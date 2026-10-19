// Rewards-HVAC · Hiring — lightweight applicant pipeline (kanban-ish by stage)
import { useState, useEffect } from 'react'
import { listApplicants, addApplicant, updateApplicant, hireApplicant, listJobDescriptions, HIRING_STAGES } from './hrData'
import { useOrgSelector, OrgBar } from './shared'
import AiAssist from '../../AiAssist'
import { supabase } from '../../utils/supabase'
import { ApplicantDetail, HiringQuestions } from './HiringPanels'
import { printHiringForm, loadQuestions } from './hiringForms'
import { orgName as getOrgName } from './hrRecords'

const STAGE_LABEL = { applied: 'Applied', screen: 'Screening', interview: 'Interview', offer: 'Offer', hired: 'Hired', rejected: 'Rejected' }
const blank = { name: '', email: '', phone: '', source: 'indeed', job_description_id: '' }

// Generates a structured interview kit from the ROLE — never ranks or judges the
// person. Hard guardrails against protected-class bias, and the hiring manager
// always makes the call. This is prep, not a decision.
const INTERVIEW_SYS = `You are a hiring assistant for an HVAC contractor helping a manager PREPARE to interview a candidate for a specific role. Produce: (1) 6-8 structured interview questions tailored to the role — a mix of technical HVAC, safety, real-world troubleshooting, customer-service, and behavioral; and (2) a short list of job-related areas to assess. STRICT RULES: base everything ONLY on the job requirements and general HVAC field-service knowledge. NEVER write questions that ask about or infer protected characteristics — age, race, color, religion, sex, national origin, disability, medical/health, pregnancy or family status, marital status, or similar — and avoid anything that isn't job-related. Do NOT score, rank, or recommend hiring/rejecting the candidate; the hiring manager makes that decision. End with one line: "Prep only — evaluate answers against the job requirements; the hiring decision is yours."`

