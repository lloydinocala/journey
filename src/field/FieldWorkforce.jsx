import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import FieldShell, { todayISO, shiftISO } from './FieldShell'
import { supabase } from '../utils/supabase'

// WORKFORCE — Team (add / edit people) and Hours (the Monday–Sunday pay week from the time clock).
const PR_TAX = 0.0765 // employer Social Security + Medicare
const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
// 42.5 · 17.0 · 0.0
const fmtHrs = (n) => { const v = Math.round((Number(n) || 0) * 100) / 100; return Number.isInteger(v) ? v.toFixed(1) : String(v) }
const isAdmin = (p) => p?.role === 'org_admin' || p?.role === 'super_admin'

export default function FieldWorkforce({ profile }) {
  const navigate = useNavigate()
  return (
    <FieldShell profile={profile} title="WorkForce" onBack={() => navigate('/tech/field')}>
      <div className="fa-panel fa-menu-list">
        <button type="button" className="fa-navbtn" onClick={() => navigate('/tech/field/team')}>Team</button>
        <button type="button" className="fa-navbtn" onClick={() => navigate('/tech/field/hours')}>Hours</button>
      </div>
    </FieldShell>
  )
}

// ---------- Team ----------
const ROLES = [['tech', 'Technician'], ['supervisor', 'Field Supervisor'], ['office', 'Office'], ['admin', 'Admin']]
const roleKey = (u) => (u.role === 'org_admin' || u.role === 'super_admin' ? 'admin' : u.role === 'csr' ? 'office' : u.is_field_supervisor ? 'supervisor' : 'tech')
const roleFields = (k) => (k === 'admin' ? { role: 'org_admin', is_field_supervisor: true } : k === 'office' ? { role: 'csr' } : k === 'supervisor' ? { role: 'tech', is_field_supervisor: true } : { role: 'tech', is_field_supervisor: false })
const blankMember = { id: null, full_name: '', email: '', calendar_color: '#1676B8', hire_date: todayISO(), standard_hourly_rate: '', is_active: true, rk: 'tech' }

