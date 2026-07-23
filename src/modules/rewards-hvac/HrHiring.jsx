// Rewards-HVAC · Hiring — lightweight applicant pipeline (kanban-ish by stage)
import { useState, useEffect } from 'react'
import { listApplicants, addApplicant, updateApplicant, hireApplicant, listJobDescriptions, HIRING_STAGES } from './hrData'
import { useOrgSelector, OrgBar } from './shared'

const STAGE_LABEL = { applied: 'Applied', screen: 'Screening', interview: 'Interview', offer: 'Offer', hired: 'Hired', rejected: 'Rejected' }
const blank = { name: '', email: '', phone: '', source: 'indeed', job_description_id: '' }

export default function HrHiring({ profile }) {
  const org = useOrgSelector(profile)
  const [apps, setApps] = useState([])
  const [jds, setJds] = useState([])
  const [form, setForm] = useState(blank)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function load() {
    if (!org.selectedOrg) return
    const [a, j] = await Promise.all([listApplicants(org.selectedOrg), listJobDescriptions(org.selectedOrg)])
    setApps(a); setJds(j)
  }
  useEffect(() => { load() }, [org.selectedOrg])

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    await addApplicant(org.selectedOrg, {
      name: form.name.trim(), email: form.email || null, phone: form.phone || null,
      source: form.source || null, job_description_id: form.job_description_id || null,
    })
    setSaving(false); setForm(blank); setShowForm(false); load()
  }

  async function advance(app, stage) {
    if (stage === 'hired') {
      const { error } = await hireApplicant(org.selectedOrg, app)
      setMsg(error ? error.message : `${app.name} hired — added to Employees with an onboarding checklist.`)
    } else {
      await updateApplicant(app.id, { stage })
    }
    load()
  }

  const jdTitle = (id) => (jds.find((j) => j.id === id) || {}).title || ''

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><h2>Hiring</h2><span className="badge">{apps.filter((a) => a.stage !== 'rejected' && a.stage !== 'hired').length} in pipeline</span></div>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ New Applicant'}</button>
      </div>
      <OrgBar {...org} />
      {msg && <div style={{ marginBottom: 14, color: '#166534' }}>{msg}</div>}

      {showForm && (
        <form className="inline-form" onSubmit={submit} style={{ marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div className="field"><label>Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div className="field"><label>Email</label><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="field"><label>Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="field"><label>Source</label>
            <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              <option value="indeed">Indeed</option><option value="referral">Referral</option><option value="walk-in">Walk-in</option><option value="website">Website</option><option value="other">Other</option></select></div>
          <div className="field" style={{ minWidth: 200 }}><label>Position</label>
            <select value={form.job_description_id} onChange={(e) => setForm({ ...form, job_description_id: e.target.value })}>
              <option value="">— any —</option>{jds.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}</select></div>
          <button className="auth-button" type="submit" style={{ width: 'auto' }} disabled={saving}>{saving ? 'Adding…' : 'Add'}</button>
        </form>
      )}

      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
        {HIRING_STAGES.filter((s) => s !== 'rejected').map((stage) => {
          const inStage = apps.filter((a) => a.stage === stage)
          return (
            <div key={stage} style={{ minWidth: 220, flex: '1 0 220px', background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span>{STAGE_LABEL[stage]}</span><span className="badge">{inStage.length}</span>
              </div>
              {inStage.map((a) => {
                const idx = HIRING_STAGES.indexOf(a.stage)
                const next = HIRING_STAGES[idx + 1]
                return (
                  <div key={a.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: 10, marginBottom: 8 }}>
                    <div style={{ fontWeight: 600 }}>{a.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--mist)' }}>{jdTitle(a.job_description_id) || a.source || ''}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      {next && next !== 'rejected' && (
                        <button className="logout-button" onClick={() => advance(a, next)}>→ {STAGE_LABEL[next]}</button>
                      )}
                      {a.stage !== 'hired' && <button className="logout-button" onClick={() => advance(a, 'rejected')}>Reject</button>}
                    </div>
                  </div>
                )
              })}
              {inStage.length === 0 && <div style={{ color: 'var(--mist)', fontSize: 12 }}>—</div>}
            </div>
          )
        })}
      </div>

      {apps.some((a) => a.stage === 'rejected') && (
        <details style={{ marginTop: 18 }}>
          <summary style={{ cursor: 'pointer', color: 'var(--mist)' }}>Rejected ({apps.filter((a) => a.stage === 'rejected').length})</summary>
          <ul>{apps.filter((a) => a.stage === 'rejected').map((a) => <li key={a.id}>{a.name}</li>)}</ul>
        </details>
      )}
    </div>
  )
}
