import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import {
  IconChevronLeft, IconPhone, IconMessage, IconPin, IconNavigation, IconCamera,
  IconReceipt, IconShield, IconFile, IconCalculator, IconLock,
} from './MobileIcons'

const STATUS_LABEL = {
  scheduled: 'Scheduled',
  on_my_way: 'On My Way',
  in_progress: 'In Progress',
  incomplete: 'Incomplete',
  completed: 'Completed',
  canceled: 'Canceled',
}

const INCOMPLETE_REASONS = [
  'Estimate provided — customer approved follow-up work',
  'Awaiting parts or materials',
  'Needs estimate — information still pending',
  'Weather or site conditions prevented completion',
  'Customer-authorized part not on truck',
  'Emergency or scheduling interruption',
  'Other',
]

const RELATIONSHIP_OPTIONS = [
  { value: 'homeowner', label: 'HomeOwner' },
  { value: 'tenant', label: 'Tenant' },
  { value: 'property_manager', label: 'Property Mgr' },
]
const RELATIONSHIP_LABEL = Object.fromEntries(RELATIONSHIP_OPTIONS.map((o) => [o.value, o.label]))

function formatPhone(raw) {
  if (!raw) return raw
  const d = ('' + raw).replace(/\D/g, '')
  if (d.length === 10) return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6)
  if (d.length === 11 && d[0] === '1') return d.slice(1, 4) + '-' + d.slice(4, 7) + '-' + d.slice(7)
  return raw
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

function addressString(property) {
  if (!property?.street_address) return null
  return `${property.street_address}${property.unit ? ' #' + property.unit : ''}, ${property.city || ''} ${property.state || ''} ${property.zip || ''}`
}

function mapsUrl(property) {
  const addr = addressString(property)
  if (!addr) return null
  const q = encodeURIComponent(addr)
  return isIOS() ? `https://maps.apple.com/?q=${q}` : `geo:0,0?q=${q}`
}

// Default hands off to whatever the phone treats as its GPS app (Apple Maps on iOS,
// or the Android chooser). The other two are explicit alternatives.
function mapProviderOptions(property) {
  const addr = addressString(property)
  if (!addr) return []
  const q = encodeURIComponent(addr)
  return [
    { label: isIOS() ? 'Default Maps App' : 'Default Maps App (Android chooser)', url: mapsUrl(property) },
    { label: 'Google Maps', url: `https://www.google.com/maps/search/?api=1&query=${q}` },
    { label: 'Waze', url: `https://waze.com/ul?q=${q}&navigate=yes` },
  ]
}

function streetViewUrl(property) {
  const addr = addressString(property)
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (!addr || !key) return null
  const q = encodeURIComponent(addr)
  return `https://maps.googleapis.com/maps/api/streetview?size=640x300&location=${q}&fov=80&pitch=0&key=${key}`
}

function fmtDateTime(startTime) {
  if (!startTime) return { date: '', time: '' }
  const d = new Date(startTime)
  if (isNaN(d)) return { date: '', time: '' }
  return {
    date: d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
  }
}

// A system counts as "fully filled" once it has a label and real nameplate data
// (a serial on at least one of the three units). Anything short of that flags red.
function isSystemFilled(eq) {
  if (!eq) return false
  const hasSerial = !!(eq.outdoor_serial || eq.indoor_serial || eq.furnace_serial)
  const hasModel = !!(eq.outdoor_model || eq.indoor_model || eq.furnace_model)
  return hasSerial && hasModel
}

