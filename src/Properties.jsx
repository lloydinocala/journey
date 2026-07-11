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
