import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import { METRIC_GROUPS, METRIC_BY_KEY, computeMetrics, fmtMetric } from './kpiMetrics'

const C = { green: '#2E7D52', red: '#B5462F', teal: '#176E7A', slate: '#64748B', amber: '#9C6A12', ink: '#1C2430', faint: '#98A2AD', track: '#EAEEF2' }

const COMPARISONS = [
  { key: 'vs', label: 'vs — % change', hint: 'How Unit 1 compares to Unit 2 (year-over-year, etc.)' },
  { key: 'ratio', label: '÷ per — a rate', hint: 'Unit 1 divided by Unit 2 (e.g. revenue per job)' },
  { key: 'share', label: '% of — share', hint: 'Unit 1 as a percentage of Unit 2' },
  { key: 'single', label: 'single — one number', hint: 'Just Unit 1 on its own, no comparison' },
]
const DISPLAY_MODES = [['text', 'Text'], ['graphic', 'Graphic'], ['both', 'Both']]

function autoLabel(u1, u2, comp) {
  const l1 = METRIC_BY_KEY[u1]?.label, l2 = METRIC_BY_KEY[u2]?.label
  if (!l1) return ''
  if (comp === 'single' || !l2) return l1
  if (comp === 'ratio') return `${l1} per ${l2}`
  if (comp === 'share') return `${l1} as % of ${l2}`
  return `${l1} vs ${l2}`
}
const shortL = (lbl) => (lbl || '').replace('Same Month Last Year', 'Last yr').replace('Last Year Y-T-D', 'Last yr').replace(' Y-T-D', '').replace('This Month', 'This mo')

export function computeCard(kpi, vals) {
  const m1 = METRIC_BY_KEY[kpi.unit1_key], m2 = METRIC_BY_KEY[kpi.unit2_key]
  const u1 = Number(vals[kpi.unit1_key] || 0), u2 = Number(vals[kpi.unit2_key] || 0)
  const title = kpi.label || (m1 ? m1.label : 'KPI')
  if (kpi.comparison === 'single' || !m2) return { title, value: fmtMetric(u1, m1?.format), sub: m1?.label, accent: C.teal, u1, u2 }
  if (kpi.comparison === 'ratio') {
    const q = u2 ? u1 / u2 : 0
    return { title, value: fmtMetric(q, m1?.format === 'currency' ? 'currency' : 'number'), sub: `${m1?.label} per ${m2?.label}`, accent: C.teal, u1, u2 }
  }
  if (kpi.comparison === 'share') {
    const pct = u2 ? (u1 / u2) * 100 : 0
    return { title, value: pct.toFixed(1) + '%', sub: `of ${m2?.label}`, accent: C.teal, pct, u1, u2 }
  }
  const delta = u2 ? ((u1 - u2) / u2) * 100 : null
  if (delta == null) return { title, value: fmtMetric(u1, m1?.format), sub: `vs ${m2?.label}`, badge: 'new', badgeColor: C.slate, accent: C.slate, u1, u2 }
  const up = delta >= 0
  const good = up === (kpi.direction !== 'lower_better')
  return { title, value: fmtMetric(u1, m1?.format), sub: `vs ${m2?.label}`, badge: `${up ? '+' : ''}${delta.toFixed(1)}%`, badgeColor: good ? C.green : C.red, accent: good ? C.green : C.red, u1, u2 }
}

function Donut({ pct, color }) {
  const r = 26, circ = 2 * Math.PI * r
  const off = circ * (1 - Math.min(1, Math.max(0, (pct || 0) / 100)))
  return (
    <svg viewBox="0 0 64 64" width="66" height="66" style={{ display: 'block' }}>
      <circle cx="32" cy="32" r={r} fill="none" stroke={C.track} strokeWidth="8" />
      <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off} transform="rotate(-90 32 32)" />
      <text x="32" y="37" textAnchor="middle" fontSize="15" fontWeight="800" fill={color}>{Math.round(pct || 0)}%</text>
    </svg>
  )
}

function TwoBars({ a, b, la, lb, ca }) {
  const max = Math.max(a, b, 1)
  const h = (v) => `${Math.max(v > 0 ? 5 : 0, (v / max) * 100)}%`
  const bars = [[a, la, ca], [b, lb, C.slate]]
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 62 }}>
      {bars.map(([v, l, c], i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: 34 }}>
          <div style={{ width: '100%', height: 46, display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ width: '100%', height: h(v), background: c, borderRadius: '3px 3px 0 0' }} />
          </div>
          <span style={{ fontSize: 10, color: C.faint, whiteSpace: 'nowrap', maxWidth: 46, overflow: 'hidden', textOverflow: 'ellipsis' }}>{l}</span>
        </div>
      ))}
    </div>
  )
}

