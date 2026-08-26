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
        'The green "This Week ✓" strip shows what you have already cleared: collected, estimates won, jobs completed, and close rate.',
        'A green ✓ and "All caught up" on a card means that bucket is empty. That is the win.',
        'If on-call coverage is scheduled less than two weeks out, an amber banner appears at the top — click it to open the On-Call Schedule.',
      ]},
      { h: 'What each bucket means', items: [
        'Unpaid Invoices — sent invoices that still have a balance. Age pills turn amber at 30 days, terracotta at 60+.',
        'Estimates to Follow Up — estimates sent with no reply yet. Amber at 2 days, terracotta at 5+.',
        'Completed, Not Invoiced — finished jobs with no invoice. Unbilled money.',
        'Warranty Registration — new systems (from Retrofit jobs) not yet registered. 30-day clock.',
        'Jobs to Schedule — jobs with no real date yet.',
        'Maintenance Due — agreements with a visit due within 30 days.',
        'Estimates Not Yet Sent — drafts that never went out.',
      ]},
      { h: 'Behind the scenes', body: 'The board refreshes on its own every minute and again whenever you return to the browser tab, so numbers stay live. All figures are for your organization only. Aging is measured from the date an invoice or estimate was sent.' },
      { h: 'Good to know', body: 'If an item has been filtered out of its own table (by a status filter, a search, or the archived toggle), clicking it opens the table but may not visibly highlight the row — clear the filter to see it.' },
    ],
  },
  {
    id: 'estimates',
    title: 'Estimates (Job & System)',
    area: 'Operations',
    keywords: ['estimate', 'estimates', 'quote', 'job estimate', 'system estimate', 'approve', 'decline', 'send estimate', 'preview', 'proposal', 'new system'],
    purpose: 'Estimates are the quotes you send a customer to approve before doing work. Journey has two kinds: Job Estimates (tied to a service job) and System Estimates (new-system installs, based on a property, with no job yet).',
    sections: [
      { h: 'The two kinds', items: [
        'Job Estimate — recommended repair or service work on an existing job. Lives in the "Job Estimates" table.',
        'System Estimate — a new-system sale, quoted against a property before any job exists. Lives in its own "System Estimates" table.',
      ]},
      { h: 'How to create and send', items: [
        'Create a Job Estimate from the job it belongs to. Create a System Estimate from the System Estimates table with "+ New System Estimate".',
        'Before sending, use Preview (or "Preview as customer") to see exactly what the customer will receive.',
        'Send to Customer emails them a link where they can Approve or Decline.',
        'When a preventive-maintenance checklist is completed, its report rides along on the same estimate — one link, report on top, recommended work below.',
      ]},
      { h: 'Rules', items: [
        'Approval status is "Pending" until the customer acts, then "Approved". Approved estimates can spawn the work.',
        'System Estimates resolve their customer and property directly from the estimate, because they have no job to look through.',
      ]},
      { h: 'Good to know', body: 'A clean-bill preventive-maintenance visit with nothing to quote still sends the customer their report — with a "no repairs recommended" note in place of an estimate.' },
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
        'Retrofit — a new-system install. Creating one automatically creates a Warranty Registration record (30-day clock).',
        'Preventive Maint — generates the PM checklist(s) for the system(s) at that property.',
        'Repair / Other — standard service work.',
      ]},
      { h: 'Good to know', body: 'Unscheduled or placeholder-dated jobs appear on the dashboard under "Jobs to Schedule"; completed jobs with no invoice under "Completed, Not Invoiced". A new column you add may be hidden if your saved column layout predates it — switch it on once in the Columns picker and it sticks.' },
    ],
  },
  {
    id: 'jobs-management',
    title: 'Jobs Management',
    area: 'Operations',
    keywords: ['jobs management', 'deleted', 'recover', 'cleanup', 'audit', 'bulk', 'oversight'],
    purpose: 'A higher-level view of jobs for oversight and cleanup — including jobs that have been deleted, so nothing is lost by accident.',
    sections: [
      { h: 'How to use it', body: 'Use it to review and audit jobs beyond the day-to-day list, including recently deleted ones (with when they were removed) so you can recover or account for them. For everyday scheduling and editing, use the Jobs table instead.' },
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
        'Record a payment (cash, check, or card). Recording takes a deliberate button tap and a confirmation, so it cannot fire by accident.',
      ]},
      { h: 'Rules', items: [
        'An invoice’s balance is its total minus what has been paid. Sent-but-unpaid invoices appear on the dashboard, aged from the send date.',
        'Void cancels an invoice. Archive hides it from the main list but keeps it for your records.',
      ]},
      { h: 'Good to know', body: 'A completed job with no invoice shows on the dashboard under "Completed, Not Invoiced" — that is unbilled work worth catching.' },
    ],
  },
  {
    id: 'customers-properties',
    title: 'Customers & Properties',
    area: 'Operations',
    keywords: ['customer', 'customers', 'customer file', 'property', 'properties', 'contact', 'invoice routing', 'history', 'address', 'billing contact'],
    purpose: 'The customer file is the full picture of one customer — their properties, jobs, estimates, invoices, maintenance agreements, warranty registrations, contacts, and attachments in one place. Properties are the physical locations where work happens.',
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
        'From the popup, "Open in Jobs Table" jumps to that job with the row highlighted, and the Customer name links to their file.',
        'Business hours and holidays (in Settings) control which time slots are available.',
      ]},
      { h: 'Good to know', body: 'Jobs with only a placeholder date (auto-set from an approved estimate) still need a real date — they appear on the dashboard’s "Jobs to Schedule". On-call is scheduled separately, on the On-Call Schedule page.' },
    ],
  },
  {
    id: 'tasks',
    title: 'Tasks',
    area: 'Operations',
    keywords: ['task', 'tasks', 'to do', 'todo', 'reminder', 'follow up', 'callback', 'assign'],
    purpose: 'A shared to-do list for things that need doing but are not a scheduled job — callbacks, follow-ups, and reminders for the office and field.',
    sections: [
      { h: 'How to use it', body: 'Create a task, assign it to a person, and check it off when it is done. Use it for the small things that would otherwise live on sticky notes — the ones easy to forget once the day gets busy.' },
    ],
  },
  {
    id: 'maintenance',
    title: 'Maintenance (Agreements, Due, Tiers & Checklists)',
    area: 'Operations',
    keywords: ['maintenance', 'agreement', 'agreements', 'plan', 'tier', 'tiers', 'due', 'pm', 'preventive', 'checklist', 'inspection', 'report', 'recurring', 'visit', 'dashboard'],
    purpose: 'Maintenance keeps recurring service on track — the agreements customers are on, the visits coming due, the tiers you offer, and the checklists techs complete each visit. It is your recurring-revenue engine.',
    sections: [
      { h: 'The pieces', items: [
        'Maintenance Agreements — who is on a plan, their tier, and when their next visit is due.',
        'Maintenance Due — upcoming visits, so you can schedule them.',
        'Maintenance Tiers — the plan levels you offer (e.g. Silver / Gold / Platinum) and what each includes.',
        'PM Checklists — what a tech inspects and measures each visit, per system type and tier.',
        'Maintenance Dashboard — a reporting view of the maintenance program (permission-gated).',
      ]},
      { h: 'How it flows', body: 'When a Preventive Maint job runs, the checklist auto-generates for each system at that property. The tech completes it on mobile, and a trended report goes to the customer alongside any recommended-work estimate.' },
      { h: 'Rules', items: [
        'Higher tiers add deeper checklist items and better benefits — not more visits.',
        'Measured values are recorded every visit, so the customer sees how their system trends over time (e.g. a capacitor weakening year over year).',
      ]},
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
        'Fill in the equipment (brand, models, serials), or hit "Pull from Equipment on File" to copy what the tech recorded, then set the Registered date once you have registered online.',
        'The days-left pill counts down from 30: amber at 7 days, terracotta when overdue, green once registered.',
      ]},
      { h: 'Good to know', body: 'The install signal is the Retrofit job type; install date defaults to the job’s date and is editable. Unregistered systems within 30 days appear on the dashboard, most urgent first, and on the customer’s file. Filter the page by unregistered / all / registered.' },
    ],
  },
  {
    id: 'vendors-parts',
    title: 'Vendors & Parts Catalog',
    area: 'Operations',
    keywords: ['vendor', 'vendors', 'supplier', 'parts', 'parts catalog', 'part', 'price', 'cost', 'inventory'],
    purpose: 'Vendors is your list of suppliers. Parts Catalog is your parts with their costs and prices, so a part drops onto an estimate or invoice at the right number.',
    sections: [
      { h: 'How to use it', body: 'Keep your suppliers in Vendors and your parts (with cost and price) in Parts Catalog. You can bulk-load both from Bulk Import — Import Parts Catalog and Import Vendor Price File — instead of typing them in one at a time.' },
    ],
  },
  {
    id: 'pricing',
    title: 'Pricebooks, Features & Discounts',
    area: 'Financials',
    keywords: ['pricebook', 'systems pricebook', 'special features', 'discount', 'discount catalog', 'pricing', 'price', 'catalog', 'add-on'],
    purpose: 'Where your pricing lives, so estimates and invoices build themselves at the right numbers.',
    sections: [
      { h: 'The catalogs', items: [
        'Pricebook — your service and repair prices.',
        'Systems Pricebook — your new-system packages, used to build System Estimates.',
        'Special Features — the add-ons offered on system estimates (e.g. an upgrade or an extra).',
        'Discount Catalog — named discounts you can apply to an estimate or invoice.',
      ]},
      { h: 'Good to know', body: 'Set these once and they flow everywhere. The Systems Pricebook and Special Features can be bulk-imported from Bulk Import.' },
    ],
  },
  {
    id: 'system-estimate-setup',
    title: 'System Estimate Setup',
    area: 'Financials',
    keywords: ['system estimate setup', 'included', 'installation', 'warranty', 'template', 'boilerplate', 'what is included'],
    purpose: 'Sets the standard "what’s included" installation block and the exact warranty wording that appear on every System Estimate — so you write them once instead of on every quote.',
    sections: [
      { h: 'How to use it', body: 'Enter your standard installation inclusions and your warranty language here. They are then shown automatically on every System Estimate the customer receives.' },
    ],
  },
  {
    id: 'text-archive',
    title: 'Text Archive',
    area: 'Operations',
    keywords: ['text', 'texts', 'sms', 'message', 'messages', 'archive', 'thread', 'communication'],
    purpose: 'A record of every text message technicians send customers from a job — one thread per conversation — so you have a paper trail of what was communicated.',
    sections: [
      { h: 'How to use it', body: 'A thread appears here as soon as a technician sends a message on a job. Open one to read the back-and-forth. It is a read record, not a place to start new conversations.' },
    ],
  },
  {
    id: 'team-roles',
    title: 'Team, Roles & Permissions',
    area: 'Admin',
    keywords: ['team', 'user', 'users', 'staff', 'role', 'roles', 'permission', 'permissions', 'access', 'tags', 'grant'],
    purpose: 'Team is your people; Roles & Tags controls what each of them can do.',
    sections: [
      { h: 'How to use it', items: [
        'Team lists your users and lets you add or manage them.',
        'Roles & Tags defines roles and the granular permissions attached to them — who can see the Maintenance Dashboard, void invoices, and so on.',
        'Assign a person a role to grant them its permissions.',
      ]},
      { h: 'Good to know', body: 'On-call technicians can be granted extra permissions automatically, only for their on-call window — see the On-Call Schedule.' },
    ],
  },
  {
    id: 'on-call',
    title: 'On-Call Schedule',
    area: 'Admin',
    keywords: ['on-call', 'on call', 'after hours', 'emergency', 'coverage', 'supervisor', 'rotation', 'permissions'],
    purpose: 'Sets who covers after-hours calls — a calendar of periods, each with a supervisor and a technician.',
    sections: [
      { h: 'How it works', items: [
        'Schedule on-call periods ahead of time, each assigning a supervisor and a tech.',
        'While on call, a technician is automatically granted the extra permissions they need to handle emergencies — and only for their on-call window.',
      ]},
      { h: 'Good to know', body: 'The Operations Dashboard shows an amber banner when on-call is scheduled less than two weeks out, so coverage never quietly lapses.' },
    ],
  },
  {
    id: 'job-checklists',
    title: 'Job Checklists',
    area: 'Admin',
    keywords: ['checklist', 'checklists', 'template', 'safety', 'steps', 'job checklist'],
    purpose: 'Reusable checklist templates a technician completes on a job — safety steps, install steps, and the like.',
    sections: [
      { h: 'Good to know', body: 'These are general job checklists. Preventive-maintenance checklists are separate and live under PM Checklists, because they drive the trended maintenance report.' },
    ],
  },
  {
    id: 'time-payroll',
    title: 'Time Clock & Payroll',
    area: 'Admin',
    keywords: ['time clock', 'clock in', 'clock out', 'hours', 'payroll', 'pay', 'timesheet', 'capture'],
    purpose: 'Time Clock is where staff clock in and out; Payroll Capture pulls those hours together for payroll.',
    sections: [
      { h: 'How to use it', body: 'Staff clock in and out on the Time Clock. Payroll Capture gathers the recorded hours so you can run payroll from them. (Sign-In Log is separate — that tracks app access, not work hours.)' },
    ],
  },
  {
    id: 'sign-in-log',
    title: 'Sign-In Log',
    area: 'Admin',
    keywords: ['sign-in', 'sign in', 'sign-out', 'log', 'audit', 'security', 'access', 'session'],
    purpose: 'A security audit trail of who signed in and out of Journey and when. Admin-only.',
    sections: [
      { h: 'Good to know', body: 'Use it to review app access. This is about signing into the software, not clocking in for work — for hours worked, see Time Clock.' },
    ],
  },
  {
    id: 'settings',
    title: 'Settings',
    area: 'Admin',
    keywords: ['settings', 'business hours', 'holidays', 'branding', 'logo', 'payment terms', 'organization', 'preferences'],
    purpose: 'Your organization’s settings — the things you configure once that flow through the whole app.',
    sections: [
      { h: 'What lives here', items: [
        'Business hours and holidays — which drive the slots available on the Calendar and in booking.',
        'Branding shown to customers on estimates and invoices.',
        'Payment terms and other organization-wide preferences.',
      ]},
    ],
  },
  {
    id: 'announcements',
    title: 'Announcements',
    area: 'Admin',
    keywords: ['announcement', 'announcements', 'banner', 'notice', 'broadcast', 'company-wide'],
    purpose: 'Post a message that shows as a banner to everyone in your organization — handy for company-wide notices.',
    sections: [
      { h: 'How to use it', body: 'Create an announcement and it appears as a banner across the app for your team until you remove it.' },
    ],
  },
  {
    id: 'bulk-import',
    title: 'Bulk Import',
    area: 'Admin',
    keywords: ['import', 'bulk', 'spreadsheet', 'csv', 'upload', 'migrate', 'data', 'customers', 'properties', 'jobs'],
    purpose: 'Bring existing data into Journey from spreadsheets, instead of entering it by hand.',
    sections: [
      { h: 'What you can import', body: 'Customers, Properties, Jobs, your Parts Catalog, Services and Systems Pricebooks, and a Vendor Price File.' },
      { h: 'Good to know', body: 'Import entities before the things that reference them — Customers and Properties first, then Jobs — so each job can find its customer and property.' },
    ],
  },
]

