import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

// Warranty Registration Links — the brand → manufacturer registration-portal URL
// list. The Warranty Registrations page reads these to show a "Register online"
// button per system that opens the correct brand's portal in a new tab.
// NOTE: verify each URL — manufacturer registration pages change; paste the exact
// link for every brand you install.
export default function WarrantyRegistrationLinks({ profile }) {
  const isSuperAdmin = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [newBrand, setNewBrand] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        if (!selectedOrg && data && data.length) setSelectedOrg(data[0].id)
      })
    }
  }, [])

  async function load(orgId) {
    if (!orgId) return
    setLoading(true)
    const { data } = await supabase.from('warranty_registration_links')
      .select('*').eq('org_id', orgId).order('brand')
    setRows((data || []).map((r) => ({ ...r, _dirty: false })))
    setLoading(false)
  }
  useEffect(() => { if (selectedOrg || !isSuperAdmin) load(selectedOrg) }, [selectedOrg])

  const setField = (id, field, val) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: val, _dirty: true } : r)))

  async function save(r) {
    setSavingId(r.id); setErr('')
    const { error } = await supabase.from('warranty_registration_links')
      .update({ brand: (r.brand || '').trim(), url: (r.url || '').trim(), updated_at: new Date().toISOString() })
      .eq('id', r.id)
    if (error) { setErr(error.message); setSavingId(null); return }
    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, _dirty: false } : x)))
    setSavingId(null)
  }

  async function remove(r) {
    if (!window.confirm(`Remove the ${r.brand} link?`)) return
    await supabase.from('warranty_registration_links').delete().eq('id', r.id)
    setRows((rs) => rs.filter((x) => x.id !== r.id))
  }

  async function add() {
    setErr('')
    const brand = newBrand.trim(); const url = newUrl.trim()
    if (!brand || !url) { setErr('Enter both a brand and a URL.'); return }
    const { data, error } = await supabase.from('warranty_registration_links')
      .insert({ org_id: selectedOrg, brand, url }).select().single()
    if (error) { setErr(error.message.includes('duplicate') ? `A link for "${brand}" already exists.` : error.message); return }
    setRows((rs) => [...rs, { ...data, _dirty: false }].sort((a, b) => (a.brand || '').localeCompare(b.brand || '')))
    setNewBrand(''); setNewUrl('')
  }

  const input = { width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #D5DAE1', fontSize: 13.5, boxSizing: 'border-box' }

  return (
    <div>
      <h2 className="page-title">Warranty Registration Links</h2>
      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: -8, marginBottom: 16, maxWidth: 720 }}>
        The manufacturer registration page for each brand you install. On the <strong>Warranty Registrations</strong> page,
        each system shows a <strong>Register online</strong> button that opens its brand's link here in a new tab.
        <span style={{ color: '#B45309' }}> Verify each URL</span> — manufacturers change these; paste the exact link for every brand.
      </p>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        {isSuperAdmin && <div style={{ maxWidth: 300 }}><OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} /></div>}
      </div>

      {err && <div className="auth-error" style={{ marginBottom: 12 }}>{err}</div>}

      <div style={{ border: '1px solid var(--line, #E2E6ED)', borderRadius: 12, padding: 16, marginBottom: 18, background: 'var(--panel)', maxWidth: 820 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Add a brand link</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ width: 200 }}>
            <label style={{ fontSize: 11, color: 'var(--mist)', display: 'block', marginBottom: 2 }}>Brand</label>
            <input style={input} value={newBrand} onChange={(e) => setNewBrand(e.target.value)} placeholder="e.g. Goodman" />
          </div>
          <div style={{ flex: 1, minWidth: 260 }}>
            <label style={{ fontSize: 11, color: 'var(--mist)', display: 'block', marginBottom: 2 }}>Registration URL</label>
            <input style={input} value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://…" />
          </div>
          <button className="auth-button" style={{ width: 'auto', padding: '8px 18px' }} onClick={add}>Add</button>
        </div>
      </div>

      {loading ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : rows.length === 0 ? (
        <p style={{ color: 'var(--mist)' }}>No brand links yet — add one above.</p>
      ) : (
        <div style={{ maxWidth: 820 }}>
          {rows.map((r) => (
            <div key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid var(--line, #E2E6ED)', borderRadius: 10, padding: 12, marginBottom: 10, background: 'var(--panel)' }}>
              <div style={{ width: 180 }}>
                <label style={{ fontSize: 11, color: 'var(--mist)', display: 'block', marginBottom: 2 }}>Brand</label>
                <input style={input} value={r.brand || ''} onChange={(e) => setField(r.id, 'brand', e.target.value)} />
              </div>
              <div style={{ flex: 1, minWidth: 240 }}>
                <label style={{ fontSize: 11, color: 'var(--mist)', display: 'block', marginBottom: 2 }}>Registration URL</label>
                <input style={input} value={r.url || ''} onChange={(e) => setField(r.id, 'url', e.target.value)} />
              </div>
              {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" className="logout-button" style={{ padding: '7px 12px', textDecoration: 'none' }}>Open ↗</a>}
              <button className="auth-button" style={{ width: 'auto', padding: '7px 16px' }} disabled={!r._dirty || savingId === r.id} onClick={() => save(r)}>
                {savingId === r.id ? 'Saving…' : r._dirty ? 'Save' : 'Saved'}
              </button>
              <button className="logout-button" style={{ padding: '7px 12px', color: '#B0472B', borderColor: '#B0472B' }} onClick={() => remove(r)}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
