// Elements-HVAC · P4 · Vendor Invoices (Accounts Payable)
// Capture a vendor bill (photo/PDF) with the invoice-extract AI, auto-match it
// to its PO, run a 3-way match (ordered vs received vs billed), stage it for
// payment, and optionally receive the matched goods into stock. Bills wait in
// the "Staged for payment" queue for the future Bookkeeping module to claim.
import { useState, useEffect, useMemo, useRef } from 'react'
import {
  listVendorInvoices, getVendorInvoice, createVendorInvoice, updateVendorInvoice,
  setVendorInvoiceStatus, deleteVendorInvoice, extractInvoiceFile, uploadInvoiceFile,
  getInvoiceFileUrl, createVendor, findPurchaseOrdersForVendor, updateVendorInvoiceLine,
  getPurchaseOrder, listVendors, listItems, receivePO, listItemVendors, learnAliases,
} from './data'
import { useOrgSelector, OrgBar } from './shared'

const money = (n) => (n == null || n === '' || isNaN(n) ? '—' : `$${Number(n).toFixed(2)}`)
const fmtDate = (d) => (d ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? d + 'T12:00:00' : d).toLocaleDateString() : '')

// --- fuzzy matching (vendor name + line description) ---
const norm = (s) => (s || '').toString().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const toks = (s) => new Set(norm(s).split(' ').filter((w) => w.length > 1))
function overlap(a, b) {
  const ta = toks(a), tb = toks(b)
  if (!ta.size || !tb.size) return 0
  let hit = 0; for (const t of ta) if (tb.has(t)) hit++
  return hit / Math.max(ta.size, tb.size)
}
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1])
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

const STATUS = {
  review: { t: 'Needs review', bg: '#F8EEDD', c: '#B0600A' },
  staged: { t: 'Staged for payment', bg: '#E3F1E8', c: '#166534' },
  hold: { t: 'On hold', bg: '#FBE7E7', c: '#B00020' },
}
const MATCH = {
  matched: { t: 'Matched', bg: '#E3F1E8', c: '#166534' },
  exception: { t: 'Needs attention', bg: '#F8EEDD', c: '#B0600A' },
  unmatched: { t: 'No PO', bg: '#EEF1F6', c: '#475569' },
}
const badge = (map, k) => { const m = map[k] || map.review || map.unmatched; return <span className="badge" style={{ background: m.bg, color: m.c }}>{m.t}</span> }

const CENTS = 0.01

// Compare a billed line against its matched PO line → variance state.
function lineState(l, poLine) {
  if (!poLine) return 'unmatched'
  const billedCost = l.unit_cost == null || l.unit_cost === '' ? null : Number(l.unit_cost)
  const poCost = poLine.unit_cost == null ? null : Number(poLine.unit_cost)
  const billedQty = Number(l.quantity) || 0
  const recvQty = Number(poLine.qty_received || 0)
  if (billedCost != null && poCost != null && Math.abs(billedCost - poCost) > CENTS) return 'price_variance'
  if (billedQty > recvQty + 1e-9) return 'qty_variance'
  return 'matched'
}
function rollupMatch(poId, lines, poLineById) {
  if (!poId) return 'unmatched'
  let anyMatched = false, anyBad = false
  for (const l of lines) {
    const st = lineState(l, l.po_line_id ? poLineById[l.po_line_id] : null)
    if (st === 'matched') anyMatched = true
    else anyBad = true
  }
  if (anyBad) return 'exception'
  return anyMatched ? 'matched' : 'unmatched'
}

