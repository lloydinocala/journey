import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import { IconChevronLeft, IconReceipt } from './MobileIcons'

export default function TechInvoice({ profile }) {
  const { jobId } = useParams()
  const navigate = useNavigate()

  const [job, setJob] = useState(null)
  const [invoice, setInvoice] = useState(null)
  const [lineItems, setLineItems] = useState([])
  const [loading, setLoading] = useState(true)

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
  const [taxRate, setTaxRate] = useState(0)

  async function loadJobAndInvoice() {
    setLoading(true)
    const { data: jobData } = await supabase
      .from('jobs')
      .select('id, job_number, job_date, org_id, customer_id, trip_charge_price_id, properties(street_address, customers!properties_customer_id_fkey(display_name, primary_phone, email_1)), trip_charge:trip_charge_price_id(location, access, hours, price, cost, task_hours, customer_display, services(id, name, is_tax_exempt))')
      .eq('id', jobId)
      .single()
    setJob(jobData)
    if (!jobData) { setLoading(false); return }

    let { data: existingInvoice } = await supabase
      .from('invoices')
      .select('*')
      .eq('job_id', jobId)
      .eq('kind', 'invoice')
      .maybeSingle()

    if (!existingInvoice) {
      const { count } = await supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', jobData.org_id)
        .eq('kind', 'invoice')
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
          kind: 'invoice',
        })
        .select()
        .single()
      existingInvoice = created

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

  async function loadLineItems(invoiceId) {
    const { data } = await supabase.from('invoice_line_items').select('*').eq('invoice_id', invoiceId).order('sort_order')
    setLineItems(data || [])
  }

  useEffect(() => { loadJobAndInvoice() }, [jobId])

  useEffect(() => {
    if (!pickCategory || !job) { setServicesInCategory([]); return }
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

  async function handleAddService() {
    if (!resolvedVariant) return
    setAddingService(true)
    const svc = servicesInCategory.find((s) => s.id === pickServiceId)
    const nextSort = lineItems.length > 0 ? Math.max(...lineItems.map((li) => li.sort_order)) + 1 : 1
    await supabase.from('invoice_line_items').insert({
      invoice_id: invoice.id,
      org_id: job.org_id,
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

  async function saveDiscount() {
    await supabase.from('invoices').update({ discount_type: discountType, discount_amount: parseFloat(discountAmount) || 0 }).eq('id', invoice.id)
  }

  const subtotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unit_price, 0)
  const taxableSubtotal = lineItems.filter((li) => li.taxable).reduce((sum, li) => sum + li.quantity * li.unit_price, 0)
  const salesTax = taxableSubtotal * (taxRate / 100)
  const discountValue = discountType === 'percent' ? subtotal * ((parseFloat(discountAmount) || 0) / 100) : parseFloat(discountAmount) || 0
  const totalDue = Math.max(subtotal + salesTax - discountValue, 0)

  useEffect(() => {
    if (!invoice) return
    supabase.from('invoices').update({ subtotal, sales_tax: salesTax, job_total: totalDue, amount_due: totalDue, balance: totalDue }).eq('id', invoice.id).then(() => {})
  }, [subtotal, salesTax, totalDue, invoice])

  if (loading || !job || !invoice) {
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
          <div className="job-detail-title">{invoice.invoice_number} — Job {job.job_number}</div>
          <div className="job-detail-sub">{job.properties?.customers?.display_name}</div>
        </div>
        <span className={`status-pill ${invoice.paid_at ? 'status-active' : 'status-trial'}`}>{invoice.paid_at ? 'Paid' : 'Unpaid'}</span>
      </div>

      <div className="mobile-body">
        <div className="section-card">
          <div className="section-card-header"><span><IconReceipt /> Line Items</span></div>
          <div className="section-card-body">
            {lineItems.length === 0 && <p style={{ color: 'var(--mist)', fontSize: 13, margin: 0 }}>No line items yet — add one below.</p>}
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
              {addingService ? 'Adding…' : 'Add to Invoice'}
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
                {addingCustom ? 'Adding…' : 'Add to Invoice'}
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
              <div className="totals-row total"><span>Total Due</span><span>${totalDue.toFixed(2)}</span></div>
            </div>
            {invoice.paid_at && (
              <p style={{ color: '#1F7A43', fontWeight: 700, fontSize: 13, marginTop: 10 }}>
                ✓ Paid ${invoice.total_paid?.toFixed(2)} on {new Date(invoice.paid_at).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>

        <div className="section-card">
          <div className="section-card-header"><span>Review &amp; Send</span></div>
          <div className="section-card-body">
            <p style={{ color: 'var(--mist)', fontSize: 12, marginTop: 0 }}>
              Review the invoice exactly as the customer will see it, then send it or record a payment.
            </p>
            <button
              className="action-btn primary"
              style={{ width: '100%', padding: '13px 0', fontSize: 14 }}
              onClick={() => navigate(`/tech/invoice-view/${invoice.id}`)}
            >
              View &amp; Send Invoice
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
