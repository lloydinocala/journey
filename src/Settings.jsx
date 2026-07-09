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
