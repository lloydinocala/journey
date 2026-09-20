// Filter Orders — the office view for air-filter orders from every source
// (customer portal, phoned in by a customer or a tech, website). Each order is a
// FLT-#### invoice (is_filter_order). Staff can place an order here, see the full
// sales table linked to the customer, and track payment + delivery status.
import { useState, useEffect, Fragment } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

const money = (v) => (v == null ? '—' : '$' + Number(v).toFixed(2))
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '')

const SOURCE = { portal: 'Customer Portal', phone_customer: 'Called in — customer', phone_tech: 'Called in — tech', website: 'Website', office: 'Office' }
const SOURCE_OPTS = [['office', 'Office'], ['phone_customer', 'Called in — customer'], ['phone_tech', 'Called in — tech'], ['portal', 'Customer Portal'], ['website', 'Website']]
const sourceLabel = (o) => SOURCE[o.filter_source] || 'Customer Portal'

const DELIVERY = [['ordered', 'Ordered'], ['shipped', 'Shipped'], ['delivered_tech', 'Delivered by tech'], ['delivered', 'Delivered'], ['picked_up', 'Picked up']]
const TERMINAL = new Set(['delivered_tech', 'delivered', 'picked_up'])
const deliveryOf = (o) => {
  if (o.filter_delivery_status) return o.filter_delivery_status
  return o.filter_fulfilled_at ? 'delivered' : 'ordered'
}

