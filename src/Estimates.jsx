import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import { exportToCSV } from './utils/csvExport'

const COLUMNS = [
  { key: 'invoice_date', label: 'Date', required: true },
  { key: 'invoice_number', label: 'Estimate #', required: true },
  { key: 'customer', label: 'Customer' },
  { key: 'amount_due', label: 'Estimated Total' },
  { key: 'status', label: 'Status' },
]

export default function Estimates({ profile }) {
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [estimates, setEstimates] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [sortField, setSortField] = useState('invoice_date')
  const [sortDirection, setSortDirection] = useState('desc')
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('estimates_visible_columns')
    return saved ? JSON.parse(saved) : COLUMNS.map((c) => c.key)
  })

  const isSuperAdmin = profile.role === 'super_admin'

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        if (!selectedOrg && data && data.length > 0) setSelectedOrg(data[0].id)
      })
    }
  }, [])

  async function loadEstimates(orgId) {
    if (!orgId) return
    setLoading(true)
    const { data } = await supabase
      .from('invoices')
      .select('id, invoice_number, invoice_date, job_id, amount_due, sent_at, jobs(job_number, properties(customers!properties_customer_id_fkey(display_name)))')
      .eq('org_id', orgId)
      .eq('kind', 'estimate')
    setEstimates(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadEstimates(selectedOrg)
  }, [selectedOrg])

  useEffect(() => {
    localStorage.setItem('estimates_visible_columns', JSON.stringify(visibleColumns))
  }, [visibleColumns])

  function toggleColumn(key) {
    setVisibleColumns((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  function customerName(est) {
    return est.jobs?.properties?.customers?.display_name || 'Unknown'
  }

  function statusLabel(est) {
    return est.sent_at ? 'Sent' : 'Draft'
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

  const filtered = estimates.filter((est) => {
    if (searchText) {
      const q = searchText.toLowerCase()
      const matchesNumber = est.invoice_number?.toLowerCase().includes(q)
      const matchesCustomer = customerName(est).toLowerCase().includes(q)
      const matchesJob = est.jobs?.job_number?.toLowerCase().includes(q)
      if (!matchesNumber && !matchesCustomer && !matchesJob) return false
    }
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    let aVal, bVal
    if (sortField === 'invoice_date') {
      aVal = a.invoice_date || ''
      bVal = b.invoice_date || ''
    } else if (sortField === 'customer') {
      aVal = customerName(a)
      bVal = customerName(b)
    } else if (sortField === 'amount_due') {
      aVal = a.amount_due || 0
      bVal = b.amount_due || 0
    } else if (sortField === 'status') {
      aVal = a.sent_at ? 1 : 0
      bVal = b.sent_at ? 1 : 0
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
        { key: 'invoice_date', label: 'Date' },
        { key: 'invoice_number', label: 'Estimate #' },
        { label: 'Customer', value: customerName },
        { key: 'amount_due', label: 'Estimated Total' },
        { label: 'Status', value: statusLabel },
      ],
      'estimates-' + new Date().toISOString().slice(0, 10) + '.csv'
    )
  }

  return (
    <div>
      <div className="page-header-bar">
        <h2>Job Estimates</h2>
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
            placeholder="Estimate #, job #, or customer…"
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
          {filtered.length} estimate{filtered.length !== 1 ? 's' : ''}
        </p>
      </div>

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : (
        <div className="grid-table" style={{ gridTemplateColumns: '1fr 1fr 1.5fr 1fr 1fr' }}>
          <div className="grid-cell grid-head" style={{ cursor: 'pointer' }} onClick={() => toggleSort('invoice_date')}>
            Date{sortArrow('invoice_date')}
          </div>
          <div className="grid-cell grid-head">Estimate #</div>
          {visibleColumns.includes('customer') && (
            <div className="grid-cell grid-head" style={{ cursor: 'pointer' }} onClick={() => toggleSort('customer')}>
              Customer{sortArrow('customer')}
            </div>
          )}
          {visibleColumns.includes('amount_due') && (
            <div className="grid-cell grid-head" style={{ cursor: 'pointer' }} onClick={() => toggleSort('amount_due')}>
              Estimated Total{sortArrow('amount_due')}
            </div>
          )}
          {visibleColumns.includes('status') && (
            <div className="grid-cell grid-head" style={{ cursor: 'pointer' }} onClick={() => toggleSort('status')}>
              Status{sortArrow('status')}
            </div>
          )}

          {sorted.map((est) => (
            <Link key={est.id} to={'/estimate/' + est.job_id} style={{ display: 'contents', textDecoration: 'none', color: 'inherit' }}>
              <div className="grid-cell">{est.invoice_date}</div>
              <div className="grid-cell">{est.invoice_number}</div>
              {visibleColumns.includes('customer') && <div className="grid-cell">{customerName(est)}</div>}
              {visibleColumns.includes('amount_due') && <div className="grid-cell">${est.amount_due?.toFixed(2)}</div>}
              {visibleColumns.includes('status') && (
                <div className="grid-cell">
                  {est.sent_at ? (
                    <span className="status-pill status-trial">Sent</span>
                  ) : (
                    <span className="status-pill status-canceled">Draft</span>
                  )}
                </div>
              )}
            </Link>
          ))}
          {sorted.length === 0 && (
            <div className="grid-cell" style={{ gridColumn: '1 / -1', color: 'var(--mist)' }}>No estimates found.</div>
          )}
        </div>
      )}
    </div>
  )
}
