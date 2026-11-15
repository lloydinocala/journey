// The customer app is shared by every Journey company, so it never shows a fixed name.
// After sign-in it shows the customer's OWN contractor (from get_my_org_branding).

const SUFFIX = /[,\s]+(l\.?l\.?c\.?|inc\.?|incorporated|corp\.?|corporation|ltd\.?|co\.?)$/i

// "Air-Care Connect LLC" -> "Air-Care Connect"
export function displayBrandName(name) {
  let n = String(name || '').trim()
  for (let i = 0; i < 2 && SUFFIX.test(n); i++) n = n.replace(SUFFIX, '').trim()
  return n
}

const KEY = 'cp_brand'

export function rememberBrand(org) {
  try {
    if (!org?.name) return
    localStorage.setItem(KEY, JSON.stringify({ name: displayBrandName(org.name), logo: org.logo_url || null, color: org.brand_primary_color || null }))
  } catch (_) { /* storage unavailable */ }
}

export function savedBrand() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null') } catch (_) { return null }
}
