import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import NewItemDropdown from './NewItemDropdown'
import QuickAddModal from './QuickAddModal'
import { exportToCSV } from './utils/csvExport'

const COLUMNS = [
  { key: 'street_address', label: 'Address', required: true },
  { key: 'city_state_zip', label: 'City/State/Zip' },
  { key: 'county', label: 'County' },
  { key: 'customer', label: 'Customer' },
  { key: 'gate_code', label: 'Gate code' },
  { key: 'tenants', label: 'Tenants' },
]

export default function Properties({ profile }) {
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [customers, setCustomers] = useState([])
  const [properties, setProperties] = useState([])
  const [showArchived, setShowArchived] = useState(false)
  const [loading, setLoading] = useState(true)
  const [newItemMode, setNewItemMode] = useState(null)

  const [customerId, setCustomerId] = useState('')
  const [street, setStreet] = useState('')
  const [unit, setUnit] = useState('')
  const [city, setCity] = useState('')
  const [county, setCounty] = useState('')
  const [state, setState] = useState('FL')
  const [zip, setZip] = useState('')
  const [gateCode, setGateCode] = useState('')
  const [tenant1Name, setTenant1Name] = useState('')
  const [tenant1Phone, setTenant1Phone] = useState('')
  const [tenant2Name, setTenant2Name] = useState('')
  const [tenant2Phone, setTenant2Phone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [searchText, setSearchText] = useState('')
  const [sortField, setSortField] = useState('street_address')
  const [sortDirection, setSortDirection] = useState('asc')
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('properties_visible_columns')
    return saved ? JSON.parse(saved) : COLUMNS.map((c) => c.key)
  })

  const [editingId, setEditingId] = useState(null)
  const [editCustomerId, setEditCustomerId] = useState('')
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
    const [customersRes, propertiesRes] = await Promise.all([
      supabase.from('customers').select('id, display_name').eq('org_id', orgId).eq('is_active', true).order('display_name'),
      supabase
        .from('properties')
        .select('id, customer_id, street_address, unit, city, county, state, zip, gate_code, created_at, is_active, customers!properties_customer_id_fkey(display_name), property_tenants(id, name, phone)')
        .eq('org_id', orgId)
        .eq('is_active', !showArchived)
        .order('created_at', { ascending: false }),
    ])
    setCustomers(customersRes.data || [])
    setProperties(propertiesRes.data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadData(selectedOrg)
  }, [selectedOrg, showArchived])

  useEffect(() => {
    localStorage.setItem('properties_visible_columns', JSON.stringify(visibleColumns))
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

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    if (!customerId || !street.trim()) return

    setSaving(true)

    const { data: property, error: propError } = await supabase
      .from('properties')
      .insert({
        org_id: selectedOrg,
        customer_id: customerId,
        street_address: street.trim(),
        unit: unit.trim() || null,
        city: city.trim() || null,
        county: county.trim() || null,
        state: state.trim() || null,
        zip: zip.trim() || null,
        gate_code: gateCode.trim() || null,
      })
      .select()
      .single()

    if (propError) {
      setError(propError.message)
      setSaving(false)
      return
    }

    if (tenant1Name.trim()) {
      await supabase.from('property_tenants').insert({
        org_id: selectedOrg,
        property_id: property.id,
        name: tenant1Name.trim(),
        phone: tenant1Phone.trim() || null,
      })
    }
    if (tenant2Name.trim()) {
      await supabase.from('property_tenants').insert({
        org_id: selectedOrg,
        property_id: property.id,
        name: tenant2Name.trim(),
        phone: tenant2Phone.trim() || null,
      })
    }

    setSaving(false)
    setCustomerId('')
    setStreet('')
    setUnit('')
    setCity('')
    setCounty('')
    setZip('')
    setGateCode('')
    setTenant1Name('')
    setTenant1Phone('')
    setTenant2Name('')
    setTenant2Phone('')
    loadData(selectedOrg)
  }

  function startEdit(p) {
    setEditingId(p.id)
    setEditCustomerId(p.customer_id)
    setEditStreet(p.street_address)
    setEditUnit(p.unit || '')
    setEditCity(p.city || '')
    setEditCounty(p.county || '')
    setEditState(p.state || '')
    setEditZip(p.zip || '')
    setEditGateCode(p.gate_code || '')
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
        street_address: editStreet.trim(),
        unit: editUnit.trim() || null,
        city: editCity.trim() || null,
        county: editCounty.trim() || null,
        state: editState.trim() || null,
        zip: editZip.trim() || null,
        gate_code: editGateCode.trim() || null,
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
    } else if (sortField === 'city_state_zip') {
      aVal = cityStateZip(a)
      bVal = cityStateZip(b)
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
        { label: 'City/State/Zip', value: cityStateZip },
        { key: 'county', label: 'County' },
        { label: 'Customer', value: (p) => p.customers?.display_name || '' },
        { key: 'gate_code', label: 'Gate Code' },
        { label: 'Tenants', value: tenantsLabel },
        { label: 'Status', value: (p) => (p.is_active ? 'Active' : 'Archived') },
      ],
      'properties-' + new Date().toISOString().slice(0, 10) + '.csv'
    )
  }

  const gridCols = ['1.4fr']
    .concat(visibleColumns.includes('city_state_zip') ? ['1.2fr'] : [])
    .concat(visibleColumns.includes('county') ? ['0.9fr'] : [])
    .concat(visibleColumns.includes('customer') ? ['1.2fr'] : [])
    .concat(visibleColumns.includes('gate_code') ? ['0.8fr'] : [])
    .concat(visibleColumns.includes('tenants') ? ['1.6fr'] : [])
    .concat(['1fr'])
    .join(' ')

  return (
<div>
      <div className="page-header-bar">
        <h2>Properties</h2>
        <NewItemDropdown onSelect={setNewItemMode} />
      </div>

      {isSuperAdmin && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      <form className="inline-form" onSubmit={handleAdd} style={{ marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="field">
          <label htmlFor="custPick">Customer</label>
          <select id="custPick" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
            <option value="">Select…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.display_name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="street">Street address</label>
          <input id="street" type="text" value={street} onChange={(e) => setStreet(e.target.value)} placeholder="123 SE 91st Court Rd" required />
        </div>
        <div className="field">
          <label htmlFor="unit">Unit</label>
          <input id="unit" type="text" value={unit} onChange={(e) => setUnit(e.target.value)} style={{ width: 80 }} />
        </div>
        <div className="field">
          <label htmlFor="city">City</label>
          <input id="city" type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Summerfield" />
        </div>
        <div className="field">
          <label htmlFor="county">County</label>
          <input id="county" type="text" value={county} onChange={(e) => setCounty(e.target.value)} placeholder="Marion" />
        </div>
        <div className="field">
          <label htmlFor="state">State</label>
          <input id="state" type="text" value={state} onChange={(e) => setState(e.target.value)} style={{ width: 60 }} />
        </div>
        <div className="field">
          <label htmlFor="zip">Zip</label>
          <input id="zip" type="text" value={zip} onChange={(e) => setZip(e.target.value)} style={{ width: 90 }} />
        </div>
        <div className="field">
          <label htmlFor="gateCode">Gate code</label>
          <input id="gateCode" type="text" value={gateCode} onChange={(e) => setGateCode(e.target.value)} style={{ width: 100 }} />
        </div>
        <div className="field">
          <label htmlFor="tenant1Name">Tenant 1 (optional)</label>
          <input id="tenant1Name" type="text" value={tenant1Name} onChange={(e) => setTenant1Name(e.target.value)} placeholder="if rental" />
        </div>
        <div className="field">
          <label htmlFor="tenant1Phone">Tenant 1 phone</label>
          <input id="tenant1Phone" type="tel" value={tenant1Phone} onChange={(e) => setTenant1Phone(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="tenant2Name">Tenant 2 (optional)</label>
          <input id="tenant2Name" type="text" value={tenant2Name} onChange={(e) => setTenant2Name(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="tenant2Phone">Tenant 2 phone</label>
          <input id="tenant2Phone" type="tel" value={tenant2Phone} onChange={(e) => setTenant2Phone(e.target.value)} />
        </div>
        <button className="auth-button" type="submit" disabled={saving}>
          {saving ? 'Adding…' : 'Add property'}
        </button>
      </form>

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
            <div className="org-picker-list" style={{ right: 0, left: 'auto', minWidth: 180 }}>
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

      {error && <div className="auth-error">{error}</div>}

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : (
        <div className="grid-table" style={{ gridTemplateColumns: gridCols }}>
          <div className="grid-cell grid-head" style={{ cursor: 'pointer' }} onClick={() => toggleSort('street_address')}>
            Address{sortArrow('street_address')}
          </div>
          {visibleColumns.includes('city_state_zip') && (
            <div className="grid-cell grid-head" style={{ cursor: 'pointer' }} onClick={() => toggleSort('city_state_zip')}>
              City/State/Zip{sortArrow('city_state_zip')}
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
          {visibleColumns.includes('gate_code') && <div className="grid-cell grid-head">Gate code</div>}
          {visibleColumns.includes('tenants') && <div className="grid-cell grid-head">Tenants</div>}
          <div className="grid-cell grid-head"></div>

          {sorted.map((p) =>
            editingId === p.id ? (
              <>
                <div className="grid-cell">
                  <input type="text" value={editStreet} onChange={(e) => setEditStreet(e.target.value)} placeholder="Street" />
                  <input type="text" value={editUnit} onChange={(e) => setEditUnit(e.target.value)} placeholder="Unit" />
                </div>
                {visibleColumns.includes('city_state_zip') && (
                  <div className="grid-cell">
                    <input type="text" value={editCity} onChange={(e) => setEditCity(e.target.value)} placeholder="City" />
                    <input type="text" value={editState} onChange={(e) => setEditState(e.target.value)} placeholder="State" />
                    <input type="text" value={editZip} onChange={(e) => setEditZip(e.target.value)} placeholder="Zip" />
                  </div>
                )}
                {visibleColumns.includes('county') && (
                  <div className="grid-cell">
                    <input type="text" value={editCounty} onChange={(e) => setEditCounty(e.target.value)} />
                  </div>
                )}
                {visibleColumns.includes('customer') && (
                  <div className="grid-cell">
                    <select value={editCustomerId} onChange={(e) => setEditCustomerId(e.target.value)}>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>{c.display_name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {visibleColumns.includes('gate_code') && (
                  <div className="grid-cell">
                    <input type="text" value={editGateCode} onChange={(e) => setEditGateCode(e.target.value)} />
                  </div>
                )}
                {visibleColumns.includes('tenants') && (
                  <div className="grid-cell">
                    <input type="text" value={editTenant1Name} onChange={(e) => setEditTenant1Name(e.target.value)} placeholder="Tenant 1 name" />
                    <input type="tel" value={editTenant1Phone} onChange={(e) => setEditTenant1Phone(e.target.value)} placeholder="Phone" />
                    <input type="text" value={editTenant2Name} onChange={(e) => setEditTenant2Name(e.target.value)} placeholder="Tenant 2 name" />
                    <input type="tel" value={editTenant2Phone} onChange={(e) => setEditTenant2Phone(e.target.value)} placeholder="Phone" />
                  </div>
                )}
                <div className="grid-cell grid-actions">
                  <button className="auth-button" style={{ width: 'auto', padding: '6px 14px', margin: 0 }} onClick={() => saveEdit(p.id)}>Save</button>
                  <button className="logout-button" onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <div className="grid-cell">
                  {p.street_address}{p.unit ? ` #${p.unit}` : ''}
                  {!p.is_active && <span className="status-pill status-canceled" style={{ marginLeft: 6 }}>Archived</span>}
                </div>
                {visibleColumns.includes('city_state_zip') && <div className="grid-cell">{cityStateZip(p)}</div>}
                {visibleColumns.includes('county') && <div className="grid-cell">{p.county || '—'}</div>}
                {visibleColumns.includes('customer') && <div className="grid-cell">{p.customers?.display_name || '—'}</div>}
                {visibleColumns.includes('gate_code') && <div className="grid-cell">{p.gate_code || '—'}</div>}
                {visibleColumns.includes('tenants') && <div className="grid-cell">{tenantsLabel(p) || '—'}</div>}
                <div className="grid-cell grid-actions">
                  <button className="logout-button" onClick={() => startEdit(p)}>Edit</button>
                  <button className="logout-button" onClick={() => toggleArchive(p)}>
                    {p.is_active ? 'Archive' : 'Reactivate'}
                  </button>
                </div>
              </>
            )
          )}
          {sorted.length === 0 && (
            <div className="grid-cell" style={{ gridColumn: '1 / -1', color: 'var(--mist)' }}>No properties found.</div>
          )}
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
