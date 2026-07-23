// Rewards-HVAC · Year-End — W-2/W-3, Form 940, and 1099-NEC, from the year's payroll.
import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabase'
import { getSettings } from './hrData'
import { loadYear, buildW2s, buildW3, build940, list1099, add1099, delete1099, money } from './yearEndData'
import { useOrgSelector, OrgBar } from './shared'

const blank1099 = { payee_name: '', tin_last4: '', amount: '' }

export default function YearEnd({ profile }) {
  const org = useOrgSelector(profile)
  const [year, setYear] = useState(new Date().getFullYear())
  const [w2s, setW2s] = useState([])
  const [w3, setW3] = useState(null)
  const [f940, setF940] = useState(null)
  const [nec, setNec] = useState([])
  const [orgName, setOrgName] = useState('')
  const [settings, setSettings] = useState(null)
  const [form, setForm] = useState(blank1099)
  const [loading, setLoading] = useState(false)

  async function load() {
    if (!org.selectedOrg) return
    setLoading(true)
    const [{ calcs, empByUser }, s, orgRes, necRows] = await Promise.all([
      loadYear(org.selectedOrg, year), getSettings(org.selectedOrg),
      supabase.from('organizations').select('name').eq('id', org.selectedOrg).maybeSingle(),
      list1099(org.selectedOrg, year),
    ])
    const w = buildW2s(calcs, empByUser)
    setW2s(w); setW3(buildW3(w)); setF940(build940(calcs)); setNec(necRows)
    setOrgName(orgRes.data?.name || 'Employer'); setSettings(s)
    setLoading(false)
  }
  useEffect(() => { load() }, [org.selectedOrg, year])

  async function addPayee(e) {
    e.preventDefault()
    if (!form.payee_name.trim()) return
    await add1099(org.selectedOrg, { tax_year: year, payee_name: form.payee_name.trim(), tin_last4: form.tin_last4 || null, amount: parseFloat(form.amount) || 0 })
    setForm(blank1099); load()
  }

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><h2>Year-End Forms</h2>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[year + 1, year, year - 1, year - 2].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => b - a).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>
      <OrgBar {...org} />

      {loading ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : (
        <>
          {/* W-2 */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>W-2 statements — {year}</h3>
              {w2s.length > 0 && <button className="logout-button" onClick={() => printW3(w3, year, orgName, settings)}>🖨 Print W-3 (totals)</button>}
            </div>
            {w2s.length === 0 ? <p style={{ color: 'var(--mist)' }}>No payroll in {year}.</p> : (
              <table className="data-table">
                <thead><tr><th>Employee</th><th>Box 1 wages</th><th>Box 2 fed WH</th><th>SS wages</th><th>Medicare</th><th>401(k)</th><th></th></tr></thead>
                <tbody>
                  {w2s.map((w) => (
                    <tr key={w.user_id}>
                      <td>{w.name} <span style={{ color: 'var(--mist)', fontSize: 12 }}>…{w.ssn_last4}</span></td>
                      <td>{money(w.box1)}</td><td>{money(w.box2)}</td><td>{money(w.box3)}</td><td>{money(w.box5)}</td>
                      <td>{w.box12D ? money(w.box12D) : '—'}</td>
                      <td><button className="logout-button" onClick={() => printW2(w, year, orgName, settings)}>🖨 W-2</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* 940 */}
          {f940 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <h3 style={{ margin: 0 }}>Form 940 — FUTA {year}</h3>
                <button className="logout-button" onClick={() => print940(f940, year, orgName, settings)}>🖨 Print 940</button>
              </div>
              <table className="data-table" style={{ maxWidth: 520 }}>
                <tbody>
                  <tr><td style={{ color: 'var(--mist)' }}>3 · Total payments to employees</td><td style={{ textAlign: 'right' }}>{money(f940.line3)}</td></tr>
                  <tr><td style={{ color: 'var(--mist)' }}>5 · Payments over $7,000 (excluded)</td><td style={{ textAlign: 'right' }}>{money(f940.line5)}</td></tr>
                  <tr><td style={{ color: 'var(--mist)' }}>7 · Taxable FUTA wages</td><td style={{ textAlign: 'right' }}>{money(f940.line7)}</td></tr>
                  <tr><td style={{ fontWeight: 700 }}>8 · FUTA tax (0.6%)</td><td style={{ textAlign: 'right', fontWeight: 800 }}>{money(f940.line8)}</td></tr>
                </tbody>
              </table>
            </div>
          )}

          {/* 1099-NEC */}
          <div>
            <h3 style={{ marginBottom: 8 }}>1099-NEC — subcontractors {year}</h3>
            <p style={{ color: 'var(--mist)', fontSize: 13, maxWidth: 720 }}>
              Enter total paid to each non-employee contractor. A 1099-NEC is required for anyone paid <strong>$600+</strong>.
              Use the <strong>Worker Classification</strong> checker first to confirm they're truly 1099, not a W-2 employee.
            </p>
            <form className="inline-form" onSubmit={addPayee} style={{ margin: '10px 0 16px', flexWrap: 'wrap', gap: 12 }}>
              <div className="field"><label>Payee</label><input value={form.payee_name} onChange={(e) => setForm({ ...form, payee_name: e.target.value })} placeholder="Jim's Welding LLC" required /></div>
              <div className="field" style={{ width: 90 }}><label>TIN·4</label><input maxLength="4" value={form.tin_last4} onChange={(e) => setForm({ ...form, tin_last4: e.target.value })} /></div>
              <div className="field"><label>Total paid</label><input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></div>
              <button className="auth-button" type="submit" style={{ width: 'auto' }}>Add</button>
            </form>
            {nec.length > 0 && (
              <table className="data-table">
                <thead><tr><th>Payee</th><th>TIN</th><th>Amount</th><th>1099 required?</th><th></th></tr></thead>
                <tbody>
                  {nec.map((p) => (
                    <tr key={p.id}>
                      <td>{p.payee_name}</td><td>…{p.tin_last4 || '?'}</td><td>{money(p.amount)}</td>
                      <td>{Number(p.amount) >= 600 ? <span style={{ color: '#B8720A', fontWeight: 700 }}>Yes</span> : <span style={{ color: 'var(--mist)' }}>No (under $600)</span>}</td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        <button className="logout-button" onClick={() => print1099(p, year, orgName, settings)}>🖨 1099</button>
                        <button className="logout-button" onClick={() => { if (confirm('Delete?')) delete1099(p.id).then(load) }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function win(title, inner) {
  const w = window.open('', '_blank', 'width=720,height=900'); if (!w) return
  w.document.write(`<html><head><title>${title}</title><style>body{font-family:Arial,sans-serif;padding:30px;color:#111}h1{font-size:16px}table{width:100%;border-collapse:collapse;margin-top:14px}td{padding:6px 5px;border-bottom:1px solid #ddd;font-size:13px}.r{text-align:right;font-weight:600}.b{font-weight:800}.s{color:#666;font-size:11px;margin-top:20px}</style></head><body>${inner}</body></html>`)
  w.document.close(); w.focus(); w.print()
}
const m = (n) => '$' + (Number(n) || 0).toFixed(2)
const employerHdr = (orgName, settings) => `<div>${orgName}${settings?.fein ? ' · FEIN ' + settings.fein : ''}</div>`

function printW2(w, year, orgName, settings) {
  win(`W-2 ${year} — ${w.name}`, `<h1>Form W-2 — Wage and Tax Statement (${year})</h1>${employerHdr(orgName, settings)}
    <div style="margin-top:8px">Employee: <strong>${w.name}</strong> · SSN …${w.ssn_last4}</div>
    <table><tbody>
    <tr><td>1 · Wages, tips, other comp</td><td class="r">${m(w.box1)}</td></tr>
    <tr><td>2 · Federal income tax withheld</td><td class="r">${m(w.box2)}</td></tr>
    <tr><td>3 · Social Security wages</td><td class="r">${m(w.box3)}</td></tr>
    <tr><td>4 · Social Security tax withheld</td><td class="r">${m(w.box4)}</td></tr>
    <tr><td>5 · Medicare wages and tips</td><td class="r">${m(w.box5)}</td></tr>
    <tr><td>6 · Medicare tax withheld</td><td class="r">${m(w.box6)}</td></tr>
    <tr><td>12a · Code D (401(k) elective deferral)</td><td class="r">${m(w.box12D)}</td></tr>
    <tr><td>14 · Other — Qualified OT premium (No Tax on OT)</td><td class="r">${m(w.box14_ot)}</td></tr>
    <tr><td>15-17 · State (${w.state || '—'}) wages / income tax</td><td class="r">${m(w.box16)} / ${m(w.box17)}</td></tr>
    </tbody></table>
    <p class="s">Generated by Rewards-HVAC. Verify against official IRS W-2 (incl. current box codes for tips/overtime) before filing with the SSA.</p>`)
}
function printW3(t, year, orgName, settings) {
  win(`W-3 ${year}`, `<h1>Form W-3 — Transmittal of Wage and Tax Statements (${year})</h1>${employerHdr(orgName, settings)}
    <div style="margin-top:8px">Total W-2 forms: <strong>${t.count}</strong></div>
    <table><tbody>
    <tr><td>1 · Total wages</td><td class="r">${m(t.box1)}</td></tr>
    <tr><td>2 · Total federal income tax withheld</td><td class="r">${m(t.box2)}</td></tr>
    <tr><td>3 · Total Social Security wages</td><td class="r">${m(t.box3)}</td></tr>
    <tr><td>4 · Total Social Security tax</td><td class="r">${m(t.box4)}</td></tr>
    <tr><td>5 · Total Medicare wages</td><td class="r">${m(t.box5)}</td></tr>
    <tr><td>6 · Total Medicare tax</td><td class="r">${m(t.box6)}</td></tr>
    <tr><td class="b">Total state income tax (box 17)</td><td class="r b">${m(t.box17)}</td></tr>
    </tbody></table><p class="s">Generated by Rewards-HVAC. Verify before filing.</p>`)
}
function print940(f, year, orgName, settings) {
  win(`Form 940 ${year}`, `<h1>Form 940 — Employer's Annual FUTA Tax Return (${year})</h1>${employerHdr(orgName, settings)}
    <table><tbody>
    <tr><td>3 · Total payments to all employees</td><td class="r">${m(f.line3)}</td></tr>
    <tr><td>5 · Payments over $7,000 (excluded)</td><td class="r">${m(f.line5)}</td></tr>
    <tr><td>7 · Total taxable FUTA wages</td><td class="r">${m(f.line7)}</td></tr>
    <tr><td class="b">8 · FUTA tax (0.6%)</td><td class="r b">${m(f.line8)}</td></tr>
    </tbody></table><p class="s">Assumes full state UI credit (0.6% net). Adjust for credit-reduction states. Verify before filing.</p>`)
}
function print1099(p, year, orgName, settings) {
  win(`1099-NEC ${year} — ${p.payee_name}`, `<h1>Form 1099-NEC — Nonemployee Compensation (${year})</h1>${employerHdr(orgName, settings)}
    <div style="margin-top:8px">Payer: ${orgName}</div>
    <div>Recipient: <strong>${p.payee_name}</strong> · TIN …${p.tin_last4 || '____'}</div>
    <table><tbody><tr><td class="b">1 · Nonemployee compensation</td><td class="r b">${m(p.amount)}</td></tr></tbody></table>
    <p class="s">Required if $600+. Collect a W-9 (and backup-withhold 24% if the TIN is missing). Verify before filing with the IRS.</p>`)
}
