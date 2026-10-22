import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import CustomerSearchSelect from './CustomerSearchSelect'
import { loadServiceCallsForProperty, pickLikelyServiceCall, serviceCallLabel } from './SystemEstimate'

// New Estimate — any kind (Service/Repair, Duct Cleaning, System), with or without a job.
// Estimates often come before the job: start from the customer (we remember customers by
// name, not addresses), pick or add the property, and optionally connect an existing job.
// A jobless estimate becomes a job automatically when it's approved.
// `type` locks the kind (the New System Estimate entry point); `mobile` = field app.
const TYPES = [['service', 'Service / Repair'], ['duct', 'Duct Cleaning'], ['system', 'New System']]
const OPEN_JOB = ['scheduled', 'unscheduled', 'in_progress', 'on_my_way', 'incomplete']

export default function NewSystemEstimate({ profile, type, mobile }) {
  const [estType, setEstType] = useState(type || 'service')
  const [tripCharges, setTripCharges] = useState([])
  const [tripId, setTripId] = useState('')
  const [jobs, setJobs] = useState([])
  const [jobId, setJobId] = useState('')
  const navigate = useNavigate()
  const isSuperAdmin = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [mode, setMode] = useState('existing') // 'existing' | 'new'

  const [existingCustomerId, setExistingCustomerId] = useState('')
  const [customerProperties, setCustomerProperties] = useState([])
  const [propertyId, setPropertyId] = useState('')
  const [addNewProperty, setAddNewProperty] = useState(false)

  const [custName, setCustName] = useState('')
  const [custPhone, setCustPhone] = useState('')
  const [custEmail, setCustEmail] = useState('')
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [stateAbbr, setStateAbbr] = useState('')
  const [zip, setZip] = useState('')

  const [serviceCalls, setServiceCalls] = useState([])
  const [fromJobId, setFromJobId] = useState('')
  const [creating, setCreating] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        if (!selectedOrg && data && data.length) setSelectedOrg(data[0].id)
      })
    }
  }, [])

  useEffect(() => { setExistingCustomerId('') }, [selectedOrg])

  // Trip charges (they set service/repair prices: location, access, hours).
  useEffect(() => {
    if (!selectedOrg) return
    supabase.from('service_prices').select('id, location, access, hours, price, customer_display, services!inner(name, category, org_id)')
      .eq('services.org_id', selectedOrg).eq('services.category', 'TRIP CHARGES').eq('is_active', true)
      .then(({ data }) => setTripCharges((data || []).sort((a, b) => String(a.customer_display || '').localeCompare(String(b.customer_display || '')))))
  }, [selectedOrg])

  // Open jobs at the property, to connect the estimate to (optional).
  useEffect(() => {
    setJobId('')
    if (!propertyId || addNewProperty || estType === 'system') { setJobs([]); return }
    supabase.from('jobs').select('id, job_number, segment, job_date, job_type, status, service_line')
      .eq('property_id', propertyId).is('deleted_at', null).in('status', OPEN_JOB).order('job_date', { ascending: false }).limit(25)
      .then(({ data }) => setJobs((data || []).filter((j) => (estType === 'duct' ? j.service_line === 'duct_cleaning' : j.service_line !== 'duct_cleaning'))))
  }, [propertyId, addNewProperty, estType])

  useEffect(() => {
    if (!existingCustomerId) { setCustomerProperties([]); setPropertyId(''); setAddNewProperty(false); return }
    supabase
      .from('properties')
      .select('id, street_address, unit, city')
      .eq('customer_id', existingCustomerId)
      .eq('is_active', true)
      .order('street_address')
      .then(({ data }) => {
        setCustomerProperties(data || [])
        setPropertyId(data && data.length === 1 ? data[0].id : '')
        setAddNewProperty((data || []).length === 0)
      })
  }, [existingCustomerId])

  // A tech may have left the call while the office sells the system — offer to tie the
  // estimate to that service call (pre-picked when one is in progress or dated today).
  useEffect(() => {
    if (!propertyId || addNewProperty) { setServiceCalls([]); setFromJobId(''); return }
    loadServiceCallsForProperty(propertyId, existingCustomerId).then((jobs) => { setServiceCalls(jobs); setFromJobId(pickLikelyServiceCall(jobs)) })
  }, [propertyId, addNewProperty, existingCustomerId])

  async function createEstimate() {
    if (creating) return
    setErr('')
    let propId, custId

    if (mode === 'existing') {
      if (!existingCustomerId) { setErr('Pick a customer, or switch to New customer.'); return }
      custId = existingCustomerId
      const addingProp = addNewProperty || customerProperties.length === 0
      if (!addingProp) {
        if (!propertyId) { setErr('Select a property, or add a new one.'); return }
        propId = propertyId
      } else if (!street.trim()) {
        setErr('Enter the service address for this customer.'); return
      }
    } else if (!custName.trim() || !street.trim()) {
      setErr('Customer name and service address are required.'); return
    }

    if (estType === 'service' && !(jobId && !addNewProperty) && !tripId) { setErr('Pick the trip charge — service prices depend on it.'); return }
    setCreating(true)
    if (mode === 'new') {
      const { data: cust, error } = await supabase.from('customers').insert({
        org_id: selectedOrg,
        display_name: custName.trim(),
        primary_phone: custPhone.trim() || null,
        email_1: custEmail.trim() || null,
      }).select('id').single()
      if (error) { setErr(error.message); setCreating(false); return }
      custId = cust.id
    }

    if (!propId) {
      const { data: prop, error } = await supabase.from('properties').insert({
        org_id: selectedOrg,
        customer_id: custId,
        street_address: street.trim(),
        city: city.trim() || null,
        state: stateAbbr.trim() || null,
        zip: zip.trim() || null,
      }).select('id').single()
      if (error) { setErr(error.message); setCreating(false); return }
      propId = prop.id
    }

    const { count } = await supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('org_id', selectedOrg).eq('kind', 'estimate')
    const num = 'EST-' + String((count || 0) + 1).padStart(4, '0')

    if (estType !== 'system') {
      const linkJob = (!addNewProperty && propId === propertyId && jobId) ? jobs.find((j) => j.id === jobId) : null
      if (linkJob) {
        const { data: has } = await supabase.from('invoices').select('invoice_number').eq('job_id', linkJob.id).eq('kind', 'estimate').neq('estimate_type', 'system').is('deleted_at', null).limit(1).maybeSingle()
        if (has) { setErr(`Job ${linkJob.job_number} already has estimate ${has.invoice_number} — open it from the job instead.`); setCreating(false); return }
      }
      const { data: est, error: eErr } = await supabase.from('invoices').insert({
        org_id: selectedOrg, invoice_number: num, kind: 'estimate', estimate_type: 'service', approval_status: 'Pending',
        job_id: linkJob ? linkJob.id : null, property_id: propId, bills_to_customer_id: custId,
        invoice_date: new Date().toISOString().slice(0, 10), discount_type: 'dollar',
        ...(estType === 'duct' ? { service_line: 'duct_cleaning' } : { trip_charge_price_id: linkJob ? null : tripId }),
      }).select('id').single()
      if (eErr) { setErr(eErr.message); setCreating(false); return }
      // Service estimates start with the trip charge line (the job's, or the one picked here).
      if (estType === 'service') {
        let tcId = tripId
        if (linkJob) { const { data: jj } = await supabase.from('jobs').select('trip_charge_price_id').eq('id', linkJob.id).maybeSingle(); tcId = jj?.trip_charge_price_id }
        if (tcId) {
          const { data: tc } = await supabase.from('service_prices').select('price, customer_display, services(is_tax_exempt)').eq('id', tcId).maybeSingle()
          if (tc) await supabase.from('invoice_line_items').insert({ invoice_id: est.id, org_id: selectedOrg, description: tc.customer_display, unit_price: tc.price, quantity: 1, taxable: !tc.services?.is_tax_exempt, is_custom: false, sort_order: 1, category: 'TRIP CHARGES' })
        }
      }
      navigate(`${mobile ? '/tech' : ''}/estimate-doc/${est.id}`)
      return
    }

    const { data: created, error } = await supabase.from('invoices').insert({
      org_id: selectedOrg,
      invoice_number: num,
      kind: 'estimate',
      estimate_type: 'system',
      job_id: null,
      reference_job_id: (!addNewProperty && propId === propertyId && fromJobId) ? fromJobId : null,
      property_id: propId,
      bills_to_customer_id: custId,
      invoice_date: new Date().toISOString().slice(0, 10),
      discount_type: 'dollar',
    }).select('id').single()
    if (error) { setErr(error.message); setCreating(false); return }
    navigate(`${mobile ? '/tech' : ''}/system-estimate-p/${created.id}`)
  }

  const fieldLabel = { display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 4 }
  const input = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line, #D5DAE1)', fontSize: 14, boxSizing: 'border-box' }

  const propertyFields = (
    <>
      <div>
        <label style={fieldLabel}>Service address *</label>
        <input style={input} value={street} onChange={(e) => setStreet(e.target.value)} placeholder="123 Main St" />
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 2 }}><label style={fieldLabel}>City</label><input style={input} value={city} onChange={(e) => setCity(e.target.value)} /></div>
        <div style={{ flex: 1 }}><label style={fieldLabel}>State</label><input style={input} value={stateAbbr} onChange={(e) => setStateAbbr(e.target.value)} /></div>
        <div style={{ flex: 1 }}><label style={fieldLabel}>ZIP</label><input style={input} value={zip} onChange={(e) => setZip(e.target.value)} /></div>
      </div>
    </>
  )

  return (
    <div>
      <h2 className="page-title">{type === 'system' ? 'New System Estimate' : 'New Estimate'}</h2>
      {!type && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {TYPES.map(([k, l]) => <button key={k} className={estType === k ? 'auth-button' : 'logout-button'} style={{ width: 'auto', padding: '6px 16px', margin: 0 }} onClick={() => setEstType(k)}>{l}</button>)}
        </div>
      )}
      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: type ? -8 : 0, marginBottom: 20, maxWidth: 620 }}>
        {estType === 'system'
          ? <>For a new-system sale — a referral, a purchased lead, or a cold quote. Start with the customer; it&rsquo;s tied to their property, with no service call and no job. When they accept, it becomes a job to schedule.</>
          : <>Start with the customer. Connecting a job is optional — an estimate written before any job becomes a {estType === 'duct' ? 'duct cleaning (DC-)' : 'repair'} job automatically when it&rsquo;s approved.</>}
      </p>

      {isSuperAdmin && (
        <div style={{ marginBottom: 16, maxWidth: 520 }}>
          <label style={fieldLabel}>Organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className={mode === 'existing' ? 'auth-button' : 'logout-button'} style={{ width: 'auto', padding: '6px 16px' }} onClick={() => setMode('existing')}>Existing customer</button>
        <button className={mode === 'new' ? 'auth-button' : 'logout-button'} style={{ width: 'auto', padding: '6px 16px' }} onClick={() => setMode('new')}>New customer</button>
      </div>

      {mode === 'existing' ? (
        <div style={{ maxWidth: 520, display: 'grid', gap: 14 }}>
          <div>
            <label style={fieldLabel}>Customer</label>
            <CustomerSearchSelect orgId={selectedOrg} value={existingCustomerId} onChange={(id) => setExistingCustomerId(id)} />
          </div>

          {existingCustomerId && customerProperties.length > 0 && (
            <div>
              <label style={fieldLabel}>Property</label>
              <select
                style={input}
                value={addNewProperty ? '__new__' : propertyId}
                onChange={(e) => {
                  if (e.target.value === '__new__') { setAddNewProperty(true); setPropertyId('') }
                  else { setAddNewProperty(false); setPropertyId(e.target.value) }
                }}
              >
                <option value="">Select…</option>
                {customerProperties.map((p) => (
                  <option key={p.id} value={p.id}>{p.street_address}{p.unit ? ` #${p.unit}` : ''}{p.city ? `, ${p.city}` : ''}</option>
                ))}
                <option value="__new__">+ Add a new property…</option>
              </select>
            </div>
          )}

          {propertyId && !addNewProperty && estType !== 'system' && (
            <div>
              <label style={fieldLabel}>Connect to a job (optional)</label>
              <select style={input} value={jobId} onChange={(e) => setJobId(e.target.value)}>
                <option value="">No job — create one when it's approved</option>
                {jobs.map((j) => <option key={j.id} value={j.id}>Job {j.job_number}{j.segment > 1 ? `-${j.segment}` : ''} · {j.job_type || 'Service'} · {j.job_date || 'no date'} · {j.status}</option>)}
              </select>
              {!jobs.length && <p style={{ fontSize: 12, color: 'var(--mist)', margin: '4px 0 0' }}>No open {estType === 'duct' ? 'duct cleaning ' : ''}jobs at this property.</p>}
            </div>
          )}

          {propertyId && !addNewProperty && estType === 'system' && (
            <div>
              <label style={fieldLabel}>From service call</label>
              <select style={input} value={fromJobId} onChange={(e) => setFromJobId(e.target.value)}>
                <option value="">None — becomes a new job only</option>
                {serviceCalls.map((j) => <option key={j.id} value={j.id}>{serviceCallLabel(j)}</option>)}
              </select>
              <p style={{ fontSize: 12, color: 'var(--mist)', margin: '4px 0 0' }}>
                If a tech was just out on a call here, pick it — when the system is approved, that call is set to $0.
              </p>
            </div>
          )}

          {existingCustomerId && (addNewProperty || customerProperties.length === 0) && (
            <div style={{ display: 'grid', gap: 12 }}>
              {customerProperties.length === 0 && (
                <p style={{ fontSize: 12.5, color: 'var(--mist)', margin: 0 }}>No properties on file for this customer — add the service address:</p>
              )}
              {propertyFields}
            </div>
          )}
        </div>
      ) : (
        <div style={{ maxWidth: 520, display: 'grid', gap: 12 }}>
          <div>
            <label style={fieldLabel}>Customer name *</label>
            <input style={input} value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="e.g. Jane Smith" />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}><label style={fieldLabel}>Phone</label><input style={input} value={custPhone} onChange={(e) => setCustPhone(e.target.value)} /></div>
            <div style={{ flex: 1 }}><label style={fieldLabel}>Email</label><input style={input} value={custEmail} onChange={(e) => setCustEmail(e.target.value)} /></div>
          </div>
          {propertyFields}
        </div>
      )}

      {estType === 'service' && !jobId && (
        <div style={{ maxWidth: 520, marginTop: 14 }}>
          <label style={fieldLabel}>Trip charge (sets the prices) *</label>
          <select style={input} value={tripId} onChange={(e) => setTripId(e.target.value)}>
            <option value="">Select…</option>
            {tripCharges.map((t) => <option key={t.id} value={t.id}>{t.customer_display || t.services?.name} — {[t.location, t.access, t.hours].filter(Boolean).join(' / ')}{t.price != null ? ` · $${Number(t.price).toFixed(2)}` : ''}</option>)}
          </select>
        </div>
      )}

      {err && <div className="auth-error" style={{ marginTop: 12, maxWidth: 520 }}>{err}</div>}

      <button className="auth-button" style={{ width: 'auto', padding: '9px 22px', marginTop: 18 }} onClick={createEstimate} disabled={creating}>
        {creating ? 'Creating…' : 'Create & Start Estimate'}
      </button>
    </div>
  )
}
