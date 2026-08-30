// Journey · Mobile · Supervisor — Cycle Counts (field)
// Cycle counts happen on the truck and in the warehouse, so field supervisors
// run them here on their phone. Same count engine as the office web app
// (elements-hvac/data), so a count is one record wherever it's started.
//
// Flow: pick a location → blind count what you physically see → Reveal
// variances → Post. Posting writes the corrections straight to the ledger.
// Field supervisors + admins only; any active location in the org.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isFieldAdmin } from './MobileNav'
import { IconChevronLeft } from './MobileIcons'
import {
  listCycleCounts, createCycleCount, getCycleCount, setCycleCountLine,
  postCycleCount, cancelCycleCount, listAllLocations,
} from './modules/elements-hvac/data'

const useDark = () => {
  const [dark] = useState(() => { try { return localStorage.getItem('jc-theme') === 'dark' } catch { return false } })
  return dark
}

export default function TechCycleCounts({ profile }) {
  const navigate = useNavigate()
  const dark = useDark()
  const orgId = profile?.org_id
  const admin = isFieldAdmin(profile)

  const [view, setView] = useState('list')     // 'list' | 'start' | 'count'
  const [counts, setCounts] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // start form
  const [startLoc, setStartLoc] = useState('')
  const [blind, setBlind] = useState(true)
  const [starting, setStarting] = useState(false)

  // active count
  const [count, setCount] = useState(null)     // { ...session, lines: [...] }
  const [revealed, setRevealed] = useState(false)
  const [posting, setPosting] = useState(false)
  const [savingLine, setSavingLine] = useState(null)

  async function loadList() {
    if (!orgId) return
    setLoading(true)
    const [cs, locs] = await Promise.all([
      listCycleCounts(orgId).catch(() => []),
      listAllLocations(orgId).catch(() => []),
    ])
    setCounts(cs)
    setLocations(locs)
    setLoading(false)
  }
  useEffect(() => { if (admin) loadList() }, [orgId])

  async function openCount(id) {
    setError(''); setRevealed(false)
    const c = await getCycleCount(orgId, id)
    if (!c) { setError('Could not open that count.'); return }
    setCount(c); setView('count')
  }

  async function startCount() {
    setError('')
    if (!startLoc) { setError('Pick a location to count.'); return }
    setStarting(true)
    const { session, error: err } = await createCycleCount(orgId, { location_id: startLoc, blind, scope: 'all', createdBy: profile?.id })
    setStarting(false)
    if (err || !session) { setError(err?.message || 'Could not start the count.'); return }
    setStartLoc(''); setBlind(true)
    openCount(session.id)
    loadList()
  }

  async function saveLine(line, value) {
    setSavingLine(line.id)
    await setCycleCountLine(orgId, line.id, value === '' ? null : value)
    setCount((c) => ({ ...c, lines: c.lines.map((l) => l.id === line.id ? { ...l, counted_qty: value === '' ? null : Number(value) } : l) }))
    setSavingLine(null)
  }

  async function doPost() {
    if (!count) return
    const countedLines = count.lines.filter((l) => l.counted_qty != null)
    if (!countedLines.length) { setError('Enter at least one counted quantity before posting.'); return }
    const adj = countedLines.filter((l) => Number(l.counted_qty) !== Number(l.current_on_hand)).length
    if (!window.confirm(`Post this count for ${count.location?.name || 'this location'}? ${adj} adjustment${adj === 1 ? '' : 's'} will be written to inventory now. This can’t be undone.`)) return
    setPosting(true); setError('')
    const res = await postCycleCount(orgId, count.id, profile?.id)
    setPosting(false)
    if (res?.error) { setError(res.error.message); return }
    window.alert(`Posted — ${res.adjustments} adjustment${res.adjustments === 1 ? '' : 's'}, net ${res.net > 0 ? '+' : ''}${res.net}.`)
    setView('list'); setCount(null); loadList()
  }

  async function discard() {
    if (!count) return
    if (!window.confirm(`Discard this in-progress count for ${count.location?.name || 'this location'}? Nothing will be posted.`)) return
    await cancelCycleCount(orgId, count.id)
    setView('list'); setCount(null); loadList()
  }

  const shell = `mobile-shell job-card-v2${dark ? ' jc-dark' : ''}`

  // ---- Access gate --------------------------------------------------------
  if (!admin) {
    return (
      <div className={shell}>
        <div className="jc-header">
          <button className="jc-back" onClick={() => navigate('/tech')}><IconChevronLeft /></button>
          <div className="jc-header-text"><div className="jc-title">Cycle Counts</div></div>
        </div>
        <div className="jc-body"><p className="jc-muted-note" style={{ padding: 16 }}>Cycle counts are for field supervisors.</p></div>
      </div>
    )
  }

  // ---- Count detail (blind entry + reveal + post) -------------------------
  if (view === 'count' && count) {
    const counted = count.lines.filter((l) => l.counted_qty != null).length
    return (
      <div className={shell}>
        <div className="jc-header">
          <button className="jc-back" onClick={() => { setView('list'); setCount(null); loadList() }}><IconChevronLeft /></button>
          <div className="jc-header-text">
            <div className="jc-title">{count.location?.name || 'Count'}</div>
            <div className="jc-subtitle">{count.blind ? 'Blind count' : 'Open count'} · {counted}/{count.lines.length} counted</div>
          </div>
        </div>
        <div className="jc-body">
          {error && <div className="jc-error" style={{ margin: '0 0 12px' }}>{error}</div>}
          <p className="jc-muted-note" style={{ marginTop: 0 }}>
            {revealed
              ? 'Variances revealed. Review the differences, then post to update inventory.'
              : count.blind
                ? 'Enter what you physically count. The expected quantity stays hidden until you reveal variances.'
                : 'Enter what you physically count.'}
          </p>

          {count.lines.map((l) => {
            const expected = Number(l.current_on_hand || 0)
            const has = l.counted_qty != null
            const delta = has ? Number(l.counted_qty) - expected : null
            return (
              <div key={l.id} className="cc-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px', borderBottom: '1px solid var(--line, #E2E8F0)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--ink, #152238)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.item?.description || 'Item'}</div>
                  <div style={{ fontSize: 12, color: 'var(--mist)' }}>
                    {l.item?.category || 'Uncategorized'}
                    {revealed ? ` · expected ${expected}` : ''}
                    {revealed && has && delta !== 0 ? (
                      <span style={{ fontWeight: 700, marginLeft: 6, color: delta < 0 ? '#B00020' : '#0B7A3B' }}>
                        {delta > 0 ? '+' : ''}{delta}
                      </span>
                    ) : null}
                    {revealed && has && delta === 0 ? <span style={{ marginLeft: 6, color: '#0B7A3B' }}>✓ match</span> : null}
                  </div>
                </div>
                <input
                  type="number" inputMode="decimal" step="any" min="0"
                  defaultValue={l.counted_qty ?? ''}
                  disabled={savingLine === l.id}
                  onBlur={(e) => saveLine(l, e.target.value)}
                  placeholder="—"
                  style={{ width: 74, textAlign: 'center', fontSize: 18, fontWeight: 700, padding: '10px 8px', borderRadius: 10, border: `1px solid ${has ? '#1B3A6B' : 'var(--line, #CBD5E1)'}` }}
                />
              </div>
            )
          })}
          {count.lines.length === 0 && <p className="jc-muted-note">This location has no stocked items to count yet. Receive stock first.</p>}
        </div>

        <div className="cc-actions" style={{ position: 'sticky', bottom: 0, display: 'flex', gap: 8, padding: 12, background: 'var(--card, #fff)', borderTop: '1px solid var(--line, #E2E8F0)' }}>
          {!revealed ? (
            <button className="jc-btn wide" onClick={() => setRevealed(true)} disabled={counted === 0}>Reveal variances</button>
          ) : (
            <button className="jc-btn wide" style={{ background: '#0B7A3B' }} onClick={doPost} disabled={posting}>{posting ? 'Posting…' : 'Post count'}</button>
          )}
          <button className="jc-btn ghost" onClick={discard} style={{ flex: '0 0 auto' }}>Discard</button>
        </div>
      </div>
    )
  }

  // ---- Start a count ------------------------------------------------------
  if (view === 'start') {
    return (
      <div className={shell}>
        <div className="jc-header">
          <button className="jc-back" onClick={() => { setView('list'); setError('') }}><IconChevronLeft /></button>
          <div className="jc-header-text"><div className="jc-title">Start a count</div></div>
        </div>
        <div className="jc-body">
          {error && <div className="jc-error" style={{ margin: '0 0 12px' }}>{error}</div>}
          <div className="jc-task">
            <div className="jc-task-head blue" style={{ cursor: 'default' }}><span className="jc-th-title">What are you counting?</span></div>
            <div className="jc-task-body">
              <label className="jc-field-label">Location</label>
              <select value={startLoc} onChange={(e) => setStartLoc(e.target.value)}
                style={{ width: '100%', padding: '12px 10px', fontSize: 16, borderRadius: 10, border: '1px solid var(--line, #CBD5E1)', marginBottom: 14 }}>
                <option value="">— pick a truck or warehouse —</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}{l.type === 'truck' ? ' (truck)' : ''}</option>)}
              </select>
              <label className="consent-agree" style={{ marginBottom: 0 }}>
                <input type="checkbox" checked={blind} onChange={(e) => setBlind(e.target.checked)} />
                <span>Blind count (hide the expected quantity while counting — recommended)</span>
              </label>
            </div>
          </div>
          <button className="jc-btn wide" onClick={startCount} disabled={starting} style={{ marginTop: 4 }}>{starting ? 'Starting…' : 'Start counting'}</button>
        </div>
      </div>
    )
  }

  // ---- List ---------------------------------------------------------------
  const inProgress = counts.filter((c) => c.status === 'open')
  const done = counts.filter((c) => c.status !== 'open').slice(0, 20)
  const fmt = (s) => { try { return new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) } catch { return '' } }

  return (
    <div className={shell}>
      <div className="jc-header">
        <button className="jc-back" onClick={() => navigate('/tech')}><IconChevronLeft /></button>
        <div className="jc-header-text"><div className="jc-title">Cycle Counts</div></div>
      </div>
      <div className="jc-body">
        {error && <div className="jc-error" style={{ margin: '0 0 12px' }}>{error}</div>}
        <button className="jc-btn wide" onClick={() => { setError(''); setView('start') }} style={{ marginBottom: 16 }}>+ Start a count</button>

        {loading ? (
          <p className="jc-muted-note">Loading…</p>
        ) : (
          <>
            <div className="jc-section-label" style={{ fontSize: 12, fontWeight: 700, color: 'var(--mist)', textTransform: 'uppercase', letterSpacing: 0.5, margin: '4px 0 8px' }}>In progress</div>
            {inProgress.length === 0 ? (
              <p className="jc-muted-note" style={{ marginTop: 0 }}>No counts in progress. Start one above.</p>
            ) : inProgress.map((c) => (
              <button key={c.id} className="cc-list-item" onClick={() => openCount(c.id)}
                style={{ display: 'flex', width: '100%', textAlign: 'left', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 12px', marginBottom: 8, borderRadius: 12, border: '1px solid var(--line, #E2E8F0)', background: 'var(--card, #fff)' }}>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--ink, #152238)' }}>{c.location?.name || 'Location'}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--mist)' }}>{fmt(c.created_at)} · {c.countedCount}/{c.lineCount} counted{c.blind ? ' · blind' : ''}</div>
                </div>
                <span className="badge" style={{ background: '#F8EEDD', color: '#B0600A' }}>In progress</span>
              </button>
            ))}

            {done.length > 0 && (
              <>
                <div className="jc-section-label" style={{ fontSize: 12, fontWeight: 700, color: 'var(--mist)', textTransform: 'uppercase', letterSpacing: 0.5, margin: '18px 0 8px' }}>Recent</div>
                {done.map((c) => (
                  <div key={c.id} style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px', marginBottom: 8, borderRadius: 12, border: '1px solid var(--line, #E2E8F0)' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--ink, #152238)' }}>{c.location?.name || 'Location'}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--mist)' }}>
                        {fmt(c.posted_at || c.created_at)}
                        {c.status === 'posted' ? ` · ${c.adjustments_count ?? 0} adj · net ${c.net_qty_delta > 0 ? '+' : ''}${c.net_qty_delta ?? 0}` : ' · cancelled'}
                      </div>
                    </div>
                    <span className="badge" style={{ background: c.status === 'posted' ? '#E3F1E8' : '#EEF1F5', color: c.status === 'posted' ? '#166534' : '#64748B' }}>
                      {c.status === 'posted' ? 'Posted' : 'Cancelled'}
                    </span>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
