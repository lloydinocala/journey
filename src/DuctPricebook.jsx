// Duct Cleaning Pricebook — the flat price list duct cleaning estimates and invoices use.
// One row per item: category, item, materials cost, price, taxable to the customer, task hours.
// Materials w/ tax, profit and profit % are worked out from your sales tax rate — office only,
// never shown to customers.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

const money = (n) => (n == null || isNaN(n) ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const pct = (n) => (n == null || !isFinite(n) ? '—' : Math.round(n * 1000) / 10 + '%')
const BLANK = { category: '', name: '', materials: '', price: '', taxable: false, task_hours: '' }

export default function DuctPricebook({ profile }) {
  const isSuper = profile?.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [orgId, setOrgId] = useState(profile?.org_id || '')
  const [rows, setRows] = useState([])
  const [rate, setRate] = useState(0)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [adding, setAdding] = useState(null)
  const [showInactive, setShowInactive] = useState(false)
  const [q, setQ] = useState('')

  useEffect(() => {
    if (isSuper) supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
      setOrgs(data || []); if (!orgId && data?.length) setOrgId(data[0].id)
    })
  }, [])

  async function load() {
    if (!orgId) return
    setLoading(true)
    const [{ data }, { data: o }] = await Promise.all([
      supabase.from('duct_pricebook_items').select('*').eq('org_id', orgId).order('sort_order').order('name'),
      supabase.from('organizations').select('sales_tax_rate').eq('id', orgId).maybeSingle(),
    ])
    setRows(data || []); setRate(Number(o?.sales_tax_rate) || 0); setLoading(false)
  }
  useEffect(() => { load() }, [orgId])

  async function save(row, patch) {
    setErr('')
    const clean = { ...patch }
    for (const k of ['materials', 'price', 'task_hours']) if (k in clean) clean[k] = clean[k] === '' || clean[k] == null ? (k === 'task_hours' ? null : 0) : Number(clean[k])
    const { error } = await supabase.from('duct_pricebook_items').update({ ...clean, updated_at: new Date().toISOString() }).eq('id', row.id)
    if (error) setErr(error.message)
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, ...clean } : r)))
  }
  async function add(e) {
    e.preventDefault()
    if (!adding.category.trim() || !adding.name.trim()) { setErr('Category and item are required.'); return }
    const max = rows.reduce((m, r) => Math.max(m, r.sort_order || 0), 0)
    const { error } = await supabase.from('duct_pricebook_items').insert({
      org_id: orgId, category: adding.category.trim(), name: adding.name.trim(), materials: Number(adding.materials) || 0,
      price: Number(adding.price) || 0, taxable: !!adding.taxable, task_hours: adding.task_hours === '' ? null : Number(adding.task_hours), sort_order: max + 10,
    })
    if (error) { setErr(error.message); return }
    setAdding(null); load()
  }

  const cats = useMemo(() => [...new Set(rows.map((r) => r.category))], [rows])
  const shown = rows.filter((r) => (showInactive || r.is_active) && (!q.trim() || (r.name + ' ' + r.category).toLowerCase().includes(q.toLowerCase())))
  const num = (row, field, w = 90) => (
    <input type="number" step="0.01" defaultValue={row[field] ?? ''} key={row.id + field + row[field]} onBlur={(e) => { if (String(e.target.value) !== String(row[field] ?? '')) save(row, { [field]: e.target.value }) }} style={{ width: w, textAlign: 'right' }} />
  )
  const txt = (row, field, w) => (
    <input defaultValue={row[field] || ''} key={row.id + field + row[field]} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== row[field]) save(row, { [field]: v }) }} style={{ width: w }} list={field === 'category' ? 'dc-cats' : undefined} />
  )

  return (
    <div className="page">
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0 }}>Duct Cleaning Pricebook</h2>
          {isSuper && <OrgPicker orgs={orgs} value={orgId} onChange={setOrgId} />}
        </div>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => setAdding({ ...BLANK, category: cats[0] || '' })}>+ Add item</button>
      </div>
      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0, maxWidth: 860 }}>
        The price list duct cleaning estimates and invoices are built from. Materials w/ tax uses your {rate}% sales tax rate; profit and profit % are for the office only and never appear on customer documents. Taxable means sales tax is charged to the customer on that item. Task hours feed performance pay.
      </p>
      {err && <div className="auth-error" style={{ marginBottom: 10 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items…" style={{ minWidth: 240 }} />
        <label style={{ fontSize: 13 }}><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show inactive</label>
      </div>
      <datalist id="dc-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>

      {adding && (
        <form onSubmit={add} className="section-card" style={{ padding: 14, marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ marginBottom: 0 }}><label>Category</label><input list="dc-cats" value={adding.category} onChange={(e) => setAdding({ ...adding, category: e.target.value })} style={{ width: 150 }} /></div>
          <div className="field" style={{ marginBottom: 0 }}><label>Item</label><input value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} style={{ width: 280 }} /></div>
          <div className="field" style={{ marginBottom: 0 }}><label>Materials</label><input type="number" step="0.01" value={adding.materials} onChange={(e) => setAdding({ ...adding, materials: e.target.value })} style={{ width: 90 }} /></div>
          <div className="field" style={{ marginBottom: 0 }}><label>Price</label><input type="number" step="0.01" value={adding.price} onChange={(e) => setAdding({ ...adding, price: e.target.value })} style={{ width: 90 }} /></div>
          <div className="field" style={{ marginBottom: 0 }}><label>Task hrs</label><input type="number" step="0.01" value={adding.task_hours} onChange={(e) => setAdding({ ...adding, task_hours: e.target.value })} style={{ width: 80 }} /></div>
          <label style={{ fontSize: 13, paddingBottom: 8 }}><input type="checkbox" checked={adding.taxable} onChange={(e) => setAdding({ ...adding, taxable: e.target.checked })} /> Taxable</label>
          <button className="auth-button" type="submit" style={{ width: 'auto', margin: 0 }}>Add</button>
          <button className="logout-button" type="button" onClick={() => setAdding(null)}>Cancel</button>
        </form>
      )}

      {loading ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : !rows.length ? <p style={{ color: 'var(--mist)' }}>No items yet — add your first one.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr><th>Category</th><th>Item</th><th style={{ textAlign: 'right' }}>Materials</th><th style={{ textAlign: 'right' }}>Materials w/ tax</th><th style={{ textAlign: 'right' }}>Price</th><th style={{ textAlign: 'right' }}>Profit</th><th style={{ textAlign: 'right' }}>Profit %</th><th>Taxable</th><th style={{ textAlign: 'right' }}>Task hrs</th><th>Active</th></tr></thead>
            <tbody>
              {shown.map((r) => {
                const mt = Number(r.materials || 0) * (1 + rate / 100)
                const profit = Number(r.price || 0) - mt
                const p = Number(r.price) > 0 ? profit / Number(r.price) : null
                return (
                  <tr key={r.id} style={{ opacity: r.is_active ? 1 : 0.5 }}>
                    <td>{txt(r, 'category', 130)}</td>
                    <td>{txt(r, 'name', 300)}</td>
                    <td style={{ textAlign: 'right' }}>{num(r, 'materials')}</td>
                    <td style={{ textAlign: 'right', color: 'var(--mist)' }}>{money(mt)}</td>
                    <td style={{ textAlign: 'right' }}>{num(r, 'price')}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: profit < 0 ? '#B00020' : undefined }}>{money(profit)}</td>
                    <td style={{ textAlign: 'right', color: p != null && p < 0.4 ? '#B0600A' : undefined }}>{pct(p)}</td>
                    <td style={{ textAlign: 'center' }}><input type="checkbox" checked={!!r.taxable} onChange={(e) => save(r, { taxable: e.target.checked })} /></td>
                    <td style={{ textAlign: 'right' }}>{num(r, 'task_hours', 70)}</td>
                    <td style={{ textAlign: 'center' }}><input type="checkbox" checked={!!r.is_active} onChange={(e) => save(r, { is_active: e.target.checked })} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
