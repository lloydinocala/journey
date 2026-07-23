// Rewards-HVAC · module entry point (R1 = HR core; Payroll routes land in R2)
// Self-contained: exports its own routes and nav so App.jsx / Layout.jsx stay thin,
// exactly like the Elements module.
import HrDashboard from './HrDashboard'
import HrEmployees from './HrEmployees'
import HrJobDescriptions from './HrJobDescriptions'
import HrHiring from './HrHiring'
import HrOnboarding from './HrOnboarding'
import HrDiscipline from './HrDiscipline'
import HrCertifications from './HrCertifications'
import HrDocuments from './HrDocuments'
import RewardsSettings from './RewardsSettings'
import PayrollDashboard from './PayrollDashboard'
import PreparePayroll from './PreparePayroll'
import Paychecks from './Paychecks'
import TaxCenter from './TaxCenter'
import ClassificationCheck from './ClassificationCheck'
import Deductions from './Deductions'
import TimeOff from './TimeOff'
import WorkersComp from './WorkersComp'
import StateRules from './StateRules'
import CertProjects from './CertProjects'
import PrevailingWage from './PrevailingWage'
import CertifiedPayroll from './CertifiedPayroll'
import YearEnd from './YearEnd'

// Each entry rendered in App.jsx as <Route path element={<Component profile={profile} />} />
export const REWARDS_HR_ROUTES = [
  { path: '/rewards', Component: HrDashboard },
  { path: '/rewards/employees', Component: HrEmployees },
  { path: '/rewards/job-descriptions', Component: HrJobDescriptions },
  { path: '/rewards/hiring', Component: HrHiring },
  { path: '/rewards/onboarding', Component: HrOnboarding },
  { path: '/rewards/discipline', Component: HrDiscipline },
  { path: '/rewards/certifications', Component: HrCertifications },
  { path: '/rewards/documents', Component: HrDocuments },
  { path: '/rewards/time-off', Component: TimeOff },
  { path: '/rewards/settings', Component: RewardsSettings },
]

// Payroll (R2) — same self-contained pattern, same entitlement gate.
export const REWARDS_PAYROLL_ROUTES = [
  { path: '/rewards/payroll', Component: PayrollDashboard },
  { path: '/rewards/payroll/prepare', Component: PreparePayroll },
  { path: '/rewards/payroll/paychecks', Component: Paychecks },
  { path: '/rewards/payroll/tax-center', Component: TaxCenter },
  { path: '/rewards/payroll/classification', Component: ClassificationCheck },
  { path: '/rewards/payroll/deductions', Component: Deductions },
  { path: '/rewards/payroll/workers-comp', Component: WorkersComp },
  { path: '/rewards/payroll/state-rules', Component: StateRules },
  { path: '/rewards/payroll/year-end', Component: YearEnd },
]

// Sidebar category (Layout.jsx). Office roles only (hidden from techs), gated on entitlement.
export const REWARDS_HR_NAV = {
  key: 'rewards',
  label: 'Rewards · People',
  items: [
    { label: 'HR Dashboard', path: '/rewards' },
    { label: 'Employees', path: '/rewards/employees' },
    { label: 'Job Descriptions', path: '/rewards/job-descriptions' },
    { label: 'Hiring', path: '/rewards/hiring' },
    { label: 'Onboarding', path: '/rewards/onboarding' },
    { label: 'Discipline', path: '/rewards/discipline' },
    { label: 'Certifications & Licenses', path: '/rewards/certifications' },
    { label: 'Documents', path: '/rewards/documents' },
    { label: 'Time Off', path: '/rewards/time-off' },
    { label: 'Rewards Settings', path: '/rewards/settings' },
  ],
}

// Certified payroll (R6) — third category, same entitlement gate.
export const REWARDS_CERT_ROUTES = [
  { path: '/rewards/certified', Component: CertifiedPayroll },
  { path: '/rewards/certified/projects', Component: CertProjects },
  { path: '/rewards/certified/wage-rates', Component: PrevailingWage },
]

export const REWARDS_CERT_NAV = {
  key: 'rewards-cert',
  label: 'Rewards · Certified Payroll',
  items: [
    { label: 'Projects', path: '/rewards/certified/projects' },
    { label: 'Prevailing Wage', path: '/rewards/certified/wage-rates' },
    { label: 'Certified Payroll', path: '/rewards/certified' },
  ],
}

export const REWARDS_PAYROLL_NAV = {
  key: 'rewards-payroll',
  label: 'Rewards · Payroll',
  items: [
    { label: 'Payroll Dashboard', path: '/rewards/payroll' },
    { label: 'Prepare Payroll', path: '/rewards/payroll/prepare' },
    { label: 'Paychecks', path: '/rewards/payroll/paychecks' },
    { label: 'Benefits & Deductions', path: '/rewards/payroll/deductions' },
    { label: 'Workers’ Comp', path: '/rewards/payroll/workers-comp' },
    { label: 'Tax Center', path: '/rewards/payroll/tax-center' },
    { label: 'Year-End Forms', path: '/rewards/payroll/year-end' },
    { label: 'Worker Classification', path: '/rewards/payroll/classification' },
    { label: 'State Tax Rules', path: '/rewards/payroll/state-rules' },
  ],
}
