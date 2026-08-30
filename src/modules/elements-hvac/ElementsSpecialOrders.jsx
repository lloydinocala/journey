// Elements-HVAC · P5b · Special Orders
// A tracking board for per-job parts that aren't stocked, so nothing ordered for
// a customer gets lost. Lifecycle: requested -> ordered -> received -> ready ->
// closed. Decoupled from stock — these go straight to the job, not into on-hand.
import { useState, useEffect, useMemo, useRef } from 'react'
import {
  listSpecialOrders, createSpecialOrder, updateSpecialOrder, setSpecialOrderStatus,
  deleteSpecialOrder, searchCustomers, listVendors, listItems,
} from './data'
import { useOrgSelector, OrgBar } from './shared'

const money = (n) => (n == null || n === '' || isNaN(n) ? '—' : `$${Number(n).toFixed(2)}`)
const fmtDate = (d) => (d ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? d + 'T12:00:00' : d).toLocaleDateString() : '')
const STATUS = {
  requested: { t: 'Requested', bg: '#EEF1F6', c: '#475569' },
  ordered: { t: 'Ordered', bg: '#E7EEFB', c: '#1B3A6B' },
  received: { t: 'Received', bg: '#EAF3FB', c: '#0E6FB8' },
  ready: { t: 'Ready', bg: '#F8EEDD', c: '#B0600A' },
  closed: { t: 'Closed', bg: '#E3F1E8', c: '#166534' },
  cancelled: { t: 'Cancelled', bg: '#FBE7E7', c: '#B00020' },
}
const NEXT = { requested: 'ordered', ordered: 'received', received: 'ready', ready: 'closed' }
const NEXT_LABEL = { requested: 'Mark ordered', ordered: 'Mark received', received: 'Mark ready', ready: 'Close (installed / picked up)' }
const badge = (k) => { const m = STATUS[k] || STATUS.requested; return <span className="badge" style={{ background: m.bg, color: m.c }}>{m.t}</span> }
const blankForm = () => ({ customer_id: null, customer_name: '', job_ref: '', item_id: '', description: '', quantity: '1', unit_cost: '', vendor_id: '', vendor_name: '', po_ref: '', needed_by: '', notes: '' })

