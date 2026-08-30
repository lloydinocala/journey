// Elements-HVAC · Vendor Cross-Reference (seed the alias crosswalk)
// Point Quincy at one vendor and it proposes "this vendor's part = your catalog
// item" matches from your real purchase history (part_vendor_offerings), judged
// by AI so single vs dual capacitors, exact microfarads, ECM vs PSC motors, and
// accessories-that-aren't-the-part are sorted out. You confirm before anything
// is saved into the learning crosswalk that auto-matches future vendor invoices.
import { useState, useEffect, useMemo } from 'react'
import {
  listAliasVendorStats, suggestAliases, learnAliases,
  listVendorAliasesDetailed, deleteItemVendor,
} from './data'
import { useOrgSelector, OrgBar } from './shared'

const money = (n) => (n == null || n === '' || isNaN(n) ? '—' : `$${Number(n).toFixed(2)}`)
const CONF = {
  high: { t: 'High', bg: '#E3F1E8', c: '#166534' },
  medium: { t: 'Medium', bg: '#F8EEDD', c: '#B0600A' },
  low: { t: 'Low', bg: '#EEF1F6', c: '#475569' },
}

export default function ElementsVendorCrossref({ profile }) {
  const org = useOrgSelector(profile)
  const [vendorStats, setVendorStats] = useState([])
  const [vendorId, setVendorId] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  // suggestion results: rows = [{ ...item, candidates, ai_pick, confidence, reason, sel, include }]
  const [rows, setRows] = useState(null)
  const [stats, setStats] = useState(null)
  const [existing, setExisting] = useState([])

  async function loadVendors() {
    if (!org.selectedOrg) return
    setVendorStats(await listAliasVendorStats())
  }
  useEffect(() => { loadVendors(); setVendorId(''); setRows(null); setStats(null); setExisting([]) }, [org.selectedOrg])

  const vendor = useMemo(() => vendorStats.find((v) => v.vendor_id === vendorId) || null, [vendorStats, vendorId])

  async function loadExisting(vId) {
    if (!vId) { setExisting([]); return }
    setExisting(await listVendorAliasesDetailed(org.selectedOrg, vId))
  }

  function onPickVendor(vId) {
    setVendorId(vId); setRows(null); setStats(null); setMsg(''); setErr('')
    loadExisting(vId)
  }

  async function runSuggest() {
    if (!vendorId) return
    setBusy(true); setErr(''); setMsg(''); setRows(null); setStats(null)
    const { data, error } = await suggestAliases(vendorId)
    setBusy(false)
    if (error) { setErr(error.message || 'Could not build suggestions.'); return }
    const prepared = (data.items || []).map((it) => ({
      ...it,
      sel: it.ai_pick >= 0 ? String(it.ai_pick) : '',
      include: it.ai_pick >= 0,
    }))
    setRows(prepared)
    setStats(data.stats || null)
    if (!prepared.length) setMsg('No unmatched catalog items had any candidate parts in this vendor’s history.')
  }

  function setRow(i, patch) { setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r))) }
  function onSel(i, val) { setRow(i, { sel: val, include: val !== '' }) }

  const selectedCount = useMemo(() => (rows || []).filter((r) => r.include && r.sel !== '').length, [rows])

  function bulk(kind) {
    setRows((rs) => rs.map((r) => {
      if (kind === 'none') return { ...r, include: false }
      if (kind === 'ai') return { ...r, sel: r.ai_pick >= 0 ? String(r.ai_pick) : '', include: r.ai_pick >= 0 }
      if (kind === 'high') return { ...r, sel: r.ai_pick >= 0 ? String(r.ai_pick) : '', include: r.ai_pick >= 0 && r.confidence === 'high' }
      return r
    }))
  }

  async function saveSelected() {
    const chosen = (rows || []).filter((r) => r.include && r.sel !== '')
    if (!chosen.length) { setErr('Nothing selected to save.'); return }
    setBusy(true); setErr(''); setMsg('')
    const lines = chosen.map((r) => {
      const c = r.candidates[Number(r.sel)]
      return { item_id: r.item_id, vendor_sku: c.vendor_sku, vendor_description: c.vendor_description, last_cost: c.last_cost }
    })
    try {
      await learnAliases(org.selectedOrg, vendorId, lines)
      setMsg(`Saved ${lines.length} alias${lines.length === 1 ? '' : 'es'}. Future invoices from this vendor will auto-match these parts.`)
      // Drop saved rows from the worklist and refresh the learned list + counts.
      const savedItems = new Set(chosen.map((r) => r.item_id))
      setRows((rs) => rs.filter((r) => !savedItems.has(r.item_id)))
      await loadExisting(vendorId)
      await loadVendors()
    } catch (e) { setErr(e.message || String(e)) }
    setBusy(false)
  }

  async function removeAlias(id) {
    if (!window.confirm('Remove this learned alias? Future invoices will no longer auto-match this vendor part.')) return
    setBusy(true); setErr('')
    const { error } = await deleteItemVendor(id)
    setBusy(false)
    if (error) { setErr(error.message); return }
    await loadExisting(vendorId); await loadVendors()
  }

  return (
    <div>
      <div className="page-header-bar">
        <h2>Vendor Cross-Reference</h2>
      </div>
      <OrgBar {...org} />

      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0, maxWidth: 780 }}>
        Every vendor has their own names, SKUs, and brands for the same part your catalog names generically. Point Quincy at
        a vendor and it proposes matches from your real purchase history — you approve them, and from then on that vendor's
        invoices auto-match without guessing. Nothing is saved until you confirm.
      </p>

      {msg && <div style={{ marginBottom: 12, background: '#E3F1E8', border: '1px solid #166534', color: '#166534', padding: '8px 12px', borderRadius: 8, fontWeight: 600, fontSize: 13 }}>{msg}</div>}
      {err && <div className="auth-error" style={{ marginBottom: 12 }}>{err}</div>}

      {/* Vendor picker */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
        <div className="field" style={{ marginBottom: 0, minWidth: 260 }}>
          <label>Vendor</label>
          <select value={vendorId} onChange={(e) => onPickVendor(e.target.value)} disabled={busy}>
            <option value="">— choose a vendor with purchase history —</option>
            {vendorStats.map((v) => (
              <option key={v.vendor_id} value={v.vendor_id}>
                {v.vendor_name} ({Number(v.offerings).toLocaleString()} parts on file{Number(v.aliases) > 0 ? `, ${v.aliases} learned` : ''})
              </option>
            ))}
          </select>
        </div>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={!vendorId || busy} onClick={runSuggest}>
          {busy ? 'Quincy is matching…' : 'Suggest matches from history'}
        </button>
        {vendorStats.length === 0 && <span style={{ color: 'var(--mist)', fontSize: 13 }}>No vendor purchase history is on file yet.</span>}
      </div>

      {busy && !rows && (
        <div style={{ border: '1px dashed #CBD5E1', borderRadius: 12, padding: '28px 24px', textAlign: 'center', color: 'var(--mist)' }}>
          Reading {vendor ? `${Number(vendor.offerings).toLocaleString()} ` : ''}vendor parts and matching them to your catalog. This can take up to a minute.
        </div>
      )}

      {/* Suggestions worklist */}
      {rows && rows.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
            <div style={{ fontSize: 13, color: 'var(--mist)' }}>
              {stats ? `Quincy proposed a match for ${stats.ai_matched} of ${stats.items_with_candidates} items with candidates.` : ''} Review, adjust, and save the ones you trust.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="logout-button" onClick={() => bulk('high')} disabled={busy}>Select high-confidence</button>
              <button className="logout-button" onClick={() => bulk('ai')} disabled={busy}>Select all AI picks</button>
              <button className="logout-button" onClick={() => bulk('none')} disabled={busy}>Clear all</button>
            </div>
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid var(--line, #E2E8F0)', borderRadius: 10 }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: 34 }}></th>
                  <th>Your catalog item</th>
                  <th style={{ minWidth: 280 }}>Vendor's part (from history)</th>
                  <th style={{ width: 90, textAlign: 'right' }}>Last cost</th>
                  <th style={{ width: 150 }}>Quincy</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const conf = r.confidence ? (CONF[r.confidence] || CONF.low) : null
                  return (
                    <tr key={r.item_id} style={{ background: r.include && r.sel !== '' ? '#F3F8F4' : undefined }}>
                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={r.include && r.sel !== ''} disabled={r.sel === ''}
                          onChange={(e) => setRow(i, { include: e.target.checked })} />
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#152238' }}>{r.item_description}</div>
                        <div style={{ fontSize: 11, color: 'var(--mist)' }}>{r.item_category || 'Uncategorized'}{r.item_sku ? ` · ${r.item_sku}` : ''}</div>
                      </td>
                      <td>
                        <select value={r.sel} onChange={(e) => onSel(i, e.target.value)}
                          style={{ width: '100%', border: r.sel === '' ? '1px solid #E2E8F0' : (r.ai_pick >= 0 && String(r.ai_pick) === r.sel ? '1px solid #86C79A' : '1px solid #E4B36B') }}>
                          <option value="">— no match —</option>
                          {r.candidates.map((c, ci) => (
                            <option key={c.offering_id} value={String(ci)}>
                              {c.vendor_description}{c.vendor_sku ? ` (${c.vendor_sku})` : ''}{ci === r.ai_pick ? '  ★ Quincy' : ''}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--mist)' }}>
                        {r.sel !== '' ? money(r.candidates[Number(r.sel)]?.last_cost) : '—'}
                      </td>
                      <td>
                        {r.ai_pick >= 0 && conf && <span className="badge" style={{ background: conf.bg, color: conf.c }}>{conf.t}</span>}
                        {r.ai_pick < 0 && <span className="badge" style={{ background: '#EEF1F6', color: '#475569' }}>No match</span>}
                        {r.reason && <div style={{ fontSize: 11, color: 'var(--mist)', marginTop: 2 }}>{r.reason}</div>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center' }}>
            <button className="auth-button" style={{ width: 'auto', margin: 0, padding: '10px 22px' }} disabled={busy || selectedCount === 0} onClick={saveSelected}>
              {busy ? 'Saving…' : `Save ${selectedCount} selected alias${selectedCount === 1 ? '' : 'es'}`}
            </button>
            <span style={{ fontSize: 12, color: 'var(--mist)' }}>Items you don't match now stay unmatched — you can re-run this anytime, or they'll learn from the next invoice.</span>
          </div>
        </div>
      )}

      {rows && rows.length === 0 && !busy && (
        <div style={{ border: '1px dashed #CBD5E1', borderRadius: 12, padding: '28px 24px', textAlign: 'center', color: 'var(--mist)', marginBottom: 24 }}>
          Nothing left to suggest for this vendor — every catalog item with a candidate is already mapped.
        </div>
      )}

      {/* Existing learned aliases */}
      {vendorId && (
        <div>
          <h3 style={{ marginBottom: 6 }}>Learned aliases {existing.length > 0 && <span style={{ color: 'var(--mist)', fontWeight: 400, fontSize: 14 }}>({existing.length})</span>}</h3>
          {existing.length === 0 ? (
            <p style={{ color: 'var(--mist)', fontSize: 13 }}>No aliases saved for this vendor yet. Approve some suggestions above, or they'll build up as you capture invoices.</p>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid var(--line, #E2E8F0)', borderRadius: 10 }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead><tr><th>Catalog item</th><th>Vendor's name for it</th><th style={{ width: 120 }}>Vendor SKU</th><th style={{ width: 90, textAlign: 'right' }}>Last cost</th><th style={{ width: 70 }}></th></tr></thead>
                <tbody>
                  {existing.map((a) => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 600, color: '#152238' }}>{a.item?.description || '(item)'}</td>
                      <td>{a.vendor_description || <span style={{ color: 'var(--mist)' }}>—</span>}</td>
                      <td style={{ fontSize: 12 }}>{a.vendor_sku || '—'}</td>
                      <td style={{ textAlign: 'right', color: 'var(--mist)' }}>{money(a.last_cost)}</td>
                      <td><button className="logout-button" style={{ color: '#B00020', borderColor: '#F0B4B4', padding: '4px 10px' }} disabled={busy} onClick={() => removeAlias(a.id)}>Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
