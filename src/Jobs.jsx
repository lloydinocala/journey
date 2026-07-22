import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import NewItemDropdown from './NewItemDropdown'
import QuickAddModal from './QuickAddModal'
import TripChargePicker from './TripChargePicker'
import { exportToCSV } from './utils/csvExport'
import { fetchAllRows } from './utils/csvImport'

function formatPhone(raw) {
  if (!raw) return raw
  const d = ('' + raw).replace(/\D/g, '')
  if (d.length === 10) return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6)
  if (d.length === 11 && d[0] === '1') return d.slice(1, 4) + '-' + d.slice(4, 7) + '-' + d.slice(7)
  return raw
}

const FROZEN_KEYS = ['job_number', 'segment', 'job_date', 'street_address']

const COLUMNS = [
  { key: 'job_number', label: 'Job #', required: true },
  { key: 'segment', label: 'Segment', required: true },
  { key: 'job_date', label: 'Date', required: true },
  { key: 'street_address', label: 'Street Address', required: true },
  { key: 'unit', label: 'Unit' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'zip', label: 'Zip' },
  { key: 'trip_charge', label: 'Trip Charge' },
  { key: 'start_time', label: 'Scheduled Start' },
  { key: 'job_type', label: 'Type' },
  { key: 'service_complaint', label: 'Issue' },
  { key: 'gate_code', label: 'Gate Code' },
  { key: 'tenant_1', label: 'Tenant 1' },
  { key: 'tenant_1_phone', label: 'Phone 1' },
  { key: 'tenant_2', label: 'Tenant 2' },
  { key: 'tenant_2_phone', label: 'Phone 2' },
  { key: 'technician_1', label: 'Technician 1' },
  { key: 'technician_2', label: 'Technician 2' },
  { key: 'on_my_way_at', label: 'On My Way' },
  { key: 'arrival_at', label: 'Arrival' },
  { key: 'completed_at', label: 'Completed Time' },
  { key: 'status', label: 'Job Status' },
  { key: 'job_notes', label: 'Job Notes' },
]

const DEFAULT_VISIBLE = COLUMNS.map((c) => c.key)

const STATUS_OPTIONS = [
  { value: 'unscheduled', label: 'Unscheduled' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'on_my_way', label: 'On my way' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'incomplete', label: 'Incomplete — needs another visit' },
  { value: 'completed', label: 'Completed' },
  { value: 'canceled', label: 'Canceled' },
]

const DELETE_REASONS = ['Customer Canceled', 'Duplicate Job', 'Created in Error', 'Test/Training Entry', 'Other']

