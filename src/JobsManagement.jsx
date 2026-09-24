import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import NewItemDropdown from './NewItemDropdown'
import QuickAddModal from './QuickAddModal'
import { fetchAllRows } from './utils/csvImport'

// Warranty-or-Cash now includes Punchlist. Claim Status options are conditional
// on that choice (see claimStatusOptions()).
const WARRANTY_OPTIONS = [
  { value: 'warranty', label: 'Warranty' },
  { value: 'cash', label: 'Cash' },
  { value: 'punchlist', label: 'Punchlist' },
]
function claimStatusOptions(warrantyOrCash) {
  switch ((warrantyOrCash || '').toLowerCase()) {
    case 'warranty': return ['Pending', 'Approved']
    case 'cash': return ['Not Warranty Eligible']
    case 'punchlist': return ['Punchlist']
    default: return []
  }
}
const COMM_OPTIONS = ['Pending', 'Notified', 'Price Approved']
const ESTIMATE_APPROVAL_OPTIONS = ['Pending', 'Verbal Approval', 'Declined', 'Punchlist']

const STATUS_LABELS = {
  unscheduled: 'Unscheduled',
  scheduled: 'Scheduled',
  on_my_way: 'On My Way',
  in_progress: 'In Progress',
  incomplete: 'Incomplete',
  completed: 'Completed',
  canceled: 'Canceled',
}

function todayISO() {
  const d = new Date()
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d - tz).toISOString().slice(0, 10)
}
const money = (n) => (n == null || n === '' || isNaN(n) ? null : `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`)

const blankPartForm = { part_description: '', part_number: '', po_number: '', vendor_id: '', segment_assigned: '', expected_delivery_date: '' }

