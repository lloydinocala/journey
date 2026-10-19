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
      "page settings",
      "gear",
      "my preferences",
      "starting page",
      "call handling",
      "when a call comes in for me",
      "company",
      "logo",
      "branding",
      "time zone",
      "jobs & customers",
      "tasks",
      "sales tax",
      "job types",
      "routing",
      "dispatch",
      "business hours",
      "holidays",
      "online booking",
      "service requests",
      "qr",
      "permitting",
      "workforce",
      "pay rates",
      "pay period",
      "financials",
      "stripe",
      "collections",
      "quickbooks",
      "admin only"
    ],
    "purpose": "Settings is one page with a section for each main menu heading. My Preferences applies only to you; every other section is for admins and applies to the whole company. Any page that has settings has a ⚙ Page Settings button that jumps straight to its section.",
    "sections": [
      {
        "h": "Finding the setting you need",
        "items": [
          "1. From any page that has settings, click ⚙ Page Settings in the top bar. Settings opens at that page’s section, highlighted.",
          "2. Make your change and click that setting’s Save button (some dropdowns and checkboxes save as soon as you change them and show \"Saved ✓\").",
          "3. Click \"← Back to [page]\" at the top to return to where you were.",
          "Or open Settings directly and click a heading in the left-hand list to jump to that section."
        ]
      },
      {
        "h": "Who can change what",
        "items": [
          "My Preferences is open to everyone and only affects you.",
          "Every other section is marked \"Admin only\". If you are not an admin, it shows 🔒 in the left list and reads \"Only an admin can change these settings.\""
        ]
      },
      {
        "h": "What is in each section",
        "items": [
          "My Preferences: \"Your starting page\" (where the app opens when you sign in) and \"When a call comes in for me\" (how the receptionist handles calls meant for you — see below).",
          "Company: Logo, App Icon, Brand colors, Business contact info, and Time zone.",
          "Jobs & Customers: Tasks (how long completed tasks stay before they archive; default 3 weeks, or \"Always show\"), Sales tax, and Job types.",
          "Dispatch: Business hours (with holidays), Online booking rules, and Service requests (QR stickers) — how many days before finished requests archive (default 30).",
          "Permitting: \"Track installation permits\". When on, a Permit section appears on System Estimates and permits show on the customer profile.",
          "WorkForce: Call handling for the team, Employee pay rates, and Payroll pay period. Roles and team members are managed on the Roles & Tags and Team pages.",
          "Financials & Payments: Payments (connect your Stripe account so card payments go straight to you), Collections & reminders, and QuickBooks.",
          "Inventory Central: a link to the separate Inventory Settings page."
        ]
      },
      {
        "h": "When a call comes in for me",
        "items": [
          "1. In My Preferences, pick your First choice: Transfer the call to me if I’m available, Forward the call to my cell phone, Take a message, or Book an appointment on my calendar.",
          "2. Pick \"If that isn’t possible\" (your fallback), or leave \"— nothing else —\".",
          "3. If you chose forwarding, enter the cell phone number to forward to.",
          "4. Add optional notes for the receptionist, then click Save.",
          "Admins can set this for each office or management team member in WorkForce → \"Call handling for the team\". Anyone not set defaults to \"Take a message\"."
        ]
      },
      {
        "h": "Job types & routing",
        "items": [
          "Job types fill the Type dropdown when creating a job, and each type’s settings decide how the job behaves: its estimate format (service/repair or a full system proposal), default pricebook, and billing behavior.",
          "Add a Commercial type and set its pricebook to Commercial Flat Rate when you do commercial work.",
          "Turn a type off instead of deleting it if past jobs still use it.",
          "A job type can be linked to a Checklist; any checklist you create shows in the dropdown right away."
        ]
      },
      {
        "h": "Good to know",
        "body": "Platform owners pick the organization at the top (\"Viewing organization\"). Settings changes apply right away for everyone in the organization, except My Preferences, which is just yours."
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
      {"h": "Measures by position, and the company average", "items": ["Manage metrics → \"Which measures apply to each position\": tick the measures that count for each job description. Measures that don't apply are greyed out on that person's scorecard and left out of the count. A position with nothing ticked uses every measure.", "Set each employee's position on their Employee File.", "The Company avg column shows the average across all employees for that measure this quarter, with ▲ above / ▼ below. Comparisons are always to the team average — never to another individual. Employees see the same comparison in their own records."]},
      {
        "h": "What it is for",
        "body": "A quarterly performance record built on real numbers, not opinions. You choose the metrics that matter, record each person's results per quarter, and every quarter is kept as a permanent history. It's built to be fair and defensible: cells that miss the accepted minimum are highlighted, and last quarter shows next to this one so trends are plain."
      },
      {
        "h": "Set up your metrics (Manage metrics)",
        "items": [
          "Click “Manage metrics”. Add a metric with a Category (Customer experience, Productivity, Responsible revenue generation, Professionalism, Workmanship, or your own via “Other”), a name, a unit, and a Goal direction — higher is better, lower is better, or just track the actual value.",
          "Set the Minimum accepted rating where one applies; results under it get flagged.",
          "In a hurry, click “Load starter metrics” to drop in a standard set of 11 you can edit, instead of starting blank. Edit or Archive any metric later.",
          "Or pick from the metric catalog: under Manage metrics, tick the ones you want and click Add. A green “Journey can source” tag means Journey already holds the data (jobs, invoices, estimates, time clock, certifications); a grey “You enter” tag means you supply the number. Automatic value-fill for the sourced metrics is rolling out, so until a metric is wired you still enter its value by hand."
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
          "Marketing Center — the KPIs: channels, active campaigns, drafts awaiting your yes, leads, and review requests.",
          "Approval Queue — AI-drafted posts and messages that wait for your approval before anything goes out. Nothing publishes on its own.",
          "Channels & Assets — the built-in and custom channels you market through, and the brand assets used.",
          "Reviews — review requests and your reputation. Reviews are the top contractor-marketing lever: a request goes out when a job is marked complete."
        ]
      },
      {
        "h": "Good to know",
        "body": "The customer review link a request points to is your per-organization Google review link, set in Settings. Drafts always wait for a person — the Marketing Center leads with anything sitting in the approval queue."
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
  },
  {
    "id": "team-communications",
    "title": "Team Communications",
    "area": "WorkForce",
    "keywords": [
      "team communications",
      "call messages",
      "take a call",
      "take a call for",
      "call for a team member",
      "message",
      "phone message",
      "transfer",
      "forward",
      "appointment",
      "receptionist",
      "notification",
      "desktop notification",
      "badge",
      "mark handled",
      "reopen",
      "text archive",
      "call handling"
    ],
    "purpose": "Team Communications (under WorkForce) is where calls taken for team members are logged and delivered: messages, appointment requests, and notes about transferred or forwarded calls. Each person follows their own call instructions, gets notified, and works their own inbox. The Text Archive lives here too.",
    "sections": [
      {
        "h": "Step 1 — everyone sets how their calls are handled",
        "items": [
          "1. Go to Settings → My Preferences → \"When a call comes in for me\".",
          "2. Choose a First choice and a fallback (\"If that isn’t possible\"): transfer the call, forward it to your cell, take a message, or book an appointment.",
          "3. Enter your cell number if you chose forwarding, add any notes for the receptionist, and click Save.",
          "Admins can set this for the whole team in Settings → WorkForce → \"Call handling for the team\". Anyone not set defaults to \"Take a message\"."
        ]
      },
      {
        "h": "Step 2 — taking a call for someone",
        "items": [
          "1. Click \"📞 Take a call for…\" (top of this page), or \"📞 Call for a team member\" on the Call Console.",
          "2. Pick who the call is for. Their instructions appear: first choice, what to do if that is not possible, any cell number, and their notes.",
          "3. Click what you did: Transfer, Forward to cell, Take a message, or Book appointment. ★ marks their first choice.",
          "4. Enter the caller’s name and phone. For a message, type the message. For an appointment, type what it is about and pick the date and time.",
          "5. Tick Urgent if it cannot wait.",
          "6. Click \"Send message\", \"Book & notify\", \"Log transfer & notify\", or \"Log forward & notify\".",
          "A message or appointment needs the caller’s name or phone; a message also needs the message text."
        ]
      },
      {
        "h": "What the person receives",
        "items": [
          "The 📨 button in their top bar turns red and shows how many of their messages are not yet handled. Clicking it opens this page. The count goes down as they click \"Mark handled\".",
          "A desktop notification pops up for each new message while Journey is open (marked URGENT when ticked). The browser asks for permission the first time you click the 📨 button; allow it to get pop-ups.",
          "New messages are checked about every 30 seconds."
        ]
      },
      {
        "h": "Working your inbox",
        "items": [
          "My call messages: calls taken for you. Everyone: all messages for the whole team (shown to admins, reception, and dispatch).",
          "Each card shows the type (Message, Appointment request, Call transferred, Call forwarded), the caller and a \"call back\" link, when it was taken and by whom, the appointment time (📅), and the message. Urgent cards have a red edge.",
          "1. Handle the call, then click \"Mark handled\". It drops off the list.",
          "2. Tick \"Show handled\" to see handled messages again; click Reopen to put one back on the list.",
          "The Text Archive button opens customer text threads."
        ]
      },
      {
        "h": "Current limits",
        "items": [
          "Transfers and forwards are done on your phone for now. Journey records them and notifies the person; this becomes one click once the phone system is connected.",
          "A booked appointment shows in the person’s messages. It is not added to the Calendar yet."
        ]
      },
      {
        "h": "Good to know",
        "body": "Find it under WorkForce → Team Communications, with Call Messages and Text Archive underneath. Everything is scoped to your organization."
      }
    ]
  },
  {
    "id": "hr-records",
    "title": "Employee Files, Discipline, Separations & Time Off",
    "area": "Human Resources",
    "keywords": [
      "employee file",
      "personnel file",
      "discipline",
      "write-up",
      "rescind",
      "override",
      "separation",
      "termination",
      "reinstate",
      "archive",
      "time off",
      "pto",
      "approve time off",
      "out",
      "dispatch",
      "skills matrix",
      "classification",
      "shared with employee",
      "my records",
      "history",
      "print for signature"
    ],
    "purpose": "How Journey keeps a clean, legally careful record of each employee — one Employee File per person, discipline and separations with a full change history, and time off that dispatch can see.",
    "sections": [
      {
        "h": "Employee File (HR → Employee Files)",
        "items": [
          "One page per employee pulling together their position, discipline, separations, scorecard, certifications and documents.",
          "Set the employee's Position (job description) here — it decides which scorecard measures count for them.",
          "Each discipline record, separation and document has a Shared / Hidden switch. Shared items appear in the employee's own records (My Records → My File / Documents). Scorecards and certifications always show to the employee.",
          "Medical, drug-test and leave (FMLA) records do not belong in the Employee File — keep them in a separate confidential file."
        ]
      },
      {
        "h": "Discipline",
        "items": [
          "Click a record to open it: details, improvement plan, who issued it, and its full history.",
          "Print for signature — a printable notice with an acknowledgment statement and lines for the employee, supervisor and a witness (if the employee declines to sign). Signing confirms receipt, not agreement.",
          "Edit… — change the record; you must give a reason, and the original wording is kept in the history.",
          "Override / rescind… — voids the action with a reason. It stays on file marked Rescinded and stops counting as active discipline (its follow-up no longer flags on the HR Dashboard).",
          "Delete… — with a reason. The record is hidden but kept (marked Deleted) so retention rules are still met; Restore brings it back. Tick Show rescinded & deleted to see them."
        ]
      },
      {
        "h": "Separations",
        "items": [
          "The reason is a single choice from a behavior-only list (resignation, no-call/no-show, attendance, insubordination, policy violation, job abandonment, layoff, not specified). There are deliberately no competency or accusation reasons.",
          "Row buttons: 🖨 print the official record, Archive / Unarchive, Delete… (with a reason, kept as Deleted), and Add to file (share with the employee).",
          "Open a record for Edit… (with reason) and Reinstate employee… (with reason) — reinstating marks the separation Reinstated and makes the employee active again.",
          "Views: Current, Archived, and All (including deleted)."
        ]
      },
      {
        "h": "Time off",
        "items": [
          "Employees request time off in My Records → Time off (in the field app: My Records in the jobs header).",
          "Settings → WorkForce → Time off: turn \"Time-off requests need approval\" on or off. Off = requests are approved automatically.",
          "When approval is on, people with the Approve time off permission (Owners and Supervisors tags and field supervisors by default — change it on Roles & Tags) get each request in their Agent Inbox and approve or deny it on HR → Time Off.",
          "Approved time off shows on the Dispatch Station and the Calendar as 🌴 Out, and Journey warns you if you try to assign a job to someone who's out that day. The record itself stays in HR.",
          "Sending approved time-off hours into payroll arrives with the upcoming Payroll update."
        ]
      },
      {
        "h": "Skills Matrix and job classifications",
        "items": [
          "Skills run down the side and employees across the top. Everyone active on the Team appears — Journey creates a basic HR record for anyone who didn't have one (fill in their pay on Employees).",
          "Job Descriptions: Classification is now a dropdown of common HVAC roles, plus \"+ Add new classification…\" for your own."
        ]
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
  "/rewards/employee-file": "hr-records",
  "/rewards/job-descriptions": "hr",
  "/rewards/hiring": "hr",
  "/rewards/onboarding": "hr",
  "/rewards/discipline": "hr-records",
  "/rewards/separations": "hr-records",
  "/rewards/certifications": "hr",
  "/rewards/skills": "hr-records",
  "/rewards/scorecards": "scorecards",
  "/rewards/documents": "hr",
  "/rewards/time-off": "hr-records",
  "/rewards/settings": "hr",
  "/rewards": "hr",
  "/marketing/queue": "marketing",
  "/marketing/channels": "marketing",
  "/marketing/reviews": "marketing",
  "/marketing": "marketing",
  "/my": "my-portal",
  "/team-communications": "team-communications"
}
