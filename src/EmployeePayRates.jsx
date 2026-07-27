import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'

// Per-employee hourly pay rates (standard + task), stored on the user record.
// Used to convert captured task time into compensation on the Tasks page.
export default function EmployeePayRates({ orgId }) {
  const [users, setUsers] = useState([])
  const [draft, setDraft] = useState({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [savedId, setSavedId] = useState(null)

  async function load() {
    if (!orgId) { setUsers([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('users')
      .select('id, full_name, role, standard_hourly_rate, task_hourly_rate')
      .eq('org_id', orgId).eq('is_active', true).order('full_name')
    setUsers(data || [])
    const d = {}
    for (const u of data || []) d[u.id] = { standard: u.standard_hourly_rate ?? '', task: u.task_hourly_rate ?? '' }
    setDraft(d)
    setLoading(false)
  }
  useEffect(() => { load() }, [orgId])

  async function saveRow(u) {
    setSavingId(u.id)
    const row = draft[u.id] || {}
    const patch = {
      standard_hourly_rate: row.standard === '' ? null : Number(row.standard),
      task_hourly_rate: row.task === '' ? null : Number(row.task),
    }
    await supabase.from('users').update(patch).eq('id', u.id)
    setSavingId(null)
    setSavedId(u.id)
    setTimeout(() => setSavedId((s) => (s === u.id ? null : s)), 1800)
  }

  function set(uid, key, val) { setDraft((d) => ({ ...d, [uid]: { ...d[uid], [key]: val } })) }

  return (
    <div style={{ marginBottom: 40 }}>
      <h3 style={{ fontSize: 16, marginBottom: 6 }}>Employee Pay Rates</h3>
      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0, marginBottom: 12 }}>
        Set each person's hourly pay. The <strong>task rate</strong> is applied to time they work on field tasks
        (Start My Time → Stop My Time); the <strong>standard rate</strong> is their normal hourly wage.
      </p>
      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : users.length === 0 ? (
        <p style={{ color: 'var(--mist)' }}>No active team members to set rates for.</p>
      ) : (
        <table className="data-table" style={{ maxWidth: 640 }}>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Standard $/hr</th>
              <th>Task $/hr</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.full_name} <span style={{ color: 'var(--mist)', fontSize: 12 }}>({u.role})</span></td>
                <td>
                  <input type="number" step="0.01" min="0" placeholder="—" value={draft[u.id]?.standard ?? ''}
                    onChange={(e) => set(u.id, 'standard', e.target.value)} style={{ width: 90 }} />
                </td>
                <td>
                  <input type="number" step="0.01" min="0" placeholder="—" value={draft[u.id]?.task ?? ''}
                    onChange={(e) => set(u.id, 'task', e.target.value)} style={{ width: 90 }} />
                </td>
                <td>
                  <button className="auth-button" style={{ width: 'auto', padding: '4px 10px', margin: 0 }} disabled={savingId === u.id} onClick={() => saveRow(u)}>
                    {savingId === u.id ? 'Saving…' : savedId === u.id ? 'Saved ✓' : 'Save'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
