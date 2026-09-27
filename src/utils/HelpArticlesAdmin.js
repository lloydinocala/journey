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
      "grant",
      "manager",
      "office manager",
      "field manager",
      "warehouse manager",
      "department",
      "stack",
      "combine"
    ],
    "purpose": "Team is your people; Roles & Tags controls what each of them can do.",
    "sections": [
      {
        "h": "How to use it",
        "items": [
          "Team lists your users and lets you add or manage them.",
          "Roles & Tags defines roles (tags) and the granular permissions attached to each one — who can see the Maintenance Dashboard, void invoices, and so on.",
          "Assign a person one or more tags to grant them those permissions."
        ]
      },
      {
        "h": "Build a separate tag for each real role",
        "items": [
          "Every tag is independent and carries its own set of permissions, so you can make one for each real job — for example Office Mgr, Field Mgr, and Warehouse Mgr — and give each only what that role needs. There is no single fixed \"manager\" role you are stuck with.",
          "Create one with New tag: give it a name, pick a department, then check the permissions it should have and Save.",
          "The department (Admin, Field, Shop, Front Office, Back Office) is only a grouping label on this screen — it does not limit which permissions you can grant. A Warehouse Mgr can have full inventory and purchasing power with no field access, and a Field Mgr the reverse."
        ]
      },
      {
        "h": "Permissions add up across tags",
        "items": [
          "A person's access is the sum of every tag they hold. Give someone only \"Field Mgr\" and they get exactly that set; add \"Bookkeeping\" on top and they get both combined.",
          "So you can build a manager as one focused tag, or assemble one from a base tag plus add-ons — whichever is easier to keep straight.",
          "You can keep a broad manager tag, narrow it, or stop using it once the specific tags cover your people."
        ]
      },
      {
        "h": "Good to know",
        "body": "Saving a tag replaces its permissions with exactly what is checked at that moment, so glance over the boxes before you save. On-call technicians can also be granted extra permissions automatically, only for their on-call window — see the On-Call Schedule."
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
      "capture",
      "device",
      "phone",
      "computer",
      "reset device",
      "security",
      "locked"
    ],
    "purpose": "Time Clock is where staff clock in and out; Payroll Capture pulls those hours together for payroll.",
    "sections": [
      {
        "h": "How to use it",
        "body": "Staff clock in and out on the Time Clock. Payroll Capture gathers the recorded hours so you can run payroll from them. (Sign-In Log is separate — that tracks app access, not work hours.)"
      },
      {
        "h": "Device security — one computer + one phone",
        "body": "Clocking in and opening the app bind to the device you're on. Each person can be signed in on at most one computer and one phone at the same time — never two of the same kind. That keeps the field app one-per-person, so a login can't be shared to clock someone else in, while a manager can still work a desktop and a phone at once. Opening a second computer (or a second phone) locks the first with a \"Locked for security\" screen. The device-security panel on this page logs new devices, switches, and rapid back-and-forth switching (flagged red), and an org admin can reset an employee's device here when they replace a phone. Only the platform owner is exempt."
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
        "body": "Use it to review app access. This is about signing into the software, not clocking in for work — for hours worked, see Time Clock. Note the sign-in rule: each person can be signed in on only one computer and one phone at a time; a second device of the same kind locks the first, and those device switches are detailed on the Time Clock's device-security panel."
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
      "compliance",
      "roster",
      "login accounts",
      "add employee",
      "add from logins"
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
        "h": "Getting your roster in fast",
        "items": [
          "Employees are separate from login accounts on purpose — a person can be an employee with no login (a seasonal helper), or a login you don't score. Every HR page (Scorecards, Skills, Certifications, Time Off) lists employees, so build the roster first or those pages look empty.",
          "Fastest way: on Employees, click \"+ From login accounts\", check the people who already sign in, and Add selected — each becomes an active employee linked to their login in one step. Accounts already linked are greyed out so you can't double-add.",
          "Or click \"+ New Employee\" to add someone by hand, with an optional login link — use this for staff who don't sign in.",
          "Either way, open the new record's Edit to fill in pay, role, and hire date. The moment an employee exists, they appear everywhere else in HR."
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
    "id": "employees",
    "title": "Employees (HR Roster)",
    "area": "Human Resources",
    "keywords": [
      "employees",
      "roster",
      "add employee",
      "login accounts",
      "add from logins",
      "direct deposit",
      "pay",
      "hire date",
      "staff",
      "headcount",
      "ssn"
    ],
    "purpose": "The people roster every HR page draws from — add staff, link them to logins, and hold pay, tax, and direct-deposit details securely.",
    "sections": [
      {
        "h": "Employees are separate from logins",
        "body": "An employee record and a sign-in account are two different things, on purpose: someone can be an employee with no login (a seasonal helper), or a login you don't track as an employee. Every HR page — Scorecards, Skills, Certifications, Time Off — lists employees, so if this roster is empty those pages look blank. Build it first."
      },
      {
        "h": "Two ways to add people",
        "items": [
          "“+ From login accounts” — the fast path. Check everyone who already signs in and add them all at once; each becomes an active employee linked to their login. Accounts already linked are greyed out so you can't double-add.",
          "“+ New Employee” — add someone by hand, with an optional login link. Use this for staff who don't sign in."
        ]
      },
      {
        "h": "Fill in the details (Edit)",
        "body": "Open a record's Edit to set pay type and rate, hire date, role, and — under Secure info (encrypted) — the Direct Deposit routing and account numbers and SSN. Secure fields are stored encrypted; only office roles can save or reveal them, and employees never see them. Deactivating someone keeps their history; use the Show inactive toggle to see past staff."
      }
    ]
  },
  {
    "id": "scorecards",
    "title": "Employee Scorecards",
    "area": "Human Resources",
    "keywords": [
      "scorecard",
      "scorecards",
      "metrics",
      "performance",
      "review",
      "quarter",
      "quarterly",
      "technician",
      "rating",
      "goals",
      "minimum",
      "customer experience",
      "productivity",
      "professionalism",
      "workmanship"
    ],
    "purpose": "Fair, numbers-based quarterly performance scorecards — you define the metrics, record each quarter's values, and get an evidence-grounded review draft. Turn it on in HR Settings.",
    "sections": [
      {
        "h": "What it is for",
        "body": "A quarterly performance record built on real numbers, not opinions. You choose the metrics that matter, record each person's results per quarter, and every quarter is kept as a permanent history. It's built to be fair and defensible: cells that miss the accepted minimum are highlighted, and last quarter shows next to this one so trends are plain."
      },
      {
        "h": "Set up your metrics (Manage metrics)",
        "items": [
          "Click “Manage metrics”. Add a metric with a Category (Customer experience, Productivity, Professionalism, Workmanship, or your own via “Other”), a name, a unit, and a Goal direction — higher is better, lower is better, or just track the actual value.",
          "Set the Minimum accepted rating where one applies; results under it get flagged.",
          "In a hurry, click “Load starter metrics” to drop in a standard set of 11 you can edit, instead of starting blank. Edit or Archive any metric later."
        ]
      },
      {
        "h": "Record a quarter",
        "items": [
          "Pick the Employee, Quarter, and Year, then click “Record / edit [quarter]”, enter each metric's value, and Save.",
          "Cells that miss the minimum are highlighted; the prior quarter shows beside the current one. Nothing is overwritten — use the quarter/year selectors to review any past quarter."
        ]
      },
      {
        "h": "Manager notes & goals — and the fair AI draft",
        "body": "Write a short summary and next-quarter goals; the employee sees these on their scorecard. Click “✦ Draft summary from the metrics” and the assistant writes a balanced summary using ONLY the numbers you recorded — it credits genuine strengths and names shortfalls even-handedly, notes improvement or decline versus last quarter, and never invents a figure or speculates about the person's character, motives, or anything personal. It's a draft: review and edit before saving."
      },
      {
        "h": "Good to know",
        "body": "Scorecards must be turned on in HR Settings, and the page lists people from your Employees roster — add them there first. The whole point is honesty: the review is grounded strictly in recorded numbers, so a scorecard can back up a raise, a coaching conversation, or a hard decision with evidence rather than opinion."
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
  "/rewards/employees": "employees",
  "/rewards/job-descriptions": "hr",
  "/rewards/hiring": "hr",
  "/rewards/onboarding": "hr",
  "/rewards/discipline": "hr",
  "/rewards/separations": "hr",
  "/rewards/certifications": "hr",
  "/rewards/skills": "hr",
  "/rewards/scorecards": "scorecards",
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
