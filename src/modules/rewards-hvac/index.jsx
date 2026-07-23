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
  { path: '/rewards/settings', Component: RewardsSettings },
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
    { label: 'Rewards Settings', path: '/rewards/settings' },
  ],
}
