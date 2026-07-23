// Rewards-HVAC · Tax Center — the mission. Set-aside ledger, deposit calendar,
// guided EFTPS hand-off, Form 941 summary, and accountant export. Path B: we tell
// the contractor exactly what's owed and when; they pay the IRS from their own account.
import { useState, useEffect } from 'react'
import { getSettings, listUsers } from './hrData'
import {
  loadCalcs, summarize, buildDepositCalendar, buildFutaDeposits, build941,
  exportCsv, listSetAsides, confirmSetAside, listDeposits, markDepositPaid,
  deposit941Of, money,
} from './taxCenterData'
import { useOrgSelector, OrgBar, SetupNotice, FlagChip } from './shared'

function quarterRange(year, q) {
  const startM = (q - 1) * 3
  const from = `${year}-${String(startM + 1).padStart(2, '0')}-01`
  const endD = new Date(year, startM + 3, 0)
  const tz = endD.getTimezoneOffset() * 60000
  const to = new Date(endD - tz).toISOString().slice(0, 10)
  return { from, to }
}

export default function TaxCenter({ profile }) {
  const org = useOrgSelector(profile)
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1)
  const [settings, setSettings] = useState(null)
  const [names, setNames] = useState({})
  const [calcs, setCalcs] = useState([])
  const [setAsides, setSetAsides] = useState({})
  const [deposits, setDeposits] = useState({})
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(false)

  async function load() {
    if (!org.selectedOrg) return
    setLoading(true)
    const { from, to } = quarterRange(year, quarter)
    const [s, users, cs, sa, dp] = await Promise.all([
      getSettings(org.selectedOrg), listUsers(org.selectedOrg),
      loadCalcs(org.selectedOrg, { from, to }), listSetAsides(org.selectedOrg), listDeposits(org.selectedOrg),
    ])
    setSettings(s); setEnabled(!!s?.enabled)
    const nm = {}; users.forEach((u) => { nm[u.id] = u.full_name }); setNames(nm)
    setCalcs(cs); setSetAsides(sa); setDeposits(dp)
    setLoading(false)
  }
  useEffect(() => { load() }, [org.selectedOrg, year, quarter])

  const scheduleType = settings?.default_deposit_schedule || 'monthly'
  const accountLabel = settings?.tax_setaside_account_label || 'your dedicated tax account'
  const summary = summarize(calcs)
  const depCal = buildDepositCalendar(calcs, scheduleType)
  const futa = buildFutaDeposits(calcs)
  const f941 = build941(calcs, year, quarter)

  // Group set-aside by pay week
  const byWeek = {}
  calcs.forEach((c) => {
    const k = c.week_start
    if (!byWeek[k]) byWeek[k] = { week_start: k, week_end: c.week_end, liability_941: 0, futa: 0, suta: 0, total: 0 }
    byWeek[k].liability_941 += deposit941Of(c)
    byWeek[k].futa += Number(c.futa) || 0
    byWeek[k].suta += Number(c.suta) || 0
    byWeek[k].total += (Number(c.employee_taxes) || 0) + (Number(c.ss_employer) || 0) + (Number(c.medicare_employer) || 0) + (Number(c.futa) || 0) + (Number(c.suta) || 0)
  })
  const weeks = Object.values(byWeek).sort((a, b) => (a.week_start < b.week_start ? -1 : 1))

  async function doConfirmSetAside(w) {
    await confirmSetAside(org.selectedOrg, {
      period_start: w.week_start, period_end: w.week_end,
      liability_941: round2(w.liability_941), futa: round2(w.futa), suta: round2(w.suta), total: round2(w.total),
      account_label: accountLabel, confirmed_by: profile.id,
    })
    load()
  }

  async function doPayDeposit(dep) {
    const conf = window.prompt('Enter the EFTPS/bank confirmation number (optional) to mark this deposit paid:')
    if (conf === null) return
    await markDepositPaid(org.selectedOrg, dep, conf)
    load()
  }

  function downloadCsv() {
    const csv = exportCsv(calcs, names)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `payroll_${year}_Q${quarter}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="page-header-bar"><h2>Tax Center</h2></div>
      <OrgBar {...org} />
      <SetupNotice enabled={enabled} />

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
        <label>Quarter</label>
        <select value={quarter} onChange={(e) => setQuarter(Number(e.target.value))}>
          {[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {[year - 1, year, year + 1].filter((v, i, a) => a.indexOf(v) === i).map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <span className="badge">{scheduleType} depositor</span>
        <button className="logout-button" style={{ marginLeft: 'auto' }} onClick={downloadCsv} disabled={!calcs.length}>⬇ Export for accountant (CSV)</button>
      </div>

      {loading ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : (
        <>
          {/* SET-ASIDE LEDGER */}
          <Section title="1 · Tax set-aside (quarantine)"
            note={`The moment payroll runs, move this money into ${accountLabel} so it's never spent. This is the #1 way to stay clean — the withheld taxes aren't yours, they're the government's.`}>
            {weeks.length === 0 ? <Empty text="No payroll runs this quarter yet." /> : (
              <table className="data-table">
                <thead><tr><th>Pay week</th><th>941 taxes</th><th>FUTA</th><th>Total to set aside</th><th>Status</th></tr></thead>
                <tbody>
                  {weeks.map((w) => {
                    const done = setAsides[w.week_start]?.confirmed_at
                    return (
                      <tr key={w.week_start}>
                        <td>{w.week_start}</td>
                        <td>{money(w.liability_941)}</td>
                        <td>{money(w.futa)}</td>
                        <td style={{ fontWeight: 700, color: '#B8720A' }}>{money(w.total)}</td>
                        <td>{done
                          ? <span style={{ color: '#166534' }}>✓ Set aside {new Date(done).toLocaleDateString()}</span>
                          : <button className="auth-button" style={{ width: 'auto', padding: '4px 12px', margin: 0 }} onClick={() => doConfirmSetAside(w)}>Mark set aside</button>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </Section>

          {/* DEPOSIT CALENDAR */}
          <Section title="2 · Deposit calendar (pay the IRS)"
            note="Federal 941 taxes (income tax withheld + Social Security + Medicare) are deposited on this schedule via EFTPS — the free government system. Money moves from your bank account straight to the IRS; Rewards never touches it. Missing a deadline costs up to 15%.">
            {depCal.length === 0 ? <Empty text="No deposits due this quarter yet." /> : (
              <table className="data-table">
                <thead><tr><th>Type</th><th>Period</th><th>Due date</th><th>Amount</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {[...depCal, ...futa].map((d) => {
                    const rec = deposits[d.kind + ':' + d.period_label]
                    const paid = rec?.status === 'paid'
                    const overdue = !paid && new Date(d.due_date) < new Date()
                    return (
                      <tr key={d.kind + d.period_label}>
                        <td>{d.kind === 'futa' ? 'FUTA (940)' : 'Form 941'}</td>
                        <td>{d.period_label}</td>
                        <td>{overdue ? <FlagChip severity="red">{d.due_date} — overdue</FlagChip> : d.due_date}</td>
                        <td style={{ fontWeight: 700 }}>{money(d.amount)}</td>
                        <td>{paid ? <span style={{ color: '#166534' }}>✓ Paid{rec.confirmation ? ` #${rec.confirmation}` : ''}</span> : 'Upcoming'}</td>
                        <td style={{ display: 'flex', gap: 6 }}>
                          <a className="logout-button" href="https://www.eftps.gov/" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>Pay on EFTPS ↗</a>
                          {!paid && <button className="logout-button" onClick={() => doPayDeposit(d)}>Mark paid</button>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            <p style={{ fontSize: 12, color: 'var(--mist)', marginTop: 8 }}>
              FUTA is deposited quarterly only when accrued over $500 (otherwise carried and paid with the annual Form 940).
              If any single day's liability hits $100,000, it's due the next business day.
            </p>
          </Section>

          {/* FORM 941 */}
          <Section title={`3 · Form 941 — Q${quarter} ${year}`}
            note="Your quarterly federal payroll tax return, auto-filled from the runs above. Review, then file with the IRS (or hand to your accountant via the export).">
            <table className="data-table" style={{ maxWidth: 560 }}>
              <tbody>
                <Row941 n="1" label="Number of employees" v={f941.line1} />
                <Row941 n="2" label="Wages, tips, other compensation" v={money(f941.line2)} />
                <Row941 n="3" label="Federal income tax withheld" v={money(f941.line3)} />
                <Row941 n="5a" label={`Taxable SS wages × 12.4%`} v={`${money(f941.line5a_wages)} → ${money(f941.line5a_tax)}`} />
                <Row941 n="5c" label={`Taxable Medicare wages × 2.9%`} v={`${money(f941.line5c_wages)} → ${money(f941.line5c_tax)}`} />
                <Row941 n="5d" label="Additional Medicare (0.9%)" v={money(f941.line5d_tax)} />
                <Row941 n="5e" label="Total SS + Medicare taxes" v={money(f941.line5e)} />
                <Row941 n="6" label="Total taxes before adjustments" v={money(f941.line6)} bold />
              </tbody>
            </table>
            <button className="logout-button" style={{ marginTop: 10 }} onClick={() => print941Window(f941, settings, year, quarter)}>🖨 Print 941 worksheet</button>
          </Section>

          {/* ANNUAL / OTHER */}
          <Section title="4 · Year-end &amp; other forms"
            note="Generated at year-end from the same data.">
            <ul style={{ color: 'var(--mist)', lineHeight: 1.8 }}>
              <li><strong>Form 940</strong> (annual FUTA) — summarized above; full form at year-end.</li>
              <li><strong>W-2 / W-3</strong> — per-employee wage statements, due Jan 31 (coming).</li>
              <li><strong>1099-NEC</strong> — for subcontractors paid ≥ $600 (coming; use the Classification checker to confirm who's really a 1099).</li>
            </ul>
          </Section>
        </>
      )}
    </div>
  )
}

