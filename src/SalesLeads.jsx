import { Fragment, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import SalesCalendar from './SalesCalendar'

// Journey's own sales (Journey platform only).
//   Demo Requests — everyone who asked for a demo: Clara callers who said yes, website bookings, emails, phone calls.
//   Sales Calendar — the demo calls and blocked time.
//   Sign-ups / Other calls — sign-ups waiting to become customers, and Clara callers who didn't want a demo.
// All of it lives in sales_leads (kind = demo | signup | call). Status moves on its own when a demo is
// booked, marked done or canceled; Signed up and Lost are set here.
const JOURNEY_ORG = '5bb0e0a2-9a0a-4f45-96b9-69e7fe31ba8b'
const TZ = 'America/New_York'
const fmtPhone = (s) => { const d = String(s || '').replace(/\D/g, '').slice(-10); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : '' }
const fmtWhen = (ts) => ts ? new Date(ts).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ }) : ''
const fmtDate = (d) => d ? new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : ''
const todayET = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
const STATUS = {
  new: { l: 'New', c: '#64748B' }, demo_booked: { l: 'Demo booked', c: '#2F79C4' }, demo_done: { l: 'Demo done', c: '#7C3AED' },
  signed_up: { l: 'Signed up', c: '#16A34A' }, lost: { l: 'Lost', c: '#94A3B8' },
}
const PLANS = ['None', 'Pro Starter', 'Growing', 'Ambitious', 'Established']
const TEAMS = ['', 'Just me +1', '2-5 people', '6-10 people', '11-15 people', '16 or more']
const SOURCES = { clara: 'Clara', website: 'Website', 'website-signup': 'Website', email: 'Email', phone: 'Phone', manual: 'Entered' }
const BLANK = { contact_name: '', title: '', company_name: '', phone: '', email: '', special_interests: '', plan_chosen: 'None', team_size: '', source: 'phone', request_date: '' }

