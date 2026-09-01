// Warranty logic for the customer portal.
//
// Policy: parts = PARTS_YEARS from install; labor = LABOR_YEARS from install.
// When we DON'T have an install date, per Air-Care's rule: parts is ESTIMATED as
// PARTS_YEARS from the unit's manufacture year (decoded from the serial), and labor
// is shown as EXPIRED. A definitive status is only ever shown when the install date
// is actually on file — everything inferred from a serial is labeled "estimated,"
// and anything we can't decode is "verify," never a guess.
//
// Change these two if Air-Care's terms differ:
export const PARTS_YEARS = 10
export const LABOR_YEARS = 1

const thisYear = () => new Date().getFullYear()
const digitsOf = (s) => (s || '').replace(/[^0-9]/g, '')

// Turn a 2-digit year into a full year, with a plausibility window.
function fullYear(n) {
  const curYY = thisYear() % 100
  return n > curYY + 1 ? 1900 + n : 2000 + n
}
const plausible = (y) => y >= 1985 && y <= thisYear() + 1

// Decode manufacture year from a serial by brand.
// Returns { year, confidence:'high' } or null when we can't stand behind a date.
// Only brands with clean, well-documented numeric date codes are decoded; brands
// with letter-coded or inconsistent schemes (Trane, Lennox, York, Rheem, …) return
// null on purpose, so the UI says "verify" instead of showing a wrong date.
export function decodeSerialYear(brand, serial) {
  const d = digitsOf(serial)
  if (d.length < 4) return null
  const b = (brand || '').toLowerCase()
  const first2 = parseInt(d.slice(0, 2), 10)
  const next2 = parseInt(d.slice(2, 4), 10)

  // Goodman / Amana / Daikin / Janitrol: first four digits = YYMM
  if (/goodman|amana|daikin|janitrol/.test(b)) {
    const y = fullYear(first2)
    if (plausible(y) && next2 >= 1 && next2 <= 12) return { year: y, confidence: 'high' }
    return null
  }
  // Carrier family + ICP brands: first four digits = WWYY (week, year)
  if (/carrier|bryant|payne|icp|tempstar|heil|comfortmaker|arcoaire|keeprite|day\s*&?\s*night/.test(b)) {
    const y = fullYear(next2)
    if (plausible(y) && first2 >= 1 && first2 <= 53) return { year: y, confidence: 'high' }
    return null
  }
  return null
}

// Compute a component's warranty from install date (preferred) or serial (estimate).
// Returns { parts:{state,label,estimated}, labor:{state,label}, basis }.
// state ∈ 'active' | 'expired' | 'verify' — drives the pill color.
export function warrantyFor({ installDate, brand, serial }) {
  const today = new Date()

  if (installDate) {
    const inst = new Date(installDate + 'T00:00:00')
    const partsExp = new Date(inst); partsExp.setFullYear(inst.getFullYear() + PARTS_YEARS)
    const laborExp = new Date(inst); laborExp.setFullYear(inst.getFullYear() + LABOR_YEARS)
    const pActive = today <= partsExp, lActive = today <= laborExp
    return {
      parts: { state: pActive ? 'active' : 'expired', label: pActive ? `Parts to ${partsExp.getFullYear()}` : 'Parts expired', estimated: false },
      labor: { state: lActive ? 'active' : 'expired', label: lActive ? `Labor to ${laborExp.getFullYear()}` : 'Labor expired' },
      basis: 'install',
    }
  }

  // No install date on file.
  const dec = decodeSerialYear(brand, serial)
  if (dec) {
    const endYear = dec.year + PARTS_YEARS
    const pActive = today <= new Date(endYear, 11, 31)
    return {
      parts: { state: pActive ? 'active' : 'expired', label: `Parts ${pActive ? 'to' : 'expired'} ${endYear} · est.`, estimated: true },
      labor: { state: 'expired', label: 'Labor EXPIRED' },
      basis: 'serial',
    }
  }
  return {
    parts: { state: 'verify', label: 'Parts — verify', estimated: true },
    labor: { state: 'expired', label: 'Labor EXPIRED' },
    basis: 'unknown',
  }
}
