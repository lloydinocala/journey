// Central timezone layer for the whole app.
//
// Times are stored as absolute UTC instants (timestamptz). What varies is the
// zone we DISPLAY them in and the zone we INTERPRET typed-in date+time as. That
// zone is the subscriber ORGANIZATION's operating timezone (organizations.timezone),
// NOT the viewer's device zone — so a Texas company's 2:00 PM job reads as 2:00 PM
// to the Texas tech, to a Florida super-admin looking over their shoulder, and to
// anyone else, all at once.
//
// Usage: call loadOrgTz(orgId) whenever an org context is established (app load,
// super-admin org switch). The format/parse helpers then default to that zone.
// They all accept an explicit tz to override when a specific org's zone is known.

import { supabase } from './supabase'

const DEFAULT_TZ = 'America/New_York'

let activeTz = null

export function browserTz() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TZ
  } catch {
    return DEFAULT_TZ
  }
}

export function setActiveOrgTz(tz) {
  activeTz = tz || null
}

// The zone to use when a caller doesn't pass one. Falls back to the device zone
// only if no org zone has been loaded yet (keeps behavior sane pre-login).
export function getActiveOrgTz() {
  return activeTz || browserTz()
}

// Fetch an org's stored timezone and cache it as the active zone. Returns it.
export async function loadOrgTz(orgId) {
  if (!orgId) {
    setActiveOrgTz(null)
    return getActiveOrgTz()
  }
  const { data } = await supabase
    .from('organizations')
    .select('timezone')
    .eq('id', orgId)
    .maybeSingle()
  setActiveOrgTz(data?.timezone || null)
  return getActiveOrgTz()
}

// Offset (in minutes) of a zone at a specific UTC instant. DST-aware because it
// asks Intl what the local wall-clock is at that instant.
function tzOffsetMinutes(date, tz) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const p = {}
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  return (asUTC - date.getTime()) / 60000
}

// A typed-in wall-clock date ('YYYY-MM-DD') + time ('HH:MM') interpreted AS the
// given zone, returned as a UTC ISO string. Inverse of utcToZonedInputs.
export function zonedToUtcIso(dateStr, timeStr, tz = getActiveOrgTz()) {
  if (!dateStr || !timeStr) return null
  const naive = new Date(`${dateStr}T${timeStr}:00Z`)
  if (isNaN(naive)) return null
  const off1 = tzOffsetMinutes(naive, tz)
  let utc = new Date(naive.getTime() - off1 * 60000)
  // Re-check at the candidate instant to handle DST boundary shifts.
  const off2 = tzOffsetMinutes(utc, tz)
  if (off2 !== off1) utc = new Date(naive.getTime() - off2 * 60000)
  return utc.toISOString()
}

// A stored UTC instant broken into { date, time } strings in the given zone, for
// pre-filling edit forms. Inverse of zonedToUtcIso.
export function utcToZonedInputs(ts, tz = getActiveOrgTz()) {
  if (!ts) return { date: '', time: '' }
  const d = new Date(ts)
  if (isNaN(d)) return { date: '', time: '' }
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
  const p = {}
  for (const part of dtf.formatToParts(d)) p[part.type] = part.value
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` }
}

// "2:30 PM" in the org zone.
export function formatTimeInZone(ts, tz = getActiveOrgTz()) {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d)) return ''
  return d.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' })
}

// "Wed, Aug 3, 2:30 PM" (or custom opts) in the org zone.
export function formatDateTimeInZone(ts, tz = getActiveOrgTz(), opts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d)) return ''
  return d.toLocaleString('en-US', {
    timeZone: tz,
    ...(opts || { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
  })
}

// A short human label for a zone, e.g. "Central Time" — used in Settings.
export function tzShortLabel(tz) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'long' }).formatToParts(new Date())
    const name = parts.find((p) => p.type === 'timeZoneName')?.value
    return name || tz
  } catch {
    return tz
  }
}
