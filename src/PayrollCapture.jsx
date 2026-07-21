import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

// ---- helpers ---------------------------------------------------------------

function mondayOf(date) {
  const d = new Date(date)
  const day = (d.getDay() + 6) % 7 // 0 = Monday
  d.setDate(d.getDate() - day)
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d - tz).toISOString().slice(0, 10)
}

function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d - tz).toISOString().slice(0, 10)
}

function money(n) {
  if (n == null || isNaN(n)) return '—'
  return '$' + Number(n).toFixed(2)
}

// Frozen-total formulas. These run at archive time and the results are stored,
// so later rate/formula changes never rewrite an archived legal record.
function computeBaseDue(b) {
  if (!b) return 0
  const rate = Number(b.hourly_rate) || 0
  switch (b.pay_type) {
    case 'salary': {
      const annual = Number(b.annual_salary) || 0
      const days = Number(b.days_clocked_in) || 0
      const daily = annual / 260 // ~52 weeks * 5 days
      return +(daily * days).toFixed(2)
    }
    case 'wages': {
      const hrs = Number(b.hours_clocked_in) || 0
      const ot = Number(b.overtime_hours) || 0
      return +((hrs * rate) + (ot * rate * 1.5)).toFixed(2)
    }
    case 'performance': {
      const th = Number(b.task_hours_recorded) || 0
      const tb = Number(b.task_bonus) || 0
      return +((th * rate) + tb).toFixed(2)
    }
    case 'piece_rate': {
      const jobs = Number(b.piece_rate_jobs) || 0
      return +(jobs * rate).toFixed(2)
    }
    default:
      return 0
  }
}

function computeBonusDue(x) {
  return +(((Number(x.bonuses_earned) || 0) * (Number(x.amount) || 0)).toFixed(2))
}

function computeCommissionDue(x) {
  return +(((Number(x.commissioned_sales) || 0) * ((Number(x.commission_pct) || 0) / 100)).toFixed(2))
}

const PAY_TYPE_LABELS = {
  salary: 'Salary',
  wages: 'Wages (Hourly)',
  performance: 'Performance Pay',
  piece_rate: 'Piece Rate',
}

// ---- component -------------------------------------------------------------

