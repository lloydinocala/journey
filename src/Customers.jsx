import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import NewItemDropdown from './NewItemDropdown'
import QuickAddModal from './QuickAddModal'
import { exportToCSV } from './utils/csvExport'
import { fetchAllRows } from './utils/csvImport'

function formatPhone(raw) {
  if (!raw) return raw
  const d = ('' + raw).replace(/\D/g, '')
  if (d.length === 10) return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6)
  if (d.length === 11 && d[0] === '1') return d.slice(1, 4) + '-' + d.slice(4, 7) + '-' + d.slice(7)
  return raw
}

const COLUMNS = [
  { key: 'display_name', label: 'Name', required: true },
  { key: 'company', label: 'Company' },
  { key: 'first_name', label: 'First Name' },
  { key: 'last_name', label: 'Last Name' },
  { key: 'spouse_name', label: 'Spouse Name' },
  { key: 'primary_phone', label: 'Phone' },
  { key: 'secondary_phone', label: 'Phone 2' },
  { key: 'email_1', label: 'Email' },
  { key: 'email_2', label: 'Email 2' },
  { key: 'acquire_date', label: 'Acquired' },
  { key: 'notes', label: 'Notes' },
  { key: 'created_at', label: 'Added' },
]

const DEFAULT_VISIBLE = COLUMNS.map((c) => c.key)

