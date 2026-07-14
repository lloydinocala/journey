import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import { exportToCSV } from './utils/csvExport'

export default function SessionLog({ profile }) {
  const isSuperAdmin = profile.role === 'super_admin'
  const isOrgAdmin = profile.role === 'org_admin'

  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const [searchText, setSearchText] = useState('')
  const [sortField, setSortField] = useState('occurred_at')
  const [sortDirection, setSortDirection] = useState('desc')

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        if (!selectedOrg && data && data.length > 0) setSelectedOrg(data[0].id)
      })
    }
  }, [])

  async function loadRows(orgId) {
    if (!orgId) return
    setLoading(true)
    const { data } = await supabase
      .from('session_log')
      .select('id, event, source, occurred_at, user:users(full_name, role)')
      .eq('org_id', orgId)
      .order('occurred_at', { ascending: false })
      .limit(1000)
    setRows(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadRows(selectedOrg)
  }, [selectedOrg])

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

  const filtered = rows.filter((r) => {
    if (!searchText) return true
    const q = searchText.toLowerCase()
    return r.user?.full_name?.toLowerCase().includes(q) || r.user?.role?.toLowerCase().includes(q)
  })

  const sorted = [...filtered].sort((a, b) => {
    let aVal, bVal
    if (sortField === 'name') {
      aVal = a.user?.full_name || ''
      bVal = b.user?.full_name || ''
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
        { label: 'Name', value: (r) => r.user?.full_name || '—' },
        { label: 'Role', value: (r) => r.user?.role || '—' },
        { key: 'event', label: 'Event' },
        { key: 'source', label: 'Source' },
        { label: 'Date', value: (r) => new Date(r.occurred_at).toLocaleDateString() },
        { label: 'Time', value: (r) => new Date(r.occurred_at).toLocaleTimeString() },
      ],
      'session-log-' + new Date().toISOString().slice(0, 10) + '.csv'
    )
  }

  if (!isSuperAdmin && !isOrgAdmin) {
    return (
      <div>
        <h2 className="page-title">Sign-In / Sign-Out Log</h2>
        <p style={{ color: 'var(--mist)' }}>Only Admins can view this log.</p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="page-title">Sign-In / Sign-Out Log</h2>

      {isSuperAdmin && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>
            Viewing organization
          </label>
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
            placeholder="Name or role…"
          />
        </div>
        <button className="logout-button" style={{ marginBottom: 10 }} onClick={handleExport}>
          Export CSV
        </button>
        <p style={{ color: 'var(--mist)', fontSize: 14, margin: '0 0 12px' }}>
          {sorted.length} record{sorted.length !== 1 ? 's' : ''} (most recent 1000)
        </p>
      </div>

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('name')}>Name{sortArrow('name')}</th>
                <th>Role</th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('event')}>Event{sortArrow('event')}</th>
                <th>Source</th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('occurred_at')}>
                  Date / Time{sortArrow('occurred_at')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id}>
                  <td>{r.user?.full_name || '—'}</td>
                  <td>{r.user?.role || '—'}</td>
                  <td>
                    <span className="badge" style={r.event === 'sign_in' ? {} : { background: '#888', color: '#fff' }}>
                      {r.event === 'sign_in' ? 'Sign In' : 'Sign Out'}
                    </span>
                  </td>
                  <td>{r.source}</td>
                  <td>{new Date(r.occurred_at).toLocaleString()}</td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr><td colSpan="5" style={{ color: 'var(--mist)' }}>No sign-in/out records yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
