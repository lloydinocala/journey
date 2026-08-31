// Dashboard-HVAC · visualizations. Dependency-free, theme-aware (via the app's
// CSS variables). Each takes a measure def + the tidy rows its RPC returned.
import { fmt } from './dashboardData'

const NAVY = 'var(--route-blue, #1B3A6B)'
const OK = '#166534', BAD = '#B00020', MIST = 'var(--mist, #64748B)'
const val = (rows, bucket) => {
  if (!rows || !rows.length) return null
  const r = bucket ? rows.find((x) => x.bucket === bucket) : rows[0]
  return r ? Number(r.value) : null
}

function StatTile({ def, rows }) {
  const v = val(rows)
  return (
    <div>
      <div style={{ fontSize: 30, fontWeight: 800, color: NAVY, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>{fmt(def.unit, v)}</div>
      <div style={{ fontSize: 12.5, color: MIST, marginTop: 6 }}>{def.sub}</div>
    </div>
  )
}

function Gauge({ def, rows }) {
  const v = val(rows) ?? 0
  const clamp = Math.max(0, Math.min(100, v))
  const target = def.target ?? null
  const pass = target == null ? true : (def.targetDir === 'floor' ? v >= target : v <= target)
  const arc = pass ? OK : BAD
  const tf = target != null ? (180 * (1 - target / 100)) * Math.PI / 180 : null
  const tx = target != null ? 80 + 64 * Math.cos(tf) : 0
  const ty = target != null ? 80 - 64 * Math.sin(tf) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexDirection: 'column' }}>
      <svg viewBox="0 0 160 96" width="100%" style={{ maxWidth: 200 }} role="img" aria-label={`${def.label} ${fmt('percent', v)}`}>
        <path d="M 16 80 A 64 64 0 0 1 144 80" fill="none" stroke="var(--border, #E2E8F0)" strokeWidth="12" strokeLinecap="round" />
        <path d="M 16 80 A 64 64 0 0 1 144 80" fill="none" stroke={arc} strokeWidth="12" strokeLinecap="round" pathLength="100" strokeDasharray={`${clamp} 100`} />
        {target != null && <circle cx={tx} cy={ty} r="4" fill={NAVY} stroke="#fff" strokeWidth="1.5" />}
        <text x="80" y="72" textAnchor="middle" style={{ fontSize: 26, fontWeight: 800, fill: arc }}>{Math.round(v * 10) / 10}%</text>
      </svg>
      <div style={{ fontSize: 12, color: MIST }}>{def.sub}{target != null && ` · ${pass ? 'on target' : 'below target'}`}</div>
    </div>
  )
}

