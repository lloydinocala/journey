// Rewards-HVAC · Prepare Payroll — the engine UI.
// Reads the weekly capture, automates the greater-of (hourly vs task-hours),
// layers federal taxes, shows net pay, and saves the calc per employee.
import { useState, useEffect, Fragment } from 'react'
import { getSettings } from './hrData'
import {
  loadWeek, computeGross, computeTaxes, getYtdGross, savePaycheckCalc,
  mondayOf, addDays, money,
} from './payrollData'
import { useOrgSelector, OrgBar, FlagChip } from './shared'

const DELIVERY = [
  { v: 'manual', l: 'Manual (record only)' },
  { v: 'print', l: 'Print check' },
  { v: 'direct_deposit', l: 'Direct deposit' },
  { v: 'export', l: 'Export to accountant' },
]
const METHOD_LABEL = { hourly: 'Hourly', performance: 'Performance (task-hrs)', piece: 'Piece rate', salary: 'Salary' }

export default function PreparePayroll({ profile }) {
  const org = useOrgSelector(profile)
  const [weekStart, setWeekStart] = useState(mondayOf(new Date()))
  const [frequency, setFrequency] = useState('weekly')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [filingOverride, setFilingOverride] = useState({})
  const [deliveryOverride, setDeliveryOverride] = useState({})
  const [savingId, setSavingId] = useState(null)
  const [msg, setMsg] = useState('')

  async function load() {
    if (!org.selectedOrg) return
    setLoading(true); setMsg('')
    const settings = await getSettings(org.selectedOrg)
    const freq = settings?.pay_frequency || 'weekly'
    setFrequency(freq)
    const sutaRate = settings?.settings?.suta_rate || 0

    const { weeks, users, comp, clockHours, profiles, existingCalcs } = await loadWeek(org.selectedOrg, weekStart)
    const userName = (id) => (users.find((u) => u.id === id) || {}).full_name || 'Employee'

    // YTD gross per user (before this week) for FICA/FUTA caps.
    const ytdMap = {}
    await Promise.all(weeks.map(async (w) => { ytdMap[w.user_id] = await getYtdGross(org.selectedOrg, w.user_id, weekStart) }))

    const built = weeks.map((w) => {
      const c = comp[w.id] || { base: null, bonuses: [], commissions: [] }
      const g = computeGross(c.base, clockHours[w.user_id], c.bonuses, c.commissions)
      const prof = profiles[w.user_id] || {}
      const filing = filingOverride[w.user_id] || prof.filing_status || 'single'
      const t = computeTaxes({
        gross: g.gross, ytdBefore: ytdMap[w.user_id] || 0, frequency: freq,
        filingStatus: filing, step2Checked: prof.step2_checked, sutaRate,
      })
      const net = Math.round((g.gross - t.employeeTaxes + Number.EPSILON) * 100) / 100
      return {
        week: w, name: userName(w.user_id), user_id: w.user_id, employee_id: prof.employee_id || null,
        hasBase: !!c.base, hasProfile: !!prof.filing_status, filing, clocked: clockHours[w.user_id],
        g, t, net, existing: existingCalcs[w.id] || null,
        delivery: deliveryOverride[w.user_id] || existingCalcs[w.id]?.delivery_mode || 'manual',
      }
    })
    setRows(built)
    setLoading(false)
  }
  useEffect(() => { load() }, [org.selectedOrg, weekStart, filingOverride, deliveryOverride])

  async function saveRow(r) {
    setSavingId(r.user_id); setMsg('')
    const { g, t } = r
    const { error } = await savePaycheckCalc(org.selectedOrg, {
      week_id: r.week.id, user_id: r.user_id, employee_id: r.employee_id,
      week_start: weekStart, week_end: addDays(weekStart, 6), frequency,
      clocked_hours: g.totalHours, reg_hours: g.regHours, ot_hours: g.otHours, hourly_rate: g.rate,
      task_hours: g.taskHours, task_bonus: g.taskBonus,
      hourly_base: g.hourlyBase, performance_base: g.performanceBase, chosen_method: g.chosenMethod,
      chosen_base: g.chosenBase, ot_premium: g.otPremium, bonus_total: g.bonusTotal, commission_total: g.commissionTotal,
      gross_pay: g.gross, filing_status: r.filing, step2_checked: false,
      fed_income_wh: t.fed_income_wh, ss_employee: t.ss_employee, ss_employer: t.ss_employer,
      medicare_employee: t.medicare_employee, medicare_employer: t.medicare_employer,
      addl_medicare: t.addl_medicare, futa: t.futa, suta: t.suta,
      employee_taxes: t.employeeTaxes, employer_taxes: t.employerTaxes, net_pay: r.net,
      delivery_mode: r.delivery, status: 'draft',
      tax_detail: { hourlyBase: g.hourlyBase, performanceBase: g.performanceBase, pieceBase: g.pieceBase },
    })
    setSavingId(null)
    setMsg(error ? error.message : `Saved ${r.name}.`)
    load()
  }

  async function saveAll() {
    for (const r of rows.filter((x) => x.hasBase)) { await saveRow(r) } // eslint-disable-line
    setMsg('All eligible paychecks computed & saved.')
  }

  const totals = rows.reduce((a, r) => ({
    gross: a.gross + r.g.gross, empTax: a.empTax + r.t.employeeTaxes,
    erTax: a.erTax + r.t.employerTaxes, net: a.net + r.net,
  }), { gross: 0, empTax: 0, erTax: 0, net: 0 })
  const setAside = totals.empTax + (rows.reduce((a, r) => a + r.t.ss_employer + r.t.medicare_employer, 0))

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Prepare Payroll</h2>
          <span className="badge">{rows.length} employees</span>
        </div>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={loading || !rows.some((r) => r.hasBase)} onClick={saveAll}>
          Compute &amp; Save All
        </button>
      </div>
      <OrgBar {...org} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0 16px', flexWrap: 'wrap' }}>
        <button className="logout-button" onClick={() => setWeekStart(addDays(weekStart, -7))}>&larr; Prev</button>
        <div style={{ fontWeight: 700 }}>Week of {weekStart} – {addDays(weekStart, 6)}</div>
        <button className="logout-button" onClick={() => setWeekStart(addDays(weekStart, 7))}>Next &rarr;</button>
        <input type="date" value={weekStart} onChange={(e) => setWeekStart(mondayOf(e.target.value))} />
        <span className="badge" style={{ marginLeft: 8 }}>{frequency}</span>
      </div>
      {msg && <div style={{ marginBottom: 12, color: msg.includes('Saved') || msg.includes('All') ? '#166534' : '#B00020' }}>{msg}</div>}

      {loading ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : rows.length === 0 ? (
        <p style={{ color: 'var(--mist)' }}>
          No payroll weeks started for this week. Use <strong>Payroll Capture</strong> to start weeks and enter hours/bonuses,
          then return here to compute taxes &amp; net pay.
        </p>
      ) : (
        <>
          <table className="data-table">
            <thead><tr><th>Employee</th><th>Basis</th><th>Gross</th><th>Fed WH</th><th>FICA</th><th>Net</th><th>Delivery</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <Fragment key={r.user_id}>
                  <tr>
                    <td>
                      {r.name}
                      {!r.hasProfile && <div><FlagChip severity="amber">No tax profile — using {r.filing}</FlagChip></div>}
                    </td>
                    <td>
                      {r.hasBase ? (
                        <span title={`hourly ${money(r.g.hourlyBase)} vs performance ${money(r.g.performanceBase)}`}>
                          {METHOD_LABEL[r.g.chosenMethod] || r.g.chosenMethod}
                          {r.g.chosenMethod !== 'hourly' && r.g.chosenMethod !== 'salary' && <span style={{ color: '#166534' }}> ✓ greater-of</span>}
                        </span>
                      ) : <span style={{ color: 'var(--mist)' }}>no base pay entered</span>}
                    </td>
                    <td>{money(r.g.gross)}</td>
                    <td>{money(r.t.fed_income_wh)}</td>
                    <td>{money(r.t.ss_employee + r.t.medicare_employee + r.t.addl_medicare)}</td>
                    <td style={{ fontWeight: 700 }}>{money(r.net)}</td>
                    <td>
                      <select value={r.delivery} onChange={(e) => setDeliveryOverride({ ...deliveryOverride, [r.user_id]: e.target.value })}>
                        {DELIVERY.map((d) => <option key={d.v} value={d.v}>{d.l}</option>)}
                      </select>
                    </td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="logout-button" onClick={() => setExpanded(expanded === r.user_id ? null : r.user_id)}>{expanded === r.user_id ? 'Hide' : 'Detail'}</button>
                      <button className="auth-button" style={{ width: 'auto', padding: '4px 12px', margin: 0 }} disabled={!r.hasBase || savingId === r.user_id} onClick={() => saveRow(r)}>
                        {savingId === r.user_id ? '…' : r.existing ? 'Update' : 'Save'}
                      </button>
                    </td>
                  </tr>
                  {expanded === r.user_id && (
                    <tr>
                      <td colSpan="8" style={{ background: '#F8FAFC' }}>
                        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', padding: '6px 4px' }}>
                          <Detail title="Greater-of basis" rows={[
                            ['Clocked hours', `${r.g.totalHours} (reg ${r.g.regHours} / OT ${r.g.otHours})`],
                            ['Hourly pay', money(r.g.hourlyBase)],
                            ['Task-hours pay', money(r.g.performanceBase)],
                            ['Chosen', `${METHOD_LABEL[r.g.chosenMethod]} → ${money(r.g.chosenBase)}`],
                            r.g.otPremium ? ['FLSA OT premium', money(r.g.otPremium)] : null,
                            ['Bonuses', money(r.g.bonusTotal)],
                            ['Commissions', money(r.g.commissionTotal)],
                            ['Gross pay', money(r.g.gross)],
                          ].filter(Boolean)} />
                          <Detail title="Employee taxes" rows={[
                            ['Federal income WH', money(r.t.fed_income_wh)],
                            ['Social Security (6.2%)', money(r.t.ss_employee)],
                            ['Medicare (1.45%)', money(r.t.medicare_employee)],
                            r.t.addl_medicare ? ['Add’l Medicare (0.9%)', money(r.t.addl_medicare)] : null,
                            ['Total withheld', money(r.t.employeeTaxes)],
                            ['Net pay', money(r.net)],
                          ].filter(Boolean)} />
                          <Detail title="Employer taxes" rows={[
                            ['Social Security', money(r.t.ss_employer)],
                            ['Medicare', money(r.t.medicare_employer)],
                            ['FUTA', money(r.t.futa)],
                            ['SUTA', money(r.t.suta)],
                            ['Total employer cost', money(r.t.employerTaxes)],
                          ]} />
                          {!r.hasProfile && (
                            <div style={{ minWidth: 200 }}>
                              <div style={{ fontWeight: 700, marginBottom: 6 }}>Filing status (temp)</div>
                              <select value={r.filing} onChange={(e) => setFilingOverride({ ...filingOverride, [r.user_id]: e.target.value })}>
                                <option value="single">Single</option><option value="married">Married (jointly)</option><option value="hoh">Head of household</option>
                              </select>
                              <p style={{ fontSize: 12, color: 'var(--mist)', marginTop: 6 }}>Set the real W-4 on the employee's HR profile to remove this.</p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 20 }}>
            <Stat label="Total gross" value={money(totals.gross)} />
            <Stat label="Employee withheld" value={money(totals.empTax)} />
            <Stat label="Total net (take-home)" value={money(totals.net)} />
            <Stat label="Tax to set aside" value={money(setAside)} accent />
          </div>
          <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 10, maxWidth: 720 }}>
            <strong>Set-aside</strong> = everything owed to the government for this run (employee withholding + both halves of
            FICA + employer FUTA/SUTA). Move this amount into your dedicated tax account now — the guided deposit calendar,
            941/940 forms, and one-click direct payment come in the Tax Center (Phase R3).
          </p>
        </>
      )}
    </div>
  )
}

function Detail({ title, rows }) {
  return (
    <div style={{ minWidth: 220 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <table style={{ fontSize: 13 }}><tbody>
        {rows.map(([k, v], i) => (
          <tr key={i}><td style={{ color: 'var(--mist)', paddingRight: 14 }}>{k}</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{v}</td></tr>
        ))}
      </tbody></table>
    </div>
  )
}

function Stat({ label, value, accent }) {
  return (
    <div style={{ border: `1px solid ${accent ? '#FDE68A' : 'var(--border)'}`, background: accent ? '#FFFBEB' : '#fff', borderRadius: 12, padding: '14px 18px', minWidth: 160 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent ? '#B8720A' : 'var(--route-blue, #1B3A6B)' }}>{value}</div>
      <div style={{ fontSize: 13, color: 'var(--mist)', marginTop: 2 }}>{label}</div>
    </div>
  )
}
