// Help articles — Operations section. One file per section so edits stay local.
// Shape: export const HELP_ARTICLES (array) + ROUTE_HELP (route -> article id).
// Aggregated by ./HelpArticles.js. Keep article ids unique across ALL section files.

export const HELP_ARTICLES = [
  {
    "id": "filter-orders",
    "title": "Filter Orders",
    "area": "Operations",
    "keywords": [
      "filter",
      "filters",
      "filter order",
      "flt",
      "air filter",
      "reorder",
      "pricebook",
      "delivery",
      "shipped",
      "fulfill",
      "merv",
      "subscription"
    ],
    "purpose": "Filter Orders is where every air-filter sale is placed, fulfilled, and tracked — orders from the customer portal, phoned in by a customer or a tech, from the website, or entered in the office. Each one is a FLT-#### invoice linked to the customer.",
    "sections": [
      {
        "h": "What it is for",
        "body": "This is the one place all filter orders land, whatever their source, so nothing is missed and every order is tracked from placed to delivered. Payment and fulfillment are tracked separately — you can deliver an order before it is paid, and the customer gets a pay link either way."
      },
      {
        "h": "Finding orders",
        "items": [
          "Tabs: Open (still to fulfill, with a count), Delivered, All, and Removed (deleted orders, kept so they can be restored).",
          "The list refreshes on its own every 30 seconds and on tab focus; Refresh forces it now.",
          "Each row links the customer to their file and shows the property, source, filter sizes, total, payment, and delivery status."
        ]
      },
      {
        "h": "Placing an order",
        "items": [
          "Click + New order. Search the customer by name and choose their property.",
          "Journey shows that property’s filters on file and its last order — click \"Use these\" or \"Reorder last\" to prefill instead of re-typing sizes.",
          "Set the order source, then verify each filter line (width × height × thickness, MERV, quantity). Sizes are priced from your filter pricebook — a size not in the pricebook is skipped, so add it there first if needed.",
          "Click Create order. That makes an unpaid FLT-#### invoice and emails the customer a pay link if they have an email on file. Payment is not required to place or deliver."
        ]
      },
      {
        "h": "Fulfilling and tracking",
        "items": [
          "Work the Open tab. As each order moves, set its Delivery dropdown: Ordered → Shipped (add the carrier/tracking in the \"Shipped via\" box) → Delivered by tech / Delivered / Picked up.",
          "The terminal statuses (delivered/picked up) move the order to the Delivered tab.",
          "The Payment pill shows Paid / Unpaid / Cancelled at a glance."
        ]
      },
      {
        "h": "Editing an order",
        "items": [
          "Edit — adjust quantities or remove lines inline; the new total recalculates as you go.",
          "To add a different filter size, place a new order (so pricing always comes from the pricebook).",
          "Cancel keeps the order on record but drops it off the open list; Un-cancel restores it. Delete removes a mistaken order — it moves to the Removed tab, where Restore brings it back if you deleted it in error.",
          "Invoice — opens the customer’s invoice to view or re-send."
        ]
      },
      {
        "h": "Good to know",
        "body": "Everything is scoped to the selected organization. Filters on file come from the property record, so keeping that up to date makes reordering a two-click job."
      }
    ]
  },
  {
    "id": "jobs-dashboard",
    "title": "Jobs & Customers (Dashboard)",
    "area": "Operations",
    "keywords": [
      "jobs & customers",
      "jobs dashboard",
      "jobs station",
      "jobs dash",
      "work",
      "billing",
      "unbilled",
      "unpaid",
      "a/r",
      "accounts receivable",
      "collected",
      "invoices to send",
      "estimates to convert",
      "owner view"
    ],
    "purpose": "The Jobs & Customers dashboard is the work-to-money board. It tracks jobs as they move from completed to billed to sent to paid, and gives owners the A/R and collected figures behind those tasks — the same signals framed as office tasks or owner dollars.",
    "sections": [
      {
        "h": "What it is for",
        "body": "This is where finished work becomes cash. Every tile is a step in that pipeline that still needs a hand, so the board is empty only when every job is billed, every invoice is sent, and A/R is clear. Managers and owners get an extra view with the dollars behind the tasks."
      },
      {
        "h": "The task tiles (Needs a hand)",
        "items": [
          "Completed — needs invoicing: finished jobs with no invoice yet. Create the bill.",
          "Incomplete jobs: jobs held up awaiting parts or a follow-up visit → opens Jobs Management.",
          "Invoices to send: invoices created but not sent. Send them.",
          "Unpaid invoices: sent and still unpaid. Follow up to collect.",
          "Estimates to send: drafted estimates not yet sent to the customer.",
          "Estimates to convert / System estimates to convert: approved estimates ready to build into a job.",
          "Estimates out: sent, awaiting the customer’s decision.",
          "Click any tile to open the exact list behind it."
        ]
      },
      {
        "h": "Office vs Owner view",
        "items": [
          "Use the \"Viewing as\" toggle (top-right) to switch between Office and Owner / Admin.",
          "Office / operational access shows health tiles: Unbilled completed (opens Jobs) and Unsent invoices (opens Invoices).",
          "Owner access adds dollar KPIs: A/R outstanding (opens the unpaid list), Collected in the last 30 days, and Won in the last 30 days (dollar value of estimates approved).",
          "It is the same underlying data — a follow-up task for the office, a dollar figure for the owner."
        ]
      },
      {
        "h": "Good to know",
        "body": "Everything is scoped to the selected organization (platform owners get a picker). Which view you can see depends on your operational- and owner-metrics permissions."
      }
    ]
  },
  {
    "id": "operations-dashboard",
    "title": "Operations Dashboard",
    "area": "Operations",
    "keywords": [
      "dashboard",
      "operations",
      "queue",
      "board",
      "a/r",
      "accounts receivable",
      "follow up",
      "unpaid",
      "to do",
      "attention",
      "on-call",
      "wins"
    ],
    "purpose": "A working queue for the office — everything that needs doing today, in one place. It is not a report: every number links to the exact record you go to resolve. The goal is to clear the board to zero.",
    "sections": [
      {
        "h": "How to use it",
        "items": [
          "The four numbers across the top are your vital signs. Click any one to jump to that full list.",
          "Cards are grouped by urgency: \"Needs attention now\" is money and deadlines; \"Coming up\" is scheduling and pipeline.",
          "Click any item row inside a card to open that exact record — the invoice, estimate, or job.",
          "The green \"This Week ✓\" strip shows what you have already cleared: collected, estimates won, jobs completed, and close rate.",
          "A green ✓ and \"All caught up\" on a card means that bucket is empty. That is the win.",
          "If on-call coverage is scheduled less than two weeks out, an amber banner appears at the top — click it to open the On-Call Schedule."
        ]
      },
      {
        "h": "What each bucket means",
        "items": [
          "Unpaid Invoices — sent invoices that still have a balance. Age pills turn amber at 30 days, terracotta at 60+.",
          "Estimates to Follow Up — estimates sent with no reply yet. Amber at 2 days, terracotta at 5+.",
          "Completed, Not Invoiced — finished jobs with no invoice. Unbilled money.",
          "Warranty Registration — new systems (from Retrofit jobs) not yet registered. 30-day clock.",
          "Jobs to Schedule — jobs with no real date yet.",
          "Maintenance Due — agreements with a visit due within 30 days.",
          "Estimates Not Yet Sent — drafts that never went out."
        ]
      },
      {
        "h": "Behind the scenes",
        "body": "The board refreshes on its own every minute and again whenever you return to the browser tab, so numbers stay live. All figures are for your organization only. Aging is measured from the date an invoice or estimate was sent."
      },
      {
        "h": "Good to know",
        "body": "If an item has been filtered out of its own table (by a status filter, a search, or the archived toggle), clicking it opens the table but may not visibly highlight the row — clear the filter to see it."
      }
    ]
  },
  {
    "id": "estimates",
    "title": "Job Estimates",
    "area": "Operations",
    "keywords": [
      "estimate",
      "estimates",
      "job estimate",
      "quote",
      "proposal",
      "approve",
      "decline",
      "send estimate",
      "resend",
      "convert",
      "service call",
      "approval status",
      "projected profit",
      "archive"
    ],
    "purpose": "Job Estimates are the quotes you send for service and repair work tied to a job. This table tracks each one from sent to sold, and turns an approved estimate into schedulable work. (New-system quotes live on the separate System Estimates page.)",
    "sections": [
      {
        "h": "What it is for",
        "body": "Use this page to manage the repair and service quotes in flight — who they are for, whether they have been sent, where they stand with the customer, and their projected profit. When a customer says yes, this is also where you convert the estimate into a job so it can be scheduled."
      },
      {
        "h": "Finding and reading estimates",
        "items": [
          "Search by estimate #, job #, or customer; filter by Approval Status (with a Hide completed & declined shortcut); toggle Show archived.",
          "Columns include line items, the money breakdown, Projected Profit and %, the Estimating Technician, and Approval Status. Use the Columns picker to choose what you see and Export CSV to pull the list.",
          "The Approval Status shows \"→ job#\" once an estimate has been converted, so you can see at a glance what became work."
        ]
      },
      {
        "h": "Working an estimate",
        "items": [
          "Set the Estimating Technician and update Approval Status (Pending, Approved, Declined, Pending Financing, Completed) right in the row.",
          "Send / Resend emails the estimate to the customer (the button’s tooltip shows when it was last sent and to whom); View opens the customer-facing copy; Edit opens the estimate to change it.",
          "+ Incomplete flags the linked job as needing another visit and attaches this estimate to it."
        ]
      },
      {
        "h": "Converting an approved estimate",
        "items": [
          "When Approval Status is Approved and it has not been converted, a → Service Call button appears.",
          "It opens a choice: New segment of the existing job (a return visit on the same job number) or a brand-new job.",
          "Either way Journey creates an unscheduled repair call with no trip charge (the estimate already priced the work), linked back to the estimate — you then schedule it from Jobs."
        ]
      },
      {
        "h": "Cleaning up",
        "body": "Delete removes a throwaway draft that has no activity; an estimate with history (sent, approved, converted, or paid) is archived instead so the record is kept. Turn on Show archived and use Unarchive to bring one back. Everything is scoped to the selected organization."
      }
    ]
  },
  {
    "id": "system-estimates",
    "title": "System Estimates",
    "area": "Operations",
    "keywords": [
      "system estimate",
      "system estimates",
      "new system",
      "install",
      "retrofit",
      "replacement",
      "proposal",
      "convert to job",
      "property",
      "deposit",
      "approve"
    ],
    "purpose": "System Estimates are your new-equipment quotes — a system installation or replacement proposed against a property, before any job exists. This page tracks each proposal and, once approved, turns it into a schedulable install job.",
    "sections": [
      {
        "h": "What it is for",
        "body": "This is the new-system sales pipeline, kept separate from repair quotes. A system estimate is quoted against a property and its account holder rather than an existing job, so it can be sent and approved before any work is scheduled. When the customer says yes, you convert it here into the actual Install/Retrofit job."
      },
      {
        "h": "Creating and managing proposals",
        "items": [
          "Click + New System Estimate to start one — it quotes a system against a property (no job needed yet).",
          "Each row links the customer to their file and the property to Properties. Set the Estimating Technician and Approval Status inline.",
          "Send / Resend emails the proposal; View shows the customer’s copy; Edit reopens the estimate. Search, filter by status, show archived, pick columns, and Export CSV as on the other tables."
        ]
      },
      {
        "h": "Converting to a job",
        "items": [
          "The Convert to Job button has three states: grayed (\"Approve the estimate first\") until it is approved, red (ready) once Approval Status is Approved, and blue (\"Converted\") after it has been built.",
          "Converting creates an unscheduled Install/Retrofit job that lands in the Calendar’s Needs Dispatch tray, and copies the estimate’s line items onto a new invoice for that job.",
          "Approved system estimates waiting to be converted also appear on the Jobs & Customers dashboard so they are not missed."
        ]
      },
      {
        "h": "Good to know",
        "body": "Delete removes a draft with no activity; an estimate with history is archived instead (Show archived + Unarchive restores it). Everything is scoped to the selected organization (platform owners get a picker)."
      }
    ]
  },
  {
    "id": "jobs",
    "title": "Jobs",
    "area": "Operations",
    "keywords": [
      "job",
      "jobs",
      "jobs table",
      "schedule",
      "retrofit",
      "repair",
      "maintenance",
      "technician",
      "customer",
      "invoice sent",
      "columns",
      "status",
      "edit",
      "delete",
      "restore",
      "export",
      "trip charge",
      "search"
    ],
    "purpose": "Jobs is the master list of all the work — service calls, new-system installs, and maintenance visits — everything scheduled and done. It is where you find any job, edit it inline, and open its paperwork.",
    "sections": [
      {
        "h": "What it is for",
        "body": "Everything the company does is a job, and this is the table of all of them. Use it to locate a job, change its details, assign technicians, and jump to its invoice or estimate. Day-to-day scheduling is easier on the Calendar; Jobs is for finding and editing the record itself."
      },
      {
        "h": "Finding a job",
        "items": [
          "Filter by Status (multi-select; a shortcut hides completed & canceled at once).",
          "Search matches job number, address, customer, issue, or technician. Arriving from a Home dashboard chart pre-fills the search or a job-type filter.",
          "Use Columns to show or hide fields; your layout is remembered in your browser. Job #, Segment, Date, and Customer stay pinned (with their headers) as you scroll sideways.",
          "Click a sortable column header to sort (Job # sorts numerically, newest first by default)."
        ]
      },
      {
        "h": "Editing a job",
        "items": [
          "Click Edit on a row to change it inline: property, date, start time and duration, job type, service complaint, status, notes, and the On My Way / Arrival / Completed timestamps (clear one to blank it).",
          "Set the trip charge, and mark it Diagnose-only or set an authorization limit.",
          "Add or remove technicians; the first one listed is the lead (★).",
          "Setting a job to \"Incomplete\" files it in the office’s incomplete-jobs queue so it is not forgotten."
        ]
      },
      {
        "h": "Row actions and links",
        "items": [
          "Invoice / Estimate / System Estimate — open (or start) that document for the job.",
          "The Customer links to their file and the Address links to Properties. The Invoice Status column shows No invoice / Not sent / Not paid / Paid at a glance and links to the invoice.",
          "A ⏳ badge on the date means a placeholder date from an approved estimate — the job still needs real scheduling."
        ]
      },
      {
        "h": "Deleting, restoring, and exporting",
        "items": [
          "Delete (admins) asks for a reason and note, then soft-deletes — linked estimates and unsent draft invoices go with it, but nothing is erased.",
          "View Deleted Jobs (admins) lists removed jobs with who/when/why and a Restore button.",
          "Export CSV downloads the current, filtered list to a spreadsheet."
        ]
      },
      {
        "h": "Good to know",
        "body": "Job types drive automatic behavior elsewhere: a Retrofit (new-system install) creates a Warranty Registration (30-day clock); a Preventive Maintenance job generates the PM checklist(s) for that property’s systems. Unscheduled and placeholder-dated jobs surface on the dashboard under \"Jobs to Schedule\"; completed jobs with no invoice under \"Completed, Not Invoiced.\" Platform owners get an organization picker."
      }
    ]
  },
  {
    "id": "jobs-management",
    "title": "Jobs Management",
    "area": "Operations",
    "keywords": [
      "jobs management",
      "incomplete jobs",
      "parts",
      "parts orders",
      "po",
      "purchase order",
      "vendor",
      "warranty",
      "claim",
      "estimate approval",
      "verbal approval",
      "segment",
      "delivery",
      "staged",
      "dispatch"
    ],
    "purpose": "Jobs Management is the parts-and-follow-up desk. When a job needs a part before it can be finished, it lands here so the office can price it, order it, track its delivery, and stage the return visit — all in one place, feeding Dispatch automatically once the part arrives.",
    "sections": [
      {
        "h": "What it is for",
        "body": "A job appears in the Incomplete Jobs list the moment a customer signs off on a follow-up estimate (or a tech marks a job incomplete). The office works each row left to right: confirm the equipment, get the estimate approved, order the part, then stage the next segment so Dispatch can schedule the return visit when the part is in. A row clears itself once that return visit is marked Complete. Red = nothing done yet; yellow = a return visit already exists."
      },
      {
        "h": "Working an incomplete job",
        "items": [
          "Open Estimate opens the follow-up estimate in a side panel that stays visible while you fill in the parts fields.",
          "Brand / Model # / Serial # auto-fill from the property’s equipment on file; edit them if needed.",
          "Warranty or Cash: choose Warranty, Cash, or Punchlist. Claim Status then offers only the valid choices — Warranty → Pending / Approved; Cash → Not Warranty Eligible; Punchlist → Punchlist.",
          "Price is a free-text field you fill in; Availability is a date you enter for when the part will be available.",
          "Verbal Approval records the new estimate amount and its status (Pending / Approved / Declined / Punchlist). If it’s Declined, Edit shows \"Flip to Complete\" to close the job out (it also reads Completed on the Jobs table).",
          "Edit saves the row; Delete removes the entry from Jobs Management (it does not delete the job)."
        ]
      },
      {
        "h": "Ordering the part",
        "items": [
          "+ Add Part opens the parts form. The Vendor list is filtered to the suppliers that carry the equipment’s brand (★ = your preferred vendor for that brand, set on the vendor’s page).",
          "PO # is auto-assigned from the same purchase-order sequence as stock replenishment — leave it blank and Journey takes the next number (no duplicates), or type your own.",
          "Set the part, quantity of segment it’s for (Seg # Assigned), and Expected Delivery. The part shows in the Parts Orders table below."
        ]
      },
      {
        "h": "Staging the return visit",
        "items": [
          "+ New Segment creates the next job segment with no date, time, or technician and drops it into the Calendar’s \"Needs Dispatch\" tray — so Dispatch can schedule it whenever the part lands.",
          "In Parts Orders, Mark Verified when a part arrives. That flags the staged segment as \"Parts in — ready to schedule,\" which shows on its Dispatch card.",
          "Schedule Confirmed shows whether that segment has been put on the calendar yet."
        ]
      },
      {
        "h": "Good to know",
        "body": "On both tables the action buttons plus Job # and Seg stay pinned on the left while the rest scrolls sideways, and the header row stays put as you scroll down. The + New button here is scoped to New Job, New Segment, New Invoice, New Task, and New To-Do Item. Everything is scoped to the selected organization (platform owners get a picker)."
      }
    ]
  },
  {
    "id": "customers",
    "title": "Customers",
    "area": "Operations",
    "keywords": [
      "customer",
      "customers",
      "customer file",
      "contact",
      "phone",
      "email",
      "archive",
      "fire customer",
      "do not service",
      "ban",
      "history",
      "billing contact",
      "export"
    ],
    "purpose": "The Customers page is your directory of everyone you serve — searchable, editable, and exportable — and the doorway to each customer’s full file, where their properties, jobs, invoices, estimates, agreements, warranties, and history all live in one place.",
    "sections": [
      {
        "h": "What it is for",
        "body": "Use this page to find a customer, keep their contact details current, and open the complete picture of your relationship with them. It is the front door; the customer file behind each name is where the depth is."
      },
      {
        "h": "Finding and tailoring the list",
        "items": [
          "Search by name, company, phone, or email.",
          "Show archived includes retired customers; Columns lets you show or hide fields (remembered in your browser); click a header to sort.",
          "Export CSV downloads the current list, including each customer’s status and Do-Not-Service flag."
        ]
      },
      {
        "h": "Editing and managing a customer",
        "items": [
          "Edit updates details inline — display name (with First+Last / Company quick-fill), company, names, two phones, two emails, acquired date, and notes.",
          "Archive retires an inactive customer; Reactivate brings them back.",
          "Admins can Fire Customer with a reason — a \"Do Not Service\" flag that blocks new scheduling everywhere until an admin uses Lift Ban."
        ]
      },
      {
        "h": "The customer file",
        "body": "Click a customer’s name to open their file. It gathers everything about them on one screen: contact details, their properties (with equipment and warranty status), maintenance agreement, Contacts & Invoice Routing (who gets billed and who approves — useful for commercial accounts), notes, full job history, invoices & estimates, permits, service reports, warranty registrations, and photos & attachments."
      },
      {
        "h": "Good to know",
        "body": "A property belongs to a customer, and a job belongs to a property (and therefore that customer). Everything is scoped to the selected organization (platform owners get a picker)."
      }
    ]
  },
  {
    "id": "properties",
    "title": "Properties",
    "area": "Operations",
    "keywords": [
      "property",
      "properties",
      "address",
      "equipment",
      "system",
      "warranty",
      "serial",
      "filters",
      "merv",
      "gate code",
      "tenant",
      "bill to",
      "county",
      "needs filters",
      "mfg date"
    ],
    "purpose": "Properties is the record of every location you service and the equipment in it — addresses, tenants, billing, the systems installed there (with warranty status), and the filter sizes that make reordering effortless.",
    "sections": [
      {
        "h": "What it is for",
        "body": "A property is where work actually happens. Keeping its details, equipment, and filters current here pays off everywhere else — accurate dispatch addresses, correct warranty answers on the phone, and one-click filter reorders for the office and the customer portal."
      },
      {
        "h": "Finding and filtering",
        "items": [
          "Search by address, customer, city, state, zip, or county. Clicking an address elsewhere in Journey opens this page pre-searched to it.",
          "Toggle Show archived, Needs filters (no filter sizes on file yet), or Needs mfg date (equipment whose warranty cannot be dated yet). Row badges flag each of these.",
          "Use Columns to choose fields (remembered), click a header to sort, and Export CSV for the full list."
        ]
      },
      {
        "h": "Editing a property",
        "items": [
          "Edit sets the customer and, when billing goes to someone else, a separate Bill To customer (otherwise it reads \"Same as Customer\").",
          "Update the address, gate code, up to two tenants (name + phone), and notes.",
          "Archive/Reactivate retires or restores a property."
        ]
      },
      {
        "h": "Equipment",
        "items": [
          "Click Equipment on a row to see the systems installed there.",
          "Add a system with its outdoor/indoor/furnace brand, model, and serial, plus an install date or a manufacture year/month. Journey computes the parts, labor, and refrigerant warranty status — reading many serials automatically.",
          "A \"No mfg date\" badge (and the Needs mfg date filter) flags systems it could not date — confirm those so the warranty is accurate.",
          "When a system is replaced, Retire the old one; it stays on record 90 days (for size-for-size compliance) then clears itself. Recall restores a retired system."
        ]
      },
      {
        "h": "Filters",
        "items": [
          "Click Filters on a row to record the property’s air-filter sizes (width × height × thickness), MERV, location, and quantity.",
          "This is the same list technicians fill in on the job and the customer portal reads for reordering — so recording it once here makes every future filter order a two-click job.",
          "The Needs filters filter shows which properties still have none on file."
        ]
      },
      {
        "h": "Good to know",
        "body": "A property belongs to a customer, and jobs belong to the property. Last Service Date is the most recent completed job there. Everything is scoped to the selected organization (platform owners get a picker)."
      }
    ]
  },
  {
    "id": "calendar",
    "title": "Calendar",
    "area": "Operations",
    "keywords": [
      "calendar",
      "schedule",
      "scheduling",
      "appointment",
      "day",
      "week",
      "month",
      "dispatch tray",
      "needs dispatch",
      "drag",
      "reschedule",
      "job popup",
      "business hours",
      "map",
      "slot"
    ],
    "purpose": "The Calendar is the visual schedule — every job on its day and time — and the place where unscheduled work becomes scheduled work. Drag a waiting job onto the grid to book it; drag a booked job to move it.",
    "sections": [
      {
        "h": "What it is for",
        "body": "Two things live here: the jobs already on the board (the grid) and the jobs still waiting for a slot (the Needs Dispatch tray). You work left to right — take something out of the tray, drop it on the grid, and it is scheduled. It is the day-to-day companion to the Dispatch Map, which shows the same jobs geographically for routing."
      },
      {
        "h": "Choosing a view",
        "items": [
          "Week / Day / Month toggle (top-right). Week is for planning, Day is for working a single day in detail, Month shows the whole month. On a phone it always shows Day.",
          "Use ‹ / Today / › to move backward, jump to today, or move forward (by month, week, or day depending on the view).",
          "The Calendar ↔ Map toggle (and the 🗺 Map button) opens the Dispatch Map for the date you are viewing."
        ]
      },
      {
        "h": "The Needs Dispatch tray",
        "items": [
          "The left-hand tray lists every job that still needs a slot — self-booked requests, approved estimates turned into jobs, and office-created jobs — no matter which dates the grid is showing.",
          "ASAP jobs are grouped at the top under URGENT; the rest are grouped by their requested day.",
          "Each card shows the requested time window, customer, job type, and address. Collapse the tray with its header when you need the room."
        ]
      },
      {
        "h": "Scheduling and rescheduling",
        "items": [
          "To schedule: drag a tray card onto the grid at the day and time you want. That books it, stamps the start time, and removes it from the tray.",
          "To reschedule: drag a job already on the grid to a new slot. In Month view, drag a job to another day.",
          "Times are stored correctly for your organization’s time zone, so what you drop is what techs see."
        ]
      },
      {
        "h": "Working with a job",
        "items": [
          "Click any job to open its detail popup — customer (linked to their file), the job’s details, and any job-specific parts/equipment.",
          "From the popup, \"Open in Jobs Table\" jumps to the full job record.",
          "Per-tech colors and a banned-customer flag help you read the board at a glance."
        ]
      },
      {
        "h": "Good to know",
        "body": "The grid’s hours come from your business hours (Settings). Jobs with only a placeholder date still need a real one — they wait in the tray and on the dashboard’s \"Jobs to Schedule.\" On-call coverage is scheduled separately on the On-Call Schedule page. Platform owners get an organization picker."
      }
    ]
  },
  {
    "id": "tasks",
    "title": "Tasks",
    "area": "Operations",
    "keywords": [
      "task",
      "tasks",
      "field task",
      "errand",
      "parts pickup",
      "assign",
      "on my way",
      "start",
      "stop",
      "task pay",
      "job card",
      "destination",
      "dispatch errand"
    ],
    "purpose": "Tasks are standalone errands you assign to a field user — a parts pickup, a drop-off, a quick stop — with a destination, address, and time. Each becomes a time-tracked Job Card on that person’s phone, so an errand is scheduled, routed, and paid much like a job.",
    "sections": [
      {
        "h": "What it is for",
        "body": "Use Tasks for work that has to happen out in the field but is not a customer job — most often picking up parts. It is not the office sticky-note list (that is the To-Do list behind the Dispatch \"To-Dos\" tile). A task carries a destination and a time, cannot be double-booked over the person’s jobs, and records their time and location as they run it."
      },
      {
        "h": "Creating a task",
        "items": [
          "Click + New Task and choose who it is assigned to.",
          "For a parts run, pick a Parts House to quick-fill the destination, or Link to Parts Order to auto-fill the vendor’s name, address, and what to pick up. Otherwise type any destination and address.",
          "Add a contact (name/title/phone), a description, and choose what happens On Completion — finish, return to the shop, or return to a job.",
          "Set date, time, and duration. Journey blocks a time that overlaps the person’s jobs or other tasks."
        ]
      },
      {
        "h": "How the field user runs it",
        "items": [
          "The task appears as a Job Card on their phone.",
          "They tap On My Way, Start My Time, then Stop My Time — each stamped with time and GPS location.",
          "If they mark it Incomplete, it turns red here with their reason."
        ]
      },
      {
        "h": "Tracking and records",
        "items": [
          "The table shows assignee, destination (with PARTS / return-to badges), address, tap-to-call/text contact, date/time, duration, the three button-times, status, and description.",
          "Click Records on a row to see each button’s timestamp and map location, total worked time, and task pay, plus the linked parts order.",
          "Use \"Show completed / canceled\" to include finished tasks.",
          "Use \"Show removed\" to list deleted tasks; each has a Restore button to bring one back if it was removed by mistake."
        ]
      },
      {
        "h": "Task pay",
        "items": [
          "Open Task pay summary and set a date range to see each employee’s completed-task count, worked time, and pay.",
          "Worked time is Start My Time → Stop My Time; the rate is the employee’s task rate (Settings → Employee Pay Rates).",
          "This is a task-time report — it does not post to payroll on its own."
        ]
      },
      {
        "h": "Good to know",
        "body": "Cancel keeps a task on the list as Canceled; Delete removes it from the list but keeps it recoverable — turn on \"Show removed\" to Restore a deleted task. Everything is scoped to the selected organization (platform owners get a picker)."
      }
    ]
  },
  {
    "id": "vendors-parts",
    "title": "Vendors & Parts Catalog",
    "area": "Operations",
    "keywords": [
      "vendor",
      "vendors",
      "supplier",
      "parts",
      "parts catalog",
      "part",
      "price",
      "cost",
      "inventory"
    ],
    "purpose": "Vendors is your list of suppliers. Parts Catalog is your parts with their costs and prices, so a part drops onto an estimate or invoice at the right number.",
    "sections": [
      {
        "h": "How to use it",
        "body": "Keep your suppliers in Vendors and your parts (with cost and price) in Parts Catalog. You can bulk-load both from Bulk Import — Import Parts Catalog and Import Vendor Price File — instead of typing them in one at a time."
      },
      {
        "h": "Vendor details that matter",
        "items": [
          "Email — the order email a purchase order is sent to. Keep it current so \"Email to vendor\" on a PO reaches the right inbox.",
          "Address (street, city, state, zip) — shown as its own column and editable inline; use it to task an employee with a parts pickup.",
          "You can add a vendor on the spot with + New Vendor from a Purchase Order or a Special Order — handy for a one-time supplier — without leaving that screen."
        ]
      }
    ]
  },
  {
    "id": "text-archive",
    "title": "Text Archive",
    "area": "Operations",
    "keywords": [
      "text",
      "texts",
      "sms",
      "message",
      "messages",
      "archive",
      "thread",
      "communication",
      "print",
      "flag",
      "important",
      "paper trail"
    ],
    "purpose": "A read-only record of every text conversation technicians have with customers from a job — one thread per conversation — so you always have a paper trail of what was communicated, by whom, and when.",
    "sections": [
      {
        "h": "What it is for",
        "body": "This is your communication record, not a place to start new conversations. A thread appears as soon as a technician sends the first message on a job (shown as \"active\") and stays here as \"archived\" once the job is stopped. Use it to check what a customer was told, settle a dispute, or keep a copy for a warranty or claim."
      },
      {
        "h": "Who can see it",
        "body": "Access is limited to Reception and Dispatch (the view-text-archive permission); Admins can additionally delete threads. Everyone is scoped to their own organization."
      },
      {
        "h": "Finding a conversation",
        "items": [
          "Search by customer name, technician, or job number, and/or filter by date; Clear resets both.",
          "The left list shows each thread with the customer, a ★ if flagged important, message count, job number, active/archived, the tech, and a preview of the last message — newest first.",
          "Click a thread to read the full back-and-forth on the right: technician messages in blue on the right, customer replies in gray on the left, each timestamped."
        ]
      },
      {
        "h": "Working with a thread",
        "items": [
          "Print Thread — opens a clean, print-ready copy of just that conversation for a file or claim.",
          "Flag important (★) — marks a thread you may need again; it rises to the top and is locked against deletion.",
          "Delete thread (Admins only) — removes a thread after a confirm. If it is flagged important, unflag it first.",
          "The job number links to the job; a job that was later deleted shows \"(deleted)\" but keeps its thread on record."
        ]
      }
    ]
  }
]

export const ROUTE_HELP = {
  "/jobs-dash": "jobs-dashboard",
  "/filter-orders": "filter-orders",
  "/operations": "operations-dashboard",
  "/jobs-management": "jobs-management",
  "/jobs": "jobs",
  "/calendar": "calendar",
  "/tasks": "tasks",
  "/customers": "customers",
  "/properties": "properties",
  "/system-estimates": "system-estimates",
  "/estimates": "estimates",
  "/vendors": "vendors-parts",
  "/parts-catalog": "vendors-parts",
  "/text-archive": "text-archive"
}
