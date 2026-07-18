import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import SignaturePad from './SignaturePad'
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

const STAGE_LABELS = {
  work_approved_to_begin: 'Work Approved to Begin',
  work_finished: 'Work Finished',
  payment: 'Payment',
}
const STAGE_ORDER = ['work_approved_to_begin', 'work_finished', 'payment']

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
// or the Android chooser, which is however the user has their own default set).
// The other two are explicit alternatives in case that's not what they want.
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

function dataUrlToBlob(dataUrl) {
  const [meta, base64] = dataUrl.split(',')
  const mime = meta.match(/:(.*?);/)[1]
  const binary = atob(base64)
  const array = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i)
  return new Blob([array], { type: mime })
}

function ApprovalSignatureImage({ path }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!path) return
    supabase.storage.from('signatures').createSignedUrl(path, 3600).then(({ data }) => {
      if (data) setUrl(data.signedUrl)
    })
  }, [path])
  if (!url) return null
  return <img src={url} alt="Signature" style={{ maxWidth: 180, border: '1px solid var(--border)', borderRadius: 6, marginTop: 6, background: 'white' }} />
}

export default function TechJobCard({ profile }) {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

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

  const [approvals, setApprovals] = useState([])
  const [approvingStage, setApprovingStage] = useState(null)
  const [approverName, setApproverName] = useState('')
  const [signatureDataUrl, setSignatureDataUrl] = useState(null)
  const [useTypedFallback, setUseTypedFallback] = useState(false)
  const [approvalError, setApprovalError] = useState('')
  const [mapsMenuOpen, setMapsMenuOpen] = useState(false)

  const [equipment, setEquipment] = useState([])
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

  const [sendingPlans, setSendingPlans] = useState(false)
  const [plansError, setPlansError] = useState('')
  const [plansSentTo, setPlansSentTo] = useState(null)
  const [copyPlansLabel, setCopyPlansLabel] = useState('Copy Link')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data?.user?.id || null))
  }, [])

  useEffect(() => {
    loadJob()
    loadPhotos()
    loadInvoice()
    loadApprovals()
  }, [jobId])

  useEffect(() => {
    if (job?.property_id) loadEquipment(job.property_id)
  }, [job?.property_id])

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
      .order('created_at', { ascending: false })
    setEquipment(data || [])
  }

  function startEquipEdit(eq) {
    setEquipEditingId(eq.id)
    setEquipForm({
      system_label: eq.system_label || '',
      outdoor_brand: eq.outdoor_brand || '',
      outdoor_model: eq.outdoor_model || '',
      outdoor_serial: eq.outdoor_serial || '',
      indoor_brand: eq.indoor_brand || '',
      indoor_model: eq.indoor_model || '',
      indoor_serial: eq.indoor_serial || '',
      furnace_brand: eq.furnace_brand || '',
      furnace_model: eq.furnace_model || '',
      furnace_serial: eq.furnace_serial || '',
      install_date: eq.install_date || '',
      notes: eq.notes || '',
    })
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
        id, org_id, property_id, job_number, segment, status, job_date, start_time, duration_hours, job_type,
        service_complaint, internal_notes, on_my_way_at, arrival_at, completed_at,
        properties ( street_address, unit, city, state, zip ),
        customers ( display_name, spouse_name, primary_phone, secondary_phone, email_1 )
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

  async function loadApprovals() {
    const { data } = await supabase.from('job_approvals').select('*').eq('job_id', jobId).order('created_at')
    setApprovals(data || [])
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
      // Fire-and-forget — a notification hiccup should never block the tech
      // from moving the job forward, so this doesn't await or surface errors.
      if (newStatus === 'on_my_way') {
        supabase.functions.invoke('send-on-my-way-notification', { body: { jobId } }).catch(() => {})
      }
    }
    setSaving(false)
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
          org_id: job.org_id,
          job_id: jobId,
          uploaded_by: uid,
          file_path: path,
          file_name: file.name,
          mime_type: file.type || 'image/jpeg',
          file_size_bytes: file.size,
          category: 'photo',
        })
      }
    }
    setUploading(false)
    e.target.value = ''
    loadPhotos()
  }

  async function submitApproval(stage) {
    if (!approverName.trim()) return
    if (!useTypedFallback && !signatureDataUrl) {
      setApprovalError('Capture a signature, or check "Customer not present" to use a typed approval instead.')
      return
    }
    setApprovalError('')

    let signaturePath = null
    if (!useTypedFallback && signatureDataUrl) {
      const blob = dataUrlToBlob(signatureDataUrl)
      const path = `${job.org_id}/${jobId}/${stage}-${Date.now()}.png`
      const { error: uploadErr } = await supabase.storage.from('signatures').upload(path, blob, { contentType: 'image/png' })
      if (uploadErr) {
        setApprovalError(uploadErr.message)
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
      amount: invoice?.job_total ?? invoice?.amount_due ?? 0,
      signature_url: signaturePath,
    })
    setApprovingStage(null)
    setApproverName('')
    setSignatureDataUrl(null)
    setUseTypedFallback(false)
    loadApprovals()
  }

  if (loading || !job) {
    return (
      <div className="mobile-shell">
        <div className="mobile-header">
          <button className="mobile-back" onClick={() => navigate('/tech')}><IconChevronLeft /></button>
        </div>
        <div className="mobile-body"><p style={{ color: 'var(--mist)' }}>Loading…</p></div>
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

  return (
    <div className="mobile-shell">
      <div className="mobile-header job-detail-header">
        <button className="mobile-back" onClick={() => navigate('/tech')}><IconChevronLeft /></button>
        <div className="job-detail-header-text">
          <div className="job-detail-title">{job.job_number}{job.segment > 1 ? `-${job.segment}` : ''} — {customer?.display_name}</div>
          <div className="job-detail-sub">{date}, {time}{job.duration_hours ? ` · ${job.duration_hours}h` : ''}</div>
        </div>
        <span className={`status-pill status-${status}`}>{STATUS_LABEL[status] || status}</span>
      </div>

      <div className="mobile-body">
        {mapImg && (
          <a
            className="property-header"
            href={maps || undefined}
            target="_blank"
            rel="noreferrer"
            style={{ pointerEvents: maps ? 'auto' : 'none' }}
          >
            <img src={mapImg} alt="Property location" className="property-map-img" />
          </a>
        )}

        <div className="action-row-buttons">
          <button
            className="action-btn"
            disabled={status !== 'scheduled' || saving}
            onClick={() => updateStatus('on_my_way')}
          >
            On My Way
          </button>
          <button
            className="action-btn"
            disabled={status !== 'on_my_way' || saving}
            onClick={() => updateStatus('in_progress')}
          >
            Start My Time
          </button>
          <button
            className="action-btn primary"
            disabled={status !== 'in_progress' || saving}
            onClick={() => updateStatus('completed')}
          >
            Complete
          </button>
        </div>

        <div className="section-card">
          <div className="section-card-header"><span>Customer</span></div>
          <div className="section-card-body">
            <div className="customer-name">{customer?.display_name}</div>
            {customer?.spouse_name && <div className="customer-spouse">{customer.spouse_name}</div>}
            {address?.street_address && (
              <div className="address-row">
                <a
                  className="address-link"
                  href={maps || undefined}
                  target="_blank"
                  rel="noreferrer"
                  style={{ pointerEvents: maps ? 'auto' : 'none' }}
                >
                  <IconPin />
                  <span>{address.street_address}{address.unit ? ` #${address.unit}` : ''}, {address.city}, {address.state} {address.zip}</span>
                </a>
                <div className="gps-menu-wrap">
                  <button className="gps-icon-btn" title="Navigate" onClick={() => setMapsMenuOpen((v) => !v)}>
                    <IconNavigation />
                  </button>
                  {mapsMenuOpen && (
                    <>
                      <div className="gps-menu-backdrop" onClick={() => setMapsMenuOpen(false)} />
                      <div className="gps-menu">
                        {mapOptions.map((opt) => (
                          <a
                            key={opt.label}
                            href={opt.url}
                            target="_blank"
                            rel="noreferrer"
                            className="gps-menu-item"
                            onClick={() => setMapsMenuOpen(false)}
                          >
                            {opt.label}
                          </a>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
            {[customer?.primary_phone, customer?.secondary_phone].filter(Boolean).map((p) => (
              <div key={p} className="phone-row">
                <span>{p}</span>
                <div className="phone-actions">
                  <a href={`tel:${p}`} title="Call"><IconPhone /></a>
                  <a href={`sms:${p}`} title="Text"><IconMessage /></a>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="section-card">
          <div className="section-card-header"><span>Schedule</span></div>
          <div className="section-card-body">
            <div className="kv-row"><span>Date &amp; Time</span><strong>{date}, {time}</strong></div>
            {job.duration_hours && <div className="kv-row"><span>Planned Duration</span><strong>{job.duration_hours} hr</strong></div>}
            {job.service_complaint && <div className="kv-row"><span>Issue</span><strong>{job.service_complaint}</strong></div>}
          </div>
        </div>

        <div className="section-card">
          <div className="section-card-header">
            <span><IconCamera /> Photo Attachments</span>
            <button className="link-btn" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? 'Uploading…' : '+ Add'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              style={{ display: 'none' }}
              onChange={handlePhotoSelect}
            />
          </div>
          <div className="section-card-body">
            <div className="photo-grid">
              {photos.map((p) => (
                <a key={p.id} href={photoUrls[p.id] || '#'} target="_blank" rel="noreferrer" className="photo-thumb">
                  {photoUrls[p.id] ? <img src={photoUrls[p.id]} alt={p.file_name} /> : <IconCamera />}
                </a>
              ))}
              <div className="photo-add-tile" onClick={() => fileInputRef.current?.click()}>+</div>
            </div>
          </div>
        </div>

        <div className="section-card">
          <div className="section-card-header"><span>Invoice</span></div>
          <div className="section-card-body action-rows">
            <Link to={`/tech/invoice/${jobId}`} className="action-row">
              <IconReceipt /><span>Invoice Builder</span><span className="chev">›</span>
            </Link>
          </div>
        </div>

        <div className="section-card">
          <div className="section-card-header"><span><IconReceipt /> View &amp; Send</span></div>
          <div className="section-card-body">
            {!invoice ? (
              <p style={{ color: 'var(--mist)', fontSize: 13, margin: 0 }}>
                No invoice yet — open Invoice Builder above to create one first.
              </p>
            ) : (
              <>
                <div className="kv-row">
                  <span>Total Due</span>
                  <strong>${(invoice.amount_due ?? invoice.job_total ?? 0).toFixed(2)}</strong>
                </div>
                <div className="kv-row">
                  <span>Status</span>
                  <strong>{invoice.paid_at ? `Paid ${new Date(invoice.paid_at).toLocaleDateString()}` : 'Unpaid'}</strong>
                </div>
                {invoice.sent_at && (
                  <div className="kv-row"><span>Last Sent</span><strong>{new Date(invoice.sent_at).toLocaleString()}</strong></div>
                )}
                <button
                  className="action-btn primary"
                  style={{ width: '100%', marginTop: 10 }}
                  onClick={() => navigate(`/tech/invoice-view/${invoice.id}`)}
                >
                  View &amp; Send Invoice
                </button>
              </>
            )}
          </div>
        </div>

        <div className="section-card">
          <div className="section-card-header"><span>Approval Signatures</span></div>
          <div className="section-card-body">
            {STAGE_ORDER.map((stage) => {
              const existing = approvals.find((a) => a.stage === stage)
              return (
                <div key={stage} style={{ borderTop: stage === STAGE_ORDER[0] ? 'none' : '1px solid var(--border)', paddingTop: stage === STAGE_ORDER[0] ? 0 : 12, marginTop: stage === STAGE_ORDER[0] ? 0 : 12 }}>
                  <strong style={{ fontSize: 13 }}>{STAGE_LABELS[stage]}</strong>
                  {existing ? (
                    <div style={{ marginTop: 4 }}>
                      <p style={{ fontSize: 12.5, color: 'var(--mist)', margin: 0 }}>
                        Approved by {existing.approved_by} on {new Date(existing.approved_at).toLocaleDateString()} — ${existing.amount?.toFixed(2)}
                      </p>
                      {existing.signature_url ? (
                        <ApprovalSignatureImage path={existing.signature_url} />
                      ) : (
                        <p style={{ fontSize: 11.5, color: 'var(--mist)', fontStyle: 'italic' }}>Typed approval, no signature on file</p>
                      )}
                    </div>
                  ) : approvingStage === stage ? (
                    <div style={{ marginTop: 8 }}>
                      {!invoice || !(invoice.job_total || invoice.amount_due) ? (
                        <div style={{ background: 'rgba(255, 107, 107, 0.12)', border: '1px solid rgba(255, 107, 107, 0.3)', borderRadius: 8, padding: '10px 12px', marginBottom: 10, fontSize: 12.5, color: '#C0392B' }}>
                          No amount on the invoice yet — add the line items in Invoice Builder above before getting a signature, so the customer sees the real price.
                        </div>
                      ) : (
                        <div style={{ background: '#F7F9FA', borderRadius: 8, padding: '10px 12px', marginBottom: 10, textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: 'var(--mist)', textTransform: 'uppercase', letterSpacing: 0.3 }}>Amount being approved</div>
                          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--route-blue)' }}>
                            ${(invoice.job_total ?? invoice.amount_due).toFixed(2)}
                          </div>
                        </div>
                      )}
                      <input
                        type="text"
                        value={approverName}
                        onChange={(e) => setApproverName(e.target.value)}
                        placeholder="Customer name"
                        style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8, boxSizing: 'border-box', fontSize: 13 }}
                      />
                      <label style={{ display: 'block', fontSize: 12.5, marginBottom: 8, cursor: 'pointer' }}>
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
                      {approvalError && <p style={{ color: '#C0392B', fontSize: 12, marginBottom: 8 }}>{approvalError}</p>}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="action-btn primary" style={{ flex: 'none', padding: '8px 16px' }} onClick={() => submitApproval(stage)}>Confirm</button>
                        <button
                          className="action-btn"
                          style={{ flex: 'none', padding: '8px 16px', background: '#F0F1F3', color: 'var(--paper)' }}
                          onClick={() => { setApprovingStage(null); setApproverName(''); setSignatureDataUrl(null); setUseTypedFallback(false); setApprovalError('') }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button className="link-btn" style={{ display: 'block', marginTop: 6 }} onClick={() => { setApprovingStage(stage); setApproverName('') }}>Approve →</button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="section-card">
          <div className="section-card-header">
            <span>Equipment on File</span>
            <button className="link-btn" onClick={() => { setShowEquipForm(!showEquipForm); setEquipEditingId(null); setEquipForm(blankEquipForm) }}>
              {showEquipForm ? 'Close' : '+ Add'}
            </button>
          </div>
          <div className="section-card-body">
            {equipment.length === 0 && !showEquipForm && (
              <p style={{ color: 'var(--mist)', fontSize: 13, margin: 0 }}>No equipment on file for this property yet.</p>
            )}
            {equipment.map((eq) => (
              <div key={eq.id} className="line-item-card">
                <div className="line-item-desc">
                  {eq.system_label || 'System'}{eq.install_date ? ` — installed ${new Date(eq.install_date + 'T00:00:00').toLocaleDateString()}` : ''}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--mist)', lineHeight: 1.6 }}>
                  <div><strong>Outdoor:</strong> {[eq.outdoor_brand, eq.outdoor_model].filter(Boolean).join(' ') || '—'}{eq.outdoor_serial ? ` (SN: ${eq.outdoor_serial})` : ''}</div>
                  <div><strong>Indoor:</strong> {[eq.indoor_brand, eq.indoor_model].filter(Boolean).join(' ') || '—'}{eq.indoor_serial ? ` (SN: ${eq.indoor_serial})` : ''}</div>
                  <div><strong>Furnace:</strong> {[eq.furnace_brand, eq.furnace_model].filter(Boolean).join(' ') || '—'}{eq.furnace_serial ? ` (SN: ${eq.furnace_serial})` : ''}</div>
                </div>
                <div className="line-item-meta-row">
                  <span>{eq.notes || ''}</span>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="remove-item-btn" style={{ color: '#2E7FC4' }} onClick={() => startEquipEdit(eq)}>Edit</button>
                    <button className="remove-item-btn" style={{ color: '#B8720A' }} onClick={() => retireEquipment(eq)}>Retire</button>
                    <button className="remove-item-btn" onClick={() => deleteEquipment(eq.id)}>Remove</button>
                  </div>
                </div>
              </div>
            ))}

            {showEquipForm && (
              <div style={{ marginTop: equipment.length > 0 ? 12 : 0 }}>
                <div className="mobile-field">
                  <label>System Label</label>
                  <input type="text" value={equipForm.system_label} onChange={(e) => setEquipForm({ ...equipForm, system_label: e.target.value })} placeholder="e.g. Upstairs" />
                </div>
                <div className="mobile-field">
                  <label>Install Date</label>
                  <input type="date" value={equipForm.install_date} onChange={(e) => setEquipForm({ ...equipForm, install_date: e.target.value })} />
                </div>

                <p style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--mist)', textTransform: 'uppercase', margin: '10px 0 4px' }}>Outdoor Unit</p>
                <div className="mobile-field-row">
                  <div className="mobile-field"><label>Brand</label><input type="text" value={equipForm.outdoor_brand} onChange={(e) => setEquipForm({ ...equipForm, outdoor_brand: e.target.value })} /></div>
                  <div className="mobile-field"><label>Model</label><input type="text" value={equipForm.outdoor_model} onChange={(e) => setEquipForm({ ...equipForm, outdoor_model: e.target.value })} /></div>
                </div>
                <div className="mobile-field">
                  <label>Serial Number</label>
                  <input type="text" value={equipForm.outdoor_serial} onChange={(e) => setEquipForm({ ...equipForm, outdoor_serial: e.target.value })} />
                </div>

                <p style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--mist)', textTransform: 'uppercase', margin: '10px 0 4px' }}>Indoor Unit</p>
                <div className="mobile-field-row">
                  <div className="mobile-field"><label>Brand</label><input type="text" value={equipForm.indoor_brand} onChange={(e) => setEquipForm({ ...equipForm, indoor_brand: e.target.value })} /></div>
                  <div className="mobile-field"><label>Model</label><input type="text" value={equipForm.indoor_model} onChange={(e) => setEquipForm({ ...equipForm, indoor_model: e.target.value })} /></div>
                </div>
                <div className="mobile-field">
                  <label>Serial Number</label>
                  <input type="text" value={equipForm.indoor_serial} onChange={(e) => setEquipForm({ ...equipForm, indoor_serial: e.target.value })} />
                </div>

                <p style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--mist)', textTransform: 'uppercase', margin: '10px 0 4px' }}>Furnace</p>
                <div className="mobile-field-row">
                  <div className="mobile-field"><label>Brand</label><input type="text" value={equipForm.furnace_brand} onChange={(e) => setEquipForm({ ...equipForm, furnace_brand: e.target.value })} /></div>
                  <div className="mobile-field"><label>Model</label><input type="text" value={equipForm.furnace_model} onChange={(e) => setEquipForm({ ...equipForm, furnace_model: e.target.value })} /></div>
                </div>
                <div className="mobile-field">
                  <label>Serial Number</label>
                  <input type="text" value={equipForm.furnace_serial} onChange={(e) => setEquipForm({ ...equipForm, furnace_serial: e.target.value })} />
                </div>

                <div className="mobile-field">
                  <label>Notes</label>
                  <input type="text" value={equipForm.notes} onChange={(e) => setEquipForm({ ...equipForm, notes: e.target.value })} placeholder="optional" />
                </div>

                <button className="action-btn primary" style={{ width: '100%' }} disabled={savingEquip} onClick={saveEquipment}>
                  {savingEquip ? 'Saving…' : equipEditingId ? 'Save Changes' : 'Add Equipment'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="section-card">
          <div className="section-card-header"><span><IconShield /> Maintenance Plans</span></div>
          <div className="section-card-body">
            <p style={{ color: 'var(--mist)', fontSize: 12, marginTop: 0 }}>
              Sends all plan options in one email — the customer picks a tier and pays, no login required.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="action-btn primary" style={{ flex: '1 1 auto' }} onClick={handleSendPlans} disabled={sendingPlans}>
                {sendingPlans ? 'Sending…' : 'Send Plan Options'}
              </button>
              <button className="action-btn" style={{ flex: '1 1 auto', background: '#2E7FC4' }} onClick={() => window.open(plansLinkUrl(), '_blank')}>
                Open Link
              </button>
              <button className="action-btn" style={{ flex: '1 1 auto', background: '#F0F1F3', color: 'var(--paper)' }} onClick={copyPlansLink}>
                {copyPlansLabel}
              </button>
            </div>
            {plansSentTo && <p style={{ fontSize: 12, color: '#1F7A43', marginTop: 8 }}>Sent to {plansSentTo}</p>}
            {plansError && <p style={{ fontSize: 12.5, color: '#C0392B', marginTop: 8 }}>{plansError}</p>}
          </div>
        </div>

        <div className="section-card">
          <div className="section-card-header"><span>Estimates</span></div>
          <div className="section-card-body action-rows">
            <Link to={`/tech/estimate/${jobId}`} className="action-row">
              <IconFile /><span>Service Estimate</span><span className="chev">›</span>
            </Link>
            <Link to={`/tech/system-estimate/${jobId}`} className="action-row">
              <IconCalculator /><span>System Estimate</span><span className="chev">›</span>
            </Link>
          </div>
        </div>

        <div className="section-card">
          <div className="section-card-header"><span><IconLock /> Private Notes</span></div>
          <div className="section-card-body">
            <textarea
              className="private-notes"
              placeholder="Internal notes — not visible to customer"
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setNotesSaved(false) }}
              onBlur={saveNotes}
            />
            {!notesSaved && <div className="notes-hint">Unsaved — saves when you tap away</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
