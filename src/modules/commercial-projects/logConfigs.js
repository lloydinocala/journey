// Commercial Projects · configuration for each field/document log.
// The flag() functions are also used by the dashboard, so "what needs attention"
// is defined once.
import { today, fmtDate, num } from './data'

const opts = (pairs) => pairs.map(([value, label]) => ({ value, label }))
// Whole calendar days between today (local) and a YYYY-MM-DD date.
const todayUTC = () => { const t = new Date(); return Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) }
const daysPast = (d) => (d ? Math.round((todayUTC() - Date.parse(d)) / 864e5) : null)
const daysUntil = (d) => (d ? -daysPast(d) : null)
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10) }

export const SUBMITTAL_STATUS = opts([['draft', 'Draft'], ['submitted', 'Submitted'], ['approved', 'Approved'], ['approved_as_noted', 'Approved as noted'], ['revise_resubmit', 'Revise & resubmit'], ['rejected', 'Rejected']])
export const RFI_STATUS = opts([['draft', 'Draft'], ['open', 'Open'], ['answered', 'Answered'], ['closed', 'Closed']])
export const EQUIP_STATUS = opts([['not_ordered', 'Not ordered'], ['ordered', 'Ordered'], ['in_production', 'In production'], ['shipped', 'Shipped'], ['delivered', 'Delivered'], ['set', 'Set']])
export const INSPECTION_STATUS = opts([['scheduled', 'Scheduled'], ['passed', 'Passed'], ['failed', 'Failed'], ['reinspect', 'Re-inspection needed'], ['cancelled', 'Cancelled']])
export const TAB_STATUS = opts([['scheduled', 'Scheduled'], ['in_progress', 'In progress'], ['report_received', 'Report received'], ['deficiencies_open', 'Deficiencies open'], ['closed', 'Closed']])
export const PUNCH_STATUS = opts([['open', 'Open'], ['done', 'Done — needs verifying'], ['verified', 'Verified']])

export const submittalFlag = (r) => {
  if (r.status === 'submitted' && daysPast(r.due_date) > 0) return { tone: 'red', text: `Review overdue ${daysPast(r.due_date)}d` }
  if (r.status === 'revise_resubmit' || r.status === 'rejected') return { tone: 'amber', text: 'Needs resubmittal' }
  return null
}
export const rfiFlag = (r) => {
  if (r.status === 'open' && daysPast(r.needed_by) > 0) return { tone: 'red', text: `Answer overdue ${daysPast(r.needed_by)}d` }
  if (r.status === 'answered' && (r.cost_impact || r.schedule_impact) && !r.change_order_id) return { tone: 'amber', text: 'Impact — consider a change order' }
  return null
}
// Equipment: the one residential tools never have. Need-by vs promised ship.
export const equipmentFlag = (r) => {
  if (r.status === 'delivered' || r.status === 'set') return null
  if (r.need_by_date && r.promised_ship_date && r.promised_ship_date > r.need_by_date) return { tone: 'red', text: `Ships ${fmtDate(r.promised_ship_date)}, needed ${fmtDate(r.need_by_date)}` }
  if (r.status === 'not_ordered' && r.need_by_date && r.lead_time_weeks) {
    const orderBy = addDays(r.need_by_date, -Math.ceil(num(r.lead_time_weeks) * 7))
    const left = daysUntil(orderBy)
    if (left < 0) return { tone: 'red', text: `Should have been ordered by ${fmtDate(orderBy)}` }
    if (left <= 14) return { tone: 'amber', text: `Order by ${fmtDate(orderBy)}` }
  }
  if (r.need_by_date && daysPast(r.need_by_date) > 0) return { tone: 'red', text: 'Past need-by date' }
  return null
}
export const inspectionFlag = (r) => {
  if (r.status === 'failed' || r.status === 'reinspect') return { tone: 'red', text: 'Failed — re-inspection needed' }
  if (r.status === 'scheduled' && daysPast(r.scheduled_date) > 0) return { tone: 'amber', text: 'Result not recorded' }
  return null
}
export const tabFlag = (r) => (r.status === 'deficiencies_open' ? { tone: 'amber', text: 'Deficiencies to close' } : null)
export const punchFlag = (r) => {
  if (r.status === 'open' && daysPast(r.due_date) > 0) return { tone: 'red', text: `Overdue ${daysPast(r.due_date)}d` }
  if (r.status === 'done') return { tone: 'amber', text: 'Verify' }
  return null
}

