// Rewards-HVAC · Onboarding — per-employee checklist (I-9, W-4, new-hire report, …)
import { useState, useEffect } from 'react'
import { listEmployees, listOnboarding, seedOnboarding, updateOnboardingTask } from './hrData'
import { useOrgSelector, OrgBar } from './shared'

export default function HrOnboarding({ profile }) {
  const org = useOrgSelector(profile)
  const [employees, setEmployees] = useState([])
  const [empId, setEmpId] = useState('')
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!org.selectedOrg) return
    listEmployees(org.selectedOrg).then((e) => { setEmployees(e); if (!empId && e[0]) setEmpId(e[0].id) })
  }, [org.selectedOrg])

  async function loadTasks(id) {
    if (!id) return
    setLoading(true)
    let t = await listOnboarding(org.selectedOrg, id)
    if (t.length === 0) t = await seedOnboarding(org.selectedOrg, id)
    setTasks(t); setLoading(false)
  }
  useEffect(() => { loadTasks(empId) }, [empId])

  async function toggle(task) {
    const status = task.status === 'complete' ? 'pending' : 'complete'
    await updateOnboardingTask(task.id, { status, signed_at: status === 'complete' ? new Date().toISOString() : null })
    loadTasks(empId)
  }

  const done = tasks.filter((t) => t.status === 'complete').length

  return (
    <div>
      <div className="page-header-bar"><h2>Onboarding</h2></div>
      <OrgBar {...org} />

      <div className="field" style={{ maxWidth: 340, marginBottom: 18 }}>
        <label>Employee</label>
        <select value={empId} onChange={(e) => setEmpId(e.target.value)}>
          <option value="">— select —</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
        </select>
      </div>

      {empId && (
        <>
          <div style={{ marginBottom: 12, color: 'var(--mist)' }}>{done} of {tasks.length} complete</div>
          {loading ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : (
            <table className="data-table">
              <thead><tr><th></th><th>Task</th><th>Status</th><th>Completed</th></tr></thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id}>
                    <td><input type="checkbox" checked={t.status === 'complete'} onChange={() => toggle(t)} /></td>
                    <td>{t.label || t.task}</td>
                    <td style={{ textTransform: 'capitalize', color: t.status === 'complete' ? '#166534' : 'var(--mist)' }}>{t.status}</td>
                    <td>{t.signed_at ? new Date(t.signed_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p style={{ color: 'var(--mist)', fontSize: 12, marginTop: 10 }}>
            Digital e-signature capture and document upload for each task attach in a later pass (reusing the app's
            signature pad). The <strong>state new-hire report</strong> must be filed within 20 days of hire — keep it checked off promptly.
          </p>
        </>
      )}
    </div>
  )
}
