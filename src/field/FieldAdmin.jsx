import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FieldShell, { todayISO, shiftISO } from './FieldShell'
import { supabase } from '../utils/supabase'
import { useWeek, mondayOf } from './FieldWorkforce'
import AskBar from '../AskBar'
import { useSolo } from './FieldHome'
import ContactImport from '../ContactImport'

// ADMIN — the Field App's back office: call logs, reports, payroll, pricebook, company profile, feedback.
const PR_TAX = 0.0765
const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const whole = (n) => '$ ' + Math.round(Number(n || 0)).toLocaleString('en-US')
const isAdmin = (p) => p?.role === 'org_admin' || p?.role === 'super_admin'
const back = (navigate) => () => navigate('/tech/field/admin')
const fmtHrs = (n) => { const v = Math.round((Number(n) || 0) * 100) / 100; return Number.isInteger(v) ? v.toFixed(1) : String(v) }

function monthOptions(n = 13) {
  const out = []
  const d = new Date(); d.setDate(1)
  for (let i = 0; i < n; i++) {
    const iso = new Date(d.getFullYear(), d.getMonth() - i, 1)
    const v = `${iso.getFullYear()}-${String(iso.getMonth() + 1).padStart(2, '0')}-01`
    out.push([v, iso.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })])
  }
  return out
}
const lastMonth = () => monthOptions(2)[1][0]
function monthRange(v) {
  const d = new Date(v + 'T12:00:00')
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return `${d.toLocaleDateString('en-US', { month: 'long' })} 1-${end.getDate()}, ${d.getFullYear()}`
}

function Title({ children, sub }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 4 }}>
      <div style={{ fontWeight: 800, fontSize: 18 }}>{children}</div>
      {sub && <div style={{ fontWeight: 700, fontSize: 13.5 }}>{sub}</div>}
    </div>
  )
}
function AdminOnly() {
  return <p className="fa-empty">Only company admins can open this.</p>
}
const pickStyle = { width: '100%', height: 44, borderRadius: 12, border: '2px solid var(--fa-cyan)', background: '#E4E6E8', fontSize: 16, fontWeight: 700, color: 'var(--fa-ink)', textAlign: 'center', fontFamily: 'inherit' }

// ---------- menu ----------
export default function FieldAdmin({ profile }) {
  const navigate = useNavigate()
  const solo = useSolo(profile?.org_id)
  const items = [
    ['Setup Checklist', '/tech/field/admin/setup'],
    ['Call Logs', '/tech/field/call-logs?from=admin'],
    ['Jobs Summary', '/tech/field/admin/jobs-summary'],
    ['Jobs Profitability', '/tech/field/admin/job-profit'],
    ['Period Profitability', '/tech/field/admin/period-profit'],
    ...(solo ? [] : [['Prepare Payroll', '/tech/field/admin/payroll'], ['Y-T-D Payroll', '/tech/field/admin/ytd']]),
    ['Mileage', '/tech/field/admin/mileage'],
    ['Edit Pricebook', '/tech/field/admin/pricebook'],
    ['Business Hours', '/tech/field/admin/hours'],
    ['Job Types', '/tech/field/admin/job-types'],
    ['Company Profile', '/tech/field/admin/company'],
    ['Import Phone Contacts', '/tech/field/admin/contacts'],
    ...(solo ? [['Add a Team Member', '/tech/field/team']] : []),
    ['Feedback', '/tech/field/admin/feedback'],
  ]
  return (
    <FieldShell profile={profile} title="Admin" onBack={() => navigate('/tech/field')}>
      <div className="fa-panel fa-menu-list">
        {items.map(([label, to], i) => (
          <button key={to} type="button" className={`fa-navbtn${i % 2 ? ' ghost' : ''}`} style={i % 2 ? { borderColor: 'var(--fa-cyan)' } : undefined} onClick={() => navigate(to)}>{label}</button>
        ))}
      </div>
    </FieldShell>
  )
}

