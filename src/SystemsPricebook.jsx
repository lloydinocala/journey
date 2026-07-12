import { useState, useEffect, useRef } from 'react'
import Papa from 'papaparse'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

const COLUMNS = [
  { key: 'system_type', label: 'System Type', required: true, width: 100, type: 'text' },
  { key: 'size_tons', label: 'Size (Tons)', required: true, width: 90, type: 'number' },
  { key: 'brand_family', label: 'Brand Family', required: true, width: 140, type: 'text' },
  { key: 'outdoor_brand', label: 'Outdoor Brand', width: 110, type: 'text' },
  { key: 'outdoor_series', label: 'Outdoor Series', width: 130, type: 'text' },
  { key: 'outdoor_model', label: 'Outdoor Model', width: 140, type: 'text' },
  { key: 'indoor_brand', label: 'Indoor Brand', width: 110, type: 'text' },
  { key: 'indoor_model', label: 'Indoor Model', width: 140, type: 'text' },
  { key: 'furnace_model', label: 'Furnace Model', width: 140, type: 'text' },
  { key: 'ahri_ref', label: 'AHRI Ref #', width: 100, type: 'text' },
  { key: 'cooling_capacity', label: 'Cooling Cap', width: 90, type: 'number' },
  { key: 'eer2', label: 'EER2', width: 70, type: 'number' },
  { key: 'seer2', label: 'SEER2', width: 70, type: 'number' },
  { key: 'home_type', label: 'Home Type', width: 130, type: 'text' },
  { key: 'energy_star', label: 'Energy Star', width: 90, type: 'boolean' },
  { key: 'florida_rating', label: 'FL Rating', width: 80, type: 'number' },
  { key: 'client_rating', label: 'Client Rating', width: 90, type: 'number' },
  { key: 'labor_warranty', label: 'Labor Warranty', width: 100, type: 'text' },
  { key: 'quality_pledge', label: 'Quality Pledge', width: 100, type: 'boolean' },
  { key: 'quality_pledge_years', label: 'Pledge Years', width: 90, type: 'number' },
  { key: 'quality_pledge_issuer', label: 'Pledge Issuer', width: 110, type: 'text' },
  { key: 'lineset_requirements', label: 'Lineset', width: 160, type: 'text' },
  { key: 'subtotal', label: 'Subtotal', required: true, width: 90, type: 'number' },
  { key: 'installation_costs', label: 'Our Cost', width: 90, type: 'number' },
  { key: 'installation_price', label: 'Installation Price', required: true, width: 130, type: 'number' },
  { key: 'recommended', label: 'Recommended', required: true, width: 100, type: 'boolean' },
  { key: 'active', label: 'Active', required: true, width: 80, type: 'boolean' },
]

const LABEL_TO_KEY = Object.fromEntries(COLUMNS.map((c) => [c.label, c.key]))
const KEY_TO_TYPE = Object.fromEntries(COLUMNS.map((c) => [c.key, c.type]))

const DEFAULT_VISIBLE = COLUMNS.map((c) => c.key)

function parseBoolean(val) {
  return ['true', 'TRUE', '1', 'yes', 'Yes', 'YES'].includes(String(val ?? '').trim())
}

