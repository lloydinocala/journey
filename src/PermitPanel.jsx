import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'

const STATUSES = [
  ['not_applied', 'Not applied'],
  ['applied', 'Applied'],
  ['issued', 'Issued'],
  ['inspected', 'Inspected'],
  ['closed', 'Closed / Finaled'],
  ['not_required', 'Not required'],
]
const linkUrl = (u) => (u ? (/^https?:\/\//i.test(u) ? u : 'https://' + u) : null)
const money = (v) => '$' + (Number(v) || 0).toFixed(2)

// Full permit workflow for one job: pick the building authority, open/download its
// application, upload the completed one, email it, and record dates/number/AHRI/status.
// Renders nothing unless the org has permit tracking enabled.
export default function PermitPanel({ estimateId, jobId, orgId, propertyId, profile }) {
  const [enabled, setEnabled] = useState(null)   // org.track_permits
  const [authorities, setAuthorities] = useState([])
  const [permit, setPermit] = useState(null)
  const [f, setF] = useState({ building_authority_id: '', authority_name: '', permit_number: '', status: 'not_applied', application_date: '', issue_date: '', fee: '', ahri_number: '', notes: '' })
  const [filledFile, setFilledFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [emailing, setEmailing] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!orgId) return
    supabase.from('organizations').select('track_permits').eq('id', orgId).single().then(({ data }) => setEnabled(!!data?.track_permits))
    supabase.from('building_authorities').select('*').eq('org_id', orgId).eq('is_active', true).order('name').then(({ data }) => setAuthorities(data || []))
  }, [orgId])

  useEffect(() => {
    if (enabled !== true || (!estimateId && !jobId)) return
    let q = supabase.from('permits').select('*')
    q = estimateId ? q.eq('estimate_id', estimateId) : q.eq('job_id', jobId)
    q.order('created_at', { ascending: false }).limit(1).maybeSingle().then(({ data }) => {
      if (data) {
        setPermit(data)
        setF({ building_authority_id: data.building_authority_id || '', authority_name: data.authority_name || '', permit_number: data.permit_number || '', status: data.status || 'not_applied', application_date: data.application_date || '', issue_date: data.issue_date || '', fee: data.fee ?? '', ahri_number: data.ahri_number || '', notes: data.notes || '' })
      }
    })
  }, [estimateId, jobId, enabled])

  if (enabled !== true) return null

  const authority = authorities.find((a) => a.id === f.building_authority_id) || null

  async function save() {
    setSaving(true); setMsg('')
    const payload = {
      org_id: orgId, estimate_id: estimateId || null, job_id: jobId || null, property_id: propertyId || null,
      building_authority_id: f.building_authority_id || null,
      authority_name: authority ? authority.name : (f.authority_name.trim() || null),
      permit_number: f.permit_number.trim() || null, status: f.status,
      application_date: f.application_date || null, issue_date: f.issue_date || null,
      fee: f.fee === '' ? null : Number(f.fee), ahri_number: f.ahri_number.trim() || null,
      notes: f.notes.trim() || null, updated_at: new Date().toISOString(),
    }
    let id = permit?.id
    if (id) {
      const { error } = await supabase.from('permits').update(payload).eq('id', id)
      if (error) { setMsg(error.message); setSaving(false); return }
    } else {
      const { data, error } = await supabase.from('permits').insert(payload).select().single()
      if (error) { setMsg(error.message); setSaving(false); return }
      id = data.id; setPermit(data)
    }
    // keep the authority on the job too (so the dashboard + job know it)
    if (f.building_authority_id && jobId) await supabase.from('jobs').update({ building_authority_id: f.building_authority_id }).eq('id', jobId)
    setSaving(false); setMsg('Saved.')
    // refresh
    const { data: fresh } = await supabase.from('permits').select('*').eq('id', id).single()
    if (fresh) setPermit(fresh)
    setTimeout(() => setMsg(''), 2500)
  }

  function downloadBlank() {
    if (!authority?.blank_form_path) return
    const { data } = supabase.storage.from('org-logos').getPublicUrl(authority.blank_form_path, { download: authority.blank_form_name || 'permit-application.pdf' })
    window.open(data.publicUrl, '_blank')
  }

  async function uploadFilled() {
    if (!filledFile) return
    let id = permit?.id
    if (!id) { await save(); id = permit?.id }
    if (!id) { setMsg('Save the permit first.'); return }
    setSaving(true); setMsg('')
    const path = `permits/${orgId}/${id}.pdf`
    const up = await supabase.storage.from('job-photos').upload(path, filledFile, { upsert: true, contentType: 'application/pdf' })
    if (up.error) { setMsg(up.error.message); setSaving(false); return }
    await supabase.from('permits').update({ filled_form_path: path, filled_form_name: filledFile.name, updated_at: new Date().toISOString() }).eq('id', id)
    const { data: fresh } = await supabase.from('permits').select('*').eq('id', id).single()
    setPermit(fresh); setFilledFile(null); setSaving(false); setMsg('Completed form attached.')
    setTimeout(() => setMsg(''), 2500)
  }

  async function downloadFilled() {
    if (!permit?.filled_form_path) return
    const { data } = await supabase.storage.from('job-photos').createSignedUrl(permit.filled_form_path, 300, { download: permit.filled_form_name || 'permit.pdf' })
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function emailAuthority() {
    if (!permit?.id) { setMsg('Save the permit first.'); return }
    if (!permit.filled_form_path) { setMsg('Attach the completed form first.'); return }
    if (!authority?.email) { setMsg('This authority has no email on file.'); return }
    setEmailing(true); setMsg('')
    const { data, error } = await supabase.functions.invoke('send-permit-application', { body: { permit_id: permit.id } })
    setEmailing(false)
    if (error || data?.error) { setMsg(data?.error || error.message || 'Could not send.'); return }
    setMsg(`Sent to ${authority.email}.`)
    setTimeout(() => setMsg(''), 3000)
  }

  const L = { display: 'block', fontSize: 12, color: 'var(--mist)', marginBottom: 3 }
  const I = { padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, width: '100%' }

  return (
    <div className="section-card" style={{ padding: 16, marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>Permit</h3>

      {/* Authority */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <label style={L}>Building authority</label>
          <select style={I} value={f.building_authority_id} onChange={(e) => setF({ ...f, building_authority_id: e.target.value })}>
            <option value="">— Select or enter manually —</option>
            {authorities.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        {!f.building_authority_id && (
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={L}>…or type authority name</label>
            <input style={I} value={f.authority_name} onChange={(e) => setF({ ...f, authority_name: e.target.value })} placeholder="One-off authority" />
          </div>
        )}
      </div>

      {authority && (authority.noc_required || authority.online_form_url || authority.blank_form_path || authority.email) && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
          {authority.online_form_url && <a className="logout-button" style={{ textDecoration: 'none', fontSize: 12, padding: '5px 10px' }} href={linkUrl(authority.online_form_url)} target="_blank" rel="noreferrer">Open online form ↗</a>}
          {authority.blank_form_path && <button className="logout-button" style={{ fontSize: 12, padding: '5px 10px' }} onClick={downloadBlank}>Download blank form ↓</button>}
          {authority.noc_required && <span style={{ fontSize: 12, color: '#C8811B', fontWeight: 700 }}>⚠ Requires Notice of Commencement{authority.noc_url ? ' — ' : ''}{authority.noc_url && <a href={linkUrl(authority.noc_url)} target="_blank" rel="noreferrer">NOC form ↗</a>}</span>}
        </div>
      )}

      {/* Completed form */}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <label style={L}>Completed application / permit PDF</label>
        {permit?.filled_form_path ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="logout-button" style={{ fontSize: 12, padding: '5px 10px' }} onClick={downloadFilled}>View attached ↓</button>
            <span style={{ fontSize: 12, color: 'var(--mist)' }}>{permit.filled_form_name}</span>
            <input type="file" accept="application/pdf" onChange={(e) => setFilledFile(e.target.files[0] || null)} style={{ fontSize: 12 }} />
            {filledFile && <button className="logout-button" style={{ fontSize: 12, padding: '5px 10px' }} onClick={uploadFilled}>Replace</button>}
            <button className="auth-button" style={{ width: 'auto', fontSize: 12, padding: '5px 12px' }} disabled={emailing} onClick={emailAuthority}>{emailing ? 'Sending…' : 'Email to authority'}</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="file" accept="application/pdf" onChange={(e) => setFilledFile(e.target.files[0] || null)} style={{ fontSize: 12 }} />
            <button className="logout-button" style={{ fontSize: 12, padding: '5px 10px' }} disabled={!filledFile || saving} onClick={uploadFilled}>Attach completed form</button>
          </div>
        )}
        <div style={{ fontSize: 11.5, color: 'var(--mist)', marginTop: 4 }}>Download the blank form, fill it in your PDF app, then attach it here and email it to the authority. It's stored on the job + Customer Profile.</div>
      </div>

      {/* Record */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
        <div style={{ width: 150 }}><label style={L}>Status</label><select style={I} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div style={{ width: 150 }}><label style={L}>Permit #</label><input style={I} value={f.permit_number} onChange={(e) => setF({ ...f, permit_number: e.target.value })} /></div>
        <div style={{ width: 150 }}><label style={L}>AHRI #</label><input style={I} value={f.ahri_number} onChange={(e) => setF({ ...f, ahri_number: e.target.value })} /></div>
        <div style={{ width: 110 }}><label style={L}>Fee</label><input style={I} type="number" step="0.01" value={f.fee} onChange={(e) => setF({ ...f, fee: e.target.value })} /></div>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
        <div style={{ width: 160 }}><label style={L}>Applied</label><input style={I} type="date" value={f.application_date} onChange={(e) => setF({ ...f, application_date: e.target.value })} /></div>
        <div style={{ width: 160 }}><label style={L}>Issued</label><input style={I} type="date" value={f.issue_date} onChange={(e) => setF({ ...f, issue_date: e.target.value })} /></div>
        <div style={{ flex: 1, minWidth: 200 }}><label style={L}>Notes</label><input style={I} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14 }}>
        <button className="auth-button" style={{ width: 'auto' }} disabled={saving} onClick={save}>{saving ? 'Saving…' : permit ? 'Save permit' : 'Create permit record'}</button>
        {msg && <span style={{ fontSize: 13, color: msg === 'Saved.' || msg.startsWith('Sent') || msg.includes('attached') ? '#1a7f37' : '#C0392B' }}>{msg}</span>}
      </div>
    </div>
  )
}
