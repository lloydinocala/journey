import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'

const num = v => (v == null ? '' : String(v).replace(/\.0+$/, ''))
const sizeOf = f => [num(f.width), num(f.height), num(f.thickness)].filter(Boolean).join('x')
const MERVS = [8, 11, 13]

export default function CustomerFilters({ properties }) {
  const nav = useNavigate()
  const [propId, setPropId] = useState(properties[0]?.id || '')
  const [filters, setFilters] = useState(null) // null = loading
  const [custom, setCustom] = useState({})     // size -> { merv, qty }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    let live = true
    setFilters(null)
    supabase.from('property_filters')
      .select('id, property_id, width, height, thickness, merv, location, quantity')
      .then(({ data }) => { if (live) setFilters(data || []) })
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

  async function submit(details) {
    setBusy(true); setError('')
    const { error: err } = await supabase.rpc('submit_customer_request', {
      p_property_id: propId, p_type: 'filter_order', p_details: details, p_window: null,
    })
    setBusy(false)
    if (err) { setError(err.message); return }
    setDone(true)
  }

  function orderTypical() {
    const lines = mine.map(f => {
      const q = Math.max(1, Number(f.quantity) || 1)
      return `\u2022 ${q}\u00D7 ${sizeOf(f) || 'filter'}${f.merv ? ` MERV ${f.merv}` : ''}`
    })
    if (!lines.length) { setError('No filters on file to reorder.'); return }
    submit('Reorder usual filters:\n' + lines.join('\n'))
  }

  function orderCustom() {
    const lines = sizes.filter(s => (custom[s]?.qty || 0) > 0)
      .map(s => `\u2022 ${custom[s].qty}\u00D7 ${s} MERV ${custom[s].merv}`)
    if (!lines.length) { setError('Set a quantity on at least one filter.'); return }
    submit('Custom filter order:\n' + lines.join('\n'))
  }

  function askIdentify() {
    submit('Customer asked us to identify/record their filter sizes on the next visit.')
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
      <h2 className="cp-h2">My AC Filters</h2>
      <p className="cp-note" style={{ marginTop: 0 }}>We’ll confirm current pricing before anything is charged or delivered.</p>

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
            <button className="cp-btn" onClick={orderTypical} disabled={busy}>Order 1 Each Above</button>
          </div>

          <div className="cp-card cp-filtcustom">
            {sizes.map(s => (
              <div className="cp-fcust-row" key={s}>
                <div className="size">{s}</div>
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
                    <span className="cp-qty">{custom[s]?.qty || 0}</span>
                    <button onClick={() => bump(s, 1)} aria-label="more">+</button>
                  </div>
                </div>
              </div>
            ))}
            <button className="cp-btn pay" onClick={orderCustom} disabled={busy}>Order Custom Selection</button>
          </div>

          {error && <div className="cp-err">{error}</div>}
        </>
      )}
    </div>
  )
}
