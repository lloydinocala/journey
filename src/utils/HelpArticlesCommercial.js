// Living help for the Commercial Projects module (add-on). Same article shape as
// the other section files: { id, title, area, keywords, purpose, sections }.
export const HELP_ARTICLES = [
  {
    id: 'commercial-dashboard',
    title: 'Commercial Projects Dashboard',
    area: 'Commercial Projects',
    keywords: ['commercial', 'dashboard', 'retainage', 'pay application', 'certified', 'contract value', 'attention'],
    purpose: 'The money summary across your active commercial projects, and the items that need someone to act.',
    sections: [
      { h: 'What the tiles mean', items: [
        'Contract value: the original contract sums of active and on-hold projects.',
        'Certified to date: what has been billed through submitted pay applications, after retainage.',
        'Retainage held: money the owner or GC is holding back until closeout, across every project not yet released.',
        'Awaiting payment: submitted pay applications whose invoices are not yet paid.',
      ]},
      { h: 'Needs attention', items: [
        'A schedule of values that does not add up to the contract sum (red).',
        'A pay application left in draft.',
        'An active project with no pay application in over 30 days, or none at all.',
        'A pay application invoice unpaid for more than 30 days (red).',
        'Retainage still held on a project in closeout or marked complete.',
      ]},
    ],
  },
  {
    id: 'commercial-projects',
    title: 'Commercial Projects',
    area: 'Commercial Projects',
    keywords: ['commercial', 'project', 'schedule of values', 'sov', 'contract', 'gc', 'general contractor', 'owner', 'architect', 'phase', 'gate', 'retainage'],
    purpose: 'Run a commercial mechanical job from contract to closeout: the contract and parties, the schedule of values, the phase gates, and monthly pay applications.',
    sections: [
      { h: 'Starting a project', items: [
        'Click + New commercial project. Enter the name, the customer who pays, the job site, the parties (owner, GC, architect, engineer), the original contract sum, and the retainage percent (10% unless the contract says otherwise).',
        'Leave "Start with the HVAC schedule-of-values lines" checked to load nine standard lines: engineering and submittals, demolition, rigging, major equipment, duct rough-in, piping and insulation, controls, TAB, and closeout.',
        'Residential new-construction jobs stay on the original Projects page under Residential Projects; the two are kept separate.',
      ]},
      { h: 'Schedule of Values tab', items: [
        'Split the contract across the lines of work. Every pay application bills against these lines.',
        'The total must match the contract sum; the footer says how much is left to assign or over.',
        'Add, rename, or reorder lines freely before the first pay application. After billing starts, changing a scheduled value asks you to confirm, because contract changes normally go through a change order.',
        'A line that has been billed on a submitted application cannot be deleted.',
      ]},
      { h: 'Change Orders and Lien Waivers tabs', items: [
        'Change Orders: write, price, and approve changes to the contract. Approved changes add lines to the schedule of values and raise the contract sum to date.',
        'Lien Waivers: Florida statutory progress and final waivers and the contractor\'s final payment affidavit, filled in from the project.',
      ]},
      { h: 'Overview tab', items: [
        'Tiles show the contract sum, completed and stored to date, certified to date, retainage held, and the balance to finish.',
        'Phases & gates: check a gate when it is met (contract signed, submittals approved, rough-in inspection, equipment set, final inspection, retainage released). Journey stamps the date and moves the project to the next phase. Gates never lock anything.',
        'Edit the parties, dates, retainage rates (a separate rate for stored material is optional), status, and notes.',
      ]},
    ],
  },
  {
    id: 'commercial-pay-applications',
    title: 'Pay Applications',
    area: 'Commercial Projects',
    keywords: ['aia', 'pay application', 'pay app', 'application for payment', 'continuation sheet', 'g702', 'g703', 'progress billing', 'retainage', 'stored materials', 'invoice', 'billing period'],
    purpose: 'Bill a commercial project each period against its schedule of values, with retainage, using the standard Application for Payment and Continuation Sheet layout.',
    sections: [
      { h: 'Filling in an application', items: [
        'Start one from the project (+ Pay application). Only one draft can be open per project.',
        'Set the Period to date. For each line enter the work completed this period in dollars, or type a % to date and Journey works out the dollars.',
        'Materials stored is the balance on hand right now: equipment delivered or stored offsite but not yet installed. It carries forward from the last application; lower it as material gets installed and billed as work.',
        'Lines billed past their scheduled value are highlighted so they can be checked before submitting.',
      ]},
      { h: 'How the numbers work', items: [
        'D (from previous applications) = work billed on earlier submitted applications. E = this period. F = materials presently stored. G = D + E + F.',
        'Retainage = the retainage % of completed work (D + E) plus the stored-material % of F.',
        'Current payment due = total earned less retainage, minus what earlier applications already certified.',
      ]},
      { h: 'Submitting', items: [
        'Submit application locks it: the totals are saved as a permanent record and corrections go on the next application.',
        'Journey creates a normal invoice for the payment due, so payment collection, receipts, and QuickBooks work as usual. If nothing is due, no invoice is made.',
        'Print / Save PDF produces the Application for Payment summary and the Continuation Sheet.',
      ]},
      { h: 'Retainage and the final application', items: [
        'Each draft has its own retainage rates. Leave them blank to use the project\'s rate, or lower them when the contract allows a reduction (for example, 10% down to 5% at 50% complete). Retainage is figured on the whole amount completed to date, so lowering the rate releases the difference on that application.',
        'Tick "Final application: release all retainage" on the last application. Retainage drops to 0%, the payment due includes everything held back, and submitting it records the "Retainage released" gate and moves the project to Closeout.',
        'After submitting, use the buttons at the top to prepare the lien paperwork: a progress payment waiver for a regular application, or the final payment waiver and final payment affidavit for the final one.',
      ]},
      { h: 'AIA G702 / G703 format', items: [
        'Approved change orders flow into the Application for Payment: line 2 (net change by change orders) and the change order summary (additions and deductions approved in previous months and this month).',
        'Journey\'s pay applications follow the AIA G702/G703 format that owners, general contractors, and lenders expect: the Application for Payment summary matches G702 (lines 1 through 9) and the Continuation Sheet matches G703 (columns A through I).',
        'The calculations are the same: total completed and stored (G = D + E + F), percent complete (G ÷ C), balance to finish (C − G), retainage, earned less retainage, less previous certificates, and current payment due.',
        'If a contract requires the official AIA document itself, the numbers from Journey\'s continuation sheet transfer to it line for line.',
        'AIA, G702, and G703 are trademarks of The American Institute of Architects. Journey is not affiliated with or endorsed by the AIA; Journey produces its own form in the same format rather than reproducing the copyrighted AIA documents.',
      ]},
      { h: 'The Pay Applications page', body: 'Lists every application across all projects. The default view shows what needs action: drafts and submitted applications still unpaid, with the total awaiting payment.' },
    ],
  },
]

