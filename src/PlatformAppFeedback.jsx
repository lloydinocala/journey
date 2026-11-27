import { useEffect, useState } from 'react'
import { supabase } from './utils/supabase'

// App Feedback (Journey Platform, super admin only) — every subscriber's Customer Portal feedback in one
// place, for improving the app. De-identified on purpose: it shows the subscriber company, what the customer
// did in the app, the rating and the comments, never the customer's name, phone or email (those stay with the
// subscriber, whose customer it is). Read through the platform_app_feedback() function, which only super
// admins can call.
const WHAT = { appointment: 'Booked an appointment', filter_order: 'Ordered filters', filter_autoship: 'Set up filter auto-ship' }
const fmt = (t) => { const d = new Date(t); return isNaN(d) ? '' : d.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) }

export default function PlatformAppFeedback({ profile }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState('new')
  const [company, setCompany] = useState('')
  const [onlySuggestions, setOnlySuggestions] = useState(false)

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const { data, error } = await supabase.rpc('platform_app_feedback')
    if (error) setErr(error.message); else setRows(data || [])
    setLoading(false)
  }
  async function setReviewed(r, on) {
    await supabase.rpc('platform_app_feedback_review', { p_id: r.id, p_reviewed: on })
    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, platform_reviewed_at: on ? new Date().toISOString() : null } : x)))
  }

  if (profile?.role !== 'super_admin') return <div><div className="page-title">App Feedback</div><p>This page is for Journey Platform only.</p></div>

  const companies = [...new Set(rows.map((r) => r.org_name))].sort()
  const base = rows.filter((r) => (!company || r.org_name === company) && (!onlySuggestions || (r.suggestions || '').trim()))
  const shown = base.filter((r) => (tab === 'new' ? !r.platform_reviewed_at : !!r.platform_reviewed_at))
  const newCount = base.filter((r) => !r.platform_reviewed_at).length
  const rated = base.filter((r) => r.rating)
  const avg = rated.length ? (rated.reduce((s, r) => s + r.rating, 0) / rated.length).toFixed(1) : null

  return (
    <div>
      <div className="page-title">App Feedback</div>
      <p style={{ color: 'var(--mist)', fontSize: 14, marginTop: 0 }}>
        What subscribers' customers say about the Customer Portal, two days after they book or order filters in it. Customer names and contact details are left out; each subscriber sees its own customers' feedback, with names, under Team Communications → Customer Feedback.
      </p>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14, fontSize: 14 }}>
        <select value={company} onChange={(e) => setCompany(e.target.value)} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)' }}>
          <option value="">All subscribers</option>
          {companies.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={onlySuggestions} onChange={(e) => setOnlySuggestions(e.target.checked)} /> Only ones with suggestions</label>
        <span><b>{base.length}</b> responses</span>
        {avg && <span>Average <b style={{ color: '#D97706' }}>{avg} ★</b></span>}
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
        {[['new', `New${newCount ? ` (${newCount})` : ''}`], ['reviewed', 'Reviewed']].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            style={{ background: 'none', border: 'none', borderBottom: tab === k ? '3px solid #215F9A' : '3px solid transparent', padding: '8px 14px', fontWeight: 700, color: tab === k ? '#215F9A' : 'var(--mist)', cursor: 'pointer', fontSize: 14 }}>{l}</button>
        ))}
      </div>
      {err && <p style={{ color: '#B91C1C' }}>{err}</p>}
      {loading ? <p>Loading…</p> : !shown.length ? <p style={{ color: 'var(--mist)' }}>{tab === 'new' ? 'No new feedback.' : 'Nothing reviewed yet.'}</p> : shown.map((r) => (
        <div key={r.id} className="section-card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
            <div style={{ fontWeight: 800, fontSize: 15.5 }}>{r.org_name}</div>
            <div style={{ color: 'var(--mist)', fontSize: 13 }}>{WHAT[r.trigger_kind] || ''} · {fmt(r.submitted_at)}</div>
          </div>
          <div style={{ fontSize: 20, color: '#F59E0B', margin: '6px 0 2px', letterSpacing: 2 }}>
            {r.rating ? '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating) : <span style={{ fontSize: 13, color: 'var(--mist)', letterSpacing: 0 }}>No rating</span>}
          </div>
          {r.suggestions && <div style={{ marginTop: 8 }}><div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: 'var(--mist)' }}>Suggestions</div><div style={{ whiteSpace: 'pre-wrap', fontSize: 14.5 }}>{r.suggestions}</div></div>}
          {r.experience && <div style={{ marginTop: 8 }}><div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: 'var(--mist)' }}>Experience</div><div style={{ whiteSpace: 'pre-wrap', fontSize: 14.5 }}>{r.experience}</div></div>}
          <div style={{ marginTop: 12 }}>
            <button type="button" className="btn" onClick={() => setReviewed(r, !r.platform_reviewed_at)}>{r.platform_reviewed_at ? 'Move back to New' : 'Mark reviewed'}</button>
          </div>
        </div>
      ))}
    </div>
  )
}
