// Lead Board — every new-business opportunity for the company, from first call to won or lost.
// Leads arrive on their own (new callers Clara or the office logs, website requests) or are
// added by hand. Drag a card between columns, or open it to change the stage.
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import { viewingOrg } from './utils/viewingOrg'

export const STAGES = [
  { key: 'new', label: 'New', color: '#00A6D6' },
  { key: 'contacted', label: 'Contacted', color: '#6B7FD7' },
  { key: 'estimate_scheduled', label: 'Estimate scheduled', color: '#B8720A' },
  { key: 'estimate_sent', label: 'Estimate sent', color: '#8E44AD' },
  { key: 'won', label: 'Won', color: '#166534' },
  { key: 'lost', label: 'Lost', color: '#B00020' },
]
const SOURCES = {
  phone_clara: 'Phone — Clara', phone: 'Phone — office', website: 'Website', customer_app: 'Customer app',
  referral: 'Referral', facebook: 'Facebook', google: 'Google', walk_in: 'Walk-in', other: 'Other',
}
const LOST_REASONS = ['Price', 'Went with another company', 'No response', 'Not ready / timing', 'Financing declined', 'Outside service area', 'Other']
const money = (n) => (n == null || n === '' ? '' : '$' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }))
const daysSince = (d) => Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000))
const label = (s) => SOURCES[s] || (s ? s.replace(/_/g, ' ') : 'Unknown')

