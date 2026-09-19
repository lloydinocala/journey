import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

// How far back the EARLIER (archive) table reaches. Today always lives in the
// top table, so these only scope the searchable history below it.
const RANGES = [
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
  const [range, setRange] = useState('all')
  const [clear, setClear] = useState({ mode: 'idle', count: 0, msg: '' })
  const [expOpen, setExpOpen] = useState(false)
  const [exp, setExp] = useState({ name: '', from: '', to: '', includeCleared: true })
  const [exporting, setExporting] = useState(false)
  const [expMsg, setExpMsg] = useState('')

  useEffect(() => { if (isSuper) supabase.from('organizations').select('id, name').order('name').then(({ data }) => setOrgs(data || [])) }, [isSuper])
  useEffect(() => { if (selectedOrg) load(); else setLoading(false) }, [selectedOrg])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('call_logs')
      .select('id, called_at, caller_name, phone, purpose, taken_by_name, customer_id, vendor_id, known_contact_id, caller_type, route_to, follow_up, needs_callback, known_contacts:known_contact_id ( category )')
      .eq('org_id', selectedOrg).is('deleted_at', null).order('called_at', { ascending: false }).limit(1000)
    setRows(data || []); setLoading(false); setClear({ mode: 'idle', count: 0, msg: '' })
  }

  async function toggleFlag(row, field) {
    const next = !row[field]
    setRows((rs) => rs.map((r) => r.id === row.id ? { ...r, [field]: next } : r))
    await supabase.from('call_logs').update({ [field]: next }).eq('id', row.id)
  }

  const startToday = new Date(); startToday.setHours(0, 0, 0, 0)
  const startMs = startToday.getTime()

  async function askClear() {
    // Only clears the archive (before today) — today's board is never touched here.
    const { data } = await supabase.from('call_logs').select('id').eq('org_id', selectedOrg).is('deleted_at', null).eq('needs_callback', false).eq('follow_up', false).lt('called_at', startToday.toISOString())
    const n = (data || []).length
    if (n === 0) { setClear({ mode: 'idle', count: 0, msg: 'Nothing to clear — every earlier call is flagged.' }); return }
    setClear({ mode: 'confirm', count: n, msg: '' })
  }
  async function doClear() {
    setClear((c) => ({ ...c, mode: 'clearing' }))
    await supabase.from('call_logs').update({ deleted_at: new Date().toISOString() }).eq('org_id', selectedOrg).is('deleted_at', null).eq('needs_callback', false).eq('follow_up', false).lt('called_at', startToday.toISOString())
    load()
  }

  // ---- CSV export: name / date-range / all, optionally including cleared calls ----
  const csvCell = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  async function runExport() {
    if (!selectedOrg) return
    setExporting(true); setExpMsg('')
    let q = supabase.from('call_logs')
      .select('called_at, caller_name, phone, purpose, taken_by_name, caller_type, route_to, needs_callback, follow_up, deleted_at, known_contacts:known_contact_id ( category )')
      .eq('org_id', selectedOrg).order('called_at', { ascending: false })
    if (!exp.includeCleared) q = q.is('deleted_at', null)
    if (exp.name.trim()) q = q.ilike('caller_name', `%${exp.name.trim()}%`)
    if (exp.from) q = q.gte('called_at', new Date(exp.from + 'T00:00:00').toISOString())
    if (exp.to) q = q.lte('called_at', new Date(exp.to + 'T23:59:59.999').toISOString())
    const { data, error } = await q.limit(100000)
    setExporting(false)
    if (error) { setExpMsg('Export failed: ' + (error.message || 'unknown error')); return }
    if (!data || !data.length) { setExpMsg('No calls matched — nothing to export.'); return }
    const header = ['Date / Time', 'Caller', 'Caller type', 'Phone', 'Purpose / calling whom', 'Taken by', 'Route to', 'Flagged: call back', 'Flagged: follow-up', 'Status']
    const lines = [header.map(csvCell).join(',')]
    data.forEach((r) => {
      const dt = new Date(r.called_at)
      const when = `${dt.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' })} ${dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
      lines.push([when, r.caller_name || '', typeLabel(r), r.phone || '', r.purpose || '', r.taken_by_name || '', r.route_to || '', r.needs_callback ? 'Yes' : '', r.follow_up ? 'Yes' : '', r.deleted_at ? 'Cleared' : 'Active'].map(csvCell).join(','))
    })
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `call-log_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setExpMsg(`Exported ${data.length} call${data.length === 1 ? '' : 's'}.`)
  }

  const term = search.trim().toLowerCase()
  const termDigits = term.replace(/\D/g, '')
  const matchesTerm = (r) => !term
    || (r.caller_name || '').toLowerCase().includes(term)
    || (r.purpose || '').toLowerCase().includes(term)
    || typeLabel(r).toLowerCase().includes(term)
    || (r.route_to || '').toLowerCase().includes(term)
    || (termDigits && (r.phone || '').replace(/\D/g, '').includes(termDigits))

  const todayRows = rows.filter((r) => new Date(r.called_at).getTime() >= startMs)
  const earlierAll = rows.filter((r) => new Date(r.called_at).getTime() < startMs)
  const earlierShown = earlierAll.filter((r) => {
    if (!matchesTerm(r)) return false
    if (range === 'all') return true
    const since = Date.now() - Number(range) * 86400000
    return new Date(r.called_at).getTime() >= since
  })

  const callbackCount = rows.filter((r) => r.needs_callback).length
  const followupCount = rows.filter((r) => r.follow_up).length

  const callerCell = (r) => {
    const nm = firstLast(r.caller_name) || 'Unknown'
    if (r.customer_id) return <Link to={`/customers/${r.customer_id}`}>{nm}</Link>
    if (r.vendor_id) return <Link to={`/vendors/${r.vendor_id}`}>{nm}</Link>
    return <span style={r.caller_name ? undefined : { color: 'var(--mist)' }}>{nm}</span>
  }

  const renderTable = (list, maxHeight) => (
    <div className="tbl-scroll" style={{ maxHeight }}>
      <table className="data-table">
        <thead><tr>
          <th style={{ width: 70, textAlign: 'center' }}>Call back</th>
          <th>Time</th><th>Caller</th><th>Caller type</th><th>Phone</th>
          <th>Purpose / calling whom</th><th>Taken by</th>
          <th style={{ width: 56, textAlign: 'center' }}>F/U?</th><th>Route to</th>
        </tr></thead>
        <tbody>
          {list.map((r) => {
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
    </div>
  )

  const todayLabel = startToday.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px' }}>
      <div className="page-header-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Call Log</h2>
        <button onClick={() => { setExpOpen((o) => !o); setExpMsg('') }} disabled={!selectedOrg} style={{ border: '1px solid var(--border)', background: expOpen ? '#EAF3F4' : '#fff', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#176E7A' }}>Export CSV</button>
      </div>
      {expOpen && (
        <div className="section-card" style={{ padding: 18, marginBottom: 16, border: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 800, marginBottom: 4 }}>Export call records</div>
          <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--mist)' }}>Leave the filters blank to export the full history. Add a name and/or a date range to narrow it — useful for pulling one caller's complete record.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <label style={{ display: 'block' }}><span style={{ display: 'block', fontSize: 12.5, color: 'var(--mist)', marginBottom: 4 }}>Caller name (optional)</span><input value={exp.name} onChange={(e) => setExp({ ...exp, name: e.target.value })} placeholder="e.g. Coughlin" style={{ width: '100%', padding: '9px 11px', border: '1px solid var(--border)', borderRadius: 8, boxSizing: 'border-box' }} /></label>
            <label style={{ display: 'block' }}><span style={{ display: 'block', fontSize: 12.5, color: 'var(--mist)', marginBottom: 4 }}>From date (optional)</span><input type="date" value={exp.from} onChange={(e) => setExp({ ...exp, from: e.target.value })} style={{ width: '100%', padding: '9px 11px', border: '1px solid var(--border)', borderRadius: 8, boxSizing: 'border-box' }} /></label>
            <label style={{ display: 'block' }}><span style={{ display: 'block', fontSize: 12.5, color: 'var(--mist)', marginBottom: 4 }}>To date (optional)</span><input type="date" value={exp.to} onChange={(e) => setExp({ ...exp, to: e.target.value })} style={{ width: '100%', padding: '9px 11px', border: '1px solid var(--border)', borderRadius: 8, boxSizing: 'border-box' }} /></label>
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, marginTop: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={exp.includeCleared} onChange={(e) => setExp({ ...exp, includeCleared: e.target.checked })} />
            Include cleared calls <span style={{ color: 'var(--mist)' }}>(recovers auto-cleared and manually cleared calls — recommended for a complete record)</span>
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14 }}>
            <button className="auth-button" style={{ width: 'auto', margin: 0, padding: '9px 18px' }} disabled={exporting} onClick={runExport}>{exporting ? 'Preparing…' : 'Download CSV'}</button>
            {expMsg && <span style={{ fontSize: 13, color: expMsg.startsWith('Export failed') ? '#B5462F' : 'var(--mist)' }}>{expMsg}</span>}
          </div>
        </div>
      )}
      {isSuper && (
        <div style={{ marginBottom: 12, maxWidth: 340 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--mist)' }}>Calls aren't meant to live here forever — flag anyone you need to call back or follow up; the rest clear automatically overnight. Flagged calls are kept until you clear their flag, and nothing is ever permanently erased.</p>

      {loading ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : (
        <>
          {/* ---- TODAY: the active board, always in view ---- */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Today</h3>
            <span style={{ fontSize: 13, color: 'var(--mist)' }}>{todayLabel} · {todayRows.length} call{todayRows.length === 1 ? '' : 's'}</span>
          </div>
          {todayRows.length === 0 ? (
            <div className="section-card" style={{ padding: 18, marginBottom: 26 }}><p style={{ margin: 0, color: 'var(--mist)' }}>No calls logged yet today.</p></div>
          ) : <div style={{ marginBottom: 26 }}>{renderTable(todayRows, '40vh')}</div>}

          {/* ---- EARLIER: the searchable archive ---- */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Earlier calls</h3>
            <span style={{ fontSize: 13, color: 'var(--mist)' }}>search anytime — flagged calls stay here until you clear them</span>
          </div>
          {(callbackCount > 0 || followupCount > 0) && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              {callbackCount > 0 && <span style={{ fontSize: 12.5, color: '#fff', background: '#B5462F', borderRadius: 6, padding: '3px 10px', fontWeight: 700 }}>{callbackCount} flagged for call-back</span>}
              {followupCount > 0 && <span style={{ fontSize: 12.5, color: '#fff', background: '#B5462F', borderRadius: 6, padding: '3px 10px', fontWeight: 700 }}>{followupCount} flagged for follow-up</span>}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, type, phone, or purpose…" style={{ flex: 1, minWidth: 240, padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8 }} />
            <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {RANGES.map((d) => (
                <button key={d.key} onClick={() => setRange(d.key)} style={{ border: 'none', cursor: 'pointer', padding: '9px 13px', fontSize: 13, fontWeight: range === d.key ? 700 : 500, background: range === d.key ? '#176E7A' : 'transparent', color: range === d.key ? '#fff' : 'var(--mist)' }}>{d.label}</button>
              ))}
            </div>
            {clear.mode === 'confirm' ? (
              <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', background: '#FBECE8', border: '1px solid #EAC5BC', borderRadius: 8, padding: '5px 10px' }}>
                <span style={{ fontSize: 13, color: '#B5462F', fontWeight: 600 }}>Clear {clear.count} unflagged from before today?</span>
                <button onClick={doClear} style={{ border: 'none', background: '#B5462F', color: '#fff', borderRadius: 6, padding: '5px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Clear</button>
                <button onClick={() => setClear({ mode: 'idle', count: 0, msg: '' })} style={{ border: '1px solid var(--border)', background: '#fff', borderRadius: 6, padding: '5px 12px', fontSize: 12.5, cursor: 'pointer' }}>Cancel</button>
              </span>
            ) : (
              <button onClick={askClear} disabled={clear.mode === 'clearing'} style={{ border: '1px solid var(--border)', background: '#fff', borderRadius: 8, padding: '9px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--mist)' }}>{clear.mode === 'clearing' ? 'Clearing…' : 'Clear all unflagged entries'}</button>
            )}
          </div>
          {clear.msg && <div style={{ fontSize: 13, color: 'var(--mist)', marginBottom: 10 }}>{clear.msg}</div>}
          {earlierShown.length === 0 ? (
            <div className="section-card" style={{ padding: 20 }}><p style={{ margin: 0, color: 'var(--mist)' }}>No earlier calls{range !== 'all' ? ' in this range' : ''}{term ? ' matching your search' : ''}.</p></div>
          ) : (
            <>
              {renderTable(earlierShown, '52vh')}
              <div style={{ fontSize: 12, color: 'var(--mist)', marginTop: 8 }}>{earlierShown.length} call{earlierShown.length === 1 ? '' : 's'}</div>
            </>
          )}
        </>
      )}
    </div>
  )
}
