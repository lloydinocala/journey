import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import { IconChevronLeft, IconCalculator } from './MobileIcons'

export default function TechSystemEstimate({ profile }) {
  const { jobId } = useParams()
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
  const [brandFamilies, setBrandFamilies] = useState([])
  const [pickBrandFamily, setPickBrandFamily] = useState('')
  const [matchingEquipment, setMatchingEquipment] = useState([])
  const [equipmentSearch, setEquipmentSearch] = useState('')
  const [selectedEquipmentId, setSelectedEquipmentId] = useState('')
  const [addingSystem, setAddingSystem] = useState(false)
  const [systemTaxable, setSystemTaxable] = useState(false)

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
  const [copyLabel, setCopyLabel] = useState('Copy Link')

  async function loadJobAndEstimate() {
    setLoading(true)
    const { data: jobData } = await supabase
      .from('jobs')
      .select('id, job_number, job_date, org_id, customer_id, properties(street_address, customers!properties_customer_id_fkey(display_name, primary_phone, email_1))')
      .eq('id', jobId)
      .single()
    setJob(jobData)
    if (!jobData) { setLoading(false); return }

    const { data: usersData } = await supabase.from('users').select('id, full_name').eq('org_id', jobData.org_id).order('full_name')
    setUsers(usersData || [])

    let { data: existingEstimate } = await supabase
      .from('invoices')
      .select('*')
      .eq('job_id', jobId)
      .eq('kind', 'estimate')
      .maybeSingle()

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
        })
        .select()
        .single()
      existingEstimate = created
    }

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

  async function loadLineItems(estimateId) {
    const { data } = await supabase.from('invoice_line_items').select('*').eq('invoice_id', estimateId).order('sort_order')
    setLineItems(data || [])
  }

  useEffect(() => { loadJobAndEstimate() }, [jobId])

  useEffect(() => {
    if (!pickSystemType || !job) { setSizeOptions([]); return }
    supabase.from('equipment').select('size_tons').eq('org_id', job.org_id).eq('system_type', pickSystemType).eq('active', true)
      .then(({ data }) => {
        const sizes = [...new Set((data || []).map((r) => r.size_tons))].filter((s) => s != null).sort((a, b) => a - b)
        setSizeOptions(sizes)
      })
  }, [pickSystemType, job])

  useEffect(() => {
    if (!pickSystemType || !pickSize || !job) { setBrandFamilies([]); return }
    supabase.from('equipment').select('brand_family').eq('org_id', job.org_id).eq('system_type', pickSystemType).eq('size_tons', pickSize).eq('active', true)
      .then(({ data }) => setBrandFamilies([...new Set((data || []).map((r) => r.brand_family))].filter(Boolean).sort()))
  }, [pickSystemType, pickSize, job])

  useEffect(() => {
    if (!pickSystemType || !pickSize || !pickBrandFamily || !job) { setMatchingEquipment([]); return }
    supabase
      .from('equipment')
      .select('id, ahri_ref, recommended, outdoor_brand, outdoor_series, outdoor_model, indoor_brand, indoor_model, furnace_model, size_tons, seer2, eer2, energy_star, installation_price')
      .eq('org_id', job.org_id)
      .eq('system_type', pickSystemType)
      .eq('size_tons', pickSize)
      .eq('brand_family', pickBrandFamily)
      .eq('active', true)
      .order('recommended', { ascending: false })
      .order('outdoor_brand')
      .then(({ data }) => setMatchingEquipment(data || []))
  }, [pickSystemType, pickSize, pickBrandFamily, job])

  const filteredEquipment = matchingEquipment.filter((eq) => {
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
    setPickBrandFamily('')
    setMatchingEquipment([])
    setSelectedEquipmentId('')
    setEquipmentSearch('')
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

  async function handleSendEmail() {
    setSendingEmail(true)
    setSendError('')
    const { data, error } = await supabase.functions.invoke('send-invoice-email', { body: { invoiceId: estimate.id } })
    setSendingEmail(false)
    if (error) {
      let detail = error.message
      if (error.context) {
        try { const body = await error.context.json(); if (body?.error) detail = body.error } catch {}
      }
      setSendError(detail)
    } else if (data?.error) {
      setSendError(data.error)
    } else {
      loadJobAndEstimate()
    }
  }

  function payLinkUrl() {
    return estimate ? `${window.location.origin}/view-invoice/${estimate.id}` : ''
  }

  function copyPayLink() {
    navigator.clipboard.writeText(payLinkUrl())
    setCopyLabel('Copied!')
    setTimeout(() => setCopyLabel('Copy Link'), 1500)
  }

  const subtotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unit_price, 0)
  const taxableSubtotal = lineItems.filter((li) => li.taxable).reduce((sum, li) => sum + li.quantity * li.unit_price, 0)
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
          <div className="section-card-header"><span>Add System</span></div>
          <div className="section-card-body">
            <div className="mobile-field">
              <label>System Type</label>
              <select value={pickSystemType} onChange={(e) => { setPickSystemType(e.target.value); setPickSize(''); setPickBrandFamily(''); setSelectedEquipmentId('') }}>
                <option value="">Select…</option>
                {systemTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {pickSystemType && (
              <div className="mobile-field">
                <label>Size (Tons)</label>
                <select value={pickSize} onChange={(e) => { setPickSize(e.target.value); setPickBrandFamily(''); setSelectedEquipmentId('') }}>
                  <option value="">Select…</option>
                  {sizeOptions.map((s) => <option key={s} value={s}>{s} Ton</option>)}
                </select>
              </div>
            )}
            {pickSize && (
              <div className="mobile-field">
                <label>Brand Family</label>
                <select value={pickBrandFamily} onChange={(e) => { setPickBrandFamily(e.target.value); setSelectedEquipmentId('') }}>
                  <option value="">Select…</option>
                  {brandFamilies.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            )}
            {pickBrandFamily && matchingEquipment.length > 0 && (
              <div className="mobile-field">
                <label>Search Models</label>
                <input type="text" value={equipmentSearch} onChange={(e) => setEquipmentSearch(e.target.value)} placeholder="Filter by brand or model…" />
              </div>
            )}
            {pickBrandFamily && filteredEquipment.map((eq) => (
              <div
                key={eq.id}
                className={'equipment-option-card' + (selectedEquipmentId === eq.id ? ' selected' : '')}
                onClick={() => setSelectedEquipmentId(eq.id)}
              >
                <div className="eq-title">
                  {eq.outdoor_brand} {eq.outdoor_model}
                  {eq.recommended && <span className="recommended-badge">Recommended</span>}
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
            {pickBrandFamily && matchingEquipment.length === 0 && (
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
          <div className="section-card-header"><span>Send to Customer</span></div>
          <div className="section-card-body">
            <p style={{ color: 'var(--mist)', fontSize: 12, marginTop: 0 }}>No login required for the customer.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="action-btn" style={{ flex: '1 1 auto' }} onClick={handleSendEmail} disabled={sendingEmail}>
                {sendingEmail ? 'Sending…' : estimate.sent_at ? 'Resend' : 'Send to Customer'}
              </button>
              <button className="action-btn" style={{ flex: '1 1 auto', background: '#2E7FC4' }} onClick={() => window.open(payLinkUrl(), '_blank')}>
                Open Link
              </button>
              <button className="action-btn" style={{ flex: '1 1 auto', background: '#F0F1F3', color: 'var(--paper)' }} onClick={copyPayLink}>
                {copyLabel}
              </button>
            </div>
            {estimate.sent_at && <p style={{ fontSize: 11.5, color: 'var(--mist)', marginTop: 8 }}>Last sent {new Date(estimate.sent_at).toLocaleString()}</p>}
            {sendError && <p style={{ color: '#C0392B', fontSize: 12.5, marginTop: 8 }}>{sendError}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
