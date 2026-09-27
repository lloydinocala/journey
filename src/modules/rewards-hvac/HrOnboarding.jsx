// Rewards-HVAC · Onboarding — per-employee checklist (I-9, W-4, new-hire report, …)
import { useState, useEffect } from 'react'
import { listEmployees, listOnboarding, seedOnboarding, updateOnboardingTask } from './hrData'
import { useOrgSelector, OrgBar } from './shared'
import AiAssist from '../../AiAssist'

// Drafts a role-tailored onboarding plan that goes BEYOND the fixed compliance
// checklist (I-9/W-4/etc.) — the trade-specific ramp for this role. Advisory only:
// the office reads/copies it; it never changes the checklist automatically.
const ONBOARDING_SYS = `You are an onboarding coordinator for an HVAC contractor. Given a new hire's role, draft a practical, role-tailored onboarding plan for their first 90 days. Assume the standard compliance items (I-9, W-4, direct deposit, handbook, state new-hire report) are already tracked separately — do NOT repeat them; focus on the trade-specific ramp: tool/equipment issue, truck/vehicle assignment, required certifications (e.g. EPA 608 for anyone handling refrigerant), safety and PPE, systems/app logins, ride-alongs or shadowing, and early competency checkpoints. Organize as First week / 30 days / 60 days / 90 days with short bullet lines. Be specific to the role given; if the role is unclear, give a sensible field-service default. Keep it concise.`

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
  const selectedEmp = employees.find((e) => e.id === empId)

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
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--mist)' }}>{done} of {tasks.length} complete</span>
            <AiAssist inline title={`Onboarding plan${selectedEmp?.role ? ` — ${selectedEmp.role}` : ''}`} label="✦ Draft role onboarding plan"
              system={ONBOARDING_SYS}
              prompt="Draft the role-tailored 90-day onboarding plan for this new hire."
              context={{ role: selectedEmp?.role || 'HVAC field service (unspecified)', compliance_items_already_tracked: ['I-9', 'W-4', 'Direct deposit', 'Handbook', 'State new-hire report'] }} />
            <span style={{ fontSize: 12, color: 'var(--mist)' }}>Trade-specific ramp beyond the compliance checklist — copy into your plan.</span>
          </div>
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