HELP_ARTICLES.push(
  {
    id: 'commercial-change-orders',
    title: 'Change Orders',
    area: 'Commercial Projects',
    keywords: ['change order', 'co', 'extra', 'deduct', 'scope change', 'markup', 'contract sum', 'approval', 'days added'],
    purpose: 'Price, send, and record approval of changes to a commercial contract. Nothing bills until a change order is approved.',
    sections: [
      { h: 'Writing one', items: [
        'Open the project, go to the Change Orders tab, and click + New change order.',
        'Give it a title, a reason (owner request, field condition, design change, RFI response, and so on), the scope in plain words, the owner or GC\'s own CO number if they have one, and any days added to the schedule.',
        'Price each line from labor, material, equipment, subcontract, and other cost, plus a markup %. Use negative numbers for work being removed (a deduct).',
        'Print / Save PDF makes a change order for signatures, showing the original contract, earlier approved changes, this change, and the new contract sum. You can show or hide the cost breakdown.',
      ]},
      { h: 'Statuses', items: [
        'Draft: still being priced. Mark sent for approval once it goes to the owner or GC; the date is recorded and the dashboard flags any left waiting more than 14 days.',
        'Approve: record the date and who approved it. The contract sum goes up (or down), and each priced line becomes a schedule-of-values line marked CO so the work can be billed on the next pay application.',
        'Rejected or Void: kept for the record and never billed. A rejected change order can be reopened as a draft.',
        'Unapprove is possible only until the change order appears on a submitted pay application. After that, write a deducting change order instead.',
      ]},
      { h: 'Where the totals show up', body: 'The Overview tab shows the contract sum to date (original plus approved changes) and pending changes. The Change Orders page under Commercial Projects lists every change order across all projects, with the total still waiting on approval.' },
    ],
  },
  {
    id: 'commercial-lien-waivers',
    title: 'Lien Waivers (Florida)',
    area: 'Commercial Projects',
    keywords: ['lien', 'waiver', 'release', 'florida', '713', 'final payment affidavit', 'progress payment', 'notice to owner', 'conditional', 'check'],
    purpose: 'Prepare Florida\'s statutory lien waivers and the contractor\'s final payment affidavit, filled in from the project and its pay applications.',
    sections: [
      { h: 'The three documents', items: [
        'Waiver and Release of Lien Upon Progress Payment: Fla. Stat. 713.20(4). Covers work through a date, for the amount of one payment. It does not cover retainage or later work.',
        'Waiver and Release of Lien Upon Final Payment: Fla. Stat. 713.20(5). Given for the final payment.',
        'Contractor\'s Final Payment Affidavit: Fla. Stat. 713.06(3)(d). States that everyone under your contract who served a notice to owner has been paid, or lists who has not and how much. It must be signed before a notary and given to the owner before final payment.',
      ]},
      { h: 'Using them', items: [
        'From a submitted pay application, use Prepare progress payment waiver (or the final waiver and affidavit on a final application). Or start one from the project\'s Lien Waivers tab.',
        'Check the names, amount, dates, and property description, add who signs, then Print / Save PDF.',
        'The form wording is the statute\'s and cannot be edited; Florida does not allow anyone to require a different form (713.20(6)).',
        'Mark delivered once it is handed over, so the tab shows what has gone out.',
      ]},
      { h: 'Important', items: [
        'A Florida statutory waiver releases your lien rights for the amount stated as soon as you sign it. Hand it over when you are paid.',
        'If you are trading the waiver for a check, tick "Conditioned on payment of a check" and enter the check number. Florida allows a waiver given for a check to be conditioned on the check being paid (713.20(7)).',
        'Journey fills in the statutory forms; it does not give legal advice. Ask your attorney about anything unusual, such as public (bonded) projects.',
      ]},
    ],
  },
)

export const ROUTE_HELP = {
  '/commercial/change-orders': 'commercial-change-orders',
  '/commercial/lien-documents': 'commercial-lien-waivers',
  '/commercial': 'commercial-dashboard',
  '/commercial/projects': 'commercial-projects',
  '/commercial/pay-apps': 'commercial-pay-applications',
}
