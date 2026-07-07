import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export default function Organizations() {
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)

  async function loadOrgs() {
    setLoading(true)
    const { data, error } = await supabase
      .from('organizations')
      .select('id, name, slug, billing_status, created_at, frozen_reason, canceled_reason')
      .order('created_at', { ascending: false })
    if (!error) setOrgs(data)
    setLoading(false)
  }

  useEffect(() => {
    loadOrgs()
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    if (!name.trim()) return

    setSaving(true)
    const { error } = await supabase.from('organizations').insert({
      name: name.trim(),
      slug: slugify(name),
      billing_status: 'trial',
    })
    setSaving(false)

    if (error) {
      setError(error.message)
    } else {
      setName('')
      loadOrgs()
    }
  }

  async function toggleFreeze(org) {
    if (org.billing_status === 'suspended') {
      if (!window.confirm(`Unfreeze ${org.name}? Access will be restored immediately.`)) return
      await supabase.from('organizations').update({ billing_status: 'active' }).eq('id', org.id)
      loadOrgs()
      return
    }

    const reason = window.prompt(
      `Freeze ${org.name}? Every user there will be locked out immediately.\n\nA reason is required and will be kept on record:`
    )
    if (reason === null) return // cancelled
    if (!reason.trim()) {
      alert('A reason is required to freeze an organization.')
      return
    }

    const { data: userData } = await supabase.auth.getUser()
    await supabase
      .from('organizations')
      .update({
        billing_status: 'suspended',
        frozen_reason: reason.trim(),
        frozen_at: new Date().toISOString(),
        frozen_by: userData.user.id,
      })
      .eq('id', org.id)
    loadOrgs()
  }

  function startEdit(org) {
    setEditingId(org.id)
    setEditName(org.name)
    setEditSlug(org.slug)
    setSlugTouched(false)
  }

  function handleEditNameChange(value) {
    setEditName(value)
    if (!slugTouched) setEditSlug(slugify(value))
  }

  async function saveEdit(id) {
    await supabase
      .from('organizations')
      .update({ name: editName.trim(), slug: editSlug.trim() })
      .eq('id', id)
    setEditingId(null)
    loadOrgs()
  }

  return (
    <div>
      <h2 className="page-title">Organizations</h2>

      <form className="inline-form" onSubmit={handleAdd} style={{ marginBottom: 28 }}>
        <div className="field">
          <label htmlFor="orgName">Organization name</label>
          <input
            id="orgName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Comfort Zone HVAC"
            required
          />
        </div>
        <button className="auth-button" type="submit" disabled={saving}>
          {saving ? 'Adding…' : 'Add organization'}
        </button>
      </form>

      {error && <div className="auth-error">{error}</div>}

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : (
        <table className="org-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Status</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((org) =>
              editingId === org.id ? (
                <tr key={org.id}>
                  <td><input type="text" value={editName} onChange={(e) => handleEditNameChange(e.target.value)} /></td>
                  <td><input type="text" value={editSlug} onChange={(e) => { setEditSlug(e.target.value); setSlugTouched(true) }} /></td>
                  <td>
                    <span className={`status-pill status-${org.billing_status}`}>
                      {org.billing_status}
                    </span>
                  </td>
                  <td>{new Date(org.created_at).toLocaleDateString()}</td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button className="auth-button" style={{ width: 'auto', padding: '6px 14px', margin: 0 }} onClick={() => saveEdit(org.id)}>Save</button>
                    <button className="logout-button" onClick={() => setEditingId(null)}>Cancel</button>
                  </td>
                </tr>
              ) : (
                <tr key={org.id}>
                  <td>{org.name}</td>
                  <td>{org.slug}</td>
                 <td>
                    <span
                      className={`status-pill status-${org.billing_status}`}
                      title={org.billing_status === 'suspended' ? (org.frozen_reason || 'No reason recorded') : ''}
                    >
                      {org.billing_status}
                    </span>
                  </td>
                  <td>{new Date(org.created_at).toLocaleDateString()}</td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button className="logout-button" onClick={() => startEdit(org)}>Edit</button>
                    <button className="logout-button" onClick={() => toggleFreeze(org)}>
                      {org.billing_status === 'suspended' ? 'Unfreeze' : 'Freeze'}
                    </button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
