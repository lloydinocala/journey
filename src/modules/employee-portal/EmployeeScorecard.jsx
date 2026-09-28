import { useMemo, useState } from 'react'
import { CATEGORY_ORDER, fmtValue, fmtMinimum, isFail, currentQuarter } from '../rewards-hvac/scorecardData'

function priorQuarter(y, q) { return q === 1 ? { y: y - 1, q: 4 } : { y, q: q - 1 } }

// Read-only, printable scorecard for the signed-in employee. Data comes from the
// sc_my_scorecard RPC (own record only). No editing here — this is the mirror the
// employee sees of what their manager recorded.
export default function EmployeeScorecard({ data, onSignOut }) {
  const metrics = data.metrics || []
  const entries = data.entries || []
  const reviews = data.reviews || []
  const enabled = !!data.scorecards_enabled
  const orgName = data.org?.name || ''
  const empName = data.employee?.full_name || 'You'

  const cq = currentQuarter()
  const [year, setYear] = useState(Number(cq.label.slice(0, 4)))
  const [quarter, setQuarter] = useState(Number(cq.label.slice(-1)))
  const curLabel = `${year}-Q${quarter}`
  const pq = priorQuarter(year, quarter)
  const lastLabel = `${pq.y}-Q${pq.q}`

  const valueOf = (metricId, label) => {
    const e = entries.find((x) => x.metric_id === metricId && x.period_label === label)
    return e ? e.value : null
  }
  const review = reviews.find((r) => r.period_label === curLabel) || null

  // Quarters the employee actually has data for, plus the current one.
  const quarters = useMemo(() => {
    const s = new Set(entries.map((e) => e.period_label))
    s.add(curLabel)
    return [...s].sort().reverse()
  }, [entries, curLabel])

  const groups = useMemo(() => {
    const cats = [...new Set([...CATEGORY_ORDER, ...metrics.map((m) => m.category)])]
    return cats.map((cat) => ({ cat, items: metrics.filter((m) => m.category === cat) })).filter((g) => g.items.length)
  }, [metrics])

  const hasData = entries.some((e) => e.period_label === curLabel && e.value != null && e.value !== '')

  return (
    <div className="cp-app">
      <style>{`@media print { .ep-noprint { display: none !important; } .cp-app { background: #fff !important; } .ep-card { box-shadow: none !important; border: none !important; } }`}</style>
      <div className="cp-scroll" style={{ padding: 16 }}>
        <div className="ep-card" style={{ maxWidth: 820, margin: '0 auto', background: '#fff', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
            <div>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', fontWeight: 700 }}>{orgName} · Employee Scorecard</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{empName}</div>
            </div>
            <div className="ep-noprint" style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button className="cp-btn" style={{ width: 'auto', padding: '8px 14px' }} onClick={() => window.print()}>Print</button>
              <button className="cp-btn ghost" style={{ width: 'auto', padding: '8px 14px' }} onClick={onSignOut}>Sign out</button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', margin: '10px 0 6px' }}>
            <label style={{ fontSize: 12, color: '#64748b' }}>Period&nbsp;
              <select value={curLabel} onChange={(e) => { const [y, q] = e.target.value.split('-Q'); setYear(Number(y)); setQuarter(Number(q)) }}
                style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '5px 8px', fontSize: 14 }}>
                {quarters.map((ql) => <option key={ql} value={ql}>{ql.replace('-Q', ' · Q')}</option>)}
              </select>
            </label>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>compared to {lastLabel.replace('-Q', ' Q')}</span>
          </div>

          {!enabled ? (
            <p style={{ color: '#64748b', marginTop: 16 }}>Scorecards aren’t turned on for your company yet.</p>
          ) : groups.length === 0 ? (
            <p style={{ color: '#64748b', marginTop: 16 }}>No scorecard has been set up yet. Check back later.</p>
          ) : !hasData ? (
            <p style={{ color: '#64748b', marginTop: 16 }}>Nothing has been recorded for {curLabel.replace('-Q', ' Q')} yet. Pick another period above, or check back after your review.</p>
          ) : (
            <>
              {groups.map((g) => (
                <div key={g.cat} style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8A93A6', fontWeight: 700, marginBottom: 4 }}>{g.cat}</div>
                  <table className="data-table" style={{ width: '100%', fontSize: 13.5 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left' }}>Metric</th>
                        <th style={{ textAlign: 'right' }}>This period</th>
                        <th style={{ textAlign: 'right' }}>Last</th>
                        <th style={{ textAlign: 'right' }}>Minimum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.items.map((m) => {
                        const cur = valueOf(m.id, curLabel)
                        const last = valueOf(m.id, lastLabel)
                        const miss = isFail(m, cur)
                        return (
                          <tr key={m.id} style={miss ? { background: '#FCF0F0' } : undefined}>
                            <td>{m.name}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: miss ? '#B00020' : '#0f172a' }}>{miss ? '⚠ ' : ''}{fmtValue(m.unit, cur)}</td>
                            <td style={{ textAlign: 'right', color: '#64748b' }}>{fmtValue(m.unit, last)}</td>
                            <td style={{ textAlign: 'right', color: '#64748b' }}>{fmtMinimum(m)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
              <p style={{ color: '#94a3b8', fontSize: 12, marginTop: 10 }}>Highlighted rows are below the accepted minimum.</p>

              {(review?.summary || review?.goals) && (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginTop: 16 }}>
                  <div style={{ fontWeight: 800, marginBottom: 8, color: '#0f172a' }}>Manager notes &amp; goals — {curLabel.replace('-Q', ' Q')}</div>
                  {review?.summary && <div style={{ marginBottom: 10 }}><div style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>Summary</div><div style={{ whiteSpace: 'pre-wrap', color: '#1e293b' }}>{review.summary}</div></div>}
                  {review?.goals && <div><div style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>Goals for next period</div><div style={{ whiteSpace: 'pre-wrap', color: '#1e293b' }}>{review.goals}</div></div>}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
