import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'

// Place a filter order — the +New ▾ "New Filter Order" form. Opens from Filter Orders,
// the Dispatch Map, or any page with a +New menu. Every field is required except Notes.
// Prices come from the filter pricebook (create-filter-invoice); the order lands in
// Filter Orders as a FLT-#### filter invoice.

const money = (v) => (v == null ? '—' : '$' + Number(v).toFixed(2))
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '')
export const FILTER_SOURCE_OPTS = [['office', 'Office'], ['phone_customer', 'Called in — customer'], ['phone_tech', 'Called in — tech'], ['portal', 'Customer Portal'], ['website', 'Website']]
const blankLine = () => ({ width: '', height: '', thickness: '1', merv: '', qty: '1' })
const fileToLine = (f) => ({ width: String(f.width ?? ''), height: String(f.height ?? ''), thickness: String(f.thickness ?? 1), merv: f.merv ? String(f.merv) : '', qty: String(f.quantity || 1) })
const sizeText = (f) => `${[f.width, f.height, f.thickness].filter((v) => v != null && v !== '').join('×')}${f.merv ? ` MERV ${f.merv}` : ''}${f.quantity ? ` ×${f.quantity}` : ''}`

export default function PlaceFilterOrderModal({ orgId, onClose, onCreated }) {
  const [custQuery, setCustQuery] = useState('')
  const [custResults, setCustResults] = useState([])
  const [cust, setCust] = useState(null)
  const [props, setProps] = useState([])
  const [propId, setPropId] = useState('')
  const [source, setSource] = useState('')
  const [lines, setLines] = useState([blankLine()])
  const [notes, setNotes] = useState('')
  const [onFile, setOnFile] = useState([])
  const [lastOrder, setLastOrder] = useState(null)
  const [creating, setCreating] = useState(false)
  const [msg, setMsg] = useState('')
  const [tried, setTried] = useState(false)
  const [done, setDone] = useState(null)

  async function searchCust(v) {
    setCustQuery(v); setCust(null); setProps([]); setPropId('')
    if (v.trim().length < 2) { setCustResults([]); return }
    const { data } = await supabase.from('customers').select('id, display_name, primary_phone')
      .eq('org_id', orgId).ilike('display_name', `%${v.trim()}%`).order('display_name').limit(8)
    setCustResults(data || [])
  }
  async function pickCust(c) {
    setCust(c); setCustResults([]); setCustQuery(c.display_name)
    const { data } = await supabase.from('properties').select('id, street_address, unit, city').eq('customer_id', c.id).order('street_address')
    setProps(data || []); setPropId(data && data.length === 1 ? data[0].id : '')
  }
  const setLine = (i, k, v) => setLines((ls) => ls.map((l, idx) => idx === i ? { ...l, [k]: v } : l))

  useEffect(() => {
    if (!propId) { setOnFile([]); setLastOrder(null); return }
    let cancelled = false
    ;(async () => {
      const [{ data: pf }, { data: last }] = await Promise.all([
        supabase.from('property_filters').select('width, height, thickness, merv, quantity, location').eq('property_id', propId),
        supabase.from('invoices').select('invoice_number, created_at, invoice_line_items!invoice_line_items_invoice_id_fkey(description, quantity, sort_order)').eq('is_filter_order', true).eq('property_id', propId).is('deleted_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ])
      if (cancelled) return
      const onf = pf || []
      setOnFile(onf); setLastOrder(last || null)
      setLines((cur) => (onf.length && cur.length === 1 && !cur[0].width && !cur[0].height) ? onf.map(fileToLine) : cur)
    })()
    return () => { cancelled = true }
  }, [propId])

  function reorderLast() {
    const its = (lastOrder?.invoice_line_items || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    const parsed = its.map((li) => {
      const m = /(\d+)\s*x\s*(\d+)\s*x\s*(\d+)/i.exec(li.description || '')
      if (!m) return null
      const mv = /MERV\s*(\d+)/i.exec(li.description || '')
      return { width: m[1], height: m[2], thickness: m[3], merv: mv ? mv[1] : '', qty: String(li.quantity || 1) }
    }).filter(Boolean)
    if (parsed.length) setLines(parsed)
  }

  // Required: customer, property, source, and every size field on every line. Notes optional.
  const lineOk = (l) => l.width && l.height && l.thickness && l.merv && Number(l.qty) > 0
  const missing = []
  if (!cust) missing.push('customer')
  if (!propId) missing.push('property')
  if (!source) missing.push('order source')
  if (!lines.length || !lines.every(lineOk)) missing.push('width, height, thickness, MERV and quantity on every filter line')
  const bad = (cond) => (tried && cond ? { borderColor: '#B5462F', background: '#FFF6F4' } : null)

  async function createOrder() {
    setTried(true); setMsg('')
    if (missing.length) { setMsg('Please fill in: ' + missing.join('; ') + '.'); return }
    const items = lines.map((l) => ({ width: Number(l.width), height: Number(l.height), thickness: Number(l.thickness) || 1, merv: Number(l.merv), qty: Math.max(1, Number(l.qty) || 1) }))
    setCreating(true)
    const { data, error } = await supabase.functions.invoke('create-filter-invoice', { body: { propertyId: propId, items } })
    if (error || !data?.invoiced) {
      setCreating(false)
      setMsg(data?.reason === 'unpriced' ? 'None of those sizes are in the filter pricebook — add them in the pricebook first.' : (data?.error || error?.message || 'Could not create the order.'))
      return
    }
    await supabase.from('invoices').update({ filter_source: source, filter_delivery_status: 'ordered', filter_notes: notes.trim() || null }).eq('id', data.invoiceId)
    setCreating(false)
    setDone(data)
    onCreated && onCreated(data)
  }

  const inputStyle = { padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 7, background: '#fff', color: '#0f172a', boxSizing: 'border-box' }
  const label = (t, req = true) => <label style={{ display: 'block', fontSize: 12.5, color: 'var(--mist)', marginBottom: 4 }}>{t}{req && <span style={{ color: '#B5462F' }}> *</span>}</label>

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,26,34,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 1100 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 720, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(20,26,34,.28)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>New Filter Order</div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', color: 'var(--mist)', lineHeight: 1 }}>×</button>
        </div>

        {done ? (
          <div style={{ padding: 20 }}>
            <div style={{ color: '#1a7f37', fontWeight: 700, fontSize: 15, marginBottom: 6 }}>✓ Created {done.invoiceNumber} · {money(done.amount)}</div>
            <div style={{ fontSize: 14 }}>It&rsquo;s in Filter Orders.{done.emailed ? ' The invoice was emailed to the customer.' : ''}{done.unpriced ? ` ${done.unpriced} size(s) weren't priced and were left off.` : ''}</div>
            <button className="auth-button" style={{ width: 'auto', margin: '16px 0 0', padding: '9px 20px' }} onClick={onClose}>Done</button>
          </div>
        ) : (<>
          <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 240px', position: 'relative' }}>
                {label('Customer')}
                <input value={custQuery} onChange={(e) => searchCust(e.target.value)} placeholder="Search by name…" style={{ ...inputStyle, width: '100%', ...bad(!cust) }} />
                {custResults.length > 0 && (
                  <div className="section-card" style={{ position: 'absolute', zIndex: 5, left: 0, right: 0, padding: 6, marginTop: 4, maxHeight: 220, overflowY: 'auto' }}>
                    {custResults.map((c) => (
                      <button key={c.id} onClick={() => pickCust(c)} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: '6px 8px', cursor: 'pointer' }}>
                        {c.display_name}{c.primary_phone ? <span style={{ color: 'var(--mist)' }}> · {c.primary_phone}</span> : ''}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ flex: '1 1 240px' }}>
                {label('Property')}
                <select value={propId} onChange={(e) => setPropId(e.target.value)} disabled={!cust} style={{ ...inputStyle, width: '100%', ...bad(!propId) }}>
                  <option value="">{cust ? 'Choose property…' : 'Pick a customer first'}</option>
                  {props.map((p) => <option key={p.id} value={p.id}>{[p.street_address, p.unit, p.city].filter(Boolean).join(' ')}</option>)}
                </select>
              </div>
              <div style={{ flex: '0 1 200px' }}>
                {label('Order source')}
                <select value={source} onChange={(e) => setSource(e.target.value)} style={{ ...inputStyle, width: '100%', ...bad(!source) }}>
                  <option value="">Choose…</option>
                  {FILTER_SOURCE_OPTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
            </div>

            {propId && (onFile.length > 0 || lastOrder) && (
              <div style={{ marginTop: 14, padding: '10px 12px', background: '#F5F8FF', border: '1px solid #D8E2F5', borderRadius: 8 }}>
                {onFile.length > 0 && (
                  <div style={{ marginBottom: lastOrder ? 8 : 0 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: '#2F5DE3' }}>Filters on file:</span>{' '}
                    <span style={{ fontSize: 13 }}>{onFile.map(sizeText).join('  ·  ')}</span>
                    <button type="button" onClick={() => setLines(onFile.map(fileToLine))} style={{ marginLeft: 8, border: '1px solid #2F5DE3', background: '#fff', color: '#2F5DE3', borderRadius: 6, padding: '3px 10px', fontSize: 12, cursor: 'pointer' }}>Use these</button>
                  </div>
                )}
                {lastOrder && (
                  <div>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: '#2F5DE3' }}>Last order:</span>{' '}
                    <span style={{ fontSize: 13 }}>{lastOrder.invoice_number} · {fmtDate(lastOrder.created_at)}</span>
                    <button type="button" onClick={reorderLast} style={{ marginLeft: 8, border: '1px solid #2F5DE3', background: '#fff', color: '#2F5DE3', borderRadius: 6, padding: '3px 10px', fontSize: 12, cursor: 'pointer' }}>Reorder last</button>
                  </div>
                )}
                <div style={{ fontSize: 11.5, color: 'var(--mist)', marginTop: 6 }}>Prefilled for you — verify sizes and quantities before creating.</div>
              </div>
            )}

            <div style={{ marginTop: 14 }}>
              {label('Filters (W × H × Thickness, MERV, Qty — priced from your filter pricebook)')}
              {lines.map((l, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                  <input value={l.width} onChange={(e) => setLine(i, 'width', e.target.value)} placeholder="W" style={{ ...inputStyle, width: 60, ...bad(!l.width) }} />
                  <span style={{ color: 'var(--mist)' }}>×</span>
                  <input value={l.height} onChange={(e) => setLine(i, 'height', e.target.value)} placeholder="H" style={{ ...inputStyle, width: 60, ...bad(!l.height) }} />
                  <span style={{ color: 'var(--mist)' }}>×</span>
                  <input value={l.thickness} onChange={(e) => setLine(i, 'thickness', e.target.value)} placeholder="T" style={{ ...inputStyle, width: 52, ...bad(!l.thickness) }} />
                  <input value={l.merv} onChange={(e) => setLine(i, 'merv', e.target.value)} placeholder="MERV" style={{ ...inputStyle, width: 70, ...bad(!l.merv) }} />
                  <input value={l.qty} onChange={(e) => setLine(i, 'qty', e.target.value)} placeholder="Qty" style={{ ...inputStyle, width: 56, ...bad(!(Number(l.qty) > 0)) }} />
                  {lines.length > 1 && <button onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))} style={{ border: '1px solid var(--border)', background: '#fff', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', color: '#B5462F' }}>✕</button>}
                </div>
              ))}
              <button onClick={() => setLines((ls) => [...ls, blankLine()])} style={{ border: 'none', background: 'none', color: '#176E7A', fontSize: 12.5, cursor: 'pointer', padding: 0 }}>+ Add another size</button>
            </div>

            <div style={{ marginTop: 14 }}>
              {label('Notes', false)}
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Delivery instructions, gate code, etc. (optional)" style={{ ...inputStyle, width: '100%' }} />
            </div>
            <p style={{ fontSize: 12, color: 'var(--mist)', margin: '10px 0 0' }}>Creates an unpaid FLT-#### invoice and emails the customer a pay link (if they have an email on file).</p>
          </div>

          {/* Sticky footer: the Create button never scrolls out of view or covers a field. */}
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', background: '#fff', borderRadius: '0 0 16px 16px' }}>
            {msg && <div style={{ marginBottom: 8, fontSize: 13, color: '#B5462F', fontWeight: 600 }}>{msg}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="auth-button" style={{ width: 'auto', margin: 0, padding: '10px 22px' }} disabled={creating} onClick={createOrder}>{creating ? 'Creating…' : 'Create order'}</button>
              <button className="logout-button" style={{ margin: 0 }} onClick={onClose}>Cancel</button>
            </div>
          </div>
        </>)}
      </div>
    </div>
  )
}
