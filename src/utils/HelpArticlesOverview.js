// Help articles — Overview section. One file per section so edits stay local.
// Shape: export const HELP_ARTICLES (array) + ROUTE_HELP (route -> article id).
// Aggregated by ./HelpArticles.js. Keep article ids unique across ALL section files.

export const HELP_ARTICLES = [
  {
    "id": "home-dashboard",
    "title": "HOME (Command Dashboard)",
    "area": "Overview",
    "keywords": [
      "home",
      "dashboard",
      "command",
      "kpi",
      "kpis",
      "board",
      "tiles",
      "at a glance",
      "period",
      "investigate",
      "quincy",
      "customize",
      "arrange",
      "add kpi",
      "gross margin",
      "on-time",
      "sales"
    ],
    "purpose": "HOME is your daily command board — the whole business at a glance for one organization and one time window. It is read-only reporting, not a place you edit records: every tile is a live number that links straight to the page where you act on it. A manager can run the entire morning review from here.",
    "sections": [
      {
        "h": "What it is for",
        "body": "Open HOME to answer one question fast: how is the business doing right now? The Quincy Brief across the top gives a plain-English summary; the KPI tiles below give the vital signs — money, jobs, margins, pipeline, and fleet — each drawn as the right visual for its data (a single number, a gauge against a goal, a bar or column chart, or a flags list). You do not fix anything on this page; you read a signal, then click into the page behind it."
      },
      {
        "h": "Step 1 — choose what you are looking at",
        "items": [
          "Check the Viewing-Organization pill (top-left) shows the right company. Platform owners can click the pill to switch to any client org; the whole board reloads for that company and your choice is remembered next time.",
          "Set the Period dropdown (top-right): This month (default), Last 30 days, This quarter, or Year to date. Every date-based tile re-queries the instant you change it.",
          "Four tiles are point-in-time by design and do NOT follow the period: Recurring revenue and Outstanding estimates (both \"as of now\"), Payroll % of sales (always last 6 months), and Unusual fuel / mileage flags (current)."
        ]
      },
      {
        "h": "Step 2 — read the tiles",
        "items": [
          "Sales — invoiced revenue for the period. Recurring revenue — agreement run-rate per month. Outstanding estimates — unsold pipeline value.",
          "Jobs / tech / day — completed jobs per technician per working day. Gross margin — a gauge with a 60% floor line. On-time arrival — a gauge with a 90% floor (within 15 min of schedule).",
          "Revenue by tech and Revenue by job type — ranked bar charts. Payroll % of sales — a column chart against a 20% ceiling. Estimates: presented vs. sold — pipeline conversion for the period.",
          "Inventory variance $ by truck holder — posted count adjustments by who holds the stock. Unusual fuel / mileage flags — fleet anomalies to chase."
        ]
      },
      {
        "h": "Step 3 — act on a number",
        "items": [
          "Click a tile body to drill to the page behind it — Sales and Gross margin open Invoices; Outstanding and Presented-vs-sold open Estimates; Jobs/tech/day and On-time open Jobs Management; Recurring opens Maintenance Agreements; Payroll opens Payroll. A small ↗ marks a tile that drills.",
          "Click a single bar on Revenue by tech or by job type to open Jobs pre-filtered to exactly that technician or job type.",
          "Click the ✦ (Investigate) icon on any tile for an AI read of that number for this org and period — what it is saying, likely drivers, and what to do next."
        ]
      },
      {
        "h": "Customizing the board (managers/owners only)",
        "items": [
          "These controls appear only for a super-admin or anyone with the \"customize dashboard\" permission; everyone else sees the board read-only.",
          "+ Add KPI — pick a base measure (Revenue, Gross profit, Estimate value, Jobs completed) and a breakdown (total, by tech, by job type, by customer, by month, by status); the builder picks the right chart and adds the tile to the end of the board.",
          "Arrange — drag any tile by its handle to reorder, and use the − S/M/L + control to resize (single-value tiles cap at M, charts go to L). Every change saves automatically; click Done arranging when finished.",
          "Remove a tile with its × ; Reset to default restores the standard 12-tile board (that button only shows once an org has customized). The factory default can never be lost."
        ]
      },
      {
        "h": "Good to know",
        "body": "Layouts are saved per organization, so each client company keeps its own board. The board fetches fresh data whenever you change org, period, or a widget. Use the \"Jump to a section\" chips at the bottom to leave HOME for a major work area (Operations, Financials, Admin, Inventory, Fleet, Tools, Marketing, HR, Payroll) — modules your org does not own will return you to Home."
      }
    ]
  },
  {
    "id": "train-station",
    "title": "Train Station",
    "area": "Overview",
    "keywords": [
      "train station",
      "hub",
      "home",
      "start",
      "office",
      "needs a hand",
      "handled",
      "alerts",
      "off",
      "edit",
      "briefing",
      "roll-up"
    ],
    "purpose": "The Train Station is the office’s home hub — a personalized roll-up of every area that might need attention (Dispatch, Jobs & Customers, Maintenance, Permitting, and refrigerant compliance) in one list, so whoever opens it can see what is waiting and go straight to it.",
    "sections": [
      {
        "h": "What it is for",
        "body": "This is the first screen to open each day. Instead of checking each area one by one, the Train Station gathers every open item across the office into a single board. It rolls up the individual stations, so clearing something in Dispatch or Jobs also clears it here — the counts always agree."
      },
      {
        "h": "Reading the board",
        "items": [
          "The banner tells you how many things need a hand across how many areas (or that you are all caught up), with a Quincy \"Today’s briefing\" beside it.",
          "Needs a hand — a tile for each area with work waiting: its name, a count, a one-line description, and an \"Open …\" action. Click a tile to jump to the screen that clears it.",
          "Handled — areas currently at zero rest here as green pills. A tile jumps back up the moment it has something."
        ]
      },
      {
        "h": "Tailoring it to your company (Edit)",
        "items": [
          "Click Edit to show an Alerts / Off switch on each area.",
          "Alerts — watch this area and show its work here. Off — another team owns it; you will still reach it from the menu, it just won’t clutter this hub.",
          "The choice is saved per company, so each office’s Station reflects how it divides the work."
        ]
      },
      {
        "h": "Good to know",
        "body": "The Train Station rolls up the \"start\" areas (Dispatch, Jobs & Customers, Maintenance, Permitting, refrigerant compliance). Inventory and Marketing have their own hubs and do not appear here. Everything is scoped to your organization."
      }
    ]
  }
]

export const ROUTE_HELP = {
  "/home": "home-dashboard",
  "/": "home-dashboard",
  "/train-station": "train-station"
}
