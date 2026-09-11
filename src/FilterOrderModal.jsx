import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'

const money = (n) => '$' + (Number(n) || 0).toFixed(2)
const IN = { padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 7, fontSize: 13.5, width: '100%', boxSizing: 'border-box' }

// Shared filter-order composer. Given a property, prefills its filters on file,
// lets you adjust/add sizes, and creates a priced filter invoice via
// create-filter-invoice (works for staff, techs, and the portal). It lands in
// the Filter Orders fulfillment queue like any other filter order.
export default function FilterOrderModal({ propertyId, propertyLabel, customerName, onClose, onPlaced }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [placing, setPlacing] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!propertyId) { setLoading(false); return }
    supabase.from('property_filters').select('width, height, thickness, merv, quantity').eq('property_id', propertyId).then(({ data }) => {
      const mapped = (data || []).map((f) => ({ width: f.width ?? '', height: f.height ?? '', thickness: f.thickness ?? '', merv: f.merv ?? '', qty: Math.max(1, Number(f.quantity) || 1), selected: true }))
      setRows(mapped.length ? mapped : [{ width: '', height: '', thickness: '', merv: '', qty: 1, selected: true }])
      setLoading(false)
    })
  }, [propertyId])

  const set = (i, patch) => setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  const addRow = () => setRows((rs) => [...rs, { width: '', height: '', thickness: '', merv: '', qty: 1, selected: true }])
  const removeRow = (i) => setRows((rs) => rs.filter((_, idx) => idx !== i))

  async function place() {
    const items = rows.filter((r) => r.selected && r.width && r.height).map((r) => ({ width: Number(r.width), height: Number(r.height), thickness: r.thickness !== '' ? Number(r.thickness) : null, merv: r.merv !== '' ? Number(r.merv) : null, qty: Math.max(1, Number(r.qty) || 1) }))
    if (!items.length) { setError('Add at least one filter size (width × height).'); return }
    setPlacing(true); setError('')
    const { data, error: err } = await supabase.functions.invoke('create-filter-invoice', { body: { propertyId, items } })
    setPlacing(false)
    if (err || data?.error) { setError(err?.message || data?.error || 'Could not place the order.'); return }
    if (!data?.invoiced) { setError("None of these sizes are priced in the filter price book yet — add them under Filter Pricebook first."); return }
    setResult(data); onPlaced && onPlaced(data)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,26,34,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 70 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '88vh', overflow: 'auto', boxShadow: '0 24px 60px rgba(20,26,34,.28)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Order filters</div>
            {(customerName || propertyLabel) && <div style={{ fontSize: 12.5, color: 'var(--mist)', marginTop: 2 }}>{[customerName, propertyLabel].filter(Boolean).join(' · ')}</div>}
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', color: 'var(--mist)', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '16px 20px 20px' }}>
          {result ? (
            <div>
              <div style={{ color: '#1a7f37', fontWeight: 700, fontSize: 15, marginBottom: 6 }}>✓ Filter order placed — {result.invoiceNumber}</div>
              <div style={{ fontSize: 14 }}>Invoice for {money(result.amount)} created and added to Filter Orders.{result.emailed ? ' Emailed to the customer.' : ''}</div>
              {result.unpriced > 0 && <div style={{ fontSize: 12.5, color: '#9C6A12', marginTop: 6 }}>{result.unpriced} size(s) weren't priced and were left off.</div>}
              <button className="auth-button" style={{ width: 'auto', margin: '16px 0 0', padding: '9px 20px' }} onClick={onClose}>Done</button>
            </div>
          ) : loading ? <div style={{ color: 'var(--mist)' }}>Loading filters on file…</div> : (
            <>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--mist)' }}>Prefilled from the filters on file. Adjust quantities, add sizes, then place — it prices from your filter price book and creates a filter invoice.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr 1fr 58px auto', gap: 6, alignItems: 'center', fontSize: 11.5, color: 'var(--mist)', fontWeight: 700, marginBottom: 4 }}>
                <span></span><span>W</span><span>H</span><span>Thick</span><span>MERV</span><span>Qty</span><span></span>
              </div>
              {rows.map((r, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr 1fr 58px auto', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                  <input type="checkbox" checked={r.selected} onChange={(e) => set(i, { selected: e.target.checked })} />
                  <input value={r.width} onChange={(e) => set(i, { width: e.target.value })} placeholder="20" style={IN} />
                  <input value={r.height} onChange={(e) => set(i, { height: e.target.value })} placeholder="25" style={IN} />
                  <input value={r.thickness} onChange={(e) => set(i, { thickness: e.target.value })} placeholder="1" style={IN} />
                  <input value={r.merv} onChange={(e) => set(i, { merv: e.target.value })} placeholder="8" style={IN} />
                  <input value={r.qty} onChange={(e) => set(i, { qty: e.target.value })} style={IN} />
                  <button onClick={() => removeRow(i)} style={{ border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', fontSize: 16 }}>×</button>
                </div>
              ))}
              <button onClick={addRow} style={{ border: '1px dashed var(--border)', background: 'transparent', borderRadius: 8, padding: '7px 12px', fontSize: 13, cursor: 'pointer', color: 'var(--mist)', marginTop: 4 }}>+ Add a size</button>
              {error && <div style={{ color: '#B0342F', fontSize: 13, fontWeight: 600, marginTop: 12 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                <button className="auth-button" style={{ width: 'auto', margin: 0, padding: '10px 22px' }} disabled={placing} onClick={place}>{placing ? 'Placing…' : 'Place filter order'}</button>
                <button className="logout-button" style={{ margin: 0 }} onClick={onClose}>Cancel</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