// ---------- Jobs Summary ----------
export function FieldJobsSummary({ profile }) {
  const navigate = useNavigate()
  const [month, setMonth] = useState(lastMonth)
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    if (!profile?.org_id) return
    setD(null); setErr('')
    supabase.rpc('field_jobs_summary', { p_org: profile.org_id, p_month: month }).then(({ data, error }) => { if (error) setErr(error.message); else setD(data) })
  }, [profile?.org_id, month])
  return (
    <FieldShell profile={profile} title="Admin" onBack={back(navigate)}>
      <div className="fa-panel">
        <Title sub={monthRange(month)}>Jobs Summary</Title>
        <select style={pickStyle} value={month} onChange={(e) => setMonth(e.target.value)}>{monthOptions().map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        {err ? <p className="fa-empty">{err}</p> : !d ? <p className="fa-empty">Loading…</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 16, fontWeight: 600 }}>
            <tbody>
              {d.rows.map((r) => (
                <tr key={r.label}>
                  <td style={{ padding: '9px 4px' }}>{r.label}</td>
                  <td style={{ padding: '9px 4px', textAlign: 'right', width: 50 }}>{r.count}</td>
                  <td style={{ padding: '9px 4px', textAlign: 'right', width: 100 }}>{r.amount != null ? whole(r.amount) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </FieldShell>
  )
}

// ---------- Jobs Profitability ----------
export function FieldJobProfit({ profile }) {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState([])
  const [jobId, setJobId] = useState('')
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    if (!profile?.org_id) return
    const since = shiftISO(todayISO(), -120)
    supabase.from('jobs').select('id, job_number, segment, job_date, status, customers ( display_name )')
      .eq('org_id', profile.org_id).is('deleted_at', null).gte('job_date', since).lte('job_date', todayISO())
      .not('status', 'in', '("canceled","cancelled")').order('job_date', { ascending: false }).limit(300)
      .then(({ data }) => setJobs(data || []))
  }, [profile?.org_id])
  useEffect(() => {
    if (!jobId) { setD(null); return }
    setD(null); setErr('')
    supabase.rpc('field_job_profit', { p_job: jobId }).then(({ data, error }) => { if (error) setErr(error.message); else setD(data) })
  }, [jobId])
  const line = (label, v, strong, neg) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 2px', fontSize: 16, fontWeight: strong ? 800 : 600, borderTop: strong ? '1.5px solid #0C2E44' : 'none' }}>
      <span>{label}</span><span style={{ color: neg ? '#B00020' : undefined }}>{v}</span>
    </div>
  )
  return (
    <FieldShell profile={profile} title="Admin" onBack={back(navigate)}>
      <div className="fa-panel">
        <Title sub="By Job #">Jobs Profitability</Title>
        <select className="fa-select" value={jobId} onChange={(e) => setJobId(e.target.value)}>
          <option value="">Choose a job ▾</option>
          {jobs.map((j) => <option key={j.id} value={j.id}>{j.job_number}{j.segment > 1 ? `-${j.segment}` : ''} · {j.customers?.display_name || ''} · {new Date(j.job_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</option>)}
        </select>
        {err && <p className="fa-empty">{err}</p>}
        {jobId && !d && !err && <p className="fa-empty">Loading…</p>}
        {d && (
          <div style={{ padding: '4px 4px 0' }}>
            <div className="fa-muted" style={{ fontWeight: 700, marginBottom: 4 }}>{d.job_type}</div>
            {line('Invoice', `$ ${money(d.income)}`)}
            {line('Parts & materials (COS)', `− $ ${money(d.cos)}`)}
            {line(`Labor (${fmtHrs(d.labor_hours)} hrs on site)`, `− $ ${money(d.labor)}`)}
            {line('Profit', `$ ${money(d.profit)}`, true, Number(d.profit) < 0)}
            {line('Margin', d.margin != null ? `${d.margin}%` : '—')}
            <p className="fa-muted" style={{ fontSize: 12.5, marginTop: 8 }}>Parts come from Credits &amp; Expenses saved to this job. Labor is time on site × each assigned tech&apos;s wage, plus 7.65% payroll taxes.</p>
          </div>
        )}
      </div>
    </FieldShell>
  )
}

// ---------- Period Profitability ----------
export function FieldPeriodProfit({ profile }) {
  const navigate = useNavigate()
  const [month, setMonth] = useState(lastMonth)
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    if (!profile?.org_id) return
    setD(null); setErr('')
    supabase.rpc('field_period_profit', { p_org: profile.org_id, p_month: month }).then(({ data, error }) => { if (error) setErr(error.message); else setD(data) })
  }, [profile?.org_id, month])
  const n = (k) => Number(d?.[k] || 0)
  const jobExp = n('cos') + n('labor')
  const otherExp = n('rent') + n('utilities') + n('fleet') + n('insurance') + n('other')
  const total = jobExp + otherExp
  const profit = n('income') - total
  const row = (label, v, opts = {}) => (
    <tr>
      <td style={{ padding: '6px 4px', paddingLeft: opts.sub ? 16 : 4, fontWeight: opts.bold ? 800 : 600, fontSize: opts.sub ? 14.5 : 16 }}>{opts.sub ? '* ' : ''}{label}</td>
      <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: opts.bold ? 800 : 600, color: opts.neg ? '#B00020' : undefined, fontSize: opts.sub ? 14.5 : 16 }}>{v == null ? '' : money(v)}</td>
    </tr>
  )
  return (
    <FieldShell profile={profile} title="Admin" onBack={back(navigate)}>
      <div className="fa-panel">
        <Title>Period Profitability</Title>
        <select style={pickStyle} value={month} onChange={(e) => setMonth(e.target.value)}>{monthOptions().map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        {err ? <p className="fa-empty">{err}</p> : !d ? <p className="fa-empty">Loading…</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {row('Job Income', n('income'), { bold: true })}
              {row('Job Expense', jobExp)}
              {row('COS', n('cos'), { sub: true })}
              {row('Labor Costs', n('labor'), { sub: true })}
              {row('Other Expense', otherExp)}
              {row('Rent', n('rent'), { sub: true })}
              {row('Utilities', n('utilities'), { sub: true })}
              {row('Fleet Expense', n('fleet'), { sub: true })}
              {row('Insurance', n('insurance'), { sub: true })}
              {n('other') ? row('Other Overhead', n('other'), { sub: true }) : null}
              {row('Total Expense', total, { bold: true })}
              {row('Est Profit (Loss)', profit, { bold: true, neg: profit < 0 })}
            </tbody>
          </table>
        )}
        <p className="fa-muted" style={{ fontSize: 12.5 }}>Income is invoices dated in the month. Expenses come from Credits &amp; Expenses. Labor is time-clock hours × wage plus 7.65% payroll taxes (overtime premiums aren&apos;t included).</p>
      </div>
    </FieldShell>
  )
}

