import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import NewItemDropdown from './NewItemDropdown'
import QuickAddModal from './QuickAddModal'
import CalendarGrid from './CalendarGrid'
import CalendarMonth from './CalendarMonth'
import JobDetailModal from './JobDetailModal'
import {
  startOfWeek,
  addDays,
  addMonths,
  formatWeekRangeLabel,
  formatDayLabel,
  formatMonthLabel,
  getMonthGridDays,
} from './utils/dateHelpers'

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
  const [newItemMode, setNewItemMode] = useState(null)

  const isSuperAdmin = profile.role === 'super_admin'
  const effectiveView = isMobile ? 'day' : viewMode

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

  function toLocalDateStr(d) {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const date = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${date}`
  }

  function getWeekDays(date) {
    const start = startOfWeek(date)
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }

  const days =
    effectiveView === 'month'
      ? getMonthGridDays(currentDate)
      : effectiveView === 'week'
      ? getWeekDays(currentDate)
      : [currentDate]

  async function loadJobs() {
    if (!selectedOrg || days.length === 0) return
    setLoading(true)
    const rangeStart = toLocalDateStr(days[0])
    const rangeEnd = toLocalDateStr(days[days.length - 1])

    const { data } = await supabase
      .from('jobs')
      .select(
        'id, job_number, job_date, start_time, duration_hours, status, job_type, service_complaint, property_id, job_technicians(sort_order, users(full_name, calendar_color)), properties(street_address, customers!properties_customer_id_fkey(display_name, is_banned))'
      )
      .eq('org_id', selectedOrg)
      .gte('job_date', rangeStart)
      .lte('job_date', rangeEnd)

    const mapped = (data || []).map((j) => {
      const techs = (j.job_technicians || []).slice().sort((a, b) => a.sort_order - b.sort_order)
      return {
        ...j,
        customer_name: j.properties?.customers?.display_name || 'Unknown',
        address: j.properties?.street_address || '',
        is_banned: j.properties?.customers?.is_banned || false,
        primary_technician: techs[0]?.users || null,
        technician_names: techs.length > 0 ? techs.map((t) => t.users?.full_name).join(', ') : 'Unassigned',
      }
    })
    setJobs(mapped)
    setLoading(false)
  }

  useEffect(() => {
    loadJobs()
  }, [selectedOrg, currentDate, effectiveView])

  function goToday() {
    setCurrentDate(new Date())
  }

  function goPrev() {
    if (effectiveView === 'month') setCurrentDate((d) => addMonths(d, -1))
    else if (effectiveView === 'week') setCurrentDate((d) => addDays(d, -7))
    else setCurrentDate((d) => addDays(d, -1))
  }

  function goNext() {
    if (effectiveView === 'month') setCurrentDate((d) => addMonths(d, 1))
    else if (effectiveView === 'week') setCurrentDate((d) => addDays(d, 7))
    else setCurrentDate((d) => addDays(d, 1))
  }

  async function handleGridDrop(jobId, newDateStr, newTimeStr) {
    await supabase
      .from('jobs')
      .update({ job_date: newDateStr, start_time: `${newDateStr}T${newTimeStr}:00` })
      .eq('id', jobId)
    loadJobs()
  }

  function handleDayClick(day) {
    setCurrentDate(day)
    setViewMode('day')
  }

  async function handleMonthDrop(jobId, newDateStr) {
    await supabase.from('jobs').update({ job_date: newDateStr }).eq('id', jobId)
    loadJobs()
  }

  const dateLabel =
    effectiveView === 'month'
      ? formatMonthLabel(currentDate)
      : effectiveView === 'week'
      ? formatWeekRangeLabel(startOfWeek(currentDate))
      : formatDayLabel(currentDate)

  return (
<div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 className="page-title" style={{ marginBottom: 0 }}>Calendar</h2>
        <NewItemDropdown onSelect={setNewItemMode} />
      </div>

      {isSuperAdmin && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      <div className="calendar-toolbar">
        <div className="calendar-nav-group">
          <button className="calendar-nav-btn" onClick={goPrev}>‹</button>
          <button className="logout-button" onClick={goToday}>Today</button>
          <button className="calendar-nav-btn" onClick={goNext}>›</button>
          <div className="calendar-date-label">{dateLabel}</div>
        </div>

        {!isMobile && (
          <div className="calendar-view-toggle">
            <button
              className={`calendar-view-btn${viewMode === 'week' ? ' active' : ''}`}
              onClick={() => setViewMode('week')}
            >
              Week
            </button>
            <button
              className={`calendar-view-btn${viewMode === 'day' ? ' active' : ''}`}
              onClick={() => setViewMode('day')}
            >
              Day
            </button>
            <button
              className={`calendar-view-btn${viewMode === 'month' ? ' active' : ''}`}
              onClick={() => setViewMode('month')}
            >
              Month
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : effectiveView === 'month' ? (
        <CalendarMonth
          monthDate={currentDate}
          gridDays={days}
          jobs={jobs}
          onJobClick={setSelectedJob}
          onDayClick={handleDayClick}
          onJobDrop={handleMonthDrop}
        />
      ) : (
        <CalendarGrid
          days={days}
          jobs={jobs}
          businessStart={businessStart}
          businessEnd={businessEnd}
          onJobClick={setSelectedJob}
          onJobDrop={handleGridDrop}
        />
      )}

      <JobDetailModal job={selectedJob} onClose={() => setSelectedJob(null)} />

      {newItemMode && (
        <QuickAddModal
          mode={newItemMode}
          orgId={selectedOrg}
          profile={profile}
          onClose={() => setNewItemMode(null)}
          onCreated={loadJobs}
        />
      )}
    </div>
  )
}