function Pill({ tone, children }) {
  const map = {
    green: { bg: 'rgba(46,160,87,0.14)', fg: '#1b7a3d', bd: 'rgba(46,160,87,0.35)' },
    amber: { bg: 'rgba(210,150,40,0.14)', fg: '#9a6a12', bd: 'rgba(210,150,40,0.35)' },
    mist: { bg: 'rgba(120,130,140,0.14)', fg: 'var(--mist)', bd: 'rgba(120,130,140,0.3)' },
  }
  const c = map[tone] || map.mist
  return <span style={{ fontSize: 11, fontWeight: 700, color: c.fg, background: c.bg, border: `1px solid ${c.bd}`, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>{children}</span>
}

const blankLine = () => ({ width: '', height: '', thickness: '1', merv: '', qty: '1' })

export default function FilterOrders({ profile }) {
  const isSuperAdmin = profile?.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(() => (typeof localStorage !== 'undefined' && localStorage.getItem('journey_viewing_org')) || profile?.org_id || '')
  const [orders, setOrders] = useState(null)
  const [tab, setTab] = useState('open') // 'open' | 'delivered' | 'all'

  // order-entry form
  const [formOpen, setFormOpen] = useState(false)
  const [custQuery, setCustQuery] = useState('')
  const [custResults, setCustResults] = useState([])
  const [cust, setCust] = useState(null)
  const [props, setProps] = useState([])
  const [propId, setPropId] = useState('')
  const [source, setSource] = useState('office')
  const [lines, setLines] = useState([blankLine()])
  const [onFile, setOnFile] = useState([])       // property_filters on record
  const [lastOrder, setLastOrder] = useState(null)
  const [creating, setCreating] = useState(false)
  const [formMsg, setFormMsg] = useState('')
  const [editId, setEditId] = useState(null)     // order being edited inline
  const [editLines, setEditLines] = useState([]) // its line items while editing
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    if (isSuperAdmin) supabase.from('organizations').select('id, name').order('name').then(({ data }) => setOrgs(data || []))
  }, [isSuperAdmin])
  useEffect(() => { if (selectedOrg) loadOrders(selectedOrg) }, [selectedOrg])
  // Auto-refresh so new portal/website orders appear without a manual reload.
  useEffect(() => {
    if (!selectedOrg) return
    const id = setInterval(() => loadOrders(selectedOrg), 30000)
    const onFocus = () => loadOrders(selectedOrg)
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(id); window.removeEventListener('focus', onFocus) }
  }, [selectedOrg])

  async function loadOrders(orgId) {
    setOrders(null)
    const { data: inv } = await supabase.from('invoices')
      .select('id, invoice_number, amount_due, total_paid, paid_at, created_at, filter_fulfilled_at, filter_cancelled_at, filter_source, filter_delivery_status, filter_ship_via, bills_to_customer_id, property_id, invoice_line_items!invoice_line_items_invoice_id_fkey(id, description, quantity, unit_price, sort_order)')
      .eq('org_id', orgId).eq('is_filter_order', true).eq('is_archived', false).is('deleted_at', null)
      .order('created_at', { ascending: false })
    const rows = inv || []
    const custIds = [...new Set(rows.map((r) => r.bills_to_customer_id).filter(Boolean))]
    const propIds = [...new Set(rows.map((r) => r.property_id).filter(Boolean))]
    const [{ data: custs }, { data: propsData }] = await Promise.all([
      custIds.length ? supabase.from('customers').select('id, display_name, primary_phone').in('id', custIds) : Promise.resolve({ data: [] }),
      propIds.length ? supabase.from('properties').select('id, street_address, unit, city').in('id', propIds) : Promise.resolve({ data: [] }),
    ])
    const cById = Object.fromEntries((custs || []).map((c) => [c.id, c]))
    const pById = Object.fromEntries((propsData || []).map((p) => [p.id, p]))
    setOrders(rows.map((r) => ({
      ...r,
      customer: cById[r.bills_to_customer_id] || null,
      property: pById[r.property_id] || null,
      items: (r.invoice_line_items || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
      paid: !!r.paid_at,
    })))
  }

  async function setDelivery(o, status) {
    const patch = { filter_delivery_status: status, filter_fulfilled_at: TERMINAL.has(status) ? (o.filter_fulfilled_at || new Date().toISOString()) : null }
    setOrders((os) => os.map((x) => x.id === o.id ? { ...x, ...patch } : x))
    await supabase.from('invoices').update(patch).eq('id', o.id)
  }
  async function setShipVia(o, v) {
    setOrders((os) => os.map((x) => x.id === o.id ? { ...x, filter_ship_via: v } : x))
    await supabase.from('invoices').update({ filter_ship_via: v }).eq('id', o.id)
  }

  // ---- edit / cancel / delete ----
  function startEdit(o) {
    setEditId(o.id)
    setEditLines(o.items.map((li) => ({ id: li.id, description: li.description, unit_price: Number(li.unit_price) || 0, quantity: Number(li.quantity) || 1 })))
  }
  const editQty = (id, v) => setEditLines((ls) => ls.map((l) => l.id === id ? { ...l, quantity: v } : l))
  const removeEditLine = (id) => setEditLines((ls) => ls.filter((l) => l.id !== id))
  async function saveEdit(o) {
    setSavingEdit(true)
    const keep = editLines.filter((l) => Math.max(0, Number(l.quantity) || 0) > 0)
    const removedIds = o.items.filter((li) => !keep.some((k) => k.id === li.id)).map((li) => li.id)
    // apply quantity changes + removals
    for (const l of keep) await supabase.from('invoice_line_items').update({ quantity: Math.max(1, Number(l.quantity) || 1) }).eq('id', l.id)
    if (removedIds.length) await supabase.from('invoice_line_items').delete().in('id', removedIds)
    const subtotal = Number(keep.reduce((s, l) => s + l.unit_price * Math.max(1, Number(l.quantity) || 1), 0).toFixed(2))
    const balance = Number((subtotal - (Number(o.total_paid) || 0)).toFixed(2))
    await supabase.from('invoices').update({ subtotal, job_total: subtotal, amount_due: subtotal, balance }).eq('id', o.id)
    setSavingEdit(false); setEditId(null); setEditLines([])
    loadOrders(selectedOrg)
  }
  async function toggleCancel(o) {
    const cancel = !o.filter_cancelled_at
    if (cancel && !window.confirm(`Cancel order ${o.invoice_number}? It stays on record but drops off the open list.`)) return
    await supabase.from('invoices').update({ filter_cancelled_at: cancel ? new Date().toISOString() : null }).eq('id', o.id)
    loadOrders(selectedOrg)
  }
  async function deleteOrder(o) {
    if (!window.confirm(`Delete order ${o.invoice_number}? This removes it from the list.`)) return
    await supabase.from('invoices').update({ deleted_at: new Date().toISOString() }).eq('id', o.id)
    loadOrders(selectedOrg)
  }

  // ---- order-entry form ----
  async function searchCust(v) {
    setCustQuery(v); setCust(null); setProps([]); setPropId('')
    if (v.trim().length < 2) { setCustResults([]); return }
    const { data } = await supabase.from('customers').select('id, display_name, primary_phone')
      .eq('org_id', selectedOrg).ilike('display_name', `%${v.trim()}%`).order('display_name').limit(8)
    setCustResults(data || [])
  }
  async function pickCust(c) {
    setCust(c); setCustResults([]); setCustQuery(c.display_name)
    const { data } = await supabase.from('properties').select('id, street_address, unit, city').eq('customer_id', c.id).order('street_address')
    setProps(data || []); setPropId(data && data.length === 1 ? data[0].id : '')
  }
  const setLine = (i, k, v) => setLines((ls) => ls.map((l, idx) => idx === i ? { ...l, [k]: v } : l))
  function resetForm() { setCust(null); setCustQuery(''); setCustResults([]); setProps([]); setPropId(''); setSource('office'); setLines([blankLine()]); setOnFile([]); setLastOrder(null); setFormMsg('') }

  // When a property is chosen, pull its filters on file + last order so we can
  // verify and prefill instead of re-typing sizes.
  useEffect(() => {
    if (!propId) { setOnFile([]); setLastOrder(null); return }
    let cancelled = false
    ;(async () => {
      const [{ data: pf }, { data: last }] = await Promise.all([
        supabase.from('property_filters').select('width, height, thickness, merv, quantity, location').eq('property_id', propId),
        supabase.from('invoices').select('invoice_number, created_at, invoice_line_items!invoice_line_items_invoice_id_fkey(description, quantity, sort_order)').eq('is_filter_order', true).eq('property_id', propId).is('deleted_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ])
      if (cancelled) return
      const onf = pf || []
      setOnFile(onf)
      setLastOrder(last || null)
      // Auto-prefill from filters on file, but only if the form is still blank.
      setLines((cur) => (onf.length && cur.length === 1 && !cur[0].width && !cur[0].height)
        ? onf.map(fileToLine) : cur)
    })()
    return () => { cancelled = true }
  }, [propId])

  const fileToLine = (f) => ({ width: String(f.width ?? ''), height: String(f.height ?? ''), thickness: String(f.thickness ?? 1), merv: f.merv ? String(f.merv) : '', qty: String(f.quantity || 1) })
  const sizeText = (f) => `${[f.width, f.height, f.thickness].filter((v) => v != null && v !== '').join('×')}${f.merv ? ` MERV ${f.merv}` : ''}${f.quantity ? ` ×${f.quantity}` : ''}`
  function useOnFile() { if (onFile.length) setLines(onFile.map(fileToLine)) }
  function reorderLast() {
    const its = (lastOrder?.invoice_line_items || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    const parsed = its.map((li) => {
      const m = /(\d+)\s*x\s*(\d+)\s*x\s*(\d+)/i.exec(li.description || '')
      if (!m) return null
      const mv = /MERV\s*(\d+)/i.exec(li.description || '')
      return { width: m[1], height: m[2], thickness: m[3], merv: mv ? mv[1] : '', qty: String(li.quantity || 1) }
    }).filter(Boolean)
    if (parsed.length) setLines(parsed)
  }

  async function createOrder() {
    setFormMsg('')
    if (!propId) { setFormMsg('Choose the customer and property.'); return }
    const items = lines.filter((l) => l.width && l.height).map((l) => ({ width: Number(l.width), height: Number(l.height), thickness: Number(l.thickness) || 1, merv: l.merv ? Number(l.merv) : null, qty: Math.max(1, Number(l.qty) || 1) }))
    if (!items.length) { setFormMsg('Add at least one filter size (width × height).'); return }
    setCreating(true)
    const { data, error } = await supabase.functions.invoke('create-filter-invoice', { body: { propertyId: propId, items } })
    if (error || !data?.invoiced) {
      setCreating(false)
      setFormMsg(data?.reason === 'unpriced' ? 'None of those sizes are in the filter pricebook — add them in the pricebook first.' : (data?.error || error?.message || 'Could not create the order.'))
      return
    }
    // Stamp the source + starting delivery status onto the new order.
    await supabase.from('invoices').update({ filter_source: source, filter_delivery_status: 'ordered' }).eq('id', data.invoiceId)
    setCreating(false)
    setFormMsg(`Created ${data.invoiceNumber} · ${money(data.amount)}${data.emailed ? ' · invoice emailed' : ''}${data.unpriced ? ` · ${data.unpriced} size(s) skipped (no price)` : ''}`)
    resetForm()
    loadOrders(selectedOrg)
  }

  const isOpen = (o) => !TERMINAL.has(deliveryOf(o)) && !o.filter_cancelled_at
  const shown = (orders || []).filter((o) => tab === 'all' ? true : tab === 'delivered' ? (TERMINAL.has(deliveryOf(o)) && !o.filter_cancelled_at) : isOpen(o))
  const openCount = (orders || []).filter(isOpen).length

  const inputStyle = { padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 7, background: '#fff', color: '#0f172a', boxSizing: 'border-box' }
  const linkBtn = { border: 'none', background: 'none', color: '#176E7A', cursor: 'pointer', padding: 0, font: 'inherit' }

  return (
    <div style={{ maxWidth: 1150, margin: '0 auto' }}>
      <div className="page-header-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Filter Orders</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => selectedOrg && loadOrders(selectedOrg)} disabled={!selectedOrg} style={{ border: '1px solid var(--border)', background: '#fff', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#176E7A' }}>Refresh</button>
          <button onClick={() => { setFormOpen((o) => !o); setFormMsg('') }} disabled={!selectedOrg} style={{ border: '1px solid var(--border)', background: formOpen ? '#EAF3F4' : '#fff', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#176E7A' }}>+ New order</button>
        </div>
      </div>
      <p style={{ color: 'var(--mist)', fontSize: 14, marginTop: 4, marginBottom: 16, maxWidth: 760 }}>
        Air-filter orders from every source — the customer portal, phoned in by a customer or a tech, or the website. Paid or unpaid, they all land here to fulfill and track. Each is a FLT-#### invoice linked to the customer.
      </p>

      {isSuperAdmin && (
        <div style={{ marginBottom: 16, maxWidth: 360 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      {formOpen && (
        <div className="section-card" style={{ padding: 16, marginBottom: 18, border: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 800, marginBottom: 12 }}>Place a filter order</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 260px', position: 'relative' }}>
              <label style={{ display: 'block', fontSize: 12.5, color: 'var(--mist)', marginBottom: 4 }}>Customer</label>
              <input value={custQuery} onChange={(e) => searchCust(e.target.value)} placeholder="Search by name…" style={{ ...inputStyle, width: '100%' }} />
              {custResults.length > 0 && (
                <div className="section-card" style={{ position: 'absolute', zIndex: 5, left: 0, right: 0, padding: 6, marginTop: 4, maxHeight: 220, overflowY: 'auto' }}>
                  {custResults.map((c) => (
                    <button key={c.id} onClick={() => pickCust(c)} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: '6px 8px', cursor: 'pointer' }}>
                      {c.display_name}{c.primary_phone ? <span style={{ color: 'var(--mist)' }}> · {c.primary_phone}</span> : ''}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ flex: '1 1 260px' }}>
              <label style={{ display: 'block', fontSize: 12.5, color: 'var(--mist)', marginBottom: 4 }}>Property</label>
              <select value={propId} onChange={(e) => setPropId(e.target.value)} disabled={!cust} style={{ ...inputStyle, width: '100%' }}>
                <option value="">{cust ? 'Choose property…' : 'Pick a customer first'}</option>
                {props.map((p) => <option key={p.id} value={p.id}>{[p.street_address, p.unit, p.city].filter(Boolean).join(' ')}</option>)}
              </select>
            </div>
            <div style={{ flex: '0 1 200px' }}>
              <label style={{ display: 'block', fontSize: 12.5, color: 'var(--mist)', marginBottom: 4 }}>Order source</label>
              <select value={source} onChange={(e) => setSource(e.target.value)} style={{ ...inputStyle, width: '100%' }}>
                {SOURCE_OPTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
          </div>

          {propId && (onFile.length > 0 || lastOrder) && (
            <div style={{ marginTop: 14, padding: '10px 12px', background: '#F5F8FF', border: '1px solid #D8E2F5', borderRadius: 8 }}>
              {onFile.length > 0 && (
                <div style={{ marginBottom: lastOrder ? 8 : 0 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#2F5DE3' }}>Filters on file:</span>{' '}
                  <span style={{ fontSize: 13 }}>{onFile.map(sizeText).join('  ·  ')}</span>
                  <button type="button" onClick={useOnFile} style={{ marginLeft: 8, border: '1px solid #2F5DE3', background: '#fff', color: '#2F5DE3', borderRadius: 6, padding: '3px 10px', fontSize: 12, cursor: 'pointer' }}>Use these</button>
                </div>
              )}
              {lastOrder && (
                <div>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#2F5DE3' }}>Last order:</span>{' '}
                  <span style={{ fontSize: 13 }}>{lastOrder.invoice_number} · {fmtDate(lastOrder.created_at)}</span>
                  <button type="button" onClick={reorderLast} style={{ marginLeft: 8, border: '1px solid #2F5DE3', background: '#fff', color: '#2F5DE3', borderRadius: 6, padding: '3px 10px', fontSize: 12, cursor: 'pointer' }}>Reorder last</button>
                </div>
              )}
              <div style={{ fontSize: 11.5, color: 'var(--mist)', marginTop: 6 }}>Prefilled for you — verify sizes and quantities before creating.</div>
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            <label style={{ display: 'block', fontSize: 12.5, color: 'var(--mist)', marginBottom: 6 }}>Filters (priced from your filter pricebook)</label>
            {lines.map((l, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                <input value={l.width} onChange={(e) => setLine(i, 'width', e.target.value)} placeholder="W" style={{ ...inputStyle, width: 60 }} />
                <span style={{ color: 'var(--mist)' }}>×</span>
                <input value={l.height} onChange={(e) => setLine(i, 'height', e.target.value)} placeholder="H" style={{ ...inputStyle, width: 60 }} />
                <span style={{ color: 'var(--mist)' }}>×</span>
                <input value={l.thickness} onChange={(e) => setLine(i, 'thickness', e.target.value)} placeholder="T" style={{ ...inputStyle, width: 52 }} />
                <input value={l.merv} onChange={(e) => setLine(i, 'merv', e.target.value)} placeholder="MERV" style={{ ...inputStyle, width: 70 }} />
                <input value={l.qty} onChange={(e) => setLine(i, 'qty', e.target.value)} placeholder="Qty" style={{ ...inputStyle, width: 56 }} />
                {lines.length > 1 && <button onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))} style={{ border: '1px solid var(--border)', background: '#fff', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', color: '#B5462F' }}>✕</button>}
              </div>
            ))}
            <button onClick={() => setLines((ls) => [...ls, blankLine()])} style={{ border: 'none', background: 'none', color: '#176E7A', fontSize: 12.5, cursor: 'pointer', padding: 0 }}>+ Add another size</button>
          </div>

          {formMsg && <div style={{ marginTop: 10, fontSize: 13, color: formMsg.startsWith('Created') ? '#1b7a3d' : '#B5462F' }}>{formMsg}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={creating} onClick={createOrder}>{creating ? 'Creating…' : 'Create order'}</button>
            <button onClick={resetForm} style={{ border: '1px solid var(--border)', background: '#fff', borderRadius: 8, padding: '9px 16px', cursor: 'pointer' }}>Clear</button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--mist)', marginTop: 8 }}>Creates an unpaid FLT-#### invoice and emails the customer a pay link (if they have an email on file). Payment is tracked below — it's not required to place or deliver the order.</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[['open', `Open${openCount ? ` (${openCount})` : ''}`], ['delivered', 'Delivered'], ['all', 'All']].map(([key, label]) => (
          <button key={key} className={tab === key ? 'auth-button' : 'logout-button'} style={{ width: 'auto', padding: '6px 16px' }} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {orders === null ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : shown.length === 0 ? (
        <p style={{ color: 'var(--mist)' }}>{tab === 'open' ? 'No open filter orders — all caught up.' : 'No orders here.'}</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr>
              <th>Order</th><th>Date</th><th>Customer</th><th>Source</th><th>Filters</th><th>Total</th><th>Payment</th><th style={{ minWidth: 260 }}>Delivery</th><th></th>
            </tr></thead>
            <tbody>
              {shown.map((o) => {
                const d = deliveryOf(o)
                const cancelled = !!o.filter_cancelled_at
                const editing = editId === o.id
                const editTotal = editLines.reduce((s, l) => s + l.unit_price * Math.max(0, Number(l.quantity) || 0), 0)
                return (
                  <Fragment key={o.id}>
                  <tr style={cancelled ? { opacity: 0.55 } : undefined}>
                    <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{o.invoice_number}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(o.created_at)}</td>
                    <td>
                      {o.customer ? <Link to={`/customers/${o.bills_to_customer_id}`}>{o.customer.display_name}</Link> : 'Customer'}
                      {o.property && <div style={{ fontSize: 12, color: 'var(--mist)' }}>{[o.property.street_address, o.property.unit].filter(Boolean).join(' ')}</div>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12.5 }}>{sourceLabel(o)}</td>
                    <td style={{ fontSize: 13 }}>{o.items.map((li, i) => <div key={i}>{li.quantity}× {li.description}</div>)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{money(o.amount_due)}</td>
                    <td>{cancelled ? <Pill tone="mist">Cancelled</Pill> : <Pill tone={o.paid ? 'green' : 'amber'}>{o.paid ? 'Paid' : 'Unpaid'}</Pill>}</td>
                    <td>
                      {cancelled ? <span style={{ color: 'var(--mist)', fontSize: 13 }}>—</span> : (<>
                        <select value={d} onChange={(e) => setDelivery(o, e.target.value)} style={{ ...inputStyle, width: '100%' }}>
                          {DELIVERY.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                        </select>
                        {d === 'shipped' && (
                          <input defaultValue={o.filter_ship_via || ''} onBlur={(e) => setShipVia(o, e.target.value)} placeholder="Shipped via (carrier / tracking)" style={{ ...inputStyle, width: '100%', marginTop: 5, fontSize: 12.5 }} />
                        )}
                      </>)}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12.5 }}>
                      <Link to={`/view-invoice/${o.id}`}>Invoice</Link>
                      {!cancelled && <> · <button onClick={() => startEdit(o)} style={linkBtn}>Edit</button></>}
                      {' · '}<button onClick={() => toggleCancel(o)} style={linkBtn}>{cancelled ? 'Un-cancel' : 'Cancel'}</button>
                      {' · '}<button onClick={() => deleteOrder(o)} style={{ ...linkBtn, color: '#B5462F' }}>Delete</button>
                    </td>
                  </tr>
                  {editing && (
                    <tr>
                      <td colSpan={9} style={{ background: '#F5F8FF' }}>
                        <div style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>Edit {o.invoice_number} — adjust quantities or remove lines</div>
                          {editLines.length === 0 && <div style={{ fontSize: 13, color: '#B5462F', marginBottom: 8 }}>All lines removed — saving will empty the order; cancel or delete it instead if that's the intent.</div>}
                          {editLines.map((l) => (
                            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                              <span style={{ minWidth: 220, fontSize: 13 }}>{l.description}</span>
                              <span style={{ fontSize: 12.5, color: 'var(--mist)' }}>{money(l.unit_price)} ea</span>
                              <label style={{ fontSize: 12.5, color: 'var(--mist)' }}>Qty <input value={l.quantity} onChange={(e) => editQty(l.id, e.target.value)} style={{ ...inputStyle, width: 56, marginLeft: 4 }} /></label>
                              <button onClick={() => removeEditLine(l.id)} style={{ ...linkBtn, color: '#B5462F' }}>Remove</button>
                            </div>
                          ))}
                          <div style={{ fontWeight: 700, marginTop: 8, fontSize: 13 }}>New total: {money(editTotal)}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--mist)', marginTop: 2 }}>To add a different filter size, place a new order — pricing comes from the pricebook.</div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                            <button className="auth-button" style={{ width: 'auto', margin: 0, padding: '7px 16px' }} disabled={savingEdit} onClick={() => saveEdit(o)}>{savingEdit ? 'Saving…' : 'Save changes'}</button>
                            <button onClick={() => { setEditId(null); setEditLines([]) }} style={{ border: '1px solid var(--border)', background: '#fff', borderRadius: 8, padding: '7px 16px', cursor: 'pointer' }}>Cancel edit</button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
          <div style={{ fontSize: 12, color: 'var(--mist)', marginTop: 8 }}>{shown.length} order{shown.length === 1 ? '' : 's'}</div>
        </div>
      )}
    </div>
  )
}
