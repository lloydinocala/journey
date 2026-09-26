// Special Orders — ETA watch. Self-contained and deterministic: learns each
// vendor's real average lead time from this board's own history (received_at −
// ordered_at), predicts when open orders will arrive, and flags anything running
// late or at risk of missing the customer's needed-by date. So the office can
// answer "where's my part?" without calling the vendor. Every date is derived
// from real timestamps; where a vendor has no history yet it says so.
import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabase'

const fmt = (d) => (d ? new Date(d).toLocaleDateString() : '—')
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000)
const DEFAULT_LEAD = 7

export default function SpecialOrderEta({ orgId }) {
  const [rows, setRows] = useState(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!orgId || !open || rows != null) return
    let alive = true
    ;(async () => {
      const { data } = await supabase.from('elements_special_orders')
        .select('id, description, vendor_id, vendor_name, status, ordered_at, received_at, needed_by, job_ref, customer_name')
        .eq('org_id', orgId)
      if (!alive) return
      setRows(data || [])
    })()
    return () => { alive = false }
  }, [orgId, open, rows])

  const all = rows || []
  // Learn per-vendor average lead time from completed orders.
  const leadByVendor = {}
  const overallLeads = []
  all.forEach((o) => {
    if (o.ordered_at && o.received_at) {
      const d = daysBetween(o.ordered_at, o.received_at)
      if (d >= 0 && d < 365) { (leadByVendor[o.vendor_id || o.vendor_name] ||= []).push(d); overallLeads.push(d) }
    }
  })
  const avg = (arr) => (arr && arr.length ? Math.round(arr.reduce((s, d) => s + d, 0) / arr.length) : null)
  const overallAvg = avg(overallLeads)

  const now = new Date()
  const open_orders = all.filter((o) => o.status === 'ordered' || o.status === 'requested')
    .map((o) => {
      const vlead = avg(leadByVendor[o.vendor_id || o.vendor_name])
      const lead = vlead ?? overallAvg ?? DEFAULT_LEAD
      const leadSource = vlead != null ? `${o.vendor_name || 'vendor'} avg` : overallAvg != null ? 'shop avg' : 'default 7d'
      const eta = o.status === 'ordered' && o.ordered_at ? addDays(o.ordered_at, lead) : null
      const overdue = eta && eta < now
      const atRisk = eta && o.needed_by && eta > new Date(o.needed_by)
      return { ...o, lead, leadSource, eta, overdue, atRisk }
    })
    .sort((a, b) => (b.overdue - a.overdue) || (b.atRisk - a.atRisk) || ((a.eta || 0) - (b.eta || 0)))

  const flagged = open_orders.filter((o) => o.overdue || o.atRisk).length

  return (
    <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: 12, margin: '8px 0 16px', background: '#FBFCFE' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => setOpen((o) => !o)}
          style={{ border: '1px solid #1B3A6B', background: '#fff', color: '#1B3A6B', fontWeight: 600, fontSize: 13, borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
          {open ? 'Hide ETA watch' : '⏱️ ETA watch'}
        </button>
        {open && rows != null && <span style={{ fontSize: 12.5, color: 'var(--mist)', marginLeft: 'auto' }}>{open_orders.length} open · {flagged} late or at-risk</span>}
      </div>

      {open && (
        rows == null ? <p style={{ color: 'var(--mist)', fontSize: 13, margin: '10px 2px 2px' }}>Predicting from order history…</p> : open_orders.length === 0 ? (
          <p style={{ color: 'var(--mist)', fontSize: 13, margin: '10px 2px 2px' }}>No open special orders to predict.</p>
        ) : (
          <div style={{ marginTop: 10 }}>
            <table className="data-table" style={{ fontSize: 13 }}>
              <thead><tr><th>Part</th><th>Vendor</th><th>Predicted ETA</th><th>Needed by</th><th>Status</th></tr></thead>
              <tbody>
                {open_orders.slice(0, 60).map((o) => (
                  <tr key={o.id}>
                    <td><span style={{ fontWeight: 600 }}>{o.description || 'Part'}</span>{o.job_ref ? <span style={{ color: 'var(--mist)' }}> · {o.job_ref}</span> : ''}{o.customer_name ? <span style={{ color: 'var(--mist)' }}> · {o.customer_name}</span> : ''}</td>
                    <td style={{ color: 'var(--mist)' }}>{o.vendor_name || '—'}</td>
                    <td>{o.eta ? fmt(o.eta) : <span style={{ color: 'var(--mist)' }}>not ordered yet</span>}{o.eta ? <span style={{ fontSize: 11, color: 'var(--mist)' }}> ({o.leadSource})</span> : ''}</td>
                    <td>{fmt(o.needed_by)}</td>
                    <td>
                      {o.overdue ? <span className="badge" style={{ background: '#FBE7E7', color: '#B00020' }}>Late</span>
                        : o.atRisk ? <span className="badge" style={{ background: '#F8EEDD', color: '#B0600A' }}>At risk</span>
                          : o.status === 'requested' ? <span className="badge" style={{ background: '#EEF1F6', color: '#475569' }}>Not ordered</span>
                            : <span className="badge" style={{ background: '#E3F1E8', color: '#166534' }}>On track</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {open_orders.length > 60 && <div style={{ fontSize: 12, color: 'var(--mist)', marginTop: 4 }}>Showing 60 of {open_orders.length}.</div>}
          </div>
        )
      )}
    </div>
  )
}
