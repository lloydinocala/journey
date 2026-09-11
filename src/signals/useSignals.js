// ============================================================================
//  ROLL-UP ENGINE — turns the registry into station/hub views.
//  A station renders the signals tagged to it; a hub rolls up every signal tagged
//  to it. Both read the SAME registry, so a task completed anywhere clears in its
//  station AND its hub. Output is shaped for StationShell.
// ============================================================================
import { useState, useEffect } from 'react'
import { REGISTRY } from './registry'

export const HUB_OF_STATION = REGISTRY.reduce((m, s) => { m[s.station] = s.hub; return m }, {})

export function signalsForStation(stationKey) { return REGISTRY.filter((s) => s.station === stationKey) }
export function signalsForHub(hubKey) { return REGISTRY.filter((s) => s.hub === hubKey) }

// Run all count queries for a set of signals, with a shared per-load cache so
// heavy domain helpers run once. Returns { [key]: number | null }.
export async function loadCounts(defs, org) {
  const cache = {}
  const entries = await Promise.all(defs.map(async (sig) => {
    try {
      const n = await sig.count(org, cache)
      return [sig.key, typeof n === 'number' ? n : (n && typeof n.count === 'number' ? n.count : null)]
    } catch (e) {
      return [sig.key, null]
    }
  }))
  return Object.fromEntries(entries)
}

// Hook: useSignals({ station } | { hub }, org, nav) -> { signals, counts, loading, total }.
// `signals` is StationShell-ready ([{ key, name, n, tone, line, cta, onClick, audience }]).
export function useSignals(scope, org, nav) {
  const { station, hub } = scope || {}
  const defs = station ? signalsForStation(station) : hub ? signalsForHub(hub) : []
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let live = true
    if (!org) { setLoading(false); return }
    setLoading(true)
    loadCounts(defs, org).then((c) => { if (live) { setCounts(c); setLoading(false) } })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org, station, hub])

  const signals = defs.map((s) => ({
    key: s.key,
    name: s.name,
    n: counts[s.key],
    tone: s.tone,
    line: s.line ? s.line(counts[s.key] || 0) : '',
    cta: s.cta,
    onClick: nav && s.href ? () => nav(s.href) : undefined,
    audience: s.audience,
    station: s.station,
  }))
  const needing = signals.filter((s) => (s.n || 0) > 0)
  const total = needing.reduce((a, s) => a + (s.n || 0), 0)
  return { signals, counts, loading, total, needing, defs }
}
