import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import NewItemDropdown from './NewItemDropdown'
import QuickAddModal from './QuickAddModal'
import { exportToCSV } from './utils/csvExport'
import AiAssist from './AiAssist'

const INV_REMINDER_SYS = 'Draft a brief, friendly, professional payment reminder for an HVAC company to send a customer about an unpaid invoice. Reference the invoice number and the outstanding balance. 2 to 3 sentences, courteous and not aggressive. No subject line.'

const LINE_ITEM_COUNT = 9

const ACTIONS_WIDTH = 320
const FROZEN_KEYS = ['invoice_date', 'invoice_number', 'job_number', 'customer']

const COLUMNS = [
  { key: 'invoice_date', label: 'Date', required: true, width: 90 },
  { key: 'invoice_number', label: 'Invoice #', required: true, width: 100 },
  { key: 'job_number', label: 'Job #', required: true, width: 80 },
  { key: 'customer', label: 'Customer', required: true, width: 150 },
  { key: 'segment', label: 'Segment', width: 70 },
  { key: 'customer_mobile', label: 'Customer Mobile', width: 120 },
  // The first line item is always the Trip Charge (sort_order 1); the rest are
  // the real line items, numbered from 1.
  ...Array.from({ length: LINE_ITEM_COUNT }, (_, i) => ({
    key: 'line_item_' + (i + 1),
    label: i === 0 ? 'Trip Charge' : 'Line Item ' + i,
    width: 160,
    ...(i === 0 ? { required: true } : {}),
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
  const [showArchived, setShowArchived] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [sortField, setSortField] = useState('invoice_date')
  const [sortDirection, setSortDirection] = useState('desc')
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const [newItemMode, setNewItemMode] = useState(null)
  const [sendingId, setSendingId] = useState(null)
  const [payFor, setPayFor] = useState(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('cash')
  const [payCheck, setPayCheck] = useState('')
  const [payNotes, setPayNotes] = useState('')
  const [paying, setPaying] = useState(false)
  const [payErr, setPayErr] = useState('')
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

  const [searchParams] = useSearchParams()
  const highlightId = searchParams.get('invoice')
  const highlightRef = useRef(null)
  const didScrollRef = useRef(false)
  useEffect(() => {
    if (highlightId && highlightRef.current && !didScrollRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      didScrollRef.current = true
    }
  })

  async function loadInvoices(orgId) {
    if (!orgId) return
    setLoading(true)
    // No joins here: invoices has several FKs to jobs (job_id, reference_job_id, spawned_job_id),
    // so embedding jobs makes PostgREST fail the whole query and blank the table. Fetch jobs +
    // line items separately and stitch them on — same approach as Estimates.
    const { data: invRows } = await supabase
      .from('invoices')
      .select(`
        id, invoice_number, invoice_date, job_id, subtotal, sales_tax, job_total,
        discount_amount, discount_type, deposit, amount_due, total_paid, balance,
        profit, profit_pct, paid_at, sent_at, sent_count, last_sent_to, is_archived
      `)
      .eq('org_id', orgId)
      .eq('kind', 'invoice')
      .is('deleted_at', null)
      .eq('is_archived', showArchived)
    let rows = invRows || []

    const jobIds = [...new Set(rows.map((r) => r.job_id).filter(Boolean))]
    let jobById = {}
    if (jobIds.length) {
      const { data: jobs } = await supabase
        .from('jobs')
        .select('id, job_number, segment, status, properties ( customers!properties_customer_id_fkey ( display_name, primary_phone ) ), job_technicians ( sort_order, users ( full_name ) )')
        .in('id', jobIds)
      jobById = Object.fromEntries((jobs || []).map((j) => [j.id, j]))
    }
    const invIds = rows.map((r) => r.id)
    const itemsByInvoice = {}
    if (invIds.length) {
      const { data: items } = await supabase
        .from('invoice_line_items')
        .select('invoice_id, description, sort_order')
        .in('invoice_id', invIds)
      for (const it of items || []) {
        if (!itemsByInvoice[it.invoice_id]) itemsByInvoice[it.invoice_id] = []
        itemsByInvoice[it.invoice_id].push(it)
      }
    }
    rows = rows.map((r) => ({
      ...r,
      jobs: r.job_id ? jobById[r.job_id] || null : null,
      invoice_line_items: itemsByInvoice[r.id] || [],
    }))
    setInvoices(rows)
    setLoading(false)
  }

  useEffect(() => {
    loadInvoices(selectedOrg)
  }, [selectedOrg, showArchived])

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

  function isPaid(inv) {
    return inv.paid_at != null || Number(inv.balance || 0) <= 0
  }

  function statusLabel(inv) {
    return isPaid(inv) ? 'Paid' : inv.sent_at ? 'Sent' : 'Draft'
  }

  // Marking paid records a real payment in the ledger (a DB trigger then updates the
  // invoice's total_paid / balance / paid_at). This keeps the money side honest and
  // makes the payment show up in cash reports — not just a flag on the invoice.
  function openPay(inv) {
    const remaining = Math.max((Number(inv.amount_due) || 0) - (Number(inv.total_paid) || 0), 0)
    setPayFor(inv)
    setPayAmount(remaining ? remaining.toFixed(2) : '')
    setPayMethod('cash')
    setPayCheck('')
    setPayNotes('')
    setPayErr('')
  }
  async function recordPayment() {
    if (!payFor) return
    const amt = Number(payAmount)
    if (!amt || amt <= 0) { setPayErr('Enter a payment amount greater than zero.'); return }
    if (payMethod === 'check' && !payCheck.trim()) { setPayErr('Enter a check number.'); return }
    setPaying(true); setPayErr('')
    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase.from('invoice_payments').insert({
      org_id: payFor.org_id,
      invoice_id: payFor.id,
      amount: amt,
      method: payMethod,
      check_number: payMethod === 'check' ? payCheck.trim() : null,
      notes: payNotes.trim() || null,
      recorded_by: userData?.user?.id || null,
    })
    setPaying(false)
    if (error) { setPayErr(error.message || 'Could not record the payment.'); return }
    setPayFor(null)
    loadInvoices(selectedOrg)
  }
  // Reverse a payment (undo an erroneous mark-paid) with an offsetting ledger entry —
  // preserves the audit trail rather than deleting history; the trigger reopens the balance.
  async function unmarkPaid(inv) {
    const paid = Number(inv.total_paid) || 0
    if (!window.confirm(`Reverse the recorded payment${paid ? ' of $' + paid.toFixed(2) : ''} on ${inv.invoice_number} and reopen its balance?`)) return
    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase.from('invoice_payments').insert({
      org_id: inv.org_id,
      invoice_id: inv.id,
      amount: -paid,
      method: 'reversal',
      notes: 'Payment reversed — marked unpaid in the office',
      recorded_by: userData?.user?.id || null,
    })
    if (error) { window.alert(error.message || 'Could not reverse the payment.'); return }
    loadInvoices(selectedOrg)
  }

  async function toggleArchive(inv) {
    const action = inv.is_archived ? 'unarchive' : 'archive'
    if (!window.confirm(`Are you sure you want to ${action} invoice ${inv.invoice_number}?`)) return
    await supabase.from('invoices').update({ is_archived: !inv.is_archived }).eq('id', inv.id)
    loadInvoices(selectedOrg)
  }

  // Void = soft-delete. This is what actually lets an associated job be deleted
  // (archiving does not). Admin-only; requires a reason.
  async function voidInvoice(inv) {
    const hadPayment = inv.paid_at || Number(inv.total_paid || 0) > 0
    const warn = hadPayment
      ? '\n\n⚠ This invoice shows a payment. Voiding it here does NOT refund the customer — handle any refund in Stripe separately.'
      : ''
    const reason = window.prompt(
      `Void invoice ${inv.invoice_number}?\n\nThis removes it (it stops counting anywhere and lets the job be deleted). This cannot be undone from the app.${warn}\n\nEnter a reason:`
    )
    if (reason === null) return
    if (!reason.trim()) { alert('A reason is required to void an invoice.'); return }
    const { data, error } = await supabase.rpc('void_invoice', { p_invoice_id: inv.id, p_reason: reason.trim() })
    if (error) { alert('Could not void this invoice: ' + error.message); return }
    if (data && data.ok === false) { alert(data.error); return }
    loadInvoices(selectedOrg)
  }

  async function sendInvoice(inv) {
    const verb = inv.sent_at ? 'Resend' : 'Send'
    if (!window.confirm(`${verb} invoice ${inv.invoice_number} to the customer's email on file?`)) return
    setSendingId(inv.id)
    const { data, error } = await supabase.functions.invoke('send-invoice-email', { body: { invoiceId: inv.id } })
    setSendingId(null)
    if (error) {
      let msg = error.message || 'Send failed.'
      try { const body = await error.context.json(); if (body?.error) msg = body.error } catch (_) { /* ignore */ }
      alert(`Could not ${verb.toLowerCase()} this invoice: ${msg}`)
      return
    }
    if (data?.error) { alert(`Could not ${verb.toLowerCase()} this invoice: ${data.error}`); return }
    alert(`Invoice ${inv.invoice_number} sent to ${data?.sentTo || 'the customer'}.`)
    loadInvoices(selectedOrg)
  }

  function sentTitle(inv) {
    if (!inv.sent_at) return 'Not sent yet'
    const when = new Date(inv.sent_at).toLocaleString()
    const to = inv.last_sent_to ? ` to ${inv.last_sent_to}` : ''
    const times = inv.sent_count > 1 ? ` · sent ${inv.sent_count}×` : ''
    return `Last sent ${when}${to}${times}`
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
    if (statusFilter === 'paid' && !isPaid(inv)) return false
    if (statusFilter === 'unpaid' && isPaid(inv)) return false
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

  const totalUnpaid = filtered.filter((inv) => !isPaid(inv)).reduce((sum, inv) => sum + (inv.amount_due || 0), 0)

  const visibleColumnDefs = COLUMNS.filter((c) => c.required || visibleColumns.includes(c.key))
  const gridTemplateColumns = ACTIONS_WIDTH + 'px ' + visibleColumnDefs.map((c) => c.width + 'px').join(' ')
  const tableMinWidth = visibleColumnDefs.reduce((sum, c) => sum + c.width, 0) + ACTIONS_WIDTH

  const stickyLeft = {}
  let stickyCum = ACTIONS_WIDTH
  for (const key of FROZEN_KEYS) {
    stickyLeft[key] = stickyCum
    stickyCum += COLUMNS.find((c) => c.key === key).width
  }

  function isCompletedUnpaid(inv) {
    return inv.jobs?.status === 'completed' && !isPaid(inv)
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Invoices</h2>
          <span className="badge">{invoices.length.toLocaleString()} total</span>
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
            <div className="grid-cell grid-head" style={actionsHeaderStyle}></div>
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
              const isHighlight = highlightId && inv.id === highlightId
              const rowBg = isHighlight ? '#FFF3C4' : (rowIdx % 2 === 0 ? 'var(--panel)' : 'var(--ink)')
              const flagUnpaid = isCompletedUnpaid(inv)
              return (
              <div key={inv.id} style={{ display: 'contents' }}>
                <div ref={isHighlight ? highlightRef : undefined} className="grid-cell grid-actions" style={actionsCellStyle(rowBg)}>
                  <Link to={'/invoice/' + inv.job_id} className="logout-button" style={{ textDecoration: 'none', display: 'inline-block' }}>
                    Edit
                  </Link>
                  <a href={'/view-invoice/' + inv.id} target="_blank" rel="noopener noreferrer" className="logout-button" style={{ textDecoration: 'none', display: 'inline-block' }}>
                    View
                  </a>
                  <button className="logout-button" disabled={sendingId === inv.id} title={sentTitle(inv)} onClick={() => sendInvoice(inv)}>
                    {sendingId === inv.id ? 'Sending…' : inv.sent_at ? 'Resend' : 'Send'}
                  </button>
                  {inv.sent_at && Number(inv.balance || 0) > 0.5 && (
                    <AiAssist compact label="AI reminder" title={'Payment reminder · ' + inv.invoice_number}
                      system={INV_REMINDER_SYS}
                      prompt="Draft a short, friendly payment reminder for this overdue invoice, ready to review and send."
                      context={{ invoice_number: inv.invoice_number, customer: inv.jobs?.properties?.customers?.display_name, outstanding_balance: inv.balance, invoice_date: inv.invoice_date }} />
                  )}
                  {inv.paid_at ? (
                    <button className="logout-button" onClick={() => unmarkPaid(inv)}>Unmark Paid</button>
                  ) : Number(inv.balance || 0) > 0 ? (
                    <button className="logout-button" onClick={() => openPay(inv)}>Mark Paid</button>
                  ) : null}
                  <button className="logout-button" onClick={() => toggleArchive(inv)}>
                    {inv.is_archived ? 'Unarchive' : 'Archive'}
                  </button>
                  <button className="logout-button" style={{ color: '#C0392B', borderColor: 'rgba(192,57,43,0.4)' }} title="Void (soft-delete) this invoice — lets the job be deleted" onClick={() => voidInvoice(inv)}>
                    Void
                  </button>
                </div>
                {visibleColumnDefs.map((col) => {
                  const isInvoiceNumberCell = col.key === 'invoice_number'
                  const style = isInvoiceNumberCell && flagUnpaid
                    ? { ...cellStyle(col.key, '#FFEB3B'), fontWeight: 700 }
                    : cellStyle(col.key, rowBg)
                  return (
                    <div key={col.key} className="grid-cell" style={style}>
                      {col.key === 'status' ? (
                        isPaid(inv) ? (
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
              </div>
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

      {payFor && (
        <div onClick={() => !paying && setPayFor(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--surface, #fff)', borderRadius: 14, width: '100%', maxWidth: 440, boxShadow: '0 24px 60px rgba(0,0,0,.35)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ margin: 0 }}>Record payment · {payFor.invoice_number}</h3>
              <div style={{ fontSize: 12.5, color: 'var(--mist)', marginTop: 3 }}>Only record money you have actually received. This posts to the payment ledger and settles the balance.</div>
            </div>
            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Amount received</label>
                <input type="number" step="0.01" min="0" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Method</label>
                <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                  <option value="card">Card</option>
                  <option value="other">Other</option>
                </select>
              </div>
              {payMethod === 'check' && (
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Check number</label>
                  <input type="text" value={payCheck} onChange={(e) => setPayCheck(e.target.value)} />
                </div>
              )}
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Notes (optional)</label>
                <input type="text" value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Reference, payer, etc." />
              </div>
              {payErr && <div style={{ color: '#B00020', fontSize: 13, background: '#FBE7E7', border: '1px solid #E3B0B0', borderRadius: 8, padding: '8px 10px' }}>{payErr}</div>}
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="logout-button" disabled={paying} onClick={() => setPayFor(null)}>Cancel</button>
              <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={paying} onClick={recordPayment}>
                {paying ? 'Recording…' : 'Record payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
