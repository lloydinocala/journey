// Warranty logic — single source of truth (office app + customer portal).
//
// Air-Care policy (Florida): the residential PARTS warranty is honored for 10
// years from the unit's MANUFACTURE date, to ANY owner (including subsequent
// owners), regardless of registration — established from the serial number.
// LABOR is 1 year and REFRIGERANT (freon) is covered the first year only; both
// are install-based.
//
// If WE installed it (install date on file) everything runs from the install
// date. Otherwise the manufacturer parts warranty runs from the manufacture date
// and labor/refrigerant are EXPIRED.
//
// LEGAL NOTE: warranty is measured to the MONTH, not the year. A Goodman serial
// 2409 (YYMM) is Sept 2024, so parts expire Sept 2034 — NOT "through 2034."
// Showing a bare year overstates coverage by up to ~11 months, so every date we
// display carries its month. When only a year is known (a confirmed year with no
// month), we take the conservative earliest boundary and never overstate.
//
// Manufacture date comes from a confirmed manufacture_year (+ optional
// manufacture_month) on the record when present, otherwise it is decoded from the
// serial. Trane / American Standard / Oxbox don't encode the date in the serial
// and are flagged for nameplate lookup, never guessed.
//
// Adjust these if Air-Care's terms change:
export const PARTS_YEARS = 10
export const LABOR_YEARS = 1
export const FREON_YEARS = 1

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monLabel = (d) => `${MON[d.getMonth()]} ${d.getFullYear()}`

const thisYear = () => new Date().getFullYear()
const digitsOf = (s) => (s || '').replace(/[^0-9]/g, '')

// 2-digit year -> full year within a plausible window.
function fullYear(n) {
  const curYY = thisYear() % 100
  return n > curYY + 1 ? 1900 + n : 2000 + n
}
const plausibleYear = (y) => y >= 1985 && y <= thisYear() + 1

// Convert a 1-53 week number in a given year to its calendar month (1-12).
function monthFromWeek(year, week) {
  const doy = (week - 1) * 7 + 1
  return new Date(year, 0, doy).getMonth() + 1
}

const TRANE_FAMILY = /trane|american\s*standard|oxbox/

// Decode manufacture info from a serial by brand.
// Returns { year, month, week, method, note, confidence }:
//   year/month: numbers (month 1-12) | null
//   method: 'YYMM' | 'WWYY' | 'nameplate' | 'unknown'
// Only brands with clean numeric date codes are decoded; everything else returns
// a null year with an explanatory note, so the UI says "verify" rather than
// showing a wrong date.
export function decodeSerial(brand, serial) {
  const b = (brand || '').toLowerCase()
  const d = digitsOf(serial)

  if (TRANE_FAMILY.test(b)) {
    return {
      year: null, month: null, week: null, method: 'nameplate', confidence: null,
      note: "Trane / American Standard / Oxbox don't put the date in the serial — read the manufacture month & year off the unit's nameplate and enter them.",
    }
  }

  if (d.length >= 4) {
    const first2 = parseInt(d.slice(0, 2), 10)
    const next2 = parseInt(d.slice(2, 4), 10)

    // Method 1 — Goodman / Amana / Daikin / Janitrol: YYMM (year, then month).
    if (/goodman|amana|daikin|janitrol/.test(b)) {
      const y = fullYear(first2)
      if (plausibleYear(y) && next2 >= 1 && next2 <= 12) {
        return { year: y, month: next2, week: null, method: 'YYMM', confidence: 'high', note: null }
      }
    }
    // Method 2 — Carrier family + ICP brands: WWYY (week, then year).
    if (/carrier|bryant|payne|icp|tempstar|heil|comfortmaker|arcoaire|keeprite|day\s*&?\s*night/.test(b)) {
      const y = fullYear(next2)
      if (plausibleYear(y) && first2 >= 1 && first2 <= 53) {
        return { year: y, month: monthFromWeek(y, first2), week: first2, method: 'WWYY', confidence: 'high', note: null }
      }
    }
  }

  return {
    year: null, month: null, week: null, method: 'unknown', confidence: null,
    note: 'Serial format not recognized for this brand — confirm the manufacture month & year from the nameplate.',
  }
}

