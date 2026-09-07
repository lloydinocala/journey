import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'

// Shown on the System Estimate ONLY to record which building authority permits this
// address. Everything else (links, applying, recording) lives on the Permits page.
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
    supabase.from('building_authorities').select('id, name').eq('org_id', orgId).eq('is_active', true).order('name').then(({ data }) => setAuthorities(data || []))
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

  const I = { padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, width: '100%' }

  return (
    <div className="section-card" style={{ padding: 16, marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>Permit — Building Authority</h3>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--mist)', marginBottom: 3 }}>Which authority permits this address?</label>
          <select style={I} value={authorityId} onChange={(e) => { setAuthorityId(e.target.value); setManualName(''); persist(e.target.value, '') }}>
            <option value="">— Select or enter manually —</option>
            {authorities.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        {!authorityId && (
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--mist)', marginBottom: 3 }}>…or type a one-off</label>
            <input style={I} value={manualName} onChange={(e) => setManualName(e.target.value)} onBlur={() => persist('', manualName)} placeholder="One-off authority" />
          </div>
        )}
        {saving && <span style={{ fontSize: 12, color: 'var(--mist)' }}>Saving…</span>}
      </div>
    </div>
  )
}
