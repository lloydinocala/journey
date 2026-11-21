import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'

const WINDOWS = { '8_11': '8–11 AM', '10_1': '10 AM–1 PM', '12_3': '12–3 PM', '2_5': '2–5 PM', asap: 'As soon as possible' }
const todayIso = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) }
const plusDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
const longDate = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
const timeOf = (ts) => ts ? new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : ''

// My upcoming appointments: visits booked from today through the next 30 days.
// (Past visits, invoices and estimates live in "Access My Service Records".)
export default function CustomerAppointments({ customer }) {
  const nav = useNavigate()
  const [rows, setRows] = useState(null)

  useEffect(() => {
    let live = true
    const from = todayIso(), to = plusDays(from, 30)
    supabase.from('jobs')
      .select('id, job_number, job_type, status, job_date, start_time, requested_window, date_pending, service_complaint')
      .is('deleted_at', null).gte('job_date', from).lte('job_date', to)
      .not('status', 'in', '(completed,canceled,cancelled,incomplete)')
      .order('job_date', { ascending: true }).order('start_time', { ascending: true })
      .then(({ data }) => { if (live) setRows(data || []) })
    return () => { live = false }
  }, [customer.id])

  const when = (j) => {
    if (j.date_pending) return 'Time to be confirmed by the office'
    if (j.start_time) return 'Arrival around ' + timeOf(j.start_time)
    if (WINDOWS[j.requested_window]) return 'Arrival window ' + WINDOWS[j.requested_window]
    return ''
  }
  const statusWord = (s) => s === 'on_my_way' ? 'On the way' : s === 'in_progress' ? 'In progress' : 'Scheduled'

  return (
    <div className="cp-wrap">
      <button className="cp-back" onClick={() => nav('/portal')}>‹ Home</button>
      <h2 className="cp-h2">My upcoming appointments</h2>
      <p className="cp-lead">Visits booked for the next 30 days.</p>

      {rows === null ? <div className="cp-empty">Loading…</div> : rows.length ? (
        <div className="cp-card">
          {rows.map((j) => (
            <div className="cp-row" key={j.id}>
              <div className="cp-main">
                <b>{longDate(j.job_date)}</b>
                <span>{j.job_type || 'Service visit'}{when(j) ? ` · ${when(j)}` : ''}</span>
                {j.service_complaint && <span>{j.service_complaint}</span>}
              </div>
              <span className={'cp-pill ' + (j.status === 'on_my_way' ? 'ok' : 'pend')}>{statusWord(j.status)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="cp-card"><div className="cp-empty">Nothing is booked for the next 30 days.</div></div>
      )}

      <div style={{ height: 8 }} />
      <button className="cp-btn" onClick={() => nav('/portal/schedule')}>Schedule an appointment</button>
      <div style={{ height: 8 }} />
      <button className="cp-btn ghost" onClick={() => nav('/portal/records?tab=appointments')}>See all my records</button>
    </div>
  )
}
