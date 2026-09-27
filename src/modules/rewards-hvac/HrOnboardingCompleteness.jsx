// Rewards-HVAC · Onboarding & PII completeness rollup
// A team-wide view of which employees are missing required onboarding / tax
// fields, so the office can close gaps before payroll or an audit. It reads only
// whether each field is PRESENT — never the value — so no SSN, bank number, or
// date of birth is ever shown or sent anywhere. Pure local computation, no AI.
// Collapsed by default: it does nothing (and fetches nothing) until opened.
import { useState } from 'react'
import { listEmployees, getEmployeeHr, listOnboarding } from './hrData'

// Required fields differ by worker type. Each entry: key, label, and a test that
// returns true when the field is SATISFIED (present / done).
function requirementsFor(workerType) {
  const isContractor = workerType === '1099'
  const base = [
    { key: 'worker_type', label: 'Worker type', ok: (hr) => !!hr.worker_type },
    { key: 'ssn', label: 'SSN/TIN on file', ok: (hr) => !!hr.ssn_enc },
    { key: 'dob', label: 'Date of birth', ok: (hr) => !!hr.dob },
    { key: 'work_state', label: 'Work state', ok: (hr) => !!hr.work_state },
  ]
  if (isContractor) {
    return base.concat([
      { key: 'address', label: 'Address (1099)', ok: (hr) => !!hr.home_address },
    ])
  }
  return base.concat([
    { key: 'filing_status', label: 'Filing status (W-4)', ok: (hr) => !!hr.filing_status },
    { key: 'i9', label: 'I-9 verified', ok: (hr) => hr.i9_status === 'verified' },
    { key: 'direct_deposit', label: 'Direct deposit', ok: (hr) => !!(hr.bank_enc && hr.bank_enc.account_last4) },
  ])
}

export default function HrOnboardingCompleteness({ orgId }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')

  async function load() {
    if (!orgId) return
    setLoading(true); setErr('')
    try {
      const emps = await listEmployees(orgId, { includeInactive: false })
      const out = await Promise.all(emps.map(async (e) => {
        const [hr, tasks] = await Promise.all([
          getEmployeeHr(orgId, e.id).then((d) => d || {}),
          listOnboarding(orgId, e.id),
        ])
        const reqs = requirementsFor(hr.worker_type)
        const missing = reqs.filter((r) => !r.ok(hr)).map((r) => r.label)
        const openTasks = (tasks || []).filter((t) => t.status !== 'complete')
        const i9Reverify = hr.i9_reverify_due && hr.i9_reverify_due < new Date().toISOString().slice(0, 10)
        const totalChecks = reqs.length
        const pct = Math.round(((totalChecks - missing.length) / totalChecks) * 100)
        return { id: e.id, name: e.full_name, role: e.role, worker_type: hr.worker_type || 'w2', missing, openTasks: openTasks.length, i9Reverify, pct }
      }))
      // Worst first: most missing fields, then most open tasks.
      out.sort((a, b) => (b.missing.length + (b.i9Reverify ? 1 : 0)) - (a.missing.length + (a.i9Reverify ? 1 : 0)) || b.openTasks - a.openTasks)
      setRows(out)
    } catch (e) {
      setErr(e?.message || 'Could not load completeness.')
    }
    setLoading(false)
  }

  function toggle() { const n = !open; setOpen(n); if (n && rows == null) load() }

  const needsAttention = rows ? rows.filter((r) => r.missing.length > 0 || r.openTasks > 0 || r.i9Reverify).length : 0

  return (
    <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: 12, margin: '4px 0 18px', background: '#FBFCFE' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={toggle}
          style={{ border: '1px solid #1B3A6B', background: '#fff', color: '#1B3A6B', fontWeight: 600, fontSize: 13, borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
          {open ? 'Hide onboarding check' : '📋 Onboarding & PII completeness'}
        </button>
        {open && rows != null && (
          <span style={{ fontSize: 12.5, color: needsAttention ? '#B0600A' : '#166534', marginLeft: 'auto', fontWeight: 600 }}>
            {needsAttention === 0 ? 'All complete' : `${needsAttention} employee${needsAttention === 1 ? '' : 's'} with gaps`}
          </span>
        )}
      </div>

      {open && (
        <div style={{ marginTop: 10 }}>
          <p style={{ color: 'var(--mist)', fontSize: 12.5, margin: '0 0 10px' }}>
            Shows only whether each required field is <em>on file</em> — never the value. Nothing here is sent anywhere.
          </p>
          {err && <div className="auth-error" style={{ marginBottom: 10 }}>{err}</div>}
          {loading ? (
            <p style={{ color: 'var(--mist)', fontSize: 13 }}>Checking…</p>
          ) : rows && rows.length === 0 ? (
            <p style={{ color: 'var(--mist)', fontSize: 13 }}>No active employees to check.</p>
          ) : rows && (
            <table className="data-table" style={{ fontSize: 12.5 }}>
              <thead><tr><th>Employee</th><th>Type</th><th>Missing</th><th>Onboarding</th><th style={{ textAlign: 'right' }}>Complete</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={r.missing.length || r.i9Reverify ? { background: '#FCF3E9' } : undefined}>
                    <td style={{ fontWeight: 600, color: '#152238' }}>{r.name}{r.role ? <span style={{ color: 'var(--mist)', fontWeight: 400 }}> · {r.role}</span> : null}</td>
                    <td style={{ textTransform: 'uppercase', color: 'var(--mist)' }}>{r.worker_type}</td>
                    <td>
                      {r.missing.length === 0 ? <span style={{ color: '#166534' }}>—</span> : r.missing.map((m, i) => (
                        <span key={i} className="badge" style={{ background: '#FBE7E7', color: '#B00020', marginRight: 4, marginBottom: 3, display: 'inline-block' }}>{m}</span>
                      ))}
                      {r.i9Reverify && <span className="badge" style={{ background: '#B00020', color: '#fff', marginRight: 4 }}>I-9 reverify overdue</span>}
                    </td>
                    <td>{r.openTasks === 0 ? <span style={{ color: '#166534' }}>Done</span> : <span style={{ color: '#B0600A' }}>{r.openTasks} open task{r.openTasks === 1 ? '' : 's'}</span>}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: r.pct === 100 ? '#166534' : r.pct >= 60 ? '#B0600A' : '#B00020' }}>{r.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
