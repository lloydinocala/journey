import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'

// "Order AC Filters" — the app surfaces the exact filter sizes we recorded at
// the customer's service calls, and lets them reorder by quantity. Sizes come
// straight from property_filters (captured in the field); nothing to type.
const num = v => (v == null ? '' : String(v).replace(/\.0+$/, ''))
const sizeOf = f => [num(f.width), num(f.height), num(f.thickness)].filter(Boolean).join('x')

export default function CustomerFilters({ properties }) {
  const nav = useNavigate()
  const [propId, setPropId] = useState(properties[0]?.id || '')
  const [filters, setFilters] = useState(null) // null=loading
  const [qty, setQty] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    let live = true
    setFilters(null)
    supabase.from('property_filters')
      .select('id, property_id, width, height, thickness, merv, location, quantity')
      .then(({ data }) => {
        if (!live) return
        const rows = data || []
        setFilters(rows)
        const q = {}
        rows.forEach(f => { q[f.id] = Math.max(1, Number(f.quantity) || 1) })
        setQty(q)
      })
    return () => { live = false }
  }, [])

  const mine = useMemo(
    () => (filters || []).filter(f => !propId || f.property_id === propId),
    [filters, propId]
  )

  const bump = (id, d) => setQty(q => ({ ...q, [id]: Math.max(0, (q[id] || 0) + d) }))

  async function order() {
    const lines = mine.filter(f => (qty[f.id] || 0) > 0).map(f => {
      const bits = [`${qty[f.id]}\u00D7 ${sizeOf(f) || 'filter'}`]
      if (f.merv) bits.push(`MERV ${f.merv}`)
      if (f.location) bits.push(`(${f.location})`)
      return '\u2022 ' + bits.join(' ')
    })
    if (!lines.length) { setError('Choose at least one filter to order.'); return }
    setBusy(true); setError('')
    const details = 'Filter reorder:\n' + lines.join('\n')
    const { error: err } = await supabase.rpc('submit_customer_request', {
      p_property_id: propId, p_type: 'filter_order', p_details: details, p_window: null,
    })
    setBusy(false)
    if (err) { setError(err.message); return }
    setDone(true)
  }

  async function askIdentify() {
    setBusy(true); setError('')
    const { error: err } = await supabase.rpc('submit_customer_request', {
      p_property_id: propId, p_type: 'filter_order',
      p_details: 'Customer asked us to identify/record their filter sizes on the next visit.',
      p_window: null,
    })
    setBusy(false)
    if (err) { setError(err.message); return }
    setDone(true)
  }

  if (done) return (
    <div className="cp-wrap">
      <div className="cp-center">
        <div style={{ fontSize: 46 }}>✅</div>
        <h2 className="cp-h2">Filter request received</h2>
        <p className="cp-lead" style={{ maxWidth: 340 }}>
          We’ll confirm pricing and delivery, and reach out if we need anything. Thanks!
        </p>
        <button className="cp-btn" style={{ maxWidth: 260 }} onClick={() => nav('/portal')}>Back to home</button>
      </div>
    </div>
  )

  return (
    <div className="cp-wrap">
      <button className="cp-back" onClick={() => nav('/portal')}>‹ Home</button>
      <h2 className="cp-h2">Order AC Filters</h2>
      <p className="cp-lead">The sizes below are the ones we’ve fitted at your home — just set the quantity.</p>

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
          <div className="cp-card">
            {mine.map(f => (
              <div key={f.id} className="cp-row">
                <div className="cp-main">
                  <b>{sizeOf(f) || 'Filter'}{f.merv ? `  ·  MERV ${f.merv}` : ''}</b>
                  <span>{f.location || 'Air handler'}</span>
                </div>
                <div className="cp-step">
                  <button onClick={() => bump(f.id, -1)} aria-label="less">–</button>
                  <span className="cp-qty">{qty[f.id] || 0}</span>
                  <button onClick={() => bump(f.id, 1)} aria-label="more">+</button>
                </div>
              </div>
            ))}
          </div>
          {error && <div className="cp-err">{error}</div>}
          <div style={{ height: 12 }} />
          <button className="cp-btn pay" onClick={order} disabled={busy}>
            {busy ? 'Sending…' : 'Request these filters'}
          </button>
          <p className="cp-note">
            We’ll confirm current pricing before anything is charged or delivered. Filters help your
            system run efficiently and keep your indoor air clean.
          </p>
        </>
      )}
    </div>
  )
}
