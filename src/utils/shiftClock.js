import { supabase } from './supabase'

// Shared helpers for the SHIFT clock (the legal/payroll clock — CLOCK IN/OUT),
// so the Job Details wrap-up router, the Standby screen, and Settings can all
// act on the open shift without each re-implementing the queries. This is the
// same model ClockWidget uses: one open shift = a time_clock_events row with
// clock_out null; a lunch = a clock_breaks row nested in that shift.
//
// IMPORTANT: the shift clock runs CONTINUOUSLY through gaps between jobs.
// Drive/wait time is compensable — nothing here clocks a tech out between jobs.
// Only clockOut() (end of day / leaving early) or a bona-fide meal break pauses
// paid time. Every mutation fires 'clock-changed' so any mounted ClockWidget
// refreshes.

function fireChanged() {
  try { window.dispatchEvent(new Event('clock-changed')) } catch { /* non-browser */ }
}

// Latest open shift for a user, or null.
export async function getOpenShift(userId) {
  if (!userId) return null
  const { data } = await supabase
    .from('time_clock_events')
    .select('id, org_id, user_id, clock_in')
    .eq('user_id', userId)
    .is('clock_out', null)
    .order('clock_in', { ascending: false })
    .limit(1)
  return data && data.length ? data[0] : null
}

// Open (unfinished) break for a shift, or null.
export async function getOpenBreak(shiftId) {
  if (!shiftId) return null
  const { data } = await supabase
    .from('clock_breaks')
    .select('id, break_start')
    .eq('clock_event_id', shiftId)
    .is('break_end', null)
    .limit(1)
  return data && data.length ? data[0] : null
}

// Close the shift. endKind: 'last_job' | 'early_leave' | 'manual' | 'auto'.
// endReason is optional free text (captured when a tech leaves early).
// Any open lunch is closed first so we never leave a dangling break.
export async function clockOut(shiftId, { endKind = 'manual', endReason = null } = {}) {
  if (!shiftId) return { error: new Error('No open shift') }
  const now = new Date().toISOString()
  await supabase.from('clock_breaks')
    .update({ break_end: now })
    .eq('clock_event_id', shiftId)
    .is('break_end', null)
  const { error } = await supabase.from('time_clock_events')
    .update({ clock_out: now, end_kind: endKind, end_reason: endReason })
    .eq('id', shiftId)
  if (!error) {
    try { localStorage.removeItem('tech_standby_note') } catch { /* ignore */ }
    fireChanged()
  }
  return { error }
}

// Start an unpaid lunch break nested in the shift (paid clock pauses).
export async function startLunch(shiftId, orgId) {
  if (!shiftId || !orgId) return { error: new Error('No open shift') }
  const { error } = await supabase.from('clock_breaks').insert({
    org_id: orgId,
    clock_event_id: shiftId,
    break_start: new Date().toISOString(),
    is_paid: false,
  })
  if (!error) fireChanged()
  return { error }
}

// End the current open lunch (paid clock resumes).
export async function endLunch(breakId) {
  if (!breakId) return { error: new Error('No open break') }
  const { error } = await supabase.from('clock_breaks')
    .update({ break_end: new Date().toISOString() })
    .eq('id', breakId)
  if (!error) fireChanged()
  return { error }
}
