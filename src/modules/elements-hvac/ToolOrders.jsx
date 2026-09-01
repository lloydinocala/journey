// Tools Management · Orders & Receipts (acquisitions)
// Three ways tools enter the fleet:
//   • New PO order  — place a custom order with a vendor; it gets the next PO number
//     from the SAME sequence as parts POs, and the tools are created when received.
//   • Read a receipt — Quincy reads a receipt (PDF/photo) for an already-bought lot
//     (hardware-store card run, etc.) and turns line items into tools now.
//   • Enter manually — record an already-bought card purchase or a rental by hand.
import { useState, useEffect } from 'react'
import {
  listAcquisitions, extractToolReceipt, createAcquisitionWithTools, returnRental,
  createToolOrder, listToolOrderLines, receiveToolOrder,
} from './toolsData'
import { useOrgSelector, OrgBar } from './shared'

const today = () => new Date().toISOString().slice(0, 10)
const money = (n) => (n == null || n === '' || isNaN(n) ? '—' : `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
const num = (x) => { if (x == null || x === '') return null; const n = parseFloat(String(x).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? null : n }
const normDate = (s) => { if (!s) return null; if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; const d = new Date(s); return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10) }
const blankAcq = { acquisition_type: 'card', vendor: '', po_number: '', acquired_date: today(), amount: '', card_last4: '', card_label: '', rental_return_due: '', rental_rate: '' }
const blankItem = () => ({ name: '', brand: '', is_hand_tool: false, cost: '', track: true })
const blankLine = () => ({ name: '', brand: '', model_no: '', serial_no: '', is_hand_tool: false, quantity: '1', unit_cost: '' })
const TYPE_LABEL = { po: 'PO order', card: 'Card purchase', rental: 'Rental' }
const PO_STATUS_LABEL = { ordered: 'Ordered', partial: 'Partially received', received: 'Received' }
function fileToBase64(file) {
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1] || ''); r.onerror = reject; r.readAsDataURL(file) })
}

export default function ToolOrders({ profile }) {
  const org = useOrgSelector(profile)
  const [mode, setMode] = useState('po')             // po | receipt | manual
  const [acq, setAcq] = useState(blankAcq)
  const [items, setItems] = useState([])
  const [poForm, setPoForm] = useState({ vendor: '', expected_date: '', notes: '' })
  const [poLines, setPoLines] = useState([blankLine()])
  const [reading, setReading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [list, setList] = useState([])
  const [recv, setRecv] = useState({ id: null, lines: [], qty: {} })   // receive panel

  async function load() { if (org.selectedOrg) setList(await listAcquisitions(org.selectedOrg)) }
  useEffect(() => { load() }, [org.selectedOrg])

  function resetAll() { setAcq(blankAcq); setItems([]); setPoForm({ vendor: '', expected_date: '', notes: '' }); setPoLines([blankLine()]); setMsg('') }

  // ---- Receipt / manual (after-the-fact, tools created now) ----
  async function onReceipt(e) {
    const file = e.target.files?.[0]; if (!file) return
    setReading(true); setMsg('')
    try {
      const b64 = await fileToBase64(file)
      const res = await extractToolReceipt(b64, file.type || 'application/pdf')
      if (res.error) { setMsg(res.error); return }
      setAcq({
        acquisition_type: res.po_number ? 'po' : 'card', vendor: res.vendor || '', po_number: res.po_number || '',
        acquired_date: normDate(res.purchase_date) || today(), amount: res.total_amount != null ? String(res.total_amount) : '',
        card_last4: res.card_last4 || '', card_label: res.payment_method || '', rental_return_due: '', rental_rate: '',
      })
      setItems((res.items || []).map((it) => ({ name: it.description || '', brand: it.brand || '', is_hand_tool: false, cost: it.unit_cost != null ? String(it.unit_cost) : '', track: it.likely_tool !== false })))
      setMsg(`Quincy read ${res.items?.length || 0} line item(s) from ${res.vendor || 'the receipt'} — review and save.`)
    } catch (err) { setMsg(String(err)) } finally { setReading(false); e.target.value = '' }
  }
  function setItem(i, patch) { setItems((a) => a.map((it, idx) => idx === i ? { ...it, ...patch } : it)) }

  async function saveAfterTheFact() {
    if (!acq.vendor.trim()) { setMsg('Enter the vendor / store.'); return }
    setSaving(true); setMsg('')
    const isPo = acq.acquisition_type === 'po'
    const payload = {
      acquisition_type: acq.acquisition_type, vendor: acq.vendor.trim() || null,
      po_number: isPo ? (acq.po_number.trim() || null) : null,
      po_status: isPo ? 'received' : null, received_date: isPo ? (acq.acquired_date || null) : null,
      acquired_date: acq.acquired_date || null, amount: num(acq.amount),
      card_last4: acq.acquisition_type === 'card' ? (acq.card_last4.trim() ? acq.card_last4.trim().slice(-4) : null) : null,
      card_label: acq.acquisition_type === 'card' ? (acq.card_label.trim() || null) : null,
      rental_return_due: acq.acquisition_type === 'rental' ? (acq.rental_return_due || null) : null,
      rental_rate: acq.acquisition_type === 'rental' ? num(acq.rental_rate) : null,
    }
    const toolRows = items.filter((it) => it.track && it.name.trim()).map((it) => ({ name: it.name.trim(), brand: it.brand.trim() || null, is_hand_tool: it.is_hand_tool, cost: num(it.cost) }))
    const res = await createAcquisitionWithTools(org.selectedOrg, payload, toolRows, profile.id)
    setSaving(false)
    if (res.error) { setMsg(res.error.message || 'Could not save.'); return }
    setMsg(`Saved ${TYPE_LABEL[payload.acquisition_type]} from ${payload.vendor} — created ${res.createdCount} tool${res.createdCount === 1 ? '' : 's'}.`)
    resetAll(); load()
  }

  // ---- New PO order (order now, receive later) ----
  function setLine(i, patch) { setPoLines((a) => a.map((l, idx) => idx === i ? { ...l, ...patch } : l)) }
  function addLine() { setPoLines((a) => [...a, blankLine()]) }
  function removeLine(i) { setPoLines((a) => a.filter((_, idx) => idx !== i)) }

  async function savePoOrder() {
    if (!poForm.vendor.trim()) { setMsg('Enter the vendor.'); return }
    const lines = poLines.filter((l) => l.name.trim())
    if (lines.length === 0) { setMsg('Add at least one tool line.'); return }
    setSaving(true); setMsg('')
    const res = await createToolOrder(org.selectedOrg, { vendor: poForm.vendor.trim(), expected_date: poForm.expected_date || null, notes: poForm.notes.trim() || null, lines }, profile.id)
    setSaving(false)
    if (res.error) { setMsg(res.error.message || 'Could not create the order.'); return }
    setMsg(`Created PO ${res.po_number} for ${poForm.vendor.trim()} — ${res.lineCount} line(s). Receive it below when it arrives.`)
    resetAll(); load()
  }

  // ---- Receiving ----
  async function openReceive(a) {
    const lines = await listToolOrderLines(org.selectedOrg, a.id)
    const qty = {}; lines.forEach((l) => { qty[l.id] = String(Math.max(0, (l.quantity || 0) - (l.received_count || 0))) })
    setRecv({ id: a.id, lines, qty })
  }
  async function doReceive() {
    setSaving(true)
    const res = await receiveToolOrder(org.selectedOrg, recv.id, recv.qty)
    setSaving(false)
    setMsg(`Received ${res.createdCount} tool${res.createdCount === 1 ? '' : 's'}${res.fullyReceived ? ' — PO complete.' : ' — partial receipt saved.'}`)
    setRecv({ id: null, lines: [], qty: {} }); load()
  }

  async function doReturn(a) {
    if (!confirm('Mark this rental returned? Its tools will be retired from the active list.')) return
    await returnRental(org.selectedOrg, a.id); load()
  }

  const isRental = acq.acquisition_type === 'rental', isCard = acq.acquisition_type === 'card', isPoManual = acq.acquisition_type === 'po'

  return (
    <div>
      <div className="page-header-bar"><h2>Tool Orders &amp; Receipts</h2></div>
      <OrgBar {...org} />
      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0, maxWidth: 820 }}>
        Place a <strong>PO order</strong> with a vendor (custom items, gets the next PO number in your parts sequence, received
        when it arrives), let <strong>Quincy read a receipt</strong> for an already-bought lot, or <strong>enter</strong> a card
        purchase / rental by hand. Card purchases reconcile to your bank statement on the <strong>Reconcile</strong> page.
      </p>

      {/* Mode toggle */}
      <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', margin: '4px 0 14px' }}>
        {[['po', 'New PO order'], ['receipt', 'Read a receipt (Quincy)'], ['manual', 'Enter manually']].map(([k, label]) => (
          <button key={k} type="button" onClick={() => { setMode(k); setMsg('') }}
            style={{ border: 'none', padding: '7px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700, background: mode === k ? '#1B3A6B' : '#fff', color: mode === k ? '#fff' : '#334155' }}>{label}</button>
        ))}
      </div>

      {/* ===== New PO order ===== */}
      {mode === 'po' && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 16, background: '#F8FAFC' }}>
          <div className="inline-form" style={{ flexWrap: 'wrap', marginBottom: 6 }}>
            <div className="field" style={{ minWidth: 220, flex: 1 }}><label>Vendor</label><input type="text" value={poForm.vendor} onChange={(e) => setPoForm({ ...poForm, vendor: e.target.value })} placeholder="Tool distributor / parts house" /></div>
            <div className="field" style={{ width: 160 }}><label>Expected date</label><input type="date" value={poForm.expected_date} onChange={(e) => setPoForm({ ...poForm, expected_date: e.target.value })} /></div>
            <div className="field" style={{ minWidth: 200, flex: 1 }}><label>Notes</label><input type="text" value={poForm.notes} onChange={(e) => setPoForm({ ...poForm, notes: e.target.value })} /></div>
            <div className="field" style={{ minWidth: 160, alignSelf: 'flex-end' }}><span style={{ fontSize: 12, color: 'var(--mist)' }}>PO # is assigned on save (next in your parts sequence).</span></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0' }}>
            <strong style={{ fontSize: 13 }}>Custom line items</strong>
            <button className="logout-button" onClick={addLine}>+ Add line</button>
          </div>
          <table className="data-table" style={{ margin: 0 }}>
            <thead><tr><th>Name / description</th><th>Brand</th><th>Model</th><th>Serial</th><th>Hand</th><th>Qty</th><th>Unit cost</th><th></th></tr></thead>
            <tbody>
              {poLines.map((l, i) => (
                <tr key={i}>
                  <td><input type="text" value={l.name} onChange={(e) => setLine(i, { name: e.target.value })} style={{ minWidth: 180 }} /></td>
                  <td><input type="text" value={l.brand} onChange={(e) => setLine(i, { brand: e.target.value })} style={{ width: 110 }} /></td>
                  <td><input type="text" value={l.model_no} disabled={l.is_hand_tool} onChange={(e) => setLine(i, { model_no: e.target.value })} style={{ width: 100 }} /></td>
                  <td><input type="text" value={l.serial_no} disabled={l.is_hand_tool} onChange={(e) => setLine(i, { serial_no: e.target.value })} style={{ width: 100 }} /></td>
                  <td style={{ textAlign: 'center' }}><input type="checkbox" checked={l.is_hand_tool} onChange={(e) => setLine(i, { is_hand_tool: e.target.checked })} /></td>
                  <td><input type="number" min="1" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} style={{ width: 60 }} /></td>
                  <td><input type="number" step="any" value={l.unit_cost} onChange={(e) => setLine(i, { unit_cost: e.target.value })} style={{ width: 90 }} /></td>
                  <td>{poLines.length > 1 && <button className="logout-button" onClick={() => removeLine(i)}>✕</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={saving} onClick={savePoOrder}>{saving ? 'Saving…' : 'Create PO order'}</button>
            <button className="logout-button" onClick={resetAll}>Clear</button>
          </div>
        </div>
      )}

      {/* ===== Receipt reader ===== */}
      {mode === 'receipt' && items.length === 0 && (
        <div style={{ marginBottom: 14 }}>
          <label className="auth-button" style={{ width: 'auto', padding: '9px 18px', cursor: 'pointer', display: 'inline-block' }}>
            {reading ? 'Quincy is reading…' : 'Choose receipt (PDF / photo)'}
            <input type="file" accept="application/pdf,image/*" onChange={onReceipt} disabled={reading} style={{ display: 'none' }} />
          </label>
        </div>
      )}

      {/* ===== After-the-fact acquisition form (receipt + manual) ===== */}
      {(mode === 'manual' || (mode === 'receipt' && (items.length > 0 || acq.vendor))) && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 16, background: '#F8FAFC' }}>
          <div className="inline-form" style={{ flexWrap: 'wrap', marginBottom: 0 }}>
            <div className="field" style={{ minWidth: 160 }}>
              <label>Type</label>
              <select value={acq.acquisition_type} onChange={(e) => setAcq({ ...acq, acquisition_type: e.target.value })}>
                <option value="card">Card purchase</option>
                <option value="po">PO (already received)</option>
                <option value="rental">Rental</option>
              </select>
            </div>
            <div className="field" style={{ minWidth: 180, flex: 1 }}><label>Vendor / store</label><input type="text" value={acq.vendor} onChange={(e) => setAcq({ ...acq, vendor: e.target.value })} placeholder="Home Depot" /></div>
            <div className="field" style={{ width: 150 }}><label>Date</label><input type="date" value={acq.acquired_date} onChange={(e) => setAcq({ ...acq, acquired_date: e.target.value })} /></div>
            <div className="field" style={{ width: 120 }}><label>Amount</label><input type="number" step="any" value={acq.amount} onChange={(e) => setAcq({ ...acq, amount: e.target.value })} placeholder="0.00" /></div>
            {isPoManual && <div className="field" style={{ width: 150 }}><label>PO #</label><input type="text" value={acq.po_number} onChange={(e) => setAcq({ ...acq, po_number: e.target.value })} /></div>}
            {isCard && <div className="field" style={{ width: 110 }}><label>Card last 4</label><input type="text" value={acq.card_last4} onChange={(e) => setAcq({ ...acq, card_last4: e.target.value })} placeholder="1234" /></div>}
            {isCard && <div className="field" style={{ width: 140 }}><label>Card label</label><input type="text" value={acq.card_label} onChange={(e) => setAcq({ ...acq, card_label: e.target.value })} placeholder="Visa ..1234" /></div>}
            {isRental && <div className="field" style={{ width: 150 }}><label>Return by</label><input type="date" value={acq.rental_return_due} onChange={(e) => setAcq({ ...acq, rental_return_due: e.target.value })} /></div>}
            {isRental && <div className="field" style={{ width: 120 }}><label>Rate ($)</label><input type="number" step="any" value={acq.rental_rate} onChange={(e) => setAcq({ ...acq, rental_rate: e.target.value })} /></div>}
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <strong style={{ fontSize: 13 }}>Tools on this {TYPE_LABEL[acq.acquisition_type].toLowerCase()}</strong>
              <button className="logout-button" onClick={() => setItems((a) => [...a, blankItem()])}>+ Add tool</button>
              <span style={{ fontSize: 12, color: 'var(--mist)' }}>Only checked rows become tracked tools.</span>
            </div>
            {items.length === 0 ? <div style={{ color: 'var(--mist)', fontSize: 13 }}>No tools yet — add one, or record just the purchase.</div> : (
              <table className="data-table" style={{ margin: 0 }}>
                <thead><tr><th>Track</th><th>Name / description</th><th>Brand</th><th>Hand tool</th><th>Cost</th><th></th></tr></thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} style={it.track ? undefined : { opacity: 0.5 }}>
                      <td><input type="checkbox" checked={it.track} onChange={(e) => setItem(i, { track: e.target.checked })} /></td>
                      <td><input type="text" value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} style={{ minWidth: 200 }} /></td>
                      <td><input type="text" value={it.brand} onChange={(e) => setItem(i, { brand: e.target.value })} style={{ width: 120 }} /></td>
                      <td style={{ textAlign: 'center' }}><input type="checkbox" checked={it.is_hand_tool} onChange={(e) => setItem(i, { is_hand_tool: e.target.checked })} /></td>
                      <td><input type="number" step="any" value={it.cost} onChange={(e) => setItem(i, { cost: e.target.value })} style={{ width: 90 }} /></td>
                      <td><button className="logout-button" onClick={() => setItems((a) => a.filter((_, idx) => idx !== i))}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={saving} onClick={saveAfterTheFact}>{saving ? 'Saving…' : 'Save acquisition'}</button>
            <button className="logout-button" onClick={resetAll}>Clear</button>
          </div>
        </div>
      )}

      {msg && <div style={{ marginBottom: 12, color: msg.startsWith('Saved') || msg.startsWith('Quincy read') || msg.startsWith('Created PO') || msg.startsWith('Received') ? '#166534' : '#B00020' }}>{msg}</div>}

      {/* Acquisitions list */}
      <h3 style={{ marginBottom: 6 }}>Recent orders &amp; acquisitions</h3>
      <table className="data-table">
        <thead><tr><th>Date</th><th>Type</th><th>Vendor</th><th style={{ textAlign: 'right' }}>Amount</th><th>PO / Card</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {list.map((a) => {
            const overdue = a.acquisition_type === 'rental' && !a.rental_returned_at && a.rental_return_due && a.rental_return_due < today()
            const openPo = a.acquisition_type === 'po' && (a.po_status === 'ordered' || a.po_status === 'partial')
            return (
              <tr key={a.id} style={overdue ? { background: '#FCEFEF' } : openPo ? { background: '#F0F6FF' } : undefined}>
                <td>{a.acquired_date || '—'}</td>
                <td>{TYPE_LABEL[a.acquisition_type] || a.acquisition_type}</td>
                <td>{a.vendor || '—'}</td>
                <td style={{ textAlign: 'right' }}>{money(a.amount)}</td>
                <td style={{ color: 'var(--mist)' }}>{a.acquisition_type === 'po' ? (a.po_number || '—') : a.card_last4 ? `••${a.card_last4}` : '—'}</td>
                <td>
                  {a.acquisition_type === 'po' ? (a.po_status === 'received' ? <span style={{ color: '#166534' }}>Received</span> : <span style={{ color: '#1B3A6B', fontWeight: 600 }}>{PO_STATUS_LABEL[a.po_status] || 'Ordered'}{a.expected_date ? ` · exp ${a.expected_date}` : ''}</span>)
                    : a.acquisition_type === 'rental' ? (a.rental_returned_at ? <span style={{ color: '#166534' }}>Returned</span> : overdue ? <span style={{ color: '#B00020', fontWeight: 600 }}>Overdue — due {a.rental_return_due}</span> : `Due ${a.rental_return_due || '—'}`)
                    : '—'}
                </td>
                <td>
                  {openPo && <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => openReceive(a)}>Receive</button>}
                  {a.acquisition_type === 'rental' && !a.rental_returned_at && <button className="logout-button" onClick={() => doReturn(a)}>Return</button>}
                </td>
              </tr>
            )
          })}
          {list.length === 0 && <tr><td colSpan="7" style={{ color: 'var(--mist)' }}>No orders or acquisitions yet.</td></tr>}
        </tbody>
      </table>

      {/* Receive panel */}
      {recv.id && (
        <div style={{ border: '1px solid #B7D0F5', background: '#F0F6FF', borderRadius: 10, padding: 14, marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong>Receive PO — enter how many of each line arrived</strong>
            <button className="logout-button" onClick={() => setRecv({ id: null, lines: [], qty: {} })}>Cancel</button>
          </div>
          <table className="data-table" style={{ margin: 0 }}>
            <thead><tr><th>Tool</th><th>Ordered</th><th>Already received</th><th>Receive now</th></tr></thead>
            <tbody>
              {recv.lines.map((l) => {
                const remaining = (l.quantity || 0) - (l.received_count || 0)
                return (
                  <tr key={l.id}>
                    <td>{l.name}{l.brand ? <span style={{ color: 'var(--mist)' }}> · {l.brand}</span> : ''}</td>
                    <td>{l.quantity}</td>
                    <td>{l.received_count || 0}</td>
                    <td><input type="number" min="0" max={remaining} value={recv.qty[l.id] ?? ''} onChange={(e) => setRecv({ ...recv, qty: { ...recv.qty, [l.id]: e.target.value } })} style={{ width: 70 }} disabled={remaining <= 0} /> <span style={{ fontSize: 12, color: 'var(--mist)' }}>of {remaining} left</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <button className="auth-button" style={{ width: 'auto', marginTop: 10 }} disabled={saving} onClick={doReceive}>{saving ? 'Receiving…' : 'Receive into shop'}</button>
        </div>
      )}
    </div>
  )
}
