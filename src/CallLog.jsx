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
  const [clear, setClear] = useState({ mode: 'idle', count: 0, msg: '' })

  useEffect(() => { if (isSuper) supabase.from('organizations').select('id, name').order('name').then(({ data }) => setOrgs(data || [])) }, [isSuper])
  useEffect(() => { if (selectedOrg) load(); else setLoading(false) }, [selectedOrg, range])

  async function load() {
    setLoading(true)
    let q = supabase.from('call_logs')
      .select('id, called_at, caller_name, phone, purpose, taken_by_name, direction, customer_id, vendor_id, needs_callback')
      .eq('org_id', selectedOrg).order('called_at', { ascending: false })
    if (range !== 'all') {
      const since = range === 'today'
        ? new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
        : new Date(Date.now() - Number(range) * 86400000).toISOString()
      q = q.gte('called_at', since)
    }
    const { data } = await q.limit(1000)
    setRows(data || []); setLoading(false); setClear({ mode: 'idle', count: 0, msg: '' })
  }

  async function toggleCallback(row) {
    const next = !row.needs_callback
    setRows((rs) => rs.map((r) => r.id === row.id ? { ...r, needs_callback: next } : r))
    await supabase.from('call_logs').update({ needs_callback: next }).eq('id', row.id)
  }

  const cutoffISO = () => new Date(Date.now() - 24 * 3600 * 1000).toISOString()

  async function askClear() {
    const { data } = await supabase.from('call_logs').select('id').eq('org_id', selectedOrg).lt('called_at', cutoffISO()).eq('needs_callback', false)
    const n = (data || []).length
    if (n === 0) { setClear({ mode: 'idle', count: 0, msg: 'Nothing older than 24 hours to clear.' }); return }
    setClear({ mode: 'confirm', count: n, msg: '' })
  }

  async function doClear() {
    setClear((c) => ({ ...c, mode: 'clearing' }))
    await supabase.from('call_logs').delete().eq('org_id', selectedOrg).lt('called_at', cutoffISO()).eq('needs_callback', false)
    load()
  }

  const term = search.trim().toLowerCase()
  const termDigits = term.replace(/\D/g, '')
  const shown = rows.filter((r) => !term
    || (r.caller_name || '').toLowerCase().includes(term)
    || (r.purpose || '').toLowerCase().includes(term)
    || (termDigits && (r.phone || '').replace(/\D/g, '').includes(termDigits)))
  const callbackCount = rows.filter((r) => r.needs_callback).length

  return (
    <div style={{ maxWidth: 1150, margin: '0 auto', padding: '20px 24px' }}>
      <div className="page-header-bar"><h2>Call Log</h2></div>
      {isSuper && (
        <div style={{ marginBottom: 12, maxWidth: 340 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}
      <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--mist)' }}>Calls aren't meant to live here forever — flag anyone you need to call back, then clear the rest once it's a day old. Flagged call-backs are kept until you clear their flag.</p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, number, or purpose…" style={{ flex: 1, minWidth: 220, padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8 }} />
        <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {RANGES.map((d) => (
            <button key={d.key} onClick={() => setRange(d.key)} style={{ border: 'none', cursor: 'pointer', padding: '9px 13px', fontSize: 13, fontWeight: range === d.key ? 700 : 500, background: range === d.key ? '#176E7A' : 'transparent', color: range === d.key ? '#fff' : 'var(--mist)' }}>{d.label}</button>
          ))}
        </div>
        {clear.mode === 'confirm' ? (
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', background: '#FBECE8', border: '1px solid #EAC5BC', borderRadius: 8, padding: '5px 10px' }}>
            <span style={{ fontSize: 13, color: '#B5462F', fontWeight: 600 }}>Clear {clear.count} older than 24h?</span>
            <button onClick={doClear} style={{ border: 'none', background: '#B5462F', color: '#fff', borderRadius: 6, padding: '5px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Clear</button>
            <button onClick={() => setClear({ mode: 'idle', count: 0, msg: '' })} style={{ border: '1px solid var(--border)', background: '#fff', borderRadius: 6, padding: '5px 12px', fontSize: 12.5, cursor: 'pointer' }}>Cancel</button>
          </span>
        ) : (
          <button onClick={askClear} disabled={clear.mode === 'clearing'} style={{ border: '1px solid var(--border)', background: '#fff', borderRadius: 8, padding: '9px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--mist)' }}>{clear.mode === 'clearing' ? 'Clearing…' : 'Clear entries older than 24h'}</button>
        )}
      </div>
      {clear.msg && <div style={{ fontSize: 13, color: 'var(--mist)', marginBottom: 10 }}>{clear.msg}</div>}
      {callbackCount > 0 && <div style={{ fontSize: 13, color: '#9C6A12', fontWeight: 600, marginBottom: 10 }}>{callbackCount} flagged for call-back</div>}
      {loading ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : shown.length === 0 ? (
        <div className="section-card" style={{ padding: 20 }}><p style={{ margin: 0, color: 'var(--mist)' }}>No calls logged{range !== 'all' ? ' in this range' : ''}{term ? ' matching your search' : ''}.</p></div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr><th style={{ width: 78, textAlign: 'center' }}>Call back</th><th>When</th><th>Caller</th><th>Phone</th><th>Purpose</th><th>Taken by</th></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} style={r.needs_callback ? { background: '#FCF6E9' } : undefined}>
                  <td style={{ textAlign: 'center' }}>
                    <input type="checkbox" checked={!!r.needs_callback} onChange={() => toggleCallback(r)} title="Flag for call-back" style={{ width: 17, height: 17, cursor: 'pointer' }} />
                  </td>
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
