import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import { can } from './utils/permissions'
import OrgPicker from './OrgPicker'

// The Maintenance Station — a domain station (same family as the Train Station).
// STAGE 2: office view (tasks). STAGE 3: owner/admin faces — the SAME signals, framed
// as KPIs/flags, gated by two independent permissions:
//   • view_operational_metrics → health/variance flags (retention rate) — a supervisor
//   • view_owner_metrics        → the dollars (MRR, ACV, untapped base) — the owner
// One source, two faces: the "lapsed" signal is an office TASK and an owner RETENTION FLAG.

const ACCENT = {
  amber: { fg: '#9C6A12', bg: '#FAF2E0', line: '#EAD3A0' },
  red: { fg: '#B5462F', bg: '#FBECE8', line: '#EAC5BC' },
}
const GREEN = '#2E7D52', GREEN_BG = '#EAF3EC', GREEN_LINE = '#CADFCF', BRAND = '#176E7A', FAINT = '#98A2AD'
const money = (n) => '$' + (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const d7 = () => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
const d30 = () => new Date(Date.now() - 30 * 86400000).toISOString()

async function postjobCount(org) {
  const { data: jobs, error } = await supabase.from('jobs').select('property_id')
    .eq('org_id', org).eq('status', 'completed').gte('completed_at', d30()).not('property_id', 'is', null)
  if (error) return { count: null, error }
  const propIds = [...new Set((jobs || []).map((j) => j.property_id))]
  if (!propIds.length) return { count: 0 }
  const { count, error: e2 } = await supabase.from('property_maintenance_status').select('*', { count: 'exact', head: true })
    .in('property_id', propIds).not('status', 'in', '("active","opted_out")')
  return { count, error: e2 }
}

const REGISTRY = [
  { key: 'lapsed', name: 'Win back lapsed plans', href: '/maintenance-dashboard', tone: 'red', cta: 'Win them back',
    line: (n) => `${n} had a plan, none active now`,
    q: (org) => supabase.from('property_maintenance_status').select('*', { count: 'exact', head: true }).eq('org_id', org).eq('status', 'lapsed') },
  { key: 'offered', name: 'Follow up on offers', href: '/maintenance-dashboard', tone: 'amber', cta: 'Open nurture list',
    line: (n) => `${n} offered, awaiting a decision`,
    q: (org) => supabase.from('property_maintenance_status').select('*', { count: 'exact', head: true }).eq('org_id', org).eq('status', 'offered') },
  { key: 'postjob', name: 'Offer a plan after service', href: '/maintenance-dashboard', tone: 'amber', cta: 'Review jobs',
    line: (n) => `${n} recent job${n === 1 ? '' : 's'} with no plan on file`,
    q: (org) => postjobCount(org) },
  { key: 'filters', name: 'Filters to ship', href: '/maintenance-dashboard', tone: 'amber', cta: 'Fulfill',
    line: (n) => `${n} subscription filter${n === 1 ? '' : 's'} due this week`,
    q: (org) => supabase.from('filter_subscriptions').select('*', { count: 'exact', head: true }).eq('org_id', org).eq('status', 'active').lte('next_ship_date', d7()) },
  { key: 'visits', name: 'Visits to book', href: '/maintenance-due', tone: 'amber', cta: 'Open visit board',
    line: (n) => `${n} PM visit${n === 1 ? '' : 's'} due to schedule`,
    q: (org) => supabase.from('maintenance_visits').select('*', { count: 'exact', head: true }).eq('org_id', org).eq('status', 'due') },
]

export default function MaintenanceStation({ profile }) {
  const nav = useNavigate()
  const isSuper = profile?.role === 'super_admin'
  const allowed = isSuper || can(profile, 'view_maintenance_dashboard')
  const opsAdmin = isSuper || can(profile, 'view_operational_metrics')
  const ownerAdmin = isSuper || can(profile, 'view_owner_metrics')
  const hasAdmin = opsAdmin || ownerAdmin

  const [view, setView] = useState('office')
  const [counts, setCounts] = useState({})
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(true)
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile?.org_id || '')
  const firstName = (profile.full_name || '').trim().split(' ')[0] || 'there'

  useEffect(() => { if (isSuper) supabase.from('organizations').select('id, name').order('name').then(({ data }) => setOrgs(data || [])) }, [isSuper])
  useEffect(() => { if (allowed && selectedOrg) load(); else if (allowed && !selectedOrg) setLoading(false) }, [allowed, selectedOrg])

  async function load() {
    const org = selectedOrg
    setLoading(true)
    const results = await Promise.all(REGISTRY.map(async (t) => {
      try { const { count, error } = await t.q(org); return [t.key, error ? null : (count || 0)] } catch { return [t.key, null] }
    }))
    setCounts(Object.fromEntries(results))
    if (hasAdmin) {
      try {
        const [{ count: activeN }, { count: neverN }, { data: agmts }] = await Promise.all([
          supabase.from('property_maintenance_status').select('*', { count: 'exact', head: true }).eq('org_id', org).eq('status', 'active'),
          supabase.from('property_maintenance_status').select('*', { count: 'exact', head: true }).eq('org_id', org).eq('status', 'never_offered'),
          supabase.from('maintenance_agreements').select('price, billing_cycle').eq('org_id', org).eq('status', 'active'),
        ])
        const mrr = (agmts || []).reduce((s, a) => s + (a.billing_cycle === 'annual' ? (Number(a.price) || 0) / 12 : (Number(a.price) || 0)), 0)
        setAdmin({ active: activeN || 0, never: neverN || 0, mrr })
      } catch { setAdmin(null) }
    }
    setLoading(false)
  }

  if (!allowed) return <div style={{ padding: '24px' }}><p style={{ color: FAINT }}>You don't have access to the Maintenance Station.</p></div>

  const needs = REGISTRY.filter((t) => (counts[t.key] || 0) > 0)
  const handled = REGISTRY.filter((t) => counts[t.key] === 0)
  const total = needs.reduce((n, t) => n + (counts[t.key] || 0), 0)
  const lapsed = counts.lapsed || 0
  const card = { background: '#fff', border: '1px solid var(--border)', borderRadius: 12 }

  return (
    <div style={{ padding: '22px 24px 70px', maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 0.3, color: BRAND }}>Maintenance Station</div>
          <h2 style={{ fontSize: 25, fontWeight: 800, letterSpacing: -0.5, margin: '4px 0 0' }}>
            {view === 'office' ? 'Your maintenance tasks' : 'Maintenance health'}
          </h2>
          <p style={{ margin: '7px 0 0', fontSize: 15, color: 'var(--mist)', maxWidth: 600 }}>
            {view === 'admin'
              ? 'The same signals your office works — framed as the metrics you watch.'
              : loading ? 'Checking what needs attention…'
                : total > 0
                  ? <>The recurring-revenue work waiting on you — <b style={{ color: 'inherit' }}>{total}</b> across {needs.length} area{needs.length === 1 ? '' : 's'}. Each tile opens the task, not a table.</>
                  : <>You're all caught up — no maintenance work is waiting.</>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {isSuper && (
          <div>
            <div style={{ fontSize: 11.5, color: FAINT, marginBottom: 4, textAlign: 'right' }}>Organization</div>
            <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
          </div>
        )}
        {hasAdmin && (
          <div>
            <div style={{ fontSize: 11.5, color: FAINT, marginBottom: 4, textAlign: 'right' }}>Viewing as</div>
            <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 9, overflow: 'hidden', background: '#fff' }}>
              {[['office', 'Office'], ['admin', 'Owner / Admin']].map(([v, label]) => (
                <button key={v} onClick={() => setView(v)} style={{ border: 'none', cursor: 'pointer', padding: '8px 16px', fontSize: 13, fontWeight: view === v ? 700 : 500, background: view === v ? BRAND : 'transparent', color: view === v ? '#fff' : 'var(--mist)' }}>{label}</button>
              ))}
            </div>
          </div>
        )}
        </div>
      </div>

      {isSuper && !selectedOrg ? (
        <div style={{ marginTop: 26, color: FAINT, fontSize: 14 }}>Select an organization above to load its Maintenance Station.</div>
      ) : view === 'admin' ? (
        <AdminView opsAdmin={opsAdmin} ownerAdmin={ownerAdmin} lapsed={lapsed} admin={admin} loading={loading} onWork={() => setView('office')} />
      ) : (
        <>
          <div style={{ marginTop: 26 }}>
            <SectionHead title="Needs a hand" hint="Recurring-revenue work on a clock. Each tile opens the task." />
            {!loading && needs.length === 0 ? (
              <div style={{ background: GREEN_BG, border: `1px solid ${GREEN_LINE}`, borderRadius: 12, padding: '20px', display: 'flex', gap: 13, alignItems: 'center' }}>
                <span style={{ width: 32, height: 32, borderRadius: 999, background: '#fff', border: `1px solid ${GREEN_LINE}`, color: GREEN, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>✓</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Nothing needs a hand right now.</div>
                  <div style={{ fontSize: 13.5, color: 'var(--mist)', marginTop: 2 }}>Every maintenance area below is watched and clear.</div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(258px, 1fr))', gap: 14 }}>
                {needs.map((t) => {
                  const a = ACCENT[t.tone] || ACCENT.amber; const n = counts[t.key] || 0
                  return (
                    <div key={t.key} onClick={() => nav(t.href)} style={{ ...card, borderLeft: `3px solid ${a.fg}`, padding: '15px 16px 13px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 124 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 15, fontWeight: 700 }}>{t.name}</span>
                        <span style={{ minWidth: 30, height: 30, padding: '0 9px', borderRadius: 999, background: a.bg, color: a.fg, border: `1px solid ${a.line}`, fontWeight: 800, fontSize: 15, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>
                      </div>
                      <div style={{ fontSize: 14, color: 'var(--mist)', lineHeight: 1.4, flex: 1 }}>{t.line(n)}</div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: BRAND }}>{t.cta}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          {handled.length > 0 && (
            <div style={{ marginTop: 28 }}>
              <SectionHead title="Handled" hint="Watching, nothing pending. A tile jumps up the moment it has work." />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
                {handled.map((t) => (
                  <div key={t.key} onClick={() => nav(t.href)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, ...card, borderRadius: 999, padding: '7px 13px', fontSize: 13.5, cursor: 'pointer' }}>
                    <span style={{ width: 7, height: 7, borderRadius: 999, background: GREEN }} />{t.name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {hasAdmin && (
        <div style={{ marginTop: 30, paddingTop: 14, borderTop: '1px dashed var(--border)', fontSize: 12.5, color: FAINT, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: '#B5462F' }} />
          One signal — <b style={{ color: 'var(--mist)' }}>lapsed plans ({lapsed})</b> — is a <b style={{ color: 'var(--mist)' }}>task</b> for the office and a <b style={{ color: 'var(--mist)' }}>retention flag</b> for the owner. Flip the toggle to see the same number reframed.
        </div>
      )}
    </div>
  )
}

function AdminView({ opsAdmin, ownerAdmin, lapsed, admin, loading, onWork }) {
  if (loading || !admin) return <div style={{ marginTop: 26, color: FAINT, fontSize: 14 }}>Loading metrics…</div>
  const active = admin.active || 0
  const everActive = active + lapsed
  const lapseRate = everActive ? Math.round((lapsed / everActive) * 100) : 0
  const acv = (admin.mrr || 0) * 12
  return (
    <div style={{ marginTop: 26 }}>
      <SectionHead title="What only you watch" hint="Health of the recurring-revenue base — retention, dollars, and the untapped opportunity." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(232px, 1fr))', gap: 14 }}>
        {opsAdmin && (
          <div onClick={onWork} style={{ cursor: 'pointer', background: '#fff', border: `1px solid ${lapseRate >= 50 ? '#EAC5BC' : 'var(--border)'}`, borderTop: `3px solid ${lapseRate >= 50 ? '#B5462F' : '#9C6A12'}`, borderRadius: 12, padding: '15px 16px' }}>
            <div style={{ fontSize: 12.5, color: lapseRate >= 50 ? '#B5462F' : '#9C6A12', fontWeight: 700 }}>RETENTION{lapseRate >= 50 ? ' · needs attention' : ''}</div>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1, margin: '6px 0 2px' }}>{lapseRate}%</div>
            <div style={{ fontSize: 13, color: 'var(--mist)' }}>of ever-active plans have lapsed ({lapsed} of {everActive}). Active now: {active}.</div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: BRAND, marginTop: 8 }}>Work the win-backs →</div>
          </div>
        )}
        {ownerAdmin && <Kpi label="Recurring revenue" big={money(admin.mrr)} sub={`MRR · ${money(acv)} a year`} />}
        {ownerAdmin && <Kpi label="Untapped base" big={(admin.never || 0).toLocaleString()} sub="properties never offered a plan" tone="opp" />}
      </div>
      {opsAdmin && !ownerAdmin && (
        <p style={{ fontSize: 12, color: FAINT, marginTop: 12 }}>You see operational health. The dollar figures (MRR, revenue) are limited to owner-metrics access.</p>
      )}
    </div>
  )
}

function Kpi({ label, big, sub, tone }) {
  const top = tone === 'opp' ? BRAND : 'var(--border)'
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderTop: `3px solid ${top}`, borderRadius: 12, padding: '15px 16px' }}>
      <div style={{ fontSize: 12.5, color: FAINT, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1, margin: '6px 0 2px' }}>{big}</div>
      <div style={{ fontSize: 13, color: 'var(--mist)' }}>{sub}</div>
    </div>
  )
}

function SectionHead({ title, hint }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.2, margin: 0 }}>{title}</h3>
      {hint && <p style={{ margin: '3px 0 0', fontSize: 12.5, color: FAINT, maxWidth: 640 }}>{hint}</p>}
    </div>
  )
}
