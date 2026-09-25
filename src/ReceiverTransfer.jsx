// Journey · Mobile · Receiver — Transfer stock between locations.
// Move parts warehouse↔truck or truck↔truck. Uses the same transferStock ledger
// as the office (paired out/in rows, guarded so From can't go negative).
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconChevronLeft } from './MobileIcons'
import { listAllLocations, listItems, listStockLevels, transferStock } from './modules/elements-hvac/data'

export default function ReceiverTransfer({ profile }) {
  const nav = useNavigate()
  const orgId = profile?.org_id
  const [locations, setLocations] = useState([])
  const [items, setItems] = useState([])
  const [fromLoc, setFromLoc] = useState('')
  const [toLoc, setToLoc] = useState('')
  const [levels, setLevels] = useState({})   // item_id -> on_hand at fromLoc
  const [itemId, setItemId] = useState('')
  const [qty, setQty] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!orgId) return
    listAllLocations(orgId).then(setLocations).catch(() => setLocations([]))
    listItems(orgId).then(setItems).catch(() => setItems([]))
  }, [orgId])

  useEffect(() => {
    if (!orgId || !fromLoc) { setLevels({}); return }
    listStockLevels(orgId, fromLoc).then((rows) => {
      const m = {}; (rows || []).forEach((r) => { if (Number(r.on_hand) > 0) m[r.item_id] = Number(r.on_hand) })
      setLevels(m); setItemId('')
    }).catch(() => setLevels({}))
  }, [orgId, fromLoc])

  const itemName = (id) => items.find((i) => i.id === id)?.description || '(part)'
  const avail = itemId ? (levels[itemId] || 0) : 0
  const onHandItems = Object.keys(levels)

  async function submit() {
    setErr(''); setMsg('')
    if (!fromLoc || !toLoc) { setErr('Pick both a From and a To location.'); return }
    if (fromLoc === toLoc) { setErr('From and To must be different locations.'); return }
    if (!itemId) { setErr('Pick a part to move.'); return }
    const q = Number(qty)
    if (!(q > 0)) { setErr('Enter how many to move.'); return }
    if (q > avail) { setErr(`Only ${avail} on hand at the From location.`); return }
    setBusy(true)
    const { error } = await transferStock(orgId, { from_location_id: fromLoc, to_location_id: toLoc, item_id: itemId, qty: q })
    setBusy(false)
    if (error) { setErr(error.message); return }
    setMsg(`Moved ${q} × ${itemName(itemId)}.`)
    // refresh availability at the source
    const rows = await listStockLevels(orgId, fromLoc)
    const m = {}; (rows || []).forEach((r) => { if (Number(r.on_hand) > 0) m[r.item_id] = Number(r.on_hand) })
    setLevels(m); setItemId(''); setQty('')
  }

  const locOpts = (exclude) => locations.filter((l) => l.id !== exclude).map((l) => (
    <option key={l.id} value={l.id}>{l.name}{l.type === 'truck' ? ' (truck)' : l.type === 'warehouse' ? ' (warehouse)' : ''}</option>
  ))

  return (
    <div className="mobile-shell job-card-v2">
      <div className="jc-header" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="jc-back" onClick={() => nav('/receiver')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IconChevronLeft /></button>
        <div className="jc-header-text"><div className="jc-title">Transfer stock</div></div>
      </div>
      <div className="jc-body" style={{ paddingBottom: 96 }}>
        {msg && <div style={{ background: '#E3F1E8', border: '1px solid #166534', color: '#166534', padding: '8px 12px', borderRadius: 8, fontWeight: 600, fontSize: 13, marginBottom: 10 }}>{msg}</div>}
        {err && <div className="auth-error" style={{ marginBottom: 10 }}>{err}</div>}

        <div className="field"><label>From</label>
          <select value={fromLoc} onChange={(e) => setFromLoc(e.target.value)}>
            <option value="">— where it's coming from —</option>
            {locOpts(toLoc)}
          </select>
        </div>
        <div className="field"><label>To</label>
          <select value={toLoc} onChange={(e) => setToLoc(e.target.value)}>
            <option value="">— where it's going —</option>
            {locOpts(fromLoc)}
          </select>
        </div>
        <div className="field"><label>Part</label>
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} disabled={!fromLoc}>
            <option value="">{fromLoc ? (onHandItems.length ? '— pick a part on hand —' : 'Nothing on hand at that location') : 'Pick a From location first'}</option>
            {onHandItems.map((id) => <option key={id} value={id}>{itemName(id)} · {levels[id]} on hand</option>)}
          </select>
        </div>
        <div className="field"><label>How many{itemId ? ` (up to ${avail})` : ''}</label>
          <input type="number" min="0" step="any" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} disabled={!itemId} style={{ fontSize: 16, padding: '8px 10px' }} />
        </div>

        <button className="auth-button" style={{ width: '100%', margin: '8px 0 0', padding: 14, fontSize: 16 }} disabled={busy} onClick={submit}>{busy ? 'Moving…' : 'Transfer'}</button>
      </div>
    </div>
  )
}
