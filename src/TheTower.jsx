import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import MobileNav, { isFieldAdmin } from './MobileNav'
import { can } from './utils/permissions'

/* ------------------------------------------------------------------ *
 * THE TOWER — field-supervisor crew oversight (real data).
 * Every signal triple-encoded (color + icon-shape + word) so a
 * colorblind supervisor still reads the board. Day strip = mode shift:
 *   Today = TRIAGE (no-contact / late)   [5-min grace]
 *   Tomorrow = COVERAGE (unassigned / conflicts)
 *   Yesterday = REVIEW (incomplete / Punchlist / Labor Warranty)
 * Query is bounded to a single selected day (near window) for security.
 * ------------------------------------------------------------------ */

const NAVY = '#0B2545'
const PAGE = '#EEF3F9'
const SUN  = '#F5820B'
const GRACE_MIN = 5
const RETURN_TYPES = ['Punchlist', 'Labor Warranty']

// Employee identity palette — always paired with initials (never color alone)
const PALETTE = ['#2E6BD6', '#7A3FF2', '#0E9C8A', '#E8641C', '#C0398A', '#3B7A57', '#B4472E', '#5A4FCF']
function techColor(id) {
  if (!id) return '#D0342C'
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}
function initials(name) {
  if (!name) return '—'
  const p = name.trim().split(/\s+/)
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '—'
}
function shortName(name) {
  if (!name) return 'Unassigned'
  const p = name.trim().split(/\s+/)
  return p.length > 1 ? `${p[0]} ${p[1][0]}.` : p[0]
}

// tiny inline icons (no external dep)
const Ico = ({ d, size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 auto' }}>{d}</svg>
)
const IHome = <Ico d={<><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></>} />
const INav = <Ico d={<polygon points="3 11 22 2 13 21 11 13 3 11" />} />
const IAlert = <Ico d={<><path d="M12 3l10 18H2z" /><path d="M12 10v5" /><path d="M12 18h.01" /></>} />
const IClock = <Ico d={<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>} />
const ICheck = <Ico d={<path d="M4 12l5 5L20 6" />} />
const IRotate = <Ico d={<><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></>} />
const IMsg = <Ico d={<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />} size={15} />
const IPhone = <Ico d={<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19 19 0 0 1-8.3-3 19 19 0 0 1-6-6 19 19 0 0 1-3-8.4A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.5a16 16 0 0 0 6 6l1.1-1.1a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z" />} size={15} />
const IUserPlus = <Ico d={<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></>} size={15} />
const IChevL = <Ico d={<path d="M15 18l-6-6 6-6" />} size={18} />
const IChevR = <Ico d={<path d="M9 18l6-6-6-6" />} size={18} />
const ICal = <Ico d={<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>} size={17} />
const IPlus = <Ico d={<><path d="M12 5v14M5 12h14" /></>} size={26} />

// status display: color + icon(shape) + word
const STATUS = {
  on_my_way:  { word: 'En route',  color: '#C97A12', ico: INav,    bg: '#FBF1DF' },
  in_progress:{ word: 'On site',   color: '#1F9D57', ico: IHome,   bg: '#E7F6EE' },
  scheduled:  { word: 'Scheduled', color: '#5A6B7B', ico: IClock,  bg: '#EDF1F5' },
  unscheduled:{ word: 'Unscheduled',color:'#5A6B7B', ico: IClock,  bg: '#EDF1F5' },
  completed:  { word: 'Complete',  color: '#1F9D57', ico: ICheck,  bg: '#E7F6EE' },
  incomplete: { word: 'Incomplete',color: '#D0342C', ico: IAlert,  bg: '#FBE7E5' },
  canceled:   { word: 'Canceled',  color: '#8A98AC', ico: IAlert,  bg: '#F1F2F4' },
  unassigned: { word: 'Unassigned',color: '#D0342C', ico: IAlert,  bg: '#FBE7E5' },
  conflict:   { word: 'Conflict',  color: '#C97A12', ico: IAlert,  bg: '#FBF1DF' },
  return:     { word: 'Return',    color: '#D9741A', ico: IRotate, bg: '#FCEBDD' },
}

function dayStr(offset) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d - tz).toISOString().slice(0, 10)
}
function fmtTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  let h = d.getHours(), m = d.getMinutes()
  const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12
  return `${h}:${String(m).padStart(2, '0')} ${ap}`
}

