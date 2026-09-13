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
const SERVICE_AREA = 'Ocala and Central Florida — The Villages, Marion, Lake, Sumter, Citrus, Levy & Alachua counties'

export default function MarketingQueue({ profile }) {
  const orgId = profile?.org_id
  const [campaign, setCampaign] = useState(null)
  const [channels, setChannels] = useState([])
  const [orgName, setOrgName] = useState('')
  const [items, setItems] = useState(null)
  const [busy, setBusy] = useState(false)
  const [jobBusy, setJobBusy] = useState(false)
  const [fb, setFb] = useState(null)
  const [fbForm, setFbForm] = useState({ open: false, page_id: '', token: '', saving: false })
  const [imgUrls, setImgUrls] = useState({})

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
    loadFb()
  }

  async function loadFb() {
    try { const { data } = await supabase.functions.invoke('facebook-connection', { body: {} }); setFb(data || { connected: false }) }
    catch { setFb({ connected: false }) }
  }

  async function loadItems(campaignId) {
    const { data } = await supabase.from('marketing_content_items')
      .select('*').eq('org_id', orgId).eq('campaign_id', campaignId).order('created_at', { ascending: false })
    const list = data || []
    setItems(list)
    loadImages(list)
  }

  async function loadImages(list) {
    const withImg = (list || []).filter((i) => i.image_path && !imgUrls[i.id])
    if (!withImg.length) return
    const map = { ...imgUrls }
    for (const it of withImg) {
      try {
        const { data } = await supabase.storage.from('job-photos').createSignedUrl(it.image_path, 3600)
        if (data?.signedUrl) map[it.id] = data.signedUrl
      } catch { /* skip */ }
    }
    setImgUrls(map)
  }

  useEffect(() => { if (orgId) bootstrap() }, [orgId])

  async function generate() {
    if (!campaign) return
    setBusy(true)
    const live = channels.filter((c) => c.channel_type === 'organic' && c.status === 'live')
    const targets = (live.length ? live : channels.filter((c) => c.channel_type === 'organic')).slice(0, 4)
    if (targets.length === 0) {
      alert('Add some organic channels first (Channels & Assets → Add the built-in channels).')
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

  async function generateFromJob() {
    setJobBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('marketing-photo-post', { body: {} })
      if (error) throw new Error(error.message || 'invoke failed')
      if (data?.error) throw new Error(data.error === 'no_job_photos_found' ? 'No job photos found to post from.' : data.error)
      await loadItems(campaign.id)
    } catch (e) {
      console.error(e)
      alert('Photo post failed: ' + (e.message || e))
    }
    setJobBusy(false)
  }

  async function saveFb() {
    const page_id = fbForm.page_id.trim(); const token = fbForm.token.trim()
    if (!page_id || !token) { alert('Enter your Facebook Page ID and Page Access Token.'); return }
    setFbForm((f) => ({ ...f, saving: true }))
    try {
      const { data, error } = await supabase.functions.invoke('facebook-connection', { body: { action: 'save', page_id, page_access_token: token } })
      if (error) throw new Error(error.message || 'invoke failed')
      if (data?.error) throw new Error(data.detail || data.error)
      setFb(data)
      setFbForm({ open: false, page_id: '', token: '', saving: false })
    } catch (e) {
      alert('Connect failed: ' + (e.message || e))
      setFbForm((f) => ({ ...f, saving: false }))
    }
  }

  async function disconnectFb() {
    if (!confirm('Disconnect this Facebook page?')) return
    await supabase.functions.invoke('facebook-connection', { body: { action: 'disconnect' } })
    setFb({ connected: false })
  }

  async function postToFacebook(item) {
    if (!fb?.connected) { alert('Connect your Facebook page first (panel above).'); return }
    if (!confirm('Post this to your Facebook page now?')) return
    try {
      const { data, error } = await supabase.functions.invoke('facebook-publish', { body: { item_id: item.id } })
      if (error) throw new Error(error.message || 'invoke failed')
      if (data?.error) throw new Error(data.error)
      await loadItems(campaign.id)
    } catch (e) {
      alert('Post failed: ' + (e.message || e))
    }
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

      <div className="card mb16">
        <div className="card-head">
          <h3>Facebook connection</h3>
          <div className="spacer" />
          {fb?.connected
            ? <span className="post-status posted">Connected: {fb.page_name}</span>
            : <span className="post-status pending_review">Not connected</span>}
        </div>
        <div className="card-body">
          {fb?.connected ? (
            <div className="post-actions">
              <span className="muted" style={{ marginRight: 12 }}>Approved posts can publish straight to <b>{fb.page_name}</b>.</span>
              <button className="btn" onClick={disconnectFb}>Disconnect</button>
            </div>
          ) : !fbForm.open ? (
            <div>
              <div className="note" style={{ marginBottom: 12 }}><span className="i">i</span>
                <span>Connect your Facebook Page once so Command Center can post to it. You will paste your Page ID and a Page Access Token from your Meta app.</span></div>
              <button className="btn approve" onClick={() => setFbForm((f) => ({ ...f, open: true }))}>Connect Facebook page</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 620 }}>
              <label className="muted" style={{ fontSize: 13 }}>Facebook Page ID
                <input value={fbForm.page_id} onChange={(e) => setFbForm((f) => ({ ...f, page_id: e.target.value }))}
                  placeholder="e.g. 123456789012345" style={inp} /></label>
              <label className="muted" style={{ fontSize: 13 }}>Page Access Token
                <input value={fbForm.token} onChange={(e) => setFbForm((f) => ({ ...f, token: e.target.value }))}
                  placeholder="long-lived page access token" style={inp} /></label>
              <div className="post-actions">
                <button className="btn approve" disabled={fbForm.saving} onClick={saveFb}>{fbForm.saving ? 'Connecting…' : 'Save & connect'}</button>
                <button className="btn" onClick={() => setFbForm({ open: false, page_id: '', token: '', saving: false })}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="pipeline">
        {PIPELINE.map((s) => (
          <div className="stage" key={s.n}>
            <div className="snum">{s.n}</div><h4>{s.name}</h4><p>{s.desc}</p>
            <span className={`gate ${s.auto ? 'auto' : ''}`}>{s.auto ? '✓' : '⚑'} {s.gate}</span>
          </div>
        ))}
      </div>

      <div className="card mb16">
        <div className="card-head">
          <h3>Campaign · {campaign?.name || '—'}</h3>
          <span className="sub">{campaign?.goal}</span>
          <div className="spacer" />
          <button className="btn" disabled={jobBusy} onClick={generateFromJob} style={{ marginRight: 8 }}>{jobBusy ? 'Reading photos…' : '📷 Post from a completed job'}</button>
          <button className="btn approve" disabled={busy} onClick={generate}>{busy ? 'Writing…' : '✨ Generate drafts with Claude'}</button>
        </div>
        <div className="card-body">
          <div className="note" style={{ marginBottom: 14 }}>
            <span className="i">i</span>
            <span>Drafts are written live by Claude, on-brand for your HVAC business and service area, then saved here as pending review. “Post from a completed job” turns your latest job photos into a post. Approve to schedule — nothing posts without your yes.</span>
          </div>

          {items.length === 0 && <p className="muted">No drafts yet. Generate with Claude, or turn a completed job’s photos into a post.</p>}

          {items.map((it) => {
            const ch = chanFor(it.channel_id)
            return (
              <div className="post-card" key={it.id}>
                <div className="post-top">
                  <span className="glyph" style={{ background: GLYPH[ch?.channel_type] || '#5a6b80', width: 24, height: 24 }}>
                    {(ch?.name || 'Ch').slice(0, 2)}
                  </span>
                  <span className="cname">{ch?.name || 'Unassigned channel'}</span>
                  {it.ai_generated && <span className="when">· Claude draft</span>}
                  <div className="spacer" />
                  <span className={`post-status ${it.status}`}>{STATUS_LABEL[it.status] || it.status}</span>
                </div>
                <div className="post-body">
                  {it.image_path && imgUrls[it.id] && (
                    <img src={imgUrls[it.id]} alt="job" style={{ width: '100%', maxWidth: 380, borderRadius: 10, marginBottom: 10, display: 'block' }} />
                  )}
                  <div className="text">{it.body}</div>
                  {it.media_note && !it.image_path && <div className="media">🖼 {it.media_note}</div>}
                </div>
                {it.status === 'pending_review' && (
                  <div className="post-actions">
                    {fb?.connected && <button className="btn approve" onClick={() => postToFacebook(it)}>Post to Facebook now</button>}
                    <button className="btn" onClick={() => setStatus(it, 'scheduled')}>Approve &amp; schedule</button>
                    <button className="btn reject" onClick={() => setStatus(it, 'rejected')}>Reject</button>
                  </div>
                )}
                {it.status === 'scheduled' && (
                  <div className="post-actions">
                    {fb?.connected && <button className="btn approve" onClick={() => postToFacebook(it)}>Post to Facebook now</button>}
                    <button className="btn" onClick={() => setStatus(it, 'posted')}>Mark posted</button>
                    <button className="btn" onClick={() => setStatus(it, 'pending_review')}>Send back</button>
                  </div>
                )}
                {it.status === 'posted' && it.external_post_id && (
                  <div className="post-actions">
                    <a className="btn" href={`https://facebook.com/${it.external_post_id}`} target="_blank" rel="noreferrer">View on Facebook</a>
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

const inp = { display: 'block', width: '100%', marginTop: 4, padding: '9px 11px', border: '1px solid #cdd7e1', borderRadius: 8, fontSize: 14 }
