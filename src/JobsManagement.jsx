import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import { fetchAllRows } from './utils/csvImport'

const WARRANTY_OPTIONS = ['Warranty', 'Cash']
const CLAIM_STATUS_OPTIONS = ['Not Eligible', 'Pending', 'Approved']
const COMM_OPTIONS = ['Pending', 'Notified', 'Price Approved']

function todayISO() {
  const d = new Date()
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d - tz).toISOString().slice(0, 10)
}

const blankPartForm = { part_description: '', part_number: '', po_number: '', vendor_id: '', segment_assigned: '', expected_delivery_date: '' }

export default function JobsManagement({ profile }) {
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [loading, setLoading] = useState(true)

  const [incompleteRecords, setIncompleteRecords] = useState([])
  const [allJobs, setAllJobs] = useState([])
  const [partsOrders, setPartsOrders] = useState([])
  const [vendors, setVendors] = useState([])

  const [showVerifiedParts, setShowVerifiedParts] = useState(false)
  const [addingPartFor, setAddingPartFor] = useState(null)
  const [partForm, setPartForm] = useState(blankPartForm)
  const [savingPart, setSavingPart] = useState(false)

  const isSuperAdmin = profile.role === 'super_admin'

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
      const [records, jobs, parts, vendorsData] = await Promise.all([
        fetchAllRows(() =>
          supabase
            .from('job_incomplete_records')
            .select(`
              id, job_id, estimate_id, warranty_or_cash, claim_status, customer_communication,
              equipment_brand, equipment_model, equipment_serial, created_at, reason,
              jobs ( id, job_number, segment, job_date, status, property_id,
                properties ( street_address, customers!properties_customer_id_fkey ( display_name, primary_phone ) )
              )
            `)
            .eq('org_id', orgId)
            .order('created_at', { ascending: false })
        ),
        fetchAllRows(() => supabase.from('jobs').select('id, job_number, segment, status, job_date').eq('org_id', orgId)),
        fetchAllRows(() => supabase.from('parts_orders').select('*').eq('org_id', orgId).order('created_at', { ascending: false })),
        fetchAllRows(() => supabase.from('vendors').select('id, name, phone').eq('org_id', orgId).eq('is_active', true).order('name')),
      ])
      setIncompleteRecords(records)
      setAllJobs(jobs)
      setPartsOrders(parts)
      setVendors(vendorsData)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadAll(selectedOrg)
  }, [selectedOrg])

  // A row only shows while the job's newest segment hasn't reached Complete.
  // Red = the incomplete segment IS the newest one (nothing done yet).
  // Yellow = a newer segment already exists (a fix visit is on the books).
  const visibleIncomplete = incompleteRecords
    .map((rec) => {
      const job = rec.jobs
      if (!job) return null
      const siblingSegments = allJobs.filter((j) => j.job_number === job.job_number)
      const maxSegment = siblingSegments.reduce((max, j) => Math.max(max, j.segment || 1), 1)
      const currentSegmentJob = siblingSegments.find((j) => j.segment === maxSegment)
      if (currentSegmentJob?.status === 'completed') return null
      const isRed = maxSegment === job.segment
      const scheduledDate = !isRed ? currentSegmentJob?.job_date : null
      const relatedParts = partsOrders.filter((p) => p.incomplete_record_id === rec.id)
      const nextDeliveryDate = relatedParts
        .filter((p) => !p.delivery_verified && p.expected_delivery_date)
        .map((p) => p.expected_delivery_date)
        .sort()[0] || null
      return { ...rec, job, isRed, scheduledDate, relatedParts, nextDeliveryDate }
    })
    .filter(Boolean)

  const visibleParts = partsOrders.filter((p) => showVerifiedParts || !p.delivery_verified)

  function vendorName(id) {
    return vendors.find((v) => v.id === id)?.name || ''
  }
  function vendorPhone(id) {
    return vendors.find((v) => v.id === id)?.phone || ''
  }
  function scheduleConfirmedFor(job_id, segmentAssigned) {
    if (!segmentAssigned) return null
    const originJob = allJobs.find((j) => j.id === job_id)
    if (!originJob) return null
    const match = allJobs.find((j) => j.job_number === originJob.job_number && j.segment === Number(segmentAssigned))
    return match ? match.job_date : null
  }

  async function updateRecordField(id, field, value) {
    await supabase.from('job_incomplete_records').update({ [field]: value }).eq('id', id)
    loadAll(selectedOrg)
  }

  function startAddPart(rec) {
    setAddingPartFor(rec.id)
    setPartForm(blankPartForm)
  }

  async function saveNewPart(rec) {
    if (!partForm.part_description.trim()) return
    setSavingPart(true)
    await supabase.from('parts_orders').insert({
      org_id: selectedOrg,
      job_id: rec.job_id,
      incomplete_record_id: rec.id,
      segment_assigned: partForm.segment_assigned ? parseInt(partForm.segment_assigned, 10) : null,
      part_description: partForm.part_description.trim(),
      part_number: partForm.part_number.trim() || null,
      po_number: partForm.po_number.trim() || null,
      vendor_id: partForm.vendor_id || null,
      expected_delivery_date: partForm.expected_delivery_date || null,
    })
    setSavingPart(false)
    setAddingPartFor(null)
    setPartForm(blankPartForm)
    loadAll(selectedOrg)
  }

  async function updatePartField(id, field, value) {
    await supabase.from('parts_orders').update({ [field]: value }).eq('id', id)
    loadAll(selectedOrg)
  }

  async function toggleVerified(part) {
    await supabase.from('parts_orders').update({ delivery_verified: !part.delivery_verified }).eq('id', part.id)
    loadAll(selectedOrg)
  }

  function deliveryDateStyle(dateStr) {
    if (!dateStr) return {}
    if (dateStr === todayISO()) return { background: 'rgba(76, 217, 123, 0.2)', color: '#1F7A43', fontWeight: 700, padding: '2px 6px', borderRadius: 4 }
    return {}
  }

  return (
    <div>
      <h2 className="page-title">Jobs Management</h2>

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
              <table className="data-table" style={{ minWidth: 1400 }}>
                <thead>
                  <tr>
                    <th>Job #</th>
                    <th>Seg #</th>
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
                    <th>Segment Scheduled</th>
                    <th>Job Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleIncomplete.map((rec) => (
                    <>
                      <tr key={rec.id} style={{ background: rec.isRed ? 'rgba(255, 107, 107, 0.08)' : 'rgba(242, 169, 60, 0.08)' }}>
                        <td>{rec.job.job_number}</td>
                        <td>{rec.job.segment}</td>
                        <td>{rec.job.properties?.customers?.display_name || '—'}</td>
                        <td>{rec.job.properties?.customers?.primary_phone || '—'}</td>
                        <td style={{ maxWidth: 180, fontSize: 12 }}>{rec.reason || '—'}</td>
                        <td>
                          {rec.estimate_id ? (
                            <Link to={`/estimate/${rec.job.id}`} className="status-pill status-active" style={{ textDecoration: 'none' }}>Estimate linked</Link>
                          ) : (
                            <Link to={`/estimate/${rec.job.id}`} className="logout-button" style={{ textDecoration: 'none', display: 'inline-block' }}>Attach estimate</Link>
                          )}
                        </td>
                        <td>
                          <input type="text" value={rec.equipment_brand || ''} onChange={(e) => updateRecordField(rec.id, 'equipment_brand', e.target.value)} style={{ width: 90 }} />
                        </td>
                        <td>
                          <input type="text" value={rec.equipment_model || ''} onChange={(e) => updateRecordField(rec.id, 'equipment_model', e.target.value)} style={{ width: 90 }} />
                        </td>
                        <td>
                          <input type="text" value={rec.equipment_serial || ''} onChange={(e) => updateRecordField(rec.id, 'equipment_serial', e.target.value)} style={{ width: 90 }} />
                        </td>
                        <td>
                          <select value={rec.warranty_or_cash || ''} onChange={(e) => updateRecordField(rec.id, 'warranty_or_cash', e.target.value)}>
                            <option value="">Select…</option>
                            {WARRANTY_OPTIONS.map((o) => <option key={o} value={o.toLowerCase()}>{o}</option>)}
                          </select>
                        </td>
                        <td>
                          <select value={rec.claim_status || ''} onChange={(e) => updateRecordField(rec.id, 'claim_status', e.target.value)}>
                            <option value="">Select…</option>
                            {CLAIM_STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </td>
                        <td>
                          <select value={rec.customer_communication || ''} onChange={(e) => updateRecordField(rec.id, 'customer_communication', e.target.value)}>
                            <option value="">Select…</option>
                            {COMM_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </td>
                        <td>
                          {rec.nextDeliveryDate ? (
                            <span style={deliveryDateStyle(rec.nextDeliveryDate)}>{new Date(rec.nextDeliveryDate + 'T00:00:00').toLocaleDateString()}</span>
                          ) : '—'}
                        </td>
                        <td>{rec.scheduledDate ? new Date(rec.scheduledDate + 'T00:00:00').toLocaleDateString() : '—'}</td>
                        <td><span className={`status-pill status-${rec.isRed ? 'past_due' : 'trial'}`}>{rec.isRed ? 'Incomplete' : 'Scheduled'}</span></td>
                        <td><button className="logout-button" onClick={() => startAddPart(rec)}>+ Add Part</button></td>
                      </tr>
                      {addingPartFor === rec.id && (
                        <tr key={rec.id + '-form'}>
                          <td colSpan="16" style={{ background: 'var(--ink)', padding: 16 }}>
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                              <div className="field" style={{ marginBottom: 0, minWidth: 200 }}>
                                <label>Part Description</label>
                                <input type="text" value={partForm.part_description} onChange={(e) => setPartForm({ ...partForm, part_description: e.target.value })} />
                              </div>
                              <div className="field" style={{ marginBottom: 0, minWidth: 130 }}>
                                <label>Part # (optional)</label>
                                <input type="text" value={partForm.part_number} onChange={(e) => setPartForm({ ...partForm, part_number: e.target.value })} />
                              </div>
                              <div className="field" style={{ marginBottom: 0, minWidth: 130 }}>
                                <label>PO #</label>
                                <input type="text" value={partForm.po_number} onChange={(e) => setPartForm({ ...partForm, po_number: e.target.value })} />
                              </div>
                              <div className="field" style={{ marginBottom: 0, minWidth: 160 }}>
                                <label>Vendor</label>
                                <select value={partForm.vendor_id} onChange={(e) => setPartForm({ ...partForm, vendor_id: e.target.value })}>
                                  <option value="">Select…</option>
                                  {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
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
                              <button className="auth-button" style={{ width: 'auto' }} disabled={savingPart} onClick={() => saveNewPart(rec)}>
                                {savingPart ? 'Saving…' : 'Add'}
                              </button>
                              <button className="logout-button" onClick={() => setAddingPartFor(null)}>Cancel</button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
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
                    <th>Seg # Assigned</th>
                    <th>Part Description</th>
                    <th>Part # (optional)</th>
                    <th>PO #</th>
                    <th>Vendor</th>
                    <th>Vendor Phone</th>
                    <th>Expected Delivery</th>
                    <th>Delivery Verified</th>
                    <th>Schedule Confirmed</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleParts.map((p) => {
                    const originJob = allJobs.find((j) => j.id === p.job_id)
                    const scheduledDate = scheduleConfirmedFor(p.job_id, p.segment_assigned)
                    return (
                      <tr key={p.id}>
                        <td>{originJob?.job_number || '—'}</td>
                        <td>
                          <input type="number" value={p.segment_assigned || ''} onChange={(e) => updatePartField(p.id, 'segment_assigned', e.target.value ? parseInt(e.target.value, 10) : null)} style={{ width: 60 }} />
                        </td>
                        <td>{p.part_description}</td>
                        <td>{p.part_number || '—'}</td>
                        <td>{p.po_number || '—'}</td>
                        <td>
                          {p.vendor_id ? (
                            <Link to={`/vendors/${p.vendor_id}`}>{vendorName(p.vendor_id)}</Link>
                          ) : (
                            <select value={p.vendor_id || ''} onChange={(e) => updatePartField(p.id, 'vendor_id', e.target.value || null)}>
                              <option value="">Select…</option>
                              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                            </select>
                          )}
                        </td>
                        <td>{vendorPhone(p.vendor_id) || '—'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input
                              type="date"
                              value={p.expected_delivery_date || ''}
                              onChange={(e) => updatePartField(p.id, 'expected_delivery_date', e.target.value || null)}
                            />
                            {p.expected_delivery_date === todayISO() && !p.delivery_verified && (
                              <span className="status-pill status-active">Today</span>
                            )}
                          </div>
                        </td>
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
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
