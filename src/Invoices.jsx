import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

export default function Invoices({ profile }) {
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchText, setSearchText] = useState('')
  const [sortField, setSortField] = useState('invoice_date')
  const [sortDirection, setSortDirection] = useState('desc')

  const isSuperAdmin = profile.role === 'super_admin'

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        if (!selectedOrg && data && data.length > 0) setSelectedOrg(data[0].id)
      })
    }
  }, [])

  async function loadInvoices(orgId) {
    if (!orgId) return
    setLoading(true)
    const { data } = await supabase
      .from('invoices')
      .select('id, invoice_number, invoice_date, job_id, amount_due, total_paid, paid_at, sent_at, jobs(job_number, properties(customers!properties_customer_id_fkey(display_name)))')
      .eq('org_id', orgId)
    setInvoices(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadInvoices(selectedOrg)
  }, [selectedOrg])

  function customerName(inv) {
    return inv.jobs?.properties?.customers?.display_name || 'Unknown'
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

  const filtered = invoices.filter((inv) => {
    if (statusFilter === 'paid' && !inv.paid_at) return false
    if (statusFilter === 'unpaid' && inv.paid_at) return false
    if (searchText) {
      const q = searchText.toLowerCase()
      const matchesNumber = inv.invoice_number?.toLowerCase().includes(q)
      const matchesCustomer = customerName(inv).toLowerCase().includes(q)
      const matchesJob = inv.jobs?.job_number?.toLowerCase().includes(q)
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
      aVal = a.paid_at ? 1 : 0
      bVal = b.paid_at ? 1 : 0
    }
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  const totalUnpaid = filtered.filter((inv) => !inv.paid_at).reduce((sum, inv) => sum + (inv.amount_due || 0), 0)

  return (
    <div>
      <h2 className="page-title">Invoices</h2>

      {isSuperAdmin && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ marginBottom: 0, minWidth: 160 }}>
          <label htmlFor="statusFilter">Status</label>
          <select id="statusFilter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0, minWidth: 220 }}>
          <label htmlFor="searchBox">Search</label>
          <input
            id="searchBox"
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Invoice #, job #, or customer…"
          />
        </div>
        <p style={{ color: 'var(--mist)', fontSize: 14, margin: 0 }}>
          {filtered.length} invoice{filtered.length !== 1 ? 's' : ''} — ${totalUnpaid.toFixed(2)} outstanding
        </p>
      </div>

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : (
        <div className="grid-table" style={{ gridTemplateColumns: '1fr 1fr 1.5fr 1fr 1fr' }}>
          <div className="grid-cell grid-head" style={{ cursor: 'pointer' }} onClick={() => toggleSort('invoice_date')}>
            Date{sortArrow('invoice_date')}
          </div>
          <div className="grid-cell grid-head">Invoice #</div>
          <div className="grid-cell grid-head" style={{ cursor: 'pointer' }} onClick={() => toggleSort('customer')}>
            Customer{sortArrow('customer')}
          </div>
          <div className="grid-cell grid-head" style={{ cursor: 'pointer' }} onClick={() => toggleSort('amount_due')}>
            Amount Due{sortArrow('amount_due')}
          </div>
          <div className="grid-cell grid-head" style={{ cursor: 'pointer' }} onClick={() => toggleSort('status')}>
            Status{sortArrow('status')}
          </div>

          {sorted.map((inv) => (
            <Link key={inv.id} to={'/invoice/' + inv.job_id} style={{ display: 'contents', textDecoration: 'none', color: 'inherit' }}>
              <div className="grid-cell">{inv.invoice_date}</div>
              <div className="grid-cell">{inv.invoice_number}</div>
              <div className="grid-cell">{customerName(inv)}</div>
              <div className="grid-cell">${inv.amount_due?.toFixed(2)}</div>
              <div className="grid-cell">
                {inv.paid_at ? (
                  <span className="status-pill status-active">Paid</span>
                ) : inv.sent_at ? (
                  <span className="status-pill status-trial">Sent</span>
                ) : (
                  <span className="status-pill status-canceled">Draft</span>
                )}
              </div>
            </Link>
          ))}
          {sorted.length === 0 && (
            <div className="grid-cell" style={{ gridColumn: '1 / -1', color: 'var(--mist)' }}>No invoices found.</div>
          )}
        </div>
      )}
    </div>
  )
}
