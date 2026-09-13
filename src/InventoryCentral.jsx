import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import StationShell from './StationShell'
import { useSignals } from './signals/useSignals'
import QuincyBrief from './QuincyBrief'

// Inventory Central hub — a pure roll-up of its children (Stock, Fleet, Tools)
// fed entirely by the signal registry via useSignals({ hub }). Insights &
// Planning and Supplies have no signals yet, so they simply contribute nothing.
export default function InventoryCentral({ profile }) {
  const nav = useNavigate()
  const isSuper = profile?.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile?.org_id || '')

  useEffect(() => {
    if (isSuper) supabase.from('organizations').select('id, name').order('name').then(({ data }) => setOrgs(data || []))
  }, [isSuper])

  const { signals, loading, total, needing } = useSignals({ hub: 'inventory-central' }, selectedOrg, nav)
  const qctx = Object.fromEntries(signals.filter((x) => typeof x.n === 'number').map((x) => [x.name, x.n]))

  const sub = loading
    ? 'Checking every inventory area…'
    : total > 0
      ? (<>Across your inventory areas — <b style={{ color: 'inherit' }}>{total}</b> across {needing.length} area{needing.length === 1 ? '' : 's'} need a hand.</>)
      : 'All of inventory is watched and clear — nothing needs a hand right now.'

  return (
    <div style={{ padding: '22px 24px 70px' }}>
      <StationShell
        eyebrow="Inventory Central"
        officeTitle="Your inventory at a glance"
        officeSubtitle={sub}
        loading={loading}
        signals={signals}
        quincy={<QuincyBrief kind="operations" context={qctx} title="Inventory briefing" />}
        emptyHint="Stock, fleet, and tools are all in good shape."
        headerRight={isSuper ? <div><div style={{ fontSize: 11.5, color: '#98A2AD', marginBottom: 4, textAlign: 'right' }}>Organization</div><OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} /></div> : null}
      />
    </div>
  )
}
