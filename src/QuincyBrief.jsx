// Shared "QuincyAI: brief me on today" widget — now domain-aware, so each
// dashboard gets a briefing about ITS OWN work, not one generic company summary.
//
// Every dashboard passes a `kind` naming its domain. Data-rich dashboards also
// pass their already-computed numbers as `context` (preferred — no extra query):
//   <QuincyBrief kind="inventory" context={{ lowStock, openPos, ... }} />
//   <QuincyBrief kind="fleet"     context={{ vehicles, compliance }} />
// The three summary sections that don't compute their own data (home, financials,
// admin) pass just `kind` + `org` and QuincyBrief self-fetches a snapshot scoped
// to that domain:
//   <QuincyBrief kind="financials" org={orgId} />
// It renders an inline AI panel (shared AiAssist / ai-assist edge function) that
// turns the live numbers into a short, prioritized briefing for THAT page.
import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import AiAssist from './AiAssist'

// Per-domain system prompts. Each keeps QuincyAI's voice but points it at the
// tasks that actually live on that page, so no two dashboards read alike.
const KIND_SYS = {
  operations: 'You are QuincyAI, the operations assistant for an HVAC company. Using ONLY the live dashboard numbers provided, write a short prioritized daily operations briefing for the owner/office. Lead with the most urgent money and deadlines (overdue A/R, estimates to chase, completed-but-not-invoiced work), then work that needs scheduling and maintenance coming due. Be specific with the actual counts and dollar amounts.',
  home: 'You are QuincyAI, the assistant for an HVAC company owner. Using ONLY the live numbers provided, write a short "start here" briefing for the whole business today — the few things across money, scheduling, and maintenance that most deserve attention right now. Be specific with the actual counts and dollar amounts.',
  financials: 'You are QuincyAI, the financial assistant for an HVAC company. Using ONLY the live numbers provided, write a short briefing focused strictly on money: outstanding A/R and the oldest/biggest balances to collect first, cash collected so far this week, and estimate dollars still out. Do not talk about scheduling or fleet. Be specific with the actual dollar amounts.',
  admin: 'You are QuincyAI, the administrative assistant for an HVAC company. Using ONLY the live numbers provided, write a short briefing focused on people and setup: on-call coverage gaps, anyone still clocked in (especially from a prior day), and staffing/setup items that need attention. Do not talk about A/R or sales. Be specific.',
  inventory: 'You are QuincyAI, the inventory assistant for an HVAC company. Using ONLY the live numbers provided, write a short briefing about the stockroom and purchasing: parts at or under reorder point, open purchase orders and deliveries expected, valuation, and any variance exceptions. Lead with low stock and anything overdue. Be specific with the actual counts and dollar amounts.',
  fleet: 'You are QuincyAI, the fleet assistant for an HVAC company. Using ONLY the provided data, brief the fleet manager: which vehicles need attention (red flags first, then amber) and why, plus compliance items such as insurance/registration expirations and inspections due. Name the specific vehicles. Lead with the single most important action.',
  hr: 'You are QuincyAI, the HR assistant for an HVAC company. Using ONLY the provided data, write a short briefing on people compliance: expiring or expired certifications and any open compliance flags, most urgent first, naming the employee or subject. Do not talk about A/R or inventory. Be specific.',
  payroll: 'You are QuincyAI, the payroll assistant for an HVAC company. Using ONLY the provided data, write a short briefing on payroll: the most recent pay run (checks, gross, net) and the tax to set aside for it, and whether a run looks due. Do not talk about A/R, sales, or inventory. Be specific with the dollar amounts.',
  maintenance: 'You are QuincyAI, the maintenance-agreements assistant for an HVAC company. Using ONLY the provided data, write a short briefing on the recurring-revenue book: recurring revenue on file, lapsed plans to win back, properties never offered a plan, and recently completed jobs whose property still has no plan (the "did we sell it?" sweep). Lead with the biggest retention/revenue opportunity. Be specific with the actual counts and dollar amounts.',
  marketing: 'You are QuincyAI, the marketing assistant for an HVAC company. Using ONLY the provided data, write a short briefing on demand generation: drafts awaiting review/approval, active campaigns, leads, and review requests. Lead with anything waiting on the owner (drafts to approve). Do not talk about A/R, fleet, or inventory. Be specific with the counts.',
  tools: 'You are QuincyAI, the tools assistant for an HVAC company. Using ONLY the provided data, write a short briefing on the tool fleet. LEAD with any follow-ups needed — tools past their anticipated return-to-service date that still are not back (name them and how many days late) — since those need chasing today. Then cover tools flagged for maintenance that must be repaired and verified before redeploying, tools currently in the shop for repair, and how many tools are deployed on trucks/techs versus available in the shop. Do not talk about A/R, sales, or parts inventory. Be specific with the counts.',
}

const COMMON_TAIL = ' 3 to 6 short lines, most urgent first. No greeting, no sign-off, no headers. If everything is clear or a number is zero, say so briefly rather than inventing problems.'