export const CONFIGS = {
  submittals: {
    table: 'cp_submittals', title: 'Submittals', noun: 'submittal', addLabel: 'Submittal', numberField: 'number', revisionField: 'revision',
    orderBy: 'number', orderAsc: true, closedStatuses: ['approved', 'approved_as_noted'],
    help: 'Cut sheets, shop drawings, and samples sent to the engineer or architect for approval. Approved equipment can be ordered.',
    empty: 'No submittals yet.', flag: submittalFlag,
    defaults: () => ({ status: 'draft', revision: 0 }),
    fields: [
      { key: 'title', label: 'Item', required: true, list: true, w: 260 },
      { key: 'spec_section', label: 'Spec section', list: true, w: 130 },
      { key: 'revision', label: 'Revision', type: 'number', w: 90 },
      { key: 'submitted_to', label: 'Submitted to', list: true },
      { key: 'status', label: 'Status', type: 'select', options: SUBMITTAL_STATUS, required: true, list: true,
        onSelect: (v, e) => (v === 'submitted' && !e.sent_date ? { sent_date: today(), due_date: e.due_date || addDays(today(), 14) } : ['approved', 'approved_as_noted', 'revise_resubmit', 'rejected'].includes(v) && !e.returned_date ? { returned_date: today() } : {}) },
      { key: 'sent_date', label: 'Sent', type: 'date', list: true, w: 150 },
      { key: 'due_date', label: 'Review due', type: 'date', list: true, w: 150 },
      { key: 'returned_date', label: 'Returned', type: 'date', w: 150 },
      { key: 'reviewer_comments', label: 'Reviewer comments', type: 'textarea', full: true },
      { key: 'attachments', label: 'Files (cut sheets, shop drawings, stamped returns)', type: 'files', list: true, full: true },
    ],
  },
  rfis: {
    table: 'cp_rfis', title: 'RFIs', noun: 'RFI', addLabel: 'RFI', numberField: 'number', orderBy: 'number', orderAsc: true, closedStatuses: ['closed'],
    help: 'Questions to the design team. Mark cost or schedule impact so it can become a change order.',
    empty: 'No RFIs yet.', flag: rfiFlag,
    defaults: () => ({ status: 'draft' }),
    fields: [
      { key: 'subject', label: 'Subject', required: true, list: true, w: 260 },
      { key: 'asked_to', label: 'Asked to', list: true },
      { key: 'reference', label: 'Drawing / spec reference', w: 200 },
      { key: 'status', label: 'Status', type: 'select', options: RFI_STATUS, required: true, list: true,
        onSelect: (v, e) => (v === 'open' && !e.sent_date ? { sent_date: today(), needed_by: e.needed_by || addDays(today(), 7) } : v === 'answered' && !e.answered_date ? { answered_date: today() } : {}) },
      { key: 'sent_date', label: 'Sent', type: 'date', w: 150 },
      { key: 'needed_by', label: 'Answer needed by', type: 'date', list: true, w: 160 },
      { key: 'question', label: 'Question', type: 'textarea', full: true,
        ai: { title: 'Draft RFI question', label: 'Quincy: write the question',
          system: 'Turn the project manager\'s rough notes into a clear, professional RFI question for the engineer or architect on a commercial HVAC job. State the conflict or missing information, cite the drawing/spec reference given, and ask one specific question (offer a proposed solution only if the notes contain one). 2 to 5 sentences. Use only the facts given; leave [placeholders] for anything missing.',
          prompt: 'Write the RFI question.',
          context: (e, p) => ({ project: p.name, subject: e.subject || '', drawing_or_spec_reference: e.reference || '', rough_notes: e.question || '', asked_to: e.asked_to || '' }) } },
      { key: 'answer', label: 'Answer', type: 'textarea', full: true },
      { key: 'answered_date', label: 'Answered', type: 'date', w: 150 },
      { key: 'cost_impact', label: 'Cost impact', type: 'checkbox', list: true, w: 110 },
      { key: 'schedule_impact', label: 'Schedule impact', type: 'checkbox', w: 130 },
      { key: 'change_order_id', label: 'Change order', type: 'lookup', lookup: 'changeOrders', w: 200 },
      { key: 'attachments', label: 'Files (photos, marked-up drawings)', type: 'files', full: true, accept: 'image/*,application/pdf' },
    ],
  },
  equipment: {
    table: 'cp_equipment', title: 'Equipment & procurement', noun: 'equipment item', addLabel: 'Equipment', orderBy: 'created_at', orderAsc: true,
    closedStatuses: ['set'], minWidth: 1050,
    help: 'Major units and their lead times. Set the need-by date (when it must be on site) — Journey warns when the promised ship date runs past it, or when it is time to order.',
    empty: 'No equipment yet. Add each major unit (RTU, AHU, chiller, VRF condenser…).', flag: equipmentFlag,
    defaults: () => ({ status: 'not_ordered', quantity: 1 }),
    fields: [
      { key: 'tag', label: 'Tag', list: true, w: 100 },
      { key: 'description', label: 'Description', required: true, list: true, w: 240 },
      { key: 'manufacturer', label: 'Manufacturer', w: 160 },
      { key: 'model', label: 'Model', list: true, w: 160 },
      { key: 'quantity', label: 'Qty', type: 'number', w: 80 },
      { key: 'submittal_id', label: 'Submittal', type: 'lookup', lookup: 'submittals', w: 220 },
      { key: 'vendor_id', label: 'Vendor', type: 'lookup', lookup: 'vendors', list: true, w: 200 },
      { key: 'po_number', label: 'PO #', w: 120 },
      { key: 'lead_time_weeks', label: 'Lead time (weeks)', type: 'number', list: true, w: 130 },
      { key: 'status', label: 'Status', type: 'select', options: EQUIP_STATUS, required: true, list: true,
        onSelect: (v, e) => (v === 'ordered' && !e.ordered_date ? { ordered_date: today() } : v === 'delivered' && !e.delivered_date ? { delivered_date: today() } : v === 'set' && !e.set_date ? { set_date: today() } : {}) },
      { key: 'ordered_date', label: 'Ordered', type: 'date', w: 150 },
      { key: 'promised_ship_date', label: 'Promised ship', type: 'date', list: true, w: 150 },
      { key: 'need_by_date', label: 'Needed on site by', type: 'date', list: true, w: 160 },
      { key: 'delivered_date', label: 'Delivered', type: 'date', w: 150 },
      { key: 'crane_date', label: 'Crane / rigging date', type: 'date', w: 160 },
      { key: 'set_date', label: 'Set', type: 'date', w: 150 },
      { key: 'notes', label: 'Notes', type: 'textarea', full: true, rows: 2 },
    ],
  },
  dailyLogs: {
    table: 'cp_daily_logs', title: 'Daily logs', noun: 'daily log', addLabel: 'Daily log', orderBy: 'log_date', orderAsc: false,
    help: 'What happened on site each day: crew, hours, work done, weather, deliveries, delays. These back up every pay application.',
    empty: 'No daily logs yet. The field lead can file them from the phone (Supervisor Tools → Commercial Projects).',
    defaults: (profile) => ({ log_date: today(), author_id: profile?.id || null, author_name: profile?.full_name || '' }),
    fields: [
      { key: 'log_date', label: 'Date', type: 'date', required: true, list: true, w: 150 },
      { key: 'author_name', label: 'Filed by', list: true, w: 160 },
      { key: 'crew', label: 'Crew on site', list: true, w: 220 },
      { key: 'crew_hours', label: 'Crew hours', type: 'number', list: true, w: 110 },
      { key: 'weather', label: 'Weather', w: 160 },
      { key: 'work_performed', label: 'Work performed', type: 'textarea', full: true, list: true, render: (r) => (r.work_performed || '').slice(0, 90),
        ai: { title: 'Tidy daily log', label: 'Quincy: tidy this entry',
          system: 'Rewrite a field lead\'s rough daily-log notes for a commercial HVAC job into a clear, factual record: what was installed or done, where (floor/area/unit tag), and quantities. Keep every fact, add none, no opinions. Short sentences or a brief list.',
          prompt: 'Rewrite the work-performed notes.',
          context: (e) => ({ date: e.log_date, crew: e.crew || '', crew_hours: e.crew_hours || '', notes: e.work_performed || '', deliveries: e.deliveries || '', delays: e.delays || '' }) } },
      { key: 'budget_line_id', label: 'Charge labor to budget line', type: 'lookup', lookup: 'budgetLines', w: 220 },
      { key: 'deliveries', label: 'Deliveries', type: 'textarea', rows: 2, full: true },
      { key: 'delays', label: 'Delays or problems', type: 'textarea', rows: 2, full: true },
      { key: 'safety', label: 'Safety notes', type: 'textarea', rows: 2, full: true },
      { key: 'attachments', label: 'Photos', type: 'files', list: true, full: true, accept: 'image/*' },
    ],
    beforeSave: (row, e) => ({ author_id: e.author_id || null }),
  },
  inspections: {
    table: 'cp_inspections', title: 'Inspections', noun: 'inspection', addLabel: 'Inspection', orderBy: 'scheduled_date', orderAsc: false,
    closedStatuses: ['passed', 'cancelled'], empty: 'No inspections yet.', flag: inspectionFlag,
    defaults: () => ({ status: 'scheduled' }),
    fields: [
      { key: 'inspection_type', label: 'Inspection', type: 'select', required: true, list: true, w: 220,
        options: opts([['Rough-in mechanical', 'Rough-in mechanical'], ['Above-ceiling', 'Above-ceiling'], ['Duct / pressure test', 'Duct / pressure test'], ['Refrigerant piping pressure test', 'Refrigerant piping pressure test'], ['Gas piping', 'Gas piping'], ['Fire / smoke damper', 'Fire / smoke damper'], ['Final mechanical', 'Final mechanical'], ['Other', 'Other']]) },
      { key: 'authority', label: 'Authority (building dept.)', list: true },
      { key: 'scheduled_date', label: 'Scheduled', type: 'date', list: true, w: 150 },
      { key: 'status', label: 'Result', type: 'select', options: INSPECTION_STATUS, required: true, list: true,
        onSelect: (v, e) => (v !== 'scheduled' && v !== 'cancelled' && !e.result_date ? { result_date: today() } : {}) },
      { key: 'result_date', label: 'Result date', type: 'date', w: 150 },
      { key: 'inspector', label: 'Inspector', w: 160 },
      { key: 'notes', label: 'Notes / corrections required', type: 'textarea', full: true },
      { key: 'attachments', label: 'Files (inspection card, correction notice)', type: 'files', full: true },
    ],
  },
  tab: {
    table: 'cp_tab_reports', title: 'Testing, adjusting & balancing (TAB)', noun: 'TAB record', addLabel: 'TAB', orderBy: 'created_at',
    closedStatuses: ['closed'], empty: 'No TAB records yet.', flag: tabFlag,
    defaults: () => ({ status: 'scheduled' }),
    fields: [
      { key: 'balancer', label: 'Balancing contractor', list: true, w: 220 },
      { key: 'scope', label: 'Scope (systems balanced)', list: true, w: 240 },
      { key: 'scheduled_date', label: 'Scheduled', type: 'date', list: true, w: 150 },
      { key: 'status', label: 'Status', type: 'select', options: TAB_STATUS, required: true, list: true,
        onSelect: (v, e) => (v === 'report_received' && !e.report_received_date ? { report_received_date: today() } : {}) },
      { key: 'report_received_date', label: 'Report received', type: 'date', w: 150 },
      { key: 'deficiencies', label: 'Deficiencies found', type: 'textarea', full: true },
      { key: 'attachments', label: 'TAB report and files', type: 'files', list: true, full: true },
    ],
  },
  punch: {
    table: 'cp_punch_items', title: 'Punch list', noun: 'punch item', addLabel: 'Punch item', numberField: 'number', orderBy: 'number', orderAsc: true,
    closedStatuses: ['verified'], empty: 'No punch items.', flag: punchFlag,
    defaults: () => ({ status: 'open' }),
    fields: [
      { key: 'description', label: 'Item', required: true, list: true, w: 280 },
      { key: 'location', label: 'Location', list: true, w: 160 },
      { key: 'raised_by', label: 'Raised by', w: 160 },
      { key: 'assigned_to', label: 'Assigned to', type: 'lookup', lookup: 'users', list: true, w: 180 },
      { key: 'due_date', label: 'Due', type: 'date', list: true, w: 150 },
      { key: 'status', label: 'Status', type: 'select', options: PUNCH_STATUS, required: true, list: true,
        onSelect: (v, e) => (v === 'done' && !e.done_date ? { done_date: today() } : v === 'verified' && !e.verified_date ? { verified_date: today(), done_date: e.done_date || today() } : {}) },
      { key: 'done_date', label: 'Done', type: 'date', w: 150 },
      { key: 'verified_date', label: 'Verified', type: 'date', w: 150 },
      { key: 'attachments', label: 'Photos', type: 'files', list: true, full: true, accept: 'image/*' },
    ],
  },
}

export const CLOSEOUT_DEFAULTS = [
  'Operation & maintenance (O&M) manuals delivered',
  'Equipment warranties registered and delivered',
  'As-built drawings delivered',
  'Owner / facility staff training completed',
  'Attic stock (spare filters, belts) delivered',
  'TAB report delivered',
  'Final mechanical inspection passed',
  'Punch list complete and verified',
  'Controls / BAS sequences demonstrated',
  'Final waiver of lien delivered',
  "Contractor's final payment affidavit delivered",
  'Retainage released (final application submitted)',
]
