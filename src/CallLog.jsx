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

// First name + last initial, e.g. "Test Customer" -> "Test C."
function firstLast(name) {
  const n = (name || '').trim()
  if (!n) return ''
  const parts = n.split(/\s+/)
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`
}

// Display label for the caller type. Known Others resolve by their category.
function typeLabel(r) {
  if (r.caller_type === 'known_other') {
    const c = r.known_contacts?.category
    return c === 'friends_family' ? 'Personal' : c === 'salesman' ? 'Salesman' : 'Contact'
  }
  const map = { customer: 'Customer', vendor: 'Vendor', employee: 'Employee', unknown: 'Unknown' }
  return map[r.caller_type] || 'Unknown'
}
const TYPE_COLOR = { Customer: '#1B5E9B', Vendor: '#9C6A12', Employee: '#2E7D32', Contact: '#6A4FB6', Salesman: '#6A4FB6', Personal: '#B5477F', Unknown: '#64748B' }

export default function CallLog({ profile }) {
  const isSuper = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [range, setRange] = useState('7')
  const [clear, setClear] = useState({ mode: 'idle', count: 0, msg: '' })

  useEffect(() => { if (isSuper) supabase.from('organizations').select('id, name').order('name').then(({ data }) => setOrgs(data || [])) }, [isSuper])
  useEffect(() => { if (selectedOrg) load(); else setLoading(false) }, [selectedOrg, range])

  async function load() {
    setLoading(true)
    let q = supabase.from('call_logs')
      .select('id, called_at, caller_name, phone, purpose, taken_by_name, customer_id, vendor_id, known_contact_id, caller_type, route_to, follow_up, needs_callback, known_contacts:known_contact_id ( category )')
      .eq('org_id', selectedOrg).is('deleted_at', null).order('called_at', { ascending: false })
    if (range !== 'all') {
      const since = range === 'today'
        ? new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
        : new Date(Date.now() - Number(range) * 86400000).toISOString()
      q = q.gte('called_at', since)
    }
    const { data } = await q.limit(1000)
    setRows(data || []); setLoading(false); setClear({ mode: 'idle', count: 0, msg: '' })
  }

  async function toggleFlag(row, field) {
    const next = !row[field]
    setRows((rs) => rs.map((r) => r.id === row.id ? { ...r, [field]: next } : r))
    await supabase.from('call_logs').update({ [field]: next }).eq('id', row.id)
  }

  async function askClear() {
    const { data } = await supabase.from('call_logs').select('id').eq('org_id', selectedOrg).is('deleted_at', null).eq('needs_callback', false).eq('follow_up', false)
    const n = (data || []).length
    if (n === 0) { setClear({ mode: 'idle', count: 0, msg: 'Nothing to clear — every remaining call is flagged.' }); return }
    setClear({ mode: 'confirm', count: n, msg: '' })
  }
  async function doClear() {
    setClear((c) => ({ ...c, mode: 'clearing' }))
    await supabase.from('call_logs').update({ deleted_at: new Date().toISOString() }).eq('org_id', selectedOrg).is('deleted_at', null).eq('needs_callback', false).eq('follow_up', false)
    load()
  }

  const term = search.trim().toLowerCase()
  const termDigits = term.replace(/\D/g, '')
  const shown = rows.filter((r) => !term
    || (r.caller_name || '').toLowerCase().includes(term)
    || (r.purpose || '').toLowerCase().includes(term)
    || typeLabel(r).toLowerCase().includes(term)
    || (r.route_to || '').toLowerCase().includes(term)
    || (termDigits && (r.phone || '').replace(/\D/g, '').includes(termDigits)))
  const callbackCount = rows.filter((r) => r.needs_callback).length
  const followupCount = rows.filter((r) => r.follow_up).length

  const callerCell = (r) => {
    const nm = firstLast(r.caller_name) || 'Unknown'
    if (r.customer_id) return <Link to={`/customers/${r.customer_id}`}>{nm}</Link>
    if (r.vendor_id) return <Link to={`/vendors/${r.vendor_id}`}>{nm}</Link>
    return <span style={r.caller_name ? undefined : { color: 'var(--mist)' }}>{nm}</span>
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px' }}>
      <div className="page-header-bar"><h2>Call Log</h2></div>
      {isSuper && (
        <div style={{ marginBottom: 12, maxWidth: 340 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}
      <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--mist)' }}>Calls aren't meant to live here forever — flag anyone you need to call back or follow up; the rest clear automatically overnight. Flagged calls are kept until you clear their flag.</p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, type, phone, or purpose…" style={{ flex: 1, minWidth: 240, padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8 }} />
        <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {RANGES.map((d) => (
            <button key={d.key} onClick={() => setRange(d.key)} style={{ border: 'none', cursor: 'pointer', padding: '9px 13px', fontSize: 13, fontWeight: range === d.key ? 700 : 500, background: range === d.key ? '#176E7A' : 'transparent', color: range === d.key ? '#fff' : 'var(--mist)' }}>{d.label}</button>
          ))}
        </div>
        {clear.mode === 'confirm' ? (
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', background: '#FBECE8', border: '1px solid #EAC5BC', borderRadius: 8, padding: '5px 10px' }}>
            <span style={{ fontSize: 13, color: '#B5462F', fontWeight: 600 }}>Clear {clear.count} unflagged?</span>
            <button onClick={doClear} style={{ border: 'none', background: '#B5462F', color: '#fff', borderRadius: 6, padding: '5px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Clear</button>
            <button onClick={() => setClear({ mode: 'idle', count: 0, msg: '' })} style={{ border: '1px solid var(--border)', background: '#fff', borderRadius: 6, padding: '5px 12px', fontSize: 12.5, cursor: 'pointer' }}>Cancel</button>
          </span>
        ) : (
          <button onClick={askClear} disabled={clear.mode === 'clearing'} style={{ border: '1px solid var(--border)', background: '#fff', borderRadius: 8, padding: '9px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--mist)' }}>{clear.mode === 'clearing' ? 'Clearing…' : 'Clear all unflagged entries'}</button>
        )}
      </div>
      {clear.msg && <div style={{ fontSize: 13, color: 'var(--mist)', marginBottom: 10 }}>{clear.msg}</div>}
      {(callbackCount > 0 || followupCount > 0) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {callbackCount > 0 && <span style={{ fontSize: 12.5, color: '#fff', background: '#B5462F', borderRadius: 6, padding: '3px 10px', fontWeight: 700 }}>{callbackCount} flagged for call-back</span>}
          {followupCount > 0 && <span style={{ fontSize: 12.5, color: '#fff', background: '#B5462F', borderRadius: 6, padding: '3px 10px', fontWeight: 700 }}>{followupCount} flagged for follow-up</span>}
        </div>
      )}
      {loading ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : shown.length === 0 ? (
        <div className="section-card" style={{ padding: 20 }}><p style={{ margin: 0, color: 'var(--mist)' }}>No calls{range !== 'all' ? ' in this range' : ''}{term ? ' matching your search' : ''}.</p></div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr>
              <th style={{ width: 70, textAlign: 'center' }}>Call back</th>
              <th>Time</th><th>Caller</th><th>Caller type</th><th>Phone</th>
              <th>Purpose / calling whom</th><th>Taken by</th>
              <th style={{ width: 56, textAlign: 'center' }}>F/U?</th><th>Route to</th>
            </tr></thead>
            <tbody>
              {shown.map((r) => {
                const label = typeLabel(r)
                return (
                  <tr key={r.id} style={(r.needs_callback || r.follow_up) ? { background: '#FCF6E9' } : undefined}>
                    <td style={{ textAlign: 'center' }}><input type="checkbox" checked={!!r.needs_callback} onChange={() => toggleFlag(r, 'needs_callback')} title="Flag for call-back" style={{ width: 17, height: 17, cursor: 'pointer' }} /></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(r.called_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} {new Date(r.called_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</td>
                    <td>{callerCell(r)}</td>
                    <td><span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.03em', textTransform: 'uppercase', color: TYPE_COLOR[label] || 'var(--mist)' }}>{label}</span></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{r.phone ? <a href={`tel:${(r.phone || '').replace(/[^\d+]/g, '')}`}>{r.phone}</a> : '—'}</td>
                    <td>{r.purpose || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{firstLast(r.taken_by_name) || '—'}</td>
                    <td style={{ textAlign: 'center' }}><input type="checkbox" checked={!!r.follow_up} onChange={() => toggleFlag(r, 'follow_up')} title="Flag for follow-up" style={{ width: 17, height: 17, cursor: 'pointer' }} /></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{r.route_to || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{ fontSize: 12, color: 'var(--mist)', marginTop: 8 }}>{shown.length} call{shown.length === 1 ? '' : 's'}</div>
        </div>
      )}
    </div>
  )
}
