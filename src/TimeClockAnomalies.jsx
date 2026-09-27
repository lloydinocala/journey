// Time Clock · timesheet anomaly flags.
// Reviews clock entries for likely errors BEFORE they flow into payroll — long or
// forgotten shifts, missing meal breaks, big manual corrections, and overlapping
// punches — then offers a plain-English AI review. Deterministic and read-only.
// NOTE: true buddy-punch and geofence detection need device ID / GPS on each
// punch, which this data doesn't carry — so those are intentionally NOT guessed
// from timestamps (crews legitimately clock in together). See the footnote.
import { useState, useMemo } from 'react'
import AiAssist from './AiAssist'

const hoursBetween = (a, b) => { if (!a || !b) return null; const ms = new Date(b) - new Date(a); return ms > 0 ? ms / 3600000 : (ms <= 0 ? ms / 3600000 : null) }
const fmt = (ts) => (ts ? new Date(ts).toLocaleString() : '—')

const TC_SYS = `You are reviewing an HVAC contractor's employee time clock for likely errors before the hours flow into payroll. You are given flagged shifts (employee, the issue, and the relevant times/hours). Explain in plain English what to check for each, most impactful first — anything that would over- or under-pay someone (a forgotten clock-out inflating hours, a missing unpaid break, a large manual correction) is top priority. Be specific with the names and numbers given. Use ONLY the data provided; do not invent shifts or issues. End with one short line noting these should be corrected before running payroll. Under 12 lines, no headers.`

export default function TimeClockAnomalies({ events, breaksByEvent, empName }) {
  const [open, setOpen] = useState(false)

  const flagged = useMemo(() => {
    const evs = events || []
    const now = Date.now()
    const byUser = {}
    evs.forEach((e) => { (byUser[e.user_id] = byUser[e.user_id] || []).push(e) })

    const out = []
    evs.forEach((e) => {
      const flags = []
      const dur = e.clock_out ? hoursBetween(e.clock_in, e.clock_out) : null
      const breaks = breaksByEvent?.[e.id] || []

      if (!e.clock_out) {
        const openH = (now - new Date(e.clock_in).getTime()) / 3600000
        if (openH > 14) flags.push({ tone: 'red', text: `Still clocked in ${Math.round(openH)}h — likely forgot to clock out` })
      } else {
        if (dur != null && dur <= 0) flags.push({ tone: 'red', text: 'Clock-out is at or before clock-in' })
        else if (dur != null && dur > 16) flags.push({ tone: 'red', text: `${dur.toFixed(1)}h shift — verify; likely a missed clock-out` })
        else if (dur != null && dur >= 6 && breaks.length === 0) flags.push({ tone: 'amber', text: `${dur.toFixed(1)}h with no break recorded — check meal-break rules` })
      }
      if (e.end_kind && /logout|auto/i.test(e.end_kind)) flags.push({ tone: 'amber', text: 'Ended by logout, not a manual clock-out' })

      // Large manual correction vs the preserved original.
      const dIn = e.original_clock_in && e.clock_in ? Math.abs(new Date(e.clock_in) - new Date(e.original_clock_in)) / 3600000 : 0
      const dOut = e.original_clock_out && e.clock_out ? Math.abs(new Date(e.clock_out) - new Date(e.original_clock_out)) / 3600000 : 0
      const dMax = Math.max(dIn, dOut)
      if (dMax > 2) flags.push({ tone: 'amber', text: `Corrected by ${dMax.toFixed(1)}h from the original punch — review` })

      // Overlap with the same user's other shifts.
      const overlap = (byUser[e.user_id] || []).some((o) => o.id !== e.id && o.clock_in && e.clock_in && o.clock_out && e.clock_out &&
        new Date(o.clock_in) < new Date(e.clock_out) && new Date(e.clock_in) < new Date(o.clock_out))
      if (overlap) flags.push({ tone: 'red', text: 'Overlaps another shift for this employee' })

      if (flags.length) out.push({ e, dur, flags })
    })
    return out.sort((a, b) => b.flags.filter((f) => f.tone === 'red').length - a.flags.filter((f) => f.tone === 'red').length)
  }, [events, breaksByEvent])

  const redCount = flagged.reduce((s, x) => s + x.flags.filter((f) => f.tone === 'red').length, 0)

  const aiContext = {
    flagged: flagged.map(({ e, dur, flags }) => ({
      employee: empName(e.user_id),
      clock_in: fmt(e.clock_in), clock_out: e.clock_out ? fmt(e.clock_out) : 'still open',
      hours: dur == null ? null : Number(dur.toFixed(2)),
      issues: flags.map((f) => f.text),
    })),
  }

  if (!events || events.length === 0) return null

  return (
    <div className="section-card" style={{ padding: 16, marginBottom: 16, borderLeft: `4px solid ${redCount ? '#B00020' : '#1B3A6B'}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button className="logout-button" onClick={() => setOpen(!open)}>{open ? 'Hide timesheet check' : '🛡 Timesheet anomaly check'}</button>
        <span style={{ fontSize: 13, fontWeight: 600, color: flagged.length ? (redCount ? '#B00020' : '#B0600A') : '#166534', marginLeft: 'auto' }}>
          {flagged.length === 0 ? 'No anomalies in this range' : `${flagged.length} shift${flagged.length === 1 ? '' : 's'} flagged${redCount ? ` · ${redCount} to fix` : ''}`}
        </span>
      </div>

      {open && (
        <div style={{ marginTop: 12 }}>
          {flagged.length === 0 ? (
            <p style={{ color: '#166534', fontSize: 13, margin: 0 }}>Nothing looks off in the entries shown.</p>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                <AiAssist inline title="Timesheet review" label="✦ Review these before payroll"
                  system={TC_SYS}
                  prompt="Review these flagged shifts and tell me what to fix before payroll, most impactful first."
                  context={aiContext} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {flagged.map(({ e, dur, flags }) => (
                  <div key={e.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      <strong style={{ minWidth: 130 }}>{empName(e.user_id)}</strong>
                      <span style={{ fontSize: 12.5, color: 'var(--mist)' }}>In {fmt(e.clock_in)} · Out {e.clock_out ? fmt(e.clock_out) : '—'}{dur != null ? ` · ${dur.toFixed(1)}h` : ''}</span>
                    </div>
                    <div style={{ marginTop: 4 }}>
                      {flags.map((f, i) => (
                        <span key={i} style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 600, borderRadius: 6, padding: '2px 7px', marginRight: 4, marginTop: 3, background: f.tone === 'red' ? '#FBE7E7' : '#F8EEDD', color: f.tone === 'red' ? '#B00020' : '#B0600A' }}>{f.text}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          <p style={{ fontSize: 11.5, color: 'var(--mist)', marginTop: 10 }}>
            Buddy-punch and geofence checks aren't shown — they need a device ID or GPS on each punch, which these entries don't carry. Add that capture and those flags can join this list.
          </p>
        </div>
      )}
    </div>
  )
}
