// Rewards-HVAC · Paychecks — printable stubs/checks, numbering, delivery modes.
import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabase'
import { getSettings, listUsers } from './hrData'
import { getYtdGross, money, mondayOf, addDays } from './payrollData'
import { loadCalcs } from './taxCenterData'
import { useOrgSelector, OrgBar } from './shared'

const DELIVERY_LABEL = { manual: 'Manual (record only)', print: 'Print check', direct_deposit: 'Direct deposit', export: 'Export to accountant' }

export default function Paychecks({ profile }) {
  const org = useOrgSelector(profile)
  const [weekStart, setWeekStart] = useState(mondayOf(new Date()))
  const [rows, setRows] = useState([])
  const [names, setNames] = useState({})
  const [orgName, setOrgName] = useState('')
  const [settings, setSettings] = useState(null)
  const [paychecks, setPaychecks] = useState({})
  const [loading, setLoading] = useState(false)

  async function load() {
    if (!org.selectedOrg) return
    setLoading(true)
    const [calcs, users, s, orgRes, pcRes] = await Promise.all([
      loadCalcs(org.selectedOrg, { from: weekStart, to: weekStart }),
      listUsers(org.selectedOrg), getSettings(org.selectedOrg),
      supabase.from('organizations').select('name').eq('id', org.selectedOrg).maybeSingle(),
      supabase.from('rewards_paychecks').select('*').eq('org_id', org.selectedOrg),
    ])
    const nm = {}; users.forEach((u) => { nm[u.id] = u.full_name }); setNames(nm)
    setOrgName(orgRes.data?.name || 'Employer'); setSettings(s)
    const pc = {}; (pcRes.data || []).forEach((p) => { pc[p.calc_id] = p }); setPaychecks(pc)
    setRows(calcs)
    setLoading(false)
  }
  useEffect(() => { load() }, [org.selectedOrg, weekStart])

  async function issue(calc) {
    const existing = paychecks[calc.id]
    const nextNum = existing?.check_number || window.prompt('Check number (leave blank for direct deposit / manual):', '')
    if (nextNum === null) return
    await supabase.from('rewards_paychecks').upsert({
      org_id: org.selectedOrg, calc_id: calc.id, user_id: calc.user_id, employee_id: calc.employee_id,
      check_number: nextNum || null, check_date: calc.week_end, net_amount: calc.net_pay,
      delivery_mode: calc.delivery_mode, status: 'issued', printed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'calc_id' })
    load()
  }

  async function printStub(calc) {
    const ytd = await getYtdGross(org.selectedOrg, calc.user_id, calc.week_start)
    const ytdGross = ytd + (Number(calc.gross_pay) || 0)
    openStub(calc, names[calc.user_id] || 'Employee', orgName, ytdGross, paychecks[calc.id])
  }

  return (
    <div>
      <div className="page-header-bar"><h2>Paychecks</h2></div>
      <OrgBar {...org} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0 16px', flexWrap: 'wrap' }}>
        <button className="logout-button" onClick={() => setWeekStart(addDays(weekStart, -7))}>&larr; Prev</button>
        <div style={{ fontWeight: 700 }}>Week of {weekStart} – {addDays(weekStart, 6)}</div>
        <button className="logout-button" onClick={() => setWeekStart(addDays(weekStart, 7))}>Next &rarr;</button>
        <input type="date" value={weekStart} onChange={(e) => setWeekStart(mondayOf(e.target.value))} />
      </div>

      {loading ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : rows.length === 0 ? (
        <p style={{ color: 'var(--mist)' }}>No computed paychecks for this week. Compute them in <strong>Prepare Payroll</strong> first.</p>
      ) : (
        <table className="data-table">
          <thead><tr><th>Employee</th><th>Gross</th><th>Net</th><th>Delivery</th><th>Check #</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.map((c) => {
              const pc = paychecks[c.id]
              return (
                <tr key={c.id}>
                  <td>{names[c.user_id] || c.user_id}</td>
                  <td>{money(c.gross_pay)}</td>
                  <td style={{ fontWeight: 700 }}>{money(c.net_pay)}</td>
                  <td>{DELIVERY_LABEL[c.delivery_mode] || c.delivery_mode}</td>
                  <td>{pc?.check_number || '—'}</td>
                  <td>{pc ? <span style={{ color: '#166534' }}>Issued</span> : <span style={{ color: 'var(--mist)' }}>Draft</span>}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    {c.delivery_mode !== 'manual' && <button className="logout-button" onClick={() => printStub(c)}>🖨 Stub</button>}
                    <button className="auth-button" style={{ width: 'auto', padding: '4px 12px', margin: 0 }} onClick={() => issue(c)}>{pc ? 'Update' : 'Issue'}</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 14, maxWidth: 720 }}>
        <strong>Manual</strong> delivery records the paycheck for the payroll history without printing — you write the check by hand.
        <strong> Print</strong> opens a pay stub you can print on check stock. Direct-deposit and accountant-export files come with the banking/export passes.
      </p>
    </div>
  )
}

function openStub(c, name, orgName, ytdGross, pc) {
  const w = window.open('', '_blank', 'width=760,height=900')
  if (!w) return
  const row = (l, v, b) => `<tr><td>${l}</td><td class="r${b ? ' b' : ''}">${v}</td></tr>`
  const m = (n) => '$' + (Number(n) || 0).toFixed(2)
  const empTaxRows =
    row('Federal income tax', '-' + m(c.fed_income_wh)) +
    row('Social Security', '-' + m(c.ss_employee)) +
    row('Medicare', '-' + m(c.medicare_employee)) +
    (Number(c.addl_medicare) ? row('Add’l Medicare', '-' + m(c.addl_medicare)) : '')
  w.document.write(`<html><head><title>Pay Stub — ${name}</title>
    <style>body{font-family:Arial,sans-serif;padding:28px;color:#111}h1{font-size:16px;margin:0}h2{font-size:13px;color:#555;margin:2px 0 16px}
    .grid{display:flex;gap:32px;flex-wrap:wrap}table{border-collapse:collapse;min-width:260px}td{padding:5px 4px;border-bottom:1px solid #e5e5e5;font-size:13px}.r{text-align:right;font-weight:600}.b{font-weight:800}
    .net{margin-top:18px;padding:12px 16px;background:#0f2f5f;color:#fff;border-radius:8px;display:flex;justify-content:space-between;font-size:16px;font-weight:800}</style></head><body>
    <h1>${orgName}</h1><h2>Pay stub — pay period ${c.week_start} to ${c.week_end}${pc?.check_number ? ' · Check #' + pc.check_number : ''}</h2>
    <div style="font-weight:700;margin-bottom:12px">${name}</div>
    <div class="grid">
      <div><div class="b" style="margin-bottom:6px">Earnings</div><table><tbody>
        ${row('Basis (' + (c.chosen_method || '') + ')', m(c.chosen_base))}
        ${Number(c.ot_premium) ? row('FLSA OT premium', m(c.ot_premium)) : ''}
        ${Number(c.bonus_total) ? row('Bonuses', m(c.bonus_total)) : ''}
        ${Number(c.commission_total) ? row('Commissions', m(c.commission_total)) : ''}
        ${row('Gross pay', m(c.gross_pay), true)}
      </tbody></table></div>
      <div><div class="b" style="margin-bottom:6px">Taxes withheld</div><table><tbody>
        ${empTaxRows}
        ${row('Total withheld', '-' + m(c.employee_taxes), true)}
      </tbody></table></div>
    </div>
    <div class="net"><span>Net pay</span><span>${m(c.net_pay)}</span></div>
    <div style="margin-top:14px;font-size:12px;color:#666">YTD gross: ${m(ytdGross)} · Hours: ${c.clocked_hours || 0} (OT ${c.ot_hours || 0})</div>
    </body></html>`)
  w.document.close(); w.focus(); w.print()
}
