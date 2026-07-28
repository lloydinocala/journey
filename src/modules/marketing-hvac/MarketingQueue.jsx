import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabase'
import './marketing.css'

const PIPELINE = [
  { n: '1', name: 'Plan', desc: 'AI drafts a calendar with the admin', gate: 'With admin' },
  { n: '2', name: 'Create', desc: 'Claude writes posts for approval', gate: 'Admin approves' },
  { n: '3', name: 'Schedule', desc: 'AI proposes timing from what converts', gate: 'Admin approves' },
  { n: '4', name: 'Post', desc: 'Publishes once approved', gate: 'Auto after approval', auto: true },
  { n: '5', name: 'Report', desc: 'Results roll up to the dashboard', gate: 'Live', auto: true },
]

const STATUS_LABEL = { draft: 'Draft', pending_review: 'Needs review', approved: 'Approved', scheduled: 'Scheduled', posted: 'Posted', rejected: 'Rejected' }
const GLYPH = { organic: '#2f7be0', paid: '#6a54c4', reviews: '#c78320', reengage: '#1c9b5c', custom: '#5a6b80' }
const SERVICE_AREA = 'Ocala and Central Florida \u2014 The Villages, Marion, Lake, Sumter, Citrus, Levy & Alachua counties'

export default function MarketingQueue({ profile }) {
  const orgId = profile?.org_id
  const [campaign, setCampaign] = useState(null)
  const [channels, setChannels] = useState([])
  const [orgName, setOrgName] = useState('')
  const [items, setItems] = useState(null)
  const [busy, setBusy] = useState(false)

  async function bootstrap() {
    const { data: chans } = await supabase.from('marketing_channels').select('*').eq('org_id', orgId).order('created_at')
    setChannels(chans || [])

    const { data: org } = await supabase.from('organizations').select('name').eq('id', orgId).maybeSingle()
    setOrgName(org?.name || '')

    let { data: camps } = await supabase.from('marketing_campaigns').select('*').eq('org_id', orgId).order('created_at').limit(1)
    let camp = camps && camps[0]
    if (!camp) {
      const { data: created } = await supabase.from('marketing_campaigns').insert({
        org_id: orgId, name: 'Spring AC tune-up', goal: 'Instant-estimate leads',
        campaign_type: 'content', status: 'active', created_by: profile?.id || null,
      }).select().single()
      camp = created
    }
    setCampaign(camp)
    await loadItems(camp.id)
  }

  async function loadItems(campaignId) {
    const { data } = await supabase.from('marketing_content_items')
      .select('*').eq('org_id', orgId).eq('campaign_id', campaignId).order('created_at', { ascending: false })
    setItems(data || [])
  }

  useEffect(() => { if (orgId) bootstrap() }, [orgId])

  async function generate() {
    if (!campaign) return
    setBusy(true)
    const live = channels.filter((c) => c.channel_type === 'organic' && c.status === 'live')
    const targets = (live.length ? live : channels.filter((c) => c.channel_type === 'organic')).slice(0, 4)
    if (targets.length === 0) {
      alert('Add some organic channels first (Channels & Assets \u2192 Add the built-in channels).')
      setBusy(false); return
    }
    try {
      const { data, error } = await supabase.functions.invoke('marketing-generate', {
        body: {
          orgName: orgName || 'Air-Care Connect',
          serviceArea: SERVICE_AREA,
          goal: campaign.goal || 'instant-estimate leads',
          count: 1,
          channels: targets.map((c) => ({ name: c.name, type: c.channel_type })),
        },
      })
      if (error) throw new Error(error.message || 'invoke failed')
      if (data?.error) throw new Error(data.error)
      const drafts = Array.isArray(data?.drafts) ? data.drafts : []
      if (drafts.length === 0) throw new Error('No drafts returned.')
      const rows = drafts.map((d) => {
        const ch = targets.find((c) => c.name === d.channel) || targets[0]
        return {
          org_id: orgId, campaign_id: campaign.id, channel_id: ch?.id || null,
          body: d.body, media_note: d.media_note || null,
          status: 'pending_review', ai_generated: true,
        }
      })
      await supabase.from('marketing_content_items').insert(rows)
      await loadItems(campaign.id)
    } catch (e) {
      console.error(e)
      alert('Draft generation failed: ' + (e.message || e))
    }
    setBusy(false)
  }

  async function setStatus(item, status) {
    const patch = { status }
    if (status === 'scheduled') { patch.approved_by = profile?.id || null; patch.approved_at = new Date().toISOString() }
    if (status === 'posted') { patch.posted_at = new Date().toISOString() }
    await supabase.from('marketing_content_items').update(patch).eq('id', item.id)
    loadItems(campaign.id)
  }

  const chanFor = (id) => channels.find((c) => c.id === id)

  if (items === null) {
    return <div className="mkt"><div className="view-head"><h2>Approval queue</h2></div><p className="muted">Loading\u2026</p></div>
  }

  return (
    <div className="mkt">
      <div className="view-head">
        <h2>Approval queue</h2>
        <p>Claude plans and drafts; you approve. Nothing publishes \u2014 and nothing spends \u2014 without a human yes.</p>
      </div>

      <div className="pipeline">
        {PIPELINE.map((s) => (
          <div className="stage" key={s.n}>
            <div className="snum">{s.n}</div><h4>{s.name}</h4><p>{s.desc}</p>
            <span className={`gate ${s.auto ? 'auto' : ''}`}>{s.auto ? '\u2713' : '\u2691'} {s.gate}</span>
          </div>
        ))}
      </div>

      <div className="card mb16">
        <div className="card-head">
          <h3>Campaign \u00b7 {campaign?.name || '\u2014'}</h3>
          <span className="sub">{campaign?.goal}</span>
          <div className="spacer" />
          <button className="btn approve" disabled={busy} onClick={generate}>{busy ? 'Writing\u2026' : '\u2728 Generate drafts with Claude'}</button>
        </div>
        <div className="card-body">
          <div className="note" style={{ marginBottom: 14 }}>
            <span className="i">i</span>
            <span>Drafts are written live by Claude, on-brand for your HVAC business and service area, then saved here as pending review. Approve to schedule \u2014 nothing posts without your yes.</span>
          </div>

          {items.length === 0 && <p className="muted">No drafts yet. Hit \u201cGenerate drafts with Claude\u201d to write the first batch across your live channels.</p>}

          {items.map((it) => {
            const ch = chanFor(it.channel_id)
            return (
              <div className="post-card" key={it.id}>
                <div className="post-top">
                  <span className="glyph" style={{ background: GLYPH[ch?.channel_type] || '#5a6b80', width: 24, height: 24 }}>
                    {(ch?.name || 'Ch').slice(0, 2)}
                  </span>
                  <span className="cname">{ch?.name || 'Unassigned channel'}</span>
                  {it.ai_generated && <span className="when">\u00b7 Claude draft</span>}
                  <div className="spacer" />
                  <span className={`post-status ${it.status}`}>{STATUS_LABEL[it.status] || it.status}</span>
                </div>
                <div className="post-body">
                  <div className="text">{it.body}</div>
                  {it.media_note && <div className="media">\uD83D\uDDBC {it.media_note}</div>}
                </div>
                {it.status === 'pending_review' && (
                  <div className="post-actions">
                    <button className="btn approve" onClick={() => setStatus(it, 'scheduled')}>Approve &amp; schedule</button>
                    <button className="btn reject" onClick={() => setStatus(it, 'rejected')}>Reject</button>
                  </div>
                )}
                {it.status === 'scheduled' && (
                  <div className="post-actions">
                    <button className="btn approve" onClick={() => setStatus(it, 'posted')}>Mark posted</button>
                    <button className="btn" onClick={() => setStatus(it, 'pending_review')}>Send back</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
