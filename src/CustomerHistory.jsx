import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from './utils/supabase'

export default function CustomerHistory({ profile }) {
  const { customerId } = useParams()

  const [customer, setCustomer] = useState(null)
  const [properties, setProperties] = useState([])
  const [jobs, setJobs] = useState([])
  const [invoices, setInvoices] = useState([])
  const [warranties, setWarranties] = useState([])
  const [agreements, setAgreements] = useState([])
  const [offerPropId, setOfferPropId] = useState('')
  const [sendingOffer, setSendingOffer] = useState(false)
  const [offerMsg, setOfferMsg] = useState('')
  const [billingHistory, setBillingHistory] = useState({})
  const [attachments, setAttachments] = useState([])
  const [photoUrls, setPhotoUrls] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lightbox, setLightbox] = useState(null)

  const [contacts, setContacts] = useState([])
  const [editContactId, setEditContactId] = useState(null)
  const [cName, setCName] = useState('')
  const [cTitle, setCTitle] = useState('')
  const [cEmail, setCEmail] = useState('')
  const [cPhone, setCPhone] = useState('')
  const [cPropertyId, setCPropertyId] = useState('')
  const [cApprover, setCApprover] = useState(false)
  const [cBilling, setCBilling] = useState(false)
  const [cOnsite, setCOnsite] = useState(false)
  const [savingContact, setSavingContact] = useState(false)

  useEffect(() => {
    loadAll()
  }, [customerId])

  async function loadAll() {
    setLoading(true)
    setError('')

    const { data: custData, error: custError } = await supabase
      .from('customers')
      .select('id, org_id, display_name, company, first_name, last_name, spouse_name, primary_phone, secondary_phone, email_1, email_2, acquire_date, notes, is_active, is_banned, banned_reason')
      .eq('id', customerId)
      .single()

    if (custError || !custData) {
      setError(custError?.message || 'Customer not found.')
      setLoading(false)
      return
    }
    setCustomer(custData)

    const [propsRes, jobsRes, invoicesRes, agreementsRes, warrantiesRes] = await Promise.all([
      supabase
        .from('properties')
        .select('id, street_address, unit, city, county, state, zip, gate_code, notes, is_active')
        .eq('customer_id', customerId)
        .order('is_active', { ascending: false }),
      supabase
        .from('jobs')
        .select(`
          id, job_number, segment, status, job_date, job_type, service_complaint, job_notes, completed_at,
          property:properties(street_address, unit, city, state, zip),
          job_technicians ( sort_order, users ( full_name ) )
        `)
        .eq('customer_id', customerId)
        .is('deleted_at', null)
        .order('job_date', { ascending: false }),
      supabase
        .from('invoices')
        .select('id, invoice_number, invoice_date, kind, estimate_type, job_total, amount_due, balance, paid_at, approval_status')
        .eq('bills_to_customer_id', customerId)
        .is('deleted_at', null)
        .order('invoice_date', { ascending: false }),
      supabase
        .from('maintenance_agreements')
        .select(`
          id, status, billing_cycle, price, start_date, next_visit_due_date, last_visit_completed_date, canceled_at,
          tier:maintenance_agreement_tiers(name, visit_count_per_year, discount_pct)
        `)
        .eq('customer_id', customerId)
        .order('start_date', { ascending: false }),
      supabase
        .from('warranty_registrations')
        .select('id, install_date, brand, indoor_model, indoor_serial, outdoor_model, outdoor_serial, furnace_model, furnace_serial, registered_at')
        .eq('customer_id', customerId)
        .order('install_date', { ascending: false }),
    ])

    setProperties(propsRes.data || [])
    setOfferPropId((propsRes.data || []).find((p) => p.is_active)?.id || '')
    setJobs(jobsRes.data || [])
    setInvoices(invoicesRes.data || [])
    setAgreements(agreementsRes.data || [])
    setWarranties(warrantiesRes.data || [])

    const { data: contactsData } = await supabase
      .from('contacts')
      .select('id, name, title, email, phone, property_id, is_approver, is_billing, is_onsite, is_active, properties(street_address, unit, city, state, zip)')
      .eq('customer_id', customerId)
      .order('sort_order')
    setContacts(contactsData || [])

    const agreementIds = (agreementsRes.data || []).map((a) => a.id)
    if (agreementIds.length > 0) {
      const { data: billingRows } = await supabase
        .from('maintenance_agreement_billing_history')
        .select('id, agreement_id, billed_date, amount, paid_at, payment_method, status')
        .in('agreement_id', agreementIds)
        .order('billed_date', { ascending: false })
      const grouped = {}
      ;(billingRows || []).forEach((b) => {
        if (!grouped[b.agreement_id]) grouped[b.agreement_id] = []
        grouped[b.agreement_id].push(b)
      })
      setBillingHistory(grouped)
    } else {
      setBillingHistory({})
    }

    const jobIds = (jobsRes.data || []).map((j) => j.id)
    let attachmentRows = []
    if (jobIds.length > 0) {
      const { data } = await supabase
        .from('attachments')
        .select('id, job_id, file_path, file_name, category, caption, taken_at')
        .or(`customer_id.eq.${customerId},job_id.in.(${jobIds.join(',')})`)
        .order('taken_at', { ascending: false })
      attachmentRows = data || []
    } else {
      const { data } = await supabase
        .from('attachments')
        .select('id, job_id, file_path, file_name, category, caption, taken_at')
        .eq('customer_id', customerId)
        .order('taken_at', { ascending: false })
      attachmentRows = data || []
    }
    setAttachments(attachmentRows)

    const urlEntries = await Promise.all(
      attachmentRows
        .filter((a) => a.category === 'photo')
        .map(async (a) => {
          const { data } = await supabase.storage.from('job-photos').createSignedUrl(a.file_path, 3600)
          return [a.id, data?.signedUrl || null]
        })
    )
    setPhotoUrls(Object.fromEntries(urlEntries))

    setLoading(false)
  }

  function formatDate(d) {
    if (!d) return '—'
    return new Date(d.length <= 10 ? d + 'T00:00:00' : d).toLocaleDateString()
  }

  function formatMoney(n) {
    if (n === null || n === undefined) return '—'
    return '$' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  function techNames(job) {
    const names = (job.job_technicians || [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((jt) => jt.users?.full_name)
      .filter(Boolean)
    return names.length ? names.join(', ') : '—'
  }

  function propertyLine(p) {
    if (!p) return '—'
    return [p.street_address, p.unit, p.city, p.state, p.zip].filter(Boolean).join(', ')
  }

  function roleBadges(c) {
    const r = []
    if (c.is_approver) r.push('Approver')
    if (c.is_billing) r.push('Billing / AP')
    if (c.is_onsite) r.push('On-site')
    return r
  }

  function resetContactForm() {
    setEditContactId(null)
    setCName(''); setCTitle(''); setCEmail(''); setCPhone(''); setCPropertyId('')
    setCApprover(false); setCBilling(false); setCOnsite(false)
  }

  function editContact(c) {
    setEditContactId(c.id)
    setCName(c.name || ''); setCTitle(c.title || ''); setCEmail(c.email || ''); setCPhone(c.phone || '')
    setCPropertyId(c.property_id || '')
    setCApprover(!!c.is_approver); setCBilling(!!c.is_billing); setCOnsite(!!c.is_onsite)
  }

  async function saveContact(e) {
    e.preventDefault()
    if (!cName.trim()) return
    setSavingContact(true)
    const row = {
      org_id: customer.org_id,
      customer_id: customerId,
      property_id: cPropertyId || null,
      name: cName.trim(),
      title: cTitle.trim() || null,
      email: cEmail.trim() || null,
      phone: cPhone.trim() || null,
      is_approver: cApprover,
      is_billing: cBilling,
      is_onsite: cOnsite,
    }
    if (editContactId) {
      await supabase.from('contacts').update(row).eq('id', editContactId)
    } else {
      await supabase.from('contacts').insert(row)
    }
    setSavingContact(false)
    resetContactForm()
    loadAll()
  }

  async function deleteContact(id) {
    if (!window.confirm('Remove this contact?')) return
    await supabase.from('contacts').delete().eq('id', id)
    if (editContactId === id) resetContactForm()
    loadAll()
  }

  if (loading) return <p style={{ color: 'var(--mist)' }}>Loading…</p>
  if (error) return <div className="auth-error">{error}</div>
  async function sendPlanOffer() {
    if (!offerPropId) return
    setSendingOffer(true); setOfferMsg('')
    const { data, error } = await supabase.functions.invoke('send-agreement-options-email', { body: { propertyId: offerPropId } })
    if (error || data?.error) { setSendingOffer(false); setOfferMsg('Could not send — check the customer has an email on file.'); return }
    await supabase.from('maintenance_offers').insert({
      org_id: customer.org_id, property_id: offerPropId, customer_id: customer.id,
      offered_by: profile?.id || null, channel: 'email',
    })
    setSendingOffer(false)
    setOfferMsg(data?.sentTo ? `Plan offer sent to ${data.sentTo}` : 'Plan offer sent.')
  }

  if (!customer) return null

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .ch-printable, .ch-printable * { visibility: visible; }
          .ch-printable { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Link to="/customers" className="logout-button">← Back to Customers</Link>
        <button className="auth-button" style={{ width: 'auto', margin: 0, padding: '8px 20px' }} onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      </div>

      <div className="ch-printable">
        <div className="page-header-bar">
          <h2>{customer.display_name}</h2>
          {customer.is_banned && <span className="badge" style={{ background: '#a33', color: '#fff' }}>Do Not Service</span>}
        </div>
        {customer.is_banned && customer.banned_reason && (
          <p style={{ color: '#a33', marginTop: -8 }}>Reason: {customer.banned_reason}</p>
        )}

        <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap', margin: '16px 0 28px' }}>
          <div>
            <h3 style={{ marginBottom: 6 }}>Contact</h3>
            {customer.company && <p style={{ margin: '2px 0' }}>{customer.company}</p>}
            {(customer.first_name || customer.last_name) && (
              <p style={{ margin: '2px 0' }}>{[customer.first_name, customer.last_name].filter(Boolean).join(' ')}</p>
            )}
            {customer.spouse_name && <p style={{ margin: '2px 0' }}>Spouse: {customer.spouse_name}</p>}
            <p style={{ margin: '2px 0' }}>{customer.primary_phone || '—'}</p>
            {customer.secondary_phone && <p style={{ margin: '2px 0' }}>{customer.secondary_phone}</p>}
            <p style={{ margin: '2px 0' }}>{customer.email_1 || '—'}</p>
            {customer.email_2 && <p style={{ margin: '2px 0' }}>{customer.email_2}</p>}
            <p style={{ margin: '2px 0', color: 'var(--mist)' }}>Customer since {formatDate(customer.acquire_date)}</p>
          </div>

          <div>
            <h3 style={{ marginBottom: 6 }}>Properties</h3>
            {properties.length === 0 && <p style={{ color: 'var(--mist)' }}>No properties on file.</p>}
            {properties.map((p) => (
              <p key={p.id} style={{ margin: '2px 0' }}>
                {propertyLine(p)}{!p.is_active ? ' (inactive)' : ''}
                {p.gate_code ? ` — Gate: ${p.gate_code}` : ''}
              </p>
            ))}
          </div>

          <div>
            <h3 style={{ marginBottom: 6 }}>Maintenance Agreement</h3>
            {agreements.length === 0 && <p style={{ color: 'var(--mist)' }}>No maintenance agreement on file.</p>}
            {agreements.map((a) => (
              <div key={a.id} style={{ marginBottom: 8 }}>
                <p style={{ margin: '2px 0' }}>
                  {a.tier?.name || 'Tier'} — <span className="badge">{a.status}</span>
                </p>
                <p style={{ margin: '2px 0', color: 'var(--mist)' }}>
                  {a.billing_cycle} · {formatMoney(a.price)} · {a.tier?.visit_count_per_year || '—'} visits/yr
                </p>
                <p style={{ margin: '2px 0', color: 'var(--mist)' }}>
                  Next visit due {formatDate(a.next_visit_due_date)} · Last visit {formatDate(a.last_visit_completed_date)}
                </p>
                {(billingHistory[a.id] || []).length > 0 && (
                  <table className="data-table" style={{ marginTop: 8, marginBottom: 0 }}>
                    <thead>
                      <tr>
                        <th>Billed</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Paid</th>
                        <th>Method</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billingHistory[a.id].map((b) => (
                        <tr key={b.id}>
                          <td>{formatDate(b.billed_date)}</td>
                          <td>{formatMoney(b.amount)}</td>
                          <td><span className="badge">{b.status}</span></td>
                          <td>{b.paid_at ? new Date(b.paid_at).toLocaleDateString() : '—'}</td>
                          <td>{b.payment_method || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border, #E2E6ED)' }}>
              <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: 13 }}>Offer a plan</p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <select value={offerPropId} onChange={(e) => setOfferPropId(e.target.value)}>
                  <option value="">Select property…</option>
                  {properties.filter((p) => p.is_active).map((p) => <option key={p.id} value={p.id}>{propertyLine(p)}</option>)}
                </select>
                <button className="auth-button" style={{ width: 'auto', margin: 0, padding: '8px 16px' }} disabled={!offerPropId || sendingOffer} onClick={sendPlanOffer}>{sendingOffer ? 'Sending…' : 'Send Plan Offer'}</button>
              </div>
              {offerMsg && <p style={{ margin: '6px 0 0', fontSize: 13, color: '#2563EB' }}>{offerMsg}</p>}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 28 }}>
          <h3 style={{ marginBottom: 6 }}>Contacts &amp; Invoice Routing</h3>
          <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0 }}>
            Who approves and who gets billed. Pin a contact to a department, or leave it at the account
            level to cover the whole customer.
          </p>
          {contacts.length === 0 && <p style={{ color: 'var(--mist)' }}>No contacts yet.</p>}
          {contacts.length > 0 && (
            <table className="data-table" style={{ marginBottom: 16 }}>
              <thead>
                <tr><th>Name</th><th>Roles</th><th>Department</th><th>Email</th><th>Phone</th><th className="no-print"></th></tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}{c.title ? <span style={{ color: 'var(--mist)' }}> — {c.title}</span> : ''}</td>
                    <td>
                      {roleBadges(c).map((r) => <span key={r} className="badge" style={{ marginRight: 4 }}>{r}</span>)}
                      {roleBadges(c).length === 0 && <span style={{ color: 'var(--mist)' }}>—</span>}
                    </td>
                    <td>{c.property_id ? propertyLine(c.properties) : <span style={{ color: 'var(--mist)' }}>Whole account</span>}</td>
                    <td>{c.email || '—'}</td>
                    <td>{c.phone || '—'}</td>
                    <td className="no-print" style={{ whiteSpace: 'nowrap' }}>
                      <button className="logout-button" type="button" onClick={() => editContact(c)}>Edit</button>
                      <button className="logout-button" type="button" onClick={() => deleteContact(c.id)} style={{ marginLeft: 6 }}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <form onSubmit={saveContact} className="no-print" style={{ border: '0.5px solid var(--border, #d0d0d0)', borderRadius: 10, padding: 14, maxWidth: 720 }}>
            <h4 style={{ margin: '0 0 10px' }}>{editContactId ? 'Edit contact' : 'Add a contact'}</h4>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div className="field" style={{ flex: '1 1 200px' }}>
                <label>Name</label>
                <input type="text" value={cName} onChange={(e) => setCName(e.target.value)} placeholder="e.g. Bob Smith" required />
              </div>
              <div className="field" style={{ flex: '1 1 200px' }}>
                <label>Title</label>
                <input type="text" value={cTitle} onChange={(e) => setCTitle(e.target.value)} placeholder="optional, e.g. Blue Division Manager" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div className="field" style={{ flex: '1 1 200px' }}>
                <label>Email</label>
                <input type="email" value={cEmail} onChange={(e) => setCEmail(e.target.value)} placeholder="optional" />
              </div>
              <div className="field" style={{ flex: '1 1 200px' }}>
                <label>Phone</label>
                <input type="tel" value={cPhone} onChange={(e) => setCPhone(e.target.value)} placeholder="optional" />
              </div>
            </div>
            <div className="field">
              <label>Department</label>
              <select value={cPropertyId} onChange={(e) => setCPropertyId(e.target.value)}>
                <option value="">Whole account (customer level)</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{propertyLine(p)}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 16, margin: '6px 0 12px', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={cApprover} onChange={(e) => setCApprover(e.target.checked)} /> Approver</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={cBilling} onChange={(e) => setCBilling(e.target.checked)} /> Billing / AP</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={cOnsite} onChange={(e) => setCOnsite(e.target.checked)} /> On-site</label>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="auth-button" type="submit" style={{ width: 'auto', margin: 0, padding: '8px 20px' }} disabled={savingContact || !cName.trim()}>
                {savingContact ? 'Saving\u2026' : editContactId ? 'Save contact' : 'Add contact'}
              </button>
              {editContactId && <button className="logout-button" type="button" onClick={resetContactForm}>Cancel</button>}
            </div>
          </form>
        </div>

        {customer.notes && (
          <div style={{ marginBottom: 28 }}>
            <h3 style={{ marginBottom: 6 }}>Notes</h3>
            <p style={{ whiteSpace: 'pre-wrap' }}>{customer.notes}</p>
          </div>
        )}

        <div style={{ marginBottom: 28 }}>
          <h3 style={{ marginBottom: 10 }}>Job History</h3>
          {jobs.length === 0 ? (
            <p style={{ color: 'var(--mist)' }}>No jobs on file.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Job #</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Property</th>
                    <th>Technician(s)</th>
                    <th>Complaint / Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j) => (
                    <tr key={j.id}>
                      <td><Link to={`/jobs?job=${j.id}`} style={{ color: '#2E7FC4', fontWeight: 600 }}>{j.job_number}{j.segment > 1 ? `-${j.segment}` : ''}</Link></td>
                      <td>{formatDate(j.job_date)}</td>
                      <td>{j.job_type || '—'}</td>
                      <td><span className="badge">{j.status}</span></td>
                      <td>{propertyLine(j.property)}</td>
                      <td>{techNames(j)}</td>
                      <td>{j.service_complaint || j.job_notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 28 }}>
          <h3 style={{ marginBottom: 10 }}>Invoices &amp; Estimates</h3>
          {invoices.length === 0 ? (
            <p style={{ color: 'var(--mist)' }}>No invoices or estimates on file.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Total</th>
                    <th>Balance</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td><Link to={inv.kind === 'estimate' ? (inv.estimate_type === 'system' ? `/system-estimates?estimate=${inv.id}` : `/estimates?estimate=${inv.id}`) : `/invoices?invoice=${inv.id}`} style={{ color: '#2E7FC4', fontWeight: 600 }}>{inv.invoice_number}</Link></td>
                      <td>{formatDate(inv.invoice_date)}</td>
                      <td>{inv.kind === 'estimate' ? 'Estimate' : 'Invoice'}</td>
                      <td>{formatMoney(inv.job_total)}</td>
                      <td>{formatMoney(inv.balance)}</td>
                      <td>
                        {inv.kind === 'estimate'
                          ? inv.approval_status
                          : inv.paid_at ? 'Paid' : 'Unpaid'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <h3 style={{ marginBottom: 10 }}>Warranty Registrations</h3>
          {warranties.length === 0 ? (
            <p style={{ color: 'var(--mist)' }}>No new-system installs on file.</p>
          ) : (
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr><th>Install Date</th><th>Brand</th><th>Equipment (model / serial)</th><th>Status</th></tr>
              </thead>
              <tbody>
                {warranties.map((w) => {
                  const eq = [
                    w.outdoor_model && `Outdoor ${w.outdoor_model}${w.outdoor_serial ? ' / ' + w.outdoor_serial : ''}`,
                    w.indoor_model && `Indoor ${w.indoor_model}${w.indoor_serial ? ' / ' + w.indoor_serial : ''}`,
                    w.furnace_model && `Furnace ${w.furnace_model}${w.furnace_serial ? ' / ' + w.furnace_serial : ''}`,
                  ].filter(Boolean).join('; ') || '—'
                  return (
                    <tr key={w.id}>
                      <td>{w.install_date ? formatDate(w.install_date) : '—'}</td>
                      <td>{w.brand || '—'}</td>
                      <td style={{ fontSize: 12.5 }}>{eq}</td>
                      <td>{w.registered_at
                        ? <span style={{ color: '#15803D', fontWeight: 600 }}>✓ Registered {formatDate(w.registered_at)}</span>
                        : <Link to="/warranty-registrations" style={{ color: '#B0472B', fontWeight: 600 }}>Not registered</Link>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div>
          <h3 style={{ marginBottom: 10 }}>Photos &amp; Attachments</h3>
          {attachments.length === 0 ? (
            <p style={{ color: 'var(--mist)' }}>No photos or attachments on file.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              {attachments.map((a) => (
                <div key={a.id} style={{ width: 180 }}>
                  {a.category === 'photo' && photoUrls[a.id] ? (
                    <img
                      src={photoUrls[a.id]}
                      alt={a.caption || a.file_name}
                      onClick={() => setLightbox({ url: photoUrls[a.id], caption: a.caption, date: a.taken_at })}
                      style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 6, border: '1px solid #ddd', cursor: 'zoom-in' }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #ddd', borderRadius: 6, color: 'var(--mist)' }}>
                      {a.file_name}
                    </div>
                  )}
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--mist)' }}>{formatDate(a.taken_at)}</p>
                  {a.caption && <p style={{ margin: '2px 0 0', fontSize: 12 }}>{a.caption}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {lightbox && (
        <div
          className="no-print"
          onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 5000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out' }}
        >
          <button
            onClick={() => setLightbox(null)}
            style={{ position: 'fixed', top: 16, right: 20, background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 16, cursor: 'pointer' }}
          >
            ✕ Close
          </button>
          <img
            src={lightbox.url}
            alt={lightbox.caption || ''}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '95vw', maxHeight: '88vh', objectFit: 'contain', borderRadius: 8, boxShadow: '0 10px 40px rgba(0,0,0,0.5)', cursor: 'default' }}
          />
          {(lightbox.caption || lightbox.date) && (
            <div style={{ color: '#fff', marginTop: 12, fontSize: 14, textAlign: 'center' }}>
              {lightbox.caption}{lightbox.caption && lightbox.date ? ' · ' : ''}{lightbox.date ? formatDate(lightbox.date) : ''}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
