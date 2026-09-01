// Supplies · Catalog (module landing)
// The lean list of expendables you buy regularly but don't inventory. Add/edit
// items, and flag anything to the reorder list. No stock counts by design.
import { useState, useEffect, Fragment } from 'react'
import { Link } from 'react-router-dom'
import {
  listSupplies, addSupply, updateSupply, retireSupply, setReorder,
  suppliesDashboard, SUPPLY_CATEGORIES, SUPPLY_UNITS,
} from './suppliesData'
import { useOrgSelector, OrgBar } from '../elements-hvac/shared'
import QuincyBrief from '../../QuincyBrief'

const money = (n) => (n == null || n === '' || isNaN(n) ? '—' : `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
const money0 = (n) => (n == null || isNaN(n) ? '—' : `$${Math.round(Number(n)).toLocaleString()}`)
const blank = { name: '', category: '', unit: 'each', typical_vendor: '', last_price: '', notes: '' }

export default function SuppliesCatalog({ profile }) {
  const org = useOrgSelector(profile)
  const [items, setItems] = useState([])
  const [d, setD] = useState(null)
  const [showRetired, setShowRetired] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [reorderRow, setReorderRow] = useState(null) // id currently opening the reorder detail
  const [reorderForm, setReorderForm] = useState({ qty: '', note: '' })
  const [busy, setBusy] = useState(false)

  async function load() {
    if (!org.selectedOrg) return
    setLoading(true)
    const [list, dash] = await Promise.all([listSupplies(org.selectedOrg, { includeRetired: showRetired }), suppliesDashboard(org.selectedOrg)])
    setItems(list); setD(dash); setLoading(false)
  }
  useEffect(() => { load() }, [org.selectedOrg, showRetired])

  function startNew() { setEditingId(null); setForm(blank); setShowForm(true); setError('') }
  function startEdit(it) {
    setEditingId(it.id)
    setForm({ name: it.name || '', category: it.category || '', unit: it.unit || 'each', typical_vendor: it.typical_vendor || '', last_price: it.last_price ?? '', notes: it.notes || '' })
    setShowForm(true); setError('')
  }
  function cancelForm() { setEditingId(null); setForm(blank); setShowForm(false); setError('') }

  async function handleSubmit(e) {
    e.preventDefault(); setError('')
    if (!form.name.trim()) { setError('Name is required.'); return }
    setSaving(true)
    const payload = { name: form.name.trim(), category: form.category || null, unit: form.unit || null, typical_vendor: form.typical_vendor.trim() || null, last_price: form.last_price, notes: form.notes.trim() || null }
    const err = editingId ? (await updateSupply(editingId, payload)).error : (await addSupply(org.selectedOrg, payload)).error
    setSaving(false)
    if (err) { setError(err.message); return }
    cancelForm(); load()
  }

  function openReorder(it) { setReorderRow(it.id); setReorderForm({ qty: it.reorder_qty ?? '', note: it.reorder_note || '' }) }
  async function addToReorder(it) {
    setBusy(true)
    await setReorder(org.selectedOrg, it.id, true, { qty: reorderForm.qty, note: reorderForm.note })
    setBusy(false); setReorderRow(null); load()
  }
  async function removeFromReorder(it) {
    setBusy(true)
    await setReorder(org.selectedOrg, it.id, false)
    setBusy(false); load()
  }

  const Metric = ({ to, label, value, sub, accent, alert }) => (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div style={{ border: `1px solid ${alert ? '#E3B0B0' : 'var(--line, #E2E8F0)'}`, background: alert ? '#FCEFEF' : '#FBFCFE', borderRadius: 12, padding: '14px 16px', height: '100%' }}>
        <div style={{ fontSize: 12, color: 'var(--mist)', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: accent || '#132A4C', marginTop: 4 }}>{value}</div>
        <div style={{ fontSize: 12, color: 'var(--mist)', marginTop: 4, minHeight: 16 }}>{sub}</div>
      </div>
    </Link>
  )
  const reorderAlert = !!d && d.reorderCount > 0

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Supplies</h2>
          <span className="badge">{items.length} shown</span>
        </div>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => (showForm ? cancelForm() : startNew())}>{showForm ? 'Cancel' : '+ New Supply'}</button>
      </div>
      <OrgBar {...org} />

      <div style={{ margin: '12px 0 16px' }}>
        <QuincyBrief kind="supplies" context={{
          suppliesTracked: d ? d.itemCount : 0,
          onReorderList: d ? d.reorderCount : 0,
          itemsToBuy: d ? d.reorderItems.map((r) => ({ item: r.name, qty: r.qty, vendor: r.vendor })) : [],
          spendLast30Days: d ? d.spend30 : 0,
          spendLast90Days: d ? d.spend90 : 0,
        }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12, marginBottom: 20 }}>
        <Metric to="/supplies" label="Supplies tracked" value={loading && !d ? '…' : String(d ? d.itemCount : 0)} sub="in the catalog" accent="#132A4C" />
        <Metric to="/supplies/reorder" label="On the reorder list" value={loading && !d ? '…' : String(d ? d.reorderCount : 0)} sub={reorderAlert ? 'ready to buy' : 'nothing to buy'} accent={reorderAlert ? '#B8720A' : '#0B7A3B'} alert={reorderAlert} />
        <Metric to="/supplies/purchases" label="Spent (30 days)" value={loading && !d ? '…' : money0(d ? d.spend30 : 0)} sub="on supplies" accent="#1B3A6B" />
        <Metric to="/supplies/purchases" label="Spent (90 days)" value={loading && !d ? '…' : money0(d ? d.spend90 : 0)} sub="on supplies" accent="#1B3A6B" />
      </div>

      {showForm && (
        <form className="inline-form" onSubmit={handleSubmit} style={{ marginBottom: 20, flexWrap: 'wrap' }}>
          {editingId && <div style={{ flexBasis: '100%', fontWeight: 700, color: '#1B3A6B' }}>Editing {form.name || 'supply'}</div>}
          <div className="field" style={{ minWidth: 220 }}><label>Name</label><input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Zip ties, 8 in." required /></div>
          <div className="field" style={{ minWidth: 150 }}>
            <label>Category</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="">—</option>
              {SUPPLY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field" style={{ width: 120 }}>
            <label>Unit</label>
            <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              {SUPPLY_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="field" style={{ minWidth: 170 }}><label>Typical vendor</label><input type="text" value={form.typical_vendor} onChange={(e) => setForm({ ...form, typical_vendor: e.target.value })} placeholder="Supply house" /></div>
          <div className="field" style={{ width: 130 }}><label>Last price</label><input type="number" step="any" value={form.last_price} onChange={(e) => setForm({ ...form, last_price: e.target.value })} placeholder="0.00" /></div>
          <div className="field" style={{ minWidth: 220, flex: 1 }}><label>Notes</label><input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Size, spec, part #, etc." /></div>
          <button className="auth-button" type="submit" disabled={saving} style={{ width: 'auto' }}>{saving ? 'Saving…' : (editingId ? 'Save changes' : 'Add supply')}</button>
        </form>
      )}
      {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}

      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0, maxWidth: 780 }}>
        Supplies are expendables you buy regularly but <strong>don&apos;t</strong> count as inventory — paper, tape, zip ties,
        gallon chemicals, fuses. Flag anything low to the <Link to="/supplies/reorder">reorder list</Link>; checking it off
        there logs the spend.
      </p>

      <label className="nav-link" style={{ cursor: 'pointer', display: 'inline-block', marginBottom: 12 }}>
        <input type="checkbox" checked={showRetired} onChange={(e) => setShowRetired(e.target.checked)} style={{ marginRight: 6 }} />
        Show removed
      </label>

      <table className="data-table">
        <thead>
          <tr><th></th><th>Supply</th><th>Category</th><th>Unit</th><th>Typical vendor</th><th>Last price</th><th>Reorder</th></tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <Fragment key={it.id}>
              <tr style={it.needs_reorder ? { background: '#FFF7ED' } : undefined}>
                <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button className="logout-button" onClick={() => startEdit(it)}>Edit</button>
                  {!it.deleted_at && <button className="logout-button" onClick={async () => { if (confirm('Remove this supply from the catalog?')) { await retireSupply(it.id); load() } }}>Remove</button>}
                </td>
                <td><strong>{it.name}</strong>{it.notes && <span style={{ color: 'var(--mist)', fontSize: 12, display: 'block' }}>{it.notes}</span>}</td>
                <td style={{ color: 'var(--mist)' }}>{it.category || '—'}</td>
                <td style={{ color: 'var(--mist)' }}>{it.unit || '—'}</td>
                <td style={{ color: 'var(--mist)' }}>{it.typical_vendor || '—'}</td>
                <td>{money(it.last_price)}</td>
                <td>
                  {it.needs_reorder ? (
                    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                      <span className="badge" style={{ background: '#B8720A', color: '#fff' }}>On list</span>
                      <button className="logout-button" disabled={busy} onClick={() => removeFromReorder(it)}>Remove</button>
                    </span>
                  ) : reorderRow === it.id ? (
                    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <input type="number" step="any" placeholder="Qty" value={reorderForm.qty} onChange={(e) => setReorderForm({ ...reorderForm, qty: e.target.value })} style={{ width: 64 }} />
                      <input type="text" placeholder="Note" value={reorderForm.note} onChange={(e) => setReorderForm({ ...reorderForm, note: e.target.value })} style={{ width: 110 }} />
                      <button className="auth-button" style={{ width: 'auto', margin: 0, padding: '4px 10px' }} disabled={busy} onClick={() => addToReorder(it)}>Add</button>
                      <button className="logout-button" onClick={() => setReorderRow(null)}>×</button>
                    </span>
                  ) : (
                    <button className="logout-button" onClick={() => openReorder(it)}>+ Reorder</button>
                  )}
                </td>
              </tr>
            </Fragment>
          ))}
          {items.length === 0 && <tr><td colSpan="7" style={{ color: 'var(--mist)' }}>{loading ? 'Loading…' : 'No supplies yet. Add the expendables you buy regularly.'}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
