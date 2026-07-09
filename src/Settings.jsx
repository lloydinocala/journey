import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import PricebookImport from './PricebookImport'

export default function Settings({ profile }) {
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [jobTypes, setJobTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [newType, setNewType] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')

  const [businessStart, setBusinessStart] = useState('08:00')
  const [businessEnd, setBusinessEnd] = useState('19:00')
  const [savingHours, setSavingHours] = useState(false)
  const [hoursSaved, setHoursSaved] = useState(false)

  const [taxableByDefault, setTaxableByDefault] = useState(false)
  const [salesTaxRate, setSalesTaxRate] = useState('0')
  const [savingTax, setSavingTax] = useState(false)
  const [taxSaved, setTaxSaved] = useState(false)

 const [logoUrl, setLogoUrl] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoError, setLogoError] = useState('')
  const [brandPrimary, setBrandPrimary] = useState('#2F5DE3')
  const [brandAccent, setBrandAccent] = useState('#B8720A')
  const [savingBrand, setSavingBrand] = useState(false)
  const [brandSaved, setBrandSaved] = useState(false)

  const [bizStreet, setBizStreet] = useState('')
  const [bizCity, setBizCity] = useState('')
  const [bizState, setBizState] = useState('')
  const [bizZip, setBizZip] = useState('')
  const [bizPhone, setBizPhone] = useState('')
  const [bizEmail, setBizEmail] = useState('')
  const [bizWebsite, setBizWebsite] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [paymentTermsDays, setPaymentTermsDays] = useState('0')
  const [savingBiz, setSavingBiz] = useState(false)
  const [bizSaved, setBizSaved] = useState(false)

  const isSuperAdmin = profile.role === 'super_admin'

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        if (!selectedOrg && data && data.length > 0) setSelectedOrg(data[0].id)
      })
    }
  }, [])

  async function loadJobTypes(orgId) {
    if (!orgId) return
    setLoading(true)
    const { data } = await supabase
      .from('job_types')
      .select('id, name, sort_order, is_active')
      .eq('org_id', orgId)
      .order('sort_order')
    setJobTypes(data || [])
    setLoading(false)
  }

  async function loadBusinessHours(orgId) {
    if (!orgId) return
    const { data } = await supabase
      .from('organizations')
      .select('business_hours_start, business_hours_end, services_taxable_by_default, sales_tax_rate, business_street, business_city, business_state, business_zip, business_phone, business_email, business_website, license_number, payment_terms_days, logo_url')
      .eq('id', orgId)
      .single()
    if (data) {
      setBusinessStart(data.business_hours_start.slice(0, 5))
      setBusinessEnd(data.business_hours_end.slice(0, 5))
      setTaxableByDefault(data.services_taxable_by_default)
      setSalesTaxRate(String(data.sales_tax_rate))
      setBizStreet(data.business_street || '')
      setBizCity(data.business_city || '')
      setBizState(data.business_state || '')
      setBizZip(data.business_zip || '')
      setBizPhone(data.business_phone || '')
      setBizEmail(data.business_email || '')
      setBizWebsite(data.business_website || '')
      setLicenseNumber(data.license_number || '')
      setPaymentTermsDays(String(data.payment_terms_days))
      setLogoUrl(data.logo_url || '')
    }
  }
  async function handleLogoUpload(e) {
    const file = e.target.files[0]
    if (!file || !selectedOrg) return
    setLogoError('')
    setUploadingLogo(true)

    const ext = file.name.split('.').pop()
    const path = selectedOrg + '/logo.' + ext

    const uploadResult = await supabase.storage.from('org-logos').upload(path, file, { upsert: true })
    if (uploadResult.error) {
      setLogoError(uploadResult.error.message)
      setUploadingLogo(false)
      return
    }

    const publicUrlResult = supabase.storage.from('org-logos').getPublicUrl(path)
    const newUrl = publicUrlResult.data.publicUrl + '?t=' + Date.now()

    await supabase.from('organizations').update({ logo_url: newUrl }).eq('id', selectedOrg)
    setLogoUrl(newUrl)
    setUploadingLogo(false)
    e.target.value = ''
  }

  async function saveBusinessInfo(e) {
    e.preventDefault()
    setSavingBiz(true)
    setBizSaved(false)
    await supabase
      .from('organizations')
      .update({
        business_street: bizStreet.trim() || null,
        business_city: bizCity.trim() || null,
        business_state: bizState.trim() || null,
        business_zip: bizZip.trim() || null,
        business_phone: bizPhone.trim() || null,
        business_email: bizEmail.trim() || null,
        business_website: bizWebsite.trim() || null,
        license_number: licenseNumber.trim() || null,
        payment_terms_days: parseInt(paymentTermsDays) || 0,
      })
      .eq('id', selectedOrg)
    setSavingBiz(false)
    setBizSaved(true)
  }

  async function saveTaxSettings(e) {
    e.preventDefault()
    setSavingTax(true)
    setTaxSaved(false)
    await supabase
      .from('organizations')
      .update({ services_taxable_by_default: taxableByDefault, sales_tax_rate: parseFloat(salesTaxRate) || 0 })
      .eq('id', selectedOrg)
    setSavingTax(false)
    setTaxSaved(true)
  }

  useEffect(() => {
    loadJobTypes(selectedOrg)
    loadBusinessHours(selectedOrg)
  }, [selectedOrg])

  async function saveBusinessHours(e) {
    e.preventDefault()
    setSavingHours(true)
    setHoursSaved(false)
    await supabase
      .from('organizations')
      .update({ business_hours_start: businessStart, business_hours_end: businessEnd })
      .eq('id', selectedOrg)
    setSavingHours(false)
    setHoursSaved(true)
  }
  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    if (!newType.trim()) return

    setSaving(true)
    const nextSort = jobTypes.length > 0 ? Math.max(...jobTypes.map((t) => t.sort_order)) + 1 : 1
    const { error } = await supabase.from('job_types').insert({
      org_id: selectedOrg,
      name: newType.trim(),
      sort_order: nextSort,
    })
    setSaving(false)

    if (error) {
      setError(error.message)
    } else {
      setNewType('')
      loadJobTypes(selectedOrg)
    }
  }

  async function toggleActive(id, current) {
    await supabase.from('job_types').update({ is_active: !current }).eq('id', id)
    loadJobTypes(selectedOrg)
  }

  function startEdit(t) {
    setEditingId(t.id)
    setEditName(t.name)
  }

  async function saveEdit(id) {
    if (!editName.trim()) return
    await supabase.from('job_types').update({ name: editName.trim() }).eq('id', id)
    setEditingId(null)
    loadJobTypes(selectedOrg)
  }

  return (
    <div>
      <h2 className="page-title">Settings</h2>

      {isSuperAdmin && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      <PricebookImport orgId={selectedOrg} />
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Logo</h3>
      <p style={{ color: 'var(--mist)', fontSize: 14, marginTop: -6, marginBottom: 16 }}>
        Shown on your invoices. PNG or JPG works best.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        {logoUrl && (
          <img src={logoUrl} alt="Logo" style={{ height: 60, background: 'white', padding: 8, borderRadius: 8, border: '1px solid var(--border)' }} />
        )}
        <div>
          <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo || !selectedOrg} />
          {uploadingLogo && <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 4 }}>Uploading…</p>}
          {logoError && <p style={{ color: '#C0392B', fontSize: 13, marginTop: 4 }}>{logoError}</p>}
        </div>
      </div>

      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Business contact info</h3>
      <p style={{ color: 'var(--mist)', fontSize: 14, marginTop: -6, marginBottom: 20 }}>
        This appears on your invoices — separate from your customer's info.
      </p>
      <form className="inline-form" onSubmit={saveBusinessInfo} style={{ marginBottom: 28, flexWrap: 'wrap' }}>
        <div className="field">
          <label htmlFor="bizStreet">Street</label>
          <input id="bizStreet" type="text" value={bizStreet} onChange={(e) => setBizStreet(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="bizCity">City</label>
          <input id="bizCity" type="text" value={bizCity} onChange={(e) => setBizCity(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="bizState">State</label>
          <input id="bizState" type="text" value={bizState} onChange={(e) => setBizState(e.target.value)} style={{ width: 70 }} />
        </div>
        <div className="field">
          <label htmlFor="bizZip">Zip</label>
          <input id="bizZip" type="text" value={bizZip} onChange={(e) => setBizZip(e.target.value)} style={{ width: 90 }} />
        </div>
        <div className="field">
          <label htmlFor="bizPhone">Phone</label>
          <input id="bizPhone" type="tel" value={bizPhone} onChange={(e) => setBizPhone(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="bizEmail">Email</label>
          <input id="bizEmail" type="email" value={bizEmail} onChange={(e) => setBizEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="bizWebsite">Website</label>
          <input id="bizWebsite" type="text" value={bizWebsite} onChange={(e) => setBizWebsite(e.target.value)} placeholder="www.example.com" />
        </div>
        <div className="field">
          <label htmlFor="licenseNumber">License #</label>
          <input id="licenseNumber" type="text" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="paymentTerms">Payment terms (days)</label>
          <input id="paymentTerms" type="number" value={paymentTermsDays} onChange={(e) => setPaymentTermsDays(e.target.value)} style={{ width: 90 }} />
          <span style={{ fontSize: 12, color: 'var(--mist)' }}>0 = due upon receipt</span>
        </div>
        <button className="auth-button" type="submit" disabled={savingBiz}>
          {savingBiz ? 'Saving…' : 'Save'}
        </button>
        {bizSaved && <span style={{ color: '#4CD97B', fontSize: 14 }}>Saved</span>}
      </form>
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Business hours</h3>
      <p style={{ color: 'var(--mist)', fontSize: 14, marginTop: -6, marginBottom: 20 }}>
        Controls how the Calendar displays your day — 15-minute slots during these hours,
        30-minute slots outside them for after-hours calls.
      </p>

      <form className="inline-form" onSubmit={saveBusinessHours} style={{ marginBottom: 28 }}>
        <div className="field">
          <label htmlFor="bStart">Opens</label>
          <input id="bStart" type="time" value={businessStart} onChange={(e) => setBusinessStart(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="bEnd">Closes</label>
          <input id="bEnd" type="time" value={businessEnd} onChange={(e) => setBusinessEnd(e.target.value)} required />
        </div>
        <button className="auth-button" type="submit" disabled={savingHours}>
          {savingHours ? 'Saving…' : 'Save hours'}
        </button>
        {hoursSaved && <span style={{ color: '#4CD97B', fontSize: 14 }}>Saved</span>}
      </form>

      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Sales tax</h3>
      <p style={{ color: 'var(--mist)', fontSize: 14, marginTop: -6, marginBottom: 20 }}>
        In Florida, flat-rate labor typically isn't taxed again (tax was already paid on parts at
        wholesale) — only retail items like filters are. Other states may work the other way; set
        what fits here.
      </p>
      <form className="inline-form" onSubmit={saveTaxSettings} style={{ marginBottom: 28 }}>
        <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 0 }}>
          <label style={{ marginBottom: 0, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={taxableByDefault}
              onChange={(e) => setTaxableByDefault(e.target.checked)}
              style={{ marginRight: 6 }}
            />
            New pricebook items are taxable by default
          </label>
        </div>
        <div className="field">
          <label htmlFor="taxRate">Sales tax rate (%)</label>
          <input id="taxRate" type="number" step="0.001" value={salesTaxRate} onChange={(e) => setSalesTaxRate(e.target.value)} style={{ width: 100 }} />
        </div>
        <button className="auth-button" type="submit" disabled={savingTax}>
          {savingTax ? 'Saving…' : 'Save'}
        </button>
        {taxSaved && <span style={{ color: '#4CD97B', fontSize: 14 }}>Saved</span>}
      </form>
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Job types</h3>
      <p style={{ color: 'var(--mist)', fontSize: 14, marginTop: -6, marginBottom: 20 }}>
        These show up in the Type dropdown when creating a job. Turn one off instead of
        deleting it if past jobs still reference it.
      </p>

      <form className="inline-form" onSubmit={handleAdd} style={{ marginBottom: 28 }}>
        <div className="field">
          <label htmlFor="newType">Add a job type</label>
          <input
            id="newType"
            type="text"
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            placeholder="e.g. New Construction"
            required
          />
        </div>
        <button className="auth-button" type="submit" disabled={saving}>
          {saving ? 'Adding…' : 'Add'}
        </button>
      </form>

      {error && <div className="auth-error">{error}</div>}

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : (
        <div className="grid-table" style={{ gridTemplateColumns: '1.5fr 1fr 1.5fr' }}>
          <div className="grid-cell grid-head">Name</div>
          <div className="grid-cell grid-head">Status</div>
          <div className="grid-cell grid-head"></div>

          {jobTypes.map((t) =>
            editingId === t.id ? (
              <>
                <div className="grid-cell">
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div className="grid-cell">
                  <span className={`status-pill ${t.is_active ? 'status-active' : 'status-canceled'}`}>
                    {t.is_active ? 'Active' : 'Off'}
                  </span>
                </div>
                <div className="grid-cell grid-actions">
                  <button className="auth-button" style={{ width: 'auto', padding: '6px 14px', margin: 0 }} onClick={() => saveEdit(t.id)}>Save</button>
                  <button className="logout-button" onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <div className="grid-cell">{t.name}</div>
                <div className="grid-cell">
                  <span className={`status-pill ${t.is_active ? 'status-active' : 'status-canceled'}`}>
                    {t.is_active ? 'Active' : 'Off'}
                  </span>
                </div>
                <div className="grid-cell grid-actions">
                  <button className="logout-button" onClick={() => startEdit(t)}>Rename</button>
                  <button className="logout-button" onClick={() => toggleActive(t.id, t.is_active)}>
                    {t.is_active ? 'Turn off' : 'Turn on'}
                  </button>
                </div>
              </>
            )
          )}
        </div>
      )}
    </div>
  )
}
