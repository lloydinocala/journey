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
      "new filter order",
      "flt",
      "filter invoice",
      "air filter",
      "reorder",
      "pricebook",
      "delivery",
      "shipped",
      "fulfill",
      "merv",
      "cancel",
      "refund",
      "refund owed",
      "mark handed back",
      "stripe"
    ],
    "purpose": "Filter Orders is where every air-filter sale is placed, delivered, and tracked, whether it came from the customer portal, a phone call from a customer or tech, the website, or the office. Each order is a FLT-#### invoice linked to the customer (it shows as \"Filter Invoice\" in the customer’s records).",
    "sections": [
      {
        "h": "Placing a new order",
        "items": [
          "1. Click + New ▾ (top right) and choose New Filter Order. The same New Filter Order popup is in every + New menu in the app, so you can start one from anywhere.",
          "2. Customer: type a name and click the customer.",
          "3. Property: choose the address the filters are for.",
          "4. Order source: choose Office, Called in — customer, Called in — tech, Customer Portal, or Website.",
          "5. If the property has filters on file, click \"Use these\". If it has ordered before, click \"Reorder last\". Both fill in the sizes for you; check them before creating.",
          "6. For each filter line, fill in width × height × thickness, MERV, and quantity. Click \"+ Add another size\" for more lines, or ✕ to remove one.",
          "7. Add Notes if you like (delivery instructions, gate code). Notes is the only optional field.",
          "8. Click \"Create order\" at the bottom (the button stays in view while you scroll). Any missing field is outlined in red and listed above the button.",
          "Creating the order makes an unpaid FLT-#### invoice and emails the customer a pay link if they have an email on file. Prices come from your filter pricebook. A size that is not in the pricebook is left off, so add it there first."
        ]
      },
      {
        "h": "Finding orders",
        "items": [
          "Tabs: Open (still to deliver, with a count), Delivered, Refunds owed (only appears when a cash or check refund is waiting), and All.",
          "Each row shows the order number, date, customer (click to open their file) and address, source, filters, total, payment status, and delivery status.",
          "The list refreshes itself every 30 seconds and when you return to the tab. Click Refresh to update it now."
        ]
      },
      {
        "h": "Delivering an order",
        "items": [
          "1. Work the Open tab.",
          "2. Change the Delivery dropdown as the order moves: Ordered → Shipped → Delivered by tech / Delivered / Picked up.",
          "3. When you pick Shipped, type the carrier or tracking number in the \"Shipped via\" box.",
          "Delivered by tech, Delivered, and Picked up move the order to the Delivered tab. You can deliver before the customer pays; the Payment pill shows Paid or Unpaid."
        ]
      },
      {
        "h": "Changing an order",
        "items": [
          "Edit: change quantities or click Remove on a line. The new total shows as you go. Save, or click \"Cancel edit\". To add a different size, place a new order so the price comes from the pricebook.",
          "Invoice: opens the customer’s invoice to view or re-send.",
          "Delete: removes a mistaken order from the list (it asks you to confirm)."
        ]
      },
      {
        "h": "Cancelling an order (and refunds)",
        "items": [
          "1. Click Cancel on the row. An unpaid order simply drops off the open list and stays on record.",
          "2. If the order was already paid, Journey tells you how much was paid and asks you to confirm.",
          "Card payments made online through Stripe are refunded to the card automatically. The row then shows \"Refunded $__ to card\".",
          "Cash or check payments are flagged \"Refund owed\". The order appears on the Refunds owed tab, and a red \"Refunds owed\" tile appears on the Train Station and Dispatch Station.",
          "3. When you hand the cash or check refund back, click \"Mark handed back\" under the amount and confirm. The row then reads \"Cash/check refund handed back\".",
          "Un-cancel restores a cancelled order, but not after a refund was issued or flagged. In that case, place a new order."
        ]
      },
      {
        "h": "Good to know",
        "body": "Everything is scoped to the selected organization (platform owners get a picker). Filters on file come from the property record, so keeping them current makes reordering a two-click job."
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
      "archive",
      "profit",
      "profit %",
      "partial",
      "no cost data",
      "cost"
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
        "h": "How Projected Profit is worked out",
        "items": [
          "Projected Profit = the estimate total minus sales tax, minus the parts cost.",
          "Parts cost comes from the actual parts used when they have been recorded; otherwise from the pricebook Cost of each line.",
          "\"(partial)\" means some priced lines have no cost on file, so the profit shown is higher than it really is. Add costs in the pricebook to fix it.",
          "\"No cost data\" means there is nothing to subtract yet, so no profit is shown."
        ]
      },
      {
        "h": "Working an estimate",
        "items": [
          "Set the Estimating Technician and update Approval Status (Pending, Approved, Declined, Pending Financing, Completed) right in the row.",
          "Send / Resend emails the estimate to the customer (the button’s tooltip shows when it was last sent and to whom); View opens the customer-facing copy; Edit opens the estimate to change it.",
          "Inside the estimate (Edit), an \"✨ AI: draft scope\" helper turns the line items into a short, plain-language scope-of-work summary a homeowner understands. You review and edit the draft, then paste it in — it never sends anything on its own and never states a total.",
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
          "Send / Resend emails the proposal; View shows the customer’s copy; Edit reopens the estimate. Search, filter by status, show archived, pick columns, and Export CSV as on the other tables.",
          "Opening a system estimate (Edit) shows an \"✨ AI: draft proposal\" helper that turns the equipment, installation, and warranty lines into a warm, plain-language proposal summary for the homeowner — translating model numbers into benefits. Review, edit, and paste; nothing is sent automatically and no total is stated."
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
      "search",
      "retrofits",
      "duct cleaning",
      "diagnosis",
      "tabs",
      "install",
      "permit",
      "financing"
    ],
    "purpose": "Jobs is the master list of all the work: service calls, new-system installs, duct cleaning, and maintenance visits. Find any job, edit it right in the row, read the tech’s diagnosis, and open its paperwork. Tabs give you focused views for Retrofits and Duct Cleaning.",
    "sections": [
      {
        "h": "What it is for",
        "body": "Everything the company does is a job, and this is the table of all of them. Use it to locate a job, change its details, assign technicians, and jump to its invoice or estimate. Day-to-day scheduling is easier on the Calendar; Jobs is for finding and editing the record itself."
      },
      {
        "h": "The tabs: All Jobs, Retrofits, Duct Cleaning",
        "items": [
          "All Jobs: every job, with the columns you choose in Columns ▾.",
          "Retrofits: only new-system jobs (job types RETROFIT, INSTALL, ELECTRIC SPLIT SYSTEM, GAS FURNACE SYSTEM, MINI-SPLIT, PACKAGED UNIT, and SIDE-DISCHARGE). Extra columns: Estimate Total and Approval (from the system estimate that became the job), Payment / Financing (Paid, Financing status, Confirmed, Selected, or Awaiting method), and Permit (status and number).",
          "Duct Cleaning: only DUCT CLEANING jobs, with a Price column (the invoice total), both technicians, and job notes.",
          "Each tab shows how many of its jobs are still open, for example \"Retrofits (4 open)\".",
          "Retrofits and Duct Cleaning use a fixed set of columns; the Columns ▾ picker applies to All Jobs."
        ]
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
        "h": "Reading the Diagnosis column",
        "items": [
          "The Diagnosis column shows what the tech found, read live from the job’s invoice: the tech’s diagnosis note, or the invoice’s Diagnosis line when there is no note.",
          "1. Click the diagnosis text to open the full write-up.",
          "2. Click \"Open invoice\" in that window to go to the invoice.",
          "It is read live and never copied, so a change on the invoice shows here right away. It shows — when there is no diagnosis yet."
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
      "dispatch",
      "reason",
      "other",
      "needs rescheduling",
      "→ dispatch",
      "route"
    ],
    "purpose": "Jobs Management is the parts-and-follow-up desk. Incomplete jobs that need a part, an estimate, or office follow-up land here so the office can price it, order it, track delivery, and stage the return visit. Jobs that only need another visit go to Dispatch’s Needs Rescheduling page instead.",
    "sections": [
      {
        "h": "How jobs get here",
        "items": [
          "When a tech stops a job as Incomplete, they pick a reason. Parts, estimate, and \"Other\" reasons come here. A customer signing off on a follow-up estimate also puts the job here.",
          "\"No one home\", \"Weather or site conditions\", and \"Emergency or scheduling interruption\" go to Dispatch’s Needs Rescheduling page instead.",
          "The Reason column shows the tech’s reason. When they chose \"Other\", their required short note shows in quotes underneath.",
          "If a row only needs a new visit (not parts or an estimate), click \"→ Dispatch\" to send it to Needs Rescheduling. A job you send by hand stays where you put it.",
          "Red row = nothing done yet; yellow row = a return visit already exists. A row clears itself once the newest visit is marked Complete."
        ]
      },
      {
        "h": "Working an incomplete job",
        "items": [
          "Work each row left to right: confirm the equipment, get the estimate approved, order the part, then stage the next segment.",
          "Open Estimate opens the follow-up estimate in a side panel that stays visible while you fill in the parts fields.",
          "Brand / Model # / Serial # auto-fill from the property’s equipment on file; edit them if needed.",
          "Warranty or Cash: choose Warranty, Cash, or Punchlist. Claim Status then offers only the valid choices — Warranty → Pending / Approved; Cash → Not Warranty Eligible; Punchlist → Punchlist.",
          "Price is a free-text field you fill in; Availability is a date you enter for when the part will be available.",
          "Verbal Approval records the new estimate amount and its status (Pending / Approved / Declined / Punchlist). If it’s Declined, Edit shows \"Flip to Complete\" to close the job out (it also reads Completed on the Jobs table).",
          "Edit opens the row for changes (Save or Cancel). \"→ Dispatch\" sends the row to Needs Rescheduling. Delete removes the entry from Jobs Management (any parts ordered stay on record, and the job itself is not deleted)."
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
      "export",
      "last job",
      "properties",
      "multi-property",
      "landlord",
      "property manager",
      "sort"
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
          "The list opens sorted by most recent job created (newest first), then by last name, so the customers you are working with now are at the top.",
          "Last Job shows when the customer’s most recent job was created. Properties shows how many active properties they own or manage.",
          "A purple \"Multi-property · N\" badge next to the name marks customers with 2 or more properties, such as landlords and property managers.",
          "Click any column header to sort by it; click again to reverse. Click Last Job to get back to the default order.",
          "Search by name, company, phone, or email.",
          "Show archived includes retired customers; Columns lets you show or hide fields (remembered in your browser).",
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
      "slot",
      "unassigned tasks",
      "assign to",
      "task"
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
        "h": "The Unassigned Tasks tray",
        "items": [
          "Under Needs Dispatch, an \"Unassigned Tasks\" tray lists tasks created with no one assigned. It only appears when there is at least one.",
          "Each card shows the destination, date and time, and description.",
          "1. Pick a person in the card’s \"Assign to…\" list. The task goes to that person’s phone as a Job Card and leaves the tray.",
          "To change a task’s time or details, use the Tasks page."
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
      "new task",
      "field task",
      "errand",
      "parts pickup",
      "assign",
      "unassigned",
      "unassigned tasks",
      "on my way",
      "start",
      "stop",
      "task pay",
      "job card",
      "destination",
      "locked",
      "archive",
      "show archived",
      "payroll"
    ],
    "purpose": "Tasks are errands for a field user that are not customer jobs, like a parts pickup, a drop-off, or a quick stop. Each assigned task becomes a time-tracked Job Card on that person’s phone, so it is scheduled, recorded, and paid much like a job.",
    "sections": [
      {
        "h": "Creating a task",
        "items": [
          "1. Click + New Task (top right). This is the only way to create a task.",
          "2. Assign to: pick a person, or leave it \"Unassigned — stage it on the Calendar\".",
          "3. Pick a Parts House to fill in the name and address, or type any destination name and address.",
          "4. Add a contact name, title, and phone if useful.",
          "5. Set the Date, Time, and Duration, and add a Description (for example \"Re: PO # or Job #\").",
          "6. Choose On Completion: \"Done — back to Job Cards\", \"Return to Shop\", or \"Return to Job\".",
          "7. Click Create Task.",
          "An unassigned task waits in the Calendar’s \"Unassigned Tasks\" tray until someone picks a person in its \"Assign to…\" list."
        ]
      },
      {
        "h": "Editing a task (right in the row)",
        "items": [
          "1. Click Edit on the row. The row turns into editable fields.",
          "2. Change who it is assigned to (or set it back to Unassigned), the destination (with \"Parts house quick-fill…\"), address, contact, date and time, duration, what happens on completion, the linked parts order, and the description.",
          "3. Click Save, or Cancel to discard.",
          "Journey will not save a time that overlaps the person’s jobs or other tasks; it tells you what it overlaps.",
          "The On My Way / Started / Stopped times are recorded by the phone and cannot be typed in."
        ]
      },
      {
        "h": "How the field user runs it",
        "items": [
          "The task appears as a Job Card on their phone.",
          "They tap On My Way, Start My Time, then Stop My Time. Each tap is stamped with the time and GPS location.",
          "If they mark it Incomplete, the row turns red here and shows their reason."
        ]
      },
      {
        "h": "Completed tasks are locked",
        "items": [
          "A completed task is a payroll record. Its Edit and Delete buttons are replaced by \"🔒 Locked\", and the database blocks changes too.",
          "Completed tasks archive automatically 3 weeks after they are stopped (the default). Change this in Settings → Jobs & Customers → Tasks, or pick \"Always show — never archive\". Use the ⚙ Page Settings button to get there.",
          "Archived tasks are hidden, not deleted. Tick \"Show archived\" to see them (they appear faded)."
        ]
      },
      {
        "h": "Finding and tracking tasks",
        "items": [
          "The header shows how many tasks are open, and how many are marked incomplete.",
          "Columns: Assigned To (or an Unassigned pill), Destination (with PARTS and ↩ SHOP / ↩ JOB badges), Address, Contact (tap to call or text), Date & Time, Duration, On My Way, Started, Stopped, Status, and Description.",
          "Tick \"Show completed / canceled\" to include finished tasks.",
          "Click Records on a row to see each button’s time and map location, total worked time, task pay, the linked parts order, and any incomplete reason. Click Hide to close it."
        ]
      },
      {
        "h": "Cancelling and deleting",
        "items": [
          "Cancel (and confirm) keeps the task on the list marked Canceled.",
          "Delete (and confirm) removes a task that is not completed. There is no restore button, so use Cancel if you may need the record."
        ]
      },
      {
        "h": "Task pay",
        "items": [
          "1. Click \"Task pay summary\".",
          "2. Set the From and To dates.",
          "The table shows each employee’s completed tasks, worked time (Start My Time → Stop My Time), task rate, and pay, with a total. \"set rate\" in red means that person has no task rate yet (Settings → WorkForce → Employee Pay Rates).",
          "This is a report only; it does not post to payroll on its own. Click \"Hide task pay\" to close it."
        ]
      },
      {
        "h": "Good to know",
        "body": "Tasks are not the office To-Do list (that is the To-Dos tile on the Dispatch Station). Everything is scoped to the selected organization (platform owners get a picker)."
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
          "Brands — the brands this vendor supplies, shown as tags with a ★ on your preferred source for each brand (edit them on the vendor's profile). This is what routes a brand's parts to the right parts house.",
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
      "paper trail",
      "on my way",
      "review request",
      "sent",
      "not sent",
      "customer reply",
      "tenant",
      "team communications",
      "delivery status"
    ],
    "purpose": "A read-only record of every text sent from a job (On My Way alerts, technician messages, and review requests) and every customer reply, one thread per job. Each text shows what it was, who it went to, and whether it really went out. It lives under WorkForce → Team Communications.",
    "sections": [
      {
        "h": "What it is for",
        "body": "This is your communication record, not a place to start new conversations. A thread appears as soon as a text goes out on a job (shown as \"active\") and stays here as \"archived\" once the job is stopped. Use it to check what a customer was told, prove a text was delivered, settle a dispute, or keep a copy for a warranty or claim. Open it from WorkForce → Team Communications → Text Archive, or the Text Archive button on the Team Communications page."
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
        "h": "Reading each text",
        "items": [
          "Under every text is a line saying what it was: On My Way, Review request, Technician (a message from the tech), or Customer reply (with who sent it).",
          "It shows who it went to (name and number), then ✓ Sent, or ✗ Not sent with the reason (shown in red). \"Not sent (saved before texting was connected)\" marks older texts that were only saved.",
          "Customer replies arrive in the same thread.",
          "On My Way alerts go to every tenant on the property plus the homeowner. Technician messages and review links go to the on-site contact."
        ]
      },
      {
        "h": "Working with a thread",
        "items": [
          "🖨 Print Thread — opens a clean, print-ready copy of just that conversation for a file or claim.",
          "☆ Flag important — marks a thread you may need again (it shows ★ Important and a ★ in the list) and locks it against deletion. Click it again to unflag.",
          "Delete thread (Admins only) — click it, then Delete to confirm. A flagged thread shows \"🔒 Flagged — can’t delete\" until you unflag it.",
          "The job number links to the job; a job that was later deleted shows \"(deleted)\" but keeps its thread on record."
        ]
      }
    ]
  },
  {
    "id": "system-estimate-builder",
    "title": "Building a System Estimate",
    "area": "Operations",
    "keywords": [
      "system estimate",
      "build",
      "add/edit system",
      "equipment",
      "lineset",
      "thermostat",
      "installation includes",
      "warranty",
      "special feature",
      "misc item",
      "discount",
      "send",
      "text",
      "email",
      "tier",
      "replace"
    ],
    "purpose": "This is the screen where you build a new-system proposal: pick the equipment, add the lineset, thermostat, add-ons, and extras, then send it to the customer. Techs build the same estimate in the field app with the same steps.",
    "sections": [
      {
        "h": "Top of the page",
        "items": [
          "Set the Estimating Technician and the Approval Status (Pending, Approved, Rejected, Pending Financing).",
          "\"From service call\" (before approval) links this proposal to the service call it came from, or leave it on \"None — becomes a new job only\".",
          "Once it has been converted, an Install job link shows the job number and status.",
          "\"✨ AI: draft proposal\" writes a short, plain-language summary from the line items for you to review and paste. It never sends anything and never states a total."
        ]
      },
      {
        "h": "Picking the system (Add/Edit System)",
        "items": [
          "1. Choose the System type, then the Size (Tons).",
          "2. Narrow the list with SEER2, Brand, or the search box (model #, brand) if needed.",
          "3. Click the system you want. Its installed price shows under the list.",
          "4. Tick Taxable if the system is taxed.",
          "5. Optional: tick \"Include lineset\" and enter its price, and/or \"Include thermostat (its own priced line)\" and enter the model and price. The thermostat starts with the default from System Estimate Setup.",
          "6. Click \"Add to estimate\".",
          "Picking a system replaces the current one. Estimates hold one system at a time; there is no stacking of several options. To show a different choice, pick it and it replaces the old one."
        ]
      },
      {
        "h": "Lineset & Thermostat (without re-picking the equipment)",
        "items": [
          "Once a system is on the estimate, a \"Lineset & Thermostat\" box appears.",
          "1. Click \"+ Add Lineset\" (or \"Edit Lineset\") or \"+ Add Thermostat\" (or \"Edit Thermostat\").",
          "2. Type the description and price.",
          "3. Click \"Add to estimate\" (or Save), or Cancel.",
          "The lineset prints under \"Also includes:\". The thermostat is its own priced line."
        ]
      },
      {
        "h": "Installation includes and Warranty",
        "items": [
          "These are added automatically from System Estimate Setup when you pick a system.",
          "They are description-only lines, marked \"Description only — no price\". They tell the customer what is included and what is covered.",
          "Warranty always prints last on the estimate."
        ]
      },
      {
        "h": "Add-ons, extras, and discount",
        "items": [
          "Add Special Feature: pick an add-on from your catalog and click \"Add feature\". Add as many as apply.",
          "Add Misc Item: type a description (permits, extra materials, disposal fees), quantity, and unit price, tick Taxable if needed, and click \"Add to estimate\".",
          "In the line-item table you can change any priced line’s quantity or unit price, or click Remove. A \"PENDING · tech request\" item needs a price and an admin’s Approve.",
          "Discount: choose $ or % and type the amount. Subtotal, sales tax, discount, and Estimated Total update below."
        ]
      },
      {
        "h": "Sending it to the customer",
        "items": [
          "The Customer link box shows the page the customer sees (no login needed). Use Copy or Open.",
          "Click \"Review / Preview\" to check it first.",
          "Click \"Email to Customer\" (or \"Re-email to Customer\") or \"Text to Customer\". The last-sent time shows next to the buttons."
        ]
      },
      {
        "h": "Good to know",
        "body": "Set the default installation text, default thermostat, and warranty wording on System Estimate Setup. When permit tracking is on, a Permit section appears at the bottom. Once approved, convert it to an install job from the System Estimates list."
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
  "/text-archive": "text-archive",
  "/system-estimate/": "system-estimate-builder",
  "/system-estimate-p/": "system-estimate-builder"
}