// Back-compat: callers that only want the year (or null).
export function decodeSerialYear(brand, serial) {
  const r = decodeSerial(brand, serial)
  return r.year ? { year: r.year, confidence: r.confidence || 'high' } : null
}

// Resolve manufacture date: a confirmed year (+ optional month) wins, else the
// serial decode. Returns { year, month, source, method, note }; month may be null.
export function manufactureDateFor({ manufactureYear, manufactureMonth, brand, serial }) {
  const my = manufactureYear != null && manufactureYear !== '' ? parseInt(manufactureYear, 10) : null
  if (my && plausibleYear(my)) {
    const mm = manufactureMonth != null && manufactureMonth !== '' ? parseInt(manufactureMonth, 10) : null
    return { year: my, month: mm && mm >= 1 && mm <= 12 ? mm : null, source: 'confirmed', method: 'confirmed', note: null }
  }
  const dec = decodeSerial(brand, serial)
  if (dec.year) return { year: dec.year, month: dec.month, source: 'serial', method: dec.method, note: dec.note }
  return { year: null, month: null, source: 'none', method: dec.method, note: dec.note }
}

// Back-compat name.
export const manufactureYearFor = manufactureDateFor

// Compute warranty for one component/system, to MONTH precision.
// Returns { manufactureYear, manufactureMonth, manufactureSource, parts, labor, freon, basis, note }.
// state in 'active' | 'expired' | 'verify' drives the pill color.
export function warrantyFor({ manufactureYear, manufactureMonth, installDate, brand, serial }) {
  const today = new Date()
  const md = manufactureDateFor({ manufactureYear, manufactureMonth, brand, serial })
  const common = { manufactureYear: md.year, manufactureMonth: md.month, manufactureSource: md.source, note: md.note }

  // Installed by us → parts / labor / refrigerant all run from the install date.
  if (installDate) {
    const inst = new Date(installDate + 'T00:00:00')
    const partsExp = new Date(inst); partsExp.setFullYear(inst.getFullYear() + PARTS_YEARS)
    const laborExp = new Date(inst); laborExp.setFullYear(inst.getFullYear() + LABOR_YEARS)
    const freonExp = new Date(inst); freonExp.setFullYear(inst.getFullYear() + FREON_YEARS)
    const pAct = today < partsExp, lAct = today < laborExp, fAct = today < freonExp
    return {
      ...common,
      parts: { state: pAct ? 'active' : 'expired', label: `Parts ${pAct ? 'expire' : 'expired'} ${monLabel(partsExp)}`, endYear: partsExp.getFullYear(), endMonth: partsExp.getMonth() + 1 },
      labor: { state: lAct ? 'active' : 'expired', label: lAct ? `Labor through ${monLabel(laborExp)}` : 'Labor expired' },
      freon: { state: fAct ? 'active' : 'expired', label: fAct ? `Refrigerant through ${monLabel(freonExp)}` : 'Refrigerant expired' },
      basis: 'install',
    }
  }

  // Not installed by us → manufacturer parts warranty from the manufacture date;
  // labor + refrigerant EXPIRED.
  let parts
  if (md.year && md.month) {
    const partsExp = new Date(md.year + PARTS_YEARS, md.month - 1, 1)
    const active = today < partsExp
    parts = { state: active ? 'active' : 'expired', label: `Parts ${active ? 'expire' : 'expired'} ${MON[md.month - 1]} ${md.year + PARTS_YEARS}`, endYear: md.year + PARTS_YEARS, endMonth: md.month }
  } else if (md.year) {
    // Year only (no month) — take the conservative earliest boundary; never overstate.
    const endYear = md.year + PARTS_YEARS
    const active = today < new Date(endYear, 0, 1)
    parts = { state: active ? 'active' : 'expired', label: `Parts ${active ? 'expire' : 'expired'} early ${endYear} — verify month`, endYear, endMonth: null }
  } else {
    parts = { state: 'verify', label: 'Parts — verify manufacture date', endYear: null, endMonth: null }
  }
  return {
    ...common,
    parts,
    labor: { state: 'expired', label: 'Labor EXPIRED' },
    freon: { state: 'expired', label: 'Refrigerant EXPIRED' },
    basis: md.year ? 'manufacture' : 'unknown',
  }
}
