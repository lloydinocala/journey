import { useState, useEffect, useRef } from 'react'
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

const BASE_UNITS = ['each', 'ounce', 'pound', 'foot', 'linear foot', 'gallon', 'quart', 'box', 'roll', 'kit']

const BUCKETS = [
  { v: 'shop', label: 'Shop / Truck Stock', short: 'Shop' },
  { v: 'hand_tools', label: 'Hand Tools', short: 'Tools' },
  { v: 'shop_supplies', label: 'Shop Supplies', short: 'Supplies' },
  { v: 'job', label: 'Job-Specific', short: 'Job' },
]
const bucketLabel = (v) => (BUCKETS.find((b) => b.v === v)?.short || '—')

// The numeric core of a Journey job number, ignoring the "J-", leading zeros,
// and any "-<segment>" suffix. "J-0017" and "J-0017-2" both -> "17".
function jobCore(s) { return (String(s || '').toUpperCase().match(/J-?0*(\d+)/) || [])[1] || '' }

function jobLabel(j) {
  const seg = j.segment && j.segment > 1 ? `-${j.segment}` : ''
  return `${j.job_number || 'Job'}${seg}${j.job_date ? ' · ' + j.job_date : ''}`
}

// Guess an item's base unit from its description (refrigerant is stocked in ounces).
function guessBaseUnit(desc) {
  const t = (desc || '').toUpperCase()
  if (/R-?410|R-?32|R-?22|R-?454|REFRIGERANT|FREON|PURON/.test(t)) return 'ounce'
  return 'each'
}

