import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import NewItemDropdown from './NewItemDropdown'
import QuickAddModal from './QuickAddModal'
import CalendarGrid from './CalendarGrid'
import CalendarMonth from './CalendarMonth'
import JobDetailModal from './JobDetailModal'
import { loadOrgTz, zonedToUtcIso } from './utils/tz'
import {
  startOfWeek,
  addDays,
  addMonths,
  formatWeekRangeLabel,
  formatDayLabel,
  formatMonthLabel,
  getMonthGridDays,
} from './utils/dateHelpers'

const TRAY_W = { '8_11': '8\u201311 AM', '10_1': '10 AM\u20131 PM', '12_3': '12\u20133 PM', '2_5': '2\u20135 PM', 'asap': 'ASAP' }
function trayWindowLabel(job) { return TRAY_W[job.requested_window] || 'Needs scheduling' }
function trayDayLabel(dstr) {
  if (!dstr) return 'No date'
  return new Date(dstr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// The "Needs Dispatch" tray: sits on the calendar screen but OFF the time grid,
// so provisional self-bookings and pending office jobs never crowd the grid.
// Drag a card onto the grid to schedule + it clears date_pending and lands there.
function DispatchTray({ jobs, onJobClick, collapsed, onToggle, isMobile }) {
  const asap = jobs.filter((j) => j.requested_window === 'asap')
  const rest = jobs.filter((j) => j.requested_window !== 'asap')
    .slice().sort((a, b) => (a.job_date || '').localeCompare(b.job_date || ''))
  const groups = []
  let cur = null
  for (const j of rest) {
    if (!cur || cur.date !== j.job_date) { cur = { date: j.job_date, jobs: [] }; groups.push(cur) }
    cur.jobs.push(j)
  }
  const count = jobs.length
  const card = (job) => (
    <div
      key={job.id}
      draggable={!job.payment_gated}
      onDragStart={(e) => { if (job.payment_gated) { e.preventDefault(); return } e.dataTransfer.setData('text/plain', job.id) }}
      onClick={() => onJobClick(job)}
      style={{ background: '#fff', borderLeft: `4px solid ${job.payment_gated ? '#9CA3AF' : '#DC2626'}`, borderRadius: 8, padding: '8px 10px', marginBottom: 8, cursor: job.payment_gated ? 'not-allowed' : 'grab', boxShadow: '0 1px 3px rgba(16,42,67,.12)', opacity: job.payment_gated ? 0.9 : 1 }}
    >
      <div style={{ fontSize: 11, fontWeight: 800, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '.03em' }}>
        {job.requested_window === 'asap' ? '\u26A1 ASAP' : trayWindowLabel(job)}
      </div>
      <div style={{ fontWeight: 700, fontSize: 14 }}>{job.customer_name}</div>
      {job.job_type && <div style={{ fontSize: 12.5, color: 'var(--mist)' }}>{job.job_type}</div>}
      {job.address && <div style={{ fontSize: 12, color: 'var(--mist)' }}>{job.address}</div>}
      {job.parts_ready && (
        <div style={{ marginTop: 4, display: 'inline-block', fontSize: 11, fontWeight: 800, color: '#0B7A3B', background: '#E7F6EC', borderRadius: 6, padding: '1px 7px' }}>✓ Parts in — ready to schedule</div>
      )}
      {job.payment_gated && (
        <div style={{ marginTop: 4, display: 'inline-block', fontSize: 11, fontWeight: 800, color: '#B00020', background: '#FBE7E7', borderRadius: 6, padding: '1px 7px' }}>🔒 Payment not confirmed</div>
      )}
    </div>
  )
  return (
    <div style={{
      flex: isMobile ? 'none' : '0 0 202px', width: isMobile ? '100%' : 202,
      background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(220,38,38,.28)', borderRadius: 12,
      padding: 12, marginBottom: isMobile ? 16 : 0, boxSizing: 'border-box',
      position: isMobile ? 'static' : 'sticky', top: isMobile ? 'auto' : 12,
      maxHeight: isMobile ? 'none' : 'calc(100vh - 150px)', overflowY: 'auto',
    }}>
      <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: collapsed ? 0 : 10 }}>
        <strong style={{ fontSize: 14, color: '#B0342F' }}>Needs Dispatch{count ? ` (${count})` : ''}</strong>
        <span style={{ fontSize: 12, color: 'var(--mist)' }}>{collapsed ? '\u25B8' : '\u25BE'}</span>
      </div>
      {!collapsed && (count === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--mist)' }}>Nothing waiting — all caught up.</div>
      ) : (
        <>
          {asap.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#DC2626', margin: '2px 0 6px' }}>URGENT</div>
              {asap.map(card)}
            </div>
          )}
          {groups.map((g) => (
            <div key={g.date || 'nodate'} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mist)', margin: '2px 0 6px', textTransform: 'uppercase', letterSpacing: '.03em' }}>{trayDayLabel(g.date)}</div>
              {g.jobs.map(card)}
            </div>
          ))}
          <div style={{ fontSize: 11, color: 'var(--mist)', marginTop: 6 }}>Drag a card onto the calendar to schedule &amp; assign.</div>
        </>
      ))}
    </div>
  )
}

