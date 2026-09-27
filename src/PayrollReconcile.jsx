// Payroll Capture · AI hours reconciliation.
// Compares, per employee, the CAPTURED hours (entered for pay) against the ACTUAL
// time-clock hours and the JOBBED (task) hours — and flags where they don't line
// up before the numbers turn into pay. Read-only; it never changes a capture.
import { useState, useMemo } from 'react'
import AiAssist from './AiAssist'

const RECON_SYS = `You are reconciling an HVAC contractor's weekly payroll hours before pay is calculated. For each employee you are given the CAPTURED hours (what was entered for pay), the ACTUAL hours from the time clock, and the JOBBED (task) hours. Explain the discrepancies in plain English, most costly first: captured far below the clock (under-paying), captured far above the clock (over-paying), clocked hours with nothing captured, or jobbed hours that exceed clocked time (a data or reporting problem). Be specific with names and the hour figures. Use ONLY the numbers given. End with one line reminding the office to fix captures before running pay. Under 12 lines, no headers.`

const n = (v) => (v == null || isNaN(v) ? 0 : Number(v))

export default function PayrollReconcile({ employees, weeks, clockHours }) {
  const rows = useMemo(() => {
    const weekFor = (uid) => (weeks || []).find((w) => w.user_id === uid)
    return (employees || []).map((e) => {
      const w = weekFor(e.id)
      const captured = n(w?.hours_clocked_in)
      const actual = n(clockHours?.[e.id])
      const jobbed = n(w?.task_hours_recorded)
      const delta = +(captured - actual).toFixed(2)
      const flags = []
      if (actual > 0 && captured === 0) flags.push({ tone: 'red', text: `Clocked ${actual.toFixed(1)}h but nothing captured` })
      else if (Math.abs(delta) >= 0.5) flags.push({ tone: Math.abs(delta) >= 2 ? 'red' : 'amber', text: `Captured ${captured.toFixed(1)}h vs clock ${actual.toFixed(1)}h (${delta > 0 ? '+' : ''}${delta}h)` })
      if (jobbed > 0 && actual > 0 && jobbed > actual + 2) flags.push({ tone: 'amber', text: `Jobbed ${jobbed.toFixed(1)}h exceeds clocked ${actual.toFixed(1)}h` })
      return { id: e.id, name: e.full_name, captured, actual, jobbed, delta, flags }
    }).filter((r) => r.flags.length > 0)
      .sort((a, b) => (b.flags.filter((f) => f.tone === 'red').length) - (a.flags.filter((f) => f.tone === 'red').length) || Math.abs(b.delta) - Math.abs(a.delta))
  }, [employees, weeks, clockHours])

  if (!employees || employees.length === 0) return null

  return (
    <div style={{ border: `1px solid ${rows.some((r) => r.flags.some((f) => f.tone === 'red')) ? '#F1C7C7' : '#E2E8F0'}`, background: rows.length ? '#FEF9F6' : '#F4FBF6', borderRadius: 10, padding: 12, margin: '4px 0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <strong style={{ color: '#132A4C', fontSize: 13.5 }}>Hours reconciliation</strong>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: rows.length ? '#B0600A' : '#166534', marginLeft: 'auto' }}>
          {rows.length === 0 ? 'Captured hours match the time clock' : `${rows.length} employee${rows.length === 1 ? '' : 's'} to reconcile`}
        </span>
      </div>
      <p style={{ color: 'var(--mist)', fontSize: 12, margin: '6px 0 0' }}>Captured (for pay) vs actual time clock vs jobbed hours. Flags only — nothing is changed.</p>

      {rows.length > 0 && (
        <>
          <div style={{ margin: '10px 0' }}>
            <AiAssist inline title="Reconcile payroll hours" label="✦ Explain the gaps"
              system={RECON_SYS}
              prompt="Reconcile these employees' captured vs clocked vs jobbed hours and what to fix before pay."
              context={{ employees: rows.map((r) => ({ name: r.name, captured: r.captured, clocked: r.actual, jobbed: r.jobbed, delta: r.delta })) }} />
          </div>
          <table className="data-table" style={{ fontSize: 12.5 }}>
            <thead><tr><th>Employee</th><th style={{ textAlign: 'right' }}>Captured</th><th style={{ textAlign: 'right' }}>Clocked</th><th style={{ textAlign: 'right' }}>Jobbed</th><th>Flags</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600, color: '#152238' }}>{r.name}</td>
                  <td style={{ textAlign: 'right' }}>{r.captured.toFixed(1)}</td>
                  <td style={{ textAlign: 'right' }}>{r.actual.toFixed(1)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--mist)' }}>{r.jobbed ? r.jobbed.toFixed(1) : '—'}</td>
                  <td>{r.flags.map((f, i) => <span key={i} className="badge" style={{ background: f.tone === 'red' ? '#FBE7E7' : '#F8EEDD', color: f.tone === 'red' ? '#B00020' : '#B0600A', marginRight: 4, marginBottom: 3, display: 'inline-block' }}>{f.text}</span>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