export default function ElementsSpecialOrders({ profile }) {
  const org = useOrgSelector(profile)
  const [orders, setOrders] = useState([])
  const [vendors, setVendors] = useState([])
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState('active')
  const [selectedId, setSelectedId] = useState('')
  const [mode, setMode] = useState('none')       // none | new | edit
  const [form, setForm] = useState(blankForm())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  // customer typeahead
  const [custResults, setCustResults] = useState([])
  const [custOpen, setCustOpen] = useState(false)
  const custTimer = useRef(null)

  async function loadAll() {
    if (!org.selectedOrg) return
    const [os, vs, its] = await Promise.all([
      listSpecialOrders(org.selectedOrg), listVendors(org.selectedOrg), listItems(org.selectedOrg),
    ])
    setOrders(os); setVendors(vs); setItems(its)
  }
  useEffect(() => { loadAll(); setSelectedId(''); setMode('none') }, [org.selectedOrg])

  const counts = useMemo(() => {
    const c = { active: 0, requested: 0, ordered: 0, received: 0, ready: 0, closed: 0, cancelled: 0 }
    orders.forEach((o) => { c[o.status] = (c[o.status] || 0) + 1; if (o.status !== 'closed' && o.status !== 'cancelled') c.active += 1 })
    return c
  }, [orders])

  const rows = useMemo(() => orders.filter((o) => {
    if (filter === 'all') return true
    if (filter === 'active') return o.status !== 'closed' && o.status !== 'cancelled'
    return o.status === filter
  }), [orders, filter])

  function startNew() { setMode('new'); setSelectedId(''); setForm(blankForm()); setMsg(''); setErr(''); setCustResults([]); setCustOpen(false) }
  function openEdit(o) {
    setSelectedId(o.id); setMode('edit'); setMsg(''); setErr(''); setCustOpen(false)
    setForm({
      customer_id: o.customer_id || null, customer_name: o.customer_label || '', job_ref: o.job_ref || '',
      item_id: o.item_id || '', description: o.description || '', quantity: o.quantity == null ? '1' : String(o.quantity),
      unit_cost: o.unit_cost == null ? '' : String(o.unit_cost), vendor_id: o.vendor_id || '', vendor_name: o.vendor_label || '',
      po_ref: o.po_ref || '', needed_by: o.needed_by || '', notes: o.notes || '', status: o.status,
    })
  }

  function setF(patch) { setForm((f) => ({ ...f, ...patch })) }

  function onCustInput(v) {
    setF({ customer_name: v, customer_id: null })
    if (custTimer.current) clearTimeout(custTimer.current)
    if (v.trim().length < 2) { setCustResults([]); setCustOpen(false); return }
    custTimer.current = setTimeout(async () => {
      const r = await searchCustomers(org.selectedOrg, v)
      setCustResults(r); setCustOpen(true)
    }, 220)
  }
  function pickCustomer(c) { setF({ customer_id: c.id, customer_name: c.name }); setCustResults([]); setCustOpen(false) }

  function onPickItem(itemId) {
    const it = items.find((i) => i.id === itemId)
    setF({ item_id: itemId, description: form.description || (it ? it.description : '') })
  }
  function onPickVendor(vId) {
    const v = vendors.find((x) => x.id === vId)
    setF({ vendor_id: vId, vendor_name: v ? v.name : '' })
  }

  async function save() {
    if (!form.description.trim()) { setErr('Describe the part being ordered.'); return }
    setBusy(true); setErr(''); setMsg('')
    if (mode === 'new') {
      const { data, error } = await createSpecialOrder(org.selectedOrg, { ...form, created_by: profile?.id })
      setBusy(false)
      if (error) { setErr(error.message); return }
      setMsg('Special order created.'); await loadAll(); openEdit({ ...data, customer_label: form.customer_name, vendor_label: form.vendor_name })
    } else {
      const { error } = await updateSpecialOrder(org.selectedOrg, selectedId, {
        customer_id: form.customer_id, customer_name: form.customer_name, job_ref: form.job_ref, item_id: form.item_id || null,
        description: form.description, quantity: form.quantity, unit_cost: form.unit_cost, vendor_id: form.vendor_id || null,
        vendor_name: form.vendor_name, po_ref: form.po_ref, needed_by: form.needed_by || null, notes: form.notes,
      })
      setBusy(false)
      if (error) { setErr(error.message); return }
      setMsg('Saved.'); await loadAll()
    }
  }

  async function advance(to) {
    setBusy(true); setErr('')
    const { error } = await setSpecialOrderStatus(org.selectedOrg, selectedId, to)
    setBusy(false)
    if (error) { setErr(error.message); return }
    setForm((f) => ({ ...f, status: to })); setMsg(`Moved to ${STATUS[to]?.t || to}.`); await loadAll()
  }
  async function remove() {
    if (!window.confirm('Delete this special order? This cannot be undone.')) return
    setBusy(true); await deleteSpecialOrder(org.selectedOrg, selectedId); setBusy(false)
    setMode('none'); setSelectedId(''); await loadAll()
  }

  const cur = form.status
  const overdue = (o) => o.needed_by && o.status !== 'closed' && o.status !== 'cancelled' && new Date(o.needed_by + 'T23:59:59') < new Date()

  const TABS = [['active', 'Active'], ['requested', 'Requested'], ['ordered', 'Ordered'], ['received', 'Received'], ['ready', 'Ready'], ['closed', 'Closed'], ['all', 'All']]

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Special Orders</h2>
          {counts.active > 0 && <span className="badge" style={{ background: '#E7EEFB', color: '#1B3A6B' }}>{counts.active} active</span>}
          {counts.ready > 0 && <span className="badge" style={{ background: '#F8EEDD', color: '#B0600A' }}>{counts.ready} ready</span>}
        </div>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={startNew}>+ New special order</button>
      </div>
      <OrgBar {...org} />

      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0, maxWidth: 780 }}>
        Parts you order for a specific customer or job that you don't keep in stock. Log it here so it never slips through the
        cracks — track it from requested through ordered, received, and ready for the tech to install or the customer to pick up.
      </p>

      {msg && <div style={{ marginBottom: 12, background: '#E3F1E8', border: '1px solid #166534', color: '#166534', padding: '8px 12px', borderRadius: 8, fontWeight: 600, fontSize: 13 }}>{msg}</div>}
      {err && <div className="auth-error" style={{ marginBottom: 12 }}>{err}</div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={filter === k ? 'auth-button' : 'logout-button'}
            style={{ width: 'auto', margin: 0, padding: '6px 12px', fontSize: 13 }}>
            {label}{k !== 'all' && counts[k] ? ` (${counts[k]})` : ''}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* LEFT — list */}
        <div style={{ flex: '1 1 320px', minWidth: 280, maxWidth: 440 }}>
          <div style={{ border: '1px solid var(--line, #E2E8F0)', borderRadius: 10, overflow: 'hidden', maxHeight: 680, overflowY: 'auto' }}>
            {rows.map((o) => {
              const active = o.id === selectedId
              return (
                <div key={o.id} onClick={() => openEdit(o)}
                  style={{ padding: '10px 13px', cursor: 'pointer', borderBottom: '1px solid #EEF1F6', background: active ? '#EEF3FB' : '#fff', borderLeft: active ? '3px solid #1B3A6B' : '3px solid transparent' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                    <div style={{ fontWeight: 600, color: '#132A4C' }}>{o.customer_label || 'No customer'}</div>
                    {badge(o.status)}
                  </div>
                  <div style={{ fontSize: 12.5, color: '#152238', marginTop: 1 }}>{o.quantity > 1 ? `${o.quantity}× ` : ''}{o.description}</div>
                  <div style={{ fontSize: 11, color: 'var(--mist)' }}>
                    {o.job_ref ? `${o.job_ref} · ` : ''}{o.vendor_label ? `${o.vendor_label} · ` : ''}{o.needed_by ? `need by ${fmtDate(o.needed_by)}` : `opened ${fmtDate(o.created_at)}`}
                    {overdue(o) ? <span style={{ color: '#B00020', fontWeight: 700 }}> · ⚠ overdue</span> : ''}
                  </div>
                </div>
              )
            })}
            {rows.length === 0 && <div style={{ padding: 16, color: 'var(--mist)' }}>No special orders in this view.</div>}
          </div>
        </div>

        {/* RIGHT — form / detail */}
        <div style={{ flex: '2 1 480px', minWidth: 320 }}>
          {mode === 'none' ? (
            <div style={{ border: '1px dashed #CBD5E1', borderRadius: 12, padding: '48px 24px', textAlign: 'center', color: 'var(--mist)' }}>
              Select a special order, or start a new one.
            </div>
          ) : (
            <div style={{ border: '1px solid var(--line, #E2E8F0)', borderRadius: 12, padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                <h3 style={{ margin: 0 }}>{mode === 'new' ? 'New special order' : 'Special order'} {mode === 'edit' && badge(cur)}</h3>
                {mode === 'edit' && cur !== 'closed' && cur !== 'cancelled' && NEXT[cur] && (
                  <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={busy} onClick={() => advance(NEXT[cur])}>{NEXT_LABEL[cur]}</button>
                )}
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div className="field" style={{ flex: '1 1 240px', marginBottom: 8, position: 'relative' }}>
                  <label>Customer</label>
                  <input value={form.customer_name} onChange={(e) => onCustInput(e.target.value)} onFocus={() => custResults.length && setCustOpen(true)} placeholder="Search customers, or type a name" autoComplete="off" />
                  {form.customer_id && <div style={{ fontSize: 11, color: '#166534', marginTop: 2 }}>✓ linked to customer record</div>}
                  {custOpen && custResults.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, background: '#fff', border: '1px solid #CBD5E1', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 220, overflowY: 'auto' }}>
                      {custResults.map((c) => (
                        <div key={c.id} onClick={() => pickCustomer(c)} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9', fontSize: 13 }}>{c.name}</div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="field" style={{ flex: '1 1 160px', marginBottom: 8 }}>
                  <label>Job / reference</label>
                  <input value={form.job_ref} onChange={(e) => setF({ job_ref: e.target.value })} placeholder="Job #, address, PO…" />
                </div>
              </div>

              <div className="field" style={{ marginBottom: 8 }}>
                <label>Part / description *</label>
                <input value={form.description} onChange={(e) => setF({ description: e.target.value })} placeholder="e.g. OEM Goodman condenser coil, 3 ton" />
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div className="field" style={{ flex: '1 1 220px', marginBottom: 8 }}>
                  <label>Link to catalog item (optional)</label>
                  <select value={form.item_id} onChange={(e) => onPickItem(e.target.value)}>
                    <option value="">— not in catalog —</option>
                    {items.map((i) => <option key={i.id} value={i.id}>{i.description}</option>)}
                  </select>
                </div>
                <div className="field" style={{ width: 90, marginBottom: 8 }}>
                  <label>Qty</label>
                  <input type="number" step="any" value={form.quantity} onChange={(e) => setF({ quantity: e.target.value })} />
                </div>
                <div className="field" style={{ width: 120, marginBottom: 8 }}>
                  <label>Est. unit cost</label>
                  <input type="number" step="any" value={form.unit_cost} onChange={(e) => setF({ unit_cost: e.target.value })} placeholder="$" />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div className="field" style={{ flex: '1 1 200px', marginBottom: 8 }}>
                  <label>Vendor</label>
                  <select value={form.vendor_id} onChange={(e) => onPickVendor(e.target.value)}>
                    <option value="">— none —</option>
                    {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div className="field" style={{ flex: '1 1 140px', marginBottom: 8 }}>
                  <label>PO # (reference)</label>
                  <input value={form.po_ref} onChange={(e) => setF({ po_ref: e.target.value })} placeholder="Vendor or internal PO" />
                </div>
                <div className="field" style={{ width: 150, marginBottom: 8 }}>
                  <label>Needed by</label>
                  <input type="date" value={form.needed_by} onChange={(e) => setF({ needed_by: e.target.value })} />
                </div>
              </div>

              <div className="field" style={{ marginBottom: 10 }}>
                <label>Notes</label>
                <textarea value={form.notes} onChange={(e) => setF({ notes: e.target.value })} rows={2} style={{ resize: 'vertical' }} />
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <button className="auth-button" style={{ width: 'auto', margin: 0, padding: '10px 22px' }} disabled={busy} onClick={save}>{busy ? 'Saving…' : (mode === 'new' ? 'Create special order' : 'Save changes')}</button>
                {mode === 'edit' && cur !== 'cancelled' && cur !== 'closed' && (
                  <button className="logout-button" disabled={busy} onClick={() => advance('cancelled')}>Cancel order</button>
                )}
                {mode === 'edit' && (cur === 'cancelled' || cur === 'closed') && (
                  <button className="logout-button" disabled={busy} onClick={() => advance('requested')}>Reopen</button>
                )}
                {mode === 'edit' && <button className="logout-button" style={{ color: '#B00020', borderColor: '#F0B4B4' }} disabled={busy} onClick={remove}>Delete</button>}
              </div>

              {mode === 'edit' && (
                <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--mist)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  {form.status && <span>Opened {fmtDate(orders.find((o) => o.id === selectedId)?.created_at)}</span>}
                  {orders.find((o) => o.id === selectedId)?.ordered_at && <span>Ordered {fmtDate(orders.find((o) => o.id === selectedId).ordered_at)}</span>}
                  {orders.find((o) => o.id === selectedId)?.received_at && <span>Received {fmtDate(orders.find((o) => o.id === selectedId).received_at)}</span>}
                  {orders.find((o) => o.id === selectedId)?.ready_at && <span>Ready {fmtDate(orders.find((o) => o.id === selectedId).ready_at)}</span>}
                  {orders.find((o) => o.id === selectedId)?.closed_at && <span>Closed {fmtDate(orders.find((o) => o.id === selectedId).closed_at)}</span>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
