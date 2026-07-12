import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import NewItemDropdown from './NewItemDropdown'
import QuickAddModal from './QuickAddModal'
import { exportToCSV } from './utils/csvExport'

const LINE_ITEM_COUNT = 9

const FROZEN_KEYS = ['invoice_date', 'invoice_number', 'job_number', 'customer']

const COLUMNS = [
  { key: 'invoice_date', label: 'Date', required: true, width: 90 },
  { key: 'invoice_number', label: 'Invoice #', required: true, width: 100 },
  { key: 'job_number', label: 'Job #', required: true, width: 80 },
  { key: 'customer', label: 'Customer', required: true, width: 150 },
  { key: 'segment', label: 'Segment', width: 70 },
  { key: 'customer_mobile', label: 'Customer Mobile', width: 120 },
  ...Array.from({ length: LINE_ITEM_COUNT }, (_, i) => ({
    key: 'line_item_' + (i + 1),
    label: 'Line Item ' + (i + 1),
    width: 160,
  })),
  { key: 'subtotal', label: 'Subtotal', width: 90 },
  { key: 'sales_tax', label: 'Sales Tax', width: 85 },
  { key: 'job_total', label: 'Job Total', width: 90 },
  { key: 'discount', label: 'Discount', width: 85 },
  { key: 'deposit', label: 'Deposit', width: 85 },
  { key: 'amount_due', label: 'Amount Due', width: 95 },
  { key: 'total_paid', label: 'Total Paid', width: 90 },
  { key: 'balance', label: 'Balance', width: 90 },
  { key: 'technician_1', label: 'Technician 1', width: 120 },
  { key: 'technician_2', label: 'Technician 2', width: 120 },
  { key: 'profit', label: 'Profit', width: 85 },
  { key: 'profit_pct', label: 'Profit %', width: 80 },
  { key: 'status', label: 'Status', width: 90 },
]

const DEFAULT_VISIBLE = COLUMNS.map((c) => c.key)