function Pill({ s }) { const x = STATUS[s] || STATUS.new; return <span style={{ background: x.c, color: '#fff', borderRadius: 999, padding: '2px 9px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{x.l}</span> }

export default function SalesLeads({ profile }) {
  const isSuper = profile?.role === 'super_admin'
  const canSee = isSuper || profile?.org_id === JOURNEY_ORG
  const [rows, setRows] = useState(null)
  const [view, setView] = useState('demos')
  const [filter, setFilter] = useState('open')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(null)
  const [edit, setEdit] = useState(null)
  const [adding, setAdding] = useState(null)
  const [msg, setMsg] = useState('')

  const load = async () => {
    const { data } = await supabase.from('sales_leads').select('*').order('created_at', { ascending: false }).limit(1000)
    setRows(data || [])
  }
  useEffect(() => { if (canSee) load() }, [])
  if (!canSee) return <div className="page-container">Journey platform account only.</div>

  const all = rows || []
  const kindOf = { demos: 'demo', signups: 'signup', calls: 'call' }[view]
  const needle = q.trim().toLowerCase()
  const list = all.filter((r) => r.kind === kindOf)
    .filter((r) => view !== 'demos' || filter === 'all' || (filter === 'open' ? ['new', 'demo_booked', 'demo_done'].includes(r.status) : r.status === filter))
    .filter((r) => !needle || [r.contact_name, r.company_name, r.email, r.phone, r.title, r.special_interests].some((v) => String(v || '').toLowerCase().includes(needle)))
  const counts = Object.fromEntries(Object.keys(STATUS).map((k) => [k, all.filter((r) => r.kind === 'demo' && r.status === k).length]))

  const save = async (id, patch) => {
    setMsg('')
    const { error } = await supabase.from('sales_leads').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { setMsg('Could not save: ' + error.message); return false }
    await load(); return true
  }
  // Signing up makes them a Journey customer (with a subscription record) — shown in Customers and the Call Console.
  const signUp = async (r) => {
    setMsg('')
    const { error } = await supabase.rpc('journey_signup_customer', { p_lead: r.id, p_plan: r.plan_chosen && r.plan_chosen !== 'None' ? r.plan_chosen : null, p_team: r.team_size || null })
    if (error) { setMsg('Could not create the customer: ' + error.message); return }
    load()
  }
  const startEdit = (r) => setEdit({ id: r.id, contact_name: r.contact_name || '', title: r.title || '', company_name: r.company_name || '', phone: fmtPhone(r.phone) || r.phone || '', email: r.email || '', special_interests: r.special_interests || '', plan_chosen: r.plan_chosen || 'None', team_size: r.team_size || '', status: r.status, lost_reason: r.lost_reason || '', notes: r.notes || '' })
  const saveEdit = async () => {
    const e = edit, digits = e.phone.replace(/\D/g, '').slice(-10)
    const ok = await save(e.id, { contact_name: e.contact_name || null, title: e.title || null, company_name: e.company_name || null, phone: digits || null, email: e.email.trim().toLowerCase() || null, special_interests: e.special_interests || null, plan_chosen: e.plan_chosen, team_size: e.team_size || null, status: e.status, lost_reason: e.status === 'lost' ? (e.lost_reason || null) : null, notes: e.notes || null })
    if (ok) setEdit(null)
  }
  const addNew = async () => {
    const a = adding
    if (!a.contact_name.trim()) { setMsg('Enter a name.'); return }
    const { error } = await supabase.from('sales_leads').insert({
      kind: 'demo', status: 'new', source: a.source, call_id: `manual-${crypto.randomUUID()}`, request_date: a.request_date || todayET(),
      contact_name: a.contact_name.trim(), title: a.title || null, company_name: a.company_name || null, phone: a.phone.replace(/\D/g, '').slice(-10) || null,
      email: a.email.trim().toLowerCase() || null, special_interests: a.special_interests || null, plan_chosen: a.plan_chosen, team_size: a.team_size || null, wants_followup: true,
    })
    if (error) { setMsg('Could not add: ' + error.message); return }
    setAdding(null); setView('demos'); setFilter('open'); load()
  }

  const F = ({ k, label, type = 'text', obj, set, opts, wide }) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12.5, fontWeight: 600, color: '#475569', gridColumn: wide ? '1 / -1' : undefined }}>{label}
      {opts ? <select value={obj[k]} onChange={(e) => set({ ...obj, [k]: e.target.value })}>{opts.map((o) => Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o} value={o}>{o || '—'}</option>)}</select>
        : type === 'area' ? <textarea rows={3} value={obj[k]} onChange={(e) => set({ ...obj, [k]: e.target.value })} />
        : <input type={type} value={obj[k]} onChange={(e) => set({ ...obj, [k]: e.target.value })} />}
    </label>
  )
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 10 }

  return (
    <div className="page-container" style={{ maxWidth: 1320 }}>
      <h1 style={{ marginBottom: 4 }}>Sales</h1>
      <p style={{ color: '#64748B', marginTop: 0 }}>Demo requests from Clara, the website, email and phone — and the demo calendar.</p>
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #E2E8F0', marginBottom: 8, flexWrap: 'wrap' }}>
        {[['demos', `Demo Requests (${all.filter((r) => r.kind === 'demo').length})`], ['calendar', 'Sales Calendar'], ['signups', `Sign-ups (${all.filter((r) => r.kind === 'signup').length})`], ['calls', `Other Clara calls (${all.filter((r) => r.kind === 'call').length})`]].map(([k, l]) => (
          <button key={k} onClick={() => { setView(k); setOpen(null); setEdit(null) }} style={{ background: 'none', border: 'none', borderBottom: view === k ? '3px solid #2F79C4' : '3px solid transparent', padding: '8px 12px', fontWeight: 700, color: view === k ? '#163E64' : '#64748B', cursor: 'pointer' }}>{l}</button>
        ))}
      </div>

      {view === 'calendar' ? <SalesCalendar /> : <>
        {view === 'signups' && <p style={{ color: '#64748B', marginTop: 4 }}>Sign-ups from the website. Each one is already a Journey customer — open the row to go to their record.</p>}
        {view === 'calls' && <p style={{ color: '#64748B', marginTop: 4 }}>People who called Clara but didn't ask for a demo. If one does, they move to Demo Requests on their own.</p>}
        <div style={{ display: 'flex', gap: 8, margin: '12px 0', flexWrap: 'wrap', alignItems: 'center' }}>
          {view === 'demos' && [['open', 'Open'], ['new', 'New'], ['demo_booked', 'Demo booked'], ['demo_done', 'Demo done'], ['signed_up', 'Signed up'], ['lost', 'Lost'], ['all', 'All']].map(([k, l]) => (
            <button key={k} className={filter === k ? 'btn btn-primary' : 'btn'} onClick={() => setFilter(k)}>{l}{counts[k] !== undefined ? ` (${counts[k]})` : ''}</button>
          ))}
          <input placeholder="Search name, company, phone, email…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 240, marginLeft: view === 'demos' ? 8 : 0 }} />
          {view === 'demos' && isSuper && <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setAdding({ ...BLANK, request_date: todayET() })}>+ Demo request</button>}
        </div>
        {msg && <div style={{ color: '#B42318', marginBottom: 8 }}>{msg}</div>}

        {adding && (
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: 14, marginBottom: 12 }}>
            <b style={{ color: '#163E64' }}>New demo request</b>
            <div style={{ ...grid, marginTop: 10 }}>
              {F({ k: "request_date", label: "Date", type: "date", obj: adding, set: setAdding })}
              {F({ k: "contact_name", label: "Name *", obj: adding, set: setAdding })}
              {F({ k: "title", label: "Title", obj: adding, set: setAdding })}
              {F({ k: "company_name", label: "Company", obj: adding, set: setAdding })}
              {F({ k: "phone", label: "Phone", type: "tel", obj: adding, set: setAdding })}
              {F({ k: "email", label: "Email", type: "email", obj: adding, set: setAdding })}
              {F({ k: "plan_chosen", label: "Plan chosen", obj: adding, set: setAdding, opts: PLANS })}
              {F({ k: "team_size", label: "Team size", obj: adding, set: setAdding, opts: TEAMS })}
              {F({ k: "source", label: "Came in by", obj: adding, set: setAdding, opts: [['phone', 'Phone'], ['email', 'Email'], ['manual', 'Other']] })}
              {F({ k: "special_interests", label: "Special interests", type: "area", obj: adding, set: setAdding, wide: true })}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}><button className="btn btn-primary" onClick={addNew}>Add</button><button className="btn" onClick={() => setAdding(null)}>Cancel</button>
              <span style={{ color: '#64748B', fontSize: 13, alignSelf: 'center' }}>To book the demo, use Block time / the Sales Calendar, or have them pick a time at journey-hvac.com/start.</span></div>
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table className="ledger-table" style={{ width: '100%' }}>
            <thead><tr><th>Date</th><th>Name</th><th>Title</th><th>Company</th><th>Phone</th><th>Email</th><th>Special interests</th><th>Plan chosen</th><th>{view === 'signups' ? 'Setup call' : 'Demo'}</th><th>Status</th><th>From</th></tr></thead>
            <tbody>
              {list.map((r) => (
                <Fragment key={r.id}>
                  <tr onClick={() => { setOpen(open === r.id ? null : r.id); setEdit(null) }} style={{ cursor: 'pointer' }}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.request_date)}</td>
                    <td><b>{r.contact_name || '—'}</b></td>
                    <td>{r.title || ''}</td>
                    <td>{r.company_name || ''}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{r.phone ? <a href={`tel:${r.phone}`} onClick={(e) => e.stopPropagation()}>{fmtPhone(r.phone)}</a> : ''}</td>
                    <td>{r.email ? <a href={`mailto:${r.email}`} onClick={(e) => e.stopPropagation()}>{r.email}</a> : ''}</td>
                    <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.special_interests || ''}>{r.special_interests || ''}</td>
                    <td>{r.plan_chosen || 'None'}</td>
                    <td style={{ whiteSpace: 'nowrap', color: r.callback_status === 'canceled' ? '#94A3B8' : undefined, textDecoration: r.callback_status === 'canceled' ? 'line-through' : undefined }}>{fmtWhen(r.callback_at)}</td>
                    <td><Pill s={r.status} /></td>
                    <td style={{ fontSize: 12.5, color: '#64748B' }}>{SOURCES[r.source] || r.source || ''}</td>
                  </tr>
                  {open === r.id && (
                    <tr><td colSpan={11} style={{ background: '#F8FAFC' }}>
                      {edit && edit.id === r.id ? (
                        <div>
                          <div style={grid}>
                            {F({ k: "contact_name", label: "Name", obj: edit, set: setEdit })}
                            {F({ k: "title", label: "Title", obj: edit, set: setEdit })}
                            {F({ k: "company_name", label: "Company", obj: edit, set: setEdit })}
                            {F({ k: "phone", label: "Phone", type: "tel", obj: edit, set: setEdit })}
                            {F({ k: "email", label: "Email", type: "email", obj: edit, set: setEdit })}
                            {F({ k: "plan_chosen", label: "Plan chosen", obj: edit, set: setEdit, opts: PLANS })}
                            {F({ k: "team_size", label: "Team size", obj: edit, set: setEdit, opts: TEAMS })}
                            {F({ k: "status", label: "Status", obj: edit, set: setEdit, opts: Object.entries(STATUS).map(([k, v]) => [k, v.l]) })}
                            {edit.status === 'lost' && F({ k: "lost_reason", label: "Why lost", obj: edit, set: setEdit })}
                            {F({ k: "special_interests", label: "Special interests", type: "area", obj: edit, set: setEdit, wide: true })}
                            {F({ k: "notes", label: "Notes / call summary", type: "area", obj: edit, set: setEdit, wide: true })}
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}><button className="btn btn-primary" onClick={saveEdit}>Save</button><button className="btn" onClick={() => setEdit(null)}>Cancel</button></div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 13.5 }}>
                          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 8, color: '#475569' }}>
                            {r.team_size && <span>👥 {r.team_size}</span>}
                            {r.language && <span>🗣 {r.language}</span>}
                            <span>Follow-up: {r.wants_followup === true ? 'OK to call' : r.wants_followup === false ? 'Declined' : '—'}{r.sms_optin_at ? ' · ✓ Text OK' : ''}{r.email_optin_at ? ' · ✓ Email OK' : ''}</span>
                            {r.callback_at && <span>Reminders: {r.reminders_ok ? [r.confirm_sent_at && 'confirmation sent', r.remind_day_sent_at && 'day-before sent', r.remind_hour_sent_at && 'hour-before sent'].filter(Boolean).join(' · ') || 'on — none sent yet' : 'off'}</span>}
                            {r.status === 'lost' && r.lost_reason && <span>Lost: {r.lost_reason}</span>}
                          </div>
                          {r.special_interests && <p style={{ margin: '4px 0' }}><b>Special interests:</b> {r.special_interests}</p>}
                          <div style={{ whiteSpace: 'pre-wrap', color: '#334155' }}>{r.notes || (r.source === 'clara' ? 'No call summary yet (it arrives a minute after the call ends).' : '')}</div>
                          {isSuper && <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                            <button className="btn" onClick={() => startEdit(r)}>Edit</button>
                            {r.status !== 'signed_up' && <button className="btn" onClick={() => signUp(r)}>Mark signed up → make customer</button>}
                            {r.customer_id && <Link className="btn" to={`/customers/${r.customer_id}`}>Open customer →</Link>}
                            {r.status !== 'lost' && <button className="btn" onClick={() => { const why = window.prompt('Why was this lost? (optional)') ; if (why !== null) save(r.id, { status: 'lost', lost_reason: why || null }) }}>Mark lost</button>}
                            {r.status === 'lost' && <button className="btn" onClick={() => save(r.id, { status: 'new', lost_reason: null })}>Reopen</button>}
                          </div>}
                        </div>
                      )}
                    </td></tr>
                  )}
                </Fragment>
              ))}
              {rows && !list.length && <tr><td colSpan={11} style={{ color: '#64748B' }}>Nothing here.</td></tr>}
              {!rows && <tr><td colSpan={11} style={{ color: '#64748B' }}>Loading…</td></tr>}
            </tbody>
          </table>
        </div>
      </>}
    </div>
  )
}
