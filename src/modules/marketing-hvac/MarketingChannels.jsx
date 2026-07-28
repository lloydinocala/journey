import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabase'
import './marketing.css'

// The channels a new org starts with. Seeded on first visit if none exist yet.
const BUILTINS = [
  { name: 'Facebook',                 channel_type: 'organic',  delivery_mode: 'api', tracked: true },
  { name: 'Instagram',                channel_type: 'organic',  delivery_mode: 'api', tracked: true },
  { name: 'YouTube',                  channel_type: 'organic',  delivery_mode: 'api', tracked: true },
  { name: 'Google Business Profile',  channel_type: 'organic',  delivery_mode: 'api', tracked: true },
  { name: 'Google Ads (PPC)',         channel_type: 'paid',     delivery_mode: 'api', tracked: true },
  { name: 'Local Services Ads',       channel_type: 'paid',     delivery_mode: 'api', tracked: true },
  { name: 'Reviews & Reputation',     channel_type: 'reviews',  delivery_mode: 'api', tracked: false },
  { name: 'Customer Re-engagement',   channel_type: 'reengage', delivery_mode: 'api', tracked: true },
]

const TYPE_LABEL = { organic: 'Organic content', paid: 'Paid ads', reviews: 'Reputation', reengage: 'Re-engagement', custom: 'Custom asset' }
const GLYPH = { organic: '#2f7be0', paid: '#6a54c4', reviews: '#c78320', reengage: '#1c9b5c', custom: '#5a6b80' }

export default function MarketingChannels({ profile }) {
  const orgId = profile?.org_id
  const [list, setList] = useState(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', channel_type: 'custom', delivery_mode: 'manual' })
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data, error } = await supabase
      .from('marketing_channels').select('*').eq('org_id', orgId).order('created_at')
    if (error) { console.error(error); setList([]); return }
    setList(data || [])
  }
  useEffect(() => { if (orgId) load() }, [orgId])

  async function seedBuiltins() {
    setBusy(true)
    const rows = BUILTINS.map((b) => ({
      ...b, org_id: orgId, is_builtin: true,
      status: b.channel_type === 'paid' ? 'setup' : 'live',
    }))
    const { error } = await supabase.from('marketing_channels').insert(rows)
    if (error) console.error(error)
    await load(); setBusy(false)
  }

  async function addCustom() {
    if (!form.name.trim()) return
    setBusy(true)
    const { error } = await supabase.from('marketing_channels').insert({
      org_id: orgId, name: form.name.trim(), channel_type: form.channel_type,
      delivery_mode: form.delivery_mode, status: 'setup', is_builtin: false, tracked: true,
    })
    if (error) console.error(error)
    setForm({ name: '', channel_type: 'custom', delivery_mode: 'manual' })
    setAdding(false); await load(); setBusy(false)
  }

  async function toggleStatus(c) {
    const next = c.status === 'live' ? 'paused' : 'live'
    await supabase.from('marketing_channels').update({ status: next }).eq('id', c.id)
    load()
  }

  if (list === null) {
    return (
      <div className="mkt"><div className="view-head"><h2>Channels &amp; assets</h2></div>
        <p className="muted">Loading…</p></div>
    )
  }

  return (
    <div className="mkt">
      <div className="view-head">
        <h2>Channels &amp; assets</h2>
        <p>The built-in channels plus any asset you add — Yelp, Angi, direct mail, a referral program, a QR code on the truck. Each gets a tracked link and lands in the same report.</p>
      </div>

      {list.length === 0 ? (
        <div className="card"><div className="card-body" style={{ textAlign: 'center' }}>
          <p style={{ marginTop: 0 }} className="muted">No channels set up for this org yet.</p>
          <button className="btn approve" disabled={busy} onClick={seedBuiltins}>
            {busy ? 'Adding…' : 'Add the built-in channels'}
          </button>
        </div></div>
      ) : (
        <div className="chan-grid">
          {list.map((c) => (
            <div className="chan-card" key={c.id}>
              <div className="top">
                <span className="glyph" style={{ background: GLYPH[c.channel_type] || '#5a6b80', width: 38, height: 38 }}>
                  {c.name.slice(0, 2)}
                </span>
                <div>
                  <div className="cname">{c.name}</div>
                  <div className="cmeta">{c.tracked ? 'Tracked link + call number' : 'Reputation signals'}</div>
                </div>
              </div>
              <div className="tags">
                <span className={`tag ${c.channel_type}`}>{TYPE_LABEL[c.channel_type] || 'Custom'}</span>
                <span className={`tag ${c.delivery_mode}`}>{c.delivery_mode === 'api' ? 'Auto post' : 'Manual'}</span>
                <span className={`tag ${c.status === 'live' ? 'live' : 'setup'}`} onClick={() => toggleStatus(c)}
                  style={{ cursor: 'pointer' }} title="Click to toggle">
                  {c.status === 'live' ? 'Live' : c.status === 'paused' ? 'Paused' : 'Setup'}
                </span>
              </div>
            </div>
          ))}

          <div className="chan-add" onClick={() => setAdding(true)}>
            <span className="plus">+</span>
            <h4>Add your own asset</h4>
            <p>Bring any channel or strategy. It gets a tracked link and lands in the same report.</p>
          </div>
        </div>
      )}

      {adding && (
        <div className="overlay" onClick={() => setAdding(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><h3>Add a marketing asset</h3>
              <button className="x" onClick={() => setAdding(false)}>×</button></div>
            <div className="modal-body">
              <div className="field"><label>Asset name</label>
                <input autoFocus placeholder="e.g. Angi, Direct-mail postcard, Truck QR"
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="field"><label>Type</label>
                <select value={form.channel_type} onChange={(e) => setForm({ ...form, channel_type: e.target.value })}>
                  <option value="custom">Custom asset</option>
                  <option value="organic">Organic content</option>
                  <option value="paid">Paid ads</option>
                  <option value="reengage">Re-engagement</option>
                </select></div>
              <div className="field"><label>How does it post?</label>
                <div className="seg">
                  <button className={form.delivery_mode === 'api' ? 'on' : ''} onClick={() => setForm({ ...form, delivery_mode: 'api' })}>Auto (API)</button>
                  <button className={form.delivery_mode === 'manual' ? 'on' : ''} onClick={() => setForm({ ...form, delivery_mode: 'manual' })}>Manual</button>
                </div></div>
              <div className="note"><span className="i">i</span><span>Manual assets still get a tracked link and QR code, so their leads and revenue show up right beside Facebook in the report.</span></div>
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={() => setAdding(false)}>Cancel</button>
              <button className="btn approve" disabled={busy} onClick={addCustom}>{busy ? 'Adding…' : 'Add asset'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
