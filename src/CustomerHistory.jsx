import { useState, useEffect } from 'react'
import AiAssist from './AiAssist'
import { useParams, Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import { warrantyFor, decodeSerial } from './Warranty'

const CUST_SUMMARY_SYS = 'Summarize an HVAC customer account for office staff, using only the provided facts. Start with a 2-3 line snapshot (who they are, how long a customer, property/job/invoice volume), then flag opportunities and risks: overdue balances, a missing or expiring maintenance agreement, aging estimates, upcoming maintenance. Be specific with numbers. Under 8 short lines. No headers.'

export default function CustomerHistory({ profile }) {
  const { customerId } = useParams()

  const [customer, setCustomer] = useState(null)
  const [properties, setProperties] = useState([])
  const [jobs, setJobs] = useState([])
  const [invoices, setInvoices] = useState([])
  const [warranties, setWarranties] = useState([])
  const [equipment, setEquipment] = useState([])
  const blankEqForm = { system_label: '', install_date: '', manufacture_year: '', manufacture_month: '', outdoor_brand: '', outdoor_model: '', outdoor_serial: '', indoor_brand: '', indoor_model: '', indoor_serial: '', furnace_brand: '', furnace_model: '', furnace_serial: '', notes: '' }
  const [eqEditingId, setEqEditingId] = useState(null)
  const [eqForm, setEqForm] = useState(blankEqForm)
  const [savingEq, setSavingEq] = useState(false)
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
        .select('id, org_id, street_address, unit, city, county, state, zip, gate_code, notes, is_active')
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
    const eqPropIds = (propsRes.data || []).map((pr) => pr.id)
    if (eqPropIds.length) {
      const { data: eqData } = await supabase
        .from('property_equipment')
        .select('id, property_id, system_label, install_date, manufacture_year, manufacture_month, status, outdoor_brand, outdoor_model, outdoor_serial, indoor_brand, indoor_model, indoor_serial, furnace_brand, furnace_model, furnace_serial')
        .in('property_id', eqPropIds)
        .neq('status', 'retired')
        .order('created_at', { ascending: false })
      setEquipment(eqData || [])
    }
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

  // Warranty helpers (shared logic in ./Warranty). Month-precise; parts from the
  // manufacture date unless we installed it, labor/refrigerant 1 yr from install.
  const WARR_PILL_STYLE = (state) => ({
    active: { background: 'rgba(46,160,87,0.14)', color: '#1b7a3d', border: '1px solid rgba(46,160,87,0.35)' },
    expired: { background: 'rgba(200,60,60,0.12)', color: '#b0342f', border: '1px solid rgba(200,60,60,0.32)' },
    verify: { background: 'rgba(210,150,40,0.14)', color: '#9a6a12', border: '1px solid rgba(210,150,40,0.35)' },
  }[state] || {})
  const warrPill = (pill) => (
    <span key={pill.label} style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 600, ...WARR_PILL_STYLE(pill.state) }}>{pill.label}</span>
  )
  const EQ_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  function eqWarranty(eq) {
    const order = [[eq.outdoor_brand, eq.outdoor_serial], [eq.indoor_brand, eq.indoor_serial], [eq.furnace_brand, eq.furnace_serial]]
    let brand = eq.outdoor_brand, serial = eq.outdoor_serial
    if (eq.manufacture_year == null) {
      for (const [b, sn] of order) { if (decodeSerial(b, sn).year) { brand = b; serial = sn; break } }
    }
    return warrantyFor({ manufactureYear: eq.manufacture_year, manufactureMonth: eq.manufacture_month, installDate: eq.install_date, brand, serial })
  }
  function eqMfgLabel(w) {
    if (!w.manufactureYear) return 'Verify (see note)'
    const m = w.manufactureMonth ? EQ_MONTHS[w.manufactureMonth - 1] + ' ' : ''
    return `${m}${w.manufactureYear}${w.manufactureSource === 'serial' ? ' (from serial)' : ''}`
  }

  async function reloadEquipment() {
    const propIds = properties.map((pr) => pr.id)
    if (!propIds.length) { setEquipment([]); return }
    const { data } = await supabase.from('property_equipment')
      .select('id, property_id, system_label, install_date, manufacture_year, manufacture_month, status, outdoor_brand, outdoor_model, outdoor_serial, indoor_brand, indoor_model, indoor_serial, furnace_brand, furnace_model, furnace_serial')
      .in('property_id', propIds).neq('status', 'retired').order('created_at', { ascending: false })
    setEquipment(data || [])
  }
  function startEqEdit(eq) {
    setEqEditingId(eq.id)
    setEqForm({
      system_label: eq.system_label || '', install_date: eq.install_date || '',
      manufacture_year: eq.manufacture_year != null ? String(eq.manufacture_year) : '',
      manufacture_month: eq.manufacture_month != null ? String(eq.manufacture_month) : '',
      outdoor_brand: eq.outdoor_brand || '', outdoor_model: eq.outdoor_model || '', outdoor_serial: eq.outdoor_serial || '',
      indoor_brand: eq.indoor_brand || '', indoor_model: eq.indoor_model || '', indoor_serial: eq.indoor_serial || '',
      furnace_brand: eq.furnace_brand || '', furnace_model: eq.furnace_model || '', furnace_serial: eq.furnace_serial || '',
      notes: eq.notes || '',
    })
  }
  function startEqAdd(propertyId) { setEqEditingId('new:' + propertyId); setEqForm(blankEqForm) }
  function cancelEq() { setEqEditingId(null); setEqForm(blankEqForm) }
  async function saveEq(property) {
    setSavingEq(true)
    const payload = {
      system_label: eqForm.system_label.trim() || null,
      install_date: eqForm.install_date || null,
      manufacture_year: eqForm.manufacture_year === '' ? null : (parseInt(eqForm.manufacture_year, 10) || null),
      manufacture_month: eqForm.manufacture_month === '' ? null : (parseInt(eqForm.manufacture_month, 10) || null),
      outdoor_brand: eqForm.outdoor_brand.trim() || null, outdoor_model: eqForm.outdoor_model.trim() || null, outdoor_serial: eqForm.outdoor_serial.trim() || null,
      indoor_brand: eqForm.indoor_brand.trim() || null, indoor_model: eqForm.indoor_model.trim() || null, indoor_serial: eqForm.indoor_serial.trim() || null,
      furnace_brand: eqForm.furnace_brand.trim() || null, furnace_model: eqForm.furnace_model.trim() || null, furnace_serial: eqForm.furnace_serial.trim() || null,
      notes: eqForm.notes.trim() || null,
    }
    if (typeof eqEditingId === 'string' && eqEditingId.startsWith('new:')) {
      await supabase.from('property_equipment').insert({ ...payload, org_id: property.org_id, property_id: property.id, status: 'active' })
    } else {
      await supabase.from('property_equipment').update(payload).eq('id', eqEditingId)
    }
    setSavingEq(false); setEqEditingId(null); setEqForm(blankEqForm)
    await reloadEquipment()
  }
  function renderEqForm(property) {
    const f = eqForm
    const set = (k, v) => setEqForm({ ...eqForm, [k]: v })
    return (
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12 }}>System<br /><input type="text" value={f.system_label} onChange={(e) => set('system_label', e.target.value)} placeholder="e.g. Upstairs" /></label>
          <label style={{ fontSize: 12 }}>Install date<br /><input type="date" value={f.install_date} onChange={(e) => set('install_date', e.target.value)} /></label>
          <label style={{ fontSize: 12 }}>Mfg year<br /><input type="number" value={f.manufacture_year} onChange={(e) => set('manufacture_year', e.target.value)} placeholder="auto" style={{ width: 90 }} /></label>
          <label style={{ fontSize: 12 }}>Mfg month<br /><select value={f.manufacture_month} onChange={(e) => set('manufacture_month', e.target.value)}><option value="">—</option>{EQ_MONTHS.map((mn, i) => <option key={mn} value={i + 1}>{mn}</option>)}</select></label>
        </div>
        {[['Outdoor', 'outdoor'], ['Indoor', 'indoor'], ['Furnace', 'furnace']].map(([lbl, k]) => (
          <div key={k} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, width: 62, color: 'var(--mist)' }}>{lbl}</span>
            <input type="text" value={f[k + '_brand']} onChange={(e) => set(k + '_brand', e.target.value)} placeholder="Brand" style={{ width: 110 }} />
            <input type="text" value={f[k + '_model']} onChange={(e) => set(k + '_model', e.target.value)} placeholder="Model" style={{ width: 130 }} />
            <input type="text" value={f[k + '_serial']} onChange={(e) => set(k + '_serial', e.target.value)} placeholder="Serial" style={{ width: 150 }} />
          </div>
        ))}
        <label style={{ fontSize: 12 }}>Notes<br /><input type="text" value={f.notes} onChange={(e) => set('notes', e.target.value)} style={{ width: '100%', maxWidth: 420 }} /></label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="auth-button" style={{ width: 'auto', padding: '6px 16px' }} disabled={savingEq} onClick={() => saveEq(property)}>{savingEq ? 'Saving…' : 'Save'}</button>
          <button className="logout-button" onClick={cancelEq}>Cancel</button>
        </div>
      </div>
    )
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

        <div style={{ margin: '10px 0 18px' }}>
          <AiAssist inline title="AI account summary" label="✨ AI: summarize this customer"
            system={CUST_SUMMARY_SYS}
            prompt="Give a quick account summary and flag any opportunities or risks for this customer, using the facts provided."
            context={{
              customer: { name: customer.display_name, company: customer.company, customer_since: customer.acquire_date, notes: customer.notes },
              properties: properties.length,
              jobs: jobs.slice(0, 25).map((j) => ({ number: j.job_number, status: j.status, date: j.job_date })),
              invoices: invoices.slice(0, 25).map((i) => ({ number: i.invoice_number, total: i.job_total, balance: i.balance, paid: !!i.paid_at, sent: i.sent_at })),
              maintenance_agreements: agreements.map((a) => ({ status: a.status, next_visit_due: a.next_visit_due_date })),
              warranties: warranties.length,
            }} />
        </div>

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
            {properties.map((p) => {
              const propEquip = equipment.filter((e) => e.property_id === p.id)
              return (
                <div key={p.id} style={{ margin: '4px 0 10px' }}>
                  <p style={{ margin: '2px 0' }}>
                    {propertyLine(p)}{!p.is_active ? ' (inactive)' : ''}
                    {p.gate_code ? ` — Gate: ${p.gate_code}` : ''}
                  </p>
                  {propEquip.map((eq) => {
                    const w = eqWarranty(eq)
                    return (
                      <div key={eq.id} style={{ margin: '4px 0 4px 14px', padding: 8, background: 'var(--panel)', borderRadius: 6 }}>
                        {eqEditingId === eq.id ? renderEqForm(p) : (
                          <>
                            <div style={{ fontSize: 13 }}>
                              <strong>{eq.system_label || 'System'}</strong>{eq.outdoor_brand ? ` — ${eq.outdoor_brand}` : ''}{' · '}
                              <span style={{ color: 'var(--mist)' }}>Mfg: {eqMfgLabel(w)}</span>
                              <button className="logout-button" style={{ marginLeft: 8, fontSize: 12, padding: '1px 8px' }} onClick={() => startEqEdit(eq)}>Edit</button>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>{warrPill(w.parts)}{warrPill(w.labor)}{warrPill(w.freon)}</div>
                            {w.note && <div style={{ fontSize: 12, color: 'var(--amber)', marginTop: 4 }}>{w.note}</div>}
                          </>
                        )}
                      </div>
                    )
                  })}
                  {eqEditingId === 'new:' + p.id ? (
                    <div style={{ margin: '4px 0 4px 14px', padding: 8, background: 'var(--panel)', borderRadius: 6 }}>{renderEqForm(p)}</div>
                  ) : (
                    <button className="logout-button" style={{ marginLeft: 14, fontSize: 12, padding: '2px 10px' }} onClick={() => startEqAdd(p.id)}>+ Add equipment</button>
                  )}
                </div>
              )
            })}
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