export default function PayrollCapture({ profile }) {
  const isSuperAdmin = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [loading, setLoading] = useState(true)

  const [weekStart, setWeekStart] = useState(mondayOf(new Date()))
  const [employees, setEmployees] = useState([])
  const [weeks, setWeeks] = useState([])          // payroll_weeks for this org+week
  const [components, setComponents] = useState({}) // weekId -> {base, bonuses[], commissions[]}
  const [clockHours, setClockHours] = useState({}) // userId -> total clocked hours this week
  const [expanded, setExpanded] = useState(null)   // weekId currently open for editing
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        if (!selectedOrg && data && data.length > 0) setSelectedOrg(data[0].id)
      })
    }
  }, [isSuperAdmin])

  useEffect(() => {
    if (selectedOrg) loadAll()
  }, [selectedOrg, weekStart])

  async function loadAll() {
    setLoading(true)
    const weekEnd = addDays(weekStart, 6)

    const [empRes, weekRes] = await Promise.all([
      supabase.from('users').select('id, full_name, email, role').eq('org_id', selectedOrg).eq('is_active', true).order('full_name'),
      supabase.from('payroll_weeks').select('*').eq('org_id', selectedOrg).eq('week_start', weekStart),
    ])
    setEmployees(empRes.data || [])
    const wk = weekRes.data || []
    setWeeks(wk)

    // Load components for all weeks in view
    const map = {}
    if (wk.length > 0) {
      const ids = wk.map((w) => w.id)
      const [baseRes, bonusRes, commRes] = await Promise.all([
        supabase.from('payroll_base_pay').select('*').in('week_id', ids),
        supabase.from('payroll_bonuses').select('*').in('week_id', ids),
        supabase.from('payroll_commissions').select('*').in('week_id', ids),
      ])
      wk.forEach((w) => { map[w.id] = { base: null, bonuses: [], commissions: [] } })
      ;(baseRes.data || []).forEach((b) => { if (map[b.week_id]) map[b.week_id].base = b })
      ;(bonusRes.data || []).forEach((x) => { if (map[x.week_id]) map[x.week_id].bonuses.push(x) })
      ;(commRes.data || []).forEach((x) => { if (map[x.week_id]) map[x.week_id].commissions.push(x) })
    }
    setComponents(map)

    // Sum completed clock events (both clock_in and clock_out set) per employee
    // for this week — the actual compensable hours worked, for the legal
    // higher-of comparison against performance/piece pay.
    const weekEndDate = addDays(weekStart, 6)
    const { data: clockData } = await supabase
      .from('time_clock_events')
      .select('user_id, clock_in, clock_out')
      .eq('org_id', selectedOrg)
      .gte('clock_in', weekStart + 'T00:00:00')
      .lte('clock_in', weekEndDate + 'T23:59:59')
      .not('clock_out', 'is', null)
    const hoursMap = {}
    ;(clockData || []).forEach((e) => {
      const ms = new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()
      if (ms > 0) hoursMap[e.user_id] = (hoursMap[e.user_id] || 0) + ms / 3600000
    })
    // round to 2 decimals
    Object.keys(hoursMap).forEach((k) => { hoursMap[k] = +hoursMap[k].toFixed(2) })
    setClockHours(hoursMap)
    setLoading(false)
  }

  function weekForEmployee(userId) {
    return weeks.find((w) => w.user_id === userId)
  }

  async function startWeek(userId) {
    setBusy(true)
    const weekEnd = addDays(weekStart, 6)
    const { data, error } = await supabase.from('payroll_weeks').insert({
      org_id: selectedOrg,
      user_id: userId,
      week_start: weekStart,
      week_end: weekEnd,
      status: 'draft',
    }).select().single()
    setBusy(false)
    if (error) { alert('Could not start week: ' + error.message); return }
    await loadAll()
    setExpanded(data.id)
  }

  // ---- live (unfrozen) totals for a draft week, for display ----------------
  function liveTotals(weekId) {
    const c = components[weekId]
    if (!c) return { base: 0, bonus: 0, comm: 0, total: 0 }
    const base = computeBaseDue(c.base)
    const bonus = (c.bonuses || []).reduce((s, x) => s + computeBonusDue(x), 0)
    const comm = (c.commissions || []).reduce((s, x) => s + computeCommissionDue(x), 0)
    return { base, bonus, comm, total: +(base + bonus + comm).toFixed(2) }
  }

  async function archiveWeek(week) {
    if (!window.confirm(`Archive ${employeeName(week.user_id)}'s week of ${weekStart}? Totals will be frozen as a permanent record.`)) return
    setBusy(true)
    const c = components[week.id] || {}
    const t = liveTotals(week.id)

    // Freeze each component's computed amount_due, then the week totals.
    if (c.base) {
      await supabase.from('payroll_base_pay').update({ amount_due: computeBaseDue(c.base) }).eq('id', c.base.id)
    }
    for (const b of (c.bonuses || [])) {
      await supabase.from('payroll_bonuses').update({ amount_due: computeBonusDue(b) }).eq('id', b.id)
    }
    for (const cm of (c.commissions || [])) {
      await supabase.from('payroll_commissions').update({ amount_due: computeCommissionDue(cm) }).eq('id', cm.id)
    }
    const { error } = await supabase.from('payroll_weeks').update({
      status: 'archived',
      archived_at: new Date().toISOString(),
      archived_by: profile.id,
      total_base_due: t.base,
      total_bonus_due: t.bonus,
      total_commission_due: t.comm,
      total_due: t.total,
    }).eq('id', week.id)
    setBusy(false)
    if (error) { alert('Archive failed: ' + error.message); return }
    setExpanded(null)
    loadAll()
  }

  async function unarchiveWeek(week) {
    if (!window.confirm('Unarchive this week for corrections? It returns to draft and totals will recompute when re-archived.')) return
    setBusy(true)
    const { error } = await supabase.from('payroll_weeks').update({
      status: 'draft', archived_at: null, archived_by: null,
      total_base_due: null, total_bonus_due: null, total_commission_due: null, total_due: null,
    }).eq('id', week.id)
    setBusy(false)
    if (error) { alert('Unarchive failed: ' + error.message); return }
    loadAll()
  }

  async function deleteWeek(week) {
    if (week.status === 'archived') { alert('Unarchive first before deleting.'); return }
    if (!window.confirm('Delete this draft week and all its entries? This cannot be undone.')) return
    setBusy(true)
    await supabase.from('payroll_weeks').delete().eq('id', week.id)
    setBusy(false)
    if (expanded === week.id) setExpanded(null)
    loadAll()
  }

  function employeeName(userId) {
    const e = employees.find((x) => x.id === userId)
    return e ? e.full_name : 'Employee'
  }

  // ---- component editors ---------------------------------------------------

  async function setBasePayType(weekId, payType) {
    const c = components[weekId]
    if (c && c.base) {
      await supabase.from('payroll_base_pay').update({ pay_type: payType }).eq('id', c.base.id)
    } else {
      await supabase.from('payroll_base_pay').insert({ org_id: selectedOrg, week_id: weekId, pay_type: payType })
    }
    loadAll()
  }

  async function updateBaseField(baseId, field, value) {
    await supabase.from('payroll_base_pay').update({ [field]: value === '' ? null : value }).eq('id', baseId)
    loadAll()
  }

  async function addBonus(weekId) {
    await supabase.from('payroll_bonuses').insert({ org_id: selectedOrg, week_id: weekId, description: '', bonuses_earned: null, amount: null })
    loadAll()
  }
  async function updateBonus(id, field, value) {
    await supabase.from('payroll_bonuses').update({ [field]: value === '' ? null : value }).eq('id', id)
    loadAll()
  }
  async function removeBonus(id) {
    await supabase.from('payroll_bonuses').delete().eq('id', id)
    loadAll()
  }

  async function addCommission(weekId) {
    await supabase.from('payroll_commissions').insert({ org_id: selectedOrg, week_id: weekId, description: '', commissioned_sales: null, sales_occurrence: null, commission_pct: null })
    loadAll()
  }
  async function updateCommission(id, field, value) {
    await supabase.from('payroll_commissions').update({ [field]: value === '' ? null : value }).eq('id', id)
    loadAll()
  }
  async function removeCommission(id) {
    await supabase.from('payroll_commissions').delete().eq('id', id)
    loadAll()
  }

  // ---- render --------------------------------------------------------------

  const orgTotal = weeks.reduce((s, w) => {
    const t = w.status === 'archived' ? (w.total_due || 0) : liveTotals(w.id).total
    return s + t
  }, 0)

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ margin: 0 }}>
          Payroll Capture <span className="badge">{weeks.length} started</span>
        </h1>
        {isSuperAdmin && <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />}
      </div>

      <p style={{ color: 'var(--mist)', marginTop: 4 }}>
        Weekly hours, bonuses, and commissions per employee. Totals freeze when a week is archived, creating a permanent record.
        This captures data only — no disbursements.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0', flexWrap: 'wrap' }}>
        <button className="logout-button" onClick={() => setWeekStart(addDays(weekStart, -7))}>&larr; Prev week</button>
        <div style={{ fontWeight: 700 }}>
          Week of {weekStart} &ndash; {addDays(weekStart, 6)}
        </div>
        <button className="logout-button" onClick={() => setWeekStart(addDays(weekStart, 7))}>Next week &rarr;</button>
        <input type="date" value={weekStart} onChange={(e) => setWeekStart(mondayOf(e.target.value))} />
        <div style={{ marginLeft: 'auto', fontWeight: 800, fontSize: 16 }}>
          Week payroll owed: {money(orgTotal)}
        </div>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {employees.map((emp) => {
            const week = weekForEmployee(emp.id)
            const isOpen = week && expanded === week.id
            const t = week ? (week.status === 'archived'
              ? { base: week.total_base_due, bonus: week.total_bonus_due, comm: week.total_commission_due, total: week.total_due }
              : liveTotals(week.id)) : null
            return (
              <div key={emp.id} className="section-card" style={{ padding: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <Link to={`/payroll/employee/${emp.id}`} style={{ fontWeight: 700, textDecoration: 'none', color: 'var(--route-blue, #2E7FC4)' }}>
                      {emp.full_name}
                    </Link>
                    <div style={{ fontSize: 12, color: 'var(--mist)' }}>{emp.role}</div>
                  </div>

                  {!week && (
                    <button className="auth-button" style={{ width: 'auto', padding: '6px 16px', margin: 0 }} disabled={busy} onClick={() => startWeek(emp.id)}>
                      Start Week
                    </button>
                  )}

                  {week && (
                    <>
                      <div style={{ textAlign: 'right', minWidth: 120 }}>
                        <div style={{ fontWeight: 800 }}>{money(t.total)}</div>
                        <div style={{ fontSize: 11, color: 'var(--mist)' }}>
                          {week.status === 'archived'
                            ? `Archived ${new Date(week.archived_at).toLocaleDateString()}`
                            : 'Draft'}
                        </div>
                      </div>
                      {week.status === 'draft' ? (
                        <>
                          <button className="logout-button" onClick={() => setExpanded(isOpen ? null : week.id)}>
                            {isOpen ? 'Close' : 'Edit'}
                          </button>
                          <button className="auth-button" style={{ width: 'auto', padding: '6px 16px', margin: 0 }} disabled={busy} onClick={() => archiveWeek(week)}>
                            Archive
                          </button>
                          <button className="logout-button" onClick={() => deleteWeek(week)}>Delete</button>
                        </>
                      ) : (
                        <>
                          <span className="status-pill status-active">Locked</span>
                          <button className="logout-button" onClick={() => setExpanded(isOpen ? null : week.id)}>
                            {isOpen ? 'Close' : 'View'}
                          </button>
                          <button className="logout-button" onClick={() => unarchiveWeek(week)}>Unarchive</button>
                        </>
                      )}
                    </>
                  )}
                </div>

                {isOpen && (
                  <WeekEditor
                    week={week}
                    comp={components[week.id] || { base: null, bonuses: [], commissions: [] }}
                    readOnly={week.status === 'archived'}
                    clockHours={clockHours[emp.id]}
                    onSetPayType={(pt) => setBasePayType(week.id, pt)}
                    onUpdateBase={updateBaseField}
                    onAddBonus={() => addBonus(week.id)}
                    onUpdateBonus={updateBonus}
                    onRemoveBonus={removeBonus}
                    onAddCommission={() => addCommission(week.id)}
                    onUpdateCommission={updateCommission}
                    onRemoveCommission={removeCommission}
                    live={liveTotals(week.id)}
                  />
                )}
              </div>
            )
          })}
          {employees.length === 0 && <p style={{ color: 'var(--mist)' }}>No active employees found for this organization.</p>}
        </div>
      )}
    </div>
  )
}

