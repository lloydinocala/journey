// Help articles — Dispatch section. One file per section so edits stay local.
// Shape: export const HELP_ARTICLES (array) + ROUTE_HELP (route -> article id).
// Aggregated by ./HelpArticles.js. Keep article ids unique across ALL section files.

export const HELP_ARTICLES = [
  {
    "id": "service-requests",
    "title": "Service Requests",
    "area": "Dispatch",
    "keywords": [
      "service requests",
      "qr",
      "qr code",
      "sticker",
      "label",
      "homeowner",
      "tenant",
      "landlord",
      "approve",
      "decline",
      "owner approval",
      "dispatch",
      "create job",
      "request page",
      "archive",
      "unarchive",
      "history",
      "report",
      "success",
      "triage",
      "urgent"
    ],
    "purpose": "Service Requests is the inbox for jobs customers start themselves by scanning the QR service sticker at their home. Approve a request and Journey creates the job in the Calendar’s Needs Dispatch tray, billed to the property’s account holder. When someone other than the account holder (like a tenant) asks, the landlord has to approve first. The page has three tabs: Active, History, and Report.",
    "sections": [
      {
        "h": "Working the Active tab (new requests)",
        "items": [
          "1. Open the Active tab. Requests waiting on you are split into two groups: \"Awaiting homeowner approval\" (from someone other than the account holder) and \"Ready to dispatch\".",
          "2. Read each card: the category (Repair, Tune-up, Question) and the urgency the customer picked, the address and the account it bills to, what they wrote, who reported it (name and phone), and when it came in.",
          "3. Check the triage badge. Journey reads the request text and marks it Urgent or Elevated when it mentions things like a gas smell, smoke, no heat, no cooling, a leak, or an elderly person or baby in the home. The reasons it matched are printed next to the badge, and the most urgent requests sort to the top.",
          "4. On a Ready to dispatch card, click \"Approve → create job\". The job lands in the Calendar’s Needs Dispatch tray. Schedule it like any other job.",
          "5. On an Awaiting card, wait for the landlord to approve from their email. If they approved by phone instead, click \"Owner approved (I called) → ready\" to move it to Ready to dispatch.",
          "6. Click Decline (and confirm) to close a request you will not act on.",
          "The list refreshes itself every 30 seconds and when you come back to the browser tab. Click Refresh to update it now."
        ]
      },
      {
        "h": "The landlord-approval safeguard",
        "body": "When the person asking is not the account holder, Journey emails the account holder a link to approve and holds the request under \"Awaiting homeowner approval\". Nothing is scheduled or billed until they say yes. A tenant can report a problem, but cannot approve billable work in the owner’s name."
      },
      {
        "h": "The History tab (finished requests)",
        "items": [
          "1. Open the History tab to see approved and declined requests, newest first. Each card shows its outcome: \"Approved → job created\" or \"Declined\".",
          "2. Archived requests are hidden. Tick \"Show archived\" to include them. An archived card shows the date it was archived.",
          "3. Anyone can click Archive to hide a finished request, or Unarchive to bring it back.",
          "4. Admins also see Edit and Delete. Edit lets you fix the reporter name, phone, and details, then click Save (or Cancel).",
          "5. Delete removes the request permanently, and it also drops out of the Report. Journey warns you first. Only delete a request that was entered by mistake; otherwise use Archive, which keeps the record."
        ]
      },
      {
        "h": "Automatic archiving (nothing is auto-deleted)",
        "items": [
          "Every night, finished requests archive themselves: a declined request a set number of days after it was declined, and an approved request that many days after the job’s invoice is paid in full.",
          "The number of days is set in Settings → Dispatch → \"Service requests (QR stickers)\" → \"Archive after __ days\" (default 30). Use the ⚙ Page Settings button in the top bar to get there.",
          "Archiving only hides a request. Nothing is deleted automatically, and archived requests still count in the Report."
        ]
      },
      {
        "h": "The Report tab (is the QR program working?)",
        "items": [
          "1. Open the Report tab and pick a period: Last 30 days, Last 90 days, Last 12 months, or All time.",
          "Requests: how many came in, and how many became jobs, were declined, or are still open.",
          "Became jobs: the share of decided requests that turned into jobs.",
          "Landlord approved: of requests that needed the landlord, how many they approved or declined.",
          "Landlord response time: the average time from request to the landlord’s answer.",
          "Repair calls via QR: the share of repair jobs that came through a QR request; the rest were phoned in.",
          "Sales from requests: invoice totals (before sales tax) from jobs that came from requests, and their share of all sales.",
          "Homes with QR codes: properties whose sticker has been printed, and how many of those have tenants.",
          "Requests per QR home: requests in the period divided by homes with QR codes.",
          "The report counts every request, including archived ones, so archiving never changes the numbers. The same report is the \"Service Requests\" tab on the Command Center home."
        ]
      },
      {
        "h": "Printing a QR sticker for a home",
        "items": [
          "1. Scroll to \"Print a service QR sticker\" (on the Active tab).",
          "2. Type a street address or customer name in the search box and click the right property.",
          "3. Click \"Print label (top half)\" to print the branded label (your logo, business name, and the landlord-approval notice) on the top half of a Letter sheet. Flip the sheet to print a different home’s code on the other half.",
          "4. Or click \"Print code only\" for just the QR code, or \"Open full-size\" for a large image.",
          "Printing marks the property as having a QR code (that is what the Report counts). Anyone who scans the code opens a request page already tied to that address."
        ]
      },
      {
        "h": "Good to know",
        "body": "Everything is scoped to the selected organization; platform owners pick it from \"Viewing organization\". Requests show up as the \"New service requests\" tile on the Dispatch Station."
      }
    ]
  },
  {
    "id": "call-log",
    "title": "Call Log",
    "area": "Dispatch",
    "keywords": [
      "call log",
      "calls",
      "call history",
      "call back",
      "callback",
      "follow-up",
      "flag",
      "clear",
      "archive",
      "export csv",
      "tap to call",
      "taken by",
      "route to"
    ],
    "purpose": "The Call Log is the running record of every call logged from the Call Console. It is a working list, not a permanent archive: flag the calls that need a call-back or follow-up, and everything else clears itself overnight so the board stays focused on what still needs doing.",
    "sections": [
      {
        "h": "What it is for",
        "body": "Use the Call Log to make sure no call is dropped. It is deliberately self-cleaning — the calls you flag stay, the rest disappear overnight — so what you are looking at is always the calls that still need action, not months of noise. Every flag here is the same flag that drives the call tiles on the Dispatch Station."
      },
      {
        "h": "The two tables",
        "items": [
          "Today — the active board, always in view, showing every call logged since midnight.",
          "Earlier calls — a searchable archive of everything before today. Each table scrolls on its own so Today stays put while you dig through history."
        ]
      },
      {
        "h": "Reading a row",
        "items": [
          "Caller is linked to the customer or vendor record when the call was matched to one; names show as first name + last initial.",
          "Caller type is color-coded (Customer, Vendor, Employee, Contact, Salesman, Personal, Unknown).",
          "Phone is a tap-to-call link — click it to dial. Purpose, Taken by, and Route to show how the call was handled.",
          "A row flagged for call-back or follow-up is highlighted so it stands out."
        ]
      },
      {
        "h": "Flagging and clearing",
        "items": [
          "Tick Call back (urgent) or F/U? (follow-up) on any row. Flagged calls are kept until you clear the flag, and they raise the matching count on the Dispatch Station.",
          "Untick the box once the call is handled — it then becomes eligible to clear.",
          "Unflagged calls clear automatically overnight. To clear them now, use \"Clear all unflagged entries\" — it only affects calls before today, never Today, and asks you to confirm.",
          "Nothing is ever permanently erased; a cleared call can still be recovered (see Export)."
        ]
      },
      {
        "h": "Finding an older call",
        "items": [
          "Use the Earlier-calls search box — it matches on name, phone, purpose, caller type, or route-to.",
          "Narrow by time with the Last 7 days / Last 30 days / All toggle."
        ]
      },
      {
        "h": "Exporting records",
        "items": [
          "Click Export CSV (top-right). Leave the filters blank for the full history, or add a caller name and/or a from/to date range to pull one caller’s complete record.",
          "Keep \"Include cleared calls\" checked to recover auto-cleared and manually cleared calls — recommended for a complete record.",
          "Download produces a spreadsheet with date/time, caller, type, phone, purpose, taken-by, route, both flags, and each call’s status (Active or Cleared)."
        ]
      },
      {
        "h": "Good to know",
        "body": "Everything is scoped to the selected organization. The on-screen list shows the most recent calls; for a full historical pull use Export, which reaches far deeper than the live view."
      }
    ]
  },
  {
    "id": "call-console",
    "title": "Call Console",
    "area": "Dispatch",
    "keywords": [
      "call",
      "console",
      "phone",
      "caller id",
      "lookup",
      "inbound",
      "log call",
      "callback",
      "call-back",
      "follow-up",
      "route",
      "known contact",
      "vendor",
      "note",
      "who is calling",
      "call for a team member",
      "take a call",
      "message",
      "transfer",
      "forward"
    ],
    "purpose": "The Call Console is what you open the moment the phone rings. Type the caller’s number and it instantly identifies who is calling — customer, vendor, employee, or a saved contact — and pulls up everything you need to help them: history, equipment, plan, and balance. Then log the call so nothing falls through the cracks.",
    "sections": [
      {
        "h": "What it is for",
        "body": "This is the front desk in software form. Instead of asking a caller to repeat their name and account, you type their number and the whole picture appears. It turns every inbound call into a fast, informed conversation and a logged record — the log is what feeds the call-back and follow-up tiles on the Dispatch Station, so calls do not get forgotten."
      },
      {
        "h": "Step 1 — pull up the caller",
        "items": [
          "Type or paste the caller’s phone number in the big field (it is focused the moment the page opens).",
          "At 4+ digits it searches your customers. At 7+ digits it also matches vendors, employees, and saved contacts.",
          "If more than one person matches, a short list appears — click the right one.",
          "Identification precedence is Customer, then Vendor, then Employee, then Known contact."
        ]
      },
      {
        "h": "What the caller card shows",
        "items": [
          "Customer: name, company, phones, email; a red BANNED banner if the customer is flagged; a maintenance-plan pill (or \"No maintenance plan\"); balance (red when they owe); systems-on-file count; every address; and up to 6 recent or open jobs.",
          "Vendor / Employee / Known contact: a compact card identifying who they are; the vendor card links to the vendor record, and the employee card opens the Team roster.",
          "Open full record → jumps to the customer’s file to book work or answer detailed questions."
        ]
      },
      {
        "h": "Step 2 — help them, without leaving the page",
        "items": [
          "Order filters — opens the filter-order form for the caller’s property (shown when a customer with a property is up).",
          "New item dropdown / \"New Job pre-fills <customer>\" — start a job or other record already tied to this caller.",
          "New Note — jot a quick office reminder; it posts to the Operations Dashboard for whoever picks it up."
        ]
      },
      {
        "h": "Step 3 — when there is no match",
        "items": [
          "+ New customer — create a full customer record.",
          "+ Add a contact — save a salesman, friend/family, or other known caller inline so they are recognized next time.",
          "Or just log the call — capture caller name, purpose, routing, and call-back/follow-up without creating a record."
        ]
      },
      {
        "h": "Step 4 — log every call",
        "items": [
          "Pick a purpose from the quick-buttons (Book service, Reschedule, Billing question, Status update, General question, Vendor / supplier) or type your own.",
          "Route to… — send the message to Dispatch, Jobs Mgmt, or a specific person.",
          "Tick Needs call back (urgent) or Follow-up — these light the red/amber call tiles on the Dispatch Station and mark the call in the Call Log until it is handled.",
          "Click Log call. The caller’s last several calls show underneath so you can see the recent history at a glance."
        ]
      },
      {
        "h": "When the caller wants a team member",
        "items": [
          "1. Click \"📞 Call for a team member\" (top of the page).",
          "2. Choose who the call is for. Their instructions appear: their first choice, what to do if that is not possible, and any notes.",
          "3. Pick what you did: Transfer, Forward to cell, Take a message, or Book appointment (★ marks their first choice).",
          "4. Enter the caller’s name and phone, plus the message or appointment details, and tick Urgent if needed.",
          "5. Click the button at the bottom to log it. That person gets a 📨 badge in the top bar and a desktop notification.",
          "For now, do the actual transfer or forward on your phone, then log it here. See the Team Communications help for the full details."
        ]
      },
      {
        "h": "Good to know",
        "body": "Everything is scoped to the selected organization (platform owners get an org picker). A banned-customer banner is a warning, not a lock — use your judgment. Logging is the point: an unlogged call is invisible to the rest of the office."
      }
    ]
  },
  {
    "id": "dispatch-station",
    "title": "Dispatch Station",
    "area": "Dispatch",
    "keywords": [
      "dispatch",
      "station",
      "board",
      "front of house",
      "signals",
      "service requests",
      "jobs to schedule",
      "needs dispatch",
      "filter orders",
      "to-dos",
      "calls",
      "callback",
      "call-back",
      "follow-up"
    ],
    "purpose": "The Dispatch Station is your front-of-house board — everything coming IN (new requests, calls to return) and everything going OUT (jobs to schedule, techs to dispatch, filters to fulfill) on one screen. Each tile is a live count that opens the exact worklist behind it. The goal is to clear the board to zero.",
    "sections": [
      {
        "h": "What it is for",
        "body": "Open Dispatch first thing and at intervals through the day to see, in one place, everything front-of-house that needs a hand. It reads the same shared signal registry as the Train Station roll-up, so anything you clear here also clears there — the numbers never disagree. You do not do the work on this page; each tile takes you to the page where you do it."
      },
      {
        "h": "The ten things it watches",
        "items": [
          "New service requests — customer requests waiting to be reviewed and booked → opens Service Requests.",
          "Jobs to schedule — approved jobs not yet on the board → opens the Calendar.",
          "Needs dispatch — scheduled jobs with no technician assigned → opens the Dispatch Map.",
          "Needs rescheduling — incomplete jobs stopped for no access, weather, or an interruption → opens Needs Rescheduling.",
          "Parts in — schedule return — a staged return visit whose part has arrived (marked Delivery Verified in Jobs Management) and can now be booked → opens the Calendar.",
          "Refunds owed (shown red) — cancelled filter orders paid by cash or check where the money still has to be handed back → opens Filter Orders.",
          "Filter orders to fulfill — filter orders awaiting fulfillment → opens Filter Orders.",
          "To-Dos — open office reminders → opens the To-Do list.",
          "Calls to return (shown red — most urgent) — calls flagged for a call-back → opens the Call Log.",
          "Call follow-ups — calls flagged for follow-up → opens the Call Log."
        ]
      },
      {
        "h": "How to work the board",
        "items": [
          "Read the banner at the top: amber means work is waiting (with a count across how many areas); green means the board is clear. The Quincy \"Dispatch briefing\" beside it gives quick context.",
          "Work the \"Needs a hand\" tiles. Each shows the item name, a count badge, a plain-English line, and a call-to-action. Handle red tiles first — a missed call-back is a lost customer.",
          "Click any tile to jump to its worklist, clear the items there, and the count drops the next time the board loads.",
          "Signals at zero move to the \"Handled\" row as green pills — still clickable if you want to look.",
          "Platform owners: use the Organization picker (top-right) to view any client company’s dispatch board."
        ]
      },
      {
        "h": "Good to know",
        "body": "Counts are live and scoped to the selected organization. Red tiles are urgent, amber tiles are routine attention. An empty board — \"The board’s clear\" — is the win."
      }
    ]
  },
  {
    "id": "needs-rescheduling",
    "title": "Needs Rescheduling",
    "area": "Dispatch",
    "keywords": [
      "needs rescheduling",
      "reschedule",
      "incomplete",
      "incomplete job",
      "no one home",
      "no access",
      "weather",
      "interruption",
      "return visit",
      "stage",
      "stop my time",
      "jobs management",
      "dispatch"
    ],
    "purpose": "Needs Rescheduling is Dispatch’s list of incomplete jobs that only need another visit, such as when no one was home, the weather stopped the work, or an emergency pulled the tech away. Stage the return visit from here and it goes into the Calendar’s Needs Dispatch tray.",
    "sections": [
      {
        "h": "How jobs get here",
        "items": [
          "When a tech stops a job as Incomplete in the field app, they pick a reason. Journey sends the job to the right desk based on that reason.",
          "These three reasons come here, to Dispatch: \"No one home / unable to access property\", \"Weather or site conditions prevented completion\", and \"Emergency or scheduling interruption\".",
          "Every other reason (parts, estimates, \"Other\") goes to Jobs Management instead.",
          "When a tech picks \"Other\", they must type a short note. The note shows in quotes under the reason on both pages.",
          "If someone moved a job by hand with \"→ Dispatch\" or \"→ Jobs Management\", Journey keeps it where they put it."
        ]
      },
      {
        "h": "Reading the table",
        "items": [
          "Job # (click to open the job), Customer, Phone, and Address.",
          "Reason: the tech’s reason, with their note underneath when there is one.",
          "Stopped: the date the tech stopped the job.",
          "Return visit: either a \"Stage return visit\" button, a link that says \"In Calendar tray — schedule it\", or \"Scheduled [date]\" once it is on the calendar."
        ]
      },
      {
        "h": "Rescheduling a job, step by step",
        "items": [
          "1. Call the customer (the phone number is in the row) to agree on a new time.",
          "2. Click \"Stage return visit\". Journey creates the next segment of the same job with no date or tech and puts it in the Calendar’s Needs Dispatch tray. A green message confirms it.",
          "3. Click \"In Calendar tray — schedule it\" (or open the Calendar) and drag the visit onto the day and time you want.",
          "4. When the tech marks that return visit Complete, the row clears from this list by itself.",
          "If it turns out to be a parts or estimate problem, click \"→ Jobs Management\" to hand it to the office instead."
        ]
      },
      {
        "h": "Good to know",
        "body": "A count of these jobs shows as the \"Needs rescheduling\" tile on the Train Station and the Dispatch Station. Records clear only when the newest visit for the job is Complete. Platform owners get an organization picker."
      }
    ]
  },
  {
    "id": "dispatch-map",
    "title": "Dispatch Map",
    "area": "Dispatch",
    "keywords": [
      "dispatch map",
      "map",
      "route",
      "routing",
      "optimize route",
      "territory",
      "territories",
      "zip",
      "county",
      "live tracking",
      "gps",
      "unassigned",
      "ai dispatch",
      "suggest tech",
      "assign",
      "new"
    ],
    "purpose": "The Dispatch Map shows a day’s jobs, unscheduled bookings, and your technicians on a map, so you can assign the right tech, see territories, and plan efficient routes.",
    "sections": [
      {
        "h": "Getting around",
        "items": [
          "1. Pick the day with the Date box. Click Refresh to reload.",
          "2. Use the 🗓 button to switch to the Calendar for the same date (📍 is the map view you are on).",
          "3. Color by: Tech colors each pin by its technician; Territory colors pins by the territory they fall in.",
          "4. Tick \"Territory zones\" to shade your territories on the map, and \"Unscheduled bookings\" to show jobs still waiting for a date (any date).",
          "The bar shows how many jobs and techs are on the map, and how many techs are reporting their location live right now.",
          "Click any pin to see the customer, time, job type, address, tech, and a suggested tech when one fits better."
        ]
      },
      {
        "h": "Reading the pins",
        "items": [
          "Red dot: unassigned or needs attention.",
          "Gray dot: completed.",
          "Colored dot: assigned (in the tech’s color, or the territory color).",
          "Red diamond: an unscheduled booking.",
          "Green teardrop: a technician’s location."
        ]
      },
      {
        "h": "Assigning techs with AI Dispatch",
        "items": [
          "1. The \"✨ AI Dispatch — unassigned jobs\" panel lists jobs with no tech. Use + / – to open or close it.",
          "2. Click \"✨ Suggest tech\" on a job. Journey ranks techs by drive time, workload, and territory, with a short reason for each.",
          "3. Click Assign next to the tech you want. Nothing is assigned until you click Assign.",
          "Drive times are straight-line estimates until a tech has live GPS or a stop that day."
        ]
      },
      {
        "h": "Optimizing routes",
        "items": [
          "1. Choose a tech (or \"All techs\") in \"🧭 Optimize route\".",
          "2. Numbered pins show the suggested visit order, starting from the tech’s current location when known. A summary shows stops, miles, drive minutes, and miles saved.",
          "Miles and times are straight-line estimates unless road data is connected. The suggestion does not change the schedule; reorder jobs on the Calendar if you want to follow it.",
          "Set it back to Off to hide the route."
        ]
      },
      {
        "h": "Setting up territories",
        "items": [
          "1. Click \"Manage territories\".",
          "2. Enter a Name and pick a Color.",
          "3. Type the ZIP codes it covers (comma or space separated). Optionally add whole counties with the county search.",
          "4. Click the tech(s) who own it, then click \"Add territory\" (or \"Save territory\" when editing).",
          "Use Edit or Delete on an existing territory, and \"+ New\" to start a fresh one."
        ]
      },
      {
        "h": "Creating something new",
        "body": "Use the + New ▾ menu (top right) to create a job, task, customer, property, estimate, invoice, filter order, or other item without leaving the map. The map refreshes after you save."
      },
      {
        "h": "Good to know",
        "body": "Everything is scoped to the selected organization; platform owners get a picker. The Dispatch Station’s \"Needs dispatch\" tile opens this page."
      }
    ]
  }
]

export const ROUTE_HELP = {
  "/dispatch": "dispatch-station",
  "/call": "call-console",
  "/call-log": "call-log",
  "/service-requests": "service-requests",
  "/needs-rescheduling": "needs-rescheduling",
  "/dispatch-map": "dispatch-map"
}
