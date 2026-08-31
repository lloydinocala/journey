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

function BarList({ def, rows }) {
  let data = (rows || []).filter((r) => Number(r.value) > 0)
  if (data.length > 8) {
    const top = data.slice(0, 7)
    const other = data.slice(7).reduce((s, r) => s + Number(r.value), 0)
    data = [...top, { bucket: 'Other', value: other }]
  }
  const max = Math.max(1, ...data.map((r) => Number(r.value)))
  if (!data.length) return <Empty />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {data.map((r) => (
        <div key={r.bucket}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}>
            <span style={{ color: 'var(--ink, #1F2A37)', fontWeight: 600 }}>{r.bucket}</span>
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

function Empty() {
  return <div style={{ color: MIST, fontSize: 13, padding: '10px 0' }}>Not enough data yet.</div>
}

export default function Widget({ def, rows }) {
  if (def.viz === 'tile') return <StatTile def={def} rows={rows} />
  if (def.viz === 'gauge') return <Gauge def={def} rows={rows} />
  if (def.viz === 'bars') return <BarList def={def} rows={rows} />
  if (def.viz === 'estimates') return <Estimates rows={rows} />
  return <Empty />
}
