// Sign-In Log · AI security-anomaly flags on unusual sign-ins.
// Reviews recent sign-in/out records for the patterns worth a second look —
// odd-hour sign-ins, sessions never signed out, forced sign-outs, and sign-ins
// from a device/source a person rarely uses — then offers a plain-English review.
// Read-only. Pairs with the device-binding security log on the Time Clock page.
import { useState, useMemo } from 'react'
import AiAssist from './AiAssist'

const SESS_SYS = `You are a security analyst reviewing an HVAC company's app sign-in log. You are given flagged sign-in/out events (employee, what was unusual, and when). Explain in plain English what to check for each, most concerning first — a forced sign-out, a session never signed out, sign-ins at odd hours, or sign-ins from a device/source the person rarely uses can indicate a shared or compromised account. Be specific with names and times. Use ONLY the data given; do not invent events. End with one line noting these are signals to verify, not proof. Under 12 lines, no headers.`

const fmt = (ts) => new Date(ts).toLocaleString()

export default function SessionAnomalies({ rows, durationMap }) {
  const flagged = useMemo(() => {
    const evs = rows || []
    const now = Date.now()
    const cutoff = now - 14 * 86400000
    // Per-user source frequency (to spot a rarely-used device/source).
    const srcByUser = {}
    evs.forEach((r) => { if (r.user_id && r.source) { (srcByUser[r.user_id] = srcByUser[r.user_id] || {})[r.source] = (srcByUser[r.user_id][r.source] || 0) + 1 } })
    const totalByUser = {}
    Object.entries(srcByUser).forEach(([u, m]) => { totalByUser[u] = Object.values(m).reduce((a, b) => a + b, 0) })

    const out = []
    evs.forEach((r) => {
      const t = new Date(r.occurred_at).getTime()
      if (t < cutoff) return
      const name = r.user?.full_name || 'Employee'
      const flags = []
      if (r.event === 'sign_out' && r.forced_by) flags.push({ tone: 'red', text: `Forced sign-out by ${r.forced_by.full_name || 'admin'}` })
      if (r.event === 'sign_in') {
        const hr = new Date(r.occurred_at).getHours()
        if (hr < 5 || hr >= 23) flags.push({ tone: 'amber', text: `Sign-in at an odd hour (${new Date(r.occurred_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })})` })
        const noOut = durationMap ? durationMap[r.id] == null : true
        if (noOut && (now - t) > 18 * 3600000) flags.push({ tone: 'amber', text: 'Never signed out (18h+)' })
        const tot = totalByUser[r.user_id] || 0
        const cnt = (srcByUser[r.user_id] || {})[r.source] || 0
        if (r.source && tot >= 5 && cnt / tot < 0.2) flags.push({ tone: 'amber', text: `Rarely-used source (${r.source})` })
      }
      if (flags.length) out.push({ id: r.id, name, when: r.occurred_at, source: r.source, flags })
    })
    return out.sort((a, b) => (b.flags.filter((f) => f.tone === 'red').length - a.flags.filter((f) => f.tone === 'red').length) || new Date(b.when) - new Date(a.when))
  }, [rows, durationMap])

  const red = flagged.reduce((s, x) => s + x.flags.filter((f) => f.tone === 'red').length, 0)
  if (!rows || rows.length === 0) return null

  return (
    <div style={{ border: `1px solid ${red ? '#F1C7C7' : '#E2E8F0'}`, background: flagged.length ? '#FEF9F6' : '#F4FBF6', borderRadius: 10, padding: 12, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <strong style={{ color: '#132A4C', fontSize: 13.5 }}>Sign-in anomaly check</strong>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: flagged.length ? '#B0600A' : '#166534', marginLeft: 'auto' }}>
          {flagged.length === 0 ? 'Nothing unusual in the last 14 days' : `${flagged.length} to review`}
        </span>
      </div>

      {flagged.length > 0 && (
        <>
          <div style={{ margin: '10px 0' }}>
            <AiAssist inline title="Review unusual sign-ins" label="✦ Review sign-ins"
              system={SESS_SYS}
              prompt="Review these flagged sign-in events and what to check, most concerning first."
              context={{ flagged: flagged.slice(0, 30).map((f) => ({ employee: f.name, when: fmt(f.when), source: f.source, issues: f.flags.map((x) => x.text) })) }} />
          </div>
          <table className="data-table" style={{ fontSize: 12.5 }}>
            <thead><tr><th>Employee</th><th>When</th><th>Flags</th></tr></thead>
            <tbody>
              {flagged.slice(0, 40).map((f) => (
                <tr key={f.id}>
                  <td style={{ fontWeight: 600, color: '#152238' }}>{f.name}</td>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--mist)' }}>{fmt(f.when)}</td>
                  <td>{f.flags.map((x, i) => <span key={i} className="badge" style={{ background: x.tone === 'red' ? '#FBE7E7' : '#F8EEDD', color: x.tone === 'red' ? '#B00020' : '#B0600A', marginRight: 4, marginBottom: 3, display: 'inline-block' }}>{x.text}</span>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
