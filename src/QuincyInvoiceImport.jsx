import { useState } from 'react'
import { supabase } from './utils/supabase'

// Lightweight normalization + token overlap for matching a vendor's line
// description to one of our existing items when there's no known SKU.
function norm(s) { return (s || '').toString().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() }
function tokens(s) { return new Set(norm(s).split(' ').filter((w) => w.length > 1)) }
function overlapScore(a, b) {
  const ta = tokens(a), tb = tokens(b)
  if (!ta.size || !tb.size) return 0
  let hit = 0
  for (const t of ta) if (tb.has(t)) hit++
  return hit / Math.max(ta.size, tb.size)
}
function money(n) {
  if (n == null || isNaN(n)) return '—'
  return '$' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1])
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

const backdrop = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 16px', overflowY: 'auto', zIndex: 1100 }
const card = { background: '#fff', borderRadius: 12, padding: 24, maxWidth: 1000, width: '100%', boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }
const th = { padding: '8px 10px', fontSize: 12, fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap' }
const td = { padding: '7px 10px', verticalAlign: 'top', fontSize: 13 }

// Quincy invoice import — upload -> extract -> review/match -> apply.
// Invoices/packing slips receive stock (reversible); quotes update pricing only.
export default function QuincyInvoiceImport({ orgId, items, vendors, offersByItem, onClose, onApplied }) {
  const [step, setStep] = useState('upload')     // 'upload' | 'review' | 'done'
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [extracted, setExtracted] = useState(null)
  const [docType, setDocType] = useState('invoice')
  const [vendorId, setVendorId] = useState('')
  const [newVendorName, setNewVendorName] = useState('')
  const [reference, setReference] = useState('')
  const [receivedDate, setReceivedDate] = useState('')
  const [lines, setLines] = useState([])          // resolutions
  const [summary, setSummary] = useState(null)

  // Flatten all offerings with their item for SKU matching.
  const allOffers = []
  for (const [itemId, offs] of Object.entries(offersByItem || {})) {
    for (const o of offs) allOffers.push({ ...o, item_id: itemId })
  }

  function bestItemByDesc(desc) {
    let best = null, score = 0
    for (const it of items) {
      const s = overlapScore(desc, `${it.generic_name} ${it.description || ''}`)
      if (s > score) { score = s; best = it }
    }
    return score >= 0.45 ? best : null
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setBusy(true); setError('')
    try {
      const fileBase64 = await fileToBase64(file)
      const { data, error: fnErr } = await supabase.functions.invoke('invoice-extract', {
        body: { fileBase64, mediaType: file.type || 'application/pdf' },
      })
      if (fnErr || data?.error) { setError(data?.error || fnErr.message || 'Could not read that file.'); setBusy(false); return }
      setExtracted(data)
      setDocType(data.doc_type === 'quote' ? 'quote' : 'invoice')
      setReference(data.invoice_number || '')
      setReceivedDate(data.invoice_date && /^\d{4}-\d{2}-\d{2}$/.test(data.invoice_date) ? data.invoice_date : '')

      // Resolve vendor by fuzzy name.
      let vMatch = null, vScore = 0
      for (const v of vendors) { const s = overlapScore(data.vendor_name, v.name); if (s > vScore) { vScore = s; vMatch = v } }
      if (vMatch && vScore >= 0.5) { setVendorId(vMatch.id); setNewVendorName('') }
      else { setVendorId('__new__'); setNewVendorName(data.vendor_name || '') }

      // Resolve each line: SKU match first, else description match, else new.
      const resolved = (data.lines || []).map((ln) => {
        let itemId = '', packBase = 1
        const skuHit = ln.sku ? allOffers.find((o) => norm(o.vendor_sku) && norm(o.vendor_sku) === norm(ln.sku)) : null
        if (skuHit) { itemId = skuHit.item_id; packBase = Number(skuHit.pack_base_qty) || 1 }
        else {
          const it = bestItemByDesc(ln.description)
          if (it) itemId = it.id
        }
        const unitCost = ln.unit_cost != null ? Number(ln.unit_cost)
          : (ln.extended_cost != null && ln.quantity ? Number(ln.extended_cost) / Number(ln.quantity) : null)
        return {
          include: true,
          sku: ln.sku || '',
          description: ln.description || '',
          quantity: ln.quantity != null ? String(ln.quantity) : '1',
          unit_label: ln.unit_of_measure || '',
          unit_cost: unitCost != null ? String(unitCost) : '',
          item_id: itemId || '__new__',
          new_name: itemId ? '' : (ln.description || ''),
          pack_base_qty: String(packBase),
        }
      })
      setLines(resolved)
      setStep('review')
    } catch (err) {
      setError(err.message || String(err))
    }
    setBusy(false)
  }

  function setLine(i, patch) { setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l))) }

  async function apply() {
    setBusy(true); setError('')
    try {
      // 1) Resolve vendor (create if new)
      let vId = vendorId
      if (vId === '__new__') {
        if (!newVendorName.trim()) { setError('Enter or pick a vendor.'); setBusy(false); return }
        const { data: v, error: vErr } = await supabase.from('vendors')
          .insert({ org_id: orgId, name: newVendorName.trim(), is_active: true }).select('id').single()
        if (vErr) { setError(vErr.message); setBusy(false); return }
        vId = v.id
      }

      const receiveLines = []
      let created = 0, updated = 0

      for (const l of lines) {
        if (!l.include) continue
        const packBase = parseFloat(l.pack_base_qty) || 1
        const qty = parseFloat(l.quantity) || 0
        const unitCost = l.unit_cost === '' ? null : parseFloat(l.unit_cost)
        const costBase = unitCost != null && packBase > 0 ? unitCost / packBase : null

        // 2) Resolve/create the item
        let itemId = l.item_id
        if (itemId === '__new__') {
          const { data: it, error: itErr } = await supabase.from('part_items')
            .insert({ org_id: orgId, generic_name: (l.new_name || l.description || 'New item').trim(), base_unit: 'each', sell_unit: 'each', sell_unit_factor: 1 })
            .select('id').single()
          if (itErr) { setError(itErr.message); setBusy(false); return }
          itemId = it.id; created++
        }

        // 3) Upsert the vendor offering (cross-reference + price)
        const existing = allOffers.find((o) => o.vendor_id === vId && norm(o.vendor_sku) && norm(o.vendor_sku) === norm(l.sku))
        const offPayload = {
          vendor_description: l.description || null,
          pack_label: l.unit_label || null,
          pack_base_qty: packBase,
          last_cost_per_pack: unitCost,
          last_cost_per_base_unit: costBase,
          last_seen_at: new Date().toISOString(),
        }
        if (existing) {
          await supabase.from('part_vendor_offerings').update(offPayload).eq('id', existing.id)
        } else {
          await supabase.from('part_vendor_offerings').insert({
            org_id: orgId, item_id: itemId, vendor_id: vId, vendor_sku: l.sku || null, ...offPayload,
          })
          updated++
        }

        if ((docType === 'invoice' || docType === 'packing_slip') && qty * packBase > 0) {
          receiveLines.push({ item_id: itemId, qty_base: qty * packBase, cost_per_base: costBase })
        }
      }

      // 4) Invoices/packing slips receive stock (reversible batch). Quotes don't.
      let receiptId = null
      if (receiveLines.length) {
        const { data: batch, error: rErr } = await supabase.rpc('part_receive', {
          p_org: orgId, p_vendor: vId, p_reference: reference.trim() || null,
          p_received_at: receivedDate ? new Date(receivedDate + 'T12:00:00').toISOString() : null,
          p_note: 'Quincy invoice import', p_lines: receiveLines,
        })
        if (rErr) { setError(rErr.message); setBusy(false); return }
        receiptId = batch
      }

      setSummary({ docType, itemsCreated: created, offerings: updated, received: receiveLines.length, receiptId })
      setStep('done')
      onApplied?.()
    } catch (err) {
      setError(err.message || String(err))
    }
    setBusy(false)
  }

  return (
    <div className="modal-backdrop" onClick={onClose} style={backdrop}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={card}>
        <h3 style={{ marginTop: 0 }}>Import from Invoice · Quincy</h3>

        {step === 'upload' && (
          <div>
            <p style={{ color: 'var(--mist,#777)', fontSize: 14 }}>
              Upload a vendor invoice, quote, or packing slip (PDF or photo). Quincy reads it, matches the
              lines to your items and vendors, and shows you everything to approve before anything is saved.
            </p>
            <label className="auth-button" style={{ width: 'auto', padding: '10px 22px', cursor: 'pointer', display: 'inline-block' }}>
              {busy ? 'Reading…' : 'Choose file'}
              <input type="file" accept="application/pdf,image/*" onChange={handleFile} disabled={busy} style={{ display: 'none' }} />
            </label>
            {error && <div className="auth-error" style={{ marginTop: 12 }}>{error}</div>}
            <div style={{ marginTop: 16 }}><button className="logout-button" onClick={onClose}>Cancel</button></div>
          </div>
        )}

        {step === 'review' && extracted && (
          <div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
              <div className="field" style={{ width: 150 }}>
                <label>Document type</label>
                <select value={docType} onChange={(e) => setDocType(e.target.value)}>
                  <option value="invoice">Invoice (receives stock)</option>
                  <option value="packing_slip">Packing slip (receives stock)</option>
                  <option value="quote">Quote (pricing only)</option>
                </select>
              </div>
              <div className="field" style={{ flex: 1, minWidth: 180 }}>
                <label>Vendor</label>
                <select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
                  <option value="__new__">+ New vendor…</option>
                  {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
                {vendorId === '__new__' && (
                  <input style={{ marginTop: 6 }} value={newVendorName} onChange={(e) => setNewVendorName(e.target.value)} placeholder="New vendor name" />
                )}
              </div>
              <div className="field" style={{ width: 150 }}>
                <label>PO / Invoice #</label>
                <input value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>
              <div className="field" style={{ width: 150 }}>
                <label>Date</label>
                <input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} />
              </div>
            </div>
            {docType === 'quote' && (
              <p style={{ fontSize: 12, color: '#215F9A', marginTop: -4 }}>Quote: updates item/vendor pricing and creates new items — no stock received.</p>
            )}

            <div style={{ overflowX: 'auto', border: '1px solid var(--border,#e2e4e8)', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: '#002060', color: '#fff' }}>
                  <th style={th}>Use</th><th style={th}>Vendor line (SKU · description)</th><th style={{ ...th, textAlign: 'right' }}>Qty</th>
                  <th style={{ ...th, textAlign: 'right' }}>Unit cost</th><th style={th}>Maps to item</th>
                  <th style={{ ...th, textAlign: 'right' }}>Pack size</th><th style={{ ...th, textAlign: 'right' }}>Receives</th>
                </tr></thead>
                <tbody>
                  {lines.map((l, i) => {
                    const it = items.find((x) => x.id === l.item_id)
                    const base = it?.base_unit || 'each'
                    const packBase = parseFloat(l.pack_base_qty) || 0
                    const qty = parseFloat(l.quantity) || 0
                    const unitCost = l.unit_cost === '' ? null : parseFloat(l.unit_cost)
                    const costBase = unitCost != null && packBase > 0 ? unitCost / packBase : null
                    return (
                      <tr key={i} style={{ borderTop: '1px solid var(--border,#e2e4e8)', opacity: l.include ? 1 : 0.5 }}>
                        <td style={td}><input type="checkbox" checked={l.include} onChange={(e) => setLine(i, { include: e.target.checked })} /></td>
                        <td style={td}>
                          <div style={{ fontWeight: 600 }}>{l.sku ? `${l.sku} · ` : ''}{l.description}</div>
                          {l.unit_label && <div style={{ fontSize: 11, color: 'var(--mist,#777)' }}>as printed: {l.unit_label}</div>}
                        </td>
                        <td style={{ ...td, textAlign: 'right' }}><input type="number" step="any" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} style={{ width: 56, textAlign: 'right' }} /></td>
                        <td style={{ ...td, textAlign: 'right' }}><input type="number" step="any" value={l.unit_cost} onChange={(e) => setLine(i, { unit_cost: e.target.value })} style={{ width: 80, textAlign: 'right' }} placeholder="$" /></td>
                        <td style={td}>
                          <select value={l.item_id} onChange={(e) => setLine(i, { item_id: e.target.value })} style={{ minWidth: 160 }}>
                            <option value="__new__">+ New item…</option>
                            {items.map((x) => <option key={x.id} value={x.id}>{x.generic_name}</option>)}
                          </select>
                          {l.item_id === '__new__' && (
                            <input style={{ marginTop: 4 }} value={l.new_name} onChange={(e) => setLine(i, { new_name: e.target.value })} placeholder="New item name" />
                          )}
                        </td>
                        <td style={{ ...td, textAlign: 'right' }}>
                          <input type="number" step="any" value={l.pack_base_qty} onChange={(e) => setLine(i, { pack_base_qty: e.target.value })} style={{ width: 64, textAlign: 'right' }} />
                          <div style={{ fontSize: 11, color: 'var(--mist,#777)' }}>{base}/unit</div>
                        </td>
                        <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {qty * packBase > 0 ? `${(qty * packBase).toLocaleString()} ${base}` : '—'}
                          {costBase != null && <div style={{ fontSize: 11, color: 'var(--mist,#777)' }}>{money(costBase)}/{base}</div>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 12, color: 'var(--mist,#777)' }}>
              Tip: set the pack size for a new item (e.g. a 25 lb refrigerant jug = 400 if its base unit is ounces). SKUs you confirm are remembered, so next time this vendor's line matches automatically.
            </p>
            {error && <div className="auth-error" style={{ marginBottom: 10 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="auth-button" onClick={apply} disabled={busy} style={{ width: 'auto', padding: '10px 22px' }}>
                {busy ? 'Applying…' : docType === 'quote' ? 'Approve (update pricing)' : 'Approve & Receive'}
              </button>
              <button className="logout-button" onClick={() => setStep('upload')}>Back</button>
              <button className="logout-button" onClick={onClose}>Cancel</button>
            </div>
          </div>
        )}

        {step === 'done' && summary && (
          <div>
            <h4 style={{ marginTop: 0 }}>Done</h4>
            <p style={{ fontSize: 14 }}>
              {summary.received > 0
                ? `Received ${summary.received} line${summary.received === 1 ? '' : 's'} into the Shop (reversible in Receipts). `
                : 'Pricing updated — no stock received (quote). '}
              {summary.itemsCreated > 0 && `${summary.itemsCreated} new item${summary.itemsCreated === 1 ? '' : 's'} created. `}
            </p>
            <button className="auth-button" style={{ width: 'auto', padding: '9px 18px' }} onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  )
}
