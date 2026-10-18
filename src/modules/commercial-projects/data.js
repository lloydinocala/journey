// Commercial Projects · shared data + math.
// The continuation-sheet math lives HERE (for drafts, shown live) and in the
// database function cp_submit_pay_app (for submitted applications, locked).
// Both follow the standard Application for Payment layout:
//   D previous work · E this period · F materials presently stored
//   G = D + E + F · % = G / C · H = C − G · retainage on (D+E) and on F.
import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabase'

export const money = (v) => (v == null || v === '' || isNaN(Number(v)) ? '—'
  : (Number(v) < 0 ? '−$' : '$') + Math.abs(Number(v)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
export const pct = (v) => (v == null || !isFinite(v) ? '—' : (v * 100).toFixed(1) + '%')
export const num = (v) => (v === '' || v == null || isNaN(Number(v)) ? 0 : Number(v))
export const r2 = (v) => Math.round(num(v) * 100) / 100
export const today = () => new Date().toISOString().slice(0, 10)
export const fmtDate = (d) => (d ? new Date(d + (String(d).length === 10 ? 'T12:00:00' : '')).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—')

// Lifecycle phases, each closed by a gate (checkbox + date on the Overview tab).
export const PHASES = [
  { key: 'bid_award', label: 'Bid & award', gate: 'contract_signed', gateLabel: 'Contract signed' },
  { key: 'precon', label: 'Pre-construction', gate: 'submittals_approved', gateLabel: 'Submittals approved' },
  { key: 'rough_in', label: 'Rough-in', gate: 'rough_in_inspection', gateLabel: 'Rough-in inspection passed' },
  { key: 'equipment', label: 'Equipment set & hookups', gate: 'equipment_set', gateLabel: 'Equipment set' },
  { key: 'tab_final', label: 'TAB & final inspection', gate: 'final_inspection', gateLabel: 'Final inspection passed' },
  { key: 'closeout', label: 'Closeout', gate: 'retainage_released', gateLabel: 'Retainage released' },
]
export const phaseLabel = (k) => (PHASES.find((p) => p.key === k) || {}).label || k

// Starter schedule of values for a commercial HVAC scope (from Lloyd's template).
// Values start at 0 — the PM splits the contract across the lines that apply.
export const SOV_TEMPLATE = [
  ['100', 'Engineering, Submittals & Shop Drawings'],
  ['200', 'Demolition & Disposal of Existing Units'],
  ['300', 'Rigging, Cranes & Safety Logistics'],
  ['400', 'Major Equipment Supply'],
  ['500', 'Main Supply Duct Fabrication & Rough-in'],
  ['600', 'Refrigerant Piping & Hydronic Insulation'],
  ['700', 'Building Automation Controls & Wiring'],
  ['800', 'Testing, Adjusting & Balancing (TAB)'],
  ['900', 'Project Closeout, O&M Manuals, Warranties'],
]

// Super-admins pick an org per page; everyone else is locked to their own.
export function useOrg(profile) {
  const isSuper = profile?.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [orgId, setOrgId] = useState(profile?.org_id || '')
  useEffect(() => {
    if (!isSuper) return
    supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
      setOrgs(data || [])
      if (!orgId && data && data.length) setOrgId(data[0].id)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuper])
  return { isSuper, orgs, orgId, setOrgId }
}

// Compute one continuation sheet.
//  sov:        the project's SOV lines (sorted)
//  lineRows:   this application's cp_pay_app_lines rows
//  priorWork:  { sov_line_id: sum of work_this_period on earlier SUBMITTED apps }
//  rates:      { rw, rs } retainage % on work / on stored material
//  locked:     true for a submitted app — use its snapshotted previous_work
export function computeSheet(sov, lineRows, priorWork, rates, locked) {
  const byLine = Object.fromEntries((lineRows || []).map((l) => [l.sov_line_id, l]))
  const rw = num(rates.rw), rs = num(rates.rs)
  const rows = (sov || []).map((s) => {
    const l = byLine[s.id] || {}
    const C = num(s.scheduled_value)
    const D = locked && l.previous_work != null ? num(l.previous_work) : num(priorWork[s.id])
    const E = num(l.work_this_period)
    const F = num(l.stored_to_date)
    const G = D + E + F
    const ret = r2(((D + E) * rw) / 100) + r2((F * rs) / 100)
    return { sov: s, line: l, C, D, E, F, G, pct: C ? G / C : 0, H: C - G, ret, over: G > C + 0.005 }
  })
  const t = rows.reduce((a, x) => ({ C: a.C + x.C, D: a.D + x.D, E: a.E + x.E, F: a.F + x.F, G: a.G + x.G, H: a.H + x.H, ret: a.ret + x.ret }),
    { C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, ret: 0 })
  t.pct = t.C ? t.G / t.C : 0
  return { rows, totals: t }
}

// Application for Payment summary (lines 1–9 of the standard form).
export function summarize(project, totals, previousCertificates) {
  const original = num(project?.original_contract)
  const netCO = 0 // change orders arrive in Phase 2
  const contractToDate = original + netCO
  const completed = totals.G
  const retainage = totals.ret
  const earned = completed - retainage
  const prev = num(previousCertificates)
  return {
    original, netCO, contractToDate, completed, retainage, earned, prev,
    due: earned - prev,
    balanceToFinish: contractToDate - earned,
  }
}

// Load everything one pay application needs.
export async function loadPayApp(appId) {
  const { data: app, error } = await supabase.from('cp_pay_apps').select('*').eq('id', appId).maybeSingle()
  if (error || !app) return { error: error?.message || 'Pay application not found' }
  const [{ data: project }, { data: sov }, { data: lines }, { data: priorApps }] = await Promise.all([
    supabase.from('cp_projects').select('*, customers(display_name), properties(street_address, unit, city, state, zip)').eq('id', app.project_id).maybeSingle(),
    supabase.from('cp_sov_lines').select('*').eq('project_id', app.project_id).order('sort_order').order('item_no'),
    supabase.from('cp_pay_app_lines').select('*').eq('pay_app_id', appId),
    supabase.from('cp_pay_apps').select('id, app_number, status, earned_less_retainage').eq('project_id', app.project_id).eq('status', 'submitted').lt('app_number', app.app_number).order('app_number'),
  ])
  const priorIds = (priorApps || []).map((a) => a.id)
  const priorWork = {}
  if (priorIds.length) {
    const { data: pl } = await supabase.from('cp_pay_app_lines').select('sov_line_id, work_this_period').in('pay_app_id', priorIds)
    for (const r of pl || []) priorWork[r.sov_line_id] = num(priorWork[r.sov_line_id]) + num(r.work_this_period)
  }
  const last = (priorApps || []).at(-1)
  return { app, project, sov: sov || [], lines: lines || [], priorWork, previousCertificates: last ? num(last.earned_less_retainage) : 0 }
}

// Start the next application: copies forward each line's stored-material balance.
export async function createNextPayApp(project) {
  const { data: apps } = await supabase.from('cp_pay_apps').select('id, app_number, status').eq('project_id', project.id).order('app_number')
  if ((apps || []).some((a) => a.status === 'draft')) return { error: 'Finish and submit the open draft application first.' }
  const last = (apps || []).at(-1)
  const nextNo = last ? last.app_number + 1 : 1
  const { data: sov } = await supabase.from('cp_sov_lines').select('id').eq('project_id', project.id)
  if (!sov || !sov.length) return { error: 'Add schedule-of-values lines before the first pay application.' }
  const { data: app, error } = await supabase.from('cp_pay_apps').insert({
    org_id: project.org_id, project_id: project.id, app_number: nextNo, application_date: today(),
  }).select('id').maybeSingle()
  if (error) return { error: error.message }
  let carried = {}
  if (last) {
    const { data: ll } = await supabase.from('cp_pay_app_lines').select('sov_line_id, stored_to_date').eq('pay_app_id', last.id)
    carried = Object.fromEntries((ll || []).map((r) => [r.sov_line_id, num(r.stored_to_date)]))
  }
  await supabase.from('cp_pay_app_lines').insert(sov.map((s) => ({
    org_id: project.org_id, pay_app_id: app.id, sov_line_id: s.id, work_this_period: 0, stored_to_date: carried[s.id] || 0,
  })))
  return { id: app.id }
}

export async function nextProjectNumber(orgId) {
  const { data } = await supabase.from('cp_projects').select('project_number').eq('org_id', orgId)
  let max = 0
  for (const r of data || []) { const n = parseInt(String(r.project_number || '').replace(/^CP-/, ''), 10); if (!isNaN(n) && n > max) max = n }
  return 'CP-' + String(max + 1).padStart(4, '0')
}

// Format statement shown on pay-application screens and printouts.
export const AIA_FORMAT_NOTE = 'Follows the AIA® G702/G703 format: same layout, columns, and calculations.'
export const AIA_TRADEMARK_NOTE = "AIA, G702, and G703 are trademarks of The American Institute of Architects. Journey is not affiliated with or endorsed by the AIA; this is Journey's own form, not the AIA document."

// Small shared UI bits.
export const tileStyle = { background: 'var(--panel)', border: '1px solid var(--line-strong)', borderRadius: 10, padding: '14px 16px', minWidth: 150, flex: '1 1 150px' }
export const tabBtn = (active) => ({
  padding: '9px 16px', border: 'none', borderBottom: active ? '3px solid var(--nav-bg, #002060)' : '3px solid transparent',
  background: 'transparent', fontWeight: active ? 700 : 500, fontSize: 15, cursor: 'pointer', color: 'inherit',
})
