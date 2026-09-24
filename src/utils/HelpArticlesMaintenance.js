// Help articles — Maintenance section. One file per section so edits stay local.
// Shape: export const HELP_ARTICLES (array) + ROUTE_HELP (route -> article id).
// Aggregated by ./HelpArticles.js. Keep article ids unique across ALL section files.

export const HELP_ARTICLES = [
  {
    "id": "maintenance-station",
    "title": "Maintenance Station",
    "area": "Maintenance",
    "keywords": [
      "maintenance station",
      "maintenance",
      "recurring",
      "retention",
      "lapsed",
      "win back",
      "win-back",
      "offers",
      "plans",
      "mrr",
      "signals",
      "briefing"
    ],
    "purpose": "The Maintenance Station is the front board for your recurring-revenue program — everything that needs a hand to keep plans sold, kept, and serviced, in one place. It is the maintenance counterpart to the Dispatch and Jobs & Customers stations.",
    "sections": [
      {
        "h": "What it is for",
        "body": "Open the Maintenance Station to work the plan program the way you work dispatch: read the tiles, clear what needs a hand. It surfaces plans that lapsed, offers awaiting a decision, recent jobs with no plan, filters due to ship, and visits to book — and gives owners the retention and revenue numbers behind them. Access needs the maintenance-dashboard permission."
      },
      {
        "h": "The tiles (Needs a hand / Handled)",
        "items": [
          "Win back lapsed plans — customers who had a plan and have none active now. Its tile opens a Win-back tool right here (it does not navigate away).",
          "Follow up on offers — plans offered, awaiting a decision → opens the maintenance list.",
          "Offer a plan after service — recent jobs at properties with no plan on file → opens the list to review and offer.",
          "Filters to ship — subscription filters due to ship → work these on the Filter Subscriptions page (generate each due order there).",
          "Visits to book — PM visits due to schedule → opens Maintenance Due.",
          "Tiles with work appear under \"Needs a hand\"; tiles at zero rest under \"Handled\" as clickable pills."
        ]
      },
      {
        "h": "Winning back a lapsed plan",
        "items": [
          "Click the \"Win back lapsed plans\" tile to open the tool, then pick a lapsed customer.",
          "Choose a comeback offer (one month free, 10% off the first year, a free first visit, or no incentive — just reach out), edit the pre-filled message, and Send win-back offer.",
          "It emails the customer their plan options with a one-tap re-join link and logs the offer. (Texting this offer is coming soon — email only for now.) They stay lapsed until they actually sign back up."
        ]
      },
      {
        "h": "Owner / Admin view",
        "body": "If you have operational- or owner-metrics access, use the \"Viewing as → Owner / Admin\" toggle to see the numbers behind the work: Retention (the share of ever-active plans that have lapsed, flagged when it climbs), Recurring revenue (monthly and annualized), and Untapped base (properties never offered a plan). It is the same signals your office works, framed as the metrics you watch."
      }
    ]
  },
  {
    "id": "maintenance-dashboard",
    "title": "Maintenance Dashboard",
    "area": "Maintenance",
    "keywords": [
      "maintenance dashboard",
      "mrr",
      "acv",
      "recurring revenue",
      "plans",
      "status",
      "active",
      "lapsed",
      "offered",
      "never offered",
      "opted out",
      "no plan"
    ],
    "purpose": "The Maintenance Dashboard is the full picture of your plan program — recurring-revenue numbers up top and every property sorted by where it stands with a maintenance plan, so you can see who to sell, who to keep, and who to service.",
    "sections": [
      {
        "h": "What it is for",
        "body": "Use it as the daily maintenance worklist and the program’s scoreboard. It answers \"how much recurring revenue do we have?\" and \"which customers should we be talking to about a plan?\" in one screen. Access needs the maintenance-dashboard permission."
      },
      {
        "h": "Reading the numbers",
        "items": [
          "Two stat tiles: Monthly recurring revenue and Annualized contract value (MRR × 12; annual plans are divided into a monthly figure).",
          "Three quick-links jump to Agreements (view/add/edit plans), Maintenance Due (visits to book), and Plan Tiers (define and price plans)."
        ]
      },
      {
        "h": "Working the property list",
        "items": [
          "Five status buckets filter the list when clicked: Active, Offered — not yet accepted, Lapsed, Never offered, Opted out.",
          "The \"Recently completed — still no plan\" panel is your daily \"did we sell it?\" sweep — jobs finished in the last 30 days whose property has no active plan, each flagged Offered — follow up or Not offered yet.",
          "Search by customer or address, and use Group by customer to collapse multiple properties. Each row links to the customer file, or to Visits for an active plan. The list shows up to 200 rows — refine with search or a bucket if you have more."
        ]
      },
      {
        "h": "Good to know",
        "body": "This is a read-and-route board — you act by clicking into a customer, Agreements, or Due. Platform owners get an organization picker."
      }
    ]
  },
  {
    "id": "maintenance-agreements",
    "title": "Maintenance Agreements",
    "area": "Maintenance",
    "keywords": [
      "maintenance agreements",
      "agreement",
      "plan",
      "checkout",
      "stripe",
      "subscription",
      "billing",
      "monthly",
      "annual",
      "cancel",
      "archive",
      "export"
    ],
    "purpose": "Maintenance Agreements is the master list of who is on a plan and the place you sell new ones — create an agreement, send the customer a checkout link, and manage billing, visits, and status over its life.",
    "sections": [
      {
        "h": "What it is for",
        "body": "This is where plans are created and maintained. Selling one produces a payment checkout link you send the customer; once they pay, the plan goes active and its billing runs on its own. Two stat tiles show active agreements and estimated monthly recurring revenue."
      },
      {
        "h": "Creating and selling a plan",
        "items": [
          "Prerequisite: at least one active tier must exist (see Maintenance Tiers) — otherwise the Create button is disabled with a prompt to add tiers first.",
          "Pick the property, tier, and billing (Monthly or Annual), set a start date; a live price preview shows from the tier. Coming from a job card, the property is pre-filled for you.",
          "Click \"Create & Get Checkout Link\" — it creates a pending agreement and a checkout link. Copy the link or Open Checkout and send it to the customer to pay; when they pay, the plan activates."
        ]
      },
      {
        "h": "Managing existing agreements",
        "items": [
          "Filter by status, search by customer or property, show archived, choose columns (remembered), and Export CSV.",
          "Per row: Edit (status, next-visit and last-visit dates, and notes are always editable; tier/billing/price can only change before billing has started — after that, cancel and create a new agreement), Archive/Unarchive, History (billing history), Get Link (for a pending row), and Cancel (stops Stripe billing).",
          "The grid keeps Start Date, Customer, and Property pinned as you scroll sideways."
        ]
      },
      {
        "h": "Good to know",
        "body": "Tier, billing, and price lock once a subscription is billing so what you see can never drift from what Stripe charges. Platform owners get an organization picker."
      }
    ]
  },
  {
    "id": "maintenance-due",
    "title": "Maintenance Due",
    "area": "Maintenance",
    "keywords": [
      "maintenance due",
      "visits",
      "schedule",
      "book",
      "overdue",
      "due soon",
      "pm visit",
      "outreach",
      "assign tech"
    ],
    "purpose": "Maintenance Due is the visit board — every plan visit that needs booking, grouped by urgency, so the maintenance you are paid for actually gets scheduled and done.",
    "sections": [
      {
        "h": "What it is for",
        "body": "Signed plans generate visits automatically; this is where you turn them into scheduled jobs. Three stat tiles show Overdue, Due in 30 days, and Booked, and the list is grouped Overdue (red), Due Soon (amber), Booked (blue), and Upcoming (grey)."
      },
      {
        "h": "Booking a visit",
        "items": [
          "Work top-down — clear Overdue first, then Due Soon.",
          "Optionally click \"AI outreach\" to draft a short, friendly message offering to schedule (editable; you copy and send it — nothing goes out on its own).",
          "Click Schedule, pick a date, assign a technician (or leave Unassigned), and Book. The visit moves to Booked with its job number and start date."
        ]
      },
      {
        "h": "Good to know",
        "body": "Visits appear here automatically as agreements are signed and activated — there is nothing to create by hand. Upcoming is the look-ahead beyond 30 days. Platform owners get an organization picker."
      }
    ]
  },
  {
    "id": "maintenance-tiers",
    "title": "Maintenance Tiers",
    "area": "Maintenance",
    "keywords": [
      "maintenance tiers",
      "tier",
      "plan levels",
      "silver",
      "gold",
      "platinum",
      "pricing",
      "visits per year",
      "discount",
      "comfort check",
      "included"
    ],
    "purpose": "Maintenance Tiers is where you define the plan levels you sell (e.g. Silver / Gold / Platinum) — their price, how many visits a year, the member discount, and what each includes. It is the prerequisite for creating agreements.",
    "sections": [
      {
        "h": "What it is for",
        "body": "Set your plan menu once here and every agreement is built from it. Pricing here is a template — each agreement snapshots its own price at signup, so changing a tier later never re-prices existing plans."
      },
      {
        "h": "Building tiers",
        "items": [
          "Add a tier with a name, visits per year, member discount %, monthly and annual price, a \"what’s included\" description, and whether it includes a comfort check.",
          "Reorder tiers with the ↑ / ↓ arrows so they present in the right order on the Agreements page.",
          "Edit adjusts a tier’s pricing or details (template only — existing signed agreements are unaffected). Archive/Reactivate retires or restores a tier without touching current plans; use Show archived to see them."
        ]
      },
      {
        "h": "Good to know",
        "body": "Higher tiers typically add deeper benefits and a bigger discount rather than more visits. These tiers also drive PM-checklist assignments (which checklist a visit uses by system type and tier). Platform owners get an organization picker."
      }
    ]
  },
  {
    "id": "filter-subscriptions",
    "title": "Filter Subscriptions",
    "area": "Maintenance",
    "keywords": [
      "filter subscriptions",
      "auto-ship",
      "subscription",
      "filters",
      "recurring",
      "generate order",
      "ship date",
      "discount",
      "pause",
      "resume",
      "cancel"
    ],
    "purpose": "Filter Subscriptions is the fulfillment and billing side of customer auto-ship filter plans — generate a due cycle’s order in one click, and Journey prices it, applies the subscription discount, invoices and emails the customer, and advances the next ship date.",
    "sections": [
      {
        "h": "What it is for",
        "body": "Customers set these subscriptions up themselves in the portal (\"My AC Filters\"); this page is where the office fulfills them. Each card shows the customer, property, the exact filter spec (size, MERV, quantity), the shipping interval, and the next ship date — color-coded red (due), amber (paused), or green (active)."
      },
      {
        "h": "Fulfilling due subscriptions",
        "items": [
          "Set the org-wide subscription discount once (a percentage) and Save — it is applied to every generated order.",
          "Focus on the \"Due now\" cards and click Generate order on each. It prices from the filter pricebook, applies the discount, creates and emails the invoice, and rolls the next ship date forward; a banner confirms the invoice number and amount.",
          "Use Pause / Resume for seasonal holds and Cancel to end a subscription."
        ]
      },
      {
        "h": "Good to know",
        "body": "Subscriptions originate in the customer portal, so a filter must be priced in the filter pricebook for its order to generate. This is separate from one-off Filter Orders. Platform owners get an organization picker."
      }
    ]
  }
]

export const ROUTE_HELP = {
  "/maintenance-station": "maintenance-station",
  "/maintenance-agreements": "maintenance-agreements",
  "/maintenance-due": "maintenance-due",
  "/maintenance-tiers": "maintenance-tiers",
  "/maintenance-dashboard": "maintenance-dashboard",
  "/filter-subscriptions": "filter-subscriptions"
}
