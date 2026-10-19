// Rewards-HVAC · Hiring panels: the applicant record (application, screening, interview,
// printing, legal hold) and the company's own hiring questions.
import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabase'
import { FORM_LABEL, loadQuestions, printHiringForm } from './hiringForms'
import { orgName as getOrgName } from './hrRecords'

const STAGE_LABEL = { applied: 'Applied', screen: 'Screening', interview: 'Interview', offer: 'Offer', hired: 'Hired', rejected: 'Rejected' }
const inp = { width: '100%', padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13.5, boxSizing: 'border-box', fontFamily: 'inherit' }
const yn = (v) => (v === 'yes' ? 'Yes' : v === 'no' ? 'No' : '—')

export function ApplicantDetail({ applicant, positionTitle, orgId, profile, onClose, onChanged }) {
  const [tab, setTab] = useState('application')
  const [forms, setForms] = useState({})
  const [questions, setQuestions] = useState({ application: [], screening: [], interview: [] })
  const [draft, setDraft] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [notes, setNotes] = useState(applicant.notes || '')

  async function load() {
    const [{ data }, qa, qs, qi] = await Promise.all([
      supabase.from('rewards_applicant_forms').select('*').eq('applicant_id', applicant.id),
      loadQuestions(orgId, 'application', applicant.job_description_id),
      loadQuestions(orgId, 'screening', applicant.job_description_id),
      loadQuestions(orgId, 'interview', applicant.job_description_id),
    ])
    const m = Object.fromEntries((data || []).map((f) => [f.form_type, f]))
    setForms(m); setQuestions({ application: qa, screening: qs, interview: qi })
  }
  useEffect(() => { load() }, [applicant.id])
  useEffect(() => {
    if (tab === 'screening' || tab === 'interview') setDraft(forms[tab]?.answers || { date: new Date().toISOString().slice(0, 10), by: profile?.full_name || '' })
    setMsg('')
  }, [tab, forms])

  async function saveForm() {
    setSaving(true); setMsg('')
    const { error } = await supabase.from('rewards_applicant_forms').upsert({ org_id: orgId, applicant_id: applicant.id, form_type: tab, answers: draft, filled_by: profile?.id || null, updated_at: new Date().toISOString() }, { onConflict: 'applicant_id,form_type' })
    setSaving(false); setMsg(error ? error.message : 'Saved.'); if (!error) load()
  }
  async function print(type, blank) {
    printHiringForm({ orgName: await getOrgName(orgId), formType: type, applicant, positionTitle, answers: blank ? null : (forms[type]?.answers || null), questions: questions[type] })
  }
  async function setHold(v) {
    await supabase.from('rewards_applicants').update({ legal_hold: v }).eq('id', applicant.id); onChanged()
  }
  async function saveNotes() {
    await supabase.from('rewards_applicants').update({ notes: notes || null, updated_at: new Date().toISOString() }).eq('id', applicant.id); setMsg('Notes saved.'); onChanged()
  }

  const app = forms.application?.answers
  const qList = questions[tab] || []
  const setAns = (id, patch) => setDraft((d) => ({ ...d, [id]: { ...(typeof d[id] === 'object' ? d[id] : {}), ...patch } }))

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 760, width: '96vw', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div>
            <h3 style={{ margin: 0 }}>{applicant.name}</h3>
            <div style={{ fontSize: 13, color: 'var(--mist)' }}>{positionTitle || 'General'} · {STAGE_LABEL[applicant.stage]} · applied {new Date(applicant.applied_at).toLocaleDateString()} · {applicant.source || ''}</div>
            <div style={{ fontSize: 13 }}>{[applicant.phone, applicant.email].filter(Boolean).join(' · ')}</div>
          </div>
          <button className="logout-button" onClick={onClose}>Close</button>
        </div>
        {applicant.stage === 'rejected' && (
          <div style={{ fontSize: 12.5, background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', margin: '10px 0' }}>
            Rejected {applicant.rejected_at ? new Date(applicant.rejected_at).toLocaleDateString() : ''}. {applicant.legal_hold
              ? <b>On legal hold — will not be deleted.</b>
              : <>Deleted automatically on {applicant.rejected_at ? new Date(new Date(applicant.rejected_at).getTime() + 365 * 86400000).toLocaleDateString() : 'its 1-year date'} (federal retention period).</>}
            {' '}<label style={{ cursor: 'pointer', marginLeft: 6 }}><input type="checkbox" checked={!!applicant.legal_hold} onChange={(e) => setHold(e.target.checked)} /> Legal hold (a claim or charge was filed)</label>
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, margin: '12px 0' }}>
          {['application', 'screening', 'interview'].map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '6px 12px', borderRadius: 999, border: '1px solid ' + (tab === t ? '#1F3A5F' : 'var(--border)'), background: tab === t ? '#1F3A5F' : '#fff', color: tab === t ? '#fff' : '#334155', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
              {FORM_LABEL[t]}{forms[t] ? ' ✓' : ''}
            </button>
          ))}
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button className="logout-button" onClick={() => print(tab, false)} disabled={!forms[tab] && tab !== 'application'}>🖨 Print filled</button>
            <button className="logout-button" onClick={() => print(tab, true)}>🖨 Print blank</button>
          </span>
        </div>

        {tab === 'application' && (!app ? (
          <p style={{ color: 'var(--mist)', fontSize: 13.5 }}>No online application on file. Print a blank application for them to fill out, then scan it into Documents, or send them your application link.</p>
        ) : (
          <div style={{ fontSize: 13.5, display: 'grid', gap: 6 }}>
            <div><b>Address:</b> {[app.address, app.city, app.zip].filter(Boolean).join(', ') || '—'}</div>
            <div><b>Start:</b> {app.start_date || '—'} · <b>Desired pay:</b> {app.desired_pay || '—'} · <b>Availability:</b> {app.availability || '—'}</div>
            <div><b>Authorized to work in U.S.:</b> {yn(app.work_authorized)} · <b>18+:</b> {yn(app.over_18)} · <b>Driver's license:</b> {yn(app.drivers_license)} · <b>HVAC experience:</b> {app.experience_years || '—'}</div>
            <div><b>Certifications:</b> {app.certifications || '—'}</div>
            {(app.employment || []).filter((e) => e.employer).map((e, i) => (
              <div key={i} style={{ borderLeft: '3px solid #CBD5E1', paddingLeft: 8 }}><b>{e.employer}</b> — {e.title || ''} ({e.from || '?'} – {e.to || 'present'}){e.duties ? <div>{e.duties}</div> : null}{e.reason ? <div style={{ color: 'var(--mist)' }}>Left: {e.reason} · may contact: {yn(e.may_contact)}</div> : null}</div>
            ))}
            <div><b>Education:</b> {app.education || '—'}</div>
            <div style={{ whiteSpace: 'pre-wrap' }}><b>References:</b> {app.references || '—'}</div>
            {questions.application.map((q) => <div key={q.id}><b>{q.question}</b> {q.kind === 'yesno' ? yn(app.custom?.[q.id]) : (app.custom?.[q.id] || '—')}</div>)}
            {app.about && <div style={{ whiteSpace: 'pre-wrap' }}><b>More:</b> {app.about}</div>}
            <div style={{ fontSize: 12, color: 'var(--mist)' }}>Submitted {app.certified_at ? new Date(app.certified_at).toLocaleString() : ''} with the truthfulness certification checked.</div>
          </div>
        ))}

        {(tab === 'screening' || tab === 'interview') && (
          <div>
            <div style={{ display: 'flex', gap: 10 }}>
              <label style={{ fontSize: 12.5, flex: 1 }}>Date<input type="date" style={inp} value={draft.date || ''} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></label>
              <label style={{ fontSize: 12.5, flex: 2 }}>{tab === 'interview' ? 'Interviewer(s)' : 'Screened by'}<input style={inp} value={draft.by || ''} onChange={(e) => setDraft({ ...draft, by: e.target.value })} /></label>
            </div>
            {qList.map((q) => {
              const a = draft[q.id] || {}
              return (
                <div key={q.id} style={{ borderTop: '1px solid var(--border)', padding: '9px 0' }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{q.question}</div>
                  {q.kind === 'rating' && (
                    <div style={{ display: 'flex', gap: 6, margin: '5px 0' }}>
                      {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => setAns(q.id, { rating: n })} style={{ width: 34, height: 30, borderRadius: 6, border: '1px solid var(--border)', background: a.rating === n ? '#1F3A5F' : '#fff', color: a.rating === n ? '#fff' : '#334155', fontWeight: 700, cursor: 'pointer' }}>{n}</button>)}
                      <span style={{ fontSize: 11.5, color: 'var(--mist)', alignSelf: 'center' }}>1 = poor · 5 = excellent</span>
                    </div>
                  )}
                  {q.kind === 'yesno' && (
                    <div style={{ display: 'flex', gap: 12, margin: '5px 0' }}>
                      {['yes', 'no'].map((v) => <label key={v} style={{ fontSize: 13, cursor: 'pointer' }}><input type="radio" checked={a.value === v} onChange={() => setAns(q.id, { value: v })} /> {v === 'yes' ? 'Yes' : 'No'}</label>)}
                    </div>
                  )}
                  <textarea rows={q.kind === 'text' ? 2 : 1} placeholder={q.kind === 'text' ? 'Answer' : 'Notes (job-related only)'} style={inp} value={q.kind === 'text' ? (a.value || '') : (a.notes || '')} onChange={(e) => setAns(q.id, q.kind === 'text' ? { value: e.target.value } : { notes: e.target.value })} />
                </div>
              )
            })}
            <label style={{ fontSize: 12.5, display: 'block', marginTop: 8 }}>Overall notes<textarea rows={3} style={inp} value={draft.notes || ''} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '8px 0' }}>
              <b style={{ fontSize: 13 }}>Recommendation:</b>
              {[['advance', 'Advance'], ['hold', 'Hold'], ['decline', 'Do not advance']].map(([k, l]) => <label key={k} style={{ fontSize: 13, cursor: 'pointer' }}><input type="radio" checked={draft.recommendation === k} onChange={() => setDraft({ ...draft, recommendation: k })} /> {l}</label>)}
            </div>
            {tab === 'interview' && qList.some((q) => q.kind === 'rating') && (() => {
              const r = qList.filter((q) => q.kind === 'rating').map((q) => draft[q.id]?.rating).filter(Boolean)
              return r.length ? <div style={{ fontSize: 13, color: 'var(--mist)' }}>Average rating: <b>{(r.reduce((s, x) => s + x, 0) / r.length).toFixed(1)}</b> of 5 ({r.length} rated)</div> : null
            })()}
            <div style={{ fontSize: 11.5, color: '#92400E', margin: '6px 0' }}>Keep notes job-related and factual — never about age, family, health, religion, national origin or other protected characteristics. Forms are kept with the application (1 year after a decision).</div>
            <button className="auth-button" style={{ width: 'auto' }} disabled={saving} onClick={saveForm}>{saving ? 'Saving…' : `Save ${FORM_LABEL[tab].toLowerCase()}`}</button>
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--border)', marginTop: 14, paddingTop: 10 }}>
          <label style={{ fontSize: 12.5, fontWeight: 700 }}>Internal notes</label>
          <textarea rows={2} style={inp} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button className="logout-button" style={{ marginTop: 6 }} onClick={saveNotes}>Save notes</button>
          {msg && <span style={{ marginLeft: 10, fontSize: 13, color: msg.includes('aved') ? '#15803D' : '#B42318' }}>{msg}</span>}
        </div>
      </div>
    </div>
  )
}

