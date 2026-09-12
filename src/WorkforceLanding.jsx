import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import QuincyBrief from './QuincyBrief'
import { useSignals } from './signals/useSignals'

const BRAND = '#176E7A', FAINT = '#98A2AD', INK = '#1C2430'
const GREEN = '#2E7D52', GREEN_BG = '#EAF3EC', GREEN_LN = '#CADFCF'
const AMBER = '#9C6A12', AMBER_BG = '#FAF2E0', AMBER_LN = '#EAD3A0'

// Workforce hub landing — a roll-up over its children (task signals when they exist)
// plus the people KPIs and a directory of its sub-stations. Consistent with the
// other hub landings; ready to light up as workforce signals come online.
export default function WorkforceLanding({ profile }) {
  const nav = useNavigate()
  const org = profile?.org_id
  const hrOn = !!profile?.hrEntitled
  const payOn = !!profile?.payrollEntitled
  const [k, setK] = useState(null)

  const { needing, loading: sigLoading } = useSignals({ hub: 'workforce' }, org, nav)

  useEffect(() => {
    if (!org) return
    async function load() {
      const nowIso = new Date().toISOString()
      const [teamRes, clockRes, ocRes] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('org_id', org).eq('is_active', true).is('deleted_at', null),
        supabase.from('time_clock_events').select('*', { count: 'exact', head: true }).eq('org_id', org).is('clock_out', null),
        supabase.from('on_call_schedule').select('period_end').eq('org_id', org).gt('period_end', nowIso).order('period_end', { ascending: false }).limit(1),
      ])
      const coveredThrough = ocRes.data && ocRes.data[0] ? new Date(ocRes.data[0].period_end) : null
      setK({ team: teamRes.count || 0, clockedIn: clockRes.count || 0, coveredThrough })
    }
    load()
  }, [org])

  const cards = [
    { label: 'Team', desc: 'Roster, roles & invites', path: '/team', on: true },
    { label: 'Roles & Tags', desc: 'Permissions & access', path: '/roles', on: true },
    { label: 'Time Clock', desc: 'Hours & open shifts', path: '/time-clock', on: true },
    { label: 'Payroll Capture', desc: 'Capture pay data', path: '/payroll', on: true },
    { label: 'Sign-In Log', desc: 'Who signed in, when', path: '/session-log', on: true },
    { label: 'Human Resources', desc: 'Employees, hiring, compliance', path: '/rewards', on: hrOn },
    { label: 'Payroll', desc: 'Run & review payroll', path: '/rewards/payroll', on: payOn },
    { label: 'Certified Payroll', desc: 'Prevailing-wage reporting', path: '/rewards/certified', on: payOn },
  ].filter((c) => c.on)

  const covShort = k && (!k.coveredThrough || k.coveredThrough < new Date(Date.now() + 14 * 86400000))
  const covText = !k ? '…' : k.coveredThrough ? k.coveredThrough.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Not set'

  const kpi = (label, value, sub, tone) => (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderTop: `3px solid ${tone}`, borderRadius: 12, padding: '14px 16px 13px', boxShadow: '0 1px 3px rgba(20,30,50,0.04)' }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 0.3, color: FAINT, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: tone, margin: '4px 0 2px', letterSpacing: -0.5 }}>{value}</div>
      <div style={{ fontSize: 12.5, color: 'var(--mist)' }}>{sub}</div>
    </div>
  )

  return (
    <div style={{ padding: '22px 24px 70px', maxWidth: 1000 }}>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 0.3, color: BRAND }}>Workforce</div>
        <h2 style={{ fontSize: 25, fontWeight: 800, letterSpacing: -0.5, margin: '4px 0 0' }}>Your people & pay</h2>
      </div>

      {/* status banner + Quincy */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginTop: 14, padding: '11px 15px', borderRadius: 12, background: covShort ? AMBER_BG : GREEN_BG, border: `1px solid ${covShort ? AMBER_LN : GREEN_LN}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <span style={{ width: 26, height: 26, flex: 'none', borderRadius: 999, background: '#fff', border: `1px solid ${covShort ? AMBER_LN : GREEN_LN}`, color: covShort ? AMBER : GREEN, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>{covShort ? '!' : '\u2713'}</span>
          <span style={{ fontSize: 14.5, fontWeight: 600, color: covShort ? AMBER : GREEN }}>
            {!k ? 'Checking your team\u2026' : covShort ? `On-call coverage runs out ${k.coveredThrough ? 'soon (' + covText + ')' : '\u2014 none scheduled'} \u2014 extend it.` : `Team's set \u2014 on-call covered through ${covText}.`}
          </span>
        </div>
        <QuincyBrief kind="admin" org={org} title="Workforce briefing" />
      </div>

      {/* KPIs */}
      <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
        {kpi('Active team', k ? String(k.team) : '\u2013', 'members on the roster', BRAND)}
        {kpi('Clocked in now', k ? String(k.clockedIn) : '\u2013', 'currently on the clock', k && k.clockedIn > 0 ? GREEN : FAINT)}
        {kpi('On-call covered through', covText, covShort ? 'extend coverage soon' : 'coverage in place', covShort ? AMBER : GREEN)}
        {!sigLoading && needing.length > 0 && kpi('Needs a hand', String(needing.length), 'workforce tasks waiting', AMBER)}
      </div>

      {/* sub-station directory */}
      <div style={{ marginTop: 24 }}>
        <div style={{ marginBottom: 12 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.2, margin: 0 }}>Workforce areas</h3>
          <p style={{ margin: '3px 0 0', fontSize: 12.5, color: FAINT }}>Everything about your people and pay, in one place.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(232px, 1fr))', gap: 14 }}>
          {cards.map((c) => (
            <div key={c.path} onClick={() => nav(c.path)} style={{ background: '#fff', border: '1px solid var(--border)', borderLeft: `3px solid ${BRAND}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(20,30,50,0.04)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>{c.label}</div>
              <div style={{ fontSize: 13, color: 'var(--mist)', marginTop: 3 }}>{c.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
