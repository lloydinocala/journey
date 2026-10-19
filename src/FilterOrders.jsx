// Filter Orders — the office view for air-filter orders from every source
// (customer portal, phoned in by a customer or a tech, website). Each order is a
// FLT-#### invoice (is_filter_order). Staff can place an order here, see the full
// sales table linked to the customer, and track payment + delivery status.
import { useState, useEffect, Fragment } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import NewItemDropdown from './NewItemDropdown'
import QuickAddModal from './QuickAddModal'

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

  const [newItemMode, setNewItemMode] = useState(null)
  const [refundMsg, setRefundMsg] = useState('')
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
      .select('id, invoice_number, amount_due, total_paid, paid_at, created_at, filter_fulfilled_at, filter_cancelled_at, filter_source, filter_delivery_status, filter_ship_via, filter_notes, refund_status, refund_amount, refund_owed_amount, refunded_at, bills_to_customer_id, property_id, invoice_line_items!invoice_line_items_invoice_id_fkey(id, description, quantity, unit_price, sort_order)')
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
  // Cancelling a PAID order settles the money: online card payments are refunded
  // through Stripe automatically; cash/check is flagged "Refund owed" on the dashboard.
  async function toggleCancel(o) {
    const cancel = !o.filter_cancelled_at
    setRefundMsg('')
    if (!cancel) {
      if (o.refund_status) { alert('This order was refunded/flagged for refund, so it can\'t be un-cancelled. Place a new order instead.'); return }
      await supabase.from('invoices').update({ filter_cancelled_at: null }).eq('id', o.id)
      loadOrders(selectedOrg); return
    }
    const paidAmt = Number(o.total_paid) || 0
    if (paidAmt > 0) {
      if (!window.confirm(`Cancel order ${o.invoice_number}?\n\n${money(paidAmt)} has been paid. Online card payments will be refunded to the card automatically. Cash or check payments will be flagged "Refund owed" until you hand the money back.`)) return
      const { data, error } = await supabase.functions.invoke('refund-filter-order', { body: { invoiceId: o.id } })
      let err = data?.error || null
      if (error && !err) { try { err = (await error.context?.json())?.error } catch (e) { /* ignore */ } err = err || error.message }
      if (err) { setRefundMsg(`Not cancelled — ${err}`); return }
      const parts = []
      if (data?.refunded > 0) parts.push(`${money(data.refunded)} refunded to the card`)
      if (data?.owed > 0) parts.push(`${money(data.owed)} cash/check refund owed — flagged on the dashboard`)
      setRefundMsg(`${o.invoice_number} cancelled${parts.length ? ': ' + parts.join('; ') : ''}.`)
    } else {
      if (!window.confirm(`Cancel order ${o.invoice_number}? It stays on record but drops off the open list.`)) return
      await supabase.from('invoices').update({ filter_cancelled_at: new Date().toISOString() }).eq('id', o.id)
    }
    loadOrders(selectedOrg)
  }
  async function markRefundHandedBack(o) {
    if (!window.confirm(`Confirm the ${money(o.refund_owed_amount)} cash/check refund for ${o.invoice_number} was handed back to the customer?`)) return
    await supabase.from('invoices').update({ refund_status: 'done', refunded_at: new Date().toISOString() }).eq('id', o.id)
    loadOrders(selectedOrg)
  }
  async function deleteOrder(o) {
    if (!window.confirm(`Delete order ${o.invoice_number}? This removes it from the list.`)) return
    await supabase.from('invoices').update({ deleted_at: new Date().toISOString() }).eq('id', o.id)
    loadOrders(selectedOrg)
  }

  const isOpen = (o) => !TERMINAL.has(deliveryOf(o)) && !o.filter_cancelled_at
  const refundOwed = (o) => o.refund_status === 'owed' || o.refund_status === 'partial_owed'
  const shown = (orders || []).filter((o) => tab === 'all' ? true : tab === 'refunds' ? refundOwed(o) : tab === 'delivered' ? (TERMINAL.has(deliveryOf(o)) && !o.filter_cancelled_at) : isOpen(o))
  const refundCount = (orders || []).filter(refundOwed).length
  const openCount = (orders || []).filter(isOpen).length

  const inputStyle = { padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 7, background: '#fff', color: '#0f172a', boxSizing: 'border-box' }
  const linkBtn = { border: 'none', background: 'none', color: '#176E7A', cursor: 'pointer', padding: 0, font: 'inherit' }

  return (
    <div style={{ maxWidth: 1150, margin: '0 auto' }}>
      <div className="page-header-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Filter Orders</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => selectedOrg && loadOrders(selectedOrg)} disabled={!selectedOrg} style={{ border: '1px solid var(--border)', background: '#fff', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#176E7A' }}>Refresh</button>
          <NewItemDropdown items={['filterOrder', 'job', 'customer', 'property', 'task']} onSelect={setNewItemMode} />
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

      {refundMsg && <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, fontSize: 13.5, background: refundMsg.startsWith('Not') ? '#FBECE8' : '#EAF3EC', color: refundMsg.startsWith('Not') ? '#B5462F' : '#2E7D52' }}>{refundMsg}</div>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[['open', `Open${openCount ? ` (${openCount})` : ''}`], ['delivered', 'Delivered'], ...(refundCount ? [['refunds', `Refunds owed (${refundCount})`]] : []), ['all', 'All']].map(([key, label]) => (
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
              <th>Order</th><th>Date</th><th>Customer</th><th>Source</th><th>Filters</th><th>Total</th><th>Payment</th><th style={{ minWidth: 220 }}>Delivery</th><th style={{ width: 96 }}>Actions</th>
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
                    <td style={{ fontSize: 13 }}>{o.items.map((li, i) => <div key={i}>{li.quantity}× {li.description}</div>)}{o.filter_notes && <div style={{ color: 'var(--mist)', fontSize: 12, marginTop: 3 }}>Note: {o.filter_notes}</div>}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{money(o.amount_due)}</td>
                    <td>
                      {cancelled ? <Pill tone="mist">Cancelled</Pill> : <Pill tone={o.paid ? 'green' : 'amber'}>{o.paid ? 'Paid' : 'Unpaid'}</Pill>}
                      {o.refund_amount > 0 && <div style={{ fontSize: 11.5, color: '#1b7a3d', marginTop: 4 }}>Refunded {money(o.refund_amount)} to card</div>}
                      {refundOwed(o) && <div style={{ fontSize: 11.5, color: '#B5462F', fontWeight: 700, marginTop: 4 }}>Refund owed {money(o.refund_owed_amount)}<div><button onClick={() => markRefundHandedBack(o)} style={{ border: 'none', background: 'none', color: '#176E7A', cursor: 'pointer', padding: 0, font: 'inherit', fontWeight: 600 }}>Mark handed back</button></div></div>}
                      {o.refund_status === 'done' && <div style={{ fontSize: 11.5, color: '#1b7a3d', marginTop: 4 }}>Cash/check refund handed back</div>}
                    </td>
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
                    <td style={{ fontSize: 12.5, verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                        <Link to={`/view-invoice/${o.id}`}>Invoice</Link>
                        {!cancelled && <button onClick={() => startEdit(o)} style={linkBtn}>Edit</button>}
                        <button onClick={() => toggleCancel(o)} style={linkBtn}>{cancelled ? 'Un-cancel' : 'Cancel'}</button>
                        <button onClick={() => deleteOrder(o)} style={{ ...linkBtn, color: '#B5462F', fontWeight: 700 }}>Delete</button>
                      </div>
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
      {newItemMode && (
        <QuickAddModal mode={newItemMode} orgId={selectedOrg} profile={profile} onClose={() => setNewItemMode(null)} onCreated={() => loadOrders(selectedOrg)} />
      )}
    </div>
  )
}
