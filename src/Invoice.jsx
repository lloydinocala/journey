import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import SignaturePad from './SignaturePad'

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

  const [discountType, setDiscountType] = useState('dollar')
  const [discountAmount, setDiscountAmount] = useState('0')
  const [taxRate, setTaxRate] = useState(0)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [sendError, setSendError] = useState('')

  const [approvals, setApprovals] = useState([])
  const [approvingStage, setApprovingStage] = useState(null)
  const [approverName, setApproverName] = useState('')
  const [signatureDataUrl, setSignatureDataUrl] = useState(null)
  const [useTypedFallback, setUseTypedFallback] = useState(false)

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
    if (!approverName.trim()) return
    if (!useTypedFallback && !signatureDataUrl) {
      setError('Please capture a signature, or check "Customer not present" to use a typed approval instead.')
      return
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
      approved_by: approverName.trim(),
      approved_at: new Date().toISOString(),
      amount: totalDue,
      signature_url: signaturePath,
    })
    setApprovingStage(null)
    setApproverName('')
    setSignatureDataUrl(null)
    setUseTypedFallback(false)
    loadApprovals(jobId)
  }

  async function saveDiscount() {
    await supabase
      .from('invoices')
      .update({ discount_type: discountType, discount_amount: parseFloat(discountAmount) || 0 })
      .eq('id', invoice.id)
  }

  async function handleSendEmail() {
    setSendingEmail(true)
    setSendError('')
    const { data, error } = await supabase.functions.invoke('send-invoice-email', { body: { invoiceId: invoice.id } })
    setSendingEmail(false)
    if (error || data?.error) {
      setSendError(data?.error || error.message)
    } else {
      loadJobAndInvoice()
    }
  }

  const subtotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unit_price, 0)
  const taxableSubtotal = lineItems.filter((li) => li.taxable).reduce((sum, li) => sum + li.quantity * li.unit_price, 0)
  const salesTax = taxableSubtotal * (taxRate / 100)
  const discountValue =
    discountType === 'percent' ? subtotal * ((parseFloat(discountAmount) || 0) / 100) : parseFloat(discountAmount) || 0
  const totalDue = Math.max(subtotal + salesTax - discountValue, 0)

  useEffect(() => {
    if (!invoice) return
    supabase
      .from('invoices')
      .update({ subtotal, sales_tax: salesTax, job_total: totalDue, amount_due: totalDue, balance: totalDue })
      .eq('id', invoice.id)
      .then(() => {})
  }, [subtotal, salesTax, totalDue, invoice])

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
            <p style={{ margin: '8px 0' }}>Sales tax: ${salesTax.toFixed(2)}</p>
            <p style={{ margin: '8px 0' }}>Discount: -${discountValue.toFixed(2)}</p>
            <h3 style={{ margin: '12px 0 0' }}>Total Due: ${totalDue.toFixed(2)}</h3>
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
                      <input
                        type="text"
                        value={approverName}
                        onChange={(e) => setApproverName(e.target.value)}
                        placeholder="Customer name"
                        style={{ width: '100%', padding: '8px 10px', background: 'var(--ink)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--paper)', marginBottom: 8, boxSizing: 'border-box' }}
                      />
                      <label style={{ display: 'block', fontSize: 13, marginBottom: 8, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={useTypedFallback}
                          onChange={(e) => { setUseTypedFallback(e.target.checked); setSignatureDataUrl(null) }}
                          style={{ marginRight: 6 }}
                        />
                        Customer not present (typed approval, no signature)
                      </label>
                      {!useTypedFallback && (
                        <div style={{ marginBottom: 8 }}>
                          <SignaturePad onChange={setSignatureDataUrl} />
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="auth-button" style={{ width: 'auto', padding: '8px 16px', margin: 0 }} onClick={() => submitApproval(stage)}>Confirm</button>
                        <button
                          className="logout-button"
                          onClick={() => { setApprovingStage(null); setApproverName(''); setSignatureDataUrl(null); setUseTypedFallback(false) }}
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
