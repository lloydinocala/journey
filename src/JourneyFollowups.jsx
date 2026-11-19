import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import JourneyAppointmentModal, { ContactPicker, canUseJourneyDesk, fmtPhone, label12, APPT_TYPES } from './JourneyAppointmentModal'

// Journey (Platform) follow-ups: call-backs, support issues (always a follow-up first — Journey schedules
// the support call), suggestions to review, info to send, vendor items and important inquiries.
// "Schedule" turns a follow-up into an appointment on the Journey calendar.
const TZ = 'America/New_York'
export const FU_TYPES = {
  callback: { l: 'Call back', c: '#2F79C4' }, support: { l: 'Support issue', c: '#B45309' }, suggestion: { l: 'Suggestion', c: '#0E7C66' },
  send_info: { l: 'Send info', c: '#7C3AED' }, vendor: { l: 'Vendor', c: '#9C6A12' }, inquiry: { l: 'Inquiry', c: '#DB2777' }, other: { l: 'Other', c: '#475569' },
}
const SCHEDULE_AS = { support: 'support', callback: 'demo_follow_up', suggestion: 'other', send_info: 'other', vendor: 'other', inquiry: 'other', other: 'other' }
const todayET = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
const fmtDay = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
const BLANK = () => ({ type: 'callback', title: '', due_date: todayET(), due_time: '', priority: 'normal', customer_id: null, sales_lead_id: null, contact_name: '', company: '', phone: '', email: '', notes: '' })

