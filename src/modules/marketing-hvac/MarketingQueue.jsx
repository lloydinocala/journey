import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabase'
import './marketing.css'

const PIPELINE = [
  { n: '1', name: 'Plan', desc: 'AI drafts a calendar with the admin', gate: 'With admin' },
  { n: '2', name: 'Create', desc: 'AI writes posts for approval', gate: 'Admin approves' },
  { n: '3', name: 'Schedule', desc: 'AI proposes timing from what converts', gate: 'Admin approves' },
  { n: '4', name: 'Post', desc: 'Publishes once approved', gate: 'Auto after approval', auto: true },
  { n: '5', name: 'Report', desc: 'Results roll up to the dashboard', gate: 'Live', auto: true },
]

// v1 sample drafts. Next pass: replace this with a live Claude call (edge function, same pattern as Apollo).
const CANNED = [
  "Florida summer is no joke \u2600\uFE0F Is your AC keeping up? Get a real, guaranteed price for a new system in about 2 minutes \u2014 no appointment, no salesperson, no pressure. Get your instant estimate \uD83D\uDC47",
  "Your AC shouldn\u2019t cost you a mystery. See a transparent price for a new system \u2014 financing from $111/mo. Tap for your instant estimate.",
  "Now booking same-week AC installs across Marion, Lake & Sumter counties. Get an instant online estimate and lock your price today.",
  "Heat wave incoming \uD83E\uDD75 Before your AC gives out, find out what a new system actually costs \u2014 real guaranteed pricing in 2 minutes. No pushy sales call.",
]
const STATUS_LABEL = { draft: 'Draft', pending_review: 'Needs review', approved: 'Approved', scheduled: 'Scheduled', posted: 'Posted', rejected: 'Rejected' }
const GLYPH = { organic: '#2f7be0', paid: '#6a54c4', reviews: '#c78320', reengage: '#1c9b5c', custom: '#5a6b80' }

export default function MarketingQueue({ profile }) {
  const orgId = profile?.org_id
  const [campaign, setCampaign] = useState(null)
  const [channels, setChannels] = useState([])
  const [items, setItems] = useState(null)
  const [busy, setBusy] = useState(false)

  async function bootstrap() {
    // Channels (for attaching drafts + showing names)
    const { data: chans } = await supabase.from('marketing_channels').select('*').eq('org_id', orgId).order('created_at')
    setChannels(chans || [])

    // Find or create a working campaign
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
    const organic = channels.filter((c) => c.channel_type === 'organic')
    const pool = organic.length ? organic : channels
    const channel = pool[(items?.length || 0) % Math.max(pool.length, 1)] || null
    const body = CANNED[(items?.length || 0) % CANNED.length]
    const { error } = await supabase.from('marketing_content_items').insert({
      org_id: orgId, campaign_id: campaign.id, channel_id: channel?.id || null,
      body, media_note: 'Suggested: exterior condenser install photo',
      status: 'pending_review', ai_generated: true,
    })
    if (error) console.error(error)
    await loadItems(campaign.id); setBusy(false)
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
    return <div className="mkt"><div className="view-head"><h2>Approval queue</h2></div><p className="muted">Loading…</p></div>
  }

  return (
    <div className="mkt">
      <div className="view-head">
        <h2>Approval queue</h2>
        <p>Claude plans and drafts; you approve. Nothing publishes — and nothing spends — without a human yes.</p>
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
          <h3>Campaign · {campaign?.name || '—'}</h3>
          <span className="sub">{campaign?.goal}</span>
          <div className="spacer" />
          <button className="btn approve" disabled={busy} onClick={generate}>{busy ? 'Generating…' : '\u2728 Generate drafts'}</button>
        </div>
        <div className="card-body">
          <div className="note" style={{ marginBottom: 14 }}>
            <span className="i">i</span>
            <span><strong>Note:</strong> drafts are sample content for now and persist to the real database. The live Claude call (same edge-function pattern as Apollo) drops in next pass.</span>
          </div>

          {items.length === 0 && <p className="muted">No drafts yet. Hit “Generate drafts” to create the first ones.</p>}

          {items.map((it) => {
            const ch = chanFor(it.channel_id)
            return (
              <div className="post-card" key={it.id}>
                <div className="post-top">
                  <span className="glyph" style={{ background: GLYPH[ch?.channel_type] || '#5a6b80', width: 24, height: 24 }}>
                    {(ch?.name || 'Ch').slice(0, 2)}
                  </span>
                  <span className="cname">{ch?.name || 'Unassigned channel'}</span>
                  {it.ai_generated && <span className="when">· AI draft</span>}
                  <div className="spacer" />
                  <span className={`post-status ${it.status}`}>{STATUS_LABEL[it.status] || it.status}</span>
                </div>
                <div className="post-body">
                  <div className="text">{it.body}</div>
                  {it.media_note && <div className="media">🖼 {it.media_note}</div>}
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
