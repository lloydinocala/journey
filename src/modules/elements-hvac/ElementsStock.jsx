// Elements-HVAC · Stock & Receiving — on-hand per location, plus receive & transfer.
// The ledger (elements_stock_txns) is the source of truth; this screen writes to it
// through data.js helpers and reads the cached per-location levels.
import { useState, useEffect } from 'react'
import { listItems, listAllLocations, listStockLevels, receiveStock, transferStock, setLevelPar } from './data'
import { useOrgSelector, OrgBar } from './shared'

const blankReceive = { location_id: '', item_id: '', qty: '', unit_cost: '' }
const blankTransfer = { from_location_id: '', to_location_id: '', item_id: '', qty: '' }

export default function ElementsStock({ profile }) {
  const org = useOrgSelector(profile)
  const [locations, setLocations] = useState([])
  const [items, setItems] = useState([])
  const [levels, setLevels] = useState({})          // item_id -> level row
  const [selectedLoc, setSelectedLoc] = useState('')
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState(null)             // null | 'receive' | 'transfer'
  const [rcv, setRcv] = useState(blankReceive)
  const [xfer, setXfer] = useState(blankTransfer)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  async function loadBase() {
    if (!org.selectedOrg) return
    const [locs, its] = await Promise.all([listAllLocations(org.selectedOrg), listItems(org.selectedOrg)])
    setLocations(locs)
    setItems(its)
    setSelectedLoc((cur) => cur || locs.find((l) => l.type === 'warehouse')?.id || locs[0]?.id || '')
  }
  useEffect(() => { loadBase() }, [org.selectedOrg])

  async function loadLevels(loc) {
    if (!org.selectedOrg || !loc) { setLevels({}); return }
    const rows = await listStockLevels(org.selectedOrg, loc)
    const map = {}
    rows.forEach((r) => { map[r.item_id] = r })
    setLevels(map)
  }
  useEffect(() => { loadLevels(selectedLoc) }, [selectedLoc, org.selectedOrg])

  const locName = (id) => locations.find((l) => l.id === id)?.name || '—'
  const itemCost = (id) => { const it = items.find((x) => x.id === id); return it ? (it.last_cost ?? it.standard_cost ?? '') : '' }

  function openReceive() { setMode('receive'); setError(''); setMsg(''); setRcv({ ...blankReceive, location_id: selectedLoc }) }
  function openTransfer() { setMode('transfer'); setError(''); setMsg(''); setXfer({ ...blankTransfer, from_location_id: selectedLoc }) }
  function closeForm() { setMode(null); setError('') }

  async function submitReceive(e) {
    e.preventDefault(); setError(''); setSaving(true)
    const { error: err } = await receiveStock(org.selectedOrg, rcv)
    setSaving(false)
    if (err) { setError(err.message); return }
    setMsg(`Received ${rcv.qty} into ${locName(rcv.location_id)}.`)
    setMode(null)
    if (rcv.location_id === selectedLoc) loadLevels(selectedLoc)
    loadBase()
  }

  async function submitTransfer(e) {
    e.preventDefault(); setError(''); setSaving(true)
    const { error: err } = await transferStock(org.selectedOrg, xfer)
    setSaving(false)
    if (err) { setError(err.message); return }
    setMsg(`Transferred ${xfer.qty} from ${locName(xfer.from_location_id)} to ${locName(xfer.to_location_id)}.`)
    setMode(null)
    if (xfer.from_location_id === selectedLoc || xfer.to_location_id === selectedLoc) loadLevels(selectedLoc)
  }

  // Categories for grouped item pickers
  const itemsByCat = {}
  items.forEach((it) => { (itemsByCat[it.category || 'Uncategorized'] = itemsByCat[it.category || 'Uncategorized'] || []).push(it) })
  const cats = Object.keys(itemsByCat).sort()

  function ItemOptions() {
    return cats.map((c) => (
      <optgroup key={c} label={c}>
        {itemsByCat[c].map((it) => <option key={it.id} value={it.id}>{it.description}</option>)}
      </optgroup>
    ))
  }

  // Save a per-location par (reorder_point / max_level). Skips no-op writes.
  async function savePar(itemId, field, val) {
    if (!selectedLoc) return
    if (val !== '' && isNaN(Number(val))) return
    const v = val === '' ? null : Number(val)
    const cur = levels[itemId]?.[field]
    const curNum = cur == null ? null : Number(cur)
    if (v === curNum) return
    setSaving(true)
    const res = await setLevelPar(org.selectedOrg, itemId, selectedLoc, { [field]: v })
    setSaving(false)
    if (res?.error) { setError(res.error.message); return }
    loadLevels(selectedLoc)
  }

  // Rows for the selected location: every item, with its level (default 0)
  const rows = items
    .filter((it) => !search || `${it.description} ${it.category || ''}`.toLowerCase().includes(search.toLowerCase()))
    .map((it) => {
      const lv = levels[it.id] || {}
      const onHand = Number(lv.on_hand || 0)
      const lvReorder = lv.reorder_point != null ? Number(lv.reorder_point) : null
      const lvMax = lv.max_level != null ? Number(lv.max_level) : null
      const reorder = lvReorder != null ? lvReorder : (it.reorder_point != null ? Number(it.reorder_point) : null)
      let status = 'ok'
      if (onHand <= 0) status = 'out'
      else if (reorder != null && onHand <= reorder) status = 'low'
      return { it, onHand, reorder, lvReorder, lvMax, status }
    })

  const lowCount = rows.filter((r) => r.status === 'low').length
  const outCount = rows.filter((r) => r.status === 'out').length
  const stockedCount = rows.filter((r) => r.onHand > 0).length

  const pill = (status) => {
    const map = {
      ok: { t: 'In stock', bg: '#E3F1E8', c: '#166534' },
      low: { t: 'Low', bg: '#F8EEDD', c: '#B0600A' },
      out: { t: 'Out', bg: '#FBE7E7', c: '#B00020' },
    }[status]
    return <span className="badge" style={{ background: map.bg, color: map.c }}>{map.t}</span>
  }

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Stock &amp; Receiving</h2>
          <span className="badge">{stockedCount} stocked · {lowCount} low · {outCount} out</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={openReceive}>+ Receive</button>
          <button className="logout-button" onClick={openTransfer}>Transfer</button>
        </div>
      </div>
      <OrgBar {...org} />

      {msg && <div style={{ margin: '8px 0 4px', padding: '9px 13px', borderRadius: 8, background: '#E3F1E8', border: '1px solid #166534', color: '#166534', fontWeight: 600, fontSize: 14 }}>{msg}</div>}
      {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}

      {mode === 'receive' && (
        <form className="inline-form" onSubmit={submitReceive} style={{ margin: '12px 0 20px', flexWrap: 'wrap', alignItems: 'flex-end', background: '#EEF3FB', padding: 16, borderRadius: 10 }}>
          <div style={{ flexBasis: '100%', fontWeight: 700, color: '#1B3A6B' }}>Receive stock</div>
          <div className="field" style={{ minWidth: 180 }}><label>Into location</label>
            <select value={rcv.location_id} onChange={(e) => setRcv({ ...rcv, location_id: e.target.value })} required>
              <option value="">— pick —</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ minWidth: 220 }}><label>Item</label>
            <select value={rcv.item_id} onChange={(e) => setRcv({ ...rcv, item_id: e.target.value, unit_cost: rcv.unit_cost || String(itemCost(e.target.value) ?? '') })} required>
              <option value="">— pick —</option>{ItemOptions()}
            </select>
          </div>
          <div className="field" style={{ width: 100 }}><label>Quantity</label><input type="number" step="any" min="0" value={rcv.qty} onChange={(e) => setRcv({ ...rcv, qty: e.target.value })} required /></div>
          <div className="field" style={{ width: 120 }}><label>Unit cost</label><input type="number" step="any" min="0" value={rcv.unit_cost} onChange={(e) => setRcv({ ...rcv, unit_cost: e.target.value })} placeholder="$" /></div>
          <button className="auth-button" type="submit" disabled={saving} style={{ width: 'auto' }}>{saving ? 'Saving…' : 'Receive'}</button>
          <button type="button" className="logout-button" onClick={closeForm}>Cancel</button>
        </form>
      )}

      {mode === 'transfer' && (
        <form className="inline-form" onSubmit={submitTransfer} style={{ margin: '12px 0 20px', flexWrap: 'wrap', alignItems: 'flex-end', background: '#EEF3FB', padding: 16, borderRadius: 10 }}>
          <div style={{ flexBasis: '100%', fontWeight: 700, color: '#1B3A6B' }}>Transfer stock</div>
          <div className="field" style={{ minWidth: 160 }}><label>From</label>
            <select value={xfer.from_location_id} onChange={(e) => setXfer({ ...xfer, from_location_id: e.target.value })} required>
              <option value="">— pick —</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ minWidth: 160 }}><label>To</label>
            <select value={xfer.to_location_id} onChange={(e) => setXfer({ ...xfer, to_location_id: e.target.value })} required>
              <option value="">— pick —</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ minWidth: 220 }}><label>Item</label>
            <select value={xfer.item_id} onChange={(e) => setXfer({ ...xfer, item_id: e.target.value })} required>
              <option value="">— pick —</option>{ItemOptions()}
            </select>
          </div>
          <div className="field" style={{ width: 100 }}><label>Quantity</label><input type="number" step="any" min="0" value={xfer.qty} onChange={(e) => setXfer({ ...xfer, qty: e.target.value })} required /></div>
          <button className="auth-button" type="submit" disabled={saving} style={{ width: 'auto' }}>{saving ? 'Saving…' : 'Transfer'}</button>
          <button type="button" className="logout-button" onClick={closeForm}>Cancel</button>
        </form>
      )}

      <div style={{ display: 'flex', gap: 12, margin: '4px 0 16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ marginBottom: 0, minWidth: 200 }}><label>Location</label>
          <select value={selectedLoc} onChange={(e) => setSelectedLoc(e.target.value)}>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}{l.type === 'truck' ? ' (truck)' : ''}</option>)}
            {locations.length === 0 && <option value="">No locations yet</option>}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0, minWidth: 220 }}><label>Search</label><input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Part or category…" /></div>
      </div>

      <p style={{ color: 'var(--mist)', fontSize: 12.5, margin: '0 0 8px' }}>
        Reorder and Max are set per location — type a number and tab out to save. When on-hand drops to the reorder
        point, the part shows up on the Replenishment list, which tops it back up to Max.
      </p>

      <table className="data-table">
        <thead>
          <tr><th>Item</th><th>Category</th><th style={{ textAlign: 'right' }}>On hand</th><th style={{ textAlign: 'right' }}>Reorder</th><th style={{ textAlign: 'right' }}>Max</th><th>Status</th></tr>
        </thead>
        <tbody>
          {rows.map(({ it, onHand, lvReorder, lvMax, status }) => (
            <tr key={it.id} style={status === 'out' ? { color: 'var(--mist)' } : undefined}>
              <td>{it.description}{it.stock_type === 'special_order' ? <span className="badge" style={{ marginLeft: 6, background: '#F8EEDD', color: '#B0600A' }}>Special order</span> : null}</td>
              <td style={{ color: 'var(--mist)' }}>{it.category || '—'}</td>
              <td style={{ textAlign: 'right', fontWeight: 600 }}>{onHand}</td>
              <td style={{ textAlign: 'right' }}>
                <input type="number" min="0" step="any" defaultValue={lvReorder ?? ''} disabled={saving}
                  style={{ width: 58, textAlign: 'right' }} title="Reorder point for this location"
                  onBlur={(e) => savePar(it.id, 'reorder_point', e.target.value)} />
              </td>
              <td style={{ textAlign: 'right' }}>
                <input type="number" min="0" step="any" defaultValue={lvMax ?? ''} disabled={saving}
                  style={{ width: 58, textAlign: 'right' }} title="Max / order-up-to level for this location"
                  onBlur={(e) => savePar(it.id, 'max_level', e.target.value)} />
              </td>
              <td>{pill(status)}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan="6" style={{ color: 'var(--mist)' }}>No items match. Add parts in the Item Catalog, or Receive stock to start counts.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
