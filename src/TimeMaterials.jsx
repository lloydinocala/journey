import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

// Time & Materials parts pricebook. Serves both Residential and Commercial jobs
// off the single shared part_items catalog (same data as the Parts Catalog /
// inventory), surfaced with only the columns T&M billing needs. Server-paged via
// the search_parts RPC so it stays fast across tens of thousands of parts.
// "Preferred Vendor" uses part_items.preferred_vendor_id when set, otherwise
// falls back to the cheapest vendor the RPC reports.
const UNIT_OPTS = ['each', 'ft', 'lb', 'gal', 'box', 'roll', 'hour', 'set', 'pair', 'case']
const PAGE = 100

export default function TimeMaterials({ profile }) {
  const isSuperAdmin = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')

  const [rows, setRows] = useState([])
  const [prefMap, setPrefMap] = useState({})          // item_id -> preferred_vendor_id
  const [vendors, setVendors] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')   // all (active) | archived
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const offsetRef = useRef(0)

  // add form
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [newVendor, setNewVendor] = useState('')
  const [newUnit, setNewUnit] = useState('each')
  const [newCost, setNewCost] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  // inline edit
  const [editingId, setEditingId] = useState(null)
  const [editRow, setEditRow] = useState({})

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        if (!selectedOrg && data && data.length > 0) setSelectedOrg(data[0].id)
      })
    }
  }, [])

  async function loadVendors(orgId) {
    const { data } = await supabase.from('vendors').select('id, name')
      .eq('org_id', orgId).eq('is_active', true).order('name')
    setVendors(data || [])
  }

  async function fetchPref(orgId, ids) {
    if (!ids.length) return {}
    const { data } = await supabase.from('part_items')
      .select('id, preferred_vendor_id').eq('org_id', orgId).in('id', ids)
    const m = {}
    for (const r of (data || [])) if (r.preferred_vendor_id) m[r.id] = r.preferred_vendor_id
    return m
  }

  const load = useCallback(async (orgId, append = false) => {
    if (!orgId) { setRows([]); setPrefMap({}); setLoading(false); return }
    const off = append ? offsetRef.current : 0
    append ? setLoadingMore(true) : setLoading(true)
    const { data, error } = await supabase.rpc('search_parts', {
      p_org: orgId,
      p_q: search.trim(),
      p_filter: statusFilter === 'archived' ? 'archived' : 'all',
      p_limit: PAGE,
      p_offset: off,
    })
    const list = error ? [] : (data || [])
    const pm = await fetchPref(orgId, list.map((r) => r.id))
    if (append) {
      setRows((prev) => [...prev, ...list])
      setPrefMap((prev) => ({ ...prev, ...pm }))
      offsetRef.current = off + list.length
    } else {
      setRows(list)
      setPrefMap(pm)
      offsetRef.current = list.length
    }
    setHasMore(list.length === PAGE)
    setLoading(false)
    setLoadingMore(false)
  }, [search, statusFilter])

  // Reload when org or status filter changes.
  useEffect(() => {
    if (selectedOrg) { loadVendors(selectedOrg); load(selectedOrg, false) }
    else setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg, statusFilter])

  // Debounced reload on search.
  useEffect(() => {
    if (!selectedOrg) return
    const t = setTimeout(() => load(selectedOrg, false), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const vendorName = (id) => vendors.find((v) => v.id === id)?.name || ''
  const preferredFor = (r) => {
    const set = prefMap[r.id]
    if (set) return vendorName(set) || '—'
    return r.cheapest_vendor || '—'
  }

  async function handleAdd(e) {
    e.preventDefault()
    setErr('')
    if (!newName.trim()) { setErr('Part name is required.'); return }
    setSaving(true)
    const { error } = await supabase.from('part_items').insert({
      org_id: selectedOrg,
      generic_name: newName.trim(),
      category: newCategory.trim() || null,
      base_unit: newUnit || 'each',
      last_cost: newCost === '' ? null : parseFloat(newCost),
      preferred_vendor_id: newVendor || null,
    })
    setSaving(false)
    if (error) { setErr(error.message); return }
    setNewName(''); setNewCategory(''); setNewVendor(''); setNewUnit('each'); setNewCost('')
    load(selectedOrg, false)
  }

  function startEdit(r) {
    setEditingId(r.id)
    setEditRow({
      generic_name: r.generic_name || '',
      category: r.category || '',
      base_unit: r.base_unit || 'each',
      last_cost: r.last_cost ?? '',
      preferred_vendor_id: prefMap[r.id] || '',
    })
  }

  async function saveEdit(id) {
    await supabase.from('part_items').update({
      generic_name: editRow.generic_name.trim(),
      category: editRow.category.trim() || null,
      base_unit: editRow.base_unit || 'each',
      last_cost: editRow.last_cost === '' ? null : parseFloat(editRow.last_cost),
      preferred_vendor_id: editRow.preferred_vendor_id || null,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    setEditingId(null)
    load(selectedOrg, false)
  }

  async function toggleArchive(r) {
    await supabase.from('part_items').update({ is_active: statusFilter === 'archived' }).eq('id', r.id)
    load(selectedOrg, false)
  }

  const gridTemplateColumns = '1.9fr 1.1fr 1.3fr 0.7fr 0.9fr 1.3fr'
  const archivedView = statusFilter === 'archived'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <h2 className="page-title" style={{ margin: 0 }}>Time &amp; Materials</h2>
        <span className="badge">{rows.length.toLocaleString()}{hasMore ? '+' : ''} parts</span>
      </div>
      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 4, marginBottom: 16 }}>
        Shared materials catalog used for Time &amp; Materials billing on both residential and commercial jobs.
      </p>

      {isSuperAdmin && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      <form className="inline-form" onSubmit={handleAdd} style={{ marginBottom: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field">
          <label>Part</label>
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. 5-ton condenser fan motor" />
        </div>
        <div className="field">
          <label>Category</label>
          <input type="text" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="e.g. Motors" />
        </div>
        <div className="field">
          <label>Preferred Vendor</label>
          <select value={newVendor} onChange={(e) => setNewVendor(e.target.value)}>
            <option value="">— none —</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Units</label>
          <select value={newUnit} onChange={(e) => setNewUnit(e.target.value)}>
            {UNIT_OPTS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Last Cost</label>
          <input type="number" step="0.01" value={newCost} onChange={(e) => setNewCost(e.target.value)} placeholder="0.00" />
        </div>
        <button className="auth-button" type="submit" disabled={saving || !selectedOrg} style={{ width: 'auto', padding: '8px 18px', margin: 0 }}>
          {saving ? 'Adding…' : 'Add Part'}
        </button>
      </form>
      {err && <p style={{ color: '#b00020', fontSize: 13, marginTop: -4, marginBottom: 12 }}>{err}</p>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search parts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '8px 10px', minWidth: 220 }}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Active</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <div className="grid-table" style={{ gridTemplateColumns, minWidth: 900 }}>
              <div className="grid-cell grid-head">Part</div>
              <div className="grid-cell grid-head">Category</div>
              <div className="grid-cell grid-head">Preferred Vendor</div>
              <div className="grid-cell grid-head">Units</div>
              <div className="grid-cell grid-head">Last Cost</div>
              <div className="grid-cell grid-head">Actions</div>

              {rows.map((r, rowIdx) => {
                const rowBg = rowIdx % 2 === 0 ? 'var(--panel)' : 'var(--ink)'
                return editingId === r.id ? (
                  <div key={r.id} style={{ display: 'contents' }}>
                    <div className="grid-cell" style={{ background: rowBg }}>
                      <input type="text" value={editRow.generic_name} onChange={(e) => setEditRow({ ...editRow, generic_name: e.target.value })} />
                    </div>
                    <div className="grid-cell" style={{ background: rowBg }}>
                      <input type="text" value={editRow.category} onChange={(e) => setEditRow({ ...editRow, category: e.target.value })} />
                    </div>
                    <div className="grid-cell" style={{ background: rowBg }}>
                      <select value={editRow.preferred_vendor_id} onChange={(e) => setEditRow({ ...editRow, preferred_vendor_id: e.target.value })}>
                        <option value="">— none —</option>
                        {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                    </div>
                    <div className="grid-cell" style={{ background: rowBg }}>
                      <select value={editRow.base_unit} onChange={(e) => setEditRow({ ...editRow, base_unit: e.target.value })}>
                        {UNIT_OPTS.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div className="grid-cell" style={{ background: rowBg }}>
                      <input type="number" step="0.01" value={editRow.last_cost} onChange={(e) => setEditRow({ ...editRow, last_cost: e.target.value })} />
                    </div>
                    <div className="grid-cell grid-actions" style={{ background: rowBg }}>
                      <button className="auth-button" style={{ width: 'auto', padding: '6px 14px', margin: 0 }} onClick={() => saveEdit(r.id)}>Save</button>
                      <button className="logout-button" onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div key={r.id} style={{ display: 'contents' }}>
                    <div className="grid-cell" style={{ background: rowBg }}>{r.generic_name || '—'}</div>
                    <div className="grid-cell" style={{ background: rowBg }}>{r.category || '—'}</div>
                    <div className="grid-cell" style={{ background: rowBg }}>{preferredFor(r)}</div>
                    <div className="grid-cell" style={{ background: rowBg }}>{r.base_unit || '—'}</div>
                    <div className="grid-cell" style={{ background: rowBg }}>{r.last_cost != null ? `$${Number(r.last_cost).toFixed(2)}` : '—'}</div>
                    <div className="grid-cell grid-actions" style={{ background: rowBg }}>
                      <button className="logout-button" onClick={() => startEdit(r)}>Edit</button>
                      <button className="logout-button" onClick={() => toggleArchive(r)}>{archivedView ? 'Restore' : 'Archive'}</button>
                    </div>
                  </div>
                )
              })}
              {rows.length === 0 && (
                <div className="grid-cell" style={{ gridColumn: '1 / -1', color: 'var(--mist)' }}>No parts found.</div>
              )}
            </div>
          </div>
          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button className="logout-button" onClick={() => load(selectedOrg, true)} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
