import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FieldShell from './FieldShell'
import { supabase } from '../utils/supabase'
import PushToggle from '../push/PushToggle'
import { callFn } from './fieldUtil'

// SETUP CHECKLIST — everything a one-truck company needs in place to run Journey from the phone.
const isAdmin = (p) => p?.role === 'org_admin' || p?.role === 'super_admin'
const back = (navigate) => () => navigate('/tech/field/admin')
export const justMeKey = (orgId) => `fa_just_me_${orgId}`

export default function FieldSetup({ profile }) {
  const navigate = useNavigate()
  const orgId = profile?.org_id
  const admin = isAdmin(profile)
  const [s, setS] = useState(null)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState(null)
  const [justMe, setJustMe] = useState(() => { try { return localStorage.getItem(justMeKey(orgId)) === '1' } catch { return false } })

  async function load() {
    const { data: o } = await supabase.from('organizations')
      .select('name, business_phone, business_street, business_city, email_sender_status, email_from_address, sms_number_status, sms_from_number, stripe_account_id, stripe_charges_enabled, business_hours, field_pricebook')
      .eq('id', orgId).maybeSingle()
    const book = o?.field_pricebook || 'res_flat_rate'
    const table = book === 'duct_cleaning' ? 'duct_pricebook_items' : book === 'time_materials' ? 'part_items' : 'services'
    const [{ count: items }, { count: types }, { count: people }] = await Promise.all([
      supabase.from(table).select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('is_active', true),
      supabase.from('job_types').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('is_active', true),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('org_id', orgId).neq('is_active', false),
    ])
    setS({ o: o || {}, items: items || 0, types: types || 0, people: people || 0 })
  }
  useEffect(() => { if (orgId) load() }, [orgId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function connectStripe() {
    setBusy('stripe'); setMsg(null)
    const { data, error } = await callFn('stripe-connect-onboarding', { orgId })
    setBusy('')
    if (error) { setMsg({ k: 'stripe', ok: false, t: error }); return }
    if (data?.url) window.location.href = data.url
  }
  async function requestNumber() {
    setBusy('sms'); setMsg(null)
    const { data, error } = await callFn('field-report-email', { action: 'feedback', body: `TEXTING NUMBER REQUEST — ${s.o.name || ''} would like its own texting number so customer texts come from the company. Business phone: ${s.o.business_phone || 'not set'}.` })
    setBusy('')
    setMsg(error ? { k: 'sms', ok: false, t: error } : { k: 'sms', ok: true, t: data?.emailed === false ? 'Request saved. Journey will reach out to set it up.' : 'Request sent. Journey will reach out to set it up.' })
  }
  function toggleJustMe() {
    const v = !justMe
    setJustMe(v)
    try { localStorage.setItem(justMeKey(orgId), v ? '1' : '0') } catch { /* private mode */ }
  }

  const o = s?.o || {}
  const steps = s ? [
    { k: 'company', label: 'Company profile', done: !!(o.name && o.business_phone && o.business_street && o.business_city), note: 'Name, address and phone that customers see.', go: '/tech/field/admin/company' },
    { k: 'email', label: 'Email sender', done: o.email_sender_status === 'verified', note: o.email_sender_status === 'pending' ? `Waiting on you to click the link sent to ${o.email_from_address}.` : 'Invoices, estimates and confirmations go out from this address.', go: '/tech/field/admin/company' },
    { k: 'sms', label: 'Texting number', done: o.sms_number_status === 'own_number' && !!o.sms_from_number, note: o.sms_number_status === 'own_number' ? 'Customer texts come from your own number.' : 'Texts go out from Journey\'s shared number until you have your own.', action: o.sms_number_status !== 'own_number' && admin ? ['Request a number', requestNumber] : null },
    { k: 'stripe', label: 'Card payments', done: !!o.stripe_charges_enabled, note: o.stripe_charges_enabled ? 'Customers can pay invoices by card.' : o.stripe_account_id ? 'Stripe still needs a few details from you.' : 'Let customers pay by card from the invoice link.', action: !o.stripe_charges_enabled && admin ? [o.stripe_account_id ? 'Finish with Stripe' : 'Connect Stripe', connectStripe] : null },
    { k: 'price', label: 'Pricebook', done: s.items > 0, note: s.items ? `${s.items} items.` : 'Add the services you sell and what you charge.', go: '/tech/field/admin/pricebook' },
    { k: 'hours', label: 'Business hours', done: !!o.business_hours, note: 'When customers can book you online.', go: '/tech/field/admin/hours' },
    { k: 'types', label: 'Job types', done: s.types > 0, note: s.types ? `${s.types} job types.` : 'The kinds of jobs you run.', go: '/tech/field/admin/job-types' },
    { k: 'team', label: 'Team', done: s.people > 1 || justMe, note: s.people > 1 ? `${s.people} people.` : justMe ? 'Just you — team and payroll screens are tucked away.' : 'Add a helper, or tell Journey it\'s just you.', go: '/tech/field/team', action: s.people <= 1 && admin ? [justMe ? 'Not just me' : 'It\'s just me', toggleJustMe] : null },
  ] : []
  const done = steps.filter((x) => x.done).length
  return (
    <FieldShell profile={profile} title="Admin" onBack={back(navigate)}>
      <div className="fa-panel">
        <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 18 }}>Setup Checklist</div>
        {!s ? <p className="fa-empty">Loading…</p> : (<>
          <div className="fa-muted" style={{ textAlign: 'center', marginTop: -4 }}>{done} of {steps.length} done</div>
          <div style={{ height: 8, background: '#E3EAF0', borderRadius: 6, overflow: 'hidden' }}><div style={{ width: `${(done / steps.length) * 100}%`, height: '100%', background: '#1B7A3D' }} /></div>
          {steps.map((x) => (
            <div key={x.k} className="fa-info" role={x.go ? 'button' : undefined} tabIndex={x.go ? 0 : undefined} style={{ cursor: x.go ? 'pointer' : 'default', padding: '10px 12px' }} onClick={() => x.go && navigate(x.go)}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 24, height: 24, borderRadius: 12, flex: '0 0 24px', display: 'grid', placeItems: 'center', fontWeight: 900, color: '#fff', background: x.done ? '#1B7A3D' : '#B8C4CF' }}>{x.done ? '✓' : ''}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 15.5 }}>{x.label}{x.go ? ' ›' : ''}</div>
                  <div className="fa-muted" style={{ fontSize: 12.5 }}>{x.note}</div>
                  {x.action && <button type="button" className="fa-small-btn" style={{ marginTop: 8, fontSize: 14, padding: '6px 12px' }} disabled={!!busy} onClick={(e) => { e.stopPropagation(); x.action[1]() }}>{busy === x.k ? 'Working…' : x.action[0]}</button>}
                  {msg?.k === x.k && <div className={`fa-msg ${msg.ok ? 'ok' : 'err'}`} style={{ marginTop: 6 }}>{msg.t}</div>}
                </div>
              </div>
            </div>
          ))}
          <div className="fa-section-label" style={{ marginTop: 4 }}>This phone</div>
          <PushToggle profile={profile} />
        </>)}
      </div>
    </FieldShell>
  )
}

