import { useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import { money, num, fmtDate, CO_STATUS, nextCoNumber, approvedCoTotal, pendingCoTotal } from './data'

// Project workspace · Change Orders tab.
export default function ChangeOrdersTab({ project, changeOrders, profile }) {
  const navigate = useNavigate()
  async function create() {
    const co_number = await nextCoNumber(project.id)
    const { data, error } = await supabase.from('cp_change_orders').insert({
      org_id: project.org_id, project_id: project.id, co_number, title: `Change order #${co_number}`, created_by: profile?.id || null,
    }).select('id').maybeSingle()
    if (error) { alert(error.message); return }
    navigate(`/commercial/change-orders/${data.id}`)
  }
  const approved = approvedCoTotal(changeOrders), pending = pendingCoTotal(changeOrders)
  const color = { draft: 'var(--mist)', sent: '#9a6a12', approved: '#1F7A43', rejected: '#B00020', void: 'var(--mist)' }
  return (
    <div>
      <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12, fontSize: 14 }}>
        <span>Original contract <strong>{money(project.original_contract)}</strong></span>
        <span>Approved changes <strong>{money(approved)}</strong></span>
        <span>Contract sum to date <strong>{money(num(project.original_contract) + approved)}</strong></span>
        <span style={{ color: pending ? '#9a6a12' : 'var(--mist)' }}>Pending (not yet approved) <strong>{money(pending)}</strong></span>
        <button className="auth-button" style={{ width: 'auto', padding: '8px 16px', marginLeft: 'auto' }} onClick={create}>+ New change order</button>
      </div>
      {changeOrders.length === 0 ? (
        <div style={{ background: 'var(--panel)', border: '1px dashed var(--line-strong)', borderRadius: 10, padding: 24, color: 'var(--mist)' }}>
          No change orders. When the scope changes, write one here, price it, and record the approval. Nothing bills until it is approved.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: 820 }}>
            <thead><tr><th>CO #</th><th>Title</th><th>Reason</th><th>Status</th><th style={{ textAlign: 'right' }}>Amount</th><th style={{ textAlign: 'right' }}>Days</th></tr></thead>
            <tbody>{changeOrders.map((c) => (
              <tr key={c.id} onClick={() => navigate(`/commercial/change-orders/${c.id}`)} style={{ cursor: 'pointer' }}>
                <td style={{ fontWeight: 600 }}>#{c.co_number}</td><td>{c.title}</td><td>{c.reason || '—'}</td>
                <td style={{ color: color[c.status], fontWeight: 600 }}>{CO_STATUS[c.status]}{c.status === 'approved' ? ' ' + fmtDate(c.approved_date) : ''}</td>
                <td style={{ textAlign: 'right' }}>{money(c.amount)}</td><td style={{ textAlign: 'right' }}>{c.days_added || 0}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}
