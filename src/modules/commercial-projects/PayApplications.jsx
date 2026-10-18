import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import OrgPicker from '../../OrgPicker'
import { money, fmtDate, useOrg, AIA_FORMAT_NOTE } from './data'

// Commercial Projects · every pay application across every project (the office's billing list).
export default function PayApplications({ profile }) {
  const navigate = useNavigate()
  const { isSuper, orgs, orgId, setOrgId } = useOrg(profile)
  const [rows, setRows] = useState([])
  const [inv, setInv] = useState({})
  const [filter, setFilter] = useState('open')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!orgId) { setRows([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase.from('cp_pay_apps').select('*, cp_projects(name, project_number)').eq('org_id', orgId).order('created_at', { ascending: false })
    const ids = (data || []).map((a) => a.invoice_id).filter(Boolean)
    let m = {}
    if (ids.length) {
      const { data: iv } = await supabase.from('invoices').select('id, invoice_number, paid_at, total_paid, amount_due').in('id', ids)
      m = Object.fromEntries((iv || []).map((i) => [i.id, i]))
    }
    setRows(data || []); setInv(m); setLoading(false)
  }, [orgId])
  useEffect(() => { load() }, [load])

  const state = (a) => (a.status === 'draft' ? 'draft' : a.invoice_id && inv[a.invoice_id] && !inv[a.invoice_id].paid_at ? 'unpaid' : 'done')
  const shown = rows.filter((a) => filter === 'all' || (filter === 'open' ? state(a) !== 'done' : state(a) === filter))
  const unpaidTotal = rows.filter((a) => state(a) === 'unpaid').reduce((s, a) => s + Number(a.current_payment_due || 0), 0)

  return (
    <div>
      <h2 className="page-title">Pay Applications</h2>
      <p style={{ margin: '0 0 12px', fontSize: 14 }}><span className="badge" style={{ marginRight: 8 }}>AIA G702 / G703 format</span>{AIA_FORMAT_NOTE}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {isSuper && <OrgPicker orgs={orgs} value={orgId} onChange={setOrgId} />}
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8 }}>
          <option value="open">Needs action (drafts + unpaid)</option>
          <option value="draft">Drafts</option>
          <option value="unpaid">Submitted, unpaid</option>
          <option value="done">Paid or nothing due</option>
          <option value="all">All</option>
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 14 }}>Awaiting payment: <strong>{money(unpaidTotal)}</strong></span>
      </div>
      {loading ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : shown.length === 0 ? (
        <p style={{ color: 'var(--mist)' }}>Nothing here. Pay applications are started from a project's workspace.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: 900 }}>
            <thead><tr><th>Project</th><th>App #</th><th>Period to</th><th>Status</th><th style={{ textAlign: 'right' }}>Payment due</th><th>Invoice</th></tr></thead>
            <tbody>
              {shown.map((a) => {
                const i = a.invoice_id ? inv[a.invoice_id] : null
                const st = state(a)
                return (
                  <tr key={a.id} onClick={() => navigate(`/commercial/pay-apps/${a.id}`)} style={{ cursor: 'pointer' }}>
                    <td>{a.cp_projects?.name} <span style={{ color: 'var(--mist)', fontSize: 12 }}>{a.cp_projects?.project_number}</span></td>
                    <td>#{a.app_number}</td>
                    <td>{fmtDate(a.period_to)}</td>
                    <td>{st === 'draft' ? <span className="badge">Draft</span> : st === 'unpaid' ? <span style={{ color: '#9a6a12', fontWeight: 600 }}>Submitted, unpaid</span> : <span style={{ color: '#1F7A43', fontWeight: 600 }}>{i ? 'Paid' : 'Nothing due'}</span>}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{a.status === 'draft' ? '—' : money(a.current_payment_due)}</td>
                    <td>{i ? i.invoice_number : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