// ---------- Prepare Payroll (this period) ----------
export function FieldPayroll({ profile }) {
  const navigate = useNavigate()
  const admin = isAdmin(profile)
  const [weekStart, setWeekStart] = useState(() => shiftISO(mondayOf(todayISO()), -7))
  const { loading, byPerson } = useWeek(admin ? profile?.org_id : null, weekStart)
  const [saved, setSaved] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  useEffect(() => {
    if (!admin || !profile?.org_id) return
    setSaved(null)
    supabase.from('field_payroll_weeks').select('finalized_at').eq('org_id', profile.org_id).eq('week_start', weekStart).maybeSingle().then(({ data }) => setSaved(data || false))
  }, [admin, profile?.org_id, weekStart])
  const lines = byPerson.filter((p) => p.total > 0).map((p) => ({
    user_id: p.id, name: p.name, rate: p.rate, reg_hours: +p.reg.toFixed(2), ot_hours: +p.ot.toFixed(2),
    reg_pay: +p.regPay.toFixed(2), ot_pay: +p.otPay.toFixed(2), gross: +p.pay.toFixed(2), employer_tax: +(p.pay * PR_TAX).toFixed(2),
  }))
  const gross = lines.reduce((a, l) => a + l.gross, 0)
  async function finalize() {
    if (!window.confirm(`Finalize payroll for the week of ${weekStart}? It will be added to Y-T-D. You can finalize again later to replace it.`)) return
    setBusy(true); setMsg(null)
    const totals = { gross: +gross.toFixed(2), employer_tax: +(gross * PR_TAX).toFixed(2), people: lines.length }
    const { error } = await supabase.from('field_payroll_weeks').upsert({ org_id: profile.org_id, week_start: weekStart, lines, totals, finalized_at: new Date().toISOString(), finalized_by: profile.id }, { onConflict: 'org_id,week_start' })
    setBusy(false)
    if (error) setMsg({ ok: false, t: error.message }); else { setMsg({ ok: true, t: 'Week finalized and added to Y-T-D.' }); setSaved({ finalized_at: new Date().toISOString() }) }
  }
  const end = shiftISO(weekStart, 6)
  const fmt = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const th = { padding: '6px 4px', fontSize: 12.5, color: '#5A6B7B', textAlign: 'right' }
  const td = { padding: '7px 4px', fontWeight: 600, fontSize: 14.5, borderTop: '1px solid #DCE6EE', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
  return (
    <FieldShell profile={profile} title="Admin" onBack={back(navigate)}>
      <div className="fa-panel">
        <Title sub="This Period Payroll">Prepare Payroll</Title>
        {!admin ? <AdminOnly /> : (<>
          <div className="fa-datebar" style={{ margin: 0 }}>
            <button type="button" onClick={() => setWeekStart(shiftISO(weekStart, -7))}>‹</button>
            <div style={{ flex: 1, textAlign: 'center', fontWeight: 700 }}>{fmt(weekStart)} – {fmt(end)}, {end.slice(0, 4)}</div>
            <button type="button" onClick={() => setWeekStart(shiftISO(weekStart, 7))}>›</button>
          </div>
          {loading ? <p className="fa-empty">Loading…</p> : lines.length === 0 ? <p className="fa-empty">No hours recorded this week.</p> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--fa-ink)' }}>
              <thead><tr><th style={{ ...th, textAlign: 'left' }}>Employee</th><th style={th}>Reg</th><th style={th}>OT</th><th style={th}>Gross</th></tr></thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.user_id}><td style={{ ...td, textAlign: 'left' }}>{l.name}</td><td style={td}>{fmtHrs(l.reg_hours)}</td><td style={td}>{fmtHrs(l.ot_hours)}</td><td style={td}>{money(l.gross)}</td></tr>
                ))}
                <tr><td style={{ ...td, textAlign: 'left', fontWeight: 800 }} colSpan={3}>Total Gross Pay</td><td style={{ ...td, fontWeight: 800 }}>{money(gross)}</td></tr>
                <tr><td style={{ ...td, textAlign: 'left' }} colSpan={3}>Employer taxes to set apart (7.65%)</td><td style={td}>{money(gross * PR_TAX)}</td></tr>
              </tbody>
            </table>
          )}
          <p className="fa-muted" style={{ fontSize: 12.5, margin: 0 }}>Gross pay from the time clock (overtime 1.5× after 40 hours). Employee withholding isn&apos;t calculated here — send this to your accountant or payroll service to issue the checks.</p>
          {msg && <div className={`fa-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.t}</div>}
          {saved?.finalized_at && <div className="fa-msg ok">Finalized {new Date(saved.finalized_at).toLocaleDateString('en-US')}.</div>}
          <button type="button" className="fa-navbtn" disabled={busy || loading || !lines.length} onClick={finalize}>{busy ? 'Saving…' : saved ? 'Finalize Again (replace)' : 'Finalize This Week'}</button>
          <button type="button" className="fa-navbtn ghost" style={{ borderColor: 'var(--fa-cyan)' }} onClick={() => navigate('/tech/field/admin/payroll-send')}>Accum Payroll Data — Print / Send</button>
        </>)}
      </div>
    </FieldShell>
  )
}

// ---------- Y-T-D ----------
function useYtd(orgId, year) {
  const [weeks, setWeeks] = useState(null)
  useEffect(() => {
    if (!orgId) return
    supabase.from('field_payroll_weeks').select('week_start, lines, totals, finalized_at').eq('org_id', orgId)
      .gte('week_start', `${year}-01-01`).lte('week_start', `${year}-12-31`).order('week_start').then(({ data }) => setWeeks(data || []))
  }, [orgId, year])
  const people = useMemo(() => {
    const m = {}
    for (const w of weeks || []) for (const l of w.lines || []) {
      const p = (m[l.user_id] = m[l.user_id] || { id: l.user_id, name: l.name, reg: 0, ot: 0, gross: 0, tax: 0 })
      p.reg += Number(l.reg_hours) || 0; p.ot += Number(l.ot_hours) || 0; p.gross += Number(l.gross) || 0; p.tax += Number(l.employer_tax) || 0
    }
    return Object.values(m).sort((a, b) => a.name.localeCompare(b.name))
  }, [weeks])
  return { loading: weeks === null, weeks: weeks || [], people }
}

export function FieldYtd({ profile }) {
  const navigate = useNavigate()
  const admin = isAdmin(profile)
  const year = new Date().getFullYear()
  const { loading, weeks, people } = useYtd(admin ? profile?.org_id : null, year)
  const gross = people.reduce((a, p) => a + p.gross, 0)
  const tax = people.reduce((a, p) => a + p.tax, 0)
  const th = { padding: '6px 4px', fontSize: 12.5, color: '#5A6B7B', textAlign: 'right' }
  const td = { padding: '7px 4px', fontWeight: 600, fontSize: 14.5, borderTop: '1px solid #DCE6EE', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
  return (
    <FieldShell profile={profile} title="Admin" onBack={back(navigate)}>
      <div className="fa-panel">
        <Title sub="By Employee">Payroll Y-T-D</Title>
        {!admin ? <AdminOnly /> : loading ? <p className="fa-empty">Loading…</p> : people.length === 0 ? <p className="fa-empty">No finalized payroll weeks in {year} yet. Finalize a week in Prepare Payroll.</p> : (<>
          <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--fa-ink)' }}>
            <thead><tr><th style={{ ...th, textAlign: 'left' }}>Employee</th><th style={th}>Hours</th><th style={th}>Gross</th></tr></thead>
            <tbody>
              {people.map((p) => <tr key={p.id}><td style={{ ...td, textAlign: 'left' }}>{p.name}</td><td style={td}>{fmtHrs(p.reg + p.ot)}</td><td style={td}>{money(p.gross)}</td></tr>)}
              <tr><td style={{ ...td, textAlign: 'left', fontWeight: 800 }} colSpan={2}>Total Gross Pay</td><td style={{ ...td, fontWeight: 800 }}>{money(gross)}</td></tr>
              <tr><td style={{ ...td, textAlign: 'left' }} colSpan={2}>Employer taxes (7.65%)</td><td style={td}>{money(tax)}</td></tr>
            </tbody>
          </table>
          <p className="fa-muted" style={{ fontSize: 12.5, margin: 0 }}>{weeks.length} finalized week{weeks.length === 1 ? '' : 's'} since Jan 1, {year}.</p>
        </>)}
        {admin && <button type="button" className="fa-navbtn ghost" style={{ borderColor: 'var(--fa-cyan)' }} onClick={() => navigate('/tech/field/admin/payroll-send')}>Accum Payroll Data — Print / Send</button>}
      </div>
    </FieldShell>
  )
}

// ---------- Accum Payroll Data: Print / Send ----------
function reportHtml(orgName, year, weeks, people) {
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const td = 'padding:6px 8px;border-bottom:1px solid #E2E8F0'
  const tdr = td + ';text-align:right'
  const ytdRows = people.map((p) => `<tr><td style="${td}">${esc(p.name)}</td><td style="${tdr}">${fmtHrs(p.reg)}</td><td style="${tdr}">${fmtHrs(p.ot)}</td><td style="${tdr}">$${money(p.gross)}</td><td style="${tdr}">$${money(p.tax)}</td></tr>`).join('')
  const weekBlocks = weeks.map((w) => `<h3 style="margin:18px 0 6px;font-size:15px">Week of ${esc(w.week_start)}</h3><table style="border-collapse:collapse;width:100%;font-size:13px"><tr><th style="${td};text-align:left">Employee</th><th style="${tdr}">Rate</th><th style="${tdr}">Reg hrs</th><th style="${tdr}">OT hrs</th><th style="${tdr}">Gross</th></tr>${(w.lines || []).map((l) => `<tr><td style="${td}">${esc(l.name)}</td><td style="${tdr}">$${money(l.rate)}</td><td style="${tdr}">${fmtHrs(l.reg_hours)}</td><td style="${tdr}">${fmtHrs(l.ot_hours)}</td><td style="${tdr}">$${money(l.gross)}</td></tr>`).join('')}</table>`).join('')
  const gross = people.reduce((a, p) => a + p.gross, 0), tax = people.reduce((a, p) => a + p.tax, 0)
  return `<div style="font-family:Arial,sans-serif;color:#1F2A37;max-width:720px;margin:0 auto">
    <h2 style="margin:0">${esc(orgName)} — Accumulated Payroll Data ${year}</h2>
    <p style="color:#64748B;margin:4px 0 14px">Prepared ${new Date().toLocaleDateString('en-US')} from the Journey time clock. Gross wages only; employee withholding is not calculated.</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px"><tr><th style="${td};text-align:left">Employee</th><th style="${tdr}">Reg hrs</th><th style="${tdr}">OT hrs</th><th style="${tdr}">Gross</th><th style="${tdr}">Employer tax (7.65%)</th></tr>${ytdRows}
    <tr><td style="${td};font-weight:700">Total</td><td style="${td}"></td><td style="${td}"></td><td style="${tdr};font-weight:700">$${money(gross)}</td><td style="${tdr};font-weight:700">$${money(tax)}</td></tr></table>
    ${weekBlocks}</div>`
}

export function FieldPayrollSend({ profile }) {
  const navigate = useNavigate()
  const admin = isAdmin(profile)
  const year = new Date().getFullYear()
  const { loading, weeks, people } = useYtd(admin ? profile?.org_id : null, year)
  const [org, setOrg] = useState(null)
  const [other, setOther] = useState('')
  const [askOther, setAskOther] = useState(false)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState(null)
  useEffect(() => { if (profile?.org_id) supabase.from('organizations').select('name, dba_name, accountant_email, accountant_name').eq('id', profile.org_id).maybeSingle().then(({ data }) => setOrg(data)) }, [profile?.org_id])
  const orgName = org?.dba_name || org?.name || ''
  const html = useMemo(() => reportHtml(orgName, year, weeks, people), [orgName, year, weeks, people])
  async function send(to) {
    setBusy(to); setMsg(null)
    const { data, error } = await supabase.functions.invoke('field-report-email', { body: { action: 'send_report', to, subject: `${orgName} — Payroll Data ${year}`, html } })
    let e = data?.error
    if (!e && error) { try { e = (await error.context?.json())?.error } catch { /* generic */ } e = e || error.message }
    setBusy('')
    setMsg(e ? { ok: false, t: e } : { ok: true, t: `Sent to ${data?.to}.` })
  }
  function print() {
    const w = window.open('', '_blank')
    if (!w) { setMsg({ ok: false, t: 'Allow pop-ups to print.' }); return }
    w.document.write(`<html><head><title>Payroll Data ${year}</title></head><body>${html}</body></html>`)
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300)
  }
  return (
    <FieldShell profile={profile} title="Admin" onBack={() => navigate(-1)}>
      <div className="fa-panel">
        <Title sub="Print / Send">Accum Payroll Data</Title>
        {!admin ? <AdminOnly /> : loading ? <p className="fa-empty">Loading…</p> : (<>
          {weeks.length === 0 && <p className="fa-muted" style={{ textAlign: 'center' }}>No finalized weeks yet this year — the report will be empty.</p>}
          <button type="button" className="fa-navbtn" disabled={!!busy} onClick={() => send('self')}>{busy === 'self' ? 'Sending…' : 'Email Self'}</button>
          <button type="button" className="fa-navbtn" disabled={!!busy || !org?.accountant_email} onClick={() => send('accountant')}>{busy === 'accountant' ? 'Sending…' : 'Email Accountant'}</button>
          {!org?.accountant_email && <p className="fa-muted" style={{ margin: '-4px 4px 0', fontSize: 12.5 }}>Add the accountant&apos;s email in Company Profile.</p>}
          {askOther ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <input className="fa-input" type="email" placeholder="name@example.com" value={other} onChange={(e) => setOther(e.target.value)} />
              <button type="button" className="fa-small-btn" disabled={!!busy || !other.trim()} onClick={() => send(other.trim())}>Send</button>
            </div>
          ) : <button type="button" className="fa-navbtn" disabled={!!busy} onClick={() => setAskOther(true)}>Email Other</button>}
          <button type="button" className="fa-navbtn" style={{ background: '#D9D9D9', color: 'var(--fa-navy)', borderColor: 'var(--fa-navy)' }} onClick={print}>Print</button>
          {msg && <div className={`fa-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.t}</div>}
        </>)}
      </div>
    </FieldShell>
  )
}