export default function JobsManagement({ profile }) {
  const navigate = useNavigate()
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [loading, setLoading] = useState(true)

  const [incompleteRecords, setIncompleteRecords] = useState([])
  const [allJobs, setAllJobs] = useState([])
  const [partsOrders, setPartsOrders] = useState([])
  const [vendors, setVendors] = useState([])
  const [vendorBrands, setVendorBrands] = useState([])

  const [showVerifiedParts, setShowVerifiedParts] = useState(false)
  const [addingPartFor, setAddingPartFor] = useState(null)
  const [partForm, setPartForm] = useState(blankPartForm)
  const [savingPart, setSavingPart] = useState(false)
  const [newItemMode, setNewItemMode] = useState(null)

  const [editingRecId, setEditingRecId] = useState(null)
  const [recDraft, setRecDraft] = useState({})
  const [savingRec, setSavingRec] = useState(false)
  const [busyRecId, setBusyRecId] = useState(null)

  const [editingPartId, setEditingPartId] = useState(null)
  const [partDraft, setPartDraft] = useState({})
  const [savingPartRow, setSavingPartRow] = useState(false)

  // Open Estimate side panel — docked right, content reserves space so the
  // Add Part fields stay visible while the office reads the estimate.
  const [estPanel, setEstPanel] = useState({ open: false, loading: false, rec: null, invoice: null, lines: [] })

  const isSuperAdmin = profile.role === 'super_admin'
  const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '')

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        if (!selectedOrg && data && data.length > 0) setSelectedOrg(data[0].id)
      })
    }
  }, [])

  async function loadAll(orgId) {
    if (!orgId) return
    setLoading(true)
    try {
      const [records, jobs, parts, vendorsData, vbData] = await Promise.all([
        fetchAllRows(() =>
          supabase
            .from('job_incomplete_records')
            .select(`
              id, job_id, estimate_id, warranty_or_cash, claim_status, customer_communication,
              equipment_brand, equipment_model, equipment_serial, created_at, reason,
              estimate_approval, new_estimate_amount,
              jobs ( id, job_number, segment, job_date, status, property_id, customer_id, job_type, deleted_at,
                properties ( street_address, customers!properties_customer_id_fkey ( display_name, primary_phone ) )
              )
            `)
            .eq('org_id', orgId)
            .order('created_at', { ascending: false })
        ),
        fetchAllRows(() => supabase.from('jobs').select('id, job_number, segment, status, job_date, date_pending, parts_ready').eq('org_id', orgId).is('deleted_at', null)),
        fetchAllRows(() => supabase.from('parts_orders').select('*').eq('org_id', orgId).order('created_at', { ascending: false })),
        fetchAllRows(() => supabase.from('vendors').select('id, name, phone').eq('org_id', orgId).eq('is_active', true).order('name')),
        fetchAllRows(() => supabase.from('vendor_brands').select('vendor_id, brand, is_preferred').eq('org_id', orgId)),
      ])
      // Auto-fill Brand / Model # / Serial # from the property's equipment on file
      // for any incomplete record that hasn't been filled in yet.
      const propIds = [...new Set(records.map((r) => r.jobs?.property_id).filter(Boolean))]
      if (propIds.length) {
        const { data: equip } = await supabase
          .from('property_equipment')
          .select('property_id, created_at, outdoor_brand, outdoor_model, outdoor_serial, indoor_brand, indoor_model, indoor_serial, furnace_brand, furnace_model, furnace_serial')
          .in('property_id', propIds)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
        const byProp = {}
        for (const e of equip || []) { if (!byProp[e.property_id]) byProp[e.property_id] = e }
        const pick = (e) => {
          if (!e) return null
          for (const u of ['outdoor', 'indoor', 'furnace']) {
            const b = e[`${u}_brand`], m = e[`${u}_model`], s = e[`${u}_serial`]
            if (b || m || s) return { equipment_brand: b || null, equipment_model: m || null, equipment_serial: s || null }
          }
          return null
        }
        const toBackfill = []
        for (const rec of records) {
          if (rec.equipment_brand || rec.equipment_model || rec.equipment_serial) continue
          const sugg = pick(byProp[rec.jobs?.property_id])
          if (sugg) {
            rec.equipment_brand = sugg.equipment_brand
            rec.equipment_model = sugg.equipment_model
            rec.equipment_serial = sugg.equipment_serial
            toBackfill.push({ id: rec.id, ...sugg })
          }
        }
        if (toBackfill.length) {
          await Promise.all(toBackfill.map((r) =>
            supabase.from('job_incomplete_records')
              .update({ equipment_brand: r.equipment_brand, equipment_model: r.equipment_model, equipment_serial: r.equipment_serial })
              .eq('id', r.id)
          ))
        }
      }

      setIncompleteRecords(records)
      setAllJobs(jobs)
      setPartsOrders(parts)
      setVendors(vendorsData)
      setVendorBrands(vbData || [])
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  useEffect(() => { loadAll(selectedOrg) }, [selectedOrg])

  const visibleIncomplete = incompleteRecords
    .map((rec) => {
      const job = rec.jobs
      if (!job) return null
      if (job.deleted_at) return null
      const siblingSegments = allJobs.filter((j) => j.job_number === job.job_number)
      const maxSegment = siblingSegments.reduce((max, j) => Math.max(max, j.segment || 1), 1)
      const currentSegmentJob = siblingSegments.find((j) => j.segment === maxSegment)
      if (currentSegmentJob?.status === 'completed') return null
      const isRed = maxSegment === job.segment                 // no newer segment yet
      const nextSegmentJob = isRed ? null : currentSegmentJob   // the staged next segment, if any
      const scheduledDate = !isRed ? currentSegmentJob?.job_date : null
      const relatedParts = partsOrders.filter((p) => p.incomplete_record_id === rec.id)
      const nextDeliveryDate = relatedParts
        .filter((p) => !p.delivery_verified && p.expected_delivery_date)
        .map((p) => p.expected_delivery_date)
        .sort()[0] || null
      const currentStatus = currentSegmentJob?.status || job.status
      const currentSegmentId = currentSegmentJob?.id || job.id
      return { ...rec, job, isRed, maxSegment, nextSegmentJob, scheduledDate, relatedParts, nextDeliveryDate, currentStatus, currentSegmentId }
    })
    .filter(Boolean)

  const visibleParts = partsOrders.filter((p) => showVerifiedParts || !p.delivery_verified)

  const vendorName = (id) => vendors.find((v) => v.id === id)?.name || ''
  const vendorPhone = (id) => vendors.find((v) => v.id === id)?.phone || ''

  // Vendors that carry a given brand, preferred first. Falls back to all vendors
  // when the brand is unknown or has no mapping yet.
  function vendorsForBrand(brand) {
    const b = (brand || '').trim().toUpperCase()
    if (!b) return vendors
    const rows = vendorBrands.filter((vb) => (vb.brand || '').toUpperCase() === b)
    if (!rows.length) return vendors
    const preferred = new Set(rows.filter((r) => r.is_preferred).map((r) => r.vendor_id))
    const ids = new Set(rows.map((r) => r.vendor_id))
    const list = vendors.filter((v) => ids.has(v.id))
    list.sort((a, c) => (preferred.has(c.id) ? 1 : 0) - (preferred.has(a.id) ? 1 : 0) || a.name.localeCompare(c.name))
    return list.length ? list : vendors
  }
  function preferredVendorForBrand(brand) {
    const b = (brand || '').trim().toUpperCase()
    if (!b) return ''
    const row = vendorBrands.find((vb) => (vb.brand || '').toUpperCase() === b && vb.is_preferred)
    return row?.vendor_id || ''
  }

  function scheduleConfirmedFor(job_id, segmentAssigned) {
    if (!segmentAssigned) return null
    const originJob = allJobs.find((j) => j.id === job_id)
    if (!originJob) return null
    const match = allJobs.find((j) => j.job_number === originJob.job_number && j.segment === Number(segmentAssigned))
    return match ? match.job_date : null
  }

  // ---- Incomplete-record edit ----
  function startEditRec(rec) {
    setEditingRecId(rec.id)
    setRecDraft({
      equipment_brand: rec.equipment_brand || '',
      equipment_model: rec.equipment_model || '',
      equipment_serial: rec.equipment_serial || '',
      warranty_or_cash: rec.warranty_or_cash || '',
      claim_status: rec.claim_status || '',
      customer_communication: rec.customer_communication || '',
      estimate_approval: rec.estimate_approval || '',
      new_estimate_amount: rec.new_estimate_amount ?? '',
    })
  }
  async function saveRec(id) {
    setSavingRec(true)
    // Keep claim status valid for the chosen warranty/cash bucket.
    const allowed = claimStatusOptions(recDraft.warranty_or_cash)
    const claim = allowed.includes(recDraft.claim_status) ? recDraft.claim_status : (allowed[0] || null)
    await supabase.from('job_incomplete_records').update({
      equipment_brand: recDraft.equipment_brand.trim() || null,
      equipment_model: recDraft.equipment_model.trim() || null,
      equipment_serial: recDraft.equipment_serial.trim() || null,
      warranty_or_cash: recDraft.warranty_or_cash || null,
      claim_status: claim,
      customer_communication: recDraft.customer_communication || null,
      estimate_approval: recDraft.estimate_approval || null,
      new_estimate_amount: recDraft.new_estimate_amount === '' ? null : Number(recDraft.new_estimate_amount),
    }).eq('id', id)
    setSavingRec(false)
    setEditingRecId(null)
    loadAll(selectedOrg)
  }

  // Delete removes the incomplete-job entry from Jobs Management. It does NOT
  // delete the underlying job — that lives on the Jobs table.
  async function deleteRecord(rec) {
    if (!window.confirm(`Remove ${rec.job.job_number} from Jobs Management? This clears the incomplete-job entry (any parts ordered stay on record). The job itself is not deleted.`)) return
    setBusyRecId(rec.id)
    await supabase.from('job_incomplete_records').delete().eq('id', rec.id)
    setBusyRecId(null)
    loadAll(selectedOrg)
  }

  // Flip the job to Complete (e.g. after a declined estimate). Completes the
  // newest segment, which clears it from Jobs Management and reads Complete on
  // the Jobs table.
  async function markComplete(rec) {
    if (!window.confirm(`Mark ${rec.job.job_number} Complete? It will clear from Jobs Management and show Completed on the Jobs table.`)) return
    setBusyRecId(rec.id)
    await supabase.from('jobs').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', rec.currentSegmentId)
    setBusyRecId(null)
    setEditingRecId(null)
    loadAll(selectedOrg)
  }

  // Stage the next segment: a new unscheduled segment with NO date/time/tech,
  // placed in the Calendar dispatch tray (date_pending) so Dispatch can schedule
  // it once the part arrives.
  async function stageSegment(rec) {
    setBusyRecId(rec.id)
    const nextSeg = (rec.maxSegment || rec.job.segment || 1) + 1
    const { error } = await supabase.from('jobs').insert({
      org_id: selectedOrg,
      job_number: rec.job.job_number,
      segment: nextSeg,
      property_id: rec.job.property_id,
      customer_id: rec.job.customer_id,
      job_type: rec.job.job_type || null,
      service_complaint: rec.reason || null,
      status: 'unscheduled',
      date_pending: true,
      parts_ready: false,
    })
    setBusyRecId(null)
    if (error) { alert('Could not stage the segment: ' + error.message); return }
    loadAll(selectedOrg)
  }

  // ---- Parts ----
  function startEditPart(p) {
    setEditingPartId(p.id)
    setPartDraft({
      segment_assigned: p.segment_assigned ?? '',
      part_number: p.part_number || '',
      vendor_id: p.vendor_id || '',
      expected_delivery_date: p.expected_delivery_date || '',
    })
  }
  async function savePart(id) {
    setSavingPartRow(true)
    await supabase.from('parts_orders').update({
      segment_assigned: partDraft.segment_assigned !== '' ? parseInt(partDraft.segment_assigned, 10) : null,
      part_number: partDraft.part_number.trim() || null,
      vendor_id: partDraft.vendor_id || null,
      expected_delivery_date: partDraft.expected_delivery_date || null,
    }).eq('id', id)
    setSavingPartRow(false)
    setEditingPartId(null)
    loadAll(selectedOrg)
  }

  function startAddPart(rec) {
    setAddingPartFor(rec.id)
    // Default the segment to the staged next segment, and the vendor to the
    // preferred supplier for this equipment's brand.
    const nextSeg = rec.nextSegmentJob ? rec.nextSegmentJob.segment : (rec.maxSegment || rec.job.segment || 1) + 1
    setPartForm({ ...blankPartForm, segment_assigned: String(nextSeg), vendor_id: preferredVendorForBrand(rec.equipment_brand) })
  }

  async function saveNewPart(rec) {
    if (!partForm.part_description.trim()) return
    setSavingPart(true)
    // Auto-assign a PO number from the shared stock-purchasing sequence when the
    // user didn't type one — same counter as replenishment, so no duplicates.
    let po = partForm.po_number.trim()
    if (!po) {
      const { data: alloc } = await supabase.rpc('elements_alloc_po_number', { p_org: selectedOrg })
      po = alloc || null
    }
    await supabase.from('parts_orders').insert({
      org_id: selectedOrg,
      job_id: rec.job_id,
      incomplete_record_id: rec.id,
      segment_assigned: partForm.segment_assigned ? parseInt(partForm.segment_assigned, 10) : null,
      part_description: partForm.part_description.trim(),
      part_number: partForm.part_number.trim() || null,
      po_number: po,
      vendor_id: partForm.vendor_id || null,
      expected_delivery_date: partForm.expected_delivery_date || null,
    })
    setSavingPart(false)
    setAddingPartFor(null)
    setPartForm(blankPartForm)
    loadAll(selectedOrg)
  }

  // Verifying delivery flags the staged segment (same job_number + segment) as
  // parts_ready, so Dispatch knows it can now be scheduled.
  async function toggleVerified(part) {
    const nextVal = !part.delivery_verified
    await supabase.from('parts_orders').update({ delivery_verified: nextVal }).eq('id', part.id)
    const originJob = allJobs.find((j) => j.id === part.job_id)
    if (originJob && part.segment_assigned) {
      const staged = allJobs.find((j) => j.job_number === originJob.job_number && j.segment === Number(part.segment_assigned))
      if (staged) await supabase.from('jobs').update({ parts_ready: nextVal }).eq('id', staged.id)
    }
    loadAll(selectedOrg)
  }

  // ---- Open Estimate panel ----
  async function openEstimate(rec) {
    setEstPanel({ open: true, loading: true, rec, invoice: null, lines: [] })
    let invoice = null
    if (rec.estimate_id) {
      invoice = (await supabase.from('invoices').select('*').eq('id', rec.estimate_id).maybeSingle()).data
    }
    if (!invoice) {
      invoice = (await supabase.from('invoices').select('*').eq('job_id', rec.job.id).eq('kind', 'estimate').is('deleted_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle()).data
    }
    let lines = []
    if (invoice) {
      const { data: li } = await supabase.from('invoice_line_items').select('description, quantity, unit_price, sort_order').eq('invoice_id', invoice.id).order('sort_order')
      lines = li || []
    }
    setEstPanel({ open: true, loading: false, rec, invoice, lines })
  }
  const estTotal = estPanel.lines.reduce((s, l) => s + (Number(l.unit_price) || 0) * (Number(l.quantity) || 0), 0)

  function deliveryDateStyle(dateStr) {
    if (!dateStr) return {}
    if (dateStr === todayISO()) return { background: 'rgba(76, 217, 123, 0.2)', color: '#1F7A43', fontWeight: 700, padding: '2px 6px', borderRadius: 4 }
    return {}
  }
  const editBtn = { width: 'auto', padding: '4px 12px', margin: 0 }
  const deleteBtn = { padding: '4px 12px', border: '1px solid #C0392B', color: '#C0392B', background: '#fff', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }

  return (
    <div style={{ paddingRight: estPanel.open ? 452 : 0, transition: 'padding-right .15s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 className="page-title" style={{ margin: 0 }}>Jobs Management</h2>
        <NewItemDropdown
          items={['job', 'segment', 'invoice', 'task', 'todo']}
          onSelect={(m) => (m === 'task' ? navigate('/tasks') : setNewItemMode(m))}
        />
      </div>

      {isSuperAdmin && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : (
        <>
          <h3 style={{ fontSize: 16, marginBottom: 4 }}>Incomplete Jobs</h3>
          <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0, marginBottom: 12 }}>
            A job lands here the moment a customer signs off on a follow-up estimate. Red means nothing's been done
            yet; yellow means a return visit is already on the schedule. It clears on its own once that visit is
            marked Complete.
          </p>
          {visibleIncomplete.length === 0 ? (
            <p style={{ color: 'var(--mist)', marginBottom: 28 }}>No incomplete jobs need attention right now.</p>
          ) : (
            <div style={{ marginBottom: 28, overflowX: 'auto' }}>
              <table className="data-table" style={{ minWidth: 1500 }}>
                <thead>
                  <tr>
                    <th>Job #</th>
                    <th className="col-seg">Seg</th>
                    <th>Customer</th>
                    <th>Phone</th>
                    <th>Reason</th>
                    <th>Estimate</th>
                    <th>Brand</th>
                    <th>Model #</th>
                    <th>Serial #</th>
                    <th>Warranty or Cash</th>
                    <th>Claim Status</th>
                    <th>Customer Comm.</th>
                    <th>Expected Delivery</th>
                    <th>Verbal Approval</th>
                    <th>Create Next Segment</th>
                    <th style={{ minWidth: 120, whiteSpace: 'nowrap' }}>Job Status</th>
                    <th className="sticky-actions"></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleIncomplete.map((rec) => {
                    const editing = editingRecId === rec.id
                    const claimOpts = claimStatusOptions(editing ? recDraft.warranty_or_cash : rec.warranty_or_cash)
                    const declined = (rec.estimate_approval || '').toLowerCase() === 'declined'
                    return (
                    <>
                      <tr key={rec.id} style={{ background: rec.isRed ? 'rgba(255, 107, 107, 0.08)' : 'rgba(242, 169, 60, 0.08)' }}>
                        <td>{rec.job.job_number}</td>
                        <td className="col-seg">{rec.job.segment}</td>
                        <td>{rec.job.properties?.customers?.display_name || '—'}</td>
                        <td>{rec.job.properties?.customers?.primary_phone || '—'}</td>
                        <td style={{ maxWidth: 180, fontSize: 12 }}>{rec.reason || '—'}</td>
                        <td>
                          <button className="auth-button" style={{ width: 'auto', padding: '4px 12px', margin: 0, whiteSpace: 'nowrap' }} onClick={() => openEstimate(rec)}>Open Estimate</button>
                        </td>
                        {editing ? (
                          <>
                            <td><input type="text" value={recDraft.equipment_brand} onChange={(e) => setRecDraft({ ...recDraft, equipment_brand: e.target.value })} style={{ width: 90 }} /></td>
                            <td><input type="text" value={recDraft.equipment_model} onChange={(e) => setRecDraft({ ...recDraft, equipment_model: e.target.value })} style={{ width: 90 }} /></td>
                            <td><input type="text" value={recDraft.equipment_serial} onChange={(e) => setRecDraft({ ...recDraft, equipment_serial: e.target.value })} style={{ width: 90 }} /></td>
                            <td>
                              <select value={recDraft.warranty_or_cash} onChange={(e) => setRecDraft({ ...recDraft, warranty_or_cash: e.target.value, claim_status: '' })}>
                                <option value="">Select…</option>
                                {WARRANTY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            </td>
                            <td>
                              <select value={recDraft.claim_status} onChange={(e) => setRecDraft({ ...recDraft, claim_status: e.target.value })} disabled={!claimOpts.length}>
                                <option value="">{claimOpts.length ? 'Select…' : '—'}</option>
                                {claimOpts.map((o) => <option key={o} value={o}>{o}</option>)}
                              </select>
                            </td>
                            <td>
                              <select value={recDraft.customer_communication} onChange={(e) => setRecDraft({ ...recDraft, customer_communication: e.target.value })}>
                                <option value="">Select…</option>
                                {COMM_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                              </select>
                            </td>
                          </>
                        ) : (
                          <>
                            <td>{rec.equipment_brand || '—'}</td>
                            <td>{rec.equipment_model || '—'}</td>
                            <td>{rec.equipment_serial || '—'}</td>
                            <td>{capitalize(rec.warranty_or_cash) || '—'}</td>
                            <td>{rec.claim_status || '—'}</td>
                            <td>{rec.customer_communication || '—'}</td>
                          </>
                        )}
                        <td>
                          {rec.nextDeliveryDate ? (
                            <span style={deliveryDateStyle(rec.nextDeliveryDate)}>{new Date(rec.nextDeliveryDate + 'T00:00:00').toLocaleDateString()}</span>
                          ) : '—'}
                        </td>
                        {/* Verbal Approval: new estimate amount + approval status */}
                        <td style={{ minWidth: 150 }}>
                          {editing ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <input type="number" step="0.01" placeholder="New estimate $" value={recDraft.new_estimate_amount} onChange={(e) => setRecDraft({ ...recDraft, new_estimate_amount: e.target.value })} style={{ width: 120 }} />
                              <select value={recDraft.estimate_approval} onChange={(e) => setRecDraft({ ...recDraft, estimate_approval: e.target.value })}>
                                <option value="">Approval…</option>
                                {ESTIMATE_APPROVAL_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                              </select>
                            </div>
                          ) : (
                            <div style={{ fontSize: 13 }}>
                              {money(rec.new_estimate_amount) && <div style={{ fontWeight: 700 }}>{money(rec.new_estimate_amount)}</div>}
                              {rec.estimate_approval
                                ? <span className="status-pill" style={{ background: declined ? '#FBECE8' : '#E7F6EC', color: declined ? '#B5462F' : '#0B7A3B' }}>{rec.estimate_approval}</span>
                                : (!money(rec.new_estimate_amount) && '—')}
                            </div>
                          )}
                        </td>
                        {/* Create Next Segment */}
                        <td style={{ minWidth: 150 }}>
                          {rec.nextSegmentJob ? (
                            <div style={{ fontSize: 13 }}>
                              <div>Seg {rec.nextSegmentJob.segment} staged</div>
                              <span className="status-pill" style={{ background: rec.nextSegmentJob.job_date ? '#E7F6EC' : (rec.nextSegmentJob.parts_ready ? '#FAF2E0' : '#EEF1F5'), color: rec.nextSegmentJob.job_date ? '#0B7A3B' : (rec.nextSegmentJob.parts_ready ? '#9C6A12' : '#64748B') }}>
                                {rec.nextSegmentJob.job_date ? `Scheduled ${new Date(rec.nextSegmentJob.job_date + 'T00:00:00').toLocaleDateString()}` : (rec.nextSegmentJob.parts_ready ? 'Parts in · ready' : 'Awaiting schedule')}
                              </span>
                            </div>
                          ) : (
                            <button className="logout-button" style={{ whiteSpace: 'nowrap' }} disabled={busyRecId === rec.id} onClick={() => stageSegment(rec)}>+ New Segment</button>
                          )}
                        </td>
                        <td style={{ minWidth: 120, whiteSpace: 'nowrap' }}>
                          <span className={`status-pill status-${rec.currentStatus}`} style={{ display: 'inline-block' }}>{STATUS_LABELS[rec.currentStatus] || rec.currentStatus}</span>
                        </td>
                        <td className="sticky-actions">
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {editing ? (
                              <>
                                <button className="auth-button" style={editBtn} disabled={savingRec} onClick={() => saveRec(rec.id)}>{savingRec ? 'Saving…' : 'Save'}</button>
                                {declined && <button style={deleteBtn} disabled={busyRecId === rec.id} onClick={() => markComplete(rec)}>Flip to Complete</button>}
                                <button className="logout-button" onClick={() => setEditingRecId(null)}>Cancel</button>
                              </>
                            ) : (
                              <>
                                <button className="auth-button" style={editBtn} onClick={() => startEditRec(rec)}>Edit</button>
                                <button className="logout-button" onClick={() => startAddPart(rec)}>+ Add Part</button>
                                <button style={deleteBtn} disabled={busyRecId === rec.id} onClick={() => deleteRecord(rec)}>Delete</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {addingPartFor === rec.id && (
                        <tr key={rec.id + '-form'}>
                          <td colSpan="17" style={{ background: 'var(--ink)', padding: 16 }}>
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                              <div className="field" style={{ marginBottom: 0, minWidth: 200 }}>
                                <label>Part Description</label>
                                <input type="text" value={partForm.part_description} onChange={(e) => setPartForm({ ...partForm, part_description: e.target.value })} />
                              </div>
                              <div className="field" style={{ marginBottom: 0, minWidth: 130 }}>
                                <label>Part # (optional)</label>
                                <input type="text" value={partForm.part_number} onChange={(e) => setPartForm({ ...partForm, part_number: e.target.value })} />
                              </div>
                              <div className="field" style={{ marginBottom: 0, minWidth: 150 }}>
                                <label>PO #</label>
                                <input type="text" value={partForm.po_number} onChange={(e) => setPartForm({ ...partForm, po_number: e.target.value })} placeholder="Auto-assigned if blank" />
                              </div>
                              <div className="field" style={{ marginBottom: 0, minWidth: 180 }}>
                                <label>Vendor{rec.equipment_brand ? ` (for ${rec.equipment_brand})` : ''}</label>
                                <select value={partForm.vendor_id} onChange={(e) => setPartForm({ ...partForm, vendor_id: e.target.value })}>
                                  <option value="">Select…</option>
                                  {vendorsForBrand(rec.equipment_brand).map((v) => <option key={v.id} value={v.id}>{v.name}{preferredVendorForBrand(rec.equipment_brand) === v.id ? ' ★' : ''}</option>)}
                                </select>
                              </div>
                              <div className="field" style={{ marginBottom: 0, minWidth: 90 }}>
                                <label>Seg # Assigned</label>
                                <input type="number" value={partForm.segment_assigned} onChange={(e) => setPartForm({ ...partForm, segment_assigned: e.target.value })} />
                              </div>
                              <div className="field" style={{ marginBottom: 0, minWidth: 150 }}>
                                <label>Expected Delivery</label>
                                <input type="date" value={partForm.expected_delivery_date} onChange={(e) => setPartForm({ ...partForm, expected_delivery_date: e.target.value })} />
                              </div>
                              <button className="auth-button" style={{ width: 'auto' }} disabled={savingPart} onClick={() => saveNewPart(rec)}>{savingPart ? 'Saving…' : 'Add'}</button>
                              <button className="logout-button" onClick={() => setAddingPartFor(null)}>Cancel</button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 16, margin: 0 }}>Parts Orders</h3>
            <label style={{ fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={showVerifiedParts} onChange={(e) => setShowVerifiedParts(e.target.checked)} style={{ marginRight: 6 }} />
              Show picked up
            </label>
          </div>
          {visibleParts.length === 0 ? (
            <p style={{ color: 'var(--mist)' }}>No parts on order.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ minWidth: 1200 }}>
                <thead>
                  <tr>
                    <th>Job #</th>
                    <th className="col-seg">Seg</th>
                    <th>Part Description</th>
                    <th>Part # (optional)</th>
                    <th>PO #</th>
                    <th>Vendor</th>
                    <th>Vendor Phone</th>
                    <th>Expected Delivery</th>
                    <th>Delivery Verified</th>
                    <th>Schedule Confirmed</th>
                    <th className="sticky-actions"></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleParts.map((p) => {
                    const originJob = allJobs.find((j) => j.id === p.job_id)
                    const scheduledDate = scheduleConfirmedFor(p.job_id, p.segment_assigned)
                    return (
                      <tr key={p.id}>
                        <td>{originJob?.job_number || '—'}</td>
                        {editingPartId === p.id ? (
                          <td className="col-seg"><input type="number" value={partDraft.segment_assigned} onChange={(e) => setPartDraft({ ...partDraft, segment_assigned: e.target.value })} /></td>
                        ) : (
                          <td className="col-seg">{p.segment_assigned || '—'}</td>
                        )}
                        <td>{p.part_description}</td>
                        {editingPartId === p.id ? (
                          <td><input type="text" value={partDraft.part_number} onChange={(e) => setPartDraft({ ...partDraft, part_number: e.target.value })} style={{ width: 110 }} /></td>
                        ) : (
                          <td>{p.part_number || '—'}</td>
                        )}
                        <td>{p.po_number || '—'}</td>
                        {editingPartId === p.id ? (
                          <td>
                            <select value={partDraft.vendor_id} onChange={(e) => setPartDraft({ ...partDraft, vendor_id: e.target.value })}>
                              <option value="">Select…</option>
                              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                            </select>
                          </td>
                        ) : (
                          <td>{p.vendor_id ? <Link to={`/vendors/${p.vendor_id}`}>{vendorName(p.vendor_id)}</Link> : '—'}</td>
                        )}
                        <td>{vendorPhone(p.vendor_id) || '—'}</td>
                        {editingPartId === p.id ? (
                          <td><input type="date" value={partDraft.expected_delivery_date} onChange={(e) => setPartDraft({ ...partDraft, expected_delivery_date: e.target.value })} /></td>
                        ) : (
                          <td>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              {p.expected_delivery_date ? (
                                <span style={deliveryDateStyle(p.expected_delivery_date)}>{new Date(p.expected_delivery_date + 'T00:00:00').toLocaleDateString()}</span>
                              ) : '—'}
                              {p.expected_delivery_date === todayISO() && !p.delivery_verified && (
                                <span className="status-pill status-active">Today</span>
                              )}
                            </div>
                          </td>
                        )}
                        <td>
                          <button className={p.delivery_verified ? 'logout-button' : 'auth-button'} style={{ width: 'auto', padding: '4px 10px' }} onClick={() => toggleVerified(p)}>
                            {p.delivery_verified ? 'Verified ✓' : 'Mark Verified'}
                          </button>
                        </td>
                        <td>
                          <span className={`status-pill ${scheduledDate ? 'status-active' : 'status-canceled'}`}>
                            {scheduledDate ? `Scheduled ${new Date(scheduledDate + 'T00:00:00').toLocaleDateString()}` : 'Not Scheduled'}
                          </span>
                        </td>
                        <td className="sticky-actions">
                          <div style={{ display: 'flex', gap: 8 }}>
                            {editingPartId === p.id ? (
                              <>
                                <button className="auth-button" style={{ width: 'auto', padding: '4px 10px', margin: 0 }} disabled={savingPartRow} onClick={() => savePart(p.id)}>{savingPartRow ? 'Saving…' : 'Save'}</button>
                                <button className="logout-button" onClick={() => setEditingPartId(null)}>Cancel</button>
                              </>
                            ) : (
                              <button className="logout-button" onClick={() => startEditPart(p)}>Edit</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Open Estimate — right-docked panel; the page reserves space (paddingRight)
          so the Add Part fields stay fully visible while it's open. */}
      {estPanel.open && (
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 440, background: '#fff', borderLeft: '1px solid var(--border, #d5dae1)', boxShadow: '-4px 0 16px rgba(0,0,0,0.12)', zIndex: 60, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border, #d5dae1)', background: 'var(--route-blue, #176E7A)', color: '#fff' }}>
            <div>
              <div style={{ fontWeight: 800 }}>Estimate</div>
              <div style={{ fontSize: 12.5, opacity: 0.9 }}>{estPanel.rec?.job.job_number} · {estPanel.rec?.job.properties?.customers?.display_name || ''}</div>
            </div>
            <button className="logout-button" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.5)' }} onClick={() => setEstPanel({ open: false, loading: false, rec: null, invoice: null, lines: [] })}>Close ✕</button>
          </div>
          <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
            {estPanel.loading ? (
              <p style={{ color: 'var(--mist)' }}>Loading estimate…</p>
            ) : !estPanel.invoice ? (
              <div>
                <p style={{ color: 'var(--mist)' }}>No estimate is attached to this job yet.</p>
                {estPanel.rec && <Link className="auth-button" style={{ width: 'auto', display: 'inline-block', textDecoration: 'none', padding: '9px 18px' }} to={`/estimate/${estPanel.rec.job.id}`}>Open the estimate editor →</Link>}
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontWeight: 700 }}>{estPanel.invoice.invoice_number || 'Estimate'}</div>
                  <Link to={`/estimate/${estPanel.rec.job.id}`} style={{ fontSize: 13 }}>Full editor →</Link>
                </div>
                <table className="data-table" style={{ width: '100%' }}>
                  <thead><tr><th>Item</th><th style={{ width: 50 }}>Qty</th><th style={{ width: 90 }}>Price</th></tr></thead>
                  <tbody>
                    {estPanel.lines.length === 0 ? (
                      <tr><td colSpan="3" style={{ color: 'var(--mist)' }}>No line items.</td></tr>
                    ) : estPanel.lines.map((l, i) => (
                      <tr key={i}>
                        <td style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{l.description}</td>
                        <td>{l.quantity}</td>
                        <td>{money(l.unit_price) || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ textAlign: 'right', marginTop: 12, fontWeight: 800, fontSize: 16 }}>Total: {money(estTotal) || '$0'}</div>
              </>
            )}
          </div>
        </div>
      )}

      {newItemMode && (
        <QuickAddModal
          mode={newItemMode}
          orgId={selectedOrg}
          profile={profile}
          onClose={() => setNewItemMode(null)}
          onCreated={() => loadAll(selectedOrg)}
        />
      )}
    </div>
  )
}

