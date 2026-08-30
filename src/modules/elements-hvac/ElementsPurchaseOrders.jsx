// Elements-HVAC · Purchase Orders — draft a PO to a vendor (seeded from the
// Replenishment shortfalls if you like), mark it ordered, then receive against
// it. Receiving flows through the same ledger as manual receiving, so on-hand
// and costs update the moment goods land.
import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  listPurchaseOrders, getPurchaseOrder, createPurchaseOrder, updatePurchaseOrder,
  deletePOLine, receivePO, adjustReceived, listVendors, listAllLocations, listItems, listReplenishment,
  getPoSettings, setPoNextNumber, addItem, deriveSku, deletePurchaseOrder,
} from './data'
import { useOrgSelector, OrgBar } from './shared'

const money = (n) => (n == null || n === '' || isNaN(n) ? '—' : `$${Number(n).toFixed(2)}`)
const costOf = (it) => (it ? (it.last_cost ?? it.standard_cost ?? null) : null)
const STATUS = {
  draft: { t: 'Draft', bg: '#EEF1F6', c: '#475569' },
  ordered: { t: 'Ordered', bg: '#EEF3FB', c: '#1B3A6B' },
  partial: { t: 'Partial', bg: '#F8EEDD', c: '#B0600A' },
  received: { t: 'Received', bg: '#E3F1E8', c: '#166534' },
  cancelled: { t: 'Cancelled', bg: '#FBE7E7', c: '#B00020' },
}
const pill = (s) => { const m = STATUS[s] || STATUS.draft; return <span className="badge" style={{ background: m.bg, color: m.c }}>{m.t}</span> }

