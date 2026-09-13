// Section dashboards — a landing page per menu section, opened by clicking the
// section title in the rail. Home is a knowledge/summary hub; the others are
// workflow dashboards. Operations, Assets, Inventory, Fleet, Marketing, HR, and
// Payroll already have their own dashboards; these fill the remaining sections
// (Home, Financials, Admin) as functional placeholders — useful quick-launch +
// a clear outline of the analytics coming to each — until we build them out.
import { Link } from 'react-router-dom'
import QuincyBrief from './QuincyBrief'
import { can } from './utils/permissions'
import CustomKpis from './CustomKpis'

const NAVY = '#1B3A6B'
const C = { ink: '#1F2A37', mist: '#64748B', line: '#E7EBF0', card: '#FFFFFF', wash: '#F7F9FB' }

function SectionDash({ title, subtitle, intro, links, planned, tone = NAVY, org, kind }) {
  return (
    <div style={{ color: C.ink }}>
      <div style={{ borderLeft: `4px solid ${tone}`, paddingLeft: 14, marginBottom: 6 }}>
        <h2 className="page-title" style={{ margin: 0 }}>{title}</h2>
        <div style={{ color: C.mist, fontSize: 13 }}>{subtitle}</div>
      </div>
      <div style={{ margin: '14px 0 4px' }}><QuincyBrief kind={kind} org={org} /></div>
      {intro && <p style={{ color: C.mist, fontSize: 13.5, maxWidth: 760, margin: '14px 0 22px' }}>{intro}</p>}

      {links && links.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.mist, letterSpacing: 0.6, textTransform: 'uppercase', margin: '4px 0 12px' }}>Quick links</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 28 }}>
            {links.map((l) => (
              <Link key={l.path} to={l.path} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: '14px 16px', height: '100%', transition: 'box-shadow .15s' }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: tone }}>{l.label}</div>
                  {l.desc && <div style={{ fontSize: 12.5, color: C.mist, marginTop: 3 }}>{l.desc}</div>}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {planned && planned.length > 0 && (
        <div style={{ background: C.wash, border: `1px dashed ${C.line}`, borderRadius: 12, padding: '16px 18px', maxWidth: 760 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.mist, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 }}>Coming to this dashboard</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {planned.map((p, i) => <li key={i} style={{ fontSize: 13, lineHeight: 1.6, color: '#3B4757' }}>{p}</li>)}
          </ul>
          <div style={{ fontSize: 12, color: C.mist, marginTop: 10 }}>Placeholder for now — the live summaries and graphs land as we build this section out.</div>
        </div>
      )}
    </div>
  )
}

// HomeDash retired — the Home route now renders the live CommandDashboard
// (modules/dashboard-hvac). FinancialsDash / AdminDash remain for their sections.

export function AdminDash({ profile }) {
  const canManage = profile?.role === 'super_admin' || can(profile, 'manage_kpis')
  return (
    <div>
      <div style={{ padding: '20px 24px 0', maxWidth: 1040 }}>
        <CustomKpis org={profile?.org_id} dashboard="admin" canManage={canManage} />
      </div>
    <SectionDash
      org={profile?.org_id}
      kind="admin"
      title="Admin"
      subtitle="System setup and org-wide oversight"
      intro="Configure the company and keep an eye on the numbers. People, time, and pay now live under Workforce; on-call under Dispatch; and checklists under the Data Station."
      links={[
        { label: 'Settings', path: '/settings', desc: 'Company setup' },
      ]}
      planned={[
        'A setup-health checklist so nothing critical is left unconfigured.',
        'An audit trail of settings and permission changes.',
        'Module & add-on management — which features each part of the org can use.',
      ]}
    />
    </div>
  )
}
