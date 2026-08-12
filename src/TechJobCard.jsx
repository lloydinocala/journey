import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import SignaturePad from './SignaturePad'
import { formatTimeInZone, formatDateTimeInZone } from './utils/tz'
import {
  IconChevronLeft, IconPhone, IconMessage, IconPin, IconNavigation, IconCamera,
  IconReceipt, IconShield, IconFile, IconCalculator, IconLock, IconList,
} from './MobileIcons'

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
  { value: 'renter', label: 'Renter' },
  { value: 'property_manager', label: 'Property Mgr' },
]
const RELATIONSHIP_LABEL = Object.fromEntries(RELATIONSHIP_OPTIONS.map((o) => [o.value, o.label]))

const SIG_STAGES = [
  { key: 'work_approved_to_begin', label: 'Before Work Begins' },
  { key: 'work_finished', label: 'When Work Completes' },
]

const SIG_NO_REASONS = [
  'Customer not present',
  'Verbal approval — in person',
  'Phone verbal approval',
  'Text or email approval',
  'Customer refused to sign',
  'Other',
]

function formatPhone(raw) {
  if (!raw) return raw
  const d = ('' + raw).replace(/\D/g, '')
  if (d.length === 10) return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6)
  if (d.length === 11 && d[0] === '1') return d.slice(1, 4) + '-' + d.slice(4, 7) + '-' + d.slice(7)
  return raw
}
function isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) }
function addressString(p) {
  if (!p?.street_address) return null
  return `${p.street_address}${p.unit ? ' #' + p.unit : ''}, ${p.city || ''} ${p.state || ''} ${p.zip || ''}`
}
function deviceMapsUrl(p) {
  const a = addressString(p); if (!a) return null
  const q = encodeURIComponent(a)
  return isIOS() ? `https://maps.apple.com/?q=${q}` : `geo:0,0?q=${q}`
}
function googleMapsUrl(p) {
  const a = addressString(p); if (!a) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a)}`
}
function streetViewUrl(p) {
  const a = addressString(p); const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (!a || !key) return null
  return `https://maps.googleapis.com/maps/api/streetview?size=640x300&location=${encodeURIComponent(a)}&fov=80&pitch=0&key=${key}`
}
function fmtDateTime(t) {
  if (!t) return { date: '', time: '' }
  return {
    date: formatDateTimeInZone(t, undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
    time: formatTimeInZone(t),
  }
}
function dataUrlToBlob(dataUrl) {
  const [meta, b64] = dataUrl.split(','); const mime = meta.match(/:(.*?);/)[1]
  const bin = atob(b64); const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}
// Trip charge and the auto-added Equipment-on-File note are not "real" billable
// line items — a service or custom item must be added before viewing/sending.
const NON_ITEM_CATEGORIES = ['TRIP CHARGES', 'EQUIPMENT ON FILE']
function isRealLineItem(li) { return !NON_ITEM_CATEGORIES.includes(li.category) }
function isSystemFilled(eq) {
  if (!eq) return false
  if (eq.info_unavailable_reason) return true  // a recorded reason counts as documented
  const hasSerial = !!(eq.outdoor_serial || eq.indoor_serial || eq.furnace_serial)
  const hasModel = !!(eq.outdoor_model || eq.indoor_model || eq.furnace_model)
  return hasSerial && hasModel
}
// Per-job-type matrix: what the spine's middle gate is, and which spine tasks show.
// Keyed on the job_type NAME (the repair-style default covers Repair / Labor Warranty /
// Punchlist / Retrofit / Duct Repair / Other). Filter deliveries ride as tasks/segments,
// so they need no variant here.
function jobTypeConfig(jobType) {
  const t = (jobType || '').trim().toLowerCase()
  if (t === 'maintenance') return { middle: 'checklist', showServiceEstimate: true }
  if (t === 'system estimate') return { middle: 'none', showServiceEstimate: false }
  return { middle: 'diagnosis', showServiceEstimate: true }
}
function haversineMeters(a, b) {
  const R = 6371000, toRad = (x) => (x * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

// Load the Google Maps JS SDK once. The website-restricted key is authorized for
// the JS Geocoder (unlike the REST geocode endpoint), so this works in-browser.
let gmapsPromise = null
function loadGoogleMaps(key) {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (window.google?.maps) return Promise.resolve(window.google.maps)
  if (gmapsPromise) return gmapsPromise
  gmapsPromise = new Promise((resolve) => {
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}`
    s.async = true; s.defer = true
    s.onload = () => resolve(window.google?.maps || null)
    s.onerror = () => resolve(null)
    document.head.appendChild(s)
  })
  return gmapsPromise
}
async function geocodeAddress(address, key) {
  // 1) Free US Census geocoder — no API key, CORS-enabled, good US coverage.
  try {
    const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(address)}&benchmark=Public_AR_Current&format=json`
    const r = await fetch(url)
    if (r.ok) {
      const j = await r.json()
      const c = j?.result?.addressMatches?.[0]?.coordinates
      if (c && typeof c.y === 'number' && typeof c.x === 'number') return { lat: c.y, lng: c.x }
    }
  } catch { /* fall through to Google */ }
  // 2) Fallback: Google Maps JS Geocoder (only if the website key is authorized for it).
  try {
    const maps = await loadGoogleMaps(key)
    if (maps?.Geocoder) {
      return await new Promise((resolve) => {
        new maps.Geocoder().geocode({ address }, (results, status) => {
          if (status === 'OK' && results && results[0]) {
            const loc = results[0].geometry.location
            resolve({ lat: loc.lat(), lng: loc.lng() })
          } else resolve(null)
        })
      })
    }
  } catch { /* ignore */ }
  return null
}

function ApprovalSignatureImage({ path }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!path) return
    supabase.storage.from('signatures').createSignedUrl(path, 3600).then(({ data }) => { if (data) setUrl(data.signedUrl) })
  }, [path])
  if (!url) return null
  return <img src={url} alt="Signature" style={{ maxWidth: 180, border: '1px solid var(--jc-line)', borderRadius: 6, marginTop: 6, background: '#fff' }} />
}

