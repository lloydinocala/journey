// Shared "QuincyAI: brief me on today" widget. Drop it on any dashboard:
//   <QuincyBrief org={selectedOrg} />                         // self-fetches a snapshot
//   <QuincyBrief context={{ ...dashboardNumbers }} />         // pass a dashboard's own data
// It renders an inline AI panel (via the shared AiAssist / ai-assist edge function)
// that turns the live numbers into a short prioritized daily briefing.
import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import AiAssist from './AiAssist'

const BRIEF_SYS = 'You are QuincyAI, the operations assistant for an HVAC company. Using ONLY the live dashboard numbers provided, write a short prioritized briefing for the owner/office. Lead with the most urgent money and deadlines (overdue A/R, estimates to chase), then work that needs scheduling and maintenance coming due. Be specific with the actual counts and dollar amounts. 3 to 6 short lines, most urgent first. No greeting, no sign-off, no headers. If a number is zero, do not invent problems.'

// A compact org snapshot for dashboards that don't already compute one.
async function fetchSnapshot(org) {
  if (!org) return {}
  const now = new Date()
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0, 0, 0, 0)
  const in30 = new Date(now); in30.setDate(now.getDate() + 30)
  const dstr = (d) => d.toISOString().slice(0, 10)
  const [invRes, jobRes, agrRes, payRes] = await Promise.all([
    supabase.from('invoices').select('kind, sent_at, approval_status, paid_at, job_total, amount_due, total_paid').eq('org_id', org).is('deleted_at', null).eq('is_archived', false),
    supabase.from('jobs').select('status, date_pending').eq('org_id', org).is('deleted_at', null),
    supabase.from('maintenance_agreements').select('next_visit_due_date, status').eq('org_id', org),
    supabase.from('invoice_payments').select('amount, recorded_at').eq('org_id', org).gte('recorded_at', weekStart.toISOString()),
  ])
  const inv = invRes.data || [], jobs = jobRes.data || [], agr = agrRes.data || [], pays = payRes.data || []
  const bal = (i) => Number(i.amount_due || 0) - Number(i.total_paid || 0)
  const unpaid = inv.filter((i) => i.kind === 'invoice' && i.sent_at && !i.paid_at && bal(i) > 0.5)
  const pend = inv.filter((i) => i.kind === 'estimate' && i.sent_at && i.approval_status === 'Pending')
  const toSchedule = jobs.filter((j) => (j.status === 'unscheduled' || j.date_pending) && j.status !== 'canceled' && j.status !== 'completed')
  const maintDue = agr.filter((a) => a.next_visit_due_date && a.next_visit_due_date <= dstr(in30) && !['canceled', 'cancelled', 'expired'].includes((a.status || '').toLowerCase()))
  const r = (n) => Math.round(n)
  return {
    outstandingAR: r(unpaid.reduce((s, i) => s + bal(i), 0)),
    unpaidInvoices: unpaid.length,
    estimatesAwaitingReply: pend.length,
    estimatesOutValue: r(pend.reduce((s, i) => s + Number(i.job_total || 0), 0)),
    jobsToSchedule: toSchedule.length,
    maintenanceDueIn30d: maintDue.length,
    collectedThisWeek: r(pays.reduce((s, p) => s + Number(p.amount || 0), 0)),
  }
}

export default function QuincyBrief({ org, context, system, prompt, title = "Today's briefing" }) {
  const [snap, setSnap] = useState(context || null)
  useEffect(() => {
    if (context) { setSnap(context); return undefined }
    let alive = true
    fetchSnapshot(org).then((s) => { if (alive) setSnap(s) })
    return () => { alive = false }
  }, [org, context])

  return (
    <AiAssist inline title={title} label="✦ QuincyAI: brief me on today"
      system={system || BRIEF_SYS}
      prompt={prompt || 'Using the live numbers, give me a short prioritized briefing for today — what to tackle first and why, referencing the actual counts and dollar amounts.'}
      context={snap || {}} />
  )
}