// Kinds whose dashboards do not compute their own numbers — QuincyBrief fetches a
// domain-scoped snapshot for these. Everything else passes `context` directly.
const SELF_FETCH = new Set(['home', 'financials', 'admin'])

const r = (n) => Math.round(Number(n) || 0)
const dstr = (d) => d.toISOString().slice(0, 10)

// Home + Financials both read the money/work book; each takes the slice its prompt uses.
async function fetchMoneySnapshot(org) {
  const now = new Date()
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0, 0, 0, 0)
  const in30 = new Date(now); in30.setDate(now.getDate() + 30)
  const [invRes, jobRes, agrRes, payRes] = await Promise.all([
    supabase.from('invoices').select('kind, sent_at, approval_status, paid_at, job_total, amount_due, total_paid').eq('org_id', org).is('deleted_at', null).eq('is_archived', false),
    supabase.from('jobs').select('status, date_pending').eq('org_id', org).is('deleted_at', null),
    supabase.from('maintenance_agreements').select('next_visit_due_date, status').eq('org_id', org),
    supabase.from('invoice_payments').select('amount, recorded_at').eq('org_id', org).gte('recorded_at', weekStart.toISOString()),
  ])
  const inv = invRes.data || [], jobs = jobRes.data || [], agr = agrRes.data || [], pays = payRes.data || []
  const bal = (i) => Number(i.amount_due || 0) - Number(i.total_paid || 0)
  const days = (d) => Math.floor((now - new Date(d)) / 86400000)
  const unpaid = inv.filter((i) => i.kind === 'invoice' && i.sent_at && !i.paid_at && bal(i) > 0.5)
  const arOver60 = unpaid.filter((i) => days(i.sent_at) >= 60)
  const pend = inv.filter((i) => i.kind === 'estimate' && i.sent_at && i.approval_status === 'Pending')
  const toSchedule = jobs.filter((j) => (j.status === 'unscheduled' || j.date_pending) && j.status !== 'canceled' && j.status !== 'completed')
  const maintDue = agr.filter((a) => a.next_visit_due_date && a.next_visit_due_date <= dstr(in30) && !['canceled', 'cancelled', 'expired'].includes((a.status || '').toLowerCase()))
  return {
    outstandingAR: r(unpaid.reduce((s, i) => s + bal(i), 0)),
    unpaidInvoices: unpaid.length,
    arOver60Days: arOver60.length,
    arOver60Value: r(arOver60.reduce((s, i) => s + bal(i), 0)),
    estimatesAwaitingReply: pend.length,
    estimatesOutValue: r(pend.reduce((s, i) => s + Number(i.job_total || 0), 0)),
    jobsToSchedule: toSchedule.length,
    maintenanceDueIn30d: maintDue.length,
    collectedThisWeek: r(pays.reduce((s, p) => s + Number(p.amount || 0), 0)),
  }
}

// Admin: people + setup — on-call coverage and open time-clock shifts.
async function fetchAdminSnapshot(org) {
  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const twoWeeksOut = new Date(now); twoWeeksOut.setDate(now.getDate() + 14)
  const [ocRes, tcRes] = await Promise.all([
    supabase.from('on_call_schedule').select('period_end').eq('org_id', org).order('period_end', { ascending: false }).limit(1),
    supabase.from('time_clock_events').select('clock_in, clock_out').eq('org_id', org).is('clock_out', null),
  ])
  const onCallEnd = ocRes.data && ocRes.data[0] ? ocRes.data[0].period_end : null
  const open = tcRes.data || []
  const stale = open.filter((e) => e.clock_in && new Date(e.clock_in) < todayStart)
  return {
    onCallCoveredThrough: onCallEnd ? dstr(new Date(onCallEnd)) : null,
    onCallCoverageShort: !onCallEnd || new Date(onCallEnd) < twoWeeksOut,
    clockedInNow: open.length,
    clockedInFromPriorDay: stale.length,
  }
}

async function fetchSnapshot(kind, org) {
  if (!org) return {}
  if (kind === 'admin') return fetchAdminSnapshot(org)
  return fetchMoneySnapshot(org) // home + financials
}

export default function QuincyBrief({ kind = 'operations', org, context, system, prompt, title = "Today's briefing", label = '✦ QuincyAI: brief me on today' }) {
  const selfFetch = SELF_FETCH.has(kind) && !context
  const [snap, setSnap] = useState(context || null)

  useEffect(() => {
    if (context) { setSnap(context); return undefined }
    if (!selfFetch) return undefined
    let alive = true
    fetchSnapshot(kind, org).then((s) => { if (alive) setSnap(s) })
    return () => { alive = false }
  }, [kind, org, context, selfFetch])

  const sys = system || ((KIND_SYS[kind] || KIND_SYS.operations) + COMMON_TAIL)

  return (
    <AiAssist inline title={title} label={label}
      system={sys}
      prompt={prompt || 'Using the live numbers for this page, give me a short prioritized briefing — what to tackle first and why, referencing the actual counts and dollar amounts.'}
      context={snap || {}} />
  )
}