// ---------- Edit Pricebook ----------
const BOOK_LABEL = { res_flat_rate: 'Res Flat Rate PriceBook', duct_cleaning: 'Duct Cleaning PriceBook', time_materials: 'Time & Materials PriceBook' }
export function FieldPricebook({ profile }) {
  const navigate = useNavigate()
  const admin = isAdmin(profile)
  const orgId = profile?.org_id
  const [book, setBook] = useState(null)
  const [items, setItems] = useState(null)
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState(null)
  const [msg, setMsg] = useState(null)
  async function load(b) {
    setItems(null)
    if (b === 'duct_cleaning') {
      const { data } = await supabase.from('duct_pricebook_items').select('id, category, name, price').eq('org_id', orgId).eq('is_active', true).order('sort_order').order('name')
      setItems((data || []).map((r) => ({ key: r.id, table: 'duct_pricebook_items', id: r.id, group: r.category, name: r.name, price: r.price, priceField: 'price', nameField: 'name' })))
    } else if (b === 'time_materials') {
      const { data } = await supabase.from('part_items').select('id, category, generic_name, last_cost').eq('org_id', orgId).is('deleted_at', null).eq('is_active', true).order('generic_name').limit(1000)
      setItems((data || []).map((r) => ({ key: r.id, table: 'part_items', id: r.id, group: r.category || 'Parts', name: r.generic_name, price: r.last_cost, priceField: 'last_cost', nameField: 'generic_name', priceLabel: 'Last cost' })))
    } else {
      const { data: svc } = await supabase.from('services').select('id, category, name, segment').eq('org_id', orgId).eq('is_active', true).order('category').order('name')
      const res = (svc || []).filter((s) => !s.segment || s.segment === 'residential')
      const ids = res.map((s) => s.id)
      const { data: prices } = ids.length ? await supabase.from('service_prices').select('id, service_id, location, access, hours, part_source, customer_display, price').in('service_id', ids).eq('is_active', true) : { data: [] }
      const out = []
      for (const s of res) for (const p of (prices || []).filter((x) => x.service_id === s.id)) {
        const variant = [p.location, p.access, p.hours, p.part_source].filter(Boolean).join(' · ')
        out.push({ key: p.id, table: 'service_prices', id: p.id, group: s.category, name: s.name + (variant ? ` — ${variant}` : ''), price: p.price, priceField: 'price', serviceId: s.id, serviceName: s.name })
      }
      setItems(out)
    }
  }
  useEffect(() => {
    if (!orgId) return
    supabase.from('organizations').select('field_pricebook').eq('id', orgId).maybeSingle().then(({ data }) => { const b = data?.field_pricebook || 'res_flat_rate'; setBook(b); load(b) })
  }, [orgId]) // eslint-disable-line react-hooks/exhaustive-deps
  async function save() {
    setMsg(null)
    const price = Number(String(edit.price).replace(/[$,\s]/g, ''))
    if (!(price >= 0)) { setMsg({ ok: false, t: 'Enter a valid price.' }); return }
    const patch = { [edit.priceField]: price }
    if (edit.nameField) patch[edit.nameField] = edit.name.trim()
    const { error } = await supabase.from(edit.table).update(patch).eq('id', edit.id)
    if (!error && edit.table === 'service_prices' && edit.serviceName !== edit.svcName?.trim() && edit.svcName?.trim()) {
      await supabase.from('services').update({ name: edit.svcName.trim() }).eq('id', edit.serviceId)
    }
    if (error) { setMsg({ ok: false, t: error.message }); return }
    setMsg({ ok: true, t: 'Saved.' }); setEdit(null); load(book)
  }
  const [adding, setAdding] = useState(null)
  async function addItem() {
    setMsg(null)
    const name = adding.name.trim()
    const group = adding.group.trim() || (book === 'time_materials' ? 'Parts' : 'General')
    const price = Number(String(adding.price).replace(/[$,\s]/g, ''))
    if (!name) { setMsg({ ok: false, t: 'Enter a name.' }); return }
    if (!(price >= 0) || adding.price === '') { setMsg({ ok: false, t: 'Enter a valid price.' }); return }
    let error
    if (book === 'duct_cleaning') {
      ({ error } = await supabase.from('duct_pricebook_items').insert({ org_id: orgId, category: group, name, price, is_active: true, sort_order: 999 }))
    } else if (book === 'time_materials') {
      ({ error } = await supabase.from('part_items').insert({ org_id: orgId, category: group, generic_name: name, last_cost: price, is_active: true }))
    } else {
      const { data: svc, error: e1 } = await supabase.from('services').insert({ org_id: orgId, category: group, name, segment: 'residential', is_active: true }).select('id').single()
      error = e1
      if (!error) ({ error } = await supabase.from('service_prices').insert({ org_id: orgId, service_id: svc.id, customer_display: name, price, is_active: true }))
    }
    if (error) { setMsg({ ok: false, t: error.message }); return }
    setMsg({ ok: true, t: `Added ${name}.` }); setAdding(null); load(book)
  }
  const groups = [...new Set((items || []).map((i) => i.group).filter(Boolean))].sort()
  const shown = (items || []).filter((i) => !q.trim() || i.name.toLowerCase().includes(q.trim().toLowerCase()) || String(i.group || '').toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <FieldShell profile={profile} title="Admin" onBack={back(navigate)}>
      <div className="fa-panel">
        <Title sub={book ? BOOK_LABEL[book] : ''}>Edit Pricebook</Title>
        {adding ? (<>
          <div className="fa-section-label">Category</div>
          <input className="fa-input" list="fa-pb-groups" value={adding.group} onChange={(e) => setAdding({ ...adding, group: e.target.value })} placeholder={book === 'time_materials' ? 'Parts' : 'e.g. Maintenance'} />
          <datalist id="fa-pb-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
          <div className="fa-section-label">Name</div>
          <input className="fa-input" value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} />
          <div className="fa-section-label">{book === 'time_materials' ? 'Your cost' : 'Price'}</div>
          <input className="fa-input" inputMode="decimal" value={adding.price} onChange={(e) => setAdding({ ...adding, price: e.target.value })} placeholder="$ 0.00" />
          {msg && <div className={`fa-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.t}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="fa-navbtn" style={{ flex: 1 }} onClick={addItem}>Add</button>
            <button type="button" className="fa-navbtn ghost" style={{ flex: 1 }} onClick={() => { setAdding(null); setMsg(null) }}>Cancel</button>
          </div>
        </>) : edit ? (<>
          {edit.table === 'service_prices'
            ? <><div className="fa-section-label">Service name</div><input className="fa-input" value={edit.svcName ?? edit.serviceName} onChange={(e) => setEdit({ ...edit, svcName: e.target.value })} /><div className="fa-muted">{edit.name.replace(edit.serviceName, '').replace(/^ — /, '') || 'Standard'}</div></>
            : <><div className="fa-section-label">Name</div><input className="fa-input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></>}
          <div className="fa-section-label">{edit.priceLabel || 'Price'}</div>
          <input className="fa-input" inputMode="decimal" value={edit.price ?? ''} onChange={(e) => setEdit({ ...edit, price: e.target.value })} />
          {msg && <div className={`fa-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.t}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="fa-navbtn" style={{ flex: 1 }} onClick={save}>Save</button>
            <button type="button" className="fa-navbtn ghost" style={{ flex: 1 }} onClick={() => { setEdit(null); setMsg(null) }}>Cancel</button>
          </div>
        </>) : (<>
          <input className="fa-input" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
          {admin && book && <button type="button" className="fa-navbtn ghost" style={{ borderColor: 'var(--fa-cyan)' }} onClick={() => { setMsg(null); setAdding({ group: '', name: '', price: '' }) }}>+ Add Item</button>}
          {msg && <div className={`fa-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.t}</div>}
          {!items ? <p className="fa-empty">Loading…</p> : shown.length === 0 ? <p className="fa-empty">Nothing found.</p> : shown.slice(0, 200).map((i) => (
            <div key={i.key} className="fa-info" role="button" tabIndex={0} style={{ cursor: admin ? 'pointer' : 'default', display: 'flex', justifyContent: 'space-between', gap: 8, padding: '9px 12px' }}
              onClick={() => admin && setEdit({ ...i })}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{i.name}</div>
                {i.group && <div className="fa-muted" style={{ fontSize: 12 }}>{i.group}</div>}
              </div>
              <div style={{ fontWeight: 800, whiteSpace: 'nowrap' }}>{i.price != null ? `$${money(i.price)}` : '—'}</div>
            </div>
          ))}
          {items && shown.length > 200 && <p className="fa-muted" style={{ textAlign: 'center' }}>Showing 200 — search to narrow.</p>}
          {!admin && <p className="fa-muted" style={{ textAlign: 'center' }}>Only company admins can change prices.</p>}
        </>)}
      </div>
    </FieldShell>
  )
}

// ---------- Company Profile ----------
const CO_FIELDS = [
  ['name', 'Company Name'], ['dba_name', 'Name customers see (DBA)'], ['business_street', 'Street'], ['business_city', 'City'],
  ['business_state', 'State'], ['business_zip', 'ZIP'], ['business_phone', 'Phone'], ['business_email', 'Email'],
  ['business_website', 'Website'], ['license_number', 'License #'], ['sales_tax_rate', 'Sales Tax Rate (%)'],
]
const ACCT_FIELDS = [['accountant_name', 'Accountant Name'], ['accountant_address', 'Address'], ['accountant_phone', 'Phone'], ['accountant_email', 'Email']]
export function FieldCompany({ profile }) {
  const navigate = useNavigate()
  const admin = isAdmin(profile)
  const [o, setO] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  useEffect(() => {
    if (!profile?.org_id) return
    supabase.from('organizations').select([...CO_FIELDS, ...ACCT_FIELDS].map(([k]) => k).join(', ')).eq('id', profile.org_id).maybeSingle().then(({ data }) => setO(data || {}))
  }, [profile?.org_id])
  async function save() {
    setBusy(true); setMsg(null)
    const patch = {}
    for (const [k] of [...CO_FIELDS, ...ACCT_FIELDS]) patch[k] = k === 'sales_tax_rate' ? (o[k] === '' || o[k] == null ? null : Number(o[k])) : (String(o[k] ?? '').trim() || null)
    if (!patch.name) { setBusy(false); setMsg({ ok: false, t: 'Company name is required.' }); return }
    const { error } = await supabase.from('organizations').update(patch).eq('id', profile.org_id)
    setBusy(false)
    setMsg(error ? { ok: false, t: error.message } : { ok: true, t: 'Saved.' })
  }
  const row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: '#E4E6E8', border: '2px solid #1E5631', borderRadius: 10, padding: '2px 10px', minHeight: 40 }
  const inp = { border: 'none', background: 'transparent', textAlign: 'right', fontSize: 15, fontWeight: 600, color: 'var(--fa-ink)', flex: 1, minWidth: 0, fontFamily: 'inherit', padding: '6px 0' }
  const [snd, setSnd] = useState(null) // { address, status }
  const [sndAddr, setSndAddr] = useState('')
  const [sndBusy, setSndBusy] = useState('')
  const [sndMsg, setSndMsg] = useState(null)
  async function sender(action, extra = {}) {
    setSndBusy(action); setSndMsg(null)
    const { data, error } = await supabase.functions.invoke('email-sender', { body: { action, ...extra } })
    let e = data?.error
    if (!e && error) { try { e = (await error.context?.json())?.error } catch { /* generic */ } e = e || error.message }
    setSndBusy('')
    if (e) { setSndMsg({ ok: false, t: e }); return }
    setSnd({ address: data.address, status: data.status })
    if (action === 'request') setSndMsg({ ok: true, t: data.status === 'verified' ? 'Verified.' : `Verification email sent to ${data.address}. Click the link in it, then tap Check Status.${data.freeMail ? ' Tip: a Gmail/Yahoo-type address often lands in customers\' spam — an address at your business domain works best.' : ''}` })
    if (action === 'resend') setSndMsg({ ok: true, t: 'Verification email sent again.' })
  }
  useEffect(() => {
    if (!profile?.org_id) return
    supabase.from('organizations').select('email_from_address, email_sender_status').eq('id', profile.org_id).maybeSingle()
      .then(({ data }) => { setSnd({ address: data?.email_from_address || '', status: data?.email_sender_status || 'none' }); setSndAddr(data?.email_from_address || '') })
  }, [profile?.org_id])
  const field = ([k, l]) => (
    <label key={k} style={row}><span style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap' }}>{l}</span>
      <input style={inp} value={o[k] ?? ''} disabled={!admin} inputMode={k === 'sales_tax_rate' ? 'decimal' : undefined} onChange={(e) => setO({ ...o, [k]: e.target.value })} /></label>
  )
  return (
    <FieldShell profile={profile} title="Admin" onBack={back(navigate)}>
      <div className="fa-panel">
        <Title>Company Profile</Title>
        {!o ? <p className="fa-empty">Loading…</p> : (<>
          {CO_FIELDS.map(field)}
          <div style={{ fontWeight: 800, fontSize: 15, margin: '8px 4px 0' }}>Email sender</div>
          <div className="fa-muted" style={{ margin: '0 4px', fontSize: 12.5 }}>Every email your company sends — invoices, estimates, confirmations, reports — comes from this address. It must be verified before emails can go out.</div>
          {snd && (
            <div className="fa-info">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{snd.address || 'Not set'}</span>
                <span className={`fa-chip ${snd.status === 'verified' ? 'green' : snd.status === 'pending' ? '' : 'red'}`} style={{ marginTop: 0 }}>{snd.status === 'verified' ? 'Verified' : snd.status === 'pending' ? 'Pending' : 'Not verified'}</span>
              </div>
              {admin && (<>
                <input className="fa-input" style={{ marginTop: 8, fontSize: 16 }} type="email" placeholder="office@yourcompany.com" value={sndAddr} onChange={(e) => setSndAddr(e.target.value)} />
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="fa-small-btn" disabled={!!sndBusy || !sndAddr.trim() || (sndAddr.trim().toLowerCase() === snd.address && snd.status !== 'none')} onClick={() => sender('request', { address: sndAddr.trim() })}>{sndBusy === 'request' ? 'Sending…' : 'Verify'}</button>
                  {snd.status === 'pending' && <button type="button" className="fa-small-btn" style={{ background: '#fff', color: 'var(--fa-navy)' }} disabled={!!sndBusy} onClick={() => sender('status')}>{sndBusy === 'status' ? 'Checking…' : 'Check Status'}</button>}
                  {snd.status === 'pending' && <button type="button" className="fa-small-btn" style={{ background: '#fff', color: 'var(--fa-navy)' }} disabled={!!sndBusy} onClick={() => sender('resend')}>Resend</button>}
                </div>
              </>)}
              {sndMsg && <div className={`fa-msg ${sndMsg.ok ? 'ok' : 'err'}`} style={{ marginTop: 8 }}>{sndMsg.t}</div>}
            </div>
          )}
          <div style={{ fontWeight: 800, fontSize: 15, margin: '8px 4px 0' }}>Accountant</div>
          {ACCT_FIELDS.map(field)}
          {msg && <div className={`fa-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.t}</div>}
          {admin ? <button type="button" className="fa-navbtn" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button> : <p className="fa-muted" style={{ textAlign: 'center' }}>Only company admins can change the profile.</p>}
        </>)}
      </div>
    </FieldShell>
  )
}

