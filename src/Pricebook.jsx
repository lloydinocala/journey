import { useState, useEffect } from 'react'
import Papa from 'papaparse'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

const LOCATIONS = ['Ground Level', 'Attic or Ceiling', 'Roof or Sub-Level']
const ACCESS_OPTS = ['Standard Access', 'Difficult Access']
const HOURS_OPTS = ['Standard Hours', 'Extended Hours']
const PART_SOURCES = ['', 'OEM', 'Aftermarket']

export default function Pricebook({ profile }) {
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [services, setServices] = useState([])
  const [loadingServices, setLoadingServices] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [searchText, setSearchText] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [exporting, setExporting] = useState(false)

  const [newServiceName, setNewServiceName] = useState('')
  const [newServiceCategory, setNewServiceCategory] = useState('')
  const [newServiceExempt, setNewServiceExempt] = useState(false)
  const [savingService, setSavingService] = useState(false)
  const [serviceError, setServiceError] = useState('')

  const [editingServiceId, setEditingServiceId] = useState(null)
  const [editServiceName, setEditServiceName] = useState('')
  const [editServiceCategory, setEditServiceCategory] = useState('')

  const [selectedServiceId, setSelectedServiceId] = useState(null)
  const [selectedServiceInfo, setSelectedServiceInfo] = useState(null)
  const [variants, setVariants] = useState([])
  const [loadingVariants, setLoadingVariants] = useState(false)

  const [newLocation, setNewLocation] = useState(LOCATIONS[0])
  const [newAccess, setNewAccess] = useState(ACCESS_OPTS[0])
  const [newHours, setNewHours] = useState(HOURS_OPTS[0])
  const [newPartSource, setNewPartSource] = useState('')
  const [newDisplay, setNewDisplay] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newCost, setNewCost] = useState('')
  const [newTaskHours, setNewTaskHours] = useState('')
  const [savingVariant, setSavingVariant] = useState(false)
  const [variantError, setVariantError] = useState('')

  const [editingVariantId, setEditingVariantId] = useState(null)
  const [editLocation, setEditLocation] = useState('')
  const [editAccess, setEditAccess] = useState('')
  const [editHours, setEditHours] = useState('')
  const [editPartSource, setEditPartSource] = useState('')
  const [editDisplay, setEditDisplay] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editCost, setEditCost] = useState('')
  const [editTaskHours, setEditTaskHours] = useState('')

  const isSuperAdmin = profile.role === 'super_admin'

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        if (!selectedOrg && data && data.length > 0) setSelectedOrg(data[0].id)
      })
    }
  }, [])

  async function loadServices(orgId) {
    if (!orgId) return
    setLoadingServices(true)
    const { data } = await supabase
      .from('services')
      .select('id, category, name, is_tax_exempt, is_active')
      .eq('org_id', orgId)
      .eq('is_active', !showArchived)
      .order('category')
      .order('name')
    setServices(data || [])
    setLoadingServices(false)
  }

  useEffect(() => {
    loadServices(selectedOrg)
    setSelectedServiceId(null)
    setVariants([])
  }, [selectedOrg, showArchived])

  const categories = [...new Set(services.map((s) => s.category))].sort()
  const filteredServices = services.filter((s) => {
    if (categoryFilter && s.category !== categoryFilter) return false
    if (searchText && !s.name.toLowerCase().includes(searchText.toLowerCase())) return false
    return true
  })

  async function handleAddService(e) {
    e.preventDefault()
    setServiceError('')
    if (!newServiceName.trim() || !newServiceCategory.trim()) return
    setSavingService(true)
    const { error } = await supabase.from('services').insert({
      org_id: selectedOrg,
      category: newServiceCategory.trim(),
      name: newServiceName.trim(),
      is_tax_exempt: newServiceExempt,
    })
    setSavingService(false)
    if (error) {
      setServiceError(error.message)
    } else {
      setNewServiceName('')
      setNewServiceExempt(false)
      loadServices(selectedOrg)
    }
  }

  function startEditService(s) {
    setEditingServiceId(s.id)
    setEditServiceName(s.name)
    setEditServiceCategory(s.category)
  }

  async function saveEditService(id) {
    await supabase
      .from('services')
      .update({ name: editServiceName.trim(), category: editServiceCategory.trim() })
      .eq('id', id)
    setEditingServiceId(null)
    loadServices(selectedOrg)
  }

  async function toggleServiceActive(s) {
    const action = s.is_active ? 'archive' : 'reactivate'
    if (!window.confirm(`Are you sure you want to ${action} "${s.name}"? This does not delete its price history.`)) return
    await supabase.from('services').update({ is_active: !s.is_active }).eq('id', s.id)
    if (selectedServiceId === s.id) setSelectedServiceId(null)
    loadServices(selectedOrg)
  }

  async function handleExport() {
    setExporting(true)
    const { data: allServices } = await supabase
      .from('services')
      .select('id, category, name, is_tax_exempt')
      .eq('org_id', selectedOrg)
    const { data: allVariants } = await supabase
      .from('service_prices')
      .select('service_id, location, access, hours, part_source, customer_display, price, cost, task_hours')
      .eq('org_id', selectedOrg)

    const serviceMap = new Map((allServices || []).map((s) => [s.id, s]))
    const rows = (allVariants || []).map((v) => {
      const svc = serviceMap.get(v.service_id)
      return {
        Category: svc?.category || '',
        Item: svc?.name || '',
        Location: v.location || '',
        Access: v.access || '',
        Hours: v.hours || '',
        PartSrc: v.part_source || '',
        Price: v.price,
        Cost: v.cost,
        TaskHrs: v.task_hours,
        CustomerDisplay: v.customer_display || '',
        Exempt: svc?.is_tax_exempt ? 'TRUE' : 'FALSE',
      }
    })

    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pricebook-export-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setExporting(false)
  }

  return (