export default function ElementsPurchaseOrders({ profile }) {
  const org = useOrgSelector(profile)
  const [sp] = useSearchParams()
  const [pos, setPos] = useState([])
  const [vendors, setVendors] = useState([])
  const [locations, setLocations] = useState([])
  const [items, setItems] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [mode, setMode] = useState('view')     // view | new
  const [statusFilter, setStatusFilter] = useState('relevant')
  const [search, setSearch] = useState('')
  const [po, setPo] = useState(null)           // loaded detail
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  // new-PO form
  const blankNew = { vendor_id: '', location_id: '', expected_at: '', notes: '', job_name: '' }
  const [np, setNp] = useState(blankNew)
  const [npLines, setNpLines] = useState([])   // [{item_id,name,category,qty,cost}]
  const [addTerm, setAddTerm] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const addRef = useRef(null)

  // PO-number settings (the next number the counter will assign)
  const [poSettings, setPoSettings] = useState({ next_number: 1001, prefix: 'PO-' })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [startInput, setStartInput] = useState('')
  const nextPoLabel = `${poSettings.prefix || 'PO-'}${poSettings.next_number}`

  // receive inputs on detail: line_id -> {qty,cost}
  const [recv, setRecv] = useState({})
  // edit-received mode: line_id -> corrected total received
  const [editRecv, setEditRecv] = useState(false)
  const [adj, setAdj] = useState({})

  async function loadList() {
    if (!org.selectedOrg) return
    const [p, v, locs, its, settings] = await Promise.all([
      listPurchaseOrders(org.selectedOrg), listVendors(org.selectedOrg),
      listAllLocations(org.selectedOrg), listItems(org.selectedOrg), getPoSettings(org.selectedOrg),
    ])
    setPos(p); setVendors(v); setLocations(locs); setItems(its); setPoSettings(settings)
  }
  useEffect(() => { loadList() }, [org.selectedOrg])

  // Deep link from the dashboard: /elements/purchasing?po=<id> opens that PO.
  useEffect(() => {
    const id = sp.get('po')
    if (id && org.selectedOrg) openPO(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp, org.selectedOrg])

  async function openPO(id) {
    setMode('view'); setSelectedId(id); setMsg(''); setErr(''); setRecv({}); setEditRecv(false); setAdj({})
    const detail = await getPurchaseOrder(org.selectedOrg, id)
    setPo(detail)
    // default receive inputs = remaining qty, line cost or item cost
    const r = {}
    ;(detail?.lines || []).forEach((l) => {
      const remaining = Math.max(0, Number(l.qty_ordered || 0) - Number(l.qty_received || 0))
      r[l.id] = { qty: remaining > 0 ? String(remaining) : '', cost: l.unit_cost != null ? String(l.unit_cost) : (costOf(l.item) != null ? String(costOf(l.item)) : '') }
    })
    setRecv(r)
  }

  useEffect(() => {
    function onDoc(e) { if (addRef.current && !addRef.current.contains(e.target)) setAddOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  // "Relevant" = the everyday view: in-flight POs plus receipts from the last
  // 30 days. Cancelled and older received POs stay out until you pick their
  // filter, so the list doesn't grow unwieldy over time. Search always runs
  // WITHIN the chosen filter — to dig up an old receipt, switch to Received.
  const RECEIPT_WINDOW_DAYS = 30
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    const cutoff = Date.now() - RECEIPT_WINDOW_DAYS * 24 * 60 * 60 * 1000
    const recentlyReceived = (p) => {
      const d = p.received_at || p.created_at
      return d ? new Date(d).getTime() >= cutoff : false
    }
    const inFilter = (p) => {
      switch (statusFilter) {
        case 'relevant':
          if (p.status === 'cancelled') return false
          if (p.status === 'received') return recentlyReceived(p)
          return true // draft / ordered / partial
        case 'open':
          return p.status !== 'received' && p.status !== 'cancelled'
        case 'all':
          return true
        default:
          return p.status === statusFilter
      }
    }
    return pos.filter((p) => {
      if (!inFilter(p)) return false
      if (term) return `${p.po_number || ''} ${p.job_name || ''} ${p.vendor?.name || ''} ${p.location?.name || ''} ${p.partsText || ''}`.toLowerCase().includes(term)
      return true
    })
  }, [pos, statusFilter, search])

  // ---- new PO ----
  function startNew() {
    setMode('new'); setSelectedId(''); setPo(null); setMsg(''); setErr('')
    setNp({ ...blankNew, location_id: locations.find((l) => l.type === 'warehouse')?.id || locations[0]?.id || '' })
    setNpLines([]); setAddTerm('')
  }
  const inLines = useMemo(() => new Set(npLines.map((l) => l.item_id)), [npLines])
  const matches = useMemo(() => {
    const t = addTerm.trim().toLowerCase()
    return items.filter((it) => !inLines.has(it.id))
      .filter((it) => !t || `${it.description || ''} ${it.sku || ''} ${it.category || ''}`.toLowerCase().includes(t))
      .slice(0, 20)
  }, [items, addTerm, inLines])
  function addLine(it) {
    setNpLines((ls) => [...ls, { item_id: it.id, name: it.description || it.sku, category: it.category || '', qty: '1', cost: costOf(it) != null ? String(costOf(it)) : '' }])
    setAddTerm(''); setAddOpen(false)
  }
  // Add a specialty part that isn't in the catalog yet. It's created as a real
  // (receivable, reusable) item when the PO is saved.
  function addNewLine() {
    const name = addTerm.trim()
    if (!name) return
    setNpLines((ls) => [...ls, { item_id: null, isNew: true, _k: `new-${Date.now()}-${ls.length}`, name, category: '', qty: '1', cost: '', stock_type: 'special_order' }])
    setAddTerm(''); setAddOpen(false)
  }
  const exactMatch = useMemo(() => {
    const t = addTerm.trim().toLowerCase()
    return !!t && items.some((it) => (it.description || '').toLowerCase() === t)
  }, [items, addTerm])
  function setLine(idx, k, v) { setNpLines((ls) => ls.map((l, i) => (i === idx ? { ...l, [k]: v } : l))) }
  function rmLine(idx) { setNpLines((ls) => ls.filter((_, i) => i !== idx)) }

  async function pullLowItems() {
    if (!np.location_id) { setErr('Pick a deliver-to location first.'); return }
    setErr('')
    const rep = await listReplenishment(org.selectedOrg)
    const forLoc = rep.filter((r) => r.location_id === np.location_id)
    if (!forLoc.length) { setMsg('No items are below reorder at that location.'); return }
    setNpLines((ls) => {
      const have = new Set(ls.map((l) => l.item_id))
      const add = forLoc.filter((r) => !have.has(r.item_id)).map((r) => ({
        item_id: r.item_id, name: r.item?.description || '(part)', category: r.item?.category || '',
        qty: String(r.suggest || 0), cost: costOf(r.item) != null ? String(costOf(r.item)) : '',
      }))
      return [...ls, ...add]
    })
    setMsg(`Pulled ${forLoc.length} low item${forLoc.length === 1 ? '' : 's'} into the order.`)
  }

  const npTotal = useMemo(() => npLines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.cost) || 0), 0), [npLines])

  async function saveNew() {
    if (!np.vendor_id) { setErr('Pick a vendor.'); return }
    const lines = npLines.filter((l) => (Number(l.qty) || 0) > 0)
    if (!lines.length) { setErr('Add at least one line with a quantity.'); return }
    setBusy(true); setErr(''); setMsg('')
    // Create any specialty parts that aren't in the catalog yet, so they become
    // real, receivable, reusable items before the PO line references them.
    const taken = new Set(items.map((i) => (i.sku || '').toLowerCase()))
    const resolved = []
    for (const l of lines) {
      if (l.isNew && !l.item_id) {
        const sku = deriveSku(l.name, taken); taken.add(sku.toLowerCase())
        const cost = (l.cost === '' || l.cost == null) ? null : Number(l.cost)
        const { data: item, error: ie } = await addItem(org.selectedOrg, {
          sku, description: l.name, item_class: 'part',
          stock_type: l.stock_type || 'special_order',
          standard_cost: (cost != null && !isNaN(cost)) ? cost : null,
        })
        if (ie) { setBusy(false); setErr(`Could not create part "${l.name}": ${ie.message}`); return }
        resolved.push({ ...l, item_id: item.id })
      } else {
        resolved.push(l)
      }
    }
    const { po: created, error } = await createPurchaseOrder(org.selectedOrg, {
      vendor_id: np.vendor_id, location_id: np.location_id, expected_at: np.expected_at || null,
      notes: np.notes, job_name: np.job_name,
      lines: resolved.map((l) => ({ item_id: l.item_id, qty_ordered: l.qty, unit_cost: l.cost })),
    })
    setBusy(false)
    if (error) { setErr(error.message); return }
    await loadList()
    openPO(created.id)
  }

  // ---- PO number settings ----
  function openSettings() {
    setStartInput(String(poSettings.next_number)); setSettingsOpen(true); setMsg(''); setErr('')
  }
  async function saveSettings() {
    const n = parseInt(startInput, 10)
    if (!n || n < 1) { setErr('Enter a whole number of 1 or more.'); return }
    setBusy(true); setErr(''); setMsg('')
    const { error } = await setPoNextNumber(org.selectedOrg, n)
    setBusy(false)
    if (error) { setErr(error.message); return }
    setSettingsOpen(false)
    setPoSettings((s) => ({ ...s, next_number: n }))
    setMsg(`Next PO number set to ${poSettings.prefix || 'PO-'}${n}.`)
  }

  // ---- detail actions ----
  async function markOrdered() {
    setBusy(true)
    await updatePurchaseOrder(org.selectedOrg, po.id, { status: 'ordered', ordered_at: new Date().toISOString() })
    setBusy(false); await loadList(); openPO(po.id)
  }
  async function cancelPO() {
    if (!window.confirm('Cancel this purchase order? Lines already received stay in stock; nothing is un-received.')) return
    setBusy(true)
    await updatePurchaseOrder(org.selectedOrg, po.id, { status: 'cancelled' })
    setBusy(false); await loadList(); openPO(po.id)
  }
  async function deleteDraft() {
    if (!window.confirm('Delete this draft purchase order? It will be removed entirely — this cannot be undone.')) return
    setBusy(true); setErr(''); setMsg('')
    const { error } = await deletePurchaseOrder(org.selectedOrg, po.id)
    setBusy(false)
    if (error) { setErr(error.message); return }
    setPo(null); setSelectedId(''); setMode('view'); setMsg('Draft deleted.')
    await loadList()
  }
  async function removeLine(lineId) {
    setBusy(true); await deletePOLine(lineId); setBusy(false); openPO(po.id)
  }
  async function doReceive() {
    const receipts = (po.lines || []).map((l) => ({ line_id: l.id, item_id: l.item_id, qty: recv[l.id]?.qty, unit_cost: recv[l.id]?.cost }))
      .filter((r) => (Number(r.qty) || 0) > 0)
    if (!receipts.length) { setErr('Enter a quantity to receive on at least one line.'); return }
    setBusy(true); setErr(''); setMsg('')
    const { error, count } = await receivePO(org.selectedOrg, po.id, receipts)
    setBusy(false)
    if (error) { setErr(error.message); return }
    setMsg(`Received ${count} line${count === 1 ? '' : 's'} into ${po.location?.name || 'stock'}.`)
    await loadList(); openPO(po.id)
  }

  function startEditRecv() {
    const a = {}
    ;(po.lines || []).forEach((l) => { a[l.id] = String(Number(l.qty_received || 0)) })
    setAdj(a); setEditRecv(true); setMsg(''); setErr('')
  }
  async function saveAdjust() {
    const adjustments = (po.lines || []).map((l) => ({ line_id: l.id, item_id: l.item_id, new_received: adj[l.id] }))
    setBusy(true); setErr(''); setMsg('')
    const { error, count } = await adjustReceived(org.selectedOrg, po.id, adjustments)
    setBusy(false)
    if (error) { setErr(error.message); return }
    setEditRecv(false)
    setMsg(count ? `Corrected received on ${count} line${count === 1 ? '' : 's'}. Stock adjusted by the difference.` : 'No changes to received quantities.')
    await loadList(); openPO(po.id)
  }

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Purchase Orders</h2>
          <span className="badge">{pos.filter((p) => p.status !== 'received' && p.status !== 'cancelled').length} open</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="logout-button" onClick={openSettings} title="Set the next PO number">⚙ Numbering</button>
          <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={startNew}>+ New PO</button>
        </div>
      </div>
      <OrgBar {...org} />

      {settingsOpen && (
        <div style={{ border: '1px solid #CBD5E1', borderRadius: 12, padding: 16, marginBottom: 14, background: '#F8FAFC', maxWidth: 520 }}>
          <div style={{ fontWeight: 700, color: '#132A4C', marginBottom: 6 }}>PO numbering</div>
          <p style={{ color: 'var(--mist)', fontSize: 12.5, marginTop: 0, marginBottom: 10 }}>
            POs are numbered automatically in sequence. The next one will be <strong>{nextPoLabel}</strong>.
            If you're carrying over history from another system, set the next number so your sequence continues where it left off.
          </p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="field" style={{ marginBottom: 0, width: 160 }}><label>Next number</label>
              <input type="number" min="1" step="1" value={startInput} onChange={(e) => setStartInput(e.target.value)} />
            </div>
            <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={busy} onClick={saveSettings}>{busy ? 'Saving…' : 'Save'}</button>
            <button className="logout-button" disabled={busy} onClick={() => setSettingsOpen(false)}>Cancel</button>
          </div>
        </div>
      )}

      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0 }}>
        Order parts from a vendor, then receive them in as they arrive. Start a PO from scratch or pull in whatever's
        below reorder for a location. Receiving updates on-hand and part costs automatically.
      </p>

      {msg && <div style={{ marginBottom: 12, background: '#E3F1E8', border: '1px solid #166534', color: '#166534', padding: '8px 12px', borderRadius: 8, fontWeight: 600, fontSize: 13 }}>{msg}</div>}
      {err && <div className="auth-error" style={{ marginBottom: 12 }}>{err}</div>}

      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* LEFT — PO list */}
        <div style={{ flex: '1 1 320px', minWidth: 280, maxWidth: 420 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 140 }}><label>Search</label>
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search — number, name, vendor, or part…" />
            </div>
            <div className="field" style={{ marginBottom: 0 }}><label>Show</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="relevant">Relevant</option>
                <option value="open">Open (awaiting receipt)</option>
                <option value="draft">Draft</option>
                <option value="ordered">Ordered</option>
                <option value="partial">Partial</option>
                <option value="received">Received (all)</option>
                <option value="cancelled">Cancelled</option>
                <option value="all">Everything</option>
              </select>
            </div>
          </div>
          <div style={{ border: '1px solid var(--line, #E2E8F0)', borderRadius: 10, overflow: 'hidden', maxHeight: 620, overflowY: 'auto' }}>
            {rows.map((p) => {
              const active = p.id === selectedId
              return (
                <div key={p.id} onClick={() => openPO(p.id)}
                  style={{ padding: '10px 13px', cursor: 'pointer', borderBottom: '1px solid #EEF1F6', background: active ? '#EEF3FB' : '#fff', borderLeft: active ? '3px solid #1B3A6B' : '3px solid transparent' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                    <div style={{ fontWeight: 600, color: '#132A4C' }}>
                      {p.po_number || '(no #)'}
                      {p.job_name ? <span style={{ fontWeight: 400, color: '#1B3A6B' }}> · {p.job_name}</span> : null}
                    </div>
                    {pill(p.status)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--mist)' }}>
                    {p.vendor?.name || 'No vendor'}{p.location?.name ? ` → ${p.location.name}` : ''} · {p.received}/{p.ordered} rcvd{p.value ? ` · ${money(p.value)}` : ''}
                  </div>
                </div>
              )
            })}
            {rows.length === 0 && <div style={{ padding: 16, color: 'var(--mist)' }}>{search.trim() ? 'No matches in this view. Try the "Received (all)" or "Everything" filter for older or cancelled POs.' : 'No purchase orders for this filter.'}</div>}
          </div>
        </div>

        {/* RIGHT — new or detail */}
        <div style={{ flex: '2 1 460px', minWidth: 320 }}>
          {mode === 'new' ? (
            <div style={{ border: '1px solid var(--line, #E2E8F0)', borderRadius: 12, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#132A4C' }}>New purchase order</div>
                <div style={{ fontSize: 12.5, color: 'var(--mist)' }}>Will be numbered <strong style={{ color: '#1B3A6B' }}>{nextPoLabel}</strong></div>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div className="field" style={{ minWidth: 200, flex: 1 }}><label>Vendor</label>
                  <select value={np.vendor_id} onChange={(e) => setNp({ ...np, vendor_id: e.target.value })}>
                    <option value="">— pick vendor —</option>
                    {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div className="field" style={{ minWidth: 180, flex: 1 }}><label>Deliver to</label>
                  <select value={np.location_id} onChange={(e) => setNp({ ...np, location_id: e.target.value })}>
                    <option value="">— location —</option>
                    {locations.map((l) => <option key={l.id} value={l.id}>{l.name}{l.type === 'truck' ? ' (truck)' : ''}</option>)}
                  </select>
                </div>
                <div className="field" style={{ width: 150 }}><label>Expected</label>
                  <input type="date" value={np.expected_at} onChange={(e) => setNp({ ...np, expected_at: e.target.value })} />
                </div>
              </div>
              <div className="field" style={{ marginTop: 4 }}><label>Job / customer name (optional)</label>
                <input type="text" value={np.job_name} onChange={(e) => setNp({ ...np, job_name: e.target.value })} placeholder="e.g. Smith install, Building B rooftop units…" />
              </div>
              <div className="field" style={{ marginTop: 4 }}><label>Notes (optional)</label>
                <input type="text" value={np.notes} onChange={(e) => setNp({ ...np, notes: e.target.value })} placeholder="Anything the vendor should know…" />
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', margin: '10px 0', flexWrap: 'wrap' }}>
                <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 220, position: 'relative' }} ref={addRef}>
                  <label>Add a part</label>
                  <input type="text" value={addTerm} onChange={(e) => { setAddTerm(e.target.value); setAddOpen(true) }} onFocus={() => setAddOpen(true)} placeholder="Search your catalog, or type a new part…" autoComplete="off" />
                  {addOpen && (matches.length > 0 || addTerm.trim()) && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, background: '#fff', border: '1px solid #CBD5E1', borderRadius: 8, marginTop: 4, maxHeight: 240, overflowY: 'auto', boxShadow: '0 6px 20px rgba(0,0,0,0.10)' }}>
                      {matches.map((it) => (
                        <div key={it.id} onMouseDown={() => addLine(it)} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#EEF3FB')} onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}>
                          <div style={{ fontWeight: 600, color: '#132A4C' }}>{it.description || it.sku}</div>
                          <div style={{ fontSize: 12, color: 'var(--mist)' }}>{it.category || '—'}{costOf(it) != null ? ` · ${money(costOf(it))}` : ''}</div>
                        </div>
                      ))}
                      {addTerm.trim() && !exactMatch && (
                        <div onMouseDown={addNewLine} style={{ padding: '8px 12px', cursor: 'pointer', borderTop: matches.length ? '1px solid #E2E8F0' : 'none', background: '#F8FAFC' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#EEF3FB')} onMouseLeave={(e) => (e.currentTarget.style.background = '#F8FAFC')}>
                          <div style={{ fontWeight: 700, color: '#1B3A6B' }}>+ Create “{addTerm.trim()}”</div>
                          <div style={{ fontSize: 12, color: 'var(--mist)' }}>Add a specialty part that isn't in your catalog yet</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button className="logout-button" onClick={pullLowItems} title="Add everything below reorder at the deliver-to location">Pull low items</button>
              </div>

              <table className="data-table">
                <thead><tr><th>Part</th><th style={{ textAlign: 'right', width: 80 }}>Qty</th><th style={{ textAlign: 'right', width: 90 }}>Unit cost</th><th style={{ textAlign: 'right', width: 90 }}>Line</th><th style={{ width: 60 }}></th></tr></thead>
                <tbody>
                  {npLines.map((l, idx) => (
                    <tr key={l.item_id || l._k}>
                      <td>{l.name}{l.category ? <span style={{ color: 'var(--mist)', fontSize: 12 }}> · {l.category}</span> : null}
                        {l.isNew ? (
                          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="badge" style={{ background: '#E3F1E8', color: '#166534' }}>New part</span>
                            <select value={l.stock_type} onChange={(e) => setLine(idx, 'stock_type', e.target.value)} style={{ fontSize: 12, padding: '1px 4px' }}>
                              <option value="special_order">Special order</option>
                              <option value="stock">Stock</option>
                            </select>
                          </div>
                        ) : null}</td>
                      <td style={{ textAlign: 'right' }}><input type="number" min="0" step="any" value={l.qty} onChange={(e) => setLine(idx, 'qty', e.target.value)} style={{ width: 64, textAlign: 'right' }} /></td>
                      <td style={{ textAlign: 'right' }}><input type="number" min="0" step="any" value={l.cost} onChange={(e) => setLine(idx, 'cost', e.target.value)} style={{ width: 78, textAlign: 'right' }} placeholder="$" /></td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{money((Number(l.qty) || 0) * (Number(l.cost) || 0))}</td>
                      <td style={{ textAlign: 'right' }}><button className="logout-button" onClick={() => rmLine(idx)}>✕</button></td>
                    </tr>
                  ))}
                  {npLines.length === 0 && <tr><td colSpan="5" style={{ color: 'var(--mist)' }}>No lines yet. Search a part or pull the low items.</td></tr>}
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1B3A6B' }}>Order total {money(npTotal)}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="logout-button" onClick={() => { setMode('view') }}>Cancel</button>
                  <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={busy} onClick={saveNew}>{busy ? 'Saving…' : 'Save draft'}</button>
                </div>
              </div>
            </div>
          ) : !po ? (
            <div style={{ border: '1px dashed #CBD5E1', borderRadius: 12, padding: '48px 24px', textAlign: 'center', color: 'var(--mist)' }}>
              Select a purchase order, or start a new one.
            </div>
          ) : (
            <div style={{ border: '1px solid var(--line, #E2E8F0)', borderRadius: 12, padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#132A4C', display: 'flex', gap: 10, alignItems: 'center' }}>{po.po_number || '(no #)'} {pill(po.status)}</div>
                  {po.job_name && <div style={{ fontSize: 14, fontWeight: 600, color: '#1B3A6B', marginTop: 2 }}>{po.job_name}</div>}
                  <div style={{ fontSize: 13, color: 'var(--mist)', marginTop: 2 }}>
                    {po.vendor?.name || 'No vendor'} → {po.location?.name || 'no location'}{po.expected_at ? ` · expected ${new Date(po.expected_at).toLocaleDateString()}` : ''}
                  </div>
                  {po.notes && <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>{po.notes}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {po.status === 'draft' && <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={busy} onClick={markOrdered}>Mark ordered</button>}
                  {(po.status === 'ordered' || po.status === 'partial' || po.status === 'received') && !editRecv && <button className="logout-button" disabled={busy} onClick={startEditRecv}>Edit received</button>}
                  {(po.status === 'ordered' || po.status === 'partial') && !editRecv && <button className="logout-button" disabled={busy} onClick={cancelPO}>Cancel PO</button>}
                  {po.status === 'draft' && !editRecv && <button className="logout-button" style={{ color: '#B00020', borderColor: '#F0B4B4' }} disabled={busy} onClick={deleteDraft}>Delete draft</button>}
                </div>
              </div>

              <table className="data-table" style={{ marginTop: 14 }}>
                <thead>
                  <tr>
                    <th>Part</th>
                    <th style={{ textAlign: 'right', width: 70 }}>Ordered</th>
                    <th style={{ textAlign: 'right', width: 70 }}>Received</th>
                    <th style={{ textAlign: 'right', width: 90 }}>Receive now</th>
                    <th style={{ textAlign: 'right', width: 90 }}>Unit cost</th>
                    {po.status === 'draft' && <th style={{ width: 50 }}></th>}
                  </tr>
                </thead>
                <tbody>
                  {(po.lines || []).map((l) => {
                    const remaining = Math.max(0, Number(l.qty_ordered || 0) - Number(l.qty_received || 0))
                    const full = remaining <= 0
                    const canReceive = (po.status === 'ordered' || po.status === 'partial') && !editRecv
                    return (
                      <tr key={l.id}>
                        <td>{l.item?.description || l.description || '(part)'}{l.item?.category ? <span style={{ color: 'var(--mist)', fontSize: 12 }}> · {l.item.category}</span> : null}</td>
                        <td style={{ textAlign: 'right' }}>{Number(l.qty_ordered || 0)}</td>
                        <td style={{ textAlign: 'right' }}>
                          {editRecv ? (
                            <input type="number" min="0" step="any" value={adj[l.id] ?? ''} style={{ width: 70, textAlign: 'right' }}
                              onChange={(e) => setAdj((s) => ({ ...s, [l.id]: e.target.value }))} />
                          ) : (
                            <span style={{ color: full ? '#166534' : 'var(--mist)', fontWeight: full ? 600 : 400 }}>{Number(l.qty_received || 0)}</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {canReceive && !full ? (
                            <input type="number" min="0" step="any" value={recv[l.id]?.qty ?? ''} style={{ width: 70, textAlign: 'right' }}
                              onChange={(e) => setRecv((s) => ({ ...s, [l.id]: { ...s[l.id], qty: e.target.value } }))} />
                          ) : <span style={{ color: 'var(--mist)' }}>{full ? '✓' : '—'}</span>}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {canReceive && !full ? (
                            <input type="number" min="0" step="any" value={recv[l.id]?.cost ?? ''} style={{ width: 78, textAlign: 'right' }} placeholder="$"
                              onChange={(e) => setRecv((s) => ({ ...s, [l.id]: { ...s[l.id], cost: e.target.value } }))} />
                          ) : <span style={{ color: 'var(--mist)' }}>{money(l.unit_cost)}</span>}
                        </td>
                        {po.status === 'draft' && <td style={{ textAlign: 'right' }}><button className="logout-button" disabled={busy} onClick={() => removeLine(l.id)}>✕</button></td>}
                      </tr>
                    )
                  })}
                  {(po.lines || []).length === 0 && <tr><td colSpan="6" style={{ color: 'var(--mist)' }}>No lines on this PO.</td></tr>}
                </tbody>
              </table>

              {editRecv ? (
                <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12.5, color: 'var(--mist)' }}>Correcting a received number adjusts stock by the difference — lowering it backs stock out.</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="logout-button" disabled={busy} onClick={() => { setEditRecv(false); setErr('') }}>Cancel</button>
                    <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={busy} onClick={saveAdjust}>{busy ? 'Saving…' : 'Save received'}</button>
                  </div>
                </div>
              ) : (po.status === 'ordered' || po.status === 'partial') ? (
                <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={busy} onClick={doReceive}>{busy ? 'Receiving…' : 'Receive entered quantities'}</button>
                </div>
              ) : null}
              {po.status === 'draft' && (
                <p style={{ color: 'var(--mist)', fontSize: 12.5, marginTop: 12 }}>This PO is still a draft. Press <strong>Mark ordered</strong> once it's placed with the vendor, then you can receive against it as parts arrive.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
