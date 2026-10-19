import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './utils/supabase'

// Public job application — /apply/<company hiring link>. No login. Only job-related
// questions; the company's own extra questions appear after the standard ones.

const inp = { width: '100%', padding: '9px 11px', border: '1px solid #CBD5E1', borderRadius: 8, fontSize: 15, boxSizing: 'border-box', fontFamily: 'inherit' }
const lbl = { display: 'block', fontSize: 13.5, fontWeight: 700, color: '#334155', margin: '12px 0 4px' }
const blankJob = { employer: '', title: '', from: '', to: '', duties: '', reason: '', may_contact: '' }

function YesNo({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 14 }}>
      {['yes', 'no'].map((v) => (
        <label key={v} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 15, cursor: 'pointer' }}>
          <input type="radio" checked={value === v} onChange={() => onChange(v)} /> {v === 'yes' ? 'Yes' : 'No'}
        </label>
      ))}
    </div>
  )
}

export default function PublicApply() {
  const { token } = useParams()
  const [info, setInfo] = useState(null)
  const [err, setErr] = useState('')
  const [f, setF] = useState({ name: '', email: '', phone: '', address: '', city: '', zip: '', job_description_id: '', start_date: '', desired_pay: '', availability: '', work_authorized: '', over_18: '', drivers_license: '', experience_years: '', certifications: '', education: '', references: '', about: '', employment: [{ ...blankJob }], custom: {}, certify: false, website: '' })
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    supabase.functions.invoke('hr-apply', { body: { action: 'info', token } }).then(({ data, error }) => {
      if (error || data?.error) setErr(data?.error || 'This application link isn\'t working right now.')
      else { setInfo(data); if (data.positions?.length === 1) setF((x) => ({ ...x, job_description_id: data.positions[0].id })) }
    })
  }, [token])

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const setJob = (i, k, v) => setF({ ...f, employment: f.employment.map((j, n) => (n === i ? { ...j, [k]: v } : j)) })
  const questions = (info?.questions || []).filter((q) => !q.job_description_id || q.job_description_id === f.job_description_id)

  async function submit(e) {
    e.preventDefault(); setErr('')
    for (const q of questions) if (q.required && !f.custom[q.id]) { setErr(`Please answer: ${q.question}`); return }
    setSending(true)
    const { data, error } = await supabase.functions.invoke('hr-apply', { body: { action: 'submit', token, application: f } })
    setSending(false)
    if (error || data?.error) { let m = data?.error; try { const j = await error?.context?.json?.(); if (j?.error) m = j.error } catch (x) { /* ignore */ } setErr(m || 'Could not send your application.'); return }
    setDone(true); window.scrollTo({ top: 0 })
  }

  const color = info?.color || '#1F3A5F'
  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9', padding: '24px 14px 60px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', background: '#fff', borderRadius: 14, boxShadow: '0 2px 14px rgba(15,23,42,.08)', overflow: 'hidden' }}>
        <div style={{ background: color, color: '#fff', padding: '18px 22px' }}>
          <div style={{ fontSize: 13, opacity: 0.85, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase' }}>Job application</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{info?.company || ' '}</div>
        </div>
        <div style={{ padding: '18px 22px' }}>
          {!info && !err && <p>Loading…</p>}
          {err && !info && <p style={{ color: '#B42318' }}>{err}</p>}
          {done ? (
            <div>
              <h2 style={{ marginTop: 0 }}>Thank you — your application was sent.</h2>
              <p>{info.company} will review it and contact you{info.phone ? <> — or call them at <b>{info.phone}</b></> : ''}.</p>
            </div>
          ) : info && (
            <form onSubmit={submit}>
              <p style={{ color: '#475569', fontSize: 14, marginTop: 0 }}>It takes about 5 minutes. Fields marked * are required.</p>
              <input value={f.website} onChange={set('website')} style={{ display: 'none' }} tabIndex={-1} autoComplete="off" aria-hidden="true" />

              <label style={lbl}>Position *</label>
              <select style={inp} value={f.job_description_id} onChange={set('job_description_id')} required={info.positions.length > 0}>
                <option value="">{info.positions.length ? '— choose —' : 'General application'}</option>
                {info.positions.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
              {(() => { const p = info.positions.find((x) => x.id === f.job_description_id); return p?.summary ? <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>{p.summary}</div> : null })()}

              <label style={lbl}>Full name *</label><input style={inp} value={f.name} onChange={set('name')} required />
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 220px' }}><label style={lbl}>Phone *</label><input style={inp} type="tel" value={f.phone} onChange={set('phone')} /></div>
                <div style={{ flex: '1 1 220px' }}><label style={lbl}>Email</label><input style={inp} type="email" value={f.email} onChange={set('email')} /></div>
              </div>
              <label style={lbl}>Street address</label><input style={inp} value={f.address} onChange={set('address')} />
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 2 }}><label style={lbl}>City</label><input style={inp} value={f.city} onChange={set('city')} /></div>
                <div style={{ flex: 1 }}><label style={lbl}>ZIP</label><input style={inp} value={f.zip} onChange={set('zip')} /></div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px' }}><label style={lbl}>When could you start?</label><input style={inp} value={f.start_date} onChange={set('start_date')} placeholder="e.g. 2 weeks' notice" /></div>
                <div style={{ flex: '1 1 200px' }}><label style={lbl}>Desired pay</label><input style={inp} value={f.desired_pay} onChange={set('desired_pay')} /></div>
              </div>
              <label style={lbl}>Days / hours you're available</label><input style={inp} value={f.availability} onChange={set('availability')} />

              <label style={lbl}>Are you legally authorized to work in the United States? *</label><YesNo value={f.work_authorized} onChange={(v) => setF({ ...f, work_authorized: v })} />
              <label style={lbl}>Are you 18 or older? *</label><YesNo value={f.over_18} onChange={(v) => setF({ ...f, over_18: v })} />
              <label style={lbl}>Do you have a valid driver's license?</label><YesNo value={f.drivers_license} onChange={(v) => setF({ ...f, drivers_license: v })} />

              <label style={lbl}>Years of HVAC experience</label><input style={inp} value={f.experience_years} onChange={set('experience_years')} />
              <label style={lbl}>Certifications & licenses (EPA 608 type, NATE, etc.)</label><textarea rows={2} style={inp} value={f.certifications} onChange={set('certifications')} />

              <h3 style={{ margin: '20px 0 4px', fontSize: 16 }}>Work history</h3>
              {f.employment.map((j, i) => (
                <div key={i} style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: '4px 12px 12px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 200px' }}><label style={lbl}>Employer</label><input style={inp} value={j.employer} onChange={(e) => setJob(i, 'employer', e.target.value)} /></div>
                    <div style={{ flex: '1 1 200px' }}><label style={lbl}>Job title</label><input style={inp} value={j.title} onChange={(e) => setJob(i, 'title', e.target.value)} /></div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1 }}><label style={lbl}>From</label><input style={inp} value={j.from} onChange={(e) => setJob(i, 'from', e.target.value)} placeholder="MM/YYYY" /></div>
                    <div style={{ flex: 1 }}><label style={lbl}>To</label><input style={inp} value={j.to} onChange={(e) => setJob(i, 'to', e.target.value)} placeholder="MM/YYYY or present" /></div>
                  </div>
                  <label style={lbl}>Main duties</label><input style={inp} value={j.duties} onChange={(e) => setJob(i, 'duties', e.target.value)} />
                  <label style={lbl}>Reason for leaving</label><input style={inp} value={j.reason} onChange={(e) => setJob(i, 'reason', e.target.value)} />
                  <label style={lbl}>May we contact this employer?</label><YesNo value={j.may_contact} onChange={(v) => setJob(i, 'may_contact', v)} />
                </div>
              ))}
              {f.employment.length < 4 && <button type="button" onClick={() => setF({ ...f, employment: [...f.employment, { ...blankJob }] })} style={{ background: 'none', border: '1px dashed #94A3B8', borderRadius: 8, padding: '7px 12px', cursor: 'pointer' }}>+ Add another job</button>}

              <label style={lbl}>Education & training</label><textarea rows={2} style={inp} value={f.education} onChange={set('education')} />
              <label style={lbl}>References (name, how you know them, phone)</label><textarea rows={3} style={inp} value={f.references} onChange={set('references')} />

              {questions.map((q) => (
                <div key={q.id}>
                  <label style={lbl}>{q.question}{q.required ? ' *' : ''}</label>
                  {q.kind === 'yesno'
                    ? <YesNo value={f.custom[q.id]} onChange={(v) => setF({ ...f, custom: { ...f.custom, [q.id]: v } })} />
                    : <textarea rows={2} style={inp} value={f.custom[q.id] || ''} onChange={(e) => setF({ ...f, custom: { ...f.custom, [q.id]: e.target.value } })} />}
                </div>
              ))}

              <label style={lbl}>Anything else you'd like us to know?</label><textarea rows={3} style={inp} value={f.about} onChange={set('about')} />

              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 18, fontSize: 13.5, color: '#334155', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={f.certify} onChange={(e) => setF({ ...f, certify: e.target.checked })} style={{ marginTop: 3 }} />
                <span>I certify that the information I've given is true and complete. I understand false or missing information may disqualify me, and that employment is at will.</span>
              </label>
              <p style={{ fontSize: 12, color: '#64748B' }}>{info.company} is an equal opportunity employer. We don't ask about — and don't make decisions based on — race, color, religion, sex, national origin, age, disability, genetic information, or any other protected status. Applications are kept for one year after a decision, then securely deleted.</p>
              {err && <p style={{ color: '#B42318', fontWeight: 700 }}>{err}</p>}
              <button type="submit" disabled={sending || !f.certify || !f.work_authorized || !f.over_18} style={{ width: '100%', padding: 14, border: 'none', borderRadius: 10, background: color, color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer', opacity: sending || !f.certify ? 0.7 : 1 }}>{sending ? 'Sending…' : 'Send my application'}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
