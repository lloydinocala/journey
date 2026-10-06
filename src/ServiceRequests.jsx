import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import { printServiceFlyer } from './utils/serviceFlyer'

const CAT_LABEL = { repair: 'Repair', tuneup: 'Tune-up', question: 'Question' }
const URG_COLOR = { emergency: '#DC2626', soon: '#9a6a12', flexible: '#1b7a3d' }

// Deterministic triage: scores a request from its own text so genuine emergencies
// (no heat/cool, safety hazards, vulnerable occupants) rise to the top. Honest by
// design — the matched reasons are shown on the card, nothing is hidden or invented.
function computeTriage(r) {
  const text = `${r.details || ''} ${r.category || ''}`.toLowerCase()
  const reasons = []
  let score = 0
  const hit = (re, label, pts) => { if (re.test(text)) { score += pts; reasons.push(label) } }
  hit(/gas|smell|burning|smoke|spark|carbon monoxide|\bco\b/, 'possible safety hazard', 4)
  hit(/\bno (heat|heating)\b|not heating|no warm/, 'no heat', 3)
  hit(/\bno (cool|cooling|a\/?c|air)\b|not cooling|no cold/, 'no cooling', 3)
  hit(/not working|won'?t turn on|stopped working|\bdead\b|no power|shut down/, 'system down', 2)
  hit(/leak|leaking|flood|dripping|water every/, 'water / leak', 2)
  hit(/elderly|senior|baby|infant|newborn|medical|oxygen|disab|pregnan/, 'vulnerable occupant', 2)
  if ((r.urgency || '') === 'emergency') { score += 2; reasons.push('marked emergency') }
  else if ((r.urgency || '') === 'soon') { score += 1 }
  const level = score >= 4 ? 'urgent' : score >= 2 ? 'elevated' : 'normal'
  return { score, reasons, level }
}
const TRIAGE_STYLE = { urgent: ['#FBE7E7', '#B00020', 'Urgent'], elevated: ['#F8EEDD', '#B0600A', 'Elevated'] }
const byTriage = (a, b) => (computeTriage(b).score - computeTriage(a).score) || (new Date(b.created_at) - new Date(a.created_at))

export default function ServiceRequests({ profile }) {
  const isSuper = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [reqs, setReqs] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [view, setView] = useState('active') // 'active' | 'history'
  const [history, setHistory] = useState([])
  const [histLoading, setHistLoading] = useState(false)
  // QR tool
  const [qsearch, setQsearch] = useState('')
  const [qresults, setQresults] = useState([])
  const [qr, setQr] = useState(null) // { url, address }

  useEffect(() => { if (isSuper) supabase.from('organizations').select('id, name').order('name').then(({ data }) => setOrgs(data || [])) }, [isSuper])

  async function load() {
    if (!selectedOrg) return
    setLoading(true)
    const { data } = await supabase.from('service_requests')
      .select('*, properties(street_address, unit, city, customers!properties_customer_id_fkey(display_name))')
      .eq('org_id', selectedOrg).in('status', ['pending', 'awaiting_owner']).order('created_at', { ascending: false })
    setReqs(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [selectedOrg])
  // Auto-refresh so new requests appear without a manual reload; also refreshes
  // when the tab regains focus.
  useEffect(() => {
    if (!selectedOrg) return
    const id = setInterval(load, 30000)
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(id); window.removeEventListener('focus', onFocus) }
  }, [selectedOrg])

  // History: approved (converted → job) requests are kept indefinitely; declined requests
  // only show for 30 days (and are deleted after 30 days by a nightly cleanup). Newest first.
  async function loadHistory() {
    if (!selectedOrg) return
    setHistLoading(true)
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString()
    const { data } = await supabase.from('service_requests')
      .select('*, properties(street_address, unit, city, customers!properties_customer_id_fkey(display_name))')
      .eq('org_id', selectedOrg)
      .or(`status.eq.converted,and(status.eq.declined,created_at.gte.${cutoff})`)
      .order('created_at', { ascending: false }).limit(500)
    setHistory(data || []); setHistLoading(false)
  }
  useEffect(() => { if (view === 'history') loadHistory() }, [view, selectedOrg])

  async function approve(r) {
    setBusyId(r.id)
    const { error } = await supabase.rpc('approve_service_request', { p_request_id: r.id })
    setBusyId(null)
    if (error) { alert(error.message); return }
    load()
  }
  async function decline(r) {
    if (!window.confirm('Decline this request?')) return
    setBusyId(r.id)
    await supabase.rpc('decline_service_request', { p_request_id: r.id })
    setBusyId(null); load()
  }
  async function ownerApprove(r) {
    setBusyId(r.id)
    const { error } = await supabase.rpc('mark_owner_approved', { p_request_id: r.id })
    setBusyId(null)
    if (error) { alert(error.message); return }
    load()
  }

  // Search by property street address OR by customer (account holder) name.
  // Done as two plain queries (address match, and customer-name → their properties)
  // rather than an embedded-table filter, which is unreliable across relationships.
  async function searchProps(v) {
    setQsearch(v)
    const q = v.trim()
    if (q.length < 3) { setQresults([]); return }
    const sel = 'id, street_address, unit, city, customers!properties_customer_id_fkey(display_name)'
    const [byAddr, custRes] = await Promise.all([
      supabase.from('properties').select(sel).eq('org_id', selectedOrg).ilike('street_address', `%${q}%`).limit(10),
      supabase.from('customers').select('id').eq('org_id', selectedOrg).ilike('display_name', `%${q}%`).limit(25),
    ])
    let byName = []
    const custIds = (custRes.data || []).map((c) => c.id)
    if (custIds.length) {
      const r = await supabase.from('properties').select(sel).eq('org_id', selectedOrg).in('customer_id', custIds).limit(25)
      byName = r.data || []
    }
    const byId = {}
    for (const row of [...(byAddr.data || []), ...byName]) byId[row.id] = row
    setQresults(Object.values(byId).slice(0, 15))
  }
  function printQr(url) {
    // Print ONLY the QR code — white background, no margin/quiet zone around the code.
    const src = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=0&data=${encodeURIComponent(url)}`
    const w = window.open('', '_blank', 'width=700,height=800')
    if (!w) { alert('Please allow pop-ups to print the QR code.'); return }
    w.document.write(`<!doctype html><html><head><title>Service QR</title><style>@page{margin:0}html,body{margin:0;padding:0;background:#fff}img{display:block}</style></head><body><img src="${src}" onload="setTimeout(function(){window.focus();window.print()},150)"></body></html>`)
    w.document.close()
  }
  async function makeQr(p) {
    const { data, error } = await supabase.rpc('ensure_service_token', { p_property_id: p.id })
    if (error) { alert(error.message); return }
    const url = `${window.location.origin}/r/${data}`
    const { data: st } = await supabase.rpc('service_qr_status', { p_property_id: p.id })
    setQr({
      url,
      propertyId: p.id,
      address: [p.street_address, p.unit, p.city].filter(Boolean).join(' '),
      printed_at: st?.printed_at || null,
      orgName: st?.org_name || '',
      orgLogoUrl: st?.org_logo_url || '',
      orgPhone: st?.org_phone || '',
    })
    setQresults([]); setQsearch('')
  }

  // Print the branded 5.5x8.5 flyer and record that this property now has a QR handed out.
  async function printFlyer() {
    if (!qr) return
    const { data, error } = await supabase.rpc('mark_service_qr_printed', { p_property_id: qr.propertyId })
    if (error) { alert(error.message); return }
    printServiceFlyer({
      qrUrl: qr.url,
      orgName: data?.org_name || qr.orgName,
      orgLogoUrl: data?.org_logo_url || qr.orgLogoUrl,
      orgPhone: data?.org_phone || qr.orgPhone,
      address: qr.address,
    })
    setQr((q) => (q ? { ...q, printed_at: data?.printed_at || new Date().toISOString() } : q))
  }

  const awaiting = reqs.filter((r) => r.status === 'awaiting_owner').sort(byTriage)
  const ready = reqs.filter((r) => r.status === 'pending').sort(byTriage)
  function basisBadge(r) {
    if (r.requested_by_owner) return { text: 'Homeowner requested', color: '#1b7a3d' }
    if (r.owner_approved_at) return { text: `Owner approved ${new Date(r.owner_approved_at).toLocaleDateString()}`, color: '#1b7a3d' }
    return null
  }
  function card(r, kind) {
    const badge = kind === 'ready' ? basisBadge(r) : null
    const tri = computeTriage(r)
    const triStyle = TRIAGE_STYLE[tri.level]
    return (
      <div key={r.id} className="section-card" style={{ padding: 14, borderLeft: `4px solid ${tri.level === 'urgent' ? '#DC2626' : URG_COLOR[r.urgency] || 'var(--border)'}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <strong style={{ fontSize: 15 }}>{CAT_LABEL[r.category] || 'Request'}{r.urgency ? ` · ${r.urgency}` : ''}</strong>
            {triStyle && <span title={tri.reasons.join(', ')} style={{ marginLeft: 8, fontSize: 11.5, fontWeight: 700, color: triStyle[1], background: triStyle[0], borderRadius: 6, padding: '2px 8px' }}>{triStyle[2]}</span>}
            {triStyle && tri.reasons.length > 0 && <span style={{ marginLeft: 6, fontSize: 12, color: 'var(--mist)' }}>{tri.reasons.join(' · ')}</span>}
            {badge && <span style={{ marginLeft: 8, fontSize: 11.5, fontWeight: 700, color: '#fff', background: badge.color, borderRadius: 6, padding: '2px 8px' }}>{badge.text}</span>}
            <div style={{ fontSize: 13.5, color: 'var(--mist)', marginTop: 2 }}>
              {[r.properties?.street_address, r.properties?.unit, r.properties?.city].filter(Boolean).join(' ')}
              {r.properties?.customers?.display_name ? ` · Account: ${r.properties.customers.display_name}` : ''}
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--mist)' }}>{new Date(r.created_at).toLocaleString()}</div>
        </div>
        {r.details && <div style={{ margin: '8px 0', fontSize: 14 }}>{r.details}</div>}
        <div style={{ fontSize: 13, color: 'var(--mist)' }}>Reported by: {r.reporter_name || '—'}{r.reporter_phone ? ` · ${r.reporter_phone}` : ''}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {kind === 'awaiting' ? (
            <>
              <button className="auth-button" style={{ width: 'auto' }} disabled={busyId === r.id} onClick={() => ownerApprove(r)}>{busyId === r.id ? 'Working…' : 'Owner approved (I called) → ready'}</button>
              <button className="logout-button" disabled={busyId === r.id} onClick={() => decline(r)}>Decline</button>
            </>
          ) : (
            <>
              <button className="auth-button" style={{ width: 'auto' }} disabled={busyId === r.id} onClick={() => approve(r)}>{busyId === r.id ? 'Working…' : 'Approve → create job'}</button>
              <button className="logout-button" disabled={busyId === r.id} onClick={() => decline(r)}>Decline</button>
            </>
          )}
        </div>
      </div>
    )
  }

  function outcomeBadge(r) {
    if (r.status === 'converted') return { text: 'Approved → job created', color: '#1b7a3d' }
    if (r.status === 'declined') return { text: 'Declined', color: '#DC2626' }
    return { text: r.status, color: 'var(--mist)' }
  }
  function historyCard(r) {
    const badge = outcomeBadge(r)
    return (
      <div key={r.id} className="section-card" style={{ padding: 14, borderLeft: '4px solid var(--border)', opacity: 0.92 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <strong style={{ fontSize: 15 }}>{CAT_LABEL[r.category] || 'Request'}{r.urgency ? ` · ${r.urgency}` : ''}</strong>
            <span style={{ marginLeft: 8, fontSize: 11.5, fontWeight: 700, color: '#fff', background: badge.color, borderRadius: 6, padding: '2px 8px' }}>{badge.text}</span>
            <div style={{ fontSize: 13.5, color: 'var(--mist)', marginTop: 2 }}>
              {[r.properties?.street_address, r.properties?.unit, r.properties?.city].filter(Boolean).join(' ')}
              {r.properties?.customers?.display_name ? ` · Account: ${r.properties.customers.display_name}` : ''}
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--mist)' }}>{new Date(r.created_at).toLocaleString()}</div>
        </div>
        {r.details && <div style={{ margin: '8px 0', fontSize: 14 }}>{r.details}</div>}
        <div style={{ fontSize: 13, color: 'var(--mist)' }}>Reported by: {r.reporter_name || '—'}{r.reporter_phone ? ` · ${r.reporter_phone}` : ''}</div>
      </div>
    )
  }

  const tabBtn = (v, label) => (
    <button onClick={() => setView(v)} style={{ border: '1px solid var(--border)', background: view === v ? '#176E7A' : '#fff', color: view === v ? '#fff' : '#176E7A', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{label}</button>
  )

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div className="page-header-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Service Requests</h2>
        <button onClick={() => (view === 'history' ? loadHistory() : load())} disabled={view === 'history' ? histLoading : loading} style={{ border: '1px solid var(--border)', background: '#fff', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#176E7A' }}>{(view === 'history' ? histLoading : loading) ? 'Refreshing…' : 'Refresh'}</button>
      </div>
      <p style={{ color: 'var(--mist)', fontSize: 14, marginTop: 4, marginBottom: 16, maxWidth: 680 }}>
        Requests from the QR service stickers (tenants & homeowners). Approve to create a job in the dispatch tray — billed to the property’s account holder.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {tabBtn('active', 'Active')}
        {tabBtn('history', 'History')}
      </div>

      {isSuper && (
        <div style={{ marginBottom: 16, maxWidth: 340 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      {view === 'history' ? (
        histLoading ? <p style={{ color: 'var(--mist)' }}>Loading…</p>
          : history.length === 0 ? <div className="section-card" style={{ padding: 18 }}><p style={{ margin: 0, color: 'var(--mist)' }}>No approved or declined requests yet.</p></div>
          : (
            <>
              <p style={{ fontSize: 12.5, color: 'var(--mist)', margin: '0 0 10px' }}>Approved requests are kept indefinitely; declined requests drop off after 30 days. Newest first.</p>
              <div style={{ display: 'grid', gap: 10 }}>{history.map((r) => historyCard(r))}</div>
            </>
          )
      ) : (
      <>
      {loading ? <p style={{ color: 'var(--mist)' }}>Loading…</p>
        : reqs.length === 0 ? <div className="section-card" style={{ padding: 18 }}><p style={{ margin: 0 }}>No pending requests. 🎉</p></div>
        : (
          <>
            {awaiting.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 15, margin: '0 0 8px' }}>Awaiting homeowner approval <span style={{ color: 'var(--mist)', fontWeight: 400 }}>({awaiting.length})</span></h3>
                <p style={{ fontSize: 12.5, color: 'var(--mist)', margin: '0 0 10px' }}>Requested by someone other than the account holder. We’ve emailed the account holder for approval — nothing is scheduled or billed until they say yes. You can also approve on their behalf after a phone call.</p>
                <div style={{ display: 'grid', gap: 10 }}>{awaiting.map((r) => card(r, 'awaiting'))}</div>
              </div>
            )}
            <h3 style={{ fontSize: 15, margin: '0 0 8px' }}>Ready to dispatch <span style={{ color: 'var(--mist)', fontWeight: 400 }}>({ready.length})</span></h3>
            {ready.length === 0 ? <div className="section-card" style={{ padding: 16 }}><p style={{ margin: 0, color: 'var(--mist)' }}>Nothing ready to dispatch.</p></div>
              : <div style={{ display: 'grid', gap: 10 }}>{ready.map((r) => card(r, 'ready'))}</div>}
          </>
        )}

      <h3 style={{ fontSize: 16, marginTop: 28 }}>Print a service QR sticker</h3>
      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0 }}>Find a property, then print the branded label (your logo, business name, and the landlord-approval notice) to leave at the home. Prints one 8.125×5 label on the top half of a Letter sheet — flip the sheet to run a second, different code onto the other label. Scanning the code opens the service-request page for that address. Printing marks the property as having a QR code.</p>
      <input style={{ maxWidth: 380, width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, background: '#fff', color: '#0f172a' }}
        value={qsearch} onChange={(e) => searchProps(e.target.value)} placeholder="Search by street address or customer name…" />
      {qresults.length > 0 && (
        <div className="section-card" style={{ padding: 8, maxWidth: 480, marginTop: 6 }}>
          {qresults.map((p) => (
            <button key={p.id} className="logout-button" style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 4 }} onClick={() => makeQr(p)}>
              {[p.street_address, p.unit, p.city].filter(Boolean).join(' ')}
              {p.customers?.display_name ? <span style={{ color: 'var(--mist)' }}> · {p.customers.display_name}</span> : ''}
            </button>
          ))}
        </div>
      )}
      {qr && (
        <div className="section-card" style={{ padding: 18, maxWidth: 360, marginTop: 12, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{qr.address}</div>
          <img alt="Service QR" src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=10&data=${encodeURIComponent(qr.url)}`} style={{ width: 240, height: 240 }} />
          <div style={{ fontSize: 12, color: 'var(--mist)', wordBreak: 'break-all', marginTop: 6 }}>{qr.url}</div>
          {qr.printed_at && (
            <div style={{ fontSize: 12, color: '#15803D', fontWeight: 700, marginTop: 6 }}>
              ✓ Flyer printed — property marked as having a QR code
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 10, flexWrap: 'wrap' }}>
            <button className="auth-button" style={{ width: 'auto' }} onClick={printFlyer}>Print label (top half)</button>
            <button className="logout-button" onClick={() => printQr(qr.url)}>Print code only</button>
            <button className="logout-button" onClick={() => window.open(`https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=0&data=${encodeURIComponent(qr.url)}`, '_blank')}>Open full-size</button>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  )
}
