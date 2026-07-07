import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import CalendarGrid from './CalendarGrid'
import { startOfWeek, addDays, formatWeekRangeLabel, formatDayLabel } from './utils/dateHelpers'

export default function Calendar({ profile }) {
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState('week')
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [businessStart, setBusinessStart] = useState('08:00')
  const [businessEnd, setBusinessEnd] = useState('19:00')
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedJob, setSelectedJob] = useState(null)

  const isSuperAdmin = profile.role === 'super_admin'

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        if (!selectedOrg && data && data.length > 0) setSelectedOrg(data[0].id)
      })
    }
  }, [])

  useEffect(() => {
    if (!selectedOrg) return
    supabase
      .from('organizations')
      .select('business_hours_start, business_hours_end')
      .eq('id', selectedOrg)
      .single()
      .then(({ data }) => {
        if (data) {
          setBusinessStart(data.business_hours_start.slice(0, 5))
          setBusinessEnd(data.business_hours_end.slice(0, 5))
        }
      })
  }, [selectedOrg])

  const days = isMobile || viewMode === 'day' ? [currentDate] : getWeekDays(currentDate)

  function getWeekDays(date) {
    const start = startOfWeek(date)
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }

  function toLocalDateStr(d) {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const date = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${date}`
  }

  async function loadJobs() {
    if (!selectedOrg || days.length === 0) return
    setLoading(true)
    const rangeStart = toLocalDateStr(days[0])
    const rangeEnd = toLocalDateStr(days[days.length - 1])

    const { data } = await supabase
      .from('jobs')
      .select(
        'id, job_number, job_date, start_time, duration_hours, status, job_type, service_complaint, technician_1_id, property_id, technician_1:technician_1_id(full_name, calendar_color), properties(street_address, customers!properties_customer_id_fkey(display_name, is_banned))'
      )
      .eq('org_id', selectedOrg)
      .gte('job_date', rangeStart)
      .lte('job_date', rangeEnd)

    const mapped = (data || []).map((j) => ({
      ...j,
      customer_name: j.properties?.customers?.display_name || 'Unknown',
      address: j.properties?.street_address || '',
      is_banned: j.properties?.customers?.is_banned || false,
    }))
    setJobs(mapped)
    setLoading(false)
  }

  useEffect(() => {
    loadJobs()
  }, [selectedOrg, currentDate, viewMode, isMobile])

  function goToday() {
    setCurrentDate(new Date())
  }

  function goPrev() {
    const step = isMobile || viewMode === 'day' ? 1 : 7
    setCurrentDate((d) => addDays(d, -step))
  }

  function goNext() {
    const step = isMobile || viewMode === 'day' ? 1 : 7
    setCurrentDate((d) => addDays(d, step))
  }

  const dateLabel =
    isMobile || viewMode === 'day' ? formatDayLabel(currentDate) : formatWeekRangeLabel(startOfWeek(currentDate))

  return (
