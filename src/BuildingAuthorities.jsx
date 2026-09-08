import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import StatusFilter from './StatusFilter'

const blank = { name: '', address: '', city: '', state: '', zip: '', phone: '', email: '', website_url: '', online_form_url: '', noc_required: false, noc_url: '', notes: '', county_id: '', phone_extension: '', inspection_scheduling_url: '' }
const linkUrl = (u) => (u ? (/^https?:\/\//i.test(u) ? u : 'https://' + u) : null)

export default function BuildingAuthorities({ profile }) {
  const isSuper = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState(['Active'])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(blank)
  const [editingId, setEditingId] = useState(null)
  const [pdfFile, setPdfFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [counties, setCounties] = useState([])
  const [recorderVendors, setRecorderVendors] = useState([])
  const [countyForm, setCountyForm] = useState({ name: '', state: '', property_appraiser_url: '', recorder_vendor_id: '' })
  const [editingCountyId, setEditingCountyId] = useState(null)
  const [showCountyForm, setShowCountyForm] = useState(false)
  const [countySaving, setCountySaving] = useState(false)

  useEffect(() => { if (isSuper) supabase.from('organizations').select('id, name').order('name').then(({ data }) => setOrgs(data || [])) }, [])
  useEffect(() => { if (selectedOrg) load() }, [selectedOrg])

  async function load() {
    setLoading(true)
    const [{ data }, { data: cty }, { data: rec }] = await Promise.all([
      supabase.from('building_authorities').select('*').eq('org_id', selectedOrg).order('name'),
      supabase.from('counties').select('*').eq('org_id', selectedOrg).order('name'),
      supabase.from('vendors').select('id, name').eq('org_id', selectedOrg).eq('is_recorder', true).eq('is_active', true).order('name'),
    ])
    setRows(data || []); setCounties(cty || []); setRecorderVendors(rec || []); setLoading(false)
  }

  function startAdd() { setForm(blank); setEditingId(null); setPdfFile(null); setErr(''); setShowForm(true) }
  function startEdit(a) {
    setForm({ name: a.name || '', address: a.address || '', city: a.city || '', state: a.state || '', zip: a.zip || '', phone: a.phone || '', email: a.email || '', website_url: a.website_url || '', online_form_url: a.online_form_url || '', noc_required: !!a.noc_required, noc_url: a.noc_url || '', notes: a.notes || '', county_id: a.county_id || '', phone_extension: a.phone_extension || '', inspection_scheduling_url: a.inspection_scheduling_url || '' })
    setEditingId(a.id); setPdfFile(null); setErr(''); setShowForm(true)
  }

  async function save(e) {
    e.preventDefault()
    if (!form.name.trim()) { setErr('Name is required.'); return }
    setSaving(true); setErr('')
    const payload = {
      org_id: selectedOrg, name: form.name.trim(),
      address: form.address.trim() || null, city: form.city.trim() || null, state: form.state.trim() || null, zip: form.zip.trim() || null,
      phone: form.phone.trim() || null, email: form.email.trim() || null, website_url: form.website_url.trim() || null,
      online_form_url: form.online_form_url.trim() || null, noc_required: !!form.noc_required, noc_url: form.noc_url.trim() || null, notes: form.notes.trim() || null,
      county_id: form.county_id || null, phone_extension: form.phone_extension.trim() || null, inspection_scheduling_url: form.inspection_scheduling_url.trim() || null,
    }
    let id = editingId
    if (editingId) {
      const { error } = await supabase.from('building_authorities').update(payload).eq('id', editingId)
      if (error) { setErr(error.message); setSaving(false); return }
    } else {
      const { data, error } = await supabase.from('building_authorities').insert(payload).select().single()
      if (error) { setErr(error.message); setSaving(false); return }
      id = data.id
    }
    if (pdfFile && id) {
      const path = `permit-forms/${selectedOrg}/${id}.pdf`
      const up = await supabase.storage.from('org-logos').upload(path, pdfFile, { upsert: true, contentType: 'application/pdf' })
      if (!up.error) await supabase.from('building_authorities').update({ blank_form_path: path, blank_form_name: pdfFile.name }).eq('id', id)
    }
    setSaving(false); setShowForm(false); setForm(blank); setEditingId(null); setPdfFile(null); load()
  }

  function startAddCounty() { setCountyForm({ name: '', state: '', property_appraiser_url: '', recorder_vendor_id: '' }); setEditingCountyId(null); setShowCountyForm(true) }
  function startEditCounty(c) { setCountyForm({ name: c.name || '', state: c.state || '', property_appraiser_url: c.property_appraiser_url || '', recorder_vendor_id: c.recorder_vendor_id || '' }); setEditingCountyId(c.id); setShowCountyForm(true) }
  async function saveCounty(e) {
    e.preventDefault()
    if (!countyForm.name.trim()) return
    setCountySaving(true)
    const payload = { org_id: selectedOrg, name: countyForm.name.trim(), state: countyForm.state.trim() || null, property_appraiser_url: countyForm.property_appraiser_url.trim() || null, recorder_vendor_id: countyForm.recorder_vendor_id || null }
    if (editingCountyId) await supabase.from('counties').update(payload).eq('id', editingCountyId)
    else await supabase.from('counties').insert(payload)
    setCountySaving(false); setShowCountyForm(false); setEditingCountyId(null); load()
  }

  async function toggleActive(a) {
    await supabase.from('building_authorities').update({ is_active: !a.is_active }).eq('id', a.id); load()
  }
  function downloadBlank(a) {
    if (!a.blank_form_path) return
    const { data } = supabase.storage.from('org-logos').getPublicUrl(a.blank_form_path, { download: a.blank_form_name || 'permit-form.pdf' })
    window.open(data.publicUrl, '_blank')
  }

  const filtered = rows.filter((a) => statusFilter.includes(a.is_active ? 'Active' : 'Archived') && (!search || a.name.toLowerCase().includes(search.toLowerCase())))

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div className="page-header-bar"><h2>Building Authorities</h2></div>
      <p style={{ color: 'var(--mist)', fontSize: 14, marginTop: 4, marginBottom: 16, maxWidth: 720 }}>
        The permitting offices you work with — county and city building departments. Store each one's contact info, its online-application link, and/or a blank PDF application, so pulling a permit on a job is one click.
      </p>
      <div style={{ marginBottom: 16 }}>
        <a className="logout-button" style={{ textDecoration: 'none', width: 'auto' }} href="https://www.ahridirectory.org/" target="_blank" rel="noreferrer">AHRI Directory ↗</a>
        <span style={{ fontSize: 12.5, color: 'var(--mist)', marginLeft: 8 }}>Look up equipment AHRI certificate numbers (recorded on the permit).</span>
      </div>

      <div className="section-card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Counties</h3>
          <button className="logout-button" style={{ fontSize: 12 }} onClick={startAddCounty}>+ Add county</button>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--mist)', marginTop: 0 }}>The property appraiser (one per county) and the recorder used for Notices of Commencement. Assign each authority below to its county.</p>
        {showCountyForm && (
          <form onSubmit={saveCounty} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
            <div className="field" style={{ marginBottom: 0, minWidth: 160 }}><label>County name *</label><input value={countyForm.name} onChange={(e) => setCountyForm({ ...countyForm, name: e.target.value })} placeholder="Marion County" /></div>
            <div className="field" style={{ marginBottom: 0, width: 60 }}><label>State</label><input value={countyForm.state} onChange={(e) => setCountyForm({ ...countyForm, state: e.target.value })} /></div>
            <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 220 }}><label>Property appraiser URL</label><input value={countyForm.property_appraiser_url} onChange={(e) => setCountyForm({ ...countyForm, property_appraiser_url: e.target.value })} placeholder="https://…" /></div>
            <div className="field" style={{ marginBottom: 0, minWidth: 170 }}><label>Recorder</label><select value={countyForm.recorder_vendor_id} onChange={(e) => setCountyForm({ ...countyForm, recorder_vendor_id: e.target.value })}><option value="">— none —</option>{recorderVendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
            <button className="auth-button" style={{ width: 'auto' }} disabled={countySaving} type="submit">{countySaving ? 'Saving…' : editingCountyId ? 'Save' : 'Add'}</button>
            <button className="logout-button" type="button" onClick={() => { setShowCountyForm(false); setEditingCountyId(null) }}>Cancel</button>
          </form>
        )}
        {counties.length === 0 ? <p style={{ fontSize: 13, color: 'var(--mist)', margin: 0 }}>No counties yet. Add one, then assign authorities to it.</p> : (
          <div style={{ display: 'grid', gap: 6 }}>
            {counties.map((c) => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, fontSize: 13.5 }}>
                <div><strong>{c.name}</strong>{c.state ? ', ' + c.state : ''}<span style={{ color: 'var(--mist)' }}>{c.recorder_vendor_id ? '  ·  Recorder: ' + (recorderVendors.find((v) => v.id === c.recorder_vendor_id)?.name || '—') : '  ·  no recorder'}</span></div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {c.property_appraiser_url && <a className="logout-button" style={{ textDecoration: 'none', fontSize: 12, padding: '3px 8px' }} href={linkUrl(c.property_appraiser_url)} target="_blank" rel="noreferrer">Appraiser ↗</a>}
                  <button className="logout-button" style={{ fontSize: 12, padding: '3px 8px' }} onClick={() => startEditCounty(c)}>Edit</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isSuper && (
        <div style={{ marginBottom: 16, maxWidth: 340 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="auth-button" style={{ width: 'auto' }} onClick={startAdd}>+ Add authority</button>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, minWidth: 180 }} />
        <StatusFilter value={statusFilter} onChange={setStatusFilter} options={['Active', 'Archived']} />
      </div>

      {showForm && (
        <form onSubmit={save} className="section-card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 220 }}><label>Name *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Marion County Building Dept." /></div>
            <div className="field" style={{ marginBottom: 0, width: 150 }}><label>Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="field" style={{ marginBottom: 0, minWidth: 200 }}><label>Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="permits@county.gov" /></div>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
            <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 220 }}><label>Address</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div className="field" style={{ marginBottom: 0, width: 140 }}><label>City</label><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div className="field" style={{ marginBottom: 0, width: 60 }}><label>State</label><input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
            <div className="field" style={{ marginBottom: 0, width: 90 }}><label>ZIP</label><input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} /></div>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
            <div className="field" style={{ marginBottom: 0, minWidth: 170 }}><label>County</label><select value={form.county_id} onChange={(e) => setForm({ ...form, county_id: e.target.value })}><option value="">— none —</option>{counties.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div className="field" style={{ marginBottom: 0, width: 110 }}><label>Phone ext.</label><input value={form.phone_extension} onChange={(e) => setForm({ ...form, phone_extension: e.target.value })} /></div>
          </div>
          <div className="field" style={{ marginTop: 8 }}><label>Website</label><input value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} placeholder="https://county.gov/building" /></div>
          <div className="field" style={{ marginBottom: 0 }}><label>Inspection scheduling URL</label><input value={form.inspection_scheduling_url} onChange={(e) => setForm({ ...form, inspection_scheduling_url: e.target.value })} placeholder="https://…" /></div>
          <div className="field" style={{ marginBottom: 0 }}><label>Online application link (if the form is fillable online)</label><input value={form.online_form_url} onChange={(e) => setForm({ ...form, online_form_url: e.target.value })} placeholder="https://county.gov/permits/apply" /></div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginTop: 8, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
              <input type="checkbox" checked={form.noc_required} onChange={(e) => setForm({ ...form, noc_required: e.target.checked })} /> Requires Notice of Commencement
            </label>
            <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 220 }}><label>Notice of Commencement link/form</label><input value={form.noc_url} onChange={(e) => setForm({ ...form, noc_url: e.target.value })} placeholder="https://…" /></div>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Blank application PDF (if they use a downloadable form)</label>
            <input type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files[0] || null)} />
            {editingId && !pdfFile && <span style={{ fontSize: 12, color: 'var(--mist)' }}> (leave empty to keep the current one)</span>}
          </div>
          <div className="field" style={{ marginTop: 8, marginBottom: 0 }}><label>Notes</label><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          {err && <p style={{ color: '#C0392B', fontSize: 13, marginTop: 8 }}>{err}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="auth-button" style={{ width: 'auto' }} disabled={saving} type="submit">{saving ? 'Saving…' : editingId ? 'Save changes' : 'Add authority'}</button>
            <button className="logout-button" type="button" onClick={() => { setShowForm(false); setEditingId(null); setForm(blank) }}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : filtered.length === 0 ? (
        <div className="section-card" style={{ padding: 18 }}><p style={{ margin: 0 }}>No building authorities yet. Add the permitting offices you work with.</p></div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {filtered.map((a) => (
            <div key={a.id} className="section-card" style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{a.name} {!a.is_active && <span style={{ fontSize: 12, color: 'var(--mist)' }}>(archived)</span>}</div>
                  <div style={{ fontSize: 13, color: 'var(--mist)', marginTop: 2 }}>
                    {[a.address, a.city, [a.state, a.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
                    {a.phone ? `  ·  ${a.phone}${a.phone_extension ? ' x' + a.phone_extension : ''}` : ''}{a.email ? `  ·  ${a.email}` : ''}
                    {a.county_id ? `  ·  ${counties.find((c) => c.id === a.county_id)?.name || ''}` : ''}
                  </div>
                  {a.noc_required && <div style={{ fontSize: 12, color: '#C8811B', fontWeight: 700, marginTop: 2 }}>Requires Notice of Commencement</div>}
                  {a.notes && <div style={{ fontSize: 12.5, color: 'var(--mist)', marginTop: 2 }}>{a.notes}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {a.website_url && <a className="logout-button" style={{ textDecoration: 'none', fontSize: 12, padding: '4px 10px' }} href={linkUrl(a.website_url)} target="_blank" rel="noreferrer">Website ↗</a>}
                  {a.online_form_url && <a className="logout-button" style={{ textDecoration: 'none', fontSize: 12, padding: '4px 10px' }} href={linkUrl(a.online_form_url)} target="_blank" rel="noreferrer">Online form ↗</a>}
                  {a.noc_url && <a className="logout-button" style={{ textDecoration: 'none', fontSize: 12, padding: '4px 10px' }} href={linkUrl(a.noc_url)} target="_blank" rel="noreferrer">NOC form ↗</a>}
                  {a.blank_form_path && <button className="logout-button" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => downloadBlank(a)}>Blank PDF ↓</button>}
                  <button className="logout-button" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => startEdit(a)}>Edit</button>
                  <button className="logout-button" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => toggleActive(a)}>{a.is_active ? 'Archive' : 'Restore'}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
