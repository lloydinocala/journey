// Warranty logic — single source of truth (office app + customer portal).
//
// Air-Care policy (Florida): the residential PARTS warranty is honored for 10
// years from the unit's MANUFACTURE date, to ANY owner (including subsequent
// owners), regardless of registration — established from the serial number.
// LABOR is 1 year and REFRIGERANT (freon) is covered the first year only; both
// are install-based, so until install-date handling lands they show their term
// rather than a hard date.
//
// Manufacture year comes from a confirmed manufacture_year on the record when
// present, otherwise it is decoded from the serial. Brands whose serial does not
// encode the date (Trane / American Standard / Oxbox) are flagged for nameplate
// lookup, never guessed.
//
// Adjust these if Air-Care's terms change:
export const PARTS_YEARS = 10
export const LABOR_YEARS = 1
export const FREON_YEARS = 1

const thisYear = () => new Date().getFullYear()
const digitsOf = (s) => (s || '').replace(/[^0-9]/g, '')

// 2-digit year -> full year within a plausible window.
function fullYear(n) {
  const curYY = thisYear() % 100
  return n > curYY + 1 ? 1900 + n : 2000 + n
}
const plausible = (y) => y >= 1985 && y <= thisYear() + 1

const TRANE_FAMILY = /trane|american\s*standard|oxbox/

// Decode manufacture info from a serial by brand.
// Returns { year, method, note, confidence }:
//   year: number | null
//   method: 'YYMM' | 'WWYY' | 'nameplate' | 'unknown'
// Only brands with clean numeric date codes are decoded; everything else returns
// a null year with an explanatory note, so the UI says "verify" rather than
// showing a wrong date.
export function decodeSerial(brand, serial) {
  const b = (brand || '').toLowerCase()
  const d = digitsOf(serial)

  // Trane / American Standard / Oxbox: the date is NOT in the serial.
  if (TRANE_FAMILY.test(b)) {
    return {
      year: null, method: 'nameplate', confidence: null,
      note: "Trane / American Standard / Oxbox don't put the date in the serial — read the manufacture date off the unit's nameplate and enter it as the manufacture year.",
    }
  }

  if (d.length >= 4) {
    const first2 = parseInt(d.slice(0, 2), 10)
    const next2 = parseInt(d.slice(2, 4), 10)

    // Method 1 — Goodman / Amana / Daikin / Janitrol: YYMM (year first).
    if (/goodman|amana|daikin|janitrol/.test(b)) {
      const y = fullYear(first2)
      if (plausible(y) && next2 >= 1 && next2 <= 12) return { year: y, method: 'YYMM', confidence: 'high', note: null }
    }
    // Method 2 — Carrier family + ICP brands: WWYY (week first, year second).
    if (/carrier|bryant|payne|icp|tempstar|heil|comfortmaker|arcoaire|keeprite|day\s*&?\s*night/.test(b)) {
      const y = fullYear(next2)
      if (plausible(y) && first2 >= 1 && first2 <= 53) return { year: y, method: 'WWYY', confidence: 'high', note: null }
    }
  }

  return {
    year: null, method: 'unknown', confidence: null,
    note: 'Serial format not recognized for this brand — confirm the manufacture year from the nameplate.',
  }
}

// Back-compat: callers that only want the year (or null).
export function decodeSerialYear(brand, serial) {
  const r = decodeSerial(brand, serial)
  return r.year ? { year: r.year, confidence: r.confidence || 'high' } : null
}

// Resolve the manufacture year for a component: a confirmed manufacture_year wins,
// otherwise the serial decode. Returns { year, source, method, note } with
// source in 'confirmed' | 'serial' | 'none'.
export function manufactureYearFor({ manufactureYear, brand, serial }) {
  const my = manufactureYear != null && manufactureYear !== '' ? parseInt(manufactureYear, 10) : null
  if (my && plausible(my)) return { year: my, source: 'confirmed', method: 'confirmed', note: null }
  const dec = decodeSerial(brand, serial)
  if (dec.year) return { year: dec.year, source: 'serial', method: dec.method, note: dec.note }
  return { year: null, source: 'none', method: dec.method, note: dec.note }
}

// Compute warranty for one component/system.
//
// If WE installed it (install date on file), everything runs from the install
// date: parts 10 yr, labor 1 yr, refrigerant 1 yr.
//
// If there is NO install date, we did not install it: the manufacturer PARTS
// warranty runs 10 yr from the MANUFACTURE date (serial / confirmed year), honored
// to any owner — and labor + refrigerant are EXPIRED (they only ever run from an
// install we performed).
//
// Returns { manufactureYear, manufactureSource, parts, labor, freon, basis, note }.
// state in 'active' | 'expired' | 'verify' drives the pill color.
export function warrantyFor({ manufactureYear, installDate, brand, serial }) {
  const today = new Date()
  const my = manufactureYearFor({ manufactureYear, brand, serial })

  // Installed by us → parts / labor / refrigerant all run from the install date.
  if (installDate) {
    const inst = new Date(installDate + 'T00:00:00')
    const partsExp = new Date(inst); partsExp.setFullYear(inst.getFullYear() + PARTS_YEARS)
    const laborExp = new Date(inst); laborExp.setFullYear(inst.getFullYear() + LABOR_YEARS)
    const freonExp = new Date(inst); freonExp.setFullYear(inst.getFullYear() + FREON_YEARS)
    const pAct = today <= partsExp, lAct = today <= laborExp, fAct = today <= freonExp
    return {
      manufactureYear: my.year, manufactureSource: my.source,
      parts: { state: pAct ? 'active' : 'expired', label: pAct ? `Parts through ${partsExp.getFullYear()}` : 'Parts expired', endYear: partsExp.getFullYear() },
      labor: { state: lAct ? 'active' : 'expired', label: lAct ? `Labor through ${laborExp.getFullYear()}` : 'Labor expired' },
      freon: { state: fAct ? 'active' : 'expired', label: fAct ? `Refrigerant through ${freonExp.getFullYear()}` : 'Refrigerant expired' },
      basis: 'install', note: my.note,
    }
  }

  // Not installed by us → manufacturer parts warranty from the manufacture date;
  // labor + refrigerant EXPIRED.
  let parts
  if (my.year) {
    const endYear = my.year + PARTS_YEARS
    const active = today <= new Date(endYear, 11, 31)
    parts = { state: active ? 'active' : 'expired', label: `Parts ${active ? 'through' : 'expired'} ${endYear}`, endYear }
  } else {
    parts = { state: 'verify', label: 'Parts — verify manufacture year', endYear: null }
  }
  return {
    manufactureYear: my.year, manufactureSource: my.source,
    parts,
    labor: { state: 'expired', label: 'Labor EXPIRED' },
    freon: { state: 'expired', label: 'Refrigerant EXPIRED' },
    basis: my.year ? 'manufacture' : 'unknown', note: my.note,
  }
}
