// Supplies · Orders & POs
// Purchase orders for supplies from vendors that use them (office-supply and AC
// parts houses). PO numbers come from the SAME sequential counter as parts and
// tool POs. Order → receive lifecycle; receiving logs the spend automatically.
import { useState, useEffect, Fragment } from 'react'
import { Link } from 'react-router-dom'
import {
  listSupplies, listSupplyOrders, listSupplyOrderLines, createSupplyOrder,
  receiveSupplyOrder, cancelSupplyOrder, reorderSeedLines, SUPPLY_UNITS,
} from './suppliesData'
import { useOrgSelector, OrgBar } from '../elements-hvac/shared'

const today = () => new Date().toISOString().slice(0, 10)
const money = (n) => (n == null || n === '' || isNaN(n) ? '—' : `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
const emptyLine = () => ({ supply_id: '', item_name: '', unit: 'each', quantity: 1, unit_cost: '' })
const STATUS = { ordered: 'Ordered', partial: 'Partially received', received: 'Received', canceled: 'Canceled' }

export default function SuppliesOrders({ profile }) {
  const org = useOrgSelector(profile)
  const [orders, setOrders] = useState([])
  const [catalog, setCatalog] = useState([])
  const [includeClosed, setIncludeClosed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [head, setHead] = useState({ vendor: '', expected_date: '', notes: '' })
  const [lines, setLines] = useState([emptyLine()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [banner, setBanner] = useState('')
  const [recvOrder, setRecvOrder] = useState(null) // order id being received
  const [recvLines, setRecvLines] = useState([])
  const [recvQty, setRecvQty] = useState({})
  const [busy, setBusy] = useState(false)
  const [viewLines, setViewLines] = useState({}) // orderId -> lines cache

  async function load() {
    if (!org.selectedOrg) return
    setLoading(true)
    const [o, c] = await Promise.all([listSupplyOrders(org.selectedOrg, { includeClosed }), listSupplies(org.selectedOrg)])
    setOrders(o); setCatalog(c); setLoading(false)
  }
  useEffect(() => { load() }, [org.selectedOrg, includeClosed])

  function pickSupply(idx, id) {
    const s = catalog.find((x) => x.id === id)
    setLines((ls) => ls.map((l, i) => i === idx ? {
      ...l, supply_id: id,
      item_name: s ? s.name : l.item_name, unit: s?.unit || l.unit,
      unit_cost: s?.last_price ?? l.unit_cost, category: s?.category || null,
    } : l))
  }
  const setLine = (idx, patch) => setLines((ls) => ls.map((l, i) => i === idx ? { ...l, ...patch } : l))
  const addLine = () => setLines((ls) => [...ls, emptyLine()])
  const removeLine = (idx) => setLines((ls) => ls.length > 1 ? ls.filter((_, i) => i !== idx) : ls)

  async function pullReorder() {
    const seed = await reorderSeedLines(org.selectedOrg)
    if (seed.length === 0) { setBanner('Nothing is on the reorder list right now.'); return }
    setLines(seed.map((s) => ({ supply_id: s.supply_id, item_name: s.item_name, unit: s.unit || 'each', quantity: s.quantity || 1, unit_cost: s.unit_cost ?? '' })))
    setBanner(`Pulled ${seed.length} item${seed.length === 1 ? '' : 's'} from the reorder list.`)
  }

  function startNew() { setHead({ vendor: '', expected_date: '', notes: '' }); setLines([emptyLine()]); setShowForm(true); setError(''); setBanner('') }

  async function submitOrder(e) {
    e.preventDefault(); setError('')
    const usable = lines.filter((l) => (l.item_name || '').trim() || l.supply_id)
    if (usable.length === 0) { setError('Add at least one line item.'); return }
    setSaving(true)
    const { error: err, po_number } = await createSupplyOrder(org.selectedOrg, { ...head, lines: usable }, profile?.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    setShowForm(false); setBanner(`Created ${po_number}.`); load()
  }

  const orderTotal = lines.reduce((s, l) => s + (Number(l.unit_cost) || 0) * (Number(l.quantity) || 0), 0)

  async function openReceive(o) {
    setRecvOrder(o.id)
    const ls = await listSupplyOrderLines(org.selectedOrg, o.id)
    setRecvLines(ls)
    const q = {}; ls.forEach((l) => { q[l.id] = Math.max(0, (Number(l.quantity) || 0) - (Number(l.received_count) || 0)) })
    setRecvQty(q)
  }
  async function submitReceive(o) {
    setBusy(true)
    await receiveSupplyOrder(org.selectedOrg, o.id, recvQty)
    setBusy(false); setRecvOrder(null); load()
  }
  async function toggleView(o) {
    if (viewLines[o.id]) { setViewLines((v) => { const n = { ...v }; delete n[o.id]; return n }); return }
    const ls = await listSupplyOrderLines(org.selectedOrg, o.id)
    setViewLines((v) => ({ ...v, [o.id]: ls }))
  }

  const statusPill = (s) => (
    <span className="badge" style={{
      background: s === 'received' ? '#0B7A3B' : s === 'partial' ? '#B8720A' : s === 'canceled' ? '#8A93A6' : '#1B3A6B',
      color: '#fff',
    }}>{STATUS[s] || s}</span>
  )

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Supplies Orders &amp; POs</h2>
          <span className="badge">{orders.length} shown</span>
        </div>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => (showForm ? setShowForm(false) : startNew())}>{showForm ? 'Cancel' : '+ New PO'}</button>
      </div>
      <OrgBar {...org} />

      {banner && <div style={{ background: '#F0F9F4', border: '1px solid #BFE6CE', color: '#0B7A3B', padding: '8px 14px', borderRadius: 8, marginBottom: 14, fontSize: 14 }}>{banner}</div>}

      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0, maxWidth: 820 }}>
        Raise a PO for supplies from vendors that use them. PO numbers share the same running sequence as parts and tool
        POs, so numbering never collides. Nothing is spent until you receive the order — receiving logs the cost to
        <Link to="/supplies/purchases"> Purchases</Link> and updates each item&apos;s last price.
      </p>

      {showForm && (
        <form onSubmit={submitOrder} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12 }}>
            <div className="field" style={{ marginBottom: 0, minWidth: 200 }}><label>Vendor</label><input type="text" value={head.vendor} onChange={(e) => setHead({ ...head, vendor: e.target.value })} placeholder="Office / parts house" /></div>
            <div className="field" style={{ marginBottom: 0, width: 160 }}><label>Expected date</label><input type="date" value={head.expected_date} onChange={(e) => setHead({ ...head, expected_date: e.target.value })} /></div>
            <div className="field" style={{ marginBottom: 0, minWidth: 200, flex: 1 }}><label>Notes</label><input type="text" value={head.notes} onChange={(e) => setHead({ ...head, notes: e.target.value })} /></div>
            <button type="button" className="logout-button" style={{ margin: 0 }} onClick={pullReorder}>Pull from reorder list</button>
          </div>

          <table className="data-table" style={{ marginBottom: 10 }}>
            <thead><tr><th>From catalog</th><th>Item</th><th>Unit</th><th>Qty</th><th>Unit cost</th><th>Line total</th><th></th></tr></thead>
            <tbody>
              {lines.map((l, idx) => (
                <tr key={idx}>
                  <td>
                    <select value={l.supply_id} onChange={(e) => pickSupply(idx, e.target.value)}>
                      <option value="">— free text —</option>
                      {catalog.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </td>
                  <td><input type="text" value={l.item_name} onChange={(e) => setLine(idx, { item_name: e.target.value })} placeholder="Item" style={{ minWidth: 160 }} /></td>
                  <td>
                    <select value={l.unit} onChange={(e) => setLine(idx, { unit: e.target.value })}>
                      {SUPPLY_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>
                  <td><input type="number" step="any" value={l.quantity} onChange={(e) => setLine(idx, { quantity: e.target.value })} style={{ width: 70 }} /></td>
                  <td><input type="number" step="any" value={l.unit_cost} onChange={(e) => setLine(idx, { unit_cost: e.target.value })} placeholder="0.00" style={{ width: 90 }} /></td>
                  <td style={{ whiteSpace: 'nowrap' }}>{money((Number(l.unit_cost) || 0) * (Number(l.quantity) || 0))}</td>
                  <td><button type="button" className="logout-button" onClick={() => removeLine(idx)}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="logout-button" style={{ margin: 0 }} onClick={addLine}>+ Add line</button>
            <div style={{ marginLeft: 'auto', fontWeight: 700, color: '#1B3A6B' }}>PO total: {money(orderTotal)}</div>
            <button className="auth-button" type="submit" disabled={saving} style={{ width: 'auto', margin: 0 }}>{saving ? 'Creating…' : 'Create PO'}</button>
          </div>
          {error && <div className="auth-error" style={{ marginTop: 12 }}>{error}</div>}
        </form>
      )}

      <label className="nav-link" style={{ cursor: 'pointer', display: 'inline-block', marginBottom: 12 }}>
        <input type="checkbox" checked={includeClosed} onChange={(e) => setIncludeClosed(e.target.checked)} style={{ marginRight: 6 }} />
        Show received &amp; canceled
      </label>

      <table className="data-table">
        <thead><tr><th></th><th>PO #</th><th>Vendor</th><th>Status</th><th>Ordered</th><th>Expected</th><th>Amount</th></tr></thead>
        <tbody>
          {orders.map((o) => (
            <Fragment key={o.id}>
              <tr>
                <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(o.status === 'ordered' || o.status === 'partial') && <button className="auth-button" style={{ width: 'auto', margin: 0, padding: '4px 12px' }} onClick={() => (recvOrder === o.id ? setRecvOrder(null) : openReceive(o))}>{recvOrder === o.id ? 'Cancel' : 'Receive'}</button>}
                  <button className="logout-button" onClick={() => toggleView(o)}>{viewLines[o.id] ? 'Hide' : 'Lines'}</button>
                  {(o.status === 'ordered' || o.status === 'partial') && <button className="logout-button" onClick={async () => { if (confirm('Cancel this PO?')) { await cancelSupplyOrder(org.selectedOrg, o.id); load() } }}>Void</button>}
                </td>
                <td><strong>{o.po_number || '—'}</strong></td>
                <td style={{ color: 'var(--mist)' }}>{o.vendor || '—'}</td>
                <td>{statusPill(o.status)}</td>
                <td style={{ color: 'var(--mist)' }}>{o.order_date}</td>
                <td style={{ color: 'var(--mist)' }}>{o.expected_date || '—'}</td>
                <td>{money(o.amount)}</td>
              </tr>

              {viewLines[o.id] && (
                <tr><td colSpan="7" style={{ background: '#F7F9FC' }}>
                  <table style={{ width: '100%' }}><thead><tr style={{ textAlign: 'left', color: 'var(--mist)', fontSize: 12 }}><th>Item</th><th>Ordered</th><th>Received</th><th>Unit cost</th></tr></thead>
                    <tbody>
                      {viewLines[o.id].map((l) => (
                        <tr key={l.id} style={{ fontSize: 13 }}><td>{l.item_name}</td><td>{l.quantity} {l.unit || ''}</td><td>{l.received_count || 0}</td><td>{money(l.unit_cost)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </td></tr>
              )}

              {recvOrder === o.id && (
                <tr><td colSpan="7" style={{ background: '#F0F9F4' }}>
                  <div style={{ padding: '8px 2px' }}>
                    <div style={{ fontWeight: 700, color: '#0B7A3B', marginBottom: 8 }}>Receive {o.po_number} — enter what came in</div>
                    <table style={{ width: '100%', marginBottom: 10 }}>
                      <thead><tr style={{ textAlign: 'left', color: 'var(--mist)', fontSize: 12 }}><th>Item</th><th>Ordered</th><th>Already in</th><th>Receiving now</th></tr></thead>
                      <tbody>
                        {recvLines.map((l) => {
                          const remaining = (Number(l.quantity) || 0) - (Number(l.received_count) || 0)
                          return (
                            <tr key={l.id} style={{ fontSize: 13 }}>
                              <td>{l.item_name}</td>
                              <td>{l.quantity} {l.unit || ''}</td>
                              <td>{l.received_count || 0}</td>
                              <td><input type="number" step="any" min="0" max={remaining} value={recvQty[l.id] ?? ''} onChange={(e) => setRecvQty({ ...recvQty, [l.id]: e.target.value })} style={{ width: 80 }} /></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={busy} onClick={() => submitReceive(o)}>{busy ? 'Receiving…' : 'Receive & log spend'}</button>
                    <button className="logout-button" style={{ marginLeft: 8 }} onClick={() => setRecvOrder(null)}>Cancel</button>
                    <div style={{ fontSize: 12, color: 'var(--mist)', marginTop: 8 }}>Receiving part of the order marks it partially received; you can receive the rest later.</div>
                  </div>
                </td></tr>
              )}
            </Fragment>
          ))}
          {orders.length === 0 && <tr><td colSpan="7" style={{ color: 'var(--mist)' }}>{loading ? 'Loading…' : 'No open POs. Raise one with “+ New PO”, or pull items straight from the reorder list.'}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
