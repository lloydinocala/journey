import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabase'
import AiAssist from '../../AiAssist'
import { num, phaseLabel, approvedCoTotal, pendingCoTotal } from './data'
import { loadCostPicture } from './cost'
import { submittalFlag, rfiFlag, equipmentFlag, inspectionFlag, punchFlag } from './logConfigs'

const SYSTEM = `You write a short status briefing for the project manager of a commercial HVAC project.
Write 4 to 7 plain sentences, most important first: what moved recently, what is late or at risk, and what money is at risk.
Name the specific items (equipment tags, submittal and RFI numbers, change order numbers) from the facts.
Every number you state must come from the facts. If the budget is empty, say cost tracking has not been set up rather than guessing margins.
Do not invent progress, dates, or causes. If nothing is late, say so plainly.`

// Overview · "Quincy, brief me": gathers the project's facts, then asks for a
// briefing the PM reads and can copy. It never changes anything.
export default function ProjectBriefing({ project, latest, cos, apps }) {
  const [facts, setFacts] = useState(null)
  useEffect(() => {
    let alive = true
    ;(async () => {
      const since = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10)
      const [pic, { data: subs }, { data: rfis }, { data: equip }, { data: insp }, { data: punch }, { data: logs }] = await Promise.all([
        loadCostPicture(project),
        supabase.from('cp_submittals').select('number, title, status, due_date').eq('project_id', project.id),
        supabase.from('cp_rfis').select('number, subject, status, needed_by, cost_impact, schedule_impact, change_order_id').eq('project_id', project.id),
        supabase.from('cp_equipment').select('tag, description, status, lead_time_weeks, promised_ship_date, need_by_date').eq('project_id', project.id),
        supabase.from('cp_inspections').select('inspection_type, status, scheduled_date, result_date').eq('project_id', project.id),
        supabase.from('cp_punch_items').select('number, description, status, due_date').eq('project_id', project.id),
        supabase.from('cp_daily_logs').select('log_date, crew_hours, work_performed, delays').eq('project_id', project.id).gte('log_date', since).order('log_date', { ascending: false }).limit(10),
      ])
      if (!alive) return
      const flagged = (list, fn, name) => (list || []).map((r) => ({ r, f: fn(r) })).filter((x) => x.f).map((x) => `${name(x.r)}: ${x.f.text}`)
      setFacts({
        project: { name: project.name, phase: phaseLabel(project.phase), status: project.status },
        money: {
          original_contract: num(project.original_contract), approved_change_orders: approvedCoTotal(cos), pending_change_orders: pendingCoTotal(cos),
          contract_to_date: pic.contract, last_pay_application: latest ? { number: latest.app_number, period_to: latest.period_to, completed_and_stored: num(latest.total_completed), certified: num(latest.earned_less_retainage), retainage_held: num(latest.retainage_amount) } : 'none submitted yet',
          draft_pay_application_open: !!(apps || []).find((a) => a.status === 'draft'),
          budget: pic.hasBudget ? { budgeted_cost: Math.round(pic.budgetTotal), actual_cost: Math.round(pic.actualTotal), forecast_cost_at_completion: Math.round(pic.eacTotal), projected_margin: Math.round(pic.projectedMargin), planned_margin: Math.round(pic.budgetMargin), over_or_under_billed: Math.round(pic.overUnder), lines_spending_ahead_of_progress: pic.lines.filter((l) => l.fade).map((l) => l.line.description) } : 'no budget entered',
        },
        attention: [
          ...flagged(equip, equipmentFlag, (r) => `Equipment ${r.tag || r.description}`),
          ...flagged(subs, submittalFlag, (r) => `Submittal #${r.number} ${r.title}`),
          ...flagged(rfis, rfiFlag, (r) => `RFI #${r.number} ${r.subject}`),
          ...flagged(insp, inspectionFlag, (r) => r.inspection_type),
          ...flagged(punch, punchFlag, (r) => `Punch #${r.number}`),
        ],
        counts: {
          open_submittals: (subs || []).filter((r) => !['approved', 'approved_as_noted'].includes(r.status)).length,
          open_rfis: (rfis || []).filter((r) => r.status !== 'closed').length,
          equipment_not_yet_set: (equip || []).filter((r) => r.status !== 'set').length,
          open_punch_items: (punch || []).filter((r) => r.status !== 'verified').length,
        },
        recent_daily_logs: (logs || []).map((l) => ({ date: l.log_date, crew_hours: l.crew_hours, work: (l.work_performed || '').slice(0, 300), delays: l.delays || undefined })),
      })
    })()
    return () => { alive = false }
  }, [project, latest, cos, apps])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
      {facts ? (
        <AiAssist title="Project briefing" label="Quincy: brief me on this project" system={SYSTEM}
          prompt="Write the status briefing for this project." context={facts} />
      ) : <span style={{ fontSize: 13, color: 'var(--mist)' }}>Gathering project facts for Quincy…</span>}
      {facts && facts.attention.length > 0 && <span style={{ fontSize: 13, color: '#9a6a12', fontWeight: 600 }}>{facts.attention.length} item{facts.attention.length === 1 ? '' : 's'} need attention</span>}
    </div>
  )
}
