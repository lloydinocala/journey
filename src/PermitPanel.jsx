import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'

const linkUrl = (u) => (u ? (/^https?:\/\//i.test(u) ? u : 'https://' + u) : null)

// INFO-ONLY panel shown on the System Estimate. It tells the user which building
// authority to use (with clickable links) and flags that this job needs a permit.
// The actual permitting process is worked on the dedicated Permits page.
export default function PermitPanel({ estimateId, jobId, orgId, propertyId, profile }) {
  const [enabled, setEnabled] = useState(null)
  const [authorities, setAuthorities] = useState([])
  const [permit, setPermit] = useState(null)
  const [authorityId, setAuthorityId] = useState('')
  const [manualName, setManualName] = useState('')
  const [saving, setSaving] = useState(false)

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
      if (data) { setPermit(data); setAuthorityId(data.building_authority_id || ''); setManualName(data.authority_name && !data.building_authority_id ? data.authority_name : '') }
    })
  }, [estimateId, jobId, enabled])

  if (enabled !== true) return null

  const authority = authorities.find((a) => a.id === authorityId) || null

  async function persist(newAuthorityId, newManual) {
    setSaving(true)
    const a = authorities.find((x) => x.id === newAuthorityId) || null
    const payload = {
      org_id: orgId, estimate_id: estimateId || null, job_id: jobId || null, property_id: propertyId || null,
      building_authority_id: newAuthorityId || null,
      authority_name: a ? a.name : (newManual?.trim() || null),
      updated_at: new Date().toISOString(),
    }
    if (permit?.id) {
      await supabase.from('permits').update(payload).eq('id', permit.id)
      setPermit({ ...permit, ...payload })
    } else {
      const { data } = await supabase.from('permits').insert({ ...payload, status: 'not_applied' }).select().single()
      if (data) setPermit(data)
    }
    if (newAuthorityId && jobId) await supabase.from('jobs').update({ building_authority_id: newAuthorityId }).eq('id', jobId)
    setSaving(false)
  }

  function downloadBlank() {
    if (!authority?.blank_form_path) return
    const { data } = supabase.storage.from('org-logos').getPublicUrl(authority.blank_form_path, { download: authority.blank_form_name || 'permit-application.pdf' })
    window.open(data.publicUrl, '_blank')
  }

  const L = { display: 'block', fontSize: 12, color: 'var(--mist)', marginBottom: 3 }
  const I = { padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, width: '100%' }

  return (
    <div className="section-card" style={{ padding: 16, marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>Permit</h3>
      <p style={{ fontSize: 13, color: 'var(--mist)', marginTop: 0 }}>Which building authority permits this address? This is for reference — apply for and record the permit on the <Link to="/permits">Permits page</Link>.</p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <label style={L}>Building authority</label>
          <select style={I} value={authorityId} onChange={(e) => { setAuthorityId(e.target.value); setManualName(''); persist(e.target.value, '') }}>
            <option value="">— Select or enter manually —</option>
            {authorities.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        {!authorityId && (
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={L}>…or type authority name</label>
            <input style={I} value={manualName} onChange={(e) => setManualName(e.target.value)} onBlur={() => persist('', manualName)} placeholder="One-off authority" />
          </div>
        )}
        {saving && <span style={{ fontSize: 12, color: 'var(--mist)' }}>Saving…</span>}
      </div>

      {authority && (
        <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--surface-2, #f6f7f9)', borderRadius: 8 }}>
          <div style={{ fontSize: 13, color: 'var(--mist)' }}>
            {[authority.address, authority.city, [authority.state, authority.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
            {authority.phone ? `  ·  ${authority.phone}` : ''}{authority.email ? `  ·  ${authority.email}` : ''}
          </div>
          {authority.noc_required && <div style={{ fontSize: 12.5, color: '#C8811B', fontWeight: 700, marginTop: 4 }}>⚠ Requires Notice of Commencement</div>}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {authority.website_url && <a className="logout-button" style={{ textDecoration: 'none', fontSize: 12, padding: '4px 10px' }} href={linkUrl(authority.website_url)} target="_blank" rel="noreferrer">Website ↗</a>}
            {authority.online_form_url && <a className="logout-button" style={{ textDecoration: 'none', fontSize: 12, padding: '4px 10px' }} href={linkUrl(authority.online_form_url)} target="_blank" rel="noreferrer">Online form ↗</a>}
            {authority.blank_form_path && <button className="logout-button" style={{ fontSize: 12, padding: '4px 10px' }} onClick={downloadBlank}>Download blank form ↓</button>}
            {authority.noc_url && <a className="logout-button" style={{ textDecoration: 'none', fontSize: 12, padding: '4px 10px' }} href={linkUrl(authority.noc_url)} target="_blank" rel="noreferrer">NOC form ↗</a>}
          </div>
        </div>
      )}
    </div>
  )
}
