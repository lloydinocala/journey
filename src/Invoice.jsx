import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from './utils/supabase'

export default function Invoice({ profile }) {
  const { jobId } = useParams()
  const [job, setJob] = useState(null)
  const [invoice, setInvoice] = useState(null)
  const [lineItems, setLineItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [categories, setCategories] = useState([])
  const [pickCategory, setPickCategory] = useState('')
  const [servicesInCategory, setServicesInCategory] = useState([])
  const [pickServiceId, setPickServiceId] = useState('')
  const [matchingVariants, setMatchingVariants] = useState([])
  const [pickPartSource, setPickPartSource] = useState('')
  const [addingService, setAddingService] = useState(false)

  const [customDesc, setCustomDesc] = useState('')
  const [customQty, setCustomQty] = useState('1')
  const [customPrice, setCustomPrice] = useState('')
  const [customTaxable, setCustomTaxable] = useState(true)
  const [addingCustom, setAddingCustom] = useState(false)

  const [discountType, setDiscountType] = useState('dollar')
  const [discountAmount, setDiscountAmount] = useState('0')

  async function loadJobAndInvoice() {
    setLoading(true)
    const { data: jobData } = await supabase
      .from('jobs')
   .select('id, job_number, job_date, org_id, customer_id, trip_charge_price_id, properties(street_address, customers!properties_customer_id_fkey(display_name, primary_phone, email_1)), trip_charge:trip_charge_price_id(location, access, hours, price, cost, task_hours, customer_display, services(id, name, is_tax_exempt))')
      .eq('id', jobId)
      .single()
    setJob(jobData)

    if (!jobData) {
      setLoading(false)
      return
    }

    let { data: existingInvoice } = await supabase
      .from('invoices')
      .select('*')
      .eq('job_id', jobId)
      .maybeSingle()

    if (!existingInvoice) {
      const { count } = await supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', jobData.org_id)
      const invoiceNumber = `INV-${String((count || 0) + 1).padStart(4, '0')}`

      const { data: created } = await supabase
        .from('invoices')
        .insert({
          org_id: jobData.org_id,
          invoice_number: invoiceNumber,
          job_id: jobId,
          invoice_date: new Date().toISOString().slice(0, 10),
          bills_to_customer_id: jobData.customer_id,
          discount_type: 'dollar',
        })
        .select()
        .single()
      existingInvoice = created

      if (jobData.trip_charge_price_id && jobData.trip_charge) {
        const tc = jobData.trip_charge
        await supabase.from('invoice_line_items').insert({
          invoice_id: created.id,
          description: tc.customer_display,
          unit_price: tc.price,
          quantity: 1,
          taxable: !tc.services?.is_tax_exempt,
          is_custom: false,
          sort_order: 1,
        })
      }
    }

    setInvoice(existingInvoice)
    setDiscountType(existingInvoice.discount_type || 'dollar')
    setDiscountAmount(String(existingInvoice.discount_amount || 0))

    await loadLineItems(existingInvoice.id)

    const { data: cats } = await supabase
      .from('services')
      .select('category')
      .eq('org_id', jobData.org_id)
      .eq('is_active', true)
      .neq('category', 'TRIP CHARGES')
    setCategories([...new Set((cats || []).map((c) => c.category))].sort())

    setLoading(false)
  }

  async function loadLineItems(invoiceId) {
    const { data } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('sort_order')
    setLineItems(data || [])
  }

  useEffect(() => {
    loadJobAndInvoice()
  }, [jobId])
useEffect(() => {
    if (!pickCategory || !job) {
      setServicesInCategory([])
      return
    }
    supabase
      .from('services')
      .select('id, name, is_tax_exempt')
      .eq('org_id', job.org_id)
      .eq('category', pickCategory)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setServicesInCategory(data || []))
  }, [pickCategory, job])

  useEffect(() => {
    if (!pickServiceId || !job?.trip_charge) {
      setMatchingVariants([])
      return
    }
    supabase
      .from('service_prices')
      .select('id, part_source, customer_display, price')
      .eq('service_id', pickServiceId)
      .eq('location', job.trip_charge.location)
      .eq('access', job.trip_charge.access)
      .eq('hours', job.trip_charge.hours)
      .eq('is_active', true)
      .then(({ data }) => {
        setMatchingVariants(data || [])
        setPickPartSource('')
      })
  }, [pickServiceId, job])

  const resolvedVariant =
    matchingVariants.length === 1
      ? matchingVariants[0]
      : matchingVariants.find((v) => (v.part_source || '') === pickPartSource) || null

  async function handleAddService() {
    if (!resolvedVariant) return
    setAddingService(true)
    const svc = servicesInCategory.find((s) => s.id === pickServiceId)
    const nextSort = lineItems.length > 0 ? Math.max(...lineItems.map((li) => li.sort_order)) + 1 : 1
    await supabase.from('invoice_line_items').insert({
      invoice_id: invoice.id,
      description: resolvedVariant.customer_display,
      unit_price: resolvedVariant.price,
      quantity: 1,
      taxable: !svc?.is_tax_exempt,
      is_custom: false,
      sort_order: nextSort,
    })
    setAddingService(false)
    setPickCategory('')
    setPickServiceId('')
    setMatchingVariants([])
    loadLineItems(invoice.id)
  }

  async function handleAddCustom(e) {
    e.preventDefault()
    if (!customDesc.trim() || !customPrice) return
    setAddingCustom(true)
    const nextSort = lineItems.length > 0 ? Math.max(...lineItems.map((li) => li.sort_order)) + 1 : 1
    await supabase.from('invoice_line_items').insert({
      invoice_id: invoice.id,
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
    loadLineItems(invoice.id)
  }

  async function removeLineItem(id) {
    await supabase.from('invoice_line_items').delete().eq('id', id)
    loadLineItems(invoice.id)
  }

  async function updateLineItem(id, field, value) {
    await supabase.from('invoice_line_items').update({ [field]: value }).eq('id', id)
    loadLineItems(invoice.id)
  }

  const subtotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unit_price, 0)
  const discountValue =
    discountType === 'percent' ? subtotal * ((parseFloat(discountAmount) || 0) / 100) : parseFloat(discountAmount) || 0
  const totalDue = Math.max(subtotal -
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
              <h2 className="page-title" style={{ marginBottom: 4 }}>{invoice.invoice_number} — Job {job.job_number}</h2>
              <p style={{ color: 'var(--mist)', margin: 0 }}>{job.properties?.customers?.display_name}</p>
              <p style={{ color: 'var(--mist)', margin: 0 }}>{job.properties?.street_address}</p>
              <p style={{ color: 'var(--mist)', margin: 0 }}>{job.properties?.customers?.primary_phone} · {job.properties?.customers?.email_1}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              {job.trip_charge ? (
                <p style={{ fontSize: 13, color: 'var(--mist)' }}>
                  Trip charge: {job.trip_charge.services?.name}<br />
                  {job.trip_charge.location} / {job.trip_charge.access} / {job.trip_charge.hours}
                </p>
              ) : (
                <p style={{ fontSize: 13, color: '#C0392B' }}>No trip charge set on this job — set it on the Jobs page to enable pricebook lookups.</p>
              )}
            </div>
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

          <div className="auth-card" style={{ maxWidth: 500, marginBottom: 24 }}>
            <h3 style={{ marginTop: 0, fontSize: 15 }}>Add Service</h3>
            <div className="field">
              <label>Category</label>
              <select value={pickCategory} onChange={(e) => { setPickCategory(e.target.value); setPickServiceId('') }}>
                <option value="">Select…</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {pickCategory && (
              <div className="field">
                <label>Service</label>
                <select value={pickServiceId} onChange={(e) => setPickServiceId(e.target.value)}>
                  <option value="">Select…</option>
                  {servicesInCategory.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            {pickServiceId && matchingVariants.length > 1 && (
              <div className="field">
                <label>Part source</label>
                <select value={pickPartSource} onChange={(e) => setPickPartSource(e.target.value)}>
                  <option value="">Select…</option>
                  {matchingVariants.map((v) => (
                    <option key={v.id} value={v.part_source || ''}>{v.part_source || 'N/A'}</option>
                  ))}
                </select>
              </div>
            )}
            {pickServiceId && matchingVariants.length === 0 && job.trip_charge && (
              <p style={{ color: '#C0392B', fontSize: 13 }}>No price found for this service at the job's Location/Access/Hours.</p>
            )}
            {resolvedVariant && (
              <p style={{ fontWeight: 600, color: 'var(--route-blue)' }}>${resolvedVariant.price.toFixed(2)}</p>
            )}
            <button className="auth-button" onClick={handleAddService} disabled={!resolvedVariant || addingService} style={{ width: 'auto', padding: '8px 20px' }}>
              {addingService ? 'Adding…' : 'Add to invoice'}
            </button>
          </div>

          <div className="auth-card" style={{ maxWidth: 500, marginBottom: 24 }}>
            <h3 style={{ marginTop: 0, fontSize: 15 }}>Add Custom Service</h3>
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
                {addingCustom ? 'Adding…' : 'Add to invoice'}
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
            <p style={{ margin: '8px 0' }}>Discount: -${discountValue.toFixed(2)}</p>
            <h3 style={{ margin: '12px 0 0' }}>Total Due: ${totalDue.toFixed(2)}</h3>
          </div>
        </>
      )}
    </div>
  )
}
