import { useNavigate } from 'react-router-dom'
import StationShell from './StationShell'
import { useSignals } from './signals/useSignals'
import QuincyBrief from './QuincyBrief'
import { useViewOrg } from './utils/viewOrg'

// The Dispatch Station — the front-of-house domain. Now rendered entirely from
// the shared signal registry (useSignals), so its tiles and the Train Station
// roll-up read one source and never drift. The viewing organization comes from
// the global header bar (useViewOrg), so no per-page org picker here.
export default function DispatchStation({ profile }) {
  const nav = useNavigate()
  const { viewOrgId: selectedOrg } = useViewOrg()

  const { signals, loading, total, needing } = useSignals({ station: 'dispatch' }, selectedOrg, nav)
  const qctx = Object.fromEntries(signals.filter((x) => typeof x.n === 'number').map((x) => [x.name, x.n]))

  const sub = loading
    ? 'Checking what needs attention…'
    : total > 0
      ? (<>Work coming in and going out — <b style={{ color: 'inherit' }}>{total}</b> across {needing.length} area{needing.length === 1 ? '' : 's'} need a hand.</>)
      : "The board's clear — nothing waiting to book or dispatch."

  return (
    <div style={{ padding: '22px 24px 70px' }}>
      <StationShell
        eyebrow="Dispatch Station"
        officeTitle="Your dispatch board"
        officeSubtitle={sub}
        loading={loading}
        signals={signals}
        quincy={<QuincyBrief kind="operations" context={qctx} title="Dispatch briefing" />}
        emptyHint="No new requests, everything scheduled and dispatched, filters fulfilled."
      />
    </div>
  )
}
