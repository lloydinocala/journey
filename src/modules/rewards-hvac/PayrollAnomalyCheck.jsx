// Rewards-HVAC · Payroll pre-run anomaly check + paycheck explainer.
// Reads the computed calc rows BEFORE anything is saved or paid, flags likely
// errors deterministically (missed OT, no tax withheld, out-of-band pay, etc.),
// and offers a plain-English AI review of the run plus a "why is my check this
// amount" explainer per employee. It never moves money and never changes a calc —
// it's a review layer. Only names + payroll numbers are sent to the AI (no SSNs).
import { useState, useMemo } from 'react'
import AiAssist from '../../AiAssist'

const money = (n) => (n == null || isNaN(n) ? '—' : `$${Number(n).toFixed(2)}`)
const median = (arr) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }

const REVIEW_SYS = `You are a payroll reviewer for an HVAC contractor doing a final check BEFORE a payroll run is saved and paid. You are given the run summary and a list of flagged paychecks (each with the employee, the flag, and the relevant numbers). Explain in plain English what each flag means and what to verify, MOST important first — anything that would over- or under-pay someone, withhold the wrong tax, or skip overtime is top priority. Be specific with the names and numbers given. Use ONLY the data provided; do not invent employees, numbers, or issues. End with one short line noting this is a pre-run check and the office should fix issues before running payroll. Under 14 lines, no headers.`

const EXPLAIN_SYS = `You explain a single paycheck in plain, friendly English for an HVAC company, so anyone can see exactly how the amount was reached. You are given the pay components (hours, rates, overtime, bonuses, commissions), the taxes withheld, the deductions, and the net pay. Walk through it simply: what was earned (gross and how), what was taken out (each tax and deduction) and why, and the take-home net. Be warm and clear, not technical. Use ONLY the numbers given; never invent a figure. Keep it concise.`

// Deterministic flags for one computed row. tone: 'red' (likely wrong) or 'amber' (check).
function flagsFor(r, medianGross) {
  const out = []
  const g = r.g || {}
  const gross = Number(g.gross || 0)
  const hours = Number(g.totalHours || 0)
  const ot = Number(g.otHours || 0)
  if (!r.hasBase) return out // no pay basis yet — nothing to check
  if (!r.hasProfile) out.push({ tone: 'amber', text: 'No W-4 on file — taxes estimated as Single', detail: 'filing_status missing' })
  if (hours > 40 && ot <= 0) out.push({ tone: 'red', text: `${hours} hours but no overtime premium`, detail: 'possible missed OT' })
  if (hours > 60) out.push({ tone: 'amber', text: `Unusually high hours (${hours})`, detail: 'verify the time capture' })
  if (gross > 0 && Number(r.empTaxAll || 0) <= 0) out.push({ tone: 'red', text: 'No taxes withheld on positive gross', detail: 'check tax profile / exemptions' })
  if (gross > 0 && Number(r.net || 0) <= 0) out.push({ tone: 'red', text: 'Net pay is zero or negative', detail: 'deductions/garnishments may exceed pay' })
  if (Number(r.net || 0) > gross) out.push({ tone: 'red', text: 'Net pay exceeds gross', detail: 'calculation error' })
  if (medianGross > 0 && gross > 2.5 * medianGross) out.push({ tone: 'amber', text: `Gross well above the team norm (${money(gross)} vs ~${money(medianGross)} median)`, detail: 'out-of-band pay — verify hours/bonuses' })
  return out
}

