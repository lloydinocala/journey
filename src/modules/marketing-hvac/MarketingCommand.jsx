import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabase'
import QuincyBrief from '../../QuincyBrief'
import './marketing.css'

export default function MarketingCommand({ profile }) {
  const isSuper = !profile?.org_id
  const [orgs, setOrgs] = useState([])
  const [selOrg, setSelOrg] = useState('')
  const orgId = profile?.org_id || selOrg
  const [m, setM] = useState(null)

  useEffect(() => {
    if (!isSuper) return
    supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
      const l = data || []
      setOrgs(l)
      const saved = localStorage.getItem('mkt_org')
      const pick = (saved && l.find((o) => o.id === saved)?.id)
        || l.find((o) => /journey \(platform\)/i.test(o.name))?.id
        || l[0]?.id || ''
      setSelOrg(pick)
    })
  }, [isSuper])
  function changeOrg(id) { setSelOrg(id); localStorage.setItem('mkt_org', id); setM(null) }

  useEffect(() => {
    if (!orgId) return
    async function load() {
      const countOf = async (table, filter) => {
        let q = supabase.from(table).select('*', { count: 'exact', head: true }).eq('org_id', orgId)
        if (filter) q = filter(q)
        const { count } = await q
        return count || 0
      }
      const [channels, campaigns, pending, leads, reviews] = await Promise.all([
        countOf('marketing_channels'),
        countOf('marketing_campaigns', (q) => q.eq('status', 'active')),
        countOf('marketing_content_items', (q) => q.eq('status', 'pending_review')),
        countOf('leads'),
        countOf('marketing_review_requests'),
      ])
      setM({ channels, campaigns, pending, leads, reviews })
    }
    load()
  }, [orgId])

  const kpis = m ? [
    { label: 'Channels', val: m.channels, sub: 'built-in + custom' },
    { label: 'Active campaigns', val: m.campaigns, sub: 'running now' },
    { label: 'Drafts to review', val: m.pending, sub: 'awaiting your yes' },
    { label: 'Leads (all time)', val: m.leads, sub: 'in Journey' },
    { label: 'Review requests', val: m.reviews, sub: 'sent + queued' },
  ] : []

  return (
    <div className="mkt">
      <div className="view-head">
        <h2>Command Center</h2>
        <p>Every channel and dollar measured against real booked revenue — pulled from Journey jobs, not vanity metrics.</p>
      </div>

      {isSuper && (
        <div className="card mb16">
          <div className="card-head">
            <h3>Marketing as</h3>
            <div className="spacer" />
            <select value={selOrg} onChange={(e) => changeOrg(e.target.value)} style={{ padding: '8px 11px', border: '1px solid #cdd7e1', borderRadius: 8, fontSize: 14, minWidth: 220 }}>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', margin: '4px 0 16px', padding: '11px 15px', borderRadius: 12, background: (m && m.pending > 0) ? '#FAF2E0' : '#E7F0F1', border: '1px solid ' + ((m && m.pending > 0) ? '#EAD3A0' : '#BCD7D9') }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <span style={{ width: 26, height: 26, flex: 'none', borderRadius: 999, background: '#fff', border: '1px solid ' + ((m && m.pending > 0) ? '#EAD3A0' : '#BCD7D9'), color: (m && m.pending > 0) ? '#9C6A12' : '#176E7A', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>{(m && m.pending > 0) ? '!' : '✦'}</span>
          <span style={{ fontSize: 14.5, fontWeight: 600, color: (m && m.pending > 0) ? '#9C6A12' : '#176E7A' }}>
            {!m ? 'Loading marketing…' : m.pending > 0 ? `${m.pending} draft${m.pending === 1 ? '' : 's'} awaiting your review.` : 'Nothing waiting on you — campaigns are running.'}
          </span>
        </div>
        <QuincyBrief kind="marketing" context={{
          draftsAwaitingReview: m ? m.pending : 0,
          activeCampaigns: m ? m.campaigns : 0,
          leadsAllTime: m ? m.leads : 0,
          reviewRequests: m ? m.reviews : 0,
          channels: m ? m.channels : 0,
        }} />
      </div>

      {!m ? <p className="muted">Loading…</p> : (
        <>
          <div className="kpis">
            {kpis.map((k) => (
              <div className="kpi" key={k.label}>
                <div className="label">{k.label}</div>
                <div className="val">{k.val}</div>
                <div className="sub">{k.sub}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-head"><h3>Revenue attribution</h3><span className="sub">channel → lead → job → paid invoice</span></div>
            <div className="card-body">
              <p className="muted" style={{ marginTop: 0 }}>
                The attribution ledger — spend/effort per channel measured against real paid invoices — wires in next.
                It needs two pieces now that the tables are live: the tracked-link resolver (<code>/r/&#123;slug&#125;</code>) that
                stamps each click/call onto a lead, and a link from a <code>lead</code> to the <code>job</code> it becomes so revenue can flow through.
              </p>
              <div className="note" style={{ marginTop: 14 }}>
                <span className="i">i</span>
                <span>Counts above are live from your database. The channel→revenue ledger and the SERP-stack panel come online once the resolver and the lead→job link are in.</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
