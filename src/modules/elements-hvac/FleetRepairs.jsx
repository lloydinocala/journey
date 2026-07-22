// Elements-HVAC · Fleet · Repairs & cost (issues → work orders → history)
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../utils/supabase'
import {
  listVehicles, listIssues, addIssue, updateIssue, listServiceRecords, logRepair,
  costRollup, latestOdometersByVehicle, todayStr, FLAG_COLORS,
} from './fleetData'
import { useOrgSelector, OrgBar } from './shared'

const sevColor = (s) => (s === 'critical' || s === 'high' ? FLAG_COLORS.red : FLAG_COLORS.amber)
const num = (x) => (x === '' || x == null ? null : Number(x))

export default function FleetRepairs({ profile }) {
  const org = useOrgSelector(profile)
  const [vehicles, setVehicles] = useState([])
  const [vehicleId, setVehicleId] = useState('')
  const [odoMap, setOdoMap] = useState({})
  const [issues, setIssues] = useState([])
  const [records, setRecords] = useState([])
  const [vendors, setVendors] = useState([])
  const [issueForm, setIssueForm] = useState({ description: '', severity: 'medium' })
  const [showIssue, setShowIssue] = useState(false)
  const [repair, setRepair] = useState(null) // {issue} or {} for ad-hoc
  const [repairForm, setRepairForm] = useState({})
  const [msg, setMsg] = useState('')

  async function loadVehicles() {
    if (!org.selectedOrg) return
    const [v, odo, vend] = await Promise.all([
      listVehicles(org.selectedOrg),
      latestOdometersByVehicle(org.selectedOrg),
      supabase.from('vendors').select('id, name').eq('org_id', org.selectedOrg).eq('is_active', true).order('name'),
    ])
    setVehicles(v); setOdoMap(odo); setVendors(vend.data || [])
    if (!vehicleId && v[0]) setVehicleId(v[0].id)
  }
  useEffect(() => { loadVehicles() }, [org.selectedOrg])

  async function loadDetail() {
    if (!org.selectedOrg || !vehicleId) { setIssues([]); setRecords([]); return }
    const [iss, recs] = await Promise.all([
      listIssues(org.selectedOrg, vehicleId),
      listServiceRecords(org.selectedOrg, vehicleId),
    ])
    setIssues(iss); setRecords(recs)
  }
  useEffect(() => { loadDetail() }, [org.selectedOrg, vehicleId])

  const currentOdo = odoMap[vehicleId] ?? null
  const roll = useMemo(() => costRollup(records)[vehicleId] || { totalCost: 0, downtime: 0, count: 0 }, [records, vehicleId])
  const openIssues = issues.filter((i) => i.status !== 'resolved')

  async function submitIssue(e) {
    e.preventDefault()
    if (!issueForm.description.trim()) return
    await addIssue(org.selectedOrg, {
      vehicle_id: vehicleId, description: issueForm.description.trim(),
      severity: issueForm.severity, source: 'manual', created_by: profile.id,
    })
    setIssueForm({ description: '', severity: 'medium' }); setShowIssue(false); loadDetail()
  }

  function openRepair(issue) {
    setRepair(issue || {})
    setRepairForm({
      service_date: todayStr(), odometer: currentOdo != null ? String(currentOdo) : '',
      labor_cost: '', parts_cost: '', downtime_hours: '', vendor_id: '',
      description: issue?.description || '',
    })
  }
  async function saveRepair(e) {
    e.preventDefault()
    setMsg('')
    const { error } = await logRepair(org.selectedOrg, {
      vehicle_id: vehicleId, issue_id: repair?.id || null,
      service_date: repairForm.service_date || todayStr(), odometer: num(repairForm.odometer),
      labor_cost: num(repairForm.labor_cost), parts_cost: num(repairForm.parts_cost),
      downtime_hours: num(repairForm.downtime_hours), vendor_id: repairForm.vendor_id || null,
      description: repairForm.description,
    })
    if (error) { setMsg(error.message); return }
    setRepair(null); loadDetail()
  }

  const vendName = (id) => vendors.find((v) => v.id === id)?.name || null

  return (
    <div>
      <div className="page-header-bar"><h2>Repairs &amp; Cost</h2></div>
      <OrgBar {...org} />

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
        <div className="field" style={{ maxWidth: 300, marginBottom: 0 }}>
          <label>Vehicle</label>
          <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            <option value="">— select —</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <button className="auth-button" style={{ width: 'auto', marginBottom: 4 }} disabled={!vehicleId} onClick={() => setShowIssue(!showIssue)}>
          {showIssue ? 'Cancel' : '+ Report Issue'}
        </button>
        <button className="auth-button" style={{ width: 'auto', marginBottom: 4, background: '#1B3A6B' }} disabled={!vehicleId} onClick={() => openRepair(null)}>
          + Log Repair
        </button>
      </div>

      {/* cost summary */}
      {vehicleId && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
          <Stat label="Total spent" value={`$${roll.totalCost.toFixed(2)}`} />
          <Stat label="Downtime (hrs)" value={roll.downtime.toFixed(1)} />
          <Stat label="Service records" value={roll.count} />
          <Stat label="Open issues" value={openIssues.length} color={openIssues.length ? FLAG_COLORS.red : undefined} />
        </div>
      )}

      {showIssue && (
        <form className="inline-form" onSubmit={submitIssue} style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <div className="field" style={{ minWidth: 280 }}><label>What's wrong?</label><input type="text" value={issueForm.description} onChange={(e) => setIssueForm({ ...issueForm, description: e.target.value })} placeholder="e.g. AC clutch noisy" /></div>
          <div className="field">
            <label>Severity</label>
            <select value={issueForm.severity} onChange={(e) => setIssueForm({ ...issueForm, severity: e.target.value })}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
            </select>
          </div>
          <button className="auth-button" type="submit" style={{ width: 'auto' }}>Report</button>
        </form>
      )}
      {msg && <div className="auth-error" style={{ marginBottom: 12 }}>{msg}</div>}

      <h3 style={{ marginBottom: 6 }}>Open issues</h3>
      <table className="data-table" style={{ marginBottom: 24 }}>
        <thead><tr><th>Reported</th><th>Description</th><th>Severity</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {openIssues.map((i) => (
            <tr key={i.id}>
              <td style={{ color: 'var(--mist)' }}>{i.reported_date}</td>
              <td>{i.description}</td>
              <td><span style={{ background: sevColor(i.severity), color: '#fff', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700, textTransform: 'capitalize' }}>{i.severity}</span></td>
              <td>
                <select value={i.status} onChange={async (e) => { await updateIssue(i.id, { status: e.target.value }); loadDetail() }}>
                  <option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option>
                </select>
              </td>
              <td><button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => openRepair(i)}>Log repair &amp; resolve</button></td>
            </tr>
          ))}
          {openIssues.length === 0 && <tr><td colSpan="5" style={{ color: 'var(--mist)' }}>No open issues for this vehicle.</td></tr>}
        </tbody>
      </table>

      <h3 style={{ marginBottom: 6 }}>Service &amp; repair history</h3>
      <table className="data-table">
        <thead><tr><th>Date</th><th>Type</th><th>Description</th><th style={{ textAlign: 'right' }}>Cost</th><th style={{ textAlign: 'right' }}>Downtime</th><th>Vendor</th></tr></thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id}>
              <td>{r.service_date}</td>
              <td style={{ textTransform: 'capitalize', color: 'var(--mist)' }}>{r.record_type || 'service'}</td>
              <td>{r.description || '—'}</td>
              <td style={{ textAlign: 'right' }}>{r.total_cost != null ? `$${Number(r.total_cost).toFixed(2)}` : '—'}</td>
              <td style={{ textAlign: 'right' }}>{r.downtime_hours != null ? `${Number(r.downtime_hours)}h` : '—'}</td>
              <td style={{ color: 'var(--mist)' }}>{vendName(r.vendor_id) || '—'}</td>
            </tr>
          ))}
          {records.length === 0 && <tr><td colSpan="6" style={{ color: 'var(--mist)' }}>No service history yet.</td></tr>}
        </tbody>
      </table>

      {repair && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000, padding: 20 }}>
          <form onSubmit={saveRepair} style={{ background: '#fff', borderRadius: 14, padding: 24, width: 460, maxWidth: '100%' }}>
            <h3 style={{ marginTop: 0 }}>{repair.id ? `Repair: ${repair.description}` : 'Log a repair'}</h3>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div className="field" style={{ width: 150 }}><label>Date</label><input type="date" value={repairForm.service_date} onChange={(e) => setRepairForm({ ...repairForm, service_date: e.target.value })} /></div>
              <div className="field" style={{ width: 130 }}><label>Odometer</label><input type="number" step="any" value={repairForm.odometer} onChange={(e) => setRepairForm({ ...repairForm, odometer: e.target.value })} /></div>
              <div className="field" style={{ width: 120 }}><label>Labor $</label><input type="number" step="any" value={repairForm.labor_cost} onChange={(e) => setRepairForm({ ...repairForm, labor_cost: e.target.value })} /></div>
              <div className="field" style={{ width: 120 }}><label>Parts $</label><input type="number" step="any" value={repairForm.parts_cost} onChange={(e) => setRepairForm({ ...repairForm, parts_cost: e.target.value })} /></div>
              <div className="field" style={{ width: 120 }}><label>Downtime (hrs)</label><input type="number" step="any" value={repairForm.downtime_hours} onChange={(e) => setRepairForm({ ...repairForm, downtime_hours: e.target.value })} /></div>
              <div className="field" style={{ minWidth: 160 }}>
                <label>Vendor / shop</label>
                <select value={repairForm.vendor_id} onChange={(e) => setRepairForm({ ...repairForm, vendor_id: e.target.value })}>
                  <option value="">In-house / none</option>
                  {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="field" style={{ minWidth: '100%' }}><label>Description</label><input type="text" value={repairForm.description} onChange={(e) => setRepairForm({ ...repairForm, description: e.target.value })} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button className="auth-button" type="submit" style={{ width: 'auto' }}>{repair.id ? 'Save & resolve issue' : 'Save repair'}</button>
              <button type="button" className="logout-button" onClick={() => setRepair(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '12px 18px', minWidth: 120 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || '#1B3A6B' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--mist)' }}>{label}</div>
    </div>
  )
}
