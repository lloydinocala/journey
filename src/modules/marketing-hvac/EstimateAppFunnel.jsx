import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabase'

// Estimate App visitors → quotes → bookings, logged by the customer Estimate Apps themselves
// (estimate_app_events, one row per step per visit). Vercel's own analytics is linked as a
// second source for raw traffic.
const AIR_CARE = '7194773e-a5fd-4666-bb32-2a70e736e7fb'
const VERCEL_ANALYTICS = { [AIR_CARE]: 'https://vercel.com/ventexiq/air-care-connect-estimate-app/analytics' }

const PERIODS = [[7, '7 days'], [30, '30 days'], [90, '90 days']]
const APPS = [['', 'Both apps'], ['duct', 'Duct Cleaning'], ['system', 'Systems']]
const pct = (n, of) => (of ? Math.round((n / of) * 100) + '%' : '—')
const SOURCE_LABEL = { facebook: 'Facebook', google: 'Google', direct: 'Direct / typed in', website: 'Your website', 'other search': 'Other search' }

export default function EstimateAppFunnel({ orgId }) {
  const [days, setDays] = useState(30)
  const [app, setApp] = useState('')
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!orgId) return
    let live = true
    setD(null); setErr('')
    supabase.rpc('estimate_app_funnel', { p_org: orgId, p_days: days, p_app: app || null }).then(({ data, error }) => {
      if (!live) return
      if (error) setErr(error.message); else setD(data)
    })
    return () => { live = false }
  }, [orgId, days, app])

  const vercel = VERCEL_ANALYTICS[orgId]
  const steps = d ? [
    ['Visitors', d.visitors, 'opened the app'],
    ['Started', d.started, 'entered an address'],
    ['Saw a quote', d.quoted, 'reached their price'],
    ['Approved quote', d.approved, 'went on to pick a day'],
    ['Asked for in-person estimate', d.estimate_requested, 'duct app'],
    ['Emailed quote to themselves', d.emailed, 'for later'],
    ['Booked a job', d.booked, 'confirmed on the calendar'],
    ['Booked an estimate visit', d.estimates_booked, 'confirmed on the calendar'],
  ] : []
  const max = d ? Math.max(1, d.visitors) : 1
  const dev = d?.devices || {}
  const devTotal = Object.values(dev).reduce((a, b) => a + Number(b || 0), 0)

  return (
    <div className="card mb16">
      <div className="card-head" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h3>Estimate App visitors</h3>
        <span className="sub">visit → quote → booking</span>
        <div className="spacer" />
        <div className="seg">{APPS.map(([k, l]) => <button key={k || 'all'} type="button" className={app === k ? 'on' : ''} onClick={() => setApp(k)}>{l}</button>)}</div>
        <div className="seg">{PERIODS.map(([k, l]) => <button key={k} type="button" className={days === k ? 'on' : ''} onClick={() => setDays(k)}>{l}</button>)}</div>
        {vercel && <a className="btn" href={vercel} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>Open Vercel Analytics ↗</a>}
      </div>
      <div className="card-body">
        {err ? <p className="muted" style={{ margin: 0 }}>Couldn't load visitor numbers: {err}</p>
          : !d ? <p className="muted" style={{ margin: 0 }}>Loading…</p>
          : d.visitors === 0 ? <p className="muted" style={{ margin: 0 }}>No visits logged in this period yet. Visits are counted from the day tracking went live (Nov 4, 2026).</p>
          : (
            <>
              <div style={{ display: 'grid', gap: 7, marginBottom: 18 }}>
                {steps.map(([label, n, sub]) => (
                  <div key={label} style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 230px) 1fr 92px', alignItems: 'center', gap: 10, fontSize: 13.5 }}>
                    <div><b>{label}</b><div className="muted" style={{ fontSize: 11.5 }}>{sub}</div></div>
                    <div style={{ background: '#EEF1F5', borderRadius: 6, height: 14, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.max(n ? 2 : 0, (n / max) * 100)}%`, height: '100%', background: '#215F9A', borderRadius: 6 }} />
                    </div>
                    <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}><b>{n}</b> <span className="muted">{label === 'Visitors' ? '' : pct(n, d.visitors)}</span></div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                  <h4 style={{ margin: '0 0 6px', fontSize: 13.5 }}>Where visitors came from</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead><tr style={{ textAlign: 'left', color: '#64748B' }}><th style={{ padding: '4px 0' }}>Source</th><th style={{ textAlign: 'right' }}>Visitors</th><th style={{ textAlign: 'right' }}>Saw quote</th><th style={{ textAlign: 'right' }}>Booked</th></tr></thead>
                    <tbody>
                      {(d.sources || []).map((s) => (
                        <tr key={s.source} style={{ borderTop: '1px solid #EEF1F5' }}>
                          <td style={{ padding: '5px 0' }}>{SOURCE_LABEL[s.source] || s.source}</td>
                          <td style={{ textAlign: 'right' }}>{s.visitors}</td>
                          <td style={{ textAlign: 'right' }}>{s.quoted}</td>
                          <td style={{ textAlign: 'right' }}>{s.booked}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ flex: '0 1 220px' }}>
                  <h4 style={{ margin: '0 0 6px', fontSize: 13.5 }}>Devices</h4>
                  {['mobile', 'desktop', 'tablet', 'unknown'].filter((k) => dev[k]).map((k) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}>
                      <span style={{ textTransform: 'capitalize' }}>{k}</span><span>{dev[k]} <span className="muted">{pct(dev[k], devTotal)}</span></span>
                    </div>
                  ))}
                  <div style={{ fontSize: 13, padding: '8px 0 0' }}>Opened the Comfort Guide: <b>{d.comfort_guide}</b></div>
                </div>
              </div>

              <div className="note" style={{ marginTop: 14 }}>
                <span className="i">i</span>
                <span>Counted by the Estimate Apps themselves — one visitor per browser visit. Vercel's numbers {vercel ? '(button above) ' : ''}count raw page traffic and won't match exactly; ad blockers affect the two differently.</span>
              </div>
            </>
          )}
      </div>
    </div>
  )
}
