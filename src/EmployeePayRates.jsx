import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'

// Employee pay rates — ONE rate per person, kept on the HR employee record (the same field
// as HR → Employees). It pays clocked hours, task hours and errand hours alike, per the
// company's pay method above. Editing here or in HR changes the same number.
export default function EmployeePayRates({ orgId }) {
  const [rows, setRows] = useState([])
  const [draft, setDraft] = useState({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [savedId, setSavedId] = useState(null)
  const [err, setErr] = useState('')

  async function load() {
    if (!orgId) { setRows([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase.from('employees')
      .select('id, full_name, role, pay_type, hourly_rate, annual_salary')
      .eq('org_id', orgId).eq('is_active', true).order('full_name')
    setRows(data || [])
    const d = {}
    for (const e of data || []) d[e.id] = e.hourly_rate ?? ''
    setDraft(d)
    setLoading(false)
  }
  useEffect(() => { load() }, [orgId])

  async function saveRow(e) {
    setSavingId(e.id); setErr('')
    const v = draft[e.id]
    const { error } = await supabase.from('employees').update({ hourly_rate: v === '' ? null : Number(v), updated_at: new Date().toISOString() }).eq('id', e.id)
    setSavingId(null)
    if (error) { setErr(error.message); return }
    setSavedId(e.id)
    setTimeout(() => setSavedId((s) => (s === e.id ? null : s)), 1800)
  }

  return (
    <div style={{ marginBottom: 40 }}>
      <h3 style={{ fontSize: 16, marginBottom: 6 }}>Employee Pay Rates</h3>
      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0, marginBottom: 12, maxWidth: 680 }}>
        One hourly rate per person. It pays clocked hours, task hours and errand hours alike, following the pay method above.
        This is the same rate shown on each person's record in <Link to="/rewards/employees">HR → Employees</Link> — change it in either place.
      </p>
      {err && <div className="auth-error" style={{ marginBottom: 8 }}>{err}</div>}
      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: 'var(--mist)' }}>No active employees yet — add them in <Link to="/rewards/employees">HR → Employees</Link>.</p>
      ) : (
        <div className="frozen-scroll" style={{ maxWidth: 640 }}>
        <table className="data-table" style={{ width: '100%', marginBottom: 0 }}>
          <thead><tr><th>Employee</th><th>Pay</th><th>Hourly rate</th><th></th></tr></thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td>{e.full_name}{e.role ? <span style={{ color: 'var(--mist)', fontSize: 12 }}> ({e.role})</span> : null}</td>
                <td style={{ fontSize: 13 }}>{e.pay_type === 'salary' ? `Salary${e.annual_salary ? ` $${Number(e.annual_salary).toLocaleString()}/yr` : ''}` : 'Hourly'}</td>
                <td>
                  <input type="number" step="0.01" min="0" placeholder="—" value={draft[e.id] ?? ''}
                    onChange={(ev) => setDraft((d) => ({ ...d, [e.id]: ev.target.value }))} style={{ width: 90 }} />
                </td>
                <td>
                  <button className="auth-button" style={{ width: 'auto', padding: '4px 10px', margin: 0 }} disabled={savingId === e.id} onClick={() => saveRow(e)}>
                    {savingId === e.id ? 'Saving…' : savedId === e.id ? 'Saved ✓' : 'Save'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  )
}
