import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import { exportToCSV } from './utils/csvExport'

const COLUMNS = [
  { key: 'full_name', label: 'Name', required: true },
  { key: 'email', label: 'Email' },
  { key: 'role', label: 'Role' },
  { key: 'status', label: 'Status' },
]

export default function Team({ profile }) {
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState(null)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('tech')
  const [color, setColor] = useState('#2F5DE3')
  const [canViewAccounting, setCanViewAccounting] = useState(false)
  const [canViewOperations, setCanViewOperations] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [searchText, setSearchText] = useState('')
  const [sortField, setSortField] = useState('full_name')
  const [sortDirection, setSortDirection] = useState('asc')
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('team_visible_columns')
    return saved ? JSON.parse(saved) : COLUMNS.map((c) => c.key)
  })

  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState('tech')
  const [editColor, setEditColor] = useState('#2F5DE3')
  const [editEmail, setEditEmail] = useState('')
  const [editSupervisor, setEditSupervisor] = useState(false)
  const [editCanViewAccounting, setEditCanViewAccounting] = useState(false)
  const [editCanViewOperations, setEditCanViewOperations] = useState(false)

  const isSuperAdmin = profile.role === 'super_admin'

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id))
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        if (!selectedOrg && data && data.length > 0) setSelectedOrg(data[0].id)
      })
    }
  }, [])

  async function loadMembers(orgId) {
    if (!orgId) return
    setLoading(true)
    const { data } = await supabase
      .from('users')
      .select('id, full_name, email, role, calendar_color, is_active, is_field_supervisor, can_view_accounting, can_view_operations')
      .eq('org_id', orgId)
      .order('full_name')
    setMembers(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadMembers(selectedOrg)
  }, [selectedOrg])

  useEffect(() => {
    localStorage.setItem('team_visible_columns', JSON.stringify(visibleColumns))
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
    setSuccess('')
    if (!fullName.trim() || !email.trim()) return

    setSaving(true)
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session.access_token

    const { data, error } = await supabase.functions.invoke('create-team-member', {
      body: {
        action: 'invite',
        email: email.trim(),
        full_name: fullName.trim(),
        role,
        org_id: selectedOrg,
        calendar_color: color,
        can_view_accounting: canViewAccounting,
        can_view_operations: canViewOperations,
      },
      headers: { Authorization: `Bearer ${token}` },
    })

    setSaving(false)

    if (error) {
      setError(error.message)
    } else if (data?.error) {
      setError(data.error)
    } else {
      setSuccess(`Invite sent to ${email}.`)
      setFullName('')
      setEmail('')
      setRole('tech')
      setCanViewAccounting(false)
      setCanViewOperations(false)
      loadMembers(selectedOrg)
    }
  }

  function startEdit(member) {
    setEditingId(member.id)
    setEditName(member.full_name)
    setEditRole(member.role)
    setEditColor(member.calendar_color || '#2F5DE3')
    setEditEmail(member.email)
    setEditSupervisor(!!member.is_field_supervisor)
    setEditCanViewAccounting(!!member.can_view_accounting)
    setEditCanViewOperations(!!member.can_view_operations)
  }

  async function saveEdit(member) {
    setError('')
    await supabase
      .from('users')
      .update({
        full_name: editName.trim(),
        role: editRole,
        calendar_color: editColor,
        is_field_supervisor: editSupervisor,
        can_view_accounting: editCanViewAccounting,
        can_view_operations: editCanViewOperations,
      })
      .eq('id', member.id)

    if (editEmail.trim() !== member.email) {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session.access_token
      const { data, error } = await supabase.functions.invoke('create-team-member', {
        body: { action: 'update_email', user_id: member.id, new_email: editEmail.trim() },
        headers: { Authorization: `Bearer ${token}` },
      })
      if (error) {
        setError(error.message)
        return
      }
      if (data?.error) {
        setError(data.error)
        return
      }
    }

    setEditingId(null)
    loadMembers(selectedOrg)
  }

  async function toggleActive(member) {
    const action = member.is_active ? 'deactivate' : 'reactivate'
    if (!window.confirm(`Are you sure you want to ${action} ${member.full_name}?`)) return
    await supabase.from('users').update({ is_active: !member.is_active }).eq('id', member.id)
    loadMembers(selectedOrg)
  }

  const [resetSentId, setResetSentId] = useState(null)

  async function handleResetPassword(member) {
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(member.email, {
      redirectTo: window.location.origin,
    })
    if (error) {
      setError(error.message)
      return
    }
    setResetSentId(member.id)
    setTimeout(() => setResetSentId(null), 4000)
  }

  const filtered = members.filter((m) => {
    if (!searchText) return true
    const q = searchText.toLowerCase()
    return m.full_name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q) || m.role?.toLowerCase().includes(q)
  })

  const sorted = [...filtered].sort((a, b) => {
    let aVal, bVal
    if (sortField === 'status') {
      aVal = a.is_active ? 1 : 0
      bVal = b.is_active ? 1 : 0
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
        { key: 'full_name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'role', label: 'Role' },
        { label: 'Status', value: (m) => (m.is_active ? 'Active' : 'Deactivated') },
        { label: 'Accounting Access', value: (m) => (m.role === 'org_admin' || m.can_view_accounting ? 'Yes' : 'No') },
        { label: 'Operations Access', value: (m) => (m.role === 'org_admin' || m.can_view_operations ? 'Yes' : 'No') },
      ],
      'team-' + new Date().toISOString().slice(0, 10) + '.csv'
)
  }

  return (
    <div>
      <h2 className="page-title">Team</h2>

      {isSuperAdmin && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      <form className="inline-form" onSubmit={handleAdd} style={{ marginBottom: 28, flexWrap: 'wrap' }}>
        <div className="field">
          <label htmlFor="fullName">Name</label>
          <input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Orlando Ayala" required />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="orlando@aircareconnect.com" required />
        </div>
        <div className="field">
          <label htmlFor="role">Role</label>
          <select id="role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="tech">Technician</option>
            <option value="csr">CSR / Office</option>
            <option value="org_admin">Admin</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="color">Calendar color</label>
          <input id="color" type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 60, padding: 4, height: 40 }} />
        </div>
        {role !== 'org_admin' && (
          <div className="field">
            <label>Dashboard Access</label>
            <div style={{ display: 'flex', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={canViewAccounting} onChange={(e) => setCanViewAccounting(e.target.checked)} />
                Accounting
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={canViewOperations} onChange={(e) => setCanViewOperations(e.target.checked)} />
                Operations
              </label>
            </div>
          </div>
        )}
        <button className="auth-button" type="submit" disabled={saving}>
          {saving ? 'Sending invite…' : 'Send invite'}
        </button>
      </form>

      {error && <div className="auth-error">{error}</div>}
      {success && (
        <div style={{ background: 'rgba(76, 217, 123, 0.12)', border: '1px solid rgba(76, 217, 123, 0.3)', color: '#4CD97B', fontSize: 13, padding: '10px 12px', borderRadius: 8, marginBottom: 16 }}>
          {success}
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
            placeholder="Name, email, or role…"
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
          {sorted.length} member{sorted.length !== 1 ? 's' : ''}
        </p>
      </div>

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : (
        <div className="grid-table" style={{ gridTemplateColumns: '0.4fr 1.3fr 1.5fr 1.3fr 1fr 1.8fr' }}>
          <div className="grid-cell grid-head"></div>
          <div className="grid-cell grid-head" style={{ cursor: 'pointer' }} onClick={() => toggleSort('full_name')}>Name{sortArrow('full_name')}</div>
          {visibleColumns.includes('email') && (
            <div className="grid-cell grid-head" style={{ cursor: 'pointer' }} onClick={() => toggleSort('email')}>Email{sortArrow('email')}</div>
          )}
          {visibleColumns.includes('role') && (
            <div className="grid-cell grid-head" style={{ cursor: 'pointer' }} onClick={() => toggleSort('role')}>Role{sortArrow('role')}</div>
          )}
          {visibleColumns.includes('status') && (
            <div className="grid-cell grid-head" style={{ cursor: 'pointer' }} onClick={() => toggleSort('status')}>Status{sortArrow('status')}</div>
          )}
          <div className="grid-cell grid-head"></div>

          {sorted.map((m) =>
            editingId === m.id ? (
              <>
                <div className="grid-cell">
                  <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} style={{ width: 40, height: 32, padding: 2 }} />
                </div>
                <div className="grid-cell">
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                {visibleColumns.includes('email') && (
                  <div className="grid-cell">
                    <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                  </div>
                )}
                {visibleColumns.includes('role') && (
                  <div className="grid-cell">
                    <select value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                      <option value="tech">Technician</option>
                      <option value="csr">CSR / Office</option>
                      <option value="org_admin">Admin</option>
                    </select>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, marginTop: 4, cursor: 'pointer', color: 'var(--mist)' }}>
                      <input type="checkbox" checked={editSupervisor} onChange={(e) => setEditSupervisor(e.target.checked)} />
                      Field Supervisor (mobile admin access)
                    </label>
                    {editRole !== 'org_admin' && (
                      <>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, marginTop: 4, cursor: 'pointer', color: 'var(--mist)' }}>
                          <input type="checkbox" checked={editCanViewAccounting} onChange={(e) => setEditCanViewAccounting(e.target.checked)} />
                          Dashboard: Accounting
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, marginTop: 4, cursor: 'pointer', color: 'var(--mist)' }}>
                          <input type="checkbox" checked={editCanViewOperations} onChange={(e) => setEditCanViewOperations(e.target.checked)} />
                          Dashboard: Operations
                        </label>
                      </>
                    )}
                  </div>
                )}
                {visibleColumns.includes('status') && <div className="grid-cell">{m.is_active ? 'Active' : 'Deactivated'}</div>}
                <div className="grid-cell grid-actions">
                  <button className="auth-button" style={{ width: 'auto', padding: '6px 14px', margin: 0 }} onClick={() => saveEdit(m)}>Save</button>
                  <button className="logout-button" onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <div className="grid-cell"><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: m.calendar_color || 'var(--mist)' }} /></div>
                <div className="grid-cell">{m.full_name}</div>
                {visibleColumns.includes('email') && <div className="grid-cell">{m.email}</div>}
                {visibleColumns.includes('role') && (
                  <div className="grid-cell">
                    {m.role}
                    {m.is_field_supervisor && <span className="badge" style={{ marginLeft: 6, fontSize: 10 }}>Supervisor</span>}
                    <div style={{ marginTop: 4 }}>
                      {m.role === 'org_admin' ? (
                        <span className="badge" style={{ fontSize: 10 }}>Full Dashboard Access</span>
                      ) : (
                        <>
                          {m.can_view_accounting && <span className="badge" style={{ marginRight: 4, fontSize: 10 }}>Accounting</span>}
                          {m.can_view_operations && <span className="badge" style={{ fontSize: 10 }}>Operations</span>}
                          {!m.can_view_accounting && !m.can_view_operations && (
                            <span style={{ fontSize: 10, color: 'var(--mist)' }}>No dashboard access</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
                {visibleColumns.includes('status') && (
                  <div className="grid-cell">
                    <span className={`status-pill ${m.is_active ? 'status-active' : 'status-canceled'}`}>
                      {m.is_active ? 'Active' : 'Deactivated'}
                    </span>
                  </div>
                )}
                <div className="grid-cell grid-actions">
                  <button className="logout-button" onClick={() => startEdit(m)}>Edit</button>
                  <button className="logout-button" onClick={() => handleResetPassword(m)}>
                    {resetSentId === m.id ? 'Email sent!' : 'Reset Password'}
                  </button>
                  {m.id !== currentUserId && (
                    <button className="logout-button" onClick={() => toggleActive(m)}>
                      {m.is_active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  )}
                </div>
              </>
            )
          )}
          {sorted.length === 0 && (
            <div className="grid-cell" style={{ gridColumn: '1 / -1', color: 'var(--mist)' }}>No team members found.</div>
          )}
        </div>
      )}
    </div>
  )
}
