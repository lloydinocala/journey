// Fleet compliance list — insurance/document expirations + inspection-due flags —
// as [{ kind:'inspection'|'legal', color:'red'|'amber', label }]. Extracted so BOTH
// the Fleet dashboard (display + tile counts) and the signal registry read one source.
import { dashboardData, latestOdometersByVehicle } from './fleetData'
import { listPolicies, listDocuments, expiryStatus, docTypeLabel } from './fleetLegalData'
import { getSettings, lastInspectionsByVehicle, inspectionDue } from './fleetInspectData'

export async function fleetCompliance(org) {
  if (!org) return []
  const [d, policies, docs, settings, lastMap, odoMap] = await Promise.all([
    dashboardData(org), listPolicies(org), listDocuments(org),
    getSettings(org), lastInspectionsByVehicle(org), latestOdometersByVehicle(org),
  ])
  const nameById = {}; d.forEach((r) => { nameById[r.vehicle.id] = r.vehicle.name })
  const items = []
  policies.forEach((p) => {
    const st = expiryStatus(p.expiration_date, p.due_soon_days)
    if (st.state === 'overdue' || st.state === 'due_soon') {
      const covers = p.scope === 'fleet' ? 'whole fleet' : (p.vehicle_ids || []).map((id) => nameById[id] || 'vehicle').join(', ') || 'listed vehicles'
      items.push({ kind: 'legal', color: st.state === 'overdue' ? 'red' : 'amber', label: `Insurance ${st.state === 'overdue' ? 'expired' : 'expires soon'} — ${p.carrier || 'policy'} (${covers})` })
    }
  })
  docs.forEach((dc) => {
    const st = expiryStatus(dc.expiration_date, dc.due_soon_days)
    if (st.state === 'overdue' || st.state === 'due_soon') {
      const who = dc.vehicle_id ? (nameById[dc.vehicle_id] || 'vehicle') : 'whole fleet'
      items.push({ kind: 'legal', color: st.state === 'overdue' ? 'red' : 'amber', label: `${docTypeLabel(dc.doc_type)} ${st.state === 'overdue' ? 'expired' : 'expires soon'} — ${who}` })
    }
  })
  d.forEach((r) => {
    const st = inspectionDue(lastMap[r.vehicle.id], settings, odoMap[r.vehicle.id] ?? null)
    if (st.state === 'overdue' || st.state === 'due_soon') {
      const insLabel = st.label.startsWith('No inspection') ? `No inspection yet — ${r.vehicle.name}` : `Inspection ${st.label.toLowerCase()} — ${r.vehicle.name}`
      items.push({ kind: 'inspection', color: st.state === 'overdue' ? 'red' : 'amber', label: insLabel })
    }
  })
  items.sort((a, b) => (a.color === b.color ? 0 : a.color === 'red' ? -1 : 1))
  return items
}
