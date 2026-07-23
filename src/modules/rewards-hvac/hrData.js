// Rewards-HVAC · HR data layer (R1)
// Org-scoped, RLS-gated. The core `employees`/`users` tables are shared Journey
// records; Rewards owns every rewards_* table and extends employees 1:1 via
// rewards_employee_hr. No payroll math here — that arrives in R2.
import { supabase } from '../../utils/supabase'

// ---- Settings --------------------------------------------------------------
export async function getSettings(orgId) {
  const { data } = await supabase.from('rewards_settings').select('*').eq('org_id', orgId).maybeSingle()
  return data || null
}

export async function upsertSettings(orgId, patch) {
  return supabase
    .from('rewards_settings')
    .upsert({ org_id: orgId, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'org_id' })
    .select()
    .single()
}

// ---- Users (identity) & Employees (HR master) ------------------------------
export async function listUsers(orgId) {
  const { data } = await supabase
    .from('users')
    .select('id, full_name, role, is_active')
    .eq('org_id', orgId)
    .order('full_name')
  return data || []
}

export async function listEmployees(orgId, { includeInactive = false } = {}) {
  let q = supabase.from('employees').select('*').eq('org_id', orgId).order('full_name')
  if (!includeInactive) q = q.eq('is_active', true)
  const { data } = await q
  return data || []
}

export async function addEmployee(orgId, row) {
  return supabase.from('employees').insert({ org_id: orgId, ...row }).select().single()
}

export async function updateEmployee(id, patch) {
  return supabase.from('employees').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
}

// ---- Employee HR detail (1:1 side-table) -----------------------------------
export async function getEmployeeHr(orgId, employeeId) {
  const { data } = await supabase
    .from('rewards_employee_hr')
    .select('*')
    .eq('org_id', orgId)
    .eq('employee_id', employeeId)
    .maybeSingle()
  return data || null
}

export async function upsertEmployeeHr(orgId, employeeId, patch) {
  return supabase
    .from('rewards_employee_hr')
    .upsert(
      { org_id: orgId, employee_id: employeeId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: 'employee_id' }
    )
    .select()
    .single()
}

// ---- Job descriptions ------------------------------------------------------
export async function listJobDescriptions(orgId, { includeInactive = false } = {}) {
  let q = supabase.from('rewards_job_descriptions').select('*').eq('org_id', orgId).order('title')
  if (!includeInactive) q = q.eq('is_active', true)
  const { data } = await q
  return data || []
}
export async function addJobDescription(orgId, row) {
  return supabase.from('rewards_job_descriptions').insert({ org_id: orgId, ...row }).select().single()
}
export async function updateJobDescription(id, patch) {
  return supabase.from('rewards_job_descriptions').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
}

// ---- Applicants (hiring pipeline) ------------------------------------------
export const HIRING_STAGES = ['applied', 'screen', 'interview', 'offer', 'hired', 'rejected']

export async function listApplicants(orgId) {
  const { data } = await supabase
    .from('rewards_applicants')
    .select('*')
    .eq('org_id', orgId)
    .order('applied_at', { ascending: false })
  return data || []
}
export async function addApplicant(orgId, row) {
  return supabase.from('rewards_applicants').insert({ org_id: orgId, ...row }).select().single()
}
export async function updateApplicant(id, patch) {
  return supabase.from('rewards_applicants').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
}

// Convert a hired applicant into an employee + seed the onboarding checklist.
export async function hireApplicant(orgId, applicant) {
  const { data: emp, error } = await addEmployee(orgId, {
    full_name: applicant.name,
    is_active: true,
    hire_date: new Date().toISOString().slice(0, 10),
    pay_type: 'hourly',
  })
  if (error) return { error }
  await updateApplicant(applicant.id, { stage: 'hired', hired_employee_id: emp.id })
  await seedOnboarding(orgId, emp.id)
  return { employee: emp }
}

// ---- Onboarding ------------------------------------------------------------
export const ONBOARDING_TEMPLATE = [
  { task: 'i9', label: 'Form I-9 — employment eligibility' },
  { task: 'w4', label: 'Form W-4 — federal withholding' },
  { task: 'direct_deposit', label: 'Direct deposit authorization' },
  { task: 'handbook', label: 'Employee handbook acknowledgment' },
  { task: 'new_hire_report', label: 'State new-hire report (within 20 days)' },
]

export async function seedOnboarding(orgId, employeeId) {
  const existing = await listOnboarding(orgId, employeeId)
  if (existing.length) return existing
  const rows = ONBOARDING_TEMPLATE.map((t) => ({ org_id: orgId, employee_id: employeeId, task: t.task, label: t.label }))
  const { data } = await supabase.from('rewards_onboarding_tasks').insert(rows).select()
  return data || []
}
export async function listOnboarding(orgId, employeeId) {
  const { data } = await supabase
    .from('rewards_onboarding_tasks')
    .select('*')
    .eq('org_id', orgId)
    .eq('employee_id', employeeId)
    .order('created_at')
  return data || []
}
export async function updateOnboardingTask(id, patch) {
  return supabase.from('rewards_onboarding_tasks').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
}

