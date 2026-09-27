// On-Call Scheduling · AI rotation optimizer.
// Reads who has carried on-call recently and where coverage has gaps, then drafts
// a FAIR upcoming rotation that spreads the load and fills the holes. Advisory —
// it proposes; the office still sets the schedule. Read-only.
import { useState, useMemo } from 'react'
import AiAssist from './AiAssist'

const ONCALL_SYS = `You are planning an HVAC contractor's on-call rotation. You are given the active roster, each person's recent on-call load (how many periods and hours they've carried as supervisor and as tech), and any coverage gaps. Propose a FAIR upcoming rotation: spread the load toward those who've carried the least, avoid scheduling the same person back-to-back, keep a supervisor and (where staffed) a tech per period, and explicitly fill the gaps listed. Name the people and the periods. Use ONLY the roster and history given — do not invent people. Keep it practical and concise.`

const hrs = (a, b) => Math.max(0, (new Date(b) - new Date(a)) / 3600000)

export default function OnCallOptimizer({ periods, users }) {
  const { load, gaps, roster } = useMemo(() => {
    const nameOf = (id) => (users || []).find((u) => u.id === id)?.full_name || null
    const since = Date.now() - 90 * 86400000
    const recent = (periods || []).filter((p) => new Date(p.period_end).getTime() > since)
    const load = {}
    const bump = (id, role, h) => { if (!id) return; const k = nameOf(id); if (!k) return; (load[k] = load[k] || { name: k, sup: 0, tech: 0, hours: 0 }); load[k][role]++; load[k].hours += h }
    recent.forEach((p) => { const h = hrs(p.period_start, p.period_end); bump(p.supervisor_user_id, 'sup', h); bump(p.tech_user_id, 'tech', h) })

    // Coverage gaps in the upcoming window (sorted periods with a hole between them).
    const sorted = [...(periods || [])].sort((a, b) => new Date(a.period_start) - new Date(b.period_start))
    const now = Date.now()
    const gaps = []
    for (let i = 1; i < sorted.length; i++) {
      const prevEnd = new Date(sorted[i - 1].period_end).getTime()
      const thisStart = new Date(sorted[i].period_start).getTime()
      if (thisStart > prevEnd && prevEnd > now - 7 * 86400000) gaps.push({ from: sorted[i - 1].period_end, to: sorted[i].period_start })
    }
    const roster = (users || []).map((u) => u.full_name).filter(Boolean)
    return { load: Object.values(load).sort((a, b) => a.hours - b.hours), gaps, roster }
  }, [periods, users])

  if (!users || users.length === 0) return null

  const context = {
    roster,
    recent_load: load.map((l) => ({ name: l.name, supervisor_periods: l.sup, tech_periods: l.tech, total_hours: Math.round(l.hours) })),
    coverage_gaps: gaps.map((g) => ({ from: new Date(g.from).toLocaleString(), to: new Date(g.to).toLocaleString() })),
  }

  return (
    <div style={{ border: '1px solid #E2E8F0', background: '#FBFCFE', borderRadius: 10, padding: 12, margin: '4px 0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <strong style={{ color: '#132A4C', fontSize: 13.5 }}>Rotation optimizer</strong>
        <span style={{ fontSize: 12.5, color: gaps.length ? '#B0600A' : 'var(--mist)', marginLeft: 'auto', fontWeight: 600 }}>
          {gaps.length ? `${gaps.length} coverage gap${gaps.length === 1 ? '' : 's'}` : 'No gaps detected'}
        </span>
      </div>
      <p style={{ color: 'var(--mist)', fontSize: 12, margin: '6px 0 10px' }}>Balances on-call fairly from recent load and fills gaps. It proposes — you set the schedule.</p>

      <AiAssist inline title="Fair rotation proposal" label="✦ Suggest a fair rotation"
        system={ONCALL_SYS}
        prompt="Propose a fair upcoming on-call rotation that balances recent load and fills any coverage gaps."
        context={context} />

      {load.length > 0 && (
        <table className="data-table" style={{ fontSize: 12.5, marginTop: 10 }}>
          <thead><tr><th>Person (last 90 days)</th><th style={{ textAlign: 'right' }}>As supervisor</th><th style={{ textAlign: 'right' }}>As tech</th><th style={{ textAlign: 'right' }}>Total hours</th></tr></thead>
          <tbody>
            {load.map((l) => (
              <tr key={l.name}>
                <td style={{ fontWeight: 600, color: '#152238' }}>{l.name}</td>
                <td style={{ textAlign: 'right' }}>{l.sup}</td>
                <td style={{ textAlign: 'right' }}>{l.tech}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{Math.round(l.hours)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
