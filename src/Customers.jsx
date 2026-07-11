import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import NewItemDropdown from './NewItemDropdown'
import QuickAddModal from './QuickAddModal'
import { exportToCSV } from './utils/csvExport'

const COLUMNS = [
  { key: 'display_name', label: 'Name', required: true },
  { key: 'company', label: 'Company' },
  { key: 'primary_phone', label: 'Phone' },
  { key: 'secondary_phone', label: 'Phone 2' },
  { key: 'email_1', label: 'Email' },
  { key: 'email_2', label: 'Email 2' },
  { key: 'created_at', label: 'Added' },
  { key: 'flags', label: 'Flags' },
]

export default function Customers({ profile }) {
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [customers, setCustomers] = useState([])
  const [showArchived, setShowArchived] = useState(false)
  const [loading, setLoading] = useState(true)
  const [displayName, setDisplayName] = useState('')
  const [company, setCompany] = useState('')
  const [phone, setPhone] = useState('')
  const [secondaryPhone, setSecondaryPhone] = useState('')
  const [email, setEmail] = useState('')
  const [email2, setEmail2] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [newItemMode, setNewItemMode] = useState(null)

  const [searchText, setSearchText] = useState('')
  const [sortField, setSortField] = useState('created_at')
  const [sortDirection, setSortDirection] = useState('desc')
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('customers_visible_columns')
    return saved ? JSON.parse(saved) : COLUMNS.map((c) => c.key)
  })

  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editCompany, setEditCompany] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editSecondaryPhone, setEditSecondaryPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editEmail2, setEditEmail2] = useState('')

  const isSuperAdmin = profile.role === 'super_admin'
  const isOrgAdmin = profile.role === 'org_admin'
  const canManageBans = isSuperAdmin || isOrgAdmin

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

  async function loadCustomers(orgId) {
    if (!orgId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('customers')
      .select('id, display_name, company, primary_phone, secondary_phone, email_1, email_2, created_at, is_active, is_banned, banned_reason')
      .eq('org_id', orgId)
      .eq('is_active', !showArchived)
      .order('created_at', { ascending: false })
    if (!error) setCustomers(data)
    setLoading(false)
  }

  useEffect(() => {
    loadCustomers(selectedOrg)
  }, [selectedOrg, showArchived])

  useEffect(() => {
    localStorage.setItem('customers_visible_columns', JSON.stringify(visibleColumns))
  }, [visibleColumns])

  function toggleColumn(key) {
    setVisibleColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
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
    if (!displayName.trim() || !selectedOrg) return

    setSaving(true)
    const { error } = await supabase.from('customers').insert({
      org_id: selectedOrg,
      display_name: displayName.trim(),
      company: company.trim() || null,
      primary_phone: phone.trim() || null,
      secondary_phone: secondaryPhone.trim() || null,
      email_1: email.trim() || null,
      email_2: email2.trim() || null,
    })
    setSaving(false)

    if (error) {
      setError(error.message)
    } else {
      setDisplayName('')
      setCompany('')
      setPhone('')
      setSecondaryPhone('')
      setEmail('')
      setEmail2('')
      loadCustomers(selectedOrg)
    }
  }

  function startEdit(c) {
    setEditingId(c.id)
    setEditName(c.display_name)
    setEditCompany(c.company || '')
    setEditPhone(c.primary_phone || '')
    setEditSecondaryPhone(c.secondary_phone || '')
    setEditEmail(c.email_1 || '')
    setEditEmail2(c.email_2 || '')
  }

  async function saveEdit(id) {
    await supabase
      .from('customers')
      .update({
        display_name: editName.trim(),
        company: editCompany.trim() || null,
        primary_phone: editPhone.trim() || null,
        secondary_phone: editSecondaryPhone.trim() || null,
        email_1: editEmail.trim() || null,
        email_2: editEmail2.trim() || null,
      })
      .eq('id', id)
    setEditingId(null)
    loadCustomers(selectedOrg)
  }

  async function toggleArchive(c) {
    const action = c.is_active ? 'archive' : 'reactivate'
    if (!window.confirm(`Are you sure you want to ${action} ${c.display_name}?`)) return
    await supabase.from('customers').update({ is_active: !c.is_active }).eq('id', c.id)
    loadCustomers(selectedOrg)
  }

  async function fireCustomer(c) {
    const reason = window.prompt(
      `You're flagging ${c.display_name} as Do Not Service.\nThis blocks scheduling new jobs for them until an admin lifts it.\n\nReason (optional):`
    )
    if (reason === null) return

    const { data: sessionData } = await supabase.auth.getUser()
    await supabase
      .from('customers')
      .update({
        is_banned: true,
        banned_reason: reason.trim() || null,
        banned_at: new Date().toISOString(),
        banned_by: sessionData.user.id,
      })
      .eq('id', c.id)
    loadCustomers(selectedOrg)
  }

  async function liftBan(c) {
    if (!window.confirm(`Lift the Do Not Service flag on ${c.display_name}? They'll be schedulable again.`)) return
    await supabase.from('customers').update({ is_banned: false }).eq('id', c.id)
    loadCustomers(selectedOrg)
  }

  const filtered = customers.filter((c) => {
    if (!searchText) return true
    const q = searchText.toLowerCase()
    return (
      c.display_name?.toLowerCase().includes(q) ||
      c.company?.toLowerCase().includes(q) ||
      c.primary_phone?.toLowerCase().includes(q) ||
      c.email_1?.toLowerCase().includes(q)
    )
  })

  const sorted = [...filtered].sort((a, b) => {
    let aVal = a[sortField] || ''
    let bVal = b[sortField] || ''
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  function handleExport() {
    exportToCSV(
      sorted,
      [
        { key: 'display_name', label: 'Name' },
        { key: 'company', label: 'Company' },
        { key: 'primary_phone', label: 'Phone' },
        { key: 'secondary_phone', label: 'Phone 2' },
        { key: 'email_1', label: 'Email' },
        { key: 'email_2', label: 'Email 2' },
        { label: 'Added', value: (c) => new Date(c.created_at).toLocaleDateString() },
        { label: 'Status', value: (c) => (c.is_active ? 'Active' : 'Archived') },
        { label: 'Do Not Service', value: (c) => (c.is_banned ? 'Yes' : 'No') },
      ],
      'customers-' + new Date().toISOString().slice(0, 10) + '.csv'
    )
  }

  return (
