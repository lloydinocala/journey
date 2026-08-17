import { supabase } from './supabase'

// Resolve a user's effective permission keys.
//   Permanent: the union of every permission on every tag (job_role) they hold.
//   On-call: if RIGHT NOW falls inside a period where they're the on-call
//   supervisor or tech, the matching on-call tag's permissions are added too.
// Elevation is derived live from the schedule + current time — nothing to flip,
// so it turns on when the window opens and off when it closes, on its own.
export async function loadPermissions(userId, orgId) {
  const empty = { keys: new Set(), onCall: null }
  if (!userId || !orgId) return empty
  try {
    const roleIds = []

    const { data: ujr } = await supabase
      .from('user_job_roles')
      .select('job_role_id')
      .eq('user_id', userId)
    ;(ujr || []).forEach((r) => roleIds.push(r.job_role_id))

    // Am I on call right now?
    const nowIso = new Date().toISOString()
    const { data: oc } = await supabase
      .from('on_call_schedule')
      .select('period_end, supervisor_user_id, tech_user_id')
      .eq('org_id', orgId)
      .lte('period_start', nowIso)
      .gt('period_end', nowIso)
      .or(`supervisor_user_id.eq.${userId},tech_user_id.eq.${userId}`)
      .limit(1)

    let onCall = null
    if (oc && oc.length) {
      const period = oc[0]
      const tagName = period.supervisor_user_id === userId ? 'On-Call Supervisor' : 'On-Call Tech'
      onCall = { until: period.period_end, as: tagName }
      const { data: tag } = await supabase
        .from('job_roles')
        .select('id')
        .eq('org_id', orgId)
        .eq('name', tagName)
        .limit(1)
      if (tag && tag.length) roleIds.push(tag[0].id)
    }

    const keys = new Set()
    if (roleIds.length) {
      const { data: rp } = await supabase
        .from('role_permissions')
        .select('permission_key')
        .in('role_id', roleIds)
      ;(rp || []).forEach((r) => keys.add(r.permission_key))
    }
    return { keys, onCall }
  } catch (e) {
    return empty
  }
}

// True if the profile is allowed the given permission.
// super_admin is always allowed. Otherwise checks the resolved permission set.
// NOTE: callers keep their existing role fallbacks — this only ADDS a path,
// so a missing/empty permission set never removes access during the rollout.
export function can(profile, key) {
  if (!profile) return false
  if (profile.role === 'super_admin') return true
  const p = profile.permKeys
  return !!(p && typeof p.has === 'function' && p.has(key))
}