// Company questions for each form, overall or for one position.
export function HiringQuestions({ orgId, jds }) {
  const [rows, setRows] = useState([])
  const [f, setF] = useState({ form_type: 'interview', job_description_id: '', question: '', kind: 'rating', required: false })
  async function load() {
    if (!orgId) return
    const { data } = await supabase.from('rewards_hiring_questions').select('*').eq('org_id', orgId).eq('active', true).order('form_type').order('sort')
    setRows(data || [])
  }
  useEffect(() => { load() }, [orgId])
  async function add(e) {
    e.preventDefault()
    if (!f.question.trim()) return
    await supabase.from('rewards_hiring_questions').insert({ org_id: orgId, form_type: f.form_type, job_description_id: f.job_description_id || null, question: f.question.trim(), kind: f.kind, required: f.required, sort: rows.length + 100 })
    setF({ ...f, question: '' }); load()
  }
  const jdName = (id) => (jds.find((j) => j.id === id) || {}).title || 'All positions'
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--mist)', marginTop: 0 }}>Standard, job-related questions are built in. Add your own here — for every position or just one. Ask only what relates to the job: never age, date of birth, marital/family status, religion, national origin, health, or arrests.</p>
      <form onSubmit={add} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
        <label style={{ fontSize: 12.5 }}>Form<select style={inp} value={f.form_type} onChange={(e) => setF({ ...f, form_type: e.target.value, kind: e.target.value === 'interview' ? 'rating' : 'text' })}>
          <option value="application">Application</option><option value="screening">Screening</option><option value="interview">Interview</option></select></label>
        <label style={{ fontSize: 12.5 }}>Position<select style={inp} value={f.job_description_id} onChange={(e) => setF({ ...f, job_description_id: e.target.value })}>
          <option value="">All positions</option>{jds.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}</select></label>
        <label style={{ fontSize: 12.5, flex: '1 1 260px' }}>Question<input style={inp} value={f.question} onChange={(e) => setF({ ...f, question: e.target.value })} /></label>
        <label style={{ fontSize: 12.5 }}>Answer type<select style={inp} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
          <option value="text">Written answer</option><option value="yesno">Yes / No</option><option value="rating">Rating 1–5</option></select></label>
        <label style={{ fontSize: 12.5, display: 'flex', gap: 4, alignItems: 'center' }}><input type="checkbox" checked={f.required} onChange={(e) => setF({ ...f, required: e.target.checked })} /> Required</label>
        <button className="auth-button" type="submit" style={{ width: 'auto', margin: 0 }}>+ Add question</button>
      </form>
      <table className="data-table"><thead><tr><th>Form</th><th>Position</th><th>Question</th><th>Type</th><th></th></tr></thead><tbody>
        {rows.map((q) => (
          <tr key={q.id}><td style={{ textTransform: 'capitalize' }}>{q.form_type}</td><td>{jdName(q.job_description_id)}</td><td>{q.question}{q.required ? ' *' : ''}</td><td>{{ text: 'Written', yesno: 'Yes/No', rating: '1–5' }[q.kind]}</td>
            <td style={{ textAlign: 'right' }}><button className="logout-button" onClick={async () => { await supabase.from('rewards_hiring_questions').update({ active: false }).eq('id', q.id); load() }}>Remove</button></td></tr>
        ))}
        {!rows.length && <tr><td colSpan="5" style={{ color: 'var(--mist)' }}>No custom questions yet — the built-in ones are used.</td></tr>}
      </tbody></table>
    </div>
  )
}

// Settings → WorkForce wrapper (loads the company's positions itself).
export function HiringQuestionsSettings({ orgId }) {
  const [jds, setJds] = useState([])
  useEffect(() => { if (orgId) supabase.from('rewards_job_descriptions').select('id, title').eq('org_id', orgId).eq('is_active', true).order('title').then(({ data }) => setJds(data || [])) }, [orgId])
  return <HiringQuestions orgId={orgId} jds={jds} />
}
