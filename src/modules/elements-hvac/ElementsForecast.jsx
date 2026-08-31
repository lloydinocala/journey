// Elements-HVAC · P5e · Demand Forecast
// Projects each part's usage from trailing consumption into a daily/monthly rate,
// days of cover at current on-hand, a run-out date, and a suggested order qty to
// reach a coverage target. A trend arrow flags demand that's rising or easing.
import { useState, useEffect, useMemo } from 'react'
import { forecast } from './data'
import { useOrgSelector, OrgBar } from './shared'
import AiAssist from '../../AiAssist'

const FORECAST_SYS = 'You are helping an HVAC inventory manager read a parts demand forecast. Using only the rows provided, give a short narrative: which parts are about to run out and when, which need ordering now and roughly how much, and any patterns worth noting. Be specific with part names and numbers. Under 8 short lines. No headers.'

const money = (n) => (n == null || isNaN(n) ? '—' : `$${Number(n).toFixed(2)}`)
const HISTORY = [[90, 'last 90 days'], [180, 'last 6 months'], [365, 'last year'], [3650, 'all history']]
const TARGET = [[30, '30 days'], [60, '60 days'], [90, '90 days']]

function coverColor(days, onHand) {
  if (onHand <= 0) return { bg: '#FBE7E7', c: '#B00020' }
  if (days == null) return { bg: '#EEF1F6', c: '#475569' }
  if (days <= 14) return { bg: '#FBE7E7', c: '#B00020' }
  if (days <= 30) return { bg: '#F8EEDD', c: '#B0600A' }
  return { bg: '#E3F1E8', c: '#166534' }
}
function runOutText(days, onHand) {
  if (onHand <= 0) return 'now'
  if (days == null) return '—'
  const d = new Date(); d.setDate(d.getDate() + Math.round(days))
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ElementsForecast({ profile }) {
  const org = useOrgSelector(profile)
  const [raw, setRaw] = useState([])
  const [days, setDays] = useState(90)
  const [target, setTarget] = useState(60)
  const [loading, setLoading] = useState(false)

  async function load() {
    if (!org.selectedOrg) return
    setLoading(true)
    setRaw(await forecast(days))
    setLoading(false)
  }
  useEffect(() => { load() }, [org.selectedOrg, days])

  const rows = useMemo(() => {
    const spanDays = Math.min(days, 3650)
    return raw.map((r) => {
      const usedPeriod = Number(r.used_period || 0)
      const used30 = Number(r.used_30 || 0)
      const onHand = Number(r.on_hand || 0)
      const daily = usedPeriod / spanDays
      const monthly = daily * 30.4
      const daysCover = daily > 0 ? (onHand > 0 ? onHand / daily : 0) : null
      const suggest = Math.max(0, Math.ceil(daily * target - onHand))
      const recentDaily = used30 / 30
      const trend = (spanDays > 45 && daily > 0) ? recentDaily / daily : null // ratio recent vs period
      return { ...r, onHand, daily, monthly, daysCover, suggest, trend }
    }).sort((a, b) => {
      // Most urgent first: out of stock, then fewest days of cover.
      const ax = a.onHand <= 0 ? -1 : (a.daysCover == null ? Infinity : a.daysCover)
      const bx = b.onHand <= 0 ? -1 : (b.daysCover == null ? Infinity : b.daysCover)
      return ax - bx
    })
  }, [raw, days, target])

  const needing = rows.filter((r) => r.suggest > 0).length

  function Trend({ t }) {
    if (t == null) return <span style={{ color: '#CBD5E1' }}>—</span>
    if (t >= 1.3) return <span style={{ color: '#B0600A', fontWeight: 600 }}>↑ rising</span>
    if (t <= 0.7) return <span style={{ color: '#166534', fontWeight: 600 }}>↓ easing</span>
    return <span style={{ color: '#64748B' }}>→ steady</span>
  }

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Demand Forecast</h2>
          {needing > 0 && <span className="badge" style={{ background: '#F8EEDD', color: '#B0600A' }}>{needing} to order</span>}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div className="field" style={{ marginBottom: 0 }}><label>Based on</label>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))}>{HISTORY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}><label>Cover</label>
            <select value={target} onChange={(e) => setTarget(Number(e.target.value))}>{TARGET.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </div>
        </div>
      </div>
      <OrgBar {...org} />

      <div style={{ marginBottom: 16 }}>
        <AiAssist inline title="Forecast summary" label="✨ AI: explain this forecast"
          system={FORECAST_SYS}
          prompt="Summarize what this demand forecast is telling me and what to order now."
          context={{ rows: rows.slice(0, 40) }} />
      </div>

      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0, maxWidth: 820 }}>
        Projected from how fast each part has actually been used (via Record Parts Used). "Days of cover" is how long today's
        on-hand lasts at the recent rate; "order to cover" is what to buy to have {target} days on hand. The more usage history
        builds up, the sharper these get.
      </p>

      {loading ? (
        <div style={{ border: '1px dashed #CBD5E1', borderRadius: 12, padding: '40px 24px', textAlign: 'center', color: 'var(--mist)' }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ border: '1px dashed #CBD5E1', borderRadius: 12, padding: '40px 24px', textAlign: 'center', color: 'var(--mist)' }}>
          Not enough usage yet to forecast. As parts get recorded as used, the parts that move will show up here with a projected run-out.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--line, #E2E8F0)', borderRadius: 10 }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Item</th>
                <th style={{ textAlign: 'right' }}>Usage /mo</th>
                <th style={{ textAlign: 'right' }}>On hand</th>
                <th style={{ width: 110 }}>Days of cover</th>
                <th>Runs out</th>
                <th style={{ width: 110 }}>Trend</th>
                <th style={{ textAlign: 'right', width: 120 }}>Order to cover {target}d</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const col = coverColor(r.daysCover, r.onHand)
                return (
                  <tr key={r.item_id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#152238' }}>{r.description}</div>
                      <div style={{ fontSize: 11, color: 'var(--mist)' }}>{r.category || 'Uncategorized'}</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>{r.monthly.toFixed(r.monthly < 10 ? 1 : 0)}</td>
                    <td style={{ textAlign: 'right', color: r.onHand <= 0 ? '#B00020' : '#152238', fontWeight: r.onHand <= 0 ? 600 : 400 }}>{r.onHand}</td>
                    <td>{r.onHand <= 0
                      ? <span className="badge" style={{ background: col.bg, color: col.c }}>out</span>
                      : (r.daysCover == null ? <span style={{ color: 'var(--mist)' }}>—</span>
                        : <span className="badge" style={{ background: col.bg, color: col.c }}>{Math.round(r.daysCover)} d</span>)}</td>
                    <td style={{ color: r.onHand <= 0 ? '#B00020' : '#334155', fontSize: 13 }}>{runOutText(r.daysCover, r.onHand)}</td>
                    <td><Trend t={r.trend} /></td>
                    <td style={{ textAlign: 'right', fontWeight: r.suggest > 0 ? 700 : 400, color: r.suggest > 0 ? '#1B3A6B' : 'var(--mist)' }}>
                      {r.suggest > 0 ? r.suggest : '—'}
                      {r.suggest > 0 && r.unit_cost != null && <div style={{ fontSize: 11, color: 'var(--mist)', fontWeight: 400 }}>~{money(r.suggest * Number(r.unit_cost))}</div>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ fontSize: 11.5, color: 'var(--mist)', marginTop: 10 }}>
        Rates are a simple trailing average, not seasonal — with a full year of history they sharpen considerably. Trend compares the last 30 days against the whole window. Special-order parts are excluded.
      </p>
    </div>
  )
}
