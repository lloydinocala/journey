import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import OrgPicker from '../../OrgPicker'
import { money, fmtDate, useOrg, CO_STATUS } from './data'

// Commercial Projects · every change order across every project.
export default function ChangeOrders({ profile }) {
  const navigate = useNavigate()
  const { isSuper, orgs, orgId, setOrgId } = useOrg(profile)
  const [rows, setRows] = useState([])
  const [filter, setFilter] = useState('pending')
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    if (!orgId) { setRows([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase.from('cp_change_orders').select('*, cp_projects(name, project_number)').eq('org_id', orgId).order('created_at', { ascending: false })
    setRows(data || []); setLoading(false)
  }, [orgId])
  useEffect(() => { load() }, [load])
  const shown = rows.filter((c) => filter === 'all' || (filter === 'pending' ? (c.status === 'draft' || c.status === 'sent') : c.status === filter))
  const exposure = rows.filter((c) => c.status === 'draft' || c.status === 'sent').reduce((a, c) => a + Number(c.amount || 0), 0)
  const now = Date.now()
  return (
    <div>
      <h2 className="page-title">Change Orders</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {isSuper && <OrgPicker orgs={orgs} value={orgId} onChange={setOrgId} />}
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8 }}>
          <option value="pending">Pending (draft + sent)</option><option value="approved">Approved</option>
          <option value="rejected">Rejected</option><option value="all">All</option>
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 14 }}>Pending exposure: <strong>{money(exposure)}</strong></span>
      </div>
      {loading ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : shown.length === 0 ? <p style={{ color: 'var(--mist)' }}>Nothing here. Change orders are written from a project's Change Orders tab.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: 900 }}>
            <thead><tr><th>Project</th><th>CO #</th><th>Title</th><th>Status</th><th style={{ textAlign: 'right' }}>Amount</th><th>Waiting</th></tr></thead>
            <tbody>{shown.map((c) => {
              const days = c.status === 'sent' && c.sent_date ? Math.floor((now - Date.parse(c.sent_date)) / 864e5) : null
              return (
                <tr key={c.id} onClick={() => navigate(`/commercial/change-orders/${c.id}`)} style={{ cursor: 'pointer' }}>
                  <td>{c.cp_projects?.name} <span style={{ color: 'var(--mist)', fontSize: 12 }}>{c.cp_projects?.project_number}</span></td>
                  <td>#{c.co_number}</td><td>{c.title}</td><td>{CO_STATUS[c.status]}{c.status === 'approved' ? ' ' + fmtDate(c.approved_date) : ''}</td>
                  <td style={{ textAlign: 'right' }}>{money(c.amount)}</td>
                  <td style={{ color: days > 14 ? '#B00020' : 'inherit' }}>{days != null ? `${days} day${days === 1 ? '' : 's'} since sent` : '—'}</td>
                </tr>
              )
            })}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}