function KpiGraphic({ kpi, card }) {
  if (kpi.comparison === 'share') return <Donut pct={card.pct} color={card.accent} />
  if (kpi.comparison === 'vs') {
    const m1 = METRIC_BY_KEY[kpi.unit1_key], m2 = METRIC_BY_KEY[kpi.unit2_key]
    return <TwoBars a={card.u1} b={card.u2} la={shortL(m1?.label)} lb={shortL(m2?.label)} ca={card.accent} />
  }
  return null
}
const hasGraphic = (comp) => comp === 'share' || comp === 'vs'

function MetricSelect({ value, onChange, placeholder }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, background: '#fff' }}>
      <option value="">{placeholder}</option>
      {METRIC_GROUPS.map((g) => (
        <optgroup key={g.group} label={g.group}>
          {g.metrics.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </optgroup>
      ))}
    </select>
  )
}

function KpiMaker({ org, onClose, onSaved }) {
  const [u1, setU1] = useState(''); const [comp, setComp] = useState('vs'); const [u2, setU2] = useState('')
  const [dir, setDir] = useState('higher_better'); const [dash, setDash] = useState('both'); const [display, setDisplay] = useState('both')
  const [label, setLabel] = useState(''); const [touched, setTouched] = useState(false); const [saving, setSaving] = useState(false)
  const [vals, setVals] = useState(null)
  useEffect(() => { if (org) computeMetrics(org).then(setVals) }, [org])

  const autoL = autoLabel(u1, u2, comp)
  const previewKpi = { label: touched ? label : autoL, unit1_key: u1, unit2_key: u2, comparison: comp, direction: dir, display_mode: display }
  const preview = u1 ? computeCard(previewKpi, vals || {}) : null

  async function save() {
    if (!u1 || (comp !== 'single' && !u2)) return
    setSaving(true)
    const { error } = await supabase.from('custom_kpis').insert({
      org_id: org, label: (touched ? label : autoL) || null, unit1_key: u1, unit2_key: comp === 'single' ? null : u2,
      comparison: comp, dashboards: dash, direction: dir, display_mode: display,
    })
    setSaving(false)
    if (!error) { onSaved && onSaved(); onClose() }
  }

  const field = { marginBottom: 14 }
  const lbl = { fontSize: 12, fontWeight: 700, color: C.slate, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 5, display: 'block' }
  const seg = (opts, val, set) => (
    <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      {opts.map(([v, l]) => <button key={v} onClick={() => set(v)} style={{ border: 'none', cursor: 'pointer', padding: '7px 14px', fontSize: 12.5, fontWeight: val === v ? 700 : 500, background: val === v ? C.teal : 'transparent', color: val === v ? '#fff' : C.slate }}>{l}</button>)}
    </div>
  )

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 16px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 480, padding: '20px 22px', boxShadow: '0 20px 60px rgba(15,23,32,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>New KPI</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 22, color: C.faint, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: C.faint }}>Compare one measure against another. Pick two units and how they relate.</p>

        <div style={field}><label style={lbl}>Unit 1</label><MetricSelect value={u1} onChange={setU1} placeholder="Choose a measure…" /></div>

        <div style={field}>
          <label style={lbl}>Compare as</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {COMPARISONS.map((c) => (
              <button key={c.key} onClick={() => setComp(c.key)} style={{ textAlign: 'left', padding: '8px 10px', borderRadius: 8, border: `1px solid ${comp === c.key ? C.teal : 'var(--border)'}`, background: comp === c.key ? '#E7F0F1' : '#fff', cursor: 'pointer', fontSize: 13, fontWeight: comp === c.key ? 700 : 500, color: comp === c.key ? C.teal : C.ink }}>{c.label}</button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: C.faint, marginTop: 6 }}>{COMPARISONS.find((c) => c.key === comp)?.hint}</div>
        </div>

        {comp !== 'single' && <div style={field}><label style={lbl}>Unit 2</label><MetricSelect value={u2} onChange={setU2} placeholder="Choose a measure…" /></div>}

        {comp === 'vs' && <div style={field}><label style={lbl}>Good direction</label>{seg([['higher_better', 'Higher is better'], ['lower_better', 'Lower is better']], dir, setDir)}</div>}

        <div style={field}><label style={lbl}>Display as</label>{seg(DISPLAY_MODES, display, setDisplay)}
          {display !== 'text' && !hasGraphic(comp) && <div style={{ fontSize: 11.5, color: C.amber, marginTop: 5 }}>Per-rate and single KPIs have no chart — they'll show as a number.</div>}
        </div>

        <div style={field}><label style={lbl}>Show on</label>{seg([['financial', 'Financial'], ['admin', 'Admin'], ['both', 'Both']], dash, setDash)}</div>

        <div style={field}><label style={lbl}>Label</label>
          <input value={touched ? label : autoL} onChange={(e) => { setTouched(true); setLabel(e.target.value) }} placeholder="Auto from your choices" style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 }} />
        </div>

        {preview && (
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Preview</label>
            <KpiCard kpi={previewKpi} card={preview} ready={!!vals} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Cancel</button>
          <button onClick={save} disabled={saving || !u1 || (comp !== 'single' && !u2)} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: (!u1 || (comp !== 'single' && !u2)) ? '#B8C4CE' : C.teal, color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>{saving ? 'Saving…' : 'Add KPI'}</button>
        </div>
      </div>
    </div>
  )
}

function KpiCard({ kpi, card, ready, onRemove }) {
  const mode = kpi.display_mode || 'text'
  const graphic = hasGraphic(kpi.comparison)
  const showValue = mode === 'text' || mode === 'both' || (mode === 'graphic' && !graphic)
  const showGraphic = (mode === 'graphic' || mode === 'both') && graphic
  return (
    <div style={{ position: 'relative', background: '#fff', border: '1px solid var(--border)', borderTop: `3px solid ${card.accent}`, borderRadius: 12, padding: '13px 15px', boxShadow: '0 1px 3px rgba(20,30,50,0.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 0.3, color: C.faint, textTransform: 'uppercase', lineHeight: 1.25 }}>{card.title}</span>
        {card.badge && <span style={{ fontSize: 12.5, fontWeight: 800, color: card.badgeColor, whiteSpace: 'nowrap' }}>{card.badge}</span>}
      </div>
      {showGraphic && <div style={{ display: 'flex', justifyContent: 'center', margin: showValue ? '10px 0 6px' : '12px 0 8px' }}>{ready ? <KpiGraphic kpi={kpi} card={card} /> : <div style={{ height: 62 }} />}</div>}
      {showValue && <div style={{ fontSize: 25, fontWeight: 800, color: card.accent, margin: '4px 0 2px', letterSpacing: -0.5, textAlign: showGraphic ? 'center' : 'left' }}>{ready ? card.value : '…'}</div>}
      <div style={{ fontSize: 12.5, color: 'var(--mist)', textAlign: showGraphic && !showValue ? 'center' : 'left' }}>{card.sub}</div>
      {onRemove && <button onClick={onRemove} title="Remove" style={{ position: 'absolute', top: 8, right: 9, border: 'none', background: 'transparent', color: C.faint, cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>×</button>}
    </div>
  )
}

export default function CustomKpis({ org, dashboard, canManage }) {
  const [kpis, setKpis] = useState([]); const [vals, setVals] = useState(null); const [maker, setMaker] = useState(false)

  async function loadKpis() {
    if (!org) return
    const { data } = await supabase.from('custom_kpis').select('*').eq('org_id', org).eq('is_active', true).in('dashboards', dashboard === 'both' ? ['both'] : [dashboard, 'both']).order('sort_order').order('created_at')
    setKpis(data || [])
  }
  useEffect(() => { loadKpis(); computeMetrics(org).then(setVals) }, [org, dashboard]) // eslint-disable-line

  async function remove(id) {
    await supabase.from('custom_kpis').update({ is_active: false }).eq('id', id)
    setKpis((x) => x.filter((k) => k.id !== id))
  }
  if (!kpis.length && !canManage) return null

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.2, margin: 0 }}>Custom KPIs</h3>
          <p style={{ margin: '3px 0 0', fontSize: 12.5, color: C.faint }}>Your own measures — one unit against another.</p>
        </div>
        {canManage && <button onClick={() => setMaker(true)} style={{ padding: '7px 13px', borderRadius: 8, border: `1px solid ${C.teal}`, background: '#fff', color: C.teal, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>+ Add KPI</button>}
      </div>

      {kpis.length === 0 ? (
        <div style={{ background: '#F6F8FA', border: '1px dashed var(--border)', borderRadius: 12, padding: '18px', fontSize: 13.5, color: C.faint }}>
          No custom KPIs yet. {canManage && 'Click + Add KPI to build one — e.g. “Sales Y-T-D vs Last Year”.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {kpis.map((k) => <KpiCard key={k.id} kpi={k} card={computeCard(k, vals || {})} ready={!!vals} onRemove={canManage ? () => remove(k.id) : null} />)}
        </div>
      )}
      {maker && <KpiMaker org={org} onClose={() => setMaker(false)} onSaved={loadKpis} />}
    </div>
  )
}
