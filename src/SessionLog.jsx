import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import { exportToCSV } from './utils/csvExport'

function formatDuration(ms) {
  if (ms == null || ms < 0) return '—'
  const totalMinutes = Math.round(ms / 60000)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

// Pairs each sign_in with the sign_out that immediately follows it for that
// same user (chronologically) and returns { [sign_in_row_id]: durationMs }.
// A sign_in followed by another sign_in (missed logout) is left unpaired
// rather than guessed at.
function computeDurations(allRows) {
  const byUser = {}
  allRows.forEach((r) => {
    if (!r.user_id) return
    if (!byUser[r.user_id]) byUser[r.user_id] = []
    byUser[r.user_id].push(r)
  })
  const durationMap = {}
  Object.values(byUser).forEach((userRows) => {
    const chron = [...userRows].sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at))
    for (let i = 0; i < chron.length - 1; i++) {
      if (chron[i].event === 'sign_in' && chron[i + 1].event === 'sign_out') {
        durationMap[chron[i].id] = new Date(chron[i + 1].occurred_at) - new Date(chron[i].occurred_at)
      }
    }
  })
  return durationMap
}

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
  const [filterUserId, setFilterUserId] = useState('')
  const [filterUserName, setFilterUserName] = useState('')

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
      .select('id, user_id, event, source, occurred_at, user:users!session_log_user_id_fkey(full_name, role), forced_by:users!session_log_initiated_by_fkey(full_name)')
      .eq('org_id', orgId)
      .order('occurred_at', { ascending: false })
      .limit(1000)
    setRows(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadRows(selectedOrg)
  }, [selectedOrg])

  useEffect(() => {
    setFilterUserId('')
    setFilterUserName('')
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

  function isolateUser(r) {
    setFilterUserId(r.user_id)
    setFilterUserName(r.user?.full_name || '')
  }

  const durationMap = computeDurations(rows)

  const filtered = rows.filter((r) => {
    if (filterUserId && r.user_id !== filterUserId) return false
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
        { label: 'Duration', value: (r) => (durationMap[r.id] != null ? formatDuration(durationMap[r.id]) : '') },
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

      {filterUserId && (
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="badge">Isolated: {filterUserName}</span>
          <button
            className="logout-button"
            style={{ fontSize: 12, padding: '2px 10px' }}
            onClick={() => { setFilterUserId(''); setFilterUserName('') }}
          >
            Clear — show everyone
          </button>
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
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id}>
                  <td>
                    <button
                      onClick={() => isolateUser(r)}
                      title="Isolate this person's history"
                      style={{ background: 'none', border: 'none', padding: 0, color: 'var(--route-blue)', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}
                    >
                      {r.user?.full_name || '—'}
                    </button>
                  </td>
                  <td>{r.user?.role || '—'}</td>
                  <td>
                    <span className="badge" style={r.event === 'sign_in' ? {} : { background: '#888', color: '#fff' }}>
                      {r.event === 'sign_in' ? 'Sign In' : 'Sign Out'}
                    </span>
                    {r.forced_by && (
                      <span style={{ marginLeft: 6, fontSize: 11, color: '#a33' }}>
                        forced by {r.forced_by.full_name}
                      </span>
                    )}
                  </td>
                  <td>{r.source}</td>
                  <td>{new Date(r.occurred_at).toLocaleString()}</td>
                  <td>{durationMap[r.id] != null ? formatDuration(durationMap[r.id]) : (r.event === 'sign_in' ? 'Still signed in / no matching sign-out' : '—')}</td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr><td colSpan="6" style={{ color: 'var(--mist)' }}>No sign-in/out records yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
