import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import { METRIC_GROUPS, METRIC_BY_KEY, computeMetrics, fmtMetric } from './kpiMetrics'

const C = { green: '#2E7D52', red: '#B5462F', teal: '#176E7A', slate: '#64748B', amber: '#9C6A12', ink: '#1C2430', faint: '#98A2AD' }

const COMPARISONS = [
  { key: 'vs', label: 'vs — % change', hint: 'How Unit 1 compares to Unit 2 (year-over-year, etc.)' },
  { key: 'ratio', label: '÷ per — a rate', hint: 'Unit 1 divided by Unit 2 (e.g. revenue per job)' },
  { key: 'share', label: '% of — share', hint: 'Unit 1 as a percentage of Unit 2' },
  { key: 'single', label: 'single — one number', hint: 'Just Unit 1 on its own, no comparison' },
]

function autoLabel(u1, u2, comp) {
  const l1 = METRIC_BY_KEY[u1]?.label, l2 = METRIC_BY_KEY[u2]?.label
  if (!l1) return ''
  if (comp === 'single' || !l2) return l1
  if (comp === 'ratio') return `${l1} per ${l2}`
  if (comp === 'share') return `${l1} as % of ${l2}`
  return `${l1} vs ${l2}`
}

export function computeCard(kpi, vals) {
  const m1 = METRIC_BY_KEY[kpi.unit1_key], m2 = METRIC_BY_KEY[kpi.unit2_key]
  const u1 = Number(vals[kpi.unit1_key] || 0), u2 = Number(vals[kpi.unit2_key] || 0)
  const title = kpi.label || (m1 ? m1.label : 'KPI')
  if (kpi.comparison === 'single' || !m2) return { title, value: fmtMetric(u1, m1?.format), sub: m1?.label, accent: C.teal }
  if (kpi.comparison === 'ratio') {
    const q = u2 ? u1 / u2 : 0
    return { title, value: fmtMetric(q, m1?.format === 'currency' ? 'currency' : 'number'), sub: `${m1?.label} per ${m2?.label}`, accent: C.teal }
  }
  if (kpi.comparison === 'share') {
    const pct = u2 ? (u1 / u2) * 100 : 0
    return { title, value: pct.toFixed(1) + '%', sub: `of ${m2?.label}`, accent: C.teal }
  }
  const delta = u2 ? ((u1 - u2) / u2) * 100 : null
  const up = delta != null && delta >= 0
  const good = up === (kpi.direction !== 'lower_better')
  return { title, value: fmtMetric(u1, m1?.format), sub: `vs ${m2?.label}`, badge: delta == null ? '\u2014' : `${up ? '+' : ''}${delta.toFixed(1)}%`, badgeColor: good ? C.green : C.red, accent: good ? C.green : C.red }
}

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
  const [u1, setU1] = useState('')
  const [comp, setComp] = useState('vs')
  const [u2, setU2] = useState('')
  const [dir, setDir] = useState('higher_better')
  const [dash, setDash] = useState('both')
  const [label, setLabel] = useState('')
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [vals, setVals] = useState(null)

  useEffect(() => { if (org) computeMetrics(org).then(setVals) }, [org])

  const effLabel = touched ? label : autoLabel(u1, comp, comp === 'single' ? '' : u2) // eslint-disable-line
  const autoL = autoLabel(u1, u2, comp)
  const preview = u1 ? computeCard({ label: touched ? label : autoL, unit1_key: u1, unit2_key: u2, comparison: comp, direction: dir }, vals || {}) : null

  async function save() {
    if (!u1 || (comp !== 'single' && !u2)) return
    setSaving(true)
    const { error } = await supabase.from('custom_kpis').insert({
      org_id: org, label: (touched ? label : autoL) || null, unit1_key: u1, unit2_key: comp === 'single' ? null : u2,
      comparison: comp, dashboards: dash, direction: dir,
    })
    setSaving(false)
    if (!error) { onSaved && onSaved(); onClose() }
  }

  const field = { marginBottom: 14 }
  const lbl = { fontSize: 12, fontWeight: 700, color: C.slate, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 5, display: 'block' }

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

        {comp === 'vs' && (
          <div style={field}>
            <label style={lbl}>Good direction</label>
            <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {[['higher_better', 'Higher is better'], ['lower_better', 'Lower is better']].map(([v, l]) => (
                <button key={v} onClick={() => setDir(v)} style={{ border: 'none', cursor: 'pointer', padding: '7px 13px', fontSize: 12.5, fontWeight: dir === v ? 700 : 500, background: dir === v ? C.teal : 'transparent', color: dir === v ? '#fff' : C.slate }}>{l}</button>
              ))}
            </div>
          </div>
        )}

        <div style={field}>
          <label style={lbl}>Show on</label>
          <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {[['financial', 'Financial'], ['admin', 'Admin'], ['both', 'Both']].map(([v, l]) => (
              <button key={v} onClick={() => setDash(v)} style={{ border: 'none', cursor: 'pointer', padding: '7px 14px', fontSize: 12.5, fontWeight: dash === v ? 700 : 500, background: dash === v ? C.teal : 'transparent', color: dash === v ? '#fff' : C.slate }}>{l}</button>
            ))}
          </div>
        </div>

        <div style={field}>
          <label style={lbl}>Label</label>
          <input value={touched ? label : autoL} onChange={(e) => { setTouched(true); setLabel(e.target.value) }} placeholder="Auto from your choices" style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 }} />
        </div>

        {preview && (
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Preview</label>
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderTop: `3px solid ${preview.accent}`, borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 0.3, color: C.faint, textTransform: 'uppercase' }}>{preview.title}</span>
                {preview.badge && <span style={{ fontSize: 12, fontWeight: 800, color: preview.badgeColor }}>{preview.badge}</span>}
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: preview.accent, margin: '3px 0 1px' }}>{preview.value}</div>
              <div style={{ fontSize: 12, color: 'var(--mist)' }}>{preview.sub}</div>
            </div>
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

// The section rendered on a dashboard: the saved KPI cards + a +Add KPI opener.
export default function CustomKpis({ org, dashboard, canManage }) {
  const [kpis, setKpis] = useState([])
  const [vals, setVals] = useState(null)
  const [maker, setMaker] = useState(false)

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
          {kpis.map((k) => {
            const card = computeCard(k, vals || {})
            return (
              <div key={k.id} style={{ position: 'relative', background: '#fff', border: '1px solid var(--border)', borderTop: `3px solid ${card.accent}`, borderRadius: 12, padding: '13px 15px', boxShadow: '0 1px 3px rgba(20,30,50,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 0.3, color: C.faint, textTransform: 'uppercase', lineHeight: 1.25 }}>{card.title}</span>
                  {card.badge && <span style={{ fontSize: 12.5, fontWeight: 800, color: card.badgeColor, whiteSpace: 'nowrap' }}>{card.badge}</span>}
                </div>
                <div style={{ fontSize: 25, fontWeight: 800, color: card.accent, margin: '4px 0 2px', letterSpacing: -0.5 }}>{vals ? card.value : '…'}</div>
                <div style={{ fontSize: 12.5, color: 'var(--mist)' }}>{card.sub}</div>
                {canManage && <button onClick={() => remove(k.id)} title="Remove" style={{ position: 'absolute', top: 8, right: 9, border: 'none', background: 'transparent', color: C.faint, cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>×</button>}
              </div>
            )
          })}
        </div>
      )}

      {maker && <KpiMaker org={org} onClose={() => setMaker(false)} onSaved={loadKpis} />}
    </div>
  )
}
