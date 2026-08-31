// Dashboard-HVAC · the live default board (P0). Renders the default template's
// KPIs from the aggregation RPCs. Read-only for now; per-widget customization
// (the builder + template model) lands in a later phase.
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import OrgPicker from '../../OrgPicker'
import { MEASURES, DEFAULT_TEMPLATE } from './catalog'
import { fetchMeasure, queryKpi, periodRange, PERIODS } from './dashboardData'
import Widget from './charts'
import KpiBuilder from './KpiBuilder'

const SECTIONS = [
  ['Operations', '/operations'], ['Financials', '/financials'], ['Admin', '/admin'],
  ['Assets', '/assets'], ['Inventory', '/elements'], ['Fleet', '/fleet'],
  ['Marketing', '/marketing'], ['HR', '/rewards'], ['Payroll', '/rewards/payroll'],
]

export default function CommandDashboard({ profile }) {
  const isSuperAdmin = profile?.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile?.org_id || '')
  const [period, setPeriod] = useState('mtd')
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)
  const [extras, setExtras] = useState([])   // session-added KPIs (persistence = P2)
  const [builderOpen, setBuilderOpen] = useState(false)
  const navigate = useNavigate()
  // Designing the board is a subscriber privilege. The formal customize_dashboard
  // permission arrives in P2; for now the platform owner can build KPIs.
  const canCustomize = isSuperAdmin

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        setSelectedOrg((s) => s || (data && data[0] ? data[0].id : ''))
      })
    }
  }, [isSuperAdmin])

  useEffect(() => {
    let alive = true
    async function load() {
      if (!selectedOrg) { setLoading(false); return }
      setLoading(true)
      const range = periodRange(period)
      const tpl = await Promise.all(
        DEFAULT_TEMPLATE.map(async (w) => [w.key, await fetchMeasure(MEASURES[w.key], selectedOrg, range)])
      )
      const ext = await Promise.all(
        extras.map(async (x) => [x.id, await queryKpi(selectedOrg, x.measure, x.dim, range)])
      )
      if (!alive) return
      setData(Object.fromEntries([...tpl, ...ext]))
      setLoading(false)
    }
    load()
    return () => { alive = false }
  }, [selectedOrg, period, extras])

  const periodLabel = (PERIODS.find((p) => p[0] === period) || [])[1]

  return (
    <div>
      <div className="page-header-bar" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2 className="page-title" style={{ margin: 0 }}>Dashboard</h2>
          <div style={{ color: 'var(--mist)', fontSize: 13, marginTop: 2 }}>Your business at a glance · {periodLabel}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Period</label>
            <select value={period} onChange={(e) => setPeriod(e.target.value)}>
              {PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          {canCustomize && <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => setBuilderOpen(true)}>+ Add KPI</button>}
        </div>
      </div>

      {isSuperAdmin && (
        <div style={{ marginBottom: 18, maxWidth: 360 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(244px, 1fr))', gap: 14, marginBottom: 26 }}>
        {[
          ...DEFAULT_TEMPLATE.map((w) => ({ id: w.key, def: MEASURES[w.key], w: w.w, rows: data[w.key], drill: MEASURES[w.key].drill })),
          ...extras.map((x) => ({ id: x.id, def: { label: x.label, unit: x.unit, viz: x.viz, sub: '' }, w: x.w, rows: data[x.id], removable: true })),
        ].map((it) => (
          <div key={it.id}
            onClick={() => it.drill && navigate(it.drill)}
            style={{
              gridColumn: it.w === 2 ? 'span 2' : 'span 1',
              background: 'var(--surface, #fff)', border: '1px solid var(--border)', borderRadius: 14,
              padding: '16px 18px', cursor: it.drill ? 'pointer' : 'default',
              display: 'flex', flexDirection: 'column', gap: 12, minHeight: 132, transition: 'box-shadow .15s, border-color .15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 6px 22px rgba(16,32,47,.10)'; e.currentTarget.style.borderColor = 'var(--route-blue, #1B3A6B)' }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '.02em', textTransform: 'uppercase', color: 'var(--mist)' }}>{it.def.label}</div>
              {it.removable
                ? <button title="Remove" onClick={(e) => { e.stopPropagation(); setExtras((xs) => xs.filter((x) => x.id !== it.id)) }} style={{ border: 'none', background: 'none', color: 'var(--mist)', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 0 }}>×</button>
                : (it.drill && <span aria-hidden style={{ color: 'var(--mist)', fontSize: 13 }}>↗</span>)}
            </div>
            {loading ? <div style={{ color: 'var(--mist)', fontSize: 13 }}>Loading…</div> : <Widget def={it.def} rows={it.rows} />}
          </div>
        ))}
      </div>

      {builderOpen && (
        <KpiBuilder org={selectedOrg} range={periodRange(period)}
          onAdd={(cfg) => { setExtras((xs) => [...xs, cfg]); setBuilderOpen(false) }}
          onClose={() => setBuilderOpen(false)} />
      )}

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--mist)', marginBottom: 10 }}>Jump to a section</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {SECTIONS.map(([label, to]) => (
            <Link key={to} to={to} className="nav-link" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 13px', fontSize: 13.5 }}>{label}</Link>
          ))}
        </div>
        <div style={{ color: 'var(--mist)', fontSize: 12, marginTop: 14 }}>
          This is the default board.{canCustomize ? ' Use “+ Add KPI” to compose your own — pick a measure, a breakdown, and it picks the right chart.' : ''} Saving your customizations across sessions (and rearranging) arrives next.
        </div>
      </div>
    </div>
  )
}