export default function SystemsPricebook({ profile }) {
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [equipment, setEquipment] = useState([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importSummary, setImportSummary] = useState('')

  const [systemTypeFilter, setSystemTypeFilter] = useState('')
  const [brandFamilyFilter, setBrandFamilyFilter] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [brandNameFilter, setBrandNameFilter] = useState('')
  const [sortField, setSortField] = useState('system_type')
  const [sortDirection, setSortDirection] = useState('asc')
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('systems_pricebook_visible_columns')
    return saved ? JSON.parse(saved) : DEFAULT_VISIBLE
  })

  const [editingId, setEditingId] = useState(null)
  const [editRow, setEditRow] = useState({})

  const isSuperAdmin = profile.role === 'super_admin'

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        if (!selectedOrg && data && data.length > 0) setSelectedOrg(data[0].id)
      })
    }
  }, [])

  async function loadEquipment(orgId) {
    if (!orgId) return
    setLoading(true)
    let query = supabase.from('equipment').select('*').eq('org_id', orgId)
    if (!showInactive) query = query.eq('active', true)
    const { data } = await query.order('system_type').order('size_tons').order('brand_family')
    setEquipment(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadEquipment(selectedOrg)
  }, [selectedOrg, showInactive])

  useEffect(() => {
    localStorage.setItem('systems_pricebook_visible_columns', JSON.stringify(visibleColumns))
  }, [visibleColumns])

  function toggleColumn(key) {
    setVisibleColumns((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  function toggleSort(field) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  function sortArrow(field) {
    if (sortField !== field) return ''
    return sortDirection === 'asc' ? ' ↑' : ' ↓'
  }

  const systemTypes = [...new Set(equipment.map((e) => e.system_type))].filter(Boolean).sort()
  const brandFamilies = [...new Set(equipment.map((e) => e.brand_family))].filter(Boolean).sort()
  const allBrands = [...new Set(equipment.map((e) => e.outdoor_brand))].filter(Boolean).sort()

  const filtered = equipment.filter((e) => {
    if (systemTypeFilter && e.system_type !== systemTypeFilter) return false
    if (brandFamilyFilter && e.brand_family !== brandFamilyFilter) return false
    if (brandNameFilter && e.outdoor_brand !== brandNameFilter) return false
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    let aVal = a[sortField]
    let bVal = b[sortField]
    if (aVal === null || aVal === undefined) aVal = ''
    if (bVal === null || bVal === undefined) bVal = ''
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  function startEdit(e) {
    setEditingId(e.id)
    const initial = {}
    for (const col of COLUMNS) {
      initial[col.key] = e[col.key]
    }
    setEditRow(initial)
  }

  function updateEditField(key, value) {
    setEditRow((prev) => ({ ...prev, [key]: value }))
  }

  async function saveEdit(id) {
    const payload = {}
    for (const col of COLUMNS) {
      const val = editRow[col.key]
      if (col.type === 'number') {
        payload[col.key] = val === '' || val === null || val === undefined ? null : parseFloat(val)
      } else if (col.type === 'boolean') {
        payload[col.key] = !!val
      } else {
        payload[col.key] = val === '' ? null : val
      }
    }
    await supabase.from('equipment').update(payload).eq('id', id).eq('org_id', selectedOrg)
    setEditingId(null)
    loadEquipment(selectedOrg)
  }

  async function toggleActive(e) {
    const action = e.active ? 'deactivate' : 'reactivate'
    if (!window.confirm(`Are you sure you want to ${action} this system (${e.outdoor_brand} ${e.outdoor_model})? This just hides/shows it in the System Estimate picker.`)) return
    await supabase.from('equipment').update({ active: !e.active }).eq('id', e.id)
    loadEquipment(selectedOrg)
  }

  async function handleExport() {
    setExporting(true)
    const rows = sorted.map((e) => {
      const row = { ID: e.id }
      for (const col of COLUMNS) {
        row[col.label] = e[col.key]
      }
      return row
    })
    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `systems-pricebook-export-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setExporting(false)
  }

  function handleImportFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    setImportSummary('')

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        let updated = 0
        let inserted = 0
        let failed = 0

        for (const row of results.data) {
          const id = (row.ID || '').trim()
          const fields = {}
          for (const [label, key] of Object.entries(LABEL_TO_KEY)) {
            if (!(label in row)) continue
            const raw = row[label]
            const type = KEY_TO_TYPE[key]
            if (type === 'number') {
              fields[key] = raw === '' || raw === undefined ? null : parseFloat(raw)
              if (Number.isNaN(fields[key])) fields[key] = null
            } else if (type === 'boolean') {
              fields[key] = parseBoolean(raw)
            } else {
              fields[key] = raw === '' || raw === undefined ? null : raw
            }
          }
          fields.org_id = selectedOrg

          if (id) {
            const { error } = await supabase.from('equipment').update(fields).eq('id', id).eq('org_id', selectedOrg)
            if (error) failed++
            else updated++
          } else {
            const { error } = await supabase.from('equipment').insert(fields)
            if (error) failed++
            else inserted++
          }
        }

        setImportSummary(
          `${updated} updated, ${inserted} added` + (failed ? `, ${failed} failed` : '') + '.'
        )
        setImporting(false)
        e.target.value = ''
        loadEquipment(selectedOrg)
      },
      error: (err) => {
        setImportSummary('Import failed to parse: ' + err.message)
        setImporting(false)
        e.target.value = ''
      },
    })
  }

  const visibleColumnDefs = COLUMNS.filter((c) => c.required || visibleColumns.includes(c.key))
  const gridTemplateColumns = visibleColumnDefs.map((c) => c.width + 'px').join(' ') + ' 160px'
  const tableMinWidth = visibleColumnDefs.reduce((sum, c) => sum + c.width, 0) + 160

  const scrollTableRef = useRef(null)
  const scrollBarRef = useRef(null)
  const [scrollBarRect, setScrollBarRect] = useState({ left: 0, width: 0 })

  useEffect(() => {
    function updateRect() {
      if (scrollTableRef.current) {
        const r = scrollTableRef.current.getBoundingClientRect()
        setScrollBarRect({ left: r.left, width: r.width })
      }
    }
    updateRect()
    window.addEventListener('resize', updateRect)
    return () => window.removeEventListener('resize', updateRect)
  }, [visibleColumns, sorted.length])

  function syncFromTable(e) {
    if (scrollBarRef.current) scrollBarRef.current.scrollLeft = e.target.scrollLeft
  }
  function syncFromBar(e) {
    if (scrollTableRef.current) scrollTableRef.current.scrollLeft = e.target.scrollLeft
  }

  function displayValue(e, key) {
    const type = KEY_TO_TYPE[key]
    if (key === 'quality_pledge_years') return e.quality_pledge_years === 999 ? 'Lifetime' : e.quality_pledge_years ?? '—'
    if (type === 'boolean') return e[key] ? 'Yes' : 'No'
    if (key === 'subtotal' || key === 'installation_costs' || key === 'installation_price') {
      return e[key] === null || e[key] === undefined ? '—' : '$' + Number(e[key]).toFixed(2)
    }
    const val = e[key]
    return val === null || val === undefined || val === '' ? '—' : val
  }

  return (
    <div>
      <h2 className="page-title">Systems Pricebook</h2>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <label className="logout-button" style={{ cursor: 'pointer', margin: 0 }}>
          {importing ? 'Importing…' : 'Import CSV'}
          <input type="file" accept=".csv" onChange={handleImportFile} disabled={importing} style={{ display: 'none' }} />
        </label>
        <button className="logout-button" onClick={handleExport} disabled={exporting || !selectedOrg}>
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>
      {importSummary && (
        <p style={{ textAlign: 'right', fontSize: 13, color: 'var(--mist)', marginTop: 0, marginBottom: 12 }}>{importSummary}</p>
      )}

      {isSuperAdmin && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ marginBottom: 0, minWidth: 160 }}>
          <label htmlFor="typeFilter">System Type</label>
          <select id="typeFilter" value={systemTypeFilter} onChange={(e) => setSystemTypeFilter(e.target.value)}>
            <option value="">All types</option>
            {systemTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0, minWidth: 180 }}>
          <label htmlFor="brandFilter">Brand Family</label>
          <select id="brandFilter" value={brandFamilyFilter} onChange={(e) => setBrandFamilyFilter(e.target.value)}>
            <option value="">All brand families</option>
            {brandFamilies.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0, minWidth: 220 }}>
          <label htmlFor="brandSearch">Brand</label>
          <select id="brandSearch" value={brandNameFilter} onChange={(e) => setBrandNameFilter(e.target.value)}>
            <option value="">All brands</option>
            {allBrands.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <label className="nav-link" style={{ cursor: 'pointer', marginBottom: 10 }}>
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} style={{ marginRight: 6 }} />
          Show inactive
        </label>
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <button className="logout-button" onClick={() => setShowColumnPicker(!showColumnPicker)}>
            Columns ▾
          </button>
          {showColumnPicker && (
            <div className="org-picker-list" style={{ right: 'auto', left: 0, minWidth: 200, maxHeight: 360 }}>
              {COLUMNS.filter((c) => !c.required).map((col) => (
                <label key={col.key} className="org-picker-item" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={visibleColumns.includes(col.key)}
                    onChange={() => toggleColumn(col.key)}
                  />
                  {col.label}
                </label>
              ))}
            </div>
          )}
        </div>
        <p style={{ color: 'var(--mist)', fontSize: 14, margin: '0 0 12px' }}>
          {sorted.length} system{sorted.length !== 1 ? 's' : ''}
        </p>
      </div>

      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0, marginBottom: 16 }}>
        Export includes a hidden ID column used to match rows back up on import — don't remove or edit it for rows you're updating.
        Leave ID blank on any row to add it as a brand new system. Deactivating a system just hides it from the System Estimate picker; it doesn't delete it.
      </p>

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : (
        <>
        <div ref={scrollTableRef} onScroll={syncFromTable} style={{ overflowX: 'auto' }}>
          <div className="grid-table" style={{ gridTemplateColumns, minWidth: tableMinWidth }}>
            {visibleColumnDefs.map((col) => (
              <div
                key={col.key}
                className="grid-cell grid-head"
                style={{ cursor: 'pointer' }}
                onClick={() => toggleSort(col.key)}
              >
                {col.label}
                {sortArrow(col.key)}
              </div>
            ))}
            <div className="grid-cell grid-head"></div>

            {sorted.map((e, rowIdx) => {
              const rowBg = rowIdx % 2 === 0 ? 'var(--panel)' : 'var(--ink)'
              return editingId === e.id ? (
                <>
                  {visibleColumnDefs.map((col) => (
                    <div key={col.key} className="grid-cell" style={{ background: rowBg }}>
                      {col.type === 'boolean' ? (
                        <input
                          type="checkbox"
                          checked={!!editRow[col.key]}
                          onChange={(ev) => updateEditField(col.key, ev.target.checked)}
                        />
                      ) : col.type === 'number' ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editRow[col.key] ?? ''}
                          onChange={(ev) => updateEditField(col.key, ev.target.value)}
                        />
                      ) : (
                        <input
                          type="text"
                          value={editRow[col.key] ?? ''}
                          onChange={(ev) => updateEditField(col.key, ev.target.value)}
                        />
                      )}
                    </div>
                  ))}
                  <div className="grid-cell grid-actions" style={{ background: rowBg }}>
                    <button className="auth-button" style={{ width: 'auto', padding: '6px 14px', margin: 0 }} onClick={() => saveEdit(e.id)}>Save</button>
                    <button className="logout-button" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  {visibleColumnDefs.map((col) => (
                    <div key={col.key} className="grid-cell" style={{ background: rowBg }}>
                      {col.key === 'active' ? (
                        <span className={`status-pill ${e.active ? 'status-active' : 'status-canceled'}`}>{e.active ? 'Active' : 'Inactive'}</span>
                      ) : (
                        displayValue(e, col.key)
                      )}
                    </div>
                  ))}
                  <div className="grid-cell grid-actions" style={{ background: rowBg }}>
                    <button className="logout-button" onClick={() => startEdit(e)}>Edit</button>
                    <button className="logout-button" onClick={() => toggleActive(e)}>{e.active ? 'Deactivate' : 'Reactivate'}</button>
                  </div>
                </>
              )
            })}
            {sorted.length === 0 && (
              <div className="grid-cell" style={{ gridColumn: '1 / -1', color: 'var(--mist)' }}>No systems found.</div>
            )}
          </div>
        </div>
        {tableMinWidth > scrollBarRect.width && scrollBarRect.width > 0 && (
          <div
            ref={scrollBarRef}
            onScroll={syncFromBar}
            style={{
              position: 'fixed',
              bottom: 0,
              left: scrollBarRect.left,
              width: scrollBarRect.width,
              overflowX: 'auto',
              overflowY: 'hidden',
              height: 16,
              zIndex: 50,
              background: 'var(--panel)',
              borderTop: '1px solid var(--border)',
            }}
          >
            <div style={{ width: tableMinWidth, height: 1 }} />
          </div>
        )}
        </>
      )}
    </div>
  )
}
