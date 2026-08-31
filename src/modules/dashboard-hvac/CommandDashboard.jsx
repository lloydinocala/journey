// Dashboard-HVAC · the live default board (P0). Renders the default template's
// KPIs from the aggregation RPCs. Read-only for now; per-widget customization
// (the builder + template model) lands in a later phase.
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import OrgPicker from '../../OrgPicker'
import { MEASURES, DEFAULT_TEMPLATE } from './catalog'
import { fetchMeasure, periodRange, PERIODS } from './dashboardData'
import Widget from './charts'

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
  const navigate = useNavigate()

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
      const entries = await Promise.all(
        DEFAULT_TEMPLATE.map(async (w) => [w.key, await fetchMeasure(MEASURES[w.key], selectedOrg, range)])
      )
      if (!alive) return
      setData(Object.fromEntries(entries))
      setLoading(false)
    }
    load()
    return () => { alive = false }
  }, [selectedOrg, period])

  const periodLabel = (PERIODS.find((p) => p[0] === period) || [])[1]

  return (
    <div>
      <div className="page-header-bar" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2 className="page-title" style={{ margin: 0 }}>Dashboard</h2>
          <div style={{ color: 'var(--mist)', fontSize: 13, marginTop: 2 }}>Your business at a glance · {periodLabel}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Period</label>
            <select value={period} onChange={(e) => setPeriod(e.target.value)}>
              {PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
      </div>

      {isSuperAdmin && (
        <div style={{ marginBottom: 18, maxWidth: 360 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(244px, 1fr))', gap: 14, marginBottom: 26 }}>
        {DEFAULT_TEMPLATE.map((w) => {
          const def = MEASURES[w.key]
          const rows = data[w.key]
          return (
            <div key={w.key}
              onClick={() => def.drill && navigate(def.drill)}
              style={{
                gridColumn: w.w === 2 ? 'span 2' : 'span 1',
                background: 'var(--surface, #fff)', border: '1px solid var(--border)', borderRadius: 14,
                padding: '16px 18px', cursor: def.drill ? 'pointer' : 'default',
                display: 'flex', flexDirection: 'column', gap: 12, minHeight: 132, transition: 'box-shadow .15s, border-color .15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 6px 22px rgba(16,32,47,.10)'; e.currentTarget.style.borderColor = 'var(--route-blue, #1B3A6B)' }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '.02em', textTransform: 'uppercase', color: 'var(--mist)' }}>{def.label}</div>
                {def.drill && <span aria-hidden style={{ color: 'var(--mist)', fontSize: 13 }}>↗</span>}
              </div>
              {loading ? <div style={{ color: 'var(--mist)', fontSize: 13 }}>Loading…</div> : <Widget def={def} rows={rows} />}
            </div>
          )
        })}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--mist)', marginBottom: 10 }}>Jump to a section</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {SECTIONS.map(([label, to]) => (
            <Link key={to} to={to} className="nav-link" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 13px', fontSize: 13.5 }}>{label}</Link>
          ))}
        </div>
        <div style={{ color: 'var(--mist)', fontSize: 12, marginTop: 14 }}>This is the default board. Widget customization — pick your own KPIs and rearrange — arrives in a later pass.</div>
      </div>
    </div>
  )
}
