// Help articles — Tools section. One file per section so edits stay local.
// Shape: export const HELP_ARTICLES (array) + ROUTE_HELP (route -> article id).
// Aggregated by ./HelpArticles.js. Keep article ids unique across ALL section files.

export const HELP_ARTICLES = [
  {
    "id": "tools-dashboard",
    "title": "Tools & Office Equipment Dashboard",
    "area": "Tools",
    "keywords": [
      "tools",
      "office equipment",
      "computers",
      "dashboard",
      "equipment",
      "reclaimer",
      "assign",
      "shop",
      "inspection",
      "maintenance",
      "hand tool"
    ],
    "purpose": "The landing page for Tools & Office Equipment Management — where your durable tools and equipment (including computers and other non-expendable purchases) are, what is flagged for maintenance, and what is in the shop for repair.",
    "sections": [
      {
        "h": "How to use it",
        "items": [
          "Enable the module from the banner (or the Organizations page) to start tracking tools.",
          "The tiles show totals: in the shop, out on trucks/techs, flagged for maintenance, and in maintenance.",
          "Open the Tool Catalog to add tools, assign them to a truck or tech, and log inspections; open Maintenance to verify repairs."
        ]
      },
      {
        "h": "Good to know",
        "body": "Tools flow like inventory: received by the shop, assigned to a truck or tech, inspected on demand, and returned to the shop for verified maintenance before being redeployed. Identical tools auto-number (e.g. \"Reclaimer 1\", \"Reclaimer 2\"). Purchase date and cost are logged as plain data for your bookkeeping."
      }
    ]
  },
  {
    "id": "tools-catalog",
    "title": "Tool Catalog",
    "area": "Tools",
    "keywords": [
      "tool catalog",
      "add tool",
      "assign",
      "truck",
      "technician",
      "inspect",
      "inspection",
      "to shop",
      "history",
      "serial",
      "model",
      "brand",
      "hand tool",
      "retire"
    ],
    "purpose": "Where each tool and piece of equipment is recorded and run through its life: added to the shop, assigned to a truck or tech, inspected on demand, sent to the shop for repair, and retired.",
    "sections": [
      {
        "h": "Adding a tool",
        "items": [
          "Record it by Name/Description and Brand, plus Model No. and Serial No. for powered tools. Tick \"Hand tool\" for simple tools (name and brand only).",
          "Identical names auto-number as you add them — the second \"Reclaimer\" is saved as \"Reclaimer 2\" — so each physical unit is distinct.",
          "Purchase date and cost are optional plain data for your bookkeeping; nothing here calculates depreciation."
        ]
      },
      {
        "h": "The lifecycle (row actions)",
        "items": [
          "Assign — put the tool in the Shop, or on a specific Truck or Technician. Assignments can be ongoing or by the job.",
          "Inspect — log condition and notes on demand; a good moment is during that vehicle’s regular inventory cycle count. Flagging a problem marks the tool \"Needs maintenance\".",
          "To Shop — pull the tool in for repair, with an anticipated return-to-service date. A flagged tool cannot be reassigned until the repair is verified.",
          "History — see every past assignment and inspection for that tool."
        ]
      },
      {
        "h": "Good to know",
        "body": "A tool flagged on inspection must go to the shop, be repaired, and be verified on the Maintenance page before it can be redeployed — so a known-bad tool never lands back on a truck."
      }
    ]
  },
  {
    "id": "tools-orders",
    "title": "Tools — Orders & Receipts",
    "area": "Tools",
    "keywords": [
      "tool order",
      "purchase order",
      "po",
      "receipt",
      "rental",
      "card",
      "debit",
      "credit",
      "vendor",
      "receive",
      "acquisition",
      "quincy"
    ],
    "purpose": "How tools come into the shop: a formal PO to a tool vendor, a spur-of-the-moment card purchase from a hardware store, or a rental. Quincy can read a receipt to save typing.",
    "sections": [
      {
        "h": "The three ways to acquire",
        "items": [
          "PO order — raise a purchase order with line items; its number comes from the same sequence as parts and supplies POs. Tools are created when the PO is received (partial receipts supported).",
          "Card / cash purchase — record an off-the-cuff buy from a hardware or parts store with no PO; snap the receipt and Quincy reads the vendor, date, total, and items.",
          "Rental — record a rented tool with its return-by date so it shows up for return before it runs late."
        ]
      },
      {
        "h": "Receiving",
        "body": "Receiving a PO creates the tools in the shop, instance-numbered like any other tool, and advances the PO to Partial or Received. What you paid becomes each tool’s recorded cost."
      },
      {
        "h": "Good to know",
        "body": "Card and cash purchases that have no PO are matched to your bank statement on the Reconcile page. Overdue rentals raise a follow-up on the Tools Dashboard and in the daily QuincyAI briefing."
      }
    ]
  },
  {
    "id": "tools-reconcile",
    "title": "Tools — Reconcile",
    "area": "Tools",
    "keywords": [
      "reconcile",
      "reconciliation",
      "bank statement",
      "card",
      "debit",
      "credit",
      "match",
      "receipt",
      "no po",
      "last4",
      "merchant"
    ],
    "purpose": "Match card and cash tool purchases against your bank or card statement, so spend from vendors that don’t use POs is still accounted for.",
    "sections": [
      {
        "h": "How to use it",
        "items": [
          "Import or enter the statement charges, then let the page suggest matches to recorded purchases by amount, date, merchant, and the card’s last four digits.",
          "Confirm a suggested match, or match by hand. Unmatched charges stay flagged until you clear them."
        ]
      },
      {
        "h": "Good to know",
        "body": "Charges still awaiting a matched receipt are counted on the Tools Dashboard and called out in the QuincyAI briefing, so nothing bought on a card quietly goes unaccounted."
      }
    ]
  },
  {
    "id": "tools-maintenance",
    "title": "Tools — Maintenance",
    "area": "Tools",
    "keywords": [
      "tool maintenance",
      "repair",
      "shop",
      "anticipated return",
      "return to service",
      "follow up",
      "overdue",
      "verify",
      "redeploy"
    ],
    "purpose": "The tools currently in the shop for repair — where you record the work and verify it before a tool goes back into service.",
    "sections": [
      {
        "h": "How to use it",
        "items": [
          "Tools land here when they’re sent \"To Shop\" from the Catalog, each with an anticipated return-to-service date.",
          "Record the maintenance or repair performed, then mark it verified — only a verified tool can be redeployed.",
          "The Anticipated Return column drives the follow-up flag: a tool not back by its date is overdue."
        ]
      },
      {
        "h": "Good to know",
        "body": "Overdue tools show as \"Follow-up needed\" on the Tools Dashboard and in the daily QuincyAI briefing, so a tool sitting too long in the shop gets chased."
      }
    ]
  }
]

export const ROUTE_HELP = {
  "/tools/catalog": "tools-catalog",
  "/tools/orders": "tools-orders",
  "/tools/reconcile": "tools-reconcile",
  "/tools/maintenance": "tools-maintenance",
  "/tools": "tools-dashboard"
}
