import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import { can } from './utils/permissions'
import SignaturePad from './SignaturePad'
import RoutingSummary from './RoutingSummary'

const NOT_PRESENT_REASONS = [
  'Phone verbal authorization',
  'Verbal authorization — in person',
  'Text or email authorization',
  'Landlord / property owner authorized remotely',
  'Property manager authorized remotely',
  'Unoccupied property — owner authorized by phone',
  'Unable to sign (physical limitation)',
  'Approved by spouse or household member',
  'Other',
]

function ApprovalSignatureImage({ path }) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    if (!path) return
    supabase.storage.from('signatures').createSignedUrl(path, 3600).then(({ data }) => {
      if (data) setUrl(data.signedUrl)
    })
  }, [path])

  if (!url) return null
  return (
    <img
      src={url}
      alt="Signature"
      style={{ maxWidth: 200, border: '1px solid var(--border)', borderRadius: 6, marginTop: 6, background: 'white' }}
    />
  )
}

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

  const [taxRate, setTaxRate] = useState(0)
  const [catalog, setCatalog] = useState([])
  const [standing, setStanding] = useState([])
  const [pickedDiscountId, setPickedDiscountId] = useState('')
  const [custOpen, setCustOpen] = useState(false)
  const [custAmt, setCustAmt] = useState('')
  const [custType, setCustType] = useState('dollar')
  const [custReason, setCustReason] = useState('')
  const [discountApproverName, setDiscountApproverName] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)
  const [sendError, setSendError] = useState('')

  const [approvals, setApprovals] = useState([])
  const [approvingStage, setApprovingStage] = useState(null)
  const [approverName, setApproverName] = useState('')
  const [signatureDataUrl, setSignatureDataUrl] = useState(null)
  const [useTypedFallback, setUseTypedFallback] = useState(false)
  const [notPresentReason, setNotPresentReason] = useState('')

  async function loadJobAndInvoice() {
    setLoading(true)
    const { data: jobData } = await supabase
      .from('jobs')
      .select('id, job_number, job_date, diagnosis_note, org_id, customer_id, property_id, trip_charge_price_id, auth_diagnose_only, auth_limit_amount, properties(street_address, customers!properties_customer_id_fkey(display_name, primary_phone, email_1)), trip_charge:trip_charge_price_id(location, access, hours, price, cost, task_hours, customer_display, services(id, name, is_tax_exempt))')
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
    await loadApprovals(jobId)

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
    const { data } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('sort_order')
    setLineItems(data || [])
  }

  async function loadApprovals(jId) {
    const { data } = await supabase.from('job_approvals').select('*').eq('job_id', jId).order('created_at')
    setApprovals(data || [])
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

  const isFieldAdmin = !!(profile && (['org_admin', 'super_admin'].includes(profile.role) || profile.is_field_supervisor))
  const canApproveDiscount = profile?.role === 'super_admin' || can(profile, 'approve_nonstandard_discounts')

  async function reloadInvoice() {
    if (!invoice) return
    const { data } = await supabase.from('invoices').select('*').eq('id', invoice.id).single()
    if (data) setInvoice(data)
  }
  async function requestCustomDiscount() {
    const amt = parseFloat(custAmt)
    if (!(amt > 0)) return
    await supabase.from('invoices').update({
      discount_id: null, discount_type: 'dollar', discount_amount: amt,
      discount_label: custReason.trim() || 'Custom discount', discount_status: 'pending',
      discount_approved_by: null, discount_approved_at: null,
    }).eq('id', invoice.id)
    setCustOpen(false); setCustAmt(''); setCustReason(''); setPickedDiscountId('')
    reloadInvoice()
  }
  async function approveCustomDiscount() {
    await supabase.from('invoices').update({
      discount_status: 'approved', discount_approved_by: profile?.id || null, discount_approved_at: new Date().toISOString(),
    }).eq('id', invoice.id)
    reloadInvoice()
  }
  async function removeCustomDiscount() {
    await supabase.from('invoices').update({
      discount_id: null, discount_amount: 0, discount_type: 'dollar', discount_label: null,
      discount_status: null, discount_approved_by: null, discount_approved_at: null,
    }).eq('id', invoice.id)
    setCustOpen(false)
    reloadInvoice()
  }

  async function approveCustom(li) {
    if (!(Number(li.unit_price) > 0)) return
    await supabase.from('invoice_line_items').update({
      custom_status: 'approved',
      custom_approved_by: profile?.id || null,
      custom_approved_at: new Date().toISOString(),
    }).eq('id', li.id)
    loadLineItems(invoice.id)
  }

  const STAGE_LABELS = {
    work_approved_to_begin: 'Work Approved to Begin',
    work_finished: 'Work Finished',
    payment: 'Payment',
  }
  const STAGE_ORDER = ['work_approved_to_begin', 'work_finished', 'payment']

  function dataUrlToBlob(dataUrl) {
    const [meta, base64] = dataUrl.split(',')
    const mime = meta.match(/:(.*?);/)[1]
    const binary = atob(base64)
    const array = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i)
    return new Blob([array], { type: mime })
  }

  async function submitApproval(stage) {
    if (useTypedFallback) {
      if (!notPresentReason) {
        setError('Pick a reason the customer/authorizer could not sign.')
        return
      }
    } else {
      if (!approverName.trim()) return
      if (!signatureDataUrl) {
        setError('Please capture a signature, or check "Not present" to record a reason instead.')
        return
      }
    }
    setError('')

    let signaturePath = null
    if (!useTypedFallback && signatureDataUrl) {
      const blob = dataUrlToBlob(signatureDataUrl)
      const path = `${job.org_id}/${jobId}/${stage}-${Date.now()}.png`
      const { error: uploadErr } = await supabase.storage.from('signatures').upload(path, blob, { contentType: 'image/png' })
      if (uploadErr) {
        setError(uploadErr.message)
        return
      }
      signaturePath = path
    }

    await supabase.from('job_approvals').insert({
      job_id: jobId,
      org_id: job.org_id,
      stage,
      approved_by: useTypedFallback ? `Not present — ${notPresentReason}` : approverName.trim(),
      approved_at: new Date().toISOString(),
      amount: totalDue,
      signature_url: signaturePath,
    })
    setApprovingStage(null)
    setApproverName('')
    setSignatureDataUrl(null)
    setUseTypedFallback(false)
    setNotPresentReason('')
    loadApprovals(jobId)
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

 async function handleSendEmail() {
    setSendingEmail(true)
    setSendError('')
    const { data, error } = await supabase.functions.invoke('send-invoice-email', { body: { invoiceId: invoice.id } })
    setSendingEmail(false)
    if (error) {
      let detail = error.message
      if (error.context) {
        try {
          const body = await error.context.json()
          if (body?.error) detail = body.error
        } catch {
          // couldn't parse body, fall back to generic message
        }
      }
      setSendError(detail)
    } else if (data?.error) {
      setSendError(data.error)
    } else {
      loadJobAndInvoice()
    }
  }

  const isPendingCustom = (li) => li.is_custom && li.custom_status === 'pending'
  const billable = lineItems.filter((li) => !isPendingCustom(li))
  const subtotal = billable.reduce((sum, li) => sum + li.quantity * li.unit_price, 0)
  const taxableSubtotal = billable.filter((li) => li.taxable).reduce((sum, li) => sum + li.quantity * li.unit_price, 0)
  const salesTax = taxableSubtotal * (taxRate / 100)

  const hasCustomDiscount = !!(invoice && !invoice.discount_id && invoice.discount_status && Number(invoice.discount_amount) > 0)
  const customDollars = hasCustomDiscount ? (invoice.discount_type === 'percent' ? subtotal * (Number(invoice.discount_amount) / 100) : Number(invoice.discount_amount)) : 0
  const customApproved = hasCustomDiscount && invoice.discount_status === 'approved'

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
  const winningDiscount = hasCustomDiscount ? null : (discountCandidates.sort((a, b) => b.dollars - a.dollars)[0] || null)
  const isManualWinner = !!(winningDiscount && pickedDiscountId === winningDiscount.id && !standing.some((s) => s.id === winningDiscount.id))
  const discountValue = hasCustomDiscount ? (customApproved ? customDollars : 0) : (winningDiscount ? winningDiscount.dollars : 0)
  const totalDue = Math.max(subtotal + salesTax - discountValue, 0)

  useEffect(() => {
    if (!invoice) return
    const base = { subtotal, sales_tax: salesTax, job_total: totalDue, amount_due: totalDue, balance: totalDue }
    const update = hasCustomDiscount ? base : {
      ...base,
      discount_id: winningDiscount ? winningDiscount.id : null,
      discount_type: winningDiscount ? (winningDiscount.discount_type === 'percent' ? 'percent' : 'dollar') : 'dollar',
      discount_amount: winningDiscount ? (winningDiscount.discount_type === 'percent' ? Number(winningDiscount.value) : winningDiscount.dollars) : 0,
      discount_approved_by: isManualWinner ? (profile?.id || null) : null,
      discount_approved_at: isManualWinner ? new Date().toISOString() : null,
    }
    supabase
      .from('invoices')
      .update(update)
      .eq('id', invoice.id)
      .then(() => {})
  }, [subtotal, salesTax, totalDue, invoice, winningDiscount?.id, isManualWinner, hasCustomDiscount])

  useEffect(() => {
    const uid = invoice?.discount_approved_by
    if (uid && invoice && !invoice.discount_id) {
      supabase.from('users').select('full_name').eq('id', uid).single().then(({ data }) => setDiscountApproverName(data?.full_name || ''))
    } else {
      setDiscountApproverName('')
    }
  }, [invoice?.discount_approved_by, invoice?.discount_id])

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
              <h2 className="page-title" style={{ marginBottom: 4 }}>
                {invoice.invoice_number} — Job {job.job_number}
                {invoice.paid_at ? (
                  <span className="status-pill status-active" style={{ marginLeft: 12, verticalAlign: 'middle' }}>
                    Paid {new Date(invoice.paid_at).toLocaleDateString()}
                  </span>
                ) : (
                  <span className="status-pill status-trial" style={{ marginLeft: 12, verticalAlign: 'middle' }}>
                    Unpaid
                  </span>
                )}
              </h2>
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

          <RoutingSummary customerId={job.customer_id} propertyId={job.property_id} label="Invoice" />

          <div className="grid-table" style={{ gridTemplateColumns: '2fr 0.6fr 0.9fr 0.9fr 0.6fr 0.6fr', marginBottom: 20 }}>
            <div className="grid-cell grid-head">Description</div>
            <div className="grid-cell grid-head">Qty</div>
            <div className="grid-cell grid-head">Unit Price</div>
            <div className="grid-cell grid-head">Extension</div>
            <div className="grid-cell grid-head">Tax</div>
            <div className="grid-cell grid-head"></div>

            {lineItems.map((li) => (
              <>
                <div className="grid-cell">
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
                <div className="grid-cell">
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!li.taxable} onChange={(e) => updateLineItem(li.id, 'taxable', e.target.checked)} />
                    <span style={{ fontSize: 13, color: li.taxable ? undefined : 'var(--mist)' }}>{li.taxable ? 'Taxable' : 'Exempt'}</span>
                  </label>
                </div>
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
              {hasCustomDiscount ? (
                <div style={{ margin: '4px 0' }}>
                  <p style={{ margin: '2px 0', fontWeight: 600 }}>
                    Custom: {invoice.discount_type === 'percent' ? `${Number(invoice.discount_amount)}%` : `$${Number(invoice.discount_amount).toFixed(2)}`} (-${customDollars.toFixed(2)})
                  </p>
                  {invoice.discount_label && <p style={{ margin: '2px 0', fontSize: 12, color: 'var(--mist)' }}>{invoice.discount_label}</p>}
                  {customApproved ? (
                    <p style={{ margin: '2px 0', fontSize: 12, color: '#1F7A43', fontWeight: 600 }}>Approved{discountApproverName ? ` by ${discountApproverName}` : ''}</p>
                  ) : (
                    <p style={{ margin: '2px 0', fontSize: 12, color: '#B8860B', fontWeight: 600 }}>Pending approval {'\u2014'} not applied until approved</p>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    {!customApproved && canApproveDiscount && (
                      <button type="button" className="logout-button" style={{ borderColor: '#1F7A43', color: '#1F7A43' }} onClick={approveCustomDiscount}>Approve discount</button>
                    )}
                    {isFieldAdmin && <button type="button" className="logout-button" onClick={removeCustomDiscount}>Remove</button>}
                  </div>
                </div>
              ) : (
                <>
                  {winningDiscount ? (
                    <p style={{ margin: '4px 0' }}>
                      {winningDiscount.label} {'\u2014'} {winningDiscount.discount_type === 'percent' ? `${Number(winningDiscount.value)}%` : `$${Number(winningDiscount.value).toFixed(2)}`} (-${discountValue.toFixed(2)})
                    </p>
                  ) : (
                    <p style={{ margin: '4px 0', color: 'var(--mist)' }}>None</p>
                  )}
                  {isFieldAdmin ? (
                    <select value={pickedDiscountId} onChange={(e) => setPickedDiscountId(e.target.value)} style={{ width: '100%' }}>
                      <option value="">Auto (standing discounts only)</option>
                      {catalog.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label} ({c.discount_type === 'percent' ? `${Number(c.value)}%` : `$${Number(c.value).toFixed(2)}`}){c.discount_type === 'flat' ? ' \u2014 flat, your approval' : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p style={{ margin: '4px 0', fontSize: 12, color: 'var(--mist)' }}>Applied automatically from the customer&rsquo;s plan and eligibility.</p>
                  )}
                  {isManualWinner && (
                    <p style={{ margin: '4px 0', fontSize: 12, color: 'var(--mist)' }}>Approved by you {'\u00b7'} not shown to the customer</p>
                  )}
                  {isFieldAdmin && (
                    <div style={{ marginTop: 8, borderTop: '1px solid var(--border,#eee)', paddingTop: 8 }}>
                      {!custOpen ? (
                        <button type="button" className="logout-button" onClick={() => setCustOpen(true)}>+ Custom discount</button>
                      ) : (
                        <div>
                          <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--mist)' }}>One-off dollar discount {'\u2014'} needs supervisor approval before it applies; not itemized on the customer&rsquo;s invoice.</p>
                          <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                            <span style={{ color: 'var(--mist)', fontWeight: 600 }}>$</span>
                            <input type="number" step="0.01" min="0" value={custAmt} onChange={(e) => setCustAmt(e.target.value)} placeholder="Dollar amount off" style={{ flex: 1 }} />
                          </div>
                          <input value={custReason} onChange={(e) => setCustReason(e.target.value)} placeholder="Reason (shown to approver)" style={{ width: '100%', marginBottom: 6 }} />
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button type="button" className="auth-button" style={{ width: 'auto', padding: '6px 14px' }} onClick={requestCustomDiscount} disabled={!(parseFloat(custAmt) > 0)}>Submit for approval</button>
                            <button type="button" className="logout-button" onClick={() => { setCustOpen(false); setCustAmt(''); setCustReason('') }}>Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            <p style={{ margin: '8px 0' }}>Subtotal: ${subtotal.toFixed(2)}</p>
            <p style={{ margin: '8px 0' }}>Sales tax: ${salesTax.toFixed(2)}</p>
            <p style={{ margin: '8px 0' }}>Discount: -${discountValue.toFixed(2)}</p>
            <h3 style={{ margin: '12px 0 0' }}>Total Due: ${totalDue.toFixed(2)}</h3>
            {invoice.paid_at && (
              <p style={{ margin: '8px 0 0', color: '#4CD97B', fontWeight: 600 }}>
                ✓ Paid ${invoice.total_paid?.toFixed(2)} on {new Date(invoice.paid_at).toLocaleDateString()}
              </p>
            )}
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
                value={window.location.origin + '/view-invoice/' + invoice.id}
                style={{ flex: 1, padding: '8px 10px', background: 'var(--ink)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--paper)' }}
                onFocus={(e) => e.target.select()}
              />
              <button
                type="button"
                className="logout-button"
                onClick={() => navigator.clipboard.writeText(window.location.origin + '/view-invoice/' + invoice.id)}
              >
                Copy
              </button>
              
     <button
                type="button"
                className="logout-button"
                onClick={() => window.open('/view-invoice/' + invoice.id, '_blank')}
              >
                Open
              </button>
            </div>
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <button className="auth-button" style={{ width: 'auto', padding: '8px 20px' }} onClick={handleSendEmail} disabled={sendingEmail}>
                {sendingEmail ? 'Sending…' : invoice.sent_at ? 'Resend to Customer' : 'Send to Customer'}
              </button>
              {invoice.sent_at && (
                <span style={{ fontSize: 13, color: 'var(--mist)' }}>
                  Last sent {new Date(invoice.sent_at).toLocaleString()}
                </span>
              )}
            </div>
            {sendError && <div className="auth-error" style={{ marginTop: 10 }}>{sendError}</div>}
          </div>
<div className="auth-card" style={{ maxWidth: 500, marginTop: 24 }}>
            <h3 style={{ marginTop: 0, fontSize: 15 }}>Approvals</h3>
            {job?.auth_diagnose_only && (
              <div style={{ background: '#B00020', color: '#fff', padding: '10px 12px', borderRadius: 8, fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
                ⚠ DIAGNOSE ONLY — no repairs were authorized on this job until approved.
              </div>
            )}
            {!job?.auth_diagnose_only && job?.auth_limit_amount != null && (
              <div style={{
                background: totalDue > Number(job.auth_limit_amount) ? '#B00020' : 'var(--panel)',
                color: totalDue > Number(job.auth_limit_amount) ? '#fff' : 'var(--paper)',
                border: '1px solid var(--border)',
                padding: '10px 12px', borderRadius: 8, fontWeight: 700, fontSize: 13, marginBottom: 8,
              }}>
                {totalDue > Number(job.auth_limit_amount)
                  ? `⚠ Invoice total $${totalDue.toFixed(2)} EXCEEDS the $${Number(job.auth_limit_amount).toFixed(2)} authorization — re-authorization required.`
                  : `Authorized up to $${Number(job.auth_limit_amount).toFixed(2)} · current total $${totalDue.toFixed(2)}.`}
              </div>
            )}
            {STAGE_ORDER.map((stage) => {
              const existing = approvals.find((a) => a.stage === stage)
              return (
                <div key={stage} style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12 }}>
                  <strong style={{ fontSize: 14 }}>{STAGE_LABELS[stage]}</strong>
                  {existing ? (
                    <div style={{ marginTop: 4 }}>
                      <p style={{ fontSize: 13, color: 'var(--mist)', margin: 0 }}>
                        Approved by {existing.approved_by} on {new Date(existing.approved_at).toLocaleDateString()} — ${existing.amount?.toFixed(2)}
                      </p>
                      {existing.signature_url ? (
                        <ApprovalSignatureImage path={existing.signature_url} />
                      ) : (
                        <p style={{ fontSize: 12, color: 'var(--mist)', fontStyle: 'italic' }}>Typed approval, no signature on file</p>
                      )}
                    </div>
                  ) : approvingStage === stage ? (
                    <div style={{ marginTop: 8 }}>
                      <label style={{ display: 'block', fontSize: 13, marginBottom: 8, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={useTypedFallback}
                          onChange={(e) => { setUseTypedFallback(e.target.checked); setSignatureDataUrl(null); setNotPresentReason('') }}
                          style={{ marginRight: 6 }}
                        />
                        Not present (record reason instead of signature)
                      </label>
                      {useTypedFallback ? (
                        <select
                          value={notPresentReason}
                          onChange={(e) => setNotPresentReason(e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', background: 'var(--ink)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--paper)', marginBottom: 8, boxSizing: 'border-box' }}
                        >
                          <option value="">Why can't they sign?…</option>
                          {NOT_PRESENT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      ) : (
                        <>
                          <input
                            type="text"
                            value={approverName}
                            onChange={(e) => setApproverName(e.target.value)}
                            placeholder="Name of person signing"
                            style={{ width: '100%', padding: '8px 10px', background: 'var(--ink)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--paper)', marginBottom: 8, boxSizing: 'border-box' }}
                          />
                          <div style={{ marginBottom: 8 }}>
                            <SignaturePad onChange={setSignatureDataUrl} />
                          </div>
                        </>
                      )}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="auth-button" style={{ width: 'auto', padding: '8px 16px', margin: 0 }} onClick={() => submitApproval(stage)}>Confirm</button>
                        <button
                          className="logout-button"
                          onClick={() => { setApprovingStage(null); setApproverName(''); setSignatureDataUrl(null); setUseTypedFallback(false); setNotPresentReason('') }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button className="logout-button" style={{ marginTop: 8 }} onClick={() => { setApprovingStage(stage); setApproverName('') }}>Approve</button>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
