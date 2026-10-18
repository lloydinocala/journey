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
      { h: 'AIA G702 / G703 format', items: [
        'Journey\'s pay applications follow the AIA G702/G703 format that owners, general contractors, and lenders expect: the Application for Payment summary matches G702 (lines 1 through 9) and the Continuation Sheet matches G703 (columns A through I).',
        'The calculations are the same: total completed and stored (G = D + E + F), percent complete (G ÷ C), balance to finish (C − G), retainage, earned less retainage, less previous certificates, and current payment due.',
        'If a contract requires the official AIA document itself, the numbers from Journey\'s continuation sheet transfer to it line for line.',
        'AIA, G702, and G703 are trademarks of The American Institute of Architects. Journey is not affiliated with or endorsed by the AIA; Journey produces its own form in the same format rather than reproducing the copyrighted AIA documents.',
      ]},
      { h: 'The Pay Applications page', body: 'Lists every application across all projects. The default view shows what needs action: drafts and submitted applications still unpaid, with the total awaiting payment.' },
    ],
  },
]

export const ROUTE_HELP = {
  '/commercial': 'commercial-dashboard',
  '/commercial/projects': 'commercial-projects',
  '/commercial/pay-apps': 'commercial-pay-applications',
}
