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
      "sticker",
      "homeowner",
      "tenant",
      "approve",
      "decline",
      "owner approval",
      "dispatch",
      "create job",
      "request page"
    ],
    "purpose": "Service Requests is the inbox for jobs customers start themselves — by scanning the QR service sticker on their equipment. Approve a request and Journey creates the job in the dispatch tray, billed to the property’s account holder. A built-in approval step protects the account holder when the request comes from someone else, like a tenant.",
    "sections": [
      {
        "h": "What it is for",
        "body": "This turns a sticker on the air handler into a booking channel. A customer scans it, describes the problem, and it appears here — no phone call needed. Your job is to review each one and either turn it into a job or decline it. The approval safeguard means a tenant can report a problem without being able to authorize billable work in the owner’s name."
      },
      {
        "h": "The two queues",
        "items": [
          "Ready to dispatch — requests you can approve straight into a job. These are from the account holder, or already owner-approved.",
          "Awaiting homeowner approval — requests made by someone other than the account holder. Nothing is scheduled or billed until the owner approves.",
          "Every card is color-coded by urgency: emergency (red), soon (amber), flexible (green), and carries a basis badge showing how it qualified."
        ]
      },
      {
        "h": "Reading a request",
        "items": [
          "Top line: category (Repair, Tune-up, Question) and the urgency the customer chose.",
          "Property address and the account holder it will bill to; the free-text details; and who reported it (name and phone).",
          "The timestamp shows when it came in."
        ]
      },
      {
        "h": "Working the queue",
        "items": [
          "Approve → create job — creates the job in the dispatch tray, billed to the property’s account holder. Then schedule and dispatch it like any job.",
          "Decline — dismisses a request that is not actionable (asks you to confirm).",
          "Owner approved (I called) → ready — on an awaiting card, use this after you have confirmed approval another way (e.g. the owner phoned in); it moves the request to Ready to dispatch.",
          "Active / History — the Active tab is the live queue you work; the History tab is a read-only archive of requests already handled, each showing its outcome (Approved → job created, or Declined), newest first.",
          "The list refreshes on its own every 30 seconds and when you return to the tab; Refresh forces it now."
        ]
      },
      {
        "h": "The homeowner-approval safeguard",
        "body": "When a request comes from someone who is not the account holder, Journey automatically emails the account holder a link to approve it, and holds the request in \"Awaiting homeowner approval\" — nothing is scheduled or billed until they say yes. If they approve by phone instead, you can move it forward yourself with the \"Owner approved (I called)\" button."
      },
      {
        "h": "Print a service QR sticker",
        "items": [
          "Under \"Print a service QR sticker,\" search a property by street address and pick it.",
          "Journey generates that property’s QR code (a link to its own request page).",
          "Click \"Open full-size to print\" and put the sticker on the equipment. Anyone at that address who scans it opens a request page already tied to their property."
        ]
      },
      {
        "h": "Good to know",
        "body": "Everything is scoped to the selected organization. The Active view shows requests still to handle; approved and declined ones move to the History tab, where they stay on record so you can look back at what was requested and how it was resolved."
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
      "who is calling"
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
        "h": "The eight things it watches",
        "items": [
          "New service requests — customer requests waiting to be reviewed and booked → opens Service Requests.",
          "Jobs to schedule — approved jobs not yet on the board → opens the Calendar.",
          "Needs dispatch — scheduled jobs with no technician assigned → opens the Dispatch Map.",
          "Parts in — schedule return — a staged return visit whose part has arrived (marked Delivery Verified in Jobs Management) and can now be booked → opens the Calendar.",
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
  }
]

export const ROUTE_HELP = {
  "/dispatch": "dispatch-station",
  "/call": "call-console",
  "/call-log": "call-log",
  "/service-requests": "service-requests"
}
