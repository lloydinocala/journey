import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from './utils/supabase'

export default function SystemEstimate({ profile }) {
  const { jobId } = useParams()
  const [job, setJob] = useState(null)
  const [estimate, setEstimate] = useState(null)
  const [lineItems, setLineItems] = useState([])
  const [loading, setLoading] = useState(true)

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

  async function loadJobAndEstimate() {
    setLoading(true)
    const { data: jobData } = await supabase
      .from('jobs')
      .select('id, job_number, job_date, org_id, customer_id, properties(street_address, customers!properties_customer_id_fkey(display_name, primary_phone, email_1))')
      .eq('id', jobId)
      .single()
    setJob(jobData)

    if (!jobData) {
      setLoading(false)
      return
    }

    let { data: existingEstimate } = await supabase
      .from('invoices')
      .select('*')
      .eq('job_id', jobId)
      .eq('kind', 'estimate')
      .maybeSingle()

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
        })
        .select()
        .single()
      existingEstimate = created
    }

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

    const { data: orgData } = await supabase
      .from('organizations')
      .select('sales_tax_rate, services_taxable_by_default')
      .eq('id', jobData.org_id)
      .single()
    if (orgData) {
      setTaxRate(orgData.sales_tax_rate || 0)
      setCustomTaxable(orgData.services_taxable_by_default)
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
  }, [jobId])

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
      setBrandFamilies([])
      return
    }
    supabase
      .from('equipment')
      .select('brand_family')
      .eq('org_id', job.org_id)
      .eq('system_type', pickSystemType)
      .eq('size_tons', pickSize)
      .eq('active', true)
      .then(({ data }) => {
        setBrandFamilies([...new Set((data || []).map((r) => r.brand_family))].filter(Boolean).sort())
      })
  }, [pickSystemType, pickSize, job])

  useEffect(() => {
    if (!pickSystemType || !pickSize || !pickBrandFamily || !job) {
      setMatchingEquipment([])
      return
    }
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

  const subtotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unit_price, 0)
  const taxableSubtotal = lineItems.filter((li) => li.taxable).reduce((sum, li) => sum + li.quantity * li.unit_price, 0)
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
          <div style={{ margin: '16px 0 24px' }}>
            <h2 className="page-title" style={{ marginBottom: 4 }}>{estimate.invoice_number} — Job {job.job_number} (System Estimate)</h2>
            <p style={{ color: 'var(--mist)', margin: 0 }}>{job.properties?.customers?.display_name}</p>
            <p style={{ color: 'var(--mist)', margin: 0 }}>{job.properties?.street_address}</p>
            <p style={{ color: 'var(--mist)', margin: 0 }}>{job.properties?.customers?.primary_phone} · {job.properties?.customers?.email_1}</p>
          </div>

          <div className="grid-table" style={{ gridTemplateColumns: '2fr 0.6fr 0.9fr 0.9fr 0.6fr 0.6fr', marginBottom: 20 }}>
            <div className="grid-cell grid-head">Description</div>
            <div className="grid-cell grid-head">Qty</div>
            <div className="grid-cell grid-head">Unit Price</div>
            <div className="grid-cell grid-head">Extension</div>
            <div className="grid-cell grid-head">Tax</div>
            <div className="grid-cell grid-head"></div>

            {lineItems.map((li) => (
              <>
                <div className="grid-cell">{li.description}</div>
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
              <select value={pickSystemType} onChange={(e) => { setPickSystemType(e.target.value); setPickSize(''); setPickBrandFamily(''); setSelectedEquipmentId('') }}>
                <option value="">Select…</option>
                {systemTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {pickSystemType && (
              <div className="field">
                <label>Size (Tons)</label>
                <select value={pickSize} onChange={(e) => { setPickSize(e.target.value); setPickBrandFamily(''); setSelectedEquipmentId('') }}>
                  <option value="">Select…</option>
                  {sizeOptions.map((s) => <option key={s} value={s}>{s} Tons</option>)}
                </select>
              </div>
            )}
            {pickSystemType && pickSize && (
              <div className="field">
                <label>Brand family</label>
                <select value={pickBrandFamily} onChange={(e) => { setPickBrandFamily(e.target.value); setSelectedEquipmentId('') }}>
                  <option value="">Select…</option>
                  {brandFamilies.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            )}
            {pickBrandFamily && (
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
                      {eq.recommended && <strong style={{ color: 'var(--route-blue)' }}>★ Recommended — </strong>}
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
            <button className="auth-button" onClick={handleAddSystem} disabled={!selectedEquipment || addingSystem} style={{ width: 'auto', padding: '8px 20px' }}>
              {addingSystem ? 'Adding…' : 'Add to estimate'}
            </button>
          </div>

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
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
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
