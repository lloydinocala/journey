import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

export default function Settings({ profile }) {
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [jobTypes, setJobTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [newType, setNewType] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')

  const [businessStart, setBusinessStart] = useState('08:00')
  const [businessEnd, setBusinessEnd] = useState('19:00')
  const [savingHours, setSavingHours] = useState(false)
  const [hoursSaved, setHoursSaved] = useState(false)

  const isSuperAdmin = profile.role === 'super_admin'

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        if (!selectedOrg && data && data.length > 0) setSelectedOrg(data[0].id)
      })
    }
  }, [])

  async function loadJobTypes(orgId) {
    if (!orgId) return
    setLoading(true)
    const { data } = await supabase
      .from('job_types')
      .select('id, name, sort_order, is_active')
      .eq('org_id', orgId)
      .order('sort_order')
    setJobTypes(data || [])
    setLoading(false)
  }

  async function loadBusinessHours(orgId) {
    if (!orgId) return
    const { data } = await supabase
      .from('organizations')
      .select('business_hours_start, business_hours_end')
      .eq('id', orgId)
      .single()
    if (data) {
      setBusinessStart(data.business_hours_start.slice(0, 5))
      setBusinessEnd(data.business_hours_end.slice(0, 5))
    }
  }

  useEffect(() => {
    loadJobTypes(selectedOrg)
    loadBusinessHours(selectedOrg)
  }, [selectedOrg])

  async function saveBusinessHours(e) {
    e.preventDefault()
    setSavingHours(true)
    setHoursSaved(false)
    await supabase
      .from('organizations')
      .update({ business_hours_start: businessStart, business_hours_end: businessEnd })
      .eq('id', selectedOrg)
    setSavingHours(false)
    setHoursSaved(true)
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    if (!newType.trim()) return

    setSaving(true)
    const nextSort = jobTypes.length > 0 ? Math.max(...jobTypes.map((t) => t.sort_order)) + 1 : 1
    const { error } = await supabase.from('job_types').insert({
      org_id: selectedOrg,
      name: newType.trim(),
      sort_order: nextSort,
    })
    setSaving(false)

    if (error) {
      setError(error.message)
    } else {
      setNewType('')
      loadJobTypes(selectedOrg)
    }
  }

  async function toggleActive(id, current) {
    await supabase.from('job_types').update({ is_active: !current }).eq('id', id)
    loadJobTypes(selectedOrg)
  }

  function startEdit(t) {
    setEditingId(t.id)
    setEditName(t.name)
  }

  async function saveEdit(id) {
    if (!editName.trim()) return
    await supabase.from('job_types').update({ name: editName.trim() }).eq('id', id)
    setEditingId(null)
    loadJobTypes(selectedOrg)
  }

  return (
    <div>