// ---- week editor sub-component ---------------------------------------------

function WeekEditor({ week, comp, readOnly, clockHours, onSetPayType, onUpdateBase, onAddBonus, onUpdateBonus, onRemoveBonus, onAddCommission, onUpdateCommission, onRemoveCommission, live }) {
  const base = comp.base
  const numInput = (val, onChange, ph) => (
    <input type="number" step="0.01" defaultValue={val ?? ''} disabled={readOnly}
      onBlur={(e) => onChange(e.target.value)} placeholder={ph}
      style={{ width: 110 }} />
  )

  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: 16, background: 'var(--panel, #fafbfc)' }}>
      {/* BASE PAY */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Base Pay</div>

        {clockHours != null && (
          <div style={{ background: '#EEF4FF', border: '1px solid #C7D9F5', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 13 }}>
            <strong>{clockHours} hrs</strong> clocked this week (from the shift clock — actual compensable hours).
            {!readOnly && base?.pay_type === 'wages' && (
              <button className="logout-button" style={{ marginLeft: 10 }} onClick={() => onUpdateBase(base.id, 'hours_clocked_in', clockHours)}>
                Use for hours clocked
              </button>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
          <label>Type:</label>
          <select value={base?.pay_type || ''} disabled={readOnly} onChange={(e) => e.target.value && onSetPayType(e.target.value)}>
            <option value="">Select pay type…</option>
            {Object.entries(PAY_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {base?.pay_type === 'salary' && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <label>Days clocked {numInput(base.days_clocked_in, (v) => onUpdateBase(base.id, 'days_clocked_in', v))}</label>
            <label>Annual salary {numInput(base.annual_salary, (v) => onUpdateBase(base.id, 'annual_salary', v))}</label>
          </div>
        )}
        {base?.pay_type === 'wages' && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <label>Hours clocked {numInput(base.hours_clocked_in, (v) => onUpdateBase(base.id, 'hours_clocked_in', v))}</label>
            <label>Overtime hrs {numInput(base.overtime_hours, (v) => onUpdateBase(base.id, 'overtime_hours', v))}</label>
            <label>Hourly rate {numInput(base.hourly_rate, (v) => onUpdateBase(base.id, 'hourly_rate', v))}</label>
          </div>
        )}
        {base?.pay_type === 'performance' && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <label>Task hours {numInput(base.task_hours_recorded, (v) => onUpdateBase(base.id, 'task_hours_recorded', v))}</label>
            <label>Task bonus {numInput(base.task_bonus, (v) => onUpdateBase(base.id, 'task_bonus', v))}</label>
            <label>Hourly rate {numInput(base.hourly_rate, (v) => onUpdateBase(base.id, 'hourly_rate', v))}</label>
          </div>
        )}
        {base?.pay_type === 'piece_rate' && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <label>Piece hours {numInput(base.piece_rate_hours, (v) => onUpdateBase(base.id, 'piece_rate_hours', v))}</label>
            <label>Jobs {numInput(base.piece_rate_jobs, (v) => onUpdateBase(base.id, 'piece_rate_jobs', v))}</label>
            <label>Rate/job {numInput(base.hourly_rate, (v) => onUpdateBase(base.id, 'hourly_rate', v))}</label>
          </div>
        )}
        {base && <div style={{ marginTop: 6, fontWeight: 700 }}>Base due: {money(live.base)}</div>}

        {base && (base.pay_type === 'performance' || base.pay_type === 'piece_rate') && clockHours != null && (
          <div style={{ marginTop: 8, padding: 10, background: '#FFF8E6', border: '1px solid #F0DFA8', borderRadius: 8, fontSize: 13 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Hourly floor check (FLSA)</div>
            <div>Performance/piece amount: <strong>{money(live.base)}</strong></div>
            <div>Actual hours ({clockHours}) × rate ({money(base.hourly_rate)}): <strong>{money((Number(clockHours) || 0) * (Number(base.hourly_rate) || 0))}</strong></div>
            <div style={{ marginTop: 4, color: 'var(--mist)' }}>
              The employee must be paid the higher of the two. Verify the rate used here is at least the applicable minimum wage.
            </div>
          </div>
        )}
      </div>

      {/* BONUSES */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>Bonuses</div>
          {!readOnly && <button className="logout-button" onClick={onAddBonus}>+ Add bonus</button>}
        </div>
        {(comp.bonuses || []).map((b) => (
          <div key={b.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
            <input type="text" defaultValue={b.description || ''} disabled={readOnly} placeholder="Description (e.g. PMA Sales)"
              onBlur={(e) => onUpdateBonus(b.id, 'description', e.target.value)} style={{ flex: 1, minWidth: 160 }} />
            <label>Earned {numInput(b.bonuses_earned, (v) => onUpdateBonus(b.id, 'bonuses_earned', v))}</label>
            <label>Amount {numInput(b.amount, (v) => onUpdateBonus(b.id, 'amount', v))}</label>
            <span style={{ fontWeight: 700, minWidth: 70 }}>{money(computeBonusDueLocal(b))}</span>
            {!readOnly && <button className="logout-button" onClick={() => onRemoveBonus(b.id)}>✕</button>}
          </div>
        ))}
        {(comp.bonuses || []).length === 0 && <div style={{ color: 'var(--mist)', fontSize: 13 }}>No bonuses this week.</div>}
      </div>

      {/* COMMISSIONS */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>Commissions <span style={{ fontWeight: 400, color: 'var(--mist)', fontSize: 12 }}>(when covering sales)</span></div>
          {!readOnly && <button className="logout-button" onClick={onAddCommission}>+ Add commission</button>}
        </div>
        {(comp.commissions || []).map((c) => (
          <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
            <input type="text" defaultValue={c.description || ''} disabled={readOnly} placeholder="Description"
              onBlur={(e) => onUpdateCommission(c.id, 'description', e.target.value)} style={{ flex: 1, minWidth: 140 }} />
            <label>Sales $ {numInput(c.commissioned_sales, (v) => onUpdateCommission(c.id, 'commissioned_sales', v))}</label>
            <label># Sales {numInput(c.sales_occurrence, (v) => onUpdateCommission(c.id, 'sales_occurrence', v))}</label>
            <label>Comm % {numInput(c.commission_pct, (v) => onUpdateCommission(c.id, 'commission_pct', v))}</label>
            <span style={{ fontWeight: 700, minWidth: 70 }}>{money(computeCommissionDueLocal(c))}</span>
            {!readOnly && <button className="logout-button" onClick={() => onRemoveCommission(c.id)}>✕</button>}
          </div>
        ))}
        {(comp.commissions || []).length === 0 && <div style={{ color: 'var(--mist)', fontSize: 13 }}>No commissions this week.</div>}
      </div>

      {readOnly && (
        <div style={{ marginTop: 14, padding: 10, background: '#1F7A43', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
          This week is archived. Values are frozen as a permanent record. Use Unarchive to make corrections.
        </div>
      )}
    </div>
  )
}

// local mirrors so the sub-component can show live line totals
function computeBonusDueLocal(x) {
  return +(((Number(x.bonuses_earned) || 0) * (Number(x.amount) || 0)).toFixed(2))
}
function computeCommissionDueLocal(x) {
  return +(((Number(x.commissioned_sales) || 0) * ((Number(x.commission_pct) || 0) / 100)).toFixed(2))
}