// ---------- Business hours ----------
const DAYS = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']]
export function FieldBusinessHours({ profile }) {
  const navigate = useNavigate()
  const admin = isAdmin(profile)
  const [week, setWeek] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  useEffect(() => {
    if (!profile?.org_id) return
    supabase.from('organizations').select('business_hours, business_hours_start, business_hours_end').eq('id', profile.org_id).maybeSingle().then(({ data }) => {
      const open = String(data?.business_hours_start || '08:00').slice(0, 5)
      const close = String(data?.business_hours_end || '17:00').slice(0, 5)
      const bh = (data?.business_hours && typeof data.business_hours === 'object') ? { ...data.business_hours } : {}
      for (const [k] of DAYS) if (!bh[k]) bh[k] = { closed: k === 'sun', open, close, extended: false }
      setWeek(bh)
    })
  }, [profile?.org_id])
  const setDay = (k, patch) => { setWeek((w) => ({ ...w, [k]: { ...w[k], ...patch } })); setMsg(null) }
  async function save() {
    setBusy(true)
    const openDays = DAYS.map(([k]) => week[k]).filter((d) => !d.closed)
    const start = openDays.length ? openDays.reduce((a, d) => (d.open < a ? d.open : a), '23:59') : '08:00'
    const end = openDays.length ? openDays.reduce((a, d) => (d.close > a ? d.close : a), '00:00') : '17:00'
    const { error } = await supabase.from('organizations').update({ business_hours: week, business_hours_start: start, business_hours_end: end }).eq('id', profile.org_id)
    setBusy(false)
    setMsg(error ? { ok: false, t: error.message } : { ok: true, t: 'Saved.' })
  }
  const t = { border: '1.5px solid #C9D6E2', borderRadius: 8, padding: '6px 2px', fontSize: 13.5, fontFamily: 'inherit', width: '100%', minWidth: 0, background: '#fff' }
  return (
    <FieldShell profile={profile} title="Admin" onBack={() => navigate(-1)}>
      <div className="fa-panel">
        <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 18 }}>Business Hours</div>
        {!week ? <p className="fa-empty">Loading…</p> : (<>
          {DAYS.map(([k, l]) => {
            const d = week[k]
            return (
              <div key={k} className="fa-info" style={{ padding: '8px 10px', display: 'grid', gridTemplateColumns: '38px 1fr 1fr 46px', gap: 4, alignItems: 'center', opacity: d.closed ? 0.6 : 1 }}>
                <b>{l}</b>
                <input style={t} type="time" disabled={!admin || d.closed} value={d.open} onChange={(e) => setDay(k, { open: e.target.value })} aria-label={`${l} opens`} />
                <input style={t} type="time" disabled={!admin || d.closed} value={d.close} onChange={(e) => setDay(k, { close: e.target.value })} aria-label={`${l} closes`} />
                <label style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><input type="checkbox" disabled={!admin} checked={!!d.closed} onChange={(e) => setDay(k, { closed: e.target.checked })} />Off</label>
              </div>
            )
          })}
          <div className="fa-muted" style={{ fontSize: 12.5, margin: '0 4px' }}>Holidays and after-hours rules are on the desktop under Settings → Business Hours.</div>
          {msg && <div className={`fa-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.t}</div>}
          {admin && <button type="button" className="fa-navbtn" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>}
        </>)}
      </div>
    </FieldShell>
  )
}

// ---------- Job types ----------
export function FieldJobTypes({ profile }) {
  const navigate = useNavigate()
  const admin = isAdmin(profile)
  const orgId = profile?.org_id
  const [rows, setRows] = useState(null)
  const [name, setName] = useState('')
  const [edit, setEdit] = useState(null)
  const [msg, setMsg] = useState(null)
  async function load() {
    const { data } = await supabase.from('job_types').select('id, name, sort_order, is_active').eq('org_id', orgId).order('sort_order').order('name')
    setRows(data || [])
  }
  useEffect(() => { if (orgId) load() }, [orgId]) // eslint-disable-line react-hooks/exhaustive-deps
  async function add() {
    const n = name.trim().toUpperCase()
    if (!n) return
    if ((rows || []).some((r) => r.name.toUpperCase() === n)) { setMsg({ ok: false, t: 'That job type already exists.' }); return }
    const sort = Math.max(0, ...(rows || []).map((r) => r.sort_order || 0)) + 1
    const { error } = await supabase.from('job_types').insert({ org_id: orgId, name: n, sort_order: sort, is_active: true })
    if (error) { setMsg({ ok: false, t: error.message }); return }
    setName(''); setMsg({ ok: true, t: `Added ${n}.` }); load()
  }
  async function saveEdit() {
    const n = edit.name.trim().toUpperCase()
    if (!n) return
    const { error } = await supabase.from('job_types').update({ name: n, is_active: edit.is_active }).eq('id', edit.id)
    if (error) { setMsg({ ok: false, t: error.message }); return }
    setEdit(null); setMsg({ ok: true, t: 'Saved.' }); load()
  }
  return (
    <FieldShell profile={profile} title="Admin" onBack={() => navigate(-1)}>
      <div className="fa-panel">
        <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 18 }}>Job Types</div>
        {admin && (
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="fa-input" style={{ flex: 1, fontSize: 16 }} placeholder="New job type, e.g. SERVICE CALL" value={name} onChange={(e) => setName(e.target.value)} />
            <button type="button" className="fa-small-btn" disabled={!name.trim()} onClick={add}>Add</button>
          </div>
        )}
        {msg && <div className={`fa-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.t}</div>}
        {!rows ? <p className="fa-empty">Loading…</p> : !rows.length ? <p className="fa-empty">No job types yet.</p> : rows.map((r) => (
          edit?.id === r.id ? (
            <div key={r.id} className="fa-info" style={{ display: 'grid', gap: 6 }}>
              <input className="fa-input" style={{ fontSize: 16 }} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}><input type="checkbox" checked={edit.is_active} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} /> In use</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="fa-small-btn" onClick={saveEdit}>Save</button>
                <button type="button" className="fa-small-btn" style={{ background: '#fff', color: 'var(--fa-navy)' }} onClick={() => setEdit(null)}>Cancel</button>
              </div>
              <div className="fa-muted" style={{ fontSize: 12 }}>Renaming doesn&apos;t change jobs already booked under the old name.</div>
            </div>
          ) : (
            <div key={r.id} className="fa-info" role="button" tabIndex={0} style={{ cursor: admin ? 'pointer' : 'default', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', opacity: r.is_active ? 1 : 0.55 }} onClick={() => admin && setEdit({ ...r })}>
              <b>{r.name}</b>{!r.is_active && <span className="fa-muted">not in use</span>}
            </div>
          )
        ))}
      </div>
    </FieldShell>
  )
}
