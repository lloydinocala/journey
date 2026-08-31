// Rewards-HVAC · Skills / training matrix — who-can-do-what across the crew.
// Distinct from Certifications (which tracks licensed/expiring credentials);
// this is a proficiency grid to help with job assignment and development.
import { useState, useEffect } from 'react'
import { listEmployees, listSkills, addSkill, updateSkill, listEmployeeSkills, setEmployeeSkill, SKILL_LEVELS } from './hrData'
import { useOrgSelector, OrgBar } from './shared'

const LEVEL_COLOR = ['#F1F5F9', '#FEF3C7', '#DBEAFE', '#DCFCE7']
const LEVEL_TEXT = ['#94A3B8', '#B0600A', '#1D4ED8', '#166534']
const blank = { name: '', category: '' }

export default function HrSkills({ profile }) {
  const org = useOrgSelector(profile)
  const [employees, setEmployees] = useState([])
  const [skills, setSkills] = useState([])
  const [levels, setLevels] = useState({})   // 'empId:skillId' -> level
  const [form, setForm] = useState(blank)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!org.selectedOrg) return
    const [emps, sk, lv] = await Promise.all([
      listEmployees(org.selectedOrg), listSkills(org.selectedOrg), listEmployeeSkills(org.selectedOrg),
    ])
    setEmployees(emps); setSkills(sk); setLevels(lv)
  }
  useEffect(() => { load() }, [org.selectedOrg]) // eslint-disable-line react-hooks/exhaustive-deps

  async function addNew(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    await addSkill(org.selectedOrg, { name: form.name.trim(), category: form.category || null, sort: skills.length })
    setSaving(false); setForm(blank); setShowForm(false); load()
  }

  async function setCell(empId, skillId, level) {
    setLevels((m) => ({ ...m, [empId + ':' + skillId]: level }))   // optimistic
    await setEmployeeSkill(org.selectedOrg, empId, skillId, level)
  }

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><h2>Skills Matrix</h2><span className="badge">{skills.length} skills</span></div>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ New Skill'}</button>
      </div>
      <OrgBar {...org} />

      {showForm && (
        <form className="inline-form" onSubmit={addNew} style={{ marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
          <div className="field"><label>Skill</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ductless install" required /></div>
          <div className="field"><label>Category (optional)</label><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Install" /></div>
          <button className="auth-button" type="submit" style={{ width: 'auto' }} disabled={saving}>Add</button>
        </form>
      )}

      <div style={{ display: 'flex', gap: 14, marginBottom: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--mist)' }}>
        {SKILL_LEVELS.map((l, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: LEVEL_COLOR[i], border: '1px solid var(--border)' }} />{i === 0 ? 'None' : l}
          </span>
        ))}
      </div>

      {skills.length === 0 ? (
        <p style={{ color: 'var(--mist)' }}>No skills defined yet. Add the capabilities you want to track (e.g. Ductless install, Commercial RTU, Brazing, Startup &amp; commissioning).</p>
      ) : employees.length === 0 ? (
        <p style={{ color: 'var(--mist)' }}>No employees yet.</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
          <table className="data-table" style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, background: '#1B3A6B', zIndex: 1 }}>Employee</th>
                {skills.map((s) => (
                  <th key={s.id} style={{ whiteSpace: 'nowrap' }}>
                    {s.name}
                    <button className="logout-button" title="Archive skill" style={{ padding: '0 6px', marginLeft: 6, fontSize: 11 }}
                      onClick={() => { if (confirm(`Archive "${s.name}"?`)) updateSkill(s.id, { active: false }).then(load) }}>×</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id}>
                  <td style={{ position: 'sticky', left: 0, background: '#fff', fontWeight: 600, whiteSpace: 'nowrap' }}>{e.full_name}</td>
                  {skills.map((s) => {
                    const lvl = levels[e.id + ':' + s.id] || 0
                    return (
                      <td key={s.id} style={{ padding: 4 }}>
                        <select
                          value={lvl}
                          onChange={(ev) => setCell(e.id, s.id, Number(ev.target.value))}
                          style={{ background: LEVEL_COLOR[lvl], color: LEVEL_TEXT[lvl], fontWeight: 600, border: '1px solid var(--border)', borderRadius: 6, padding: '4px 6px', fontSize: 12.5 }}
                        >
                          {SKILL_LEVELS.map((l, i) => <option key={i} value={i}>{i === 0 ? '—' : l}</option>)}
                        </select>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ color: 'var(--mist)', fontSize: 11.5, marginTop: 10 }}>Changes save as you set them. Use this to spot coverage gaps and plan cross-training.</p>
    </div>
  )
}
