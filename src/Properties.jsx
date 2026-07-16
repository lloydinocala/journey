import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import NewItemDropdown from './NewItemDropdown'
import QuickAddModal from './QuickAddModal'
import { exportToCSV } from './utils/csvExport'
import { fetchAllRows } from './utils/csvImport'
import CustomerSearchSelect from './CustomerSearchSelect'

const COLUMNS = [
  { key: 'street_address', label: 'Address', required: true },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'zip', label: 'Zip' },
  { key: 'county', label: 'County' },
  { key: 'customer', label: 'Customer' },
  { key: 'bill_to', label: 'Bill To' },
  { key: 'gate_code', label: 'Gate code' },
  { key: 'tenants', label: 'Tenants' },
  { key: 'last_service', label: 'Last Service Date' },
  { key: 'notes', label: 'Notes' },
]

const DEFAULT_VISIBLE = COLUMNS.map((c) => c.key)

export default function Properties({ profile }) {
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [properties, setProperties] = useState([])
  const [showArchived, setShowArchived] = useState(false)
  const [loading, setLoading] = useState(true)
  const [newItemMode, setNewItemMode] = useState(null)

  const [searchText, setSearchText] = useState('')
  const [sortField, setSortField] = useState('street_address')
  const [sortDirection, setSortDirection] = useState('asc')
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('properties_visible_columns_v3')
    return saved ? JSON.parse(saved) : DEFAULT_VISIBLE
  })

  const [editingId, setEditingId] = useState(null)
  const [editCustomerId, setEditCustomerId] = useState('')
  const [editBillToCustomerId, setEditBillToCustomerId] = useState('')
  const [editStreet, setEditStreet] = useState('')
  const [editUnit, setEditUnit] = useState('')
  const [editCity, setEditCity] = useState('')
  const [editCounty, setEditCounty] = useState('')
  const [editState, setEditState] = useState('')
  const [editZip, setEditZip] = useState('')
  const [editGateCode, setEditGateCode] = useState('')
  const [editTenant1Id, setEditTenant1Id] = useState(null)
  const [editTenant1Name, setEditTenant1Name] = useState('')
  const [editTenant1Phone, setEditTenant1Phone] = useState('')
  const [editTenant2Id, setEditTenant2Id] = useState(null)
  const [editTenant2Name, setEditTenant2Name] = useState('')
  const [editTenant2Phone, setEditTenant2Phone] = useState('')
  const [editNotes, setEditNotes] = useState('')

  const isSuperAdmin = profile.role === 'super_admin'

  useEffect(() => {
    if (isSuperAdmin) {
      supabase
        .from('organizations')
        .select('id, name')
        .order('name')
        .then(({ data }) => {
          setOrgs(data || [])
          if (!selectedOrg && data && data.length > 0) setSelectedOrg(data[0].id)
        })
    }
  }, [])

  async function loadData(orgId) {
    if (!orgId) return
    setLoading(true)
    try {
      const [propertiesData, jobsData] = await Promise.all([
        fetchAllRows(() =>
          supabase
            .from('properties')
            .select('id, customer_id, bill_to_customer_id, street_address, unit, city, county, state, zip, gate_code, notes, created_at, is_active, customers!properties_customer_id_fkey(display_name), bill_to:customers!properties_bill_to_customer_id_fkey(display_name), property_tenants(id, name, phone)')
            .eq('org_id', orgId)
            .eq('is_active', !showArchived)
            .order('created_at', { ascending: false })
        ),
        // Only completed jobs count as "service" — a scheduled-but-not-done
        // visit isn't service performed yet.
        fetchAllRows(() =>
          supabase.from('jobs').select('property_id, job_date, status').eq('org_id', orgId).eq('status', 'completed')
        ),
      ])

      const lastServiceByProperty = {}
      jobsData.forEach((j) => {
        if (!j.property_id || !j.job_date) return
        if (!lastServiceByProperty[j.property_id] || j.job_date > lastServiceByProperty[j.property_id]) {
          lastServiceByProperty[j.property_id] = j.job_date
        }
      })

      setProperties(propertiesData.map((p) => ({ ...p, last_service_date: lastServiceByProperty[p.id] || null })))
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData(selectedOrg)
  }, [selectedOrg, showArchived])

  useEffect(() => {
    localStorage.setItem('properties_visible_columns_v3', JSON.stringify(visibleColumns))
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

  function startEdit(p) {
    setEditingId(p.id)
    setEditCustomerId(p.customer_id)
    setEditBillToCustomerId(p.bill_to_customer_id || '')
    setEditStreet(p.street_address)
    setEditUnit(p.unit || '')
    setEditCity(p.city || '')
    setEditCounty(p.county || '')
    setEditState(p.state || '')
    setEditZip(p.zip || '')
    setEditGateCode(p.gate_code || '')
    setEditNotes(p.notes || '')
    const tenants = p.property_tenants || []
    setEditTenant1Id(tenants[0] ? tenants[0].id : null)
    setEditTenant1Name(tenants[0] ? tenants[0].name : '')
    setEditTenant1Phone(tenants[0] ? tenants[0].phone || '' : '')
    setEditTenant2Id(tenants[1] ? tenants[1].id : null)
    setEditTenant2Name(tenants[1] ? tenants[1].name : '')
    setEditTenant2Phone(tenants[1] ? tenants[1].phone || '' : '')
  }

  async function saveTenantSlot(propertyId, existingId, name, phone) {
    const trimmedName = name.trim()
    if (existingId && !trimmedName) {
      await supabase.from('property_tenants').delete().eq('id', existingId)
    } else if (existingId && trimmedName) {
      await supabase.from('property_tenants').update({ name: trimmedName, phone: phone.trim() || null }).eq('id', existingId)
    } else if (!existingId && trimmedName) {
      await supabase.from('property_tenants').insert({
        org_id: selectedOrg,
        property_id: propertyId,
        name: trimmedName,
        phone: phone.trim() || null,
      })
    }
  }

  async function saveEdit(id) {
    await supabase
      .from('properties')
      .update({
        customer_id: editCustomerId,
        bill_to_customer_id: editBillToCustomerId || null,
        street_address: editStreet.trim(),
        unit: editUnit.trim() || null,
        city: editCity.trim() || null,
        county: editCounty.trim() || null,
        state: editState.trim() || null,
        zip: editZip.trim() || null,
        gate_code: editGateCode.trim() || null,
        notes: editNotes.trim() || null,
      })
      .eq('id', id)

    await saveTenantSlot(id, editTenant1Id, editTenant1Name, editTenant1Phone)
    await saveTenantSlot(id, editTenant2Id, editTenant2Name, editTenant2Phone)

    setEditingId(null)
    loadData(selectedOrg)
  }

  async function toggleArchive(p) {
    const action = p.is_active ? 'archive' : 'reactivate'
    if (!window.confirm(`Are you sure you want to ${action} this property?`)) return
    await supabase.from('properties').update({ is_active: !p.is_active }).eq('id', p.id)
    loadData(selectedOrg)
  }

  function cityStateZip(p) {
    return [p.city, p.state, p.zip].filter(Boolean).join(', ')
  }

  function tenantsLabel(p) {
    return (p.property_tenants || [])
      .map((t) => t.name + (t.phone ? ' — ' + t.phone : ''))
      .join('; ')
  }

  function billToLabel(p) {
    return p.bill_to?.display_name || ''
  }

  const filtered = properties.filter((p) => {
    if (!searchText) return true
    const q = searchText.toLowerCase()
    return (
      p.street_address?.toLowerCase().includes(q) ||
      p.customers?.display_name?.toLowerCase().includes(q) ||
      cityStateZip(p).toLowerCase().includes(q) ||
      p.county?.toLowerCase().includes(q)
    )
  })

  const sorted = [...filtered].sort((a, b) => {
    let aVal, bVal
    if (sortField === 'customer') {
      aVal = a.customers?.display_name || ''
      bVal = b.customers?.display_name || ''
    } else if (sortField === 'bill_to') {
      aVal = billToLabel(a)
      bVal = billToLabel(b)
    } else {
      aVal = a[sortField] || ''
      bVal = b[sortField] || ''
    }
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  function handleExport() {
    exportToCSV(
      sorted,
      [
        { key: 'street_address', label: 'Address' },
        { key: 'city', label: 'City' },
        { key: 'state', label: 'State' },
        { key: 'zip', label: 'Zip' },
        { key: 'county', label: 'County' },
        { label: 'Customer', value: (p) => p.customers?.display_name || '' },
        { label: 'Bill To', value: billToLabel },
        { key: 'gate_code', label: 'Gate Code' },
        { label: 'Tenants', value: tenantsLabel },
        { label: 'Last Service Date', value: (p) => p.last_service_date || '' },
        { key: 'notes', label: 'Notes' },
        { label: 'Status', value: (p) => (p.is_active ? 'Active' : 'Archived') },
      ],
      'properties-' + new Date().toISOString().slice(0, 10) + '.csv'
    )
  }

  const gridCols = ['1fr', '1.4fr']
    .concat(visibleColumns.includes('city') ? ['1fr'] : [])
    .concat(visibleColumns.includes('state') ? ['0.6fr'] : [])
    .concat(visibleColumns.includes('zip') ? ['0.7fr'] : [])
    .concat(visibleColumns.includes('county') ? ['0.9fr'] : [])
    .concat(visibleColumns.includes('customer') ? ['1.2fr'] : [])
    .concat(visibleColumns.includes('bill_to') ? ['1.2fr'] : [])
    .concat(visibleColumns.includes('gate_code') ? ['0.8fr'] : [])
    .concat(visibleColumns.includes('tenants') ? ['1.6fr'] : [])
    .concat(visibleColumns.includes('last_service') ? ['1fr'] : [])
    .concat(visibleColumns.includes('notes') ? ['1.4fr'] : [])
    .join(' ')

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Properties</h2>
          <span className="badge">{properties.length.toLocaleString()} total</span>
        </div>
        <NewItemDropdown onSelect={setNewItemMode} />
      </div>

      {isSuperAdmin && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ marginBottom: 0, minWidth: 220 }}>
          <label htmlFor="searchBox">Search</label>
          <input
            id="searchBox"
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Address, customer, city, or county…"
          />
        </div>
        <label className="nav-link" style={{ cursor: 'pointer', marginBottom: 10 }}>
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          Show archived
        </label>
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <button className="logout-button" onClick={() => setShowColumnPicker(!showColumnPicker)}>
            Columns ▾
          </button>
          {showColumnPicker && (
            <div className="org-picker-list" style={{ right: 'auto', left: 0, minWidth: 200 }}>
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
        <button className="logout-button" style={{ marginBottom: 10 }} onClick={handleExport}>
          Export CSV
        </button>
        <p style={{ color: 'var(--mist)', fontSize: 14, margin: '0 0 12px' }}>
          {sorted.length} propert{sorted.length !== 1 ? 'ies' : 'y'}
        </p>
      </div>

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div className="grid-table" style={{ gridTemplateColumns: gridCols }}>
            <div className="grid-cell grid-head"></div>
            <div className="grid-cell grid-head" style={{ cursor: 'pointer' }} onClick={() => toggleSort('street_address')}>
              Address{sortArrow('street_address')}
            </div>
            {visibleColumns.includes('city') && (
              <div className="grid-cell grid-head" style={{ cursor: 'pointer' }} onClick={() => toggleSort('city')}>
                City{sortArrow('city')}
              </div>
            )}
            {visibleColumns.includes('state') && (
              <div className="grid-cell grid-head" style={{ cursor: 'pointer' }} onClick={() => toggleSort('state')}>
                State{sortArrow('state')}
              </div>
            )}
            {visibleColumns.includes('zip') && (
              <div className="grid-cell grid-head" style={{ cursor: 'pointer' }} onClick={() => toggleSort('zip')}>
                Zip{sortArrow('zip')}
              </div>
            )}
            {visibleColumns.includes('county') && (
              <div className="grid-cell grid-head" style={{ cursor: 'pointer' }} onClick={() => toggleSort('county')}>
                County{sortArrow('county')}
              </div>
            )}
            {visibleColumns.includes('customer') && (
              <div className="grid-cell grid-head" style={{ cursor: 'pointer' }} onClick={() => toggleSort('customer')}>
                Customer{sortArrow('customer')}
              </div>
            )}
            {visibleColumns.includes('bill_to') && (
              <div className="grid-cell grid-head" style={{ cursor: 'pointer' }} onClick={() => toggleSort('bill_to')}>
                Bill To{sortArrow('bill_to')}
              </div>
            )}
            {visibleColumns.includes('gate_code') && <div className="grid-cell grid-head">Gate code</div>}
            {visibleColumns.includes('tenants') && <div className="grid-cell grid-head">Tenants</div>}
            {visibleColumns.includes('last_service') && (
              <div className="grid-cell grid-head" style={{ cursor: 'pointer' }} onClick={() => toggleSort('last_service_date')}>
                Last Service Date{sortArrow('last_service_date')}
              </div>
            )}
            {visibleColumns.includes('notes') && <div className="grid-cell grid-head">Notes</div>}

            {sorted.map((p, rowIdx) => {
              const rowBg = rowIdx % 2 === 0 ? 'var(--panel)' : 'var(--ink)'
              return (
              editingId === p.id ? (
                <>
                  <div className="grid-cell grid-actions" style={{ background: rowBg }}>
                    <button className="auth-button" style={{ width: 'auto', padding: '6px 14px', margin: 0 }} onClick={() => saveEdit(p.id)}>Save</button>
                    <button className="logout-button" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                  <div className="grid-cell" style={{ background: rowBg }}>
                    <input type="text" value={editStreet} onChange={(e) => setEditStreet(e.target.value)} placeholder="Street" />
                    <input type="text" value={editUnit} onChange={(e) => setEditUnit(e.target.value)} placeholder="Unit" />
                  </div>
                  {visibleColumns.includes('city') && (
                    <div className="grid-cell" style={{ background: rowBg }}>
                      <input type="text" value={editCity} onChange={(e) => setEditCity(e.target.value)} placeholder="City" />
                    </div>
                  )}
                  {visibleColumns.includes('state') && (
                    <div className="grid-cell" style={{ background: rowBg }}>
                      <input type="text" value={editState} onChange={(e) => setEditState(e.target.value)} placeholder="State" />
                    </div>
                  )}
                  {visibleColumns.includes('zip') && (
                    <div className="grid-cell" style={{ background: rowBg }}>
                      <input type="text" value={editZip} onChange={(e) => setEditZip(e.target.value)} placeholder="Zip" />
                    </div>
                  )}
                  {visibleColumns.includes('county') && (
                    <div className="grid-cell" style={{ background: rowBg }}>
                      <input type="text" value={editCounty} onChange={(e) => setEditCounty(e.target.value)} />
                    </div>
                  )}
                  {visibleColumns.includes('customer') && (
                    <div className="grid-cell" style={{ background: rowBg }}>
                      <CustomerSearchSelect orgId={selectedOrg} value={editCustomerId} onChange={(id) => setEditCustomerId(id)} />
                    </div>
                  )}
                  {visibleColumns.includes('bill_to') && (
                    <div className="grid-cell" style={{ background: rowBg }}>
                      <CustomerSearchSelect
                        orgId={selectedOrg}
                        value={editBillToCustomerId}
                        onChange={(id) => setEditBillToCustomerId(id)}
                        placeholder="Same as Customer"
                      />
                      {editBillToCustomerId && (
                        <button
                          type="button"
                          className="logout-button"
                          style={{ fontSize: 11, padding: '2px 6px', marginTop: 4 }}
                          onClick={() => setEditBillToCustomerId('')}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  )}
                  {visibleColumns.includes('gate_code') && (
                    <div className="grid-cell" style={{ background: rowBg }}>
                      <input type="text" value={editGateCode} onChange={(e) => setEditGateCode(e.target.value)} />
                    </div>
                  )}
                  {visibleColumns.includes('tenants') && (
                    <div className="grid-cell" style={{ background: rowBg }}>
                      <input type="text" value={editTenant1Name} onChange={(e) => setEditTenant1Name(e.target.value)} placeholder="Tenant 1 name" />
                      <input type="tel" value={editTenant1Phone} onChange={(e) => setEditTenant1Phone(e.target.value)} placeholder="Phone" />
                      <input type="text" value={editTenant2Name} onChange={(e) => setEditTenant2Name(e.target.value)} placeholder="Tenant 2 name" />
                      <input type="tel" value={editTenant2Phone} onChange={(e) => setEditTenant2Phone(e.target.value)} placeholder="Phone" />
                    </div>
                  )}
                  {visibleColumns.includes('last_service') && (
                    <div className="grid-cell" style={{ background: rowBg, color: 'var(--mist)' }}>
                      {p.last_service_date ? new Date(p.last_service_date + 'T00:00:00').toLocaleDateString() : '—'}
                    </div>
                  )}
                  {visibleColumns.includes('notes') && (
                    <div className="grid-cell" style={{ background: rowBg }}>
                      <input type="text" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="grid-cell grid-actions" style={{ background: rowBg }}>
                    <button className="logout-button" onClick={() => startEdit(p)}>Edit</button>
                    <button className="logout-button" onClick={() => toggleArchive(p)}>
                      {p.is_active ? 'Archive' : 'Reactivate'}
                    </button>
                  </div>
                  <div className="grid-cell" style={{ background: rowBg }}>
                    {p.street_address}{p.unit ? ` #${p.unit}` : ''}
                    {!p.is_active && <span className="status-pill status-canceled" style={{ marginLeft: 6 }}>Archived</span>}
                  </div>
                  {visibleColumns.includes('city') && <div className="grid-cell" style={{ background: rowBg }}>{p.city || '—'}</div>}
                  {visibleColumns.includes('state') && <div className="grid-cell" style={{ background: rowBg }}>{p.state || '—'}</div>}
                  {visibleColumns.includes('zip') && <div className="grid-cell" style={{ background: rowBg }}>{p.zip || '—'}</div>}
                  {visibleColumns.includes('county') && <div className="grid-cell" style={{ background: rowBg }}>{p.county || '—'}</div>}
                  {visibleColumns.includes('customer') && <div className="grid-cell" style={{ background: rowBg }}>{p.customers?.display_name || '—'}</div>}
                  {visibleColumns.includes('bill_to') && <div className="grid-cell" style={{ background: rowBg }}>{billToLabel(p) || 'Same as Customer'}</div>}
                  {visibleColumns.includes('gate_code') && <div className="grid-cell" style={{ background: rowBg }}>{p.gate_code || '—'}</div>}
                  {visibleColumns.includes('tenants') && <div className="grid-cell" style={{ background: rowBg }}>{tenantsLabel(p) || '—'}</div>}
                  {visibleColumns.includes('last_service') && (
                    <div className="grid-cell" style={{ background: rowBg }}>
                      {p.last_service_date ? new Date(p.last_service_date + 'T00:00:00').toLocaleDateString() : 'Never'}
                    </div>
                  )}
                  {visibleColumns.includes('notes') && <div className="grid-cell" style={{ background: rowBg }}>{p.notes || '—'}</div>}
                </>
              )
              )
            })}
            {sorted.length === 0 && (
              <div className="grid-cell" style={{ gridColumn: '1 / -1', color: 'var(--mist)' }}>No properties found.</div>
            )}
          </div>
        </div>
      )}

      {newItemMode && (
        <QuickAddModal
          mode={newItemMode}
          orgId={selectedOrg}
          profile={profile}
          onClose={() => setNewItemMode(null)}
          onCreated={() => loadData(selectedOrg)}
        />
      )}
    </div>
  )
}
