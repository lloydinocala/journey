// Help articles — Financials section. One file per section so edits stay local.
// Shape: export const HELP_ARTICLES (array) + ROUTE_HELP (route -> article id).
// Aggregated by ./HelpArticles.js. Keep article ids unique across ALL section files.

export const HELP_ARTICLES = [
  {
    "id": "invoices",
    "title": "Invoices",
    "area": "Financials",
    "keywords": [
      "invoice",
      "invoices",
      "bill",
      "billing",
      "payment",
      "record payment",
      "receive payment",
      "balance",
      "unpaid",
      "void",
      "archive",
      "send invoice",
      "paid",
      "reminder",
      "diagnosis",
      "ledger"
    ],
    "purpose": "Invoices is where you bill customers for completed work and get paid — the master list of what has been billed, what is still owed, and every payment recorded against it.",
    "sections": [
      {
        "h": "What it is for",
        "body": "This is the money side of the business: send bills, chase what is owed, and record payments accurately. Payments here are real ledger entries (not just a flag), so balances stay honest and the money shows up in cash reports."
      },
      {
        "h": "Finding and reading invoices",
        "items": [
          "Filter by All / Unpaid / Paid, search by invoice #, job #, or customer, and toggle Show archived. The header shows how many invoices and the total dollars outstanding.",
          "A completed job whose invoice is still unpaid is flagged in yellow so it stands out.",
          "Columns cover the trip charge and line items, the money breakdown, technicians, profit, and a click-to-edit Diagnosis (editing it updates the job’s diagnosis everywhere). Use Columns to choose fields and Export CSV to pull the list."
        ]
      },
      {
        "h": "Sending and collecting",
        "items": [
          "Send / Resend emails the invoice with a pay link; View opens the customer’s copy; Edit opens the invoice to change it.",
          "For a sent, overdue invoice, AI reminder drafts a short, courteous payment reminder for you to review and send.",
          "Inside the invoice (Edit), an \"✨ AI: draft work summary\" helper turns the line items into a short, plain-language recap of the work performed for the customer. Review and edit it, then paste it into the invoice or a thank-you note — it never sends on its own and never states a total.",
          "Mark Paid opens Record Payment — enter the actual amount, method (cash/check/card/other), check number, and any note. It posts to the payment ledger and settles the balance. Receive Payment (top of the page) records a payment not tied to a single row.",
          "Recorded something wrong? Unmark Paid reverses it with an offsetting ledger entry, keeping the audit trail intact."
        ]
      },
      {
        "h": "Archiving and voiding",
        "items": [
          "Archive hides an invoice from the main list but keeps it (Show archived + Unarchive brings it back).",
          "Void (admins, with a required reason) removes the invoice so it stops counting and its job can be deleted. It cannot be undone from the app, and voiding a paid invoice does not refund the customer — handle refunds separately."
        ]
      },
      {
        "h": "Good to know",
        "body": "An invoice’s balance is its total minus what has been paid. Sent-but-unpaid invoices age on the Operations Dashboard; a completed job with no invoice shows there under \"Completed, Not Invoiced.\" Everything is scoped to the selected organization (platform owners get a picker)."
      }
    ]
  },
  {
    "id": "payroll",
    "title": "Payroll",
    "area": "Payroll",
    "keywords": [
      "payroll",
      "pay",
      "paycheck",
      "gross",
      "net",
      "taxes",
      "set aside",
      "withholding",
      "prepare payroll",
      "deductions",
      "benefits",
      "workers comp",
      "tax center",
      "classification",
      "w-2",
      "1099",
      "year end",
      "state rules"
    ],
    "purpose": "Run payroll from recorded hours and always know the taxes to set aside. Payroll can stand alone for smaller shops or comes included with HR.",
    "sections": [
      {
        "h": "How it flows",
        "items": [
          "Payroll Dashboard — the most recent runs (checks, gross, net) and the tax to set aside, grouped by week.",
          "Prepare Payroll — build a run from captured hours, review each employee, and generate the checks.",
          "Paychecks — the register of checks produced, with details per employee.",
          "Tax Center and Year-End — payroll taxes owed and the W-2 / 1099 wrap-up."
        ]
      },
      {
        "h": "Setup that drives the math",
        "items": [
          "Benefits & Deductions — pre- and post-tax items that adjust each check.",
          "Workers’ Comp — class codes and rates for the comp premium.",
          "Classification Check and State Rules — employee-vs-contractor sanity checks and the state-specific withholding rules."
        ]
      },
      {
        "h": "Good to know",
        "body": "Hours come from Time Clock via Payroll Capture. The set-aside figure is what to reserve for taxes on each run — not a filing; taxes are still remitted through your tax service or accountant."
      }
    ]
  },
  {
    "id": "certified-payroll",
    "title": "Certified Payroll (Prevailing Wage)",
    "area": "Payroll",
    "keywords": [
      "certified payroll",
      "prevailing wage",
      "davis-bacon",
      "davis bacon",
      "wh-347",
      "statement of compliance",
      "classification",
      "wage determination",
      "government",
      "public works",
      "project"
    ],
    "purpose": "Weekly certified payroll for prevailing-wage (Davis-Bacon) government jobs — per-worker hours by classification, auto-priced from the wage determination, producing the WH-347 and Statement of Compliance.",
    "sections": [
      {
        "h": "How to use it",
        "items": [
          "Projects — set up each public-works project and attach its wage determination.",
          "Prevailing Wage — the classifications and wage/fringe rates the hours are priced against.",
          "Certified Payroll — pick a project and week-ending Friday, enter each worker’s daily hours by classification, and the app prices straight time and overtime from the determination."
        ]
      },
      {
        "h": "Good to know",
        "body": "Output is the WH-347 with its Statement of Compliance, ready to file for the week. Workers and their base info come from the Employees record in HR."
      }
    ]
  },
  {
    "id": "projects-progress-billing",
    "title": "Projects (Progress Billing)",
    "area": "Financials",
    "keywords": [
      "project",
      "projects",
      "progress billing",
      "draw",
      "draws",
      "draw schedule",
      "retainage",
      "contract",
      "billing mode",
      "milestone",
      "large job",
      "phased"
    ],
    "purpose": "Projects group the jobs of one big, multi-visit contract under a single contract total and bill it in stages — draws — instead of one invoice at the end. Each draw becomes its own invoice, with retainage held back and released when you are ready.",
    "sections": [
      {
        "h": "What it is for",
        "body": "A system changeout or a phased install is not one trip and one bill — it is a contract you collect against as the work progresses. A Project holds the whole contract: its total price, the jobs that belong to it, and a schedule of draws (a deposit, a start-of-work draw, a completion draw, and so on). You bill a draw when its milestone is reached, and the project tracks what has been contracted, billed, paid, and still remaining."
      },
      {
        "h": "Setting up a project",
        "items": [
          "Open Projects and open (or create) a project, then set its name, Contract Total, Retainage %, and billing mode. Jobs of a project type attach to it automatically; from a project you can also attach or detach jobs, and use + Add to create a new job already linked to this project.",
          "The rollup tiles across the top always show Contract, Estimated, Billed, Paid, Remaining, and Retainage held, so you can see the financial state of the whole contract at a glance."
        ]
      },
      {
        "h": "Billing a draw",
        "items": [
          "Build the draw schedule — add each draw with a label and either a percent of the contract or a dollar amount (a 10% deposit, 40% on start, and so on).",
          "Press Bill on a draw to generate its invoice. Journey creates a normal INV-#### invoice for the draw amount net of retainage, with a line item describing the draw, so it collects and pays like any other invoice.",
          "Retainage is held back on each draw automatically; when the job is accepted, Release retainage bills the held amount as its own draw invoice."
        ]
      },
      {
        "h": "Good to know",
        "body": "Draw invoices are ordinary invoices — they appear on the Invoices page, age on the Operations Dashboard, and accept payment the same way. Closing a project keeps it for the record. Everything is scoped to the selected organization."
      }
    ]
  }
]

export const ROUTE_HELP = {
  "/invoices": "invoices",
  "/projects": "projects-progress-billing",
  "/rewards/payroll/prepare": "payroll",
  "/rewards/payroll/paychecks": "payroll",
  "/rewards/payroll/tax-center": "payroll",
  "/rewards/payroll/classification": "payroll",
  "/rewards/payroll/deductions": "payroll",
  "/rewards/payroll/workers-comp": "payroll",
  "/rewards/payroll/state-rules": "payroll",
  "/rewards/payroll/year-end": "payroll",
  "/rewards/payroll": "payroll",
  "/rewards/certified/projects": "certified-payroll",
  "/rewards/certified/wage-rates": "certified-payroll",
  "/rewards/certified": "certified-payroll"
}
