// Rewards-HVAC · Payroll provider export.
// Turns the week shown on Prepare Payroll into files that Gusto and ADP Workforce
// Now import, plus a full CSV for an accountant or any other provider.
// The provider calculates taxes and pays people, so these files carry hours and
// earnings only — never Journey's tax estimates or net pay.
import { useEffect, useState } from 'react'
import { getSettings, upsertSettings } from './hrData'
import { money } from './payrollData'

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100

// Earnings beyond plain hourly pay (performance / piece-rate top-up and the FLSA
// overtime premium). Sent as its own earning so hours x rate + this = Journey's base pay.
export function otherEarnings(g) {
  if (g.chosenMethod === 'salary') return 0
  return Math.max(0, round2(g.gross - g.hourlyBase - g.ptoPay - g.bonusTotal - g.commissionTotal))
}

function splitName(full) {
  const parts = String(full || '').trim().split(/\s+/)
  if (parts.length < 2) return [parts[0] || '', '']
  return [parts.slice(0, -1).join(' '), parts[parts.length - 1]]
}

function csvCell(v) {
  if (v == null) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
function toCsv(lines) { return lines.map((l) => l.map(csvCell).join(',')).join('\r\n') + '\r\n' }
function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }))
  const a = document.createElement('a'); a.href = url; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
const num = (n) => (n ? round2(n) : '')

const DEFAULT_CODES = { pto: 'V', bonus: 'B', commission: 'C', other: 'P' }

