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
import { MEASURES, DIMENSIONS, DEFAULT_TEMPLATE } from './catalog'
import { fetchMeasure, queryKpi, getLayout, saveLayout, resetLayout, periodRange, PERIODS } from './dashboardData'
import Widget from './charts'
import KpiBuilder from './KpiBuilder'
import AiAssist from '../../AiAssist'
import QuincyBrief from '../../QuincyBrief'
import { investigateProps } from './investigate'

const SECTIONS = [
  ['Operations', '/operations'], ['Financials', '/financials'], ['Admin', '/admin'],
  ['Inventory', '/elements'], ['Fleet', '/fleet'], ['Tools', '/tools'],
  ['Marketing', '/marketing'], ['HR', '/rewards'], ['Payroll', '/rewards/payroll'],
]

// The immutable default as a normalized working copy.
const defaultWidgets = () => DEFAULT_TEMPLATE.map((w) => ({ kind: 'measure', key: w.key, w: w.w }))
// A stable per-widget id (measure key or the composed KPI's id).
const uid = (w) => (w.kind === 'measure' ? 'm:' + w.key : 'c:' + w.id)

// Width guardrail by chart type: single-value readouts cap at 2 columns so they
// never sprawl; multi-series charts may run to 3 (full width). Presets: S·M·L.
const MAXW = { tile: 2, gauge: 2, flags: 2, bars: 3, estimates: 3, column: 3 }
const vizOf = (w) => (w.kind === 'measure' ? MEASURES[w.key].viz : w.viz)
const maxWFor = (w) => MAXW[vizOf(w)] || 3
const SIZE_LABEL = { 1: 'S', 2: 'M', 3: 'L' }

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
  const [arranging, setArranging] = useState(false)   // layout edit mode (drag + resize)
  const [dragIdx, setDragIdx] = useState(null)
  const [overIdx, setOverIdx] = useState(null)
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
    setArranging(false)
    resetLayout(selectedOrg)
  }
  // Resize a widget within the presets its chart allows (guardrail: single-value
  // tiles never stretch into wasteful wide bands; charts may go up to full width).
  function resizeWidget(i, delta) {
    const w = widgets[i]
    const next = Math.max(1, Math.min(maxWFor(w), (w.w || 1) + delta))
    if (next === (w.w || 1)) return
    persist(widgets.map((x, k) => (k === i ? { ...x, w: next } : x)))
  }
  // Reorder by dropping one card onto another's position.
  function moveWidget(from, to) {
    if (from === to || from == null || to == null) return
    const next = [...widgets]
    const [m] = next.splice(from, 1)
    next.splice(to, 0, m)
    persist(next)
  }

  const periodLabel = (PERIODS.find((p) => p[0] === period) || [])[1]
  const orgName = (orgs.find((o) => o.id === selectedOrg) || {}).name || null

  const cards = widgets.map((w) => w.kind === 'measure'
    ? { id: uid(w), def: MEASURES[w.key], w: w.w, rows: data[uid(w)], drill: MEASURES[w.key].drill, sliceTo: MEASURES[w.key].sliceTo || null, widget: w }
    : { id: uid(w), def: { label: w.label, unit: w.unit, viz: w.viz, sub: '' }, w: w.w, rows: data[uid(w)], drill: (DIMENSIONS[w.dim]?.sliceTo?.path) || null, sliceTo: DIMENSIONS[w.dim]?.sliceTo || null, widget: w })

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
          {canCustomize && <button className={arranging ? 'auth-button' : 'logout-button'} style={{ width: 'auto', margin: 0 }} onClick={() => setArranging((a) => !a)}>{arranging ? 'Done arranging' : 'Arrange'}</button>}
          {canCustomize && customized && <button className="logout-button" style={{ margin: 0 }} onClick={resetToDefault}>Reset to default</button>}
        </div>
      </div>

      {isSuperAdmin && (
        <div style={{ marginBottom: 18, maxWidth: 360 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      <div style={{ marginBottom: 16 }}><QuincyBrief kind="home" org={selectedOrg} /></div>

      {arranging && (
        <div style={{ background: 'var(--route-blue, #1B3A6B)', color: '#fff', borderRadius: 10, padding: '9px 14px', marginBottom: 12, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <strong>Arranging</strong> — drag any tile to reorder, and use <span style={{ fontWeight: 700 }}>− S/M/L +</span> to resize. Changes save automatically. Press <em>Done arranging</em> when finished.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(244px, 1fr))', gap: 14, marginBottom: 26 }}>
        {cards.map((it, i) => (
          <div key={it.id}
            draggable={arranging}
            onDragStart={arranging ? ((e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); setDragIdx(i) }) : undefined}
            onDragOver={arranging ? ((e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (overIdx !== i) setOverIdx(i) }) : undefined}
            onDrop={arranging ? ((e) => { e.preventDefault(); moveWidget(Number(e.dataTransfer.getData('text/plain')), i); setDragIdx(null); setOverIdx(null) }) : undefined}
            onDragEnd={arranging ? (() => { setDragIdx(null); setOverIdx(null) }) : undefined}
            onClick={() => { if (!arranging && it.drill) navigate(it.drill) }}
            style={{
              gridColumn: 'span ' + (it.w || 1),
              background: 'var(--surface, #fff)',
              border: '1px solid ' + (arranging && overIdx === i && dragIdx !== i ? 'var(--route-blue, #1B3A6B)' : 'var(--border)'),
              borderRadius: 14,
              padding: '16px 18px',
              cursor: arranging ? 'grab' : (it.drill ? 'pointer' : 'default'),
              opacity: arranging && dragIdx === i ? 0.4 : 1,
              boxShadow: arranging && overIdx === i && dragIdx !== i ? '0 0 0 2px var(--route-blue, #1B3A6B) inset' : 'none',
              display: 'flex', flexDirection: 'column', gap: 12, minHeight: 132, transition: 'box-shadow .15s, border-color .15s, opacity .15s',
            }}
            onMouseEnter={(e) => { if (arranging) return; e.currentTarget.style.boxShadow = '0 6px 22px rgba(16,32,47,.10)'; e.currentTarget.style.borderColor = 'var(--route-blue, #1B3A6B)' }}
            onMouseLeave={(e) => { if (arranging) return; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '.02em', textTransform: 'uppercase', color: 'var(--mist)', display: 'flex', alignItems: 'center', gap: 7 }}>
                {arranging && <span aria-hidden title="Drag to reorder" style={{ cursor: 'grab', color: 'var(--mist)', fontSize: 14, letterSpacing: 0 }}>⠿</span>}
                {it.def.label}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {arranging && (
                  <span onClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid var(--border)', borderRadius: 8, padding: '1px 4px' }}>
                    <button title="Smaller" disabled={(it.w || 1) <= 1} onClick={() => resizeWidget(i, -1)} style={{ border: 'none', background: 'none', cursor: (it.w || 1) <= 1 ? 'default' : 'pointer', color: (it.w || 1) <= 1 ? 'var(--border)' : 'var(--route-blue,#1B3A6B)', fontSize: 15, lineHeight: 1, padding: '0 3px', fontWeight: 700 }}>−</button>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--mist)', minWidth: 10, textAlign: 'center' }}>{SIZE_LABEL[it.w || 1]}</span>
                    <button title="Larger" disabled={(it.w || 1) >= maxWFor(it.widget)} onClick={() => resizeWidget(i, 1)} style={{ border: 'none', background: 'none', cursor: (it.w || 1) >= maxWFor(it.widget) ? 'default' : 'pointer', color: (it.w || 1) >= maxWFor(it.widget) ? 'var(--border)' : 'var(--route-blue,#1B3A6B)', fontSize: 15, lineHeight: 1, padding: '0 3px', fontWeight: 700 }}>+</button>
                  </span>
                )}
                {!arranging && (
                  <span onClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex' }}>
                    <AiAssist iconOnly label={'Investigate ' + it.def.label} {...investigateProps(it, { period: periodLabel, orgName })} />
                  </span>
                )}
                {!arranging && it.drill && <span aria-hidden style={{ color: 'var(--mist)', fontSize: 13 }}>↗</span>}
                {canCustomize && <button title="Remove" onClick={(e) => { e.stopPropagation(); removeWidget(it.widget) }} style={{ border: 'none', background: 'none', color: 'var(--mist)', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 0 }}>×</button>}
              </div>
            </div>
            {loading ? <div style={{ color: 'var(--mist)', fontSize: 13 }}>Loading…</div> : (
              <Widget def={it.def} rows={it.rows}
                onSlice={(!arranging && it.sliceTo) ? ((bucket) => navigate(it.sliceTo.path + '?' + it.sliceTo.param + '=' + encodeURIComponent(bucket))) : undefined} />
            )}
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
          Click the ✦ on any tile to <strong>Investigate</strong> — an AI read of what the number is saying, likely drivers, and what to do next.{' '}
          {canCustomize
            ? 'Use “+ Add KPI” to compose your own — pick a measure, a breakdown, and it picks the right chart. “Arrange” lets you drag tiles into any order and size them S/M/L. Remove any tile with ×; “Reset to default” restores the standard board at any time.'
            : 'Ask an administrator to change which KPIs appear.'}
        </div>
      </div>
    </div>
  )
}