export default function PayrollAnomalyCheck({ rows }) {
  const [open, setOpen] = useState(false)
  const [explainId, setExplainId] = useState('')

  const withBase = useMemo(() => (rows || []).filter((r) => r.hasBase), [rows])
  const medianGross = useMemo(() => median(withBase.map((r) => Number(r.g?.gross || 0)).filter((n) => n > 0)), [withBase])

  const flagged = useMemo(() => (rows || [])
    .map((r) => ({ r, flags: flagsFor(r, medianGross) }))
    .filter((x) => x.flags.length > 0)
    .sort((a, b) => (b.flags.filter((f) => f.tone === 'red').length) - (a.flags.filter((f) => f.tone === 'red').length)),
    [rows, medianGross])

  const redCount = flagged.reduce((s, x) => s + x.flags.filter((f) => f.tone === 'red').length, 0)
  const explainRow = withBase.find((r) => r.user_id === explainId) || null

  const aiContext = {
    run: { employees_with_pay: withBase.length, median_gross: Math.round(medianGross) },
    flagged: flagged.map(({ r, flags }) => ({
      employee: r.name, hours: r.g?.totalHours, overtime_hours: r.g?.otHours, gross: Math.round(Number(r.g?.gross || 0)),
      taxes_withheld: Math.round(Number(r.empTaxAll || 0)), net: Math.round(Number(r.net || 0)),
      flags: flags.map((f) => f.text),
    })),
  }

  if (!rows || rows.length === 0) return null

  return (
    <div style={{ border: `1px solid ${redCount ? '#F1C7C7' : '#E2E8F0'}`, background: redCount ? '#FEF6F6' : '#FBFCFE', borderRadius: 10, padding: 12, margin: '4px 0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={() => setOpen(!open)}
          style={{ border: '1px solid #1B3A6B', background: '#fff', color: '#1B3A6B', fontWeight: 600, fontSize: 13, borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
          {open ? 'Hide payroll check' : '🛡 Pre-run payroll check'}
        </button>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: flagged.length ? (redCount ? '#B00020' : '#B0600A') : '#166534', marginLeft: 'auto' }}>
          {flagged.length === 0 ? 'No anomalies detected' : `${flagged.length} paycheck${flagged.length === 1 ? '' : 's'} flagged${redCount ? ` · ${redCount} needs attention` : ''}`}
        </span>
      </div>

      {open && (
        <div style={{ marginTop: 10 }}>
          <p style={{ color: 'var(--mist)', fontSize: 12.5, margin: '0 0 10px' }}>
            A safety check before you run payroll — it reviews the computed checks but never changes or pays them. Only names and payroll figures are used; no SSNs.
          </p>

          {flagged.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <AiAssist inline title="Review this payroll run" label="✦ Explain the flags"
                system={REVIEW_SYS}
                prompt="Review these flagged paychecks and tell me what to check before running payroll, most important first."
                context={aiContext} />
            </div>
          )}

          {flagged.length === 0 ? (
            <p style={{ color: '#166534', fontSize: 13 }}>Nothing looks off in this run. You can still explain any paycheck below.</p>
          ) : (
            <table className="data-table" style={{ fontSize: 12.5, marginBottom: 4 }}>
              <thead><tr><th>Employee</th><th style={{ textAlign: 'right' }}>Hours</th><th style={{ textAlign: 'right' }}>Gross</th><th style={{ textAlign: 'right' }}>Net</th><th>Flags</th></tr></thead>
              <tbody>
                {flagged.map(({ r, flags }) => (
                  <tr key={r.user_id}>
                    <td style={{ fontWeight: 600, color: '#152238' }}>{r.name}</td>
                    <td style={{ textAlign: 'right' }}>{r.g?.totalHours ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>{money(r.g?.gross)}</td>
                    <td style={{ textAlign: 'right' }}>{money(r.net)}</td>
                    <td>{flags.map((f, i) => (
                      <span key={i} className="badge" style={{ background: f.tone === 'red' ? '#FBE7E7' : '#F8EEDD', color: f.tone === 'red' ? '#B00020' : '#B0600A', marginRight: 4, marginBottom: 3, display: 'inline-block' }}>{f.text}</span>
                    ))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Paycheck explainer — "why is my check this amount" for any employee */}
          <div style={{ marginTop: 14, borderTop: '1px solid #EEF2F8', paddingTop: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#1B3A6B', marginRight: 8 }}>Explain a paycheck</label>
            <select value={explainId} onChange={(e) => setExplainId(e.target.value)} style={{ border: '1px solid #D5DAE1', borderRadius: 8, padding: '6px 8px', fontSize: 13 }}>
              <option value="">— pick an employee —</option>
              {withBase.map((r) => <option key={r.user_id} value={r.user_id}>{r.name}</option>)}
            </select>
            {explainRow && (
              <div style={{ marginTop: 10 }}>
                <AiAssist key={explainId} inline title={`Paycheck — ${explainRow.name}`} label="✦ Why is this check this amount?"
                  system={EXPLAIN_SYS}
                  prompt="Explain this paycheck in plain English, step by step."
                  context={{
                    employee: explainRow.name,
                    hours: { total: explainRow.g?.totalHours, regular: explainRow.g?.regHours, overtime: explainRow.g?.otHours, rate: explainRow.g?.rate },
                    earnings: { method: explainRow.g?.chosenMethod, base: explainRow.g?.chosenBase, overtime_premium: explainRow.g?.otPremium, bonuses: explainRow.g?.bonusTotal, commissions: explainRow.g?.commissionTotal, gross: explainRow.g?.gross },
                    taxes: { federal_income: explainRow.t?.fed_income_wh, social_security: explainRow.t?.ss_employee, medicare: explainRow.t?.medicare_employee, state_income: explainRow.stateWH?.amount, total_taxes: explainRow.empTaxAll },
                    deductions: { pretax: explainRow.d?.totalPretax, posttax: explainRow.d?.totalPosttax, lines: explainRow.d?.lines },
                    net_pay: explainRow.net,
                  }} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
