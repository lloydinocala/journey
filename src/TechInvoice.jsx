import { useEffect, useState } from 'react'
import QuincyDock from './QuincyDock'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import { IconChevronLeft, IconReceipt } from './MobileIcons'
import RoutingSummary from './RoutingSummary'
import ElementsPartsUsedPanel from './modules/elements-hvac/ElementsPartsUsedPanel'

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
  const [customTaxable, setCustomTaxable] = useState(true)
  const [addingCustom, setAddingCustom] = useState(false)

  const [taxRate, setTaxRate] = useState(0)
  const [catalog, setCatalog] = useState([])
  const [standing, setStanding] = useState([])
  const [pickedDiscountId, setPickedDiscountId] = useState('')
  const isFieldAdmin = !!(profile && (['org_admin', 'super_admin'].includes(profile.role) || profile.is_field_supervisor))

  async function loadJobAndInvoice() {
    setLoading(true)
    const { data: jobData } = await supabase
      .from('jobs')
      .select('id, job_number, job_date, diagnosis_note, org_id, customer_id, property_id, trip_charge_price_id, properties(street_address, customers!properties_customer_id_fkey(display_name, primary_phone, email_1)), trip_charge:trip_charge_price_id(location, access, hours, price, cost, task_hours, customer_display, services(id, name, is_tax_exempt))')
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

      // Open the invoice with full transparency. If an approved estimate exists for this job,
      // mirror ITS line items (service call + every approved item) so the invoice matches
      // exactly what the customer approved — the service call carries over once, never doubled.
      // Otherwise fall back to the trip charge alone. Then surface the tech's diagnosis as a
      // note line. Everything is renumbered into one clean sequence.
      const opening = []
      const { data: approvedEst } = await supabase
        .from('invoices')
        .select('id')
        .eq('job_id', jobId)
        .eq('kind', 'estimate')
        .not('approved_at', 'is', null)
        .order('approved_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (approvedEst) {
        const { data: estItems } = await supabase
          .from('invoice_line_items')
          .select('description, unit_price, quantity, taxable, is_custom, category, service_price_id')
          .eq('invoice_id', approvedEst.id)
          .order('sort_order')
        for (const it of estItems || []) opening.push({ ...it })
      } else if (jobData.trip_charge_price_id && jobData.trip_charge) {
        const tc = jobData.trip_charge
        opening.push({
          description: tc.customer_display,
          unit_price: tc.price,
          quantity: 1,
          taxable: !tc.services?.is_tax_exempt,
          is_custom: false,
          category: 'TRIP CHARGES',
          service_price_id: null,
        })
      }
      if (jobData.diagnosis_note && jobData.diagnosis_note.trim() && !opening.some((i) => i.category === 'DIAGNOSIS')) {
        const diag = {
          description: 'Diagnosis: ' + jobData.diagnosis_note.trim(),
          unit_price: 0,
          quantity: 1,
          taxable: false,
          is_custom: false,
          category: 'DIAGNOSIS',
          service_price_id: null,
        }
        const tcIdx = opening.findIndex((i) => i.category === 'TRIP CHARGES')
        if (tcIdx >= 0) opening.splice(tcIdx + 1, 0, diag)
        else opening.unshift(diag)
      }
      if (opening.length) {
        await supabase.from('invoice_line_items').insert(
          opening.map((it, idx) => ({ ...it, invoice_id: created.id, org_id: jobData.org_id, sort_order: idx }))
        )
      }
    }

    setInvoice(existingInvoice)
    setPickedDiscountId(existingInvoice.discount_id || '')

    await loadDiscounts(jobData.org_id, jobData.customer_id)
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
      service_id: pickServiceId,           // Elements-HVAC: enables inventory consumption
      service_price_id: resolvedVariant.id,
    })
    setAddingService(false)
    setPickCategory('')
    setPickServiceId('')
    setMatchingVariants([])
    loadLineItems(invoice.id)
  }

  async function handleAddCustom(e) {
    e.preventDefault()
    if (!customDesc.trim()) return
    if (lineItems.filter((li) => li.is_custom).length >= 2) return
    setAddingCustom(true)
    const nextSort = lineItems.length > 0 ? Math.max(...lineItems.map((li) => li.sort_order)) + 1 : 1
    await supabase.from('invoice_line_items').insert({
      invoice_id: invoice.id,
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

  async function loadDiscounts(orgId, customerId) {
    const { data: cat } = await supabase
      .from('discount_catalog')
      .select('id, label, discount_type, value')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .order('sort_order')
    setCatalog(cat || [])

    if (!customerId) { setStanding([]); return }
    const candidates = []
    const { data: elig } = await supabase
      .from('customer_discounts')
      .select('discount:discount_id(id, label, discount_type, value, is_active)')
      .eq('customer_id', customerId)
    ;(elig || []).forEach((row) => { if (row.discount && row.discount.is_active) candidates.push(row.discount) })
    const { data: agr } = await supabase
      .from('maintenance_agreements')
      .select('tier:tier_id(default_discount:default_discount_id(id, label, discount_type, value, is_active))')
      .eq('customer_id', customerId)
      .eq('status', 'active')
    ;(agr || []).forEach((row) => {
      const d = row.tier && row.tier.default_discount
      if (d && d.is_active) candidates.push(d)
    })
    setStanding(candidates)
  }

  const isPendingCustom = (li) => li.is_custom && li.custom_status === 'pending'
  const customCount = lineItems.filter((li) => li.is_custom).length
  const canAddCustom = customCount < 2
  const billable = lineItems.filter((li) => !isPendingCustom(li))
  const subtotal = billable.reduce((sum, li) => sum + li.quantity * li.unit_price, 0)
  const taxableSubtotal = billable.filter((li) => li.taxable).reduce((sum, li) => sum + li.quantity * li.unit_price, 0)
  const salesTax = taxableSubtotal * (taxRate / 100)
  const discountCandidates = (() => {
    const list = [...standing]
    if (pickedDiscountId) {
      const picked = catalog.find((c) => c.id === pickedDiscountId)
      if (picked) list.push(picked)
    }
    const byId = {}
    list.forEach((c) => { byId[c.id] = c })
    return Object.values(byId)
      .map((c) => ({ ...c, dollars: c.discount_type === 'percent' ? subtotal * (Number(c.value) / 100) : Number(c.value) }))
      .filter((c) => c.dollars > 0)
  })()
  const winningDiscount = discountCandidates.sort((a, b) => b.dollars - a.dollars)[0] || null
  const discountValue = winningDiscount ? winningDiscount.dollars : 0
  const isManualWinner = !!(winningDiscount && pickedDiscountId === winningDiscount.id && !standing.some((s) => s.id === winningDiscount.id))
  const totalDue = Math.max(subtotal + salesTax - discountValue, 0)

  useEffect(() => {
    if (!invoice) return
    supabase.from('invoices').update({
      subtotal, sales_tax: salesTax, job_total: totalDue, amount_due: totalDue, balance: totalDue,
      discount_id: winningDiscount ? winningDiscount.id : null,
      discount_type: winningDiscount ? (winningDiscount.discount_type === 'percent' ? 'percent' : 'dollar') : 'dollar',
      discount_amount: winningDiscount ? (winningDiscount.discount_type === 'percent' ? Number(winningDiscount.value) : winningDiscount.dollars) : 0,
      discount_approved_by: isManualWinner ? (profile?.id || null) : null,
      discount_approved_at: isManualWinner ? new Date().toISOString() : null,
    }).eq('id', invoice.id).then(() => {})
  }, [subtotal, salesTax, totalDue, invoice, winningDiscount?.id, isManualWinner])

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
        <RoutingSummary customerId={job.customer_id} propertyId={job.property_id} label="Invoice" />
        {invoice?.pre_approved_by && (
          <div className="section-card" style={{ borderLeft: '3px solid #1F7A43' }}>
            <div className="section-card-body"><p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1F7A43' }}>Repair Pre-Approved by: {invoice.pre_approved_by}</p></div>
          </div>
        )}
        {job?.diagnosis_note && (
          <div className="section-card">
            <div className="section-card-header"><span>Diagnosis</span></div>
            <div className="section-card-body"><p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.5 }}>{job.diagnosis_note}</p></div>
          </div>
        )}
        <div className="section-card">
          <div className="section-card-header"><span><IconReceipt /> Line Items</span></div>
          <div className="section-card-body">
            {lineItems.length === 0 && <p style={{ color: 'var(--mist)', fontSize: 13, margin: 0 }}>No line items yet — add one below.</p>}
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
                  <span>{isPendingCustom(li) ? 'Awaiting office pricing — not on customer invoice yet' : (li.taxable ? 'Taxable' : 'Non-taxable')}</span>
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
          <div className="section-card-header"><span>Add Custom Item <span style={{ color: 'var(--mist)', fontWeight: 400, fontSize: 12 }}>({customCount}/2)</span></span></div>
          <div className="section-card-body">
            <p style={{ color: 'var(--mist)', fontSize: 12, marginTop: 0 }}>
              For something the price book doesn't cover. Your office prices and approves it before it shows on the customer's invoice — you don't set the price here. Up to 2 per invoice.
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
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, color: 'var(--mist)', display: 'block', marginBottom: 4 }}>Discount</label>
              {winningDiscount ? (
                <div style={{ fontSize: 14 }}>
                  {winningDiscount.label} {'\u2014'} {winningDiscount.discount_type === 'percent' ? `${Number(winningDiscount.value)}%` : `$${Number(winningDiscount.value).toFixed(2)}`} (-${discountValue.toFixed(2)})
                </div>
              ) : (
                <div style={{ fontSize: 14, color: 'var(--mist)' }}>None</div>
              )}
              {isFieldAdmin ? (
                <select value={pickedDiscountId} onChange={(e) => setPickedDiscountId(e.target.value)} style={{ marginTop: 6, width: '100%' }}>
                  <option value="">Auto (standing discounts only)</option>
                  {catalog.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label} ({c.discount_type === 'percent' ? `${Number(c.value)}%` : `$${Number(c.value).toFixed(2)}`}){c.discount_type === 'flat' ? ' \u2014 flat, your approval' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <div style={{ fontSize: 11, color: 'var(--mist)', marginTop: 4 }}>
                  Applied automatically from the customer&rsquo;s plan and eligibility.
                </div>
              )}
              {isManualWinner && (
                <div style={{ fontSize: 11, color: 'var(--mist)', marginTop: 4 }}>Approved by you {'\u00b7'} not shown to the customer</div>
              )}
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
          <div className="section-card-header"><span>Parts Used</span></div>
          <div className="section-card-body">
            <ElementsPartsUsedPanel orgId={job.org_id} invoiceId={invoice.id} embedded />
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
    <QuincyDock profile={profile} />
    </div>
  )
}
