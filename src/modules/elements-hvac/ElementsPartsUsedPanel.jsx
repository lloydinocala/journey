// Elements-HVAC · Parts Used panel (shared by the office screen and the mobile
// work order). Seeds the actual-parts list from the billed services' kits, lets
// you reconcile what was really used, then depletes the tech's truck on Record.
import { useState, useEffect, useMemo, useRef } from 'react'
import {
  listItems, listAllLocations, resolveInvoiceTruck,
  seedPartsUsed, listPartsUsed, recordPartsUsed,
} from './data'

const money = (n) => (n == null || n === '' || isNaN(n) ? '—' : `$${Number(n).toFixed(2)}`)
const costOf = (it) => (it ? (it.last_cost ?? it.standard_cost ?? null) : null)

export default function ElementsPartsUsedPanel({ orgId, invoiceId, embedded = false }) {
  const [locations, setLocations] = useState([])
  const [items, setItems] = useState([])
  const [selectedLoc, setSelectedLoc] = useState('')
  const [truck, setTruck] = useState(null)
  const [lines, setLines] = useState([])          // [{ item_id, name, category, cost, qty }]
  const [posted, setPosted] = useState(false)
  const [postedAt, setPostedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  // add-part typeahead
  const [addTerm, setAddTerm] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const addRef = useRef(null)

  async function load() {
    if (!orgId || !invoiceId) return
    setLoading(true); setMsg(''); setErr('')
    const [locs, its, tk, existing] = await Promise.all([
      listAllLocations(orgId), listItems(orgId), resolveInvoiceTruck(orgId, invoiceId), listPartsUsed(orgId, invoiceId),
    ])
    setLocations(locs); setItems(its); setTruck(tk)
    if (existing.length > 0) {
      setPosted(true)
      setPostedAt(existing[0]?.created_at || null)
      setSelectedLoc(existing[0]?.location_id || tk?.id || '')
      setLines(existing.map((r) => ({
        item_id: r.item_id,
        name: r.item?.description || '(part)',
        category: r.item?.category || '',
        cost: costOf(r.item),
        qty: Math.abs(Number(r.qty_delta || 0)),
      })))
    } else {
      setPosted(false); setPostedAt(null)
      const seed = await seedPartsUsed(orgId, invoiceId)
      setLines(seed.map((s) => ({
        item_id: s.item_id,
        name: s.item?.description || '(part)',
        category: s.item?.category || '',
        cost: costOf(s.item),
        qty: Number(s.qty || 0),
      })))
      const warehouse = locs.find((l) => l.type === 'warehouse')
      setSelectedLoc(tk?.id || warehouse?.id || locs[0]?.id || '')
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [orgId, invoiceId])

  useEffect(() => {
    function onDoc(e) { if (addRef.current && !addRef.current.contains(e.target)) setAddOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const inKit = useMemo(() => new Set(lines.map((l) => l.item_id)), [lines])
  const matches = useMemo(() => {
    const t = addTerm.trim().toLowerCase()
    return items
      .filter((it) => !inKit.has(it.id))
      .filter((it) => !t || `${it.description || ''} ${it.sku || ''} ${it.category || ''}`.toLowerCase().includes(t))
      .slice(0, 20)
  }, [items, addTerm, inKit])

  const total = useMemo(
    () => lines.reduce((s, l) => (l.cost == null ? s : s + Number(l.cost) * Number(l.qty || 0)), 0),
    [lines]
  )

  function setQty(idx, val) { setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, qty: val } : l))) }
  function remove(idx) { setLines((ls) => ls.filter((_, i) => i !== idx)) }
  function addItem(it) {
    setLines((ls) => [...ls, { item_id: it.id, name: it.description || it.sku, category: it.category || '', cost: costOf(it), qty: 1 }])
    setAddTerm(''); setAddOpen(false)
  }

  function resetToSuggested() {
    setAddTerm('')
    seedPartsUsed(orgId, invoiceId).then((seed) => {
      setLines(seed.map((s) => ({
        item_id: s.item_id, name: s.item?.description || '(part)',
        category: s.item?.category || '', cost: costOf(s.item), qty: Number(s.qty || 0),
      })))
      setMsg('Reset to the parts suggested by the billed services.')
    })
  }

  async function record() {
    setSaving(true); setMsg(''); setErr('')
    const payload = lines.map((l) => ({ item_id: l.item_id, qty: Number(l.qty), unit_cost: l.cost }))
    const { error, count } = await recordPartsUsed(orgId, invoiceId, { location_id: selectedLoc, lines: payload })
    setSaving(false)
    if (error) { setErr(error.message); return }
    setMsg(`Recorded ${count} part${count === 1 ? '' : 's'} against ${locName(selectedLoc)}. Stock depleted.`)
    load()
  }

  const locName = (id) => locations.find((l) => l.id === id)?.name || '—'

  const card = {
    border: '1px solid var(--line, #E2E8F0)', borderRadius: 12, padding: embedded ? 14 : 18,
    background: '#fff',
  }

  if (loading) return <div style={{ ...card, color: 'var(--mist)' }}>Loading parts used…</div>

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: embedded ? 15 : 17, fontWeight: 700, color: '#132A4C' }}>Parts Used</div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: 'var(--mist)' }}>Material cost</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1B3A6B' }}>{money(total)}</div>
        </div>
      </div>

      <p style={{ color: 'var(--mist)', fontSize: 12.5, margin: '6px 0 12px' }}>
        These are the parts that actually leave stock — start from what the billed services suggest, then fix it to
        match reality (e.g. a 45mf + 7.5mf pair used in place of a billed 45+5 dual). Nothing depletes until you press
        Record.
      </p>

      {posted && (
        <div style={{ marginBottom: 12, background: '#E3F1E8', border: '1px solid #166534', color: '#166534', padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
          Recorded{postedAt ? ` on ${new Date(postedAt).toLocaleDateString()}` : ''}. Editing and pressing Record again will re-post (it never double-deducts).
        </div>
      )}
      {msg && <div style={{ marginBottom: 12, color: '#166534', fontWeight: 600, fontSize: 13 }}>{msg}</div>}
      {err && <div style={{ marginBottom: 12, color: '#B00020', fontWeight: 600, fontSize: 13 }}>{err}</div>}

      {/* Location */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
        <div className="field" style={{ marginBottom: 0, minWidth: 220 }}>
          <label>Deplete from</label>
          <select value={selectedLoc} onChange={(e) => setSelectedLoc(e.target.value)} disabled={saving}>
            <option value="">— pick a location —</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}{l.type === 'truck' ? ' (truck)' : ''}</option>)}
          </select>
        </div>
        {truck
          ? <div style={{ fontSize: 12, color: 'var(--mist)', paddingBottom: 6 }}>Tech's truck: <strong style={{ color: '#132A4C' }}>{truck.name}</strong></div>
          : <div style={{ fontSize: 12, color: '#B0600A', paddingBottom: 6 }}>No truck found for this job's tech — pick a location to deplete.</div>}
      </div>

      {/* Parts table */}
      <table className="data-table">
        <thead>
          <tr>
            <th>Part</th>
            <th style={{ textAlign: 'right', width: 90 }}>Qty used</th>
            <th style={{ textAlign: 'right', width: 90 }}>Unit cost</th>
            <th style={{ textAlign: 'right', width: 90 }}>Line</th>
            <th style={{ width: 70 }}></th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, idx) => (
            <tr key={l.item_id}>
              <td>{l.name}{l.category ? <span style={{ color: 'var(--mist)', fontSize: 12 }}> · {l.category}</span> : null}</td>
              <td style={{ textAlign: 'right' }}>
                <input type="number" min="0" step="any" value={l.qty} disabled={saving}
                  style={{ width: 72, textAlign: 'right' }} onChange={(e) => setQty(idx, e.target.value)} />
              </td>
              <td style={{ textAlign: 'right', color: 'var(--mist)' }}>{money(l.cost)}</td>
              <td style={{ textAlign: 'right', fontWeight: 600 }}>{l.cost == null ? '—' : money(Number(l.cost) * Number(l.qty || 0))}</td>
              <td style={{ textAlign: 'right' }}>
                <button className="logout-button" disabled={saving} onClick={() => remove(idx)}>Remove</button>
              </td>
            </tr>
          ))}
          {lines.length === 0 && (
            <tr><td colSpan="5" style={{ color: 'var(--mist)' }}>No parts. Add what was used below, or this job used none.</td></tr>
          )}
        </tbody>
      </table>

      {/* Add a part */}
      <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 220, position: 'relative' }} ref={addRef}>
          <label>Add a part that was used</label>
          <input type="text" value={addTerm} disabled={saving}
            onChange={(e) => { setAddTerm(e.target.value); setAddOpen(true) }}
            onFocus={() => setAddOpen(true)} placeholder="Search your catalog…" autoComplete="off" />
          {addOpen && matches.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, background: '#fff', border: '1px solid #CBD5E1', borderRadius: 8, marginTop: 4, maxHeight: 240, overflowY: 'auto', boxShadow: '0 6px 20px rgba(0,0,0,0.10)' }}>
              {matches.map((it) => (
                <div key={it.id} onMouseDown={() => addItem(it)}
                  style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#EEF3FB')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}>
                  <div style={{ fontWeight: 600, color: '#132A4C' }}>{it.description || it.sku}</div>
                  <div style={{ fontSize: 12, color: 'var(--mist)' }}>{it.category || '—'}{costOf(it) != null ? ` · ${money(costOf(it))}` : ''}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <button className="logout-button" disabled={saving} onClick={resetToSuggested} title="Reset to what the billed services suggest">
          Reset to suggested
        </button>
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={saving || !selectedLoc} onClick={record}>
          {saving ? 'Recording…' : (posted ? 'Re-record parts used' : 'Record parts used')}
        </button>
        <span style={{ fontSize: 12, color: 'var(--mist)' }}>
          Depletes {lines.length} part{lines.length === 1 ? '' : 's'} from {selectedLoc ? locName(selectedLoc) : 'the chosen location'}.
        </span>
      </div>
    </div>
  )
}
