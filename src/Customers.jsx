import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import NewItemDropdown from './NewItemDropdown'
import QuickAddModal from './QuickAddModal'

export default function Customers({ profile }) {
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [customers, setCustomers] = useState([])
  const [showArchived, setShowArchived] = useState(false)
  const [loading, setLoading] = useState(true)
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [newItemMode, setNewItemMode] = useState(null)

  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')

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
    const { data, error } = await supabase
      .from('customers')
      .select('id, display_name, primary_phone, email_1, created_at, is_active, is_banned, banned_reason')
      .eq('org_id', orgId)
      .eq('is_active', !showArchived)
      .order('created_at', { ascending: false })
    if (!error) setCustomers(data)
    setLoading(false)
  }

  useEffect(() => {
    loadCustomers(selectedOrg)
  }, [selectedOrg, showArchived])

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    if (!displayName.trim() || !selectedOrg) return

    setSaving(true)
    const { error } = await supabase.from('customers').insert({
      org_id: selectedOrg,
      display_name: displayName.trim(),
      primary_phone: phone.trim() || null,
      email_1: email.trim() || null,
    })
    setSaving(false)

    if (error) {
      setError(error.message)
    } else {
      setDisplayName('')
      setPhone('')
      setEmail('')
      loadCustomers(selectedOrg)
    }
  }

  function startEdit(c) {
    setEditingId(c.id)
    setEditName(c.display_name)
    setEditPhone(c.primary_phone || '')
    setEditEmail(c.email_1 || '')
  }

  async function saveEdit(id) {
    await supabase
      .from('customers')
      .update({
        display_name: editName.trim(),
        primary_phone: editPhone.trim() || null,
        email_1: editEmail.trim() || null,
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 className="page-title" style={{ marginBottom: 0 }}>Customers</h2>
        <NewItemDropdown onSelect={setNewItemMode} />
      </div>

      {isSuperAdmin && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      <form className="inline-form" onSubmit={handleAdd} style={{ marginBottom: 20 }}>
        <div className="field">
          <label htmlFor="custName">Name</label>
          <input
            id="custName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. William Gaal"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="custPhone">Phone</label>
          <input
            id="custPhone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(352) 555-0100"
          />
        </div>
        <div className="field">
          <label htmlFor="custEmail">Email</label>
          <input
            id="custEmail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="optional"
          />
        </div>
        <button className="auth-button" type="submit" disabled={saving}>
          {saving ? 'Adding…' : 'Add customer'}
        </button>
      </form>

      <div style={{ marginBottom: 20 }}>
        <label className="nav-link" style={{ cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          Show archived customers
        </label>
      </div>

      {error && <div className="auth-error">{error}</div>}

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Added</th>
              <th>Flags</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) =>
              editingId === c.id ? (
                <tr key={c.id}>
                  <td><input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} /></td>
                  <td><input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} /></td>
                  <td><input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} /></td>
                  <td>{new Date(c.created_at).toLocaleDateString()}</td>
                  <td></td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button className="auth-button" style={{ width: 'auto', padding: '6px 14px', margin: 0 }} onClick={() => saveEdit(c.id)}>Save</button>
                    <button className="logout-button" onClick={() => setEditingId(null)}>Cancel</button>
                  </td>
                </tr>
              ) : (
                <tr key={c.id}>
                  <td>{c.display_name}</td>
                  <td>{c.primary_phone || '—'}</td>
                  <td>{c.email_1 || '—'}</td>
                  <td>{new Date(c.created_at).toLocaleDateString()}</td>
                  <td>
                    {!c.is_active && <span className="status-pill status-canceled" style={{ marginRight: 6 }}>Archived</span>}
                    {c.is_banned && (
                      <span className="status-pill status-past_due" title={c.banned_reason || 'No reason given'}>
                        Do Not Service
                      </span>
                    )}
                  </td>
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
                </tr>
              )
            )}
            {customers.length === 0 && (
              <tr><td colSpan="6" style={{ color: 'var(--mist)' }}>No customers found.</td></tr>
            )}
          </tbody>
        </table>
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