export default function TechJobCard({ profile }) {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const ocrInputRef = useRef(null)

  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [photos, setPhotos] = useState([])
  const [photoUrls, setPhotoUrls] = useState({})
  const [uploading, setUploading] = useState(false)
  const [notes, setNotes] = useState('')
  const [notesSaved, setNotesSaved] = useState(true)
  const [uid, setUid] = useState(null)

  const [invoice, setInvoice] = useState(null)

  const [mapsMenuOpen, setMapsMenuOpen] = useState(false)
  const [dark, setDark] = useState(false)

  // Collapsible sections (mockup: collapse Photo + Invoice Builder until needed)
  const [photoOpen, setPhotoOpen] = useState(false)
  const [invoiceOpen, setInvoiceOpen] = useState(false)

  // Ephemeral display banners — mockup: "Does not permanently record anywhere."
  const [showDisplayOptions, setShowDisplayOptions] = useState(false)
  const [customMsg, setCustomMsg] = useState('')
  const [customMsgActive, setCustomMsgActive] = useState(false)
  const [diagnoseBanner, setDiagnoseBanner] = useState(false)
  const [repairLimit, setRepairLimit] = useState('')
  const [repairLimitActive, setRepairLimitActive] = useState(false)

  // Occupant / tenant
  const [tenants, setTenants] = useState([])
  const [showCustEdit, setShowCustEdit] = useState(false)
  const [custForm, setCustForm] = useState({ name: '', relationship: '', phone: '', cust_primary: '', cust_secondary: '' })
  const [savingCust, setSavingCust] = useState(false)

  // Equipment
  const [equipment, setEquipment] = useState([])
  const [expectedSystems, setExpectedSystems] = useState('')
  const [showEquipForm, setShowEquipForm] = useState(false)
  const [equipEditingId, setEquipEditingId] = useState(null)
  const blankEquipForm = {
    system_label: '', outdoor_brand: '', outdoor_model: '', outdoor_serial: '',
    indoor_brand: '', indoor_model: '', indoor_serial: '',
    furnace_brand: '', furnace_model: '', furnace_serial: '',
    install_date: '', notes: '',
  }
  const [equipForm, setEquipForm] = useState(blankEquipForm)
  const [savingEquip, setSavingEquip] = useState(false)
  const [ocrNotice, setOcrNotice] = useState('')

  const [sendingPlans, setSendingPlans] = useState(false)
  const [plansError, setPlansError] = useState('')
  const [plansSentTo, setPlansSentTo] = useState(null)
  const [copyPlansLabel, setCopyPlansLabel] = useState('Copy Link')

  const [showIncompleteModal, setShowIncompleteModal] = useState(false)
  const [incompleteReason, setIncompleteReason] = useState('')
  const [savingIncomplete, setSavingIncomplete] = useState(false)
  const [incompleteError, setIncompleteError] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data?.user?.id || null))
  }, [])

  useEffect(() => {
    loadJob()
    loadPhotos()
    loadInvoice()
  }, [jobId])

  useEffect(() => {
    if (job?.property_id) {
      loadEquipment(job.property_id)
      loadTenants(job.property_id)
    }
    if (job?.properties?.expected_system_count != null) {
      setExpectedSystems(String(job.properties.expected_system_count))
    }
  }, [job?.property_id])

  useEffect(() => {
    if (photos.length > 0) setPhotoOpen(true)
  }, [photos.length])

  async function loadTenants(propertyId) {
    const { data } = await supabase
      .from('property_tenants')
      .select('id, name, phone, relationship')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: true })
    setTenants(data || [])
  }

  async function loadEquipment(propertyId) {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    await supabase
      .from('property_equipment')
      .delete()
      .eq('property_id', propertyId)
      .eq('status', 'retired')
      .lt('retired_at', ninetyDaysAgo)

    const { data } = await supabase
      .from('property_equipment')
      .select('*')
      .eq('property_id', propertyId)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
    setEquipment(data || [])
  }

  function startEquipEdit(eq) {
    setEquipEditingId(eq.id)
    setEquipForm({
      system_label: eq.system_label || '',
      outdoor_brand: eq.outdoor_brand || '', outdoor_model: eq.outdoor_model || '', outdoor_serial: eq.outdoor_serial || '',
      indoor_brand: eq.indoor_brand || '', indoor_model: eq.indoor_model || '', indoor_serial: eq.indoor_serial || '',
      furnace_brand: eq.furnace_brand || '', furnace_model: eq.furnace_model || '', furnace_serial: eq.furnace_serial || '',
      install_date: eq.install_date || '', notes: eq.notes || '',
    })
    setOcrNotice('')
    setShowEquipForm(true)
  }

  async function saveEquipment() {
    if (!job?.property_id) return
    setSavingEquip(true)
    const payload = {
      system_label: equipForm.system_label.trim() || null,
      outdoor_brand: equipForm.outdoor_brand.trim() || null,
      outdoor_model: equipForm.outdoor_model.trim() || null,
      outdoor_serial: equipForm.outdoor_serial.trim() || null,
      indoor_brand: equipForm.indoor_brand.trim() || null,
      indoor_model: equipForm.indoor_model.trim() || null,
      indoor_serial: equipForm.indoor_serial.trim() || null,
      furnace_brand: equipForm.furnace_brand.trim() || null,
      furnace_model: equipForm.furnace_model.trim() || null,
      furnace_serial: equipForm.furnace_serial.trim() || null,
      install_date: equipForm.install_date || null,
      notes: equipForm.notes.trim() || null,
    }
    if (equipEditingId) {
      await supabase.from('property_equipment').update(payload).eq('id', equipEditingId)
    } else {
      await supabase.from('property_equipment').insert({ ...payload, org_id: job.org_id, property_id: job.property_id, status: 'active' })
    }
    setSavingEquip(false)
    setEquipEditingId(null)
    setEquipForm(blankEquipForm)
    setShowEquipForm(false)
    setOcrNotice('')
    loadEquipment(job.property_id)
  }

  async function deleteEquipment(id) {
    if (!window.confirm('Remove this equipment record?')) return
    await supabase.from('property_equipment').delete().eq('id', id)
    loadEquipment(job.property_id)
  }

  async function retireEquipment(eq) {
    if (!window.confirm(`Mark "${eq.system_label || 'this system'}" as retired? Use this when it's been replaced — it stays on record for 90 days, then clears automatically.`)) return
    await supabase.from('property_equipment').update({ status: 'retired', retired_at: new Date().toISOString() }).eq('id', eq.id)
    loadEquipment(job.property_id)
  }

  // OCR stub — captures the nameplate photo now; automatic parsing is a wired
  // follow-up (provider not yet selected). Manual entry remains available.
  function handleOcrCapture(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setOcrNotice('Nameplate captured. Auto-read is coming soon — enter the details below for now.')
  }

  async function saveExpectedSystems(val) {
    if (!job?.property_id) return
    const n = val === '' ? null : parseInt(val, 10)
    if (val !== '' && (isNaN(n) || n < 0)) return
    await supabase.from('properties').update({ expected_system_count: n }).eq('id', job.property_id)
    setJob((prev) => prev ? { ...prev, properties: { ...prev.properties, expected_system_count: n } } : prev)
  }

  function openCustEdit() {
    const primaryTenant = tenants[0]
    setCustForm({
      name: primaryTenant?.name || '',
      relationship: primaryTenant?.relationship || '',
      phone: primaryTenant?.phone || '',
      cust_primary: job?.customers?.primary_phone || '',
      cust_secondary: job?.customers?.secondary_phone || '',
    })
    setShowCustEdit(true)
  }

  async function saveCustEdit() {
    if (!job) return
    setSavingCust(true)
    // Occupant/tenant (property_tenants)
    const tenantPayload = {
      name: custForm.name.trim() || null,
      relationship: custForm.relationship || null,
      phone: custForm.phone.trim() || null,
    }
    const primaryTenant = tenants[0]
    if (primaryTenant) {
      if (tenantPayload.name || tenantPayload.phone || tenantPayload.relationship) {
        await supabase.from('property_tenants').update(tenantPayload).eq('id', primaryTenant.id)
      }
    } else if (tenantPayload.name || tenantPayload.phone || tenantPayload.relationship) {
      await supabase.from('property_tenants').insert({ ...tenantPayload, org_id: job.org_id, property_id: job.property_id })
    }
    // Billing customer phones (customers)
    if (job.customer_id || job.customers) {
      await supabase.from('customers').update({
        primary_phone: custForm.cust_primary.trim() || null,
        secondary_phone: custForm.cust_secondary.trim() || null,
      }).eq('id', job.customer_id)
      setJob((prev) => ({ ...prev, customers: { ...prev.customers, primary_phone: custForm.cust_primary.trim() || null, secondary_phone: custForm.cust_secondary.trim() || null } }))
    }
    setSavingCust(false)
    setShowCustEdit(false)
    loadTenants(job.property_id)
  }

  function plansLinkUrl() {
    return `${window.location.origin}/join-plan/${job.property_id}`
  }

  function copyPlansLink() {
    navigator.clipboard.writeText(plansLinkUrl())
    setCopyPlansLabel('Copied!')
    setTimeout(() => setCopyPlansLabel('Copy Link'), 1500)
  }

  async function handleSendPlans() {
    setSendingPlans(true)
    setPlansError('')
    setPlansSentTo(null)
    const { data, error } = await supabase.functions.invoke('send-agreement-options-email', { body: { propertyId: job.property_id } })
    setSendingPlans(false)
    if (error) {
      let detail = error.message
      if (error.context) {
        try {
          const body = await error.context.json()
          if (body?.error) detail = body.error
        } catch {}
      }
      setPlansError(detail)
    } else if (data?.error) {
      setPlansError(data.error)
    } else {
      setPlansSentTo(data?.sentTo || null)
    }
  }

  async function loadJob() {
    setLoading(true)
    const { data } = await supabase
      .from('jobs')
      .select(`
        id, org_id, property_id, customer_id, job_number, segment, status, job_date, start_time, duration_hours, job_type,
        service_complaint, internal_notes, on_my_way_at, arrival_at, completed_at, auth_diagnose_only, auth_limit_amount,
        properties ( street_address, unit, city, state, zip, expected_system_count ),
        customers ( display_name, spouse_name, primary_phone, secondary_phone, email_1 ),
        trip_charge:trip_charge_price_id ( location, access, hours, price, services ( name ) )
      `)
      .eq('id', jobId)
      .single()
    setJob(data)
    setNotes(data?.internal_notes || '')
    setLoading(false)
  }

  async function loadPhotos() {
    const { data } = await supabase
      .from('attachments')
      .select('id, file_path, file_name, caption, taken_at')
      .eq('job_id', jobId)
      .eq('category', 'photo')
      .order('taken_at', { ascending: false })
    const rows = data || []
    setPhotos(rows)
    const entries = await Promise.all(
      rows.map(async (a) => {
        const { data: signed } = await supabase.storage.from('job-photos').createSignedUrl(a.file_path, 3600)
        return [a.id, signed?.signedUrl || null]
      })
    )
    setPhotoUrls(Object.fromEntries(entries))
  }

  async function loadInvoice() {
    const { data } = await supabase
      .from('invoices')
      .select('id, invoice_number, job_total, amount_due, paid_at, total_paid, sent_at')
      .eq('job_id', jobId)
      .eq('kind', 'invoice')
      .maybeSingle()
    setInvoice(data || null)
  }

  async function updateStatus(newStatus) {
    if (!job) return
    setSaving(true)
    const patch = { status: newStatus }
    const now = new Date().toISOString()
    if (newStatus === 'on_my_way') patch.on_my_way_at = now
    if (newStatus === 'in_progress') patch.arrival_at = now
    if (newStatus === 'completed') patch.completed_at = now
    const { error } = await supabase.from('jobs').update(patch).eq('id', jobId)
    if (!error) {
      setJob((prev) => ({ ...prev, ...patch }))
      if (newStatus === 'on_my_way') {
        const sendNotify = (coords) => {
          const body = { jobId }
          if (coords) { body.techLat = coords.latitude; body.techLng = coords.longitude }
          supabase.functions.invoke('send-on-my-way-notification', { body }).catch(() => {})
          if (coords && profile?.elementsEntitled) {
            supabase.from('elements_vehicle_gps').insert({
              org_id: profile.org_id, user_id: profile.id, job_id: jobId,
              lat: coords.latitude, lng: coords.longitude, event: 'on_my_way',
            }).then(() => {}, () => {})
          }
        }
        if ('geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            (pos) => sendNotify(pos.coords),
            () => sendNotify(null),
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
          )
        } else {
          sendNotify(null)
        }
      }
    }
    setSaving(false)
  }

  async function submitIncomplete() {
    if (!job) return
    if (!incompleteReason) {
      setIncompleteError('Pick a reason.')
      return
    }
    setSavingIncomplete(true)
    setIncompleteError('')

    const { error: statusErr } = await supabase
      .from('jobs')
      .update({ status: 'incomplete' })
      .eq('id', jobId)
    if (statusErr) {
      setIncompleteError(statusErr.message)
      setSavingIncomplete(false)
      return
    }

    const { data: existing } = await supabase
      .from('job_incomplete_records')
      .select('id')
      .eq('job_id', jobId)
      .limit(1)

    if (existing && existing.length > 0) {
      await supabase.from('job_incomplete_records').update({ reason: incompleteReason }).eq('id', existing[0].id)
    } else {
      const { error: recErr } = await supabase.from('job_incomplete_records').insert({
        org_id: job.org_id, job_id: jobId, reason: incompleteReason,
      })
      if (recErr) {
        setIncompleteError(recErr.message)
        setSavingIncomplete(false)
        return
      }
    }

    setJob((prev) => ({ ...prev, status: 'incomplete' }))
    setSavingIncomplete(false)
    setShowIncompleteModal(false)
    setIncompleteReason('')
  }

  async function saveNotes() {
    setSaving(true)
    const { error } = await supabase.from('jobs').update({ internal_notes: notes }).eq('id', jobId)
    if (!error) setNotesSaved(true)
    setSaving(false)
  }

  async function handlePhotoSelect(e) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0 || !job) return
    setUploading(true)
    for (const file of files) {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${job.org_id}/${jobId}/${crypto.randomUUID()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('job-photos').upload(path, file, {
        contentType: file.type || 'image/jpeg',
      })
      if (!uploadError) {
        await supabase.from('attachments').insert({
          org_id: job.org_id, job_id: jobId, uploaded_by: uid,
          file_path: path, file_name: file.name,
          mime_type: file.type || 'image/jpeg', file_size_bytes: file.size, category: 'photo',
        })
      }
    }
    setUploading(false)
    e.target.value = ''
    loadPhotos()
  }

  if (loading || !job) {
    return (
      <div className="mobile-shell job-card-v2">
        <div className="jc-header">
          <button className="jc-back" onClick={() => navigate('/tech')}><IconChevronLeft /></button>
        </div>
        <div className="jc-body"><p className="jc-muted-note">Loading…</p></div>
      </div>
    )
  }

  const { date, time } = fmtDateTime(job.start_time)
  const address = job.properties
  const customer = job.customers
  const maps = mapsUrl(address)
  const mapImg = streetViewUrl(address)
  const mapOptions = mapProviderOptions(address)
  const status = job.status
  const isComplete = status === 'completed'

  // Occupant shown in the enlarged customer section (tenant, not the billing customer)
  const occupant = tenants[0] || null
  const occupantName = occupant?.name || customer?.display_name || 'Occupant'
  const occupantRel = occupant?.relationship || null
  const occupantPhones = [
    ...(occupant?.phone ? [occupant.phone] : []),
    ...[customer?.primary_phone, customer?.secondary_phone].filter(Boolean),
  ]

  // Number-of-systems completeness
  const expected = expectedSystems === '' ? equipment.length : parseInt(expectedSystems, 10) || 0
  const filledCount = equipment.filter(isSystemFilled).length
  const slotCount = Math.max(expected, equipment.length)
  const systemsComplete = slotCount > 0 && filledCount >= slotCount

  // Required-items banner (mockup: RED = incomplete/required; disappears when met)
  const required = []
  if (!invoice) required.push('No invoice started yet')
  if (!systemsComplete) {
    if (slotCount === 0) required.push('No equipment on file — add the system(s)')
    else required.push(`Equipment incomplete (${filledCount}/${slotCount} systems filled)`)
  }
  if (!occupantRel) required.push('Occupant status not set (HomeOwner / Tenant / Property Mgr)')

  return (
    <div className={`mobile-shell job-card-v2${dark ? ' jc-dark' : ''}`}>
      <div className={`jc-header${isComplete ? ' is-complete' : ''}`}>
        <button className="jc-back" onClick={() => navigate('/tech')}><IconChevronLeft /></button>
        <div className="jc-header-text">
          <div className="jc-title">{job.job_number}{job.segment > 1 ? `-${job.segment}` : ''} — {customer?.display_name}</div>
          <div className="jc-sub">{date}, {time}{job.duration_hours ? ` · ${job.duration_hours}h` : ''}</div>
        </div>
        <span className={`jc-status ${isComplete ? 'done' : status === 'in_progress' || status === 'on_my_way' ? 'progress' : ''}`}>
          {STATUS_LABEL[status] || status}
        </span>
        <button className="jc-theme-toggle" title="Light / Dark mode" onClick={() => setDark((v) => !v)}>
          {dark ? '☀' : '☾'}
        </button>
      </div>

      <div className="jc-body">
        {/* Persisted office authorization (real authorization from the office) */}
        {job.auth_diagnose_only && (
          <div className="jc-banner red">⚠ DIAGNOSE ONLY — no repairs authorized until approved</div>
        )}
        {job.auth_limit_amount != null && (
          <div className="jc-banner amber">⚠ AUTHORIZED UP TO ${Number(job.auth_limit_amount).toFixed(2)} — do not exceed without re-authorization</div>
        )}

        {/* Ephemeral, tech-set display banners (not saved) */}
        {customMsgActive && customMsg.trim() && (
          <div className="jc-banner custom">
            {customMsg}
            <button className="jc-banner-x" onClick={() => setCustomMsgActive(false)}>×</button>
          </div>
        )}
        {diagnoseBanner && (
          <div className="jc-banner red">
            Diagnose &amp; Estimate Only
            <button className="jc-banner-x" onClick={() => setDiagnoseBanner(false)}>×</button>
          </div>
        )}
        {repairLimitActive && repairLimit.trim() && (
          <div className="jc-banner amber">
            Repair Limit ${repairLimit}
            <button className="jc-banner-x" onClick={() => setRepairLimitActive(false)}>×</button>
          </div>
        )}

        {/* Required-items banner — disappears (turns green) once met */}
        {!isComplete && (
          required.length > 0 ? (
            <div className="jc-req-banner">
              <div className="jc-req-title">Anything in RED must be completed to finish this job:</div>
              <ul>{required.map((r) => <li key={r}>{r}</li>)}</ul>
            </div>
          ) : (
            <div className="jc-req-banner is-clear">
              <div className="jc-req-title">✓ All required items complete — ready to mark Complete.</div>
            </div>
          )
        )}

        {/* Property image (2:1) */}
        <a
          className="jc-property-img-wrap"
          href={maps || undefined}
          target="_blank"
          rel="noreferrer"
          style={{ pointerEvents: maps ? 'auto' : 'none' }}
        >
          {mapImg
            ? <img src={mapImg} alt="Property" className="jc-property-img" />
            : <div className="jc-property-img-fallback"><IconPin /> Property photo</div>}
        </a>

        {/* Display options (ephemeral banners composer) */}
        <div className="jc-section">
          <div className="jc-section-head clickable" onClick={() => setShowDisplayOptions((v) => !v)}>
            <span>Display Options &amp; Messages</span>
            <div className="jc-head-right">
              <span className="jc-flag blue">Not saved</span>
              <span className={`jc-chevron${showDisplayOptions ? ' open' : ''}`}>›</span>
            </div>
          </div>
          {showDisplayOptions && (
            <div className="jc-section-body">
              <div className="jc-field">
                <label>Optional custom message</label>
                <input type="text" value={customMsg} placeholder="Shown as a banner on this screen only"
                  onChange={(e) => { setCustomMsg(e.target.value); setCustomMsgActive(true) }} />
              </div>
              <label className="jc-toggle-row">
                <input type="checkbox" checked={diagnoseBanner} onChange={(e) => setDiagnoseBanner(e.target.checked)} />
                Show "Diagnose &amp; Estimate Only" banner
              </label>
              <div className="jc-field">
                <label>Repair limit banner ($)</label>
                <div className="jc-field-row">
                  <input type="number" value={repairLimit} placeholder="e.g. 500"
                    onChange={(e) => { setRepairLimit(e.target.value); setRepairLimitActive(!!e.target.value) }} />
                </div>
              </div>
              <p className="jc-muted-note">These are reminders for this visit only — nothing here is recorded.</p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="jc-actions">
          <button className="jc-btn" disabled={status !== 'scheduled' || saving} onClick={() => updateStatus('on_my_way')}>On My Way</button>
          <button className="jc-btn" disabled={status !== 'on_my_way' || saving} onClick={() => updateStatus('in_progress')}>Start My Time</button>
          <button className="jc-btn solid-green" disabled={status !== 'in_progress' || saving} onClick={() => updateStatus('completed')}>Complete</button>
        </div>
        {(status === 'in_progress' || status === 'on_my_way') && (
          <button className="jc-btn wide" style={{ marginBottom: 12, background: 'var(--jc-amber)' }} disabled={saving}
            onClick={() => { setIncompleteReason(''); setIncompleteError(''); setShowIncompleteModal(true) }}>
            Mark Incomplete — Needs Follow-Up
          </button>
        )}
        {status === 'incomplete' && (
          <div className="jc-banner amber" style={{ justifyContent: 'flex-start' }}>
            Marked incomplete — the office has this in the follow-up queue.
          </div>
        )}

        {/* Customer / occupant — enlarged */}
        <div className="jc-section jc-customer">
          <div className="jc-section-head">
            <span>Customer</span>
            <div className="jc-head-right">
              <button className="jc-btn-sm" onClick={openCustEdit}>{showCustEdit ? 'Close' : 'Add / Edit'}</button>
            </div>
          </div>
          <div className="jc-section-body">
            {!showCustEdit ? (
              <>
                <div className="jc-tenant-name">{occupantName}</div>
                <div>
                  <span className={`jc-tenant-status${occupantRel ? '' : ' missing'}`}>
                    {occupantRel ? RELATIONSHIP_LABEL[occupantRel] : 'Status Required'}
                  </span>
                </div>
                {address?.street_address && (
                  <div className="jc-address">
                    <a href={maps || undefined} target="_blank" rel="noreferrer" style={{ pointerEvents: maps ? 'auto' : 'none' }}>
                      <IconPin />
                      <span>{address.street_address}{address.unit ? ` #${address.unit}` : ''}, {address.city}, {address.state} {address.zip}</span>
                    </a>
                    <div className="gps-menu-wrap">
                      <button className="jc-gps-btn" title="Navigate" onClick={() => setMapsMenuOpen((v) => !v)}><IconNavigation /></button>
                      {mapsMenuOpen && (
                        <>
                          <div className="gps-menu-backdrop" onClick={() => setMapsMenuOpen(false)} />
                          <div className="gps-menu">
                            {mapOptions.map((opt) => (
                              <a key={opt.label} href={opt.url} target="_blank" rel="noreferrer" className="gps-menu-item" onClick={() => setMapsMenuOpen(false)}>
                                {opt.label}
                              </a>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
                {occupantPhones.map((p) => (
                  <div key={p} className="jc-phone">
                    <span>{formatPhone(p)}</span>
                    <div className="jc-phone-icons">
                      <a className="call" href={`tel:${p}`} title="Call"><IconPhone /></a>
                      <a className="text" href={`sms:${p}`} title="Text"><IconMessage /></a>
                    </div>
                  </div>
                ))}
                <div className="jc-gps-note"><span className="jc-gps-dot" /> GPS active while signed in (security)</div>
              </>
            ) : (
              <>
                <div className="jc-field">
                  <label>Occupant name</label>
                  <input type="text" value={custForm.name} onChange={(e) => setCustForm({ ...custForm, name: e.target.value })} placeholder="Person at the property" />
                </div>
                <div className="jc-field">
                  <label>Occupant status</label>
                  <select value={custForm.relationship} onChange={(e) => setCustForm({ ...custForm, relationship: e.target.value })}>
                    <option value="">Select status…</option>
                    {RELATIONSHIP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="jc-field">
                  <label>Occupant phone</label>
                  <input type="text" value={custForm.phone} onChange={(e) => setCustForm({ ...custForm, phone: e.target.value })} placeholder="optional" />
                </div>
                <div className="jc-field-row">
                  <div className="jc-field">
                    <label>Customer phone (primary)</label>
                    <input type="text" value={custForm.cust_primary} onChange={(e) => setCustForm({ ...custForm, cust_primary: e.target.value })} />
                  </div>
                  <div className="jc-field">
                    <label>Customer phone (secondary)</label>
                    <input type="text" value={custForm.cust_secondary} onChange={(e) => setCustForm({ ...custForm, cust_secondary: e.target.value })} />
                  </div>
                </div>
                <button className="jc-btn wide" disabled={savingCust} onClick={saveCustEdit}>{savingCust ? 'Saving…' : 'Save'}</button>
              </>
            )}
          </div>
        </div>

        {/* Schedule (unchanged data, mockup styling) */}
        <div className="jc-section">
          <div className="jc-section-head"><span>Schedule</span></div>
          <div className="jc-section-body">
            <div className="jc-kv"><span>Date &amp; Time</span><strong>{date}, {time}</strong></div>
            {job.duration_hours && <div className="jc-kv"><span>Planned Duration</span><strong>{job.duration_hours} hr</strong></div>}
            {job.service_complaint && <div className="jc-kv"><span>Issue</span><strong>{job.service_complaint}</strong></div>}
            {job.trip_charge && (
              <div className="jc-kv">
                <span>Trip Charge</span>
                <strong>
                  {job.trip_charge.services?.name}
                  {job.trip_charge.location ? ` — ${job.trip_charge.location}/${(job.trip_charge.access || '').replace(' Access', '')}/${(job.trip_charge.hours || '').replace(' Hours', '')}` : ''}
                  {typeof job.trip_charge.price === 'number' ? ` · $${job.trip_charge.price.toFixed(2)}` : ''}
                </strong>
              </div>
            )}
          </div>
        </div>

        {/* Photos — collapsed until filled */}
        <div className="jc-section">
          <div className="jc-section-head clickable" onClick={() => setPhotoOpen((v) => !v)}>
            <span><IconCamera /> Photos</span>
            <div className="jc-head-right">
              <span className={`jc-flag ${photos.length > 0 ? 'blue' : 'red'}`}>{photos.length > 0 ? `${photos.length}` : 'Empty'}</span>
              <span className={`jc-chevron${photoOpen ? ' open' : ''}`}>›</span>
            </div>
          </div>
          {photoOpen && (
            <div className="jc-section-body">
              <div style={{ display: 'flex', gap: 14, marginBottom: 12 }}>
                <button className="jc-btn-sm" onClick={() => cameraInputRef.current?.click()} disabled={uploading}>{uploading ? 'Uploading…' : 'Take Photo'}</button>
                <button className="jc-btn-sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>Upload</button>
              </div>
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" multiple style={{ display: 'none' }} onChange={handlePhotoSelect} />
              <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handlePhotoSelect} />
              <div className="jc-photo-grid">
                {photos.map((p) => (
                  <a key={p.id} href={photoUrls[p.id] || '#'} target="_blank" rel="noreferrer" className="jc-photo">
                    {photoUrls[p.id] ? <img src={photoUrls[p.id]} alt={p.file_name} /> : <IconCamera />}
                  </a>
                ))}
                <div className="jc-photo-add" onClick={() => fileInputRef.current?.click()}>+</div>
              </div>
              <p className="jc-muted-note" style={{ marginTop: 10 }}>Tip: a nameplate photo can be pushed to Equipment Records below.</p>
            </div>
          )}
        </div>

        {/* Invoice Builder — collapsed */}
        <div className="jc-section">
          <div className="jc-section-head clickable" onClick={() => setInvoiceOpen((v) => !v)}>
            <span><IconReceipt /> Invoice Builder</span>
            <div className="jc-head-right">
              <span className={`jc-flag ${invoice ? 'blue' : 'red'}`}>{invoice ? 'Started' : 'None'}</span>
              <span className={`jc-chevron${invoiceOpen ? ' open' : ''}`}>›</span>
            </div>
          </div>
          {invoiceOpen && (
            <div className="jc-section-body">
              <Link to={`/tech/invoice/${jobId}`} className="jc-action-link">
                <IconReceipt /><span>Open Invoice Builder</span><span className="jc-chev">›</span>
              </Link>
            </div>
          )}
        </div>

        {/* View & Send — no change (mockup) */}
        <div className="jc-section">
          <div className="jc-section-head"><span><IconReceipt /> View &amp; Send</span></div>
          <div className="jc-section-body">
            {!invoice ? (
              <p className="jc-muted-note">No invoice yet — open Invoice Builder above to create one first.</p>
            ) : (
              <>
                <div className="jc-kv"><span>Total Due</span><strong>${(invoice.amount_due ?? invoice.job_total ?? 0).toFixed(2)}</strong></div>
                <div className="jc-kv"><span>Status</span><strong>{invoice.paid_at ? `Paid ${new Date(invoice.paid_at).toLocaleDateString()}` : 'Unpaid'}</strong></div>
                {invoice.sent_at && <div className="jc-kv"><span>Last Sent</span><strong>{new Date(invoice.sent_at).toLocaleString()}</strong></div>}
                <button className="jc-btn wide" style={{ marginTop: 10 }} onClick={() => navigate(`/tech/invoice-view/${invoice.id}`)}>View &amp; Send Invoice</button>
              </>
            )}
          </div>
        </div>

        {/* Equipment on File — Number of Systems + fill-state colors + OCR stub */}
        <div className="jc-section">
          <div className="jc-section-head">
            <span>Equipment on File</span>
            <div className="jc-head-right">
              <span className={`jc-flag ${systemsComplete ? 'blue' : 'red'}`}>{filledCount}/{slotCount || 0} filled</span>
              <button className="jc-btn-sm" onClick={() => { setShowEquipForm(!showEquipForm); setEquipEditingId(null); setEquipForm(blankEquipForm); setOcrNotice('') }}>
                {showEquipForm ? 'Close' : '+ Add'}
              </button>
            </div>
          </div>
          <div className="jc-section-body">
            <div className="jc-field">
              <label>Number of systems</label>
              <div className="jc-field-row">
                <input type="number" min="0" value={expectedSystems}
                  onChange={(e) => setExpectedSystems(e.target.value)}
                  onBlur={(e) => saveExpectedSystems(e.target.value)}
                  placeholder={String(equipment.length || 0)} />
              </div>
            </div>

            {Array.from({ length: slotCount }).map((_, i) => {
              const eq = equipment[i]
              const filled = isSystemFilled(eq)
              if (!eq) {
                return (
                  <div key={`empty-${i}`} className="jc-system missing">
                    <div className="jc-system-top">
                      <span className="jc-system-label">System {i + 1}</span>
                      <span className="jc-system-badge missing">Not on file</span>
                    </div>
                    <div className="jc-system-detail">Add this system's nameplate details (OCR or manual).</div>
                  </div>
                )
              }
              return (
                <div key={eq.id} className={`jc-system ${filled ? 'filled' : 'missing'}`}>
                  <div className="jc-system-top">
                    <span className="jc-system-label">{eq.system_label || `System ${i + 1}`}</span>
                    <span className={`jc-system-badge ${filled ? 'filled' : 'missing'}`}>{filled ? 'Filled' : 'Incomplete'}</span>
                  </div>
                  <div className="jc-system-detail">
                    <div><strong>Outdoor:</strong> {[eq.outdoor_brand, eq.outdoor_model].filter(Boolean).join(' ') || '—'}{eq.outdoor_serial ? ` (SN: ${eq.outdoor_serial})` : ''}</div>
                    <div><strong>Indoor:</strong> {[eq.indoor_brand, eq.indoor_model].filter(Boolean).join(' ') || '—'}{eq.indoor_serial ? ` (SN: ${eq.indoor_serial})` : ''}</div>
                    <div><strong>Furnace:</strong> {[eq.furnace_brand, eq.furnace_model].filter(Boolean).join(' ') || '—'}{eq.furnace_serial ? ` (SN: ${eq.furnace_serial})` : ''}</div>
                    {eq.install_date && <div><strong>Installed:</strong> {new Date(eq.install_date + 'T00:00:00').toLocaleDateString()}</div>}
                  </div>
                  <div className="jc-system-actions">
                    <button className="jc-btn-sm" onClick={() => startEquipEdit(eq)}>Edit</button>
                    <button className="jc-btn-sm" style={{ color: 'var(--jc-amber)' }} onClick={() => retireEquipment(eq)}>Retire</button>
                    <button className="jc-btn-sm" style={{ color: 'var(--jc-red)' }} onClick={() => deleteEquipment(eq.id)}>Remove</button>
                  </div>
                </div>
              )
            })}

            {showEquipForm && (
              <div style={{ marginTop: 12 }}>
                <button className="jc-ocr-btn" onClick={() => ocrInputRef.current?.click()}>
                  <IconCamera /> Scan Nameplate (OCR)
                </button>
                <input ref={ocrInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleOcrCapture} />
                {ocrNotice && <p className="jc-muted-note" style={{ color: 'var(--jc-blue)', marginBottom: 10 }}>{ocrNotice}</p>}

                <div className="jc-field"><label>System label</label><input type="text" value={equipForm.system_label} onChange={(e) => setEquipForm({ ...equipForm, system_label: e.target.value })} placeholder="e.g. Upstairs" /></div>
                <div className="jc-field"><label>Install date</label><input type="date" value={equipForm.install_date} onChange={(e) => setEquipForm({ ...equipForm, install_date: e.target.value })} /></div>

                <p className="jc-muted-note" style={{ fontWeight: 800, textTransform: 'uppercase', marginTop: 10 }}>Outdoor Unit</p>
                <div className="jc-field-row">
                  <div className="jc-field"><label>Brand</label><input type="text" value={equipForm.outdoor_brand} onChange={(e) => setEquipForm({ ...equipForm, outdoor_brand: e.target.value })} /></div>
                  <div className="jc-field"><label>Model</label><input type="text" value={equipForm.outdoor_model} onChange={(e) => setEquipForm({ ...equipForm, outdoor_model: e.target.value })} /></div>
                </div>
                <div className="jc-field"><label>Serial number</label><input type="text" value={equipForm.outdoor_serial} onChange={(e) => setEquipForm({ ...equipForm, outdoor_serial: e.target.value })} /></div>

                <p className="jc-muted-note" style={{ fontWeight: 800, textTransform: 'uppercase', marginTop: 10 }}>Indoor Unit</p>
                <div className="jc-field-row">
                  <div className="jc-field"><label>Brand</label><input type="text" value={equipForm.indoor_brand} onChange={(e) => setEquipForm({ ...equipForm, indoor_brand: e.target.value })} /></div>
                  <div className="jc-field"><label>Model</label><input type="text" value={equipForm.indoor_model} onChange={(e) => setEquipForm({ ...equipForm, indoor_model: e.target.value })} /></div>
                </div>
                <div className="jc-field"><label>Serial number</label><input type="text" value={equipForm.indoor_serial} onChange={(e) => setEquipForm({ ...equipForm, indoor_serial: e.target.value })} /></div>

                <p className="jc-muted-note" style={{ fontWeight: 800, textTransform: 'uppercase', marginTop: 10 }}>Furnace</p>
                <div className="jc-field-row">
                  <div className="jc-field"><label>Brand</label><input type="text" value={equipForm.furnace_brand} onChange={(e) => setEquipForm({ ...equipForm, furnace_brand: e.target.value })} /></div>
                  <div className="jc-field"><label>Model</label><input type="text" value={equipForm.furnace_model} onChange={(e) => setEquipForm({ ...equipForm, furnace_model: e.target.value })} /></div>
                </div>
                <div className="jc-field"><label>Serial number</label><input type="text" value={equipForm.furnace_serial} onChange={(e) => setEquipForm({ ...equipForm, furnace_serial: e.target.value })} /></div>

                <div className="jc-field"><label>Notes</label><input type="text" value={equipForm.notes} onChange={(e) => setEquipForm({ ...equipForm, notes: e.target.value })} placeholder="optional" /></div>

                <button className="jc-btn wide" disabled={savingEquip} onClick={saveEquipment}>{savingEquip ? 'Saving…' : equipEditingId ? 'Save Changes' : 'Add Equipment'}</button>
              </div>
            )}
          </div>
        </div>

        {/* Maintenance Plans */}
        <div className="jc-section">
          <div className="jc-section-head"><span><IconShield /> Maintenance Plans</span></div>
          <div className="jc-section-body">
            <p className="jc-muted-note" style={{ marginBottom: 10 }}>Sends all plan options in one email — the customer picks a tier and pays, no login required.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="jc-btn" style={{ flex: '1 1 auto' }} onClick={handleSendPlans} disabled={sendingPlans}>{sendingPlans ? 'Sending…' : 'Send Plan Options'}</button>
              <button className="jc-btn ghost" style={{ flex: '1 1 auto' }} onClick={() => window.open(plansLinkUrl(), '_blank')}>Open Link</button>
              <button className="jc-btn ghost" style={{ flex: '1 1 auto' }} onClick={copyPlansLink}>{copyPlansLabel}</button>
            </div>
            {plansSentTo && <p className="jc-muted-note" style={{ color: 'var(--jc-green)', marginTop: 8 }}>Sent to {plansSentTo}</p>}
            {plansError && <p className="jc-muted-note" style={{ color: 'var(--jc-red)', marginTop: 8 }}>{plansError}</p>}
          </div>
        </div>

        {/* Estimates — approval signatures now captured here (moved from job card) */}
        <div className="jc-section">
          <div className="jc-section-head"><span>Estimates</span></div>
          <div className="jc-section-body">
            <Link to={`/tech/estimate/${jobId}`} className="jc-action-link">
              <IconFile /><span>Service Estimate</span><span className="jc-chev">›</span>
            </Link>
            <Link to={`/tech/system-estimate/${jobId}`} className="jc-action-link">
              <IconCalculator /><span>System Estimate</span><span className="jc-chev">›</span>
            </Link>
            <p className="jc-muted-note" style={{ marginTop: 4 }}>Approval signatures are captured on the Estimate and Invoice screens.</p>
          </div>
        </div>

        {/* Private Notes */}
        <div className="jc-section">
          <div className="jc-section-head"><span><IconLock /> Private Notes</span></div>
          <div className="jc-section-body">
            <textarea className="jc-notes" placeholder="Internal notes — not visible to customer" value={notes}
              onChange={(e) => { setNotes(e.target.value); setNotesSaved(false) }} onBlur={saveNotes} />
            {!notesSaved && <div className="jc-muted-note" style={{ marginTop: 4 }}>Unsaved — saves when you tap away</div>}
          </div>
        </div>
      </div>

      {showIncompleteModal && (
        <div className="modal-overlay" onClick={() => !savingIncomplete && setShowIncompleteModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', width: '100%', maxWidth: 520, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 32 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 18 }}>Mark Job Incomplete</h3>
            <p style={{ color: 'var(--jc-muted)', fontSize: 14, margin: '0 0 16px' }}>This tells the office the job is done for now but needs a follow-up visit. Pick the reason.</p>
            <select value={incompleteReason} onChange={(e) => setIncompleteReason(e.target.value)}
              style={{ width: '100%', padding: '12px', fontSize: 16, borderRadius: 8, border: '1px solid var(--jc-line)', marginBottom: 12 }}>
              <option value="">Select a reason…</option>
              {INCOMPLETE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {incompleteError && <div className="auth-error" style={{ marginBottom: 12 }}>{incompleteError}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="jc-btn ghost" disabled={savingIncomplete} onClick={() => setShowIncompleteModal(false)}>Cancel</button>
              <button className="jc-btn" style={{ background: 'var(--jc-amber)' }} disabled={savingIncomplete} onClick={submitIncomplete}>{savingIncomplete ? 'Saving…' : 'Confirm Incomplete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
