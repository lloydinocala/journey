import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'

const num = v => (v == null ? '' : String(v).replace(/\.0+$/, ''))
const sizeOf = f => [num(f.width), num(f.height), num(f.thickness)].filter(Boolean).join('x')
const MERVS = [8, 11, 13]
const money = n => (n == null ? null : '$' + Number(n).toFixed(2))

// Unit price by quantity break: 1-3 = "1 ea", 4-5 = "4 ea", 6-11 = "6 ea",
// 12+ = the case rate (case-of-12 price divided across 12). Falls back to any
// tier that's priced if the exact break is blank.
function unitPrice(row, qty) {
  if (!row) return null
  const q = qty || 1
  const perCase = row.price_case != null ? Number(row.price_case) / 12 : null
  if (q >= 12 && perCase != null) return perCase
  if (q >= 6 && row.price_6 != null) return Number(row.price_6)
  if (q >= 4 && row.price_4 != null) return Number(row.price_4)
  if (row.price_1 != null) return Number(row.price_1)
  return (row.price_4 != null ? Number(row.price_4) : null) ?? (row.price_6 != null ? Number(row.price_6) : null) ?? perCase
}

export default function CustomerFilters({ customer, properties, activePropertyId }) {
  const nav = useNavigate()
  const [propId, setPropId] = useState(activePropertyId || properties[0]?.id || '')
  const [filters, setFilters] = useState(null) // null = loading
  const [prices, setPrices] = useState([])      // filter_pricebook rows (active, this org)
  const [custom, setCustom] = useState({})      // size -> { merv, qty }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [orderMode, setOrderMode] = useState('requested') // 'invoiced' | 'requested'
  const [subs, setSubs] = useState([])
  const [discount, setDiscount] = useState(0)
  const [subForm, setSubForm] = useState({ size: '', merv: '', qty: 1, cadence: 90 })
  const [subBusy, setSubBusy] = useState(false)
  const [subMsg, setSubMsg] = useState('')

  useEffect(() => {
    let live = true
    setFilters(null)
    supabase.from('property_filters')
      .select('id, property_id, width, height, thickness, merv, location, quantity')
      .then(({ data }) => { if (live) setFilters(data || []) })
    supabase.from('filter_pricebook')
      .select('width, height, thickness, type, merv, price_1, price_4, price_6, price_case')
      .eq('is_active', true)
      .then(({ data }) => { if (live) setPrices(data || []) })
    return () => { live = false }
  }, [])

  const mine = useMemo(
    () => (filters || []).filter(f => !propId || f.property_id === propId),
    [filters, propId]
  )

  const sizes = useMemo(() => {
    const seen = []
    mine.forEach(f => { const s = sizeOf(f); if (s && !seen.includes(s)) seen.push(s) })
    return seen
  }, [mine])

  useEffect(() => {
    setCustom(prev => {
      const next = { ...prev }
      sizes.forEach(s => {
        if (!next[s]) {
          const rec = mine.find(f => sizeOf(f) === s)
          next[s] = { merv: Number(rec?.merv) || 8, qty: 0 }
        }
      })
      return next
    })
  }, [sizes]) // eslint-disable-line react-hooks/exhaustive-deps

  const setMerv = (s, m) => setCustom(c => ({ ...c, [s]: { ...c[s], merv: m } }))
  const bump = (s, d) => setCustom(c => ({ ...c, [s]: { ...c[s], qty: Math.max(0, (c[s]?.qty || 0) + d) } }))

  // Find the priced row for a size ("WxHxT") + MERV. If several match (multiple
  // types), take the lowest 1-ea price. The recorded filter carries no "type",
  // so type isn't distinguished here.
  const priceRowFor = (sizeStr, merv) => {
    const [w, h, t] = sizeStr.split('x').map(Number)
    const matches = prices.filter(p =>
      Number(p.width) === w && Number(p.height) === h && Number(p.thickness) === t &&
      (merv == null || Number(p.merv) === Number(merv)))
    if (!matches.length) return null
    return matches.slice().sort((a, b) => (a.price_1 ?? 1e9) - (b.price_1 ?? 1e9))[0]
  }

  const customTotal = useMemo(() => {
    let total = 0, priced = false
    sizes.forEach(s => {
      const q = custom[s]?.qty || 0
      if (q <= 0) return
      const up = unitPrice(priceRowFor(s, custom[s]?.merv), q)
      if (up != null) { total += up * q; priced = true }
    })
    return priced ? total : null
  }, [sizes, custom, prices]) // eslint-disable-line react-hooks/exhaustive-deps

  const typicalTotal = useMemo(() => {
    let total = 0, priced = false
    mine.forEach(f => {
      const q = Math.max(1, Number(f.quantity) || 1)
      const up = unitPrice(priceRowFor(sizeOf(f), f.merv), q)
      if (up != null) { total += up * q; priced = true }
    })
    return priced ? total : null
  }, [mine, prices]) // eslint-disable-line react-hooks/exhaustive-deps

  async function submitRequest(details) {
    const { error: err } = await supabase.rpc('submit_customer_request', {
      p_property_id: propId, p_type: 'filter_order', p_details: details, p_window: null,
    })
    return err
  }

  // Try to generate + email a real filter invoice (priced server-side from the
  // price book). If a size isn't priced yet (or the invoice step fails), fall back
  // to a plain request so the office can follow up — the order is never lost.
  async function placeOrder(items, fallbackDetails) {
    setBusy(true); setError('')
    let invoiced = false
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('create-filter-invoice', {
        body: { propertyId: propId, items },
      })
      if (!fnErr && data && data.invoiced) invoiced = true
    } catch { /* fall through to a request */ }
    if (invoiced) { setBusy(false); setOrderMode('invoiced'); setDone(true); return }
    const err = await submitRequest(fallbackDetails)
    setBusy(false)
    if (err) { setError(err.message); return }
    setOrderMode('requested'); setDone(true)
  }

  function orderTypical() {
    if (!mine.length) { setError('No filters on file to reorder.'); return }
    const items = mine.map(f => ({ width: f.width, height: f.height, thickness: f.thickness, merv: f.merv, qty: Math.max(1, Number(f.quantity) || 1) }))
    const details = 'Reorder usual filters:\n' + mine.map(f => {
      const q = Math.max(1, Number(f.quantity) || 1)
      return `\u2022 ${q}\u00D7 ${sizeOf(f) || 'filter'}${f.merv ? ` MERV ${f.merv}` : ''}`
    }).join('\n')
    placeOrder(items, details)
  }

  function orderCustom() {
    const chosen = sizes.filter(s => (custom[s]?.qty || 0) > 0)
    if (!chosen.length) { setError('Set a quantity on at least one filter.'); return }
    const items = chosen.map(s => {
      const [width, height, thickness] = s.split('x').map(Number)
      return { width, height, thickness, merv: custom[s].merv, qty: custom[s].qty }
    })
    const details = 'Custom filter order:\n' + chosen.map(s => `\u2022 ${custom[s].qty}\u00D7 ${s} MERV ${custom[s].merv}`).join('\n')
    placeOrder(items, details)
  }

  async function askIdentify() {
    setBusy(true); setError('')
    const err = await submitRequest('Customer asked us to identify/record their filter sizes on the next visit.')
    setBusy(false)
    if (err) { setError(err.message); return }
    setOrderMode('requested'); setDone(true)
  }

  if (done) return (
    <div className="cp-wrap">
      <div className="cp-center">
        <div style={{ fontSize: 46 }}>✅</div>
        <h2 className="cp-h2">{orderMode === 'invoiced' ? 'Invoice on its way' : 'Filter request received'}</h2>
        <p className="cp-lead" style={{ maxWidth: 360 }}>
          {orderMode === 'invoiced'
            ? 'We’ve emailed your filter invoice with a secure link to pay by card. Thank you!'
            : 'We’ll confirm pricing and delivery, and reach out if we need anything. Thanks!'}
        </p>
        <button className="cp-btn" style={{ maxWidth: 260 }} onClick={() => nav('/portal')}>Back to home</button>
      </div>
    </div>
  )

  function reloadSubs() {
    if (!propId) { setSubs([]); return }
    supabase.from('filter_subscriptions').select('*').eq('property_id', propId).neq('status', 'canceled').order('created_at', { ascending: false }).then(({ data }) => setSubs(data || []))
  }
  useEffect(() => { reloadSubs() }, [propId])
  useEffect(() => { supabase.rpc('current_customer_filter_discount').then(({ data }) => setDiscount(Number(data) || 0)) }, [])

  async function addSub() {
    if (!subForm.size || !propId || !customer) return
    const [w, h, t] = subForm.size.split('x')
    const next = new Date(); next.setDate(next.getDate() + Number(subForm.cadence))
    setSubBusy(true); setSubMsg('')
    const { error: err } = await supabase.from('filter_subscriptions').insert({
      org_id: customer.org_id, customer_id: customer.id, property_id: propId,
      width: Number(w) || null, height: Number(h) || null, thickness: Number(t) || null,
      merv: subForm.merv ? Number(subForm.merv) : null, quantity: Math.max(1, Number(subForm.qty) || 1),
      cadence_days: Number(subForm.cadence), next_ship_date: next.toISOString().slice(0, 10), status: 'active',
    })
    setSubBusy(false)
    if (err) { setSubMsg(err.message); return }
    setSubForm({ size: '', merv: '', qty: 1, cadence: 90 }); setSubMsg('Auto-ship started \u2713'); reloadSubs()
  }
  async function setSubStatus(id, status) { await supabase.from('filter_subscriptions').update({ status }).eq('id', id); reloadSubs() }
  async function cancelSub(id) { if (!window.confirm('Cancel this auto-ship?')) return; await supabase.from('filter_subscriptions').update({ status: 'canceled' }).eq('id', id); reloadSubs() }

  return (
    <div className="cp-wrap">
      <button className="cp-back" onClick={() => nav('/portal')}>‹ Home</button>
      <h2 className="cp-h2">My AC Filters</h2>
      <p className="cp-note" style={{ marginTop: 0 }}>Prices shown are estimates; we’ll confirm current pricing before anything is charged or delivered.</p>

      {properties.length > 1 && (
        <>
          <div className="cp-label">Property</div>
          <select className="cp-sel" value={propId} onChange={e => setPropId(e.target.value)}>
            {properties.map(p => (
              <option key={p.id} value={p.id}>
                {[p.street_address, p.unit].filter(Boolean).join(' ')}{p.city ? `, ${p.city}` : ''}
              </option>
            ))}
          </select>
          <div style={{ height: 8 }} />
        </>
      )}

      {filters === null ? (
        <div className="cp-empty">Loading your filters…</div>
      ) : mine.length === 0 ? (
        <div className="cp-card">
          <p style={{ margin: '2px 0 12px', fontSize: 14.5 }}>
            We don’t have your filter sizes on file yet. We’ll measure and record them at your
            next visit — or we can come identify them for you.
          </p>
          {error && <div className="cp-err">{error}</div>}
          <button className="cp-btn ghost" onClick={askIdentify} disabled={busy}>
            {busy ? 'Sending…' : 'Ask us to identify my filters'}
          </button>
        </div>
      ) : (
        <>
          <div className="cp-card cp-filtsum">
            <div className="cp-fsum-h">You Typically Use:</div>
            {mine.map((f, i) => (
              <div className="cp-fsum-row" key={f.id}>
                <span className="lbl">Filter #{i + 1}</span>
                <span className="merv">MERV {f.merv || '—'}</span>
                <span className="size">{sizeOf(f) || 'filter'} ({Math.max(1, Number(f.quantity) || 1)})</span>
              </div>
            ))}
            {typicalTotal != null && (
              <div style={{ textAlign: 'right', fontWeight: 700, margin: '6px 2px 0' }}>Total: {money(typicalTotal)}</div>
            )}
            <button className="cp-btn" onClick={orderTypical} disabled={busy}>Order 1 Each Above</button>
          </div>

          <div className="cp-card cp-filtcustom">
            {sizes.map(s => {
              const q = custom[s]?.qty || 0
              const up = unitPrice(priceRowFor(s, custom[s]?.merv), q)
              return (
                <div className="cp-fcust-row" key={s}>
                  <div className="cp-fcust-top">
                    <div className="size">{s}</div>
                    <div className="cp-fcust-price">
                      {up != null
                        ? <>{money(up)} ea{q > 0 ? <> · <b>{money(up * q)}</b></> : null}</>
                        : <span className="muted">price at order</span>}
                    </div>
                  </div>
                  <div className="cp-fcust-controls">
                    <div className="mervs">
                      {MERVS.map(m => (
                        <button
                          key={m}
                          className={'cp-mervchip' + (custom[s]?.merv === m ? ' on' : '')}
                          onClick={() => setMerv(s, m)}
                        >
                          MERV {m}
                        </button>
                      ))}
                    </div>
                    <div className="cp-qtybox">
                      <div className="qtylabel">QTY</div>
                      <div className="cp-step">
                        <button onClick={() => bump(s, -1)} aria-label="less">–</button>
                        <span className="cp-qty">{q}</span>
                        <button onClick={() => bump(s, 1)} aria-label="more">+</button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            {customTotal != null && (
              <div style={{ textAlign: 'right', fontWeight: 700, margin: '6px 2px 0' }}>Estimated total: {money(customTotal)}</div>
            )}
            <button className="cp-btn pay" onClick={orderCustom} disabled={busy}>Order Custom Selection</button>
          </div>

          <div className="cp-card" style={{ marginTop: 18 }}>
            <h3 className="cp-h3" style={{ margin: '0 0 4px' }}>🔁 Auto-Ship &amp; Save{discount ? ` ${discount}%` : ''}</h3>
            <p className="cp-fineprint" style={{ marginTop: 0 }}>Never think about filters again — we ship the right ones on your schedule{discount ? `, ${discount}% off every time` : ''}. Pause or cancel anytime.</p>

            {subs.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                {subs.map(su => (
                  <div key={su.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 0', borderTop: '1px solid var(--line)' }}>
                    <div style={{ flex: 1, minWidth: 180, fontSize: 14 }}>
                      <b>{[num(su.width), num(su.height), num(su.thickness)].filter(Boolean).join('x')}{su.merv ? ` MERV ${su.merv}` : ''}</b> · qty {su.quantity} · every {su.cadence_days} days
                      <div className="cp-fineprint" style={{ marginTop: 2 }}>{su.status === 'paused' ? 'Paused' : `Next ship ${new Date(su.next_ship_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}</div>
                    </div>
                    {su.status === 'active'
                      ? <button className="cp-btn ghost" style={{ width: 'auto', padding: '6px 12px' }} onClick={() => setSubStatus(su.id, 'paused')}>Pause</button>
                      : <button className="cp-btn ghost" style={{ width: 'auto', padding: '6px 12px' }} onClick={() => setSubStatus(su.id, 'active')}>Resume</button>}
                    <button className="cp-btn ghost" style={{ width: 'auto', padding: '6px 12px', color: '#B0342F' }} onClick={() => cancelSub(su.id)}>Cancel</button>
                  </div>
                ))}
              </div>
            )}

            {sizes.length === 0
              ? <p className="cp-fineprint">Add your filter sizes to your profile first, then set up auto-ship here.</p>
              : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <label style={{ fontSize: 12 }}>Size<br />
                    <select value={subForm.size} onChange={e => setSubForm({ ...subForm, size: e.target.value })} style={{ padding: '8px', borderRadius: 8, border: '1.5px solid var(--line)' }}>
                      <option value="">Choose…</option>
                      {sizes.map(sz => <option key={sz} value={sz}>{sz}</option>)}
                    </select>
                  </label>
                  <label style={{ fontSize: 12 }}>MERV<br />
                    <select value={subForm.merv} onChange={e => setSubForm({ ...subForm, merv: e.target.value })} style={{ padding: '8px', borderRadius: 8, border: '1.5px solid var(--line)' }}>
                      <option value="">Any</option>
                      {MERVS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </label>
                  <label style={{ fontSize: 12 }}>Qty<br />
                    <input type="number" min="1" value={subForm.qty} onChange={e => setSubForm({ ...subForm, qty: e.target.value })} style={{ width: 60, padding: '8px', borderRadius: 8, border: '1.5px solid var(--line)' }} />
                  </label>
                  <label style={{ fontSize: 12 }}>Every<br />
                    <select value={subForm.cadence} onChange={e => setSubForm({ ...subForm, cadence: Number(e.target.value) })} style={{ padding: '8px', borderRadius: 8, border: '1.5px solid var(--line)' }}>
                      <option value={60}>60 days</option>
                      <option value={90}>90 days</option>
                      <option value={120}>120 days</option>
                    </select>
                  </label>
                  <button className="cp-btn" style={{ width: 'auto', padding: '9px 18px' }} disabled={subBusy || !subForm.size} onClick={addSub}>{subBusy ? 'Starting…' : 'Start auto-ship'}</button>
                </div>
              )}
            {subMsg && <div className="cp-fineprint" style={{ marginTop: 8, color: subMsg.includes('\u2713') ? '#1b7a3d' : '#B0342F' }}>{subMsg}</div>}
          </div>

          {error && <div className="cp-err">{error}</div>}
        </>
      )}
    </div>
  )
}
