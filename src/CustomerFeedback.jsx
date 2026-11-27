import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import { viewingOrg } from './utils/viewingOrg'

// Customer Feedback — answers from the private link texted two days after a customer books an
// appointment or orders filters in the Customer Portal. Each entry names the customer who sent it.
// Org-scoped: RLS limits each company to its own rows, and every query filters by the company being
// viewed (super admins pick it with OrgPicker).
const WHAT = { appointment: 'Booked an appointment', filter_order: 'Ordered filters', filter_autoship: 'Set up filter auto-ship' }
const fmt = (t) => { const d = new Date(t); return isNaN(d) ? '' : d.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) }
const pretty = (p) => { const d = String(p || '').replace(/\D/g, '').slice(-10); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : (p || '') }

export default function CustomerFeedback({ profile }) {
  const isSuper = profile?.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [orgId, setOrgId] = useState(() => profile?.org_id || viewingOrg())
  const [rows, setRows] = useState([])
  const [stats, setStats] = useState({ waiting: 0, sent: 0 })
  const [tab, setTab] = useState('new')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSuper) return
    supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
      setOrgs(data || [])
      if (!orgId && data && data.length) setOrgId(data[0].id)
    })
  }, [])
  useEffect(() => { if (orgId) load(); else setLoading(false) }, [orgId])

  async function load() {
    setLoading(true)
    const [{ data }, { count: waiting }, { count: sent }] = await Promise.all([
      supabase.from('portal_feedback')
        .select('id, trigger_kind, rating, experience, suggestions, submitted_at, reviewed_at, sent_at, customer_id, customers ( id, display_name, primary_phone, email_1 )')
        .eq('org_id', orgId).not('submitted_at', 'is', null).order('submitted_at', { ascending: false }).limit(500),
      supabase.from('portal_feedback').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'pending'),
      supabase.from('portal_feedback').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'sent').is('submitted_at', null),
    ])
    setRows(data || [])
    setStats({ waiting: waiting || 0, sent: sent || 0 })
    setLoading(false)
  }

  async function setReviewed(r, on) {
    await supabase.from('portal_feedback').update({ reviewed_at: on ? new Date().toISOString() : null, reviewed_by: on ? (profile?.user_id || profile?.id || null) : null })
      .eq('id', r.id).eq('org_id', orgId)
    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, reviewed_at: on ? new Date().toISOString() : null } : x)))
  }

  const shown = rows.filter((r) => (tab === 'new' ? !r.reviewed_at : !!r.reviewed_at))
  const newCount = rows.filter((r) => !r.reviewed_at).length
  const rated = rows.filter((r) => r.rating)
  const avg = rated.length ? (rated.reduce((s, r) => s + r.rating, 0) / rated.length).toFixed(1) : null

  return (
    <div>
      <div className="page-title">Customer Feedback</div>
      {isSuper && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={orgId} onChange={setOrgId} />
        </div>
      )}
      <p style={{ color: 'var(--mist)', fontSize: 14, marginTop: 0 }}>
        Two days after a customer books an appointment or orders filters in the Customer Portal, they get a text with a private link asking how the app worked for them and what would make it better. Their answers show up here.
      </p>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 14, marginBottom: 14 }}>
        <span><b>{rows.length}</b> responses</span>
        {avg && <span>Average rating <b style={{ color: '#D97706' }}>{avg} ★</b></span>}
        <span><b>{stats.sent}</b> texted, no reply yet</span>
        <span><b>{stats.waiting}</b> scheduled to send</span>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
        {[['new', `New${newCount ? ` (${newCount})` : ''}`], ['reviewed', 'Reviewed']].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            style={{ background: 'none', border: 'none', borderBottom: tab === k ? '3px solid #215F9A' : '3px solid transparent', padding: '8px 14px', fontWeight: 700, color: tab === k ? '#215F9A' : 'var(--mist)', cursor: 'pointer', fontSize: 14 }}>{l}</button>
        ))}
      </div>

      {loading ? <p>Loading…</p> : !shown.length ? (
        <p style={{ color: 'var(--mist)' }}>{tab === 'new' ? 'No new feedback.' : 'Nothing reviewed yet.'}</p>
      ) : shown.map((r) => {
        const c = r.customers || {}
        return (
          <div key={r.id} className="section-card" style={{ padding: 16, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
              <div>
                <Link to={`/customers/${r.customer_id}`} style={{ fontWeight: 800, fontSize: 16 }}>{c.display_name || 'Customer'}</Link>
                <span style={{ color: 'var(--mist)', fontSize: 13.5, marginLeft: 10 }}>{[pretty(c.primary_phone), c.email_1].filter(Boolean).join(' · ')}</span>
              </div>
              <div style={{ color: 'var(--mist)', fontSize: 13 }}>{WHAT[r.trigger_kind] || ''} · {fmt(r.submitted_at)}</div>
            </div>
            <div style={{ fontSize: 20, color: '#F59E0B', margin: '6px 0 2px', letterSpacing: 2 }} aria-label={r.rating ? `${r.rating} of 5` : 'No rating'}>
              {r.rating ? '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating) : <span style={{ fontSize: 13, color: 'var(--mist)', letterSpacing: 0 }}>No rating</span>}
            </div>
            {r.experience && <div style={{ marginTop: 8 }}><div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: 'var(--mist)' }}>Experience</div><div style={{ whiteSpace: 'pre-wrap', fontSize: 14.5 }}>{r.experience}</div></div>}
            {r.suggestions && <div style={{ marginTop: 8 }}><div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: 'var(--mist)' }}>Suggestions</div><div style={{ whiteSpace: 'pre-wrap', fontSize: 14.5 }}>{r.suggestions}</div></div>}
            <div style={{ marginTop: 12 }}>
              <button type="button" className="btn" onClick={() => setReviewed(r, !r.reviewed_at)}>{r.reviewed_at ? 'Move back to New' : 'Mark reviewed'}</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
