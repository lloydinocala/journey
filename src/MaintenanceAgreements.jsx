import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import { exportToCSV } from './utils/csvExport'

const ACTIONS_WIDTH = 300
const FROZEN_KEYS = ['start_date', 'customer', 'property']

const COLUMNS = [
  { key: 'start_date', label: 'Start Date', required: true, width: 100 },
  { key: 'customer', label: 'Customer', required: true, width: 160 },
  { key: 'property', label: 'Property', required: true, width: 200 },
  { key: 'tier', label: 'Tier', width: 100 },
  { key: 'billing_cycle', label: 'Billing', width: 90 },
  { key: 'price', label: 'Price', width: 90 },
  { key: 'status', label: 'Status', width: 100 },
  { key: 'next_visit_due_date', label: 'Next Visit Due', width: 130 },
  { key: 'last_visit_completed_date', label: 'Last Visit', width: 120 },
]

const DEFAULT_VISIBLE = COLUMNS.map((c) => c.key)

function money(val) {
  return val === null || val === undefined ? '—' : '$' + Number(val).toFixed(2)
}

function dateDisplay(val) {
  if (!val) return '—'
  return new Date(val + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function MaintenanceAgreements({ profile }) {
  const [searchParams] = useSearchParams()
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [agreements, setAgreements] = useState([])
  const [properties, setProperties] = useState([])
  const [tiers, setTiers] = useState([])
  const [loading, setLoading] = useState(true)

  const [statusFilter, setStatusFilter] = useState('all')
  const [showArchived, setShowArchived] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('maintenance_agreements_visible_columns_v1')
    return saved ? JSON.parse(saved) : DEFAULT_VISIBLE
  })

  const [propertyId, setPropertyId] = useState('')
  const [tierId, setTierId] = useState('')
  const [billingCycle, setBillingCycle] = useState('monthly')
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [prefilledFromLink, setPrefilledFromLink] = useState(false)

  useEffect(() => {
    const linkedPropertyId = searchParams.get('propertyId')
    if (linkedPropertyId && properties.some((p) => p.id === linkedPropertyId)) {
      setPropertyId(linkedPropertyId)
      setPrefilledFromLink(true)
    }
  }, [properties, searchParams])

  const [checkoutLink, setCheckoutLink] = useState(null)
  const [checkoutBusyId, setCheckoutBusyId] = useState(null)
  const [cancelBusyId, setCancelBusyId] = useState(null)

  const [expandedId, setExpandedId] = useState(null)
  const [billingHistory, setBillingHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const [editingId, setEditingId] = useState(null)
  const [editTierId, setEditTierId] = useState('')
  const [editBillingCycle, setEditBillingCycle] = useState('monthly')
  const [editPrice, setEditPrice] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editNextVisit, setEditNextVisit] = useState('')
  const [editLastVisit, setEditLastVisit] = useState('')
  const [editNotes, setEditNotes] = useState('')

  const isSuperAdmin = profile.role === 'super_admin'

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        if (!selectedOrg && data && data.length > 0) setSelectedOrg(data[0].id)
      })
    }
  }, [])

  async function loadData(orgId) {
    if (!orgId) return
    setLoading(true)
    const [agreementsRes, propsRes, tiersRes] = await Promise.all([
      supabase
        .from('maintenance_agreements')
        .select(`
          id, status, billing_cycle, price, start_date, next_visit_due_date, last_visit_completed_date,
          stripe_subscription_id, canceled_at, canceled_reason, notes, is_archived, tier_id,
          properties ( street_address, unit, city ),
          customers ( display_name, primary_phone, email_1 ),
          maintenance_agreement_tiers ( name )
        `)
        .eq('org_id', orgId)
        .eq('is_archived', showArchived)
        .order('start_date', { ascending: false }),
      supabase
        .from('properties')
        .select('id, street_address, unit, city, state, zip, customer_id, customers!properties_customer_id_fkey(display_name, is_banned)')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .order('street_address'),
      supabase
        .from('maintenance_agreement_tiers')
        .select('id, name, monthly_price, annual_price')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .order('sort_order'),
    ])
    setAgreements(agreementsRes.data || [])
    setProperties(propsRes.data || [])
    setTiers(tiersRes.data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadData(selectedOrg)
  }, [selectedOrg, showArchived])

  useEffect(() => {
    localStorage.setItem('maintenance_agreements_visible_columns_v1', JSON.stringify(visibleColumns))
  }, [visibleColumns])

  function toggleColumn(key) {
    setVisibleColumns((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  const selectedTier = tiers.find((t) => t.id === tierId)
  const previewPrice = selectedTier ? (billingCycle === 'monthly' ? selectedTier.monthly_price : selectedTier.annual_price) : null

  function propertyLabel(p) {
    return (p.customers?.is_banned ? '⚠️ DO NOT SERVICE — ' : '') + p.street_address + (p.unit ? ' ' + p.unit : '') + ' — ' + (p.customers?.display_name || '')
  }

  async function requestCheckoutLink(agreementId) {
    setCheckoutBusyId(agreementId)
    setFormError('')
    const { data: result, error } = await supabase.functions.invoke('create-agreement-checkout', { body: { agreementId } })
    setCheckoutBusyId(null)
    if (error || result?.error) {
      setFormError(result?.error || error.message)
      return null
    }
    return result?.url || null
  }

  async function handleAddAgreement(e) {
    e.preventDefault()
    setFormError('')
    if (!propertyId || !tierId || !startDate) return
    const property = properties.find((p) => p.id === propertyId)
    if (!property) return

    setSaving(true)
    const { data: newAgreement, error } = await supabase
      .from('maintenance_agreements')
      .insert({
        org_id: selectedOrg,
        property_id: propertyId,
        customer_id: property.customer_id,
        tier_id: tierId,
        status: 'pending',
        billing_cycle: billingCycle,
        price: previewPrice || 0,
        start_date: startDate,
      })
      .select('id')
      .single()

    if (error) {
      setSaving(false)
      setFormError(error.message)
      return
    }

    const url = await requestCheckoutLink(newAgreement.id)
    setSaving(false)
    setPropertyId('')
    setPrefilledFromLink(false)
    setTierId('')
    setBillingCycle('monthly')
    setStartDate(new Date().toISOString().slice(0, 10))
    loadData(selectedOrg)
    if (url) {
      setCheckoutLink({ agreementId: newAgreement.id, url, customerName: property.customers?.display_name })
    }
  }

  async function handleGetLink(agreementId, customerName) {
    const url = await requestCheckoutLink(agreementId)
    if (url) setCheckoutLink({ agreementId, url, customerName })
  }

  function copyLink(url) {
    navigator.clipboard.writeText(url)
  }

  async function handleCancel(agreement) {
    if (!window.confirm(`Cancel the maintenance agreement for ${agreement.customers?.display_name || 'this customer'}? This will cancel the Stripe subscription and stop future billing.`)) return
    setCancelBusyId(agreement.id)
    const { data: result, error } = await supabase.functions.invoke('cancel-agreement-subscription', { body: { agreementId: agreement.id } })
    setCancelBusyId(null)
    if (error || result?.error) {
      alert(result?.error || error.message)
      return
    }
    loadData(selectedOrg)
  }

  async function toggleArchive(agreement) {
    const action = agreement.is_archived ? 'unarchive' : 'archive'
    if (!window.confirm(`Are you sure you want to ${action} this agreement?`)) return
    await supabase.from('maintenance_agreements').update({ is_archived: !agreement.is_archived }).eq('id', agreement.id)
    loadData(selectedOrg)
  }

  function startEdit(a) {
    setEditingId(a.id)
    setEditTierId(a.tier_id || '')
    setEditBillingCycle(a.billing_cycle || 'monthly')
    setEditPrice(a.price != null ? String(a.price) : '')
    setEditStatus(a.status)
    setEditNextVisit(a.next_visit_due_date || '')
    setEditLastVisit(a.last_visit_completed_date || '')
    setEditNotes(a.notes || '')
  }

  async function saveEdit(a) {
    const patch = {
      status: editStatus,
      next_visit_due_date: editNextVisit || null,
      last_visit_completed_date: editLastVisit || null,
      notes: editNotes.trim() || null,
    }
    // Tier/billing/price only change the record itself here, not any live Stripe
    // subscription — safe to edit freely before a subscription exists, but for
    // an agreement Stripe already knows about, changing these would desync what
    // the customer's actually being charged from what this page shows.
    if (!a.stripe_subscription_id) {
      patch.tier_id = editTierId || null
      patch.billing_cycle = editBillingCycle
      patch.price = editPrice ? parseFloat(editPrice) : 0
    }
    await supabase.from('maintenance_agreements').update(patch).eq('id', a.id)
    setEditingId(null)
    loadData(selectedOrg)
  }

  async function toggleHistory(agreementId) {
    if (expandedId === agreementId) {
      setExpandedId(null)
      return
    }
    setExpandedId(agreementId)
    setLoadingHistory(true)
    const { data } = await supabase
      .from('maintenance_agreement_billing_history')
      .select('id, billed_date, amount, paid_at, status, stripe_invoice_id')
      .eq('agreement_id', agreementId)
      .order('billed_date', { ascending: false })
    setBillingHistory(data || [])
    setLoadingHistory(false)
  }

  const filtered = agreements.filter((a) => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false
    if (searchText) {
      const q = searchText.toLowerCase()
      const matchesCustomer = a.customers?.display_name?.toLowerCase().includes(q)
      const matchesProperty = a.properties?.street_address?.toLowerCase().includes(q)
      if (!matchesCustomer && !matchesProperty) return false
    }
    return true
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
      return { background: rowBg, position: 'sticky', left: stickyLeft[key], zIndex: 2, boxShadow: key === 'property' ? '2px 0 4px rgba(0,0,0,0.08)' : 'none' }
    }
    return { background: rowBg }
  }

  function headerCellStyle(key) {
    if (FROZEN_KEYS.includes(key)) {
      return { background: 'var(--route-blue)', position: 'sticky', left: stickyLeft[key], zIndex: 3, boxShadow: key === 'property' ? '2px 0 4px rgba(0,0,0,0.08)' : 'none' }
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
  }, [visibleColumns, filtered.length])

  function syncFromTable(e) {
    if (scrollBarRef.current) scrollBarRef.current.scrollLeft = e.target.scrollLeft
  }
  function syncFromBar(e) {
    if (scrollTableRef.current) scrollTableRef.current.scrollLeft = e.target.scrollLeft
  }

  function propertyDisplay(a) {
    const p = a.properties
    if (!p) return '—'
    return p.street_address + (p.unit ? ' ' + p.unit : '') + (p.city ? ', ' + p.city : '')
  }

  function cellValue(a, key) {
    if (key === 'start_date') return dateDisplay(a.start_date)
    if (key === 'customer') return a.customers?.display_name || 'Unknown'
    if (key === 'property') return propertyDisplay(a)
    if (key === 'tier') return a.maintenance_agreement_tiers?.name || '—'
    if (key === 'billing_cycle') return a.billing_cycle === 'monthly' ? 'Monthly' : 'Annual'
    if (key === 'price') return money(a.price)
    if (key === 'next_visit_due_date') return dateDisplay(a.next_visit_due_date)
    if (key === 'last_visit_completed_date') return dateDisplay(a.last_visit_completed_date)
    return ''
  }

  function handleExport() {
    exportToCSV(
      filtered,
      COLUMNS.filter((c) => c.key !== 'status').map((c) => ({ label: c.label, value: (a) => cellValue(a, c.key) })).concat([{ label: 'Status', value: (a) => a.status }]),
      'maintenance-agreements-' + new Date().toISOString().slice(0, 10) + '.csv'
    )
  }

  const activeCount = agreements.filter((a) => a.status === 'active').length
  const mrr = agreements
    .filter((a) => a.status === 'active')
    .reduce((sum, a) => sum + (a.billing_cycle === 'monthly' ? Number(a.price) : Number(a.price) / 12), 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <h2 className="page-title" style={{ margin: 0 }}>Maintenance Agreements</h2>
        <span className="badge">{agreements.length.toLocaleString()} total</span>
      </div>

      {isSuperAdmin && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
        <div className="stat-tile"><div className="stat-value">{activeCount}</div><div className="stat-label">Active agreements</div></div>
        <div className="stat-tile"><div className="stat-value">${mrr.toFixed(2)}</div><div className="stat-label">Est. monthly recurring revenue</div></div>
      </div>

      <form className="inline-form" onSubmit={handleAddAgreement} style={{ marginBottom: 20, flexWrap: 'wrap' }}>
        {prefilledFromLink && (
          <div style={{ width: '100%', fontSize: 12.5, color: 'var(--route-blue)', fontWeight: 600, marginBottom: 4 }}>
            Property pre-filled from job card — just pick a tier and start date.
          </div>
        )}
        <div className="field" style={{ minWidth: 260 }}>
          <label htmlFor="agrProperty">Property</label>
          <select id="agrProperty" value={propertyId} onChange={(e) => setPropertyId(e.target.value)} required>
            <option value="">Select…</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{propertyLabel(p)}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="agrTier">Tier</label>
          <select id="agrTier" value={tierId} onChange={(e) => setTierId(e.target.value)} required>
            <option value="">Select…</option>
            {tiers.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="agrCycle">Billing</label>
          <select id="agrCycle" value={billingCycle} onChange={(e) => setBillingCycle(e.target.value)}>
            <option value="monthly">Monthly</option>
            <option value="annual">Annual</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="agrStart">Start date</label>
          <input id="agrStart" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </div>
        {previewPrice !== null && (
          <div className="field" style={{ minWidth: 100 }}>
            <label>Price</label>
            <div style={{ padding: '8px 0', fontWeight: 600 }}>${Number(previewPrice).toFixed(2)}{billingCycle === 'monthly' ? '/mo' : '/yr'}</div>
          </div>
        )}
        <button className="auth-button" type="submit" disabled={saving || tiers.length === 0}>
          {saving ? 'Creating…' : 'Create & Get Checkout Link'}
        </button>
      </form>

      {tiers.length === 0 && !loading && (
        <div className="auth-error" style={{ marginBottom: 20 }}>No active tiers for this organization yet — add Silver/Gold/Platinum tiers first.</div>
      )}

      {formError && <div className="auth-error">{formError}</div>}

      {checkoutLink && (
        <div className="inline-form" style={{ marginBottom: 20, background: 'rgba(76, 217, 123, 0.08)', borderColor: 'rgba(76, 217, 123, 0.3)' }}>
          <div style={{ flex: 1 }}>
            <strong>Checkout link ready{checkoutLink.customerName ? ' for ' + checkoutLink.customerName : ''}.</strong>
            <div style={{ fontSize: 13, color: 'var(--mist)', marginTop: 4, wordBreak: 'break-all' }}>{checkoutLink.url}</div>
          </div>
          <button type="button" className="logout-button" onClick={() => copyLink(checkoutLink.url)}>Copy Link</button>
          <button type="button" className="logout-button" onClick={() => window.open(checkoutLink.url, '_blank')}>Open Checkout</button>
          <button type="button" className="logout-button" onClick={() => setCheckoutLink(null)}>Dismiss</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ marginBottom: 0, minWidth: 160 }}>
          <label htmlFor="statusFilter">Status</label>
          <select id="statusFilter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="lapsed">Lapsed</option>
            <option value="canceled">Canceled</option>
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0, minWidth: 220 }}>
          <label htmlFor="searchBox">Search</label>
          <input id="searchBox" type="text" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Customer or property…" />
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
          <button className="logout-button" onClick={() => setShowColumnPicker(!showColumnPicker)}>Columns ▾</button>
          {showColumnPicker && (
            <div className="org-picker-list" style={{ right: 'auto', left: 0, minWidth: 200, maxHeight: 320 }}>
              {COLUMNS.filter((c) => !c.required).map((col) => (
                <label key={col.key} className="org-picker-item" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={visibleColumns.includes(col.key)} onChange={() => toggleColumn(col.key)} />
                  {col.label}
                </label>
              ))}
            </div>
          )}
        </div>
        <button className="logout-button" style={{ marginBottom: 10 }} onClick={handleExport}>Export CSV</button>
        <p style={{ color: 'var(--mist)', fontSize: 14, margin: '0 0 12px' }}>{filtered.length} agreement{filtered.length !== 1 ? 's' : ''}</p>
      </div>

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : (
        <>
        <div ref={scrollTableRef} onScroll={syncFromTable} style={{ overflowX: 'auto' }}>
          <div className="grid-table" style={{ gridTemplateColumns, minWidth: tableMinWidth }}>
            <div className="grid-cell grid-head" style={actionsHeaderStyle}></div>
            {visibleColumnDefs.map((col) => (
              <div key={col.key} className="grid-cell grid-head" style={headerCellStyle(col.key)}>{col.label}</div>
            ))}

            {filtered.map((a, rowIdx) => {
              const rowBg = rowIdx % 2 === 0 ? 'var(--panel)' : 'var(--ink)'
              const editable = editingId === a.id
              return (
                <>
                  <div className="grid-cell grid-actions" style={{ ...actionsCellStyle(rowBg), flexDirection: 'column', alignItems: 'stretch' }}>
                    {editable ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="auth-button" style={{ width: 'auto', padding: '6px 14px', margin: 0 }} onClick={() => saveEdit(a)}>Save</button>
                        <button className="logout-button" onClick={() => setEditingId(null)}>Cancel</button>
                      </div>
                    ) : (
                      <div className="grid-actions">
                        <button className="logout-button" onClick={() => startEdit(a)}>Edit</button>
                        <button className="logout-button" onClick={() => toggleArchive(a)}>{a.is_archived ? 'Unarchive' : 'Archive'}</button>
                        <button className="logout-button" onClick={() => toggleHistory(a.id)}>{expandedId === a.id ? 'Hide History' : 'History'}</button>
                        {a.status === 'pending' && !a.stripe_subscription_id && (
                          <button className="logout-button" disabled={checkoutBusyId === a.id} onClick={() => handleGetLink(a.id, a.customers?.display_name)}>
                            {checkoutBusyId === a.id ? 'Generating…' : 'Get Link'}
                          </button>
                        )}
                        {a.status !== 'canceled' && (
                          <button className="logout-button" disabled={cancelBusyId === a.id} onClick={() => handleCancel(a)}>
                            {cancelBusyId === a.id ? 'Canceling…' : 'Cancel'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {visibleColumnDefs.map((col) => {
                    if (editable) {
                      if (col.key === 'tier') return (
                        <div key={col.key} className="grid-cell" style={cellStyle(col.key, rowBg)}>
                          {a.stripe_subscription_id ? (
                            <span title="Tier can't be changed once billing has started — cancel and create a new agreement instead.">{cellValue(a, col.key)}</span>
                          ) : (
                            <select value={editTierId} onChange={(e) => setEditTierId(e.target.value)}>
                              <option value="">Select…</option>
                              {tiers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                          )}
                        </div>
                      )
                      if (col.key === 'billing_cycle') return (
                        <div key={col.key} className="grid-cell" style={cellStyle(col.key, rowBg)}>
                          {a.stripe_subscription_id ? cellValue(a, col.key) : (
                            <select value={editBillingCycle} onChange={(e) => setEditBillingCycle(e.target.value)}>
                              <option value="monthly">Monthly</option>
                              <option value="annual">Annual</option>
                            </select>
                          )}
                        </div>
                      )
                      if (col.key === 'price') return (
                        <div key={col.key} className="grid-cell" style={cellStyle(col.key, rowBg)}>
                          {a.stripe_subscription_id ? cellValue(a, col.key) : (
                            <input type="number" step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} style={{ width: '100%' }} />
                          )}
                        </div>
                      )
                      if (col.key === 'status') return (
                        <div key={col.key} className="grid-cell" style={cellStyle(col.key, rowBg)}>
                          <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                            <option value="pending">Pending</option>
                            <option value="active">Active</option>
                            <option value="lapsed">Lapsed</option>
                            <option value="canceled">Canceled</option>
                          </select>
                        </div>
                      )
                      if (col.key === 'next_visit_due_date') return (
                        <div key={col.key} className="grid-cell" style={cellStyle(col.key, rowBg)}>
                          <input type="date" value={editNextVisit} onChange={(e) => setEditNextVisit(e.target.value)} />
                        </div>
                      )
                      if (col.key === 'last_visit_completed_date') return (
                        <div key={col.key} className="grid-cell" style={cellStyle(col.key, rowBg)}>
                          <input type="date" value={editLastVisit} onChange={(e) => setEditLastVisit(e.target.value)} />
                        </div>
                      )
                    }
                    return (
                      <div key={col.key} className="grid-cell" style={cellStyle(col.key, rowBg)}>
                        {col.key === 'status' ? (
                          <span className={`status-pill status-${a.status}`}>{a.status.charAt(0).toUpperCase() + a.status.slice(1)}</span>
                        ) : (
                          cellValue(a, col.key)
                        )}
                      </div>
                    )
                  })}
                  {editable && (
                    <div className="grid-cell" style={{ gridColumn: '1 / -1', background: rowBg }}>
                      <label style={{ fontSize: 12, color: 'var(--mist)', display: 'block', marginBottom: 4 }}>Notes</label>
                      <input type="text" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} style={{ width: '100%', maxWidth: 500 }} />
                    </div>
                  )}
                  {expandedId === a.id && !editable && (
                    <div className="grid-cell" style={{ gridColumn: '1 / -1', background: 'var(--ink)', padding: 16 }}>
                      {loadingHistory ? (
                        <p style={{ color: 'var(--mist)' }}>Loading billing history…</p>
                      ) : billingHistory.length === 0 ? (
                        <p style={{ color: 'var(--mist)' }}>No billing history yet.</p>
                      ) : (
                        <table style={{ width: '100%', fontSize: 13 }}>
                          <thead>
                            <tr style={{ textAlign: 'left', color: 'var(--mist)' }}>
                              <th style={{ padding: '4px 8px' }}>Billed</th>
                              <th style={{ padding: '4px 8px' }}>Amount</th>
                              <th style={{ padding: '4px 8px' }}>Status</th>
                              <th style={{ padding: '4px 8px' }}>Paid At</th>
                            </tr>
                          </thead>
                          <tbody>
                            {billingHistory.map((b) => (
                              <tr key={b.id}>
                                <td style={{ padding: '4px 8px' }}>{dateDisplay(b.billed_date)}</td>
                                <td style={{ padding: '4px 8px' }}>{money(b.amount)}</td>
                                <td style={{ padding: '4px 8px' }}>
                                  <span className={`status-pill ${b.status === 'paid' ? 'status-active' : b.status === 'failed' ? 'status-lapsed' : 'status-pending'}`}>
                                    {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                                  </span>
                                </td>
                                <td style={{ padding: '4px 8px' }}>{b.paid_at ? new Date(b.paid_at).toLocaleDateString('en-US') : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </>
              )
            })}
            {filtered.length === 0 && (
              <div className="grid-cell" style={{ gridColumn: '1 / -1', color: 'var(--mist)' }}>No agreements found.</div>
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
    </div>
  )
}
