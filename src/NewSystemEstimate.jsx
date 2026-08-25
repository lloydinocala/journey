import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import CustomerSearchSelect from './CustomerSearchSelect'

// New-system SALE estimate. Property-based (no job, no service call), but you START from the
// customer — we remember customers by name, not addresses. Existing customer -> pick them, then
// choose one of their properties (or add a new one). New customer -> create both on the spot.
export default function NewSystemEstimate({ profile }) {
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
    const { data: created, error } = await supabase.from('invoices').insert({
      org_id: selectedOrg,
      invoice_number: num,
      kind: 'estimate',
      estimate_type: 'system',
      job_id: null,
      property_id: propId,
      bills_to_customer_id: custId,
      invoice_date: new Date().toISOString().slice(0, 10),
      discount_type: 'dollar',
    }).select('id').single()
    if (error) { setErr(error.message); setCreating(false); return }
    navigate(`/system-estimate-p/${created.id}`)
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
      <h2 className="page-title">New System Estimate</h2>
      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: -8, marginBottom: 20, maxWidth: 620 }}>
        For a new-system sale — a referral, a purchased lead, or a cold quote. Start with the customer; it&rsquo;s tied to their property, with no service call and no job. When they accept, it becomes a job to schedule.
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

      {err && <div className="auth-error" style={{ marginTop: 12, maxWidth: 520 }}>{err}</div>}

      <button className="auth-button" style={{ width: 'auto', padding: '9px 22px', marginTop: 18 }} onClick={createEstimate} disabled={creating}>
        {creating ? 'Creating…' : 'Create & Start Estimate'}
      </button>
    </div>
  )
}
