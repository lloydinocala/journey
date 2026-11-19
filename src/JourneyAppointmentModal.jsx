import { useEffect, useState } from 'react'
import { supabase } from './utils/supabase'

// Journey (Platform) desk: appointment types, the contact picker, and the appointment editor.
// Demo bookings made by Clara or on journey-hvac.com live in sales_leads; everything booked here
// lives in journey_appointments. Both show on the Journey calendar and block open demo times.
export const JOURNEY_ORG = '5bb0e0a2-9a0a-4f45-96b9-69e7fe31ba8b'
export const TZ = 'America/New_York'
export const APPT_TYPES = {
  demo: { l: 'Demo', c: '#2F79C4' },
  setup: { l: 'Setup call', c: '#0E7C66' },
  support: { l: 'Support call', c: '#B45309' },
  demo_follow_up: { l: 'Demo follow-up', c: '#7C3AED' },
  re_engagement: { l: 'Re-engagement', c: '#DB2777' },
  other: { l: 'Other', c: '#475569' },
}
export const isJourney = (profile) => profile?.org_id === JOURNEY_ORG
export const canUseJourneyDesk = (profile) => profile?.role === 'super_admin' || isJourney(profile)
export const etDate = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)
export const etTime = (d) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d)
// Eastern wall-clock date + time → UTC instant (handles daylight saving)
export function etToUtc(day, hhmm) {
  const guess = new Date(`${day}T${hhmm}:00Z`)
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(guess).map((x) => [x.type, x.value]))
  return new Date(guess.getTime() + (guess.getTime() - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute)))
}
export const fmtPhone = (s) => { const d = String(s || '').replace(/\D/g, '').slice(-10); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : (s || '') }
export const label12 = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}` }
const TIMES = Array.from({ length: 44 }, (_, i) => { const m = 7 * 60 + i * 15; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }) // 7:00 AM – 5:45 PM
const DURS = [15, 30, 45, 60, 90, 120, 180, 240]

// Search Journey customers (subscribers) and demo requests; pick one to fill the contact.
export function ContactPicker({ value, onPick }) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState([])
  useEffect(() => {
    const s = q.trim()
    if (s.length < 2) { setHits([]); return }
    let live = true
    const t = setTimeout(async () => {
      const like = `%${s.replace(/[%_,()]/g, ' ')}%`
      const digits = s.replace(/\D/g, '')
      const cq = supabase.from('customers').select('id, display_name, company, first_name, last_name, primary_phone, email_1').eq('org_id', JOURNEY_ORG)
        .or(`display_name.ilike.${like},company.ilike.${like},email_1.ilike.${like}${digits.length >= 4 ? `,primary_phone.ilike.%${digits.slice(-4)}%` : ''}`).limit(6)
      const lq = supabase.from('sales_leads').select('id, contact_name, company_name, phone, email, kind, customer_id').in('kind', ['demo', 'call'])
        .or(`contact_name.ilike.${like},company_name.ilike.${like},email.ilike.${like}${digits.length >= 4 ? `,phone.ilike.%${digits.slice(-4)}%` : ''}`).limit(6)
      const [{ data: c }, { data: l }] = await Promise.all([cq, lq])
      if (!live) return
      setHits([
        ...(c || []).map((x) => ({ key: 'c' + x.id, tag: 'Customer', customer_id: x.id, sales_lead_id: null, contact_name: [x.first_name, x.last_name].filter(Boolean).join(' ') || x.display_name, company: x.company || x.display_name, phone: x.primary_phone || '', email: x.email_1 || '' })),
        ...(l || []).filter((x) => !x.customer_id).map((x) => ({ key: 'l' + x.id, tag: x.kind === 'demo' ? 'Demo request' : 'Clara caller', customer_id: null, sales_lead_id: x.id, contact_name: x.contact_name || '', company: x.company_name || '', phone: fmtPhone(x.phone), email: x.email || '' })),
      ])
    }, 250)
    return () => { live = false; clearTimeout(t) }
  }, [q])
  return (
    <div style={{ position: 'relative' }}>
      <input placeholder={value ? `Linked: ${value} — search to change` : 'Search customers & demo requests by name, company, phone…'} value={q} onChange={(e) => setQ(e.target.value)} style={{ width: '100%' }} />
      {hits.length > 0 && (
        <div style={{ position: 'absolute', zIndex: 20, left: 0, right: 0, background: '#fff', border: '1px solid #CBD5E1', borderRadius: 8, boxShadow: '0 8px 20px rgba(0,0,0,.12)', maxHeight: 240, overflowY: 'auto' }}>
          {hits.map((h) => (
            <div key={h.key} onClick={() => { onPick(h); setQ(''); setHits([]) }} style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9', fontSize: 14 }}>
              <b>{h.contact_name || h.company}</b>{h.company && h.contact_name ? ` · ${h.company}` : ''} <span style={{ fontSize: 11.5, color: '#64748B', marginLeft: 6 }}>{h.tag}</span>
              <div style={{ fontSize: 12.5, color: '#64748B' }}>{[h.phone, h.email].filter(Boolean).join(' · ')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// appt: an existing journey_appointments row, or a prefill ({ type, followup_id, contact fields, day, time }).
export default function JourneyAppointmentModal({ appt, profile, onClose, onSaved }) {
  const existing = !!appt?.id
  const start = appt?.starts_at ? new Date(appt.starts_at) : null
  const [f, setF] = useState(() => ({
    type: appt?.type || 'demo', day: appt?.day || (start ? etDate(start) : ''), time: appt?.time || (start ? etTime(start) : '09:00'),
    duration_min: appt?.duration_min || (appt?.type === 'support' ? 30 : 60), status: appt?.status || 'booked',
    customer_id: appt?.customer_id || null, sales_lead_id: appt?.sales_lead_id || null, followup_id: appt?.followup_id || null,
    contact_name: appt?.contact_name || '', company: appt?.company || '', phone: fmtPhone(appt?.phone), email: appt?.email || '', notes: appt?.notes || '',
  }))
  const [conflict, setConflict] = useState(null)
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setConflict(null) }

  async function findConflict(from, to) {
    const [{ data: s }, { data: a }, { data: b }] = await Promise.all([
      supabase.from('sales_leads').select('id, contact_name, callback_at').eq('callback_status', 'booked').gt('callback_at', new Date(from.getTime() - 3600e3).toISOString()).lt('callback_at', to.toISOString()),
      supabase.from('journey_appointments').select('id, contact_name, type, starts_at, duration_min').eq('status', 'booked').gt('starts_at', new Date(from.getTime() - 8 * 3600e3).toISOString()).lt('starts_at', to.toISOString()),
      supabase.from('sales_calendar_blocks').select('id, note, starts_at, ends_at').lt('starts_at', to.toISOString()).gt('ends_at', from.toISOString()),
    ])
    const hitS = (s || []).find((x) => new Date(x.callback_at).getTime() + 3600e3 > from.getTime())
    if (hitS) return `a demo with ${hitS.contact_name || 'a caller'} at ${label12(etTime(new Date(hitS.callback_at)))}`
    const hitA = (a || []).find((x) => x.id !== appt?.id && new Date(x.starts_at).getTime() + x.duration_min * 60e3 > from.getTime())
    if (hitA) return `a ${APPT_TYPES[hitA.type]?.l.toLowerCase() || 'appointment'} with ${hitA.contact_name || 'someone'} at ${label12(etTime(new Date(hitA.starts_at)))}`
    if (b && b[0]) return `blocked time (${b[0].note || 'blocked'})`
    return null
  }

  async function save(force) {
    setErr('')
    if (!f.day || !f.time) { setErr('Pick a day and time.'); return }
    if (!f.contact_name.trim() && !f.company.trim()) { setErr('Enter who the appointment is with.'); return }
    const from = etToUtc(f.day, f.time), to = new Date(from.getTime() + Number(f.duration_min) * 60e3)
    if (f.status === 'booked' && !force) {
      const c = await findConflict(from, to)
      if (c) { setConflict(c); return }
    }
    setSaving(true)
    const row = {
      type: f.type, starts_at: from.toISOString(), duration_min: Number(f.duration_min), status: f.status,
      customer_id: f.customer_id, sales_lead_id: f.sales_lead_id, followup_id: f.followup_id,
      contact_name: f.contact_name.trim() || null, company: f.company.trim() || null, phone: f.phone.replace(/\D/g, '').slice(-10) || null,
      email: f.email.trim().toLowerCase() || null, notes: f.notes || null, updated_at: new Date().toISOString(),
    }
    const res = existing
      ? await supabase.from('journey_appointments').update(row).eq('id', appt.id).select('id').single()
      : await supabase.from('journey_appointments').insert({ ...row, created_by: profile?.id || null }).select('id').single()
    if (res.error) { setSaving(false); setErr(res.error.message); return }
    // A follow-up that's now scheduled points at its appointment.
    if (f.followup_id) await supabase.from('journey_followups').update({ appointment_id: res.data.id, updated_at: new Date().toISOString() }).eq('id', f.followup_id)
    setSaving(false); onSaved && onSaved(); onClose()
  }

  const lab = { display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12.5, fontWeight: 600, color: '#475569' }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: 20, width: 'min(620px, 94vw)', maxHeight: '92vh', overflowY: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>{existing ? 'Appointment' : 'New appointment'}</h3>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {Object.entries(APPT_TYPES).map(([k, v]) => (
            <button key={k} type="button" onClick={() => set('type', k)} style={{ border: `1.5px solid ${v.c}`, background: f.type === k ? v.c : '#fff', color: f.type === k ? '#fff' : v.c, borderRadius: 999, padding: '4px 12px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{v.l}</button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
          <label style={lab}>Day<input type="date" value={f.day} onChange={(e) => set('day', e.target.value)} /></label>
          <label style={lab}>Time (Eastern)<select value={f.time} onChange={(e) => set('time', e.target.value)}>{TIMES.map((t) => <option key={t} value={t}>{label12(t)}</option>)}</select></label>
          <label style={lab}>Length<select value={f.duration_min} onChange={(e) => set('duration_min', e.target.value)}>{DURS.map((d) => <option key={d} value={d}>{d < 60 ? `${d} min` : `${d / 60} hr`}</option>)}</select></label>
          {existing && <label style={lab}>Status<select value={f.status} onChange={(e) => set('status', e.target.value)}><option value="booked">Booked</option><option value="done">Done</option><option value="no_answer">No answer</option><option value="canceled">Canceled</option></select></label>}
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ ...lab, marginBottom: 4 }}>With</div>
          <ContactPicker value={f.customer_id || f.sales_lead_id ? (f.contact_name || f.company) : ''} onPick={(h) => setF((x) => ({ ...x, customer_id: h.customer_id, sales_lead_id: h.sales_lead_id, contact_name: h.contact_name, company: h.company, phone: h.phone, email: h.email }))} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10, marginTop: 10 }}>
          <label style={lab}>Name<input value={f.contact_name} onChange={(e) => set('contact_name', e.target.value)} /></label>
          <label style={lab}>Company<input value={f.company} onChange={(e) => set('company', e.target.value)} /></label>
          <label style={lab}>Phone<input type="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></label>
          <label style={lab}>Email<input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></label>
        </div>
        <label style={{ ...lab, marginTop: 10 }}>Notes<textarea rows={3} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></label>
        {(f.customer_id || f.sales_lead_id) && <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 6 }}>Linked to {f.customer_id ? 'their customer record' : 'their demo request'}.</div>}
        {conflict && <div style={{ background: '#FEF3C7', color: '#92400E', borderRadius: 8, padding: '8px 12px', marginTop: 10, fontSize: 14 }}>That overlaps {conflict}. <button className="btn" style={{ marginLeft: 8 }} onClick={() => save(true)}>Book it anyway</button></div>}
        {err && <div style={{ color: '#B42318', marginTop: 8 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button className="btn btn-primary" disabled={saving} onClick={() => save(false)}>{saving ? 'Saving…' : existing ? 'Save' : 'Book appointment'}</button>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
