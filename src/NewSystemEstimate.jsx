import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import PropertySearchSelect from './PropertySearchSelect'

// New-system SALE estimate. Unlike a service estimate, this is not born from a job/service
// call — a new system can be sold to a referral, a purchased lead, or a cold quote. So it's
// tied only to a customer + property. No job, and (deliberately) no service-call fee.
export default function NewSystemEstimate({ profile }) {
  const navigate = useNavigate()
  const isSuperAdmin = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [mode, setMode] = useState('existing') // 'existing' | 'new'
  const [picked, setPicked] = useState(null)

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

  async function createEstimate() {
    if (creating) return
    setErr('')
    let propertyId, customerId
    if (mode === 'existing') {
      if (!picked) { setErr('Pick a property, or switch to New customer.'); return }
      propertyId = picked.id
      customerId = picked.customer_id
    } else if (!custName.trim() || !street.trim()) {
      setErr('Customer name and service address are required.')
      return
    }

    setCreating(true)
    if (mode === 'new') {
      const { data: cust, error: cErr } = await supabase.from('customers').insert({
        org_id: selectedOrg,
        display_name: custName.trim(),
        primary_phone: custPhone.trim() || null,
        email_1: custEmail.trim() || null,
      }).select('id').single()
      if (cErr) { setErr(cErr.message); setCreating(false); return }
      const { data: prop, error: pErr } = await supabase.from('properties').insert({
        org_id: selectedOrg,
        customer_id: cust.id,
        street_address: street.trim(),
        city: city.trim() || null,
        state: stateAbbr.trim() || null,
        zip: zip.trim() || null,
      }).select('id').single()
      if (pErr) { setErr(pErr.message); setCreating(false); return }
      propertyId = prop.id
      customerId = cust.id
    }

    const { count } = await supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('org_id', selectedOrg).eq('kind', 'estimate')
    const num = 'EST-' + String((count || 0) + 1).padStart(4, '0')
    const { data: created, error } = await supabase.from('invoices').insert({
      org_id: selectedOrg,
      invoice_number: num,
      kind: 'estimate',
      estimate_type: 'system',
      job_id: null,
      property_id: propertyId,
      bills_to_customer_id: customerId,
      invoice_date: new Date().toISOString().slice(0, 10),
      discount_type: 'dollar',
    }).select('id').single()
    if (error) { setErr(error.message); setCreating(false); return }
    navigate(`/system-estimate-p/${created.id}`)
  }

  const fieldLabel = { display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 4 }
  const input = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line, #D5DAE1)', fontSize: 14, boxSizing: 'border-box' }

  return (
    <div>
      <h2 className="page-title">New System Estimate</h2>
      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: -8, marginBottom: 20, maxWidth: 620 }}>
        For a new-system sale — a referral, a purchased lead, or a cold quote. Tied to a customer and property only, with no service call and no job. When the customer accepts, it becomes a job to schedule.
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
        <div style={{ maxWidth: 520 }}>
          {picked ? (
            <div style={{ padding: '12px 16px', borderRadius: 8, border: '1px solid var(--line, #E2E6ED)', background: 'var(--panel)' }}>
              <div style={{ fontWeight: 600 }}>{picked.customers?.display_name || 'Unknown customer'}</div>
              <div style={{ fontSize: 13, color: 'var(--mist)' }}>{picked.street_address}{picked.city ? `, ${picked.city}` : ''}</div>
              <button className="logout-button" style={{ width: 'auto', padding: '4px 12px', marginTop: 8 }} onClick={() => setPicked(null)}>Change</button>
            </div>
          ) : (
            <PropertySearchSelect orgId={selectedOrg} onPick={(p) => setPicked(p)} placeholder="Search service address…" />
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
          <div>
            <label style={fieldLabel}>Service address *</label>
            <input style={input} value={street} onChange={(e) => setStreet(e.target.value)} placeholder="123 Main St" />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 2 }}><label style={fieldLabel}>City</label><input style={input} value={city} onChange={(e) => setCity(e.target.value)} /></div>
            <div style={{ flex: 1 }}><label style={fieldLabel}>State</label><input style={input} value={stateAbbr} onChange={(e) => setStateAbbr(e.target.value)} /></div>
            <div style={{ flex: 1 }}><label style={fieldLabel}>ZIP</label><input style={input} value={zip} onChange={(e) => setZip(e.target.value)} /></div>
          </div>
        </div>
      )}

      {err && <div className="auth-error" style={{ marginTop: 12, maxWidth: 520 }}>{err}</div>}

      <button className="auth-button" style={{ width: 'auto', padding: '9px 22px', marginTop: 18 }} onClick={createEstimate} disabled={creating}>
        {creating ? 'Creating…' : 'Create & Start Estimate'}
      </button>
    </div>
  )
}
