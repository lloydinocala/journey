import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import { viewingOrg } from './utils/viewingOrg'

// App Customers — customer by customer, who has a Customer Portal login, when they last signed in, whether
// they use the store app, their notification choices, and whether their phone gets notifications. For the
// company's own office to follow up; a super admin can open any company (OrgPicker) to help it.
// Data: org_app_customers(org) — the company's own staff (not techs) or a super admin.
// "Store app" is known from Phone check, recorded from Nov 27, 2026.
const fmt = (t) => { if (!t) return '—'; const d = new Date(t); return isNaN(d) ? '—' : d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) }
const STEP = {
  registered: ['Gets notifications', '#15803D'], opened_app: ['Opened the store app', '#475569'], opened_browser: ['Uses a web browser', '#B45309'],
  permission_denied: ['Notifications off on phone', '#B42318'], phone_refused: ['Phone refused to register', '#B42318'], save_failed: ['Registration not saved', '#B42318'], plugin_error: ['App error', '#B42318'],
}
const FILTERS = [
  ['all', 'All logins'], ['never', 'Never signed in'], ['no_choices', 'Signed in, no choices saved'],
  ['no_phone', 'No phone registered'], ['phone', 'Phone registered'], ['problem', 'Phone problem'],
]

export default function AppCustomers({ profile }) {
  const isSuper = profile?.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [orgId, setOrgId] = useState(() => profile?.org_id || viewingOrg())
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!isSuper) return
    supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
      setOrgs(data || [])
      if (!orgId && data && data.length) setOrgId(data[0].id)
    })
  }, [])
  useEffect(() => { if (orgId) load(); else setLoading(false) }, [orgId])
  async function load() {
    setLoading(true); setErr('')
    const { data, error } = await supabase.rpc('org_app_customers', { p_org: orgId })
    if (error) setErr(error.message); else setRows(data || [])
    setLoading(false)
  }

  const problem = (r) => ['permission_denied', 'phone_refused', 'save_failed', 'plugin_error'].includes(r.latest_step)
  const shown = useMemo(() => rows.filter((r) => {
    if (q && !String(r.customer_name || '').toLowerCase().includes(q.toLowerCase())) return false
    if (filter === 'never') return !r.last_sign_in
    if (filter === 'no_choices') return !!r.last_sign_in && !r.choices_saved
    if (filter === 'no_phone') return !r.phone_registered
    if (filter === 'phone') return r.phone_registered
    if (filter === 'problem') return problem(r)
    return true
  }), [rows, filter, q])

  const n = (fn) => rows.filter(fn).length
  const yes = (b) => (b ? '✓' : '—')

  function exportCsv() {
    const cell = (v) => { const t = String(v == null ? '' : v); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t }
    const head = ['Customer', 'Login created', 'Last sign-in', 'Choices saved', 'Service Updates', 'Goodwill', 'Optional Messages', 'Store app', 'Phone registered', 'Last result']
    const body = shown.map((r) => [r.customer_name, fmt(r.login_created), fmt(r.last_sign_in), fmt(r.choices_saved),
      r.choices_saved ? (r.allow_service ? 'Yes' : 'No') : '', r.choices_saved ? (r.allow_goodwill ? 'Yes' : 'No') : '', r.choices_saved ? (r.allow_optional ? 'Yes' : 'No') : '',
      r.used_store_app ? (r.platform === 'ios' ? 'iPhone' : r.platform === 'android' ? 'Android' : 'Yes') : '', r.phone_registered ? 'Yes' : 'No',
      (STEP[r.latest_step] || [r.latest_step || ''])[0] + (r.latest_error ? ' - ' + r.latest_error : '')])
    const csv = '﻿' + [head, ...body].map((l) => l.map(cell).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = `app-customers-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const th = { textAlign: 'left', padding: '8px 10px', fontSize: 12.5, color: 'var(--mist)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
  const td = { padding: '8px 10px', fontSize: 14, borderBottom: '1px solid var(--border)', verticalAlign: 'top' }

  return (
    <div>
      <div className="page-title">App Customers</div>
      {isSuper && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={orgId} onChange={setOrgId} />
        </div>
      )}
      <p style={{ color: 'var(--mist)', fontSize: 14, marginTop: 0 }}>
        Every customer with a Customer Portal login: when they signed in, whether they use the store app, their notification choices, and whether their phone gets notifications. Use it to see who to help get set up. Store-app use is tracked from Nov 27, 2026.
      </p>
      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', fontSize: 14, marginBottom: 14 }}>
        <span><b>{rows.length}</b> logins</span>
        <span><b>{n((r) => r.last_sign_in)}</b> signed in</span>
        <span><b>{n((r) => r.used_store_app)}</b> used the store app</span>
        <span><b>{n((r) => r.choices_saved)}</b> saved choices</span>
        <span><b>{n((r) => r.phone_registered)}</b> phones registered</span>
        {n(problem) > 0 && <span style={{ color: '#B42318' }}><b>{n(problem)}</b> phone problems</span>}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)' }}>
          {FILTERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customer" style={{ padding: '7px 10px', maxWidth: 260 }} />
        <button type="button" className="btn" onClick={exportCsv} disabled={!shown.length}>⬇ Export .csv</button>
        <button type="button" className="btn" onClick={load}>Refresh</button>
      </div>
      {err && <p style={{ color: '#B42318' }}>{err}</p>}
      {loading ? <p>Loading…</p> : !shown.length ? <p style={{ color: 'var(--mist)' }}>{rows.length ? 'No customers match.' : 'No customers have a portal login yet.'}</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
            <thead><tr>
              <th style={th}>Customer</th><th style={th}>Login created</th><th style={th}>Last sign-in</th><th style={th}>Choices saved</th>
              <th style={th} title="Service Updates / Goodwill / Optional Messages">Service / Goodwill / Optional</th><th style={th}>Store app</th><th style={th}>Phone</th><th style={th}>Last result</th>
            </tr></thead>
            <tbody>
              {shown.map((r) => {
                const [label, color] = STEP[r.latest_step] || [r.latest_step ? r.latest_step : '—', '#475569']
                return (
                  <tr key={r.customer_id}>
                    <td style={td}><Link to={`/customers/${r.customer_id}`} style={{ fontWeight: 700 }}>{r.customer_name}</Link></td>
                    <td style={td}>{fmt(r.login_created)}</td>
                    <td style={td}>{r.last_sign_in ? fmt(r.last_sign_in) : <span style={{ color: '#B45309' }}>Never</span>}</td>
                    <td style={td}>{fmt(r.choices_saved)}</td>
                    <td style={td}>{r.choices_saved ? `${yes(r.allow_service)} / ${yes(r.allow_goodwill)} / ${yes(r.allow_optional)}` : '—'}</td>
                    <td style={td}>{r.used_store_app ? (r.platform === 'ios' ? 'iPhone' : r.platform === 'android' ? 'Android' : 'Yes') : '—'}</td>
                    <td style={{ ...td, color: r.phone_registered ? '#15803D' : 'inherit' }}>{r.phone_registered ? '✓ Registered' : '—'}</td>
                    <td style={{ ...td, color }}>{label}{r.latest_error ? <div style={{ fontSize: 12 }}>{r.latest_error}</div> : null}</td>
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
