import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

const money = (v) => '$' + (Number(v) || 0).toFixed(2)
const fmtDate = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '')

export default function CallConsole({ profile }) {
  const isSuper = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [phone, setPhone] = useState('')
  const [matches, setMatches] = useState(null)   // null = idle, [] = no match
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    if (isSuper) supabase.from('organizations').select('id, name').order('name').then(({ data }) => setOrgs(data || []))
  }, [isSuper])

  const digits = phone.replace(/\D/g, '')

  useEffect(() => {
    if (!selectedOrg || digits.length < 4) { setMatches(null); setSelected(null); setDetail(null); return }
    let live = true
    setSearching(true)
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('search_customers_by_phone', { p_org: selectedOrg, p_digits: digits })
      if (!live) return
      const rows = data || []
      setMatches(rows)
      setSearching(false)
      if (rows.length === 1) setSelected(rows[0])
      else setSelected(null)
    }, 350)
    return () => { live = false; clearTimeout(t) }
  }, [digits, selectedOrg])

  useEffect(() => {
    if (!selected) { setDetail(null); return }
    let live = true
    ;(async () => {
      const [props, plan, jobs, inv] = await Promise.all([
        supabase.from('properties').select('id, street_address, unit, city, state, zip').eq('customer_id', selected.id),
        supabase.from('maintenance_agreements').select('status, billing_cycle, tier:maintenance_agreement_tiers(name)').eq('customer_id', selected.id).eq('status', 'active'),
        supabase.from('jobs').select('id, job_number, job_date, status, job_type, date_pending').eq('customer_id', selected.id).is('deleted_at', null).neq('status', 'cancelled').order('job_date', { ascending: false }).limit(6),
        supabase.from('invoices').select('amount_due, paid_at, kind').eq('bills_to_customer_id', selected.id).eq('kind', 'invoice').is('paid_at', null),
      ])
      const properties = props.data || []
      const propIds = properties.map((p) => p.id)
      let equipCount = 0
      if (propIds.length) {
        const { count } = await supabase.from('property_equipment').select('id', { count: 'exact', head: true }).in('property_id', propIds).eq('status', 'active')
        equipCount = count || 0
      }
      const balance = (inv.data || []).reduce((s, i) => s + (Number(i.amount_due) || 0), 0)
      if (!live) return
      setDetail({ properties, plan: (plan.data || [])[0] || null, jobs: jobs.data || [], balance, equipCount })
    })()
    return () => { live = false }
  }, [selected])

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div className="page-header-bar"><h2>Call Console</h2></div>
      <p style={{ color: 'var(--mist)', fontSize: 14, marginTop: 4, marginBottom: 16, maxWidth: 640 }}>
        When a call comes in, type or paste the number to pull up the caller instantly — their history, equipment, plan, and balance — then open their record to book or answer questions.
      </p>

      {isSuper && (
        <div style={{ marginBottom: 16, maxWidth: 340 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      <div className="field" style={{ maxWidth: 380 }}>
        <label>Caller's phone number</label>
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(352) 555-1234" autoFocus
          style={{ fontSize: 20, letterSpacing: '0.5px', padding: '12px 14px' }} />
      </div>

      {digits.length >= 4 && (
        <div style={{ marginTop: 16 }}>
          {searching && <p style={{ color: 'var(--mist)' }}>Searching…</p>}

          {!searching && matches && matches.length === 0 && (
            <div className="section-card" style={{ padding: 18 }}>
              <p style={{ margin: '0 0 12px', fontWeight: 600 }}>No customer found for that number.</p>
              <Link className="auth-button" style={{ width: 'auto', display: 'inline-block', textDecoration: 'none', padding: '9px 18px' }} to="/customers">Add a new customer</Link>
            </div>
          )}

          {!searching && matches && matches.length > 1 && !selected && (
            <div className="section-card" style={{ padding: 12 }}>
              <div style={{ fontSize: 13, color: 'var(--mist)', marginBottom: 8 }}>{matches.length} matches — pick one:</div>
              {matches.map((m) => (
                <button key={m.id} className="logout-button" style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 6 }} onClick={() => setSelected(m)}>
                  <strong>{m.display_name}</strong>{m.company ? ` · ${m.company}` : ''} — {m.primary_phone || m.secondary_phone}
                </button>
              ))}
            </div>
          )}

          {selected && (
            <div className="section-card" style={{ padding: 20, borderLeft: selected.is_banned ? '4px solid #C0392B' : '4px solid var(--sky, #2F5DE3)' }}>
              {selected.is_banned && (
                <div style={{ background: '#FDECEC', color: '#B0342F', border: '1px solid #F5C6C6', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontWeight: 700, fontSize: 14 }}>
                  ⚠ BANNED CUSTOMER{selected.banned_reason ? ` — ${selected.banned_reason}` : ''}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{selected.display_name}</div>
                  {selected.company && <div style={{ color: 'var(--mist)' }}>{selected.company}</div>}
                  <div style={{ marginTop: 6, fontSize: 14.5 }}>
                    {selected.primary_phone && <div>📞 {selected.primary_phone}</div>}
                    {selected.secondary_phone && <div>📞 {selected.secondary_phone} <span style={{ color: 'var(--mist)', fontSize: 12 }}>(alt)</span></div>}
                    {selected.email_1 && <div>✉️ {selected.email_1}</div>}
                  </div>
                </div>
                <Link className="auth-button" style={{ width: 'auto', textDecoration: 'none', padding: '10px 20px', flex: 'none' }} to={`/customers/${selected.id}`}>Open full record →</Link>
              </div>

              {detail && (
                <>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '14px 0' }}>
                    {detail.plan
                      ? <span className="status-pill status-active">Plan: {detail.plan.tier?.name || 'Member'} ({detail.plan.billing_cycle || 'active'})</span>
                      : <span className="status-pill status-canceled">No maintenance plan</span>}
                    <span className="status-pill" style={{ background: detail.balance > 0 ? '#FDECEC' : 'rgba(46,160,87,0.14)', color: detail.balance > 0 ? '#B0342F' : '#1b7a3d' }}>
                      Balance: {money(detail.balance)}
                    </span>
                    <span className="status-pill" style={{ background: 'rgba(120,130,140,0.14)', color: 'var(--mist)' }}>{detail.equipCount} system{detail.equipCount === 1 ? '' : 's'} on file</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--mist)', marginBottom: 6 }}>Address{detail.properties.length > 1 ? 'es' : ''}</div>
                      {detail.properties.length === 0 && <div style={{ color: 'var(--mist)', fontSize: 14 }}>None on file</div>}
                      {detail.properties.map((p) => (
                        <div key={p.id} style={{ fontSize: 14, marginBottom: 4 }}>
                          {[p.street_address, p.unit].filter(Boolean).join(' ')}{p.city ? `, ${p.city}` : ''}{p.state ? ` ${p.state}` : ''} {p.zip || ''}
                        </div>
                      ))}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--mist)', marginBottom: 6 }}>Recent / open jobs</div>
                      {detail.jobs.length === 0 && <div style={{ color: 'var(--mist)', fontSize: 14 }}>No jobs on file</div>}
                      {detail.jobs.map((j) => (
                        <div key={j.id} style={{ fontSize: 14, marginBottom: 4 }}>
                          <strong>{j.job_number}</strong> · {j.job_type || 'Job'} · {fmtDate(j.job_date)} <span style={{ color: 'var(--mist)' }}>({j.date_pending ? 'needs dispatch' : j.status})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
