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

  async function loadOrgs() {
    setLoading(true)
    const { data, error } = await supabase
      .from('organizations')
      .select('id, name, slug, billing_status, created_at')
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
            </tr>
          </thead>
          <tbody>
            {orgs.map((org) => (
              <tr key={org.id}>
                <td>{org.name}</td>
                <td>{org.slug}</td>
                <td>
                  <span className={`status-pill status-${org.billing_status}`}>
                    {org.billing_status}
                  </span>
                </td>
                <td>{new Date(org.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
