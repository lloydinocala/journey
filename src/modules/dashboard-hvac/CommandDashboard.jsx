// Dashboard-HVAC · the live Home board (P2). Renders a per-org working copy of
// the board. The code default (DEFAULT_TEMPLATE) is the immutable template: an
// org with no saved layout gets it, and "Reset to default" restores it, so the
// default can never be lost. Subscribers with the customize_dashboard permission
// (and the platform owner) can replace widgets and add composed KPIs; those
// changes persist per-org. Everyone else sees the board read-only.
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import { can } from '../../utils/permissions'
import OrgPicker from '../../OrgPicker'
import { MEASURES, DEFAULT_TEMPLATE } from './catalog'
import { fetchMeasure, queryKpi, getLayout, saveLayout, resetLayout, periodRange, PERIODS } from './dashboardData'
import Widget from './charts'
import KpiBuilder from './KpiBuilder'

const SECTIONS = [
  ['Operations', '/operations'], ['Financials', '/financials'], ['Admin', '/admin'],
  ['Assets', '/assets'], ['Inventory', '/elements'], ['Fleet', '/fleet'],
  ['Marketing', '/marketing'], ['HR', '/rewards'], ['Payroll', '/rewards/payroll'],
]

// The immutable default as a normalized working copy.
const defaultWidgets = () => DEFAULT_TEMPLATE.map((w) => ({ kind: 'measure', key: w.key, w: w.w }))
// A stable per-widget id (measure key or the composed KPI's id).
const uid = (w) => (w.kind === 'measure' ? 'm:' + w.key : 'c:' + w.id)

export default function CommandDashboard({ profile }) {
  const isSuperAdmin = profile?.role === 'super_admin'
  const canCustomize = isSuperAdmin || can(profile, 'customize_dashboard')
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile?.org_id || '')
  const [period, setPeriod] = useState('mtd')
  const [widgets, setWidgets] = useState(defaultWidgets)
  const [customized, setCustomized] = useState(false)   // org has a saved layout row
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)
  const [builderOpen, setBuilderOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        setSelectedOrg((s) => s || (data && data[0] ? data[0].id : ''))
      })
    }
  }, [isSuperAdmin])

  // Load the org's saved layout (or the code default) whenever the org changes.
  useEffect(() => {
    let alive = true
    if (!selectedOrg) return
    getLayout(selectedOrg).then((saved) => {
      if (!alive) return
      if (Array.isArray(saved) && saved.length) { setWidgets(saved); setCustomized(true) }
      else { setWidgets(defaultWidgets()); setCustomized(false) }
    })
    return () => { alive = false }
  }, [selectedOrg])

  // Fetch each widget's rows for the org + period.
  useEffect(() => {
    let alive = true
    async function load() {
      if (!selectedOrg) { setLoading(false); return }
      setLoading(true)
      const range = periodRange(period)
      const pairs = await Promise.all(widgets.map(async (w) => {
        const rows = w.kind === 'measure'
          ? await fetchMeasure(MEASURES[w.key], selectedOrg, range)
          : await queryKpi(selectedOrg, w.measure, w.dim, range)
        return [uid(w), rows]
      }))
      if (!alive) return
      setData(Object.fromEntries(pairs))
      setLoading(false)
    }
    load()
    return () => { alive = false }
  }, [selectedOrg, period, widgets])

  // Persist the working copy (designers only). Marks the org as customized.
  function persist(next) {
    setWidgets(next)
    setCustomized(true)
    saveLayout(selectedOrg, next)
  }
  function addKpi(cfg) {
    persist([...widgets, { kind: 'custom', id: cfg.id, measure: cfg.measure, dim: cfg.dim, viz: cfg.viz, unit: cfg.unit, label: cfg.label, w: cfg.w }])
    setBuilderOpen(false)
  }
  function removeWidget(w) {
    persist(widgets.filter((x) => uid(x) !== uid(w)))
  }
  function resetToDefault() {
    const def = defaultWidgets()
    setWidgets(def)
    setCustomized(false)
    resetLayout(selectedOrg)
  }

  const periodLabel = (PERIODS.find((p) => p[0] === period) || [])[1]

  const cards = widgets.map((w) => w.kind === 'measure'
    ? { id: uid(w), def: MEASURES[w.key], w: w.w, rows: data[uid(w)], drill: MEASURES[w.key].drill, widget: w }
    : { id: uid(w), def: { label: w.label, unit: w.unit, viz: w.viz, sub: '' }, w: w.w, rows: data[uid(w)], drill: null, widget: w })

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
          {canCustomize && customized && <button className="logout-button" style={{ margin: 0 }} onClick={resetToDefault}>Reset to default</button>}
        </div>
      </div>

      {isSuperAdmin && (
        <div style={{ marginBottom: 18, maxWidth: 360 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(244px, 1fr))', gap: 14, marginBottom: 26 }}>
        {cards.map((it) => (
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {it.drill && <span aria-hidden style={{ color: 'var(--mist)', fontSize: 13 }}>↗</span>}
                {canCustomize && <button title="Remove" onClick={(e) => { e.stopPropagation(); removeWidget(it.widget) }} style={{ border: 'none', background: 'none', color: 'var(--mist)', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 0 }}>×</button>}
              </div>
            </div>
            {loading ? <div style={{ color: 'var(--mist)', fontSize: 13 }}>Loading…</div> : <Widget def={it.def} rows={it.rows} />}
          </div>
        ))}
      </div>

      {builderOpen && (
        <KpiBuilder org={selectedOrg} range={periodRange(period)}
          onAdd={addKpi}
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
          {canCustomize
            ? 'Use “+ Add KPI” to compose your own — pick a measure, a breakdown, and it picks the right chart. Remove any tile with ×; “Reset to default” restores the standard board at any time.'
            : 'This is your company’s dashboard. Ask an administrator to customize which KPIs appear.'}
        </div>
      </div>
    </div>
  )
}