export default function Calendar({ profile }) {
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const nav = useNavigate()
  const [currentDate, setCurrentDate] = useState(() => { const d = new URLSearchParams(window.location.search).get('date'); return d ? new Date(d + 'T00:00:00') : new Date() })
  const [viewMode, setViewMode] = useState('week')
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [businessStart, setBusinessStart] = useState('08:00')
  const [businessEnd, setBusinessEnd] = useState('19:00')
  const [jobs, setJobs] = useState([])
  const [trayJobs, setTrayJobs] = useState([])
  const [blockMsg, setBlockMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedJob, setSelectedJob] = useState(null)
  const [trayCollapsed, setTrayCollapsed] = useState(false)
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
    loadOrgTz(selectedOrg)
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
        'id, job_number, job_date, date_pending, requested_window, self_booked, start_time, duration_hours, status, job_type, service_complaint, property_id, job_technicians(sort_order, users(full_name, calendar_color)), properties(street_address, unit, city, state, zip, customers!properties_customer_id_fkey(id, display_name, is_banned))'
      )
      .eq('org_id', selectedOrg)
      .is('deleted_at', null)
      .gte('job_date', rangeStart)
      .lte('job_date', rangeEnd)

    const mapped = (data || []).map((j) => {
      const techs = (j.job_technicians || []).slice().sort((a, b) => a.sort_order - b.sort_order)
      return {
        ...j,
        customer_name: j.properties?.customers?.display_name || 'Unknown',
        customer_id: j.properties?.customers?.id || null,
        address: j.properties?.street_address || '',
        full_address: [
          j.properties?.street_address,
          j.properties?.unit ? '#' + j.properties.unit : '',
        ].filter(Boolean).join(' ')
          + (j.properties?.city || j.properties?.state || j.properties?.zip
            ? ', ' + [j.properties?.city, [j.properties?.state, j.properties?.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')
            : ''),
        is_banned: j.properties?.customers?.is_banned || false,
        primary_technician: techs[0]?.users || null,
        technician_names: techs.length > 0 ? techs.map((t) => t.users?.full_name).join(', ') : 'Unassigned',
      }
    })
    setJobs(mapped)
    setLoading(false)
  }

  // The tray loads ALL pending jobs for the org, independent of the grid's date
  // window, so future self-bookings and pending jobs are always visible to dispatch.
  async function loadTray() {
    if (!selectedOrg) return
    const { data } = await supabase
      .from('jobs')
      .select(
        'id, job_number, job_date, date_pending, parts_ready, requested_window, self_booked, start_time, duration_hours, status, job_type, service_complaint, property_id, job_technicians(sort_order, users(full_name, calendar_color)), properties(street_address, unit, city, state, zip, customers!properties_customer_id_fkey(id, display_name, is_banned))'
      )
      .eq('org_id', selectedOrg)
      .is('deleted_at', null)
      .eq('date_pending', true)
      .neq('status', 'cancelled')
      .order('job_date', { ascending: true })
    const rows = data || []
    // Installs whose source System Estimate isn't payment-confirmed can't be scheduled yet.
    const gated = new Set()
    const trayIds = rows.map((j) => j.id)
    if (trayIds.length) {
      const { data: ests } = await supabase
        .from('invoices')
        .select('spawned_job_id, converted_to_job_id, payment_confirmed_at, paid_at')
        .eq('org_id', selectedOrg).eq('estimate_type', 'system')
        .or(`spawned_job_id.in.(${trayIds.join(',')}),converted_to_job_id.in.(${trayIds.join(',')})`)
      ;(ests || []).forEach((e) => {
        if (!e.payment_confirmed_at && !e.paid_at) {
          if (e.spawned_job_id) gated.add(e.spawned_job_id)
          if (e.converted_to_job_id) gated.add(e.converted_to_job_id)
        }
      })
    }
    setTrayJobs(rows.map((j) => {
      const techs = (j.job_technicians || []).slice().sort((a, b) => a.sort_order - b.sort_order)
      return {
        ...j,
        payment_gated: gated.has(j.id),
        customer_name: j.properties?.customers?.display_name || 'Unknown',
        customer_id: j.properties?.customers?.id || null,
        address: j.properties?.street_address || '',
        is_banned: j.properties?.customers?.is_banned || false,
        primary_technician: techs[0]?.users || null,
        technician_names: techs.length > 0 ? techs.map((t) => t.users?.full_name).join(', ') : 'Unassigned',
      }
    }))
  }

  useEffect(() => {
    loadJobs()
  }, [selectedOrg, currentDate, effectiveView])

  useEffect(() => {
    loadTray()
  }, [selectedOrg])

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

  // An install spawned from a System Estimate can't be scheduled until its payment
  // is confirmed (card paid / cash-check confirmed / financing approved) — checked
  // authoritatively here at drop time, not just visually in the tray.
  async function installPaymentBlocked(jobId) {
    const { data } = await supabase
      .from('invoices')
      .select('payment_confirmed_at, paid_at')
      .eq('org_id', selectedOrg).eq('estimate_type', 'system')
      .or(`spawned_job_id.eq.${jobId},converted_to_job_id.eq.${jobId}`)
      .limit(1)
    const src = data && data[0]
    return !!(src && !src.payment_confirmed_at && !src.paid_at)
  }

  async function handleGridDrop(jobId, newDateStr, newTimeStr) {
    if (await installPaymentBlocked(jobId)) {
      setBlockMsg("This install can't be scheduled yet — its payment isn't confirmed. Confirm the method (Cash / Check / Card / approved financing) in Payments to Confirm first.")
      loadTray(); return
    }
    // newTimeStr is where on the grid the job was dropped — a local wall-clock
    // time. Building it into a real Date and using toISOString() (rather than
    // sending the bare "YYYY-MM-DDTHH:MM:00" string straight to Supabase) makes
    // sure it's stored as a true UTC instant, not silently mislabeled as UTC.
    const newStartTime = zonedToUtcIso(newDateStr, newTimeStr)
    await supabase
      .from('jobs')
      .update({ job_date: newDateStr, start_time: newStartTime, date_pending: false })
      .eq('id', jobId)
    loadJobs(); loadTray()
  }

  function handleDayClick(day) {
    setCurrentDate(day)
    setViewMode('day')
  }

  async function handleMonthDrop(jobId, newDateStr) {
    if (await installPaymentBlocked(jobId)) {
      setBlockMsg("This install can't be scheduled yet — its payment isn't confirmed. Confirm the method (Cash / Check / Card / approved financing) in Payments to Confirm first.")
      loadTray(); return
    }
    await supabase.from('jobs').update({ job_date: newDateStr, date_pending: false }).eq('id', jobId)
    loadJobs(); loadTray()
  }

  const dateLabel =
    effectiveView === 'month'
      ? formatMonthLabel(currentDate)
      : effectiveView === 'week'
      ? formatWeekRangeLabel(startOfWeek(currentDate))
      : formatDayLabel(currentDate)

  return (
<div style={{ background: '#CDD9E5', margin: '-32px', padding: '32px' }}>
      {blockMsg && (
        <div style={{ background: '#FBE7E7', border: '1px solid #E3B0B0', color: '#B00020', padding: '10px 14px', borderRadius: 8, marginBottom: 12, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{blockMsg}</span>
          <button onClick={() => setBlockMsg('')} style={{ background: 'none', border: 'none', color: '#B00020', cursor: 'pointer', fontWeight: 700, fontSize: 16 }}>✕</button>
        </div>
      )}
      <div className="page-header-bar">
        <h2>Calendar</h2>
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
          <button className="logout-button" onClick={() => nav('/dispatch-map?date=' + toLocalDateStr(currentDate))} title="Open the dispatch map for this date">🗺 Map</button>
          <button className="calendar-nav-btn" onClick={goNext}>›</button>
          <div className="calendar-date-label">{dateLabel}</div>
        </div>

        {!isMobile && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* Calendar / Map view toggle */}
            <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <button type="button" title="Calendar view" style={{ border: 'none', width: 42, height: 34, fontSize: 16, cursor: 'default', background: '#176E7A' }}>🗓</button>
              <button type="button" title="Map view" onClick={() => nav('/dispatch-map?date=' + toLocalDateStr(currentDate))} style={{ border: 'none', width: 42, height: 34, fontSize: 16, cursor: 'pointer', background: '#fff', filter: 'grayscale(1)' }}>📍</button>
            </div>
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
          </div>
        )}
      </div>

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : (
        <div style={{ display: isMobile ? 'block' : 'flex', gap: 16, alignItems: 'flex-start' }}>
          <DispatchTray
            jobs={trayJobs}
            onJobClick={setSelectedJob}
            collapsed={trayCollapsed}
            onToggle={() => setTrayCollapsed((c) => !c)}
            isMobile={isMobile}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            {effectiveView === 'month' ? (
              <CalendarMonth
                monthDate={currentDate}
                gridDays={days}
                jobs={jobs.filter((j) => !j.date_pending)}
                onJobClick={setSelectedJob}
                onDayClick={handleDayClick}
                onJobDrop={handleMonthDrop}
              />
            ) : (
              <CalendarGrid
                days={days}
                jobs={jobs.filter((j) => !j.date_pending)}
                businessStart={businessStart}
                businessEnd={businessEnd}
                onJobClick={setSelectedJob}
                onJobDrop={handleGridDrop}
              />
            )}
          </div>
        </div>
      )}

      <JobDetailModal job={selectedJob} onClose={() => setSelectedJob(null)} />

      {newItemMode && (
        <QuickAddModal
          mode={newItemMode}
          orgId={selectedOrg}
          profile={profile}
          onClose={() => setNewItemMode(null)}
          onCreated={() => { loadJobs(); loadTray() }}
        />
      )}
    </div>
  )
}
