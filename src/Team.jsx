import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'

export default function Team({ profile }) {
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('tech')
  const [color, setColor] = useState('#2F5DE3')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const isSuperAdmin = profile.role === 'super_admin'

  useEffect(() => {
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
      .select('id, full_name, email, role, calendar_color')
      .eq('org_id', orgId)
      .order('full_name')
    setMembers(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadMembers(selectedOrg)
  }, [selectedOrg])

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
        email: email.trim(),
        full_name: fullName.trim(),
        role,
        org_id: selectedOrg,
        calendar_color: color,
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
      loadMembers(selectedOrg)
    }
  }

  return (
    <div>
      <h2 className="page-title">Team</h2>

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

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th></th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: m.calendar_color || 'var(--mist)' }} /></td>
                <td>{m.full_name}</td>
                <td>{m.email}</td>
                <td>{m.role}</td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr><td colSpan="4" style={{ color: 'var(--mist)' }}>No team members yet.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