export default function Invoices({ profile }) {
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchText, setSearchText] = useState('')
  const [sortField, setSortField] = useState('invoice_date')
  const [sortDirection, setSortDirection] = useState('desc')
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const [newItemMode, setNewItemMode] = useState(null)
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('invoices_visible_columns_v2')
    return saved ? JSON.parse(saved) : DEFAULT_VISIBLE
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

  async function loadInvoices(orgId) {
    if (!orgId) return
    setLoading(true)
    const { data } = await supabase
      .from('invoices')
      .select(`
        id, invoice_number, invoice_date, job_id, subtotal, sales_tax, job_total,
        discount_amount, discount_type, deposit, amount_due, total_paid, balance,
        profit, profit_pct, paid_at, sent_at,
        jobs (
          job_number, segment, status,
          properties ( customers!properties_customer_id_fkey ( display_name, primary_phone ) ),
          job_technicians ( sort_order, users ( full_name ) )
        ),
        invoice_line_items ( description, sort_order )
      `)
      .eq('org_id', orgId)
      .eq('kind', 'invoice')
    setInvoices(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadInvoices(selectedOrg)
  }, [selectedOrg])

  useEffect(() => {
    localStorage.setItem('invoices_visible_columns_v2', JSON.stringify(visibleColumns))
  }, [visibleColumns])

  function toggleColumn(key) {
    setVisibleColumns((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  function customerName(inv) {
    return inv.jobs?.properties?.customers?.display_name || 'Unknown'
  }

  function customerMobile(inv) {
    return inv.jobs?.properties?.customers?.primary_phone || ''
  }

  function sortedLineItems(inv) {
    return (inv.invoice_line_items || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  }

  function lineItemAt(inv, idx) {
    const items = sortedLineItems(inv)
    return items[idx]?.description || ''
  }

  function sortedTechnicians(inv) {
    return (inv.jobs?.job_technicians || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  }

  function technicianAt(inv, idx) {
    const techs = sortedTechnicians(inv)
    return techs[idx]?.users?.full_name || ''
  }

  function discountDisplay(inv) {
    const amt = Number(inv.discount_amount || 0)
    if (!amt) return '—'
    return inv.discount_type === 'percent' ? amt + '%' : '$' + amt.toFixed(2)
  }

  function money(val) {
    return val === null || val === undefined ? '—' : '$' + Number(val).toFixed(2)
  }

  function profitDisplay(inv) {
    return inv.profit === null || inv.profit === undefined ? '—' : '$' + Number(inv.profit).toFixed(2)
  }

  function profitPctDisplay(inv) {
    return inv.profit_pct === null || inv.profit_pct === undefined ? '—' : Number(inv.profit_pct).toFixed(1) + '%'
  }

  function statusLabel(inv) {
    return inv.paid_at ? 'Paid' : inv.sent_at ? 'Sent' : 'Draft'
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
    } else if (sortField === 'balance') {
      aVal = a.balance || 0
      bVal = b.balance || 0
    } else if (sortField === 'status') {
      aVal = a.paid_at ? 1 : 0
      bVal = b.paid_at ? 1 : 0
    } else {
      aVal = a[sortField] || ''
      bVal = b[sortField] || ''
    }
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  const totalUnpaid = filtered.filter((inv) => !inv.paid_at).reduce((sum, inv) => sum + (inv.amount_due || 0), 0)

  const visibleColumnDefs = COLUMNS.filter((c) => c.required || visibleColumns.includes(c.key))
  const gridTemplateColumns = visibleColumnDefs.map((c) => c.width + 'px').join(' ')
  const tableMinWidth = visibleColumnDefs.reduce((sum, c) => sum + c.width, 0)

  const stickyLeft = {}
  let stickyCum = 0
  for (const key of FROZEN_KEYS) {
    stickyLeft[key] = stickyCum
    stickyCum += COLUMNS.find((c) => c.key === key).width
  }

  function isCompletedUnpaid(inv) {
    return inv.jobs?.status === 'completed' && !inv.paid_at
  }

  function cellStyle(key, rowBg) {
    if (FROZEN_KEYS.includes(key)) {
      return { background: rowBg, position: 'sticky', left: stickyLeft[key], zIndex: 2, boxShadow: key === 'customer' ? '2px 0 4px rgba(0,0,0,0.08)' : 'none' }
    }
    return { background: rowBg }
  }

  function headerCellStyle(key) {
    if (FROZEN_KEYS.includes(key)) {
      return { background: 'var(--ink)', position: 'sticky', left: stickyLeft[key], zIndex: 3, boxShadow: key === 'customer' ? '2px 0 4px rgba(0,0,0,0.08)' : 'none' }
    }
    return {}
  }

  const scrollTableRef = useRef(null)
  const scrollBarRef = useRef(null)
  const [scrollBarRect, setScrollBarRect] = useState({ left: 0, width: 0 })

  useEffect(() => {
    function updateRect() {
      if (scrollTableRef.current) {
        const r = scrollTableRef.current.getBoundingClientRect()
        setScrollBarRect({ left: r.left, width: r.width })
      }
    }
    updateRect()
    window.addEventListener('resize', updateRect)
    return () => window.removeEventListener('resize', updateRect)
  }, [visibleColumns, sorted.length])

  function syncFromTable(e) {
    if (scrollBarRef.current) scrollBarRef.current.scrollLeft = e.target.scrollLeft
  }
  function syncFromBar(e) {
    if (scrollTableRef.current) scrollTableRef.current.scrollLeft = e.target.scrollLeft
  }

  function cellValue(inv, key) {
    if (key === 'invoice_date') return inv.invoice_date
    if (key === 'invoice_number') return inv.invoice_number
    if (key === 'job_number') return inv.jobs?.job_number || ''
    if (key === 'segment') return inv.jobs?.segment ?? ''
    if (key === 'customer') return customerName(inv)
    if (key === 'customer_mobile') return customerMobile(inv)
    if (key.startsWith('line_item_')) {
      const idx = parseInt(key.replace('line_item_', ''), 10) - 1
      return lineItemAt(inv, idx)
    }
    if (key === 'subtotal') return money(inv.subtotal)
    if (key === 'sales_tax') return money(inv.sales_tax)
    if (key === 'job_total') return money(inv.job_total)
    if (key === 'discount') return discountDisplay(inv)
    if (key === 'deposit') return money(inv.deposit)
    if (key === 'amount_due') return money(inv.amount_due)
    if (key === 'total_paid') return money(inv.total_paid)
    if (key === 'balance') return money(inv.balance)
    if (key === 'technician_1') return technicianAt(inv, 0)
    if (key === 'technician_2') return technicianAt(inv, 1)
    if (key === 'profit') return profitDisplay(inv)
    if (key === 'profit_pct') return profitPctDisplay(inv)
    return ''
  }

  function handleExport() {
    exportToCSV(
      sorted,
      visibleColumnDefs
        .filter((c) => c.key !== 'status')
        .map((c) => ({ label: c.label, value: (inv) => cellValue(inv, c.key) }))
        .concat([{ label: 'Status', value: statusLabel }]),
      'invoices-' + new Date().toISOString().slice(0, 10) + '.csv'
    )
  }

  return (
    <div>
      <div className="page-header-bar">
        <h2>Invoices</h2>
        <NewItemDropdown onSelect={setNewItemMode} />
      </div>

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
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <button className="logout-button" onClick={() => setShowColumnPicker(!showColumnPicker)}>
            Columns ▾
          </button>
          {showColumnPicker && (
            <div className="org-picker-list" style={{ right: 'auto', left: 0, minWidth: 200, maxHeight: 320 }}>
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
          {filtered.length} invoice{filtered.length !== 1 ? 's' : ''} — ${totalUnpaid.toFixed(2)} outstanding
        </p>
      </div>

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : (
        <>
        <div ref={scrollTableRef} onScroll={syncFromTable} style={{ overflowX: 'auto' }}>
          <div className="grid-table" style={{ gridTemplateColumns, minWidth: tableMinWidth }}>
            {visibleColumnDefs.map((col) => (
              <div
                key={col.key}
                className="grid-cell grid-head"
                style={{
                  ...headerCellStyle(col.key),
                  cursor: ['invoice_date', 'invoice_number', 'customer', 'amount_due', 'balance', 'status'].includes(col.key) ? 'pointer' : 'default',
                }}
                onClick={() => {
                  if (['invoice_date', 'invoice_number', 'customer', 'amount_due', 'balance', 'status'].includes(col.key)) toggleSort(col.key)
                }}
              >
                {col.label}
                {sortArrow(col.key)}
              </div>
            ))}

            {sorted.map((inv, rowIdx) => {
              const rowBg = rowIdx % 2 === 0 ? 'var(--panel)' : 'var(--ink)'
              const flagUnpaid = isCompletedUnpaid(inv)
              return (
              <Link key={inv.id} to={'/invoice/' + inv.job_id} style={{ display: 'contents', textDecoration: 'none', color: 'inherit' }}>
                {visibleColumnDefs.map((col) => {
                  const isInvoiceNumberCell = col.key === 'invoice_number'
                  const style = isInvoiceNumberCell && flagUnpaid
                    ? { ...cellStyle(col.key, '#FFEB3B'), fontWeight: 700 }
                    : cellStyle(col.key, rowBg)
                  return (
                    <div key={col.key} className="grid-cell" style={style}>
                      {col.key === 'status' ? (
                        inv.paid_at ? (
                          <span className="status-pill status-active">Paid</span>
                        ) : inv.sent_at ? (
                          <span className="status-pill status-trial">Sent</span>
                        ) : (
                          <span className="status-pill status-canceled">Draft</span>
                        )
                      ) : (
                        cellValue(inv, col.key)
                      )}
                    </div>
                  )
                })}
              </Link>
              )
            })}
            {sorted.length === 0 && (
              <div className="grid-cell" style={{ gridColumn: '1 / -1', color: 'var(--mist)' }}>No invoices found.</div>
            )}
          </div>
        </div>
        {tableMinWidth > scrollBarRect.width && scrollBarRect.width > 0 && (
          <div
            ref={scrollBarRef}
            onScroll={syncFromBar}
            style={{
              position: 'fixed',
              bottom: 0,
              left: scrollBarRect.left,
              width: scrollBarRect.width,
              overflowX: 'auto',
              overflowY: 'hidden',
              height: 16,
              zIndex: 50,
              background: 'var(--panel)',
              borderTop: '1px solid var(--border)',
            }}
          >
            <div style={{ width: tableMinWidth, height: 1 }} />
          </div>
        )}
        </>
      )}

      {newItemMode && (
        <QuickAddModal
          mode={newItemMode}
          orgId={selectedOrg}
          profile={profile}
          onClose={() => setNewItemMode(null)}
          onCreated={() => loadInvoices(selectedOrg)}
        />
      )}
    </div>
  )
}