// ---- Discipline ------------------------------------------------------------
export const DISCIPLINE_TYPES = ['verbal', 'written', 'final', 'suspension', 'termination']

export async function listDiscipline(orgId, employeeId) {
  let q = supabase.from('rewards_discipline').select('*').eq('org_id', orgId).order('incident_date', { ascending: false })
  if (employeeId) q = q.eq('employee_id', employeeId)
  const { data } = await q
  return data || []
}
export async function addDiscipline(orgId, row) {
  return supabase.from('rewards_discipline').insert({ org_id: orgId, ...row }).select().single()
}
export async function updateDiscipline(id, patch) {
  return supabase.from('rewards_discipline').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
}

// ---- Certifications & licenses --------------------------------------------
export const CERT_TYPES = [
  { key: 'epa_608', label: 'EPA 608 (refrigerant)' },
  { key: 'nate', label: 'NATE certification' },
  { key: 'state_license', label: 'State mechanical license' },
  { key: 'cdl', label: "Driver's license / CDL" },
  { key: 'dot_medical', label: 'DOT medical card' },
  { key: 'osha', label: 'OSHA 10 / 30' },
  { key: 'drug_test', label: 'Drug test' },
  { key: 'insurance', label: 'Insurance cert (1099 sub)' },
  { key: 'other', label: 'Other' },
]
export function certLabel(key) {
  return (CERT_TYPES.find((c) => c.key === key) || {}).label || key
}

export async function listCertifications(orgId, { employeeId } = {}) {
  let q = supabase.from('rewards_certifications').select('*').eq('org_id', orgId).order('expires_date', { nullsFirst: false })
  if (employeeId) q = q.eq('employee_id', employeeId)
  const { data } = await q
  return data || []
}
export async function addCertification(orgId, row) {
  return supabase.from('rewards_certifications').insert({ org_id: orgId, ...row }).select().single()
}
export async function updateCertification(id, patch) {
  return supabase.from('rewards_certifications').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
}
export async function deleteCertification(id) {
  return supabase.from('rewards_certifications').delete().eq('id', id)
}

// ---- Documents -------------------------------------------------------------
export async function listDocuments(orgId, { employeeId } = {}) {
  let q = supabase.from('rewards_documents').select('*').eq('org_id', orgId).order('uploaded_at', { ascending: false })
  if (employeeId) q = q.eq('employee_id', employeeId)
  const { data } = await q
  return data || []
}
export async function addDocument(orgId, row) {
  return supabase.from('rewards_documents').insert({ org_id: orgId, ...row }).select().single()
}

// ---- Dashboard: derive live compliance flags -------------------------------
// Cert-expiry + federal headcount-threshold flags, computed on read so the
// dashboard is always current without a cron. (Persisted flags arrive in R4.)
const HEADCOUNT_THRESHOLDS = [
  { n: 15, laws: 'Title VII + ADA (anti-discrimination, reasonable accommodation)' },
  { n: 20, laws: 'ADEA (age 40+ discrimination)' },
  { n: 50, laws: 'FMLA (12-week job-protected leave)' },
  { n: 100, laws: 'EEO-1 annual demographic report' },
]

export async function dashboardData(orgId) {
  const [employees, certs] = await Promise.all([
    listEmployees(orgId, { includeInactive: false }),
    listCertifications(orgId),
  ])
  const headcount = employees.length
  const flags = []

  // Cert expiry (expired = red, within 60 days = amber)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const empName = (id) => (employees.find((e) => e.id === id) || {}).full_name || 'Employee'
  certs.forEach((c) => {
    if (!c.expires_date) return
    const d = new Date(c.expires_date + 'T00:00:00')
    const days = Math.round((d - today) / 86400000)
    if (days < 0) {
      flags.push({ flag_type: 'cert_expiring', severity: 'red', subject_label: empName(c.employee_id), message: `${certLabel(c.cert_type)} expired ${Math.abs(days)} days ago` })
    } else if (days <= 60) {
      flags.push({ flag_type: 'cert_expiring', severity: 'amber', subject_label: empName(c.employee_id), message: `${certLabel(c.cert_type)} expires in ${days} days` })
    }
  })

  // Headcount thresholds just crossed (show the highest one reached as informational)
  HEADCOUNT_THRESHOLDS.forEach((t) => {
    if (headcount >= t.n) {
      flags.push({ flag_type: 'headcount_threshold', severity: 'amber', subject_label: `${headcount} employees`, message: `At ${t.n}+ employees: ${t.laws} now apply` })
    }
  })

  // Sort red first
  flags.sort((a, b) => (a.severity === 'red' ? -1 : 1) - (b.severity === 'red' ? -1 : 1))
  return { headcount, activeEmployees: employees, certs, flags }
}