export default function ElementsVendorInvoices({ profile }) {
  const org = useOrgSelector(profile)
  const [invoices, setInvoices] = useState([])
  const [vendors, setVendors] = useState([])
  const [items, setItems] = useState([])
  const [statusFilter, setStatusFilter] = useState('review')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState(null)
  const [detailPOs, setDetailPOs] = useState([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [fileUrl, setFileUrl] = useState(null)

  // capture modal
  const [capOpen, setCapOpen] = useState(false)
  const [capStep, setCapStep] = useState('upload')   // upload | review
  const [capBusy, setCapBusy] = useState(false)
  const [capErr, setCapErr] = useState('')
  const [cap, setCap] = useState(null)               // { docType, vendorId, newVendorName, invoiceNumber, invoiceDate, dueDate, poId, lines, file, extracted }
  const [candPOs, setCandPOs] = useState([])
  const [vendorAliases, setVendorAliases] = useState([])   // this vendor's learned SKU/description → item aliases

  async function loadList() {
    if (!org.selectedOrg) return
    const [inv, v, its] = await Promise.all([
      listVendorInvoices(org.selectedOrg), listVendors(org.selectedOrg), listItems(org.selectedOrg),
    ])
    setInvoices(inv); setVendors(v); setItems(its)
  }
  useEffect(() => { loadList() }, [org.selectedOrg])

  async function openInvoice(id) {
    setSelectedId(id); setMsg(''); setErr(''); setFileUrl(null)
    const d = await getVendorInvoice(org.selectedOrg, id)
    setDetail(d)
    if (d?.file_path) getInvoiceFileUrl(d.file_path).then(setFileUrl)
    findPurchaseOrdersForVendor(org.selectedOrg, d?.vendor_id).then(setDetailPOs)
  }

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return invoices.filter((v) => {
      if (statusFilter !== 'all' && v.status !== statusFilter) return false
      if (term) return `${v.invoice_number || ''} ${v.vendor?.name || ''} ${v.po?.po_number || ''} ${v.po?.job_name || ''}`.toLowerCase().includes(term)
      return true
    })
  }, [invoices, statusFilter, search])

  const counts = useMemo(() => ({
    review: invoices.filter((v) => v.status === 'review').length,
    staged: invoices.filter((v) => v.status === 'staged').length,
    hold: invoices.filter((v) => v.status === 'hold').length,
  }), [invoices])

  // ---------------- capture ----------------
  function openCapture() {
    setCap(null); setCapErr(''); setCapStep('upload'); setCapOpen(true); setCandPOs([])
  }

  // Match a vendor line to a catalog item, best signal first:
  //  1) this vendor's learned SKU alias (exact, certain)
  //  2) this vendor's learned description alias
  //  3) catalog SKU equality  4) fuzzy description overlap
  function matchItem(line, aliases) {
    const al = aliases || vendorAliases
    const sn = (line.sku || '').toString().toLowerCase().replace(/[^a-z0-9]+/g, '')
    if (sn) { const a = al.find((x) => x.sku_norm && x.sku_norm === sn); if (a) return a.item_id }
    const dn = norm(line.description)
    if (dn) { const a = al.find((x) => norm(x.vendor_description) === dn); if (a) return a.item_id }
    const sku = norm(line.sku)
    if (sku) { const bySku = items.find((it) => norm(it.sku) === sku); if (bySku) return bySku.id }
    let best = null, score = 0
    for (const it of items) { const s = overlap(line.description, it.description); if (s > score) { score = s; best = it } }
    return (best && score >= 0.5) ? best.id : null
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]; if (e.target) e.target.value = ''
    if (!file) return
    setCapBusy(true); setCapErr('')
    try {
      const fileBase64 = await fileToBase64(file)
      const { data, error } = await extractInvoiceFile(fileBase64, file.type || 'application/pdf')
      if (error) { setCapErr(error.message || 'Could not read that file.'); setCapBusy(false); return }

      // vendor fuzzy match
      let vId = '__new__', vName = data.vendor_name || '', vScore = 0, vMatch = null
      for (const v of vendors) { const s = overlap(data.vendor_name, v.name); if (s > vScore) { vScore = s; vMatch = v } }
      if (vMatch && vScore >= 0.5) { vId = vMatch.id; vName = '' }

      // candidate POs + auto-pick by customer_po ↔ po_number / job_name
      const pos = await findPurchaseOrdersForVendor(org.selectedOrg, vId === '__new__' ? null : vId)
      setCandPOs(pos)
      // this vendor's learned aliases drive SKU-first line matching
      const aliases = await listItemVendors(org.selectedOrg, vId === '__new__' ? null : vId)
      setVendorAliases(aliases)
      const ref = norm(data.customer_po)
      let poId = ''
      if (ref) {
        const hit = pos.find((p) => norm(p.po_number) === ref || (p.job_name && norm(p.job_name) === ref))
          || pos.find((p) => (norm(p.po_number).includes(ref) || ref.includes(norm(p.po_number))) && norm(p.po_number))
          || pos.find((p) => p.job_name && overlap(p.job_name, data.customer_po) >= 0.5)
        if (hit) poId = hit.id
      }

      const lines = (data.lines || []).map((ln) => {
        const q = Number(ln.quantity) || 0
        const unit = (ln.unit_cost != null) ? Number(ln.unit_cost)
          : (ln.extended_cost != null && q > 0 ? Number(ln.extended_cost) / q : null)
        return {
          sku: ln.sku || '', description: ln.description || '', quantity: ln.quantity != null ? String(ln.quantity) : '1',
          unit_of_measure: ln.unit_of_measure || '', unit_cost: unit != null ? String(unit) : '',
          extended_cost: ln.extended_cost != null ? String(ln.extended_cost) : (unit != null ? String(unit * q) : ''),
          item_id: matchItem(ln, aliases) || '', po_line_id: '',
        }
      })
      setCap({
        docType: data.doc_type === 'quote' ? 'quote' : (data.doc_type === 'packing_slip' ? 'packing_slip' : 'invoice'),
        vendorId: vId, newVendorName: vName,
        invoiceNumber: data.invoice_number || '', customerPo: data.customer_po || '',
        invoiceDate: data.invoice_date && /^\d{4}-\d{2}-\d{2}$/.test(data.invoice_date) ? data.invoice_date : '',
        dueDate: '', poId, lines, file, extracted: data,
      })
      setCapStep('review')
    } catch (e2) { setCapErr(e2.message || String(e2)) }
    setCapBusy(false)
  }

  // when vendor changes in review, refresh candidate POs
  async function onCapVendor(vId) {
    const pos = await findPurchaseOrdersForVendor(org.selectedOrg, vId === '__new__' ? null : vId)
    setCandPOs(pos)
    const aliases = await listItemVendors(org.selectedOrg, vId === '__new__' ? null : vId)
    setVendorAliases(aliases)
    setCap((c) => (c ? { ...c, vendorId: vId, lines: c.lines.map((l) => ({ ...l, item_id: matchItem(l, aliases) || l.item_id })) } : c))
  }
  function setCapLine(i, patch) { setCap((c) => ({ ...c, lines: c.lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) })) }

  async function saveCapture() {
    const c = cap
    if (!c) return
    setCapBusy(true); setCapErr('')
    try {
      let vId = c.vendorId
      if (vId === '__new__') {
        if (!c.newVendorName.trim()) { setCapErr('Pick or name a vendor.'); setCapBusy(false); return }
        const { data: v, error: ve } = await createVendor(org.selectedOrg, c.newVendorName)
        if (ve) { setCapErr(ve.message); setCapBusy(false); return }
        vId = v.id
      }
      const subtotal = c.lines.reduce((s, l) => {
        const ext = l.extended_cost !== '' ? Number(l.extended_cost) : ((Number(l.unit_cost) || 0) * (Number(l.quantity) || 0))
        return s + (isNaN(ext) ? 0 : ext)
      }, 0)
      // Link each billed line to a PO line (by item) and compute the 3-way match.
      let poLines = []
      if (c.poId) { const pod = await getPurchaseOrder(org.selectedOrg, c.poId); poLines = pod?.lines || [] }
      const used = new Set()
      const linked = c.lines.map((l) => {
        let poLineId = null
        if (c.poId && l.item_id) {
          const m = poLines.find((pl) => pl.item_id === l.item_id && !used.has(pl.id))
          if (m) { poLineId = m.id; used.add(m.id) }
        }
        return { ...l, po_line_id: poLineId }
      })
      const poLineById = {}; poLines.forEach((pl) => { poLineById[pl.id] = pl })
      const ms = c.poId ? rollupMatch(c.poId, linked, poLineById) : 'unmatched'
      const header = {
        vendor_id: vId, po_id: c.poId || null, doc_type: c.docType,
        invoice_number: c.invoiceNumber || null,
        invoice_date: c.invoiceDate || null, due_date: c.dueDate || null,
        subtotal, total: subtotal, extracted: c.extracted || null,
        created_by: profile?.id || null,
        status: 'review', match_status: ms,
      }
      const { invoice, error } = await createVendorInvoice(org.selectedOrg, header, linked.map((l) => ({
        po_line_id: l.po_line_id || null, item_id: l.item_id || null, sku: l.sku, description: l.description,
        quantity: l.quantity, unit_of_measure: l.unit_of_measure, unit_cost: l.unit_cost, extended_cost: l.extended_cost,
        match_state: lineState(l, l.po_line_id ? poLineById[l.po_line_id] : null),
      })))
      if (error) { setCapErr(error.message); setCapBusy(false); return }
      if (c.file) {
        const up = await uploadInvoiceFile(org.selectedOrg, invoice.id, c.file)
        if (!up.error && up.path) await updateVendorInvoice(org.selectedOrg, invoice.id, { file_path: up.path })
      }
      // Remember each confirmed line→item mapping for this vendor so the next
      // invoice from them auto-matches by SKU without guessing.
      await learnAliases(org.selectedOrg, vId, linked
        .filter((l) => l.item_id)
        .map((l) => ({ item_id: l.item_id, vendor_sku: l.sku, vendor_description: l.description, last_cost: l.unit_cost })))
      setCapOpen(false); setCapBusy(false)
      await loadList()
      openInvoice(invoice.id)
    } catch (e2) { setCapErr(e2.message || String(e2)); setCapBusy(false) }
  }

  // ---------------- detail actions ----------------
  const poLineById = useMemo(() => {
    const m = {}; (detail?.poLines || []).forEach((pl) => { m[pl.id] = pl }); return m
  }, [detail])

  async function stage() {
    setBusy(true); setErr(''); setMsg('')
    const ms = rollupMatch(detail.po_id, detail.lines, poLineById)
    await updateVendorInvoice(org.selectedOrg, detail.id, { match_status: ms })
    const { error } = await setVendorInvoiceStatus(org.selectedOrg, detail.id, 'staged')
    setBusy(false)
    if (error) { setErr(error.message); return }
    setMsg('Staged for payment.'); await loadList(); openInvoice(detail.id)
  }
  async function setStatus(s) {
    setBusy(true); setErr('')
    const { error } = await setVendorInvoiceStatus(org.selectedOrg, detail.id, s)
    setBusy(false); if (error) { setErr(error.message); return }
    await loadList(); openInvoice(detail.id)
  }
  async function removeInvoice() {
    if (!window.confirm('Delete this vendor invoice? The stored file and its lines are removed. This cannot be undone.')) return
    setBusy(true); setErr('')
    const { error } = await deleteVendorInvoice(org.selectedOrg, detail.id)
    setBusy(false); if (error) { setErr(error.message); return }
    setDetail(null); setSelectedId(''); setMsg('Invoice deleted.'); await loadList()
  }
  async function relink(poId) {
    setBusy(true); setErr('')
    await updateVendorInvoice(org.selectedOrg, detail.id, { po_id: poId || null })
    // Re-fetch so we have the new PO's lines, then link each billed line by item.
    const d = await getVendorInvoice(org.selectedOrg, detail.id)
    const plById = {}; (d.poLines || []).forEach((pl) => { plById[pl.id] = pl })
    const used = new Set()
    const linked = []
    for (const l of d.lines) {
      let poLineId = null
      if (poId && l.item_id) {
        const m = (d.poLines || []).find((pl) => pl.item_id === l.item_id && !used.has(pl.id))
        if (m) { poLineId = m.id; used.add(m.id) }
      }
      await updateVendorInvoiceLine(org.selectedOrg, l.id, { po_line_id: poLineId, match_state: lineState(l, poLineId ? plById[poLineId] : null) })
      linked.push({ ...l, po_line_id: poLineId })
    }
    await updateVendorInvoice(org.selectedOrg, detail.id, { match_status: rollupMatch(poId, linked, plById) })
    setBusy(false); await loadList(); openInvoice(detail.id)
  }

  // Receive the matched, billed goods into stock via the PO's receiving flow.
  async function receiveFromDoc() {
    const d = detail
    const receipts = (d.lines || [])
      .filter((l) => l.po_line_id && (Number(l.quantity) || 0) > 0)
      .map((l) => ({ line_id: l.po_line_id, item_id: l.item_id || (poLineById[l.po_line_id]?.item_id), qty: l.quantity, unit_cost: l.unit_cost }))
      .filter((r) => r.item_id)
    if (!receipts.length) { setErr('No matched lines with a quantity to receive. Link lines to the PO first.'); return }
    if (!window.confirm(`Receive ${receipts.length} matched line(s) into stock against ${d.po?.po_number || 'the PO'}?`)) return
    setBusy(true); setErr(''); setMsg('')
    const { error, count } = await receivePO(org.selectedOrg, d.po_id, receipts)
    setBusy(false)
    if (error) { setErr(error.message); return }
    setMsg(`Received ${count} line(s) into stock from this document.`); await loadList(); openInvoice(d.id)
  }

  const detailMatch = detail ? rollupMatch(detail.po_id, detail.lines, poLineById) : 'unmatched'

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Vendor Invoices · A/P</h2>
          <span className="badge">{counts.review} to review</span>
          {counts.staged > 0 && <span className="badge" style={{ background: '#E3F1E8', color: '#166534' }}>{counts.staged} staged</span>}
        </div>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={openCapture}>+ Capture invoice</button>
      </div>
      <OrgBar {...org} />

      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0 }}>
        Snap or upload a vendor bill — Quincy reads it, matches it to its PO, and checks ordered vs. received vs. billed.
        Approve it to stage it for payment; the Bookkeeping module picks up staged bills.
      </p>

      {msg && <div style={{ marginBottom: 12, background: '#E3F1E8', border: '1px solid #166534', color: '#166534', padding: '8px 12px', borderRadius: 8, fontWeight: 600, fontSize: 13 }}>{msg}</div>}
      {err && <div className="auth-error" style={{ marginBottom: 12 }}>{err}</div>}

      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* LEFT — A/P queue */}
        <div style={{ flex: '1 1 340px', minWidth: 300, maxWidth: 460 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 140 }}><label>Search</label>
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Invoice #, vendor, or PO…" />
            </div>
            <div className="field" style={{ marginBottom: 0 }}><label>Show</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="review">Needs review</option>
                <option value="staged">Staged for payment</option>
                <option value="hold">On hold</option>
                <option value="all">All</option>
              </select>
            </div>
          </div>
          <div style={{ border: '1px solid var(--line, #E2E8F0)', borderRadius: 10, overflow: 'hidden', maxHeight: 640, overflowY: 'auto' }}>
            {rows.map((v) => {
              const active = v.id === selectedId
              return (
                <div key={v.id} onClick={() => openInvoice(v.id)}
                  style={{ padding: '10px 13px', cursor: 'pointer', borderBottom: '1px solid #EEF1F6', background: active ? '#EEF3FB' : '#fff', borderLeft: active ? '3px solid #1B3A6B' : '3px solid transparent' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                    <div style={{ fontWeight: 600, color: '#132A4C' }}>{v.vendor?.name || 'Unknown vendor'}</div>
                    {badge(MATCH, v.match_status)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--mist)' }}>
                    {v.invoice_number ? `#${v.invoice_number}` : '(no #)'}{v.po?.po_number ? ` · ${v.po.po_number}` : ''}{v.total ? ` · ${money(v.total)}` : ''}{v.invoice_date ? ` · ${fmtDate(v.invoice_date)}` : ''}
                  </div>
                </div>
              )
            })}
            {rows.length === 0 && <div style={{ padding: 16, color: 'var(--mist)' }}>No invoices in this view.</div>}
          </div>
        </div>

        {/* RIGHT — detail / 3-way match */}
        <div style={{ flex: '2 1 480px', minWidth: 320 }}>
          {!detail ? (
            <div style={{ border: '1px dashed #CBD5E1', borderRadius: 12, padding: '48px 24px', textAlign: 'center', color: 'var(--mist)' }}>
              Select an invoice, or capture a new one.
            </div>
          ) : (
            <div style={{ border: '1px solid var(--line, #E2E8F0)', borderRadius: 12, padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#132A4C', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    {detail.vendor?.name || 'Unknown vendor'} {badge(STATUS, detail.status)} {badge(MATCH, detailMatch)}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--mist)', marginTop: 2 }}>
                    {detail.invoice_number ? `Invoice #${detail.invoice_number}` : '(no invoice #)'}
                    {detail.invoice_date ? ` · ${fmtDate(detail.invoice_date)}` : ''}
                    {detail.doc_type && detail.doc_type !== 'invoice' ? ` · ${detail.doc_type.replace('_', ' ')}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {fileUrl && <a className="logout-button" href={fileUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>View original</a>}
                  {detail.status !== 'staged' && <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={busy} onClick={stage}>Stage for payment</button>}
                  {detail.status === 'staged' && <button className="logout-button" disabled={busy} onClick={() => setStatus('review')}>Back to review</button>}
                  {detail.status !== 'hold' && <button className="logout-button" disabled={busy} onClick={() => setStatus('hold')}>Hold</button>}
                  <button className="logout-button" style={{ color: '#B00020', borderColor: '#F0B4B4' }} disabled={busy} onClick={removeInvoice}>Delete</button>
                </div>
              </div>

              {/* PO link */}
              <div className="field" style={{ marginTop: 12, maxWidth: 360 }}>
                <label>Matched purchase order</label>
                <select value={detail.po_id || ''} onChange={(e) => relink(e.target.value)} disabled={busy}>
                  <option value="">— not linked to a PO —</option>
                  {detailPOs.map((p) => <option key={p.id} value={p.id}>{p.po_number}{p.job_name ? ` · ${p.job_name}` : ''}</option>)}
                  {detail.po && !detailPOs.some((p) => p.id === detail.po_id) && (
                    <option value={detail.po_id}>{detail.po.po_number}{detail.po.job_name ? ` · ${detail.po.job_name}` : ''}</option>
                  )}
                </select>
              </div>

              {/* 3-way match table */}
              <table className="data-table" style={{ marginTop: 12 }}>
                <thead>
                  <tr>
                    <th>Line</th>
                    <th style={{ textAlign: 'right', width: 90 }}>Billed</th>
                    <th style={{ textAlign: 'right', width: 70 }}>Ordered</th>
                    <th style={{ textAlign: 'right', width: 70 }}>Received</th>
                    <th style={{ width: 130 }}>Match</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.lines || []).map((l) => {
                    const pl = l.po_line_id ? poLineById[l.po_line_id] : null
                    const st = lineState(l, pl)
                    const billedCost = l.unit_cost == null ? null : Number(l.unit_cost)
                    return (
                      <tr key={l.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: '#152238' }}>{l.description || l.item?.description || '(line)'}</div>
                          <div style={{ fontSize: 11, color: 'var(--mist)' }}>{l.sku ? `${l.sku} · ` : ''}{Number(l.quantity) || 0} × {money(billedCost)}</div>
                        </td>
                        <td style={{ textAlign: 'right' }}>{money(l.extended_cost != null ? l.extended_cost : (billedCost != null ? billedCost * (Number(l.quantity) || 0) : null))}</td>
                        <td style={{ textAlign: 'right', color: 'var(--mist)' }}>{pl ? Number(pl.qty_ordered || 0) : '—'}</td>
                        <td style={{ textAlign: 'right', color: 'var(--mist)' }}>{pl ? Number(pl.qty_received || 0) : '—'}</td>
                        <td>
                          {st === 'matched' && <span className="badge" style={{ background: '#E3F1E8', color: '#166534' }}>OK</span>}
                          {st === 'price_variance' && <span className="badge" style={{ background: '#FBE7E7', color: '#B00020' }}>Price ≠ PO {money(pl?.unit_cost)}</span>}
                          {st === 'qty_variance' && <span className="badge" style={{ background: '#F8EEDD', color: '#B0600A' }}>Billed &gt; received</span>}
                          {st === 'unmatched' && <span className="badge" style={{ background: '#EEF1F6', color: '#475569' }}>No PO line</span>}
                        </td>
                      </tr>
                    )
                  })}
                  {(detail.lines || []).length === 0 && <tr><td colSpan="5" style={{ color: 'var(--mist)' }}>No lines on this invoice.</td></tr>}
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1B3A6B' }}>Invoice total {money(detail.total)}</div>
                {detail.po_id && (detail.doc_type === 'invoice' || detail.doc_type === 'packing_slip') && (
                  <button className="logout-button" disabled={busy} onClick={receiveFromDoc} title="Receive the matched quantities into stock against the PO">
                    Receive matched items into stock
                  </button>
                )}
              </div>
              {detailMatch === 'exception' && (
                <p style={{ color: '#B0600A', fontSize: 12.5, marginTop: 8 }}>
                  This bill has variances against the PO (price or quantity). Review the flagged lines before staging — you can still stage it if the difference is expected.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {capOpen && (
        <CaptureModal
          cap={cap} capStep={capStep} capBusy={capBusy} capErr={capErr} candPOs={candPOs}
          vendors={vendors} items={items}
          onFile={handleFile} onVendor={onCapVendor} setCap={setCap} setCapLine={setCapLine}
          onSave={saveCapture} onClose={() => setCapOpen(false)}
        />
      )}
    </div>
  )
}

function CaptureModal({ cap, capStep, capBusy, capErr, candPOs, vendors, items, onFile, onVendor, setCap, setCapLine, onSave, onClose }) {
  const backdrop = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 2vw', overflowY: 'auto', zIndex: 1100 }
  const card = { background: '#fff', borderRadius: 12, padding: 24, maxWidth: 1100, width: '96vw', boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }
  return (
    <div style={backdrop} onClick={onClose}>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Capture vendor invoice · Quincy</h3>
        {capStep === 'upload' && (
          <div>
            <p style={{ color: 'var(--mist)', fontSize: 14 }}>
              Upload a vendor invoice, packing slip, or quote (PDF or photo). Quincy reads it, matches the vendor,
              the PO, and each line to your catalog, then shows everything for you to confirm before saving.
            </p>
            <label className="auth-button" style={{ width: 'auto', padding: '10px 22px', cursor: 'pointer', display: 'inline-block', margin: 0 }}>
              {capBusy ? 'Reading…' : 'Choose file'}
              <input type="file" accept="application/pdf,image/*" onChange={onFile} disabled={capBusy} style={{ display: 'none' }} />
            </label>
            {capErr && <div className="auth-error" style={{ marginTop: 12 }}>{capErr}</div>}
            <div style={{ marginTop: 16 }}><button className="logout-button" onClick={onClose}>Cancel</button></div>
          </div>
        )}

        {capStep === 'review' && cap && (
          <div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
              <div className="field" style={{ width: 160 }}><label>Document</label>
                <select value={cap.docType} onChange={(e) => setCap((c) => ({ ...c, docType: e.target.value }))}>
                  <option value="invoice">Invoice</option>
                  <option value="packing_slip">Packing slip</option>
                  <option value="quote">Quote</option>
                </select>
              </div>
              <div className="field" style={{ flex: 1, minWidth: 180 }}><label>Vendor</label>
                <select value={cap.vendorId} onChange={(e) => onVendor(e.target.value)}>
                  <option value="__new__">+ New vendor…</option>
                  {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
                {cap.vendorId === '__new__' && <input style={{ marginTop: 6 }} value={cap.newVendorName} onChange={(e) => setCap((c) => ({ ...c, newVendorName: e.target.value }))} placeholder="New vendor name" />}
              </div>
              <div className="field" style={{ width: 130 }}><label>Invoice #</label>
                <input value={cap.invoiceNumber} onChange={(e) => setCap((c) => ({ ...c, invoiceNumber: e.target.value }))} />
              </div>
              <div className="field" style={{ width: 150 }}><label>Match to PO</label>
                <select value={cap.poId} onChange={(e) => setCap((c) => ({ ...c, poId: e.target.value }))}>
                  <option value="">— none —</option>
                  {candPOs.map((p) => <option key={p.id} value={p.id}>{p.po_number}{p.job_name ? ` · ${p.job_name}` : ''}</option>)}
                </select>
              </div>
              <div className="field" style={{ width: 140 }}><label>Invoice date</label>
                <input type="date" value={cap.invoiceDate} onChange={(e) => setCap((c) => ({ ...c, invoiceDate: e.target.value }))} />
              </div>
              <div className="field" style={{ width: 140 }}><label>Due date</label>
                <input type="date" value={cap.dueDate} onChange={(e) => setCap((c) => ({ ...c, dueDate: e.target.value }))} />
              </div>
            </div>
            {cap.customerPo && <p style={{ fontSize: 12, color: 'var(--mist)', marginTop: -4 }}>Buyer reference read from the document: <strong>{cap.customerPo}</strong>{cap.poId ? '' : ' — no matching PO found, pick one above if it applies.'}</p>}

            <div style={{ overflowX: 'auto', border: '1px solid var(--line, #E2E8F0)', borderRadius: 8 }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead><tr><th>Vendor line</th><th style={{ minWidth: 190 }}>Maps to catalog item</th><th style={{ textAlign: 'right', width: 70 }}>Qty</th><th style={{ width: 70 }}>Unit</th><th style={{ textAlign: 'right', width: 90 }}>Unit cost</th><th style={{ textAlign: 'right', width: 90 }}>Extended</th></tr></thead>
                <tbody>
                  {cap.lines.map((l, i) => (
                    <tr key={i}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{l.sku ? `${l.sku} · ` : ''}{l.description}</div>
                      </td>
                      <td style={{ minWidth: 190 }}>
                        <select value={l.item_id || ''} onChange={(e) => setCapLine(i, { item_id: e.target.value })}
                          style={{ width: '100%', border: l.item_id ? undefined : '1px solid #E4B36B' }}>
                          <option value="">— text only (no catalog item) —</option>
                          {items.map((it) => <option key={it.id} value={it.id}>{it.description}</option>)}
                        </select>
                        {!l.item_id && <div style={{ fontSize: 11, color: '#B0600A', marginTop: 2 }}>Pick the part so Quincy remembers this vendor's name for it</div>}
                      </td>
                      <td style={{ textAlign: 'right' }}><input type="number" step="any" value={l.quantity} onChange={(e) => setCapLine(i, { quantity: e.target.value })} style={{ width: 60, textAlign: 'right' }} /></td>
                      <td style={{ fontSize: 12, color: 'var(--mist)' }}>{l.unit_of_measure || '—'}</td>
                      <td style={{ textAlign: 'right' }}><input type="number" step="any" value={l.unit_cost} onChange={(e) => setCapLine(i, { unit_cost: e.target.value })} style={{ width: 78, textAlign: 'right' }} placeholder="$" /></td>
                      <td style={{ textAlign: 'right' }}><input type="number" step="any" value={l.extended_cost} onChange={(e) => setCapLine(i, { extended_cost: e.target.value })} style={{ width: 78, textAlign: 'right' }} placeholder="$" /></td>
                    </tr>
                  ))}
                  {cap.lines.length === 0 && <tr><td colSpan="6" style={{ color: 'var(--mist)' }}>No line items were read from this document.</td></tr>}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 12, color: 'var(--mist)' }}>Saved as a bill in <b>Needs review</b>. Once linked to a PO, the 3-way match (ordered vs received vs billed) runs automatically on the detail view.</p>
            {capErr && <div className="auth-error" style={{ marginBottom: 10 }}>{capErr}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="auth-button" style={{ width: 'auto', margin: 0, padding: '10px 22px' }} disabled={capBusy} onClick={onSave}>{capBusy ? 'Saving…' : 'Save bill'}</button>
              <button className="logout-button" onClick={onClose}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
