import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import { listPaymentsToConfirm, confirmPaymentMethod, setFinancingStatus, markInvoicePaid, methodLabel } from './utils/payments'

const money = (n) => (n == null || isNaN(n) ? '—' : `$${Number(n).toFixed(2)}`)
const fmt = (d) => (d ? new Date(d).toLocaleDateString() : '')

export default function PaymentsToConfirm({ profile }) {
  const isSuper = profile?.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile?.org_id || '')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    if (isSuper) supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
      setOrgs(data || []); if (!selectedOrg && data?.length) setSelectedOrg(data[0].id)
    })
  }, [])

  async function load() {
    if (!selectedOrg) return
    setLoading(true); setErr('')
    try { setRows(await listPaymentsToConfirm(selectedOrg)) } catch (e) { setErr(e.message || String(e)) }
    setLoading(false)
  }
  useEffect(() => { load() }, [selectedOrg])

  async function act(fn, okMsg) {
    setErr(''); setMsg('')
    const { error } = await fn()
    if (error) { setErr(error.message); return }
    setMsg(okMsg); await load()
  }
  const confirm = (r) => act(() => confirmPaymentMethod(selectedOrg, r.id), 'Method confirmed — install can be scheduled.')
  const approve = (r) => act(() => setFinancingStatus(selectedOrg, r.id, 'approved'), 'Financing approved — install can be scheduled.')
  const deny = (r) => act(() => setFinancingStatus(selectedOrg, r.id, 'denied'), 'Marked financing denied.')
  async function paid(r) {
    if (!window.confirm(`Mark invoice ${r.invoice_number || ''} PAID for ${money(r.balance ?? r.amount_due)} (${methodLabel(r.payment_method)})?`)) return
    setBusy(r.id)
    const { error } = await markInvoicePaid(selectedOrg, r, profile?.id)
    setBusy('')
    if (error) { setErr(error.message); return }
    setMsg(`Invoice ${r.invoice_number || ''} marked paid.`); await load()
  }

  const stateBadge = (r) => {
    if (r.payment_method === 'financing') {
      const s = r.financing_status || 'applied'
      const map = { applied: ['#F8EEDD', '#B0600A', 'Financing — applied'], approved: ['#E3F1E8', '#166534', 'Financing — approved'], denied: ['#FBE7E7', '#B00020', 'Financing — denied'], funded: ['#E3F1E8', '#166534', 'Financing — funded'] }
      const [bg, c, t] = map[s] || map.applied
      return <span className="badge" style={{ background: bg, color: c }}>{t}</span>
    }
    return r.payment_confirmed_at
      ? <span className="badge" style={{ background: '#E3F1E8', color: '#166534' }}>Confirmed</span>
      : <span className="badge" style={{ background: '#EEF1F6', color: '#475569' }}>Selected</span>
  }

  return (
    <div className="page">
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0 }}>Payments to Confirm</h2>
          <span className="badge">{rows.length}</span>
        </div>
        {isSuper && <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />}
      </div>
      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0, maxWidth: 780 }}>
        Invoices where the customer picked how they'll pay but the money isn't in yet. Confirm the method (or approve financing) to clear the way for scheduling, and mark the invoice paid once it's collected.
      </p>

      {msg && <div style={{ marginBottom: 12, background: '#E3F1E8', border: '1px solid #166534', color: '#166534', padding: '8px 12px', borderRadius: 8, fontWeight: 600, fontSize: 13 }}>{msg}</div>}
      {err && <div className="auth-error" style={{ marginBottom: 12 }}>{err}</div>}

      {loading ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : rows.length === 0 ? (
        <p style={{ color: 'var(--mist)' }}>Nothing waiting — every chosen-method invoice is confirmed and paid.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr><th>Invoice</th><th>Customer</th><th>Method</th><th style={{ textAlign: 'right' }}>Balance</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.job_id ? <Link to={`/invoice/${r.job_id}`}>{r.invoice_number || '(no #)'}</Link> : (r.invoice_number || '(no #)')}<div style={{ fontSize: 11, color: 'var(--mist)' }}>chose {fmt(r.payment_method_at)}</div></td>
                <td>{r.customer_name || '—'}</td>
                <td>{methodLabel(r.payment_method)}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{money(r.balance ?? r.amount_due)}</td>
                <td>{stateBadge(r)}</td>
                <td style={{ whiteSpace: 'nowrap', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {r.payment_method === 'financing' && (r.financing_status || 'applied') === 'applied' && (
                    <>
                      <button className="auth-button" style={{ width: 'auto', margin: 0, padding: '5px 12px' }} onClick={() => approve(r)}>Approve financing</button>
                      <button className="logout-button" onClick={() => deny(r)}>Deny</button>
                    </>
                  )}
                  {r.payment_method !== 'financing' && !r.payment_confirmed_at && (
                    <button className="auth-button" style={{ width: 'auto', margin: 0, padding: '5px 12px' }} onClick={() => confirm(r)}>Confirm method</button>
                  )}
                  <button className="logout-button" disabled={busy === r.id} onClick={() => paid(r)}>{busy === r.id ? 'Saving…' : 'Mark PAID'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