// Map a route to the article that best explains it, so the drawer can open context-aware.
// NOTE: order matters — a longer path that shares a prefix must come BEFORE the shorter one
// (e.g. /jobs-management before /jobs), because matching is by startsWith.
export const ROUTE_HELP = {
  '/operations': 'operations-dashboard',
  '/jobs-management': 'jobs-management',
  '/jobs': 'jobs',
  '/calendar': 'calendar',
  '/tasks': 'tasks',
  '/customers': 'customers-properties',
  '/properties': 'customers-properties',
  '/system-estimate-setup': 'system-estimate-setup',
  '/system-estimates': 'estimates',
  '/estimates': 'estimates',
  '/maintenance-agreements': 'maintenance',
  '/maintenance-due': 'maintenance',
  '/maintenance-tiers': 'maintenance',
  '/maintenance-dashboard': 'maintenance',
  '/pm-checklists': 'maintenance',
  '/warranty-registrations': 'warranty-registrations',
  '/invoices': 'invoices',
  '/vendors': 'vendors-parts',
  '/parts-catalog': 'vendors-parts',
  '/text-archive': 'text-archive',
  '/pricebook': 'pricing',
  '/systems-pricebook': 'pricing',
  '/special-features': 'pricing',
  '/discount-catalog': 'pricing',
  '/team': 'team-roles',
  '/roles': 'team-roles',
  '/on-call': 'on-call',
  '/checklists': 'job-checklists',
  '/time-clock': 'time-payroll',
  '/payroll': 'time-payroll',
  '/session-log': 'sign-in-log',
  '/settings': 'settings',
  '/announcements': 'announcements',
  '/import': 'bulk-import',
}

export function searchArticles(query) {
  const q = (query || '').trim().toLowerCase()
  if (!q) return HELP_ARTICLES
  const hay = (a) => [a.title, a.area, a.purpose, a.keywords.join(' '),
    a.sections.map((s) => [s.h, s.body || '', (s.items || []).join(' ')].join(' ')).join(' ')].join(' ').toLowerCase()
  return HELP_ARTICLES.filter((a) => q.split(/\s+/).every((w) => hay(a).includes(w)))
}
