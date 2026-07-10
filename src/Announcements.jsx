import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import { exportToCSV } from './utils/csvExport'

const BROADCAST = '__broadcast__'

const COLUMNS = [
  { key: 'target', label: 'Target', required: true },
  { key: 'severity', label: 'Type' },
  { key: 'message', label: 'Message', required: true },
  { key: 'status', label: 'Status' },
]

export default function Announcements() {
  const [orgs, setOrgs] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)

  const [targetOrg, setTargetOrg] = useState(BROADCAST)
  const [severity, setSeverity] = useState('info')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [searchText, setSearchText] = useState('')
  const [sortField, setSortField] = useState('target')
  const [sortDirection, setSortDirection] = useState('asc')
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('announcements_visible_columns')
    return saved ? JSON.parse(saved) : COLUMNS.map((c) => c.key)
  })

  useEffect(() => {
    supabase.from('organizations').select('id, name').order('name').then(({ data }) => setOrgs(data || []))
    loadAnnouncements()
  }, [])

  useEffect(() => {
    localStorage.setItem('announcements_visible_columns', JSON.stringify(visibleColumns))
  }, [visibleColumns])

  async function loadAnnouncements() {
    setLoading(true)
    const { data } = await supabase
      .from('org_announcements')
      .select('id, org_id, severity, message, is_active, created_at, organizations(name)')
      .order('created_at', { ascending: false })
    setAnnouncements(data || [])
    setLoading(false)
  }

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

  function targetLabel(a) {
    return a.organizations?.name || 'All organizations'
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    if (!message.trim()) return

    setSaving(true)
    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase.from('org_announcements').insert({
      org_id: targetOrg === BROADCAST ? null : targetOrg,
      severity,
      message: message.trim(),
      created_by: userData.user.id,
    })
    setSaving(false)

    if (error) {
      setError(error.message)
    } else {
      setMessage('')
      loadAnnouncements()
    }
  }

  async function toggleActive(a) {
    await supabase.from('org_announcements').update({ is_active: !a.is_active }).eq('id', a.id)
    loadAnnouncements()
  }

  const filtered = announcements.filter((a) => {
    if (!searchText) return true
    const q = searchText.toLowerCase()
    return targetLabel(a).toLowerCase().includes(q) || a.message?.toLowerCase().includes(q)
  })

  const sorted = [...filtered].sort((a, b) => {
    let aVal, bVal
    if (sortField === 'target') {
      aVal = targetLabel(a)
      bVal = targetLabel(b)
    } else if (sortField === 'status') {
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
        { label: 'Target', value: targetLabel },
        { key: 'severity', label: 'Type' },
        { key: 'message', label: 'Message' },
        { label: 'Status', value: (a) => (a.is_active ? 'Active' : 'Off') },
      ],
      'announcements-' + new Date().toISOString().slice(0, 10) + '.csv'
    )
  }

  return (
    <div>
      <h2 className="page-title">Announcements</h2>
      <p style={{ color: 'var(--mist)', fontSize: 14, marginTop: -12, marginBottom: 20 }}>
        Messages appear at the top of the app for whoever you target — above the
        navigation bar, before they can miss it. Turn one off once it's resolved.
      </p>

      <form className="inline-form" onSubmit={handleAdd} style={{ marginBottom: 28, flexWrap: 'wrap' }}>
        <div className="field">
          <label htmlFor="targetOrg">Send to</label>
          <select id="targetOrg" value={targetOrg} onChange={(e) => setTargetOrg(e.target.value)}>
            <option value={BROADCAST}>All organizations</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="severity">Type</label>
          <select id="severity" value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="info">Info (blue)</option>
            <option value="warning">Warning (amber)</option>
            <option value="critical">Critical (red)</option>
          </select>
        </div>
        <div className="field" style={{ minWidth: 320 }}>
          <label htmlFor="message">Message</label>
          <input
            id="message"
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. Your account is 5 days from suspension for non-payment."
            required
          />
        </div>
        <button className="auth-button" type="submit" disabled={saving}>
          {saving ? 'Sending…' : 'Send'}
        </button>
      </form>

      {error && <div className="auth-error">{error}</div>}

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ marginBottom: 0, minWidth: 220 }}>
          <label htmlFor="searchBox">Search</label>
          <input
            id="searchBox"
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Target or message…"
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
          {sorted.length} announcement{sorted.length !== 1 ? 's' : ''}
        </p>
      </div>

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : (
        <div className="grid-table" style={{ gridTemplateColumns: '1fr 0.7fr 2fr 0.7fr 1fr' }}>
          <div className="grid-cell grid-head" style={{ cursor: 'pointer' }} onClick={() => toggleSort('target')}>Target{sortArrow('target')}</div>
          {visibleColumns.includes('severity') && (
            <div className="grid-cell grid-head" style={{ cursor: 'pointer' }} onClick={() => toggleSort('severity')}>Type{sortArrow('severity')}</div>
          )}
          <div className="grid-cell grid-head">Message</div>
          {visibleColumns.includes('status') && (
            <div className="grid-cell grid-head" style={{ cursor: 'pointer' }} onClick={() => toggleSort('status')}>Status{sortArrow('status')}</div>
          )}
          <div className="grid-cell grid-head"></div>

          {sorted.map((a) => (
            <>
              <div className="grid-cell">{targetLabel(a)}</div>
              {visibleColumns.includes('severity') && (
                <div className="grid-cell">
                  <span className={`status-pill status-${a.severity === 'critical' ? 'past_due' : a.severity === 'warning' ? 'trial' : 'scheduled'}`}>
                    {a.severity}
                  </span>
                </div>
              )}
              <div className="grid-cell">{a.message}</div>
              {visibleColumns.includes('status') && (
                <div className="grid-cell">
                  <span className={`status-pill ${a.is_active ? 'status-active' : 'status-canceled'}`}>
                    {a.is_active ? 'Active' : 'Off'}
                  </span>
                </div>
              )}
              <div className="grid-cell grid-actions">
                <button className="logout-button" onClick={() => toggleActive(a)}>
                  {a.is_active ? 'Turn off' : 'Turn on'}
                </button>
              </div>
            </>
          ))}
          {sorted.length === 0 && (
            <div className="grid-cell" style={{ gridColumn: '1 / -1', color: 'var(--mist)' }}>No announcements found.</div>
          )}
        </div>
      )}
    </div>
  )
}
