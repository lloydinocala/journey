// Supplies · Purchases (spend log)
// The record of what was spent on expendables — populated when reorder items are
// checked off, plus a manual "log a purchase" for receipts bought on the fly.
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { listPurchases, addPurchase, listSupplies, SUPPLY_CATEGORIES } from './suppliesData'
import { useOrgSelector, OrgBar } from '../elements-hvac/shared'

const today = () => new Date().toISOString().slice(0, 10)
const money = (n) => (n == null || isNaN(n) ? '—' : `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
const RANGES = [{ v: 30, label: 'Last 30 days' }, { v: 90, label: 'Last 90 days' }, { v: 365, label: 'Last 12 months' }, { v: null, label: 'All time' }]
const blank = { item_name: '', category: '', qty: '', unit_cost: '', vendor: '', purchase_date: today(), notes: '' }

export default function SuppliesPurchases({ profile }) {
  const org = useOrgSelector(profile)
  const [rows, setRows] = useState([])
  const [supplies, setSupplies] = useState([])
  const [range, setRange] = useState(90)
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    if (!org.selectedOrg) return
    setLoading(true)
    const [p, s] = await Promise.all([listPurchases(org.selectedOrg, { sinceDays: range }), listSupplies(org.selectedOrg)])
    setRows(p); setSupplies(s); setLoading(false)
  }
  useEffect(() => { load() }, [org.selectedOrg, range])

  const total = rows.reduce((s, r) => s + (Number(r.total_cost) || 0), 0)

  function pickSupply(id) {
    const s = supplies.find((x) => x.id === id)
    setForm((f) => ({ ...f, supply_id: id, item_name: s ? s.name : f.item_name, category: s?.category || f.category, vendor: s?.typical_vendor || f.vendor, unit_cost: s?.last_price ?? f.unit_cost }))
  }

  async function handleSubmit(e) {
    e.preventDefault(); setError('')
    if (!form.item_name.trim() && !form.supply_id) { setError('Pick a supply or type an item name.'); return }
    setSaving(true)
    const { error: err } = await addPurchase(org.selectedOrg, form)
    setSaving(false)
    if (err) { setError(err.message); return }
    setForm(blank); setShowForm(false); load()
  }

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Supplies Purchases</h2>
          <span className="badge">{rows.length} in range</span>
        </div>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => { setShowForm((s) => !s); setError('') }}>{showForm ? 'Cancel' : '+ Log a purchase'}</button>
      </div>
      <OrgBar {...org} />

      {showForm && (
        <form className="inline-form" onSubmit={handleSubmit} style={{ marginBottom: 20, flexWrap: 'wrap' }}>
          <div className="field" style={{ minWidth: 200 }}>
            <label>From catalog (optional)</label>
            <select value={form.supply_id || ''} onChange={(e) => pickSupply(e.target.value)}>
              <option value="">— type a name below —</option>
              {supplies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ minWidth: 180 }}><label>Item</label><input type="text" value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} placeholder="What was bought" /></div>
          <div className="field" style={{ minWidth: 140 }}>
            <label>Category</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="">—</option>
              {SUPPLY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field" style={{ width: 80 }}><label>Qty</label><input type="number" step="any" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></div>
          <div className="field" style={{ width: 110 }}><label>Unit cost</label><input type="number" step="any" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} placeholder="0.00" /></div>
          <div className="field" style={{ minWidth: 150 }}><label>Vendor</label><input type="text" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /></div>
          <div className="field" style={{ width: 150 }}><label>Date</label><input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} /></div>
          <button className="auth-button" type="submit" disabled={saving} style={{ width: 'auto' }}>{saving ? 'Saving…' : 'Log purchase'}</button>
        </form>
      )}
      {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
        <div className="field" style={{ marginBottom: 0, minWidth: 170 }}>
          <label>Range</label>
          <select value={range == null ? '' : range} onChange={(e) => setRange(e.target.value === '' ? null : Number(e.target.value))}>
            {RANGES.map((r) => <option key={r.label} value={r.v == null ? '' : r.v}>{r.label}</option>)}
          </select>
        </div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '10px 18px' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1B3A6B' }}>{money(total)}</div>
          <div style={{ fontSize: 12, color: 'var(--mist)' }}>Total spend in range</div>
        </div>
      </div>

      <table className="data-table">
        <thead>
          <tr><th>Date</th><th>Item</th><th>Category</th><th>Qty</th><th>Unit cost</th><th>Total</th><th>Vendor</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td style={{ whiteSpace: 'nowrap' }}>{r.purchase_date}</td>
              <td><strong>{r.item_name || '—'}</strong>{r.notes && <span style={{ color: 'var(--mist)', fontSize: 12, display: 'block' }}>{r.notes}</span>}</td>
              <td style={{ color: 'var(--mist)' }}>{r.category || '—'}</td>
              <td style={{ color: 'var(--mist)' }}>{r.qty ?? '—'}</td>
              <td style={{ color: 'var(--mist)' }}>{money(r.unit_cost)}</td>
              <td style={{ fontWeight: 600 }}>{money(r.total_cost)}</td>
              <td style={{ color: 'var(--mist)' }}>{r.vendor || '—'}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan="7" style={{ color: 'var(--mist)' }}>{loading ? 'Loading…' : 'No purchases logged in this range. Check items off the reorder list, or log one above.'}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
