import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from './utils/supabase'

function money(n) {
  if (n == null || isNaN(n)) return '—'
  return '$' + Number(n).toFixed(2)
}

const PAY_TYPE_LABELS = {
  salary: 'Salary',
  wages: 'Wages (Hourly)',
  performance: 'Performance Pay',
  piece_rate: 'Piece Rate',
}

// This page is the permanent per-employee record: every weekly row, archived
// or draft, with its frozen totals. Read-only history view for legal reference.
export default function EmployeePayroll({ profile }) {
  const { userId } = useParams()
  const [employee, setEmployee] = useState(null)
  const [weeks, setWeeks] = useState([])
  const [components, setComponents] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userId) load()
  }, [userId])

  async function load() {
    setLoading(true)
    const [empRes, weekRes] = await Promise.all([
      supabase.from('users').select('id, full_name, email, role').eq('id', userId).single(),
      supabase.from('payroll_weeks').select('*').eq('user_id', userId).order('week_start', { ascending: false }),
    ])
    setEmployee(empRes.data)
    const wk = weekRes.data || []
    setWeeks(wk)

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
    setLoading(false)
  }

  const archivedTotal = weeks.filter((w) => w.status === 'archived').reduce((s, w) => s + (w.total_due || 0), 0)

  if (loading) return <div className="page"><p>Loading…</p></div>
  if (!employee) return <div className="page"><p>Employee not found.</p></div>

  return (
    <div className="page">
      <Link to="/payroll" className="logout-button" style={{ textDecoration: 'none', display: 'inline-block', marginBottom: 12 }}>&larr; Back to Payroll Capture</Link>
      <h1 style={{ marginBottom: 4 }}>{employee.full_name}</h1>
      <div style={{ color: 'var(--mist)', marginBottom: 16 }}>{employee.role} · {employee.email}</div>

      <div className="section-card" style={{ marginBottom: 16, padding: 16 }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div><div style={{ fontSize: 12, color: 'var(--mist)' }}>Weeks on record</div><div style={{ fontWeight: 800, fontSize: 20 }}>{weeks.length}</div></div>
          <div><div style={{ fontSize: 12, color: 'var(--mist)' }}>Archived weeks</div><div style={{ fontWeight: 800, fontSize: 20 }}>{weeks.filter((w) => w.status === 'archived').length}</div></div>
          <div><div style={{ fontSize: 12, color: 'var(--mist)' }}>Total archived payroll</div><div style={{ fontWeight: 800, fontSize: 20 }}>{money(archivedTotal)}</div></div>
        </div>
      </div>

      {weeks.length === 0 && <p style={{ color: 'var(--mist)' }}>No payroll weeks recorded yet.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {weeks.map((w) => {
          const c = components[w.id] || { base: null, bonuses: [], commissions: [] }
          return (
            <div key={w.id} className="section-card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontWeight: 700 }}>Week of {w.week_start} &ndash; {w.week_end}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {w.status === 'archived'
                    ? <span className="status-pill status-active">Archived {new Date(w.archived_at).toLocaleDateString()}</span>
                    : <span className="status-pill status-trial">Draft</span>}
                  <strong style={{ fontSize: 18 }}>{money(w.status === 'archived' ? w.total_due : null)}</strong>
                </div>
              </div>

              <div style={{ marginTop: 10, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {c.base && (
                  <div>
                    <strong>Base ({PAY_TYPE_LABELS[c.base.pay_type] || c.base.pay_type}):</strong>{' '}
                    {money(w.status === 'archived' ? c.base.amount_due : w.total_base_due)}
                  </div>
                )}
                {(c.bonuses || []).map((b) => (
                  <div key={b.id} style={{ color: 'var(--mist)' }}>
                    Bonus — {b.description || '(no description)'}: {b.bonuses_earned || 0} × {money(b.amount)} = {money(w.status === 'archived' ? b.amount_due : (Number(b.bonuses_earned || 0) * Number(b.amount || 0)))}
                  </div>
                ))}
                {(c.commissions || []).map((cm) => (
                  <div key={cm.id} style={{ color: 'var(--mist)' }}>
                    Commission — {cm.description || '(no description)'}: {money(cm.commissioned_sales)} × {cm.commission_pct || 0}% = {money(w.status === 'archived' ? cm.amount_due : (Number(cm.commissioned_sales || 0) * Number(cm.commission_pct || 0) / 100))}
                  </div>
                ))}
                {w.status === 'archived' && (
                  <div style={{ marginTop: 6, display: 'flex', gap: 16, fontWeight: 600 }}>
                    <span>Base {money(w.total_base_due)}</span>
                    <span>Bonus {money(w.total_bonus_due)}</span>
                    <span>Commission {money(w.total_commission_due)}</span>
                    <span>Total {money(w.total_due)}</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
