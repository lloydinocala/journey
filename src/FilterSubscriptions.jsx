import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

const num = (v) => (v == null ? '' : String(v).replace(/\.0+$/, ''))
const fmt = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '')
const todayStr = () => new Date().toISOString().slice(0, 10)

export default function FilterSubscriptions({ profile }) {
  const isSuper = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [subs, setSubs] = useState([])
  const [loading, setLoading] = useState(true)
  const [discount, setDiscount] = useState(10)
  const [discSaved, setDiscSaved] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [msg, setMsg] = useState('')

  useEffect(() => { if (isSuper) supabase.from('organizations').select('id, name').order('name').then(({ data }) => setOrgs(data || [])) }, [isSuper])

  async function load() {
    if (!selectedOrg) return
    setLoading(true); setMsg('')
    const { data: org } = await supabase.from('organizations').select('filter_subscription_discount_pct').eq('id', selectedOrg).single()
    setDiscount(Number(org?.filter_subscription_discount_pct ?? 10))
    const { data } = await supabase.from('filter_subscriptions').select('*')
      .eq('org_id', selectedOrg).neq('status', 'canceled').order('next_ship_date', { ascending: true })
    const rows = data || []
    const custIds = [...new Set(rows.map((r) => r.customer_id))]
    const propIds = [...new Set(rows.map((r) => r.property_id))]
    const [{ data: custs }, { data: props }] = await Promise.all([
      custIds.length ? supabase.from('customers').select('id, display_name').in('id', custIds) : Promise.resolve({ data: [] }),
      propIds.length ? supabase.from('properties').select('id, street_address, city').in('id', propIds) : Promise.resolve({ data: [] }),
    ])
    const cById = Object.fromEntries((custs || []).map((c) => [c.id, c]))
    const pById = Object.fromEntries((props || []).map((p) => [p.id, p]))
    setSubs(rows.map((r) => ({ ...r, customer: cById[r.customer_id] || null, property: pById[r.property_id] || null })))
    setLoading(false)
  }
  useEffect(() => { load() }, [selectedOrg])

  async function saveDiscount() {
    await supabase.from('organizations').update({ filter_subscription_discount_pct: Number(discount) || 0 }).eq('id', selectedOrg)
    setDiscSaved(true); setTimeout(() => setDiscSaved(false), 2500)
  }
  async function generate(sub) {
    setBusyId(sub.id); setMsg('')
    const { data, error } = await supabase.functions.invoke('generate-subscription-order', { body: { subscription_id: sub.id } })
    setBusyId(null)
    if (error || data?.error) { setMsg(`${sub.customer?.display_name || 'Order'}: ${data?.error || error?.message || 'failed'}`); return }
    setMsg(`${sub.customer?.display_name || 'Customer'}: ${data.invoiceNumber} for $${data.amountDue.toFixed(2)} — ${data.emailed ? 'emailed' : 'created'}. Next ship ${fmt(data.nextShip)}.`)
    load()
  }
  async function setStatus(id, status) { await supabase.from('filter_subscriptions').update({ status }).eq('id', id); load() }
  async function cancel(id) { if (!window.confirm('Cancel this subscription?')) return; await supabase.from('filter_subscriptions').update({ status: 'canceled' }).eq('id', id); load() }

  const due = subs.filter((s) => s.status === 'active' && s.next_ship_date <= todayStr())

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div className="page-header-bar"><h2>Filter Subscriptions</h2></div>
      <p style={{ color: 'var(--mist)', fontSize: 14, marginTop: 4, marginBottom: 16, maxWidth: 680 }}>
        Customer auto-ship filter subscriptions. Generate a due cycle's order in one click — it prices from the book, applies the subscription discount, invoices &amp; emails the customer, and advances the next ship date.
      </p>

      {isSuper && (
        <div style={{ marginBottom: 14, maxWidth: 340 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 14, fontWeight: 600 }}>Subscription discount</label>
        <input type="number" min="0" max="100" value={discount} onChange={(e) => setDiscount(e.target.value)} style={{ width: 70, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 8 }} />
        <span style={{ color: 'var(--mist)' }}>%</span>
        <button className="logout-button" onClick={saveDiscount}>Save</button>
        {discSaved && <span style={{ color: '#1a7f37', fontSize: 14 }}>Saved ✓</span>}
      </div>

      {msg && <div className="section-card" style={{ padding: 12, marginBottom: 14, fontSize: 14 }}>{msg}</div>}

      {loading ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : subs.length === 0 ? (
        <div className="section-card" style={{ padding: 18 }}><p style={{ margin: 0 }}>No active subscriptions yet. Customers set these up in the portal under My AC Filters.</p></div>
      ) : (
        <>
          {due.length > 0 && <div style={{ fontSize: 13, fontWeight: 800, color: '#B0342F', margin: '4px 0 8px', textTransform: 'uppercase', letterSpacing: '.04em' }}>Due now ({due.length})</div>}
          <div style={{ display: 'grid', gap: 10 }}>
            {subs.map((s) => {
              const isDue = s.status === 'active' && s.next_ship_date <= todayStr()
              return (
                <div key={s.id} style={{ background: 'var(--panel)', border: `1px solid ${isDue ? 'rgba(176,52,47,.4)' : 'rgba(255,255,255,0.08)'}`, borderLeft: `4px solid ${isDue ? '#B0342F' : s.status === 'paused' ? '#9a6a12' : '#1a7f37'}`, borderRadius: 10, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{s.customer?.display_name || 'Customer'} — <span style={{ fontWeight: 400 }}>{[s.property?.street_address, s.property?.city].filter(Boolean).join(', ')}</span></div>
                      <div style={{ fontSize: 13.5, marginTop: 3 }}>
                        <b>{[num(s.width), num(s.height), num(s.thickness)].filter(Boolean).join('x')}{s.merv ? ` MERV ${s.merv}` : ''}</b> · qty {s.quantity} · every {s.cadence_days} days
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--mist)', marginTop: 2 }}>
                        {s.status === 'paused' ? 'Paused' : <>Next ship <b style={{ color: isDue ? '#B0342F' : 'inherit' }}>{fmt(s.next_ship_date)}{isDue ? ' — due' : ''}</b></>}
                        {s.last_ordered_at ? ` · last ordered ${new Date(s.last_ordered_at).toLocaleDateString()}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {s.status === 'active' && <button className="auth-button" style={{ width: 'auto', padding: '7px 14px' }} disabled={busyId === s.id} onClick={() => generate(s)}>{busyId === s.id ? 'Generating…' : 'Generate order'}</button>}
                      {s.status === 'active'
                        ? <button className="logout-button" onClick={() => setStatus(s.id, 'paused')}>Pause</button>
                        : <button className="logout-button" onClick={() => setStatus(s.id, 'active')}>Resume</button>}
                      <button className="logout-button" style={{ color: '#B0342F' }} onClick={() => cancel(s.id)}>Cancel</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
