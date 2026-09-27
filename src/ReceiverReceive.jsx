// Journey · Mobile · Receiver — Receive against a PO.
// List of open POs → tap one → enter what physically arrived, line by line, and
// post. Uses the same receivePO ledger as the office, but posts QUANTITIES ONLY
// (no unit cost) — cost is set later from the vendor's invoice in A/P, so the
// receiver never has to touch pricing.
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IconChevronLeft } from './MobileIcons'
import { supabase } from './utils/supabase'
import { listPurchaseOrders, getPurchaseOrder, receivePO, createReceivingFlag } from './modules/elements-hvac/data'

const fileToB64 = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(file) })
const slipTokens = (s) => new Set((s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2))

const fmtD = (d) => (d ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? d + 'T12:00:00' : d).toLocaleDateString() : '')
const FLAG_KINDS = ['Short shipment', 'Wrong part sent', 'Damaged', 'Other']

export default function ReceiverReceive({ profile }) {
  const nav = useNavigate()
  const { poId } = useParams()
  const orgId = profile?.org_id
  const [pos, setPos] = useState([])
  const [loading, setLoading] = useState(true)
  const [po, setPo] = useState(null)
  const [recv, setRecv] = useState({})   // line_id -> qty string
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [flagOpen, setFlagOpen] = useState(false)
  const [flagKind, setFlagKind] = useState('')
  const [flagNote, setFlagNote] = useState('')
  const [flagBusy, setFlagBusy] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanNote, setScanNote] = useState('')

  // Photo-receive: read a packing slip photo and PREFILL the arrived quantities for
  // the receiver to confirm. Reuses the invoice-extract vision function (it already
  // handles packing slips). Nothing is posted from the photo — the receiver still
  // reviews every line and taps Receive.
  async function scanSlip(e) {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file || !po) return
    setScanning(true); setErr(''); setScanNote('')
    try {
      const fileBase64 = await fileToB64(file)
      const { data, error } = await supabase.functions.invoke('invoice-extract', { body: { fileBase64, mediaType: file.type } })
      if (error || data?.error) { setErr(data?.error || error?.message || 'Could not read that slip — enter quantities by hand.'); setScanning(false); return }
      const slipLines = data?.lines || []
      const openLines = (po.lines || []).filter((l) => Math.max(0, Number(l.qty_ordered || 0) - Number(l.qty_received || 0)) > 0)
      const next = { ...recv }; let matched = 0; const unmatched = []
      slipLines.forEach((sl) => {
        const st = slipTokens(`${sl.sku || ''} ${sl.description || ''}`)
        let best = null; let bestScore = 0
        openLines.forEach((l) => {
          const lt = slipTokens(`${l.item?.sku || ''} ${l.item?.description || l.description || ''}`)
          let inter = 0; st.forEach((w) => { if (lt.has(w)) inter++ })
          const j = st.size ? inter / (st.size + lt.size - inter) : 0
          if (j > bestScore) { bestScore = j; best = l }
        })
        if (best && bestScore >= 0.3 && sl.quantity != null) { next[best.id] = String(sl.quantity); matched++ }
        else unmatched.push(sl.description || sl.sku || 'a line')
      })
      setRecv(next)
      setScanNote(`Prefilled ${matched} line${matched === 1 ? '' : 's'} from the slip — please confirm each quantity before you tap Receive.${unmatched.length ? ` Couldn't match: ${unmatched.slice(0, 4).join(', ')}${unmatched.length > 4 ? '…' : ''} — enter those by hand.` : ''}`)
    } catch (ex) { setErr(String(ex)) }
    setScanning(false)
  }

  useEffect(() => {
    if (!orgId) return
    if (poId) { openPo(poId); return }
    setPo(null); setLoading(true); setMsg(''); setErr('')
    listPurchaseOrders(orgId)
      .then((all) => { setPos((all || []).filter((p) => p.status === 'ordered' || p.status === 'partial')); setLoading(false) })
      .catch(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, poId])

  async function openPo(id) {
    setLoading(true); setErr(''); setMsg('')
    const d = await getPurchaseOrder(orgId, id)
    setPo(d)
    const r = {}
    ;(d?.lines || []).forEach((l) => { const rem = Math.max(0, Number(l.qty_ordered || 0) - Number(l.qty_received || 0)); r[l.id] = rem > 0 ? String(rem) : '' })
    setRecv(r); setLoading(false)
  }

  async function submit() {
    const receipts = (po.lines || [])
      .map((l) => ({ line_id: l.id, item_id: l.item_id, qty: recv[l.id] }))
      .filter((r) => (Number(r.qty) || 0) > 0)
    if (!receipts.length) { setErr('Enter what arrived on at least one line.'); return }
    setBusy(true); setErr(''); setMsg('')
    const { error, count } = await receivePO(orgId, po.id, receipts)   // no unit_cost → cost left to A/P
    setBusy(false)
    if (error) { setErr(error.message); return }
    setMsg(`Received ${count} line${count === 1 ? '' : 's'}. On-hand updated.`)
    openPo(po.id)
  }

  async function submitFlag() {
    if (!flagKind) { setErr('Pick what went wrong.'); return }
    setFlagBusy(true); setErr(''); setMsg('')
    const { error } = await createReceivingFlag(orgId, { po_id: po.id, kind: flagKind, note: flagNote, created_by: profile?.id })
    setFlagBusy(false)
    if (error) { setErr(error.message); return }
    setMsg('Problem reported — the office will see it on the dashboard.'); setFlagOpen(false); setFlagKind(''); setFlagNote('')
  }

  // ---------------- detail ----------------
  if (poId) {
    return (
      <div className="mobile-shell job-card-v2">
        <div className="jc-header" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="jc-back" onClick={() => nav('/receiver/receive')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IconChevronLeft /></button>
          <div className="jc-header-text">
            <div className="jc-title">{po?.po_number || 'Purchase order'}</div>
            {po ? <div style={{ fontSize: 13, opacity: 0.85 }}>{po.vendor?.name || 'No vendor'}{po.job_name ? ` · ${po.job_name}` : ''}{po.expected_at ? ` · exp ${fmtD(po.expected_at)}` : ''}</div> : null}
          </div>
        </div>
        <div className="jc-body" style={{ paddingBottom: 110 }}>
          {loading ? <p className="jc-muted-note">Loading…</p> : !po ? <p className="jc-muted-note">Couldn’t load that purchase order.</p> : (
            <>
              {msg && <div style={{ background: '#E3F1E8', border: '1px solid #166534', color: '#166534', padding: '8px 12px', borderRadius: 8, fontWeight: 600, fontSize: 13, marginBottom: 10 }}>{msg}</div>}
              {err && <div className="auth-error" style={{ marginBottom: 10 }}>{err}</div>}
              <p className="jc-muted-note" style={{ marginTop: 0 }}>Enter how many of each part actually arrived. Leave a line at 0 if it didn’t come.</p>
              <label className="auth-button" style={{ width: 'auto', display: 'inline-block', margin: '0 0 10px', padding: '8px 14px', cursor: 'pointer' }}>
                {scanning ? 'Reading slip…' : '📷 Scan packing slip'}
                <input type="file" accept="image/*,application/pdf" capture="environment" onChange={scanSlip} disabled={scanning} style={{ display: 'none' }} />
              </label>
              {scanNote && <div style={{ background: '#EAF1F8', border: '1px solid #B9D0EA', color: '#1B3A6B', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 10 }}>{scanNote}</div>}
              {(po.lines || []).map((l) => {
                const rem = Math.max(0, Number(l.qty_ordered || 0) - Number(l.qty_received || 0))
                const done = rem <= 0
                return (
                  <div key={l.id} style={{ border: '1px solid var(--border,#e2e8f0)', borderRadius: 10, padding: '10px 12px', marginBottom: 8, background: '#fff' }}>
                    <div style={{ fontWeight: 600, color: '#152238' }}>{l.item?.description || l.description || '(part)'}</div>
                    <div style={{ fontSize: 12, color: 'var(--mist)', margin: '2px 0 8px' }}>
                      Ordered {Number(l.qty_ordered || 0)} · already received {Number(l.qty_received || 0)}{done ? ' · complete ✓' : ` · ${rem} still due`}
                    </div>
                    {!done && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <label style={{ fontSize: 13, color: 'var(--mist)' }}>Arrived</label>
                        <input type="number" min="0" step="any" inputMode="decimal" value={recv[l.id] ?? ''}
                          onChange={(e) => setRecv((s) => ({ ...s, [l.id]: e.target.value }))}
                          style={{ width: 90, textAlign: 'right', fontSize: 16, padding: '8px 10px' }} />
                      </div>
                    )}
                  </div>
                )
              })}
              {(po.lines || []).length === 0 && <p className="jc-muted-note">This PO has no lines.</p>}

              <div style={{ marginTop: 14 }}>
                {!flagOpen ? (
                  <button className="logout-button" onClick={() => { setFlagOpen(true); setErr('') }}>⚠ Report a problem with this delivery</button>
                ) : (
                  <div style={{ border: '1px solid #E4B36B', background: '#FCF6EA', borderRadius: 10, padding: 12 }}>
                    <div style={{ fontWeight: 700, color: '#B0600A', marginBottom: 8 }}>Report a problem</div>
                    <div className="field"><label>What’s wrong?</label>
                      <select value={flagKind} onChange={(e) => setFlagKind(e.target.value)}>
                        <option value="">— choose —</option>
                        {FLAG_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                      </select>
                    </div>
                    <div className="field"><label>Details (optional)</label>
                      <textarea rows={2} value={flagNote} onChange={(e) => setFlagNote(e.target.value)} placeholder="e.g. 2 of 5 blower motors missing" style={{ resize: 'vertical', width: '100%' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="auth-button" style={{ width: 'auto', margin: 0, padding: '8px 16px' }} disabled={flagBusy} onClick={submitFlag}>{flagBusy ? 'Sending…' : 'Send to office'}</button>
                      <button className="logout-button" onClick={() => { setFlagOpen(false); setFlagKind(''); setFlagNote('') }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        {po && (po.lines || []).some((l) => Math.max(0, Number(l.qty_ordered || 0) - Number(l.qty_received || 0)) > 0) && (
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 56, padding: '10px 14px', background: 'var(--bg,#fff)', borderTop: '1px solid var(--border,#e2e8f0)' }}>
            <button className="auth-button" style={{ width: '100%', margin: 0, padding: 14, fontSize: 16 }} disabled={busy} onClick={submit}>{busy ? 'Receiving…' : 'Receive entered quantities'}</button>
          </div>
        )}
      </div>
    )
  }

  // ---------------- list ----------------
  return (
    <div className="mobile-shell job-card-v2">
      <div className="jc-header"><div className="jc-header-text"><div className="jc-title">Receive a delivery</div></div></div>
      <div className="jc-body" style={{ paddingBottom: 96 }}>
        {loading ? <p className="jc-muted-note">Loading…</p> : pos.length === 0 ? (
          <p className="jc-muted-note">No open purchase orders are awaiting delivery right now.</p>
        ) : (
          pos.map((p) => (
            <div key={p.id} onClick={() => nav(`/receiver/receive/${p.id}`)}
              style={{ border: '1px solid var(--border,#e2e8f0)', borderRadius: 10, padding: '12px 14px', marginBottom: 8, background: '#fff', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontWeight: 700, color: '#132A4C' }}>{p.po_number || '(no #)'}</div>
                <div style={{ fontSize: 12, color: 'var(--mist)' }}>{p.received}/{p.ordered} rcvd</div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--mist)', marginTop: 2 }}>
                {p.vendor?.name || 'No vendor'}{p.job_name ? ` · ${p.job_name}` : ''}{p.expected_at ? ` · exp ${fmtD(p.expected_at)}` : ''}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
