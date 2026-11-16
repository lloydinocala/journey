import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './utils/supabase'

// Trade-show screen (super admin only, full screen on a TV).
// Shows the demo company's calendar filling in live as Clara books calls, plus "on a call now".
// Callers' numbers are masked and only first names appear — the screen is public.
// Open:  /show            (Sunshine Comfort demo company)
//        /show?call=3525551234   to print Clara's number across the top
const DEMO_ORG = '827061b5-2edd-46aa-b97a-fc432df46c46'
const WINDOWS = [
  { code: 'asap', label: 'ASAP' },
  { code: '8_11', label: '8 – 11 AM' },
  { code: '10_1', label: '10 – 1' },
  { code: '12_3', label: '12 – 3' },
  { code: '2_5', label: '2 – 5 PM' },
]
const TYPE_SHORT = { 'Service Call': 'Repair', Repair: 'Repair', 'Maintenance': 'Tune-up', 'Preventive Maintenance': 'Tune-up', 'System Quote': 'Estimate' }
const shortType = (t) => TYPE_SHORT[t] || (/(maint|pm|tune)/i.test(t || '') ? 'Tune-up' : /(quote|estimate)/i.test(t || '') ? 'Estimate' : 'Repair')
const todayStr = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
const dayName = (d) => d === todayStr() ? 'Today' : new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })
const fmtCall = (s) => { const d = String(s || '').replace(/\D/g, '').slice(-10); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : '' }
const ago = (ts) => { const s = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 1000)); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s` }

export default function ShowMode({ profile }) {
  const [feed, setFeed] = useState(null)
  const [err, setErr] = useState('')
  const [, tick] = useState(0)
  const seen = useRef(null)
  const [fresh, setFresh] = useState({})
  const callNumber = useMemo(() => fmtCall(new URLSearchParams(window.location.search).get('call')), [])

  useEffect(() => {
    let live = true
    const load = async () => {
      const { data, error } = await supabase.rpc('show_feed', { p_org: DEMO_ORG })
      if (!live) return
      if (error) { setErr(error.message); return }
      setErr('')
      const ids = (data?.jobs || []).map((j) => j.id)
      if (seen.current) {
        const added = ids.filter((id) => !seen.current.has(id))
        if (added.length) {
          setFresh((f) => { const n = { ...f }; added.forEach((id) => { n[id] = Date.now() }); return n })
        }
      }
      seen.current = new Set(ids)
      setFeed(data)
    }
    load()
    const t = setInterval(load, 3000)
    const c = setInterval(() => tick((x) => x + 1), 1000)
    return () => { live = false; clearInterval(t); clearInterval(c) }
  }, [])

  if (profile?.role !== 'super_admin') return <div style={{ padding: 40 }}>This screen is for the Journey platform account.</div>

  const jobs = feed?.jobs || []
  // Calendar columns: today plus the next open days (Sunday closed), and any day that got a booking.
  const days = (() => {
    const out = []; let d = todayStr()
    while (out.length < 3) { if (new Date(d + 'T12:00:00Z').getUTCDay() !== 0) out.push(d); d = addDays(d, 1) }
    jobs.forEach((j) => { if (j.job_date && !out.includes(j.job_date) && out.length < 5) out.push(j.job_date) })
    return out.sort()
  })()
  const latest = jobs[0]
  const isFresh = (id) => fresh[id] && Date.now() - fresh[id] < 12000

  return (
    <div className="show-root">
      <style>{CSS}</style>
      <header className="show-top">
        <div>
          <div className="show-org">{(feed?.org || 'Sunshine Comfort Heating & Air').replace(/\s*\(Demo\)\s*$/, '')}</div>
          <div className="show-sub">Demo company · every booking below was made by Clara, Journey's AI receptionist</div>
        </div>
        <div className="show-cta">
          <div className="show-cta-k">Call Clara now</div>
          <div className="show-cta-n">{callNumber || 'Pretend your AC just died'}</div>
        </div>
      </header>

      {(feed?.live || []).length > 0 && (
        <div className="show-live">
          <span className="show-dot" />
          {feed.live.length === 1
            ? <>Clara is on a call {feed.live[0].phone ? <>with <b>{feed.live[0].phone}</b></> : ''} · {ago(feed.live[0].started_at)}</>
            : <>Clara is on <b>{feed.live.length} calls</b> right now</>}
        </div>
      )}

      <main className="show-main">
        <section className="show-cal" style={{ gridTemplateColumns: `150px repeat(${days.length}, 1fr)`, gridTemplateRows: `56px repeat(${WINDOWS.length}, minmax(0, 1fr))` }}>
          <div />
          {days.map((d) => <div key={d} className="show-dayh">{dayName(d)}</div>)}
          {WINDOWS.map((w) => (
            <Row key={w.code} w={w} days={days} jobs={jobs} isFresh={isFresh} />
          ))}
        </section>

        <aside className="show-side">
          <div className="show-card">
            <div className="show-k">Just booked</div>
            {latest ? (
              <div className={isFresh(latest.id) ? 'show-latest flash' : 'show-latest'}>
                <div className="show-latest-name">{latest.first_name}</div>
                <div className="show-latest-line">{shortType(latest.job_type)} · {latest.requested_window === 'asap' ? 'Today, ASAP' : `${dayName(latest.job_date)}, ${(WINDOWS.find((x) => x.code === latest.requested_window) || {}).label || ''}`}</div>
                <div className="show-latest-ph">{latest.phone || ''}{latest.city ? ` · ${latest.city}` : ''}</div>
              </div>
            ) : <div className="show-empty">Waiting for the first call…</div>}
          </div>
          <div className="show-stats">
            <div className="show-stat"><div className="show-stat-n">{feed?.calls_today ?? 0}</div><div className="show-stat-k">calls today</div></div>
            <div className="show-stat"><div className="show-stat-n">{jobs.length}</div><div className="show-stat-k">booked</div></div>
          </div>
          {feed?.last_summary && (
            <div className="show-card">
              <div className="show-k">Last call</div>
              <div className="show-summary">{feed.last_summary}</div>
            </div>
          )}
        </aside>
      </main>

      <footer className="show-foot">
        <span><b>Journey</b> · From Surviving to Thriving</span>
        <span>English &amp; Spanish · Books real appointments · Always offers a real person</span>
        {err && <span className="show-err">Connection issue — retrying…</span>}
      </footer>
    </div>
  )
}

function Row({ w, days, jobs, isFresh }) {
  return (
    <>
      <div className="show-winh">{w.label}</div>
      {days.map((d) => {
        const here = jobs.filter((j) => j.job_date === d && j.requested_window === w.code)
        return (
          <div key={d} className="show-cell">
            {here.slice(0, 4).map((j) => (
              <div key={j.id} className={isFresh(j.id) ? 'show-chip flash' : 'show-chip'}>
                <b>{j.first_name}</b> · {shortType(j.job_type)}
              </div>
            ))}
            {here.length > 4 && <div className="show-more">+{here.length - 4} more</div>}
          </div>
        )
      })}
    </>
  )
}

const CSS = `
.show-root{position:fixed;inset:0;background:#0B2340;color:#fff;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;display:flex;flex-direction:column;padding:22px 28px;gap:16px;overflow:hidden}
.show-top{display:flex;justify-content:space-between;align-items:center;gap:24px}
.show-org{font-size:40px;font-weight:800;letter-spacing:.3px}
.show-sub{font-size:19px;opacity:.75;margin-top:4px}
.show-cta{background:#F5B700;color:#0B2340;border-radius:16px;padding:12px 26px;text-align:center}
.show-cta-k{font-size:17px;font-weight:700;text-transform:uppercase;letter-spacing:1px}
.show-cta-n{font-size:36px;font-weight:900}
.show-live{display:flex;align-items:center;gap:14px;background:#1E4E8C;border-radius:14px;padding:14px 22px;font-size:26px}
.show-dot{width:18px;height:18px;border-radius:50%;background:#FF4D4D;box-shadow:0 0 0 0 rgba(255,77,77,.7);animation:showpulse 1.4s infinite}
@keyframes showpulse{0%{box-shadow:0 0 0 0 rgba(255,77,77,.7)}70%{box-shadow:0 0 0 18px rgba(255,77,77,0)}100%{box-shadow:0 0 0 0 rgba(255,77,77,0)}}
.show-main{flex:1;display:grid;grid-template-columns:1fr 380px;gap:20px;min-height:0}
.show-cal{display:grid;grid-auto-rows:minmax(0,1fr);grid-template-rows:56px;gap:8px;min-height:0}
.show-dayh{background:#163E64;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800}
.show-winh{display:flex;align-items:center;font-size:22px;font-weight:700;opacity:.8}
.show-cell{background:#12345A;border-radius:12px;padding:8px;display:flex;flex-direction:column;gap:6px;overflow:hidden}
.show-chip{background:#2F79C4;border-radius:9px;padding:7px 11px;font-size:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.show-more{font-size:17px;opacity:.7;padding-left:4px}
.flash{animation:showflash 2.2s ease-out 3}
@keyframes showflash{0%{background:#F5B700;color:#0B2340;transform:scale(1.06)}100%{background:#2F79C4;color:#fff;transform:scale(1)}}
.show-latest.flash{animation:showflash2 2.2s ease-out 3}
@keyframes showflash2{0%{background:#F5B700;color:#0B2340}100%{background:transparent;color:#fff}}
.show-side{display:flex;flex-direction:column;gap:16px;min-height:0}
.show-card{background:#12345A;border-radius:16px;padding:18px 20px}
.show-k{font-size:16px;text-transform:uppercase;letter-spacing:1.2px;opacity:.7;margin-bottom:8px}
.show-latest{border-radius:12px;padding:6px 8px}
.show-latest-name{font-size:44px;font-weight:900}
.show-latest-line{font-size:24px;margin-top:4px}
.show-latest-ph{font-size:20px;opacity:.75;margin-top:6px}
.show-empty{font-size:22px;opacity:.7}
.show-stats{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.show-stat{background:#12345A;border-radius:16px;padding:16px;text-align:center}
.show-stat-n{font-size:56px;font-weight:900;line-height:1}
.show-stat-k{font-size:18px;opacity:.75;margin-top:6px}
.show-summary{font-size:19px;line-height:1.4;opacity:.92;display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical;overflow:hidden}
.show-foot{display:flex;justify-content:space-between;gap:20px;font-size:18px;opacity:.8}
.show-err{color:#FFB4B4}
`
