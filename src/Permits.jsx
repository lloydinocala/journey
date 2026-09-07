import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

const linkUrl = (u) => (u ? (/^https?:\/\//i.test(u) ? u : 'https://' + u) : null)
const money = (v) => (v == null || v === '' ? '—' : '$' + Number(v).toFixed(2))
const STATUSES = [
  ['not_applied', 'Not applied'], ['applied', 'Applied'], ['issued', 'Issued'],
  ['inspected', 'Inspection scheduled'], ['closed', 'Closed / Finaled'], ['not_required', 'Not required'],
]
const statusLabel = (v) => (STATUSES.find(([s]) => s === v) || [null, v])[1]

function PermitCard({ permit, onChanged }) {
  const a = permit.building_authorities
  const prop = permit.properties
  const cust = prop?.customers
  const addr = prop ? [prop.street_address, prop.city, [prop.state, prop.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ') : (permit.authority_name ? '' : '')
  const [d, setD] = useState({
    status: permit.status || 'not_applied',
    application_date: permit.application_date || '',
    permit_number: permit.permit_number || '',
    issue_date: permit.issue_date || '',
    inspection_approved_date: permit.inspection_approved_date || '',
    ahri_number: permit.ahri_number || '',
    fee: permit.fee ?? '',
    notes: permit.notes || '',
  })
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [emailing, setEmailing] = useState(false)
  const [msg, setMsg] = useState('')

  async function save() {
    setSaving(true); setMsg('')
    const { error } = await supabase.from('permits').update({
      status: d.status, application_date: d.application_date || null, permit_number: d.permit_number.trim() || null,
      issue_date: d.issue_date || null, inspection_approved_date: d.inspection_approved_date || null,
      ahri_number: d.ahri_number.trim() || null, fee: d.fee === '' ? null : Number(d.fee), notes: d.notes.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', permit.id)
    setSaving(false)
    if (error) { setMsg(error.message); return }
    setMsg('Saved.'); setTimeout(() => setMsg(''), 2000); onChanged && onChanged()
  }

  function downloadBlank() {
    if (!a?.blank_form_path) return
    const { data } = supabase.storage.from('org-logos').getPublicUrl(a.blank_form_path, { download: a.blank_form_name || 'permit-application.pdf' })
    window.open(data.publicUrl, '_blank')
  }
  async function uploadFilled() {
    if (!file) return
    setSaving(true); setMsg('')
    const path = `permits/${permit.org_id}/${permit.id}.pdf`
    const up = await supabase.storage.from('job-photos').upload(path, file, { upsert: true, contentType: 'application/pdf' })
    if (up.error) { setMsg(up.error.message); setSaving(false); return }
    await supabase.from('permits').update({ filled_form_path: path, filled_form_name: file.name, updated_at: new Date().toISOString() }).eq('id', permit.id)
    setFile(null); setSaving(false); setMsg('Completed form attached.'); setTimeout(() => setMsg(''), 2000); onChanged && onChanged()
  }
  async function downloadFilled() {
    if (!permit.filled_form_path) return
    const { data } = await supabase.storage.from('job-photos').createSignedUrl(permit.filled_form_path, 300, { download: permit.filled_form_name || 'permit.pdf' })
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }
  async function emailAuthority() {
    if (!permit.filled_form_path) { setMsg('Attach the completed form first.'); return }
    if (!a?.email) { setMsg('This authority has no email on file.'); return }
    setEmailing(true); setMsg('')
    const { data, error } = await supabase.functions.invoke('send-permit-application', { body: { permit_id: permit.id } })
    setEmailing(false)
    if (error || data?.error) { setMsg(data?.error || error.message || 'Could not send.'); return }
    setMsg(`Sent to ${a.email}.`); setTimeout(() => setMsg(''), 2500); onChanged && onChanged()
  }

  const L = { display: 'block', fontSize: 11.5, color: 'var(--mist)', marginBottom: 3 }
  const I = { padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 8, width: '100%' }

  return (
    <div className="section-card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 700 }}>{addr || permit.authority_name || 'Permit'}</div>
          <div style={{ fontSize: 13, color: 'var(--mist)' }}>
            {cust?.display_name || ''}
            {permit.jobs?.job_number ? `  ·  Job ${permit.jobs.job_number}` : ''}
          </div>
        </div>
        <span className="badge" style={{ alignSelf: 'flex-start' }}>{statusLabel(d.status)}</span>
      </div>

      {/* Authority info + clickable links */}
      <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--surface-2, #f6f7f9)', borderRadius: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{a?.name || permit.authority_name || 'No authority selected'}</div>
        {a && (
          <div style={{ fontSize: 12.5, color: 'var(--mist)', marginTop: 2 }}>
            {[a.address, a.city, [a.state, a.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
            {a.phone ? `  ·  ${a.phone}` : ''}{a.email ? `  ·  ${a.email}` : ''}
          </div>
        )}
        {a?.noc_required && <div style={{ fontSize: 12, color: '#C8811B', fontWeight: 700, marginTop: 4 }}>⚠ Requires Notice of Commencement</div>}
        {a && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {a.website_url && <a className="logout-button" style={{ textDecoration: 'none', fontSize: 12, padding: '4px 10px' }} href={linkUrl(a.website_url)} target="_blank" rel="noreferrer">Website ↗</a>}
            {a.online_form_url && <a className="logout-button" style={{ textDecoration: 'none', fontSize: 12, padding: '4px 10px' }} href={linkUrl(a.online_form_url)} target="_blank" rel="noreferrer">Online form ↗</a>}
            {a.blank_form_path && <button className="logout-button" style={{ fontSize: 12, padding: '4px 10px' }} onClick={downloadBlank}>Download blank ↓</button>}
            {a.noc_url && <a className="logout-button" style={{ textDecoration: 'none', fontSize: 12, padding: '4px 10px' }} href={linkUrl(a.noc_url)} target="_blank" rel="noreferrer">NOC form ↗</a>}
          </div>
        )}
      </div>

      {/* Completed form + email */}
      <div style={{ marginTop: 12 }}>
        <label style={L}>Completed application / permit PDF</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {permit.filled_form_path && <button className="logout-button" style={{ fontSize: 12, padding: '4px 10px' }} onClick={downloadFilled}>View attached ↓</button>}
          <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files[0] || null)} style={{ fontSize: 12 }} />
          <button className="logout-button" style={{ fontSize: 12, padding: '4px 10px' }} disabled={!file || saving} onClick={uploadFilled}>{permit.filled_form_path ? 'Replace' : 'Attach'}</button>
          <button className="auth-button" style={{ width: 'auto', fontSize: 12, padding: '4px 12px' }} disabled={emailing || !permit.filled_form_path} onClick={emailAuthority}>{emailing ? 'Sending…' : 'Email to authority'}</button>
        </div>
      </div>

      {/* Record */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
        <div style={{ width: 160 }}><label style={L}>Status</label><select style={I} value={d.status} onChange={(e) => setD({ ...d, status: e.target.value })}>{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div style={{ width: 140 }}><label style={L}>Permit #</label><input style={I} value={d.permit_number} onChange={(e) => setD({ ...d, permit_number: e.target.value })} /></div>
        <div style={{ width: 140 }}><label style={L}>AHRI #</label><input style={I} value={d.ahri_number} onChange={(e) => setD({ ...d, ahri_number: e.target.value })} /></div>
        <div style={{ width: 100 }}><label style={L}>Fee</label><input style={I} type="number" step="0.01" value={d.fee} onChange={(e) => setD({ ...d, fee: e.target.value })} /></div>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
        <div style={{ width: 160 }}><label style={L}>Applied</label><input style={I} type="date" value={d.application_date} onChange={(e) => setD({ ...d, application_date: e.target.value })} /></div>
        <div style={{ width: 160 }}><label style={L}>Permit date (issued)</label><input style={I} type="date" value={d.issue_date} onChange={(e) => setD({ ...d, issue_date: e.target.value })} /></div>
        <div style={{ width: 170 }}><label style={L}>Inspection approved</label><input style={I} type="date" value={d.inspection_approved_date} onChange={(e) => setD({ ...d, inspection_approved_date: e.target.value })} /></div>
        <div style={{ flex: 1, minWidth: 180 }}><label style={L}>Notes</label><input style={I} value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} /></div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
        <button className="auth-button" style={{ width: 'auto' }} disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
        {msg && <span style={{ fontSize: 13, color: msg.startsWith('Saved') || msg.startsWith('Sent') || msg.includes('attached') ? '#1a7f37' : '#C0392B' }}>{msg}</span>}
      </div>
    </div>
  )
}

export default function Permits({ profile }) {
  const isSuper = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [permits, setPermits] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('open')  // open | all | a specific status
  const [search, setSearch] = useState('')

  useEffect(() => { if (isSuper) supabase.from('organizations').select('id, name').order('name').then(({ data }) => setOrgs(data || [])) }, [])
  useEffect(() => { if (selectedOrg) load() }, [selectedOrg])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('permits')
      .select(`*,
        building_authorities(name, website_url, online_form_url, blank_form_path, blank_form_name, noc_required, noc_url, phone, email, address, city, state, zip),
        properties(street_address, city, state, zip, customers!properties_customer_id_fkey(display_name)),
        jobs(job_number)`)
      .eq('org_id', selectedOrg).order('created_at', { ascending: false })
    setPermits(data || []); setLoading(false)
  }

  const filtered = permits.filter((p) => {
    if (statusFilter === 'open' && (p.status === 'closed' || p.status === 'not_required')) return false
    if (statusFilter !== 'open' && statusFilter !== 'all' && p.status !== statusFilter) return false
    if (search) {
      const hay = `${p.authority_name || ''} ${p.building_authorities?.name || ''} ${p.properties?.street_address || ''} ${p.properties?.customers?.display_name || ''} ${p.permit_number || ''} ${p.jobs?.job_number || ''}`.toLowerCase()
      if (!hay.includes(search.toLowerCase())) return false
    }
    return true
  })

  const openCount = permits.filter((p) => p.status !== 'closed' && p.status !== 'not_required').length
  const awaitingInspection = permits.filter((p) => p.status === 'issued' || p.status === 'inspected').length

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div className="page-header-bar"><h2>Permits</h2></div>
      <p style={{ color: 'var(--mist)', fontSize: 14, marginTop: 4, marginBottom: 14, maxWidth: 760 }}>
        Work each installation permit here: open the authority's form, record the permit number and dates, and log the inspection approval. Manage offices under <Link to="/building-authorities">Building Authorities</Link>.
      </p>

      {isSuper && (
        <div style={{ marginBottom: 14, maxWidth: 340 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8 }}>
          <option value="open">Open ({openCount})</option>
          <option value="all">All ({permits.length})</option>
          {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search address, customer, permit #…" style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, minWidth: 240, flex: 1 }} />
        <span style={{ fontSize: 12.5, color: 'var(--mist)' }}>{awaitingInspection} awaiting inspection</span>
      </div>

      {loading ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : filtered.length === 0 ? (
        <div className="section-card" style={{ padding: 18 }}><p style={{ margin: 0 }}>No permits{statusFilter === 'open' ? ' open' : ''}. Permits appear here once a building authority is chosen on a System Estimate.</p></div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {filtered.map((p) => <PermitCard key={p.id} permit={p} onChanged={load} />)}
        </div>
      )}
    </div>
  )
}
