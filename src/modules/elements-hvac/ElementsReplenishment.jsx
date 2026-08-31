// Elements-HVAC · Replenishment — everything sitting at or below its reorder
// point, with a suggested top-up to Max. Trucks can be refilled from a warehouse
// in one click; warehouse shortfalls are flagged for purchasing (create a PO in Purchase Orders).
import { useState, useEffect, useMemo } from 'react'
import { listReplenishment, listAllLocations, listStockLevels, transferStock } from './data'
import { useOrgSelector, OrgBar } from './shared'
import AiAssist from '../../AiAssist'

const REPL_SYS = 'You are helping an HVAC inventory manager with truck replenishment. Using only the rows provided (items below par per location and quantities needed), give a short prioritized plan: which trucks/items to restock first and why, and anything that looks unusual. Be specific with names and numbers. Under 8 short lines. No headers.'

const money = (n) => (n == null || n === '' || isNaN(n) ? '—' : `$${Number(n).toFixed(2)}`)
const costOf = (it) => (it ? (it.last_cost ?? it.standard_cost ?? null) : null)

export default function ElementsReplenishment({ profile }) {
  const org = useOrgSelector(profile)
  const [rows, setRows] = useState([])
  const [locations, setLocations] = useState([])
  const [sourceWh, setSourceWh] = useState('')
  const [whLevels, setWhLevels] = useState({})   // item_id -> on_hand at source warehouse
  const [locFilter, setLocFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState('')       // item_id|location_id currently transferring
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const warehouses = useMemo(() => locations.filter((l) => l.type === 'warehouse'), [locations])

  async function load() {
    if (!org.selectedOrg) return
    setLoading(true); setErr('')
    const [rep, locs] = await Promise.all([listReplenishment(org.selectedOrg), listAllLocations(org.selectedOrg)])
    setRows(rep); setLocations(locs)
    setSourceWh((cur) => cur || locs.find((l) => l.type === 'warehouse')?.id || '')
    setLoading(false)
  }
  useEffect(() => { load() }, [org.selectedOrg])

  async function loadWh(id) {
    if (!org.selectedOrg || !id) { setWhLevels({}); return }
    const lv = await listStockLevels(org.selectedOrg, id)
    const m = {}; lv.forEach((r) => { m[r.item_id] = Number(r.on_hand || 0) }); setWhLevels(m)
  }
  useEffect(() => { loadWh(sourceWh) }, [sourceWh, org.selectedOrg])

  const view = useMemo(() => rows.filter((r) => {
    if (locFilter !== 'all' && r.location_id !== locFilter) return false
    if (search && !(`${r.item?.description || ''} ${r.item?.category || ''} ${r.location?.name || ''}`.toLowerCase().includes(search.toLowerCase()))) return false
    return true
  }), [rows, locFilter, search])

  const suggestValue = useMemo(
    () => view.reduce((s, r) => { const c = costOf(r.item); return c == null ? s : s + c * r.suggest }, 0),
    [view]
  )

  async function transfer(r) {
    if (!sourceWh || sourceWh === r.location_id) { setErr('Pick a source warehouse that is different from the truck.'); return }
    const avail = whLevels[r.item_id] || 0
    const qty = Math.min(r.suggest, avail)
    if (!(qty > 0)) return
    setSaving(`${r.item_id}|${r.location_id}`); setErr(''); setMsg('')
    const { error } = await transferStock(org.selectedOrg, {
      from_location_id: sourceWh, to_location_id: r.location_id, item_id: r.item_id, qty,
    })
    setSaving('')
    if (error) { setErr(error.message); return }
    setMsg(`Transferred ${qty} × ${r.item?.description || 'part'} to ${r.location?.name}.`)
    await Promise.all([load(), loadWh(sourceWh)])
  }

  const locsInList = useMemo(() => {
    const seen = {}; rows.forEach((r) => { if (r.location) seen[r.location_id] = r.location.name })
    return Object.entries(seen).map(([id, name]) => ({ id, name }))
  }, [rows])

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Replenishment</h2>
          <span className="badge">{rows.length} to restock</span>
          {suggestValue > 0 && <span className="badge" style={{ background: '#1B3A6B', color: '#fff' }}>{money(suggestValue)} to top up</span>}
        </div>
      </div>
      <OrgBar {...org} />

      <div style={{ marginBottom: 16 }}>
        <AiAssist inline title="Replenishment plan" label="✨ AI: prioritize restocking"
          system={REPL_SYS}
          prompt="Give me a short prioritized restocking plan from this replenishment list."
          context={{ rows: rows.slice(0, 40) }} />
      </div>

      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0 }}>
        Everything at or below its reorder point, with how much to bring it back up to Max. Refill a truck from the
        warehouse in one click; warehouse shortfalls are flagged to purchase (purchase orders arrive in a later step).
        Set reorder and max levels on the Stock &amp; Receiving screen.
      </p>

      {msg && <div style={{ marginBottom: 12, background: '#E3F1E8', border: '1px solid #166534', color: '#166534', padding: '8px 12px', borderRadius: 8, fontWeight: 600, fontSize: 13 }}>{msg}</div>}
      {err && <div className="auth-error" style={{ marginBottom: 12 }}>{err}</div>}

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ marginBottom: 0, minWidth: 200 }}><label>Refill trucks from</label>
          <select value={sourceWh} onChange={(e) => setSourceWh(e.target.value)}>
            <option value="">— warehouse —</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0, minWidth: 180 }}><label>Location</label>
          <select value={locFilter} onChange={(e) => setLocFilter(e.target.value)}>
            <option value="all">All locations</option>
            {locsInList.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0, minWidth: 200 }}><label>Search</label>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Part, category, location…" />
        </div>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Location</th><th>Item</th>
            <th style={{ textAlign: 'right' }}>On hand</th>
            <th style={{ textAlign: 'right' }}>Reorder</th>
            <th style={{ textAlign: 'right' }}>Max</th>
            <th style={{ textAlign: 'right' }}>Suggested</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {view.map((r) => {
            const isTruck = r.location?.type === 'truck'
            const avail = whLevels[r.item_id] || 0
            const canXfer = isTruck && sourceWh && sourceWh !== r.location_id
            const xferQty = Math.min(r.suggest, avail)
            const busy = saving === `${r.item_id}|${r.location_id}`
            return (
              <tr key={`${r.item_id}|${r.location_id}`}>
                <td>{r.location?.name || '—'}{isTruck ? <span style={{ color: 'var(--mist)', fontSize: 12 }}> · truck</span> : null}</td>
                <td>{r.item?.description || '(part)'}{r.item?.category ? <span style={{ color: 'var(--mist)', fontSize: 12 }}> · {r.item.category}</span> : null}</td>
                <td style={{ textAlign: 'right', fontWeight: 600, color: r.on_hand <= 0 ? '#B00020' : undefined }}>{r.on_hand}</td>
                <td style={{ textAlign: 'right', color: 'var(--mist)' }}>{r.reorder}</td>
                <td style={{ textAlign: 'right', color: 'var(--mist)' }}>{r.max ?? '—'}</td>
                <td style={{ textAlign: 'right', fontWeight: 600, color: '#1B3A6B' }}>{r.suggest}</td>
                <td>
                  {canXfer ? (
                    xferQty > 0 ? (
                      <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={busy} onClick={() => transfer(r)}>
                        {busy ? 'Transferring…' : `Transfer ${xferQty} from warehouse`}
                      </button>
                    ) : (
                      <span style={{ color: '#B0600A', fontSize: 12.5 }}>Warehouse is out — purchase needed</span>
                    )
                  ) : (
                    <span style={{ color: 'var(--mist)', fontSize: 12.5 }}>Purchase {r.suggest} needed</span>
                  )}
                  {canXfer && xferQty > 0 && xferQty < r.suggest && (
                    <span style={{ color: 'var(--mist)', fontSize: 12, marginLeft: 8 }}>(warehouse has {avail})</span>
                  )}
                </td>
              </tr>
            )
          })}
          {!loading && view.length === 0 && (
            <tr><td colSpan="7" style={{ color: 'var(--mist)' }}>Nothing to restock — everything is above its reorder point. Set reorder/max levels on Stock &amp; Receiving to populate this list.</td></tr>
          )}
          {loading && <tr><td colSpan="7" style={{ color: 'var(--mist)' }}>Loading…</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