export function FieldTeam({ profile }) {
  const navigate = useNavigate()
  const orgId = profile?.org_id
  const admin = isAdmin(profile)
  const [people, setPeople] = useState([])
  const [sel, setSel] = useState('')
  const [m, setM] = useState(null)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState(null)
  const set = (k, v) => setM((x) => ({ ...x, [k]: v }))

  async function load(keep) {
    const { data } = await supabase.from('users').select('id, full_name, email, role, is_field_supervisor, calendar_color, hire_date, standard_hourly_rate, is_active').eq('org_id', orgId).order('full_name')
    setPeople(data || [])
    if (keep) { const u = (data || []).find((x) => x.id === keep); if (u) setM({ ...u, rk: roleKey(u), standard_hourly_rate: u.standard_hourly_rate ?? '' }) }
  }
  useEffect(() => { if (orgId) load() }, [orgId]) // eslint-disable-line react-hooks/exhaustive-deps

  function pick(v) {
    setSel(v); setMsg(null)
    if (v === 'new') setM({ ...blankMember })
    else { const u = people.find((x) => x.id === v); setM(u ? { ...u, rk: roleKey(u), standard_hourly_rate: u.standard_hourly_rate ?? '' } : null) }
  }
  const ok = (t) => setMsg({ ok: true, t })
  const bad = (t) => setMsg({ ok: false, t })
  async function fnErr(error, data) {
    if (data?.error) return data.error
    if (!error) return ''
    try { const b = await error.context?.json(); if (b?.error) return b.error } catch { /* generic */ }
    return error.message
  }

  async function invite() {
    if (!m.full_name.trim() || !m.email.trim()) { bad('Enter a name and email.'); return }
    setBusy('invite'); setMsg(null)
    const rf = roleFields(m.rk)
    const { data, error } = await supabase.functions.invoke('create-team-member', { body: { action: 'invite', email: m.email.trim(), full_name: m.full_name.trim(), role: rf.role, org_id: orgId, calendar_color: m.calendar_color, permission_keys: [] } })
    const e = await fnErr(error, data)
    if (e) { setBusy(''); bad(e); return }
    const uid = data?.user_id
    if (uid) await supabase.from('users').update({ hire_date: m.hire_date || null, standard_hourly_rate: m.standard_hourly_rate === '' ? null : Number(m.standard_hourly_rate), is_field_supervisor: !!rf.is_field_supervisor }).eq('id', uid)
    setBusy(''); ok(`Invite sent to ${m.email.trim()}.`)
    await load(uid); if (uid) setSel(uid)
  }
  async function saveEdit() {
    setBusy('edit'); setMsg(null)
    const u = people.find((x) => x.id === m.id)
    const patch = { full_name: m.full_name.trim(), calendar_color: m.calendar_color, hire_date: m.hire_date || null }
    if (admin) Object.assign(patch, { standard_hourly_rate: m.standard_hourly_rate === '' ? null : Number(m.standard_hourly_rate), ...(u?.role === 'super_admin' ? {} : roleFields(m.rk)) })
    const { error } = await supabase.from('users').update(patch).eq('id', m.id)
    if (error) { setBusy(''); bad(error.message); return }
    if (admin && m.email.trim() && m.email.trim() !== u?.email) {
      const { data, error: e2 } = await supabase.functions.invoke('create-team-member', { body: { action: 'update_email', user_id: m.id, new_email: m.email.trim() } })
      const e = await fnErr(e2, data)
      if (e) { setBusy(''); bad(e); return }
    }
    setBusy(''); ok('Saved.'); load(m.id)
  }
  async function resetPw() {
    setBusy('reset'); setMsg(null)
    const { error } = await supabase.auth.resetPasswordForEmail(m.email, { redirectTo: window.location.origin })
    setBusy(''); error ? bad(error.message) : ok(`Password reset email sent to ${m.email}.`)
  }
  async function archive() {
    const next = !m.is_active
    if (!window.confirm(next ? `Reactivate ${m.full_name}?` : `Archive ${m.full_name}? They won't be able to sign in until reactivated.`)) return
    setBusy('archive')
    const { error } = await supabase.from('users').update({ is_active: next }).eq('id', m.id)
    setBusy(''); error ? bad(error.message) : ok(next ? 'Reactivated.' : 'Archived.'); load(m.id)
  }
  async function forceOut() {
    if (!window.confirm(`Force sign out ${m.full_name}? This ends their access now; they'll need to be reactivated to sign in again.`)) return
    setBusy('out')
    const { error } = await supabase.rpc('force_sign_out', { target_user_id: m.id })
    setBusy(''); error ? bad(error.message) : ok('Signed out.'); load(m.id)
  }

  const row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: '#E4E6E8', border: '2px solid #1E5631', borderRadius: 10, padding: '4px 10px', minHeight: 40 }
  const inp = { border: 'none', background: 'transparent', textAlign: 'right', fontSize: 16, fontWeight: 600, color: 'var(--fa-ink)', flex: 1, minWidth: 0, fontFamily: 'inherit', padding: '6px 0' }
  const lab = { fontWeight: 600, fontSize: 15, whiteSpace: 'nowrap' }
  const isNew = m && !m.id
  const editable = isNew ? admin : true
  const small = { flex: 1, fontSize: 14, padding: '7px 6px', borderColor: 'var(--fa-red)', color: 'var(--fa-ink)' }
  return (
    <FieldShell profile={profile} title="WorkForce - Team" onBack={() => navigate('/tech/field/workforce')}>
      <select className="fa-select" value={sel} onChange={(e) => pick(e.target.value)} aria-label="Team member">
        <option value="">{admin ? '+ADD TEAM MEMBER ▾' : 'TEAM ▾'}</option>
        {admin && <option value="new">+ Add a new team member</option>}
        {people.map((u) => <option key={u.id} value={u.id}>{u.full_name}{u.is_active ? '' : ' (archived)'}</option>)}
      </select>
      <div className="fa-panel" style={{ marginTop: 10 }}>
        {!m ? <p className="fa-empty">Choose a team member{admin ? ', or add a new one' : ''}.</p> : (<>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600, fontSize: 14 }}>
            <input type="color" value={m.calendar_color || '#1676B8'} disabled={!editable} onChange={(e) => set('calendar_color', e.target.value)} style={{ width: 46, height: 34, border: '1px solid #9AA8B5', borderRadius: 6, padding: 0, background: 'none' }} />
            Calendar Color
          </label>
          <label style={row}><span style={lab}>Hire Date</span><input style={inp} type="date" value={m.hire_date || ''} disabled={!editable} onChange={(e) => set('hire_date', e.target.value)} /></label>
          <label style={row}><span style={lab}>Name</span><input style={inp} value={m.full_name} disabled={!editable} onChange={(e) => set('full_name', e.target.value)} /></label>
          <label style={row}><span style={lab}>Email</span><input style={inp} type="email" value={m.email || ''} disabled={!admin} onChange={(e) => set('email', e.target.value)} /></label>
          <label style={row}><span style={lab}>Role</span>
            <select style={inp} value={m.rk} disabled={!admin || m.role === 'super_admin'} onChange={(e) => set('rk', e.target.value)}>{ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </label>
          <div style={row}><span style={lab}>Status</span><span style={{ ...inp, flex: 'none' }}>{isNew ? 'New' : m.is_active ? 'Active' : 'Archived'}</span></div>
          {admin && <label style={row}><span style={lab}>Hourly Wage</span><input style={inp} inputMode="decimal" value={m.standard_hourly_rate} onChange={(e) => set('standard_hourly_rate', e.target.value)} placeholder="$ 0.00" /></label>}
          {msg && <div className={`fa-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.t}</div>}
          {isNew ? (
            <button type="button" className="fa-navbtn" disabled={!!busy} onClick={invite}>{busy === 'invite' ? 'Sending…' : 'Send Invite'}</button>
          ) : (<>
            <button type="button" className="fa-navbtn" disabled={!!busy} onClick={saveEdit}>{busy === 'edit' ? 'Saving…' : 'Save Changes'}</button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="fa-navbtn ghost" style={small} disabled={!!busy || !m.email} onClick={resetPw}>Reset Password</button>
              {admin && m.id !== profile?.id && <button type="button" className="fa-navbtn ghost" style={small} disabled={!!busy} onClick={archive}>{m.is_active ? 'Archive' : 'Reactivate'}</button>}
            </div>
            {admin && m.id !== profile?.id && m.is_active && <button type="button" className="fa-navbtn ghost" style={small} disabled={!!busy} onClick={forceOut}>Force Sign Out</button>}
          </>)}
        </>)}
      </div>
    </FieldShell>
  )
}

// ---------- Hours ----------
export function mondayOf(iso) { const d = new Date(iso + 'T12:00:00'); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return d.toISOString().slice(0, 10) }
const fmtShort = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const DAYS = ['Mon', 'Tues', 'Weds', 'Thurs', 'Fri', 'Sat', 'Sun']

export function useWeek(orgId, weekStart) {
  const [rows, setRows] = useState(null)
  const [people, setPeople] = useState([])
  const [err, setErr] = useState('')
  useEffect(() => {
    if (!orgId) return
    setRows(null); setErr('')
    Promise.all([
      supabase.rpc('field_week_hours', { p_org: orgId, p_week_start: weekStart }),
      supabase.from('users').select('id, full_name, standard_hourly_rate, is_active').eq('org_id', orgId).order('full_name'),
    ]).then(([h, u]) => { if (h.error) setErr(h.error.message); setRows(h.data || []); setPeople(u.data || []) })
  }, [orgId, weekStart])
  const byPerson = useMemo(() => {
    const map = {}
    for (const p of people) if (p.is_active) map[p.id] = { id: p.id, name: p.full_name, rate: Number(p.standard_hourly_rate) || 0, days: {} }
    for (const r of rows || []) {
      map[r.user_id] = map[r.user_id] || { id: r.user_id, name: r.full_name, rate: Number(r.hourly_rate) || 0, days: {} }
      map[r.user_id].days[r.work_date] = (map[r.user_id].days[r.work_date] || 0) + Number(r.hours || 0)
    }
    return Object.values(map).map((p) => {
      const total = Object.values(p.days).reduce((a, b) => a + b, 0)
      const reg = Math.min(40, total), ot = Math.max(0, total - 40)
      return { ...p, total, reg, ot, regPay: reg * p.rate, otPay: ot * p.rate * 1.5, pay: reg * p.rate + ot * p.rate * 1.5 }
    }).sort((a, b) => a.name.localeCompare(b.name))
  }, [rows, people])
  return { loading: rows === null, err, byPerson }
}

function WeekBar({ weekStart, setWeek }) {
  const end = shiftISO(weekStart, 6)
  return (
    <div className="fa-cal-head" style={{ borderRadius: '18px 18px 0 0' }}>
      <button type="button" onClick={() => setWeek(shiftISO(weekStart, -7))} aria-label="Previous week">‹</button>
      <span style={{ fontSize: 15.5 }}>Pay Period: {fmtShort(weekStart)} - {fmtShort(end)}, {end.slice(0, 4)}</span>
      <button type="button" onClick={() => setWeek(shiftISO(weekStart, 7))} aria-label="Next week">›</button>
    </div>
  )
}
const cell = { padding: '7px 8px', borderTop: '1px solid #9ED8F2', fontWeight: 600, fontSize: 15 }
const num = { ...cell, textAlign: 'right', borderLeft: '1px solid #9ED8F2', fontVariantNumeric: 'tabular-nums' }

export function FieldHours({ profile }) {
  const navigate = useNavigate()
  const [sp, setSp] = useSearchParams()
  const weekStart = sp.get('week') || mondayOf(todayISO())
  const setWeek = (w) => setSp({ week: w }, { replace: true })
  const { loading, err, byPerson } = useWeek(profile?.org_id, weekStart)
  const wages = byPerson.reduce((a, p) => a + p.pay, 0)
  const tax = wages * PR_TAX
  return (
    <FieldShell profile={profile} title="WorkForce - Hours" onBack={() => navigate('/tech/field/workforce')}>
      <div className="fa-cal">
        <WeekBar weekStart={weekStart} setWeek={setWeek} />
        {loading ? <p className="fa-empty">Loading…</p> : err ? <p className="fa-empty">{err}</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--fa-ink)' }}>
            <tbody>
              {byPerson.map((p) => (
                <tr key={p.id} onClick={() => navigate(`/tech/field/hours/${p.id}?week=${weekStart}`)} style={{ cursor: 'pointer' }}>
                  <td style={cell}>{p.name}</td>
                  <td style={num}>{fmtHrs(p.total)}</td>
                  <td style={num}>{money(p.pay)}</td>
                </tr>
              ))}
              <tr><td style={{ ...cell, fontSize: 13.5 }}>Total Wages</td><td style={num} /><td style={num}>{money(wages)}</td></tr>
              <tr><td style={{ ...cell, fontSize: 13.5 }}>Est PR Taxes</td><td style={num} /><td style={num}>{money(tax)}</td></tr>
              <tr><td style={{ ...cell, fontSize: 13.5, fontWeight: 800 }}>Est Labor Cost</td><td style={num} /><td style={{ ...num, fontWeight: 800 }}>{money(wages + tax)}</td></tr>
            </tbody>
          </table>
        )}
      </div>
    </FieldShell>
  )
}

export function FieldHoursPerson({ profile }) {
  const navigate = useNavigate()
  const { userId } = useParams()
  const [sp, setSp] = useSearchParams()
  const weekStart = sp.get('week') || mondayOf(todayISO())
  const setWeek = (w) => setSp({ week: w }, { replace: true })
  const { loading, byPerson } = useWeek(profile?.org_id, weekStart)
  const p = byPerson.find((x) => x.id === userId)
  const hrs = fmtHrs
  return (
    <FieldShell profile={profile} title="WorkForce - Hours" onBack={() => navigate(`/tech/field/hours?week=${weekStart}`)}>
      <div className="fa-cal">
        <WeekBar weekStart={weekStart} setWeek={setWeek} />
        {loading ? <p className="fa-empty">Loading…</p> : !p ? <p className="fa-empty">No hours this week.</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--fa-ink)' }}>
            <tbody>
              <tr><td style={{ ...cell, fontWeight: 800 }}>{p.name}</td><td style={{ ...num, fontWeight: 800 }}>{hrs(p.total)}</td><td style={num}>{p.rate ? `$ ${money(p.rate)}/hr` : ''}</td></tr>
              {DAYS.map((d, i) => <tr key={d}><td style={cell}>{d}</td><td style={num}>{hrs(p.days[shiftISO(weekStart, i)] || 0)}</td><td style={num} /></tr>)}
              <tr><td style={{ ...cell, fontSize: 13.5 }}>Reg Hours</td><td style={num}>{hrs(p.reg)}</td><td style={num}>$ {money(p.regPay)}</td></tr>
              <tr><td style={{ ...cell, fontSize: 13.5 }}>Overtime Hours</td><td style={num}>{hrs(p.ot)}</td><td style={num}>$ {money(p.otPay)}</td></tr>
              <tr><td style={{ ...cell, fontSize: 13.5, fontWeight: 800 }}>Total</td><td style={num} /><td style={{ ...num, fontWeight: 800 }}>$ {money(p.pay)}</td></tr>
            </tbody>
          </table>
        )}
      </div>
    </FieldShell>
  )
}
