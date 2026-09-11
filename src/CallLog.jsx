import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: '7', label: 'Last 7 days' },
  { key: '30', label: 'Last 30 days' },
  { key: 'all', label: 'All' },
]

export default function CallLog({ profile }) {
  const isSuper = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [range, setRange] = useState('7')

  useEffect(() => { if (isSuper) supabase.from('organizations').select('id, name').order('name').then(({ data }) => setOrgs(data || [])) }, [isSuper])
  useEffect(() => { if (selectedOrg) load(); else setLoading(false) }, [selectedOrg, range])

  async function load() {
    setLoading(true)
    let q = supabase.from('call_logs')
      .select('id, called_at, caller_name, phone, purpose, taken_by_name, direction, customer_id, vendor_id')
      .eq('org_id', selectedOrg).order('called_at', { ascending: false })
    if (range !== 'all') {
      const since = range === 'today'
        ? new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
        : new Date(Date.now() - Number(range) * 86400000).toISOString()
      q = q.gte('called_at', since)
    }
    const { data } = await q.limit(1000)
    setRows(data || []); setLoading(false)
  }

  const term = search.trim().toLowerCase()
  const termDigits = term.replace(/\D/g, '')
  const shown = rows.filter((r) => !term
    || (r.caller_name || '').toLowerCase().includes(term)
    || (r.purpose || '').toLowerCase().includes(term)
    || (termDigits && (r.phone || '').replace(/\D/g, '').includes(termDigits)))

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 24px' }}>
      <div className="page-header-bar"><h2>Call Log</h2></div>
      {isSuper && (
        <div style={{ marginBottom: 12, maxWidth: 340 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, number, or purpose…" style={{ flex: 1, minWidth: 240, padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8 }} />
        <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {RANGES.map((d) => (
            <button key={d.key} onClick={() => setRange(d.key)} style={{ border: 'none', cursor: 'pointer', padding: '9px 13px', fontSize: 13, fontWeight: range === d.key ? 700 : 500, background: range === d.key ? '#176E7A' : 'transparent', color: range === d.key ? '#fff' : 'var(--mist)' }}>{d.label}</button>
          ))}
        </div>
      </div>
      {loading ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : shown.length === 0 ? (
        <div className="section-card" style={{ padding: 20 }}><p style={{ margin: 0, color: 'var(--mist)' }}>No calls logged{range !== 'all' ? ' in this range' : ''}{term ? ' matching your search' : ''}.</p></div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr><th>When</th><th>Caller</th><th>Phone</th><th>Purpose</th><th>Taken by</th></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(r.called_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} {new Date(r.called_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</td>
                  <td>
                    {r.customer_id ? <Link to={`/customers/${r.customer_id}`}>{r.caller_name || '—'}</Link>
                      : r.vendor_id ? <><Link to={`/vendors/${r.vendor_id}`}>{r.caller_name || '—'}</Link> <span style={{ fontSize: 11, color: '#9C6A12', fontWeight: 700 }}>· vendor</span></>
                      : (r.caller_name || <span style={{ color: 'var(--mist)' }}>Unknown</span>)}
                  </td>
                  <td>{r.phone || '—'}</td>
                  <td>{r.purpose || '—'}</td>
                  <td>{r.taken_by_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 12, color: 'var(--mist)', marginTop: 8 }}>{shown.length} call{shown.length === 1 ? '' : 's'}</div>
        </div>
      )}
    </div>
  )
}
