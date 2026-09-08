import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import { createPurchaseOrder, updatePurchaseOrder } from './modules/elements-hvac/data'

const AHRI_URL = 'https://www.ahridirectory.org/'
const SEJDA_URL = 'https://www.sejda.com/pdf-editor'
const linkUrl = (u) => (u ? (/^https?:\/\//i.test(u) ? u : 'https://' + u) : null)
const money = (v) => (v == null || v === '' ? '—' : '$' + Number(v).toFixed(2))
const L = { display: 'block', fontSize: 11.5, color: 'var(--mist)', marginBottom: 3 }
const I = { padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 8, width: '100%', boxSizing: 'border-box' }

function StepCard({ n, current, title, children, onNext, onSave, saving, nextLabel }) {
  const locked = n > current
  return (
    <div className="section-card" style={{ padding: 16, marginBottom: 14, opacity: locked ? 0.45 : 1, pointerEvents: locked ? 'none' : 'auto', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>Step {n}: {title} {n < current && <span style={{ color: '#1a7f37', fontSize: 12 }}>✓</span>}</h3>
        {locked && <span style={{ fontSize: 11, color: 'var(--mist)' }}>🔒 locked</span>}
      </div>
      {!locked && (
        <>
          {children}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {onSave && <button className="logout-button" disabled={saving} onClick={onSave}>Save</button>}
            {onNext && n === current && <button className="auth-button" style={{ width: 'auto' }} disabled={saving} onClick={onNext}>{nextLabel || 'Next Step →'}</button>}
          </div>
        </>
      )}
    </div>
  )
}

export default function PermitWorkflow({ profile }) {
  const { packageId } = useParams()
  const nav = useNavigate()
  const [pkg, setPkg] = useState(null)
  const [permits, setPermits] = useState([])
  const [authority, setAuthority] = useState(null)
  const [county, setCounty] = useState(null)
  const [property, setProperty] = useState(null)
  const [customer, setCustomer] = useState(null)
  const [estimate, setEstimate] = useState(null)
  const [job, setJob] = useState(null)
  const [inspections, setInspections] = useState([])
  const [vendors, setVendors] = useState([])
  const [vendorBrandMap, setVendorBrandMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const orgId = profile.org_id

  useEffect(() => { load() }, [packageId])

  async function load() {
    setLoading(true)
    const { data: p } = await supabase.from('permit_packages').select('*').eq('id', packageId).single()
    if (!p) { setLoading(false); return }
    setPkg(p)
    const [{ data: prm }, { data: auth }, { data: prop }, { data: cust }, { data: est }, { data: vend }, { data: vbrands }] = await Promise.all([
      supabase.from('permits').select('*').eq('package_id', packageId).order('system_label'),
      p.building_authority_id ? supabase.from('building_authorities').select('*').eq('id', p.building_authority_id).single() : Promise.resolve({ data: null }),
      p.property_id ? supabase.from('properties').select('*').eq('id', p.property_id).single() : Promise.resolve({ data: null }),
      p.customer_id ? supabase.from('customers').select('id, display_name, primary_phone, secondary_phone').eq('id', p.customer_id).single() : Promise.resolve({ data: null }),
      p.estimate_id ? supabase.from('invoices').select('id, invoice_number, spawned_job_id, converted_to_job_id, job_total').eq('id', p.estimate_id).single() : Promise.resolve({ data: null }),
      supabase.from('vendors').select('id, name, phone').eq('org_id', p.org_id).eq('is_active', true).order('name'),
      supabase.from('vendor_brands').select('vendor_id, brand, is_preferred').eq('org_id', p.org_id),
    ])
    const bmap = {}
    ;(vbrands || []).forEach((r) => {
      const k = (r.brand || '').trim().toUpperCase(); if (!k) return
      const e = bmap[k] || (bmap[k] = { preferred: null, ids: [] })
      e.ids.push(r.vendor_id); if (r.is_preferred) e.preferred = r.vendor_id
    })
    setVendorBrandMap(bmap)
    const seeded = (prm || []).map((pm) => {
      if (pm.act_vendor_id || !pm.req_brand) return pm
      const info = bmap[(pm.req_brand || '').trim().toUpperCase()]
      if (!info) return pm
      const pick = info.preferred || (info.ids.length === 1 ? info.ids[0] : '')
      return pick ? { ...pm, act_vendor_id: pick, _vendorAutofilled: true } : pm
    })
    setPermits(seeded); setAuthority(auth); setProperty(prop); setCustomer(cust); setEstimate(est); setVendors(vend || [])
    if (auth?.county_id) { const { data: c } = await supabase.from('counties').select('*').eq('id', auth.county_id).single(); setCounty(c) }
    const jobId0 = est?.spawned_job_id || est?.converted_to_job_id || p.job_id
    if (jobId0) { const { data: j } = await supabase.from('jobs').select('id, job_number, status').eq('id', jobId0).single(); setJob(j) }
    const { data: insp } = await supabase.from('permit_inspections').select('*').eq('package_id', packageId).order('created_at')
    setInspections(insp || [])
    setLoading(false)
  }

  async function advance(toStep) {
    setSaving(true)
    await supabase.from('permit_packages').update({ current_step: Math.max(pkg.current_step, toStep), updated_at: new Date().toISOString() }).eq('id', pkg.id)
    setPkg({ ...pkg, current_step: Math.max(pkg.current_step, toStep) })
    setSaving(false)
  }
  async function savePermit(id, patch) {
    setSaving(true)
    await supabase.from('permits').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
    setPermits((ps) => ps.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    setSaving(false)
  }
  function setPermitLocal(id, patch) { setPermits((ps) => ps.map((x) => (x.id === id ? { ...x, ...patch } : x))) }

  async function addSystem() {
    const { data } = await supabase.from('permits').insert({
      org_id: orgId, package_id: pkg.id, estimate_id: pkg.estimate_id, property_id: pkg.property_id,
      building_authority_id: pkg.building_authority_id, system_label: `System ${permits.length + 1}`, status: 'not_applied',
    }).select().single()
    if (data) setPermits((ps) => [...ps, data])
  }

  // ---- Step 1: order equipment + PO ----
  async function placeOrder(pm) {
    setSaving(true)
    const jobName = `${customer?.display_name || 'Install'} — permit`
    const notes = [`Condenser: ${pm.act_condenser_model || pm.req_condenser_model || ''}`, `AHU/Coil: ${pm.act_ahu_model || pm.req_ahu_model || ''}`, `Furnace: ${pm.act_furnace_model || pm.req_furnace_model || ''}`, `AHRI: ${pm.act_ahri || pm.req_ahri || ''}`, `Cost: ${money(pm.act_cost)}`].join('\n')
    const { po, error } = await createPurchaseOrder(orgId, { vendor_id: pm.act_vendor_id || null, expected_at: pm.act_available_date || null, job_name: jobName, notes, lines: [] })
    if (error) { setSaving(false); alert(error.message); return }
    await updatePurchaseOrder(orgId, po.id, { status: 'ordered', ordered_at: new Date().toISOString() })
    await savePermit(pm.id, { po_id: po.id, permit_number: pm.permit_number || null })
    await supabase.from('permits').update({ notes: (pm.notes || '') }).eq('id', pm.id)
    setPermitLocal(pm.id, { po_id: po.id, po_number: po.po_number })
    setSaving(false)
    alert(`PO ${po.po_number} created and marked ordered.`)
  }

  // ---- file upload to the active-package bucket ----
  async function uploadDoc(pm, kind, file, pathField) {
    setSaving(true)
    const path = `${orgId}/${pkg.id}/${kind}-${pm.id}.pdf`
    const up = await supabase.storage.from('permit-packages').upload(path, file, { upsert: true, contentType: 'application/pdf' })
    if (up.error) { setSaving(false); alert(up.error.message); return }
    await savePermit(pm.id, { [pathField]: path })
    setSaving(false)
  }
  async function viewDoc(path, name) {
    const { data } = await supabase.storage.from('permit-packages').createSignedUrl(path, 300, { download: name || 'document.pdf' })
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  // ---- Step 2: confirm/schedule the (already spawned) job ----
  async function confirmJob() {
    const jobId = estimate?.spawned_job_id || estimate?.converted_to_job_id || pkg.job_id
    setSaving(true)
    await supabase.from('permit_packages').update({ job_id: jobId || null, confirmed_job_date: pkg.confirmed_job_date || null, current_step: Math.max(pkg.current_step, 3), updated_at: new Date().toISOString() }).eq('id', pkg.id)
    if (jobId && pkg.confirmed_job_date) await supabase.from('jobs').update({ job_date: pkg.confirmed_job_date }).eq('id', jobId)
    setPkg({ ...pkg, job_id: jobId, current_step: Math.max(pkg.current_step, 3) })
    setSaving(false)
  }

  // ---- Step 4: appraiser data -> property ----
  async function saveProperty(patch) {
    setSaving(true)
    await supabase.from('properties').update(patch).eq('id', property.id)
    setProperty({ ...property, ...patch })
    setSaving(false)
  }

  async function reloadInspections() {
    const { data } = await supabase.from('permit_inspections').select('*').eq('package_id', packageId).order('created_at')
    setInspections(data || [])
  }
  async function markInstallComplete() {
    if (!window.confirm('Mark the install complete for permitting? This lets you schedule inspections. It does NOT change the install job\'s status in dispatch.')) return
    setSaving(true)
    const ts = new Date().toISOString()
    await supabase.from('permit_packages').update({ install_completed_at: ts, updated_at: ts }).eq('id', pkg.id)
    setPkg((x) => ({ ...x, install_completed_at: ts })); setSaving(false)
  }
  async function undoInstallComplete() {
    setSaving(true)
    await supabase.from('permit_packages').update({ install_completed_at: null, updated_at: new Date().toISOString() }).eq('id', pkg.id)
    setPkg((x) => ({ ...x, install_completed_at: null })); setSaving(false)
  }
  async function scheduleInspection(pm, date, isReschedule) {
    if (!date) return
    setSaving(true)
    await supabase.from('permit_inspections').insert({ org_id: orgId, permit_id: pm.id, package_id: pkg.id, job_id: job?.id || null, scheduled_date: date, result: 'pending', is_reschedule: !!isReschedule })
    await reloadInspections(); setSaving(false)
  }
  async function setInspectionResult(insp, result) {
    setSaving(true)
    await supabase.from('permit_inspections').update({ result }).eq('id', insp.id)
    if (result === 'pass') {
      await supabase.from('permits').update({ finaled: true, status: 'closed', updated_at: new Date().toISOString() }).eq('id', insp.permit_id)
      // if every permit in the package is now finaled, complete the package
      const { data: prm } = await supabase.from('permits').select('id, finaled').eq('package_id', pkg.id)
      if ((prm || []).length && prm.every((x) => x.finaled)) {
        await supabase.from('permit_packages').update({ status: 'complete', updated_at: new Date().toISOString() }).eq('id', pkg.id)
        setPkg({ ...pkg, status: 'complete' })
      }
      setPermits((ps) => ps.map((x) => (x.id === insp.permit_id ? { ...x, finaled: true, status: 'closed' } : x)))
    }
    await reloadInspections(); setSaving(false)
  }

  if (loading) return <div style={{ maxWidth: 1000, margin: '0 auto' }}><p style={{ color: 'var(--mist)' }}>Loading…</p></div>
  if (!pkg) return <div style={{ maxWidth: 1000, margin: '0 auto' }}><p>Package not found. <Link to="/permits">Back to Permits</Link></p></div>

  const cur = pkg.current_step
  const jobId = estimate?.spawned_job_id || estimate?.converted_to_job_id || pkg.job_id
  const propAddr = property ? [property.street_address, property.city, [property.state, property.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ') : ''

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <Link to="/permits" style={{ fontSize: 13, color: '#2E7FC4', textDecoration: 'none' }}>← Permits</Link>
          <h2 style={{ margin: '4px 0 0' }}>{estimate?.invoice_number || 'Permit Package'} · {customer?.display_name || ''}</h2>
          <div style={{ fontSize: 13, color: 'var(--mist)' }}>{propAddr}{authority ? `  ·  ${authority.name}` : '  ·  no authority set'}</div>
        </div>
      </div>

      {/* STEP 1 — Order equipment / PO */}
      <StepCard n={1} current={cur} title="Order Equipment / Verify Availability" onNext={() => advance(2)} saving={saving}>
        {permits.map((pm) => (
          <div key={pm.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{pm.system_label} {pm.po_number && <span style={{ color: '#1a7f37', fontWeight: 400 }}>· PO {pm.po_number} ordered</span>}</div>
            <div style={{ fontSize: 12, color: 'var(--mist)', marginBottom: 6 }}>Requested: {pm.req_brand} {pm.req_condenser_model} / {pm.req_ahu_model} / {pm.req_furnace_model} · AHRI {pm.req_ahri || '—'}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 180 }}>
                <label style={L}>Vendor (actual)</label>
                {(() => {
                  const info = pm.req_brand ? vendorBrandMap[(pm.req_brand || '').trim().toUpperCase()] : null
                  const carrierIds = info ? info.ids : []
                  const carriers = vendors.filter((v) => carrierIds.includes(v.id))
                  const others = vendors.filter((v) => !carrierIds.includes(v.id))
                  return (
                    <select style={I} value={pm.act_vendor_id || ''} onChange={(e) => setPermitLocal(pm.id, { act_vendor_id: e.target.value, _vendorAutofilled: false })}>
                      <option value="">—</option>
                      {carriers.length > 0 ? (
                        <>
                          <optgroup label={`Carries ${pm.req_brand}`}>
                            {carriers.map((v) => <option key={v.id} value={v.id}>{info.preferred === v.id ? '★ ' : ''}{v.name}</option>)}
                          </optgroup>
                          <optgroup label="Other vendors">
                            {others.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                          </optgroup>
                        </>
                      ) : (
                        vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)
                      )}
                    </select>
                  )
                })()}
                {(() => {
                  if (!pm.req_brand) return null
                  const info = vendorBrandMap[(pm.req_brand || '').trim().toUpperCase()]
                  const base = { fontSize: 11, marginTop: 3 }
                  if (!info) return <div style={{ ...base, color: 'var(--mist)' }}>No vendor tagged for {pm.req_brand}</div>
                  if (info.preferred) return <div style={{ ...base, color: '#1a7f37' }}>{pm._vendorAutofilled ? 'Auto-filled — ' : ''}preferred for {pm.req_brand}</div>
                  if (info.ids.length === 1) return <div style={{ ...base, color: '#1a7f37' }}>{pm._vendorAutofilled ? 'Auto-filled — ' : ''}only vendor for {pm.req_brand}</div>
                  return <div style={{ ...base, color: '#B8860B' }}>{info.ids.length} vendors carry {pm.req_brand} — pick one</div>
                })()}
              </div>
              <div style={{ width: 150 }}><label style={L}>Condenser (actual)</label><input style={I} value={pm.act_condenser_model || ''} onChange={(e) => setPermitLocal(pm.id, { act_condenser_model: e.target.value })} placeholder={pm.req_condenser_model || ''} /></div>
              <div style={{ width: 150 }}><label style={L}>AHU/Coil (actual)</label><input style={I} value={pm.act_ahu_model || ''} onChange={(e) => setPermitLocal(pm.id, { act_ahu_model: e.target.value })} placeholder={pm.req_ahu_model || ''} /></div>
              <div style={{ width: 150 }}><label style={L}>Furnace (actual)</label><input style={I} value={pm.act_furnace_model || ''} onChange={(e) => setPermitLocal(pm.id, { act_furnace_model: e.target.value })} placeholder={pm.req_furnace_model || ''} /></div>
              <div style={{ width: 110 }}><label style={L}>Cost (incl tax)</label><input style={I} type="number" step="0.01" value={pm.act_cost ?? ''} onChange={(e) => setPermitLocal(pm.id, { act_cost: e.target.value })} /></div>
              <div style={{ width: 150 }}><label style={L}>Available date</label><input style={I} type="date" value={pm.act_available_date || ''} onChange={(e) => setPermitLocal(pm.id, { act_available_date: e.target.value })} /></div>
              <div style={{ width: 150 }}><label style={L}>AHRI (actual)</label><input style={I} value={pm.act_ahri || ''} onChange={(e) => setPermitLocal(pm.id, { act_ahri: e.target.value })} placeholder={pm.req_ahri || ''} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="logout-button" style={{ fontSize: 12 }} disabled={saving} onClick={() => savePermit(pm.id, { act_vendor_id: pm.act_vendor_id || null, act_condenser_model: pm.act_condenser_model || null, act_ahu_model: pm.act_ahu_model || null, act_furnace_model: pm.act_furnace_model || null, act_cost: pm.act_cost === '' ? null : pm.act_cost, act_available_date: pm.act_available_date || null, act_ahri: pm.act_ahri || null })}>Save actual</button>
              <button className="auth-button" style={{ width: 'auto', fontSize: 12 }} disabled={saving || pm.po_id} onClick={() => placeOrder(pm)}>{pm.po_id ? 'Ordered ✓' : 'Place order (create PO)'}</button>
            </div>
          </div>
        ))}
        <button className="logout-button" style={{ fontSize: 12, marginTop: 10 }} onClick={addSystem}>+ Add a second system</button>
      </StepCard>

      {/* STEP 2 — Create / confirm job */}
      <StepCard n={2} current={cur} title="Job / Verify With Customer" onNext={confirmJob} saving={saving} nextLabel="Confirm & Next Step →">
        <div style={{ fontSize: 13, marginBottom: 8 }}>Install job (created at approval): <strong>{jobId ? 'linked' : 'none found'}</strong>{customer?.primary_phone ? `  ·  Customer: ${customer.primary_phone}` : ''}</div>
        <div style={{ width: 200 }}><label style={L}>Confirmed job date</label><input style={I} type="date" value={pkg.confirmed_job_date || ''} onChange={(e) => setPkg({ ...pkg, confirmed_job_date: e.target.value })} /></div>
      </StepCard>

      {/* STEP 3 — AHRI verify + certificate */}
      <StepCard n={3} current={cur} title="AHRI Verification / Certificate" onNext={() => advance(4)} saving={saving}>
        <a className="logout-button" style={{ textDecoration: 'none', fontSize: 12 }} href={AHRI_URL} target="_blank" rel="noreferrer">Open AHRI Directory ↗</a>
        {permits.map((pm) => (
          <div key={pm.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 10, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{pm.system_label}</div>
            <div style={{ width: 160 }}><label style={L}>AHRI #</label><input style={I} value={pm.act_ahri || ''} onChange={(e) => setPermitLocal(pm.id, { act_ahri: e.target.value })} onBlur={() => savePermit(pm.id, { act_ahri: pm.act_ahri || null })} /></div>
            {pm.ahri_cert_path && <button className="logout-button" style={{ fontSize: 12 }} onClick={() => viewDoc(pm.ahri_cert_path, 'ahri.pdf')}>View cert ↓</button>}
            <label className="logout-button" style={{ fontSize: 12, cursor: 'pointer' }}>{pm.ahri_cert_path ? 'Replace cert' : 'Upload AHRI cert'}<input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={(e) => e.target.files[0] && uploadDoc(pm, 'ahri', e.target.files[0], 'ahri_cert_path')} /></label>
          </div>
        ))}
      </StepCard>

      {/* STEP 4 — Property appraiser */}
      <StepCard n={4} current={cur} title="Property Appraiser / Property Card"
        onNext={async () => { await saveProperty({ parcel_number: property.parcel_number || null, legal_sec: property.legal_sec || null, legal_twp: property.legal_twp || null, legal_rge: property.legal_rge || null, legal_unit: property.legal_unit || null, legal_blk: property.legal_blk || null, legal_lot: property.legal_lot || null, subdivision: property.subdivision || null, appraiser_owner_name: property.appraiser_owner_name || null, appraiser_owner_address: property.appraiser_owner_address || null, appraiser_owner_phone: property.appraiser_owner_phone || null, appraiser_owner_email: property.appraiser_owner_email || null }); advance(5) }} saving={saving}>
        {county?.property_appraiser_url && <a className="logout-button" style={{ textDecoration: 'none', fontSize: 12 }} href={linkUrl(county.property_appraiser_url)} target="_blank" rel="noreferrer">Open {county.name} Appraiser ↗</a>}
        {property ? (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              <div style={{ width: 180 }}><label style={L}>Parcel #</label><input style={I} value={property.parcel_number || ''} onChange={(e) => setProperty({ ...property, parcel_number: e.target.value })} /></div>
              <div style={{ flex: 1, minWidth: 220 }}><label style={L}>Subdivision</label><input style={I} value={property.subdivision || ''} onChange={(e) => setProperty({ ...property, subdivision: e.target.value })} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {['legal_sec','legal_twp','legal_rge','legal_unit','legal_blk','legal_lot'].map((f) => (
                <div key={f} style={{ width: 70 }}><label style={L}>{f.replace('legal_','').toUpperCase()}</label><input style={I} value={property[f] || ''} onChange={(e) => setProperty({ ...property, [f]: e.target.value })} /></div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              <div style={{ flex: 1, minWidth: 200 }}><label style={L}>Owner name (if not the customer)</label><input style={I} value={property.appraiser_owner_name || ''} onChange={(e) => setProperty({ ...property, appraiser_owner_name: e.target.value })} /></div>
              <div style={{ flex: 1, minWidth: 200 }}><label style={L}>Owner address</label><input style={I} value={property.appraiser_owner_address || ''} onChange={(e) => setProperty({ ...property, appraiser_owner_address: e.target.value })} /></div>
              <div style={{ width: 140 }}><label style={L}>Owner phone</label><input style={I} value={property.appraiser_owner_phone || ''} onChange={(e) => setProperty({ ...property, appraiser_owner_phone: e.target.value })} /></div>
              <div style={{ minWidth: 180 }}><label style={L}>Owner email</label><input style={I} value={property.appraiser_owner_email || ''} onChange={(e) => setProperty({ ...property, appraiser_owner_email: e.target.value })} /></div>
            </div>
          </>
        ) : <p style={{ color: 'var(--mist)' }}>No property on the estimate.</p>}
      </StepCard>

      {/* STEP 5 — Apply for permit */}
      <StepCard n={5} current={cur} title="Apply for Permit" onNext={() => advance(6)} saving={saving}>
        {authority ? (
          <div style={{ fontSize: 12.5, color: 'var(--mist)', marginBottom: 8 }}>
            <strong style={{ color: 'var(--ink)' }}>{authority.name}</strong> · {authority.phone}{authority.phone_extension ? ' x' + authority.phone_extension : ''} · {authority.email || 'no email'}
          </div>
        ) : <p style={{ color: '#C0392B', fontSize: 13 }}>No building authority set on the estimate.</p>}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {authority?.online_form_url && <a className="logout-button" style={{ textDecoration: 'none', fontSize: 12 }} href={linkUrl(authority.online_form_url)} target="_blank" rel="noreferrer">Online form ↗</a>}
          {authority?.blank_form_path && <button className="logout-button" style={{ fontSize: 12 }} onClick={async () => { const { data } = supabase.storage.from('org-logos').getPublicUrl(authority.blank_form_path, { download: authority.blank_form_name || 'application.pdf' }); window.open(data.publicUrl, '_blank') }}>Download blank ↓</button>}
          <a className="logout-button" style={{ textDecoration: 'none', fontSize: 12 }} href={SEJDA_URL} target="_blank" rel="noreferrer">Open PDF filler (Sejda) ↗</a>
        </div>
        {permits.map((pm) => (
          <div key={pm.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>{pm.system_label}</span>
            {pm.application_doc_path && <button className="logout-button" style={{ fontSize: 12 }} onClick={() => viewDoc(pm.application_doc_path, 'application.pdf')}>View ↓</button>}
            <label className="logout-button" style={{ fontSize: 12, cursor: 'pointer' }}>{pm.application_doc_path ? 'Replace application' : 'Upload completed application'}<input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={(e) => e.target.files[0] && uploadDoc(pm, 'application', e.target.files[0], 'application_doc_path')} /></label>
          </div>
        ))}
        <p style={{ fontSize: 11.5, color: 'var(--mist)', marginTop: 8 }}>Emailing/printing the full package (application + AHRI + NOC) is wired in the next phase.</p>
      </StepCard>

      {/* STEP 6 — Apply for NOC */}
      <StepCard n={6} current={cur} title="Apply for Notice of Commencement" onNext={() => advance(7)} saving={saving}>
        {authority?.noc_required ? (
          <>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {authority?.noc_url && <a className="logout-button" style={{ textDecoration: 'none', fontSize: 12 }} href={linkUrl(authority.noc_url)} target="_blank" rel="noreferrer">NOC form ↗</a>}
              <a className="logout-button" style={{ textDecoration: 'none', fontSize: 12 }} href={SEJDA_URL} target="_blank" rel="noreferrer">Open PDF filler ↗</a>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ width: 170 }}><label style={L}>Date notarized</label><input style={I} type="date" value={permits[0]?.noc_notarized_date || ''} onChange={(e) => setPermitLocal(permits[0].id, { noc_notarized_date: e.target.value })} onBlur={() => savePermit(permits[0].id, { noc_notarized_date: permits[0].noc_notarized_date || null })} /></div>
              <span style={{ fontSize: 12, color: 'var(--mist)' }}>Recorder: {county?.recorder_vendor_id ? (vendors.find((v) => v.id === county.recorder_vendor_id)?.name || '—') : 'none set on county'} — send-to-recorder wired next phase</span>
            </div>
          </>
        ) : <p style={{ color: 'var(--mist)', fontSize: 13 }}>This authority does not require a Notice of Commencement. You can skip to the next step.</p>}
      </StepCard>

      {/* STEP 7 — Receive & record permit */}
      <StepCard n={7} current={cur} title="Receive & Record Permit" onNext={() => advance(8)} saving={saving}>
        {permits.map((pm) => (
          <div key={pm.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 8, display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>{pm.system_label}</span>
            <div style={{ width: 160 }}><label style={L}>Date received</label><input style={I} type="date" value={pm.permit_received_date || ''} onChange={(e) => setPermitLocal(pm.id, { permit_received_date: e.target.value })} onBlur={() => savePermit(pm.id, { permit_received_date: pm.permit_received_date || null })} /></div>
            <div style={{ width: 160 }}><label style={L}>Permit #</label><input style={I} value={pm.permit_number || ''} onChange={(e) => setPermitLocal(pm.id, { permit_number: e.target.value })} onBlur={() => savePermit(pm.id, { permit_number: pm.permit_number || null })} /></div>
            {pm.permit_doc_path && <button className="logout-button" style={{ fontSize: 12 }} onClick={() => viewDoc(pm.permit_doc_path, 'permit.pdf')}>View ↓</button>}
            <label className="logout-button" style={{ fontSize: 12, cursor: 'pointer' }}>{pm.permit_doc_path ? 'Replace permit' : 'Upload permit'}<input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={(e) => e.target.files[0] && uploadDoc(pm, 'permit', e.target.files[0], 'permit_doc_path')} /></label>
          </div>
        ))}
      </StepCard>

      {/* STEP 8 — Print & send to job */}
      <StepCard n={8} current={cur} title="Print Permit / AHRI — Send to Job" onNext={async () => { await supabase.from('permit_packages').update({ current_step: 8, updated_at: new Date().toISOString() }).eq('id', pkg.id); alert('Permit package prep complete. It will appear for inspection once the install is completed.'); nav('/permits') }} saving={saving} nextLabel="Finish prep">
        {permits.map((pm) => (
          <div key={pm.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>{pm.system_label}</span>
            {pm.permit_doc_path ? <button className="logout-button" style={{ fontSize: 12 }} onClick={() => viewDoc(pm.permit_doc_path, 'permit.pdf')}>Print permit ↗</button> : <span style={{ fontSize: 12, color: 'var(--mist)' }}>no permit doc</span>}
            {pm.ahri_cert_path ? <button className="logout-button" style={{ fontSize: 12 }} onClick={() => viewDoc(pm.ahri_cert_path, 'ahri.pdf')}>Print AHRI ↗</button> : <span style={{ fontSize: 12, color: 'var(--mist)' }}>no AHRI cert</span>}
          </div>
        ))}
      </StepCard>

      {/* STEP 9 — Inspections (separate; only after the install is completed) */}
      <div className="section-card" style={{ padding: 16, marginBottom: 14, marginTop: 22, borderTop: '3px solid var(--border)' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Step 9: Schedule Inspections</h3>
        {!(job?.status === 'completed' || pkg?.install_completed_at) ? (
          <div>
            <p style={{ color: 'var(--mist)', fontSize: 13, margin: '0 0 10px' }}>Inspections open once the install is complete{job ? ` — install job ${job.job_number} is currently "${job.status || 'unknown'}"` : ' (no linked install job on this estimate)'}. When the equipment is installed, mark it complete to schedule inspections.</p>
            <button className="auth-button" style={{ width: 'auto', fontSize: 13, padding: '6px 16px' }} disabled={saving} onClick={markInstallComplete}>Mark install complete</button>
          </div>
        ) : (
          <>
            {pkg?.install_completed_at && job?.status !== 'completed' && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8, fontSize: 12, color: 'var(--mist)' }}>
                <span>Install marked complete {new Date(pkg.install_completed_at).toLocaleDateString()} (permitting only)</span>
                <button className="logout-button" style={{ fontSize: 11, padding: '2px 8px' }} disabled={saving} onClick={undoInstallComplete}>Undo</button>
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {authority?.inspection_scheduling_url && <a className="logout-button" style={{ textDecoration: 'none', fontSize: 12 }} href={linkUrl(authority.inspection_scheduling_url)} target="_blank" rel="noreferrer">Schedule inspection online ↗</a>}
              {authority?.phone && <span style={{ fontSize: 12, color: 'var(--mist)' }}>or call {authority.phone}{authority.phone_extension ? ' x' + authority.phone_extension : ''}</span>}
            </div>
            {permits.map((pm) => {
              const rows = inspections.filter((i) => i.permit_id === pm.id)
              const passed = rows.some((r) => r.result === 'pass')
              const pending = rows.find((r) => r.result === 'pending')
              const lastFailed = rows.length > 0 && rows[rows.length - 1].result === 'fail'
              return (
                <div key={pm.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{pm.system_label} · Permit {pm.permit_number || '—'} {passed && <span style={{ color: '#1a7f37' }}>· PASSED ✓</span>}</div>
                  {rows.map((r, idx) => (
                    <div key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6, fontSize: 13 }}>
                      <span style={{ color: 'var(--mist)', width: 90 }}>{r.is_reschedule ? 'Re-sched' : 'Scheduled'}</span>
                      <span>{r.scheduled_date || '—'}</span>
                      {r.result === 'pending' ? (
                        <>
                          <button className="auth-button" style={{ width: 'auto', fontSize: 12, padding: '3px 12px' }} disabled={saving} onClick={() => setInspectionResult(r, 'pass')}>Pass</button>
                          <button className="logout-button" style={{ fontSize: 12, padding: '3px 12px', color: '#B00020', borderColor: '#F0B4B4' }} disabled={saving} onClick={() => setInspectionResult(r, 'fail')}>Fail</button>
                        </>
                      ) : (
                        <span style={{ fontWeight: 700, color: r.result === 'pass' ? '#1a7f37' : '#C0392B' }}>{r.result === 'pass' ? 'PASS' : 'FAIL'}</span>
                      )}
                    </div>
                  ))}
                  {!passed && !pending && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 8 }}>
                      <div style={{ width: 170 }}><label style={L}>{lastFailed ? 'Re-schedule date' : 'Schedule date'}</label><input style={I} type="date" id={`insp-${pm.id}`} /></div>
                      <button className="logout-button" style={{ fontSize: 12 }} disabled={saving} onClick={() => scheduleInspection(pm, document.getElementById(`insp-${pm.id}`).value, lastFailed)}>{lastFailed ? 'Re-schedule' : 'Schedule'}</button>
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
