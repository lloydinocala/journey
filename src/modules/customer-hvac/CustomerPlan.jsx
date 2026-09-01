import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'

const date = (d) => d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''

export default function CustomerPlan({ customer, properties }) {
  const nav = useNavigate()
  const [agreements, setAgreements] = useState([])
  const [tiers, setTiers] = useState({})
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let live = true
    async function load() {
      const [aRes, vRes] = await Promise.all([
        supabase.from('maintenance_agreements')
          .select('id, tier_id, status, billing_cycle, price, start_date, next_visit_due_date, property_id')
          .eq('customer_id', customer.id).eq('status', 'active'),
        supabase.from('maintenance_visits')
          .select('id, due_date, status, period_label, completed_date')
          .eq('customer_id', customer.id).order('due_date', { ascending: true }),
      ])
      const ags = aRes.data || []
      let tmap = {}
      if (ags.length) {
        const { data: t } = await supabase.from('maintenance_agreement_tiers')
          .select('id, name').in('id', ags.map(a => a.tier_id).filter(Boolean))
        ;(t || []).forEach(x => { tmap[x.id] = x.name })
      }
      if (!live) return
      setAgreements(ags); setTiers(tmap); setVisits(vRes.data || []); setLoading(false)
    }
    load()
    return () => { live = false }
  }, [customer.id])

  const upcoming = visits.filter(v => v.status !== 'completed').slice(0, 3)

  return (
    <div className="cp-wrap">
      <button className="cp-back" onClick={() => nav('/portal')}>‹ Home</button>
      <h2 className="cp-h2">My plan</h2>

      {loading ? <div className="cp-empty">Loading…</div> : agreements.length ? (
        <>
          <p className="cp-lead">You’re a member — thank you! Here’s where things stand.</p>
          {agreements.map(a => (
            <div className="cp-card" key={a.id}>
              <div className="cp-row" style={{ borderBottom: 0, paddingTop: 0 }}>
                <div className="cp-main">
                  <b style={{ fontSize: 17 }}>{tiers[a.tier_id] || 'Maintenance'} plan</b>
                  <span>{a.billing_cycle === 'annual' ? 'Billed annually' : 'Billed monthly'} · ${Number(a.price || 0).toFixed(2)}</span>
                </div>
                <span className="cp-pill ok">Active</span>
              </div>
              {a.next_visit_due_date && (
                <div className="cp-note" style={{ marginTop: 4 }}>Next visit due: <b>{date(a.next_visit_due_date)}</b></div>
              )}
            </div>
          ))}

          <div className="cp-label">Your visits</div>
          <div className="cp-card">
            {upcoming.length ? upcoming.map(v => (
              <div className="cp-row" key={v.id}>
                <div className="cp-main">
                  <b>{v.period_label || 'Maintenance visit'}</b>
                  <span>Due {date(v.due_date)}</span>
                </div>
                <span className="cp-pill pend">Upcoming</span>
              </div>
            )) : <div className="cp-empty">No upcoming visits scheduled.</div>}
          </div>
          <button className="cp-btn ghost" onClick={() => nav('/portal/request/pm')}>Ask us to schedule a visit</button>
        </>
      ) : (
        <>
          <p className="cp-lead">You’re not on a maintenance plan yet — here’s why members love it.</p>
          <div className="cp-card">
            {[
              ['Two tune-ups a year', 'We keep your system running efficiently and catch small problems early.'],
              ['Priority scheduling', 'Members go to the front of the line when you need us.'],
              ['Member savings', 'Discounts on repairs and no overtime fees.'],
            ].map(([t, d]) => (
              <div className="cp-row" key={t}>
                <div className="cp-main"><b>{t}</b><span>{d}</span></div>
              </div>
            ))}
          </div>
          {properties[0]
            ? <a className="cp-btn" href={`/join-plan/${properties[0].id}`} style={{ textDecoration: 'none' }}>See plans & join</a>
            : <button className="cp-btn ghost" onClick={() => nav('/portal/request/pm')}>Ask us about a plan</button>}
          <p className="cp-note">Takes a couple of minutes — pick a tier and you’re covered.</p>
        </>
      )}
    </div>
  )
}
