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

  // ===== Assets & Inventory Management (Elements) =====
  {
    id: 'assets-dashboard',
    title: 'Assets Management Dashboard',
    area: 'Assets',
    keywords: ['assets', 'dashboard', 'inventory', 'fleet', 'purchase orders', 'awaiting receipt', 'open po', 'overdue', 'hub'],
    purpose: 'The hub for everything your company owns and stocks — it fronts Inventory Management and Fleet Management, and surfaces purchase orders still awaiting receipt so nothing you’ve ordered gets forgotten.',
    sections: [
      { h: 'How to use it', items: [
        'Pick an area card — Inventory Management or Fleet Management — to jump into it. (Tools & Equipment is a placeholder for future asset types.)',
        'The "Purchase Orders awaiting receipt" panel lists every ordered or partially-received PO, most urgent first.',
        'Overdue POs (past their expected date) sort to the top with a red flag; the panel header shows how many are overdue.',
        'Click any PO row to open it in Purchase Orders, ready to receive.',
      ]},
      { h: 'Good to know', body: 'The panel shows up to eight POs with a "+N more" link; an empty panel means nothing is awaiting receipt. Only ordered and partial POs appear here — drafts and fully-received POs do not.' },
    ],
  },
  {
    id: 'inv-overview',
    title: 'Inventory Dashboard',
    area: 'Inventory',
    keywords: ['inventory', 'overview', 'dashboard', 'module', 'landing', 'elements', 'enabled', 'trucks', 'warehouses', 'parts', 'mapped', 'low stock', 'open pos', 'at a glance'],
    purpose: 'The landing page for Inventory Management — an at-a-glance dashboard of the four things worth watching (low stock, open POs, recent variance, and inventory value), plus module stats and shortcuts into each area.',
    sections: [
      { h: 'At a glance', items: [
        'Low stock — how many stock lines are at or under their reorder point; click through to Replenishment. It turns red when anything needs reordering.',
        'Open purchase orders — POs that are ordered or partially received, with the next expected delivery date and the dollar value on order; click through to Purchase Orders.',
        'Variance (90 days) — the net dollar impact of posted count adjustments and matched-invoice price/qty differences over the last 90 days; click through to Inventory Variance.',
        'Inventory value — what stock on hand is worth right now at cost; click through to Inventory Valuation.',
      ]},
      { h: 'The rest of the page', items: [
        'Below the cards, the stat tiles count your trucks, warehouses, catalog parts, and services with a parts kit mapped.',
        'The navigation cards link into Locations, Item Catalog, Stock & Receiving, Cycle Counts, Purchase Orders, Service → Part Mapping, and Inventory Settings.',
        'The pill by the title shows whether the module is enabled; turn it on in Inventory Settings once your items, trucks, and mappings are ready. Use Refresh to repull the live numbers.',
      ]},
    ],
  },
  {
    id: 'inv-locations',
    title: 'Locations (Warehouses & Trucks)',
    area: 'Inventory',
    keywords: ['locations', 'warehouse', 'shop', 'truck', 'vehicle', 'fleet', 'assigned', 'available', 'archive', 'retire', 'delete', 'transfer', 'spare', 'status'],
    purpose: 'Your stocking locations: warehouses / shops and service trucks. On-hand is tracked per location, so you always know what is where. Trucks carry a lifecycle status so stock and history are never lost when a vehicle changes hands or leaves service.',
    sections: [
      { h: 'How to use it', items: [
        'Add a Warehouse / Shop with a name and address.',
        'Add a Truck by picking a vehicle from Fleet — its name and assigned technician come straight from the Fleet record, so the two never drift apart.',
        'The Stock column shows what each location is currently carrying (parts and value).',
      ]},
      { h: 'Truck status (set automatically)', items: [
        'Assigned — an active truck with a driver assigned in Fleet.',
        'Available — an active truck with no driver right now. It is still live and can hold stock; a truck between drivers belongs here, not in Archive. This follows Fleet automatically — assign a driver and it becomes Assigned again.',
        'Archived — benched or surplus, kept for future use. History is preserved and it can be restored.',
        'Retired — permanently out of the fleet. History is kept forever, and it can still be restored if the vehicle ever returns.',
      ]},
      { h: 'Archive, Retire, and Delete', items: [
        'Archive or Retire is blocked while a location still holds stock — transfer the stock to another location first (Stock & Receiving → Transfer), so inventory is never hidden.',
        'Archive is for a vehicle temporarily out of rotation (surplus, or off the road for now) that stays in the fleet.',
        'Retire is for a vehicle permanently out of fleet service. It keeps all history — nothing is destroyed.',
        'Delete is only for empty records created by mistake — it is disabled the moment a location holds stock, and the database blocks it if any history exists. Use Retire, not Delete, for a real vehicle.',
        'Turn on "Show archived & retired" to see inactive locations and Restore them.',
      ]},
      { h: 'Good to know', body: 'Trucks must be recorded in Fleet → Vehicles first. A truck’s assigned technician is read-only here — change it on the Fleet vehicle and it follows automatically, including whether the truck shows as Assigned or Available.' },
    ],
  },
  {
    id: 'inv-items',
    title: 'Item Catalog',
    area: 'Inventory',
    keywords: ['item', 'items', 'catalog', 'part', 'parts', 'sku', 'consumable', 'stock type', 'special order', 'cost', 'uom', 'unit', 'barcode', 'import', 'export'],
    purpose: 'Your parts and consumables — one entry per part, with its cost, vendor, units, and whether you stock it or special-order it.',
    sections: [
      { h: 'Key fields', items: [
        'Description & Category — how the part reads everywhere else in the module.',
        'Type (stock vs special order) — stock parts feed replenishment and forecasting; special-order parts are bought per job and skip both. Set it when you create a part, and change it any time.',
        'Cost, vendor part number, barcode, and units (each, or a stock unit like a box with a conversion).',
      ]},
      { h: 'How to use it', items: [
        'Add a part with "+ New", or bulk-load your whole catalog from a spreadsheet with Import (and Export for a template or a backup).',
        'Search, filter by class, and toggle "Show archived" to see retired parts.',
        'Archive a part you no longer use instead of deleting it, so its history stays intact.',
      ]},
      { h: 'Good to know', body: 'Special-order parts show a tag and are deliberately kept out of replenishment and demand forecast — since nothing stays the same forever, you can flip a part between stock and special order whenever it changes.' },
    ],
  },
  {
    id: 'inv-stock',
    title: 'Stock & Receiving',
    area: 'Inventory',
    keywords: ['stock', 'on hand', 'on-hand', 'receive', 'receiving', 'transfer', 'reorder point', 'max', 'par', 'levels', 'ledger'],
    purpose: 'On-hand by location, and where you receive stock in and move it between locations. Every change is written to the stock ledger, the single source of truth for quantities and cost.',
    sections: [
      { h: 'How to use it', items: [
        'Pick a location to see its on-hand for every part.',
        'Receive adds stock at a unit cost (e.g. a delivery straight to the shop) — this updates the part’s last cost.',
        'Transfer moves stock from one location to another (e.g. shop → truck).',
        'Set a Reorder point and a Max (par) per part per location — these drive Replenishment.',
      ]},
      { h: 'Good to know', body: 'Receiving against a purchase order is done from Purchase Orders (not here), so PO progress and costs stay in sync. Use this screen for manual receipts and transfers.' },
    ],
  },
  {
    id: 'inv-cycle-counts',
    title: 'Cycle Counts',
    area: 'Inventory',
    keywords: ['cycle count', 'count', 'counts', 'physical count', 'blind count', 'variance', 'adjust', 'shrinkage', 'audit', 'reconcile'],
    purpose: 'Count what is physically on a truck or in the warehouse, review the variances, and post corrections to on-hand. This is how you keep your numbers honest — replenishment, job costing, and forecasting are only as good as your counts.',
    sections: [
      { h: 'How to use it', items: [
        'Start a count, pick a location, and choose the scope — everything stocked there, one category, or start empty and add items by hand.',
        'By default it is a blind count: the expected quantity is hidden while you enter what you actually see, so the count is not biased.',
        'Enter your counts (they save as you go), then "Reveal variances" to see the book quantity and the difference per line.',
        'Post the count to write the corrections to the ledger and bring on-hand to exactly what you counted.',
      ]},
      { h: 'Good to know', body: 'Posting adjusts to the current on-hand at the moment you post, so a part pulled mid-count is respected. Posted counts are permanent history — to fix a mistake, run another count. Use "Add an item found on the shelf" for stock that shouldn’t be there but is.' },
    ],
  },
  {
    id: 'inv-replenishment',
    title: 'Replenishment',
    area: 'Inventory',
    keywords: ['replenishment', 'restock', 'reorder', 'par', 'max', 'transfer', 'refill truck', 'shortfall', 'top up'],
    purpose: 'Everything sitting at or below its reorder point, with how much to buy or move to bring it back up to Max. Refill a truck from the warehouse in one click; warehouse shortfalls are flagged to purchase.',
    sections: [
      { h: 'How to use it', items: [
        'Pick the warehouse to "Refill trucks from". For each truck shortfall, Transfer moves the suggested quantity from that warehouse in one click.',
        'When the warehouse itself is short, the row is flagged to purchase instead.',
        'Filter by location or search by part; the header shows the total dollar value to top up.',
      ]},
      { h: 'Good to know', body: 'This list is driven by the Reorder and Max levels you set on Stock & Receiving. Special-order parts are excluded — they are bought per job. Set restock days and lead/safety defaults in Inventory Settings.' },
    ],
  },
  {
    id: 'inv-health',
    title: 'Inventory Health (Anomalies)',
    area: 'Inventory',
    keywords: ['health', 'anomaly', 'anomalies', 'alerts', 'negative stock', 'stockout', 'cost outlier', 'dead stock', 'shrinkage', 'usage spike', 'missing cost'],
    purpose: 'A live scan for the inventory problems worth acting on — negative stock, stockouts, cost outliers, dead stock, usage spikes, and shrinkage. It changes nothing; fix the underlying issue and the flag clears itself.',
    sections: [
      { h: 'What it flags', items: [
        'Negative on-hand (high) — stock went below zero; run a count.',
        'Stockouts — a stocked part at zero where a reorder point is set.',
        'Cost outliers — a receipt priced well off the expected cost.',
        'Usage spikes — last 30 days well above the recent average.',
        'Shrinkage — parts that came up short across recent cycle counts.',
        'Dead stock & Missing cost (low) — cash sitting idle, or stock with no cost on record.',
      ]},
      { h: 'How to use it', body: 'Flags are grouped by type and ranked by severity, each with a plain-English note on what it means and what to do. Filter by severity, and hit Refresh after you’ve made fixes to confirm they cleared.' },
    ],
  },
  {
    id: 'inv-purchase-orders',
    title: 'Purchase Orders',
    area: 'Inventory',
    keywords: ['purchase order', 'po', 'purchasing', 'order', 'receive', 'vendor', 'job name', 'draft', 'cancel', 'numbering', 'specialty part'],
    purpose: 'Create and receive purchase orders to your vendors. POs are numbered automatically, can carry a job name, and receiving flows straight into stock and cost.',
    sections: [
      { h: 'How to use it', items: [
        'Create a PO, pick the vendor and deliver-to location, add parts, and (optionally) a job name so you know what the order is for.',
        'Add catalog parts by searching, or type a part that isn’t in your catalog yet and create it on the spot (it defaults to special-order).',
        'When goods arrive, open the PO and receive against it — on-hand and costs update, and the PO advances to Partial or Received.',
        'Search by number, job name, vendor, or part. The default "Relevant" view shows in-flight POs plus anything received in the last 30 days; switch the filter to see all, cancelled, or older receipts.',
      ]},
      { h: 'Numbering', body: 'New POs get the next number automatically (PO-1001, PO-1002…). If you’re moving from another system, use the numbering control on this screen to set the next number so your sequence continues where you left off.' },
      { h: 'Good to know', body: 'A draft you change your mind about can be deleted; an ordered PO can be cancelled. Open POs awaiting receipt also surface on the Assets Dashboard.' },
    ],
  },
  {
    id: 'inv-special-orders',
    title: 'Special Orders',
    area: 'Inventory',
    keywords: ['special order', 'special orders', 'per job', 'customer part', 'requested', 'ordered', 'ready', 'pickup', 'needed by'],
    purpose: 'A tracking board for parts you order for a specific customer or job that you don’t keep in stock — so nothing ordered for a customer gets lost.',
    sections: [
      { h: 'How to use it', items: [
        'Create a special order, search your customer list to link it (or just type a name), describe the part, and add a vendor, estimated cost, PO reference, and needed-by date.',
        'Move it along with one click: Requested → Ordered → Received → Ready → Closed. Each step is timestamped.',
        'Filter by stage; the header shows how many are active and how many are ready for pickup. Anything past its needed-by date is flagged overdue.',
      ]},
      { h: 'Good to know', body: 'Special orders are intentionally separate from stock — marking one "received" never touches your on-hand, because the part goes straight to the job. The part is free text by default (special-order parts usually aren’t in your catalog), but you can link a catalog item if it is one.' },
    ],
  },
  {
    id: 'inv-vendor-invoices',
    title: 'Vendor Invoices (A/P)',
    area: 'Inventory',
    keywords: ['vendor invoice', 'a/p', 'accounts payable', 'bill', 'capture', '3-way match', 'three way match', 'variance', 'stage for payment', 'packing slip', 'quote'],
    purpose: 'Capture a vendor’s bill, match it against its purchase order and what was received (a 3-way match), and stage it for payment. The original file is kept on the record.',
    sections: [
      { h: 'How to use it', items: [
        'Capture a bill by uploading a photo or PDF — Quincy reads the vendor, invoice number, dates, and line items, and matches them to a vendor, a PO, and your catalog parts for you to confirm.',
        'The 3-way match compares ordered vs received vs billed on each line and flags price or quantity variances.',
        'Stage for payment when a bill is good to go; put it On hold if something is off. Staged bills wait for the future Bookkeeping module.',
        'From a matched bill you can receive the goods into stock, and open the original file any time.',
      ]},
      { h: 'Good to know', body: 'Every confirmed line teaches the Vendor Cross-Reference, so the next bill from that vendor auto-matches the same part by its SKU. Filter the queue by Needs review, Staged, or On hold.' },
    ],
  },
  {
    id: 'inv-vendor-crossref',
    title: 'Vendor Cross-Reference',
    area: 'Inventory',
    keywords: ['cross reference', 'crossref', 'alias', 'vendor sku', 'crosswalk', 'reconcile', 'suggest matches', 'learn', 'seed'],
    purpose: 'Bridges each vendor’s own part names and SKUs to your generic catalog, so their invoices match automatically. It learns as you capture bills, and you can seed it from purchase history.',
    sections: [
      { h: 'How to use it', items: [
        'Pick a vendor and "Suggest matches from history" — Quincy proposes which of that vendor’s past parts map to your catalog items, judged so single vs dual capacitors, exact sizes, and accessories are sorted out.',
        'Review the picks (pre-selected, with a dropdown to override or clear), select the ones you trust, and save. Nothing is stored until you confirm.',
        'The "Learned aliases" list shows what is saved for that vendor; remove any that are wrong.',
      ]},
      { h: 'Good to know', body: 'The crosswalk also fills itself in every time you confirm a captured vendor invoice — seeding here just gives it a head start. Once a vendor’s SKU is learned, their future bills auto-match without guessing.' },
    ],
  },
  {
    id: 'inv-service-map',
    title: 'Service → Part Mapping',
    area: 'Inventory',
    keywords: ['service map', 'mapping', 'kit', 'bom', 'bill of materials', 'parts kit', 'deplete', 'consume'],
    purpose: 'Link a service to the parts it consumes — a "kit" or bill of materials. When that service lands on an invoice and you record parts used, the kit is what depletes from stock.',
    sections: [
      { h: 'How to use it', items: [
        'Pick a service on the left, then build its parts list on the right — add catalog parts with a quantity each.',
        'Services that read as labor, fees, or memberships are filtered out of the default view, since they consume no parts; switch the view to see kitted, empty, or all services.',
      ]},
      { h: 'Good to know', body: 'A well-built kit is what makes "Record Parts Used" one click — the parts are already suggested from the services on the invoice.' },
    ],
  },
  {
    id: 'inv-parts-used',
    title: 'Record Parts Used',
    area: 'Inventory',
    keywords: ['parts used', 'record parts', 'consumption', 'deplete', 'truck', 'invoice', 'work order'],
    purpose: 'Record the parts that actually left the truck on a job. This depletes stock and powers Parts Usage, Job Costing, and Demand Forecast — the single most valuable habit for keeping inventory accurate.',
    sections: [
      { h: 'How to use it', items: [
        'Pick an invoice on the left (filter by recorded / not recorded, or search).',
        'Confirm the parts that really moved — seeded from the kits of the services billed — and record them.',
        'Recording depletes the technician’s truck and marks the invoice recorded.',
      ]},
      { h: 'Good to know', body: 'The billed invoice is what the customer pays; Parts Used is what physically moved — they don’t have to match. The same panel is used in the field on the mobile work order, so office and tech post through identical logic.' },
    ],
  },
  {
    id: 'inv-usage',
    title: 'Parts Usage',
    area: 'Inventory',
    keywords: ['usage', 'parts usage', 'consumed', 'report', 'truck', 'technician', 'cost'],
    purpose: 'What each truck and technician has consumed over a date range, valued at cost — a read-only report drawn from the stock ledger.',
    sections: [
      { h: 'How to use it', body: 'Set a From / To range and Run report. Results group by truck, with each part’s quantity and cost, and a grand total of parts cost consumed.' },
      { h: 'Good to know', body: 'This reflects what was entered in Record Parts Used. The more consistently parts are recorded, the more complete this report — and Job Costing and Demand Forecast — become.' },
    ],
  },
  {
    id: 'inv-valuation',
    title: 'Inventory Valuation',
    area: 'Inventory',
    keywords: ['valuation', 'value', 'worth', 'inventory value', 'cost', 'on hand value', 'by location', 'by category', 'asset'],
    purpose: 'What your stock on hand is worth right now, valued at cost — broken down by location and by category. A live, current-value snapshot you can pull any time.',
    sections: [
      { h: 'How to use it', items: [
        'The tiles show total value, how many parts are in stock, and across how many locations.',
        'Switch the breakdown between By location and By category to see where the value sits.',
        'The detail table lists every stocked part, its on-hand, unit cost, and value — highest value first.',
      ]},
      { h: 'Good to know', body: 'Each part is valued at its average cost, falling back to last cost, then standard cost. Parts with no cost on record are flagged "not valued" and excluded from the total — set a cost in the Item Catalog to include them. This is current value only; it is not stored as a weekly history.' },
    ],
  },
  {
    id: 'inv-variance',
    title: 'Inventory Variance',
    area: 'Inventory',
    keywords: ['variance', 'shrink', 'shrinkage', 'count variance', 'purchase variance', 'price variance', 'overbilled', 'adjustment', 'discrepancy', 'loss', 'exception'],
    purpose: 'Where reality did not match the plan — in dollars. Count variance is what a posted cycle count changed versus the expected quantity; purchase variance is where a vendor invoice billed a different price or quantity than its purchase order.',
    sections: [
      { h: 'How to use it', items: [
        'The tiles show net variance, count adjustments, purchase variance, and how many exceptions are in view.',
        'Filter by All, Count, or Purchase, and choose a time window (last 30 / 90 days, last year, or all time).',
        'The table lists each exception, largest dollar impact first — date, type, item, where (location for counts, vendor for purchases), expected vs. actual, quantity change, and the dollar impact.',
      ]},
      { h: 'What the numbers mean', body: 'Count value impact = adjusted quantity times item cost (average, else last, else standard). Purchase value impact = (invoiced unit price minus PO unit price) times invoiced quantity. For counts, a negative number is shrink — inventory was worth less than the books said. For purchases, a positive number means the invoice cost more than the PO.' },
      { h: 'Good to know', body: 'Count variance appears once you post a cycle count that had adjustments; purchase variance appears once a vendor invoice is matched to a PO line with a price or quantity difference. It is computed live — refresh any time.' },
    ],
  },
  {
    id: 'inv-job-costing',
    title: 'Job Costing',
    area: 'Inventory',
    keywords: ['job costing', 'margin', 'material cost', 'billed', 'profit', 'cost of job', 'material percent'],
    purpose: 'What each job actually cost you in parts, next to what you billed — so you can see material spend and margin by job. Labor is not included.',
    sections: [
      { h: 'How to use it', items: [
        'Pick a date range. Each row shows the invoice, customer, job, amount billed, material cost, what is left after materials, and material as a percent of billed (green under 35%, amber to 55%, red above).',
        'The summary strip totals billed, material, and the blended material percentage.',
      ]},
      { h: 'Good to know', body: 'Only jobs where parts were recorded appear (an invoice with no parts recorded would misleadingly look like 100% margin). "Billed" is the pre-tax subtotal; each part is valued at its recorded cost. This sharpens as Record Parts Used becomes routine.' },
    ],
  },
  {
    id: 'inv-forecast',
    title: 'Demand Forecast',
    area: 'Inventory',
    keywords: ['forecast', 'demand', 'usage rate', 'days of cover', 'run out', 'reorder', 'order to cover', 'trend', 'predict'],
    purpose: 'Projects how fast each part is used into days of cover, a run-out date, and a suggested order quantity — so you can buy ahead of demand instead of reacting to a stockout.',
    sections: [
      { h: 'How to use it', items: [
        'Choose the history window it learns from and the number of days of cover you want to hold.',
        'Each part shows its monthly usage, on-hand, days of cover, projected run-out, a trend arrow (rising / steady / easing), and how many to order to hit your coverage target. Most urgent sorts to the top.',
      ]},
      { h: 'Good to know', body: 'Rates are a simple trailing average, not seasonal — they sharpen with a full year of history. Trend compares the last 30 days to the whole window. Special-order parts are excluded, and the whole report grows more useful the more parts usage is recorded.' },
    ],
  },
  {
    id: 'inv-settings',
    title: 'Inventory Settings',
    area: 'Inventory',
    keywords: ['inventory settings', 'enable', 'restock day', 'issue day', 'lead time', 'safety stock', 'par', 'cadence'],
    purpose: 'Turn the Inventory module on or off and set the defaults that drive restocking.',
    sections: [
      { h: 'What lives here', items: [
        'Enable Inventory — when on, invoiced pricebook parts deduct from the assigned technician’s truck. Leave it off until items, trucks, and service mappings are ready.',
        'Weekly truck restock day(s) — the days trucks are refilled to par. More frequent restocks keep both truck and shop stock leaner.',
        'Default vendor lead time and Safety stock (days) — fallbacks used when planning replenishment (lead time can also be set per vendor).',
      ]},
      { h: 'Good to know', body: 'The starting number for purchase orders is set on the Purchase Orders screen, not here.' },
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
  // Assets & Inventory Management (Elements). Specific /elements/* routes must
  // come BEFORE the bare /elements base, because matching is by startsWith.
  '/assets': 'assets-dashboard',
  '/elements/locations': 'inv-locations',
  '/elements/items': 'inv-items',
  '/elements/stock': 'inv-stock',
  '/elements/cycle-counts': 'inv-cycle-counts',
  '/elements/replenishment': 'inv-replenishment',
  '/elements/health': 'inv-health',
  '/elements/purchasing': 'inv-purchase-orders',
  '/elements/special-orders': 'inv-special-orders',
  '/elements/ap': 'inv-vendor-invoices',
  '/elements/vendor-crossref': 'inv-vendor-crossref',
  '/elements/service-map': 'inv-service-map',
  '/elements/parts-used': 'inv-parts-used',
  '/elements/usage': 'inv-usage',
  '/elements/valuation': 'inv-valuation',
  '/elements/variance': 'inv-variance',
  '/elements/job-costing': 'inv-job-costing',
  '/elements/forecast': 'inv-forecast',
  '/elements/settings': 'inv-settings',
  '/elements': 'inv-overview',
}

export function searchArticles(query) {
  const q = (query || '').trim().toLowerCase()
  if (!q) return HELP_ARTICLES
  const hay = (a) => [a.title, a.area, a.purpose, a.keywords.join(' '),
    a.sections.map((s) => [s.h, s.body || '', (s.items || []).join(' ')].join(' ')).join(' ')].join(' ').toLowerCase()
  return HELP_ARTICLES.filter((a) => q.split(/\s+/).every((w) => hay(a).includes(w)))
}
