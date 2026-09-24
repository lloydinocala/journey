// Help articles — Admin section. One file per section so edits stay local.
// Shape: export const HELP_ARTICLES (array) + ROUTE_HELP (route -> article id).
// Aggregated by ./HelpArticles.js. Keep article ids unique across ALL section files.

export const HELP_ARTICLES = [
  {
    "id": "team-roles",
    "title": "Team, Roles & Permissions",
    "area": "Admin",
    "keywords": [
      "team",
      "user",
      "users",
      "staff",
      "role",
      "roles",
      "permission",
      "permissions",
      "access",
      "tags",
      "grant"
    ],
    "purpose": "Team is your people; Roles & Tags controls what each of them can do.",
    "sections": [
      {
        "h": "How to use it",
        "items": [
          "Team lists your users and lets you add or manage them.",
          "Roles & Tags defines roles and the granular permissions attached to them — who can see the Maintenance Dashboard, void invoices, and so on.",
          "Assign a person a role to grant them its permissions."
        ]
      },
      {
        "h": "Good to know",
        "body": "On-call technicians can be granted extra permissions automatically, only for their on-call window — see the On-Call Schedule."
      }
    ]
  },
  {
    "id": "on-call",
    "title": "On-Call Schedule",
    "area": "Admin",
    "keywords": [
      "on-call",
      "on call",
      "after hours",
      "emergency",
      "coverage",
      "supervisor",
      "tech",
      "rotation",
      "permissions",
      "print",
      "calendar",
      "gap"
    ],
    "purpose": "Sets who covers after-hours calls — a month calendar of coverage periods, each pairing an on-call supervisor (calls first) with an optional backup tech. Building periods back-to-back guarantees there is never a coverage gap.",
    "sections": [
      {
        "h": "What it is for",
        "body": "This is where you plan after-hours coverage and see it at a glance. Each period shows as colored bars across the days it covers, so a month of coverage reads like a calendar. It is for visual scheduling (and, where configured, after-hours permissions) — it does not clock anyone in or feed Attendance or Payroll."
      },
      {
        "h": "Adding coverage",
        "items": [
          "Pick the On-Call Supervisor (the first point of contact) and, if you use one, an On-Call Tech as backup.",
          "Set the start, then use a quick-length button (1 day / 1 week / 1 month) or set the end by hand, and click Add period.",
          "A new period’s start defaults to the previous period’s end, so you can lay out weeks of coverage nose-to-nose. If a gap or overlap ever appears, a warning banner shows exactly where."
        ]
      },
      {
        "h": "Editing and navigating",
        "items": [
          "Click a colored bar on the calendar to load that period into the form, then Save changes or Delete period. Use + New to start a fresh one.",
          "Move between months with the arrows / Today. Today’s date is highlighted.",
          "A Calendar / Map toggle sits top-right; the map view is planned (coming soon)."
        ]
      },
      {
        "h": "Printing",
        "items": [
          "Choose Letter or Legal paper, keep \"Fit all rows on one page\" checked, and click Print Calendar for a clean landscape printout with the colors intact — good for the board or the truck."
        ]
      },
      {
        "h": "Good to know",
        "body": "While on call, a technician can be automatically granted the extra permissions needed to handle emergencies — and only for their on-call window (configured in Roles & Permissions). The Operations Dashboard shows an amber banner when on-call is scheduled less than two weeks out, so coverage never quietly lapses. Platform owners get an organization picker."
      }
    ]
  },
  {
    "id": "time-payroll",
    "title": "Time Clock & Payroll",
    "area": "Admin",
    "keywords": [
      "time clock",
      "clock in",
      "clock out",
      "hours",
      "payroll",
      "pay",
      "timesheet",
      "capture"
    ],
    "purpose": "Time Clock is where staff clock in and out; Payroll Capture pulls those hours together for payroll.",
    "sections": [
      {
        "h": "How to use it",
        "body": "Staff clock in and out on the Time Clock. Payroll Capture gathers the recorded hours so you can run payroll from them. (Sign-In Log is separate — that tracks app access, not work hours.)"
      }
    ]
  },
  {
    "id": "sign-in-log",
    "title": "Sign-In Log",
    "area": "Admin",
    "keywords": [
      "sign-in",
      "sign in",
      "sign-out",
      "log",
      "audit",
      "security",
      "access",
      "session"
    ],
    "purpose": "A security audit trail of who signed in and out of Journey and when. Admin-only.",
    "sections": [
      {
        "h": "Good to know",
        "body": "Use it to review app access. This is about signing into the software, not clocking in for work — for hours worked, see Time Clock."
      }
    ]
  },
  {
    "id": "settings",
    "title": "Settings",
    "area": "Admin",
    "keywords": [
      "settings",
      "business hours",
      "holidays",
      "branding",
      "logo",
      "payment terms",
      "organization",
      "preferences"
    ],
    "purpose": "Your organization’s settings — the things you configure once that flow through the whole app.",
    "sections": [
      {
        "h": "What lives here",
        "items": [
          "Business hours and holidays — which drive the slots available on the Calendar and in booking.",
          "Branding shown to customers on estimates and invoices.",
          "Payment terms and other organization-wide preferences."
        ]
      }
    ]
  },
  {
    "id": "announcements",
    "title": "Announcements",
    "area": "Admin",
    "keywords": [
      "announcement",
      "announcements",
      "banner",
      "notice",
      "broadcast",
      "company-wide"
    ],
    "purpose": "Post a message that shows as a banner to everyone in your organization — handy for company-wide notices.",
    "sections": [
      {
        "h": "How to use it",
        "body": "Create an announcement and it appears as a banner across the app for your team until you remove it."
      }
    ]
  },
  {
    "id": "hr",
    "title": "Human Resources",
    "area": "Human Resources",
    "keywords": [
      "hr",
      "human resources",
      "employee",
      "employees",
      "headcount",
      "hiring",
      "onboarding",
      "discipline",
      "separation",
      "termination",
      "certification",
      "license",
      "skills",
      "scorecard",
      "documents",
      "time off",
      "pto",
      "compliance"
    ],
    "purpose": "The people module — headcount, a compliance watchdog for expiring certifications and licenses, and the full employee lifecycle from hire to separation. It’s a paid add-on; turn it on in HR Settings.",
    "sections": [
      {
        "h": "The pieces",
        "items": [
          "HR Dashboard — headcount, tracked certifications, and open compliance flags at a glance, with a QuincyAI briefing.",
          "Employees — the people record: contact, role, pay/tax profile, and history.",
          "Job Descriptions, Hiring, and Onboarding — define roles, track applicants, and run new-hire checklists.",
          "Discipline and Separations — document write-ups and offboarding, so there’s a clean record.",
          "Certifications & Licenses and the Skills Matrix — who holds what (EPA 608, NATE, driver’s licenses) and who can do what.",
          "Scorecards, Documents, and Time Off — performance metrics, stored HR files, and PTO requests and balances."
        ]
      },
      {
        "h": "The compliance watchdog",
        "body": "The dashboard flags expiring or expired certifications and licenses and any open compliance items, most urgent first. The same certification records back the EPA-cert check on the Refrigerant Usage Log — so keeping HR current pays off across the app."
      },
      {
        "h": "Good to know",
        "body": "HR is the fuller module and implies Payroll access. Turn it on and set defaults in HR Settings before entering people."
      }
    ]
  },
  {
    "id": "marketing",
    "title": "Marketing",
    "area": "Marketing",
    "keywords": [
      "marketing",
      "campaign",
      "campaigns",
      "channel",
      "channels",
      "content",
      "draft",
      "approval",
      "queue",
      "review",
      "reviews",
      "reputation",
      "leads",
      "demand",
      "social",
      "google"
    ],
    "purpose": "Demand generation and reputation — channels and campaigns, a queue of AI-drafted content awaiting your approval, leads, and customer review requests. It’s a paid add-on.",
    "sections": [
      {
        "h": "The pieces",
        "items": [
          "Command Center — the KPIs: channels, active campaigns, drafts awaiting your yes, leads, and review requests.",
          "Approval Queue — AI-drafted posts and messages that wait for your approval before anything goes out. Nothing publishes on its own.",
          "Channels & Assets — the built-in and custom channels you market through, and the brand assets used.",
          "Reviews — review requests and your reputation. Reviews are the top contractor-marketing lever: a request goes out when a job is marked complete."
        ]
      },
      {
        "h": "Good to know",
        "body": "The customer review link a request points to is your per-organization Google review link, set in Settings. Drafts always wait for a person — the Command Center leads with anything sitting in the approval queue."
      }
    ]
  },
  {
    "id": "my-portal",
    "title": "My Pay & Benefits",
    "area": "Personal",
    "keywords": [
      "my pay",
      "my benefits",
      "self service",
      "portal",
      "pay stub",
      "paycheck",
      "benefits",
      "tax profile",
      "time off",
      "w-4",
      "direct deposit",
      "personal"
    ],
    "purpose": "Your own self-service page — your pay stubs, benefits, tax and direct-deposit profile, and time off, without going through the office.",
    "sections": [
      {
        "h": "How to use it",
        "body": "Open My Pay & Benefits to see your recent paychecks, your benefits and deductions, your tax/direct-deposit details, and your time-off balance and requests. It shows only your own information."
      }
    ]
  }
]

export const ROUTE_HELP = {
  "/team": "team-roles",
  "/roles": "team-roles",
  "/on-call": "on-call",
  "/time-clock": "time-payroll",
  "/payroll": "time-payroll",
  "/session-log": "sign-in-log",
  "/settings": "settings",
  "/announcements": "announcements",
  "/rewards/employees": "hr",
  "/rewards/job-descriptions": "hr",
  "/rewards/hiring": "hr",
  "/rewards/onboarding": "hr",
  "/rewards/discipline": "hr",
  "/rewards/separations": "hr",
  "/rewards/certifications": "hr",
  "/rewards/skills": "hr",
  "/rewards/scorecards": "hr",
  "/rewards/documents": "hr",
  "/rewards/time-off": "hr",
  "/rewards/settings": "hr",
  "/rewards": "hr",
  "/marketing/queue": "marketing",
  "/marketing/channels": "marketing",
  "/marketing/reviews": "marketing",
  "/marketing": "marketing",
  "/my": "my-portal"
}
