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
  const [permissionsCatalog, setPermissionsCatalog] = useState([])

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('tech')
  const [color, setColor] = useState('#2F5DE3')
  const [selectedPermissions, setSelectedPermissions] = useState([])
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
  const [editPermissions, setEditPermissions] = useState([])

  // Tag model: Role = department, Tags = positions (user_job_roles). Legacy role/is_field_supervisor are kept for access during transition — never downgraded here.
  const DEPARTMENTS = ['Admin', 'Field', 'Shop', 'Front Office', 'Back Office']
  const [tagsCatalog, setTagsCatalog] = useState([])
  const [permsByTag, setPermsByTag] = useState({})
  const [addDept, setAddDept] = useState('Field')
  const [addTags, setAddTags] = useState([])
  const [editDept, setEditDept] = useState('')
  const [editTags, setEditTags] = useState([])

  const isSuperAdmin = profile.role === 'super_admin'

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id))
    supabase
      .from('permissions')
      .select('key, label, description, category, sort_order')
      .order('sort_order')
      .then(({ data }) => setPermissionsCatalog(data || []))
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
    const [membersRes, permsRes, tagsRes, rpRes, ujrRes] = await Promise.all([
      supabase
        .from('users')
        .select('id, full_name, email, role, calendar_color, is_active, is_field_supervisor')
        .eq('org_id', orgId)
        .order('full_name'),
      supabase.from('user_permissions').select('user_id, permission_key').eq('org_id', orgId),
      supabase.from('job_roles').select('id, name, department, is_oncall, sort_order').eq('org_id', orgId).order('sort_order'),
      supabase.from('role_permissions').select('role_id, permission_key').eq('org_id', orgId),
      supabase.from('user_job_roles').select('user_id, job_role_id').eq('org_id', orgId),
    ])

    const permsByUser = {}
    ;(permsRes.data || []).forEach((p) => {
      if (!permsByUser[p.user_id]) permsByUser[p.user_id] = []
      permsByUser[p.user_id].push(p.permission_key)
    })
    const tagsByUser = {}
    ;(ujrRes.data || []).forEach((r) => {
      if (!tagsByUser[r.user_id]) tagsByUser[r.user_id] = []
      tagsByUser[r.user_id].push(r.job_role_id)
    })
    const pbt = {}
    ;(rpRes.data || []).forEach((r) => { (pbt[r.role_id] = pbt[r.role_id] || new Set()).add(r.permission_key) })

    setTagsCatalog(tagsRes.data || [])
    setPermsByTag(pbt)
    setMembers((membersRes.data || []).map((m) => ({ ...m, permission_keys: permsByUser[m.id] || [], tag_ids: tagsByUser[m.id] || [] })))
    setLoading(false)
  }

  function inheritedKeys(tagIds) {
    const s = new Set()
    ;(tagIds || []).forEach((id) => (permsByTag[id] || new Set()).forEach((k) => s.add(k)))
    return s
  }
  function deptOf(tagIds) {
    const t = tagsCatalog.find((x) => (tagIds || []).includes(x.id) && x.department)
    return t ? t.department : ''
  }
  function tagNames(tagIds) {
    return tagsCatalog.filter((x) => (tagIds || []).includes(x.id)).map((x) => x.name)
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

  function togglePermission(list, setList, key) {
    setList(list.includes(key) ? list.filter((k) => k !== key) : [...list, key])
  }

  async function syncPermissions(userId, orgId, keys) {
    await supabase.from('user_permissions').delete().eq('user_id', userId)
    if (keys.length > 0) {
      const { data: sessionData } = await supabase.auth.getUser()
      await supabase.from('user_permissions').insert(
        keys.map((permission_key) => ({
          org_id: orgId,
          user_id: userId,
          permission_key,
          granted_by: sessionData.user?.id || null,
        }))
      )
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!fullName.trim() || !email.trim()) return

    setSaving(true)
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session.access_token

    const derivedRole = addDept === 'Admin' ? 'org_admin' : 'tech'
    const { data, error } = await supabase.functions.invoke('create-team-member', {
      body: {
        action: 'invite',
        email: email.trim(),
        full_name: fullName.trim(),
        role: derivedRole,
        org_id: selectedOrg,
        calendar_color: color,
        permission_keys: [],
      },
      headers: { Authorization: `Bearer ${token}` },
    })

    setSaving(false)

    if (error) {
      let msg = error.message
      try { const b = await error.context?.json(); if (b?.error) msg = b.error } catch (_) { /* keep generic */ }
      setError(msg)
    } else if (data?.error) {
      setError(data.error)
    } else {
      // attach the chosen tags to the freshly-created user; grant field-supervisor if a tag confers all-jobs access
      const { data: newUser } = await supabase.from('users').select('id').eq('org_id', selectedOrg).eq('email', email.trim()).maybeSingle()
      if (newUser?.id && addTags.length) {
        await supabase.from('user_job_roles').insert(addTags.map((job_role_id) => ({ org_id: selectedOrg, user_id: newUser.id, job_role_id })))
        if (inheritedKeys(addTags).has('view_all_jobs')) {
          await supabase.from('users').update({ is_field_supervisor: true }).eq('id', newUser.id)
        }
      }
      setSuccess(`Invite sent to ${email}.`)
      setFullName('')
      setEmail('')
      setAddTags([])
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
    setEditPermissions(member.permission_keys || [])
    setEditDept(deptOf(member.tag_ids) || '')
    setEditTags(member.tag_ids || [])
  }

  async function saveEdit(member) {
    setError('')
    const newRole = editDept === 'Admin' ? 'org_admin' : member.role
    const grantSup = inheritedKeys(editTags).has('view_all_jobs')
    await supabase
      .from('users')
      .update({
        full_name: editName.trim(),
        role: newRole,
        calendar_color: editColor,
        is_field_supervisor: grantSup ? true : member.is_field_supervisor,
      })
      .eq('id', member.id)

    await supabase.from('user_job_roles').delete().eq('user_id', member.id)
    if (editTags.length) {
      await supabase.from('user_job_roles').insert(editTags.map((job_role_id) => ({ org_id: selectedOrg, user_id: member.id, job_role_id })))
    }

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

  async function forceSignOut(member) {
    if (
      !window.confirm(
        `Force sign out ${member.full_name}?\n\nThis immediately ends their access and signs them out of any active session. They will need to be Reactivated before they can sign in again.`
      )
    )
      return
    setError('')
    const { error } = await supabase.rpc('force_sign_out', { target_user_id: member.id })
    if (error) {
      setError(error.message)
      return
    }
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

  function permissionLabel(key) {
    return permissionsCatalog.find((p) => p.key === key)?.label || key
  }

  function handleExport() {
    exportToCSV(
      sorted,
      [
        { key: 'full_name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { label: 'Role', value: (m) => deptOf(m.tag_ids) || m.role },
        { label: 'Tags', value: (m) => tagNames(m.tag_ids).join('; ') },
        { label: 'Status', value: (m) => (m.is_active ? 'Active' : 'Deactivated') },
        { label: 'Permissions', value: (m) => `${inheritedKeys(m.tag_ids).size} inherited` },
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
          <label htmlFor="dept">Role (department)</label>
          <select id="dept" value={addDept} onChange={(e) => { setAddDept(e.target.value); setAddTags([]) }}>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="color">Calendar color</label>
          <input id="color" type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 60, padding: 4, height: 40 }} />
        </div>
        <div className="field" style={{ flexBasis: '100%' }}>
          <label>Tags (positions)</label>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {tagsCatalog.filter((t) => !t.is_oncall && t.department === addDept).map((t) => (
              <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={addTags.includes(t.id)}
                  onChange={() => setAddTags((prev) => prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id])} />
                {t.name}
              </label>
            ))}
            {tagsCatalog.filter((t) => !t.is_oncall && t.department === addDept).length === 0 && (
              <span style={{ fontSize: 12, color: 'var(--mist)' }}>No tags in this department yet &mdash; add them under Roles &amp; Tags.</span>
            )}
          </div>
          {addTags.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--mist)', marginTop: 6 }}>
              Inherits {inheritedKeys(addTags).size} permission{inheritedKeys(addTags).size === 1 ? '' : 's'} from {addTags.length} tag{addTags.length === 1 ? '' : 's'}. What each tag grants is managed under Roles &amp; Tags.
            </div>
          )}
        </div>
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
        <div className="grid-table" style={{ gridTemplateColumns: '0.4fr 1.3fr 1.5fr 1.6fr 1fr 1.8fr' }}>
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
                    <select value={editDept} onChange={(e) => { setEditDept(e.target.value); setEditTags([]) }}>
                      <option value="">&mdash; department &mdash;</option>
                      {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <div style={{ marginTop: 4 }}>
                      {tagsCatalog.filter((t) => !t.is_oncall && t.department === editDept).map((t) => (
                        <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, marginTop: 3, cursor: 'pointer', color: 'var(--mist)' }}>
                          <input type="checkbox" checked={editTags.includes(t.id)}
                            onChange={() => setEditTags((prev) => prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id])} />
                          {t.name}
                        </label>
                      ))}
                    </div>
                    {editTags.length > 0 && <div style={{ fontSize: 10, color: 'var(--mist)', marginTop: 3 }}>Inherits {inheritedKeys(editTags).size} permissions</div>}
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
                    {deptOf(m.tag_ids) || <span style={{ color: 'var(--mist)' }}>{m.role}</span>}
                    <div style={{ marginTop: 4 }}>
                      {tagNames(m.tag_ids).length > 0 ? (
                        tagNames(m.tag_ids).map((n) => (
                          <span key={n} className="badge" style={{ marginRight: 4, fontSize: 10 }}>{n}</span>
                        ))
                      ) : (
                        <span style={{ fontSize: 10, color: 'var(--mist)' }}>No tags assigned</span>
                      )}
                      {m.tag_ids && m.tag_ids.length > 0 && (
                        <div style={{ fontSize: 10, color: 'var(--mist)', marginTop: 2 }}>{inheritedKeys(m.tag_ids).size} permissions</div>
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
                  {m.id !== currentUserId && m.is_active && (
                    <button
                      className="logout-button"
                      style={{ color: '#a33' }}
                      onClick={() => forceSignOut(m)}
                    >
                      Force Sign Out
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