export default function Jobs({ profile }) {
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [properties, setProperties] = useState([])
  const [users, setUsers] = useState([])
  const [jobs, setJobs] = useState([])
  const [jobTypes, setJobTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [newItemMode, setNewItemMode] = useState(null)
  const [error, setError] = useState('')

  const [visibleStatuses, setVisibleStatuses] = useState(() => {
    const saved = localStorage.getItem('jobs_visible_statuses')
    return saved ? JSON.parse(saved) : STATUS_OPTIONS.map((s) => s.value)
  })
  const [showStatusPicker, setShowStatusPicker] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [sortField, setSortField] = useState('job_date')
  const [sortDirection, setSortDirection] = useState('desc')
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('jobs_visible_columns_v2')
    return saved ? JSON.parse(saved) : DEFAULT_VISIBLE
  })

  const [editingId, setEditingId] = useState(null)
  const [editPropertyId, setEditPropertyId] = useState('')
  const [editJobDate, setEditJobDate] = useState('')
  const [editStartTime, setEditStartTime] = useState('')
  const [editDuration, setEditDuration] = useState('')
  const [editJobType, setEditJobType] = useState('')
  const [editComplaint, setEditComplaint] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editJobNotes, setEditJobNotes] = useState('')
  const [editTripChargeId, setEditTripChargeId] = useState(null)
  const [editAuthDiagnoseOnly, setEditAuthDiagnoseOnly] = useState(false)
  const [editAuthLimitAmount, setEditAuthLimitAmount] = useState('')
  const [editTechnicians, setEditTechnicians] = useState([])
  const [addTechChoice, setAddTechChoice] = useState('')

  const [showDeleted, setShowDeleted] = useState(false)
  const [deletedJobs, setDeletedJobs] = useState([])
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteReason, setDeleteReason] = useState('')
  const [deleteNote, setDeleteNote] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)

  const isSuperAdmin = profile.role === 'super_admin'
  const canOverrideBan = profile.role === 'super_admin' || profile.role === 'org_admin'
  const canDelete = profile.role === 'super_admin' || profile.role === 'org_admin'

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        if (!selectedOrg && data && data.length > 0) setSelectedOrg(data[0].id)
      })
    }
  }, [])

  async function loadData(orgId) {
    if (!orgId) return
    setLoading(true)
    try {
      const [propsData, usersRes, jobsData, jobTypesRes] = await Promise.all([
        fetchAllRows(() =>
          supabase
            .from('properties')
            .select('id, street_address, unit, city, state, zip, gate_code, customer_id, customers!properties_customer_id_fkey(display_name, is_banned), property_tenants(name, phone)')
            .eq('org_id', orgId)
            .eq('is_active', true)
            .order('street_address')
        ),
        supabase.from('users').select('id, full_name').eq('org_id', orgId).order('full_name'),
        fetchAllRows(() =>
          supabase
            .from('jobs')
            .select(`
              id, job_number, segment, status, job_date, start_time, duration_hours, job_type, service_complaint,
              property_id, customer_id, trip_charge_price_id, on_my_way_at, arrival_at, completed_at, job_notes, auth_diagnose_only, auth_limit_amount,
              properties ( street_address, unit, city, state, zip, gate_code, property_tenants ( name, phone ) ),
              job_technicians ( sort_order, users ( full_name ) ),
              trip_charge:trip_charge_price_id ( location, access, hours, services ( name ) )
            `)
            .eq('org_id', orgId)
            .is('deleted_at', null)
            .order('job_date', { ascending: false })
        ),
        supabase.from('job_types').select('id, name').eq('org_id', orgId).eq('is_active', true).order('sort_order'),
      ])
      setProperties(propsData)
      setUsers(usersRes.data || [])
      setJobs(jobsData)
      setJobTypes(jobTypesRes.data || [])
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData(selectedOrg)
  }, [selectedOrg])

  async function loadDeletedJobs() {
    if (!selectedOrg) return
    const { data } = await supabase
      .from('jobs')
      .select('id, job_number, segment, status, job_date, deleted_at, deleted_reason, deleted_note, deleted_by, properties ( street_address )')
      .eq('org_id', selectedOrg)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
    setDeletedJobs(data || [])
  }

  function openDeleteModal(j) {
    setDeleteTarget(j)
    setDeleteReason('')
    setDeleteNote('')
    setDeleteError('')
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    if (!deleteReason) { setDeleteError('Please choose a reason.'); return }
    if (deleteReason === 'Other' && !deleteNote.trim()) { setDeleteError('Please add a note describing the reason.'); return }
    setDeleting(true)
    setDeleteError('')
    const { data, error } = await supabase.rpc('soft_delete_job', {
      p_job_id: deleteTarget.id,
      p_reason: deleteReason,
      p_note: deleteNote.trim() || null,
    })
    setDeleting(false)
    if (error) { setDeleteError(error.message); return }
    if (data && data.ok === false) { setDeleteError(data.error || 'Could not delete this job.'); return }
    setDeleteTarget(null)
    loadData(selectedOrg)
    if (showDeleted) loadDeletedJobs()
  }

  async function restoreJob(j) {
    const { data, error } = await supabase.rpc('restore_job', { p_job_id: j.id })
    if (error) { alert('Could not restore this job: ' + error.message); return }
    if (data && data.ok === false) { alert(data.error || 'Could not restore this job.'); return }
    loadDeletedJobs()
    loadData(selectedOrg)
  }

  function toggleShowDeleted() {
    const next = !showDeleted
    setShowDeleted(next)
    if (next) loadDeletedJobs()
  }

  useEffect(() => {
    localStorage.setItem('jobs_visible_columns_v2', JSON.stringify(visibleColumns))
  }, [visibleColumns])

  useEffect(() => {
    localStorage.setItem('jobs_visible_statuses', JSON.stringify(visibleStatuses))
  }, [visibleStatuses])

  function toggleStatus(v) {
    setVisibleStatuses((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  }

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

  function sortedTechs(job) {
    return (job.job_technicians || []).slice().sort((a, b) => a.sort_order - b.sort_order)
  }

  function techNames(job) {
    const list = sortedTechs(job)
    if (list.length === 0) return 'Unassigned'
    return list.map((t) => t.users?.full_name).join(', ')
  }

  function techAt(job, idx) {
    return sortedTechs(job)[idx]?.users?.full_name || ''
  }

  function sortedTenants(job) {
    return (job.properties?.property_tenants || []).slice()
  }

  function tenantAt(job, idx, field) {
    const t = sortedTenants(job)[idx]
    if (!t) return ''
    return field === 'phone' ? (formatPhone(t.phone) || '') : t.name || ''
  }

  function jobNumberDisplay(job) {
    return job.job_number + (job.segment > 1 ? ' · Seg ' + job.segment : '')
  }

  function tripChargeSummary(job) {
    if (!job.trip_charge) return ''
    const tc = job.trip_charge
    const abbrev = (s) => (s ? s.replace('Standard', 'Std').replace('Difficult', 'Diff').replace('Extended', 'Ext').replace(' Access', '').replace(' Hours', '').replace(' Level', '').replace('Attic or Ceiling', 'Attic').replace('Roof or Sub-Level', 'Roof') : '')
    return `${tc.services?.name || ''} — ${abbrev(tc.location)}/${abbrev(tc.access)}/${abbrev(tc.hours)}`
  }

  function timeDisplay(value) {
    if (!value) return '—'
    return new Date(value).toLocaleString()
  }

  function startTimeDisplay(job) {
    if (!job.start_time) return '—'
    return new Date(job.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }

  // Build a proper timestamp from a date+time pair entered in the browser's
  // local time. Using new Date(...) here (rather than sending the bare
  // "YYYY-MM-DDTHH:MM:00" string straight to Supabase) makes JS interpret the
  // value as local time, then .toISOString() converts it to a correct UTC
  // instant with the right offset baked in — a bare string with no timezone
  // marker gets interpreted as UTC by Postgres, which silently shifts the
  // displayed time by however many hours off UTC the local zone is.
  function toTimestamp(dateStr, timeStr) {
    if (!timeStr) return null
    return new Date(`${dateStr}T${timeStr}:00`).toISOString()
  }

  async function loadTechniciansForJob(jobId) {
    const { data } = await supabase
      .from('job_technicians')
      .select('id, sort_order, user_id, users(full_name)')
      .eq('job_id', jobId)
      .order('sort_order')
    setEditTechnicians(data || [])
  }

  function startEdit(j) {
    setEditingId(j.id)
    setEditPropertyId(j.property_id)
    setEditJobDate(j.job_date || '')
    setEditStartTime(j.start_time ? j.start_time.slice(11, 16) : '')
    setEditDuration(j.duration_hours != null ? String(j.duration_hours) : '')
    setEditJobType(j.job_type || '')
    setEditComplaint(j.service_complaint || '')
    setEditStatus(j.status)
    setEditJobNotes(j.job_notes || '')
    setEditTripChargeId(j.trip_charge_price_id || null)
    setEditAuthDiagnoseOnly(j.auth_diagnose_only || false)
    setEditAuthLimitAmount(j.auth_limit_amount != null ? String(j.auth_limit_amount) : '')
    setAddTechChoice('')
    loadTechniciansForJob(j.id)
  }

  async function addTechnicianToJob(jobId, userId) {
    setError('')
    const nextSort = editTechnicians.length > 0 ? Math.max(...editTechnicians.map((t) => t.sort_order)) + 1 : 1
    const { error } = await supabase.from('job_technicians').insert({
      org_id: selectedOrg,
      job_id: jobId,
      user_id: userId,
      sort_order: nextSort,
    })
    if (error) {
      setError(error.message)
      return
    }
    loadTechniciansForJob(jobId)
  }

  async function removeTechnicianFromJob(rowId, jobId) {
    await supabase.from('job_technicians').delete().eq('id', rowId)
    loadTechniciansForJob(jobId)
  }

  async function saveEdit(id) {
    const startTimestamp = toTimestamp(editJobDate, editStartTime)
    const editProperty = properties.find((p) => p.id === editPropertyId)
    const currentJob = jobs.find((j) => j.id === id)
    const oldTripChargeId = currentJob?.trip_charge_price_id || null

    const { error: saveError } = await supabase
      .from('jobs')
      .update({
        property_id: editPropertyId,
        customer_id: editProperty ? editProperty.customer_id : undefined,
        job_date: editJobDate,
        start_time: startTimestamp,
        duration_hours: editDuration ? parseFloat(editDuration) : null,
        job_type: editJobType,
        service_complaint: editComplaint.trim() || null,
        status: editStatus,
        job_notes: editJobNotes.trim() || null,
        trip_charge_price_id: editTripChargeId || null,
        auth_diagnose_only: editAuthDiagnoseOnly,
        auth_limit_amount: editAuthDiagnoseOnly ? null : (editAuthLimitAmount ? parseFloat(editAuthLimitAmount) : null),
      })
      .eq('id', id)

    if (saveError) {
      alert('Could not save this job: ' + saveError.message)
      return
    }

    // Setting status to "incomplete" here should land the job in the office's
    // Incomplete Jobs queue, same as the mobile "Mark Incomplete" button does.
    // Only create a record when the job WASN'T already incomplete (avoid
    // stacking on every re-save), and reuse an existing record if one's there.
    if (editStatus === 'incomplete' && currentJob?.status !== 'incomplete') {
      const { data: existingRec } = await supabase
        .from('job_incomplete_records')
        .select('id')
        .eq('job_id', id)
        .limit(1)

      if (!existingRec || existingRec.length === 0) {
        // Auto-link the job's estimate if one exists, so the office record is
        // pre-populated rather than empty.
        const { data: est } = await supabase
          .from('invoices')
          .select('id')
          .eq('job_id', id)
          .eq('kind', 'estimate')
          .order('created_at', { ascending: false })
          .limit(1)

        await supabase.from('job_incomplete_records').insert({
          org_id: currentJob?.org_id || selectedOrg,
          job_id: id,
          estimate_id: est && est.length > 0 ? est[0].id : null,
          reason: 'Marked incomplete from office (Jobs page)',
        })
      }
    }

    // The trip charge gets copied into an invoice/estimate line item once,
    // at the time it's first set — it's a snapshot, not a live link. If the
    // selection just changed, sync that snapshot forward too, but only for a
    // line item that still reads exactly like the old trip charge, so a tech's
    // manual edits to that line never get silently overwritten.
    if (editTripChargeId && editTripChargeId !== oldTripChargeId) {
      const { data: newTC } = await supabase
        .from('service_prices')
        .select('customer_display, price, task_hours')
        .eq('id', editTripChargeId)
        .single()

      let oldDisplay = null
      if (oldTripChargeId) {
        const { data: oldTC } = await supabase
          .from('service_prices')
          .select('customer_display')
          .eq('id', oldTripChargeId)
          .single()
        oldDisplay = oldTC?.customer_display || null
      }

      if (newTC && oldDisplay) {
        const { data: relatedInvoices } = await supabase
          .from('invoices')
          .select('id, subtotal, sales_tax, discount_type, discount_amount')
          .eq('job_id', id)
          .in('kind', ['invoice', 'estimate'])

        for (const inv of relatedInvoices || []) {
          const { data: matchingLineItems } = await supabase
            .from('invoice_line_items')
            .select('id, quantity, taxable')
            .eq('invoice_id', inv.id)
            .eq('description', oldDisplay)

          for (const li of matchingLineItems || []) {
            await supabase
              .from('invoice_line_items')
              .update({ description: newTC.customer_display, unit_price: newTC.price })
              .eq('id', li.id)
          }

          if ((matchingLineItems || []).length > 0) {
            const { data: allLineItems } = await supabase
              .from('invoice_line_items')
              .select('quantity, unit_price, taxable')
              .eq('invoice_id', inv.id)
            const subtotal = (allLineItems || []).reduce((sum, l) => sum + l.quantity * l.unit_price, 0)
            const taxableSubtotal = (allLineItems || []).filter((l) => l.taxable).reduce((sum, l) => sum + l.quantity * l.unit_price, 0)
            const { data: orgTax } = await supabase.from('organizations').select('sales_tax_rate').eq('id', selectedOrg).single()
            const salesTax = taxableSubtotal * ((orgTax?.sales_tax_rate || 0) / 100)
            const discountValue = inv.discount_type === 'percent' ? subtotal * ((inv.discount_amount || 0) / 100) : (inv.discount_amount || 0)
            const total = Math.max(subtotal + salesTax - discountValue, 0)
            await supabase
              .from('invoices')
              .update({ subtotal, sales_tax: salesTax, job_total: total, amount_due: total, balance: total })
              .eq('id', inv.id)
          }
        }
      }
    }

    setEditingId(null)
    loadData(selectedOrg)
  }

  const filtered = jobs.filter((j) => {
    if (!visibleStatuses.includes(j.status)) return false
    if (!searchText) return true
    const q = searchText.toLowerCase()
    return (
      j.job_number?.toLowerCase().includes(q) ||
      j.properties?.street_address?.toLowerCase().includes(q) ||
      j.service_complaint?.toLowerCase().includes(q) ||
      techNames(j).toLowerCase().includes(q)
    )
  })

  const sorted = [...filtered].sort((a, b) => {
    let aVal, bVal
    if (sortField === 'street_address') {
      aVal = a.properties?.street_address || ''
      bVal = b.properties?.street_address || ''
    } else if (sortField === 'city' || sortField === 'state' || sortField === 'zip' || sortField === 'unit' || sortField === 'gate_code') {
      aVal = a.properties?.[sortField] || ''
      bVal = b.properties?.[sortField] || ''
    } else if (sortField === 'technician_1') {
      aVal = techAt(a, 0)
      bVal = techAt(b, 0)
    } else if (sortField === 'technician_2') {
      aVal = techAt(a, 1)
      bVal = techAt(b, 1)
    } else {
      aVal = a[sortField] || ''
      bVal = b[sortField] || ''
    }
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  const visibleColumnDefs = COLUMNS.filter((c) => c.required || visibleColumns.includes(c.key))
  const COLUMN_WIDTHS = {
    job_number: 100, segment: 80, job_date: 95, trip_charge: 170, start_time: 100,
    job_type: 110, service_complaint: 160, street_address: 180, unit: 70, city: 120,
    state: 60, zip: 80, gate_code: 90, tenant_1: 120, tenant_1_phone: 110,
    tenant_2: 120, tenant_2_phone: 110, technician_1: 130, technician_2: 130,
    on_my_way_at: 150, arrival_at: 150, completed_at: 150, status: 100, job_notes: 200,
  }
  const ACTIONS_WIDTH = 240
  const gridTemplateColumns = ACTIONS_WIDTH + 'px ' + visibleColumnDefs.map((c) => COLUMN_WIDTHS[c.key] + 'px').join(' ')
  const tableMinWidth = visibleColumnDefs.reduce((sum, c) => sum + COLUMN_WIDTHS[c.key], 0) + ACTIONS_WIDTH

  const stickyLeft = {}
  let stickyCum = ACTIONS_WIDTH
  for (const key of FROZEN_KEYS) {
    stickyLeft[key] = stickyCum
    stickyCum += COLUMN_WIDTHS[key]
  }

  const actionsCellStyle = (rowBg) => ({
    background: rowBg,
    position: 'sticky',
    left: 0,
    zIndex: 2,
    boxShadow: '2px 0 4px rgba(0,0,0,0.08)',
  })
  const actionsHeaderStyle = {
    background: 'var(--route-blue)',
    position: 'sticky',
    left: 0,
    zIndex: 3,
    boxShadow: '2px 0 4px rgba(0,0,0,0.08)',
  }

  function cellStyle(key, rowBg) {
    if (FROZEN_KEYS.includes(key)) {
      return { background: rowBg, position: 'sticky', left: stickyLeft[key], zIndex: 2, boxShadow: key === 'street_address' ? '2px 0 4px rgba(0,0,0,0.08)' : 'none' }
    }
    return { background: rowBg }
  }

  function headerCellStyle(key) {
    if (FROZEN_KEYS.includes(key)) {
      return { background: 'var(--route-blue)', position: 'sticky', left: stickyLeft[key], zIndex: 3, boxShadow: key === 'street_address' ? '2px 0 4px rgba(0,0,0,0.08)' : 'none' }
    }
    return {}
  }

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

  function cellValue(j, key) {
    if (key === 'job_number') return j.job_number
    if (key === 'segment') return j.segment
    if (key === 'job_date') return j.job_date
    if (key === 'trip_charge') return tripChargeSummary(j)
    if (key === 'start_time') return startTimeDisplay(j)
    if (key === 'job_type') return j.job_type
    if (key === 'service_complaint') return j.service_complaint || '—'
    if (key === 'street_address') return j.properties?.street_address || '—'
    if (key === 'unit') return j.properties?.unit || '—'
    if (key === 'city') return j.properties?.city || '—'
    if (key === 'state') return j.properties?.state || '—'
    if (key === 'zip') return j.properties?.zip || '—'
    if (key === 'gate_code') return j.properties?.gate_code || '—'
    if (key === 'tenant_1') return tenantAt(j, 0, 'name') || '—'
    if (key === 'tenant_1_phone') return tenantAt(j, 0, 'phone') || '—'
    if (key === 'tenant_2') return tenantAt(j, 1, 'name') || '—'
    if (key === 'tenant_2_phone') return tenantAt(j, 1, 'phone') || '—'
    if (key === 'technician_1') return techAt(j, 0) || 'Unassigned'
    if (key === 'technician_2') return techAt(j, 1) || '—'
    if (key === 'on_my_way_at') return timeDisplay(j.on_my_way_at)
    if (key === 'arrival_at') return timeDisplay(j.arrival_at)
    if (key === 'completed_at') return timeDisplay(j.completed_at)
    if (key === 'job_notes') return j.job_notes || '—'
    return ''
  }

  function handleExport() {
    exportToCSV(
      sorted,
      visibleColumnDefs
        .filter((c) => c.key !== 'status')
        .map((c) => ({ label: c.label, value: (j) => cellValue(j, c.key) }))
        .concat([{ key: 'status', label: 'Job Status' }]),
      'jobs-' + new Date().toISOString().slice(0, 10) + '.csv'
    )
  }

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Jobs</h2>
          <span className="badge">{jobs.length.toLocaleString()} total</span>
        </div>
        <NewItemDropdown onSelect={setNewItemMode} />
      </div>

      {isSuperAdmin && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      {error && <div className="auth-error">{error}</div>}

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ position: 'relative', marginBottom: 0, minWidth: 160 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Status</label>
          <button className="logout-button" onClick={() => setShowStatusPicker(!showStatusPicker)}>
            {visibleStatuses.length === STATUS_OPTIONS.length
              ? 'All statuses ▾'
              : visibleStatuses.length === 0
              ? 'No statuses ▾'
              : `${visibleStatuses.length} of ${STATUS_OPTIONS.length} ▾`}
          </button>
          {showStatusPicker && (
            <div className="org-picker-list" style={{ right: 'auto', left: 0, minWidth: 240, maxHeight: 360 }}>
              <div style={{ display: 'flex', gap: 8, padding: '6px 10px', borderBottom: '1px solid var(--border)' }}>
                <button className="logout-button" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => setVisibleStatuses(STATUS_OPTIONS.map((s) => s.value))}>
                  Show all
                </button>
                <button className="logout-button" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => setVisibleStatuses(STATUS_OPTIONS.map((s) => s.value).filter((v) => v !== 'completed' && v !== 'canceled'))}>
                  Hide completed &amp; canceled
                </button>
              </div>
              {STATUS_OPTIONS.map((s) => (
                <label key={s.value} className="org-picker-item" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={visibleStatuses.includes(s.value)} onChange={() => toggleStatus(s.value)} />
                  {s.label}
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="field" style={{ marginBottom: 0, minWidth: 220 }}>
          <label htmlFor="searchBox">Search</label>
          <input
            id="searchBox"
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Job #, address, issue, tech…"
          />
        </div>
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
        <button className="logout-button" style={{ marginBottom: 10 }} onClick={handleExport}>
          Export CSV
        </button>
        {canDelete && (
          <button className="logout-button" style={{ marginBottom: 10 }} onClick={toggleShowDeleted}>
            {showDeleted ? '← Back to Active Jobs' : 'View Deleted Jobs'}
          </button>
        )}
        <p style={{ color: 'var(--mist)', fontSize: 14, margin: '0 0 12px' }}>
          {showDeleted
            ? `${deletedJobs.length} deleted job${deletedJobs.length !== 1 ? 's' : ''}`
            : `${sorted.length} job${sorted.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : showDeleted ? (
        <div style={{ overflowX: 'auto' }}>
          {deletedJobs.length === 0 ? (
            <p style={{ color: 'var(--mist)' }}>No deleted jobs.</p>
          ) : (
            <table className="data-table" style={{ minWidth: 1000 }}>
              <thead>
                <tr>
                  <th>Job #</th>
                  <th>Date</th>
                  <th>Address</th>
                  <th>Status</th>
                  <th>Reason</th>
                  <th>Note</th>
                  <th>Deleted By</th>
                  <th>Deleted At</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {deletedJobs.map((j) => (
                  <tr key={j.id}>
                    <td>{j.job_number}{j.segment > 1 ? ' · Seg ' + j.segment : ''}</td>
                    <td>{j.job_date || '—'}</td>
                    <td>{j.properties?.street_address || '—'}</td>
                    <td><span className={`status-pill status-${j.status}`}>{j.status}</span></td>
                    <td>{j.deleted_reason || '—'}</td>
                    <td style={{ maxWidth: 220, fontSize: 12 }}>{j.deleted_note || '—'}</td>
                    <td>{users.find((u) => u.id === j.deleted_by)?.full_name || '—'}</td>
                    <td style={{ fontSize: 12 }}>{j.deleted_at ? new Date(j.deleted_at).toLocaleString() : '—'}</td>
                    <td>
                      <button className="auth-button" style={{ width: 'auto', padding: '4px 14px', margin: 0 }} onClick={() => restoreJob(j)}>Restore</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <>
        <div ref={scrollTableRef} onScroll={syncFromTable} style={{ overflowX: 'auto' }}>
          <div className="grid-table" style={{ gridTemplateColumns, minWidth: tableMinWidth }}>
            <div className="grid-cell grid-head" style={actionsHeaderStyle}></div>
            {visibleColumnDefs.map((col) => (
              <div
                key={col.key}
                className="grid-cell grid-head"
                style={{
                  ...headerCellStyle(col.key),
                  cursor: ['job_number', 'job_date', 'street_address', 'city', 'state', 'zip', 'unit', 'gate_code', 'job_type', 'technician_1', 'technician_2', 'status'].includes(col.key) ? 'pointer' : 'default',
                }}
                onClick={() => {
                  if (['job_number', 'job_date', 'street_address', 'city', 'state', 'zip', 'unit', 'gate_code', 'job_type', 'technician_1', 'technician_2', 'status'].includes(col.key)) toggleSort(col.key)
                }}
              >
                {col.label}
                {sortArrow(col.key)}
              </div>
            ))}

            {sorted.map((j, rowIdx) => {
              const rowBg = rowIdx % 2 === 0 ? 'var(--panel)' : 'var(--ink)'
              return editingId === j.id ? (
                <>
                  <div className="grid-cell grid-actions" style={{ ...actionsCellStyle(rowBg), flexDirection: 'column', alignItems: 'stretch' }}>
                    <div style={{ marginBottom: 6 }}>
                      {editTechnicians.map((t, idx) => (
                        <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                          <span>{idx === 0 ? '★ ' : ''}{t.users?.full_name}</span>
                          <button
                            type="button"
                            onClick={() => removeTechnicianFromJob(t.id, j.id)}
                            style={{ background: 'none', border: 'none', color: '#C0392B', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '0 4px' }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <select
                        value=""
                        onChange={(e) => { if (e.target.value) addTechnicianToJob(j.id, e.target.value) }}
                        style={{ width: '100%', fontSize: 12, marginTop: 4 }}
                      >
                        <option value="">+ Add a technician…</option>
                        {users
                          .filter((u) => !editTechnicians.some((t) => t.user_id === u.id))
                          .map((u) => (
                            <option key={u.id} value={u.id}>{u.full_name}</option>
                          ))}
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="auth-button" style={{ width: 'auto', padding: '6px 14px', margin: 0 }} onClick={() => saveEdit(j.id)}>Save</button>
                      <button className="logout-button" onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  </div>
                  {visibleColumnDefs.map((col) => {
                    if (col.key === 'job_number') return <div key={col.key} className="grid-cell" style={cellStyle(col.key, rowBg)}>{jobNumberDisplay(j)}</div>
                    if (col.key === 'job_date') return (
                      <div key={col.key} className="grid-cell" style={cellStyle(col.key, rowBg)}>
                        <input type="date" value={editJobDate} onChange={(e) => setEditJobDate(e.target.value)} />
                      </div>
                    )
                    if (col.key === 'start_time') return (
                      <div key={col.key} className="grid-cell" style={cellStyle(col.key, rowBg)}>
                        <input type="time" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} />
                      </div>
                    )
                    if (col.key === 'street_address') return (
                      <div key={col.key} className="grid-cell" style={cellStyle(col.key, rowBg)}>
                        <select value={editPropertyId} onChange={(e) => setEditPropertyId(e.target.value)}>
                          {properties.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.customers?.is_banned ? '⚠️ ' : ''}{p.street_address} — {p.customers?.display_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )
                    if (col.key === 'trip_charge') return (
                      <div key={col.key} className="grid-cell" style={cellStyle(col.key, rowBg)}>
                        <TripChargePicker orgId={selectedOrg} value={editTripChargeId} onChange={setEditTripChargeId} />
                        <div style={{ marginTop: 6, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                            <input type="checkbox" checked={editAuthDiagnoseOnly} onChange={(e) => { setEditAuthDiagnoseOnly(e.target.checked); if (e.target.checked) setEditAuthLimitAmount('') }} />
                            Diagnose only
                          </label>
                          {!editAuthDiagnoseOnly && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              Auth limit $
                              <input type="number" step="0.01" min="0" value={editAuthLimitAmount} onChange={(e) => setEditAuthLimitAmount(e.target.value)} placeholder="none" style={{ width: 90 }} />
                            </span>
                          )}
                        </div>
                      </div>
                    )
                    if (col.key === 'job_type') return (
                      <div key={col.key} className="grid-cell" style={cellStyle(col.key, rowBg)}>
                        <select value={editJobType} onChange={(e) => setEditJobType(e.target.value)}>
                          {jobTypes.map((t) => (
                            <option key={t.id} value={t.name}>{t.name}</option>
                          ))}
                        </select>
                      </div>
                    )
                    if (col.key === 'service_complaint') return (
                      <div key={col.key} className="grid-cell" style={cellStyle(col.key, rowBg)}>
                        <input type="text" value={editComplaint} onChange={(e) => setEditComplaint(e.target.value)} />
                      </div>
                    )
                    if (col.key === 'technician_1' || col.key === 'technician_2') return (
                      <div key={col.key} className="grid-cell" style={{ ...cellStyle(col.key, rowBg), fontSize: 12 }}>
                        {cellValue(j, col.key)}
                      </div>
                    )
                    if (col.key === 'status') return (
                      <div key={col.key} className="grid-cell" style={cellStyle(col.key, rowBg)}>
                        <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      </div>
                    )
                    if (col.key === 'job_notes') return (
                      <div key={col.key} className="grid-cell" style={cellStyle(col.key, rowBg)}>
                        <input type="text" value={editJobNotes} onChange={(e) => setEditJobNotes(e.target.value)} placeholder="Job notes…" />
                      </div>
                    )
                    return <div key={col.key} className="grid-cell" style={cellStyle(col.key, rowBg)}>{cellValue(j, col.key)}</div>
                  })}
                </>
              ) : (
                <>
                  <div className="grid-cell grid-actions" style={actionsCellStyle(rowBg)}>
                    <button className="logout-button" onClick={() => startEdit(j)}>Edit</button>
                    <Link to={`/invoice/${j.id}`} className="logout-button" style={{ textDecoration: 'none', display: 'inline-block' }}>Invoice</Link>
                    <Link to={`/estimate/${j.id}`} className="logout-button" style={{ textDecoration: 'none', display: 'inline-block' }}>Estimate</Link>
                    <Link to={`/system-estimate/${j.id}`} className="logout-button" style={{ textDecoration: 'none', display: 'inline-block' }}>System Estimate</Link>
                    {canDelete && (
                      <button className="logout-button" style={{ color: '#C0392B', borderColor: '#C0392B' }} onClick={() => openDeleteModal(j)}>Delete</button>
                    )}
                  </div>
                  {visibleColumnDefs.map((col) => (
                    <div key={col.key} className="grid-cell" style={cellStyle(col.key, rowBg)}>
                      {col.key === 'status' ? (
                        <span className={`status-pill status-${j.status}`}>{j.status}</span>
                      ) : (
                        cellValue(j, col.key)
                      )}
                    </div>
                  ))}
                </>
              )
            })}
            {sorted.length === 0 && (
              <div className="grid-cell" style={{ gridColumn: '1 / -1', color: 'var(--mist)' }}>No jobs yet.</div>
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

      {newItemMode && (
        <QuickAddModal
          mode={newItemMode}
          orgId={selectedOrg}
          profile={profile}
          onClose={() => setNewItemMode(null)}
          onCreated={() => loadData(selectedOrg)}
        />
      )}

      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => { if (!deleting) setDeleteTarget(null) }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>
              Delete {deleteTarget.job_number}{deleteTarget.segment > 1 ? ' · Seg ' + deleteTarget.segment : ''}?
            </h3>
            <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0 }}>
              This removes the job from all lists and from Customer Job History. Any linked estimates and unsent draft
              invoices are removed with it. Nothing is erased — an admin can restore it later from “View Deleted Jobs,”
              and the reason below is kept for your records.
            </p>
            <div className="field">
              <label>Reason<span style={{ color: '#C0392B' }}> *</span></label>
              <select value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)}>
                <option value="">Select a reason…</option>
                {DELETE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Note {deleteReason === 'Other' ? <span style={{ color: '#C0392B' }}>*</span> : '(optional)'}</label>
              <input
                type="text"
                value={deleteNote}
                onChange={(e) => setDeleteNote(e.target.value)}
                placeholder="Add any detail for the record…"
              />
            </div>
            {deleteError && <div className="auth-error" style={{ marginBottom: 12 }}>{deleteError}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                className="auth-button"
                style={{ width: 'auto', margin: 0, background: '#C0392B' }}
                disabled={deleting}
                onClick={confirmDelete}
              >
                {deleting ? 'Deleting…' : 'Delete Job'}
              </button>
              <button className="logout-button" disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