export default function JourneyFollowups({ profile }) {
  const [rows, setRows] = useState(null)
  const [tab, setTab] = useState('open')
  const [type, setType] = useState('all')
  const [form, setForm] = useState(null)
  const [schedule, setSchedule] = useState(null)
  const [err, setErr] = useState('')

  const load = async () => {
    const { data } = await supabase.from('journey_followups').select('*, appt:journey_appointments!journey_followups_appointment_id_fkey(id, starts_at, status, type)')
      .eq('status', tab).order('due_date', { ascending: tab === 'open' }).order('created_at', { ascending: false }).limit(500)
    setRows(data || [])
  }
  useEffect(() => { if (canUseJourneyDesk(profile)) load() }, [tab])
  if (!canUseJourneyDesk(profile)) return <div className="page-container">Journey platform account only.</div>

  const today = todayET()
  const list = (rows || []).filter((r) => type === 'all' || r.type === type)
  const save = async () => {
    setErr('')
    const f = form
    if (!f.title.trim()) { setErr('Say what needs to happen.'); return }
    const row = { type: f.type, title: f.title.trim(), due_date: f.due_date || today, due_time: f.due_time || null, priority: f.priority, customer_id: f.customer_id, sales_lead_id: f.sales_lead_id,
      contact_name: f.contact_name || null, company: f.company || null, phone: f.phone.replace(/\D/g, '').slice(-10) || null, email: f.email.trim().toLowerCase() || null, notes: f.notes || null, updated_at: new Date().toISOString() }
    const { error } = f.id ? await supabase.from('journey_followups').update(row).eq('id', f.id) : await supabase.from('journey_followups').insert({ ...row, created_by: profile?.id || null })
    if (error) { setErr(error.message); return }
    setForm(null); load()
  }
  const setStatus = async (r, status) => {
    await supabase.from('journey_followups').update({ status, done_at: status === 'done' ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq('id', r.id)
    load()
  }
  const openSchedule = async (r) => {
    if (r.appt) { const { data } = await supabase.from('journey_appointments').select('*').eq('id', r.appt.id).single(); if (data) { setSchedule(data); return } }
    setSchedule({ type: SCHEDULE_AS[r.type], followup_id: r.id, customer_id: r.customer_id, sales_lead_id: r.sales_lead_id, contact_name: r.contact_name, company: r.company, phone: r.phone, email: r.email,
      notes: r.title + (r.notes ? '\n' + r.notes : ''), day: r.due_date >= today ? r.due_date : today, time: r.due_time ? r.due_time.slice(0, 5) : '09:00' })
  }
  const lab = { display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12.5, fontWeight: 600, color: '#475569' }

  return (
    <div className="page-container" style={{ maxWidth: 1200 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>Follow-ups</h1>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setForm(BLANK())}>+ New follow-up</button>
      </div>
      <p style={{ color: '#64748B', marginTop: 4 }}>Call-backs, support issues, suggestions and anything else that needs doing. Schedule one to put it on the calendar.</p>

      {form && (
        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: 14, margin: '12px 0' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {Object.entries(FU_TYPES).map(([k, v]) => (
              <button key={k} type="button" onClick={() => setForm({ ...form, type: k })} style={{ border: `1.5px solid ${v.c}`, background: form.type === k ? v.c : '#fff', color: form.type === k ? '#fff' : v.c, borderRadius: 999, padding: '4px 12px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{v.l}</button>
            ))}
          </div>
          <label style={lab}>What needs to happen *<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Call back about invoices not sending" /></label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10, marginTop: 10 }}>
            <label style={lab}>Due<input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></label>
            <label style={lab}>Time (optional)<input type="time" value={form.due_time || ''} onChange={(e) => setForm({ ...form, due_time: e.target.value })} /></label>
            <label style={lab}>Priority<select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option value="normal">Normal</option><option value="important">Important</option></select></label>
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ ...lab, marginBottom: 4 }}>Who</div>
            <ContactPicker value={form.customer_id || form.sales_lead_id ? (form.contact_name || form.company) : ''} onPick={(h) => setForm({ ...form, customer_id: h.customer_id, sales_lead_id: h.sales_lead_id, contact_name: h.contact_name, company: h.company, phone: h.phone, email: h.email })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10, marginTop: 10 }}>
            <label style={lab}>Name<input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></label>
            <label style={lab}>Company<input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></label>
            <label style={lab}>Phone<input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            <label style={lab}>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          </div>
          <label style={{ ...lab, marginTop: 10 }}>Notes<textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          {err && <div style={{ color: '#B42318', marginTop: 6 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}><button className="btn btn-primary" onClick={save}>{form.id ? 'Save' : 'Add follow-up'}</button><button className="btn" onClick={() => setForm(null)}>Cancel</button></div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, margin: '12px 0', flexWrap: 'wrap' }}>
        {[['open', 'Open'], ['done', 'Done'], ['canceled', 'Canceled']].map(([k, l]) => <button key={k} className={tab === k ? 'btn btn-primary' : 'btn'} onClick={() => setTab(k)}>{l}</button>)}
        <select value={type} onChange={(e) => setType(e.target.value)} style={{ marginLeft: 8 }}><option value="all">All types</option>{Object.entries(FU_TYPES).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}</select>
        <span style={{ marginLeft: 'auto', alignSelf: 'center', color: '#64748B' }}>{rows ? `${list.length} shown` : 'Loading…'}</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="ledger-table" style={{ width: '100%' }}>
          <thead><tr><th>Due</th><th>Type</th><th>What</th><th>Who</th><th>Phone</th><th>Scheduled</th><th></th></tr></thead>
          <tbody>
            {list.map((r) => {
              const late = tab === 'open' && r.due_date < today, t = FU_TYPES[r.type] || FU_TYPES.other
              return (
                <tr key={r.id} style={{ background: r.priority === 'important' ? '#FFF7ED' : undefined }}>
                  <td style={{ whiteSpace: 'nowrap', color: late ? '#B42318' : undefined, fontWeight: late || r.due_date === today ? 700 : 400 }}>{r.due_date === today ? 'Today' : fmtDay(r.due_date)}{r.due_time ? ` · ${label12(r.due_time.slice(0, 5))}` : ''}{late ? ' (late)' : ''}</td>
                  <td><span style={{ background: t.c, color: '#fff', borderRadius: 999, padding: '2px 9px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{t.l}</span>{r.priority === 'important' ? ' ⚑' : ''}</td>
                  <td><b>{r.title}</b>{r.notes ? <div style={{ fontSize: 12.5, color: '#64748B', whiteSpace: 'pre-wrap' }}>{r.notes}</div> : null}</td>
                  <td>{r.customer_id ? <Link to={`/customers/${r.customer_id}`}>{r.contact_name || r.company}</Link> : (r.contact_name || '')}{r.company && r.contact_name ? <div style={{ fontSize: 12.5, color: '#64748B' }}>{r.company}</div> : null}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{r.phone ? <a href={`tel:${r.phone}`}>{fmtPhone(r.phone)}</a> : ''}</td>
                  <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{r.appt ? `${APPT_TYPES[r.appt.type]?.l || 'Appt'} · ${new Date(r.appt.starts_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ })}${r.appt.status !== 'booked' ? ` (${r.appt.status.replace('_', ' ')})` : ''}` : ''}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {tab === 'open' ? <>
                      <button className="btn" onClick={() => openSchedule(r)}>{r.appt ? 'Reschedule' : 'Schedule'}</button>{' '}
                      <button className="btn" onClick={() => setStatus(r, 'done')}>Done</button>{' '}
                      <button className="btn" onClick={() => setForm({ ...BLANK(), ...r, phone: fmtPhone(r.phone), due_time: r.due_time ? r.due_time.slice(0, 5) : '', notes: r.notes || '', email: r.email || '', contact_name: r.contact_name || '', company: r.company || '' })}>Edit</button>{' '}
                      <button className="btn" onClick={() => setStatus(r, 'canceled')} title="Cancel">✕</button>
                    </> : <button className="btn" onClick={() => setStatus(r, 'open')}>Reopen</button>}
                  </td>
                </tr>
              )
            })}
            {rows && !list.length && <tr><td colSpan={7} style={{ color: '#64748B' }}>{tab === 'open' ? 'Nothing waiting. 🎉' : 'Nothing here.'}</td></tr>}
          </tbody>
        </table>
      </div>

      {schedule && <JourneyAppointmentModal appt={schedule} profile={profile} onClose={() => setSchedule(null)} onSaved={load} />}
    </div>
  )
}
