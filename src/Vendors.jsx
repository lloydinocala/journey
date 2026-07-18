import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import { fetchAllRows } from './utils/csvImport'

const blankForm = {
  name: '', phone: '', email: '', account_number: '', billing_type: '',
  sales_rep_name: '', sales_rep_phone: '', street_address: '', city: '', state: '', zip: '', notes: '',
}

export default function Vendors({ profile }) {
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [searchText, setSearchText] = useState('')

  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState(blankForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isSuperAdmin = profile.role === 'super_admin'

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        if (!selectedOrg && data && data.length > 0) setSelectedOrg(data[0].id)
      })
    }
  }, [])

  async function loadVendors(orgId) {
    if (!orgId) return
    setLoading(true)
    const data = await fetchAllRows(() =>
      supabase.from('vendors').select('*').eq('org_id', orgId).eq('is_active', !showArchived).order('name')
    )
    setVendors(data)
    setLoading(false)
  }

  useEffect(() => {
    loadVendors(selectedOrg)
  }, [selectedOrg, showArchived])

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) return
    setSaving(true)
    const { error: insErr } = await supabase.from('vendors').insert({
      org_id: selectedOrg,
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      account_number: form.account_number.trim() || null,
      billing_type: form.billing_type.trim() || null,
      sales_rep_name: form.sales_rep_name.trim() || null,
      sales_rep_phone: form.sales_rep_phone.trim() || null,
      street_address: form.street_address.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      zip: form.zip.trim() || null,
      notes: form.notes.trim() || null,
    })
    setSaving(false)
    if (insErr) {
      setError(insErr.message)
    } else {
      setForm(blankForm)
      setShowAddForm(false)
      loadVendors(selectedOrg)
    }
  }

  async function toggleArchive(v) {
    const action = v.is_active ? 'archive' : 'reactivate'
    if (!window.confirm(`Are you sure you want to ${action} ${v.name}?`)) return
    await supabase.from('vendors').update({ is_active: !v.is_active }).eq('id', v.id)
    loadVendors(selectedOrg)
  }

  const filtered = vendors.filter((v) => !searchText || v.name.toLowerCase().includes(searchText.toLowerCase()))

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Vendors</h2>
          <span className="badge">{vendors.length.toLocaleString()} total</span>
        </div>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? 'Cancel' : '+ New Vendor'}
        </button>
      </div>

      {isSuperAdmin && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      {showAddForm && (
        <form className="inline-form" onSubmit={handleAdd} style={{ marginBottom: 20, flexWrap: 'wrap' }}>
          <div className="field">
            <label>Vendor Name</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="field">
            <label>Phone</label>
            <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="field">
            <label>Account #</label>
            <input type="text" value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} />
          </div>
          <div className="field">
            <label>Billing Type</label>
            <input type="text" value={form.billing_type} onChange={(e) => setForm({ ...form, billing_type: e.target.value })} placeholder="e.g. Charge, COD" />
          </div>
          <div className="field">
            <label>Sales Rep</label>
            <input type="text" value={form.sales_rep_name} onChange={(e) => setForm({ ...form, sales_rep_name: e.target.value })} />
          </div>
          <div className="field">
            <label>Sales Rep Phone</label>
            <input type="tel" value={form.sales_rep_phone} onChange={(e) => setForm({ ...form, sales_rep_phone: e.target.value })} />
          </div>
          <div className="field">
            <label>Street Address</label>
            <input type="text" value={form.street_address} onChange={(e) => setForm({ ...form, street_address: e.target.value })} />
          </div>
          <div className="field">
            <label>City</label>
            <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <div className="field">
            <label>State</label>
            <input type="text" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} style={{ width: 60 }} />
          </div>
          <div className="field">
            <label>Zip</label>
            <input type="text" value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} style={{ width: 90 }} />
          </div>
          <div className="field" style={{ minWidth: 220 }}>
            <label>Notes</label>
            <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="optional" />
          </div>
          <button className="auth-button" type="submit" disabled={saving} style={{ width: 'auto' }}>
            {saving ? 'Adding…' : 'Add vendor'}
          </button>
        </form>
      )}
      {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ marginBottom: 0, minWidth: 220 }}>
          <label>Search</label>
          <input type="text" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Vendor name…" />
        </div>
        <label className="nav-link" style={{ cursor: 'pointer', marginBottom: 10 }}>
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} style={{ marginRight: 6 }} />
          Show archived
        </label>
      </div>

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th></th>
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Account #</th>
              <th>Sales Rep</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v) => (
              <tr key={v.id}>
                <td style={{ display: 'flex', gap: 8 }}>
                  <button className="logout-button" onClick={() => toggleArchive(v)}>{v.is_active ? 'Archive' : 'Reactivate'}</button>
                </td>
                <td><Link to={`/vendors/${v.id}`}>{v.name}</Link></td>
                <td>{v.phone || '—'}</td>
                <td>{v.email || '—'}</td>
                <td>{v.account_number || '—'}</td>
                <td>{v.sales_rep_name || '—'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan="6" style={{ color: 'var(--mist)' }}>No vendors found.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
