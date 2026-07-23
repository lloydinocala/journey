// Rewards-HVAC · Federal tax engine (R2)
// Effective-dated federal withholding (IRS Pub 15-T, Percentage Method for
// Automated Payroll Systems, Worksheet 1A), FICA, and FUTA. Florida has no state
// income tax, so a Florida org needs federal only. State/local withholding is a
// later phase (a config table or a rented tax-calc engine).
//
// SOURCES (verify each year against the IRS release):
//  - Pub 15-T (2026): https://www.irs.gov/pub/irs-pdf/p15t.pdf  (MFJ standard schedule
//    below was taken verbatim; Single & HoH derived from 2026 brackets + standard
//    deductions and cross-checked against the published base amounts.)
//  - SS wage base / rates: SSA + IRS 2026.
//
// NOTE (v1 scope): implements the STANDARD Withholding Rate Schedules (Form W-4
// Step 2 checkbox NOT checked) — the common case. Step-2-checkbox schedules are a
// documented TODO; callers get a flag when step2Checked is set.

// ---- Effective-dated federal parameters ------------------------------------
export const FED_PARAMS = {
  2026: {
    ssWageBase: 184500,
    ssRate: 0.062,
    medicareRate: 0.0145,
    addlMedicareRate: 0.009,
    addlMedicareThreshold: 200000, // employer withholding trigger (YTD wages)
    futaRate: 0.006,               // net rate after full state credit
    futaWageBase: 7000,
    // Worksheet 1A Step 1g (standard deduction adjustment; Step 2 box not checked)
    step1g: { mfj: 12900, single: 8600, hoh: 8600 },
  },
}

export const PERIODS_PER_YEAR = {
  weekly: 52,
  biweekly: 26,
  semimonthly: 24,
  monthly: 12,
}

// ---- 2026 Standard Withholding Rate Schedules (annual, adjusted wage) -------
// Each row: [atLeast, base, rate, over]. Withholding = base + rate*(adjWage - over)
// for the row where atLeast <= adjWage < nextRow.atLeast.
const SCHED_2026 = {
  mfj: [
    [0, 0, 0, 0],
    [19300, 0, 0.10, 19300],
    [44100, 2480.0, 0.12, 44100],
    [120100, 11600.0, 0.22, 120100],
    [230700, 35932.0, 0.24, 230700],
    [422850, 82048.0, 0.32, 422850],
    [531750, 116896.0, 0.35, 531750],
    [788000, 206583.5, 0.37, 788000],
  ],
  single: [
    [0, 0, 0, 0],
    [7500, 0, 0.10, 7500],
    [19900, 1240.0, 0.12, 19900],
    [57900, 5800.0, 0.22, 57900],
    [113200, 17966.0, 0.24, 113200],
    [209275, 41024.0, 0.32, 209275],
    [263725, 58448.0, 0.35, 263725],
    [648100, 192979.25, 0.37, 648100],
  ],
  hoh: [
    [0, 0, 0, 0],
    [15550, 0, 0.10, 15550],
    [33250, 1770.0, 0.12, 33250],
    [83000, 7740.0, 0.22, 83000],
    [121250, 16155.0, 0.24, 121250],
    [217325, 39213.0, 0.32, 217325],
    [271750, 56629.0, 0.35, 271750],
    [656150, 191169.0, 0.37, 656150],
  ],
}

const SCHEDULES = { 2026: SCHED_2026 }

function normalizeStatus(s) {
  if (s === 'married' || s === 'mfj') return 'mfj'
  if (s === 'hoh' || s === 'head_of_household') return 'hoh'
  return 'single' // single, married-filing-separately, or unset all use the single schedule
}

function annualTax(adjWage, statusKey, year) {
  const sched = (SCHEDULES[year] || SCHEDULES[2026])[statusKey]
  let row = sched[0]
  for (const r of sched) { if (adjWage >= r[0]) row = r; else break }
  return Math.max(0, row[1] + row[2] * (adjWage - row[3]))
}

// ---- Federal income tax withholding (Worksheet 1A) -------------------------
// opts: { gross, frequency, filingStatus, step2Checked, otherIncomeAnnual,
//         deductionsAnnual, extraPerPeriod }
export function computeFederalWithholding(opts) {
  const year = opts.year || 2026
  const p = FED_PARAMS[year] || FED_PARAMS[2026]
  const periods = PERIODS_PER_YEAR[opts.frequency] || 52
  const statusKey = normalizeStatus(opts.filingStatus)

  const gross = Number(opts.gross) || 0
  const annualized = gross * periods                             // 1c
  const withOther = annualized + (Number(opts.otherIncomeAnnual) || 0) // 1e
  const step1g = opts.step2Checked ? 0 : p.step1g[statusKey]
  const adjWage = Math.max(0, withOther - (Number(opts.deductionsAnnual) || 0) - step1g) // adjusted annual wage

  const annual = annualTax(adjWage, statusKey, year)
  let perPeriod = annual / periods
  perPeriod += Number(opts.extraPerPeriod) || 0                  // Step 4(c) extra
  const step2Unsupported = !!opts.step2Checked
  return { amount: round2(Math.max(0, perPeriod)), step2Unsupported }
}

// ---- FICA (Social Security + Medicare + Additional Medicare) ---------------
// ytdBefore = employee's YTD gross BEFORE this check (for wage-base caps).
export function computeFICA(gross, ytdBefore, year = 2026) {
  const p = FED_PARAMS[year] || FED_PARAMS[2026]
  gross = Number(gross) || 0
  ytdBefore = Number(ytdBefore) || 0

  const ssRemaining = Math.max(0, p.ssWageBase - ytdBefore)
  const ssWages = Math.min(gross, ssRemaining)
  const ssEmployee = round2(ssWages * p.ssRate)
  const ssEmployer = ssEmployee

  const medicareEmployee = round2(gross * p.medicareRate)
  const medicareEmployer = medicareEmployee

  // Additional Medicare: extra 0.9% on wages above $200k YTD (employee only).
  const overBefore = Math.max(0, ytdBefore - p.addlMedicareThreshold)
  const overAfter = Math.max(0, ytdBefore + gross - p.addlMedicareThreshold)
  const addlWages = Math.max(0, overAfter - overBefore)
  const addlMedicare = round2(addlWages * p.addlMedicareRate)

  return { ssEmployee, ssEmployer, medicareEmployee, medicareEmployer, addlMedicare }
}

// ---- FUTA (employer only, first $7,000 of wages) ---------------------------
export function computeFUTA(gross, ytdBefore, year = 2026) {
  const p = FED_PARAMS[year] || FED_PARAMS[2026]
  const remaining = Math.max(0, p.futaWageBase - (Number(ytdBefore) || 0))
  const taxable = Math.min(Number(gross) || 0, remaining)
  return round2(taxable * p.futaRate)
}

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100 }