export default function Customers({ profile }) {
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [customers, setCustomers] = useState([])
  const [showArchived, setShowArchived] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [newItemMode, setNewItemMode] = useState(null)

  const [sortField, setSortField] = useState('created_at')
  const [sortDirection, setSortDirection] = useState('desc')
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('customers_visible_columns_v2')
    return saved ? JSON.parse(saved) : DEFAULT_VISIBLE
  })

  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editCompany, setEditCompany] = useState('')
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [editSpouseName, setEditSpouseName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editSecondaryPhone, setEditSecondaryPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editEmail2, setEditEmail2] = useState('')
  const [editAcquireDate, setEditAcquireDate] = useState('')
  const [editNotes, setEditNotes] = useState('')

  const isSuperAdmin = profile.role === 'super_admin'
  const isOrgAdmin = profile.role === 'org_admin'
  const canManageBans = isSuperAdmin || isOrgAdmin

  useEffect(() => {
    if (isSuperAdmin) {
      supabase
        .from('organizations')
        .select('id, name')
        .order('name')
        .then(({ data }) => {
          setOrgs(data || [])
          if (!selectedOrg && data && data.length > 0) setSelectedOrg(data[0].id)
        })
    }
  }, [])

  async function loadCustomers(orgId) {
    if (!orgId) return
    setLoading(true)
    try {
      const data = await fetchAllRows(() =>
        supabase
          .from('customers')
          .select('id, display_name, company, first_name, last_name, spouse_name, primary_phone, secondary_phone, email_1, email_2, acquire_date, notes, created_at, is_active, is_banned, banned_reason')
          .eq('org_id', orgId)
          .eq('is_active', !showArchived)
          .order('created_at', { ascending: false })
      )
      setCustomers(data)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadCustomers(selectedOrg)
  }, [selectedOrg, showArchived])

  useEffect(() => {
    localStorage.setItem('customers_visible_columns_v2', JSON.stringify(visibleColumns))
  }, [visibleColumns])

  function toggleColumn(key) {
    setVisibleColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
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

  function startEdit(c) {
    setEditingId(c.id)
    setEditName(c.display_name)
    setEditCompany(c.company || '')
    setEditFirstName(c.first_name || '')
    setEditLastName(c.last_name || '')
    setEditSpouseName(c.spouse_name || '')
    setEditPhone(c.primary_phone || '')
    setEditSecondaryPhone(c.secondary_phone || '')
    setEditEmail(c.email_1 || '')
    setEditEmail2(c.email_2 || '')
    setEditAcquireDate(c.acquire_date || '')
    setEditNotes(c.notes || '')
  }

  async function saveEdit(id) {
    await supabase
      .from('customers')
      .update({
        display_name: editName.trim(),
        company: editCompany.trim() || null,
        first_name: editFirstName.trim() || null,
        last_name: editLastName.trim() || null,
        spouse_name: editSpouseName.trim() || null,
        primary_phone: editPhone.trim() || null,
        secondary_phone: editSecondaryPhone.trim() || null,
        email_1: editEmail.trim() || null,
        email_2: editEmail2.trim() || null,
        acquire_date: editAcquireDate || null,
        notes: editNotes.trim() || null,
      })
      .eq('id', id)
    setEditingId(null)
    loadCustomers(selectedOrg)
  }

  async function toggleArchive(c) {
    const action = c.is_active ? 'archive' : 'reactivate'
    if (!window.confirm(`Are you sure you want to ${action} ${c.display_name}?`)) return
    await supabase.from('customers').update({ is_active: !c.is_active }).eq('id', c.id)
    loadCustomers(selectedOrg)
  }

  async function fireCustomer(c) {
    const reason = window.prompt(
      `You're flagging ${c.display_name} as Do Not Service.\nThis blocks scheduling new jobs for them until an admin lifts it.\n\nReason (optional):`
    )
    if (reason === null) return

    const { data: sessionData } = await supabase.auth.getUser()
    await supabase
      .from('customers')
      .update({
        is_banned: true,
        banned_reason: reason.trim() || null,
        banned_at: new Date().toISOString(),
        banned_by: sessionData.user.id,
      })
      .eq('id', c.id)
    loadCustomers(selectedOrg)
  }

  async function liftBan(c) {
    if (!window.confirm(`Lift the Do Not Service flag on ${c.display_name}? They'll be schedulable again.`)) return
    await supabase.from('customers').update({ is_banned: false }).eq('id', c.id)
    loadCustomers(selectedOrg)
  }

  const filtered = customers.filter((c) => {
    if (!searchText) return true
    const q = searchText.toLowerCase()
    return (
      c.display_name?.toLowerCase().includes(q) ||
      c.company?.toLowerCase().includes(q) ||
      c.first_name?.toLowerCase().includes(q) ||
      c.last_name?.toLowerCase().includes(q) ||
      c.primary_phone?.toLowerCase().includes(q) ||
      c.email_1?.toLowerCase().includes(q)
    )
  })

  const sorted = [...filtered].sort((a, b) => {
    let aVal = a[sortField] || ''
    let bVal = b[sortField] || ''
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  function handleExport() {
    exportToCSV(
      sorted,
      [
        { key: 'display_name', label: 'Name' },
        { key: 'company', label: 'Company' },
        { key: 'first_name', label: 'First Name' },
        { key: 'last_name', label: 'Last Name' },
        { key: 'spouse_name', label: 'Spouse Name' },
        { key: 'primary_phone', label: 'Phone' },
        { key: 'secondary_phone', label: 'Phone 2' },
        { key: 'email_1', label: 'Email' },
        { key: 'email_2', label: 'Email 2' },
        { key: 'acquire_date', label: 'Acquired' },
        { key: 'notes', label: 'Notes' },
        { label: 'Added', value: (c) => new Date(c.created_at).toLocaleDateString() },
        { label: 'Status', value: (c) => (c.is_active ? 'Active' : 'Archived') },
        { label: 'Do Not Service', value: (c) => (c.is_banned ? 'Yes' : 'No') },
      ],
      'customers-' + new Date().toISOString().slice(0, 10) + '.csv'
    )
  }

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Customers</h2>
          <span className="badge">{customers.length.toLocaleString()} total</span>
        </div>
        <NewItemDropdown onSelect={setNewItemMode} />
      </div>

      {isSuperAdmin && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}


      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ marginBottom: 0, minWidth: 220 }}>
          <label htmlFor="searchBox">Search</label>
          <input
            id="searchBox"
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Name, company, phone, or email…"
          />
        </div>
        <label className="nav-link" style={{ cursor: 'pointer', marginBottom: 10 }}>
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          Show archived
        </label>
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <button className="logout-button" onClick={() => setShowColumnPicker(!showColumnPicker)}>
            Columns ▾
          </button>
          {showColumnPicker && (
            <div className="org-picker-list" style={{ right: 'auto', left: 0, minWidth: 200, maxHeight: 340 }}>
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
          {sorted.length} customer{sorted.length !== 1 ? 's' : ''}
        </p>
      </div>

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th></th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('display_name')}>Name{sortArrow('display_name')}</th>
                {visibleColumns.includes('company') && (
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('company')}>Company{sortArrow('company')}</th>
                )}
                {visibleColumns.includes('first_name') && (
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('first_name')}>First Name{sortArrow('first_name')}</th>
                )}
                {visibleColumns.includes('last_name') && (
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('last_name')}>Last Name{sortArrow('last_name')}</th>
                )}
                {visibleColumns.includes('spouse_name') && (
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('spouse_name')}>Spouse Name{sortArrow('spouse_name')}</th>
                )}
                {visibleColumns.includes('primary_phone') && (
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('primary_phone')}>Phone{sortArrow('primary_phone')}</th>
                )}
                {visibleColumns.includes('secondary_phone') && (
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('secondary_phone')}>Phone 2{sortArrow('secondary_phone')}</th>
                )}
                {visibleColumns.includes('email_1') && (
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('email_1')}>Email{sortArrow('email_1')}</th>
                )}
                {visibleColumns.includes('email_2') && (
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('email_2')}>Email 2{sortArrow('email_2')}</th>
                )}
                {visibleColumns.includes('acquire_date') && (
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('acquire_date')}>Acquired{sortArrow('acquire_date')}</th>
                )}
                {visibleColumns.includes('notes') && <th>Notes</th>}
                {visibleColumns.includes('created_at') && (
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('created_at')}>Added{sortArrow('created_at')}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) =>
                editingId === c.id ? (
                  <tr key={c.id}>
                    <td style={{ display: 'flex', gap: 8 }}>
                      <button className="auth-button" style={{ width: 'auto', padding: '6px 14px', margin: 0 }} onClick={() => saveEdit(c.id)}>Save</button>
                      <button className="logout-button" onClick={() => setEditingId(null)}>Cancel</button>
                    </td>
                    <td>
                      <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
                      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                        <button
                          type="button"
                          className="logout-button"
                          style={{ fontSize: 11, padding: '2px 6px' }}
                          onClick={() => setEditName((editFirstName + ' ' + editLastName).trim())}
                          disabled={!editFirstName.trim() && !editLastName.trim()}
                        >
                          First+Last
                        </button>
                        <button
                          type="button"
                          className="logout-button"
                          style={{ fontSize: 11, padding: '2px 6px' }}
                          onClick={() => setEditName(editCompany.trim())}
                          disabled={!editCompany.trim()}
                        >
                          Company
                        </button>
                      </div>
                    </td>
                    {visibleColumns.includes('company') && (
                      <td><input type="text" value={editCompany} onChange={(e) => setEditCompany(e.target.value)} /></td>
                    )}
                    {visibleColumns.includes('first_name') && (
                      <td><input type="text" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} /></td>
                    )}
                    {visibleColumns.includes('last_name') && (
                      <td><input type="text" value={editLastName} onChange={(e) => setEditLastName(e.target.value)} /></td>
                    )}
                    {visibleColumns.includes('spouse_name') && (
                      <td><input type="text" value={editSpouseName} onChange={(e) => setEditSpouseName(e.target.value)} /></td>
                    )}
                    {visibleColumns.includes('primary_phone') && (
                      <td><input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} /></td>
                    )}
                    {visibleColumns.includes('secondary_phone') && (
                      <td><input type="tel" value={editSecondaryPhone} onChange={(e) => setEditSecondaryPhone(e.target.value)} /></td>
                    )}
                    {visibleColumns.includes('email_1') && (
                      <td><input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} /></td>
                    )}
                    {visibleColumns.includes('email_2') && (
                      <td><input type="email" value={editEmail2} onChange={(e) => setEditEmail2(e.target.value)} /></td>
                    )}
                    {visibleColumns.includes('acquire_date') && (
                      <td><input type="date" value={editAcquireDate} onChange={(e) => setEditAcquireDate(e.target.value)} /></td>
                    )}
                    {visibleColumns.includes('notes') && (
                      <td><input type="text" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} /></td>
                    )}
                    {visibleColumns.includes('created_at') && <td>{new Date(c.created_at).toLocaleDateString()}</td>}
                  </tr>
                ) : (
                  <tr key={c.id}>
                    <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="logout-button" onClick={() => startEdit(c)}>Edit</button>
                      <button className="logout-button" onClick={() => toggleArchive(c)}>
                        {c.is_active ? 'Archive' : 'Reactivate'}
                      </button>
                      {canManageBans && (
                        c.is_banned ? (
                          <button className="logout-button" onClick={() => liftBan(c)}>Lift Ban</button>
                        ) : (
                          <button className="logout-button" onClick={() => fireCustomer(c)}>Fire Customer</button>
                        )
                      )}
                    </td>
                    <td><Link to={`/customers/${c.id}`}>{c.display_name}</Link></td>
                    {visibleColumns.includes('company') && <td>{c.company || '—'}</td>}
                    {visibleColumns.includes('first_name') && <td>{c.first_name || '—'}</td>}
                    {visibleColumns.includes('last_name') && <td>{c.last_name || '—'}</td>}
                    {visibleColumns.includes('spouse_name') && <td>{c.spouse_name || '—'}</td>}
                    {visibleColumns.includes('primary_phone') && <td>{formatPhone(c.primary_phone) || '—'}</td>}
                    {visibleColumns.includes('secondary_phone') && <td>{formatPhone(c.secondary_phone) || '—'}</td>}
                    {visibleColumns.includes('email_1') && <td>{c.email_1 || '—'}</td>}
                    {visibleColumns.includes('email_2') && <td>{c.email_2 || '—'}</td>}
                    {visibleColumns.includes('acquire_date') && <td>{c.acquire_date ? new Date(c.acquire_date + 'T00:00:00').toLocaleDateString() : '—'}</td>}
                    {visibleColumns.includes('notes') && <td>{c.notes || '—'}</td>}
                    {visibleColumns.includes('created_at') && <td>{new Date(c.created_at).toLocaleDateString()}</td>}
                  </tr>
                )
              )}
              {sorted.length === 0 && (
                <tr><td colSpan="13" style={{ color: 'var(--mist)' }}>No customers found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {newItemMode && (
        <QuickAddModal
          mode={newItemMode}
          orgId={selectedOrg}
          profile={profile}
          onClose={() => setNewItemMode(null)}
          onCreated={() => loadCustomers(selectedOrg)}
        />
      )}
    </div>
  )
}
