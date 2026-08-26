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
  {
    id: 'invoices',
    title: 'Invoices',
    area: 'Financials',
    keywords: ['invoice', 'invoices', 'bill', 'billing', 'payment', 'record payment', 'balance', 'unpaid', 'void', 'cancel', 'archive', 'send invoice', 'paid'],
    purpose: 'Invoices are the bills you send customers for completed work, and where you record payments. The Invoices table is your master list of what has been billed and what is still owed.',
    sections: [
      { h: 'How to use it', items: [
        'Each row has front-of-row actions: View as customer (the public page they receive), Edit, Archive, and Void (cancel).',
        'The Customer and Job columns link to those records.',
        'Send an invoice by email; the customer gets a link to view it and pay.',
        'Record a payment (cash, check, or card) against an invoice. Recording takes a deliberate button tap and a confirmation, so it cannot fire by accident.',
      ]},
      { h: 'Rules', items: [
        'An invoice’s balance is its total minus what has been paid. Sent-but-unpaid invoices appear on the Operations Dashboard, aged from the send date.',
        'Void cancels an invoice. Archive hides it from the main list but keeps it for your records.',
      ]},
      { h: 'Behind the scenes', body: 'The table loads jobs and line items separately rather than as one joined query — invoices connect to jobs in several ways, and joining them can otherwise blank the whole list.' },
      { h: 'Good to know', body: 'A completed job with no invoice shows on the dashboard under "Completed, Not Invoiced" — that is unbilled work worth catching.' },
    ],
  },
  {
    id: 'customers-properties',
    title: 'Customers & Properties',
    area: 'Operations',
    keywords: ['customer', 'customers', 'customer file', 'property', 'properties', 'contact', 'invoice routing', 'history', 'address', 'billing contact'],
    purpose: 'The customer file is the full picture of one customer — their properties, jobs, estimates, invoices, maintenance agreements, warranty registrations, contacts, and attachments in one place. Properties are the physical locations where work happens; every job and system belongs to a property.',
    sections: [
      { h: 'How to use it', items: [
        'Open a customer file wherever their name appears — the Jobs table, Properties, a calendar job popup, or an estimate.',
        'Inside the file, Job #, Invoice #, and Estimate # link back to their tables with the row highlighted.',
        'The Warranty Registrations section lists every new system installed for that customer and whether it has been registered.',
      ]},
      { h: 'Rules', items: [
        'A property belongs to a customer; a job belongs to a property (and therefore to that customer).',
        'Contacts & Invoice Routing sets who gets billed and who approves — useful for commercial customers with multiple people involved.',
      ]},
      { h: 'Good to know', body: 'If a customer’s estimate is a System Estimate, its number links to the System Estimates table; a regular estimate links to Job Estimates.' },
    ],
  },
  {
    id: 'calendar',
    title: 'Calendar',
    area: 'Operations',
    keywords: ['calendar', 'schedule', 'scheduling', 'appointment', 'day', 'week', 'job popup', 'business hours', 'holidays', 'slot'],
    purpose: 'The Calendar is the visual schedule — every job on its day and time, so you can see the shape of the week and slot in new work.',
    sections: [
      { h: 'How to use it', items: [
        'Click a job to open its popup with the key details.',
        'From the popup, "Open in Jobs Table" jumps to that job in the Jobs table with the row highlighted, and the Customer name links to their file.',
        'Business hours and holidays (in Settings) control which time slots are available.',
      ]},
      { h: 'Rules', items: [
        'Jobs with only a placeholder date (auto-set from an approved estimate) still need a real date — they appear on the dashboard’s "Jobs to Schedule".',
      ]},
      { h: 'Good to know', body: 'On-call coverage is scheduled separately on the On-Call Schedule page. The Operations Dashboard warns you when on-call is scheduled less than two weeks out.' },
    ],
  },
  {
    id: 'maintenance',
    title: 'Maintenance (Agreements, Due & Checklists)',
    area: 'Operations',
    keywords: ['maintenance', 'agreement', 'agreements', 'plan', 'tier', 'due', 'pm', 'preventive', 'checklist', 'inspection', 'report', 'recurring', 'visit'],
    purpose: 'Maintenance keeps recurring service on track — the agreements customers are on, the visits coming due, and the checklists techs complete on each visit. It is your recurring-revenue engine.',
    sections: [
      { h: 'How to use it', items: [
        'Maintenance Agreements lists who is on a plan, their tier, and when their next visit is due.',
        'Maintenance Due surfaces upcoming visits so you can schedule them.',
        'PM Checklists (in Financials) defines what a tech inspects and measures each visit, per system type and tier.',
        'When a Preventive Maint job runs, the checklist auto-generates for each system at that property. The tech completes it on mobile, and a trended report goes to the customer alongside any recommended-work estimate.',
      ]},
      { h: 'Rules', items: [
        'Higher tiers add deeper checklist items and better benefits — not more visits.',
        'Measured values are recorded every visit, so the customer can see how their system is trending over time (for example, a capacitor weakening year over year).',
      ]},
      { h: 'Good to know', body: 'A clean-bill visit with nothing to quote still sends the customer their report, with a "no repairs recommended" note in place of an estimate.' },
    ],
  },
  {
    id: 'warranty-registrations',
    title: 'Warranty Registrations',
    area: 'Operations',
    keywords: ['warranty', 'registration', 'register', 'new system', 'retrofit', 'install', 'serial', 'model', 'manufacturer', '30 days', 'extended warranty'],
    purpose: 'New systems must be registered with the manufacturer within 30 days of install to secure the extended warranty. This page tracks every new install so none slip past the deadline.',
    sections: [
      { h: 'How to use it', items: [
        'Every Retrofit job automatically creates a warranty record — nothing to remember.',
        'On the Warranty Registrations page, fill in the equipment (brand, models, serials), or hit "Pull from Equipment on File" to copy what the tech recorded, then set the Registered date once you have registered online.',
        'The days-left pill counts down from 30: amber at 7 days, terracotta when overdue, green once registered.',
      ]},
      { h: 'Rules', items: [
        'The install signal is the Retrofit job type. Install date defaults to the job’s date and is editable.',
        'Unregistered systems within 30 days appear on the Operations Dashboard, most urgent first, and on the customer’s file.',
      ]},
      { h: 'Good to know', body: 'Filter the page by unregistered, all, or registered to focus on what still needs doing.' },
    ],
  },
]

// Map a route to the article that best explains it, so the drawer can open context-aware.
export const ROUTE_HELP = {
  '/operations': 'operations-dashboard',
  '/estimates': 'estimates',
  '/system-estimates': 'estimates',
  '/jobs': 'jobs',
  '/calendar': 'calendar',
  '/invoices': 'invoices',
  '/customers': 'customers-properties',
  '/properties': 'customers-properties',
  '/maintenance-agreements': 'maintenance',
  '/maintenance-due': 'maintenance',
  '/pm-checklists': 'maintenance',
  '/warranty-registrations': 'warranty-registrations',
}

export function searchArticles(query) {
  const q = (query || '').trim().toLowerCase()
  if (!q) return HELP_ARTICLES
  const hay = (a) => [a.title, a.area, a.purpose, a.keywords.join(' '),
    a.sections.map((s) => [s.h, s.body || '', (s.items || []).join(' ')].join(' ')).join(' ')].join(' ').toLowerCase()
  return HELP_ARTICLES.filter((a) => q.split(/\s+/).every((w) => hay(a).includes(w)))
}
