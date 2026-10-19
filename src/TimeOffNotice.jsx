import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'

// Approved time off, for dispatch. Reads only who/when (no reasons or balances) through
// org_time_off(), so dispatchers see it without HR access. The record itself lives in HR.

const iso = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` }
const nice = (s) => new Date(s + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

export async function fetchTimeOff(orgId, from, to) {
  if (!orgId) return []
  const { data } = await supabase.rpc('org_time_off', { p_org: orgId, p_from: from, p_to: to })
  return data || []
}

// Before assigning techs to a job date: returns the names of any who are out that day.
export async function techsOutOn(orgId, dateStr, userIds) {
  if (!orgId || !dateStr || !userIds?.length) return []
  const rows = await fetchTimeOff(orgId, dateStr, dateStr)
  const ids = new Set(userIds.filter(Boolean))
  return [...new Set(rows.filter((r) => ids.has(r.user_id)).map((r) => r.full_name))]
}

// Confirm dialog wrapper used by the assignment screens. Returns true to go ahead.
export async function confirmNotOut(orgId, dateStr, userIds) {
  const out = await techsOutOn(orgId, dateStr, userIds)
  if (!out.length) return true
  return window.confirm(`${out.join(', ')} ${out.length === 1 ? 'is' : 'are'} on approved time off on ${nice(dateStr)}.\n\nAssign anyway?`)
}

// Banner: who's out in a date range (Dispatch Station, Calendar, Dispatch Map).
export default function TimeOffNotice({ orgId, from, to, label }) {
  const [rows, setRows] = useState([])
  const f = iso(from || new Date()), t = iso(to || from || new Date())
  useEffect(() => { fetchTimeOff(orgId, f, t).then(setRows) }, [orgId, f, t])
  if (!rows.length) return null
  const today = iso(new Date())
  const people = {}
  rows.forEach((r) => {
    const k = r.employee_id
    ;(people[k] = people[k] || { name: r.full_name, spans: [] }).spans.push(r)
  })
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '9px 12px', margin: '0 0 12px', fontSize: 13.5, color: '#7C2D12' }}>
      <span aria-hidden="true" style={{ fontSize: 16 }}>🌴</span>
      <div>
        <b>{label || 'Out on approved time off'} — don't dispatch:</b>{' '}
        {Object.values(people).map((p, i) => (
          <span key={i}>
            {i > 0 && ' · '}
            <b>{p.name}</b>{' '}
            {p.spans.map((s) => (s.start_date <= today && s.end_date >= today && s.start_date === s.end_date ? 'today'
              : s.start_date === s.end_date ? nice(s.start_date) : `${nice(s.start_date)} – ${nice(s.end_date)}`)).join(', ')}
          </span>
        ))}
      </div>
    </div>
  )
}
