import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import NewItemDropdown from './NewItemDropdown'
import QuickAddModal from './QuickAddModal'
import { exportToCSV } from './utils/csvExport'

function formatPhone(raw) {
  if (!raw) return raw
  const d = ('' + raw).replace(/\D/g, '')
  if (d.length === 10) return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6)
  if (d.length === 11 && d[0] === '1') return d.slice(1, 4) + '-' + d.slice(4, 7) + '-' + d.slice(7)
  return raw
}

const LINE_ITEM_COUNT = 9

const APPROVAL_STATUS_OPTIONS = ['Pending', 'Approved', 'Rejected', 'Pending Financing']

const ACTIONS_WIDTH = 320
const FROZEN_KEYS = ['invoice_date', 'invoice_number', 'job_number', 'customer']

const COLUMNS = [
  { key: 'invoice_date', label: 'Date', required: true, width: 90 },
  { key: 'invoice_number', label: 'Invoice #', required: true, width: 100 },
  { key: 'job_number', label: 'Job #', required: true, width: 80 },
  { key: 'customer', label: 'Customer', required: true, width: 150 },
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
  { key: 'estimating_technician', label: 'Estimating Technician', width: 160 },
  { key: 'profit', label: 'Projected Profit', width: 110 },
  { key: 'profit_pct', label: 'Projected Profit %', width: 110 },
  { key: 'approval_status', label: 'Approval Status', width: 150 },
]

const DEFAULT_VISIBLE = COLUMNS.map((c) => c.key)

