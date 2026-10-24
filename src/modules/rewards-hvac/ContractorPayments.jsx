// Rewards-HVAC · 1099 Payments — log each payment to a 1099 contractor as it's made.
// Contractors are kept out of payroll (no tax withholding); Year-End builds each 1099-NEC
// from these payments. A contractor can be one of your people marked 1099 on their HR
// record, or any outside payee (a sub you hire for a job).
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import { useOrgSelector, OrgBar } from './shared'

const money = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const today = () => new Date().toISOString().slice(0, 10)
const BLANK = { employee_id: '', payee_name: '', tin_last4: '', paid_on: today(), amount: '', method: 'Check', memo: '' }

export default function ContractorPayments({ profile }) {
  const org = useOrgSelector(profile)
  const [year, setYear] = useState(new Date().getFullYear())
  const [rows, setRows] = useState([])
  const [contractors, setContractors] = useState([])
  const [form, setForm] = useState(BLANK)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    if (!org.selectedOrg) return
    const [{ data: log }, { data: emps }] = await Promise.all([
      supabase.from('rewards_1099_payment_log').select('*').eq('org_id', org.selectedOrg).gte('paid_on', `${year}-01-01`).lte('paid_on', `${year}-12-31`).order('paid_on', { ascending: false }),
      supabase.from('employees').select('id, full_name, is_active').eq('org_id', org.selectedOrg).order('full_name'),
    ])
    const ids = (emps || []).map((e) => e.id)
    const { data: hr } = ids.length ? await supabase.from('rewards_employee_hr').select('employee_id, worker_type, ssn_last4').in('employee_id', ids) : { data: [] }
    const c = (hr || []).filter((h) => h.worker_type === '1099').map((h) => ({ ...(emps || []).find((e) => e.id === h.employee_id), tin_last4: h.ssn_last4 || '' })).filter((x) => x.id)
    setRows(log || []); setContractors(c)
  }
  useEffect(() => { load() }, [org.selectedOrg, year])

  const totals = useMemo(() => {
    const m = new Map()
    for (const r of rows) {
      const k = (r.employee_id || '') + '|' + r.payee_name.toLowerCase()
      const t = m.get(k) || { payee: r.payee_name, tin: r.tin_last4, total: 0, count: 0 }
      t.total += Number(r.amount); t.count++; if (r.tin_last4) t.tin = r.tin_last4
      m.set(k, t)
    }
    return [...m.values()].sort((a, b) => b.total - a.total)
  }, [rows])

  function pickContractor(id) {
    const c = contractors.find((x) => x.id === id)
    setForm((f) => ({ ...f, employee_id: id, payee_name: c ? c.full_name : f.payee_name, tin_last4: c ? (c.tin_last4 || f.tin_last4) : f.tin_last4 }))
  }
  async function add(e) {
    e.preventDefault(); setErr('')
    const amount = Number(form.amount)
    if (!form.payee_name.trim()) { setErr('Who was paid?'); return }
    if (!(amount > 0)) { setErr('Enter the amount paid.'); return }
    if (form.tin_last4 && !/^\d{4}$/.test(form.tin_last4)) { setErr('TIN: last 4 digits only.'); return }
    setBusy(true)
    const { error } = await supabase.from('rewards_1099_payment_log').insert({
      org_id: org.selectedOrg, employee_id: form.employee_id || null, payee_name: form.payee_name.trim(), tin_last4: form.tin_last4 || null,
      paid_on: form.paid_on || today(), amount, method: form.method || null, memo: form.memo.trim() || null,
    })
    setBusy(false)
    if (error) { setErr(error.message); return }
    setForm({ ...BLANK, paid_on: form.paid_on }); load()
  }
  async function remove(r) {
    if (!window.confirm(`Delete the ${money(r.amount)} payment to ${r.payee_name}?`)) return
    await supabase.from('rewards_1099_payment_log').delete().eq('id', r.id); load()
  }

  const inp = { padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8 }
  return (
    <div>
      <div className="page-header-bar">
        <h2>1099 Payments</h2>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={inp}>
          {[0, 1, 2, 3].map((d) => { const y = new Date().getFullYear() - d; return <option key={y} value={y}>{y}</option> })}
        </select>
      </div>
      <OrgBar {...org} />
      <p style={{ color: 'var(--mist)', fontSize: 13.5, marginTop: -6, maxWidth: 820 }}>
        Record each payment to a 1099 contractor when you make it. Contractors never go through payroll and nothing is withheld. At year-end, <Link to="/rewards/payroll/year-end">Year-End Forms</Link> builds each 1099-NEC from these payments (required at $600 or more). Mark one of your people as a 1099 worker on their HR record to pick them here; outside subs can be typed in.
      </p>

      <form onSubmit={add} className="section-card" style={{ padding: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
        {contractors.length > 0 && (
          <div className="field" style={{ marginBottom: 0 }}><label>Contractor</label>
            <select value={form.employee_id} onChange={(e) => pickContractor(e.target.value)} style={inp}>
              <option value="">— outside payee —</option>
              {contractors.map((c) => <option key={c.id} value={c.id}>{c.full_name}{c.is_active ? '' : ' (inactive)'}</option>)}
            </select>
          </div>
        )}
        <div className="field" style={{ marginBottom: 0 }}><label>Paid to</label><input value={form.payee_name} onChange={(e) => setForm({ ...form, payee_name: e.target.value, employee_id: '' })} style={{ ...inp, width: 200 }} placeholder="Name or business" /></div>
        <div className="field" style={{ marginBottom: 0 }}><label>TIN last 4</label><input value={form.tin_last4} maxLength={4} onChange={(e) => setForm({ ...form, tin_last4: e.target.value.replace(/\D/g, '') })} style={{ ...inp, width: 80 }} /></div>
        <div className="field" style={{ marginBottom: 0 }}><label>Date paid</label><input type="date" value={form.paid_on} onChange={(e) => setForm({ ...form, paid_on: e.target.value })} style={inp} /></div>
        <div className="field" style={{ marginBottom: 0 }}><label>Amount</label><input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} style={{ ...inp, width: 110 }} /></div>
        <div className="field" style={{ marginBottom: 0 }}><label>Method</label>
          <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} style={inp}>{['Check', 'ACH / bank transfer', 'Cash', 'Card', 'Zelle / app', 'Other'].map((m) => <option key={m}>{m}</option>)}</select>
        </div>
        <div className="field" style={{ marginBottom: 0, flex: '1 1 180px' }}><label>Memo</label><input value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} style={{ ...inp, width: '100%' }} placeholder="Job, check #, what for" /></div>
        <button className="auth-button" type="submit" disabled={busy} style={{ width: 'auto', margin: 0 }}>{busy ? 'Saving…' : 'Log payment'}</button>
        {err && <div className="auth-error" style={{ width: '100%' }}>{err}</div>}
      </form>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) 2fr', gap: 16, alignItems: 'start' }}>
        <div className="section-card" style={{ padding: 14 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>{year} totals</div>
          {!totals.length ? <div style={{ fontSize: 13, color: 'var(--mist)' }}>No payments logged for {year}.</div> : totals.map((t, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '5px 0', borderBottom: '1px solid #EEF1F6', fontSize: 13.5 }}>
              <span>{t.payee}{t.tin ? <span style={{ color: 'var(--mist)' }}> · ••{t.tin}</span> : ''}<br /><span style={{ fontSize: 12, color: t.total >= 600 ? '#B0600A' : 'var(--mist)' }}>{t.total >= 600 ? '1099-NEC required' : 'Under $600 — no 1099 needed yet'} · {t.count} payment{t.count === 1 ? '' : 's'}</span></span>
              <b>{money(t.total)}</b>
            </div>
          ))}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr><th>Date</th><th>Paid to</th><th>Method</th><th>Memo</th><th style={{ textAlign: 'right' }}>Amount</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}><td>{r.paid_on}</td><td>{r.payee_name}</td><td>{r.method || '—'}</td><td>{r.memo || ''}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{money(r.amount)}</td>
                  <td><button className="logout-button" style={{ padding: '2px 8px' }} onClick={() => remove(r)}>✕</button></td></tr>
              ))}
              {!rows.length && <tr><td colSpan="6" style={{ color: 'var(--mist)' }}>No payments logged for {year}.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
