// Living help/documentation for Journey. Structured (not prose) so it serves three readers:
// the USER (rendered in the Help drawer), an AI (fed as context), and future-you (single source
// of truth). Update these as features change — treat it like committing code.
//
// Article shape:
//   { id, title, area, keywords:[], purpose, sections:[ { h, items?:[], body? } ] }
// A section renders as a heading + either a bullet list (items) or a paragraph (body).

export const HELP_ARTICLES = [
  {
    id: 'operations-dashboard',
    title: 'Operations Dashboard',
    area: 'Operations',
    keywords: ['dashboard', 'operations', 'queue', 'board', 'a/r', 'accounts receivable', 'follow up', 'unpaid', 'to do', 'attention', 'on-call', 'wins'],
    purpose: 'A working queue for the office — everything that needs doing today, in one place. It is not a report: every number links to the exact record you go to resolve. The goal is to clear the board to zero.',
    sections: [
      { h: 'How to use it', items: [
        'The four numbers across the top are your vital signs. Click any one to jump to that full list.',
        'Cards are grouped by urgency: "Needs attention now" is money and deadlines; "Coming up" is scheduling and pipeline.',
        'Click any item row inside a card to open that exact record — the invoice, estimate, or job.',
        'The green "This Week ✓" strip shows what you have already cleared: collected, estimates won, jobs completed, and close rate. It is there so the board motivates, not just nags.',
        'A green ✓ and "All caught up" on a card means that bucket is empty. That is the win.',
        'If on-call coverage is scheduled less than two weeks out, an amber banner appears at the top — click it to open the On-Call Schedule.',
      ]},
      { h: 'What each bucket means', items: [
        'Unpaid Invoices — invoices you have sent that still have a balance. Age pills turn amber at 30 days, terracotta at 60+.',
        'Estimates to Follow Up — estimates sent to a customer with no reply yet. Amber at 2 days, terracotta at 5+.',
        'Completed, Not Invoiced — finished jobs with no invoice created. This is unbilled money, easy to miss.',
        'Warranty Registration — new systems (from Retrofit jobs) not yet registered with the manufacturer. There is a 30-day clock.',
        'Jobs to Schedule — jobs with no real date yet (placeholder or unscheduled).',
        'Maintenance Due — agreements with a visit due within the next 30 days.',
        'Estimates Not Yet Sent — drafts that were created but never went out to the customer.',
      ]},
      { h: 'Behind the scenes', body: 'The board refreshes on its own every minute and again whenever you return to the browser tab, so numbers stay live — mark an invoice paid elsewhere and watch it drop off. All figures are for your organization only. Aging is measured from the date an invoice or estimate was sent.' },
      { h: 'Good to know', items: [
        'If an item has been filtered out of its own table (by a status filter, a search, or the archived toggle), clicking it opens the table but may not visibly highlight the row — clear the filter to see it.',
      ]},
    ],
  },
  {
    id: 'estimates',
    title: 'Estimates (Job & System)',
    area: 'Operations',
    keywords: ['estimate', 'estimates', 'quote', 'job estimate', 'system estimate', 'approve', 'decline', 'send estimate', 'preview', 'proposal', 'new system'],
    purpose: 'Estimates are the quotes you send a customer to approve before doing work. Journey has two kinds: Job Estimates (tied to a service job) and System Estimates (new-system installs, which are based on a property and have no job yet).',
    sections: [
      { h: 'The two kinds', items: [
        'Job Estimate — recommended repair or service work on an existing job. Lives in the "Job Estimates" table.',
        'System Estimate — a new-system sale (a full install), quoted against a property before any job exists. Lives in its own "System Estimates" table.',
      ]},
      { h: 'How to create and send', items: [
        'Create a Job Estimate from the job it belongs to. Create a System Estimate from the System Estimates table with "+ New System Estimate".',
        'Before sending, use Preview (or "Preview as customer") to see exactly what the customer will receive.',
        'Send to Customer emails them a link where they can Approve or Decline.',
        'When a preventive-maintenance checklist is completed, its report rides along on the same estimate the customer receives — one link, report on top, recommended work below.',
      ]},
      { h: 'Rules', items: [
        'Approval status is "Pending" until the customer acts, then "Approved". Approved estimates can spawn the actual work.',
        'System Estimates resolve their customer and property directly from the estimate, because they have no job to look through.',
        'The customer, invoice, and estimate numbers in a customer file link back to their tables with the row highlighted.',
      ]},
      { h: 'Good to know', body: 'A "clean bill" preventive-maintenance visit with nothing to quote still sends the customer their report — with a "no repairs recommended" note in place of an estimate.' },
    ],
  },
  {
    id: 'jobs',
    title: 'Jobs',
    area: 'Operations',
    keywords: ['job', 'jobs', 'jobs table', 'schedule', 'retrofit', 'repair', 'maintenance', 'technician', 'customer', 'invoice sent', 'columns', 'status'],
    purpose: 'Jobs are the work itself — service calls, new-system installs, and maintenance visits. The Jobs table is your master list of everything scheduled and done.',
    sections: [
      { h: 'How to use it', items: [
        'The Customer column is always shown and links straight to that customer’s file.',
        'The Invoice Sent column shows the date an invoice went out and links to it.',
        'Use the Columns button to show or hide other columns; your choice is remembered in your browser.',
        'From a job on the Calendar, open its popup and choose "Open in Jobs Table" to jump here with the row highlighted.',
      ]},
      { h: 'Job types and what they trigger', items: [
        'Retrofit — a new-system install. Creating a Retrofit job automatically creates a Warranty Registration record (30-day clock starts).',
        'Preventive Maint — generates the PM checklist(s) for the system(s) at that property.',
        'Repair / Other — standard service work.',
      ]},
      { h: 'Status', items: [
        'Unscheduled or placeholder-dated jobs appear on the Operations Dashboard under "Jobs to Schedule".',
        'Completed jobs with no invoice appear under "Completed, Not Invoiced".',
      ]},
      { h: 'Good to know', body: 'A brand-new column you add may be hidden if your saved column layout predates it — open the Columns picker and switch it on once, and it sticks.' },
    ],
  },
]

// Map a route to the article that best explains it, so the drawer can open context-aware.
export const ROUTE_HELP = {
  '/operations': 'operations-dashboard',
  '/estimates': 'estimates',
  '/system-estimates': 'estimates',
  '/jobs': 'jobs',
  '/calendar': 'jobs',
}

export function searchArticles(query) {
  const q = (query || '').trim().toLowerCase()
  if (!q) return HELP_ARTICLES
  const hay = (a) => [a.title, a.area, a.purpose, a.keywords.join(' '),
    a.sections.map((s) => [s.h, s.body || '', (s.items || []).join(' ')].join(' ')).join(' ')].join(' ').toLowerCase()
  return HELP_ARTICLES.filter((a) => q.split(/\s+/).every((w) => hay(a).includes(w)))
}