export default function Estimates({ profile }) {
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [estimates, setEstimates] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [sortField, setSortField] = useState('invoice_date')
  const [sortDirection, setSortDirection] = useState('desc')
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const [newItemMode, setNewItemMode] = useState(null)
  const [sendingId, setSendingId] = useState(null)
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('estimates_visible_columns_v2')
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

  async function loadEstimates(orgId) {
    if (!orgId) return
    setLoading(true)
    const [estimatesRes, usersRes] = await Promise.all([
      supabase
        .from('invoices')
        .select(`
          id, invoice_number, invoice_date, job_id, subtotal, sales_tax, job_total,
          discount_amount, discount_type, deposit, amount_due, total_paid, balance,
          profit, profit_pct, sent_at, sent_count, last_sent_to, paid_at, estimating_technician_id, approval_status, is_archived,
          jobs (
            job_number,
            properties ( customers!properties_customer_id_fkey ( display_name, primary_phone ) )
          ),
          invoice_line_items ( description, sort_order ),
          estimating_technician:estimating_technician_id ( full_name )
        `)
        .eq('org_id', orgId)
        .eq('kind', 'estimate')
        .is('deleted_at', null)
        .eq('is_archived', showArchived),
      supabase.from('users').select('id, full_name').eq('org_id', orgId).order('full_name'),
    ])
    setEstimates(estimatesRes.data || [])
    setUsers(usersRes.data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadEstimates(selectedOrg)
  }, [selectedOrg, showArchived])

  useEffect(() => {
    localStorage.setItem('estimates_visible_columns_v2', JSON.stringify(visibleColumns))
  }, [visibleColumns])

  function toggleColumn(key) {
    setVisibleColumns((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  function customerName(est) {
    return est.jobs?.properties?.customers?.display_name || 'Unknown'
  }

  function customerMobile(est) {
    return formatPhone(est.jobs?.properties?.customers?.primary_phone) || ''
  }

  function sortedLineItems(est) {
    return (est.invoice_line_items || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  }

  function lineItemAt(est, idx) {
    return sortedLineItems(est)[idx]?.description || ''
  }

  function discountDisplay(est) {
    const amt = Number(est.discount_amount || 0)
    if (!amt) return '—'
    return est.discount_type === 'percent' ? amt + '%' : '$' + amt.toFixed(2)
  }

  function money(val) {
    return val === null || val === undefined ? '—' : '$' + Number(val).toFixed(2)
  }

  function profitDisplay(est) {
    return est.profit === null || est.profit === undefined ? '—' : '$' + Number(est.profit).toFixed(2)
  }

  function profitPctDisplay(est) {
    return est.profit_pct === null || est.profit_pct === undefined ? '—' : Number(est.profit_pct).toFixed(1) + '%'
  }

  function statusLabel(est) {
    return est.sent_at ? 'Sent' : 'Draft'
  }

  async function updateEstimatingTechnician(id, userId) {
    await supabase.from('invoices').update({ estimating_technician_id: userId || null }).eq('id', id)
    loadEstimates(selectedOrg)
  }

  async function updateApprovalStatus(id, status) {
    await supabase.from('invoices').update({ approval_status: status }).eq('id', id)
    loadEstimates(selectedOrg)
  }

  async function toggleArchive(est) {
    const action = est.is_archived ? 'unarchive' : 'archive'
    if (!window.confirm(`Are you sure you want to ${action} estimate ${est.invoice_number}?`)) return
    await supabase.from('invoices').update({ is_archived: !est.is_archived }).eq('id', est.id)
    loadEstimates(selectedOrg)
  }

  async function sendEstimate(est) {
    const verb = est.sent_at ? 'Resend' : 'Send'
    if (!window.confirm(`${verb} estimate ${est.invoice_number} to the customer's email on file?`)) return
    setSendingId(est.id)
    const { data, error } = await supabase.functions.invoke('send-invoice-email', { body: { invoiceId: est.id } })
    setSendingId(null)
    if (error) {
      let msg = error.message || 'Send failed.'
      try { const body = await error.context.json(); if (body?.error) msg = body.error } catch (_) { /* ignore */ }
      alert(`Could not ${verb.toLowerCase()} this estimate: ${msg}`)
      return
    }
    if (data?.error) { alert(`Could not ${verb.toLowerCase()} this estimate: ${data.error}`); return }
    alert(`Estimate ${est.invoice_number} sent to ${data?.sentTo || 'the customer'}.`)
    loadEstimates(selectedOrg)
  }

  function sentTitle(est) {
    if (!est.sent_at) return 'Not sent yet'
    const when = new Date(est.sent_at).toLocaleString()
    const to = est.last_sent_to ? ` to ${est.last_sent_to}` : ''
    const times = est.sent_count > 1 ? ` · sent ${est.sent_count}×` : ''
    return `Last sent ${when}${to}${times}`
  }

  async function addToIncompleteJobs(est) {
    if (!est.job_id) {
      alert('This estimate has no linked job, so it can\'t be added to Incomplete Jobs.')
      return
    }
    // Flip the job incomplete and attach this estimate to its tracking record,
    // creating one if the tech/office hasn't already. Reuses an existing record
    // so this stays in sync with the mobile button and the estimate-page button.
    const { error: statusErr } = await supabase.from('jobs').update({ status: 'incomplete' }).eq('id', est.job_id)
    if (statusErr) {
      alert('Error: ' + statusErr.message)
      return
    }
    const { data: existing } = await supabase
      .from('job_incomplete_records')
      .select('id')
      .eq('job_id', est.job_id)
      .limit(1)
    if (existing && existing.length > 0) {
      await supabase.from('job_incomplete_records').update({ estimate_id: est.id }).eq('id', existing[0].id)
    } else {
      const { error: recErr } = await supabase.from('job_incomplete_records').insert({
        org_id: selectedOrg,
        job_id: est.job_id,
        estimate_id: est.id,
      })
      if (recErr) {
        alert('Error: ' + recErr.message)
        return
      }
    }
    alert('Added to Incomplete Jobs — check the Jobs Management page.')
    loadEstimates(selectedOrg)
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
    } else if (sortField === 'balance') {
      aVal = a.balance || 0
      bVal = b.balance || 0
    } else if (sortField === 'approval_status') {
      aVal = a.approval_status || ''
      bVal = b.approval_status || ''
    } else {
      aVal = a[sortField] || ''
      bVal = b[sortField] || ''
    }
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  const visibleColumnDefs = COLUMNS.filter((c) => c.required || visibleColumns.includes(c.key))
  const gridTemplateColumns = ACTIONS_WIDTH + 'px ' + visibleColumnDefs.map((c) => c.width + 'px').join(' ')
  const tableMinWidth = visibleColumnDefs.reduce((sum, c) => sum + c.width, 0) + ACTIONS_WIDTH

  const stickyLeft = {}
  let stickyCum = ACTIONS_WIDTH
  for (const key of FROZEN_KEYS) {
    stickyLeft[key] = stickyCum
    stickyCum += COLUMNS.find((c) => c.key === key).width
  }

  const actionsCellStyle = (rowBg) => ({
    background: rowBg,
    position: 'sticky',
    left: 0,
    zIndex: 2,
    boxShadow: '2px 0 4px rgba(0,0,0,0.08)',
  })
  const actionsHeaderStyle = {
    background: 'var(--route-blue)',
    position: 'sticky',
    left: 0,
    zIndex: 3,
    boxShadow: '2px 0 4px rgba(0,0,0,0.08)',
  }

  function cellStyle(key, rowBg) {
    if (FROZEN_KEYS.includes(key)) {
      return { background: rowBg, position: 'sticky', left: stickyLeft[key], zIndex: 2, boxShadow: key === 'customer' ? '2px 0 4px rgba(0,0,0,0.08)' : 'none' }
    }
    return { background: rowBg }
  }

  function headerCellStyle(key) {
    if (FROZEN_KEYS.includes(key)) {
      return { background: 'var(--route-blue)', position: 'sticky', left: stickyLeft[key], zIndex: 3, boxShadow: key === 'customer' ? '2px 0 4px rgba(0,0,0,0.08)' : 'none' }
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

  function cellValue(est, key) {
    if (key === 'invoice_date') return est.invoice_date
    if (key === 'invoice_number') return est.invoice_number
    if (key === 'job_number') return est.jobs?.job_number || ''
    if (key === 'customer') return customerName(est)
    if (key === 'customer_mobile') return customerMobile(est)
    if (key.startsWith('line_item_')) {
      const idx = parseInt(key.replace('line_item_', ''), 10) - 1
      return lineItemAt(est, idx)
    }
    if (key === 'subtotal') return money(est.subtotal)
    if (key === 'sales_tax') return money(est.sales_tax)
    if (key === 'job_total') return money(est.job_total)
    if (key === 'discount') return discountDisplay(est)
    if (key === 'deposit') return money(est.deposit)
    if (key === 'amount_due') return money(est.amount_due)
    if (key === 'total_paid') return money(est.total_paid)
    if (key === 'balance') return money(est.balance)
    if (key === 'estimating_technician') return est.estimating_technician?.full_name || ''
    if (key === 'profit') return profitDisplay(est)
    if (key === 'profit_pct') return profitPctDisplay(est)
    if (key === 'approval_status') return est.approval_status || 'Pending'
    return ''
  }

  function handleExport() {
    exportToCSV(
      sorted,
      visibleColumnDefs
        .map((c) => ({ label: c.label, value: (est) => cellValue(est, c.key) }))
        .concat([{ label: 'Sent Status', value: statusLabel }]),
      'estimates-' + new Date().toISOString().slice(0, 10) + '.csv'
    )
  }

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Job Estimates</h2>
          <span className="badge">{estimates.length.toLocaleString()} total</span>
        </div>
        <NewItemDropdown onSelect={setNewItemMode} />
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
        <label className="nav-link" style={{ cursor: 'pointer', marginBottom: 10 }}>
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          Show archived
        </label>
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <button className="logout-button" onClick={() => setShowColumnPicker(!showColumnPicker)}>
            Columns ▾
          </button>
          {showColumnPicker && (
            <div className="org-picker-list" style={{ right: 'auto', left: 0, minWidth: 200, maxHeight: 360 }}>
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
        <>
        <div ref={scrollTableRef} onScroll={syncFromTable} style={{ overflowX: 'auto' }}>
          <div className="grid-table" style={{ gridTemplateColumns, minWidth: tableMinWidth }}>
            <div className="grid-cell grid-head" style={actionsHeaderStyle}></div>
            {visibleColumnDefs.map((col) => (
              <div
                key={col.key}
                className="grid-cell grid-head"
                style={{
                  ...headerCellStyle(col.key),
                  cursor: ['invoice_date', 'invoice_number', 'customer', 'amount_due', 'balance', 'approval_status'].includes(col.key) ? 'pointer' : 'default',
                }}
                onClick={() => {
                  if (['invoice_date', 'invoice_number', 'customer', 'amount_due', 'balance', 'approval_status'].includes(col.key)) toggleSort(col.key)
                }}
              >
                {col.label}
                {sortArrow(col.key)}
              </div>
            ))}

            {sorted.map((est, rowIdx) => {
              const rowBg = rowIdx % 2 === 0 ? 'var(--panel)' : 'var(--ink)'
              return (
              <div key={est.id} style={{ display: 'contents' }}>
                <div className="grid-cell grid-actions" style={actionsCellStyle(rowBg)}>
                  <Link to={'/estimate/' + est.job_id} className="logout-button" style={{ textDecoration: 'none', display: 'inline-block' }}>
                    Edit
                  </Link>
                  <a href={'/view-invoice/' + est.id} target="_blank" rel="noopener noreferrer" className="logout-button" style={{ textDecoration: 'none', display: 'inline-block' }}>
                    View
                  </a>
                  <button className="logout-button" disabled={sendingId === est.id} title={sentTitle(est)} onClick={() => sendEstimate(est)}>
                    {sendingId === est.id ? 'Sending…' : est.sent_at ? 'Resend' : 'Send'}
                  </button>
                  <button className="logout-button" onClick={() => addToIncompleteJobs(est)}>
                    + Incomplete
                  </button>
                  <button className="logout-button" onClick={() => toggleArchive(est)}>
                    {est.is_archived ? 'Unarchive' : 'Archive'}
                  </button>
                </div>
                {visibleColumnDefs.map((col) => {
                  if (col.key === 'estimating_technician') {
                    return (
                      <div key={col.key} className="grid-cell" style={cellStyle(col.key, rowBg)}>
                        <select
                          value={est.estimating_technician_id || ''}
                          onChange={(e) => updateEstimatingTechnician(est.id, e.target.value)}
                          style={{ fontSize: 12 }}
                        >
                          <option value="">Unassigned</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>{u.full_name}</option>
                          ))}
                        </select>
                      </div>
                    )
                  }
                  if (col.key === 'approval_status') {
                    return (
                      <div key={col.key} className="grid-cell" style={cellStyle(col.key, rowBg)}>
                        <select
                          value={est.approval_status || 'Pending'}
                          onChange={(e) => updateApprovalStatus(est.id, e.target.value)}
                          style={{ fontSize: 12 }}
                        >
                          {APPROVAL_STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    )
                  }
                  return <div key={col.key} className="grid-cell" style={cellStyle(col.key, rowBg)}>{cellValue(est, col.key)}</div>
                })}
              </div>
              )
            })}
            {sorted.length === 0 && (
              <div className="grid-cell" style={{ gridColumn: '1 / -1', color: 'var(--mist)' }}>No estimates found.</div>
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
          onCreated={() => loadEstimates(selectedOrg)}
        />
      )}
    </div>
  )
}
