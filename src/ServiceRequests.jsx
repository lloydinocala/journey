import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

const CAT_LABEL = { repair: 'Repair', tuneup: 'Tune-up', question: 'Question' }
const URG_COLOR = { emergency: '#DC2626', soon: '#9a6a12', flexible: '#1b7a3d' }

export default function ServiceRequests({ profile }) {
  const isSuper = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [reqs, setReqs] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
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
      .eq('org_id', selectedOrg).eq('status', 'pending').order('created_at', { ascending: false })
    setReqs(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [selectedOrg])

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

  async function searchProps(v) {
    setQsearch(v)
    if (v.trim().length < 3) { setQresults([]); return }
    const { data } = await supabase.from('properties').select('id, street_address, unit, city')
      .eq('org_id', selectedOrg).ilike('street_address', `%${v.trim()}%`).limit(8)
    setQresults(data || [])
  }
  async function makeQr(p) {
    const { data, error } = await supabase.rpc('ensure_service_token', { p_property_id: p.id })
    if (error) { alert(error.message); return }
    const url = `${window.location.origin}/r/${data}`
    setQr({ url, address: [p.street_address, p.unit, p.city].filter(Boolean).join(' ') })
    setQresults([]); setQsearch('')
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div className="page-header-bar"><h2>Service Requests</h2></div>
      <p style={{ color: 'var(--mist)', fontSize: 14, marginTop: 4, marginBottom: 16, maxWidth: 680 }}>
        Requests from the QR service stickers (tenants & homeowners). Approve to create a job in the dispatch tray — billed to the property’s account holder.
      </p>

      {isSuper && (
        <div style={{ marginBottom: 16, maxWidth: 340 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      {loading ? <p style={{ color: 'var(--mist)' }}>Loading…</p>
        : reqs.length === 0 ? <div className="section-card" style={{ padding: 18 }}><p style={{ margin: 0 }}>No pending requests. 🎉</p></div>
        : (
          <div style={{ display: 'grid', gap: 10 }}>
            {reqs.map((r) => (
              <div key={r.id} className="section-card" style={{ padding: 14, borderLeft: `4px solid ${URG_COLOR[r.urgency] || 'var(--border)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <strong style={{ fontSize: 15 }}>{CAT_LABEL[r.category] || 'Request'}{r.urgency ? ` · ${r.urgency}` : ''}</strong>
                    <div style={{ fontSize: 13.5, color: 'var(--mist)', marginTop: 2 }}>
                      {[r.properties?.street_address, r.properties?.unit, r.properties?.city].filter(Boolean).join(' ')}
                      {r.properties?.customers?.display_name ? ` · Account: ${r.properties.customers.display_name}` : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--mist)' }}>{new Date(r.created_at).toLocaleString()}</div>
                </div>
                {r.details && <div style={{ margin: '8px 0', fontSize: 14 }}>{r.details}</div>}
                <div style={{ fontSize: 13, color: 'var(--mist)' }}>Reported by: {r.reporter_name || '—'}{r.reporter_phone ? ` · ${r.reporter_phone}` : ''}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button className="auth-button" style={{ width: 'auto' }} disabled={busyId === r.id} onClick={() => approve(r)}>{busyId === r.id ? 'Working…' : 'Approve → create job'}</button>
                  <button className="logout-button" disabled={busyId === r.id} onClick={() => decline(r)}>Decline</button>
                </div>
              </div>
            ))}
          </div>
        )}

      <h3 style={{ fontSize: 16, marginTop: 28 }}>Print a service QR sticker</h3>
      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0 }}>Find a property, generate its QR, and print it for the air handler. Scanning it opens this request page for that address.</p>
      <input className="cp-sel" style={{ maxWidth: 380, padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8 }}
        value={qsearch} onChange={(e) => searchProps(e.target.value)} placeholder="Search property by street address…" />
      {qresults.length > 0 && (
        <div className="section-card" style={{ padding: 8, maxWidth: 480, marginTop: 6 }}>
          {qresults.map((p) => (
            <button key={p.id} className="logout-button" style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 4 }} onClick={() => makeQr(p)}>
              {[p.street_address, p.unit, p.city].filter(Boolean).join(' ')}
            </button>
          ))}
        </div>
      )}
      {qr && (
        <div className="section-card" style={{ padding: 18, maxWidth: 360, marginTop: 12, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{qr.address}</div>
          <img alt="Service QR" src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=10&data=${encodeURIComponent(qr.url)}`} style={{ width: 240, height: 240 }} />
          <div style={{ fontSize: 12, color: 'var(--mist)', wordBreak: 'break-all', marginTop: 6 }}>{qr.url}</div>
          <button className="logout-button" style={{ marginTop: 10 }} onClick={() => window.open(`https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=20&data=${encodeURIComponent(qr.url)}`, '_blank')}>Open full-size to print</button>
        </div>
      )}
    </div>
  )
}
