// Supplies · Reorder / Shopping List
// Everything flagged low, in one buy-it list. Check an item off when you've
// bought it — optionally record what you paid, which logs the spend and refreshes
// the catalog's last price. Group by vendor to make the supply-house run easy.
import { useState, useEffect, Fragment } from 'react'
import { Link } from 'react-router-dom'
import { listReorder, setReorder, markPurchased } from './suppliesData'
import { useOrgSelector, OrgBar } from '../elements-hvac/shared'

const today = () => new Date().toISOString().slice(0, 10)

export default function SuppliesReorder({ profile }) {
  const org = useOrgSelector(profile)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [buyRow, setBuyRow] = useState(null) // id being marked purchased
  const [buyForm, setBuyForm] = useState({ qty: '', unitCost: '', vendor: '', date: today() })
  const [busy, setBusy] = useState(false)

  async function load() {
    if (!org.selectedOrg) return
    setLoading(true)
    setRows(await listReorder(org.selectedOrg))
    setLoading(false)
  }
  useEffect(() => { load() }, [org.selectedOrg])

  function openBuy(it) { setBuyRow(it.id); setBuyForm({ qty: it.reorder_qty ?? '', unitCost: it.last_price ?? '', vendor: it.typical_vendor || '', date: today() }) }
  async function confirmBuy(it) {
    setBusy(true)
    await markPurchased(org.selectedOrg, it, { qty: buyForm.qty, unitCost: buyForm.unitCost, vendor: buyForm.vendor, date: buyForm.date })
    setBusy(false); setBuyRow(null); load()
  }
  async function justRemove(it) {
    setBusy(true)
    await setReorder(org.selectedOrg, it.id, false)
    setBusy(false); load()
  }

  // Group by vendor for the shopping run.
  const groups = {}
  rows.forEach((r) => { const v = r.typical_vendor || 'Unassigned vendor'; (groups[v] = groups[v] || []).push(r) })
  const vendors = Object.keys(groups).sort()

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Reorder List</h2>
          <span className="badge">{rows.length} to buy</span>
        </div>
        <button className="logout-button" style={{ margin: 0 }} disabled={loading} onClick={load}>{loading ? 'Loading…' : 'Refresh'}</button>
      </div>
      <OrgBar {...org} />

      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0, maxWidth: 780 }}>
        Items flagged from the <Link to="/supplies">catalog</Link>, grouped by vendor. When you&apos;ve bought one, hit
        <strong> Bought</strong> — add the price to log the spend (optional), or just check it off. Cleared items drop off this list.
      </p>

      {rows.length === 0 ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 20, color: 'var(--mist)' }}>
          {loading ? 'Loading…' : 'Nothing on the reorder list. Flag supplies from the catalog when they run low.'}
        </div>
      ) : vendors.map((v) => (
        <div key={v} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8A93A6', fontWeight: 700, margin: '4px 0 6px' }}>{v}</div>
          <table className="data-table">
            <thead>
              <tr><th></th><th>Supply</th><th>Qty</th><th>Note</th><th>Last price</th></tr>
            </thead>
            <tbody>
              {groups[v].map((it) => (
                <Fragment key={it.id}>
                  <tr>
                    <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="auth-button" style={{ width: 'auto', margin: 0, padding: '4px 12px' }} onClick={() => (buyRow === it.id ? setBuyRow(null) : openBuy(it))}>{buyRow === it.id ? 'Cancel' : 'Bought'}</button>
                      <button className="logout-button" disabled={busy} onClick={() => justRemove(it)}>Remove</button>
                    </td>
                    <td><strong>{it.name}</strong>{it.category && <span style={{ color: 'var(--mist)', fontSize: 12, marginLeft: 6 }}>{it.category}</span>}</td>
                    <td>{it.reorder_qty != null ? `${it.reorder_qty} ${it.unit || ''}`.trim() : '—'}</td>
                    <td style={{ color: 'var(--mist)' }}>{it.reorder_note || '—'}</td>
                    <td style={{ color: 'var(--mist)' }}>{it.last_price != null ? `$${Number(it.last_price).toFixed(2)}` : '—'}</td>
                  </tr>
                  {buyRow === it.id && (
                    <tr><td colSpan="5" style={{ background: '#F0F9F4' }}>
                      <div style={{ padding: '6px 2px', display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div className="field" style={{ marginBottom: 0, width: 90 }}><label>Qty</label><input type="number" step="any" value={buyForm.qty} onChange={(e) => setBuyForm({ ...buyForm, qty: e.target.value })} /></div>
                        <div className="field" style={{ marginBottom: 0, width: 110 }}><label>Unit cost</label><input type="number" step="any" value={buyForm.unitCost} onChange={(e) => setBuyForm({ ...buyForm, unitCost: e.target.value })} placeholder="0.00" /></div>
                        <div className="field" style={{ marginBottom: 0, minWidth: 160 }}><label>Vendor</label><input type="text" value={buyForm.vendor} onChange={(e) => setBuyForm({ ...buyForm, vendor: e.target.value })} /></div>
                        <div className="field" style={{ marginBottom: 0, width: 150 }}><label>Date</label><input type="date" value={buyForm.date} onChange={(e) => setBuyForm({ ...buyForm, date: e.target.value })} /></div>
                        <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={busy} onClick={() => confirmBuy(it)}>Log &amp; clear</button>
                        <div style={{ flexBasis: '100%', fontSize: 12, color: 'var(--mist)' }}>Leave price blank to just check it off without logging spend.</div>
                      </div>
                    </td></tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
