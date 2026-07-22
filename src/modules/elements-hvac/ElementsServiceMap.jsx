// Elements-HVAC · Service -> SKU mapping
// The lightweight BOM: link each parts pricebook service to an inventory SKU
// (usually 1:1). Auto-suggests SKUs for unmapped parts; labor/diagnostic
// services are left untracked. Admin approves before anything is created.
import { useState, useEffect, useMemo } from 'react'
import { listServices, listMaps, listItems, createItemAndMap, mapExistingItem, unmap } from './data'
import { useOrgSelector, OrgBar } from './shared'

// Heuristic: services whose category/name look like labor, diagnosis, fees,
// memberships, etc. are NOT tracked parts.
const LABOR_RE = /(service call|diagnos|trip|labor|inspection|maintenance|membership|agreement|discount|\bfee\b|dispatch|tune[- ]?up|estimate|permit|warranty|callback)/i
const isLikelyPart = (svc) => !LABOR_RE.test(`${svc.category || ''} ${svc.name || ''}`)

function deriveSku(name, taken) {
  let base = (name || 'ITEM').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 36) || 'ITEM'
  let sku = base
  let n = 2
  while (taken.has(sku.toLowerCase())) { sku = `${base}-${n}`; n += 1 }
  taken.add(sku.toLowerCase())
  return sku
}

export default function ElementsServiceMap({ profile }) {
  const org = useOrgSelector(profile)
  const [services, setServices] = useState([])
  const [maps, setMaps] = useState([])
  const [items, setItems] = useState([])
  const [view, setView] = useState('unmapped') // unmapped | mapped | all
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function load() {
    if (!org.selectedOrg) return
    const [s, m, i] = await Promise.all([
      listServices(org.selectedOrg), listMaps(org.selectedOrg), listItems(org.selectedOrg),
    ])
    setServices(s); setMaps(m); setItems(i)
  }
  useEffect(() => { load() }, [org.selectedOrg])

  const mapByService = useMemo(() => {
    const map = {}
    maps.forEach((m) => { (map[m.service_id] = map[m.service_id] || []).push(m) })
    return map
  }, [maps])

  const rows = useMemo(() => {
    return services
      .map((s) => ({ ...s, maps: mapByService[s.id] || [] }))
      .filter((s) => {
        if (view === 'unmapped' && s.maps.length > 0) return false
        if (view === 'mapped' && s.maps.length === 0) return false
        if (search && !(`${s.name} ${s.category || ''}`.toLowerCase().includes(search.toLowerCase()))) return false
        return true
      })
  }, [services, mapByService, view, search])

  const unmappedParts = useMemo(
    () => services.filter((s) => !(mapByService[s.id]?.length) && isLikelyPart(s)),
    [services, mapByService]
  )

  async function createOne(svc) {
    setBusy(true); setMsg('')
    const taken = new Set(items.map((i) => i.sku.toLowerCase()))
    const sku = deriveSku(svc.name, taken)
    const { error } = await createItemAndMap(
      org.selectedOrg,
      { sku, description: svc.name, category: svc.category || null, item_class: isLikelyPart(svc) ? 'part' : 'part' },
      svc.id, 1
    )
    setBusy(false)
    setMsg(error ? error.message : `Created SKU ${sku} and mapped it.`)
    load()
  }

  async function bulkCreate() {
    if (unmappedParts.length === 0) return
    if (!window.confirm(`Auto-create ${unmappedParts.length} SKUs (one per unmapped parts service) and map them? Labor/diagnostic services are skipped. You can edit or archive any afterward.`)) return
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
    setMsg(`Created ${ok} SKU${ok === 1 ? '' : 's'}${fail ? `, ${fail} failed` : ''}.`)
    load()
  }

  async function mapTo(svc, itemId) {
    if (!itemId) return
    setBusy(true); setMsg('')
    const { error } = await mapExistingItem(org.selectedOrg, svc.id, itemId, 1)
    setBusy(false)
    setMsg(error ? error.message : 'Mapped.')
    load()
  }

  async function removeMap(mapId) {
    setBusy(true)
    await unmap(mapId)
    setBusy(false)
    load()
  }

  const mappedCount = services.length - services.filter((s) => !(mapByService[s.id]?.length)).length

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Service → SKU Mapping</h2>
          <span className="badge">{mappedCount}/{services.length} services mapped</span>
        </div>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={busy || unmappedParts.length === 0} onClick={bulkCreate}>
          Auto-create {unmappedParts.length} parts SKU{unmappedParts.length === 1 ? '' : 's'}
        </button>
      </div>
      <OrgBar {...org} />

      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0 }}>
        Each parts service maps to one inventory SKU. Labor, diagnosis, trip, and membership services are
        left untracked (they consume no stock). Auto-create proposes a SKU for every unmapped parts service;
        review and edit the results on the Item Catalog page.
      </p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ marginBottom: 0, minWidth: 220 }}><label>Search</label><input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Service or category…" /></div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Show</label>
          <select value={view} onChange={(e) => setView(e.target.value)}>
            <option value="unmapped">Unmapped</option>
            <option value="mapped">Mapped</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>
      {msg && <div style={{ marginBottom: 12, color: msg.includes('failed') || msg.includes('duplicate') ? '#B00020' : '#166534' }}>{msg}</div>}

      <table className="data-table">
        <thead>
          <tr><th>Category</th><th>Service</th><th>Mapping</th><th></th></tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id}>
              <td style={{ color: 'var(--mist)' }}>{s.category || '—'}</td>
              <td>{s.name}</td>
              <td>
                {s.maps.length > 0 ? (
                  s.maps.map((m) => (
                    <span key={m.id} className="badge" style={{ marginRight: 6, background: '#1B3A6B', color: '#fff' }}>
                      {m.item?.sku || 'SKU'} ×{m.qty_per}
                    </span>
                  ))
                ) : isLikelyPart(s) ? (
                  <select defaultValue="" onChange={(e) => mapTo(s, e.target.value)} disabled={busy}>
                    <option value="">— map to existing SKU —</option>
                    {items.map((it) => <option key={it.id} value={it.id}>{it.sku}</option>)}
                  </select>
                ) : (
                  <span style={{ color: 'var(--mist)', fontStyle: 'italic' }}>untracked (labor / diagnostic)</span>
                )}
              </td>
              <td>
                {s.maps.length > 0 ? (
                  s.maps.map((m) => <button key={m.id} className="logout-button" onClick={() => removeMap(m.id)} style={{ marginRight: 6 }}>Unmap</button>)
                ) : isLikelyPart(s) ? (
                  <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={busy} onClick={() => createOne(s)}>+ Create SKU</button>
                ) : null}
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan="4" style={{ color: 'var(--mist)' }}>Nothing to show for this filter.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
