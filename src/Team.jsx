import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import { exportToCSV } from './utils/csvExport'

const COLUMNS = [
  { key: 'full_name', label: 'Name', required: true },
  { key: 'email', label: 'Email' },
  { key: 'role', label: 'Role' },
  { key: 'status', label: 'Status' },
]

export default function Team({ profile }) {
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState(null)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('tech')
  const [color, setColor] = useState('#2F5DE3')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [searchText, setSearchText] = useState('')
  const [sortField, setSortField] = useState('full_name')
  const [sortDirection, setSortDirection] = useState('asc')
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('team_visible_columns')
    return saved ? JSON.parse(saved) : COLUMNS.map((c) => c.key)
  })

  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState('tech')
  const [editColor, setEditColor] = useState('#2F5DE3')
  const [editEmail, setEditEmail] = useState('')

  const isSuperAdmin = profile.role === 'super_admin'

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id))
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        if (!selectedOrg && data && data.length > 0) setSelectedOrg(data[0].id)
      })
    }
  }, [])

  async function loadMembers(orgId) {
    if (!orgId) return
    setLoading(true)
    const { data } = await supabase
      .from('users')
      .select('id, full_name, email, role, calendar_color, is_active')
      .eq('org_id', orgId)
      .order('full_name')
    setMembers(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadMembers(selectedOrg)
  }, [selectedOrg])

  useEffect(() => {
    localStorage.setItem('team_visible_columns', JSON.stringify(visibleColumns))
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
    setSuccess('')
    if (!fullName.trim() || !email.trim()) return

    setSaving(true)
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session.access_token

    const { data, error } = await supabase.functions.invoke('create-team-member', {
      body: {
        action: 'invite',
        email: email.trim(),
        full_name: fullName.trim(),
        role,
        org_id: selectedOrg,
        calendar_color: color,
      },
      headers: { Authorization: `Bearer ${token}` },
    })

    setSaving(false)

    if (error) {
      setError(error.message)
    } else if (data?.error) {
      setError(data.error)
    } else {
      setSuccess(`Invite sent to ${email}.`)
      setFullName('')
      setEmail('')
      setRole('tech')
      loadMembers(selectedOrg)
    }
  }

  function startEdit(member) {
    setEditingId(member.id)
    setEditName(member.full_name)
    setEditRole(member.role)
    setEditColor(member.calendar_color || '#2F5DE3')
    setEditEmail(member.email)
  }

  async function saveEdit(member) {
    setError('')
    await supabase
      .from('users')
      .update({ full_name: editName.trim(), role: editRole, calendar_color: editColor })
      .eq('id', member.id)

    if (editEmail.trim() !== member.email) {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session.access_token
      const { data, error } = await supabase.functions.invoke('create-team-member', {
        body: { action: 'update_email', user_id: member.id, new_email: editEmail.trim() },
        headers: { Authorization: `Bearer ${token}` },
      })
      if (error) {
        setError(error.message)
        return
      }
      if (data?.error) {
        setError(data.error)
        return
      }
    }

    setEditingId(null)
    loadMembers(selectedOrg)
  }

  async function toggleActive(member) {
    const action = member.is_active ? 'deactivate' : 'reactivate'
    if (!window.confirm(`Are you sure you want to ${action} ${member.full_name}?`)) return
    await supabase.from('users').update({ is_active: !member.is_active }).eq('id', member.id)
    loadMembers(selectedOrg)
  }

  const filtered = members.filter((m) => {
    if (!searchText) return true
    const q = searchText.toLowerCase()
    return m.full_name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q) || m.role?.toLowerCase().includes(q)
  })

  const sorted = [...filtered].sort((a, b) => {
    let aVal, bVal
    if (sortField === 'status') {
      aVal = a.is_active ? 1 : 0
      bVal = b.is_active ? 1 : 0
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
        { key: 'full_name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'role', label: 'Role' },
        { label: 'Status', value: (m) => (m.is_active ? 'Active' : 'Deactivated') },
      ],
      'team-' + new Date().toISOString().slice(0, 10) + '.csv'
