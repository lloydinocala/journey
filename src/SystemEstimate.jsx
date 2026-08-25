import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import RoutingSummary from './RoutingSummary'

export default function SystemEstimate({ profile }) {
  const { jobId, estimateId } = useParams()
  const [job, setJob] = useState(null)
  const [estimate, setEstimate] = useState(null)
  const [lineItems, setLineItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])

  const [systemTypes, setSystemTypes] = useState([])
  const [orgTemplates, setOrgTemplates] = useState({ install: '', warranty: '' })
  const [pickSystemType, setPickSystemType] = useState('')
  const [sizeOptions, setSizeOptions] = useState([])
  const [pickSize, setPickSize] = useState('')
  const [pickSeer, setPickSeer] = useState('')
  const [pickBrand, setPickBrand] = useState('')
  const [matchingEquipment, setMatchingEquipment] = useState([])
  const [equipmentSearch, setEquipmentSearch] = useState('')
  const [selectedEquipmentId, setSelectedEquipmentId] = useState('')
  const [addingSystem, setAddingSystem] = useState(false)
  const [systemTaxable, setSystemTaxable] = useState(false)
  const [includeLineset, setIncludeLineset] = useState(false)
  const [linesetPrice, setLinesetPrice] = useState('')
  const [specialFeatures, setSpecialFeatures] = useState([])
  const [pickFeatureId, setPickFeatureId] = useState('')
  const [addingFeature, setAddingFeature] = useState(false)

  const [customDesc, setCustomDesc] = useState('')
  const [customQty, setCustomQty] = useState('1')
  const [customPrice, setCustomPrice] = useState('')
  const [customTaxable, setCustomTaxable] = useState(true)
  const [addingCustom, setAddingCustom] = useState(false)

  const [discountType, setDiscountType] = useState('dollar')
  const [discountAmount, setDiscountAmount] = useState('0')
  const [taxRate, setTaxRate] = useState(0)

  const [sendingEmail, setSendingEmail] = useState(false)
  const [sendError, setSendError] = useState('')

  async function loadJobAndEstimate() {
    setLoading(true)
    let jobData
    let existingEstimate

    if (estimateId) {
      // Property-based (job-less) system estimate — already created by the picker. Load it,
      // load its property/customer, and build a job-shaped context object so the rest of the
      // builder works unchanged. No service call, no job is ever involved here.
      const { data: est } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', estimateId)
        .eq('kind', 'estimate')
        .maybeSingle()
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

      const { data: ee } = await supabase
        .from('invoices')
        .select('*')
        .eq('job_id', jobId)
        .eq('kind', 'estimate')
        .maybeSingle()
      existingEstimate = ee

      if (!existingEstimate) {
        const { count } = await supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', jobData.org_id)
          .eq('kind', 'estimate')
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

    const { data: usersData } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('org_id', jobData.org_id)
      .order('full_name')
    setUsers(usersData || [])

    setEstimate(existingEstimate)
    setDiscountType(existingEstimate.discount_type || 'dollar')
    setDiscountAmount(String(existingEstimate.discount_amount || 0))

    await loadLineItems(existingEstimate.id)

    const { data: typesData } = await supabase
      .from('equipment')
      .select('system_type')
      .eq('org_id', jobData.org_id)
      .eq('active', true)
    setSystemTypes([...new Set((typesData || []).map((t) => t.system_type))].filter(Boolean).sort())

    const { data: featData } = await supabase.from('special_features').select('id, name, description, price, warranty_text').eq('org_id', jobData.org_id).eq('active', true).order('name')
    setSpecialFeatures(featData || [])

    const { data: orgData } = await supabase
      .from('organizations')
      .select('sales_tax_rate, services_taxable_by_default, system_installation_includes, system_warranty_template')
      .eq('id', jobData.org_id)
      .single()
    if (orgData) {
      setTaxRate(orgData.sales_tax_rate || 0)
      setCustomTaxable(orgData.services_taxable_by_default)
      setOrgTemplates({ install: orgData.system_installation_includes || '', warranty: orgData.system_warranty_template || '' })
    }

    setLoading(false)
  }

  async function loadLineItems(estimateId) {
    const { data } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', estimateId)
      .order('sort_order')
    setLineItems(data || [])
  }

  useEffect(() => {
    loadJobAndEstimate()
  }, [jobId, estimateId])

  useEffect(() => {
    if (!pickSystemType || !job) {
      setSizeOptions([])
      return
    }
    supabase
      .from('equipment')
      .select('size_tons')
      .eq('org_id', job.org_id)
      .eq('system_type', pickSystemType)
      .eq('active', true)
      .then(({ data }) => {
        const sizes = [...new Set((data || []).map((r) => r.size_tons))].filter((s) => s != null).sort((a, b) => a - b)
        setSizeOptions(sizes)
      })
  }, [pickSystemType, job])

  useEffect(() => {
    if (!pickSystemType || !pickSize || !job) {
      setMatchingEquipment([])
      return
    }
    supabase
      .from('equipment')
      .select('id, ahri_ref, outdoor_brand, outdoor_series, outdoor_model, outdoor_description, indoor_brand, indoor_model, furnace_model, indoor_description, size_tons, seer2, eer2, energy_star, installation_price, subtotal, labor_warranty, manufacturer_warranty_years, lineset_requirements')
      .eq('org_id', job.org_id)
      .eq('system_type', pickSystemType)
      .eq('size_tons', pickSize)
      .eq('active', true)
      .order('outdoor_brand')
      .order('seer2', { ascending: false })
      .then(({ data }) => setMatchingEquipment(data || []))
  }, [pickSystemType, pickSize, job])

  const seerOptions = [...new Set(matchingEquipment.map((e) => e.seer2))].filter((s) => s != null).sort((a, b) => a - b)
  const brandOptions = [...new Set(matchingEquipment.map((e) => e.outdoor_brand))].filter(Boolean).sort()

  const filteredEquipment = matchingEquipment.filter((eq) => {
    if (pickSeer && String(eq.seer2) !== String(pickSeer)) return false
    if (pickBrand && eq.outdoor_brand !== pickBrand) return false
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
    const eq = selectedEquipment

    // Re-picking replaces the base system cleanly — clear any existing base sections first.
    await supabase.from('invoice_line_items').delete().eq('invoice_id', estimate.id).in('category', ['INDOOR_UNIT', 'OUTDOOR_UNIT', 'INSTALLATION', 'ALSO_INCLUDES', 'WARRANTY'])

    const clean = (str) => str.replace(/\s+/g, ' ').trim()

    const indoorDesc = [
      eq.ahri_ref ? `AHRI# ${eq.ahri_ref}` : null,
      ['INDOOR UNIT', clean(`${eq.indoor_brand || ''} ${eq.size_tons ?? ''} TON ${eq.indoor_description || ''}`)].join('\n'),
      eq.indoor_model ? `Model # ${eq.indoor_model}` : null,
    ].filter(Boolean).join('\n\n')

    const outdoorDesc = [
      ['OUTDOOR UNIT', clean(`${eq.outdoor_brand || ''} ${eq.size_tons ?? ''} TON, ${eq.seer2 ?? ''} SEER2 ${eq.outdoor_description || ''}`)].join('\n'),
      eq.outdoor_model ? `Model # ${eq.outdoor_model}` : null,
    ].filter(Boolean).join('\n\n')

    const installDesc = ['Installation includes:', orgTemplates.install || ''].filter(Boolean).join('\n\n')

    const warrantyBody = (orgTemplates.warranty || '')
      .replace(/\{manufacturer_years\}/g, eq.manufacturer_warranty_years != null ? String(eq.manufacturer_warranty_years) : '')
      .replace(/\{contractor_years\}/g, eq.labor_warranty != null ? String(eq.labor_warranty) : '')
    const warrantyDesc = ['WARRANTY', warrantyBody].filter(Boolean).join('\n\n')

    const base = eq.installation_price || 0
    const rows = [
      { description: indoorDesc, unit_price: base, quantity: 1, category: 'INDOOR_UNIT', sort_order: 10, taxable: systemTaxable },
      { description: outdoorDesc, unit_price: 0, quantity: 1, category: 'OUTDOOR_UNIT', sort_order: 20, taxable: false },
      { description: installDesc, unit_price: 0, quantity: 1, category: 'INSTALLATION', sort_order: 30, taxable: false },
      { description: warrantyDesc, unit_price: 0, quantity: 1, category: 'WARRANTY', sort_order: 90, taxable: false },
    ].map((r) => ({ ...r, invoice_id: estimate.id, org_id: job.org_id, is_custom: false }))

    await supabase.from('invoice_line_items').insert(rows)

    if (includeLineset) {
      const linesetText = ['Also includes:', eq.lineset_requirements || ''].filter(Boolean).join('\n\n')
      await supabase.from('invoice_line_items').insert({
        invoice_id: estimate.id, org_id: job.org_id,
        description: linesetText, unit_price: parseFloat(linesetPrice) || 0, quantity: 1,
        taxable: systemTaxable, is_custom: false, category: 'ALSO_INCLUDES', sort_order: 40,
      })
    }

    setAddingSystem(false)
    setPickSystemType('')
    setPickSize('')
    setPickSeer('')
    setPickBrand('')
    setMatchingEquipment([])
    setSelectedEquipmentId('')
    setEquipmentSearch('')
    setIncludeLineset(false)
    setLinesetPrice('')
    loadLineItems(estimate.id)
  }

  async function handleAddFeature() {
    const f = specialFeatures.find((x) => x.id === pickFeatureId)
    if (!f) return
    setAddingFeature(true)
    const desc = [f.name, f.description, f.warranty_text].filter(Boolean).join('\n')
    const existingSF = lineItems.filter((li) => li.category === 'SPECIAL_FEATURE').length
    await supabase.from('invoice_line_items').insert({
      invoice_id: estimate.id, org_id: job.org_id,
      description: desc, unit_price: f.price || 0, quantity: 1,
      taxable: systemTaxable, is_custom: false, category: 'SPECIAL_FEATURE', sort_order: 100 + existingSF,
    })
    setAddingFeature(false)
    setPickFeatureId('')
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

  const isFieldAdmin = !!(profile && (['org_admin', 'super_admin'].includes(profile.role) || profile.is_field_supervisor))

  async function approveCustom(li) {
    if (!(Number(li.unit_price) > 0)) return
    await supabase.from('invoice_line_items').update({
      custom_status: 'approved',
      custom_approved_by: profile?.id || null,
      custom_approved_at: new Date().toISOString(),
    }).eq('id', li.id)
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
    await supabase
      .from('invoices')
      .update({ discount_type: discountType, discount_amount: parseFloat(discountAmount) || 0 })
      .eq('id', estimate.id)
  }

  async function handleSendEmail() {
    setSendingEmail(true)
    setSendError('')
    const { data, error } = await supabase.functions.invoke('send-invoice-email', { body: { invoiceId: estimate.id } })
    setSendingEmail(false)
    if (error) {
      let detail = error.message
      if (error.context) {
        try {
          const body = await error.context.json()
          if (body?.error) detail = body.error
        } catch {}
      }
      setSendError(detail)
    } else if (data?.error) {
      setSendError(data.error)
    } else {
      loadJobAndEstimate()
    }
  }

  const isPendingCustom = (li) => li.is_custom && li.custom_status === 'pending'
  const billable = lineItems.filter((li) => !isPendingCustom(li))
  const subtotal = billable.reduce((sum, li) => sum + li.quantity * li.unit_price, 0)
  const taxableSubtotal = billable.filter((li) => li.taxable).reduce((sum, li) => sum + li.quantity * li.unit_price, 0)
  const salesTax = taxableSubtotal * (taxRate / 100)
  const discountValue =
    discountType === 'percent' ? subtotal * ((parseFloat(discountAmount) || 0) / 100) : parseFloat(discountAmount) || 0
  const totalDue = Math.max(subtotal + salesTax - discountValue, 0)

  useEffect(() => {
    if (!estimate) return
    supabase
      .from('invoices')
      .update({ subtotal, sales_tax: salesTax, job_total: totalDue, amount_due: totalDue, balance: totalDue })
      .eq('id', estimate.id)
      .then(() => {})
  }, [subtotal, salesTax, totalDue, estimate])

  return (
    <div>
      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : !job ? (
        <p style={{ color: 'var(--mist)' }}>Job not found.</p>
      ) : (
        <>
          <Link to="/jobs" className="nav-link">← Back to Jobs</Link>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', margin: '16px 0 24px' }}>
            <div>
              <h2 className="page-title" style={{ marginBottom: 4 }}>{estimate.invoice_number} — Job {job.job_number} (System Estimate)</h2>
              <p style={{ color: 'var(--mist)', margin: 0 }}>{job.properties?.customers?.display_name}</p>
              <p style={{ color: 'var(--mist)', margin: 0 }}>{job.properties?.street_address}</p>
              <p style={{ color: 'var(--mist)', margin: 0 }}>{job.properties?.customers?.primary_phone} · {job.properties?.customers?.email_1}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--mist)', marginBottom: 2 }}>Estimating Technician</label>
                <select
                  value={estimate.estimating_technician_id || ''}
                  onChange={(e) => updateEstimatingTechnician(e.target.value)}
                  style={{ fontSize: 13 }}
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--mist)', marginBottom: 2 }}>Approval Status</label>
                <select
                  value={estimate.approval_status || 'Pending'}
                  onChange={(e) => updateApprovalStatus(e.target.value)}
                  style={{ fontSize: 13 }}
                >
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Pending Financing">Pending Financing</option>
                </select>
              </div>
            </div>
          </div>

          <RoutingSummary customerId={job.customer_id} propertyId={job.property_id} label="Estimate" />

          <div className="grid-table" style={{ gridTemplateColumns: '2fr 0.6fr 0.9fr 0.9fr 0.6fr 0.6fr', marginBottom: 20 }}>
            <div className="grid-cell grid-head">Description</div>
            <div className="grid-cell grid-head">Qty</div>
            <div className="grid-cell grid-head">Unit Price</div>
            <div className="grid-cell grid-head">Extension</div>
            <div className="grid-cell grid-head">Tax</div>
            <div className="grid-cell grid-head"></div>

            {lineItems.map((li) => (
              <>
                <div className="grid-cell" style={{ whiteSpace: 'pre-line' }}>
                  {li.description}
                  {isPendingCustom(li) && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#B8860B', background: 'rgba(184,134,11,0.12)', padding: '2px 7px', borderRadius: 6 }}>PENDING · tech request</span>}
                </div>
                <div className="grid-cell">
                  <input
                    type="number"
                    step="1"
                    value={li.quantity}
                    onChange={(e) => updateLineItem(li.id, 'quantity', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="grid-cell">
                  <input
                    type="number"
                    step="0.01"
                    value={li.unit_price}
                    onChange={(e) => updateLineItem(li.id, 'unit_price', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="grid-cell">${(li.quantity * li.unit_price).toFixed(2)}</div>
                <div className="grid-cell">{li.taxable ? 'Yes' : 'No'}</div>
                <div className="grid-cell grid-actions">
                  {isPendingCustom(li) && isFieldAdmin && (
                    <button className="logout-button" style={{ borderColor: '#1F7A43', color: '#1F7A43' }} disabled={!(Number(li.unit_price) > 0)} title={Number(li.unit_price) > 0 ? 'Approve this custom item' : 'Set a price first'} onClick={() => approveCustom(li)}>Approve</button>
                  )}
                  <button className="logout-button" onClick={() => removeLineItem(li.id)}>Remove</button>
                </div>
              </>
            ))}
            {lineItems.length === 0 && (
              <div className="grid-cell" style={{ gridColumn: '1 / -1', color: 'var(--mist)' }}>No line items yet.</div>
            )}
          </div>

          <div className="auth-card" style={{ maxWidth: 560, marginBottom: 24 }}>
            <h3 style={{ marginTop: 0, fontSize: 15 }}>Add System</h3>
            <div className="field">
              <label>System type</label>
              <select value={pickSystemType} onChange={(e) => { setPickSystemType(e.target.value); setPickSize(''); setPickSeer(''); setPickBrand(''); setSelectedEquipmentId('') }}>
                <option value="">Select…</option>
                {systemTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {pickSystemType && (
              <div className="field">
                <label>Size (Tons)</label>
                <select value={pickSize} onChange={(e) => { setPickSize(e.target.value); setPickSeer(''); setPickBrand(''); setSelectedEquipmentId('') }}>
                  <option value="">Select…</option>
                  {sizeOptions.map((s) => <option key={s} value={s}>{s} Tons</option>)}
                </select>
              </div>
            )}
            {pickSystemType && pickSize && (seerOptions.length > 1 || brandOptions.length > 1) && (
              <div className="field" style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label>SEER2</label>
                  <select value={pickSeer} onChange={(e) => { setPickSeer(e.target.value); setSelectedEquipmentId('') }}>
                    <option value="">All</option>
                    {seerOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label>Brand</label>
                  <select value={pickBrand} onChange={(e) => { setPickBrand(e.target.value); setSelectedEquipmentId('') }}>
                    <option value="">All</option>
                    {brandOptions.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>
            )}
            {pickSystemType && pickSize && (
              <>
                <div className="field">
                  <label>Search (model #, brand)</label>
                  <input type="text" value={equipmentSearch} onChange={(e) => setEquipmentSearch(e.target.value)} placeholder="Narrow the list…" />
                </div>
                <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 12 }}>
                  {filteredEquipment.map((eq) => (
                    <label
                      key={eq.id}
                      style={{
                        display: 'block',
                        padding: '10px 12px',
                        borderBottom: '1px solid var(--border)',
                        cursor: 'pointer',
                        background: selectedEquipmentId === eq.id ? 'var(--ink)' : 'transparent',
                        fontSize: 13,
                      }}
                    >
                      <input
                        type="radio"
                        name="equipmentPick"
                        checked={selectedEquipmentId === eq.id}
                        onChange={() => setSelectedEquipmentId(eq.id)}
                        style={{ marginRight: 8 }}
                      />
                      {eq.outdoor_brand} {eq.outdoor_model} / {eq.indoor_model}
                      {eq.furnace_model ? ' / ' + eq.furnace_model : ''}
                      {' — SEER2 '}{eq.seer2}{eq.energy_star ? ' — ENERGY STAR' : ''}
                      {' — '}<strong>${Number(eq.installation_price).toFixed(2)}</strong>
                    </label>
                  ))}
                  {filteredEquipment.length === 0 && (
                    <p style={{ padding: 12, color: 'var(--mist)', fontSize: 13, margin: 0 }}>No matching systems.</p>
                  )}
                </div>
              </>
            )}
            {selectedEquipment && (
              <p style={{ fontWeight: 600, color: 'var(--route-blue)' }}>${Number(selectedEquipment.installation_price).toFixed(2)}</p>
            )}
            <label style={{ display: 'block', marginBottom: 12, cursor: 'pointer', fontSize: 14 }}>
              <input type="checkbox" checked={systemTaxable} onChange={(e) => setSystemTaxable(e.target.checked)} style={{ marginRight: 6 }} />
              Taxable
            </label>
            {selectedEquipment && (
              <>
                <label style={{ display: 'block', marginBottom: includeLineset ? 6 : 12, cursor: 'pointer', fontSize: 14 }}>
                  <input type="checkbox" checked={includeLineset} onChange={(e) => setIncludeLineset(e.target.checked)} style={{ marginRight: 6 }} />
                  Include lineset (&ldquo;Also includes&rdquo;)
                </label>
                {includeLineset && (
                  <div className="field" style={{ maxWidth: 200, marginBottom: 12 }}>
                    <label>Lineset price</label>
                    <input type="number" step="0.01" value={linesetPrice} onChange={(e) => setLinesetPrice(e.target.value)} placeholder="0.00" />
                  </div>
                )}
              </>
            )}
            <button className="auth-button" onClick={handleAddSystem} disabled={!selectedEquipment || addingSystem} style={{ width: 'auto', padding: '8px 20px' }}>
              {addingSystem ? 'Adding…' : 'Add to estimate'}
            </button>
          </div>

          {specialFeatures.length > 0 && (
            <div className="auth-card" style={{ maxWidth: 500, marginBottom: 24 }}>
              <h3 style={{ marginTop: 0, fontSize: 15 }}>Add Special Feature</h3>
              <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0 }}>Add-ons from your catalog — add as many as apply.</p>
              <div className="field">
                <label>Feature</label>
                <select value={pickFeatureId} onChange={(e) => setPickFeatureId(e.target.value)}>
                  <option value="">Select…</option>
                  {specialFeatures.map((f) => <option key={f.id} value={f.id}>{f.name} — ${Number(f.price || 0).toFixed(2)}</option>)}
                </select>
              </div>
              <button className="auth-button" onClick={handleAddFeature} disabled={!pickFeatureId || addingFeature} style={{ width: 'auto', padding: '8px 20px' }}>
                {addingFeature ? 'Adding…' : 'Add feature'}
              </button>
            </div>
          )}

          <div className="auth-card" style={{ maxWidth: 500, marginBottom: 24 }}>
            <h3 style={{ marginTop: 0, fontSize: 15 }}>Add Misc Item</h3>
            <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0 }}>Permits, extra materials, disposal fees, etc.</p>
            <form onSubmit={handleAddCustom}>
              <div className="field">
                <label>Description</label>
                <input type="text" value={customDesc} onChange={(e) => setCustomDesc(e.target.value)} required />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label>Qty</label>
                  <input type="number" step="1" value={customQty} onChange={(e) => setCustomQty(e.target.value)} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label>Unit price</label>
                  <input type="number" step="0.01" value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} required />
                </div>
              </div>
              <label style={{ display: 'block', marginBottom: 12, cursor: 'pointer', fontSize: 14 }}>
                <input type="checkbox" checked={customTaxable} onChange={(e) => setCustomTaxable(e.target.checked)} style={{ marginRight: 6 }} />
                Taxable
              </label>
              <button className="auth-button" type="submit" disabled={addingCustom} style={{ width: 'auto', padding: '8px 20px' }}>
                {addingCustom ? 'Adding…' : 'Add to estimate'}
              </button>
            </form>
          </div>

          <div className="auth-card" style={{ maxWidth: 400 }}>
            <div className="field">
              <label>Discount</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={discountType} onChange={(e) => setDiscountType(e.target.value)} style={{ flex: 1 }}>
                  <option value="dollar">$</option>
                  <option value="percent">%</option>
                </select>
                <input
                  type="number"
                  step="0.01"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  onBlur={saveDiscount}
                  style={{ flex: 2 }}
                />
              </div>
            </div>
            <p style={{ margin: '8px 0' }}>Subtotal: ${subtotal.toFixed(2)}</p>
            <p style={{ margin: '8px 0' }}>Sales tax: ${salesTax.toFixed(2)}</p>
            <p style={{ margin: '8px 0' }}>Discount: -${discountValue.toFixed(2)}</p>
            <h3 style={{ margin: '12px 0 0' }}>Estimated Total: ${totalDue.toFixed(2)}</h3>
          </div>

          <div className="auth-card" style={{ maxWidth: 500, marginTop: 24 }}>
            <h3 style={{ marginTop: 0, fontSize: 15 }}>Customer link</h3>
            <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0 }}>
              This is what the customer sees, no login required.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                readOnly
                value={window.location.origin + '/view-invoice/' + estimate.id}
                style={{ flex: 1, padding: '8px 10px', background: 'var(--ink)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--paper)' }}
                onFocus={(e) => e.target.select()}
              />
              <button
                type="button"
                className="logout-button"
                onClick={() => navigator.clipboard.writeText(window.location.origin + '/view-invoice/' + estimate.id)}
              >
                Copy
              </button>
              <button
                type="button"
                className="logout-button"
                onClick={() => window.open('/view-invoice/' + estimate.id, '_blank')}
              >
                Open
              </button>
            </div>
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button className="auth-button" style={{ width: 'auto', padding: '8px 20px', background: '#2E7FC4' }} onClick={() => window.open('/view-invoice/' + estimate.id, '_blank')}>
                Review / Preview
              </button>
              <button className="auth-button" style={{ width: 'auto', padding: '8px 20px' }} onClick={handleSendEmail} disabled={sendingEmail}>
                {sendingEmail ? 'Sending…' : estimate.sent_at ? 'Resend to Customer' : 'Send to Customer'}
              </button>
              {estimate.sent_at && (
                <span style={{ fontSize: 13, color: 'var(--mist)' }}>
                  Last sent {new Date(estimate.sent_at).toLocaleString()}
                </span>
              )}
            </div>
            {sendError && <div className="auth-error" style={{ marginTop: 10 }}>{sendError}</div>}
          </div>
        </>
      )}
    </div>
  )
}
