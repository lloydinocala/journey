import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import { exportToCSV } from './utils/csvExport'

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

const COLUMNS = [
  { key: 'name', label: 'Name', required: true },
  { key: 'slug', label: 'Slug' },
  { key: 'status', label: 'Status', required: true },
  { key: 'created_at', label: 'Created' },
]

export default function Organizations() {
  const [orgs, setOrgs] = useState([])
  const [entitled, setEntitled] = useState({})   // Elements-HVAC entitlement by org_id
  const [rewardsEntitled, setRewardsEntitled] = useState({})   // Rewards-HVAC entitlement by org_id
  const [statusFilter, setStatusFilter] = useState('current')

  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [searchText, setSearchText] = useState('')
  const [sortField, setSortField] = useState('created_at')
  const [sortDirection, setSortDirection] = useState('desc')
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('organizations_visible_columns')
    return saved ? JSON.parse(saved) : COLUMNS.map((c) => c.key)
  })

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
    const { data: es } = await supabase.from('elements_settings').select('org_id, entitled')
    const map = {}
    ;(es || []).forEach((r) => { map[r.org_id] = !!r.entitled })
    setEntitled(map)
    const { data: rs } = await supabase.from('rewards_settings').select('org_id, entitled')
    const rmap = {}
    ;(rs || []).forEach((r) => { rmap[r.org_id] = !!r.entitled })
    setRewardsEntitled(rmap)
    setLoading(false)
  }

  async function toggleElements(org) {
    const now = !!entitled[org.id]
    await supabase
      .from('elements_settings')
      .upsert({ org_id: org.id, entitled: !now, updated_at: new Date().toISOString() }, { onConflict: 'org_id' })
    loadOrgs()
  }

  async function toggleRewards(org) {
    const now = !!rewardsEntitled[org.id]
    await supabase
      .from('rewards_settings')
      .upsert({ org_id: org.id, entitled: !now, updated_at: new Date().toISOString() }, { onConflict: 'org_id' })
    loadOrgs()
  }

  useEffect(() => {
    loadOrgs()
  }, [])

  useEffect(() => {
    localStorage.setItem('organizations_visible_columns', JSON.stringify(visibleColumns))
  }, [visibleColumns])

  function toggleColumn(key) {
    setVisibleColumns((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  function toggleSort(field) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  function sortArrow(field) {
    if (sortField !== field) return ''
    return sortDirection === 'asc' ? ' ↑' : ' ↓'
  }

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
    if (reason === null) return
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

  async function archiveOrg(org) {
    const reason = window.prompt(
      `Archive ${org.name}? This ends their license permanently (they can still be reinstated later if they return).\n\nA reason is required and will be kept on record:`
    )
    if (reason === null) return
    if (!reason.trim()) {
      alert('A reason is required to archive an organization.')
      return
    }

    const { data: userData } = await supabase.auth.getUser()
    await supabase
      .from('organizations')
      .update({
        billing_status: 'canceled',
        canceled_reason: reason.trim(),
        canceled_at: new Date().toISOString(),
        canceled_by: userData.user.id,
      })
      .eq('id', org.id)
    loadOrgs()
  }

  async function reinstateOrg(org) {
    if (!window.confirm(`Reinstate ${org.name}? They'll be restored to active status.`)) return
    await supabase.from('organizations').update({ billing_status: 'active' }).eq('id', org.id)
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

  const statusFiltered = orgs.filter((org) => {
    if (statusFilter === 'all') return true
    if (statusFilter === 'frozen') return org.billing_status === 'suspended'
    if (statusFilter === 'archived') return org.billing_status === 'canceled'
    return org.billing_status !== 'canceled'
  })

  const searched = statusFiltered.filter((org) => {
    if (!searchText) return true
    const q = searchText.toLowerCase()
    return org.name?.toLowerCase().includes(q) || org.slug?.toLowerCase().includes(q)
  })

  const sorted = [...searched].sort((a, b) => {
    let aVal, bVal
    if (sortField === 'status') {
      aVal = a.billing_status || ''
      bVal = b.billing_status || ''
    } else {
      aVal = a[sortField] || ''
      bVal = b[sortField] || ''
    }
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  function handleExport() {
    exportToCSV(
      sorted,
      [
        { key: 'name', label: 'Name' },
        { key: 'slug', label: 'Slug' },
        { key: 'billing_status', label: 'Status' },
        { label: 'Created', value: (o) => new Date(o.created_at).toLocaleDateString() },
      ],
      'organizations-' + new Date().toISOString().slice(0, 10) + '.csv'
    )
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

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ maxWidth: 220, marginBottom: 0 }}>
          <label htmlFor="statusFilter">Show</label>
          <select id="statusFilter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="current">Active &amp; frozen</option>
            <option value="frozen">Frozen only</option>
            <option value="archived">Archived only</option>
            <option value="all">All</option>
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0, minWidth: 220 }}>
          <label htmlFor="searchBox">Search</label>
          <input
            id="searchBox"
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Name or slug…"
          />
        </div>
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <button className="logout-button" onClick={() => setShowColumnPicker(!showColumnPicker)}>
            Columns ▾
          </button>
          {showColumnPicker && (
            <div className="org-picker-list" style={{ right: 0, left: 'auto', minWidth: 180 }}>
              {COLUMNS.filter((c) => !c.required).map((col) => (
                <label key={col.key} className="org-picker-item" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={visibleColumns.includes(col.key)}
                    onChange={() => toggleColumn(col.key)}
                  />
                  {col.label}
                </label>
              ))}
            </div>
          )}
        </div>
        <button className="logout-button" style={{ marginBottom: 10 }} onClick={handleExport}>
          Export CSV
        </button>
        <p style={{ color: 'var(--mist)', fontSize: 14, margin: '0 0 12px' }}>
          {sorted.length} organization{sorted.length !== 1 ? 's' : ''}
        </p>
      </div>

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : (
        <table className="org-table">
          <thead>
            <tr>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('name')}>Name{sortArrow('name')}</th>
              {visibleColumns.includes('slug') && (
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('slug')}>Slug{sortArrow('slug')}</th>
              )}
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('status')}>Status{sortArrow('status')}</th>
              {visibleColumns.includes('created_at') && (
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('created_at')}>Created{sortArrow('created_at')}</th>
              )}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((org) =>
              editingId === org.id ? (
                <tr key={org.id}>
                  <td><input type="text" value={editName} onChange={(e) => handleEditNameChange(e.target.value)} /></td>
                  {visibleColumns.includes('slug') && (
                    <td><input type="text" value={editSlug} onChange={(e) => { setEditSlug(e.target.value); setSlugTouched(true) }} /></td>
                  )}
                  <td>
                    <span className={`status-pill status-${org.billing_status}`}>
                      {org.billing_status}
                    </span>
                  </td>
                  {visibleColumns.includes('created_at') && <td>{new Date(org.created_at).toLocaleDateString()}</td>}
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button className="auth-button" style={{ width: 'auto', padding: '6px 14px', margin: 0 }} onClick={() => saveEdit(org.id)}>Save</button>
                    <button className="logout-button" onClick={() => setEditingId(null)}>Cancel</button>
                  </td>
                </tr>
              ) : (
                <tr key={org.id}>
                  <td>{org.name}</td>
                  {visibleColumns.includes('slug') && <td>{org.slug}</td>}
                  <td>
                    <span
                      className={`status-pill status-${org.billing_status}`}
                      title={
                        org.billing_status === 'suspended'
                          ? (org.frozen_reason || 'No reason recorded')
                          : org.billing_status === 'canceled'
                          ? (org.canceled_reason || 'No reason recorded')
                          : ''
                      }
                    >
                      {org.billing_status}
                    </span>
                  </td>
                  {visibleColumns.includes('created_at') && <td>{new Date(org.created_at).toLocaleDateString()}</td>}
                  <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="logout-button" onClick={() => startEdit(org)}>Edit</button>
                    <button
                      className="logout-button"
                      onClick={() => toggleElements(org)}
                      title={entitled[org.id] ? 'Elements-HVAC Inventory is granted to this org' : 'Grant Elements-HVAC Inventory to this org'}
                      style={entitled[org.id] ? { background: '#1B3A6B', color: '#fff', borderColor: '#1B3A6B' } : undefined}
                    >
                      {entitled[org.id] ? 'Elements ✓' : 'Elements'}
                    </button>
                    <button
                      className="logout-button"
                      onClick={() => toggleRewards(org)}
                      title={rewardsEntitled[org.id] ? 'Rewards-HVAC HR/Payroll is granted to this org' : 'Grant Rewards-HVAC HR/Payroll to this org'}
                      style={rewardsEntitled[org.id] ? { background: '#1B3A6B', color: '#fff', borderColor: '#1B3A6B' } : undefined}
                    >
                      {rewardsEntitled[org.id] ? 'Rewards ✓' : 'Rewards'}
                    </button>
                    {org.billing_status === 'canceled' ? (
                      <button className="logout-button" onClick={() => reinstateOrg(org)}>Reinstate</button>
                    ) : (
                      <>
                        <button className="logout-button" onClick={() => toggleFreeze(org)}>
                          {org.billing_status === 'suspended' ? 'Unfreeze' : 'Freeze'}
                        </button>
                        <button className="logout-button" onClick={() => archiveOrg(org)}>Archive</button>
                      </>
                    )}
                  </td>
                </tr>
              )
            )}
            {sorted.length === 0 && (
              <tr><td colSpan="5" style={{ color: 'var(--mist)' }}>No organizations found.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
