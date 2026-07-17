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

  const [expandedEquipmentId, setExpandedEquipmentId] = useState(null)
  const [equipmentList, setEquipmentList] = useState([])
  const [loadingEquipment, setLoadingEquipment] = useState(false)
  const [equipEditingId, setEquipEditingId] = useState(null)
  const blankEquipForm = {
    system_label: '', outdoor_brand: '', outdoor_model: '', outdoor_serial: '',
    indoor_brand: '', indoor_model: '', indoor_serial: '',
    furnace_brand: '', furnace_model: '', furnace_serial: '',
    install_date: '', notes: '',
  }
  const [equipForm, setEquipForm] = useState(blankEquipForm)
  const [savingEquip, setSavingEquip] = useState(false)

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

  async function loadEquipmentList(propertyId) {
    setLoadingEquipment(true)
    // Housekeeping: retired equipment is only kept ~90 days (long enough to
    // cover a size-for-size compliance check after a system swap) — clear out
    // anything older before showing the list, rather than keeping it forever.
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    await supabase
      .from('property_equipment')
      .delete()
      .eq('property_id', propertyId)
      .eq('status', 'retired')
      .lt('retired_at', ninetyDaysAgo)

    const { data } = await supabase
      .from('property_equipment')
      .select('*')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false })
    setEquipmentList(data || [])
    setLoadingEquipment(false)
  }

  async function toggleEquipment(propertyId) {
    if (expandedEquipmentId === propertyId) {
      setExpandedEquipmentId(null)
      setEquipEditingId(null)
      setEquipForm(blankEquipForm)
      return
    }
    setExpandedEquipmentId(propertyId)
    setEquipEditingId(null)
    setEquipForm(blankEquipForm)
    loadEquipmentList(propertyId)
  }

  function startEquipEdit(eq) {
    setEquipEditingId(eq.id)
    setEquipForm({
      system_label: eq.system_label || '',
      outdoor_brand: eq.outdoor_brand || '',
      outdoor_model: eq.outdoor_model || '',
      outdoor_serial: eq.outdoor_serial || '',
      indoor_brand: eq.indoor_brand || '',
      indoor_model: eq.indoor_model || '',
      indoor_serial: eq.indoor_serial || '',
      furnace_brand: eq.furnace_brand || '',
      furnace_model: eq.furnace_model || '',
      furnace_serial: eq.furnace_serial || '',
      install_date: eq.install_date || '',
      notes: eq.notes || '',
    })
  }

  async function saveEquipment(propertyId) {
    setSavingEquip(true)
    const payload = {
      system_label: equipForm.system_label.trim() || null,
      outdoor_brand: equipForm.outdoor_brand.trim() || null,
      outdoor_model: equipForm.outdoor_model.trim() || null,
      outdoor_serial: equipForm.outdoor_serial.trim() || null,
      indoor_brand: equipForm.indoor_brand.trim() || null,
      indoor_model: equipForm.indoor_model.trim() || null,
      indoor_serial: equipForm.indoor_serial.trim() || null,
      furnace_brand: equipForm.furnace_brand.trim() || null,
      furnace_model: equipForm.furnace_model.trim() || null,
      furnace_serial: equipForm.furnace_serial.trim() || null,
      install_date: equipForm.install_date || null,
      notes: equipForm.notes.trim() || null,
    }
    if (equipEditingId) {
      await supabase.from('property_equipment').update(payload).eq('id', equipEditingId)
    } else {
      await supabase.from('property_equipment').insert({ ...payload, org_id: selectedOrg, property_id: propertyId, status: 'active' })
    }
    setSavingEquip(false)
    setEquipEditingId(null)
    setEquipForm(blankEquipForm)
    loadEquipmentList(propertyId)
  }

  async function deleteEquipment(id, propertyId) {
    if (!window.confirm('Remove this equipment record? This cannot be undone.')) return
    await supabase.from('property_equipment').delete().eq('id', id)
    loadEquipmentList(propertyId)
  }

  function daysUntilPurge(retiredAt) {
    if (!retiredAt) return null
    const daysSince = Math.floor((Date.now() - new Date(retiredAt).getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(90 - daysSince, 0)
  }

  async function toggleRetired(eq, propertyId) {
    if (eq.status === 'retired') {
      await supabase.from('property_equipment').update({ status: 'active', retired_at: null }).eq('id', eq.id)
    } else {
      if (!window.confirm(`Mark "${eq.system_label || 'this system'}" as retired? It'll stay on record for 90 days (for size-for-size compliance), then clear automatically.`)) return
      await supabase.from('property_equipment').update({ status: 'retired', retired_at: new Date().toISOString() }).eq('id', eq.id)
    }
    loadEquipmentList(propertyId)
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
              <div key={p.id} style={{ display: 'contents' }}>
              {editingId === p.id ? (
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
                    <button className="logout-button" onClick={() => toggleEquipment(p.id)}>
                      {expandedEquipmentId === p.id ? 'Hide Equipment' : 'Equipment'}
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
              )}

              {expandedEquipmentId === p.id && (
                <div className="grid-cell" style={{ gridColumn: '1 / -1', background: 'var(--ink)', padding: 16 }}>
                  {loadingEquipment ? (
                    <p style={{ color: 'var(--mist)' }}>Loading equipment…</p>
                  ) : (
                    <>
                      {equipmentList.filter((eq) => eq.status !== 'retired').length === 0 ? (
                        <p style={{ color: 'var(--mist)', marginTop: 0 }}>No active equipment on file for this property yet.</p>
                      ) : (
                        equipmentList.filter((eq) => eq.status !== 'retired').map((eq) => (
                          <div key={eq.id} style={{ background: 'var(--panel)', border: '1px solid rgba(76, 217, 123, 0.3)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button className="logout-button" style={{ fontSize: 12, padding: '2px 8px' }} onClick={() => startEquipEdit(eq)}>Edit</button>
                                <button
                                  className="logout-button"
                                  style={{ fontSize: 12, padding: '2px 8px', background: 'rgba(242, 169, 60, 0.15)', color: 'var(--amber)', borderColor: 'rgba(242, 169, 60, 0.4)' }}
                                  onClick={() => toggleRetired(eq, p.id)}
                                >
                                  Retire
                                </button>
                                <button className="logout-button" style={{ fontSize: 12, padding: '2px 8px' }} onClick={() => deleteEquipment(eq.id, p.id)}>Delete</button>
                              </div>
                              <strong style={{ fontSize: 13 }}>
                                {eq.system_label || 'System'}{eq.install_date ? ` — installed ${new Date(eq.install_date + 'T00:00:00').toLocaleDateString()}` : ''}{' '}
                                <span className="status-pill status-active">Active</span>
                              </strong>
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--mist)', marginTop: 6, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                              <div><strong>Outdoor:</strong> {[eq.outdoor_brand, eq.outdoor_model].filter(Boolean).join(' ') || '—'}{eq.outdoor_serial ? ` (SN: ${eq.outdoor_serial})` : ''}</div>
                              <div><strong>Indoor:</strong> {[eq.indoor_brand, eq.indoor_model].filter(Boolean).join(' ') || '—'}{eq.indoor_serial ? ` (SN: ${eq.indoor_serial})` : ''}</div>
                              <div><strong>Furnace:</strong> {[eq.furnace_brand, eq.furnace_model].filter(Boolean).join(' ') || '—'}{eq.furnace_serial ? ` (SN: ${eq.furnace_serial})` : ''}</div>
                            </div>
                            {eq.notes && <div style={{ fontSize: 12, color: 'var(--mist)', marginTop: 4 }}>{eq.notes}</div>}
                          </div>
                        ))
                      )}

                      {equipmentList.some((eq) => eq.status === 'retired') && (
                        <div style={{ marginTop: 16 }}>
                          <p style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--mist)', textTransform: 'uppercase', margin: '0 0 8px' }}>
                            Retired — clears automatically 90 days after retirement
                          </p>
                          {equipmentList.filter((eq) => eq.status === 'retired').map((eq) => (
                            <div key={eq.id} style={{ background: 'var(--panel)', border: '1px solid rgba(255, 107, 107, 0.3)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button className="logout-button" style={{ fontSize: 12, padding: '2px 8px' }} onClick={() => startEquipEdit(eq)}>Edit</button>
                                  <button
                                    className="logout-button"
                                    style={{ fontSize: 12, padding: '2px 8px', background: 'rgba(47, 93, 227, 0.12)', color: 'var(--route-blue)', borderColor: 'rgba(47, 93, 227, 0.4)', fontWeight: 600 }}
                                    onClick={() => toggleRetired(eq, p.id)}
                                  >
                                    ↺ Recall
                                  </button>
                                  <button className="logout-button" style={{ fontSize: 12, padding: '2px 8px' }} onClick={() => deleteEquipment(eq.id, p.id)}>Delete</button>
                                </div>
                                <strong style={{ fontSize: 13 }}>
                                  {eq.system_label || 'System'} —{' '}
                                  <span className="status-pill" style={{ background: 'rgba(255, 107, 107, 0.15)', color: '#C0392B' }}>
                                    Retired {eq.retired_at ? new Date(eq.retired_at).toLocaleDateString() : ''} · clears in {daysUntilPurge(eq.retired_at)}d
                                  </span>
                                </strong>
                              </div>
                              <div style={{ fontSize: 13, color: 'var(--mist)', marginTop: 6, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                <div><strong>Outdoor:</strong> {[eq.outdoor_brand, eq.outdoor_model].filter(Boolean).join(' ') || '—'}{eq.outdoor_serial ? ` (SN: ${eq.outdoor_serial})` : ''}</div>
                                <div><strong>Indoor:</strong> {[eq.indoor_brand, eq.indoor_model].filter(Boolean).join(' ') || '—'}{eq.indoor_serial ? ` (SN: ${eq.indoor_serial})` : ''}</div>
                                <div><strong>Furnace:</strong> {[eq.furnace_brand, eq.furnace_model].filter(Boolean).join(' ') || '—'}{eq.furnace_serial ? ` (SN: ${eq.furnace_serial})` : ''}</div>
                              </div>
                              {eq.notes && <div style={{ fontSize: 12, color: 'var(--mist)', marginTop: 4 }}>{eq.notes}</div>}
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{ background: 'var(--panel)', borderRadius: 8, padding: 12, marginTop: 12 }}>
                        <strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
                          {equipEditingId ? 'Edit Equipment' : 'Add Equipment'}
                        </strong>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                          <div className="field" style={{ marginBottom: 0, minWidth: 140 }}>
                            <label>System Label</label>
                            <input type="text" value={equipForm.system_label} onChange={(e) => setEquipForm({ ...equipForm, system_label: e.target.value })} placeholder="e.g. Upstairs" />
                          </div>
                          <div className="field" style={{ marginBottom: 0, minWidth: 140 }}>
                            <label>Install Date</label>
                            <input type="date" value={equipForm.install_date} onChange={(e) => setEquipForm({ ...equipForm, install_date: e.target.value })} />
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                          <div className="field" style={{ marginBottom: 0, minWidth: 140 }}>
                            <label>Outdoor Brand</label>
                            <input type="text" value={equipForm.outdoor_brand} onChange={(e) => setEquipForm({ ...equipForm, outdoor_brand: e.target.value })} />
                          </div>
                          <div className="field" style={{ marginBottom: 0, minWidth: 140 }}>
                            <label>Outdoor Model</label>
                            <input type="text" value={equipForm.outdoor_model} onChange={(e) => setEquipForm({ ...equipForm, outdoor_model: e.target.value })} />
                          </div>
                          <div className="field" style={{ marginBottom: 0, minWidth: 140 }}>
                            <label>Outdoor Serial</label>
                            <input type="text" value={equipForm.outdoor_serial} onChange={(e) => setEquipForm({ ...equipForm, outdoor_serial: e.target.value })} />
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                          <div className="field" style={{ marginBottom: 0, minWidth: 140 }}>
                            <label>Indoor Brand</label>
                            <input type="text" value={equipForm.indoor_brand} onChange={(e) => setEquipForm({ ...equipForm, indoor_brand: e.target.value })} />
                          </div>
                          <div className="field" style={{ marginBottom: 0, minWidth: 140 }}>
                            <label>Indoor Model</label>
                            <input type="text" value={equipForm.indoor_model} onChange={(e) => setEquipForm({ ...equipForm, indoor_model: e.target.value })} />
                          </div>
                          <div className="field" style={{ marginBottom: 0, minWidth: 140 }}>
                            <label>Indoor Serial</label>
                            <input type="text" value={equipForm.indoor_serial} onChange={(e) => setEquipForm({ ...equipForm, indoor_serial: e.target.value })} />
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                          <div className="field" style={{ marginBottom: 0, minWidth: 140 }}>
                            <label>Furnace Brand</label>
                            <input type="text" value={equipForm.furnace_brand} onChange={(e) => setEquipForm({ ...equipForm, furnace_brand: e.target.value })} />
                          </div>
                          <div className="field" style={{ marginBottom: 0, minWidth: 140 }}>
                            <label>Furnace Model</label>
                            <input type="text" value={equipForm.furnace_model} onChange={(e) => setEquipForm({ ...equipForm, furnace_model: e.target.value })} />
                          </div>
                          <div className="field" style={{ marginBottom: 0, minWidth: 140 }}>
                            <label>Furnace Serial</label>
                            <input type="text" value={equipForm.furnace_serial} onChange={(e) => setEquipForm({ ...equipForm, furnace_serial: e.target.value })} />
                          </div>
                        </div>
                        <div className="field" style={{ marginBottom: 8, minWidth: 260 }}>
                          <label>Notes</label>
                          <input type="text" value={equipForm.notes} onChange={(e) => setEquipForm({ ...equipForm, notes: e.target.value })} placeholder="optional" />
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="auth-button" style={{ width: 'auto', padding: '8px 20px' }} disabled={savingEquip} onClick={() => saveEquipment(p.id)}>
                            {savingEquip ? 'Saving…' : equipEditingId ? 'Save Changes' : 'Add Equipment'}
                          </button>
                          {equipEditingId && (
                            <button className="logout-button" onClick={() => { setEquipEditingId(null); setEquipForm(blankEquipForm) }}>
                              Cancel Edit
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
              </div>
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
