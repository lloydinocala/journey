// Elements-HVAC · P5a · Cycle Counts
// Count a location's stock, review variances against the book quantity, and post
// corrections into the ledger (txn_type 'count'). Blind counts hide the expected
// quantity until you reveal it, so the count isn't biased by what the system thinks.
import { useState, useEffect, useMemo } from 'react'
import {
  listCycleCounts, createCycleCount, getCycleCount, setCycleCountLine,
  addCycleCountItem, deleteCycleCountLine, postCycleCount, cancelCycleCount,
  deleteCycleCount, listAllLocations, listItems,
} from './data'
import { useOrgSelector, OrgBar } from './shared'

const STATUS = {
  open: { t: 'In progress', bg: '#F8EEDD', c: '#B0600A' },
  posted: { t: 'Posted', bg: '#E3F1E8', c: '#166534' },
  cancelled: { t: 'Cancelled', bg: '#EEF1F6', c: '#475569' },
}
const badge = (k) => { const m = STATUS[k] || STATUS.open; return <span className="badge" style={{ background: m.bg, color: m.c }}>{m.t}</span> }
const fmtDate = (d) => (d ? new Date(d).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')
const num = (n) => (n == null || n === '' ? '' : Number(n))

export default function ElementsCycleCounts({ profile }) {
  const org = useOrgSelector(profile)
  const [sessions, setSessions] = useState([])
  const [locations, setLocations] = useState([])
  const [items, setItems] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  // start form
  const [showStart, setShowStart] = useState(false)
  const [form, setForm] = useState({ location_id: '', blind: true, scope: 'all', category: '', note: '' })
  const [addItemId, setAddItemId] = useState('')

  async function loadAll() {
    if (!org.selectedOrg) return
    const [ss, locs, its] = await Promise.all([
      listCycleCounts(org.selectedOrg), listAllLocations(org.selectedOrg), listItems(org.selectedOrg),
    ])
    setSessions(ss); setLocations(locs); setItems(its)
  }
  useEffect(() => { loadAll(); setSelectedId(''); setDetail(null) }, [org.selectedOrg])

  const categories = useMemo(() => [...new Set(items.map((i) => i.category).filter(Boolean))].sort(), [items])

  async function open(id) {
    setSelectedId(id); setMsg(''); setErr('')
    const d = await getCycleCount(org.selectedOrg, id)
    setDetail(d)
    setRevealed(d ? (!d.blind || d.status !== 'open') : false)
  }

  async function start() {
    if (!form.location_id) { setErr('Pick a location.'); return }
    setBusy(true); setErr(''); setMsg('')
    const { session, error } = await createCycleCount(org.selectedOrg, { ...form, createdBy: profile?.id })
    setBusy(false)
    if (error) { setErr(error.message); return }
    setShowStart(false); setForm({ location_id: '', blind: true, scope: 'all', category: '', note: '' })
    await loadAll(); open(session.id)
  }

  // Local edit of a counted qty, persisted on blur.
  function editCount(lineId, val) {
    setDetail((d) => ({ ...d, lines: d.lines.map((l) => (l.id === lineId ? { ...l, counted_qty: val === '' ? '' : val } : l)) }))
  }
  async function saveCount(line) {
    await setCycleCountLine(org.selectedOrg, line.id, line.counted_qty)
    setSessions((ss) => ss) // counts refresh happens on reload; keep list light
  }

  async function addItem() {
    if (!addItemId) return
    setBusy(true); setErr('')
    const { data, error } = await addCycleCountItem(org.selectedOrg, detail.id, detail.location_id, addItemId)
    setBusy(false)
    if (error) { setErr(error.message); return }
    setAddItemId('')
    setDetail((d) => ({ ...d, lines: [...d.lines, { ...data, current_on_hand: Number(data.expected_qty || 0), counted_qty: null }] }))
  }

  async function removeLine(lineId) {
    setBusy(true); setErr('')
    await deleteCycleCountLine(org.selectedOrg, lineId)
    setBusy(false)
    setDetail((d) => ({ ...d, lines: d.lines.filter((l) => l.id !== lineId) }))
  }

  async function post() {
    const counted = detail.lines.filter((l) => l.counted_qty !== null && l.counted_qty !== '')
    if (!counted.length) { setErr('Enter at least one counted quantity first.'); return }
    const withVar = counted.filter((l) => Number(l.counted_qty) !== Number(l.current_on_hand)).length
    if (!window.confirm(`Post this count? ${withVar} item(s) will be adjusted to match your count. This writes to the stock ledger and can't be undone (you'd correct it with another count).`)) return
    setBusy(true); setErr(''); setMsg('')
    // persist any unsaved edits first
    for (const l of counted) await setCycleCountLine(org.selectedOrg, l.id, l.counted_qty)
    const { error, adjustments, net } = await postCycleCount(org.selectedOrg, detail.id, profile?.id)
    setBusy(false)
    if (error) { setErr(error.message); return }
    setMsg(`Count posted. ${adjustments} item(s) adjusted, net ${net > 0 ? '+' : ''}${net} units.`)
    await loadAll(); open(detail.id)
  }

  async function cancel() {
    if (!window.confirm('Cancel this count? No stock will be changed.')) return
    setBusy(true); await cancelCycleCount(org.selectedOrg, detail.id); setBusy(false)
    await loadAll(); open(detail.id)
  }
  async function removeSession() {
    if (!window.confirm('Delete this count session and its lines? This cannot be undone.')) return
    setBusy(true); await deleteCycleCount(org.selectedOrg, detail.id); setBusy(false)
    setDetail(null); setSelectedId(''); await loadAll()
  }

  const stats = useMemo(() => {
    if (!detail) return null
    const lines = detail.lines || []
    const counted = lines.filter((l) => l.counted_qty !== null && l.counted_qty !== '')
    const variances = counted.filter((l) => Number(l.counted_qty) !== Number(l.expected_qty))
    const net = counted.reduce((s, l) => s + (Number(l.counted_qty) - Number(l.expected_qty)), 0)
    return { total: lines.length, counted: counted.length, variances: variances.length, net }
  }, [detail])

  const isOpen = detail?.status === 'open'
  const itemsNotInCount = useMemo(() => {
    if (!detail) return items
    const have = new Set(detail.lines.map((l) => l.item_id))
    return items.filter((i) => !have.has(i.id))
  }, [items, detail])

  function VarCell({ line }) {
    if (line.counted_qty === null || line.counted_qty === '') return <span style={{ color: '#CBD5E1' }}>—</span>
    const v = Number(line.counted_qty) - Number(line.expected_qty)
    if (v === 0) return <span className="badge" style={{ background: '#E3F1E8', color: '#166534' }}>match</span>
    const over = v > 0
    return <span className="badge" style={{ background: over ? '#F8EEDD' : '#FBE7E7', color: over ? '#B0600A' : '#B00020' }}>{over ? '+' : ''}{v}</span>
  }

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Cycle Counts</h2>
          {sessions.some((s) => s.status === 'open') && <span className="badge" style={{ background: '#F8EEDD', color: '#B0600A' }}>{sessions.filter((s) => s.status === 'open').length} in progress</span>}
        </div>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => { setShowStart((v) => !v); setErr('') }}>+ Start a count</button>
      </div>
      <OrgBar {...org} />

      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0, maxWidth: 760 }}>
        Count what's physically on a truck or in the warehouse, then post the corrections. Blind counts hide the expected
        quantity so the number you write down is what you actually see — variances are revealed at review, before you post.
      </p>

      {msg && <div style={{ marginBottom: 12, background: '#E3F1E8', border: '1px solid #166534', color: '#166534', padding: '8px 12px', borderRadius: 8, fontWeight: 600, fontSize: 13 }}>{msg}</div>}
      {err && <div className="auth-error" style={{ marginBottom: 12 }}>{err}</div>}

      {showStart && (
        <div style={{ border: '1px solid var(--line, #E2E8F0)', borderRadius: 12, padding: 16, marginBottom: 16, background: '#FBFCFE' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ marginBottom: 0, minWidth: 200 }}><label>Location to count</label>
              <select value={form.location_id} onChange={(e) => setForm((f) => ({ ...f, location_id: e.target.value }))}>
                <option value="">— pick a location —</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}{l.type ? ` (${l.type})` : ''}</option>)}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0, minWidth: 170 }}><label>Scope</label>
              <select value={form.scope} onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value }))}>
                <option value="all">Everything stocked here</option>
                <option value="category">One category</option>
                <option value="manual">Start empty (add by hand)</option>
              </select>
            </div>
            {form.scope === 'category' && (
              <div className="field" style={{ marginBottom: 0, minWidth: 170 }}><label>Category</label>
                <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                  <option value="">— pick —</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
            <div className="field" style={{ marginBottom: 0 }}><label>&nbsp;</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, height: 38 }}>
                <input type="checkbox" checked={form.blind} onChange={(e) => setForm((f) => ({ ...f, blind: e.target.checked }))} />
                Blind count (hide book qty)
              </label>
            </div>
            <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={busy} onClick={start}>Start count</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* LEFT — sessions */}
        <div style={{ flex: '1 1 300px', minWidth: 260, maxWidth: 400 }}>
          <div style={{ border: '1px solid var(--line, #E2E8F0)', borderRadius: 10, overflow: 'hidden', maxHeight: 660, overflowY: 'auto' }}>
            {sessions.map((s) => {
              const active = s.id === selectedId
              return (
                <div key={s.id} onClick={() => open(s.id)}
                  style={{ padding: '10px 13px', cursor: 'pointer', borderBottom: '1px solid #EEF1F6', background: active ? '#EEF3FB' : '#fff', borderLeft: active ? '3px solid #1B3A6B' : '3px solid transparent' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                    <div style={{ fontWeight: 600, color: '#132A4C' }}>{s.location?.name || 'Location'}</div>
                    {badge(s.status)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--mist)' }}>
                    {fmtDate(s.created_at)} · {s.countedCount}/{s.lineCount} counted
                    {s.status === 'posted' && s.adjustments_count != null ? ` · ${s.adjustments_count} adjusted` : ''}
                    {s.scope === 'category' && s.category ? ` · ${s.category}` : ''}
                  </div>
                </div>
              )
            })}
            {sessions.length === 0 && <div style={{ padding: 16, color: 'var(--mist)' }}>No counts yet. Start one above.</div>}
          </div>
        </div>

        {/* RIGHT — detail */}
        <div style={{ flex: '2 1 520px', minWidth: 320 }}>
          {!detail ? (
            <div style={{ border: '1px dashed #CBD5E1', borderRadius: 12, padding: '48px 24px', textAlign: 'center', color: 'var(--mist)' }}>
              Select a count, or start a new one.
            </div>
          ) : (
            <div style={{ border: '1px solid var(--line, #E2E8F0)', borderRadius: 12, padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#132A4C', display: 'flex', gap: 10, alignItems: 'center' }}>
                    {detail.location?.name} {badge(detail.status)}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--mist)', marginTop: 2 }}>
                    {fmtDate(detail.created_at)}{detail.blind ? ' · blind count' : ''}
                    {stats ? ` · ${stats.counted}/${stats.total} counted` : ''}
                    {detail.status === 'posted' ? ` · posted ${fmtDate(detail.posted_at)}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {isOpen && detail.blind && !revealed && <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => setRevealed(true)}>Reveal variances</button>}
                  {isOpen && (!detail.blind || revealed) && <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={busy} onClick={post}>Post count</button>}
                  {isOpen && <button className="logout-button" disabled={busy} onClick={cancel}>Cancel</button>}
                  <button className="logout-button" style={{ color: '#B00020', borderColor: '#F0B4B4' }} disabled={busy} onClick={removeSession}>Delete</button>
                </div>
              </div>

              {isOpen && detail.blind && !revealed && (
                <p style={{ fontSize: 12.5, color: '#B0600A', marginTop: 10 }}>Blind count — enter what you physically see. The book quantity and variances stay hidden until you reveal them.</p>
              )}

              <div style={{ overflowX: 'auto', border: '1px solid var(--line, #E2E8F0)', borderRadius: 8, marginTop: 12 }}>
                <table className="data-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th style={{ width: 90, textAlign: 'right' }}>Counted</th>
                      {revealed && <th style={{ width: 80, textAlign: 'right' }}>Book</th>}
                      {revealed && <th style={{ width: 90 }}>Variance</th>}
                      {isOpen && <th style={{ width: 40 }}></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {detail.lines.map((l) => (
                      <tr key={l.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: '#152238' }}>{l.item?.description || '(item)'}</div>
                          <div style={{ fontSize: 11, color: 'var(--mist)' }}>{l.item?.category || 'Uncategorized'}{l.bin ? ` · bin ${l.bin}` : ''}</div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {isOpen ? (
                            <input type="number" step="any" value={l.counted_qty == null ? '' : l.counted_qty}
                              onChange={(e) => editCount(l.id, e.target.value)} onBlur={() => saveCount(l)}
                              style={{ width: 74, textAlign: 'right' }} placeholder="—" />
                          ) : (l.counted_qty == null ? '—' : Number(l.counted_qty))}
                        </td>
                        {revealed && <td style={{ textAlign: 'right', color: 'var(--mist)' }}>{num(l.expected_qty)}</td>}
                        {revealed && <td><VarCell line={l} /></td>}
                        {isOpen && <td style={{ textAlign: 'center' }}><button className="link-button" title="Remove from count" onClick={() => removeLine(l.id)} style={{ color: '#94A3B8', border: 'none', background: 'none', cursor: 'pointer', fontSize: 16 }}>×</button></td>}
                      </tr>
                    ))}
                    {detail.lines.length === 0 && <tr><td colSpan={isOpen ? 5 : 4} style={{ color: 'var(--mist)' }}>No items in this count. Add some below.</td></tr>}
                  </tbody>
                </table>
              </div>

              {isOpen && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select value={addItemId} onChange={(e) => setAddItemId(e.target.value)} style={{ minWidth: 240 }}>
                    <option value="">+ Add an item found on the shelf…</option>
                    {itemsNotInCount.map((i) => <option key={i.id} value={i.id}>{i.description}{i.category ? ` · ${i.category}` : ''}</option>)}
                  </select>
                  <button className="logout-button" disabled={!addItemId || busy} onClick={addItem}>Add</button>
                </div>
              )}

              {revealed && stats && (
                <div style={{ marginTop: 12, fontSize: 13, color: '#1B3A6B', fontWeight: 600 }}>
                  {stats.variances} variance{stats.variances === 1 ? '' : 's'} across {stats.counted} counted · net {stats.net > 0 ? '+' : ''}{stats.net} units
                </div>
              )}
              {detail.status === 'posted' && (
                <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--mist)' }}>
                  Posted: {detail.adjustments_count ?? 0} item(s) adjusted in the ledger, net {detail.net_qty_delta > 0 ? '+' : ''}{detail.net_qty_delta ?? 0} units. On-hand now matches this count.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
