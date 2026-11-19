import { useEffect, useMemo, useState } from 'react'
import { supabase } from './utils/supabase'
import JourneyAppointmentModal, { APPT_TYPES } from './JourneyAppointmentModal'

// Journey's sales calendar (super admin): the follow-up calls Clara books with Lloyd, plus time
// Lloyd blocks off. Weekdays 8–5 Eastern in 30-minute rows; each sales call is booked for one hour.
// Clara never offers a booked or blocked slot, and always starts from the next business day.
const TZ = 'America/New_York'
const SLOTS = Array.from({ length: 18 }, (_, i) => { const m = 8 * 60 + i * 30; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` })
const STATUS = { booked: { l: 'Booked', c: '#2F79C4' }, done: { l: 'Done', c: '#16A34A' }, no_answer: { l: 'No answer', c: '#D97706' }, canceled: { l: 'Canceled', c: '#94A3B8' } }
const fmtPhone = (s) => { const d = String(s || '').replace(/\D/g, '').slice(-10); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : '' }
const etDate = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)
const etTime = (d) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d)
const addDays = (s, n) => { const x = new Date(s + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
const mondayOf = (s) => { const x = new Date(s + 'T12:00:00Z'); const dow = (x.getUTCDay() + 6) % 7; return addDays(s, -dow) }
// Eastern wall-clock date+time → UTC instant (handles daylight saving)
function etToUtc(day, hhmm) {
  const guess = new Date(`${day}T${hhmm}:00Z`)
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(guess).map((x) => [x.type, x.value]))
  const shownAsUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute)
  return new Date(guess.getTime() + (guess.getTime() - shownAsUtc))
}
const label12 = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}` }

export default function SalesCalendar() {
  const [week, setWeek] = useState(() => mondayOf(etDate(new Date())))
  const [calls, setCalls] = useState([])
  const [blocks, setBlocks] = useState([])
  const [appts, setAppts] = useState([])
  const [jAppt, setJAppt] = useState(null)
  const [sel, setSel] = useState(null)
  const [blockForm, setBlockForm] = useState(null)
  const days = useMemo(() => [0, 1, 2, 3, 4].map((i) => addDays(week, i)), [week])

  const load = async () => {
    const from = etToUtc(days[0], '00:00').toISOString(), to = etToUtc(addDays(days[4], 1), '00:00').toISOString()
    const [{ data: c }, { data: b }, { data: a }] = await Promise.all([
      supabase.from('sales_leads').select('id, contact_name, company_name, phone, email, language, callback_at, callback_status, reminders_ok, confirm_sent_at, remind_day_sent_at, remind_hour_sent_at, notes')
        .gte('callback_at', from).lt('callback_at', to),
      supabase.from('sales_calendar_blocks').select('*').lt('starts_at', to).gt('ends_at', from),
      supabase.from('journey_appointments').select('*').neq('status', 'canceled').gte('starts_at', from).lt('starts_at', to),
    ])
    setCalls(c || []); setBlocks(b || []); setAppts(a || [])
  }
  useEffect(() => { load() }, [week])

  // Sales calls are one hour: a call fills its start slot and the half hour after it.
  const callAt = (day, slot) => {
    const t = etToUtc(day, slot).getTime()
    return calls.find((c) => c.callback_status !== 'canceled' && t >= new Date(c.callback_at).getTime() && t < new Date(c.callback_at).getTime() + 3600e3)
  }
  const isStart = (c, day, slot) => etTime(new Date(c.callback_at)) === slot && etDate(new Date(c.callback_at)) === day
  // Appointments booked on the Journey desk (setup, support, follow-ups…), any length.
  const apptAt = (day, slot) => { const t = etToUtc(day, slot).getTime(); return appts.find((a) => t >= new Date(a.starts_at).getTime() && t < new Date(a.starts_at).getTime() + a.duration_min * 60e3) }
  const apptStart = (a, day, slot) => etTime(new Date(a.starts_at)) === slot && etDate(new Date(a.starts_at)) === day
  const blockAt = (day, slot) => { const s = etToUtc(day, slot).getTime(); return blocks.find((b) => s < new Date(b.ends_at).getTime() && s + 30 * 60e3 > new Date(b.starts_at).getTime()) }
  const today = etDate(new Date())

  const setStatus = async (c, s) => { await supabase.from('sales_leads').update({ callback_status: s, updated_at: new Date().toISOString() }).eq('id', c.id); setSel(null); load() }
  const saveBlock = async () => {
    const f = blockForm
    if (!f.day || !f.start || !f.end || f.end <= f.start) return
    await supabase.from('sales_calendar_blocks').insert({ starts_at: etToUtc(f.day, f.start).toISOString(), ends_at: etToUtc(f.day, f.end).toISOString(), note: f.note || null })
    setBlockForm(null); load()
  }
  const removeBlock = async (b) => { await supabase.from('sales_calendar_blocks').delete().eq('id', b.id); load() }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0 12px', flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => setWeek(addDays(week, -7))}>‹ Prev</button>
        <button className="btn" onClick={() => setWeek(mondayOf(today))}>This week</button>
        <button className="btn" onClick={() => setWeek(addDays(week, 7))}>Next ›</button>
        <b style={{ marginLeft: 8 }}>Week of {new Date(week + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })}</b>
        <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => setJAppt({ day: days.find((d) => d >= today) || days[0] })}>+ Appointment</button>
        <button className="btn btn-primary" onClick={() => setBlockForm({ day: days.find((d) => d >= today) || days[0], start: '12:00', end: '13:00', note: '' })}>Block time</button>
      </div>

      {blockForm && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <label>Day<br /><input type="date" value={blockForm.day} onChange={(e) => setBlockForm({ ...blockForm, day: e.target.value })} /></label>
          <label>From<br /><select value={blockForm.start} onChange={(e) => setBlockForm({ ...blockForm, start: e.target.value })}>{SLOTS.map((s) => <option key={s} value={s}>{label12(s)}</option>)}</select></label>
          <label>To<br /><select value={blockForm.end} onChange={(e) => setBlockForm({ ...blockForm, end: e.target.value })}>{[...SLOTS.slice(1), '17:00'].map((s) => <option key={s} value={s}>{label12(s)}</option>)}</select></label>
          <label style={{ flex: 1, minWidth: 180 }}>Note<br /><input style={{ width: '100%' }} placeholder="e.g. Air-Care job, dentist" value={blockForm.note} onChange={(e) => setBlockForm({ ...blockForm, note: e.target.value })} /></label>
          <button className="btn btn-primary" onClick={saveBlock}>Save block</button>
          <button className="btn" onClick={() => setBlockForm(null)}>Cancel</button>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table className="ledger-table" style={{ width: '100%', tableLayout: 'fixed', minWidth: 760 }}>
          <thead><tr><th style={{ width: 80 }}>Time</th>{days.map((d) => (
            <th key={d} style={d === today ? { background: '#1E4E8C' } : undefined}>{new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}</th>
          ))}</tr></thead>
          <tbody>
            {SLOTS.map((s) => (
              <tr key={s}>
                <td style={{ fontSize: 12.5, color: '#64748B' }}>{label12(s)}</td>
                {days.map((d) => {
                  const c = callAt(d, s), ap = !c && apptAt(d, s), b = !c && !ap && blockAt(d, s)
                  return (
                    <td key={d} style={{ padding: 3, height: 30 }}>
                      {c ? (
                        <div onClick={() => setSel(c)} style={{ cursor: 'pointer', background: STATUS[c.callback_status || 'booked']?.c, color: '#fff', borderRadius: 6, padding: '3px 7px', fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {isStart(c, d, s) ? <>📞 <b>{c.contact_name || 'Caller'}</b>{c.company_name ? ` · ${c.company_name}` : ''}</> : <span style={{ opacity: .8 }}>↳ continued</span>}
                        </div>
                      ) : ap ? (
                        <div onClick={() => setJAppt(ap)} style={{ cursor: 'pointer', background: ap.status === 'done' ? '#16A34A' : (APPT_TYPES[ap.type] || APPT_TYPES.other).c, color: '#fff', borderRadius: 6, padding: '3px 7px', fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {apptStart(ap, d, s) ? <><b>{(APPT_TYPES[ap.type] || APPT_TYPES.other).l}</b> · {ap.contact_name || ap.company || ''}</> : <span style={{ opacity: .8 }}>↳ continued</span>}
                        </div>
                      ) : b ? (
                        <div title={b.note || 'Blocked'} style={{ background: '#E2E8F0', color: '#475569', borderRadius: 6, padding: '3px 7px', fontSize: 12, display: 'flex', justifyContent: 'space-between', gap: 4 }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>⛔ {b.note || 'Blocked'}</span>
                          <span onClick={() => removeBlock(b)} title="Remove block" style={{ cursor: 'pointer' }}>✕</span>
                        </div>
                      ) : null}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {jAppt && <JourneyAppointmentModal appt={jAppt} onClose={() => setJAppt(null)} onSaved={load} />}

      {sel && (
        <div onClick={() => setSel(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: 20, width: 'min(460px, 92vw)' }}>
            <h3 style={{ marginTop: 0 }}>{sel.contact_name || 'Caller'}{sel.company_name ? ` — ${sel.company_name}` : ''}</h3>
            <p style={{ margin: '4px 0' }}><b>{new Date(sel.callback_at).toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ })}</b> (Eastern)</p>
            {sel.phone && <p style={{ margin: '4px 0' }}>📞 <a href={`tel:${sel.phone}`}>{fmtPhone(sel.phone)}</a>{sel.language === 'Spanish' ? ' · Spanish' : ''}</p>}
            {sel.email && <p style={{ margin: '4px 0' }}>✉ {sel.email}</p>}
            <p style={{ margin: '4px 0', fontSize: 13, color: '#64748B' }}>
              Reminders: {sel.reminders_ok ? [sel.confirm_sent_at && 'confirmation sent', sel.remind_day_sent_at && 'day-before sent', sel.remind_hour_sent_at && 'hour-before sent'].filter(Boolean).join(' · ') || 'on — none sent yet' : 'caller declined'}
            </p>
            {sel.notes && <p style={{ fontSize: 13.5, background: '#F8FAFC', padding: 10, borderRadius: 8, whiteSpace: 'pre-wrap' }}>{sel.notes}</p>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <button className="btn btn-primary" onClick={() => setStatus(sel, 'done')}>Done</button>
              <button className="btn" onClick={() => setStatus(sel, 'no_answer')}>No answer</button>
              <button className="btn" onClick={() => setStatus(sel, 'canceled')}>Cancel call</button>
              {sel.callback_status !== 'booked' && <button className="btn" onClick={() => setStatus(sel, 'booked')}>Back to booked</button>}
              <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => setSel(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
