import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import AskBar from '../AskBar'
import '../fieldapp.css'

// Shared frame for the Field App supervisor screens: navy title bar ("TITLE" over the company
// name), an optional back arrow, the sky-blue body, and the Ask Anything bar at the bottom.
const nameCache = {}
export function useOrgName(orgId) {
  const [name, setName] = useState(() => nameCache[orgId] || (() => {
    try { const v = JSON.parse(localStorage.getItem('journey_last_org') || 'null'); return v && v.id === orgId ? v.name : '' } catch { return '' }
  })())
  useEffect(() => {
    if (!orgId || nameCache[orgId]) return
    supabase.from('organizations').select('name, dba_name').eq('id', orgId).maybeSingle().then(({ data }) => {
      const n = data?.dba_name || data?.name || ''
      nameCache[orgId] = n; setName(n)
    })
  }, [orgId])
  return name
}

export default function FieldShell({ profile, title, back = true, onBack, children, menu }) {
  const navigate = useNavigate()
  const org = useOrgName(profile?.org_id)
  return (
    <div className="fa-shell">
      <div className="fa-header">
        {back && <button type="button" className="fa-back-btn" aria-label="Back" onClick={() => (onBack ? onBack() : navigate(-1))}>↶</button>}
        <div className="fa-header-title" style={{ textTransform: 'uppercase' }}>{title}</div>
        <div className="fa-header-sub" style={{ fontWeight: 600 }}>{org}</div>
        {menu}
      </div>
      <div className="fa-body">{children}</div>
      <AskBar />
    </div>
  )
}

// Today's date as YYYY-MM-DD in the device's zone.
export function todayISO() {
  const d = new Date()
  return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
export function shiftISO(iso, days) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
export const fmtDayLong = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

// Late = the scheduled arrival time has been reached and the tech hasn't arrived (not started / finished).
export function isLate(job, now = Date.now()) {
  if (!job?.start_time || job.arrival_at) return false
  if (!['scheduled', 'on_my_way'].includes(job.status)) return false
  return new Date(job.start_time).getTime() <= now
}