export default function HrHiring({ profile }) {
  const org = useOrgSelector(profile)
  const [apps, setApps] = useState([])
  const [jds, setJds] = useState([])
  const [form, setForm] = useState(blank)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [token, setToken] = useState(null)
  const [publicOn, setPublicOn] = useState(true)
  const [openId, setOpenId] = useState(() => new URLSearchParams(window.location.search).get('applicant'))
  const [showQuestions, setShowQuestions] = useState(false)

  async function load() {
    if (!org.selectedOrg) return
    const [a, j, o] = await Promise.all([listApplicants(org.selectedOrg), listJobDescriptions(org.selectedOrg),
      supabase.from('organizations').select('hiring_token, hiring_public_enabled').eq('id', org.selectedOrg).maybeSingle()])
    setApps(a); setJds(j); setToken(o.data?.hiring_token || null); setPublicOn(o.data?.hiring_public_enabled !== false)
  }
  useEffect(() => { load() }, [org.selectedOrg])
  const link = token ? `${window.location.origin}/apply/${token}` : ''
  async function copyLink() {
    try { await navigator.clipboard.writeText(link); setMsg('Application link copied — post it on your website, Indeed, Facebook, or text it to a candidate.') } catch (e) { setMsg(link) }
  }
  async function togglePublic(v) {
    await supabase.from('organizations').update({ hiring_public_enabled: v }).eq('id', org.selectedOrg); setPublicOn(v)
  }
  async function printBlank(type) {
    printHiringForm({ orgName: await getOrgName(org.selectedOrg), formType: type, applicant: null, positionTitle: '', answers: null, questions: await loadQuestions(org.selectedOrg, type, null) })
  }
  const opened = apps.find((a) => a.id === openId)

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
  const jdFor = (id) => jds.find((j) => j.id === id) || null

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><h2>Hiring</h2><span className="badge">{apps.filter((a) => a.stage !== 'rejected' && a.stage !== 'hired').length} in pipeline</span></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="logout-button" onClick={() => setShowQuestions(!showQuestions)}>{showQuestions ? 'Done with questions' : 'Manage questions'}</button>
          <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ New Applicant'}</button>
        </div>
      </div>
      <OrgBar {...org} />

      <div className="section-card" style={{ padding: 12, marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <b style={{ fontSize: 13.5 }}>Online application</b>
        <label style={{ fontSize: 13, cursor: 'pointer' }}><input type="checkbox" checked={publicOn} onChange={(e) => togglePublic(e.target.checked)} /> Accepting applications</label>
        {publicOn && token && <>
          <code style={{ fontSize: 12, background: '#F1F5F9', padding: '3px 7px', borderRadius: 6, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link}</code>
          <button className="logout-button" onClick={copyLink}>🔗 Copy link</button>
          <a className="logout-button" href={link} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>Preview</a>
        </>}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, color: 'var(--mist)', alignSelf: 'center' }}>Print blank:</span>
          <button className="logout-button" onClick={() => printBlank('application')}>Application</button>
          <button className="logout-button" onClick={() => printBlank('screening')}>Screening</button>
          <button className="logout-button" onClick={() => printBlank('interview')}>Interview</button>
        </span>
      </div>
      {showQuestions && <div className="section-card" style={{ padding: 14, marginBottom: 14 }}><h3 style={{ marginTop: 0 }}>Hiring questions</h3><HiringQuestions orgId={org.selectedOrg} jds={jds} /></div>}
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
                    <button onClick={() => setOpenId(a.id)} style={{ background: 'none', border: 'none', padding: 0, fontWeight: 700, color: '#1F3A5F', cursor: 'pointer', textAlign: 'left' }}>{a.name}</button>
                    {a.source === 'website' && <span style={{ fontSize: 10.5, fontWeight: 800, color: '#166534', background: '#DCFCE7', borderRadius: 999, padding: '1px 6px', marginLeft: 6 }}>Online</span>}
                    <div style={{ fontSize: 12, color: 'var(--mist)' }}>{jdTitle(a.job_description_id) || a.source || ''}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      {next && next !== 'rejected' && (
                        <button className="logout-button" onClick={() => advance(a, next)}>→ {STAGE_LABEL[next]}</button>
                      )}
                      {a.stage !== 'hired' && <button className="logout-button" onClick={() => advance(a, 'rejected')}>Reject</button>}
                      {(() => { const jd = jdFor(a.job_description_id); return (
                        <AiAssist compact title={`Interview kit${jd?.title ? ` — ${jd.title}` : ''}`} label="✦ Interview kit"
                          system={INTERVIEW_SYS}
                          prompt="Prepare role-tailored interview questions and job-related areas to assess."
                          context={{ position: jd?.title || 'HVAC field-service role', requirements: jd?.requirements || null, role_summary: jd?.summary || null, key_duties: jd?.duties || null }} />
                      ) })()}
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
          <summary style={{ cursor: 'pointer', color: 'var(--mist)' }}>Rejected ({apps.filter((a) => a.stage === 'rejected').length}) — kept 1 year after the decision, then deleted automatically</summary>
          <table className="data-table" style={{ marginTop: 8 }}><thead><tr><th>Applicant</th><th>Position</th><th>Rejected</th><th>Auto-delete</th><th></th></tr></thead><tbody>
            {apps.filter((a) => a.stage === 'rejected').map((a) => (
              <tr key={a.id}><td>{a.name}</td><td>{jdTitle(a.job_description_id) || '—'}</td><td>{a.rejected_at ? new Date(a.rejected_at).toLocaleDateString() : '—'}</td>
                <td>{a.legal_hold ? <b>Legal hold</b> : a.rejected_at ? new Date(new Date(a.rejected_at).getTime() + 365 * 86400000).toLocaleDateString() : '—'}</td>
                <td style={{ textAlign: 'right' }}><button className="logout-button" onClick={() => setOpenId(a.id)}>Open</button> <button className="logout-button" onClick={() => advance(a, 'applied')}>Reconsider</button></td></tr>
            ))}
          </tbody></table>
        </details>
      )}

      {opened && <ApplicantDetail applicant={opened} positionTitle={jdTitle(opened.job_description_id)} orgId={org.selectedOrg} profile={profile} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  )
}
