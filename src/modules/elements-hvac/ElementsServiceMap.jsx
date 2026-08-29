// Elements-HVAC · Service → Parts Kits (BOM editor)
// A service can carry a whole kit of parts: e.g. "Replace Blower Motor" pulls a
// motor + capacitor + wire nuts. Pick a service on the left, build its parts list
// on the right. When that service lands on an invoice, P1c will deplete this kit.
import { useState, useEffect, useMemo, useRef } from 'react'
import {
  listServices, listMaps, listItems, createItemAndMap, mapExistingItem,
  unmap, updateMap, updateItem, deriveSku,
} from './data'
import { useOrgSelector, OrgBar } from './shared'

// Services whose name/category read as labor, diagnosis, fees, memberships, etc.
// consume no stock, so they default out of the "needs a kit" view.
const LABOR_RE = /(service call|diagnos|trip|labor|inspection|maintenance|membership|agreement|discount|\bfee\b|dispatch|tune[- ]?up|estimate|permit|warranty|callback)/i
const isLikelyPart = (svc) => !LABOR_RE.test(`${svc.category || ''} ${svc.name || ''}`)

const money = (n) => (n == null || n === '' || isNaN(n) ? '—' : `$${Number(n).toFixed(2)}`)

export default function ElementsServiceMap({ profile }) {
  const org = useOrgSelector(profile)
  const [services, setServices] = useState([])
  const [maps, setMaps] = useState([])
  const [items, setItems] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [view, setView] = useState('parts')          // parts | kitted | empty | all
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  // Add-part typeahead state
  const [addTerm, setAddTerm] = useState('')
  const [addItemId, setAddItemId] = useState('')
  const [addQty, setAddQty] = useState('1')
  const [addCost, setAddCost] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const addBoxRef = useRef(null)

  async function load() {
    if (!org.selectedOrg) return
    const [s, m, i] = await Promise.all([
      listServices(org.selectedOrg), listMaps(org.selectedOrg), listItems(org.selectedOrg),
    ])
    setServices(s); setMaps(m); setItems(i)
  }
  useEffect(() => { load() }, [org.selectedOrg])

  // item_id -> item (for costs + names not carried on the map join)
  const itemById = useMemo(() => {
    const o = {}; items.forEach((it) => { o[it.id] = it }); return o
  }, [items])
  const itemCost = (it) => (it ? (it.last_cost ?? it.standard_cost ?? null) : null)

  const mapByService = useMemo(() => {
    const o = {}
    maps.forEach((m) => { (o[m.service_id] = o[m.service_id] || []).push(m) })
    return o
  }, [maps])

  const rows = useMemo(() => services
    .map((s) => ({ ...s, maps: mapByService[s.id] || [] }))
    .filter((s) => {
      if (view === 'kitted' && s.maps.length === 0) return false
      if (view === 'empty' && s.maps.length > 0) return false
      if (view === 'parts' && (s.maps.length === 0 && !isLikelyPart(s))) return false
      if (search && !(`${s.name} ${s.category || ''}`.toLowerCase().includes(search.toLowerCase()))) return false
      return true
    }), [services, mapByService, view, search])

  const selected = useMemo(() => services.find((s) => s.id === selectedId) || null, [services, selectedId])
  const kit = useMemo(() => (selectedId ? (mapByService[selectedId] || []) : []), [mapByService, selectedId])
  const kitItemIds = useMemo(() => new Set(kit.map((m) => m.item_id)), [kit])

  const kitTotal = useMemo(() => kit.reduce((sum, m) => {
    const c = itemCost(itemById[m.item_id]); return c == null ? sum : sum + c * Number(m.qty_per || 0)
  }, 0), [kit, itemById])

  const unmappedParts = useMemo(
    () => services.filter((s) => !(mapByService[s.id]?.length) && isLikelyPart(s)),
    [services, mapByService]
  )

  // Typeahead matches: parts not already in the kit, matched on description/sku/category.
  const addMatches = useMemo(() => {
    const t = addTerm.trim().toLowerCase()
    return items
      .filter((it) => !kitItemIds.has(it.id))
      .filter((it) => !t || `${it.description || ''} ${it.sku || ''} ${it.category || ''}`.toLowerCase().includes(t))
      .slice(0, 30)
  }, [items, addTerm, kitItemIds])
  const exactMatch = useMemo(
    () => items.find((it) => (it.description || '').trim().toLowerCase() === addTerm.trim().toLowerCase()),
    [items, addTerm]
  )

  useEffect(() => {
    function onDoc(e) { if (addBoxRef.current && !addBoxRef.current.contains(e.target)) setAddOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function selectService(id) {
    setSelectedId(id); setMsg(''); setAddTerm(''); setAddItemId(''); setAddQty('1'); setAddCost(''); setAddOpen(false)
  }
  function chooseItem(it) {
    setAddItemId(it.id); setAddTerm(it.description || it.sku)
    const c = itemCost(it); setAddCost(c == null ? '' : String(c))
    setAddOpen(false)
  }

  async function addExisting() {
    if (!addItemId || !selectedId) return
    const q = parseFloat(addQty)
    if (isNaN(q) || q <= 0) { setMsg('Enter a quantity above zero.'); return }
    setBusy(true); setMsg('')
    // If a cost was entered and it differs from what's on file, save it to the part.
    const current = itemCost(itemById[addItemId])
    const cost = addCost === '' ? null : Number(addCost)
    if (cost != null && !isNaN(cost) && cost !== (current == null ? null : Number(current))) {
      await updateItem(addItemId, { standard_cost: cost })
    }
    const { error } = await mapExistingItem(org.selectedOrg, selectedId, addItemId, q)
    setBusy(false)
    setMsg(error ? error.message : 'Part added to kit.')
    setAddTerm(''); setAddItemId(''); setAddQty('1'); setAddCost('')
    load()
  }

  async function addNew() {
    const name = addTerm.trim()
    if (!name || !selectedId) return
    const q = parseFloat(addQty)
    if (isNaN(q) || q <= 0) { setMsg('Enter a quantity above zero.'); return }
    setBusy(true); setMsg('')
    const taken = new Set(items.map((i) => i.sku.toLowerCase()))
    const sku = deriveSku(name, taken)
    const cost = addCost === '' ? null : Number(addCost)
    const { error } = await createItemAndMap(
      org.selectedOrg,
      { sku, description: name, category: selected?.category || null, item_class: 'part', standard_cost: (cost != null && !isNaN(cost)) ? cost : null },
      selectedId, q
    )
    setBusy(false)
    setMsg(error ? error.message : `Created "${name}" and added it to the kit.`)
    setAddTerm(''); setAddItemId(''); setAddQty('1'); setAddCost('')
    load()
  }

  async function saveQty(m, val) {
    const q = parseFloat(val)
    if (isNaN(q) || q <= 0 || q === Number(m.qty_per)) return
    setBusy(true); setMsg('')
    const { error } = await updateMap(m.id, { qty_per: q })
    setBusy(false)
    setMsg(error ? error.message : 'Quantity updated.')
    load()
  }

  async function removeMap(m) {
    const nm = itemById[m.item_id]?.description || m.item?.description || 'this part'
    if (!window.confirm(`Remove "${nm}" from this kit? The part stays in your catalog — only its link to this service is removed.`)) return
    setBusy(true); setMsg('')
    await unmap(m.id)
    setBusy(false)
    load()
  }

  async function bulkCreate() {
    if (unmappedParts.length === 0) return
    if (!window.confirm(`Auto-create ${unmappedParts.length} single-part kits (one part per unmapped parts service)? Labor/diagnostic services are skipped. You can edit any kit afterward.`)) return
    setBusy(true); setMsg('')
    const taken = new Set(items.map((i) => i.sku.toLowerCase()))
    let ok = 0, fail = 0
    for (const svc of unmappedParts) {
      const sku = deriveSku(svc.name, taken)
      const { error } = await createItemAndMap(
        org.selectedOrg,
        { sku, description: svc.name, category: svc.category || null, item_class: 'part' },
        svc.id, 1
      )
      if (error) fail += 1; else ok += 1
    }
    setBusy(false)
    setMsg(`Created ${ok} kit${ok === 1 ? '' : 's'}${fail ? `, ${fail} failed` : ''}.`)
    load()
  }

  const kittedCount = services.filter((s) => mapByService[s.id]?.length).length

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Service → Parts Kits</h2>
          <span className="badge">{kittedCount}/{services.length} services with a kit</span>
        </div>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={busy || unmappedParts.length === 0} onClick={bulkCreate}>
          Auto-create {unmappedParts.length} kit{unmappedParts.length === 1 ? '' : 's'}
        </button>
      </div>
      <OrgBar {...org} />

      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0 }}>
        A service can pull a whole kit of parts. Pick a service, then add every part it consumes with the
        quantity used. Search your catalog or type a new part name to create it on the spot. Labor and
        diagnostic services usually need no kit and are dimmed.
      </p>

      {msg && <div style={{ marginBottom: 12, fontWeight: 600, color: /fail|duplicate|zero|error/i.test(msg) ? '#B00020' : '#166534' }}>{msg}</div>}

      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* LEFT — service list */}
        <div style={{ flex: '1 1 340px', minWidth: 300, maxWidth: 460 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 150 }}><label>Search</label>
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Service or category…" />
            </div>
            <div className="field" style={{ marginBottom: 0 }}><label>Show</label>
              <select value={view} onChange={(e) => setView(e.target.value)}>
                <option value="parts">Parts services</option>
                <option value="kitted">Has a kit</option>
                <option value="empty">No kit yet</option>
                <option value="all">All services</option>
              </select>
            </div>
          </div>
          <div style={{ border: '1px solid var(--line, #E2E8F0)', borderRadius: 10, overflow: 'hidden', maxHeight: 560, overflowY: 'auto' }}>
            {rows.map((s) => {
              const n = s.maps.length
              const active = s.id === selectedId
              return (
                <div key={s.id} onClick={() => selectService(s.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                    padding: '10px 13px', cursor: 'pointer', borderBottom: '1px solid #EEF1F6',
                    background: active ? '#EEF3FB' : '#fff',
                    borderLeft: active ? '3px solid #1B3A6B' : '3px solid transparent',
                  }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: isLikelyPart(s) ? '#132A4C' : 'var(--mist)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--mist)' }}>{s.category || '—'}</div>
                  </div>
                  {n > 0
                    ? <span className="badge" style={{ background: '#1B3A6B', color: '#fff', flexShrink: 0 }}>{n} part{n === 1 ? '' : 's'}</span>
                    : <span className="badge" style={{ flexShrink: 0 }}>{isLikelyPart(s) ? 'no kit' : 'labor'}</span>}
                </div>
              )
            })}
            {rows.length === 0 && <div style={{ padding: 16, color: 'var(--mist)' }}>Nothing to show for this filter.</div>}
          </div>
        </div>

        {/* RIGHT — kit detail */}
        <div style={{ flex: '2 1 460px', minWidth: 320 }}>
          {!selected ? (
            <div style={{ border: '1px dashed #CBD5E1', borderRadius: 12, padding: '48px 24px', textAlign: 'center', color: 'var(--mist)' }}>
              Select a service on the left to build its parts kit.
            </div>
          ) : (
            <div style={{ border: '1px solid var(--line, #E2E8F0)', borderRadius: 12, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#132A4C' }}>{selected.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--mist)' }}>{selected.category || 'Uncategorized'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: 'var(--mist)' }}>Kit material cost</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#1B3A6B' }}>{money(kitTotal)}</div>
                </div>
              </div>

              {!isLikelyPart(selected) && (
                <div style={{ marginTop: 12, background: '#FFF7ED', border: '1px solid #FED7AA', color: '#9A3412', padding: '8px 12px', borderRadius: 8, fontSize: 13 }}>
                  This reads as a labor or diagnostic service, which normally consumes no stock. Add parts only if it genuinely does.
                </div>
              )}

              <table className="data-table" style={{ marginTop: 14 }}>
                <thead>
                  <tr>
                    <th>Part</th><th style={{ textAlign: 'right', width: 90 }}>Qty</th>
                    <th style={{ textAlign: 'right', width: 90 }}>Unit cost</th>
                    <th style={{ textAlign: 'right', width: 90 }}>Line</th>
                    <th style={{ width: 70 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {kit.map((m) => {
                    const it = itemById[m.item_id]
                    const cost = itemCost(it)
                    const nm = it?.description || m.item?.description || m.item?.sku || '(unknown part)'
                    const cat = it?.category || m.item?.category
                    return (
                      <tr key={m.id}>
                        <td>{nm}{cat ? <span style={{ color: 'var(--mist)', fontSize: 12 }}> · {cat}</span> : null}</td>
                        <td style={{ textAlign: 'right' }}>
                          <input type="number" min="0" step="any" defaultValue={m.qty_per} disabled={busy}
                            style={{ width: 70, textAlign: 'right' }} onBlur={(e) => saveQty(m, e.target.value)} />
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--mist)' }}>{money(cost)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{cost == null ? '—' : money(cost * Number(m.qty_per || 0))}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="logout-button" disabled={busy} onClick={() => removeMap(m)}>Remove</button>
                        </td>
                      </tr>
                    )
                  })}
                  {kit.length === 0 && <tr><td colSpan="5" style={{ color: 'var(--mist)' }}>No parts yet. Add the first one below.</td></tr>}
                </tbody>
              </table>

              {/* Add-part row */}
              <div style={{ marginTop: 16, background: '#EEF3FB', borderRadius: 10, padding: 14 }}>
                <div style={{ fontWeight: 700, color: '#1B3A6B', marginBottom: 8 }}>Add a part</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 220, position: 'relative' }} ref={addBoxRef}>
                    <label>Search catalog or type a new part</label>
                    <input type="text" value={addTerm} disabled={busy}
                      onChange={(e) => { setAddTerm(e.target.value); setAddItemId(''); setAddOpen(true) }}
                      onFocus={() => setAddOpen(true)}
                      placeholder="e.g. 45+5 dual run capacitor" autoComplete="off" />
                    {addOpen && (addMatches.length > 0 || (addTerm.trim() && !exactMatch)) && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, background: '#fff', border: '1px solid #CBD5E1', borderRadius: 8, marginTop: 4, maxHeight: 260, overflowY: 'auto', boxShadow: '0 6px 20px rgba(0,0,0,0.10)' }}>
                        {addMatches.map((it) => (
                          <div key={it.id} onMouseDown={() => chooseItem(it)}
                            style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9' }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#EEF3FB')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}>
                            <div style={{ fontWeight: 600, color: '#132A4C' }}>{it.description || it.sku}</div>
                            <div style={{ fontSize: 12, color: 'var(--mist)' }}>{it.category || '—'}{itemCost(it) != null ? ` · ${money(itemCost(it))}` : ''}</div>
                          </div>
                        ))}
                        {addTerm.trim() && !exactMatch && (
                          <div onMouseDown={addNew}
                            style={{ padding: '9px 12px', cursor: 'pointer', color: '#1B3A6B', fontWeight: 700, background: '#F8FAFF' }}>
                            + Create new part “{addTerm.trim()}”
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="field" style={{ marginBottom: 0, width: 110 }}><label>Unit cost</label>
                    <input type="number" min="0" step="any" value={addCost} disabled={busy} onChange={(e) => setAddCost(e.target.value)} placeholder="$" />
                  </div>
                  <div className="field" style={{ marginBottom: 0, width: 90 }}><label>Qty</label>
                    <input type="number" min="0" step="any" value={addQty} disabled={busy} onChange={(e) => setAddQty(e.target.value)} />
                  </div>
                  <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={busy || (!addItemId && !addTerm.trim())}
                    onClick={() => (addItemId ? addExisting() : addNew())}>
                    {addItemId ? 'Add to kit' : (addTerm.trim() ? 'Create & add' : 'Add to kit')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
