// Dashboard-HVAC · KPI builder (P1). The guided funnel: pick a measure → only
// its compatible breakdowns → the chart that fits → live preview → add. Bad
// combinations are never offerable, so no broken KPI can be built.
import { useState, useEffect } from 'react'
import { BASE_MEASURES, DIMENSIONS, VIZ_FOR_SHAPE } from './catalog'
import { queryKpi } from './dashboardData'
import Widget from './charts'

function titleFor(measure, dim) {
  const m = BASE_MEASURES[measure], d = DIMENSIONS[dim]
  return m.label + (d.short ? ' ' + d.short : '')
}

export default function KpiBuilder({ org, range, onAdd, onClose }) {
  const [measure, setMeasure] = useState('revenue')
  const [dim, setDim] = useState('none')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  const mDef = BASE_MEASURES[measure]
  const dims = mDef.dims
  const shape = DIMENSIONS[dim].shape
  const viz = VIZ_FOR_SHAPE[shape]
  const title = titleFor(measure, dim)
  const def = { label: title, unit: mDef.unit, viz, sub: '' }

  // Keep the breakdown valid when the measure changes.
  useEffect(() => { if (!mDef.dims.includes(dim)) setDim('none') }, [measure]) // eslint-disable-line

  useEffect(() => {
    let alive = true
    setLoading(true)
    queryKpi(org, measure, dim, range).then((r) => { if (alive) { setRows(r); setLoading(false) } })
    return () => { alive = false }
  }, [org, measure, dim, range.start, range.end])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 4000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '6vh 16px', overflowY: 'auto' }} onClick={onClose}>
      <div style={{ background: 'var(--surface, #fff)', borderRadius: 16, width: '100%', maxWidth: 580, boxShadow: '0 24px 60px rgba(0,0,0,.35)', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Build a KPI</h3>
          <button className="logout-button" onClick={onClose}>Close</button>
        </div>

        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
              <label>Data — what to measure</label>
              <select value={measure} onChange={(e) => setMeasure(e.target.value)}>
                {Object.entries(BASE_MEASURES).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
              <label>Break down — how to slice it</label>
              <select value={dim} onChange={(e) => setDim(e.target.value)}>
                {dims.map((k) => <option key={k} value={k}>{DIMENSIONS[k].label}</option>)}
              </select>
            </div>
          </div>

          <div style={{ fontSize: 12.5, color: 'var(--mist)' }}>
            Best shown as a <strong style={{ color: 'var(--route-blue,#1B3A6B)' }}>{viz === 'tile' ? 'number tile' : viz === 'bars' ? 'bar chart' : 'column chart'}</strong> — chosen automatically to fit the data.
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--mist)', marginBottom: 10 }}>Live preview</div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px', minHeight: 120 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '.02em', textTransform: 'uppercase', color: 'var(--mist)', marginBottom: 10 }}>{title}</div>
              {loading ? <div style={{ color: 'var(--mist)', fontSize: 13 }}>Loading…</div> : <Widget def={def} rows={rows} />}
            </div>
          </div>
        </div>

        <div style={{ padding: '16px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="logout-button" onClick={onClose}>Cancel</button>
          <button className="auth-button" style={{ width: 'auto', margin: 0 }}
            onClick={() => onAdd({ id: 'k' + Date.now(), measure, dim, unit: mDef.unit, viz, label: title, w: shape === 'scalar' ? 1 : 2 })}>
            Add to dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
