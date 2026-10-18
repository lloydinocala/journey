import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import OrgPicker from '../../OrgPicker'
import { money, num, fmtDate, phaseLabel, useOrg, tileStyle } from './data'
import { submittalFlag, rfiFlag, equipmentFlag, inspectionFlag, punchFlag } from './logConfigs'

// Commercial Projects · Dashboard — the money summary across all active
// commercial projects, then the items that need someone's attention.
export default function CommercialDashboard({ profile }) {
  const { isSuper, orgs, orgId, setOrgId } = useOrg(profile)
  const [data, setData] = useState(null)

  const load = useCallback(async () => {
    if (!orgId) { setData(null); return }
    const [{ data: projects }, { data: apps }, { data: sov }, { data: cos }, { data: subs }, { data: rfis }, { data: equip }, { data: insp }, { data: punch }] = await Promise.all([
      supabase.from('cp_projects').select('id, name, project_number, status, phase, original_contract, gates').eq('org_id', orgId),
      supabase.from('cp_pay_apps').select('id, project_id, app_number, status, period_to, total_completed, retainage_amount, earned_less_retainage, current_payment_due, invoice_id').eq('org_id', orgId).order('app_number'),
      supabase.from('cp_sov_lines').select('project_id, scheduled_value').eq('org_id', orgId),
      supabase.from('cp_change_orders').select('id, project_id, co_number, title, status, amount, sent_date').eq('org_id', orgId),
      supabase.from('cp_submittals').select('id, project_id, number, title, status, due_date').eq('org_id', orgId),
      supabase.from('cp_rfis').select('id, project_id, number, subject, status, needed_by, cost_impact, schedule_impact, change_order_id').eq('org_id', orgId),
      supabase.from('cp_equipment').select('id, project_id, tag, description, status, lead_time_weeks, promised_ship_date, need_by_date').eq('org_id', orgId),
      supabase.from('cp_inspections').select('id, project_id, inspection_type, status, scheduled_date').eq('org_id', orgId),
      supabase.from('cp_punch_items').select('id, project_id, number, description, status, due_date').eq('org_id', orgId),
    ])
    const invIds = (apps || []).map((a) => a.invoice_id).filter(Boolean)
    let inv = {}
    if (invIds.length) {
      const { data: iv } = await supabase.from('invoices').select('id, invoice_number, paid_at, invoice_date').in('id', invIds)
      inv = Object.fromEntries((iv || []).map((i) => [i.id, i]))
    }
    setData({ projects: projects || [], apps: apps || [], sov: sov || [], cos: cos || [], subs: subs || [], rfis: rfis || [], equip: equip || [], insp: insp || [], punch: punch || [], inv })
  }, [orgId])
  useEffect(() => { load() }, [load])

  const head = (
    <>
      <h2 className="page-title">Commercial Projects Dashboard</h2>
      {isSuper && <div style={{ marginBottom: 14 }}><OrgPicker orgs={orgs} value={orgId} onChange={setOrgId} /></div>}
    </>
  )
  if (!data) return <div>{head}<p style={{ color: 'var(--mist)' }}>Loading…</p></div>

  const active = data.projects.filter((p) => p.status === 'active' || p.status === 'on_hold')
  const latest = {}, draft = {}
  for (const a of data.apps) { if (a.status === 'submitted') latest[a.project_id] = a; else draft[a.project_id] = a }
  const sovTotal = {}
  for (const l of data.sov) sovTotal[l.project_id] = num(sovTotal[l.project_id]) + num(l.scheduled_value)
  const coApproved = {}
  for (const c of data.cos) if (c.status === 'approved') coApproved[c.project_id] = num(coApproved[c.project_id]) + num(c.amount)
  const contractOf = (p) => num(p.original_contract) + num(coApproved[p.id])
  const pendingCos = data.cos.filter((c) => c.status === 'draft' || c.status === 'sent')
  const pendingAmt = pendingCos.reduce((s, c) => s + num(c.amount), 0)
  const contractValue = active.reduce((s, p) => s + contractOf(p), 0)
  const certified = active.reduce((s, p) => s + num(latest[p.id]?.earned_less_retainage), 0)
  const retainage = data.projects.reduce((s, p) => s + (p.gates?.retainage_released ? 0 : num(latest[p.id]?.retainage_amount)), 0)
  const unpaid = data.apps.filter((a) => a.invoice_id && data.inv[a.invoice_id] && !data.inv[a.invoice_id].paid_at)
  const unpaidAmt = unpaid.reduce((s, a) => s + num(a.current_payment_due), 0)

  const now = Date.now(), DAY = 864e5
  const attention = []
  for (const p of active) {
    const l = latest[p.id], d = draft[p.id]
    if (Math.abs(num(sovTotal[p.id]) - contractOf(p)) > 0.005)
      attention.push({ p, tone: 'red', text: `Schedule of values (${money(sovTotal[p.id] || 0)}) doesn't match the contract sum to date (${money(contractOf(p))})` })
    if (d) attention.push({ p, tone: 'amber', text: `Pay application #${d.app_number} is still a draft`, to: `/commercial/pay-apps/${d.id}` })
    else if (p.status === 'active' && (!l || (l.period_to && now - Date.parse(l.period_to) > 30 * DAY)))
      attention.push({ p, tone: 'amber', text: l ? `Last billed for the period to ${fmtDate(l.period_to)} — over 30 days ago` : 'No pay application yet' })
  }
  for (const a of unpaid) {
    const i = data.inv[a.invoice_id], p = data.projects.find((x) => x.id === a.project_id)
    const age = i?.invoice_date ? Math.floor((now - Date.parse(i.invoice_date)) / DAY) : 0
    if (age > 30 && p) attention.push({ p, tone: 'red', text: `Pay application #${a.app_number} (${i.invoice_number}, ${money(a.current_payment_due)}) unpaid for ${age} days`, to: `/commercial/pay-apps/${a.id}` })
  }
  for (const c of pendingCos) {
    const p = data.projects.find((x) => x.id === c.project_id)
    const age = c.status === 'sent' && c.sent_date ? Math.floor((now - Date.parse(c.sent_date)) / DAY) : 0
    if (p && age > 14) attention.push({ p, tone: 'amber', text: `Change order #${c.co_number} (${money(c.amount)}) waiting on approval for ${age} days`, to: `/commercial/change-orders/${c.id}` })
  }
  const activeIds = new Set(active.map((p) => p.id))
  const pushFlags = (list, flagFn, labelFn, tab) => {
    for (const r of list) {
      if (!activeIds.has(r.project_id)) continue
      const f = flagFn(r); if (!f) continue
      const p = data.projects.find((x) => x.id === r.project_id)
      attention.push({ p, tone: f.tone, text: `${labelFn(r)}: ${f.text}`, to: `/commercial/projects/${p.id}?tab=${tab}` })
    }
  }
  pushFlags(data.equip, equipmentFlag, (r) => `Equipment ${r.tag || r.description}`, 'equip')
  pushFlags(data.subs, submittalFlag, (r) => `Submittal #${r.number} ${r.title}`, 'subs')
  pushFlags(data.rfis, rfiFlag, (r) => `RFI #${r.number} ${r.subject}`, 'subs')
  pushFlags(data.insp, inspectionFlag, (r) => r.inspection_type, 'field')
  const overduePunch = {}
  for (const r of data.punch) if (activeIds.has(r.project_id) && punchFlag(r)?.tone === 'red') overduePunch[r.project_id] = (overduePunch[r.project_id] || 0) + 1
  for (const [pid, n] of Object.entries(overduePunch)) {
    const p = data.projects.find((x) => x.id === pid)
    attention.push({ p, tone: 'red', text: `${n} overdue punch item${n === 1 ? '' : 's'}`, to: `/commercial/projects/${pid}?tab=field` })
  }
  attention.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'red' ? -1 : 1))
  for (const p of data.projects) {
    if ((p.status === 'complete' || p.phase === 'closeout') && !p.gates?.retainage_released && num(latest[p.id]?.retainage_amount) > 0)
      attention.push({ p, tone: 'amber', text: `${money(latest[p.id].retainage_amount)} retainage still held at closeout` })
  }
  const toneColor = { red: '#B00020', amber: '#9a6a12' }

  const tile = (label, val, note) => (
    <div style={tileStyle}><div style={{ fontSize: 12, color: 'var(--mist)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800 }}>{val}</div>{note ? <div style={{ fontSize: 12, color: 'var(--mist)' }}>{note}</div> : null}</div>
  )
  return (
    <div>
      {head}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 22 }}>
        {tile('Active projects', active.length, `${data.projects.length} total`)}
        {tile('Contract value (active)', money(contractValue))}
        {tile('Certified to date (active)', money(certified))}
        {tile('Retainage held', money(retainage), 'Collected at closeout')}
        {tile('Awaiting payment', money(unpaidAmt), `${unpaid.length} pay application${unpaid.length === 1 ? '' : 's'}`)}
        {tile('Pending change orders', money(pendingAmt), `${pendingCos.length} not yet approved`)}
      </div>

      <h3 style={{ fontSize: 16, margin: '0 0 8px' }}>Needs attention</h3>
      {attention.length === 0 ? <p style={{ color: 'var(--mist)' }}>Nothing needs attention right now.</p> : (
        <div style={{ display: 'grid', gap: 6, marginBottom: 24 }}>
          {attention.map((x, i) => (
            <Link key={i} to={x.to || `/commercial/projects/${x.p.id}`} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 14px', background: 'var(--panel)', border: '1px solid var(--line-strong)', borderLeft: `4px solid ${toneColor[x.tone]}`, borderRadius: 8, textDecoration: 'none', color: 'inherit' }}>
              <strong style={{ minWidth: 200 }}>{x.p.name}</strong><span style={{ flex: 1 }}>{x.text}</span><span style={{ color: 'var(--mist)' }}>›</span>
            </Link>
          ))}
        </div>
      )}

      <h3 style={{ fontSize: 16, margin: '0 0 8px' }}>Active projects</h3>
      {active.length === 0 ? <p style={{ color: 'var(--mist)' }}>No active commercial projects. <Link to="/commercial/projects">Start one</Link>.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: 760 }}>
            <thead><tr><th>Project</th><th>Phase</th><th style={{ textAlign: 'right' }}>Contract</th><th style={{ textAlign: 'right' }}>Completed</th><th style={{ textAlign: 'right' }}>Certified</th></tr></thead>
            <tbody>{active.map((p) => {
              const l = latest[p.id], c = contractOf(p), done = num(l?.total_completed)
              return (
                <tr key={p.id}>
                  <td><Link to={`/commercial/projects/${p.id}`}>{p.name}</Link> <span style={{ color: 'var(--mist)', fontSize: 12 }}>{p.project_number}</span></td>
                  <td>{phaseLabel(p.phase)}</td><td style={{ textAlign: 'right' }}>{money(c)}</td>
                  <td style={{ textAlign: 'right' }}>{c ? ((done / c) * 100).toFixed(1) + '%' : '—'}</td><td style={{ textAlign: 'right' }}>{money(l?.earned_less_retainage || 0)}</td>
                </tr>
              )
            })}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}
