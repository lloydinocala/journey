import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import { IconChevronLeft, IconCalculator } from './MobileIcons'
import RoutingSummary from './RoutingSummary'

export default function TechSystemEstimate({ profile }) {
  const { jobId, estimateId } = useParams()
  const navigate = useNavigate()

  const [job, setJob] = useState(null)
  const [estimate, setEstimate] = useState(null)
  const [lineItems, setLineItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])

  const [systemTypes, setSystemTypes] = useState([])
  const [pickSystemType, setPickSystemType] = useState('')
  const [sizeOptions, setSizeOptions] = useState([])
  const [pickSize, setPickSize] = useState('')
  const [pickSeer, setPickSeer] = useState('')
  const [matchingEquipment, setMatchingEquipment] = useState([])
  const [equipmentSearch, setEquipmentSearch] = useState('')
  const [selectedEquipmentId, setSelectedEquipmentId] = useState('')
  const [addingSystem, setAddingSystem] = useState(false)
  const [systemTaxable, setSystemTaxable] = useState(false)

  const [customDesc, setCustomDesc] = useState('')
  const [customQty, setCustomQty] = useState('1')
  const [customTaxable, setCustomTaxable] = useState(true)
  const [addingCustom, setAddingCustom] = useState(false)

  const [discountType, setDiscountType] = useState('dollar')
  const [discountAmount, setDiscountAmount] = useState('0')
  const [taxRate, setTaxRate] = useState(0)

  async function loadJobAndEstimate() {
    setLoading(true)
    let jobData
    let existingEstimate

    if (estimateId) {
      // Property-based (job-less) system estimate — created by the picker. Load it and build a
      // job-shaped context so the rest of the builder works unchanged.
      const { data: est } = await supabase.from('invoices').select('*').eq('id', estimateId).eq('kind', 'estimate').maybeSingle()
      if (!est) { setJob(null); setLoading(false); return }
      existingEstimate = est
      const { data: prop } = await supabase
        .from('properties')
        .select('street_address, org_id, customer_id, customers!properties_customer_id_fkey(display_name, primary_phone, email_1)')
        .eq('id', est.property_id)
        .maybeSingle()
      jobData = {
        id: null,
        org_id: est.org_id,
        customer_id: est.bills_to_customer_id || prop?.customer_id || null,
        property_id: est.property_id,
        properties: prop ? { street_address: prop.street_address, customers: prop.customers } : null,
      }
    } else {
      const { data: jd } = await supabase
        .from('jobs')
        .select('id, job_number, job_date, org_id, customer_id, property_id, properties(street_address, customers!properties_customer_id_fkey(display_name, primary_phone, email_1))')
        .eq('id', jobId)
        .single()
      if (!jd) { setJob(null); setLoading(false); return }
      jobData = jd

      const { data: ee } = await supabase.from('invoices').select('*').eq('job_id', jobId).eq('kind', 'estimate').maybeSingle()
      existingEstimate = ee
      if (!existingEstimate) {
        const { count } = await supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('org_id', jobData.org_id).eq('kind', 'estimate')
        const estimateNumber = 'EST-' + String((count || 0) + 1).padStart(4, '0')
        const { data: created } = await supabase
          .from('invoices')
          .insert({
            org_id: jobData.org_id,
            invoice_number: estimateNumber,
            job_id: jobId,
            invoice_date: new Date().toISOString().slice(0, 10),
            bills_to_customer_id: jobData.customer_id,
            discount_type: 'dollar',
            kind: 'estimate',
            estimate_type: 'system',
          })
          .select()
          .single()
        existingEstimate = created
      }
    }

    setJob(jobData)

    const { data: usersData } = await supabase.from('users').select('id, full_name').eq('org_id', jobData.org_id).order('full_name')
    setUsers(usersData || [])

    setEstimate(existingEstimate)
    setDiscountType(existingEstimate.discount_type || 'dollar')
    setDiscountAmount(String(existingEstimate.discount_amount || 0))

    await loadLineItems(existingEstimate.id)

    const { data: typesData } = await supabase.from('equipment').select('system_type').eq('org_id', jobData.org_id).eq('active', true)
    setSystemTypes([...new Set((typesData || []).map((t) => t.system_type))].filter(Boolean).sort())

    const { data: orgData } = await supabase.from('organizations').select('sales_tax_rate, services_taxable_by_default').eq('id', jobData.org_id).single()
    if (orgData) {
      setTaxRate(orgData.sales_tax_rate || 0)
      setCustomTaxable(orgData.services_taxable_by_default)
    }

    setLoading(false)
  }

  async function handleCustomerDecision(decision) {
    if (!estimate) return
    const msg = decision === 'approved'
      ? 'Record the customer APPROVING this estimate? This creates a new install job to schedule.'
      : 'Record the customer DECLINING this estimate? This archives it.'
    if (!window.confirm(msg)) return
    const { data, error } = await supabase.rpc('record_customer_estimate_decision', { p_estimate_id: estimate.id, p_decision: decision })
    if (error) { alert(error.message); return }
    setEstimate((prev) => ({ ...prev, approval_status: data || (decision === 'approved' ? 'Approved' : 'Declined') }))
    alert(decision === 'approved' ? 'Approved — a new install job was created (unscheduled).' : 'Declined — estimate archived.')
  }

  async function loadLineItems(estimateId) {
    const { data } = await supabase.from('invoice_line_items').select('*').eq('invoice_id', estimateId).order('sort_order')
    setLineItems(data || [])
  }

  useEffect(() => { loadJobAndEstimate() }, [jobId, estimateId])

  useEffect(() => {
    if (!pickSystemType || !job) { setSizeOptions([]); return }
    supabase.from('equipment').select('size_tons').eq('org_id', job.org_id).eq('system_type', pickSystemType).eq('active', true)
      .then(({ data }) => {
        const sizes = [...new Set((data || []).map((r) => r.size_tons))].filter((s) => s != null).sort((a, b) => a - b)
        setSizeOptions(sizes)
      })
  }, [pickSystemType, job])

  useEffect(() => {
    if (!pickSystemType || !pickSize || !job) { setMatchingEquipment([]); return }
    supabase
      .from('equipment')
      .select('id, ahri_ref, outdoor_brand, outdoor_series, outdoor_model, indoor_brand, indoor_model, furnace_model, size_tons, seer2, eer2, energy_star, installation_price')
      .eq('org_id', job.org_id)
      .eq('system_type', pickSystemType)
      .eq('size_tons', pickSize)
      .eq('active', true)
      .order('outdoor_brand')
      .order('seer2', { ascending: false })
      .then(({ data }) => setMatchingEquipment(data || []))
  }, [pickSystemType, pickSize, job])

  const seerOptions = [...new Set(matchingEquipment.map((e) => e.seer2))].filter((sv) => sv != null).sort((a, b) => b - a)

  const filteredEquipment = matchingEquipment.filter((eq) => {
    if (pickSeer && String(eq.seer2) !== String(pickSeer)) return false
    if (!equipmentSearch) return true
    const q = equipmentSearch.toLowerCase()
    return (
      eq.outdoor_model?.toLowerCase().includes(q) ||
      eq.indoor_model?.toLowerCase().includes(q) ||
      eq.furnace_model?.toLowerCase().includes(q) ||
      eq.outdoor_brand?.toLowerCase().includes(q)
    )
  })

  const selectedEquipment = matchingEquipment.find((eq) => eq.id === selectedEquipmentId) || null

  async function handleAddSystem() {
    if (!selectedEquipment) return
    setAddingSystem(true)
    const nextSort = lineItems.length > 0 ? Math.max(...lineItems.map((li) => li.sort_order)) + 1 : 1
    const desc =
      selectedEquipment.outdoor_brand + ' ' + selectedEquipment.outdoor_model +
      ' / ' + selectedEquipment.indoor_brand + ' ' + selectedEquipment.indoor_model +
      (selectedEquipment.furnace_model ? ' / ' + selectedEquipment.furnace_model : '') +
      ' — ' + selectedEquipment.size_tons + ' Ton ' + pickSystemType
    await supabase.from('invoice_line_items').insert({
      invoice_id: estimate.id,
      org_id: job.org_id,
      description: desc,
      unit_price: selectedEquipment.installation_price,
      quantity: 1,
      taxable: systemTaxable,
      is_custom: false,
      sort_order: nextSort,
    })
    setAddingSystem(false)
    setPickSystemType('')
    setPickSize('')
    setPickSeer('')
    setMatchingEquipment([])
    setSelectedEquipmentId('')
    setEquipmentSearch('')
    loadLineItems(estimate.id)
  }

  async function handleAddCustom(e) {
    e.preventDefault()
    if (!customDesc.trim()) return
    if (lineItems.filter((li) => li.is_custom).length >= 2) return
    setAddingCustom(true)
    const nextSort = lineItems.length > 0 ? Math.max(...lineItems.map((li) => li.sort_order)) + 1 : 1
    await supabase.from('invoice_line_items').insert({
      invoice_id: estimate.id,
      org_id: job.org_id,
      description: customDesc.trim(),
      unit_price: 0,
      quantity: parseFloat(customQty) || 1,
      taxable: customTaxable,
      is_custom: true,
      custom_status: 'pending',
      sort_order: nextSort,
    })
    setAddingCustom(false)
    setCustomDesc('')
    setCustomQty('1')
    loadLineItems(estimate.id)
  }

  async function removeLineItem(id) {
    await supabase.from('invoice_line_items').delete().eq('id', id)
    loadLineItems(estimate.id)
  }

  async function updateLineItem(id, field, value) {
    await supabase.from('invoice_line_items').update({ [field]: value }).eq('id', id)
    loadLineItems(estimate.id)
  }

  async function updateEstimatingTechnician(userId) {
    await supabase.from('invoices').update({ estimating_technician_id: userId || null }).eq('id', estimate.id)
    setEstimate((prev) => ({ ...prev, estimating_technician_id: userId || null }))
  }

  async function updateApprovalStatus(status) {
    await supabase.from('invoices').update({ approval_status: status }).eq('id', estimate.id)
    setEstimate((prev) => ({ ...prev, approval_status: status }))
  }

  async function saveDiscount() {
    await supabase.from('invoices').update({ discount_type: discountType, discount_amount: parseFloat(discountAmount) || 0 }).eq('id', estimate.id)
  }

  const isPendingCustom = (li) => li.is_custom && li.custom_status === 'pending'
  const customCount = lineItems.filter((li) => li.is_custom).length
  const canAddCustom = customCount < 2
  const billable = lineItems.filter((li) => !isPendingCustom(li))
  const subtotal = billable.reduce((sum, li) => sum + li.quantity * li.unit_price, 0)
  const taxableSubtotal = billable.filter((li) => li.taxable).reduce((sum, li) => sum + li.quantity * li.unit_price, 0)
  const salesTax = taxableSubtotal * (taxRate / 100)
  const discountValue = discountType === 'percent' ? subtotal * ((parseFloat(discountAmount) || 0) / 100) : parseFloat(discountAmount) || 0
  const totalDue = Math.max(subtotal + salesTax - discountValue, 0)

  useEffect(() => {
    if (!estimate) return
    supabase.from('invoices').update({ subtotal, sales_tax: salesTax, job_total: totalDue, amount_due: totalDue, balance: totalDue }).eq('id', estimate.id).then(() => {})
  }, [subtotal, salesTax, totalDue, estimate])

  if (loading || !job || !estimate) {
    return (
      <div className="mobile-shell">
        <div className="mobile-header"><button className="mobile-back" onClick={() => navigate(-1)}><IconChevronLeft /></button></div>
        <div className="mobile-body"><p style={{ color: 'var(--mist)' }}>Loading…</p></div>
      </div>
    )
  }

  return (
    <div className="mobile-shell">
      <div className="mobile-header job-detail-header">
        <button className="mobile-back" onClick={() => navigate(-1)}><IconChevronLeft /></button>
        <div className="job-detail-header-text">
          <div className="job-detail-title">{estimate.invoice_number} — Job {job.job_number}</div>
          <div className="job-detail-sub">{job.properties?.customers?.display_name}</div>
        </div>
      </div>

      <div className="mobile-body">
        <RoutingSummary customerId={job.customer_id} propertyId={job.property_id} label="Estimate" />
        <div className="section-card">
          <div className="section-card-header"><span>Estimate Details</span></div>
          <div className="section-card-body">
            <div className="mobile-field">
              <label>Estimating Technician</label>
              <select value={estimate.estimating_technician_id || ''} onChange={(e) => updateEstimatingTechnician(e.target.value)}>
                <option value="">Unassigned</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
            <div className="mobile-field">
              <label>Approval Status</label>
              <select value={estimate.approval_status || 'Pending'} onChange={(e) => updateApprovalStatus(e.target.value)}>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="Pending Financing">Pending Financing</option>
              </select>
            </div>
          </div>
        </div>

        <div className="section-card">
          <div className="section-card-header"><span><IconCalculator /> Line Items</span></div>
          <div className="section-card-body">
            {lineItems.length === 0 && <p style={{ color: 'var(--mist)', fontSize: 13, margin: 0 }}>No line items yet — add a system below.</p>}
            {lineItems.map((li) => (
              <div key={li.id} className="line-item-card">
                <div className="line-item-desc">
                  {li.description}
                  {isPendingCustom(li) && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#B8860B', background: 'rgba(184,134,11,0.12)', padding: '2px 7px', borderRadius: 6 }}>PENDING APPROVAL</span>}
                </div>
                <div className="line-item-fields">
                  <div className="mobile-field">
                    <label>Qty</label>
                    <input type="number" step="1" value={li.quantity} onChange={(e) => updateLineItem(li.id, 'quantity', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="mobile-field">
                    <label>Unit Price</label>
                    {isPendingCustom(li)
                      ? <div style={{ padding: '8px 0', color: 'var(--mist)', fontStyle: 'italic', fontSize: 13 }}>set by office</div>
                      : <div style={{ padding: '8px 0', fontWeight: 700 }}>${Number(li.unit_price).toFixed(2)}</div>}
                  </div>
                  <div className="line-item-ext">{isPendingCustom(li) ? '—' : `$${(li.quantity * li.unit_price).toFixed(2)}`}</div>
                </div>
                <div className="line-item-meta-row">
                  <span>{isPendingCustom(li) ? 'Awaiting office pricing — not on the customer estimate yet' : (li.taxable ? 'Taxable' : 'Non-taxable')}</span>
                  <button className="remove-item-btn" onClick={() => removeLineItem(li.id)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="section-card">
          <div className="section-card-header"><span>Add System</span></div>
          <div className="section-card-body">
            <div className="mobile-field">
              <label>System Type</label>
              <select value={pickSystemType} onChange={(e) => { setPickSystemType(e.target.value); setPickSize(''); setPickSeer(''); setSelectedEquipmentId('') }}>
                <option value="">Select…</option>
                {systemTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {pickSystemType && (
              <div className="mobile-field">
                <label>Size (Tons)</label>
                <select value={pickSize} onChange={(e) => { setPickSize(e.target.value); setPickSeer(''); setSelectedEquipmentId('') }}>
                  <option value="">Select…</option>
                  {sizeOptions.map((s) => <option key={s} value={s}>{s} Ton</option>)}
                </select>
              </div>
            )}
            {pickSize && seerOptions.length > 1 && (
              <div className="mobile-field">
                <label>SEER2 (optional filter)</label>
                <select value={pickSeer} onChange={(e) => { setPickSeer(e.target.value); setSelectedEquipmentId('') }}>
                  <option value="">All SEER2</option>
                  {seerOptions.map((sv) => <option key={sv} value={sv}>SEER2 {sv}</option>)}
                </select>
              </div>
            )}
            {pickSize && matchingEquipment.length > 0 && (
              <div className="mobile-field">
                <label>Search Models</label>
                <input type="text" value={equipmentSearch} onChange={(e) => setEquipmentSearch(e.target.value)} placeholder="Filter by brand or model…" />
              </div>
            )}
            {pickSize && filteredEquipment.map((eq) => (
              <div
                key={eq.id}
                className={'equipment-option-card' + (selectedEquipmentId === eq.id ? ' selected' : '')}
                onClick={() => setSelectedEquipmentId(eq.id)}
              >
                <div className="eq-title">
                  {eq.outdoor_brand} {eq.outdoor_model}
                </div>
                <div className="eq-sub">
                  Indoor: {eq.indoor_brand} {eq.indoor_model}{eq.furnace_model ? ` / ${eq.furnace_model}` : ''}
                </div>
                <div className="eq-sub">
                  {eq.size_tons} Ton · SEER2 {eq.seer2 ?? '—'} · EER2 {eq.eer2 ?? '—'}{eq.energy_star ? ' · Energy Star' : ''}
                </div>
                <div className="eq-price">${eq.installation_price?.toFixed(2)}</div>
              </div>
            ))}
            {pickSize && matchingEquipment.length === 0 && (
              <p style={{ color: '#C0392B', fontSize: 12.5 }}>No equipment found for this combination.</p>
            )}
            {selectedEquipment && (
              <>
                <label className="mobile-checkbox-row">
                  <input type="checkbox" checked={systemTaxable} onChange={(e) => setSystemTaxable(e.target.checked)} />
                  Taxable
                </label>
                <button className="action-btn primary" style={{ flex: 'none', padding: '9px 20px' }} onClick={handleAddSystem} disabled={addingSystem}>
                  {addingSystem ? 'Adding…' : 'Add to Estimate'}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="section-card">
          <div className="section-card-header"><span>Add Custom Item <span style={{ color: 'var(--mist)', fontWeight: 400, fontSize: 12 }}>({customCount}/2)</span></span></div>
          <div className="section-card-body">
            <p style={{ color: 'var(--mist)', fontSize: 12, marginTop: 0 }}>
              For an install extra the price book doesn't cover (e.g. an added duct run). Your office prices and approves it before it shows on the customer's estimate — you don't set the price here. Up to 2 per estimate.
            </p>
            {canAddCustom ? (
              <form onSubmit={handleAddCustom}>
                <div className="mobile-field">
                  <label>What is it?</label>
                  <input type="text" value={customDesc} onChange={(e) => setCustomDesc(e.target.value)} placeholder="e.g. Extra duct run to back bedroom" required />
                </div>
                <div className="mobile-field-row">
                  <div className="mobile-field"><label>Qty</label><input type="number" step="1" value={customQty} onChange={(e) => setCustomQty(e.target.value)} /></div>
                </div>
                <label className="mobile-checkbox-row">
                  <input type="checkbox" checked={customTaxable} onChange={(e) => setCustomTaxable(e.target.checked)} />
                  Taxable
                </label>
                <button className="action-btn primary" style={{ flex: 'none', padding: '9px 20px' }} type="submit" disabled={addingCustom || !customDesc.trim()}>
                  {addingCustom ? 'Submitting…' : 'Submit for Approval'}
                </button>
              </form>
            ) : (
              <p style={{ color: '#B8860B', fontSize: 13, margin: 0, fontWeight: 600 }}>Custom‑item limit reached (2). Remove one to add another.</p>
            )}
          </div>
        </div>

        <div className="section-card">
          <div className="section-card-header"><span>Totals</span></div>
          <div className="section-card-body">
            <div className="mobile-field-row" style={{ marginBottom: 10 }}>
              <div className="mobile-field" style={{ flex: '0 0 80px' }}>
                <label>Discount</label>
                <select value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
                  <option value="dollar">$</option>
                  <option value="percent">%</option>
                </select>
              </div>
              <div className="mobile-field">
                <label>Amount</label>
                <input type="number" step="0.01" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} onBlur={saveDiscount} />
              </div>
            </div>
            <div className="totals-block">
              <div className="totals-row"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
              <div className="totals-row"><span>Sales Tax</span><span>${salesTax.toFixed(2)}</span></div>
              <div className="totals-row"><span>Discount</span><span>-${discountValue.toFixed(2)}</span></div>
              <div className="totals-row total"><span>Estimated Total</span><span>${totalDue.toFixed(2)}</span></div>
            </div>
          </div>
        </div>

        <div className="section-card">
          <div className="section-card-header"><span>Review &amp; Send</span></div>
          <div className="section-card-body">
            <p style={{ color: 'var(--mist)', fontSize: 12, marginTop: 0 }}>
              Review the estimate exactly as the customer will see it, then send it.
            </p>
            <button
              className="action-btn primary"
              style={{ width: '100%', padding: '13px 0', fontSize: 14 }}
              onClick={() => navigate(`/tech/invoice-view/${estimate.id}`)}
            >
              View &amp; Send Estimate
            </button>
            <p style={{ color: 'var(--mist)', fontSize: 12, margin: '14px 0 6px' }}>
              Or, if the customer is with you and deciding now:
            </p>
            {estimate.approval_status === 'Approved' || estimate.approval_status === 'Declined' ? (
              <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Decision recorded: {estimate.approval_status}.</p>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="action-btn" style={{ flex: 1, padding: '12px 0', fontSize: 14, background: '#16A34A', color: '#fff', border: 'none' }} onClick={() => handleCustomerDecision('approved')}>
                  Approve
                </button>
                <button className="action-btn" style={{ flex: 1, padding: '12px 0', fontSize: 14, background: '#DC2626', color: '#fff', border: 'none' }} onClick={() => handleCustomerDecision('declined')}>
                  Decline
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