function round2(n) { return Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100 }

function Section({ title, note, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ marginBottom: 4 }} dangerouslySetInnerHTML={{ __html: title }} />
      {note && <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0, marginBottom: 12, maxWidth: 760 }}>{note}</p>}
      {children}
    </div>
  )
}
function Empty({ text }) { return <div style={{ color: 'var(--mist)' }}>{text}</div> }
function Row941({ n, label, v, bold }) {
  return <tr><td style={{ color: 'var(--mist)', width: 40 }}>{n}</td><td style={{ fontWeight: bold ? 700 : 400 }}>{label}</td><td style={{ textAlign: 'right', fontWeight: bold ? 800 : 600 }}>{v}</td></tr>
}

function print941Window(f, settings, year, quarter) {
  const w = window.open('', '_blank', 'width=720,height=900')
  if (!w) return
  const fein = settings?.fein || '__-_______'
  w.document.write(`<html><head><title>Form 941 Worksheet — Q${quarter} ${year}</title>
    <style>body{font-family:Arial,sans-serif;padding:32px;color:#111}h1{font-size:18px}table{width:100%;border-collapse:collapse;margin-top:16px}td{padding:8px 6px;border-bottom:1px solid #ddd}.r{text-align:right;font-weight:600}.b{font-weight:800}</style></head><body>
    <h1>Form 941 Worksheet — Quarter ${quarter}, ${year}</h1>
    <div>Employer FEIN: ${fein}</div>
    <table><tbody>
    <tr><td>1. Number of employees</td><td class="r">${f.line1}</td></tr>
    <tr><td>2. Wages, tips, other compensation</td><td class="r">$${f.line2.toFixed(2)}</td></tr>
    <tr><td>3. Federal income tax withheld</td><td class="r">$${f.line3.toFixed(2)}</td></tr>
    <tr><td>5a. Taxable SS wages ($${f.line5a_wages.toFixed(2)}) × 12.4%</td><td class="r">$${f.line5a_tax.toFixed(2)}</td></tr>
    <tr><td>5c. Taxable Medicare wages ($${f.line5c_wages.toFixed(2)}) × 2.9%</td><td class="r">$${f.line5c_tax.toFixed(2)}</td></tr>
    <tr><td>5d. Additional Medicare Tax (0.9%)</td><td class="r">$${f.line5d_tax.toFixed(2)}</td></tr>
    <tr><td>5e. Total Social Security + Medicare</td><td class="r">$${f.line5e.toFixed(2)}</td></tr>
    <tr><td class="b">6. Total taxes before adjustments</td><td class="r b">$${f.line6.toFixed(2)}</td></tr>
    </tbody></table>
    <p style="margin-top:24px;color:#666;font-size:12px">Worksheet generated by Rewards-HVAC from your payroll runs. Verify against the official IRS Form 941 before filing.</p>
    </body></html>`)
  w.document.close(); w.focus(); w.print()
}
