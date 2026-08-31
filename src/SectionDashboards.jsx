// Section dashboards — a landing page per menu section, opened by clicking the
// section title in the rail. Home is a knowledge/summary hub; the others are
// workflow dashboards. Operations, Assets, Inventory, Fleet, Marketing, HR, and
// Payroll already have their own dashboards; these fill the remaining sections
// (Home, Financials, Admin) as functional placeholders — useful quick-launch +
// a clear outline of the analytics coming to each — until we build them out.
import { Link } from 'react-router-dom'

const NAVY = '#1B3A6B'
const C = { ink: '#1F2A37', mist: '#64748B', line: '#E7EBF0', card: '#FFFFFF', wash: '#F7F9FB' }

function SectionDash({ title, subtitle, intro, links, planned, tone = NAVY }) {
  return (
    <div style={{ color: C.ink }}>
      <div style={{ borderLeft: `4px solid ${tone}`, paddingLeft: 14, marginBottom: 6 }}>
        <h2 className="page-title" style={{ margin: 0 }}>{title}</h2>
        <div style={{ color: C.mist, fontSize: 13 }}>{subtitle}</div>
      </div>
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

export function FinancialsDash() {
  return (
    <SectionDash
      title="Financials"
      subtitle="Money in, money out, and the health of your receivables"
      intro="The financial workflow hub — chase what is owed, watch margins, and keep pricing sharp."
      links={[
        { label: 'Invoices', path: '/invoices', desc: 'Billing & payments' },
        { label: 'Maintenance Dashboard', path: '/maintenance-dashboard', desc: 'Agreement revenue' },
        { label: 'Pricebook', path: '/pricebook', desc: 'Service pricing' },
        { label: 'Systems Pricebook', path: '/systems-pricebook', desc: 'Equipment pricing' },
        { label: 'Special Features', path: '/special-features', desc: 'Add-ons' },
        { label: 'Discount Catalog', path: '/discount-catalog', desc: 'Approved discounts' },
        { label: 'Maintenance Tiers', path: '/maintenance-tiers', desc: 'Plan pricing' },
        { label: 'System Estimate Setup', path: '/system-estimate-setup', desc: 'Estimate templates' },
      ]}
      planned={[
        'A/R aging: current / 30 / 60 / 90+, with the biggest unpaid invoices to chase first.',
        'Collected vs billed this week and this month, and cash-flow trend graphs.',
        'Revenue by month and by segment; gross margin and job profitability roll-ups.',
        'Estimate conversion in dollars, and recurring (agreement) revenue run-rate.',
        'An AI financial briefing: what to collect, where margin is slipping, and why.',
      ]}
    />
  )
}

export function AdminDash() {
  return (
    <SectionDash
      title="Admin"
      subtitle="Your team, their time, and how the system is set up"
      intro="The administrative hub — manage people and access, keep coverage staffed, and control settings."
      links={[
        { label: 'Team', path: '/team', desc: 'Employees & access' },
        { label: 'Roles & Tags', path: '/roles', desc: 'Permissions' },
        { label: 'On-Call Schedule', path: '/on-call', desc: 'Coverage' },
        { label: 'Checklists', path: '/checklists', desc: 'Job checklist templates' },
        { label: 'Time Clock', path: '/time-clock', desc: 'Clock in/out' },
        { label: 'Payroll Capture', path: '/payroll', desc: 'Hours for payroll' },
        { label: 'Sign-In Log', path: '/session-log', desc: 'Access history' },
        { label: 'Settings', path: '/settings', desc: 'Company setup' },
      ]}
      planned={[
        'Who is on the clock right now, and anyone still clocked in from a prior day.',
        'On-call coverage at a glance, with gaps flagged before they happen.',
        'Team roster by role, recent access changes, and pending invites.',
        'Time-clock exceptions (missed clock-outs, long shifts) ready for correction.',
        'A setup-health checklist so nothing critical is left unconfigured.',
      ]}
    />
  )
}