export default function TechJobCard({ profile }) {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const ocrInputRef = useRef(null)
  const geoWatchRef = useRef(null)
  const photoPhaseRef = useRef('pre') // which capture point the next photo belongs to: 'pre' | 'post'

  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uid, setUid] = useState(null)
  const [dark, setDark] = useState(() => { try { return localStorage.getItem('jc-theme') === 'dark' } catch { return false } })
  function toggleDark() { setDark((v) => { const nv = !v; try { localStorage.setItem('jc-theme', nv ? 'dark' : 'light') } catch { /* ignore */ } return nv }) }
  const [arrivalState, setArrivalState] = useState('armed') // 'armed' | 'off'
  const [arrivalDist, setArrivalDist] = useState(null)
  const [geoAcc, setGeoAcc] = useState(null)
  const [geoNote, setGeoNote] = useState('')
  const geoCleanupRef = useRef(null)

  const [photos, setPhotos] = useState([])
  const [photoUrls, setPhotoUrls] = useState({})
  const [uploading, setUploading] = useState(false)

  const [invoice, setInvoice] = useState(null)
  const [invoiceItems, setInvoiceItems] = useState(0)
  const [serviceEstimate, setServiceEstimate] = useState(null)
  const [serviceEstItems, setServiceEstItems] = useState(0)

  const [approvals, setApprovals] = useState([])
  const [signingStage, setSigningStage] = useState(null)
  const [approverName, setApproverName] = useState('')
  const [sigData, setSigData] = useState(null)
  const [sigError, setSigError] = useState('')
  const [noSig, setNoSig] = useState(false)
  const [sigReason, setSigReason] = useState('')
  const [scanNotice, setScanNotice] = useState('')
  const attachScanRef = useRef(null)

  const [banners, setBanners] = useState([])
  const [plan, setPlan] = useState(null)

  const [tenants, setTenants] = useState([])
  const [equipment, setEquipment] = useState([])
  const [expectedSystems, setExpectedSystems] = useState('')

  const [notes, setNotes] = useState('')
  const [notesSaved, setNotesSaved] = useState(true)

  // Diagnosis (forced-chain keystone) — voice-to-text and manual text are co-equal inputs.
  const [diagnosisNote, setDiagnosisNote] = useState('')
  const [diagnosisSaved, setDiagnosisSaved] = useState(true)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef(null)
  // Pre-repair photo "why not" reason (when a starting-condition photo can't be taken).
  const [savingPrePhotoReason, setSavingPrePhotoReason] = useState(false)

  const [history, setHistory] = useState([])
  const [histOpen, setHistOpen] = useState({})
  const [histData, setHistData] = useState({})

  // Collapsible section state — info sections + maintenance open by default; tasks collapsed.
  const [openMap, setOpenMap] = useState({ customer: true, schedule: true, maintenance: true })
  const isOpen = (k) => !!openMap[k]
  const toggle = (k) => setOpenMap((m) => ({ ...m, [k]: !m[k] }))
  const setOpen = (k, v) => setOpenMap((m) => ({ ...m, [k]: v }))

  // Customer edit
  const [showCustEdit, setShowCustEdit] = useState(false)
  const [custForm, setCustForm] = useState({ name: '', relationship: '', street: '', unit: '', city: '', state: '', zip: '', email: '', phone: '' })
  const [savingCust, setSavingCust] = useState(false)

  // Equipment form
  const blankEquip = { system_label: '', outdoor_brand: '', outdoor_model: '', outdoor_serial: '', indoor_brand: '', indoor_model: '', indoor_serial: '', furnace_brand: '', furnace_model: '', furnace_serial: '', install_date: '', notes: '', info_unavailable_reason: '' }
  const [equipForm, setEquipForm] = useState(blankEquip)
  const [showEquipForm, setShowEquipForm] = useState(false)
  const [equipEditingId, setEquipEditingId] = useState(null)
  const [savingEquip, setSavingEquip] = useState(false)
  const [scanMsg, setScanMsg] = useState('')
  const [scanTarget, setScanTarget] = useState(null)
  const [scanBusy, setScanBusy] = useState(false)

  // Maintenance
  const [sendingPlans, setSendingPlans] = useState(false)
  const [plansMsg, setPlansMsg] = useState('')


  // Stop / incomplete
  const [showStopModal, setShowStopModal] = useState(false)
  const [incompleteReason, setIncompleteReason] = useState('')
  const [savingStop, setSavingStop] = useState(false)
  const [stopError, setStopError] = useState('')

  const [lockHint, setLockHint] = useState(false)
  const [googleMsg, setGoogleMsg] = useState('')

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUid(data?.user?.id || null)) }, [])

  useEffect(() => {
    loadJob(); loadPhotos(); loadInvoice(); loadServiceEstimate(); loadApprovals(); loadBanners()
  }, [jobId])

  useEffect(() => {
    if (job?.property_id) { loadEquipment(job.property_id); loadTenants(job.property_id); loadPlan(job.property_id); loadHistory(job.property_id) }
    if (job?.properties?.expected_system_count != null) setExpectedSystems(String(job.properties.expected_system_count))
  }, [job?.property_id])

  // ---- loaders ----
  async function loadJob() {
    setLoading(true)
    const { data } = await supabase.from('jobs').select(`
      id, org_id, property_id, customer_id, job_number, segment, status, start_time, duration_hours, job_type,
      service_complaint, internal_notes, auth_diagnose_only, auth_limit_amount, service_estimate_not_needed, plan_options_sent_at,
      tech_email_edited_at, tech_phone_edited_at, diagnosis_note, diagnosis_recorded_at, pre_photo_skip_reason,
      properties ( street_address, unit, city, state, zip, expected_system_count ),
      customers ( display_name, spouse_name, primary_phone, secondary_phone, email_1 ),
      trip_charge:trip_charge_price_id ( location, access, hours, price, services ( name ) )
    `).eq('id', jobId).single()
    setJob(data); setNotes(data?.internal_notes || ''); setDiagnosisNote(data?.diagnosis_note || ''); setLoading(false)
  }
  async function loadPhotos() {
    const { data } = await supabase.from('attachments').select('id, file_path, file_name, taken_at, phase').eq('job_id', jobId).eq('category', 'photo').order('taken_at', { ascending: false })
    const rows = data || []; setPhotos(rows)
    const entries = await Promise.all(rows.map(async (a) => {
      const { data: s } = await supabase.storage.from('job-photos').createSignedUrl(a.file_path, 3600)
      return [a.id, s?.signedUrl || null]
    }))
    setPhotoUrls(Object.fromEntries(entries))
  }
  async function loadInvoice() {
    const { data } = await supabase.from('invoices').select('id, invoice_number, job_total, amount_due, paid_at, sent_at, org_id').eq('job_id', jobId).eq('kind', 'invoice').maybeSingle()
    setInvoice(data || null)
    if (data) {
      // Trip charge / equipment note don't count — a real service or custom item must be added.
      const { data: li } = await supabase.from('invoice_line_items').select('category').eq('invoice_id', data.id)
      setInvoiceItems((li || []).filter(isRealLineItem).length)
    } else setInvoiceItems(0)
  }
  async function loadServiceEstimate() {
    const { data } = await supabase.from('invoices').select('id, sent_at').eq('job_id', jobId).eq('kind', 'estimate').eq('estimate_type', 'service').maybeSingle()
    setServiceEstimate(data || null)
    if (data) {
      const { data: li } = await supabase.from('invoice_line_items').select('category').eq('invoice_id', data.id)
      setServiceEstItems((li || []).filter(isRealLineItem).length)
    } else setServiceEstItems(0)
  }
  async function loadApprovals() {
    const { data } = await supabase.from('job_approvals').select('*').eq('job_id', jobId).order('created_at')
    setApprovals(data || [])
  }
  async function loadBanners() {
    const { data } = await supabase.from('job_banners').select('id, kind, body').eq('job_id', jobId).order('sort_order')
    setBanners(data || [])
  }
  async function loadPlan(propertyId) {
    const { data } = await supabase.from('maintenance_agreements')
      .select('id, status, is_archived, maintenance_agreement_tiers ( name )')
      .eq('property_id', propertyId).eq('status', 'active').eq('is_archived', false).maybeSingle()
    setPlan(data || null)
  }
  async function loadTenants(propertyId) {
    const { data } = await supabase.from('property_tenants').select('id, name, phone, relationship').eq('property_id', propertyId).order('created_at')
    setTenants(data || [])
  }
  async function loadEquipment(propertyId) {
    const { data } = await supabase.from('property_equipment').select('*').eq('property_id', propertyId).eq('status', 'active').order('created_at')
    setEquipment(data || [])
  }
  async function loadHistory(propertyId) {
    const { data } = await supabase.from('jobs').select('id, job_number, segment, start_time, job_type, status').eq('property_id', propertyId).neq('id', jobId).order('start_time', { ascending: false }).limit(6)
    setHistory(data || [])
  }
  // Tap a past visit to see what was actually billed (helps explain prior work to customers).
  async function toggleHistory(h) {
    const id = h.id
    setHistOpen((o) => ({ ...o, [id]: !o[id] }))
    if (histData[id]) return
    setHistData((d) => ({ ...d, [id]: { loading: true } }))
    const { data: inv } = await supabase.from('invoices').select('id, invoice_number, job_total, amount_due').eq('job_id', id).eq('kind', 'invoice').maybeSingle()
    let items = []
    if (inv) {
      const { data } = await supabase.from('invoice_line_items').select('description, quantity, unit_price').eq('invoice_id', inv.id).order('sort_order')
      items = data || []
    }
    setHistData((d) => ({ ...d, [id]: { loading: false, invoice: inv || null, items } }))
  }

  // ---- derived / completion ----
  const occupant = tenants[0] || null
  const occupantName = occupant?.name || job?.customers?.display_name || 'Occupant'
  const occupantRel = occupant?.relationship || null
  const phoneList = Array.from(new Set([
    ...(tenants.map((t) => t.phone).filter(Boolean)),
    job?.customers?.primary_phone, job?.customers?.secondary_phone,
  ].filter(Boolean)))

  const expected = expectedSystems === '' ? equipment.length : parseInt(expectedSystems, 10) || 0
  const slotCount = Math.max(expected, equipment.length)
  const filledCount = equipment.filter(isSystemFilled).length
  const systemsFilled = slotCount > 0 && filledCount >= slotCount

  // The two money-moment capture points. Legacy photos (phase null) read as pre-repair.
  const prePhotos = photos.filter((p) => p.phase !== 'post')
  const postPhotos = photos.filter((p) => p.phase === 'post')
  // A starting-condition photo — OR a logged reason one couldn't be taken — satisfies pre-repair.
  const preRepairSatisfied = prePhotos.length > 0 || !!job?.pre_photo_skip_reason
  // "Equipment accounted for" = every system captured/documented AND pre-repair photos handled.
  const equipDone = systemsFilled && preRepairSatisfied

  // Diagnosis is blue the moment a real note exists (voice or typed) — no minimum length.
  const diagnosisDone = !!(job?.diagnosis_note && job.diagnosis_note.trim())

  const invoiceDone = !!invoice && invoiceItems > 0
  const viewSendDone = !!invoice?.sent_at
  // Before-work signature is optional; the after-work (work_finished) signature
  // or reason is what's required.
  const sigDone = approvals.some((a) => a.stage === 'work_finished')
  const planExists = !!plan
  const planSent = !!job?.plan_options_sent_at
  const maintDone = planExists || planSent
  const serviceEstDone = !!job?.service_estimate_not_needed || serviceEstItems > 0

  // ---- per-job-type matrix: which spine tasks show + what the middle gate is ----
  const jtCfg = jobTypeConfig(job?.job_type)
  const showDiagnosis = jtCfg.middle === 'diagnosis'   // repair-style
  const showChecklist = jtCfg.middle === 'checklist'   // maintenance
  const showServiceEstimate = jtCfg.showServiceEstimate
  // Maintenance uses the customer's plan-tier checklist, or Basic when no plan is on record.
  const maintChecklistName = plan?.maintenance_agreement_tiers?.name || 'Basic'
  // The middle gate that must be blue before the Service Estimate unlocks. Checklist
  // completion isn't wired until the checklist engine ships, so on Maintenance the estimate
  // unlocks after Equipment for now (flagged); it becomes the checklist gate later.
  const middleGateDone = showDiagnosis ? diagnosisDone : true

  // FORCED CHAIN: Equipment on File → [Diagnosis | Checklist] → Service Estimate, hard-gated
  // in order. A downstream task is locked (greyed, shows why) until its prerequisite goes blue.
  const diagnosisLocked = !equipDone
  const checklistLocked = !equipDone
  const serviceEstimateLocked = showDiagnosis ? !diagnosisDone : !equipDone
  const lockReason = {
    diagnosis: 'Account for the equipment first — the diagnosis needs the model and serial.',
    checklist: 'Account for the equipment first, then run the maintenance checklist.',
    service_estimate: showDiagnosis ? 'Record the diagnosis first — no quote without a diagnosis.' : 'Account for the equipment first.',
  }

  const invoiceTotal = invoice ? (invoice.amount_due ?? invoice.job_total ?? 0) : 0
  const repairLimit = job?.auth_limit_amount != null ? Number(job.auth_limit_amount) : null
  const exceedsLimit = repairLimit != null && invoiceTotal > repairLimit

  // Required tasks that drive the status pill. Warning banners do NOT count.
  const requiredDone = equipDone && middleGateDone && (showServiceEstimate ? serviceEstDone : true) && invoiceDone && viewSendDone && sigDone && maintDone
  const allClear = requiredDone && !exceedsLimit
  const status = job?.status

  // ---- GPS auto-start (best effort) + arrival diagnostics ----
  const autoStartArmed = status === 'on_my_way'
  useEffect(() => {
    if (!autoStartArmed || !job) return
    let cancelled = false
    const dbg = { armed_at: new Date().toISOString(), addr: null, geocoded: false, dest: null, fixes: 0, closest_m: null, best_acc_m: null, last_d: null, last_acc: null, last_fix_at: null, foregrounds: 0, fired: false, fired_at: null, note: '' }
    let lastWrite = 0
    const writeDbg = (force) => {
      const now = Date.now()
      if (!force && now - lastWrite < 8000) return
      lastWrite = now
      supabase.from('jobs').update({ geo_debug: dbg }).eq('id', jobId).then(() => {}, () => {})
    }
    async function arm() {
      setArrivalState('armed'); setArrivalDist(null); setGeoAcc(null); setGeoNote('')
      const addr = addressString(job.properties); const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
      dbg.addr = addr
      if (!addr || !('geolocation' in navigator)) { setArrivalState('off'); dbg.note = !addr ? 'no address on file' : 'no geolocation API'; writeDbg(true); return }
      const dest = await geocodeAddress(addr, key)
      if (cancelled) return
      if (!dest) { setArrivalState('off'); dbg.note = 'address could not be geocoded'; writeDbg(true); return }
      dbg.geocoded = true; dbg.dest = dest; writeDbg(true)
      const RING = 150 // meters; plus a slack for each fix's own accuracy
      const onFix = (pos, canFire, source) => {
        if (cancelled) return
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        const d = haversineMeters(here, dest)
        const acc = pos.coords.accuracy || 0
        setArrivalDist(Math.round(d)); setGeoAcc(Math.round(acc)); setGeoNote('')
        dbg.fixes += 1; dbg.last_d = Math.round(d); dbg.last_acc = Math.round(acc); dbg.last_fix_at = new Date().toISOString()
        if (dbg.closest_m == null || d < dbg.closest_m) dbg.closest_m = Math.round(d)
        if (dbg.best_acc_m == null || acc < dbg.best_acc_m) dbg.best_acc_m = Math.round(acc)
        // Only auto-start on a trustworthy fix within the ring (guards against a
        // wildly coarse network fix reading as "arrived"). Manual Start is always there.
        if (canFire && acc <= 500 && d <= RING + Math.min(acc, 250)) {
          dbg.fired = true; dbg.fired_at = new Date().toISOString(); dbg.note = `fired from ${source} at ${Math.round(d)}m (±${Math.round(acc)}m)`
          writeDbg(true); updateStatus('in_progress'); clearGeoWatch()
        } else { writeDbg(false) }
      }
      const onErr = (err) => {
        if (err && err.code === 1) { setArrivalState('off'); dbg.note = 'location permission denied'; writeDbg(true); return } // denied
        setGeoNote(err && err.code === 2 ? 'waiting for GPS signal' : 'still locating') // 2=unavailable, 3=timeout — keep trying
        dbg.note = err && err.code === 2 ? 'position unavailable' : 'gps timeout'; writeDbg(false)
      }
      const opts = { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
      const checkNow = (source) => navigator.geolocation.getCurrentPosition((pos) => onFix(pos, true, source), onErr, opts)
      const startWatch = () => { clearGeoWatch(); geoWatchRef.current = navigator.geolocation.watchPosition((pos) => onFix(pos, true, 'watch'), onErr, opts) }
      // Quick coarse fix for an instant distance readout, then a high-accuracy
      // check that can fire, plus the continuous watch.
      navigator.geolocation.getCurrentPosition((pos) => onFix(pos, false, 'coarse'), () => {}, { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 })
      checkNow('initial')
      startWatch()
      // iOS suspends the page (and stops the GPS watch) while the app is
      // backgrounded during the drive, and does NOT resume it on its own. Re-check
      // and restart the watch the instant the tech returns to the app — which is
      // exactly when they pull up at the destination.
      const onVisible = () => {
        if (cancelled || document.visibilityState !== 'visible') return
        dbg.foregrounds += 1; writeDbg(true)
        checkNow('foreground'); startWatch()
      }
      document.addEventListener('visibilitychange', onVisible)
      window.addEventListener('focus', onVisible)
      window.addEventListener('pageshow', onVisible)
      geoCleanupRef.current = () => {
        document.removeEventListener('visibilitychange', onVisible)
        window.removeEventListener('focus', onVisible)
        window.removeEventListener('pageshow', onVisible)
      }
    }
    arm()
    return () => { cancelled = true; clearGeoWatch(); if (geoCleanupRef.current) { geoCleanupRef.current(); geoCleanupRef.current = null } }
  }, [autoStartArmed, job?.id])
  function clearGeoWatch() { if (geoWatchRef.current != null) { navigator.geolocation.clearWatch(geoWatchRef.current); geoWatchRef.current = null } }

  // ---- nav lock: cannot leave once timing started until Stop My Time ----
  const timingLocked = status === 'in_progress'
  useEffect(() => {
    if (!timingLocked) return
    window.history.pushState(null, '', window.location.href)
    const onPop = () => { window.history.pushState(null, '', window.location.href); flashLock() }
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('popstate', onPop)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => { window.removeEventListener('popstate', onPop); window.removeEventListener('beforeunload', onBeforeUnload) }
  }, [timingLocked])
  function flashLock() { setLockHint(true); setTimeout(() => setLockHint(false), 2600) }
  function handleBack() { if (timingLocked) { flashLock(); return } navigate('/tech') }

  // ---- status transitions ----
  async function updateStatus(newStatus) {
    if (!job) return
    setSaving(true)
    const patch = { status: newStatus }
    const now = new Date().toISOString()
    if (newStatus === 'on_my_way') patch.on_my_way_at = now
    if (newStatus === 'in_progress') patch.arrival_at = now
    const { error } = await supabase.from('jobs').update(patch).eq('id', jobId)
    if (!error) {
      setJob((p) => ({ ...p, ...patch }))
      if (newStatus === 'on_my_way') {
        const sendNotify = (coords) => {
          const body = { jobId }
          if (coords) { body.techLat = coords.latitude; body.techLng = coords.longitude }
          supabase.functions.invoke('send-on-my-way-notification', { body }).catch(() => {})
          if (coords && profile?.elementsEntitled) {
            supabase.from('elements_vehicle_gps').insert({ org_id: profile.org_id, user_id: profile.id, job_id: jobId, lat: coords.latitude, lng: coords.longitude, event: 'on_my_way' }).then(() => {}, () => {})
          }
        }
        if ('geolocation' in navigator) navigator.geolocation.getCurrentPosition((pos) => sendNotify(pos.coords), () => sendNotify(null), { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 })
        else sendNotify(null)
      }
    }
    setSaving(false)
  }

  function onStopMyTime() {
    // Ends the job. If everything is clear -> Complete. Otherwise -> Incomplete (reason required).
    if (allClear) { finishJob('completed', null); return }
    setIncompleteReason(''); setStopError(''); setShowStopModal(true)
  }
  async function finishJob(finalStatus, reason) {
    setSavingStop(true)
    const { error } = await supabase.from('jobs').update({ status: finalStatus, completed_at: new Date().toISOString() }).eq('id', jobId)
    if (error) { setStopError(error.message); setSavingStop(false); return }
    if (finalStatus === 'incomplete' && reason) {
      const { data: existing } = await supabase.from('job_incomplete_records').select('id').eq('job_id', jobId).limit(1)
      if (existing && existing.length) await supabase.from('job_incomplete_records').update({ reason }).eq('id', existing[0].id)
      else await supabase.from('job_incomplete_records').insert({ org_id: job.org_id, job_id: jobId, reason })
    }
    setJob((p) => ({ ...p, status: finalStatus }))
    setSavingStop(false); setShowStopModal(false)
  }

  // ---- section actions ----
  async function uploadPhotoFiles(files) {
    if (!files.length || !job) return
    setUploading(true)
    for (const file of files) {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${job.org_id}/${jobId}/${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage.from('job-photos').upload(path, file, { contentType: file.type || 'image/jpeg' })
      if (!error) await supabase.from('attachments').insert({ org_id: job.org_id, job_id: jobId, uploaded_by: uid, file_path: path, file_name: file.name, mime_type: file.type || 'image/jpeg', file_size_bytes: file.size, category: 'photo', phase: photoPhaseRef.current })
    }
    // Capturing a starting-condition photo clears any earlier "couldn't photograph" reason.
    if (photoPhaseRef.current === 'pre' && job.pre_photo_skip_reason) {
      await supabase.from('jobs').update({ pre_photo_skip_reason: null }).eq('id', jobId)
      setJob((p) => ({ ...p, pre_photo_skip_reason: null }))
    }
    setUploading(false)
    await loadPhotos()
  }
  function capturePhoto(phase, mode) {
    photoPhaseRef.current = phase
    setOpen('equipment', phase === 'pre' ? true : isOpen('equipment'))
    ;(mode === 'upload' ? fileInputRef : cameraInputRef).current?.click()
  }
  async function handlePhotoSelect(e) {
    const files = Array.from(e.target.files || []); e.target.value = ''
    await uploadPhotoFiles(files)
  }
  async function savePrePhotoSkipReason(reason) {
    setSavingPrePhotoReason(true)
    await supabase.from('jobs').update({ pre_photo_skip_reason: reason || null }).eq('id', jobId)
    setJob((p) => ({ ...p, pre_photo_skip_reason: reason || null }))
    setSavingPrePhotoReason(false)
  }
  // ---- diagnosis (voice-to-text + manual, co-equal) ----
  async function saveDiagnosis() {
    const note = diagnosisNote.trim()
    const patch = { diagnosis_note: note || null, diagnosis_recorded_at: note ? new Date().toISOString() : null }
    const { error } = await supabase.from('jobs').update(patch).eq('id', jobId)
    if (!error) { setJob((p) => ({ ...p, ...patch })); setDiagnosisSaved(true) }
  }
  function toggleDictation() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    if (listening) { recognitionRef.current?.stop(); return }
    const rec = new SR()
    rec.lang = 'en-US'; rec.interimResults = true; rec.continuous = true
    let base = diagnosisNote ? diagnosisNote + ' ' : ''
    rec.onresult = (e) => {
      let finalTxt = '', interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) finalTxt += t; else interim += t
      }
      if (finalTxt) base += finalTxt
      setDiagnosisNote((base + interim).replace(/\s+/g, ' ').trimStart())
      setDiagnosisSaved(false)
    }
    rec.onend = () => { setListening(false); saveDiagnosis() }
    rec.onerror = () => setListening(false)
    recognitionRef.current = rec
    setListening(true)
    rec.start()
  }
  // SCAN uses the AI-scan capture; the image is saved to attachments now, AI read-out follows.
  async function handleAttachScan(e) {
    const files = Array.from(e.target.files || []); e.target.value = ''
    await uploadPhotoFiles(files)
    if (files.length) { setOpen('attachments', true); setScanNotice('AI Scan is coming soon — the image was saved to Attachments for now.') }
  }

  async function submitSignature(stage) {
    if (noSig) {
      if (!sigReason) { setSigError('Pick a reason a signature could not be captured.'); return }
      setSigError('')
      await supabase.from('job_approvals').insert({ job_id: jobId, org_id: job.org_id, stage, approved_by: approverName.trim() || sigReason, approved_at: new Date().toISOString(), amount: invoiceTotal, signature_url: null, reason: sigReason })
    } else {
      if (!approverName.trim()) { setSigError('Enter the name of the person signing.'); return }
      if (!sigData) { setSigError('Capture a signature, or check “No signature available”.'); return }
      setSigError('')
      const blob = dataUrlToBlob(sigData)
      const path = `${job.org_id}/${jobId}/${stage}-${Date.now()}.png`
      const { error: upErr } = await supabase.storage.from('signatures').upload(path, blob, { contentType: 'image/png' })
      if (upErr) { setSigError(upErr.message); return }
      await supabase.from('job_approvals').insert({ job_id: jobId, org_id: job.org_id, stage, approved_by: approverName.trim(), approved_at: new Date().toISOString(), amount: invoiceTotal, signature_url: path })
    }
    setSigningStage(null); setApproverName(''); setSigData(null); setNoSig(false); setSigReason('')
    await loadApprovals()
  }

  async function saveExpectedSystems(val) {
    if (!job?.property_id) return
    const n = val === '' ? null : parseInt(val, 10)
    if (val !== '' && (isNaN(n) || n < 0)) return
    await supabase.from('properties').update({ expected_system_count: n }).eq('id', job.property_id)
    setJob((p) => p ? { ...p, properties: { ...p.properties, expected_system_count: n } } : p)
  }
  function startEquipEdit(eq) {
    setEquipEditingId(eq.id)
    setEquipForm({ system_label: eq.system_label || '', outdoor_brand: eq.outdoor_brand || '', outdoor_model: eq.outdoor_model || '', outdoor_serial: eq.outdoor_serial || '', indoor_brand: eq.indoor_brand || '', indoor_model: eq.indoor_model || '', indoor_serial: eq.indoor_serial || '', furnace_brand: eq.furnace_brand || '', furnace_model: eq.furnace_model || '', furnace_serial: eq.furnace_serial || '', install_date: eq.install_date || '', notes: eq.notes || '', info_unavailable_reason: eq.info_unavailable_reason || '' })
    setScanMsg(''); setShowEquipForm(true); setOpen('equipment', true)
  }
  async function saveEquipment() {
    if (!job?.property_id) return
    setSavingEquip(true)
    const payload = {
      system_label: equipForm.system_label.trim() || null,
      outdoor_brand: equipForm.outdoor_brand.trim() || null, outdoor_model: equipForm.outdoor_model.trim() || null, outdoor_serial: equipForm.outdoor_serial.trim() || null,
      indoor_brand: equipForm.indoor_brand.trim() || null, indoor_model: equipForm.indoor_model.trim() || null, indoor_serial: equipForm.indoor_serial.trim() || null,
      furnace_brand: equipForm.furnace_brand.trim() || null, furnace_model: equipForm.furnace_model.trim() || null, furnace_serial: equipForm.furnace_serial.trim() || null,
      install_date: equipForm.install_date || null, notes: equipForm.notes.trim() || null,
      info_unavailable_reason: equipForm.info_unavailable_reason || null,
    }
    if (equipEditingId) await supabase.from('property_equipment').update(payload).eq('id', equipEditingId)
    else await supabase.from('property_equipment').insert({ ...payload, org_id: job.org_id, property_id: job.property_id, status: 'active' })
    setSavingEquip(false); setEquipEditingId(null); setEquipForm(blankEquip); setShowEquipForm(false); setScanMsg('')
    await loadEquipment(job.property_id)
  }
  async function deleteEquipment(id) { if (!window.confirm('Remove this equipment record?')) return; await supabase.from('property_equipment').delete().eq('id', id); loadEquipment(job.property_id) }
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result).split(',')[1])
      r.onerror = reject
      r.readAsDataURL(file)
    })
  }
  // Phone label photos are large (often 3-8 MB) and sometimes HEIC — both of which
  // fail the vision API. Draw to a canvas to cap the long edge and re-encode as a
  // clean, small JPEG. This is what makes the serial/model legible to the reader and
  // keeps the payload well under the API's per-image size limit.
  function downscaleForScan(file, maxEdge = 1600, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        try {
          const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
          const w = Math.max(1, Math.round(img.width * scale))
          const h = Math.max(1, Math.round(img.height * scale))
          const canvas = document.createElement('canvas')
          canvas.width = w; canvas.height = h
          canvas.getContext('2d').drawImage(img, 0, 0, w, h)
          canvas.toBlob((blob) => {
            URL.revokeObjectURL(url)
            if (!blob) { reject(new Error('encode failed')); return }
            const r = new FileReader()
            r.onload = () => resolve({ blob, base64: String(r.result).split(',')[1] })
            r.onerror = reject
            r.readAsDataURL(blob)
          }, 'image/jpeg', quality)
        } catch (err) { URL.revokeObjectURL(url); reject(err) }
      }
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')) }
      img.src = url
    })
  }
  // Keep the scanned label image on file (best-effort) so the data plate is documented,
  // not just the values read from it. Failure here never blocks the scan result.
  async function saveNameplatePhoto(blob, unit) {
    try {
      if (!job || !blob) return
      const label = unit.charAt(0).toUpperCase() + unit.slice(1)
      const path = `${job.org_id}/${jobId}/${crypto.randomUUID()}.jpg`
      const { error } = await supabase.storage.from('job-photos').upload(path, blob, { contentType: 'image/jpeg' })
      if (!error) {
        await supabase.from('attachments').insert({ org_id: job.org_id, job_id: jobId, uploaded_by: uid, file_path: path, file_name: `${label} nameplate.jpg`, mime_type: 'image/jpeg', file_size_bytes: blob.size, category: 'photo', phase: 'pre' })
        loadPhotos()
      }
    } catch { /* documentation is best-effort */ }
  }
  function startUnitScan(unit) { setScanTarget(unit); setScanMsg(''); setShowEquipForm(true); setOpen('equipment', true); ocrInputRef.current?.click() }
  async function onNameplateFile(e) {
    const file = e.target.files?.[0]; e.target.value = ''
    const unit = scanTarget || 'outdoor'
    if (!file) return
    setScanBusy(true); setScanMsg(`Reading ${unit} label…`)
    try {
      let imageBase64, mediaType = 'image/jpeg', photoBlob = null
      try {
        const shrunk = await downscaleForScan(file)
        imageBase64 = shrunk.base64; photoBlob = shrunk.blob
      } catch {
        // Fall back to the raw file if the canvas path is unavailable.
        imageBase64 = await fileToBase64(file); mediaType = file.type || 'image/jpeg'
      }
      const { data, error } = await supabase.functions.invoke('scan-nameplate', { body: { imageBase64, mediaType } })
      // Record the label photo regardless of how the read turned out.
      if (photoBlob) saveNameplatePhoto(photoBlob, unit)
      if (error || data?.error) { setScanMsg(data?.error || 'Scan failed — please enter the details manually.'); setScanBusy(false); return }
      setEquipForm((f) => ({
        ...f,
        [`${unit}_brand`]: data.brand || f[`${unit}_brand`],
        [`${unit}_model`]: data.model || f[`${unit}_model`],
        [`${unit}_serial`]: data.serial || f[`${unit}_serial`],
      }))
      const got = [data.brand, data.model, data.serial].filter(Boolean).length
      setScanMsg(got ? `Filled ${unit} from the label — please verify before saving.` : 'Could not read that label clearly — try a straight, well-lit close-up, or enter it manually.')
    } catch {
      setScanMsg('Scan failed — please enter the details manually.')
    }
    setScanBusy(false)
  }

  async function handleSendPlans() {
    setSendingPlans(true); setPlansMsg('')
    const { data, error } = await supabase.functions.invoke('send-agreement-options-email', { body: { propertyId: job.property_id } })
    setSendingPlans(false)
    if (error || data?.error) { setPlansMsg('Could not send — try again or send from the office.'); return }
    await supabase.from('jobs').update({ plan_options_sent_at: new Date().toISOString() }).eq('id', jobId)
    setJob((p) => ({ ...p, plan_options_sent_at: new Date().toISOString() }))
    setPlansMsg(data?.sentTo ? `Sent to ${data.sentTo}` : 'Plan options sent.')
    setOpen('maintenance', false)
  }

  function openCustEdit() {
    const a = job.properties || {}
    setCustForm({ name: occupant?.name || '', relationship: occupant?.relationship || '', street: a.street_address || '', unit: a.unit || '', city: a.city || '', state: a.state || '', zip: a.zip || '', email: job.customers?.email_1 || '', phone: occupant?.phone || '' })
    setShowCustEdit(true); setOpen('customer', true)
  }
  async function saveCustEdit() {
    setSavingCust(true)
    // occupant name + status (first tenant) + primary tenant phone
    const emailLocked = !!job.tech_email_edited_at
    const phoneLocked = !!job.tech_phone_edited_at
    const newPhone = custForm.phone.trim() || null
    const tp = { name: custForm.name.trim() || null, relationship: custForm.relationship || null }
    if (!phoneLocked) tp.phone = newPhone
    if (occupant) { await supabase.from('property_tenants').update(tp).eq('id', occupant.id) }
    else if (tp.name || tp.relationship || tp.phone) await supabase.from('property_tenants').insert({ ...tp, org_id: job.org_id, property_id: job.property_id })
    // email (customer) — one-time tech correction
    const jobPatch = {}
    if (!emailLocked) {
      const newEmail = custForm.email.trim() || null
      if (newEmail !== (job.customers?.email_1 || null)) {
        await supabase.from('customers').update({ email_1: newEmail }).eq('id', job.customer_id)
        jobPatch.tech_email_edited_at = new Date().toISOString()
        setJob((p) => ({ ...p, customers: { ...p.customers, email_1: newEmail } }))
      }
    }
    if (!phoneLocked && newPhone !== (occupant?.phone || null)) {
      jobPatch.tech_phone_edited_at = new Date().toISOString()
    }
    // address (properties)
    await supabase.from('properties').update({ street_address: custForm.street.trim() || null, unit: custForm.unit.trim() || null, city: custForm.city.trim() || null, state: custForm.state.trim() || null, zip: custForm.zip.trim() || null }).eq('id', job.property_id)
    setJob((p) => ({ ...p, ...jobPatch, properties: { ...p.properties, street_address: custForm.street.trim() || null, unit: custForm.unit.trim() || null, city: custForm.city.trim() || null, state: custForm.state.trim() || null, zip: custForm.zip.trim() || null } }))
    if (Object.keys(jobPatch).length) await supabase.from('jobs').update(jobPatch).eq('id', jobId)
    setSavingCust(false); setShowCustEdit(false)
    await loadTenants(job.property_id)
  }

  async function saveNotes() { const { error } = await supabase.from('jobs').update({ internal_notes: notes }).eq('id', jobId); if (!error) setNotesSaved(true) }

  async function markServiceEstimateNotNeeded(v) {
    await supabase.from('jobs').update({ service_estimate_not_needed: v }).eq('id', jobId)
    setJob((p) => ({ ...p, service_estimate_not_needed: v }))
    if (v) setOpen('service_estimate', false)
  }

  async function sendGoogleReview() {
    const link = (job?.customers && 'https://g.page/r/your-google-review') || 'https://g.page/r/your-google-review'
    await supabase.from('job_texts').insert({ org_id: job.org_id, job_id: jobId, to_phone: phoneList[0] || null, body: `Thanks for choosing us! Please leave a review: ${link}`, direction: 'outbound', created_by: uid })
    setGoogleMsg('Review link queued to the customer.'); setTimeout(() => setGoogleMsg(''), 2200)
  }

  if (loading || !job) {
    return (
      <div className="mobile-shell job-card-v2">
        <div className="jc-header"><button className="jc-back" onClick={() => navigate('/tech')}><IconChevronLeft /></button></div>
        <div className="jc-body"><p className="jc-muted-note">Loading…</p></div>
      </div>
    )
  }

  const { date, time } = fmtDateTime(job.start_time)
  const mapImg = streetViewUrl(job.properties)
  const dmaps = deviceMapsUrl(job.properties)
  const gmaps = googleMapsUrl(job.properties)
  const warningBanner = banners.find((b) => b.kind === 'warning')
  const messageBanner = banners.find((b) => b.kind === 'message')

  // Button flow states
  const started = status === 'in_progress'
  const enRoute = status === 'on_my_way'
  const ended = status === 'completed' || status === 'incomplete'
  const omwClass = enRoute || started || ended ? 'blue' : 'red'
  const startClass = started || ended ? 'blue' : enRoute ? 'red' : 'idle'
  const stopClass = ended ? 'blue' : started ? 'red' : 'idle'

  function TaskHead({ k, title, icon, done, actions, forceColor, locked }) {
    const color = forceColor || (done ? 'blue' : 'red')
    return (
      <div className={`jc-task-head ${color}${locked ? ' locked' : ''}`} role="button" tabIndex={0}
        style={locked ? { opacity: 0.5, filter: 'grayscale(1)', cursor: 'default' } : undefined}
        onClick={() => { if (!locked) toggle(k) }}>
        {icon}
        <span className="jc-th-title">{title}</span>
        <span className="jc-th-actions" onClick={(e) => e.stopPropagation()}>
          {!locked && actions}
          <span className={`jc-th-chevron ${isOpen(k) ? 'open' : ''}`} onClick={() => { if (!locked) toggle(k) }}>{locked ? '🔒' : '›'}</span>
        </span>
      </div>
    )
  }
  // Small greyed reason line shown right under a locked task head.
  function LockNote({ text }) {
    return <div className="jc-task" style={{ margin: '-4px 0 8px', padding: '6px 12px', fontSize: 12.5, color: 'var(--jc-muted)', display: 'flex', alignItems: 'center', gap: 6 }}><span>🔒</span><span>{text}</span></div>
  }

  return (
    <div className={`mobile-shell job-card-v2${dark ? ' jc-dark' : ''}`}>
      <div className={`jc-header${allClear ? ' is-complete' : ''}`}>
        <button className="jc-back" onClick={handleBack}><IconChevronLeft /></button>
        <div className="jc-header-text">
          <div className="jc-title">{job.job_number}{job.segment > 1 ? `-${job.segment}` : ''} — {job.customers?.display_name}</div>
          <div className="jc-sub">{date}, {time}{job.duration_hours ? ` · ${job.duration_hours}h` : ''}</div>
        </div>
        <span className={`jc-status ${allClear ? 'done' : ''}`}>{allClear ? 'Complete' : 'Incomplete'}</span>
        <button className="jc-theme-toggle" title="Light / Dark" onClick={toggleDark}>{dark ? '☀' : '☾'}</button>
      </div>

      <div className="jc-body">
        {/* Property image with dispatched banner overlays */}
        <a className="jc-property" href={dmaps || undefined} target="_blank" rel="noreferrer" style={{ pointerEvents: dmaps ? 'auto' : 'none' }}>
          {mapImg ? <img src={mapImg} alt="Property" className="jc-property-img" /> : <div className="jc-property-fallback"><IconPin /> Property photo</div>}
          {(warningBanner || messageBanner) && (
            <div className="jc-img-banners">
              {warningBanner && <div className="jc-img-banner warning">{warningBanner.body}</div>}
              {messageBanner && <div className="jc-img-banner message">{messageBanner.body}</div>}
            </div>
          )}
        </a>

        {/* Flow buttons */}
        <div className="jc-actions">
          <button className={`jc-flow-btn ${omwClass}`} disabled={status !== 'scheduled' || saving} onClick={() => updateStatus('on_my_way')}>On My Way</button>
          <button className={`jc-flow-btn ${startClass}`} disabled={status !== 'on_my_way' || saving} onClick={() => updateStatus('in_progress')}>Start My Time</button>
          <button className={`jc-flow-btn ${stopClass}`} disabled={!started || savingStop} onClick={onStopMyTime}>Stop My Time</button>
        </div>
        {enRoute && (
          <div className={`jc-arrival ${arrivalState}`}>
            <span className="jc-arrival-dot" />
            {arrivalState === 'off'
              ? 'On the way — tap Start My Time when you arrive (auto-start unavailable for this address)'
              : `On the way — auto-starts within 150 m${arrivalDist != null ? ` · ${arrivalDist} m away${geoAcc != null ? ` (±${geoAcc} m)` : ''}` : geoNote ? ` · ${geoNote}` : ' · locating…'}`}
          </div>
        )}

        <div className="jc-sections">
        {/* Customer (optional / blue, Edit only) */}
        <div className="jc-task">
          <TaskHead k="customer" title="Customer" icon={<IconPin />} done forceColor="blue"
            actions={<button className="jc-th-action" onClick={() => (showCustEdit ? setShowCustEdit(false) : openCustEdit())}>{showCustEdit ? 'Close' : 'Edit'}</button>} />
          {isOpen('customer') && (
            <div className="jc-task-body">
              {!showCustEdit ? (
                <>
                  <div className="jc-tenant-name">{occupantName}{occupantRel ? ` – ${RELATIONSHIP_LABEL[occupantRel]}` : ''}</div>
                  {job.properties?.street_address && (
                    <div className="jc-address">
                      <div className="jc-address-text">{job.properties.street_address}{job.properties.unit ? ` #${job.properties.unit}` : ''}, {job.properties.city}, {job.properties.state} {job.properties.zip}</div>
                      <div className="jc-map-icons">
                        {dmaps && <a href={dmaps} target="_blank" rel="noreferrer" title="Device maps"><IconPin /></a>}
                        {gmaps && <a className="alt" href={gmaps} target="_blank" rel="noreferrer" title="Google Maps"><IconNavigation /></a>}
                      </div>
                    </div>
                  )}
                  {phoneList.map((p) => (
                    <div key={p} className="jc-phone">
                      <span>Phone/Text</span>
                      <div className="jc-phone-icons">
                        <a className="call" href={`tel:${p}`} title="Call" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconPhone /></a>
                        <button className="text" title="Messages" onClick={() => navigate(`/tech/messages/${jobId}`)}><IconMessage /></button>
                      </div>
                    </div>
                  ))}
                  <button className="jc-btn ghost wide" style={{ marginTop: 12 }} onClick={() => navigate(`/tech/messages/${jobId}`)}>
                    <IconMessage /> Open Messages
                  </button>
                </>
              ) : (
                <>
                  <div className="jc-field"><label>Occupant name</label><input value={custForm.name} onChange={(e) => setCustForm({ ...custForm, name: e.target.value })} /></div>
                  <div className="jc-field"><label>Occupant status</label>
                    <select value={custForm.relationship} onChange={(e) => setCustForm({ ...custForm, relationship: e.target.value })}>
                      <option value="">Select…</option>
                      {RELATIONSHIP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div className="jc-field"><label>Street address</label><input value={custForm.street} onChange={(e) => setCustForm({ ...custForm, street: e.target.value })} /></div>
                  <div className="jc-field-row">
                    <div className="jc-field"><label>Unit</label><input value={custForm.unit} onChange={(e) => setCustForm({ ...custForm, unit: e.target.value })} /></div>
                    <div className="jc-field"><label>City</label><input value={custForm.city} onChange={(e) => setCustForm({ ...custForm, city: e.target.value })} /></div>
                  </div>
                  <div className="jc-field-row">
                    <div className="jc-field"><label>State</label><input value={custForm.state} onChange={(e) => setCustForm({ ...custForm, state: e.target.value })} /></div>
                    <div className="jc-field"><label>ZIP</label><input value={custForm.zip} onChange={(e) => setCustForm({ ...custForm, zip: e.target.value })} /></div>
                  </div>
                  <div className="jc-field"><label>Email address</label>
                    {job.tech_email_edited_at
                      ? <input value={job.customers?.email_1 || ''} readOnly disabled style={{ opacity: 0.7 }} />
                      : <input type="email" value={custForm.email} onChange={(e) => setCustForm({ ...custForm, email: e.target.value })} placeholder="name@example.com" />}
                    {job.tech_email_edited_at && <p className="jc-muted-note" style={{ margin: '4px 0 0' }}>Corrected — locked.</p>}
                  </div>
                  <div className="jc-field"><label>Primary phone</label>
                    {job.tech_phone_edited_at
                      ? <input value={formatPhone(occupant?.phone) || ''} readOnly disabled style={{ opacity: 0.7 }} />
                      : <input type="tel" value={custForm.phone} onChange={(e) => setCustForm({ ...custForm, phone: e.target.value })} placeholder="555-123-4567" />}
                    {job.tech_phone_edited_at && <p className="jc-muted-note" style={{ margin: '4px 0 0' }}>Corrected — locked.</p>}
                  </div>
                  <p className="jc-muted-note" style={{ marginBottom: 10 }}>Email &amp; phone can be corrected once here; the fix syncs to the office and then locks.</p>
                  <button className="jc-btn wide" disabled={savingCust} onClick={saveCustEdit}>{savingCust ? 'Saving…' : 'Save'}</button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Schedule (blue) */}
        <div className="jc-task">
          <TaskHead k="schedule" title="Schedule" icon={<IconList />} done forceColor="blue" />
          {isOpen('schedule') && (
            <div className="jc-task-body">
              <div className="jc-kv"><span>Date &amp; Time</span><strong>{date}, {time}</strong></div>
              {job.duration_hours && <div className="jc-kv"><span>Planned Duration</span><strong>{job.duration_hours} hr</strong></div>}
              {job.service_complaint && <div className="jc-kv"><span>Issue</span><strong>{job.service_complaint}</strong></div>}
              {job.trip_charge && (
                <div className="jc-kv"><span>Trip Charge</span><strong>{job.trip_charge.services?.name}{typeof job.trip_charge.price === 'number' ? ` · $${job.trip_charge.price.toFixed(2)}` : ''}</strong></div>
              )}
            </div>
          )}
        </div>

        {/* Hidden photo inputs (shared by pre- and post-repair capture) */}
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" multiple style={{ display: 'none' }} onChange={handlePhotoSelect} />
        <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handlePhotoSelect} />

        {/* ========== WORKFLOW SPINE — forced order: Equipment -> Diagnosis -> Service Estimate ========== */}

        {/* Equipment on File — the anchor: nameplates + pre-repair photos (required, first) */}
        <div className="jc-task">
          <TaskHead k="equipment" title="Equipment on File" icon={<IconShield />} done={equipDone}
            actions={<>
              <button className="jc-th-action" onClick={() => { setEquipEditingId(null); setEquipForm(blankEquip); startUnitScan('outdoor') }}>+Scan</button>
              <button className="jc-th-action" onClick={() => { setOpen('equipment', true); setShowEquipForm(true); setEquipEditingId(null); setEquipForm(blankEquip); setScanMsg('') }}>+Manual</button>
            </>} />
          <input ref={ocrInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={onNameplateFile} />
          {isOpen('equipment') && (
            <div className="jc-task-body">
              {/* Pre-repair (starting-condition) photos — required, or a logged reason */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <strong style={{ fontSize: 13 }}>Starting-condition photos{preRepairSatisfied ? '' : ' (required)'}</strong>
                  <span style={{ display: 'flex', gap: 8 }}>
                    <button className="jc-btn-sm" onClick={() => capturePhoto('pre', 'camera')}>Take</button>
                    <button className="jc-btn-sm" onClick={() => capturePhoto('pre', 'upload')}>Upload</button>
                  </span>
                </div>
                <div className="jc-photo-grid">
                  {prePhotos.map((p) => (
                    <a key={p.id} href={photoUrls[p.id] || '#'} target="_blank" rel="noreferrer" className="jc-photo">{photoUrls[p.id] ? <img src={photoUrls[p.id]} alt={p.file_name} /> : <IconCamera />}</a>
                  ))}
                  <div className="jc-photo-add" onClick={() => capturePhoto('pre', 'camera')}>+</div>
                </div>
                {prePhotos.length === 0 && (
                  <div className="jc-field" style={{ marginTop: 8 }}>
                    <label>Can&apos;t take a photo? Pick a reason — it&apos;s logged as documented</label>
                    <select value={job.pre_photo_skip_reason || ''} onChange={(e) => savePrePhotoSkipReason(e.target.value)} disabled={savingPrePhotoReason}>
                      <option value="">— I&apos;ll take a photo —</option>
                      <option value="No safe access to the unit">No safe access to the unit</option>
                      <option value="Unit or nameplate not reachable">Unit or nameplate not reachable</option>
                      <option value="Too dark or tight to photograph">Too dark or tight to photograph</option>
                      <option value="Customer declined">Customer declined</option>
                      <option value="Other">Other</option>
                    </select>
                    {job.pre_photo_skip_reason && <p className="jc-muted-note" style={{ color: 'var(--jc-blue)', marginTop: 4 }}>Documented: {job.pre_photo_skip_reason}</p>}
                  </div>
                )}
              </div>
              <div className="jc-field"><label>Number of systems</label><div className="jc-field-row"><input type="number" min="0" value={expectedSystems} onChange={(e) => setExpectedSystems(e.target.value)} onBlur={(e) => saveExpectedSystems(e.target.value)} placeholder={String(equipment.length || 0)} /></div></div>
              {Array.from({ length: slotCount }).map((_, i) => {
                const eq = equipment[i]; const filled = isSystemFilled(eq)
                if (!eq) return (
                  <div key={`e-${i}`} className="jc-system missing">
                    <div className="jc-system-top"><span className="jc-system-label">System {i + 1}</span><span className="jc-system-badge missing">Not on file</span></div>
                    <div className="jc-system-detail">Add this system&apos;s nameplate (Scan or Manual).</div>
                  </div>
                )
                return (
                  <div key={eq.id} className={`jc-system ${filled ? 'filled' : 'missing'}`}>
                    <div className="jc-system-top"><span className="jc-system-label">{eq.system_label || `System ${i + 1}`}</span><span className={`jc-system-badge ${filled ? 'filled' : 'missing'}`}>{filled ? 'Filled' : 'Incomplete'}</span></div>
                    <div className="jc-system-detail">
                      <div><strong>Outdoor:</strong> {[eq.outdoor_brand, eq.outdoor_model].filter(Boolean).join(' ') || '—'}{eq.outdoor_serial ? ` (SN: ${eq.outdoor_serial})` : ''}</div>
                      <div><strong>Indoor:</strong> {[eq.indoor_brand, eq.indoor_model].filter(Boolean).join(' ') || '—'}{eq.indoor_serial ? ` (SN: ${eq.indoor_serial})` : ''}</div>
                      <div><strong>Furnace:</strong> {[eq.furnace_brand, eq.furnace_model].filter(Boolean).join(' ') || '—'}{eq.furnace_serial ? ` (SN: ${eq.furnace_serial})` : ''}</div>
                      {eq.info_unavailable_reason && <div style={{ color: 'var(--jc-red)', fontWeight: 700, marginTop: 4 }}>Data not available: {eq.info_unavailable_reason}</div>}
                    </div>
                    <div className="jc-system-actions"><button className="jc-btn-sm" onClick={() => startEquipEdit(eq)}>Edit</button><button className="jc-btn-sm" style={{ color: 'var(--jc-red)' }} onClick={() => deleteEquipment(eq.id)}>Remove</button></div>
                  </div>
                )
              })}
              {showEquipForm && (
                <div style={{ marginTop: 12 }}>
                  {scanMsg && <p className="jc-muted-note" style={{ color: scanBusy ? 'var(--jc-muted)' : 'var(--jc-blue)', marginBottom: 10, fontWeight: 700 }}>{scanBusy ? '📷 ' : ''}{scanMsg}</p>}
                  <div className="jc-field"><label>System label</label><input value={equipForm.system_label} onChange={(e) => setEquipForm({ ...equipForm, system_label: e.target.value })} placeholder="e.g. Upstairs" /></div>
                  <div className="jc-field"><label>Install date</label><input type="date" value={equipForm.install_date} onChange={(e) => setEquipForm({ ...equipForm, install_date: e.target.value })} /></div>
                  <div className="jc-unit-head"><span>Outdoor</span><button className="jc-scan-btn" disabled={scanBusy} onClick={() => startUnitScan('outdoor')}><IconCamera /> Scan label</button></div>
                  <div className="jc-field-row"><div className="jc-field"><label>Brand</label><input value={equipForm.outdoor_brand} onChange={(e) => setEquipForm({ ...equipForm, outdoor_brand: e.target.value })} /></div><div className="jc-field"><label>Model</label><input value={equipForm.outdoor_model} onChange={(e) => setEquipForm({ ...equipForm, outdoor_model: e.target.value })} /></div></div>
                  <div className="jc-field"><label>Serial</label><input value={equipForm.outdoor_serial} onChange={(e) => setEquipForm({ ...equipForm, outdoor_serial: e.target.value })} /></div>
                  <div className="jc-unit-head"><span>Indoor</span><button className="jc-scan-btn" disabled={scanBusy} onClick={() => startUnitScan('indoor')}><IconCamera /> Scan label</button></div>
                  <div className="jc-field-row"><div className="jc-field"><label>Brand</label><input value={equipForm.indoor_brand} onChange={(e) => setEquipForm({ ...equipForm, indoor_brand: e.target.value })} /></div><div className="jc-field"><label>Model</label><input value={equipForm.indoor_model} onChange={(e) => setEquipForm({ ...equipForm, indoor_model: e.target.value })} /></div></div>
                  <div className="jc-field"><label>Serial</label><input value={equipForm.indoor_serial} onChange={(e) => setEquipForm({ ...equipForm, indoor_serial: e.target.value })} /></div>
                  <div className="jc-unit-head"><span>Furnace</span><button className="jc-scan-btn" disabled={scanBusy} onClick={() => startUnitScan('furnace')}><IconCamera /> Scan label</button></div>
                  <div className="jc-field-row"><div className="jc-field"><label>Brand</label><input value={equipForm.furnace_brand} onChange={(e) => setEquipForm({ ...equipForm, furnace_brand: e.target.value })} /></div><div className="jc-field"><label>Model</label><input value={equipForm.furnace_model} onChange={(e) => setEquipForm({ ...equipForm, furnace_model: e.target.value })} /></div></div>
                  <div className="jc-field"><label>Serial</label><input value={equipForm.furnace_serial} onChange={(e) => setEquipForm({ ...equipForm, furnace_serial: e.target.value })} /></div>
                  <div className="jc-field"><label>If details are unavailable, why?</label>
                    <select value={equipForm.info_unavailable_reason} onChange={(e) => setEquipForm({ ...equipForm, info_unavailable_reason: e.target.value })}>
                      <option value="">— Details captured above —</option>
                      <option value="Unable to read label">Unable to read label</option>
                      <option value="Data plate missing">Data plate missing</option>
                    </select>
                  </div>
                  <button className="jc-btn wide" disabled={savingEquip} onClick={saveEquipment}>{savingEquip ? 'Saving…' : equipEditingId ? 'Save Changes' : 'Add System'}</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Diagnosis (Repair-style) — locked until Equipment is done; unlocks the Service Estimate */}
        {showDiagnosis && <>
        {diagnosisLocked && <LockNote text={lockReason.diagnosis} />}
        <div className="jc-task">
          <TaskHead k="diagnosis" title="Diagnosis" icon={<IconFile />} done={diagnosisDone} locked={diagnosisLocked} />
          {!diagnosisLocked && isOpen('diagnosis') && (
            <div className="jc-task-body">
              <p className="jc-muted-note" style={{ marginBottom: 8 }}>What&apos;s wrong and why — dictate it or type it. Recording this unlocks the Service Estimate.</p>
              <textarea className="jc-notes" placeholder="Describe the diagnosis…" value={diagnosisNote} onChange={(e) => { setDiagnosisNote(e.target.value); setDiagnosisSaved(false) }} onBlur={saveDiagnosis} />
              <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {(window.SpeechRecognition || window.webkitSpeechRecognition) && (
                  <button className={`jc-btn${listening ? ' red' : ''}`} onClick={toggleDictation}>{listening ? '● Stop dictation' : '🎤 Dictate'}</button>
                )}
                <button className="jc-btn ghost" onClick={saveDiagnosis} disabled={diagnosisSaved}>Save</button>
                {!diagnosisSaved && <span className="jc-muted-note">Unsaved — saves when you tap away</span>}
                {diagnosisSaved && diagnosisDone && <span className="jc-done-line">Recorded.</span>}
              </div>
            </div>
          )}
        </div>

        </>}

        {/* Checklist (Maintenance) — replaces Diagnosis; uses the plan-tier checklist, or Basic */}
        {showChecklist && <>
        {checklistLocked && <LockNote text={lockReason.checklist} />}
        <div className="jc-task">
          <TaskHead k="checklist" title={`Checklist — ${maintChecklistName}`} icon={<IconList />} done={false} locked={checklistLocked} />
          {!checklistLocked && isOpen('checklist') && (
            <div className="jc-task-body">
              <p className="jc-muted-note">This visit uses the <strong>{maintChecklistName}</strong> maintenance checklist{plan ? ' (from the plan on record)' : ' — no plan on record, so the Basic default'}. The full checklist — its line items, required photos, and the completed copy emailed to the customer with the invoice — arrives with the checklist build. For now this is a placeholder and does not block completion.</p>
            </div>
          )}
        </div>
        </>}

        {/* Service Estimate — locked until the middle gate (diagnosis/checklist) is done */}
        {showServiceEstimate && <>
        {serviceEstimateLocked && <LockNote text={lockReason.service_estimate} />}
        <div className="jc-task">
          <TaskHead k="service_estimate" title="Service Estimate" icon={<IconFile />} done={serviceEstDone} locked={serviceEstimateLocked}
            actions={<button className="jc-th-action" onClick={() => { setOpen('service_estimate', true); if (equipDone || job.service_estimate_not_needed) navigate(`/tech/estimate/${jobId}`) }}>+Add</button>} />
          {!serviceEstimateLocked && isOpen('service_estimate') && (
            <div className="jc-task-body">
              <label className="jc-not-needed">
                <input type="checkbox" checked={!!job.service_estimate_not_needed} onChange={(e) => markServiceEstimateNotNeeded(e.target.checked)} />
                Not Needed for this job
              </label>
              {!job.service_estimate_not_needed && (
                <Link to={`/tech/estimate/${jobId}`} className="jc-action-link"><IconFile /><span>Build Service Estimate</span><span className="jc-chev">›</span></Link>
              )}
              {serviceEstimate && (
                serviceEstItems > 0 ? (
                  <button className="jc-btn red wide" style={{ marginTop: 4 }} onClick={() => navigate(`/tech/invoice-view/${serviceEstimate.id}`)}>View, Sign &amp; Send Service Estimate</button>
                ) : (
                  <p className="jc-plan-none" style={{ padding: '10px 0 2px' }}>Add at least one line item to the estimate before viewing or sending.</p>
                )
              )}
            </div>
          )}
        </div>

        </>}

        {/* ========== FREE ORDER — work these with the customer in any order ========== */}

        {/* Maintenance Agreements */}
        <div className="jc-task">
          <TaskHead k="maintenance" title="Maintenance Agreements" icon={<IconShield />} done={maintDone}
            actions={!planExists ? <button className="jc-th-action" onClick={() => { setOpen('maintenance', true); handleSendPlans() }}>{planSent ? '+Send Again' : '+Send Options'}</button> : null} />
          {isOpen('maintenance') && (
            <div className="jc-task-body">
              {planExists ? (
                <div className="jc-plan-yes">{(plan.maintenance_agreement_tiers?.name || 'PLAN').toUpperCase()} PLAN ON RECORD</div>
              ) : planSent ? (
                <div className="jc-plan-yes">PLAN OPTIONS SENT</div>
              ) : (
                <div className="jc-plan-none">CUSTOMER HAS NO PLAN ON RECORD</div>
              )}
              {!planExists && (
                <button className="jc-btn wide" disabled={sendingPlans} onClick={handleSendPlans}>{sendingPlans ? 'Sending…' : planSent ? 'Send Options Again' : 'Send Plan Options'}</button>
              )}
              {plansMsg && <p className="jc-muted-note" style={{ marginTop: 8, color: 'var(--jc-blue)' }}>{plansMsg}</p>}
            </div>
          )}
        </div>
        {/* IAQ and Checklists mount here in later builds (free-order tasks). */}

        {/* ========== WORK & BILLING — after the estimate is approved ========== */}

        {/* Completion (post-repair) photos — the hard gate before Invoice lands in the estimate/invoice build */}
        <div className="jc-task">
          <TaskHead k="completion_photos" title="Completion Photos" icon={<IconCamera />} done={postPhotos.length > 0}
            actions={<>
              <button className="jc-th-action" onClick={() => capturePhoto('post', 'camera')}>Take Photo</button>
              <button className="jc-th-action" onClick={() => capturePhoto('post', 'upload')}>Upload</button>
            </>} />
          {isOpen('completion_photos') && (
            <div className="jc-task-body">
              <p className="jc-muted-note" style={{ marginBottom: 8 }}>Photos of the finished work — proof of completion.</p>
              <div className="jc-photo-grid">
                {postPhotos.map((p) => (
                  <a key={p.id} href={photoUrls[p.id] || '#'} target="_blank" rel="noreferrer" className="jc-photo">{photoUrls[p.id] ? <img src={photoUrls[p.id]} alt={p.file_name} /> : <IconCamera />}</a>
                ))}
                <div className="jc-photo-add" onClick={() => capturePhoto('post', 'camera')}>+</div>
              </div>
            </div>
          )}
        </div>

        {/* Invoice Builder (required) */}
        <div className="jc-task">
          <TaskHead k="invoice" title="Invoice Builder" icon={<IconReceipt />} done={invoiceDone}
            actions={<button className="jc-th-action" onClick={() => navigate(`/tech/invoice/${jobId}`)}>+Add</button>} />
          {isOpen('invoice') && (
            <div className="jc-task-body">
              <Link to={`/tech/invoice/${jobId}`} className="jc-action-link"><IconReceipt /><span>Open Invoice Builder</span><span className="jc-chev">›</span></Link>
              {invoiceDone && <p className="jc-done-line">{invoiceItems} line item{invoiceItems === 1 ? '' : 's'} on invoice.</p>}
            </div>
          )}
        </div>

        {/* View & Send Invoice (required) */}
        <div className="jc-task">
          <TaskHead k="viewsend" title="View & Send Invoice" icon={<IconReceipt />} done={viewSendDone} />
          {isOpen('viewsend') && (
            <div className="jc-task-body">
              {!invoice ? <p className="jc-muted-note">No invoice yet — start it in Invoice Builder above.</p> : (
                <>
                  <div className="jc-kv"><span>Total Due</span><strong>${invoiceTotal.toFixed(2)}</strong></div>
                  <div className="jc-kv"><span>Status</span><strong>{invoice.paid_at ? 'Paid' : 'Unpaid'}{invoice.sent_at ? ' · Sent' : ''}</strong></div>
                  {exceedsLimit && <div className="jc-exceeds">⚠ Exceeds Repair Limit (${repairLimit.toFixed(2)}) — re-authorize or adjust the invoice to complete.</div>}
                  {invoiceItems > 0 ? (
                    <button className="jc-btn wide" style={{ marginTop: 10 }} onClick={() => navigate(`/tech/invoice-view/${invoice.id}`)}>View &amp; Send Invoice</button>
                  ) : (
                    <p className="jc-plan-none" style={{ padding: '10px 0 2px' }}>Add at least one service or custom item in Invoice Builder before viewing or sending. (The trip charge alone doesn&apos;t count.)</p>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Signatures (required) */}
        <div className="jc-task">
          <TaskHead k="signatures" title="Signatures" icon={<IconFile />} done={sigDone} />
          {isOpen('signatures') && (
            <div className="jc-task-body">
              {SIG_STAGES.map((s) => {
                const existing = approvals.find((a) => a.stage === s.key)
                return (
                  <div key={s.key} style={{ marginBottom: 12 }}>
                    <strong style={{ fontSize: 14 }}>{s.label}</strong>
                    {existing ? (
                      <div style={{ marginTop: 4 }}>
                        <p className="jc-muted-note">{existing.signature_url ? 'Signed' : 'Recorded'} by {existing.approved_by} · {new Date(existing.approved_at).toLocaleDateString()}</p>
                        {existing.signature_url
                          ? <ApprovalSignatureImage path={existing.signature_url} />
                          : <p className="jc-muted-note" style={{ fontStyle: 'italic' }}>No signature — {existing.reason || 'reason on file'}</p>}
                      </div>
                    ) : signingStage === s.key ? (
                      <div style={{ marginTop: 8 }}>
                        <div className="jc-field"><label>Name of signer</label><input value={approverName} onChange={(e) => setApproverName(e.target.value)} /></div>
                        <label className="jc-not-needed" style={{ marginBottom: 10 }}>
                          <input type="checkbox" checked={noSig} onChange={(e) => { setNoSig(e.target.checked); setSigData(null); setSigError('') }} />
                          No signature available
                        </label>
                        {noSig ? (
                          <div className="jc-field"><label>Reason no signature</label>
                            <select value={sigReason} onChange={(e) => setSigReason(e.target.value)}>
                              <option value="">Select a reason…</option>
                              {SIG_NO_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </div>
                        ) : (
                          <SignaturePad onChange={setSigData} />
                        )}
                        {sigError && <p style={{ color: 'var(--jc-red)', fontSize: 12.5, margin: '6px 0' }}>{sigError}</p>}
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <button className="jc-btn" onClick={() => submitSignature(s.key)}>{noSig ? 'Record Reason' : 'Save Signature'}</button>
                          <button className="jc-btn ghost" onClick={() => { setSigningStage(null); setApproverName(''); setSigData(null); setSigError(''); setNoSig(false); setSigReason('') }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div><button className="jc-btn" style={{ marginTop: 6 }} onClick={() => { setSigningStage(s.key); setApproverName(''); setNoSig(false); setSigReason('') }}>{s.label}</button></div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ========== REFERENCE ========== */}

        {/* Equipment Estimate (optional / blue) */}
        <div className="jc-task">
          <TaskHead k="equipment_estimate" title="Equipment Estimate" icon={<IconCalculator />} done forceColor="blue" />
          {isOpen('equipment_estimate') && (
            <div className="jc-task-body">
              <Link to={`/tech/system-estimate/${jobId}`} className="jc-action-link"><IconCalculator /><span>Build Equipment (System) Estimate</span><span className="jc-chev">›</span></Link>
            </div>
          )}
        </div>

        {/* Service History (optional / blue) */}
        <div className="jc-task">
          <TaskHead k="history" title="Service History" icon={<IconList />} done forceColor="blue" />
          {isOpen('history') && (
            <div className="jc-task-body">
              {history.length === 0 ? <p className="jc-muted-note">No prior visits on record for this property.</p> : history.map((h) => {
                const d = histData[h.id]
                const open = !!histOpen[h.id]
                return (
                  <div key={h.id} className="jc-hist">
                    <button className="jc-hist-row" onClick={() => toggleHistory(h)}>
                      <span className="jc-hist-title">{h.job_number}{h.segment > 1 ? `-${h.segment}` : ''} · {h.job_type || 'Service'}</span>
                      <span className="jc-hist-date">{h.start_time ? new Date(h.start_time).toLocaleDateString() : ''}</span>
                      <span className={`jc-th-chevron ${open ? 'open' : ''}`} style={{ color: 'var(--jc-muted)' }}>›</span>
                    </button>
                    {open && (
                      <div className="jc-hist-body">
                        {d?.loading ? <p className="jc-muted-note">Loading…</p>
                          : !d?.invoice ? <p className="jc-muted-note">No invoice on file for that visit.</p>
                          : (
                            <>
                              {d.items.length === 0 ? <p className="jc-muted-note">Invoice {d.invoice.invoice_number} — no line items recorded.</p> : d.items.map((li, idx) => (
                                <div key={idx} className="jc-hist-item">
                                  <span className="jc-hist-item-desc">{li.description}</span>
                                  <span className="jc-hist-item-ext">{li.quantity} × ${Number(li.unit_price).toFixed(2)}</span>
                                </div>
                              ))}
                              <div className="jc-hist-total"><span>Total</span><strong>${Number(d.invoice.amount_due ?? d.invoice.job_total ?? 0).toFixed(2)}</strong></div>
                            </>
                          )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Private Notes (optional / blue) */}
        <div className="jc-task">
          <TaskHead k="notes" title="Private Notes" icon={<IconLock />} done forceColor="blue" />
          {isOpen('notes') && (
            <div className="jc-task-body">
              <textarea className="jc-notes" placeholder="Internal notes — not visible to customer" value={notes} onChange={(e) => { setNotes(e.target.value); setNotesSaved(false) }} onBlur={saveNotes} />
              {!notesSaved && <div className="jc-muted-note" style={{ marginTop: 4 }}>Unsaved — saves when you tap away</div>}
            </div>
          )}
        </div>
        </div>{/* /jc-sections */}

        {/* Google Reviews (optional, colorful link) */}
        <button className="jc-google" onClick={sendGoogleReview}>
          <span>GOOGLE REVIEWS</span>
          <span className="stars">★★★★★</span>
        </button>
        {googleMsg && <p className="jc-muted-note" style={{ textAlign: 'center', marginTop: 8 }}>{googleMsg}</p>}
      </div>

      {/* Stop My Time — incomplete reason */}
      {showStopModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1500 }} onClick={() => !savingStop && setShowStopModal(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', width: '100%', maxWidth: 520, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 32 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 18 }}>Stopping with items still red</h3>
            <p className="jc-muted-note" style={{ marginBottom: 14 }}>This job will be sent to the office as <strong style={{ color: 'var(--jc-red)' }}>Incomplete</strong>. Pick the reason.</p>
            <select value={incompleteReason} onChange={(e) => setIncompleteReason(e.target.value)} style={{ width: '100%', padding: 12, fontSize: 16, borderRadius: 10, border: '1px solid var(--jc-line)', marginBottom: 12 }}>
              <option value="">Select a reason…</option>
              {INCOMPLETE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {stopError && <p style={{ color: 'var(--jc-red)', fontSize: 13, marginBottom: 10 }}>{stopError}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="jc-btn ghost" disabled={savingStop} onClick={() => setShowStopModal(false)}>Cancel</button>
              <button className="jc-btn red wide" disabled={savingStop || !incompleteReason} onClick={() => finishJob('incomplete', incompleteReason)}>{savingStop ? 'Saving…' : 'Stop — Mark Incomplete'}</button>
            </div>
          </div>
        </div>
      )}

      {lockHint && <div className="jc-lock-hint">Tap STOP MY TIME before leaving this job.</div>}
    </div>
  )
}
