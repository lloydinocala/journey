// Living help/documentation for Journey. Structured (not prose) so it serves three readers:
// the USER (rendered in the Help drawer), an AI (fed as context), and future-you (single source
// of truth). Update these as features change — treat it like committing code.
//
// Article shape:
//   { id, title, area, keywords:[], purpose, sections:[ { h, items?:[], body? } ] }
// A section renders as a heading + either a bullet list (items) or a paragraph (body).

export const HELP_ARTICLES = [
  {
    id: 'home-dashboard',
    title: 'HOME (Command Dashboard)',
    area: 'Overview',
    keywords: ['home', 'dashboard', 'command', 'kpi', 'kpis', 'board', 'tiles', 'at a glance', 'period', 'investigate', 'quincy', 'customize', 'arrange', 'add kpi', 'gross margin', 'on-time', 'sales'],
    purpose: 'HOME is your daily command board — the whole business at a glance for one organization and one time window. It is read-only reporting, not a place you edit records: every tile is a live number that links straight to the page where you act on it. A manager can run the entire morning review from here.',
    sections: [
      { h: 'What it is for', body: 'Open HOME to answer one question fast: how is the business doing right now? The Quincy Brief across the top gives a plain-English summary; the KPI tiles below give the vital signs — money, jobs, margins, pipeline, and fleet — each drawn as the right visual for its data (a single number, a gauge against a goal, a bar or column chart, or a flags list). You do not fix anything on this page; you read a signal, then click into the page behind it.' },
      { h: 'Step 1 — choose what you are looking at', items: [
        'Check the Viewing-Organization pill (top-left) shows the right company. Platform owners can click the pill to switch to any client org; the whole board reloads for that company and your choice is remembered next time.',
        'Set the Period dropdown (top-right): This month (default), Last 30 days, This quarter, or Year to date. Every date-based tile re-queries the instant you change it.',
        'Four tiles are point-in-time by design and do NOT follow the period: Recurring revenue and Outstanding estimates (both "as of now"), Payroll % of sales (always last 6 months), and Unusual fuel / mileage flags (current).',
      ]},
      { h: 'Step 2 — read the tiles', items: [
        'Sales — invoiced revenue for the period. Recurring revenue — agreement run-rate per month. Outstanding estimates — unsold pipeline value.',
        'Jobs / tech / day — completed jobs per technician per working day. Gross margin — a gauge with a 60% floor line. On-time arrival — a gauge with a 90% floor (within 15 min of schedule).',
        'Revenue by tech and Revenue by job type — ranked bar charts. Payroll % of sales — a column chart against a 20% ceiling. Estimates: presented vs. sold — pipeline conversion for the period.',
        'Inventory variance $ by truck holder — posted count adjustments by who holds the stock. Unusual fuel / mileage flags — fleet anomalies to chase.',
      ]},
      { h: 'Step 3 — act on a number', items: [
        'Click a tile body to drill to the page behind it — Sales and Gross margin open Invoices; Outstanding and Presented-vs-sold open Estimates; Jobs/tech/day and On-time open Jobs Management; Recurring opens Maintenance Agreements; Payroll opens Payroll. A small ↗ marks a tile that drills.',
        'Click a single bar on Revenue by tech or by job type to open Jobs pre-filtered to exactly that technician or job type.',
        'Click the ✦ (Investigate) icon on any tile for an AI read of that number for this org and period — what it is saying, likely drivers, and what to do next.',
      ]},
      { h: 'Customizing the board (managers/owners only)', items: [
        'These controls appear only for a super-admin or anyone with the "customize dashboard" permission; everyone else sees the board read-only.',
        '+ Add KPI — pick a base measure (Revenue, Gross profit, Estimate value, Jobs completed) and a breakdown (total, by tech, by job type, by customer, by month, by status); the builder picks the right chart and adds the tile to the end of the board.',
        'Arrange — drag any tile by its handle to reorder, and use the − S/M/L + control to resize (single-value tiles cap at M, charts go to L). Every change saves automatically; click Done arranging when finished.',
        'Remove a tile with its × ; Reset to default restores the standard 12-tile board (that button only shows once an org has customized). The factory default can never be lost.',
      ]},
      { h: 'Good to know', body: 'Layouts are saved per organization, so each client company keeps its own board. The board fetches fresh data whenever you change org, period, or a widget. Use the "Jump to a section" chips at the bottom to leave HOME for a major work area (Operations, Financials, Admin, Inventory, Fleet, Tools, Marketing, HR, Payroll) — modules your org does not own will return you to Home.' },
    ],
  },
  {
    id: 'filter-orders',
    title: 'Filter Orders',
    area: 'Operations',
    keywords: ['filter', 'filters', 'filter order', 'flt', 'air filter', 'reorder', 'pricebook', 'delivery', 'shipped', 'fulfill', 'merv', 'subscription'],
    purpose: 'Filter Orders is where every air-filter sale is placed, fulfilled, and tracked — orders from the customer portal, phoned in by a customer or a tech, from the website, or entered in the office. Each one is a FLT-#### invoice linked to the customer.',
    sections: [
      { h: 'What it is for', body: 'This is the one place all filter orders land, whatever their source, so nothing is missed and every order is tracked from placed to delivered. Payment and fulfillment are tracked separately — you can deliver an order before it is paid, and the customer gets a pay link either way.' },
      { h: 'Finding orders', items: [
        'Tabs: Open (still to fulfill, with a count), Delivered, and All.',
        'The list refreshes on its own every 30 seconds and on tab focus; Refresh forces it now.',
        'Each row links the customer to their file and shows the property, source, filter sizes, total, payment, and delivery status.',
      ]},
      { h: 'Placing an order', items: [
        'Click + New order. Search the customer by name and choose their property.',
        'Journey shows that property’s filters on file and its last order — click "Use these" or "Reorder last" to prefill instead of re-typing sizes.',
        'Set the order source, then verify each filter line (width × height × thickness, MERV, quantity). Sizes are priced from your filter pricebook — a size not in the pricebook is skipped, so add it there first if needed.',
        'Click Create order. That makes an unpaid FLT-#### invoice and emails the customer a pay link if they have an email on file. Payment is not required to place or deliver.',
      ]},
      { h: 'Fulfilling and tracking', items: [
        'Work the Open tab. As each order moves, set its Delivery dropdown: Ordered → Shipped (add the carrier/tracking in the "Shipped via" box) → Delivered by tech / Delivered / Picked up.',
        'The terminal statuses (delivered/picked up) move the order to the Delivered tab.',
        'The Payment pill shows Paid / Unpaid / Cancelled at a glance.',
      ]},
      { h: 'Editing an order', items: [
        'Edit — adjust quantities or remove lines inline; the new total recalculates as you go.',
        'To add a different filter size, place a new order (so pricing always comes from the pricebook).',
        'Cancel keeps the order on record but drops it off the open list; Un-cancel restores it. Delete removes a mistaken order.',
        'Invoice — opens the customer’s invoice to view or re-send.',
      ]},
      { h: 'Good to know', body: 'Everything is scoped to the selected organization. Filters on file come from the property record, so keeping that up to date makes reordering a two-click job.' },
    ],
  },
  {
    id: 'service-requests',
    title: 'Service Requests',
    area: 'Dispatch',
    keywords: ['service requests', 'qr', 'sticker', 'homeowner', 'tenant', 'approve', 'decline', 'owner approval', 'dispatch', 'create job', 'request page'],
    purpose: 'Service Requests is the inbox for jobs customers start themselves — by scanning the QR service sticker on their equipment. Approve a request and Journey creates the job in the dispatch tray, billed to the property’s account holder. A built-in approval step protects the account holder when the request comes from someone else, like a tenant.',
    sections: [
      { h: 'What it is for', body: 'This turns a sticker on the air handler into a booking channel. A customer scans it, describes the problem, and it appears here — no phone call needed. Your job is to review each one and either turn it into a job or decline it. The approval safeguard means a tenant can report a problem without being able to authorize billable work in the owner’s name.' },
      { h: 'The two queues', items: [
        'Ready to dispatch — requests you can approve straight into a job. These are from the account holder, or already owner-approved.',
        'Awaiting homeowner approval — requests made by someone other than the account holder. Nothing is scheduled or billed until the owner approves.',
        'Every card is color-coded by urgency: emergency (red), soon (amber), flexible (green), and carries a basis badge showing how it qualified.',
      ]},
      { h: 'Reading a request', items: [
        'Top line: category (Repair, Tune-up, Question) and the urgency the customer chose.',
        'Property address and the account holder it will bill to; the free-text details; and who reported it (name and phone).',
        'The timestamp shows when it came in.',
      ]},
      { h: 'Working the queue', items: [
        'Approve → create job — creates the job in the dispatch tray, billed to the property’s account holder. Then schedule and dispatch it like any job.',
        'Decline — dismisses a request that is not actionable (asks you to confirm).',
        'Owner approved (I called) → ready — on an awaiting card, use this after you have confirmed approval another way (e.g. the owner phoned in); it moves the request to Ready to dispatch.',
        'The list refreshes on its own every 30 seconds and when you return to the tab; Refresh forces it now.',
      ]},
      { h: 'The homeowner-approval safeguard', body: 'When a request comes from someone who is not the account holder, Journey automatically emails the account holder a link to approve it, and holds the request in "Awaiting homeowner approval" — nothing is scheduled or billed until they say yes. If they approve by phone instead, you can move it forward yourself with the "Owner approved (I called)" button.' },
      { h: 'Print a service QR sticker', items: [
        'Under "Print a service QR sticker," search a property by street address and pick it.',
        'Journey generates that property’s QR code (a link to its own request page).',
        'Click "Open full-size to print" and put the sticker on the equipment. Anyone at that address who scans it opens a request page already tied to their property.',
      ]},
      { h: 'Good to know', body: 'Everything is scoped to the selected organization. The page shows active requests only — approved and declined ones drop off once handled.' },
    ],
  },
  {
    id: 'call-log',
    title: 'Call Log',
    area: 'Dispatch',
    keywords: ['call log', 'calls', 'call history', 'call back', 'callback', 'follow-up', 'flag', 'clear', 'archive', 'export csv', 'tap to call', 'taken by', 'route to'],
    purpose: 'The Call Log is the running record of every call logged from the Call Console. It is a working list, not a permanent archive: flag the calls that need a call-back or follow-up, and everything else clears itself overnight so the board stays focused on what still needs doing.',
    sections: [
      { h: 'What it is for', body: 'Use the Call Log to make sure no call is dropped. It is deliberately self-cleaning — the calls you flag stay, the rest disappear overnight — so what you are looking at is always the calls that still need action, not months of noise. Every flag here is the same flag that drives the call tiles on the Dispatch Station.' },
      { h: 'The two tables', items: [
        'Today — the active board, always in view, showing every call logged since midnight.',
        'Earlier calls — a searchable archive of everything before today. Each table scrolls on its own so Today stays put while you dig through history.',
      ]},
      { h: 'Reading a row', items: [
        'Caller is linked to the customer or vendor record when the call was matched to one; names show as first name + last initial.',
        'Caller type is color-coded (Customer, Vendor, Employee, Contact, Salesman, Personal, Unknown).',
        'Phone is a tap-to-call link — click it to dial. Purpose, Taken by, and Route to show how the call was handled.',
        'A row flagged for call-back or follow-up is highlighted so it stands out.',
      ]},
      { h: 'Flagging and clearing', items: [
        'Tick Call back (urgent) or F/U? (follow-up) on any row. Flagged calls are kept until you clear the flag, and they raise the matching count on the Dispatch Station.',
        'Untick the box once the call is handled — it then becomes eligible to clear.',
        'Unflagged calls clear automatically overnight. To clear them now, use "Clear all unflagged entries" — it only affects calls before today, never Today, and asks you to confirm.',
        'Nothing is ever permanently erased; a cleared call can still be recovered (see Export).',
      ]},
      { h: 'Finding an older call', items: [
        'Use the Earlier-calls search box — it matches on name, phone, purpose, caller type, or route-to.',
        'Narrow by time with the Last 7 days / Last 30 days / All toggle.',
      ]},
      { h: 'Exporting records', items: [
        'Click Export CSV (top-right). Leave the filters blank for the full history, or add a caller name and/or a from/to date range to pull one caller’s complete record.',
        'Keep "Include cleared calls" checked to recover auto-cleared and manually cleared calls — recommended for a complete record.',
        'Download produces a spreadsheet with date/time, caller, type, phone, purpose, taken-by, route, both flags, and each call’s status (Active or Cleared).',
      ]},
      { h: 'Good to know', body: 'Everything is scoped to the selected organization. The on-screen list shows the most recent calls; for a full historical pull use Export, which reaches far deeper than the live view.' },
    ],
  },
  {
    id: 'jobs-dashboard',
    title: 'Jobs & Customers (Dashboard)',
    area: 'Operations',
    keywords: ['jobs & customers', 'jobs dashboard', 'jobs station', 'jobs dash', 'work', 'billing', 'unbilled', 'unpaid', 'a/r', 'accounts receivable', 'collected', 'invoices to send', 'estimates to convert', 'owner view'],
    purpose: 'The Jobs & Customers dashboard is the work-to-money board. It tracks jobs as they move from completed to billed to sent to paid, and gives owners the A/R and collected figures behind those tasks — the same signals framed as office tasks or owner dollars.',
    sections: [
      { h: 'What it is for', body: 'This is where finished work becomes cash. Every tile is a step in that pipeline that still needs a hand, so the board is empty only when every job is billed, every invoice is sent, and A/R is clear. Managers and owners get an extra view with the dollars behind the tasks.' },
      { h: 'The task tiles (Needs a hand)', items: [
        'Completed — needs invoicing: finished jobs with no invoice yet. Create the bill.',
        'Invoices to send: invoices created but not sent. Send them.',
        'Unpaid invoices: sent and still unpaid. Follow up to collect.',
        'Estimates to convert / System estimates to convert: approved estimates ready to build into a job.',
        'Estimates out: sent, awaiting the customer’s decision.',
        'Click any tile to open the exact list behind it.',
      ]},
      { h: 'Office vs Owner view', items: [
        'Use the "Viewing as" toggle (top-right) to switch between Office and Owner / Admin.',
        'Office / operational access shows health tiles: Unbilled completed (opens Jobs) and Unsent invoices (opens Invoices).',
        'Owner access adds dollar KPIs: A/R outstanding (opens the unpaid list) and Collected in the last 30 days.',
        'It is the same underlying data — a follow-up task for the office, a dollar figure for the owner.',
      ]},
      { h: 'Good to know', body: 'Everything is scoped to the selected organization (platform owners get a picker). Which view you can see depends on your operational- and owner-metrics permissions.' },
    ],
  },
  {
    id: 'train-station',
    title: 'Train Station',
    area: 'Overview',
    keywords: ['train station', 'hub', 'home', 'start', 'office', 'needs a hand', 'handled', 'alerts', 'off', 'edit', 'briefing', 'roll-up'],
    purpose: 'The Train Station is the office’s home hub — a personalized roll-up of every area that might need attention (Dispatch, Jobs & Customers, Maintenance, Permitting, and refrigerant compliance) in one list, so whoever opens it can see what is waiting and go straight to it.',
    sections: [
      { h: 'What it is for', body: 'This is the first screen to open each day. Instead of checking each area one by one, the Train Station gathers every open item across the office into a single board. It rolls up the individual stations, so clearing something in Dispatch or Jobs also clears it here — the counts always agree.' },
      { h: 'Reading the board', items: [
        'The banner tells you how many things need a hand across how many areas (or that you are all caught up), with a Quincy "Today’s briefing" beside it.',
        'Needs a hand — a tile for each area with work waiting: its name, a count, a one-line description, and an "Open …" action. Click a tile to jump to the screen that clears it.',
        'Handled — areas currently at zero rest here as green pills. A tile jumps back up the moment it has something.',
      ]},
      { h: 'Tailoring it to your company (Edit)', items: [
        'Click Edit to show an Alerts / Off switch on each area.',
        'Alerts — watch this area and show its work here. Off — another team owns it; you will still reach it from the menu, it just won’t clutter this hub.',
        'The choice is saved per company, so each office’s Station reflects how it divides the work.',
      ]},
      { h: 'Good to know', body: 'The Train Station rolls up the "start" areas (Dispatch, Jobs & Customers, Maintenance, Permitting, refrigerant compliance). Inventory and Marketing have their own hubs and do not appear here. Everything is scoped to your organization.' },
    ],
  },
  {
    id: 'call-console',
    title: 'Call Console',
    area: 'Dispatch',
    keywords: ['call', 'console', 'phone', 'caller id', 'lookup', 'inbound', 'log call', 'callback', 'call-back', 'follow-up', 'route', 'known contact', 'vendor', 'note', 'who is calling'],
    purpose: 'The Call Console is what you open the moment the phone rings. Type the caller’s number and it instantly identifies who is calling — customer, vendor, employee, or a saved contact — and pulls up everything you need to help them: history, equipment, plan, and balance. Then log the call so nothing falls through the cracks.',
    sections: [
      { h: 'What it is for', body: 'This is the front desk in software form. Instead of asking a caller to repeat their name and account, you type their number and the whole picture appears. It turns every inbound call into a fast, informed conversation and a logged record — the log is what feeds the call-back and follow-up tiles on the Dispatch Station, so calls do not get forgotten.' },
      { h: 'Step 1 — pull up the caller', items: [
        'Type or paste the caller’s phone number in the big field (it is focused the moment the page opens).',
        'At 4+ digits it searches your customers. At 7+ digits it also matches vendors, employees, and saved contacts.',
        'If more than one person matches, a short list appears — click the right one.',
        'Identification precedence is Customer, then Vendor, then Employee, then Known contact.',
      ]},
      { h: 'What the caller card shows', items: [
        'Customer: name, company, phones, email; a red BANNED banner if the customer is flagged; a maintenance-plan pill (or "No maintenance plan"); balance (red when they owe); systems-on-file count; every address; and up to 6 recent or open jobs.',
        'Vendor / Employee / Known contact: a compact card identifying who they are; the vendor card links to the vendor record.',
        'Open full record → jumps to the customer’s file to book work or answer detailed questions.',
      ]},
      { h: 'Step 2 — help them, without leaving the page', items: [
        'Order filters — opens the filter-order form for the caller’s property (shown when a customer with a property is up).',
        'New item dropdown / "New Job pre-fills <customer>" — start a job or other record already tied to this caller.',
        'New Note — jot a quick office reminder; it posts to the Operations Dashboard for whoever picks it up.',
      ]},
      { h: 'Step 3 — when there is no match', items: [
        '+ New customer — create a full customer record.',
        '+ Add a contact — save a salesman, friend/family, or other known caller inline so they are recognized next time.',
        'Or just log the call — capture caller name, purpose, routing, and call-back/follow-up without creating a record.',
      ]},
      { h: 'Step 4 — log every call', items: [
        'Pick a purpose from the quick-buttons (Book service, Reschedule, Billing question, Status update, General question, Vendor / supplier) or type your own.',
        'Route to… — send the message to Dispatch, Jobs Mgmt, or a specific person.',
        'Tick Needs call back (urgent) or Follow-up — these light the red/amber call tiles on the Dispatch Station and mark the call in the Call Log until it is handled.',
        'Click Log call. The caller’s last several calls show underneath so you can see the recent history at a glance.',
      ]},
      { h: 'Good to know', body: 'Everything is scoped to the selected organization (platform owners get an org picker). A banned-customer banner is a warning, not a lock — use your judgment. Logging is the point: an unlogged call is invisible to the rest of the office.' },
    ],
  },
  {
    id: 'dispatch-station',
    title: 'Dispatch Station',
    area: 'Dispatch',
    keywords: ['dispatch', 'station', 'board', 'front of house', 'signals', 'service requests', 'jobs to schedule', 'needs dispatch', 'filter orders', 'to-dos', 'calls', 'callback', 'call-back', 'follow-up'],
    purpose: 'The Dispatch Station is your front-of-house board — everything coming IN (new requests, calls to return) and everything going OUT (jobs to schedule, techs to dispatch, filters to fulfill) on one screen. Each tile is a live count that opens the exact worklist behind it. The goal is to clear the board to zero.',
    sections: [
      { h: 'What it is for', body: 'Open Dispatch first thing and at intervals through the day to see, in one place, everything front-of-house that needs a hand. It reads the same shared signal registry as the Train Station roll-up, so anything you clear here also clears there — the numbers never disagree. You do not do the work on this page; each tile takes you to the page where you do it.' },
      { h: 'The seven things it watches', items: [
        'New service requests — customer requests waiting to be reviewed and booked → opens Service Requests.',
        'Jobs to schedule — approved jobs not yet on the board → opens the Calendar.',
        'Needs dispatch — scheduled jobs with no technician assigned → opens the Dispatch Map.',
        'Filter orders to fulfill — filter orders awaiting fulfillment → opens Filter Orders.',
        'To-Dos — open office reminders → opens the To-Do list.',
        'Calls to return (shown red — most urgent) — calls flagged for a call-back → opens the Call Log.',
        'Call follow-ups — calls flagged for follow-up → opens the Call Log.',
      ]},
      { h: 'How to work the board', items: [
        'Read the banner at the top: amber means work is waiting (with a count across how many areas); green means the board is clear. The Quincy "Dispatch briefing" beside it gives quick context.',
        'Work the "Needs a hand" tiles. Each shows the item name, a count badge, a plain-English line, and a call-to-action. Handle red tiles first — a missed call-back is a lost customer.',
        'Click any tile to jump to its worklist, clear the items there, and the count drops the next time the board loads.',
        'Signals at zero move to the "Handled" row as green pills — still clickable if you want to look.',
        'Platform owners: use the Organization picker (top-right) to view any client company’s dispatch board.',
      ]},
      { h: 'Good to know', body: 'Counts are live and scoped to the selected organization. Red tiles are urgent, amber tiles are routine attention. An empty board — "The board’s clear" — is the win.' },
    ],
  },
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
    title: 'Job Estimates',
    area: 'Operations',
    keywords: ['estimate', 'estimates', 'job estimate', 'quote', 'proposal', 'approve', 'decline', 'send estimate', 'resend', 'convert', 'service call', 'approval status', 'projected profit', 'archive'],
    purpose: 'Job Estimates are the quotes you send for service and repair work tied to a job. This table tracks each one from sent to sold, and turns an approved estimate into schedulable work. (New-system quotes live on the separate System Estimates page.)',
    sections: [
      { h: 'What it is for', body: 'Use this page to manage the repair and service quotes in flight — who they are for, whether they have been sent, where they stand with the customer, and their projected profit. When a customer says yes, this is also where you convert the estimate into a job so it can be scheduled.' },
      { h: 'Finding and reading estimates', items: [
        'Search by estimate #, job #, or customer; filter by Approval Status (with a Hide completed & declined shortcut); toggle Show archived.',
        'Columns include line items, the money breakdown, Projected Profit and %, the Estimating Technician, and Approval Status. Use the Columns picker to choose what you see and Export CSV to pull the list.',
        'The Approval Status shows "→ job#" once an estimate has been converted, so you can see at a glance what became work.',
      ]},
      { h: 'Working an estimate', items: [
        'Set the Estimating Technician and update Approval Status (Pending, Approved, Declined, Pending Financing, Completed) right in the row.',
        'Send / Resend emails the estimate to the customer (the button’s tooltip shows when it was last sent and to whom); View opens the customer-facing copy; Edit opens the estimate to change it.',
        '+ Incomplete flags the linked job as needing another visit and attaches this estimate to it.',
      ]},
      { h: 'Converting an approved estimate', items: [
        'When Approval Status is Approved and it has not been converted, a → Service Call button appears.',
        'It opens a choice: New segment of the existing job (a return visit on the same job number) or a brand-new job.',
        'Either way Journey creates an unscheduled repair call with no trip charge (the estimate already priced the work), linked back to the estimate — you then schedule it from Jobs.',
      ]},
      { h: 'Cleaning up', body: 'Delete removes a throwaway draft that has no activity; an estimate with history (sent, approved, converted, or paid) is archived instead so the record is kept. Turn on Show archived and use Unarchive to bring one back. Everything is scoped to the selected organization.' },
    ],
  },
  {
    id: 'system-estimates',
    title: 'System Estimates',
    area: 'Operations',
    keywords: ['system estimate', 'system estimates', 'new system', 'install', 'retrofit', 'replacement', 'proposal', 'convert to job', 'property', 'deposit', 'approve'],
    purpose: 'System Estimates are your new-equipment quotes — a system installation or replacement proposed against a property, before any job exists. This page tracks each proposal and, once approved, turns it into a schedulable install job.',
    sections: [
      { h: 'What it is for', body: 'This is the new-system sales pipeline, kept separate from repair quotes. A system estimate is quoted against a property and its account holder rather than an existing job, so it can be sent and approved before any work is scheduled. When the customer says yes, you convert it here into the actual Install/Retrofit job.' },
      { h: 'Creating and managing proposals', items: [
        'Click + New System Estimate to start one — it quotes a system against a property (no job needed yet).',
        'Each row links the customer to their file and the property to Properties. Set the Estimating Technician and Approval Status inline.',
        'Send / Resend emails the proposal; View shows the customer’s copy; Edit reopens the estimate. Search, filter by status, show archived, pick columns, and Export CSV as on the other tables.',
      ]},
      { h: 'Converting to a job', items: [
        'The Convert to Job button has three states: grayed ("Approve the estimate first") until it is approved, red (ready) once Approval Status is Approved, and blue ("Converted") after it has been built.',
        'Converting creates an unscheduled Install/Retrofit job that lands in the Calendar’s Needs Dispatch tray, and copies the estimate’s line items onto a new invoice for that job.',
        'Approved system estimates waiting to be converted also appear on the Jobs & Customers dashboard so they are not missed.',
      ]},
      { h: 'Good to know', body: 'Delete removes a draft with no activity; an estimate with history is archived instead (Show archived + Unarchive restores it). Everything is scoped to the selected organization (platform owners get a picker).' },
    ],
  },
  {
    id: 'jobs',
    title: 'Jobs',
    area: 'Operations',
    keywords: ['job', 'jobs', 'jobs table', 'schedule', 'retrofit', 'repair', 'maintenance', 'technician', 'customer', 'invoice sent', 'columns', 'status', 'edit', 'delete', 'restore', 'export', 'trip charge', 'search'],
    purpose: 'Jobs is the master list of all the work — service calls, new-system installs, and maintenance visits — everything scheduled and done. It is where you find any job, edit it inline, and open its paperwork.',
    sections: [
      { h: 'What it is for', body: 'Everything the company does is a job, and this is the table of all of them. Use it to locate a job, change its details, assign technicians, and jump to its invoice or estimate. Day-to-day scheduling is easier on the Calendar; Jobs is for finding and editing the record itself.' },
      { h: 'Finding a job', items: [
        'Filter by Status (multi-select; a shortcut hides completed & canceled at once).',
        'Search matches job number, address, customer, issue, or technician. Arriving from a Home dashboard chart pre-fills the search or a job-type filter.',
        'Use Columns to show or hide fields; your layout is remembered in your browser. Job #, Segment, Date, Customer, and Address stay pinned as you scroll sideways.',
        'Click a sortable column header to sort (Job # sorts numerically, newest first by default).',
      ]},
      { h: 'Editing a job', items: [
        'Click Edit on a row to change it inline: property, date, start time and duration, job type, service complaint, status, and notes.',
        'Set the trip charge, and mark it Diagnose-only or set an authorization limit.',
        'Add or remove technicians; the first one listed is the lead (★).',
        'Setting a job to "Incomplete" files it in the office’s incomplete-jobs queue so it is not forgotten.',
      ]},
      { h: 'Row actions and links', items: [
        'Invoice / Estimate / System Estimate — open (or start) that document for the job.',
        'The Customer links to their file, the Address links to Properties, and Invoice Sent links to the invoice.',
        'A ⏳ badge on the date means a placeholder date from an approved estimate — the job still needs real scheduling.',
      ]},
      { h: 'Deleting, restoring, and exporting', items: [
        'Delete (admins) asks for a reason and note, then soft-deletes — linked estimates and unsent draft invoices go with it, but nothing is erased.',
        'View Deleted Jobs (admins) lists removed jobs with who/when/why and a Restore button.',
        'Export CSV downloads the current, filtered list to a spreadsheet.',
      ]},
      { h: 'Good to know', body: 'Job types drive automatic behavior elsewhere: a Retrofit (new-system install) creates a Warranty Registration (30-day clock); a Preventive Maintenance job generates the PM checklist(s) for that property’s systems. Unscheduled and placeholder-dated jobs surface on the dashboard under "Jobs to Schedule"; completed jobs with no invoice under "Completed, Not Invoiced." Platform owners get an organization picker.' },
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
    keywords: ['invoice', 'invoices', 'bill', 'billing', 'payment', 'record payment', 'receive payment', 'balance', 'unpaid', 'void', 'archive', 'send invoice', 'paid', 'reminder', 'diagnosis', 'ledger'],
    purpose: 'Invoices is where you bill customers for completed work and get paid — the master list of what has been billed, what is still owed, and every payment recorded against it.',
    sections: [
      { h: 'What it is for', body: 'This is the money side of the business: send bills, chase what is owed, and record payments accurately. Payments here are real ledger entries (not just a flag), so balances stay honest and the money shows up in cash reports.' },
      { h: 'Finding and reading invoices', items: [
        'Filter by All / Unpaid / Paid, search by invoice #, job #, or customer, and toggle Show archived. The header shows how many invoices and the total dollars outstanding.',
        'A completed job whose invoice is still unpaid is flagged in yellow so it stands out.',
        'Columns cover the trip charge and line items, the money breakdown, technicians, profit, and a click-to-edit Diagnosis (editing it updates the job’s diagnosis everywhere). Use Columns to choose fields and Export CSV to pull the list.',
      ]},
      { h: 'Sending and collecting', items: [
        'Send / Resend emails the invoice with a pay link; View opens the customer’s copy; Edit opens the invoice to change it.',
        'For a sent, overdue invoice, AI reminder drafts a short, courteous payment reminder for you to review and send.',
        'Mark Paid opens Record Payment — enter the actual amount, method (cash/check/card/other), check number, and any note. It posts to the payment ledger and settles the balance. Receive Payment (top of the page) records a payment not tied to a single row.',
        'Recorded something wrong? Unmark Paid reverses it with an offsetting ledger entry, keeping the audit trail intact.',
      ]},
      { h: 'Archiving and voiding', items: [
        'Archive hides an invoice from the main list but keeps it (Show archived + Unarchive brings it back).',
        'Void (admins, with a required reason) removes the invoice so it stops counting and its job can be deleted. It cannot be undone from the app, and voiding a paid invoice does not refund the customer — handle refunds separately.',
      ]},
      { h: 'Good to know', body: 'An invoice’s balance is its total minus what has been paid. Sent-but-unpaid invoices age on the Operations Dashboard; a completed job with no invoice shows there under "Completed, Not Invoiced." Everything is scoped to the selected organization (platform owners get a picker).' },
    ],
  },
  {
    id: 'customers',
    title: 'Customers',
    area: 'Operations',
    keywords: ['customer', 'customers', 'customer file', 'contact', 'phone', 'email', 'archive', 'fire customer', 'do not service', 'ban', 'history', 'billing contact', 'export'],
    purpose: 'The Customers page is your directory of everyone you serve — searchable, editable, and exportable — and the doorway to each customer’s full file, where their properties, jobs, invoices, estimates, agreements, warranties, and history all live in one place.',
    sections: [
      { h: 'What it is for', body: 'Use this page to find a customer, keep their contact details current, and open the complete picture of your relationship with them. It is the front door; the customer file behind each name is where the depth is.' },
      { h: 'Finding and tailoring the list', items: [
        'Search by name, company, phone, or email.',
        'Show archived includes retired customers; Columns lets you show or hide fields (remembered in your browser); click a header to sort.',
        'Export CSV downloads the current list, including each customer’s status and Do-Not-Service flag.',
      ]},
      { h: 'Editing and managing a customer', items: [
        'Edit updates details inline — display name (with First+Last / Company quick-fill), company, names, two phones, two emails, acquired date, and notes.',
        'Archive retires an inactive customer; Reactivate brings them back.',
        'Admins can Fire Customer with a reason — a "Do Not Service" flag that blocks new scheduling everywhere until an admin uses Lift Ban.',
      ]},
      { h: 'The customer file', body: 'Click a customer’s name to open their file. It gathers everything about them on one screen: contact details, their properties (with equipment and warranty status), maintenance agreement, Contacts & Invoice Routing (who gets billed and who approves — useful for commercial accounts), notes, full job history, invoices & estimates, permits, service reports, warranty registrations, and photos & attachments.' },
      { h: 'Good to know', body: 'A property belongs to a customer, and a job belongs to a property (and therefore that customer). Everything is scoped to the selected organization (platform owners get a picker).' },
    ],
  },
  {
    id: 'properties',
    title: 'Properties',
    area: 'Operations',
    keywords: ['property', 'properties', 'address', 'equipment', 'system', 'warranty', 'serial', 'filters', 'merv', 'gate code', 'tenant', 'bill to', 'county', 'needs filters', 'mfg date'],
    purpose: 'Properties is the record of every location you service and the equipment in it — addresses, tenants, billing, the systems installed there (with warranty status), and the filter sizes that make reordering effortless.',
    sections: [
      { h: 'What it is for', body: 'A property is where work actually happens. Keeping its details, equipment, and filters current here pays off everywhere else — accurate dispatch addresses, correct warranty answers on the phone, and one-click filter reorders for the office and the customer portal.' },
      { h: 'Finding and filtering', items: [
        'Search by address, customer, city, state, zip, or county. Clicking an address elsewhere in Journey opens this page pre-searched to it.',
        'Toggle Show archived, Needs filters (no filter sizes on file yet), or Needs mfg date (equipment whose warranty cannot be dated yet). Row badges flag each of these.',
        'Use Columns to choose fields (remembered), click a header to sort, and Export CSV for the full list.',
      ]},
      { h: 'Editing a property', items: [
        'Edit sets the customer and, when billing goes to someone else, a separate Bill To customer (otherwise it reads "Same as Customer").',
        'Update the address, gate code, up to two tenants (name + phone), and notes.',
        'Archive/Reactivate retires or restores a property.',
      ]},
      { h: 'Equipment', items: [
        'Click Equipment on a row to see the systems installed there.',
        'Add a system with its outdoor/indoor/furnace brand, model, and serial, plus an install date or a manufacture year/month. Journey computes the parts, labor, and refrigerant warranty status — reading many serials automatically.',
        'A "No mfg date" badge (and the Needs mfg date filter) flags systems it could not date — confirm those so the warranty is accurate.',
        'When a system is replaced, Retire the old one; it stays on record 90 days (for size-for-size compliance) then clears itself. Recall restores a retired system.',
      ]},
      { h: 'Filters', items: [
        'Click Filters on a row to record the property’s air-filter sizes (width × height × thickness), MERV, location, and quantity.',
        'This is the same list technicians fill in on the job and the customer portal reads for reordering — so recording it once here makes every future filter order a two-click job.',
        'The Needs filters filter shows which properties still have none on file.',
      ]},
      { h: 'Good to know', body: 'A property belongs to a customer, and jobs belong to the property. Last Service Date is the most recent completed job there. Everything is scoped to the selected organization (platform owners get a picker).' },
    ],
  },
  {
    id: 'calendar',
    title: 'Calendar',
    area: 'Operations',
    keywords: ['calendar', 'schedule', 'scheduling', 'appointment', 'day', 'week', 'month', 'dispatch tray', 'needs dispatch', 'drag', 'reschedule', 'job popup', 'business hours', 'map', 'slot'],
    purpose: 'The Calendar is the visual schedule — every job on its day and time — and the place where unscheduled work becomes scheduled work. Drag a waiting job onto the grid to book it; drag a booked job to move it.',
    sections: [
      { h: 'What it is for', body: 'Two things live here: the jobs already on the board (the grid) and the jobs still waiting for a slot (the Needs Dispatch tray). You work left to right — take something out of the tray, drop it on the grid, and it is scheduled. It is the day-to-day companion to the Dispatch Map, which shows the same jobs geographically for routing.' },
      { h: 'Choosing a view', items: [
        'Week / Day / Month toggle (top-right). Week is for planning, Day is for working a single day in detail, Month shows the whole month. On a phone it always shows Day.',
        'Use ‹ / Today / › to move backward, jump to today, or move forward (by month, week, or day depending on the view).',
        'The Calendar ↔ Map toggle (and the 🗺 Map button) opens the Dispatch Map for the date you are viewing.',
      ]},
      { h: 'The Needs Dispatch tray', items: [
        'The left-hand tray lists every job that still needs a slot — self-booked requests, approved estimates turned into jobs, and office-created jobs — no matter which dates the grid is showing.',
        'ASAP jobs are grouped at the top under URGENT; the rest are grouped by their requested day.',
        'Each card shows the requested time window, customer, job type, and address. Collapse the tray with its header when you need the room.',
      ]},
      { h: 'Scheduling and rescheduling', items: [
        'To schedule: drag a tray card onto the grid at the day and time you want. That books it, stamps the start time, and removes it from the tray.',
        'To reschedule: drag a job already on the grid to a new slot. In Month view, drag a job to another day.',
        'Times are stored correctly for your organization’s time zone, so what you drop is what techs see.',
      ]},
      { h: 'Working with a job', items: [
        'Click any job to open its detail popup — customer (linked to their file), the job’s details, and any job-specific parts/equipment.',
        'From the popup, "Open in Jobs Table" jumps to the full job record.',
        'Per-tech colors and a banned-customer flag help you read the board at a glance.',
      ]},
      { h: 'Good to know', body: 'The grid’s hours come from your business hours (Settings). Jobs with only a placeholder date still need a real one — they wait in the tray and on the dashboard’s "Jobs to Schedule." On-call coverage is scheduled separately on the On-Call Schedule page. Platform owners get an organization picker.' },
    ],
  },
  {
    id: 'tasks',
    title: 'Tasks',
    area: 'Operations',
    keywords: ['task', 'tasks', 'field task', 'errand', 'parts pickup', 'assign', 'on my way', 'start', 'stop', 'task pay', 'job card', 'destination', 'dispatch errand'],
    purpose: 'Tasks are standalone errands you assign to a field user — a parts pickup, a drop-off, a quick stop — with a destination, address, and time. Each becomes a time-tracked Job Card on that person’s phone, so an errand is scheduled, routed, and paid much like a job.',
    sections: [
      { h: 'What it is for', body: 'Use Tasks for work that has to happen out in the field but is not a customer job — most often picking up parts. It is not the office sticky-note list (that is the To-Do list behind the Dispatch "To-Dos" tile). A task carries a destination and a time, cannot be double-booked over the person’s jobs, and records their time and location as they run it.' },
      { h: 'Creating a task', items: [
        'Click + New Task and choose who it is assigned to.',
        'For a parts run, pick a Parts House to quick-fill the destination, or Link to Parts Order to auto-fill the vendor’s name, address, and what to pick up. Otherwise type any destination and address.',
        'Add a contact (name/title/phone), a description, and choose what happens On Completion — finish, return to the shop, or return to a job.',
        'Set date, time, and duration. Journey blocks a time that overlaps the person’s jobs or other tasks.',
      ]},
      { h: 'How the field user runs it', items: [
        'The task appears as a Job Card on their phone.',
        'They tap On My Way, Start My Time, then Stop My Time — each stamped with time and GPS location.',
        'If they mark it Incomplete, it turns red here with their reason.',
      ]},
      { h: 'Tracking and records', items: [
        'The table shows assignee, destination (with PARTS / return-to badges), address, tap-to-call/text contact, date/time, duration, the three button-times, status, and description.',
        'Click Records on a row to see each button’s timestamp and map location, total worked time, and task pay, plus the linked parts order.',
        'Use "Show completed / canceled" to include finished tasks.',
      ]},
      { h: 'Task pay', items: [
        'Open Task pay summary and set a date range to see each employee’s completed-task count, worked time, and pay.',
        'Worked time is Start My Time → Stop My Time; the rate is the employee’s task rate (Settings → Employee Pay Rates).',
        'This is a task-time report — it does not post to payroll on its own.',
      ]},
      { h: 'Good to know', body: 'Cancel keeps a task on the list as Canceled; Delete removes it. Everything is scoped to the selected organization (platform owners get a picker).' },
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
    keywords: ['text', 'texts', 'sms', 'message', 'messages', 'archive', 'thread', 'communication', 'print', 'flag', 'important', 'paper trail'],
    purpose: 'A read-only record of every text conversation technicians have with customers from a job — one thread per conversation — so you always have a paper trail of what was communicated, by whom, and when.',
    sections: [
      { h: 'What it is for', body: 'This is your communication record, not a place to start new conversations. A thread appears as soon as a technician sends the first message on a job (shown as "active") and stays here as "archived" once the job is stopped. Use it to check what a customer was told, settle a dispute, or keep a copy for a warranty or claim.' },
      { h: 'Who can see it', body: 'Access is limited to Reception and Dispatch (the view-text-archive permission); Admins can additionally delete threads. Everyone is scoped to their own organization.' },
      { h: 'Finding a conversation', items: [
        'Search by customer name, technician, or job number, and/or filter by date; Clear resets both.',
        'The left list shows each thread with the customer, a ★ if flagged important, message count, job number, active/archived, the tech, and a preview of the last message — newest first.',
        'Click a thread to read the full back-and-forth on the right: technician messages in blue on the right, customer replies in gray on the left, each timestamped.',
      ]},
      { h: 'Working with a thread', items: [
        'Print Thread — opens a clean, print-ready copy of just that conversation for a file or claim.',
        'Flag important (★) — marks a thread you may need again; it rises to the top and is locked against deletion.',
        'Delete thread (Admins only) — removes a thread after a confirm. If it is flagged important, unflag it first.',
        'The job number links to the job; a job that was later deleted shows "(deleted)" but keeps its thread on record.',
      ]},
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
    keywords: ['on-call', 'on call', 'after hours', 'emergency', 'coverage', 'supervisor', 'tech', 'rotation', 'permissions', 'print', 'calendar', 'gap'],
    purpose: 'Sets who covers after-hours calls — a month calendar of coverage periods, each pairing an on-call supervisor (calls first) with an optional backup tech. Building periods back-to-back guarantees there is never a coverage gap.',
    sections: [
      { h: 'What it is for', body: 'This is where you plan after-hours coverage and see it at a glance. Each period shows as colored bars across the days it covers, so a month of coverage reads like a calendar. It is for visual scheduling (and, where configured, after-hours permissions) — it does not clock anyone in or feed Attendance or Payroll.' },
      { h: 'Adding coverage', items: [
        'Pick the On-Call Supervisor (the first point of contact) and, if you use one, an On-Call Tech as backup.',
        'Set the start, then use a quick-length button (1 day / 1 week / 1 month) or set the end by hand, and click Add period.',
        'A new period’s start defaults to the previous period’s end, so you can lay out weeks of coverage nose-to-nose. If a gap or overlap ever appears, a warning banner shows exactly where.',
      ]},
      { h: 'Editing and navigating', items: [
        'Click a colored bar on the calendar to load that period into the form, then Save changes or Delete period. Use + New to start a fresh one.',
        'Move between months with the arrows / Today. Today’s date is highlighted.',
        'A Calendar / Map toggle sits top-right; the map view is planned (coming soon).',
      ]},
      { h: 'Printing', items: [
        'Choose Letter or Legal paper, keep "Fit all rows on one page" checked, and click Print Calendar for a clean landscape printout with the colors intact — good for the board or the truck.',
      ]},
      { h: 'Good to know', body: 'While on call, a technician can be automatically granted the extra permissions needed to handle emergencies — and only for their on-call window (configured in Roles & Permissions). The Operations Dashboard shows an amber banner when on-call is scheduled less than two weeks out, so coverage never quietly lapses. Platform owners get an organization picker.' },
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

  // ===== Tools Management =====
  {
    id: 'tools-dashboard',
    title: 'Tools & Office Equipment Dashboard',
    area: 'Tools',
    keywords: ['tools', 'office equipment', 'computers', 'dashboard', 'equipment', 'reclaimer', 'assign', 'shop', 'inspection', 'maintenance', 'hand tool'],
    purpose: 'The landing page for Tools & Office Equipment Management — where your durable tools and equipment (including computers and other non-expendable purchases) are, what is flagged for maintenance, and what is in the shop for repair.',
    sections: [
      { h: 'How to use it', items: [
        'Enable the module from the banner (or the Organizations page) to start tracking tools.',
        'The tiles show totals: in the shop, out on trucks/techs, flagged for maintenance, and in maintenance.',
        'Open the Tool Catalog to add tools, assign them to a truck or tech, and log inspections; open Maintenance to verify repairs.',
      ]},
      { h: 'Good to know', body: 'Tools flow like inventory: received by the shop, assigned to a truck or tech, inspected on demand, and returned to the shop for verified maintenance before being redeployed. Identical tools auto-number (e.g. "Reclaimer 1", "Reclaimer 2"). Purchase date and cost are logged as plain data for your bookkeeping.' },
    ],
  },
  {
    id: 'tools-catalog',
    title: 'Tool Catalog',
    area: 'Tools',
    keywords: ['tool catalog', 'add tool', 'assign', 'truck', 'technician', 'inspect', 'inspection', 'to shop', 'history', 'serial', 'model', 'brand', 'hand tool', 'retire'],
    purpose: 'Where each tool and piece of equipment is recorded and run through its life: added to the shop, assigned to a truck or tech, inspected on demand, sent to the shop for repair, and retired.',
    sections: [
      { h: 'Adding a tool', items: [
        'Record it by Name/Description and Brand, plus Model No. and Serial No. for powered tools. Tick "Hand tool" for simple tools (name and brand only).',
        'Identical names auto-number as you add them — the second "Reclaimer" is saved as "Reclaimer 2" — so each physical unit is distinct.',
        'Purchase date and cost are optional plain data for your bookkeeping; nothing here calculates depreciation.',
      ]},
      { h: 'The lifecycle (row actions)', items: [
        'Assign — put the tool in the Shop, or on a specific Truck or Technician. Assignments can be ongoing or by the job.',
        'Inspect — log condition and notes on demand; a good moment is during that vehicle’s regular inventory cycle count. Flagging a problem marks the tool "Needs maintenance".',
        'To Shop — pull the tool in for repair, with an anticipated return-to-service date. A flagged tool cannot be reassigned until the repair is verified.',
        'History — see every past assignment and inspection for that tool.',
      ]},
      { h: 'Good to know', body: 'A tool flagged on inspection must go to the shop, be repaired, and be verified on the Maintenance page before it can be redeployed — so a known-bad tool never lands back on a truck.' },
    ],
  },
  {
    id: 'tools-orders',
    title: 'Tools — Orders & Receipts',
    area: 'Tools',
    keywords: ['tool order', 'purchase order', 'po', 'receipt', 'rental', 'card', 'debit', 'credit', 'vendor', 'receive', 'acquisition', 'quincy'],
    purpose: 'How tools come into the shop: a formal PO to a tool vendor, a spur-of-the-moment card purchase from a hardware store, or a rental. Quincy can read a receipt to save typing.',
    sections: [
      { h: 'The three ways to acquire', items: [
        'PO order — raise a purchase order with line items; its number comes from the same sequence as parts and supplies POs. Tools are created when the PO is received (partial receipts supported).',
        'Card / cash purchase — record an off-the-cuff buy from a hardware or parts store with no PO; snap the receipt and Quincy reads the vendor, date, total, and items.',
        'Rental — record a rented tool with its return-by date so it shows up for return before it runs late.',
      ]},
      { h: 'Receiving', body: 'Receiving a PO creates the tools in the shop, instance-numbered like any other tool, and advances the PO to Partial or Received. What you paid becomes each tool’s recorded cost.' },
      { h: 'Good to know', body: 'Card and cash purchases that have no PO are matched to your bank statement on the Reconcile page. Overdue rentals raise a follow-up on the Tools Dashboard and in the daily QuincyAI briefing.' },
    ],
  },
  {
    id: 'tools-reconcile',
    title: 'Tools — Reconcile',
    area: 'Tools',
    keywords: ['reconcile', 'reconciliation', 'bank statement', 'card', 'debit', 'credit', 'match', 'receipt', 'no po', 'last4', 'merchant'],
    purpose: 'Match card and cash tool purchases against your bank or card statement, so spend from vendors that don’t use POs is still accounted for.',
    sections: [
      { h: 'How to use it', items: [
        'Import or enter the statement charges, then let the page suggest matches to recorded purchases by amount, date, merchant, and the card’s last four digits.',
        'Confirm a suggested match, or match by hand. Unmatched charges stay flagged until you clear them.',
      ]},
      { h: 'Good to know', body: 'Charges still awaiting a matched receipt are counted on the Tools Dashboard and called out in the QuincyAI briefing, so nothing bought on a card quietly goes unaccounted.' },
    ],
  },
  {
    id: 'tools-maintenance',
    title: 'Tools — Maintenance',
    area: 'Tools',
    keywords: ['tool maintenance', 'repair', 'shop', 'anticipated return', 'return to service', 'follow up', 'overdue', 'verify', 'redeploy'],
    purpose: 'The tools currently in the shop for repair — where you record the work and verify it before a tool goes back into service.',
    sections: [
      { h: 'How to use it', items: [
        'Tools land here when they’re sent "To Shop" from the Catalog, each with an anticipated return-to-service date.',
        'Record the maintenance or repair performed, then mark it verified — only a verified tool can be redeployed.',
        'The Anticipated Return column drives the follow-up flag: a tool not back by its date is overdue.',
      ]},
      { h: 'Good to know', body: 'Overdue tools show as "Follow-up needed" on the Tools Dashboard and in the daily QuincyAI briefing, so a tool sitting too long in the shop gets chased.' },
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
        'The On hand column shows current stock across all locations; parts carrying stock read in bold.',
        'Archive a part you no longer use instead of deleting it, so its history stays intact — Delete is disabled for any part that still has stock or is mapped to a service, and is reserved for empty records created by mistake.',
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
        'Transfer moves stock from one location to another (e.g. shop → truck). You can’t transfer more than the From location holds — receive it there first.',
        'Set a Reorder point and a Max (par) per part per location — these drive Replenishment.',
      ]},
      { h: 'What the Status column means', items: [
        'In stock (green) — above the reorder point.',
        'Low (amber) — at or below the reorder point; it will show up on Replenishment.',
        'Out (red) — a part you carry here (a reorder point is set) has hit zero.',
        'Check (red) — on-hand is negative, which should never happen; fix it with a cycle count. A negative on-hand also shows the number in red.',
        'Not stocked / Special order (grey) — this location does not carry the part, or it is a special-order part bought per job; neither is a shortage.',
      ]},
      { h: 'Good to know', body: 'Receiving against a purchase order is done from Purchase Orders (not here), so PO progress and costs stay in sync. Use this screen for manual receipts and transfers. Every change writes to the stock ledger — nothing is overwritten.' },
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
        'Use "Pull low items" to auto-fill the PO with everything below its reorder point at the deliver-to location — the quick way to turn a Replenishment shortfall into an order.',
        'When goods arrive, open the PO and receive against it — on-hand and costs update, and the PO advances to Partial or Received.',
        'Search by number, job name, vendor, or part. The default "Relevant" view shows in-flight POs plus anything received in the last 30 days; switch the filter to see all, cancelled, or older receipts.',
      ]},
      { h: 'Numbering', body: 'New POs get the next number automatically (PO-1001, PO-1002…). If you’re moving from another system, use the numbering control on this screen to set the next number so your sequence continues where you left off.' },
      { h: 'Good to know', body: 'A draft you change your mind about can be deleted; an ordered PO can be cancelled. Open POs awaiting receipt also surface on the Inventory Dashboard.' },
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
        'Use "Auto-create kits" to bulk-seed a single-part kit for every unmapped parts service at once (labor and diagnostic services are skipped) — then refine any kit by hand.',
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

  // ===== Refrigerant Management & EPA compliance =====
  {
    id: 'refrigerant-dashboard',
    title: 'Refrigerant Dashboard',
    area: 'Refrigerant',
    keywords: ['refrigerant', 'freon', 'epa', '608', 'section 608', 'aim act', 'leak', 'compliance', 'dashboard', 'covered', 'exempt', 'cylinder', 'reclaim'],
    purpose: 'The landing page for refrigerant/EPA compliance — refrigerant added and recovered, covered systems over their leak threshold (with the 30-day repair clock), cylinders on hand, and what is awaiting reclaim or disposal.',
    sections: [
      { h: 'At a glance', items: [
        'Systems tracked, pounds added and recovered over the last 90 days, cylinders on hand, and recovered refrigerant awaiting reclaim.',
        'A red "Over leak threshold" tile and callout lists covered systems that need a repair within 30 days, with each one’s estimated leak rate versus its limit.',
        'The QuincyAI briefing leads with those repair deadlines, then cylinders to ship out, then the added-vs-recovered balance.',
      ]},
      { h: 'The two rule layers', body: 'Section 608 of the Clean Air Act applies to ALL refrigerant work — certified techs only, no venting, recover before opening a system, keep records. The AIM Act leak-repair rules (leak-rate thresholds and the 30-day repair clock) apply only to COVERED systems: 15 lb or more of refrigerant and not a residential/light-commercial AC or heat pump. Each system’s sector, set on the Systems page, decides which it is.' },
      { h: 'Good to know', body: 'The leak rate shown is a trailing-12-month estimate: refrigerant added divided by the system’s full charge. It flags where to look; the formal determination is yours to make.' },
    ],
  },
  {
    id: 'refrigerant-log',
    title: 'Refrigerant Usage Log',
    area: 'Refrigerant',
    keywords: ['refrigerant', 'log', 'usage', 'added', 'charged', 'recovered', 'topoff', 'repair', 'record', 'technician', 'cert', '608', 'cylinder', 'location', 'filter'],
    purpose: 'Record every pound of refrigerant added or recovered on a job — tied to a system, a technician, and the cylinder it came from or went into.',
    sections: [
      { h: 'Recording an event', items: [
        'Pick the system (which fills in its refrigerant), the technician, pounds added and/or recovered, the cylinder, and a reason (top-off, repair, install, recovery, retirement).',
        'The technician’s EPA cert is checked against your HR records — a warning shows if none is on file or it has expired. Section 608 requires a certified tech.',
        'Choosing a cylinder moves refrigerant in or out of it automatically: charging a system draws down a virgin cylinder, recovering credits a recovered cylinder.',
      ]},
      { h: 'History & leak rate', items: [
        'The history table filters by location and by refrigerant.',
        'A per-system summary rolls up the trailing-12-month leak rate against each covered system’s full charge, flagging any over its threshold.',
      ]},
      { h: 'Good to know', body: 'Records are the backbone of compliance — keep them for at least three years. Mobile capture on the tech’s job card is planned; for now events are logged office-side.' },
    ],
  },
  {
    id: 'refrigerant-systems',
    title: 'Refrigerant Systems',
    area: 'Refrigerant',
    keywords: ['refrigerant', 'system', 'systems', 'charge', 'full charge', 'sector', 'subsector', 'covered', 'exempt', 'threshold', 'type', 'r-410a', 'r-454b', 'comfort cooling', 'commercial refrigeration'],
    purpose: 'Give each installed system its refrigerant profile — refrigerant type, full charge in pounds, and sector. This is what drives the covered-vs-exempt flag and the leak-rate math everywhere else.',
    sections: [
      { h: 'How to use it', items: [
        'Systems come from each property’s equipment on file. For each, set the refrigerant, the full charge (lb), and the sector.',
        'A system is COVERED (leak rules apply) when its full charge is 15 lb or more AND it is not a residential/light-commercial AC or heat pump. Everything else is exempt — a simple usage log with no 30-day clock.',
        'The status column shows Covered, Exempt, or "Over threshold — repair", plus the estimated annual leak rate.',
      ]},
      { h: 'The thresholds', body: 'Once covered, the leak-rate limit that forces a repair depends on the sector: 10% for comfort cooling, 20% for commercial refrigeration, 30% for industrial process refrigeration. Set the sector correctly and the rest follows.' },
    ],
  },
  {
    id: 'refrigerant-cylinders',
    title: 'Refrigerant Cylinders',
    area: 'Refrigerant',
    keywords: ['cylinder', 'cylinders', 'virgin', 'recovered', 'reclaim', 'disposal', 'cradle to grave', 'on hand', 'ship', 'manifest', 'doc reference'],
    purpose: 'Track each cylinder cradle-to-grave — virgin refrigerant purchased and put in service, recovered refrigerant accumulating on hand, then shipped to a reclaimer or certified disposal.',
    sections: [
      { h: 'How to use it', items: [
        'Add a virgin cylinder as it’s purchased, or a recovery cylinder to receive recovered refrigerant.',
        'On-hand pounds move on their own from the Usage Log — charging a system draws down a virgin cylinder, recovering credits a recovered one.',
        'When a recovered cylinder is full, use "Send out" to record shipment to a reclaimer or disposal, with the date, recipient, and a document reference (manifest / ticket number). That closes the chain.',
      ]},
      { h: 'Good to know', body: 'Recovered cylinders with refrigerant sitting on hand are counted on the dashboard as "awaiting reclaim", so nothing lingers unshipped.' },
    ],
  },

  // ===== Supplies (expendables) =====
  {
    id: 'supplies-catalog',
    title: 'Supplies Catalog',
    area: 'Supplies',
    keywords: ['supplies', 'expendable', 'expendables', 'catalog', 'consumable', 'paper', 'tape', 'zip ties', 'chemicals', 'fuses', 'reorder', 'not inventoried', 'office'],
    purpose: 'A lean list of the expendables you buy regularly but do NOT count as inventory — copy paper, tech tape, zip ties, gallon chemicals, fuses. No stock counts, by design.',
    sections: [
      { h: 'How to use it', items: [
        'Add each supply with a name, category, unit, typical vendor, and last price. There are no on-hand quantities — this is a shopping catalog, not stock.',
        'Flag anything running low to the reorder list with "+ Reorder" (with an optional quantity and note).',
        'The tiles show supplies tracked, how many are on the reorder list, open POs, and 30- and 90-day spend.',
      ]},
      { h: 'Good to know', body: 'Supplies are deliberately separate from parts Inventory — nothing here affects stock, valuation, or replenishment. For durable tools and equipment, use Tools & Office Equipment instead.' },
    ],
  },
  {
    id: 'supplies-reorder',
    title: 'Supplies Reorder List',
    area: 'Supplies',
    keywords: ['reorder', 'shopping list', 'to buy', 'restock', 'supplies', 'bought', 'check off', 'vendor', 'run'],
    purpose: 'Everything you’ve flagged low, in one buy-it list grouped by vendor — the shopping list for a supply-house run.',
    sections: [
      { h: 'How to use it', items: [
        'Items flagged from the catalog appear here, grouped by their typical vendor.',
        'When you’ve bought something, hit "Bought" — enter what you paid to log the spend and refresh the item’s last price, or just check it off without a price.',
        'Cleared items drop off the list.',
      ]},
      { h: 'Good to know', body: 'For vendors that require a purchase order, raise a PO on the Orders & POs page instead — you can pull the whole reorder list straight into a PO in one click, which also clears those items from this list.' },
    ],
  },
  {
    id: 'supplies-orders',
    title: 'Supplies — Orders & POs',
    area: 'Supplies',
    keywords: ['supplies', 'purchase order', 'po', 'order', 'vendor', 'parts house', 'office supply', 'receive', 'partial', 'reorder', 'shared numbering'],
    purpose: 'Purchase orders for supplies from vendors that use them (office-supply and AC parts houses). PO numbers share the same running sequence as parts and tool POs, so numbering never collides.',
    sections: [
      { h: 'Raising a PO', items: [
        'Pick a vendor and expected date, then add line items — from the catalog (which fills in unit and last price) or as free text — with quantity and unit cost.',
        '"Pull from reorder list" seeds the whole PO from whatever is flagged low; those items then drop off the reorder list because they’re now on order.',
        'Creating the PO assigns the next shared PO number automatically.',
      ]},
      { h: 'Receiving', body: 'Open a PO and enter what actually came in (defaults to the full remaining amount). Partial receipts mark it "Partially received" so you can receive the rest later; a full receipt closes it. Receiving is what logs the spend — each received line writes to Purchases and refreshes that item’s last price.' },
      { h: 'Good to know', body: 'Nothing is counted as spent until it’s received. For grab-and-go buys with no PO, use the "Bought" check-off on the Reorder List instead — both feed the same Purchases log.' },
    ],
  },
  {
    id: 'supplies-purchases',
    title: 'Supplies Purchases',
    area: 'Supplies',
    keywords: ['supplies', 'purchases', 'spend', 'spending', 'log', 'receipt', 'cost', 'range', 'total', 'vendor'],
    purpose: 'The spend log for supplies — what was bought, when, and for how much, with a running total by date range.',
    sections: [
      { h: 'How to use it', items: [
        'The log fills in automatically when you check items off the reorder list or receive a PO.',
        'Use "+ Log a purchase" for a receipt bought on the fly — pick a catalog item or type a name, with quantity, unit cost, vendor, and date.',
        'Set the date range (30 / 90 days, 12 months, all time); the header shows the total spend in range.',
      ]},
      { h: 'Good to know', body: 'Purchases received against a PO are tagged with the PO number, so you can trace any line of spend back to its order.' },
    ],
  },

  // ===== Human Resources =====
  {
    id: 'hr',
    title: 'Human Resources',
    area: 'Human Resources',
    keywords: ['hr', 'human resources', 'employee', 'employees', 'headcount', 'hiring', 'onboarding', 'discipline', 'separation', 'termination', 'certification', 'license', 'skills', 'scorecard', 'documents', 'time off', 'pto', 'compliance'],
    purpose: 'The people module — headcount, a compliance watchdog for expiring certifications and licenses, and the full employee lifecycle from hire to separation. It’s a paid add-on; turn it on in HR Settings.',
    sections: [
      { h: 'The pieces', items: [
        'HR Dashboard — headcount, tracked certifications, and open compliance flags at a glance, with a QuincyAI briefing.',
        'Employees — the people record: contact, role, pay/tax profile, and history.',
        'Job Descriptions, Hiring, and Onboarding — define roles, track applicants, and run new-hire checklists.',
        'Discipline and Separations — document write-ups and offboarding, so there’s a clean record.',
        'Certifications & Licenses and the Skills Matrix — who holds what (EPA 608, NATE, driver’s licenses) and who can do what.',
        'Scorecards, Documents, and Time Off — performance metrics, stored HR files, and PTO requests and balances.',
      ]},
      { h: 'The compliance watchdog', body: 'The dashboard flags expiring or expired certifications and licenses and any open compliance items, most urgent first. The same certification records back the EPA-cert check on the Refrigerant Usage Log — so keeping HR current pays off across the app.' },
      { h: 'Good to know', body: 'HR is the fuller module and implies Payroll access. Turn it on and set defaults in HR Settings before entering people.' },
    ],
  },
  {
    id: 'payroll',
    title: 'Payroll',
    area: 'Payroll',
    keywords: ['payroll', 'pay', 'paycheck', 'gross', 'net', 'taxes', 'set aside', 'withholding', 'prepare payroll', 'deductions', 'benefits', 'workers comp', 'tax center', 'classification', 'w-2', '1099', 'year end', 'state rules'],
    purpose: 'Run payroll from recorded hours and always know the taxes to set aside. Payroll can stand alone for smaller shops or comes included with HR.',
    sections: [
      { h: 'How it flows', items: [
        'Payroll Dashboard — the most recent runs (checks, gross, net) and the tax to set aside, grouped by week.',
        'Prepare Payroll — build a run from captured hours, review each employee, and generate the checks.',
        'Paychecks — the register of checks produced, with details per employee.',
        'Tax Center and Year-End — payroll taxes owed and the W-2 / 1099 wrap-up.',
      ]},
      { h: 'Setup that drives the math', items: [
        'Benefits & Deductions — pre- and post-tax items that adjust each check.',
        'Workers’ Comp — class codes and rates for the comp premium.',
        'Classification Check and State Rules — employee-vs-contractor sanity checks and the state-specific withholding rules.',
      ]},
      { h: 'Good to know', body: 'Hours come from Time Clock via Payroll Capture. The set-aside figure is what to reserve for taxes on each run — not a filing; taxes are still remitted through your tax service or accountant.' },
    ],
  },
  {
    id: 'certified-payroll',
    title: 'Certified Payroll (Prevailing Wage)',
    area: 'Payroll',
    keywords: ['certified payroll', 'prevailing wage', 'davis-bacon', 'davis bacon', 'wh-347', 'statement of compliance', 'classification', 'wage determination', 'government', 'public works', 'project'],
    purpose: 'Weekly certified payroll for prevailing-wage (Davis-Bacon) government jobs — per-worker hours by classification, auto-priced from the wage determination, producing the WH-347 and Statement of Compliance.',
    sections: [
      { h: 'How to use it', items: [
        'Projects — set up each public-works project and attach its wage determination.',
        'Prevailing Wage — the classifications and wage/fringe rates the hours are priced against.',
        'Certified Payroll — pick a project and week-ending Friday, enter each worker’s daily hours by classification, and the app prices straight time and overtime from the determination.',
      ]},
      { h: 'Good to know', body: 'Output is the WH-347 with its Statement of Compliance, ready to file for the week. Workers and their base info come from the Employees record in HR.' },
    ],
  },

  // ===== Marketing =====
  {
    id: 'marketing',
    title: 'Marketing',
    area: 'Marketing',
    keywords: ['marketing', 'campaign', 'campaigns', 'channel', 'channels', 'content', 'draft', 'approval', 'queue', 'review', 'reviews', 'reputation', 'leads', 'demand', 'social', 'google'],
    purpose: 'Demand generation and reputation — channels and campaigns, a queue of AI-drafted content awaiting your approval, leads, and customer review requests. It’s a paid add-on.',
    sections: [
      { h: 'The pieces', items: [
        'Command Center — the KPIs: channels, active campaigns, drafts awaiting your yes, leads, and review requests.',
        'Approval Queue — AI-drafted posts and messages that wait for your approval before anything goes out. Nothing publishes on its own.',
        'Channels & Assets — the built-in and custom channels you market through, and the brand assets used.',
        'Reviews — review requests and your reputation. Reviews are the top contractor-marketing lever: a request goes out when a job is marked complete.',
      ]},
      { h: 'Good to know', body: 'The customer review link a request points to is your per-organization Google review link, set in Settings. Drafts always wait for a person — the Command Center leads with anything sitting in the approval queue.' },
    ],
  },

  // ===== Personal =====
  {
    id: 'my-portal',
    title: 'My Pay & Benefits',
    area: 'Personal',
    keywords: ['my pay', 'my benefits', 'self service', 'portal', 'pay stub', 'paycheck', 'benefits', 'tax profile', 'time off', 'w-4', 'direct deposit', 'personal'],
    purpose: 'Your own self-service page — your pay stubs, benefits, tax and direct-deposit profile, and time off, without going through the office.',
    sections: [
      { h: 'How to use it', body: 'Open My Pay & Benefits to see your recent paychecks, your benefits and deductions, your tax/direct-deposit details, and your time-off balance and requests. It shows only your own information.' },
    ],
  },
]

// Map a route to the article that best explains it, so the drawer can open context-aware.
// NOTE: order matters — a longer path that shares a prefix must come BEFORE the shorter one
// (e.g. /jobs-management before /jobs), because matching is by startsWith.
export const ROUTE_HELP = {
  '/home': 'home-dashboard',
  '/': 'home-dashboard',
  '/dispatch': 'dispatch-station',
  '/train-station': 'train-station',
  '/jobs-dash': 'jobs-dashboard',
  '/call': 'call-console',
  '/call-log': 'call-log',
  '/service-requests': 'service-requests',
  '/filter-orders': 'filter-orders',
  '/operations': 'operations-dashboard',
  '/jobs-management': 'jobs-management',
  '/jobs': 'jobs',
  '/calendar': 'calendar',
  '/tasks': 'tasks',
  '/customers': 'customers',
  '/properties': 'properties',
  '/system-estimate-setup': 'system-estimate-setup',
  '/system-estimates': 'system-estimates',
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
  // Inventory Management (Elements). Specific /elements/* routes must
  // come BEFORE the bare /elements base, because matching is by startsWith.
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
  // Tools & Office Equipment. Specific /tools/* before the bare /tools base.
  '/tools/catalog': 'tools-catalog',
  '/tools/orders': 'tools-orders',
  '/tools/reconcile': 'tools-reconcile',
  '/tools/maintenance': 'tools-maintenance',
  '/tools': 'tools-dashboard',
  // Refrigerant Management. Specific /refrigerant/* before the bare base.
  '/refrigerant/log': 'refrigerant-log',
  '/refrigerant/systems': 'refrigerant-systems',
  '/refrigerant/cylinders': 'refrigerant-cylinders',
  '/refrigerant': 'refrigerant-dashboard',
  // Supplies. Specific /supplies/* before the bare base.
  '/supplies/reorder': 'supplies-reorder',
  '/supplies/orders': 'supplies-orders',
  '/supplies/purchases': 'supplies-purchases',
  '/supplies': 'supplies-catalog',
  // HR / Payroll / Certified Payroll all live under /rewards — list every deeper
  // path BEFORE the bare /rewards base, since matching is by startsWith.
  '/rewards/payroll/prepare': 'payroll',
  '/rewards/payroll/paychecks': 'payroll',
  '/rewards/payroll/tax-center': 'payroll',
  '/rewards/payroll/classification': 'payroll',
  '/rewards/payroll/deductions': 'payroll',
  '/rewards/payroll/workers-comp': 'payroll',
  '/rewards/payroll/state-rules': 'payroll',
  '/rewards/payroll/year-end': 'payroll',
  '/rewards/payroll': 'payroll',
  '/rewards/certified/projects': 'certified-payroll',
  '/rewards/certified/wage-rates': 'certified-payroll',
  '/rewards/certified': 'certified-payroll',
  '/rewards/employees': 'hr',
  '/rewards/job-descriptions': 'hr',
  '/rewards/hiring': 'hr',
  '/rewards/onboarding': 'hr',
  '/rewards/discipline': 'hr',
  '/rewards/separations': 'hr',
  '/rewards/certifications': 'hr',
  '/rewards/skills': 'hr',
  '/rewards/scorecards': 'hr',
  '/rewards/documents': 'hr',
  '/rewards/time-off': 'hr',
  '/rewards/settings': 'hr',
  '/rewards': 'hr',
  // Marketing.
  '/marketing/queue': 'marketing',
  '/marketing/channels': 'marketing',
  '/marketing/reviews': 'marketing',
  '/marketing': 'marketing',
  // Personal self-service.
  '/my': 'my-portal',
}

export function searchArticles(query) {
  const q = (query || '').trim().toLowerCase()
  if (!q) return HELP_ARTICLES
  const hay = (a) => [a.title, a.area, a.purpose, a.keywords.join(' '),
    a.sections.map((s) => [s.h, s.body || '', (s.items || []).join(' ')].join(' ')).join(' ')].join(' ').toLowerCase()
  return HELP_ARTICLES.filter((a) => q.split(/\s+/).every((w) => hay(a).includes(w)))
}