function BarList({ def, rows, onSlice }) {
  let data = (rows || []).filter((r) => Number(r.value) > 0)
  if (data.length > 8) {
    const top = data.slice(0, 7)
    const other = data.slice(7).reduce((s, r) => s + Number(r.value), 0)
    data = [...top, { bucket: 'Other', value: other }]
  }
  const max = Math.max(1, ...data.map((r) => Number(r.value)))
  if (!data.length) return <Empty />
  // A row is drillable when a slice handler is wired and the bucket is a real
  // category (not the aggregated "Other" roll-up, which isn't a single filter).
  const canSlice = (r) => !!onSlice && r.bucket !== 'Other'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {data.map((r) => (
        <div key={r.bucket}
          onClick={canSlice(r) ? ((e) => { e.stopPropagation(); onSlice(r.bucket) }) : undefined}
          title={canSlice(r) ? `See ${r.bucket}` : undefined}
          style={{ cursor: canSlice(r) ? 'pointer' : 'default', borderRadius: 6 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}>
            <span style={{ color: canSlice(r) ? 'var(--route-blue, #1B3A6B)' : 'var(--ink, #1F2A37)', fontWeight: 600, textDecoration: canSlice(r) ? 'underline dotted' : 'none', textUnderlineOffset: 2 }}>{r.bucket}</span>
            <span style={{ color: MIST, fontVariantNumeric: 'tabular-nums' }}>{fmt(def.unit, r.value)}</span>
          </div>
          <div style={{ height: 8, background: 'var(--border, #EEF1F6)', borderRadius: 999 }}>
            <div style={{ height: 8, width: `${(Number(r.value) / max) * 100}%`, background: NAVY, borderRadius: 999 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function Estimates({ rows }) {
  const presented = val(rows, 'Presented $') ?? 0
  const sold = val(rows, 'Sold $') ?? 0
  const rate = val(rows, 'Close rate %') ?? 0
  const max = Math.max(1, presented, sold)
  const Bar = ({ label, v, color }) => (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}>
        <span style={{ fontWeight: 600 }}>{label}</span><span style={{ color: MIST }}>{fmt('currency', v)}</span>
      </div>
      <div style={{ height: 10, background: 'var(--border, #EEF1F6)', borderRadius: 999 }}>
        <div style={{ height: 10, width: `${(v / max) * 100}%`, background: color, borderRadius: 999 }} />
      </div>
    </div>
  )
  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Bar label="Presented" v={presented} color={MIST} />
        <Bar label="Sold" v={sold} color={NAVY} />
      </div>
      <div style={{ textAlign: 'center', minWidth: 92 }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: NAVY, fontVariantNumeric: 'tabular-nums' }}>{Math.round(rate * 10) / 10}%</div>
        <div style={{ fontSize: 11.5, color: MIST }}>close rate</div>
      </div>
    </div>
  )
}

function Column({ def, rows }) {
  const data = (rows || []).map((r) => ({ label: r.bucket, v: r.value == null ? null : Number(r.value) }))
  const vals = data.map((d) => d.v).filter((v) => v != null)
  if (!vals.length) return <Empty />
  const target = def.target ?? null
  const max = (Math.max(target ? target * 1.35 : 0, ...vals) || 1) * 1.08
  const ok = (v) => target == null ? true : (def.targetDir === 'ceiling' ? v <= target : v >= target)
  return (
    <div>
      <div style={{ position: 'relative', height: 132, display: 'flex', alignItems: 'flex-end', gap: 6 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', height: '100%' }}>
            {d.v != null && <span style={{ fontSize: 10.5, color: MIST, marginBottom: 2, fontVariantNumeric: 'tabular-nums' }}>{Math.round(d.v)}{def.unit === 'percent' ? '%' : ''}</span>}
            <div style={{ width: '68%', height: d.v == null ? 0 : `${Math.max(2, (d.v / max) * 100)}%`, background: d.v == null ? 'transparent' : (target == null ? NAVY : (ok(d.v) ? OK : BAD)), borderRadius: '4px 4px 0 0' }} />
          </div>
        ))}
        {target != null && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${(target / max) * 100}%`, borderTop: `2px dashed ${NAVY}` }}>
            <span style={{ position: 'absolute', right: 0, top: -15, fontSize: 10, color: NAVY, background: 'var(--surface,#fff)', padding: '0 3px' }}>target {target}%</span>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
        {data.map((d, i) => <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 10.5, color: MIST }}>{d.label}</div>)}
      </div>
    </div>
  )
}

function Flags({ rows }) {
  const data = rows || []
  if (!data.length) return <div style={{ color: OK, fontWeight: 600, fontSize: 13.5 }}>All fuel &amp; mileage readings normal.</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {data.slice(0, 8).map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: r.value >= 2 ? BAD : '#B0600A', flex: '0 0 auto' }} />
          <span>{r.bucket}</span>
        </div>
      ))}
      {data.length > 8 && <div style={{ fontSize: 11.5, color: MIST }}>+{data.length - 8} more</div>}
    </div>
  )
}

function Empty() {
  return <div style={{ color: MIST, fontSize: 13, padding: '10px 0' }}>Not enough data yet.</div>
}

export default function Widget({ def, rows, onSlice }) {
  if (def.viz === 'tile') return <StatTile def={def} rows={rows} />
  if (def.viz === 'gauge') return <Gauge def={def} rows={rows} />
  if (def.viz === 'bars') return <BarList def={def} rows={rows} onSlice={onSlice} />
  if (def.viz === 'estimates') return <Estimates rows={rows} />
  if (def.viz === 'column') return <Column def={def} rows={rows} />
  if (def.viz === 'flags') return <Flags rows={rows} />
  return <Empty />
}
