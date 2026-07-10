import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import { exportToCSV } from './utils/csvExport'

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

const COLUMNS = [
  { key: 'name', label: 'Name', required: true },
  { key: 'slug', label: 'Slug' },
  { key: 'status', label: 'Status', required: true },
  { key: 'created_at', label: 'Created' },
]

export default function Organizations() {
  const [orgs, setOrgs] = useState([])
  const [statusFilter, setStatusFilter] = useState('current')

  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [searchText, setSearchText] = useState('')
  const [sortField, setSortField] = useState('created_at')
  const [sortDirection, setSortDirection] = useState('desc')
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('organizations_visible_columns')
    return saved ? JSON.parse(saved) : COLUMNS.map((c) => c.key)
  })

  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)

  async function loadOrgs() {
    setLoading(true)
    const { data, error } = await supabase
      .from('organizations')
      .select('id, name, slug, billing_status, created_at, frozen_reason, canceled_reason')
      .order('created_at', { ascending: false })
    if (!error) setOrgs(data)
    setLoading(false)
  }

  useEffect(() => {
    loadOrgs()
  }, [])

  useEffect(() => {
    localStorage.setItem('organizations_visible_columns', JSON.stringify(visibleColumns))
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
    if (!name.trim()) return

    setSaving(true)
    const { error } = await supabase.from('organizations').insert({
      name: name.trim(),
      slug: slugify(name),
      billing_status: 'trial',
    })
    setSaving(false)

    if (error) {
      setError(error.message)
    } else {
      setName('')
      loadOrgs()
    }
  }

  async function toggleFreeze(org) {
    if (org.billing_status === 'suspended') {
      if (!window.confirm(`Unfreeze ${org.name}? Access will be restored immediately.`)) return
      await supabase.from('organizations').update({ billing_status: 'active' }).eq('id', org.id)
      loadOrgs()
      return
    }

    const reason = window.prompt(
      `Freeze ${org.name}? Every user there will be locked out immediately.\n\nA reason is required and will be kept on record:`
    )
    if (reason === null) return
    if (!reason.trim()) {
      alert('A reason is required to freeze an organization.')
      return
    }

    const { data: userData } = await supabase.auth.getUser()
    await supabase
      .from('organizations')
      .update({
        billing_status: 'suspended',
        frozen_reason: reason.trim(),
        frozen_at: new Date().toISOString(),
        frozen_by: userData.user.id,
      })
      .eq('id', org.id)
    loadOrgs()
  }

  async function archiveOrg(org) {
    const reason = window.prompt(
      `Archive ${org.name}? This ends their license permanently (they can still be reinstated later if they return).\n\nA reason is required and will be kept on record:`
    )
    if (reason === null) return
    if (!reason.trim()) {
      alert('A reason is required to archive an organization.')
      return
    }

    const { data: userData } = await supabase.auth.getUser()
    await supabase
      .from('organizations')
      .update({
        billing_status: 'canceled',
        canceled_reason: reason.trim(),
        canceled_at: new Date().toISOString(),
        canceled_by: userData.user.id,
      })
      .eq('id', org.id)
    loadOrgs()
  }

  async function reinstateOrg(org) {
    if (!window.confirm(`Reinstate ${org.name}? They'll be restored to active status.`)) return
    await supabase.from('organizations').update({ billing_status: 'active' }).eq('id', org.id)
    loadOrgs()
  }

  function startEdit(org) {
    setEditingId(org.id)
    setEditName(org.name)
    setEditSlug(org.slug)
    setSlugTouched(false)
  }

  function handleEditNameChange(value) {
    setEditName(value)
    if (!slugTouched) setEditSlug(slugify(value))
  }

  async function saveEdit(id) {
    await supabase
      .from('organizations')
      .update({ name: editName.trim(), slug: editSlug.trim() })
      .eq('id', id)
    setEditingId(null)
    loadOrgs()
  }

  const statusFiltered = orgs.filter((org) => {
    if (statusFilter === 'all') return true
    if (statusFilter === 'frozen') return org.billing_status === 'suspended'
    if (statusFilter === 'archived') return org.billing_status === 'canceled'
    return org.billing_status !== 'canceled'
  })

  const searched = statusFiltered.filter((org) => {
    if (!searchText) return true
    const q = searchText.toLowerCase()
    return org.name?.toLowerCase().includes(q) || org.slug?.toLowerCase().includes(q)
  })

  const sorted = [...searched].sort((a, b) => {
    let aVal, bVal
    if (sortField === 'status') {
      aVal = a.billing_status || ''
      bVal = b.billing_status || ''
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
        { key: 'name', label: 'Name' },
        { key: 'slug', label: 'Slug' },
        { key: 'billing_status', label: 'Status' },
        { label: 'Created', value: (o) => new Date(o.created_at).toLocaleDateString() },
      ],
      'organizations-' + new Date().toISOString().slice(0, 10) + '.csv'
    )
  }

  return (
