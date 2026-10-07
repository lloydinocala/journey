// Feature entitlements — the ORG/plan layer that sits beside the user-permission
// layer (can(profile, ...)). A feature shows only when BOTH agree. Resolved once at
// login into profile.entitlements (an array of feature keys) via the org_entitlements
// RPC; this helper just reads that array.
//
// Fail-open is deliberate for super_admin (the platform owner sees everything) and for
// the brief window before entitlements have loaded we return false so nothing flashes.

export function hasFeature(profile, key) {
  if (!profile) return false
  if (profile.role === 'super_admin') return true // platform owner: full access
  return Array.isArray(profile.entitlements) && profile.entitlements.includes(key)
}

// Convenience for gating a whole group: true if ANY of the keys is entitled.
export function hasAnyFeature(profile, keys) {
  if (!profile) return false
  if (profile.role === 'super_admin') return true
  if (!Array.isArray(profile.entitlements)) return false
  return keys.some((k) => profile.entitlements.includes(k))
}
