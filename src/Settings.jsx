import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'

export default function Settings({ profile }) {
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [jobTypes, setJobTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [newType, setNewType] = useState('')
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

  async function loadJobTypes(orgId) {
    if (!orgId) return
    setLoading(true)
    const { data } = await supabase
      .from('job_types')
      .select('id, name, sort_order, is_active')
      .eq('org_id', orgId)
      .order('sort_order')
    setJobTypes(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadJobTypes(selectedOrg)
  }, [selectedOrg])

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    if (!newType.trim()) return

    setSaving(true)
    const nextSort = jobTypes.length > 0 ? Math.max(...jobTypes.map((t) => t.sort_order)) + 1 : 1
    const { error } = await supabase.from('job_types').insert({
      org_id: selectedOrg,
      name: newType.trim(),
      sort_order: nextSort,
    })
    setSaving(false)

    if (error) {
      setError(error.message)
    } else {
      setNewType('')
      loadJobTypes(selectedOrg)
    }
  }

  async function toggleActive(id, current) {
    await supabase.from('job_types').update({ is_active: !current }).eq('id', id)
    loadJobTypes(selectedOrg)
  }

  return (
    <div>
      <h2 className="page-title">Settings</h2>

      {isSuperAdmin && (
        <div className="field" style={{ maxWidth: 320, marginBottom: 20 }}>
          <label htmlFor="orgPicker">Viewing organization</label>
          <select id="orgPicker" value={selectedOrg} onChange={(e) => setSelectedOrg(e.target.value)}>
            {orgs.map((org) => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
        </div>
      )}

      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Job types</h3>
      <p style={{ color: 'var(--mist)', fontSize: 14, marginTop: -6, marginBottom: 20 }}>
        These show up in the Type dropdown when creating a job. Turn one off instead of
        deleting it if past jobs still reference it.
      </p>

      <form className="inline-form" onSubmit={handleAdd} style={{ marginBottom: 28 }}>
        <div className="field">
          <label htmlFor="newType">Add a job type</label>
          <input
            id="newType"
            type="text"
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            placeholder="e.g. New Construction"
            required
          />
        </div>
        <button className="auth-button" type="submit" disabled={saving}>
          {saving ? 'Adding…' : 'Add'}
        </button>
      </form>

      {error && <div className="auth-error">{error}</div>}

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {jobTypes.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>
                  <span className={`status-pill ${t.is_active ? 'status-active' : 'status-canceled'}`}>
                    {t.is_active ? 'Active' : 'Off'}
                  </span>
                </td>
                <td>
                  <button className="logout-button" onClick={() => toggleActive(t.id, t.is_active)}>
                    {t.is_active ? 'Turn off' : 'Turn on'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
