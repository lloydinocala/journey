// Required employee documents — federal, plus state lists picked by the employee's work
// state. Florida is complete; other states add an entry here (data only, no code changes).
// how: 'upload' (scan a signed paper/PDF form) · 'sign' (employee signs in My Records) ·
//      'ack' (employee acknowledges a company document) · 'record' (office records a fact)
export const FEDERAL_DOCS = [
  { key: 'i9', label: 'Form I-9 — Employment Eligibility Verification', how: 'upload', required: true,
    note: 'Employee completes Section 1 by their first day; you inspect their original ID documents and complete Section 2 within 3 business days. Use the official USCIS form, then upload the signed copy and record the inspection here.',
    link: 'https://www.uscis.gov/i-9' },
  { key: 'w4', label: 'Form W-4 — Federal tax withholding', how: 'sign', required: true,
    note: 'Signed electronically in My Records with the IRS perjury statement and an audit trail. Updates the payroll tax profile automatically.' },
  { key: 'handbook', label: 'Employee handbook acknowledgment', how: 'ack', ackKind: 'handbook', required: true,
    note: 'Upload your handbook under "Policies to sign"; each employee acknowledges it in My Records.' },
  { key: 'policy', label: 'Company policy acknowledgments', how: 'ack', ackKind: 'policy', required: true,
    note: 'Safety, vehicle, phone, drug-free workplace and other policies you publish under "Policies to sign".' },
  { key: 'direct_deposit', label: 'Direct deposit authorization', how: 'ack', ackKind: 'direct_deposit', required: false,
    note: 'Optional for the employee. Bank numbers are entered by the office in the secure (encrypted) fields on Employees.' },
  { key: 'nda', label: 'Confidentiality / non-disclosure agreement', how: 'ack', ackKind: 'nda', required: false,
    note: 'Only if your company uses one.' },
]

export const STATE_DOCS = {
  FL: {
    name: 'Florida',
    notes: 'Florida has no state income tax, so there is no state withholding form.',
    docs: [
      { key: 'everify', label: 'E-Verify case result', how: 'record', field: 'e_verify_case', minEmployees: 25,
        note: 'Florida private employers with 25 or more employees must run new hires through E-Verify (Fla. Stat. 448.095) within 3 business days of the start date. Record the case number and keep the result with the I-9. Recommended even below 25.' },
      { key: 'fl_new_hire', label: 'Florida New Hire Report filed', how: 'record', field: 'fl_new_hire_reported_on', required: true, dueDays: 20,
        note: 'Report every new hire to the Florida New Hire Reporting Center within 20 days of the hire date (online at servicesforemployers.floridarevenue.com). Record the date you filed.' },
    ],
  },
}

export const STATES = Object.entries(STATE_DOCS).map(([code, s]) => ({ code, name: s.name }))

export function requiredDocsFor(state) {
  return [...FEDERAL_DOCS.map((d) => ({ ...d, scope: 'Federal' })), ...((STATE_DOCS[state]?.docs || []).map((d) => ({ ...d, scope: STATE_DOCS[state].name })))]
}

// Document categories for the Documents list (and retention rules computed in the database).
export const DOC_CATEGORIES = [
  { key: 'i9', label: 'Form I-9', rule: 'Keep 3 years after separation (law: later of 3 yrs from hire or 1 yr after separation)' },
  { key: 'w4', label: 'Form W-4', rule: 'Keep 4 years after separation (IRS employment-tax records)' },
  { key: 'personnel', label: 'Personnel record', rule: 'Keep 3 years after separation (law: 1 year)' },
  { key: 'application', label: 'Application / resume', rule: 'Keep 3 years after separation; rejected applicants 1 year' },
  { key: 'payroll', label: 'Payroll record', rule: 'Keep 3 years (FLSA)' },
  { key: 'tax', label: 'Tax filing', rule: 'Keep 4 years (IRS)' },
  { key: 'certified_payroll', label: 'Certified payroll', rule: 'Keep 3 years (Davis-Bacon)' },
  { key: 'medical', label: 'Medical / leave (confidential)', rule: 'Separate confidential file — never shown to others or in the Employee File. Keep 3 years after separation (FMLA).' },
  { key: 'benefits', label: 'Benefits plan', rule: 'Keep while the plan is active plus 1 year — never deleted automatically' },
  { key: 'policy', label: 'Policy / handbook', rule: 'Kept — never deleted automatically' },
  { key: 'other', label: 'Other', rule: 'Keep 3 years after separation' },
]
export const catLabel = (k) => (DOC_CATEGORIES.find((c) => c.key === k) || {}).label || k