export default function TheTower({ profile }) {
  const navigate = useNavigate()
  const isSuperAdmin = profile?.role === 'super_admin'
  const orgId = isSuperAdmin ? (localStorage.getItem('tech_preview_org_id') || '') : profile?.org_id

  const [dayKey, setDayKey] = useState('today') // yesterday | today | tomorrow
  const [pickDate, setPickDate] = useState(null) // ISO override from the date picker
  const [view, setView] = useState('crew')       // mine | crew
  const [filter, setFilter] = useState('all')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [myUid, setMyUid] = useState(null)
  const [pendingDiscounts, setPendingDiscounts] = useState([])
  const [userMap, setUserMap] = useState({})
  const [selfApprove, setSelfApprove] = useState(true)
  const canApproveDiscount = profile?.role === 'super_admin' || can(profile, 'approve_nonstandard_discounts') || !!profile?.is_field_supervisor

  async function loadPendingDiscounts() {
    if (!orgId) return
    const { data } = await supabase
      .from('invoices')
      .select('id, invoice_number, discount_amount, discount_label, job_id, estimating_technician_id, discount_requested_by, jobs(job_number)')
      .eq('org_id', orgId).eq('kind', 'estimate').eq('discount_status', 'pending')
      .order('invoice_date', { ascending: false })
    setPendingDiscounts(data || [])
  }
  useEffect(() => {
    if (!orgId || !canApproveDiscount) return
    loadPendingDiscounts()
    supabase.from('organizations').select('discount_self_approve').eq('id', orgId).single()
      .then(({ data }) => setSelfApprove(data?.discount_self_approve !== false))
    supabase.from('users').select('id, full_name').eq('org_id', orgId).then(({ data }) => {
      const m = {}; (data || []).forEach((u) => { m[u.id] = u.full_name }); setUserMap(m)
    })
    const ch = supabase
      .channel('tower-discounts-' + orgId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices', filter: `org_id=eq.${orgId}` }, () => loadPendingDiscounts())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [orgId, canApproveDiscount])

  async function approveDiscount(d) {
    await supabase.from('invoices').update({
      discount_status: 'approved', discount_approved_by: profile.id, discount_approved_at: new Date().toISOString(),
    }).eq('id', d.id)
    loadPendingDiscounts()
  }
  async function declineDiscount(d) {
    await supabase.from('invoices').update({
      discount_id: null, discount_amount: 0, discount_type: 'dollar', discount_label: null,
      discount_status: null, discount_approved_by: null, discount_approved_at: null,
    }).eq('id', d.id)
    loadPendingDiscounts()
  }

  const offset = dayKey === 'yesterday' ? -1 : dayKey === 'tomorrow' ? 1 : 0
  const activeDate = pickDate || dayStr(offset)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMyUid(data?.user?.id || null))
  }, [])

  useEffect(() => { load() /* eslint-disable-next-line */ }, [activeDate, orgId])

  async function load() {
    setLoading(true)
    if (!orgId) { setRows([]); setLoading(false); return }
    // The Tower reads through the tower_board() RPC, which enforces the access
    // rule server-side: field supervisors/admins only, own org only (a platform
    // super_admin may pass a preview org), and a bounded near-time window.
    // A plain tech who reaches this code is rejected by the database, not just the UI.
    const { data, error } = await supabase.rpc('tower_board', { p_org_id: orgId, p_date: activeDate })
    if (error) { setRows([]); setLoading(false); return }
    const assembled = (data || []).map((r) => ({
      id: r.id,
      job_number: r.job_number,
      segment: r.segment,
      status: r.status,
      start_time: r.start_time,
      duration_hours: r.duration_hours,
      job_type: r.job_type,
      on_my_way_at: r.on_my_way_at,
      arrival_at: r.arrival_at,
      completed_at: r.completed_at,
      customers: { display_name: r.customer_name },
      properties: { street_address: r.street_address, unit: r.unit, city: r.city },
      techUserId: r.tech_user_id,
      techName: r.tech_name,
    }))
    setRows(assembled)
    setLoading(false)
  }

  // conflict detection (tomorrow coverage): a tech double-booked by start_time + duration_hours
  const conflicts = useMemo(() => {
    const out = {}
    const byTech = {}
    rows.forEach((j) => { if (j.techUserId && j.start_time) (byTech[j.techUserId] = byTech[j.techUserId] || []).push(j) })
    Object.values(byTech).forEach((list) => {
      list.sort((a, b) => a.start_time.localeCompare(b.start_time))
      for (let i = 1; i < list.length; i++) {
        const prev = list[i - 1], cur = list[i]
        const prevEnd = new Date(prev.start_time).getTime() + (Number(prev.duration_hours) || 1) * 3600000
        if (new Date(cur.start_time).getTime() < prevEnd) {
          out[cur.id] = `Overlaps ${shortName(prev.techName)}'s ${fmtTime(prev.start_time)}`
        }
      }
    })
    return out
  }, [rows])

  function attention(j) {
    if (dayKey === 'tomorrow') {
      if (!j.techUserId) return { flag: true, label: 'Unassigned — no tech' }
      if (conflicts[j.id]) return { flag: true, label: conflicts[j.id] }
      return { flag: false }
    }
    if (dayKey === 'yesterday') {
      if (j.status === 'incomplete') return { flag: true, label: 'Left incomplete' }
      if (RETURN_TYPES.includes(j.job_type)) return { flag: true, label: `${j.job_type} — return trip` }
      return { flag: false }
    }
    // today
    if ((j.status === 'scheduled' || j.status === 'on_my_way') && j.start_time && !j.arrival_at) {
      const late = Math.round((Date.now() - new Date(j.start_time).getTime()) / 60000)
      if (late > GRACE_MIN) return { flag: true, label: j.status === 'on_my_way' ? `Behind · ${late}m` : `No contact · ${late}m late` }
    }
    return { flag: false }
  }

  const enriched = useMemo(() => rows.map((j) => ({ ...j, att: attention(j) })), [rows, dayKey, conflicts])

  const counts = useMemo(() => {
    const crew = new Set(); enriched.forEach((j) => j.techUserId && crew.add(j.techUserId))
    if (dayKey === 'tomorrow') return {
      a: enriched.filter((j) => !j.techUserId).length,
      b: enriched.filter((j) => conflicts[j.id]).length,
      c: enriched.filter((j) => j.techUserId).length, crew: crew.size,
      aL: 'Unassigned', bL: 'Conflicts', cL: 'Assigned', aT: STATUS.unassigned, bT: STATUS.conflict, cT: STATUS.in_progress,
    }
    if (dayKey === 'yesterday') return {
      a: enriched.filter((j) => j.status === 'incomplete').length,
      b: enriched.filter((j) => RETURN_TYPES.includes(j.job_type)).length,
      c: enriched.filter((j) => j.status === 'completed').length, crew: crew.size,
      aL: 'Incomplete', bL: 'Returns', cL: 'Completed', aT: STATUS.incomplete, bT: STATUS.return, cT: STATUS.completed,
    }
    return {
      a: enriched.filter((j) => j.att.flag).length,
      b: enriched.filter((j) => j.status === 'on_my_way').length,
      c: enriched.filter((j) => j.status === 'in_progress').length, crew: crew.size,
      aL: 'Attention', bL: 'En route', cL: 'On site', aT: STATUS.incomplete, bT: STATUS.on_my_way, cT: STATUS.in_progress,
    }
  }, [enriched, dayKey, conflicts])

  const list = useMemo(() => {
    let r = view === 'mine' ? enriched.filter((j) => j.techUserId === myUid) : enriched
    if (filter === 'attention') r = r.filter((j) => j.att.flag)
    else if (filter === 'unassigned') r = r.filter((j) => !j.techUserId)
    else if (filter === 'conflicts') r = r.filter((j) => conflicts[j.id])
    else if (filter === 'assigned') r = r.filter((j) => j.techUserId)
    else if (filter === 'completed') r = r.filter((j) => j.status === 'completed')
    else if (filter === 'enroute') r = r.filter((j) => j.status === 'on_my_way')
    else if (filter === 'onsite') r = r.filter((j) => j.status === 'in_progress')
    return [...r].sort((a, b) => {
      if (a.att.flag !== b.att.flag) return a.att.flag ? -1 : 1
      return (a.start_time || '').localeCompare(b.start_time || '')
    })
  }, [enriched, view, filter, myUid, conflicts])

  const FILTERS = dayKey === 'tomorrow'
    ? [['all', 'All'], ['unassigned', 'Unassigned'], ['conflicts', 'Conflicts'], ['assigned', 'Assigned']]
    : dayKey === 'yesterday'
    ? [['all', 'All'], ['attention', 'Needs review'], ['completed', 'Completed']]
    : [['all', 'All'], ['attention', 'Needs attention'], ['enroute', 'En route'], ['onsite', 'On site']]

  const DAYS = [['yesterday', 'Yesterday', 'Review'], ['today', 'Today', 'Live'], ['tomorrow', 'Tomorrow', 'Coverage']]
  const changeDay = (k) => { setDayKey(k); setPickDate(null); setFilter('all') }

  if (!isFieldAdmin(profile)) {
    return (
      <div className="mobile-shell">
        <div className="mobile-body" style={{ padding: 24 }}>
          <p style={{ color: 'var(--mist)' }}>The Tower is for field supervisors.</p>
          <button className="mobile-header-action-btn" onClick={() => navigate('/tech')}>Back to my jobs</button>
        </div>
        <MobileNav profile={profile} />
      </div>
    )
  }

  const dateLabel = new Date(activeDate + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <div style={{ minHeight: '100vh', background: PAGE, fontFamily: 'inherit', color: NAVY, paddingBottom: 84 }}>
      {/* Header */}
      <div style={{ background: NAVY, color: '#fff', padding: '14px 16px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: '#9DB6D6', fontWeight: 700 }}>Field Supervisor</div>
            <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.1 }}>The Tower</div>
          </div>
          <button onClick={() => navigate('/tech')} style={{ background: 'rgba(255,255,255,.12)', color: '#C7D7EC', border: 'none', borderRadius: 8, padding: '7px 12px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>My Jobs</button>
        </div>
        <div style={{ fontSize: 12.5, color: '#C7D7EC', marginTop: 6 }}>
          {counts.crew} on the board{counts.a > 0 && dayKey === 'today' && <> · <b style={{ color: '#FFB4AE' }}>{counts.a} need attention</b></>}
          <span style={{ float: 'right', opacity: .85 }}>{dateLabel}</span>
        </div>
        {/* Day strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
          <button onClick={() => changeDay(dayKey === 'tomorrow' ? 'today' : 'yesterday')} style={ib}>{IChevL}</button>
          {DAYS.map(([k, tab, mode]) => (
            <button key={k} onClick={() => changeDay(k)} style={{
              flex: 1, border: 'none', cursor: 'pointer', borderRadius: 9, padding: '7px 3px',
              background: dayKey === k && !pickDate ? '#fff' : 'rgba(255,255,255,.10)',
              color: dayKey === k && !pickDate ? NAVY : '#C7D7EC', fontWeight: 800, fontSize: 13,
              display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.15,
            }}>
              {tab}<span style={{ fontSize: 9.5, fontWeight: 600, opacity: .7 }}>{mode}</span>
            </button>
          ))}
          <button onClick={() => changeDay(dayKey === 'yesterday' ? 'today' : 'tomorrow')} style={ib}>{IChevR}</button>
          <label style={{ ...ib, cursor: 'pointer', position: 'relative' }}>
            {ICal}
            <input type="date" value={activeDate} min={dayStr(-7)} max={dayStr(7)}
              onChange={(e) => { setPickDate(e.target.value); setFilter('all') }}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
          </label>
        </div>
      </div>

      {/* Discount approvals — routed live from techs in the field */}
      {canApproveDiscount && pendingDiscounts.length > 0 && (
        <div style={{ padding: '12px 14px 0' }}>
          <div style={{ background: '#FFF4E5', border: '2px solid #E8930C', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#8A5200', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
              Discount Approvals ({pendingDiscounts.length})
            </div>
            {pendingDiscounts.map((d) => {
              const isOwn = !selfApprove && d.discount_requested_by === profile.id
              return (
              <div key={d.id} style={{ background: '#fff', border: '1px solid #F0D6AE', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: NAVY }}>${Number(d.discount_amount || 0).toFixed(2)} off</div>
                <div style={{ fontSize: 13, color: '#42566B', margin: '2px 0 8px' }}>
                  {d.discount_label || 'Custom discount'} · Est {d.invoice_number}
                  {d.jobs?.job_number ? ` · Job ${d.jobs.job_number}` : ''}
                  {userMap[d.estimating_technician_id] ? ` · ${userMap[d.estimating_technician_id]}` : ''}
                </div>
                {isOwn ? (
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#8A5200' }}>You requested this — another supervisor or the dispatcher must approve it.</div>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => approveDiscount(d)} style={{ flex: 1, border: 'none', cursor: 'pointer', borderRadius: 9, padding: '10px', fontSize: 14, fontWeight: 800, background: '#1F7A43', color: '#fff' }}>Approve</button>
                    <button onClick={() => declineDiscount(d)} style={{ flex: 1, cursor: 'pointer', borderRadius: 9, padding: '10px', fontSize: 14, fontWeight: 800, background: '#fff', color: '#C0392B', border: '1px solid #C0392B' }}>Decline</button>
                  </div>
                )}
              </div>
            )})}
          </div>
        </div>
      )}

      {/* Count strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, padding: '12px 14px 4px' }}>
        <Stat n={counts.a} label={counts.aL} tone={counts.aT} active={filter === filterKey(dayKey, 0)} onClick={() => toggle(filterKey(dayKey, 0))} pulse />
        <Stat n={counts.b} label={counts.bL} tone={counts.bT} active={filter === filterKey(dayKey, 1)} onClick={() => toggle(filterKey(dayKey, 1))} />
        <Stat n={counts.c} label={counts.cL} tone={counts.cT} active={filter === filterKey(dayKey, 2)} onClick={() => toggle(filterKey(dayKey, 2))} />
        <Stat n={counts.crew} label="Crew" tone={{ color: NAVY, bg: '#E3EAF3' }} active={false} onClick={() => setFilter('all')} />
      </div>

      {/* My/Crew */}
      <div style={{ display: 'flex', gap: 6, padding: '6px 14px 2px' }}>
        {['mine', 'crew'].map((v) => (
          <button key={v} onClick={() => setView(v)} style={{
            border: 'none', cursor: 'pointer', borderRadius: 10, padding: '8px 16px', fontSize: 14, fontWeight: 700,
            background: view === v ? NAVY : '#fff', color: view === v ? '#fff' : '#42566B',
            boxShadow: view === v ? 'none' : 'inset 0 0 0 1px #D8E1EC',
          }}>{v === 'mine' ? 'My Jobs' : 'Crew'}</button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 7, overflowX: 'auto', padding: '10px 14px 8px' }}>
        {FILTERS.map(([k, lbl]) => (
          <button key={k} onClick={() => setFilter(k)} style={{
            whiteSpace: 'nowrap', border: 'none', cursor: 'pointer', borderRadius: 999, padding: '7px 13px', fontSize: 13, fontWeight: 600,
            background: filter === k ? NAVY : '#fff', color: filter === k ? '#fff' : '#42566B',
            boxShadow: filter === k ? 'none' : 'inset 0 0 0 1px #D8E1EC',
          }}>{lbl}</button>
        ))}
      </div>

      {/* Card stream */}
      <div style={{ padding: '4px 14px 0' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#7A8AA0', padding: '32px 10px' }}>Loading…</div>
        ) : list.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#7A8AA0', padding: '40px 10px', fontSize: 14 }}>Nothing here. Everyone in this filter is clear.</div>
        ) : list.map((j) => <Card key={j.id} job={j} dayKey={dayKey} navigate={navigate} />)}
      </div>

      {/* Create */}
      <button title="Create job / estimate" onClick={() => navigate('/tech/new-job')} style={{
        position: 'fixed', right: 18, bottom: 92, zIndex: 5, width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer',
        background: SUN, color: '#fff', boxShadow: '0 6px 18px rgba(245,130,11,.45)', display: 'grid', placeItems: 'center',
      }}>{IPlus}</button>

      <MobileNav profile={profile} />
    </div>
  )

  function toggle(k) { setFilter(filter === k ? 'all' : k) }
}

function filterKey(dayKey, idx) {
  if (dayKey === 'tomorrow') return ['unassigned', 'conflicts', 'assigned'][idx]
  if (dayKey === 'yesterday') return ['attention', 'completed', 'completed'][idx]
  return ['attention', 'enroute', 'onsite'][idx]
}

const ib = { border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,.10)', color: '#C7D7EC', width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center', flex: '0 0 auto' }

function Stat({ n, label, tone, active, onClick, pulse }) {
  const dim = n === 0
  return (
    <button onClick={onClick} style={{
      border: 'none', cursor: 'pointer', borderRadius: 14, padding: '10px 6px 8px', textAlign: 'center', position: 'relative',
      background: active ? tone.color : '#fff',
      boxShadow: active ? 'none' : '0 1px 2px rgba(11,37,69,.06), inset 0 0 0 1px #E4EBF3',
      opacity: dim && !active ? .55 : 1,
    }}>
      {pulse && n > 0 && !active && <span style={{ position: 'absolute', top: 8, right: 10, width: 8, height: 8, borderRadius: '50%', background: tone.color }} />}
      <div style={{ fontSize: 23, fontWeight: 800, lineHeight: 1, color: active ? '#fff' : (dim ? '#9AA9BC' : tone.color) }}>{n}</div>
      <div style={{ fontSize: 10.5, fontWeight: 600, marginTop: 3, color: active ? 'rgba(255,255,255,.9)' : '#5A6B7B' }}>{label}</div>
    </button>
  )
}

function Card({ job, dayKey, navigate }) {
  const color = techColor(job.techUserId)
  const att = job.att
  let s
  if (dayKey === 'tomorrow') s = !job.techUserId ? STATUS.unassigned : (att.flag ? STATUS.conflict : STATUS.scheduled)
  else if (dayKey === 'yesterday') s = RETURN_TYPES.includes(job.job_type) ? STATUS.return : (STATUS[job.status] || STATUS.scheduled)
  else s = STATUS[job.status] || STATUS.scheduled
  const addr = job.properties ? `${job.properties.street_address || ''}${job.properties.city ? ', ' + job.properties.city : ''}` : ''

  return (
    <div onClick={() => navigate(`/tech/${job.id}`)} style={{
      position: 'relative', background: '#fff', borderRadius: 14, marginBottom: 11, overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(11,37,69,.08)', display: 'flex', cursor: 'pointer',
    }}>
      <div style={{ width: 6, background: att.flag ? '#D0342C' : color, flex: '0 0 auto' }} />
      <div style={{ flex: 1, padding: '11px 12px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
          <span style={{ flex: '0 0 auto', width: 30, height: 30, borderRadius: 8, background: color, color: '#fff', fontSize: 11, fontWeight: 800, display: 'grid', placeItems: 'center' }}>{initials(job.techName)}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{shortName(job.techName)}</span>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, background: s.bg, color: s.color, fontSize: 12, fontWeight: 700, padding: '4px 9px', borderRadius: 999 }}>
            {s.ico}{s.word}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: NAVY }}>{job.job_number}{job.segment > 1 ? `-${job.segment}` : ''}</span>
          <span style={{ fontSize: 13, color: '#42566B', fontWeight: 600 }}>{fmtTime(job.start_time)}</span>
          <span style={{ fontSize: 12, color: '#8A98AC' }}>· {job.job_type || 'Job'}</span>
        </div>
        <div style={{ fontSize: 13, color: '#2C3E52', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <b style={{ color: NAVY }}>{job.customers?.display_name || 'Unknown'}</b>{addr && ` — ${addr}`}
        </div>
        {att.flag && (
          <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, background: '#FBE7E5', color: '#D0342C', fontSize: 12, fontWeight: 800, padding: '5px 9px', borderRadius: 8 }}>
            {IAlert} {att.label}
          </div>
        )}
      </div>
    </div>
  )
}