// ---------- Import phone contacts ----------
export function FieldContactImport({ profile }) {
  const navigate = useNavigate()
  return (
    <FieldShell profile={profile} title="Admin" onBack={back(navigate)}>
      {profile?.org_id && <ContactImport field orgId={profile.org_id} profile={profile} />}
    </FieldShell>
  )
}

// ---------- Feedback ----------
const IDEA_SYS = 'You help a small HVAC business owner send an idea or request to the makers of Journey, their field service software. Rewrite their rough idea as a short, clear feature request: what they want, why it would help, and any example. Keep their meaning; do not invent features they did not ask for. Plain text, under 120 words.'
export function FieldFeedback({ profile }) {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState(null)
  const [reviewUrl, setReviewUrl] = useState(null)
  useEffect(() => { supabase.rpc('journey_public_link', { p_key: 'journey_google_review_url' }).then(({ data }) => setReviewUrl(data || null)) }, [])
  async function write(idea) {
    const v = String(idea || '').trim()
    if (!v) return
    setBusy('write'); setMsg(null)
    const { data, error } = await supabase.functions.invoke('ai-assist', { body: { system: IDEA_SYS, prompt: v, context: {} } })
    setBusy('')
    const out = data?.text || data?.reply || data?.content || data?.result
    if (error || data?.error || !out) { setText(v); setMsg({ ok: false, t: 'Quincy couldn\'t write it right now — your words are in the box; edit and submit.' }); return }
    setText(String(out).trim())
  }
  async function submit() {
    setBusy('send'); setMsg(null)
    const { data, error } = await supabase.functions.invoke('field-report-email', { body: { action: 'feedback', body: text } })
    let e = data?.error
    if (!e && error) { try { e = (await error.context?.json())?.error } catch { /* generic */ } e = e || error.message }
    setBusy('')
    if (e) setMsg({ ok: false, t: e }); else { setMsg({ ok: true, t: data?.note || 'Thank you — your idea was sent to the Journey team.' }); setText('') }
  }
  return (
    <div className="fa-shell">
      <div className="fa-header">
        <button type="button" className="fa-back-btn" aria-label="Back" onClick={back(navigate)}>↶</button>
        <div className="fa-header-title">Feedback</div>
        <div className="fa-header-sub" style={{ fontWeight: 600 }}>Journey</div>
      </div>
      <div className="fa-body">
        <div className="fa-panel">
          <textarea className="fa-textarea" style={{ minHeight: 230 }} value={text} onChange={(e) => setText(e.target.value)} placeholder={busy === 'write' ? 'Quincy is writing…' : 'Your idea, request, or problem…'} />
          {msg && <div className={`fa-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.t}</div>}
          <button type="button" className="fa-navbtn" disabled={!!busy || !text.trim()} onClick={submit}>{busy === 'send' ? 'Sending…' : 'Submit'}</button>
          {reviewUrl && (
            <a href={reviewUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', borderRadius: 999, padding: '10px', background: 'linear-gradient(90deg,#00B0F0,#FFF200,#00A34A)', color: '#0C2E44', fontWeight: 800, fontSize: 14 }}>
              GOOGLE REVIEWS<br /><span style={{ color: '#E0A100', letterSpacing: 2 }}>★★★★★</span>
            </a>
          )}
        </div>
      </div>
      <AskBar placeholder="Tell me about your idea and I will write it for you." onAsk={write} />
    </div>
  )
}
