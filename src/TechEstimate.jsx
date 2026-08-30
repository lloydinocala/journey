import { useEffect, useState } from 'react'
import QuincyDock from './QuincyDock'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from './utils/supabase'
import { IconChevronLeft, IconFile } from './MobileIcons'
import { can } from './utils/permissions'

function unitLine(label, brand, model, serial) {
  if (!brand && !model && !serial) return null
  return `${label} ${[brand, model].filter(Boolean).join(' ')}${serial ? ' SN ' + serial : ''}`.trim()
}
function buildEquipSummary(list) {
  const parts = list.map((e, i) => {
    const label = e.system_label || `System ${i + 1}`
    if (e.info_unavailable_reason) return `${label}: information not available — ${e.info_unavailable_reason}`
    const units = [
      unitLine('Outdoor', e.outdoor_brand, e.outdoor_model, e.outdoor_serial),
      unitLine('Indoor', e.indoor_brand, e.indoor_model, e.indoor_serial),
      unitLine('Furnace', e.furnace_brand, e.furnace_model, e.furnace_serial),
    ].filter(Boolean)
    return `${label}: ${units.join('; ') || '—'}`
  })
  if (!parts.length) return null
  return 'Equipment on file — ' + parts.join('  |  ')
}

export default function TechEstimate({ profile }) {
  const { jobId } = useParams()
  const [searchParams] = useSearchParams()
  // When present, this is a follow-up/standalone estimate: jobId is only the CONTEXT
  // (customer/property/pricing); we operate on this specific estimate, which isn't bound
  // to the job and doesn't affect its completion.
  const followupId = searchParams.get('followup')
  const navigate = useNavigate()

  const [job, setJob] = useState(null)
  const [estimate, setEstimate] = useState(null)
  const [lineItems, setLineItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])

  const [categories, setCategories] = useState([])
  const [pickCategory, setPickCategory] = useState('')
  const [servicesInCategory, setServicesInCategory] = useState([])
  const [pickServiceId, setPickServiceId] = useState('')
  const [matchingVariants, setMatchingVariants] = useState([])
  const [pickPartSource, setPickPartSource] = useState('')
  const [addonCat, setAddonCat] = useState('')
  const [addonSvcList, setAddonSvcList] = useState([])
  const [addonSvcId, setAddonSvcId] = useState('')
  const [addonVariants, setAddonVariants] = useState([])
  const [addonPartSource, setAddonPartSource] = useState('')
  const [addingService, setAddingService] = useState(false)

  const [customDesc, setCustomDesc] = useState('')
  const [customQty, setCustomQty] = useState('1')
  const [customPrice, setCustomPrice] = useState('')
  const [customTaxable, setCustomTaxable] = useState(false)
  const [addingCustom, setAddingCustom] = useState(false)

  const [discountType, setDiscountType] = useState('dollar')
  const [discountAmount, setDiscountAmount] = useState('0')
  const [custOpen, setCustOpen] = useState(false)
  const [custAmt, setCustAmt] = useState('')
  const [custReason, setCustReason] = useState('')
  const [discountApproverName, setDiscountApproverName] = useState('')
  const [taxRate, setTaxRate] = useState(0)

  async function loadJobAndEstimate() {
    setLoading(true)
    const { data: jobData } = await supabase
      .from('jobs')
      .select('id, job_number, job_date, diagnosis_note, org_id, customer_id, property_id, trip_charge_price_id, properties(street_address, customers!properties_customer_id_fkey(display_name, primary_phone, email_1)), trip_charge:trip_charge_price_id(location, access, hours, price, cost, task_hours, customer_display, services(id, name, is_tax_exempt))')
      .eq('id', jobId)
      .single()
    setJob(jobData)
    if (!jobData) { setLoading(false); return }

    const { data: usersData } = await supabase.from('users').select('id, full_name').eq('org_id', jobData.org_id).order('full_name')
    setUsers(usersData || [])

    let { data: existingEstimate } = await supabase
      .from('invoices')
      .select('*')
      .eq(followupId ? 'id' : 'job_id', followupId || jobId)
      .eq('kind', 'estimate')
      .maybeSingle()

    if (!existingEstimate && !followupId) {
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
          estimate_type: 'service',
        })
        .select()
        .single()
      existingEstimate = created

      if (jobData.trip_charge_price_id && jobData.trip_charge) {
        const tc = jobData.trip_charge
        await supabase.from('invoice_line_items').insert({
          invoice_id: created.id,
          org_id: jobData.org_id,
          description: tc.customer_display,
          unit_price: tc.price,
          quantity: 1,
          taxable: !tc.services?.is_tax_exempt,
          is_custom: false,
          sort_order: 1,
          category: 'TRIP CHARGES',
        })
      }
    }

    // Item 9: pull the property's equipment (or the reason it's unavailable) onto
    // the estimate as a non-billable "Equipment on File" note line, kept in sync.
    await syncEquipmentLine(existingEstimate.id, jobData)

    // Default the Estimating Technician to the job's first-listed technician (by sort order).
    if (!existingEstimate.estimating_technician_id) {
      const { data: firstTech } = await supabase
        .from('job_technicians')
        .select('user_id')
        .eq('job_id', jobId)
        .order('sort_order')
        .limit(1)
        .maybeSingle()
      if (firstTech?.user_id) {
        await supabase.from('invoices').update({ estimating_technician_id: firstTech.user_id }).eq('id', existingEstimate.id)
        existingEstimate = { ...existingEstimate, estimating_technician_id: firstTech.user_id }
      }
    }

    setEstimate(existingEstimate)
    setDiscountType(existingEstimate.discount_type || 'dollar')
    setDiscountAmount(String(existingEstimate.discount_amount || 0))

    await loadLineItems(existingEstimate.id)

    const { data: cats } = await supabase.from('services').select('category').eq('org_id', jobData.org_id).eq('is_active', true).neq('category', 'TRIP CHARGES')
    setCategories([...new Set((cats || []).map((c) => c.category))].sort())

    const { data: orgData } = await supabase.from('organizations').select('sales_tax_rate').eq('id', jobData.org_id).single()
    if (orgData) {
      setTaxRate(orgData.sales_tax_rate || 0)
    }

    setLoading(false)
  }

  async function loadLineItems(estimateId) {
    const { data } = await supabase.from('invoice_line_items').select('*').eq('invoice_id', estimateId).order('sort_order')
    setLineItems(data || [])
  }

  async function syncEquipmentLine(estimateId, jobData) {
    if (!jobData?.property_id) return
    const { data: eqp } = await supabase.from('property_equipment')
      .select('system_label, outdoor_brand, outdoor_model, outdoor_serial, indoor_brand, indoor_model, indoor_serial, furnace_brand, furnace_model, furnace_serial, info_unavailable_reason')
      .eq('property_id', jobData.property_id).eq('status', 'active').order('created_at')
    const summary = buildEquipSummary(eqp || [])
    const { data: existing } = await supabase.from('invoice_line_items').select('id').eq('invoice_id', estimateId).eq('category', 'EQUIPMENT ON FILE').maybeSingle()
    if (!summary) { if (existing) await supabase.from('invoice_line_items').delete().eq('id', existing.id); return }
    if (existing) await supabase.from('invoice_line_items').update({ description: summary }).eq('id', existing.id)
    else await supabase.from('invoice_line_items').insert({ invoice_id: estimateId, org_id: jobData.org_id, description: summary, unit_price: 0, quantity: 1, taxable: false, is_custom: false, sort_order: 0, category: 'EQUIPMENT ON FILE' })
  }

  useEffect(() => { loadJobAndEstimate() }, [jobId])

  // Live discount decisions: when a supervisor approves/declines from The Tower,
  // reload so the estimate reflects it immediately (applied, or gone).
  useEffect(() => {
    if (!estimate?.id) return
    const ch = supabase
      .channel('estimate-' + estimate.id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'invoices', filter: `id=eq.${estimate.id}` }, () => { reloadEstimate() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [estimate?.id])

  useEffect(() => {
    if (!pickCategory || !job) { setServicesInCategory([]); return }
    supabase.from('services').select('id, name, is_tax_exempt').eq('org_id', job.org_id).eq('category', pickCategory).eq('is_active', true).order('name')
      .then(({ data }) => setServicesInCategory(data || []))
  }, [pickCategory, job])

  useEffect(() => {
    if (!pickServiceId || !job?.trip_charge) { setMatchingVariants([]); return }
    supabase
      .from('service_prices')
      .select('id, part_source, customer_display, price')
      .eq('service_id', pickServiceId)
      .eq('location', job.trip_charge.location)
      .eq('access', job.trip_charge.access)
      .eq('hours', job.trip_charge.hours)
      .eq('is_active', true)
      .then(({ data }) => { setMatchingVariants(data || []); setPickPartSource('') })
  }, [pickServiceId, job])

  const resolvedVariant =
    matchingVariants.length === 1
      ? matchingVariants[0]
      : matchingVariants.find((v) => (v.part_source || '') === pickPartSource) || null

  useEffect(() => {
    if (!addonCat || !job) { setAddonSvcList([]); return }
    supabase.from('services').select('id, name, is_tax_exempt').eq('org_id', job.org_id).eq('category', addonCat).eq('is_active', true).order('name')
      .then(({ data }) => setAddonSvcList(data || []))
  }, [addonCat, job])

  useEffect(() => {
    if (!addonSvcId || !job?.trip_charge) { setAddonVariants([]); return }
    supabase.from('service_prices').select('id, part_source, customer_display, price').eq('service_id', addonSvcId)
      .eq('location', job.trip_charge.location).eq('access', job.trip_charge.access).eq('hours', job.trip_charge.hours).eq('is_active', true)
      .then(({ data }) => { setAddonVariants(data || []); setAddonPartSource('') })
  }, [addonSvcId, job])

  const resolvedAddonVariant =
    addonVariants.length === 1
      ? addonVariants[0]
      : addonVariants.find((v) => (v.part_source || '') === addonPartSource) || null

  async function handleAddService() {
    if (!resolvedVariant) return
    setAddingService(true)
    const svc = servicesInCategory.find((s) => s.id === pickServiceId)
    const nextSort = lineItems.length > 0 ? Math.max(...lineItems.map((li) => li.sort_order)) + 1 : 1
    await supabase.from('invoice_line_items').insert({
      invoice_id: estimate.id,
      org_id: job.org_id,
      description: resolvedVariant.customer_display,
      unit_price: resolvedVariant.price,
      quantity: 1,
      taxable: svc?.is_tax_exempt === false,
      is_custom: false,
      sort_order: nextSort,
      service_id: pickServiceId,           // Elements-HVAC: stamped for later invoice consumption
      service_price_id: resolvedVariant.id,
    })
    setAddingService(false)
    setPickCategory('')
    setPickServiceId('')
    setMatchingVariants([])
    loadLineItems(estimate.id)
  }

  async function handleAddAddon() {
    const addonCount = lineItems.filter((li) => li.category === 'RECOMMENDED ADDONS').length
    if (!resolvedAddonVariant || addonCount >= 2) return
    setAddingService(true)
    const svc = addonSvcList.find((s) => s.id === addonSvcId)
    const nextSort = lineItems.length > 0 ? Math.max(...lineItems.map((li) => li.sort_order)) + 1 : 1
    await supabase.from('invoice_line_items').insert({
      invoice_id: estimate.id,
      org_id: job.org_id,
      description: resolvedAddonVariant.customer_display,
      unit_price: resolvedAddonVariant.price,
      quantity: 1,
      taxable: svc?.is_tax_exempt === false,
      is_custom: false,
      sort_order: nextSort,
      service_id: addonSvcId,
      service_price_id: resolvedAddonVariant.id,
      category: 'RECOMMENDED ADDONS',
    })
    setAddingService(false)
    setAddonCat('')
    setAddonSvcId('')
    setAddonVariants([])
    loadLineItems(estimate.id)
  }

  async function handleAddCustom(e) {
    e.preventDefault()
    if (!customDesc.trim() || !customPrice) return
    setAddingCustom(true)
    const nextSort = lineItems.length > 0 ? Math.max(...lineItems.map((li) => li.sort_order)) + 1 : 1
    await supabase.from('invoice_line_items').insert({
      invoice_id: estimate.id,
      org_id: job.org_id,
      description: customDesc.trim(),
      unit_price: parseFloat(customPrice) || 0,
      quantity: parseFloat(customQty) || 1,
      taxable: customTaxable,
      is_custom: true,
      sort_order: nextSort,
    })
    setAddingCustom(false)
    setCustomDesc('')
    setCustomQty('1')
    setCustomPrice('')
    setCustomTaxable(false)
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
  async function reloadEstimate() {
    const { data } = await supabase.from('invoices').select('*').eq('id', estimate.id).maybeSingle()
    if (data) setEstimate(data)
  }
  async function requestCustomDiscount() {
    const amt = parseFloat(custAmt)
    if (!(amt > 0)) return
    await supabase.from('invoices').update({
      discount_id: null, discount_type: 'dollar', discount_amount: amt,
      discount_label: custReason.trim() || 'Custom discount', discount_status: 'pending',
      discount_approved_by: null, discount_approved_at: null, discount_requested_by: profile.id,
    }).eq('id', estimate.id)
    setCustOpen(false); setCustAmt(''); setCustReason('')
    reloadEstimate()
  }
  async function approveCustomDiscount() {
    await supabase.from('invoices').update({
      discount_status: 'approved', discount_approved_by: profile?.id || null, discount_approved_at: new Date().toISOString(),
    }).eq('id', estimate.id)
    reloadEstimate()
  }
  async function removeCustomDiscount() {
    await supabase.from('invoices').update({
      discount_id: null, discount_amount: 0, discount_type: 'dollar', discount_label: null,
      discount_status: null, discount_approved_by: null, discount_approved_at: null,
    }).eq('id', estimate.id)
    setCustOpen(false); reloadEstimate()
  }

  const isFieldAdmin = !!(profile && (['org_admin', 'super_admin'].includes(profile.role) || profile.is_field_supervisor))
  const canApproveDiscount = profile?.role === 'super_admin' || can(profile, 'approve_nonstandard_discounts')

  const subtotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unit_price, 0)
  const taxableSubtotal = lineItems.filter((li) => li.taxable).reduce((sum, li) => sum + li.quantity * li.unit_price, 0)
  const salesTax = taxableSubtotal * (taxRate / 100)
  const hasCustomDiscount = !!(estimate && !estimate.discount_id && estimate.discount_status && Number(estimate.discount_amount) > 0)
  const customApproved = hasCustomDiscount && estimate.discount_status === 'approved'
  const customDollars = hasCustomDiscount ? Number(estimate.discount_amount) : 0
  const discountValue = hasCustomDiscount
    ? (customApproved ? customDollars : 0)
    : (discountType === 'percent' ? subtotal * ((parseFloat(discountAmount) || 0) / 100) : parseFloat(discountAmount) || 0)
  const totalDue = Math.max(subtotal + salesTax - discountValue, 0)
  const equipmentSummary = lineItems.find((li) => li.category === 'EQUIPMENT ON FILE')?.description || ''
  const addonItems = lineItems.filter((li) => li.category === 'RECOMMENDED ADDONS')
  const serviceLineItems = lineItems.filter((li) => li.category !== 'EQUIPMENT ON FILE' && li.category !== 'RECOMMENDED ADDONS')

  useEffect(() => {
    if (!estimate) return
    supabase.from('invoices').update({ subtotal, sales_tax: salesTax, job_total: totalDue, amount_due: totalDue, balance: totalDue }).eq('id', estimate.id).then(() => {})
  }, [subtotal, salesTax, totalDue, estimate])

  useEffect(() => {
    if (estimate?.discount_approved_by) {
      supabase.from('users').select('full_name').eq('id', estimate.discount_approved_by).maybeSingle().then(({ data }) => setDiscountApproverName(data?.full_name || ''))
    } else setDiscountApproverName('')
  }, [estimate?.discount_approved_by])

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
        {/* Under the Estimate # header: Equipment on File + Current Diagnosis, both required */}
        <div className="section-card">
          <div className="section-card-header"><span>Equipment on File</span></div>
          <div className="section-card-body">
            {equipmentSummary
              ? <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.5 }}>{equipmentSummary}</p>
              : <p style={{ margin: 0, fontSize: 13, color: '#C0392B', fontWeight: 600 }}>Required — no equipment on file yet. Capture it on the job card before sending this estimate.</p>}
          </div>
        </div>
        <div className="section-card">
          <div className="section-card-header"><span>Current Diagnosis</span></div>
          <div className="section-card-body">
            {job?.diagnosis_note
              ? <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.5 }}>{job.diagnosis_note}</p>
              : <p style={{ margin: 0, fontSize: 13, color: '#C0392B', fontWeight: 600 }}>Required — no diagnosis recorded yet. Record it on the job card before sending this estimate.</p>}
          </div>
        </div>
        <div className="section-card">
          <div className="section-card-header"><span>Estimate Details</span></div>
          <div className="section-card-body">
            <div className="builder-tech-row">
              <div className="mobile-field">
                <label>Estimating Technician</label>
                <select value={estimate.estimating_technician_id || ''} onChange={(e) => updateEstimatingTechnician(e.target.value)}>
                  <option value="">Unassigned</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
            </div>
            <div className="mobile-field">
              <label>Approval Status</label>
              <select value={estimate.approval_status || 'Pending'} onChange={(e) => updateApprovalStatus(e.target.value)}>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Declined">Declined</option>
                <option value="Pending Financing">Pending Financing</option>
              </select>
            </div>
            {!job.trip_charge && <p style={{ color: '#C0392B', fontSize: 12.5, margin: 0 }}>No trip charge set on this job — set it on the Jobs page for pricebook lookups.</p>}
          </div>
        </div>

        <div className="section-card">
          <div className="section-card-header"><span><IconFile /> Line Items</span></div>
          <div className="section-card-body">
            {serviceLineItems.length === 0 && <p style={{ color: 'var(--mist)', fontSize: 13, margin: 0 }}>No line items yet — add one below.</p>}
            {serviceLineItems.map((li) => (
              <div key={li.id} className="line-item-card">
                <div className="line-item-desc">{li.description}</div>
                <div className="line-item-fields">
                  <div className="mobile-field">
                    <label>Qty</label>
                    <input type="number" step="1" value={li.quantity} onChange={(e) => updateLineItem(li.id, 'quantity', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="mobile-field">
                    <label>Unit Price</label>
                    <input type="number" step="0.01" value={li.unit_price} onChange={(e) => updateLineItem(li.id, 'unit_price', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="line-item-ext">${(li.quantity * li.unit_price).toFixed(2)}</div>
                </div>
                <div className="line-item-meta-row">
                  <span>{li.taxable ? 'Taxable' : 'Non-taxable'}</span>
                  <button className="remove-item-btn" onClick={() => removeLineItem(li.id)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="section-card">
          <div className="section-card-header"><span>Add Service</span></div>
          <div className="section-card-body">
            <div className="mobile-field">
              <label>Category</label>
              <select value={pickCategory} onChange={(e) => { setPickCategory(e.target.value); setPickServiceId('') }}>
                <option value="">Select…</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {pickCategory && (
              <div className="mobile-field">
                <label>Service</label>
                <select value={pickServiceId} onChange={(e) => setPickServiceId(e.target.value)}>
                  <option value="">Select…</option>
                  {servicesInCategory.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            {pickServiceId && matchingVariants.length > 1 && (
              <div className="mobile-field">
                <label>Part Source</label>
                <select value={pickPartSource} onChange={(e) => setPickPartSource(e.target.value)}>
                  <option value="">Select…</option>
                  {matchingVariants.map((v) => <option key={v.id} value={v.part_source || ''}>{v.part_source || 'N/A'}</option>)}
                </select>
              </div>
            )}
            {pickServiceId && matchingVariants.length === 0 && job.trip_charge && (
              <p style={{ color: '#C0392B', fontSize: 12.5 }}>No price found for this service at the job's Location/Access/Hours.</p>
            )}
            {!job.trip_charge && (
              <p style={{ color: '#C0392B', fontSize: 12.5 }}>No trip charge set on this job — set it on the Jobs page first.</p>
            )}
            {resolvedVariant && <p style={{ fontWeight: 700, color: 'var(--route-blue)', fontSize: 14 }}>${resolvedVariant.price.toFixed(2)}</p>}
            <button className="action-btn primary" style={{ flex: 'none', padding: '9px 20px' }} onClick={handleAddService} disabled={!resolvedVariant || addingService}>
              {addingService ? 'Adding…' : 'Add to Estimate'}
            </button>
          </div>
        </div>

        <div className="section-card">
          <div className="section-card-header"><span>Add Custom Item</span></div>
          <div className="section-card-body">
            <form onSubmit={handleAddCustom}>
              <div className="mobile-field">
                <label>Description</label>
                <input type="text" value={customDesc} onChange={(e) => setCustomDesc(e.target.value)} required />
              </div>
              <div className="mobile-field-row">
                <div className="mobile-field"><label>Qty</label><input type="number" step="1" value={customQty} onChange={(e) => setCustomQty(e.target.value)} /></div>
                <div className="mobile-field"><label>Unit Price</label><input type="number" step="0.01" value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} required /></div>
              </div>
              <label className="mobile-checkbox-row">
                <input type="checkbox" checked={customTaxable} onChange={(e) => setCustomTaxable(e.target.checked)} />
                Taxable
              </label>
              <button className="action-btn primary" style={{ flex: 'none', padding: '9px 20px' }} type="submit" disabled={addingCustom}>
                {addingCustom ? 'Adding…' : 'Add to Estimate'}
              </button>
            </form>
          </div>
        </div>

        <div className="section-card">
          <div className="section-card-header"><span>Recommended Add-Ons</span></div>
          <div className="section-card-body">
            <p style={{ color: 'var(--mist)', fontSize: 12.5, marginTop: 0 }}>Optional upgrades to present for approval — up to 2, pulled from the pricebook.</p>
            {addonItems.map((li) => (
              <div key={li.id} className="line-item-card">
                <div className="line-item-desc">{li.description}</div>
                <div className="line-item-fields">
                  <div className="mobile-field">
                    <label>Qty</label>
                    <input type="number" step="1" value={li.quantity} onChange={(e) => updateLineItem(li.id, 'quantity', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="mobile-field">
                    <label>Unit Price</label>
                    <input type="number" step="0.01" value={li.unit_price} onChange={(e) => updateLineItem(li.id, 'unit_price', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="line-item-ext">${(li.quantity * li.unit_price).toFixed(2)}</div>
                </div>
                <div className="line-item-meta-row">
                  <span>{li.taxable ? 'Taxable' : 'Non-taxable'}</span>
                  <button className="remove-item-btn" onClick={() => removeLineItem(li.id)}>Remove</button>
                </div>
              </div>
            ))}
            {addonItems.length < 2 ? (
              <>
                <div className="mobile-field">
                  <label>Category</label>
                  <select value={addonCat} onChange={(e) => { setAddonCat(e.target.value); setAddonSvcId('') }}>
                    <option value="">Select…</option>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {addonCat && (
                  <div className="mobile-field">
                    <label>Service</label>
                    <select value={addonSvcId} onChange={(e) => setAddonSvcId(e.target.value)}>
                      <option value="">Select…</option>
                      {addonSvcList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}
                {addonSvcId && addonVariants.length > 1 && (
                  <div className="mobile-field">
                    <label>Part Source</label>
                    <select value={addonPartSource} onChange={(e) => setAddonPartSource(e.target.value)}>
                      <option value="">Select…</option>
                      {addonVariants.map((v) => <option key={v.id} value={v.part_source || ''}>{v.part_source || 'N/A'}</option>)}
                    </select>
                  </div>
                )}
                {resolvedAddonVariant && <p style={{ fontWeight: 700, color: 'var(--route-blue)', fontSize: 14 }}>${resolvedAddonVariant.price.toFixed(2)}</p>}
                <button className="action-btn primary" style={{ flex: 'none', padding: '9px 20px' }} onClick={handleAddAddon} disabled={!resolvedAddonVariant || addingService}>
                  {addingService ? 'Adding…' : '+ Add Recommended Add-On'}
                </button>
              </>
            ) : (
              <p style={{ color: 'var(--mist)', fontSize: 12.5, margin: 0 }}>Maximum of 2 recommended add-ons reached.</p>
            )}
          </div>
        </div>

        <div className="section-card">
          <div className="section-card-header"><span>Totals</span></div>
          <div className="section-card-body">
            {hasCustomDiscount ? (
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--mist)', marginBottom: 2 }}>Discount</label>
                <p style={{ margin: '2px 0', fontWeight: 600 }}>Custom: ${customDollars.toFixed(2)} off</p>
                {estimate.discount_label && <p style={{ margin: '2px 0', fontSize: 12, color: 'var(--mist)' }}>{estimate.discount_label}</p>}
                {customApproved ? (
                  <p style={{ margin: '2px 0', fontSize: 12, color: '#1F7A43', fontWeight: 600 }}>Approved{discountApproverName ? ` by ${discountApproverName}` : ''}{estimate.discount_approved_at ? ` · ${new Date(estimate.discount_approved_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}</p>
                ) : (
                  <p style={{ margin: '2px 0', fontSize: 12, color: '#B8860B', fontWeight: 600 }}>Pending approval &mdash; not applied until approved</p>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  {!customApproved && canApproveDiscount && (
                    <button type="button" className="action-btn" style={{ flex: 'none', padding: '7px 14px', borderColor: '#1F7A43', color: '#1F7A43' }} onClick={approveCustomDiscount}>Approve discount</button>
                  )}
                  {isFieldAdmin && <button type="button" className="action-btn" style={{ flex: 'none', padding: '7px 14px' }} onClick={removeCustomDiscount}>Remove</button>}
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 10 }}>
                <div className="mobile-field-row">
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
                {isFieldAdmin && (
                  <div style={{ marginTop: 8, borderTop: '1px solid var(--border,#eee)', paddingTop: 8 }}>
                    {!custOpen ? (
                      <button type="button" className="action-btn" style={{ flex: 'none', padding: '7px 14px' }} onClick={() => setCustOpen(true)}>+ Custom discount</button>
                    ) : (
                      <div>
                        <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--mist)' }}>One-off dollar discount &mdash; needs supervisor approval before it applies; not itemized on the customer&rsquo;s estimate.</p>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                          <span style={{ color: 'var(--mist)', fontWeight: 600 }}>$</span>
                          <input type="number" step="0.01" min="0" value={custAmt} onChange={(e) => setCustAmt(e.target.value)} placeholder="Dollar amount off" style={{ flex: 1 }} />
                        </div>
                        <input value={custReason} onChange={(e) => setCustReason(e.target.value)} placeholder="Reason (shown to approver)" style={{ width: '100%', marginBottom: 6 }} />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button type="button" className="action-btn primary" style={{ flex: 'none', padding: '7px 14px' }} onClick={requestCustomDiscount} disabled={!(parseFloat(custAmt) > 0)}>Submit for approval</button>
                          <button type="button" className="action-btn" style={{ flex: 'none', padding: '7px 14px' }} onClick={() => { setCustOpen(false); setCustAmt(''); setCustReason('') }}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
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
          </div>
        </div>
      </div>
    <QuincyDock profile={profile} />
    </div>
  )
}
