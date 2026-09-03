// Filter Orders — the office view of customer filter orders (the FLT-#### invoices
// created from the portal), so staff can see what to fulfill/ship. Shows payment
// status and a fulfillment toggle. Reads the same invoices the portal creates.
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

const money = (v) => (v == null ? '—' : '$' + Number(v).toFixed(2))
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '')

function Pill({ tone, children }) {
  const map = {
    green: { bg: 'rgba(46,160,87,0.14)', fg: '#1b7a3d', bd: 'rgba(46,160,87,0.35)' },
    amber: { bg: 'rgba(210,150,40,0.14)', fg: '#9a6a12', bd: 'rgba(210,150,40,0.35)' },
    mist: { bg: 'rgba(120,130,140,0.14)', fg: 'var(--mist)', bd: 'rgba(120,130,140,0.3)' },
  }
  const c = map[tone] || map.mist
  return <span style={{ fontSize: 11, fontWeight: 700, color: c.fg, background: c.bg, border: `1px solid ${c.bd}`, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>{children}</span>
}

export default function FilterOrders({ profile }) {
  const isSuperAdmin = profile?.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile?.org_id || '')
  const [orders, setOrders] = useState(null)
  const [tab, setTab] = useState('open') // 'open' | 'fulfilled' | 'all'

  useEffect(() => {
    if (isSuperAdmin) supabase.from('organizations').select('id, name').order('name').then(({ data }) => setOrgs(data || []))
  }, [isSuperAdmin])

  useEffect(() => { if (selectedOrg) loadOrders(selectedOrg) }, [selectedOrg])

  async function loadOrders(orgId) {
    setOrders(null)
    const { data: inv } = await supabase.from('invoices')
      .select('id, invoice_number, amount_due, paid_at, sent_at, created_at, filter_fulfilled_at, bills_to_customer_id, property_id, invoice_line_items(description, quantity, unit_price, sort_order)')
      .eq('org_id', orgId).eq('is_filter_order', true).eq('is_archived', false)
      .order('created_at', { ascending: false })
    const rows = inv || []
    const custIds = [...new Set(rows.map((r) => r.bills_to_customer_id).filter(Boolean))]
    const propIds = [...new Set(rows.map((r) => r.property_id).filter(Boolean))]
    const [{ data: custs }, { data: props }] = await Promise.all([
      custIds.length ? supabase.from('customers').select('id, display_name, primary_phone, email_1').in('id', custIds) : Promise.resolve({ data: [] }),
      propIds.length ? supabase.from('properties').select('id, street_address, unit, city').in('id', propIds) : Promise.resolve({ data: [] }),
    ])
    const cById = Object.fromEntries((custs || []).map((c) => [c.id, c]))
    const pById = Object.fromEntries((props || []).map((p) => [p.id, p]))
    setOrders(rows.map((r) => ({
      ...r,
      customer: cById[r.bills_to_customer_id] || null,
      property: pById[r.property_id] || null,
      items: (r.invoice_line_items || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
      paid: !!r.paid_at,
      fulfilled: !!r.filter_fulfilled_at,
    })))
  }

  async function toggleFulfilled(o) {
    await supabase.from('invoices').update({ filter_fulfilled_at: o.fulfilled ? null : new Date().toISOString() }).eq('id', o.id)
    loadOrders(selectedOrg)
  }

  const shown = (orders || []).filter((o) => tab === 'all' ? true : tab === 'fulfilled' ? o.fulfilled : !o.fulfilled)
  const openCount = (orders || []).filter((o) => !o.fulfilled).length

  return (
    <div style={{ maxWidth: 1050, margin: '0 auto' }}>
      <div className="page-header-bar"><h2>Filter Orders</h2></div>
      <p style={{ color: 'var(--mist)', fontSize: 14, marginTop: 4, marginBottom: 16, maxWidth: 720 }}>
        Air filter orders placed by customers in the portal. Each is a FLT-#### invoice — fulfill (ship/deliver) the paid
        ones and mark them done.
      </p>

      {isSuperAdmin && (
        <div style={{ marginBottom: 16, maxWidth: 360 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[['open', `Open${openCount ? ` (${openCount})` : ''}`], ['fulfilled', 'Fulfilled'], ['all', 'All']].map(([key, label]) => (
          <button key={key} className={tab === key ? 'auth-button' : 'logout-button'} style={{ width: 'auto', padding: '6px 16px' }} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {orders === null ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : shown.length === 0 ? (
        <p style={{ color: 'var(--mist)' }}>{tab === 'open' ? 'No open filter orders — all caught up.' : 'No orders here.'}</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {shown.map((o) => (
            <div key={o.id} style={{ background: 'var(--panel)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {o.invoice_number} · {o.customer?.display_name || 'Customer'}
                    <span style={{ fontWeight: 400, color: 'var(--mist)' }}>{'  '}· {fmtDate(o.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--mist)', marginTop: 2 }}>
                    {[o.property?.street_address, o.property?.unit].filter(Boolean).join(' ')}{o.property?.city ? `, ${o.property.city}` : ''}
                    {o.customer?.primary_phone ? `  ·  ${o.customer.primary_phone}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Pill tone={o.paid ? 'green' : 'amber'}>{o.paid ? 'Paid' : 'Awaiting payment'}</Pill>
                  {o.fulfilled ? <Pill tone="green">Fulfilled {fmtDate(o.filter_fulfilled_at)}</Pill> : <Pill tone="mist">Open</Pill>}
                </div>
              </div>

              <div style={{ margin: '10px 0', fontSize: 14 }}>
                {o.items.map((li, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', maxWidth: 460 }}>
                    <span>{li.quantity}× {li.description}</span>
                    <span style={{ color: 'var(--mist)' }}>{money(li.unit_price)} ea · {money(li.unit_price * li.quantity)}</span>
                  </div>
                ))}
                <div style={{ fontWeight: 700, marginTop: 4, maxWidth: 460, textAlign: 'right' }}>Total: {money(o.amount_due)}</div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link className="logout-button" style={{ textDecoration: 'none', fontSize: 13, padding: '5px 12px' }} to={`/view-invoice/${o.id}`}>View invoice</Link>
                <button className={o.fulfilled ? 'logout-button' : 'auth-button'} style={{ width: 'auto', padding: '5px 14px' }} onClick={() => toggleFulfilled(o)}>
                  {o.fulfilled ? 'Mark not fulfilled' : 'Mark fulfilled'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