// Infer base-units-per-purchase-pack from the printed description / unit label.
// e.g. a "25 LB" refrigerant jug with base ounce = 400; "12/CS" = 12.
function inferPackBase(desc, unitLabel, baseUnit) {
  const t = `${desc || ''} ${unitLabel || ''}`.toUpperCase()
  const lb = t.match(/(\d+(?:\.\d+)?)\s*(?:LBS?|#)\b/)
  if (lb) { const n = parseFloat(lb[1]); if (baseUnit === 'ounce') return n * 16; if (baseUnit === 'pound') return n; return n }
  const gal = t.match(/(\d+(?:\.\d+)?)\s*GAL/)
  if (gal) { const n = parseFloat(gal[1]); if (baseUnit === 'ounce') return n * 128; if (baseUnit === 'quart') return n * 4; return n }
  const oz = t.match(/(\d+(?:\.\d+)?)\s*OZ\b/)
  if (oz) { const n = parseFloat(oz[1]); if (baseUnit === 'ounce') return n; return 1 }
  const perCase = t.match(/(\d+)\s*(?:\/|PER)\s*(?:CS|CASE|BX|BOX|PK|PACK|CT)/) || t.match(/(?:CS|CASE|BX|BOX|PK|PACK)\s*(?:OF|\/)?\s*(\d+)/) || t.match(/(\d+)\s*(?:PK|PACK|CT|COUNT)\b/)
  if (perCase && baseUnit === 'each') { const n = parseInt(perCase[1], 10); if (n > 0) return n }
  return 1
}

// Advisory flag so the office confirms the messy owner-ticket lines instead of hunting.
const TOOL_WORDS = /(SCREWDRIVER|PLIER|WRENCH|DRILL|BLADE|NUT ?DRIVER|HAMMER|GLOVE|TAPE MEASURE|LEVEL|SNIP|CUTTER|GAUGE SET|MANIFOLD|VACUUM PUMP|RECOVERY|BIT SET|FLASHLIGHT|MULTIMETER|CLAMP METER)/
const EQUIP_WORDS = /(HEAT PUMP|CONDENSER|CONDENSING UNIT|AIR HANDLER|FURNACE|EVAPORATOR|COIL|PACKAGE UNIT|MINI ?SPLIT|AHU|GAS PACK|CASED COIL)/
function lineHint(desc) {
  const t = (desc || '').toUpperCase()
  if (TOOL_WORDS.test(t)) return 'tool'
  if (EQUIP_WORDS.test(t)) return 'equipment'
  return null
}

const backdrop = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 2vw', overflowY: 'auto', zIndex: 1100 }
const card = { background: '#fff', borderRadius: 12, padding: 24, maxWidth: 1500, width: '97vw', boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }
const th = { padding: '8px 10px', fontSize: 12, fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap' }
const td = { padding: '7px 10px', verticalAlign: 'top', fontSize: 13 }

// Quincy invoice import — upload -> extract -> classify/match -> apply.
// Every line is classified into Shop (receives stock), Hand Tools / Shop Supplies
// (overhead expense) or Job-Specific (books to a job). Only Shop touches on-hand.
export default function QuincyInvoiceImport({ orgId, items, vendors, offersByItem, onClose, onApplied, seedInbound }) {
  const [step, setStep] = useState(seedInbound ? 'loading' : 'upload')   // 'upload'|'loading'|'review'|'done'
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

  // Classification context
  const [jobs, setJobs] = useState([])
  const [customers, setCustomers] = useState([])
  const [dataReady, setDataReady] = useState(false)
  const [invoiceBucket, setInvoiceBucket] = useState('')   // whole-invoice default
  const [invoiceJobId, setInvoiceJobId] = useState('')
  const [dupRefs, setDupRefs] = useState(0)                // prior imports with same reference
  const [dupAck, setDupAck] = useState(false)
  const classifiedRef = useRef(false)

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

  // Load open jobs + customers for PO-based classification.
  useEffect(() => {
    if (!orgId) return
    let cancel = false
    ;(async () => {
      const [jRes, cRes] = await Promise.all([
        supabase.from('jobs').select('id, job_number, segment, status, customer_id, job_date')
          .eq('org_id', orgId).in('status', ['scheduled', 'in_progress', 'on_my_way', 'incomplete'])
          .order('job_date', { ascending: false }),
        supabase.from('customers').select('id, first_name, last_name, display_name, company')
          .eq('org_id', orgId).eq('is_active', true),
      ])
      if (cancel) return
      setJobs(jRes.data || []); setCustomers(cRes.data || []); setDataReady(true)
    })()
    return () => { cancel = true }
  }, [orgId])

  // Seeded from a queued (emailed) invoice that was already extracted server-side.
  useEffect(() => {
    if (seedInbound?.extracted) loadExtracted(seedInbound.extracted)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Classify the whole invoice from its PO/reference once both the document and the
  // jobs/customers lists are available. Deterministic Job # first, then keywords,
  // then a customer last-name match; anything unsure stays blank ("hold for review").
  useEffect(() => {
    if (!extracted || !dataReady || classifiedRef.current) return
    classifiedRef.current = true
    const raw = (reference || extracted.invoice_number || '').trim()
    let bucket = '', jobId = ''
    const up = raw.toUpperCase()
    const core = jobCore(raw)
    if (core) {
      const j = jobs.find((x) => jobCore(x.job_number) === core)
      if (j) { bucket = 'job'; jobId = j.id }
    }
    if (!bucket && /TRUCK|STOCK|SHOP|WAREHOUSE/.test(up)) bucket = 'shop'
    if (!bucket && /TOOL/.test(up)) bucket = 'hand_tools'
    if (!bucket) {
      const toks = norm(raw).split(' ').filter((w) => w.length > 2)
      for (const c of customers) {
        const ln = norm(c.last_name)
        if (ln && toks.includes(ln)) {
          bucket = 'job'
          const cj = jobs.filter((x) => x.customer_id === c.id)
          if (cj.length === 1) jobId = cj[0].id
          break
        }
      }
    }
    if (bucket) {
      setInvoiceBucket(bucket); setInvoiceJobId(jobId)
      setLines((ls) => ls.map((l) => ({ ...l, bucket: l.bucket || bucket, job_id: l.job_id || jobId })))
    }
  }, [extracted, dataReady])  // eslint-disable-line react-hooks/exhaustive-deps

  // Warn if this reference was already imported (dedupe invoice vs packing slip).
  useEffect(() => {
    const ref = (reference || '').trim()
    if (!ref || !orgId) { setDupRefs(0); return }
    let cancel = false
    ;(async () => {
      const [r1, r2] = await Promise.all([
        supabase.from('part_receipts').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('reference', ref),
        supabase.from('part_expense_lines').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('reference', ref),
      ])
      if (cancel) return
      setDupRefs((r1.count || 0) + (r2.count || 0))
      setDupAck(false)
    })()
    return () => { cancel = true }
  }, [reference, orgId])

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
      loadExtracted(data)
    } catch (err) {
      setError(err.message || String(err))
    }
    setBusy(false)
  }

  function loadExtracted(data) {
    if (!data) { setError('Nothing could be read from this document.'); setStep('upload'); return }
    try {
      classifiedRef.current = false
      setExtracted(data)
      setDocType(data.doc_type === 'quote' ? 'quote' : (data.doc_type === 'packing_slip' ? 'packing_slip' : 'invoice'))
      setReference(data.invoice_number || '')
      setReceivedDate(data.invoice_date && /^\d{4}-\d{2}-\d{2}$/.test(data.invoice_date) ? data.invoice_date : '')

      // Resolve vendor by fuzzy name.
      let vMatch = null, vScore = 0
      for (const v of vendors) { const s = overlapScore(data.vendor_name, v.name); if (s > vScore) { vScore = s; vMatch = v } }
      if (vMatch && vScore >= 0.5) { setVendorId(vMatch.id); setNewVendorName('') }
      else { setVendorId('__new__'); setNewVendorName(data.vendor_name || '') }

      // Resolve each line: SKU match first, else description match, else new.
      const resolved = (data.lines || []).map((ln) => {
        let itemId = '', packBase = null, baseUnit = ''
        const skuHit = ln.sku ? allOffers.find((o) => norm(o.vendor_sku) && norm(o.vendor_sku) === norm(ln.sku)) : null
        if (skuHit) { itemId = skuHit.item_id; packBase = Number(skuHit.pack_base_qty) || 1; baseUnit = items.find((x) => x.id === skuHit.item_id)?.base_unit || 'each' }
        else {
          const it = bestItemByDesc(ln.description)
          if (it) { itemId = it.id; baseUnit = it.base_unit || 'each'; packBase = 1 }
        }
        // New item: guess base unit + infer pack size from the printed text so a
        // 25 lb refrigerant jug lands as 400 oz, not 1 "each" (the old default).
        if (!itemId) { baseUnit = guessBaseUnit(ln.description); packBase = inferPackBase(ln.description, ln.unit_of_measure, baseUnit) }

        // Anchor cost to the line's EXTENDED total when shown (that's the real money
        // paid); fall back to printed unit price. Full precision until display.
        const qNum = Number(ln.quantity) || 0
        const unitCost = (ln.extended_cost != null && qNum > 0)
          ? Number(ln.extended_cost) / qNum
          : (ln.unit_cost != null ? Number(ln.unit_cost) : null)
        return {
          include: true,
          sku: ln.sku || '',
          description: ln.description || '',
          quantity: ln.quantity != null ? String(ln.quantity) : '1',
          unit_label: ln.unit_of_measure || '',
          unit_cost: unitCost != null ? String(unitCost) : '',
          item_id: itemId || '__new__',
          new_name: itemId ? '' : (ln.description || ''),
          base_unit: baseUnit || 'each',
          pack_base_qty: String(packBase != null ? packBase : 1),
          bucket: '',
          job_id: '',
          hint: lineHint(ln.description),
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

  // Whole-invoice classifier: cascade to every line.
  function classifyAll(bucket, jobId) {
    setInvoiceBucket(bucket)
    if (jobId !== undefined) setInvoiceJobId(jobId)
    const jid = jobId !== undefined ? jobId : invoiceJobId
    setLines((ls) => ls.map((l) => ({ ...l, bucket, job_id: bucket === 'job' ? (l.job_id || jid) : '' })))
  }

  const includedLines = lines.filter((l) => l.include)
  const unclassified = includedLines.some((l) => !l.bucket)
  const jobMissing = includedLines.some((l) => l.bucket === 'job' && !l.job_id)
  const blocked = includedLines.length === 0 || unclassified || jobMissing || (dupRefs > 0 && !dupAck)

  async function apply() {
    setBusy(true); setError('')
    try {
      let vId = vendorId
      if (vId === '__new__') {
        if (!newVendorName.trim()) { setError('Enter or pick a vendor.'); setBusy(false); return }
        const { data: v, error: vErr } = await supabase.from('vendors')
          .insert({ org_id: orgId, name: newVendorName.trim(), is_active: true }).select('id').single()
        if (vErr) { setError(vErr.message); setBusy(false); return }
        vId = v.id
      }

      const isReceipt = docType === 'invoice' || docType === 'packing_slip'
      const pricedDoc = docType !== 'packing_slip'   // packing slips confirm receipt but never set price
      const purchasedAt = receivedDate ? new Date(receivedDate + 'T12:00:00').toISOString() : new Date().toISOString()

      const receiveLines = []
      const expenseRows = []
      let created = 0

      for (const l of lines) {
        if (!l.include) continue
        const bucket = l.bucket
        const packBase = parseFloat(l.pack_base_qty) || 1
        const qty = parseFloat(l.quantity) || 0
        const unitCost = l.unit_cost === '' ? null : parseFloat(l.unit_cost)
        const costBase = unitCost != null && packBase > 0 ? unitCost / packBase : null
        const extended = unitCost != null ? unitCost * qty : null

        // Resolve/create the item. Non-shop new items are non-inventory (never stocked).
        let itemId = l.item_id
        if (itemId === '__none__') itemId = null
        else if (itemId === '__new__') {
          const { data: it, error: itErr } = await supabase.from('part_items').insert({
            org_id: orgId,
            generic_name: (l.new_name || l.description || 'New item').trim(),
            base_unit: l.base_unit || 'each',
            sell_unit: l.base_unit || 'each',
            sell_unit_factor: 1,
            is_inventory: bucket === 'shop',
          }).select('id').single()
          if (itErr) { setError(itErr.message); setBusy(false); return }
          itemId = it.id; created++
        }

        // Vendor offering (cross-reference + price history) — priced docs only.
        if (itemId && pricedDoc) {
          const existing = allOffers.find((o) => o.vendor_id === vId && norm(o.vendor_sku) && norm(o.vendor_sku) === norm(l.sku))
          const offPayload = {
            vendor_description: l.description || null,
            pack_label: l.unit_label || null,
            pack_base_qty: packBase,
            last_cost_per_pack: unitCost,
            last_cost_per_base_unit: costBase,
            last_seen_at: new Date().toISOString(),
          }
          if (existing) await supabase.from('part_vendor_offerings').update(offPayload).eq('id', existing.id)
          else await supabase.from('part_vendor_offerings').insert({ org_id: orgId, item_id: itemId, vendor_id: vId, vendor_sku: l.sku || null, ...offPayload })
        }

        if (bucket === 'shop') {
          // Shop receives stock (reversible). Packing slips receive qty with no cost.
          if (isReceipt && qty * packBase > 0) {
            receiveLines.push({ item_id: itemId, qty_base: qty * packBase, cost_per_base: pricedDoc ? costBase : null })
          }
        } else if (bucket === 'job' || bucket === 'hand_tools' || bucket === 'shop_supplies') {
          // Expense / job cost — never touches on-hand. Quotes are pricing only.
          if (isReceipt) {
            expenseRows.push({
              org_id: orgId, vendor_id: vId, reference: reference.trim() || null, purchased_at: purchasedAt,
              bucket, job_id: bucket === 'job' ? (l.job_id || null) : null, item_id: itemId,
              description: l.description || null, quantity: qty || null,
              unit_cost: unitCost, extended_cost: extended, source: docType,
            })
            // Keep a non-inventory item's catalog "last cost" current for estimating.
            if (itemId && costBase != null && pricedDoc) {
              await supabase.from('part_items').update({ last_cost: costBase, last_cost_update_at: new Date().toISOString() }).eq('id', itemId)
            }
          }
        }
      }

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

      let expensed = 0, jobCost = 0, toolCost = 0
      if (expenseRows.length) {
        const { error: eErr } = await supabase.from('part_expense_lines').insert(expenseRows)
        if (eErr) { setError(eErr.message); setBusy(false); return }
        expensed = expenseRows.length
        for (const r of expenseRows) { if (r.bucket === 'job') jobCost += r.extended_cost || 0; else toolCost += r.extended_cost || 0 }
      }

      if (seedInbound?.id) {
        await supabase.from('part_inbound_invoices').update({ status: 'applied', applied_batch: receiptId }).eq('id', seedInbound.id)
      }

      setSummary({ docType, itemsCreated: created, received: receiveLines.length, expensed, jobCost, toolCost })
      setStep('done')
      onApplied?.()
    } catch (err) {
      setError(err.message || String(err))
    }
    setBusy(false)
  }

  const jobsForCustomerless = jobs   // full open-job list for the pickers

  return (
    <div className="modal-backdrop" onClick={onClose} style={backdrop}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={card}>
        <h3 style={{ marginTop: 0 }}>Import from Invoice · Quincy</h3>

        {step === 'loading' && <p style={{ color: 'var(--mist,#777)' }}>Loading the emailed invoice…</p>}

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
              <div className="field" style={{ width: 170 }}>
                <label>Document type</label>
                <select value={docType} onChange={(e) => setDocType(e.target.value)}>
                  <option value="invoice">Invoice (priced)</option>
                  <option value="packing_slip">Packing slip (no price)</option>
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
              <div className="field" style={{ width: 160 }}>
                <label>PO / Invoice #</label>
                <input value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>
              <div className="field" style={{ width: 150 }}>
                <label>Date</label>
                <input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} />
              </div>
            </div>

            {/* Whole-invoice classifier */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '10px 12px', background: '#F5F7FB', border: '1px solid #E1E7F0', borderRadius: 8, marginBottom: 10 }}>
              <span style={{ fontWeight: 700, color: '#002060', fontSize: 13 }}>Classify all lines as:</span>
              {BUCKETS.map((b) => (
                <button key={b.v} onClick={() => classifyAll(b.v)} type="button"
                  style={{ padding: '6px 12px', borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                    border: invoiceBucket === b.v ? '2px solid #002060' : '1px solid #C9D2E0',
                    background: invoiceBucket === b.v ? '#002060' : '#fff', color: invoiceBucket === b.v ? '#fff' : '#334155' }}>
                  {b.label}
                </button>
              ))}
              {invoiceBucket === 'job' && (
                <select value={invoiceJobId} onChange={(e) => classifyAll('job', e.target.value)} style={{ minWidth: 200 }}>
                  <option value="">— pick job —</option>
                  {jobsForCustomerless.map((j) => <option key={j.id} value={j.id}>{jobLabel(j)}</option>)}
                </select>
              )}
              <span style={{ fontSize: 12, color: 'var(--mist,#777)' }}>then override any line below</span>
            </div>

            {docType === 'quote' && (
              <p style={{ fontSize: 12, color: '#215F9A', marginTop: -4 }}>Quote: updates item/vendor pricing and creates new items — no stock received, nothing expensed.</p>
            )}
            {docType === 'packing_slip' && (
              <p style={{ fontSize: 12, color: '#215F9A', marginTop: -4 }}>Packing slip: confirms what arrived (receives Shop qty) but sets no cost — cost comes from the priced invoice.</p>
            )}
            {dupRefs > 0 && (
              <div style={{ background: '#FFF4F4', border: '1px solid #FFD1D1', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
                <div style={{ fontWeight: 700, color: '#B00020', marginBottom: 4 }}>Possible duplicate</div>
                <div style={{ fontSize: 13, color: '#334155', marginBottom: 6 }}>
                  Reference “{reference}” was already imported ({dupRefs} prior line{dupRefs === 1 ? '' : 's'}). This may be the packing slip for an invoice you already received.
                </div>
                <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={dupAck} onChange={(e) => setDupAck(e.target.checked)} /> Import anyway
                </label>
              </div>
            )}

            <div style={{ overflowX: 'auto', border: '1px solid var(--border,#e2e4e8)', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: '#002060', color: '#fff' }}>
                  <th style={th}>Use</th><th style={th}>Vendor line (SKU · description)</th><th style={{ ...th, textAlign: 'right' }}>Qty</th>
                  <th style={{ ...th, textAlign: 'right' }}>Unit cost</th><th style={th}>Class</th><th style={th}>Maps to item</th>
                  <th style={{ ...th, textAlign: 'right' }}>Pack size</th><th style={{ ...th, textAlign: 'right' }}>Result</th>
                </tr></thead>
                <tbody>
                  {lines.map((l, i) => {
                    const it = items.find((x) => x.id === l.item_id)
                    const isNew = l.item_id === '__new__'
                    const base = isNew ? (l.base_unit || 'each') : (it?.base_unit || 'each')
                    const packBase = parseFloat(l.pack_base_qty) || 0
                    const qty = parseFloat(l.quantity) || 0
                    const unitCost = l.unit_cost === '' ? null : parseFloat(l.unit_cost)
                    const costBase = unitCost != null && packBase > 0 ? unitCost / packBase : null
                    const extended = unitCost != null ? unitCost * qty : null
                    const needsClass = l.include && !l.bucket
                    return (
                      <tr key={i} style={{ borderTop: '1px solid var(--border,#e2e4e8)', opacity: l.include ? 1 : 0.5 }}>
                        <td style={td}><input type="checkbox" checked={l.include} onChange={(e) => setLine(i, { include: e.target.checked })} /></td>
                        <td style={td}>
                          <div style={{ fontWeight: 600 }}>{l.sku ? `${l.sku} · ` : ''}{l.description}</div>
                          {l.unit_label && <div style={{ fontSize: 11, color: 'var(--mist,#777)' }}>as printed: {l.unit_label}</div>}
                          {l.hint === 'tool' && l.bucket !== 'hand_tools' && l.bucket !== 'shop_supplies' && <div style={{ fontSize: 11, color: '#7A5C00' }}>↳ looks like a tool</div>}
                          {l.hint === 'equipment' && l.bucket !== 'job' && <div style={{ fontSize: 11, color: '#7A5C00' }}>↳ looks like equipment (job-specific?)</div>}
                        </td>
                        <td style={{ ...td, textAlign: 'right' }}><input type="number" step="any" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} style={{ width: 56, textAlign: 'right' }} /></td>
                        <td style={{ ...td, textAlign: 'right' }}><input type="number" step="any" value={l.unit_cost} onChange={(e) => setLine(i, { unit_cost: e.target.value })} style={{ width: 80, textAlign: 'right' }} placeholder="$" /></td>
                        <td style={td}>
                          <select value={l.bucket} onChange={(e) => setLine(i, { bucket: e.target.value })}
                            style={{ minWidth: 120, border: needsClass ? '2px solid #FF0000' : undefined }}>
                            <option value="">— pick —</option>
                            {BUCKETS.map((b) => <option key={b.v} value={b.v}>{b.label}</option>)}
                          </select>
                          {l.bucket === 'job' && (
                            <select value={l.job_id} onChange={(e) => setLine(i, { job_id: e.target.value })}
                              style={{ marginTop: 4, minWidth: 120, border: !l.job_id ? '2px solid #FF0000' : undefined }}>
                              <option value="">— job —</option>
                              {jobs.map((j) => <option key={j.id} value={j.id}>{jobLabel(j)}</option>)}
                            </select>
                          )}
                        </td>
                        <td style={td}>
                          <select value={l.item_id} onChange={(e) => setLine(i, { item_id: e.target.value })} style={{ minWidth: 150 }}>
                            <option value="__new__">+ New item…</option>
                            {l.bucket !== 'shop' && <option value="__none__">— none (expense only) —</option>}
                            {items.map((x) => <option key={x.id} value={x.id}>{x.generic_name}</option>)}
                          </select>
                          {isNew && (
                            <>
                              <input style={{ marginTop: 4 }} value={l.new_name} onChange={(e) => setLine(i, { new_name: e.target.value })} placeholder="New item name" />
                              <select value={l.base_unit} onChange={(e) => setLine(i, { base_unit: e.target.value, pack_base_qty: String(inferPackBase(l.description, l.unit_label, e.target.value)) })} style={{ marginTop: 4 }}>
                                {BASE_UNITS.map((u) => <option key={u} value={u}>base: {u}</option>)}
                              </select>
                            </>
                          )}
                        </td>
                        <td style={{ ...td, textAlign: 'right' }}>
                          {l.item_id === '__none__' ? <span style={{ color: 'var(--mist,#bbb)' }}>—</span> : (
                            <>
                              <input type="number" step="any" value={l.pack_base_qty} onChange={(e) => setLine(i, { pack_base_qty: e.target.value })} style={{ width: 64, textAlign: 'right' }} />
                              <div style={{ fontSize: 11, color: 'var(--mist,#777)' }}>{base}/unit</div>
                            </>
                          )}
                        </td>
                        <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {l.bucket === 'shop'
                            ? (qty * packBase > 0 ? <>{(qty * packBase).toLocaleString()} {base}{costBase != null && <div style={{ fontSize: 11, color: 'var(--mist,#777)' }}>{money(costBase)}/{base}</div>}</> : '—')
                            : l.bucket
                              ? <>→ {bucketLabel(l.bucket)}{extended != null && <div style={{ fontSize: 11, color: 'var(--mist,#777)' }}>{money(extended)}</div>}</>
                              : <span style={{ color: '#FF0000', fontWeight: 700 }}>classify</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 12, color: 'var(--mist,#777)' }}>
              Only <b>Shop</b> lines change on-hand. Hand Tools &amp; Shop Supplies are expensed; Job-Specific books to the job.
              SKUs you confirm are remembered, so next time this vendor's line matches and classifies automatically.
            </p>
            {error && <div className="auth-error" style={{ marginBottom: 10 }}>{error}</div>}
            {blocked && includedLines.length > 0 && (
              <div style={{ fontSize: 12, color: '#B00020', marginBottom: 8 }}>
                {unclassified && 'Classify every line before approving. '}
                {jobMissing && 'Pick a job for each Job-Specific line. '}
                {dupRefs > 0 && !dupAck && 'Confirm the duplicate above. '}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="auth-button" onClick={apply} disabled={busy || blocked} style={{ width: 'auto', padding: '10px 22px', opacity: blocked ? 0.5 : 1 }}>
                {busy ? 'Applying…' : docType === 'quote' ? 'Approve (update pricing)' : 'Approve'}
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
              {summary.received > 0 && `Received ${summary.received} line${summary.received === 1 ? '' : 's'} into the Shop (reversible in Receipts). `}
              {summary.expensed > 0 && `Expensed ${summary.expensed} line${summary.expensed === 1 ? '' : 's'}${summary.jobCost > 0 ? ` — ${money(summary.jobCost)} to job(s)` : ''}${summary.toolCost > 0 ? `, ${money(summary.toolCost)} to tools/supplies` : ''}. `}
              {summary.received === 0 && summary.expensed === 0 && 'Pricing updated — nothing received or expensed (quote). '}
              {summary.itemsCreated > 0 && `${summary.itemsCreated} new item${summary.itemsCreated === 1 ? '' : 's'} created. `}
            </p>
            <button className="auth-button" style={{ width: 'auto', padding: '9px 18px' }} onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  )
}