export default function LeadBoard({ profile }) {
  const isSuper = profile?.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [orgId, setOrgId] = useState(() => profile?.org_id || viewingOrg())
  const [leads, setLeads] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(null)          // lead being edited (or {} for new)
  const [dragId, setDragId] = useState(null)
  const [q, setQ] = useState('')
  const [showReport, setShowReport] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!isSuper) return
    supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
      setOrgs(data || [])
      if (!orgId && data && data.length) setOrgId(data[0].id)
    })
  }, [])
  useEffect(() => { if (orgId) load() }, [orgId])

  async function load() {
    setLoading(true)
    const [{ data }, { data: u }] = await Promise.all([
      supabase.from('leads').select('*').eq('org_id', orgId).neq('status', 'dismissed').order('created_at', { ascending: false }),
      supabase.from('users').select('id, full_name').eq('org_id', orgId).eq('is_active', true).order('full_name'),
    ])
    setLeads(data || []); setUsers(u || []); setLoading(false)
  }

  async function moveTo(lead, status, extra = {}) {
    if (status === 'lost' && !extra.lost_reason && !lead.lost_reason) { setOpen({ ...lead, status: 'lost' }); return }
    setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, status, ...extra } : l)))
    const { error } = await supabase.from('leads').update({ status, ...extra }).eq('id', lead.id).eq('org_id', orgId)
    if (error) { setMsg(error.message); load() }
  }

  async function save(l) {
    const row = {
      customer_name: l.customer_name?.trim() || null, customer_phone: l.customer_phone?.trim() || null,
      customer_email: l.customer_email?.trim() || null, address: l.address?.trim() || null,
      source: l.source || 'other', status: l.status || 'new', notes: l.notes || null,
      estimated_value: l.estimated_value === '' || l.estimated_value == null ? null : Number(l.estimated_value),
      next_action: l.next_action || null, next_action_at: l.next_action_at || null,
      assigned_to: l.assigned_to || null, lost_reason: l.status === 'lost' ? (l.lost_reason || null) : null,
    }
    if (row.status === 'lost' && !row.lost_reason) { setMsg('Pick why the lead was lost.'); return }
    if (!row.customer_name && !row.customer_phone && !row.customer_email) { setMsg('Add a name, phone or email.'); return }
    const res = l.id
      ? await supabase.from('leads').update(row).eq('id', l.id).eq('org_id', orgId)
      : await supabase.from('leads').insert({ ...row, org_id: orgId, lead_type: 'inquiry', created_by: profile?.id || null })
    if (res.error) { setMsg(res.error.message); return }
    setOpen(null); setMsg(''); load()
  }

  async function dismiss(l) {
    await supabase.from('leads').update({ status: 'dismissed' }).eq('id', l.id).eq('org_id', orgId)
    setOpen(null); load()
  }

  // Won lead → customer record (with contact), linked back to the lead.
  async function makeCustomer(l) {
    if (l.customer_id) return
    const name = (l.customer_name || '').trim() || l.customer_phone || l.customer_email
    const parts = name.split(/\s+/)
    const { data: c, error } = await supabase.from('customers').insert({
      org_id: orgId, display_name: name, first_name: parts.length > 1 ? parts.slice(0, -1).join(' ') : name, last_name: parts.length > 1 ? parts[parts.length - 1] : null,
    }).select('id').single()
    if (error) { setMsg(error.message); return }
    await supabase.from('contacts').insert({ org_id: orgId, customer_id: c.id, name, phone: l.customer_phone || null, email: l.customer_email || null, is_billing: true, is_active: true })
    await supabase.from('leads').update({ customer_id: c.id }).eq('id', l.id).eq('org_id', orgId)
    setOpen({ ...l, customer_id: c.id }); load()
  }

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return s ? leads.filter((l) => `${l.customer_name || ''} ${l.customer_phone || ''} ${l.customer_email || ''} ${l.notes || ''} ${l.address || ''}`.toLowerCase().includes(s)) : leads
  }, [leads, q])

  const report = useMemo(() => {
    const by = {}
    for (const l of leads) {
      const k = l.source || 'other'
      by[k] = by[k] || { total: 0, won: 0, lost: 0, open: 0, wonValue: 0 }
      by[k].total++
      if (l.status === 'won') { by[k].won++; by[k].wonValue += Number(l.estimated_value) || 0 }
      else if (l.status === 'lost') by[k].lost++
      else by[k].open++
    }
    return Object.entries(by).sort((a, b) => b[1].total - a[1].total)
  }, [leads])

  const openValue = leads.filter((l) => !['won', 'lost'].includes(l.status)).reduce((s, l) => s + (Number(l.estimated_value) || 0), 0)
  const userName = (id) => (users.find((u) => u.id === id) || {}).full_name

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h2>Lead Board</h2>
          <span className="badge">{leads.filter((l) => !['won', 'lost'].includes(l.status)).length} open</span>
          {openValue > 0 && <span className="badge">{money(openValue)} in play</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input placeholder="Search leads…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 200 }} />
          <button className="logout-button" onClick={() => setShowReport(!showReport)}>{showReport ? 'Hide results' : 'Results by source'}</button>
          <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={!orgId} onClick={() => setOpen({ status: 'new', source: 'phone' })}>+ New lead</button>
        </div>
      </div>
      {isSuper && <OrgPicker orgs={orgs} value={orgId} onChange={setOrgId} />}
      {msg && !open && <div style={{ color: '#B00020', margin: '8px 0' }}>{msg}</div>}

      {showReport && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14, margin: '10px 0', background: '#fff' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Which lead sources pay off</div>
          {report.length === 0 ? <div style={{ color: 'var(--mist)' }}>No leads yet.</div> : (
            <table className="data-table">
              <thead><tr><th>Source</th><th>Leads</th><th>Open</th><th>Won</th><th>Lost</th><th>Win rate</th><th>Won value</th></tr></thead>
              <tbody>{report.map(([k, r]) => {
                const decided = r.won + r.lost
                return <tr key={k}><td>{label(k)}</td><td>{r.total}</td><td>{r.open}</td><td>{r.won}</td><td>{r.lost}</td>
                  <td>{decided ? Math.round((r.won / decided) * 100) + '%' : '—'}</td><td>{money(r.wonValue) || '—'}</td></tr>
              })}</tbody>
            </table>
          )}
          <div style={{ fontSize: 12, color: 'var(--mist)', marginTop: 6 }}>Win rate counts only leads that are won or lost.</div>
        </div>
      )}

      {loading ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STAGES.length}, minmax(190px, 1fr))`, gap: 10, overflowX: 'auto', paddingBottom: 10, marginTop: 10 }}>
          {STAGES.map((st) => {
            const items = shown.filter((l) => l.status === st.key)
            const total = items.reduce((s, l) => s + (Number(l.estimated_value) || 0), 0)
            return (
              <div key={st.key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { const l = leads.find((x) => x.id === dragId); setDragId(null); if (l && l.status !== st.key) moveTo(l, st.key) }}
                style={{ background: '#F4F7FA', borderRadius: 12, padding: 8, minHeight: 300 }}>
                <div style={{ borderTop: `4px solid ${st.color}`, padding: '6px 4px 8px', display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14 }}>
                  <span>{st.label} <span style={{ color: 'var(--mist)', fontWeight: 400 }}>({items.length})</span></span>
                  {total > 0 && <span style={{ color: 'var(--mist)', fontWeight: 400 }}>{money(total)}</span>}
                </div>
                {items.map((l) => {
                  const age = daysSince(l.stage_changed_at || l.created_at)
                  const stale = !['won', 'lost'].includes(l.status) && age >= 3
                  const due = l.next_action_at && new Date(l.next_action_at) < new Date()
                  return (
                    <div key={l.id} draggable onDragStart={() => setDragId(l.id)} onClick={() => setOpen(l)}
                      style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px', marginBottom: 8, cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,.04)' }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{l.customer_name || l.customer_phone || l.customer_email || 'Unnamed lead'}</div>
                      <div style={{ fontSize: 12, color: 'var(--mist)' }}>{label(l.source)}{l.estimated_value ? ` · ${money(l.estimated_value)}` : ''}</div>
                      {l.notes && <div style={{ fontSize: 12, marginTop: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{l.notes}</div>}
                      {l.next_action && <div style={{ fontSize: 12, marginTop: 4, color: due ? '#B00020' : '#1B3A6B' }}>Next: {l.next_action}{l.next_action_at ? ` · ${new Date(l.next_action_at).toLocaleDateString()}` : ''}</div>}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 6, color: stale ? '#B8720A' : 'var(--mist)' }}>
                        <span>{age === 0 ? 'Today' : `${age} day${age === 1 ? '' : 's'} here`}</span>
                        <span>{userName(l.assigned_to) || ''}</span>
                      </div>
                      {l.status === 'lost' && l.lost_reason && <div style={{ fontSize: 11, color: '#B00020', marginTop: 2 }}>{l.lost_reason}</div>}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {open && <LeadEditor lead={open} users={users} msg={msg} onClose={() => { setOpen(null); setMsg('') }} onSave={save} onDismiss={dismiss} onCustomer={makeCustomer} />}
    </div>
  )
}

function LeadEditor({ lead, users, msg, onClose, onSave, onDismiss, onCustomer }) {
  const [l, setL] = useState(lead)
  useEffect(() => setL(lead), [lead])
  const set = (k) => (e) => setL({ ...l, [k]: e.target.value })
  const field = { display: 'block', width: '100%', marginTop: 3 }
  const lbl = { fontSize: 13, display: 'block', marginBottom: 10 }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.35)', zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(460px, 100%)', height: '100%', overflowY: 'auto', background: '#fff', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>{l.id ? 'Lead' : 'New lead'}</h3>
          <button className="logout-button" onClick={onClose}>Close</button>
        </div>
        {l.created_at && <div style={{ fontSize: 12, color: 'var(--mist)', margin: '4px 0 12px' }}>Came in {new Date(l.created_at).toLocaleString()} · {label(l.source)}</div>}
        <label style={lbl}>Name<input style={field} value={l.customer_name || ''} onChange={set('customer_name')} /></label>
        <div style={{ display: 'flex', gap: 10 }}>
          <label style={{ ...lbl, flex: 1 }}>Phone<input style={field} value={l.customer_phone || ''} onChange={set('customer_phone')} /></label>
          <label style={{ ...lbl, flex: 1 }}>Email<input style={field} value={l.customer_email || ''} onChange={set('customer_email')} /></label>
        </div>
        <label style={lbl}>Address<input style={field} value={l.address || ''} onChange={set('address')} /></label>
        <div style={{ display: 'flex', gap: 10 }}>
          <label style={{ ...lbl, flex: 1 }}>Stage
            <select style={field} value={l.status || 'new'} onChange={set('status')}>
              {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </label>
          <label style={{ ...lbl, flex: 1 }}>Source
            <select style={field} value={l.source || 'other'} onChange={set('source')}>
              {Object.entries(SOURCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              {l.source && !SOURCES[l.source] && <option value={l.source}>{label(l.source)}</option>}
            </select>
          </label>
        </div>
        {l.status === 'lost' && (
          <label style={lbl}>Why was it lost?
            <select style={field} value={l.lost_reason || ''} onChange={set('lost_reason')}>
              <option value="">— pick one —</option>
              {LOST_REASONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <label style={{ ...lbl, flex: 1 }}>Estimated value ($)<input style={field} type="number" min="0" value={l.estimated_value ?? ''} onChange={set('estimated_value')} /></label>
          <label style={{ ...lbl, flex: 1 }}>Assigned to
            <select style={field} value={l.assigned_to || ''} onChange={set('assigned_to')}>
              <option value="">— nobody —</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </label>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <label style={{ ...lbl, flex: 2 }}>Next step<input style={field} placeholder="e.g. Call back about a quote" value={l.next_action || ''} onChange={set('next_action')} /></label>
          <label style={{ ...lbl, flex: 1 }}>By<input style={field} type="date" value={(l.next_action_at || '').slice(0, 10)} onChange={(e) => setL({ ...l, next_action_at: e.target.value || null })} /></label>
        </div>
        <label style={lbl}>Notes<textarea style={{ ...field, minHeight: 90 }} value={l.notes || ''} onChange={set('notes')} /></label>

        {msg && <div style={{ color: '#B00020', marginBottom: 8 }}>{msg}</div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => onSave(l)}>Save</button>
          {l.id && !l.customer_id && <button className="logout-button" onClick={() => onCustomer(l)}>Make customer</button>}
          {l.customer_id && <Link className="logout-button" to={`/customers/${l.customer_id}`}>Open customer →</Link>}
          {l.id && l.status === 'new' && <button className="logout-button" title="Spam, wrong number, or not a sales opportunity" onClick={() => onDismiss(l)}>Not a lead</button>}
        </div>
        {l.call_log_id && <div style={{ fontSize: 12, marginTop: 12 }}><Link to="/call-log">See the call in the Call Log →</Link></div>}
      </div>
    </div>
  )
}
