// Rewards-HVAC · Time Off — PTO/sick/vacation policies, balances, accrual & usage.
import { useState, useEffect } from 'react'
import { listEmployees } from './hrData'
import { listPtoPolicies, addPtoPolicy, updatePtoPolicy, listPtoBalances, addPtoTransaction, listPtoTransactions, listPtoRequests, approvePtoRequest, denyPtoRequest } from './r4Data'
import { useOrgSelector, OrgBar } from './shared'

const METHOD_LABEL = { per_hour: 'Per hour worked', per_period: 'Per pay period', frontload: 'Front-loaded (annual)' }
const blankPolicy = { name: '', leave_type: 'pto', accrual_method: 'per_hour', accrual_rate: '', hours_cap: '', carryover_cap: '' }

export default function TimeOff({ profile }) {
  const org = useOrgSelector(profile)
  const [policies, setPolicies] = useState([])
  const [employees, setEmployees] = useState([])
  const [balances, setBalances] = useState({})
  const [empId, setEmpId] = useState('')
  const [txns, setTxns] = useState([])
  const [pform, setPform] = useState(blankPolicy)
  const [showPform, setShowPform] = useState(false)
  const [txForm, setTxForm] = useState({ policy_id: '', kind: 'accrual', hours: '', note: '' })
  const [requests, setRequests] = useState([])
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!org.selectedOrg) return
    const [pol, emps, bal, reqs] = await Promise.all([
      listPtoPolicies(org.selectedOrg), listEmployees(org.selectedOrg), listPtoBalances(org.selectedOrg),
      listPtoRequests(org.selectedOrg),
    ])
    setPolicies(pol); setEmployees(emps); setBalances(bal); setRequests(reqs)
    if (!empId && emps[0]) setEmpId(emps[0].id)
    if (!txForm.policy_id && pol[0]) setTxForm((f) => ({ ...f, policy_id: pol[0].id }))
  }

  async function decide(req, ok) {
    setSaving(true)
    if (ok) {
      const pol = policies.find((p) => p.id === req.policy_id)
      await approvePtoRequest(org.selectedOrg, req, profile.id, { cap: pol?.hours_cap ?? null })
    } else {
      await denyPtoRequest(req, profile.id, null)
    }
    setSaving(false); load()
  }
  useEffect(() => { load() }, [org.selectedOrg])
  useEffect(() => { if (empId && org.selectedOrg) listPtoTransactions(org.selectedOrg, empId).then(setTxns) }, [empId, org.selectedOrg])

  async function addPolicy(e) {
    e.preventDefault()
    if (!pform.name.trim()) return
    setSaving(true)
    await addPtoPolicy(org.selectedOrg, {
      name: pform.name.trim(), leave_type: pform.leave_type, accrual_method: pform.accrual_method,
      accrual_rate: parseFloat(pform.accrual_rate) || 0,
      hours_cap: pform.hours_cap ? parseFloat(pform.hours_cap) : null,
      carryover_cap: pform.carryover_cap ? parseFloat(pform.carryover_cap) : null,
    })
    setSaving(false); setPform(blankPolicy); setShowPform(false); load()
  }

  async function recordTxn(e) {
    e.preventDefault()
    if (!empId || !txForm.policy_id || !txForm.hours) return
    setSaving(true)
    const pol = policies.find((p) => p.id === txForm.policy_id)
    let hours = parseFloat(txForm.hours) || 0
    if (txForm.kind === 'usage') hours = -Math.abs(hours)
    await addPtoTransaction(org.selectedOrg, {
      employee_id: empId, policy_id: txForm.policy_id, kind: txForm.kind, hours, note: txForm.note,
      cap: pol?.hours_cap ?? null,
    })
    setSaving(false); setTxForm({ ...txForm, hours: '', note: '' })
    load(); listPtoTransactions(org.selectedOrg, empId).then(setTxns)
  }

  return (
    <div>
      <div className="page-header-bar">
        <h2>Time Off</h2>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => setShowPform(!showPform)}>{showPform ? 'Cancel' : '+ New Policy'}</button>
      </div>
      <OrgBar {...org} />

      {(() => {
        const empName = (id) => (employees.find((e) => e.id === id) || {}).full_name || 'Employee'
        const polName = (id) => (policies.find((p) => p.id === id) || {}).name || 'Time off'
        const pending = requests.filter((r) => r.status === 'pending')
        const approved = requests.filter((r) => r.status === 'approved')

        // Month calendar of who's off (approved requests overlapping each day).
        const y = calMonth.getFullYear(), m = calMonth.getMonth()
        const first = new Date(y, m, 1), startDow = first.getDay()
        const daysInMonth = new Date(y, m + 1, 0).getDate()
        const iso = (dt) => dt.toISOString().slice(0, 10)
        const offOn = (dt) => {
          const d = iso(dt)
          return approved.filter((r) => r.start_date <= d && r.end_date >= d)
        }
        const cells = []
        for (let i = 0; i < startDow; i++) cells.push(null)
        for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d))
        const monthLabel = calMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
        const todayIso = iso(new Date())

        return (
          <>
            {pending.length > 0 && (
              <div style={{ border: '1px solid #FDE68A', background: '#FFFBEB', borderRadius: 12, padding: 16, marginBottom: 22 }}>
                <h3 style={{ margin: '0 0 10px' }}>Pending requests <span className="badge" style={{ background: '#B0600A', color: '#fff' }}>{pending.length}</span></h3>
                <table className="data-table">
                  <thead><tr><th>Employee</th><th>Dates</th><th>Policy</th><th style={{ textAlign: 'right' }}>Hours</th><th>Note</th><th></th></tr></thead>
                  <tbody>
                    {pending.map((r) => (
                      <tr key={r.id}>
                        <td>{empName(r.employee_id)}</td>
                        <td>{r.start_date}{r.end_date !== r.start_date ? ` – ${r.end_date}` : ''}</td>
                        <td>{polName(r.policy_id)}</td>
                        <td style={{ textAlign: 'right' }}>{Number(r.hours || 0)}</td>
                        <td>{r.note || '—'}</td>
                        <td style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={saving} onClick={() => decide(r, true)}>Approve</button>
                          <button className="logout-button" disabled={saving} onClick={() => decide(r, false)}>Deny</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ color: 'var(--mist)', fontSize: 12, marginTop: 8 }}>Approving posts the hours as usage against the employee's balance automatically.</p>
              </div>
            )}

            <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <h3 style={{ margin: 0 }}>Who's out</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button className="logout-button" onClick={() => setCalMonth(new Date(y, m - 1, 1))}>‹</button>
                  <span style={{ fontWeight: 700, minWidth: 150, textAlign: 'center' }}>{monthLabel}</span>
                  <button className="logout-button" onClick={() => setCalMonth(new Date(y, m + 1, 1))}>›</button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} style={{ fontSize: 11, fontWeight: 700, color: 'var(--mist)', textAlign: 'center', padding: '2px 0' }}>{d}</div>
                ))}
                {cells.map((dt, i) => {
                  if (!dt) return <div key={`e${i}`} />
                  const off = offOn(dt)
                  const isToday = iso(dt) === todayIso
                  return (
                    <div key={i} style={{ minHeight: 62, border: '1px solid var(--border)', borderRadius: 8, padding: 4, background: isToday ? '#EEF4FF' : '#fff' }}>
                      <div style={{ fontSize: 11, color: 'var(--mist)', fontWeight: isToday ? 800 : 400 }}>{dt.getDate()}</div>
                      {off.slice(0, 3).map((r) => (
                        <div key={r.id} title={empName(r.employee_id)} style={{ fontSize: 10.5, background: '#1B3A6B', color: '#fff', borderRadius: 4, padding: '1px 4px', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {empName(r.employee_id).split(' ')[0]}
                        </div>
                      ))}
                      {off.length > 3 && <div style={{ fontSize: 10, color: 'var(--mist)', marginTop: 2 }}>+{off.length - 3} more</div>}
                    </div>
                  )
                })}
              </div>
              {approved.length === 0 && <p style={{ color: 'var(--mist)', fontSize: 12, marginTop: 10 }}>Approved time off appears here. Employees request time off from their My Pay &amp; Benefits portal.</p>}
            </div>
          </>
        )
      })()}

      {showPform && (
        <form className="inline-form" onSubmit={addPolicy} style={{ marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div className="field"><label>Name</label><input value={pform.name} onChange={(e) => setPform({ ...pform, name: e.target.value })} placeholder="Standard PTO" required /></div>
          <div className="field"><label>Type</label>
            <select value={pform.leave_type} onChange={(e) => setPform({ ...pform, leave_type: e.target.value })}>
              <option value="pto">PTO</option><option value="sick">Sick</option><option value="vacation">Vacation</option></select></div>
          <div className="field"><label>Accrual method</label>
            <select value={pform.accrual_method} onChange={(e) => setPform({ ...pform, accrual_method: e.target.value })}>
              {Object.keys(METHOD_LABEL).map((k) => <option key={k} value={k}>{METHOD_LABEL[k]}</option>)}</select></div>
          <div className="field"><label>Rate (hrs)</label><input type="number" step="0.001" value={pform.accrual_rate} onChange={(e) => setPform({ ...pform, accrual_rate: e.target.value })} placeholder="e.g. 0.0385" /></div>
          <div className="field"><label>Balance cap</label><input type="number" value={pform.hours_cap} onChange={(e) => setPform({ ...pform, hours_cap: e.target.value })} /></div>
          <div className="field"><label>Carryover cap</label><input type="number" value={pform.carryover_cap} onChange={(e) => setPform({ ...pform, carryover_cap: e.target.value })} /></div>
          <button className="auth-button" type="submit" style={{ width: 'auto' }} disabled={saving}>Add policy</button>
        </form>
      )}

      <h3>Policies</h3>
      <table className="data-table" style={{ marginBottom: 24 }}>
        <thead><tr><th>Name</th><th>Type</th><th>Accrual</th><th>Rate</th><th>Cap</th><th></th></tr></thead>
        <tbody>
          {policies.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td><td style={{ textTransform: 'capitalize' }}>{p.leave_type}</td>
              <td>{METHOD_LABEL[p.accrual_method]}</td><td>{p.accrual_rate}</td><td>{p.hours_cap || '—'}</td>
              <td><button className="logout-button" onClick={() => updatePtoPolicy(p.id, { active: !p.active }).then(load)}>Archive</button></td>
            </tr>
          ))}
          {policies.length === 0 && <tr><td colSpan="6" style={{ color: 'var(--mist)' }}>No policies yet. Add one (e.g. 0.0385 hrs per hour worked ≈ 80 hrs/yr full-time).</td></tr>}
        </tbody>
      </table>

      <h3>Employee balances</h3>
      <div className="field" style={{ maxWidth: 340, margin: '8px 0 14px' }}>
        <label>Employee</label>
        <select value={empId} onChange={(e) => setEmpId(e.target.value)}>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
        {policies.map((p) => {
          const b = balances[empId + ':' + p.id]
          return (
            <div key={p.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '12px 18px', minWidth: 150 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--route-blue, #1B3A6B)' }}>{Number(b?.balance_hours || 0).toFixed(1)} <span style={{ fontSize: 13, color: 'var(--mist)' }}>hrs</span></div>
              <div style={{ fontSize: 13, color: 'var(--mist)' }}>{p.name}</div>
            </div>
          )
        })}
      </div>

      {policies.length > 0 && (
        <form className="inline-form" onSubmit={recordTxn} style={{ marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
          <div className="field"><label>Policy</label>
            <select value={txForm.policy_id} onChange={(e) => setTxForm({ ...txForm, policy_id: e.target.value })}>
              {policies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div className="field"><label>Action</label>
            <select value={txForm.kind} onChange={(e) => setTxForm({ ...txForm, kind: e.target.value })}>
              <option value="accrual">Accrual (+)</option><option value="usage">Usage (−)</option><option value="adjustment">Adjustment</option></select></div>
          <div className="field"><label>Hours</label><input type="number" step="0.25" value={txForm.hours} onChange={(e) => setTxForm({ ...txForm, hours: e.target.value })} required /></div>
          <div className="field" style={{ minWidth: 200 }}><label>Note</label><input value={txForm.note} onChange={(e) => setTxForm({ ...txForm, note: e.target.value })} /></div>
          <button className="auth-button" type="submit" style={{ width: 'auto' }} disabled={saving}>Record</button>
        </form>
      )}

      {txns.length > 0 && (
        <table className="data-table">
          <thead><tr><th>Date</th><th>Policy</th><th>Action</th><th>Hours</th><th>Note</th></tr></thead>
          <tbody>
            {txns.map((t) => (
              <tr key={t.id}>
                <td>{t.txn_date}</td>
                <td>{(policies.find((p) => p.id === t.policy_id) || {}).name || '—'}</td>
                <td style={{ textTransform: 'capitalize' }}>{t.kind}</td>
                <td style={{ color: t.hours < 0 ? '#DC2626' : '#166534' }}>{t.hours > 0 ? '+' : ''}{t.hours}</td>
                <td>{t.note || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
