import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import AiAssist from './AiAssist'

function dateDisplay(val) {
  if (!val) return '—'
  return new Date(val + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}
function daysBetween(later, earlier) {
  return Math.round((new Date(later + 'T00:00:00') - new Date(earlier + 'T00:00:00')) / 86400000)
}
function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

const MAINT_OUTREACH_SYS = 'Draft a short, friendly outreach message from an HVAC company to a customer, offering to schedule their maintenance visit that is coming due or overdue. Mention their plan by name if given. 2-3 sentences, warm and helpful, ready to review and send. No subject line.'

export default function MaintenanceDue({ profile }) {
  const isSuperAdmin = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [visits, setVisits] = useState([])
  const [techs, setTechs] = useState([])
  const [loading, setLoading] = useState(true)
  const [bookingId, setBookingId] = useState(null)
  const [bookDate, setBookDate] = useState('')
  const [bookTech, setBookTech] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => setOrgs(data || []))
    }
  }, [isSuperAdmin])

  useEffect(() => { if (selectedOrg) loadData(selectedOrg) }, [selectedOrg])

  async function loadData(orgId) {
    setLoading(true); setError('')
    const [{ data: v }, { data: u }] = await Promise.all([
      supabase.from('maintenance_visits')
        .select(`
          id, due_date, status, visit_index, job_id, completed_date,
          customers ( display_name, primary_phone ),
          properties ( street_address, unit, city ),
          maintenance_agreements ( maintenance_agreement_tiers ( name ) ),
          jobs:job_id ( job_number, start_time, status )
        `)
        .eq('org_id', orgId)
        .in('status', ['due', 'scheduled'])
        .order('due_date', { ascending: true }),
      supabase.from('users').select('id, full_name').eq('org_id', orgId).order('full_name'),
    ])
    setVisits(v || [])
    setTechs(u || [])
    setLoading(false)
  }

  const today = todayISO()
  const soonDate = new Date(); soonDate.setDate(soonDate.getDate() + 30)
  const soonISO = soonDate.toISOString().slice(0, 10)

  const due = visits.filter((x) => x.status === 'due')
  const overdue = due.filter((x) => x.due_date < today)
  const dueSoon = due.filter((x) => x.due_date >= today && x.due_date <= soonISO)
  const upcoming = due.filter((x) => x.due_date > soonISO)
  const scheduled = visits.filter((x) => x.status === 'scheduled')

  function startBooking(v) {
    setBookingId(v.id); setBookDate(v.due_date || today); setBookTech(''); setError('')
  }
  async function confirmBooking(v) {
    setBusy(true); setError('')
    const { error: e } = await supabase.rpc('book_maintenance_visit', {
      p_visit_id: v.id, p_date: bookDate, p_tech_id: bookTech || null,
    })
    setBusy(false)
    if (e) { setError(e.message); return }
    setBookingId(null)
    loadData(selectedOrg)
  }

  function propLine(v) {
    const p = v.properties
    if (!p) return '—'
    return p.street_address + (p.unit ? ' ' + p.unit : '') + (p.city ? ', ' + p.city : '')
  }
  function tierName(v) {
    return v.maintenance_agreements?.maintenance_agreement_tiers?.name || 'Plan'
  }

  function Row({ v, kind }) {
    const overdueDays = kind === 'overdue' ? daysBetween(today, v.due_date) : 0
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderBottom: '1px solid var(--border, #E2E6ED)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>{v.customers?.display_name || 'Customer'} <span style={{ fontWeight: 400, color: 'var(--mist, #64748B)' }}>· {tierName(v)}</span></div>
          <div style={{ fontSize: 13, color: 'var(--mist, #64748B)' }}>{propLine(v)}</div>
        </div>
        <div style={{ textAlign: 'right', minWidth: 130 }}>
          <div style={{ fontWeight: 600 }}>{dateDisplay(v.due_date)}</div>
          {kind === 'overdue' && <div style={{ fontSize: 12, color: 'var(--danger, #DC2626)' }}>{overdueDays} day{overdueDays === 1 ? '' : 's'} overdue</div>}
        </div>
        <div style={{ minWidth: 240, textAlign: 'right' }}>
          {v.status === 'scheduled' ? (
            <span>
              <span className="status-pill status-scheduled" style={{ marginRight: 8 }}>Booked</span>
              {v.jobs && <span style={{ fontSize: 13, color: 'var(--mist, #64748B)' }}>{v.jobs.job_number}{v.jobs.start_time ? ' · ' + dateDisplay(v.jobs.start_time.slice(0, 10)) : ''}</span>}
            </span>
          ) : bookingId === v.id ? (
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <input type="date" value={bookDate} onChange={(e) => setBookDate(e.target.value)} />
              <select value={bookTech} onChange={(e) => setBookTech(e.target.value)}>
                <option value="">Unassigned</option>
                {techs.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
              <button className="auth-button" disabled={busy || !bookDate} onClick={() => confirmBooking(v)}>{busy ? 'Booking…' : 'Book'}</button>
              <button className="logout-button" disabled={busy} onClick={() => setBookingId(null)}>Cancel</button>
            </span>
          ) : (
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
              <AiAssist compact label="AI outreach" title={'Outreach · ' + (v.customers?.display_name || 'Customer')}
                system={MAINT_OUTREACH_SYS}
                prompt="Draft a short, friendly message offering to schedule this customer's maintenance visit, ready to review and send."
                context={{ customer: v.customers?.display_name, plan: tierName(v), due_date: v.due_date, status: kind }} />
              <button className="auth-button" onClick={() => startBooking(v)}>Schedule</button>
            </span>
          )}
        </div>
      </div>
    )
  }

  function Section({ title, list, kind, tone }) {
    if (list.length === 0) return null
    return (
      <div style={{ marginBottom: 22 }}>
        <h3 style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: tone, display: 'inline-block' }} />
          {title} <span className="badge">{list.length}</span>
        </h3>
        <div style={{ border: '1px solid var(--border, #E2E6ED)', borderRadius: 8, overflow: 'hidden' }}>
          {list.map((v) => <Row key={v.id} v={v} kind={kind} />)}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <h2 className="page-title" style={{ margin: 0 }}>Maintenance Due</h2>
        <span className="badge">{overdue.length + dueSoon.length} need attention</span>
      </div>

      {isSuperAdmin && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
        <div className="stat-tile"><div className="stat-value">{overdue.length}</div><div className="stat-label">Overdue</div></div>
        <div className="stat-tile"><div className="stat-value">{dueSoon.length}</div><div className="stat-label">Due in 30 days</div></div>
        <div className="stat-tile"><div className="stat-value">{scheduled.length}</div><div className="stat-label">Booked</div></div>
      </div>

      {error && <div style={{ color: 'var(--danger, #DC2626)', marginBottom: 12 }}>{error}</div>}

      {loading ? (
        <p style={{ color: 'var(--mist, #64748B)' }}>Loading…</p>
      ) : visits.length === 0 ? (
        <p style={{ color: 'var(--mist, #64748B)' }}>No maintenance visits due yet. Visits appear here automatically as maintenance agreements are signed and activated.</p>
      ) : (
        <>
          <Section title="Overdue" list={overdue} kind="overdue" tone="#DC2626" />
          <Section title="Due Soon — next 30 days" list={dueSoon} kind="due" tone="#D97706" />
          <Section title="Booked" list={scheduled} kind="scheduled" tone="#2563EB" />
          <Section title="Upcoming" list={upcoming} kind="due" tone="#94A3B8" />
        </>
      )}
    </div>
  )
}
