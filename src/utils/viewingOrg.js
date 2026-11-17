// The super-admin "Viewing organization" choice (set by OrgPicker) is remembered in this browser,
// so every screen opens on the company you last picked instead of snapping back to the first one.
// Regular users always have their own org_id, so this only ever matters for super admins.
const STORE_KEY = 'journey_viewing_org'

export function viewingOrg() {
  try { return localStorage.getItem(STORE_KEY) || '' } catch (e) { return '' }
}
export function setViewingOrg(id) {
  try { if (id) localStorage.setItem(STORE_KEY, id) } catch (e) { /* storage blocked */ }
}