export default function PayrollExport({ orgId, weekStart, weekEnd, rows }) {
  const [settingsJson, setSettingsJson] = useState({})
  const [coCode, setCoCode] = useState('')
  const [codes, setCodes] = useState(DEFAULT_CODES)
  const [fileNos, setFileNos] = useState({})
  const [showAdp, setShowAdp] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!orgId) return
    getSettings(orgId).then((s) => {
      const js = s?.settings || {}
      const pe = js.payroll_export || {}
      setSettingsJson(js)
      setCoCode(pe.adp_co_code || '')
      setCodes({ ...DEFAULT_CODES, ...(pe.adp_codes || {}) })
      setFileNos(pe.adp_file_numbers || {})
    })
  }, [orgId])

  const ready = rows.filter((r) => r.hasBase)
  const salaried = ready.filter((r) => r.g.chosenMethod === 'salary').map((r) => r.name)
  const skipped = rows.filter((r) => !r.hasBase).map((r) => r.name)

  async function saveAdp() {
    const next = { ...settingsJson, payroll_export: { adp_co_code: coCode.trim().toUpperCase(), adp_codes: codes, adp_file_numbers: fileNos } }
    const { error } = await upsertSettings(orgId, { settings: next })
    if (!error) setSettingsJson(next)
    setMsg(error ? error.message : 'ADP settings saved.')
    return !error
  }

  function exportGusto() {
    const head = ['First name', 'Last name', 'Regular hours', 'Overtime hours', 'Double overtime hours', 'Paid time off hours',
      'Bonus', 'Commission', 'Other earnings', 'Reimbursement', 'Hourly rate in Journey', 'Pay basis in Journey']
    const body = ready.map((r) => {
      const [first, last] = splitName(r.name)
      const sal = r.g.chosenMethod === 'salary'
      return [first, last, sal ? '' : num(r.g.regHours), sal ? '' : num(r.g.otHours), '', sal ? '' : num(r.g.ptoHours),
        num(r.g.bonusTotal), num(r.g.commissionTotal), num(otherEarnings(r.g)), '', r.g.rate || '', r.g.chosenMethod]
    })
    download(`gusto_hours_${weekStart}_to_${weekEnd}.csv`, toCsv([head, ...body]))
    setMsg(`Gusto file downloaded for ${body.length} employee${body.length === 1 ? '' : 's'}.`)
  }

  async function exportAdp() {
    const cc = coCode.trim().toUpperCase()
    if (!/^[A-Z0-9]{2,3}$/.test(cc)) { setShowAdp(true); setMsg('Enter your 3-character ADP company code first.'); return }
    const missing = ready.filter((r) => !String(fileNos[r.user_id] || '').trim()).map((r) => r.name)
    if (missing.length) { setShowAdp(true); setMsg(`Add an ADP File # for: ${missing.join(', ')}.`); return }
    if (!(await saveAdp())) return
    const d = new Date()
    const batch = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
    const head = ['Co Code', 'Batch ID', 'File #', 'Employee Name', 'Reg Hours', 'O/T Hours', 'Hours 3 Code', 'Hours 3 Amount',
      'Earnings 3 Code', 'Earnings 3 Amount', 'Earnings 4 Code', 'Earnings 4 Amount', 'Earnings 5 Code', 'Earnings 5 Amount']
    const body = ready.map((r) => {
      const sal = r.g.chosenMethod === 'salary'
      const oth = otherEarnings(r.g)
      return [cc, batch, String(fileNos[r.user_id]).trim(), r.name,
        sal ? '' : num(r.g.regHours), sal ? '' : num(r.g.otHours),
        !sal && r.g.ptoHours ? codes.pto : '', !sal && r.g.ptoHours ? num(r.g.ptoHours) : '',
        r.g.bonusTotal ? codes.bonus : '', num(r.g.bonusTotal),
        r.g.commissionTotal ? codes.commission : '', num(r.g.commissionTotal),
        oth ? codes.other : '', num(oth)]
    })
    // ADP Workforce Now only accepts the file named PR<co code>EPI.csv (2-character codes add an underscore).
    download(`PR${cc.length === 2 ? cc + '_' : cc}EPI.csv`, toCsv([head, ...body]))
    setMsg(`ADP file downloaded for ${body.length} employee${body.length === 1 ? '' : 's'} (batch ${batch}).`)
  }

  function exportFull() {
    const head = ['Employee', 'Week start', 'Week end', 'Pay basis', 'Hourly rate', 'Regular hours', 'Overtime hours', 'PTO hours',
      'Hourly pay', 'Performance / piece / salary pay', 'Overtime premium', 'PTO pay', 'Bonus', 'Commission', 'Gross pay']
    const body = ready.map((r) => [r.name, weekStart, weekEnd, r.g.chosenMethod, r.g.rate || '', num(r.g.regHours), num(r.g.otHours),
      num(r.g.ptoHours), num(r.g.hourlyBase), r.g.chosenMethod === 'hourly' ? '' : num(r.g.chosenBase), num(r.g.otPremium),
      num(r.g.ptoPay), num(r.g.bonusTotal), num(r.g.commissionTotal), round2(r.g.gross)])
    download(`payroll_earnings_${weekStart}_to_${weekEnd}.csv`, toCsv([head, ...body]))
    setMsg('Full earnings file downloaded.')
  }

  const totalGross = ready.reduce((s, r) => s + r.g.gross, 0)
  const box = { border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', marginTop: 22, background: '#fff' }

  return (
    <div style={box}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Send to your payroll provider</div>
          <div style={{ color: 'var(--mist)', fontSize: 13 }}>
            Hours and earnings for {ready.length} employee{ready.length === 1 ? '' : 's'} · {money(totalGross)} gross. Your provider calculates the taxes.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={!ready.length} onClick={exportGusto}>⬇ Gusto file</button>
          <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={!ready.length} onClick={exportAdp}>⬇ ADP file</button>
          <button className="logout-button" disabled={!ready.length} onClick={exportFull}>⬇ Full earnings (.csv)</button>
          <button className="logout-button" onClick={() => setShowAdp(!showAdp)}>{showAdp ? 'Hide ADP setup' : 'ADP setup'}</button>
        </div>
      </div>

      {msg && <div style={{ marginTop: 10, fontSize: 13, color: /downloaded|saved/.test(msg) ? '#166534' : '#B00020' }}>{msg}</div>}

      {(salaried.length > 0 || skipped.length > 0) && (
        <div style={{ marginTop: 10, fontSize: 13, background: '#FFF8E6', border: '1px solid #F0DFA8', borderRadius: 8, padding: '8px 12px' }}>
          {salaried.length > 0 && <div>Salaried — no hours sent, your provider pays their salary: <b>{salaried.join(', ')}</b>.</div>}
          {skipped.length > 0 && <div>Not in the files — no base pay entered this week: <b>{skipped.join(', ')}</b>.</div>}
        </div>
      )}

      {showAdp && (
        <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ fontSize: 13 }}>ADP company code<br />
              <input value={coCode} maxLength={3} onChange={(e) => setCoCode(e.target.value)} style={{ width: 80, textTransform: 'uppercase' }} />
            </label>
            {[['pto', 'Paid time off hours code'], ['bonus', 'Bonus earnings code'], ['commission', 'Commission earnings code'], ['other', 'Other earnings code']].map(([k, l]) => (
              <label key={k} style={{ fontSize: 13 }}>{l}<br />
                <input value={codes[k]} maxLength={3} onChange={(e) => setCodes({ ...codes, [k]: e.target.value.toUpperCase() })} style={{ width: 70 }} />
              </label>
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'var(--mist)', margin: '8px 0' }}>
            Use the codes from your own ADP account — ask your ADP representative if unsure.
          </p>
          <table className="data-table" style={{ maxWidth: 520 }}>
            <thead><tr><th>Employee</th><th>ADP File #</th></tr></thead>
            <tbody>
              {ready.map((r) => (
                <tr key={r.user_id}>
                  <td>{r.name}</td>
                  <td><input value={fileNos[r.user_id] || ''} maxLength={9} onChange={(e) => setFileNos({ ...fileNos, [r.user_id]: e.target.value.replace(/\D/g, '') })} style={{ width: 110 }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="auth-button" style={{ width: 'auto', marginTop: 10 }} onClick={saveAdp}>Save ADP setup</button>
        </div>
      )}

      <details style={{ marginTop: 12, fontSize: 13 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>How to import</summary>
        <div style={{ marginTop: 6, lineHeight: 1.6 }}>
          <b>Gusto:</b> start the payroll in Gusto, choose to upload a spreadsheet, and pick the Gusto file. Gusto matches the columns; check that each name matched the right employee.<br />
          <b>ADP Workforce Now:</b> go to Process → Import Paydata and upload the ADP file without renaming it. Paydata import must be turned on in your ADP company options.<br />
          <b>Other:</b> the full earnings file has every pay figure for your accountant or any other provider.<br />
          Hourly pay is sent as hours, so your provider must have the same hourly rate as Journey. "Other earnings" carries performance or piece-rate pay above hourly, plus the overtime premium.
        </div>
      </details>
    </div>
  )
}
