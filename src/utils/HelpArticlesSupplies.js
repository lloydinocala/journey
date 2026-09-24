// Help articles — Supplies section. One file per section so edits stay local.
// Shape: export const HELP_ARTICLES (array) + ROUTE_HELP (route -> article id).
// Aggregated by ./HelpArticles.js. Keep article ids unique across ALL section files.

export const HELP_ARTICLES = [
  {
    "id": "supplies-catalog",
    "title": "Supplies Catalog",
    "area": "Supplies",
    "keywords": [
      "supplies",
      "expendable",
      "expendables",
      "catalog",
      "consumable",
      "paper",
      "tape",
      "zip ties",
      "chemicals",
      "fuses",
      "reorder",
      "not inventoried",
      "office"
    ],
    "purpose": "A lean list of the expendables you buy regularly but do NOT count as inventory — copy paper, tech tape, zip ties, gallon chemicals, fuses. No stock counts, by design.",
    "sections": [
      {
        "h": "How to use it",
        "items": [
          "Add each supply with a name, category, unit, typical vendor, and last price. There are no on-hand quantities — this is a shopping catalog, not stock.",
          "Flag anything running low to the reorder list with \"+ Reorder\" (with an optional quantity and note).",
          "The tiles show supplies tracked, how many are on the reorder list, open POs, and 30- and 90-day spend."
        ]
      },
      {
        "h": "Good to know",
        "body": "Supplies are deliberately separate from parts Inventory — nothing here affects stock, valuation, or replenishment. For durable tools and equipment, use Tools & Office Equipment instead."
      }
    ]
  },
  {
    "id": "supplies-reorder",
    "title": "Supplies Reorder List",
    "area": "Supplies",
    "keywords": [
      "reorder",
      "shopping list",
      "to buy",
      "restock",
      "supplies",
      "bought",
      "check off",
      "vendor",
      "run"
    ],
    "purpose": "Everything you’ve flagged low, in one buy-it list grouped by vendor — the shopping list for a supply-house run.",
    "sections": [
      {
        "h": "How to use it",
        "items": [
          "Items flagged from the catalog appear here, grouped by their typical vendor.",
          "When you’ve bought something, hit \"Bought\" — enter what you paid to log the spend and refresh the item’s last price, or just check it off without a price.",
          "Cleared items drop off the list."
        ]
      },
      {
        "h": "Good to know",
        "body": "For vendors that require a purchase order, raise a PO on the Orders & POs page instead — you can pull the whole reorder list straight into a PO in one click, which also clears those items from this list."
      }
    ]
  },
  {
    "id": "supplies-orders",
    "title": "Supplies — Orders & POs",
    "area": "Supplies",
    "keywords": [
      "supplies",
      "purchase order",
      "po",
      "order",
      "vendor",
      "parts house",
      "office supply",
      "receive",
      "partial",
      "reorder",
      "shared numbering"
    ],
    "purpose": "Purchase orders for supplies from vendors that use them (office-supply and AC parts houses). PO numbers share the same running sequence as parts and tool POs, so numbering never collides.",
    "sections": [
      {
        "h": "Raising a PO",
        "items": [
          "Pick a vendor and expected date, then add line items — from the catalog (which fills in unit and last price) or as free text — with quantity and unit cost.",
          "\"Pull from reorder list\" seeds the whole PO from whatever is flagged low; those items then drop off the reorder list because they’re now on order.",
          "Creating the PO assigns the next shared PO number automatically."
        ]
      },
      {
        "h": "Receiving",
        "body": "Open a PO and enter what actually came in (defaults to the full remaining amount). Partial receipts mark it \"Partially received\" so you can receive the rest later; a full receipt closes it. Receiving is what logs the spend — each received line writes to Purchases and refreshes that item’s last price."
      },
      {
        "h": "Good to know",
        "body": "Nothing is counted as spent until it’s received. For grab-and-go buys with no PO, use the \"Bought\" check-off on the Reorder List instead — both feed the same Purchases log."
      }
    ]
  },
  {
    "id": "supplies-purchases",
    "title": "Supplies Purchases",
    "area": "Supplies",
    "keywords": [
      "supplies",
      "purchases",
      "spend",
      "spending",
      "log",
      "receipt",
      "cost",
      "range",
      "total",
      "vendor"
    ],
    "purpose": "The spend log for supplies — what was bought, when, and for how much, with a running total by date range.",
    "sections": [
      {
        "h": "How to use it",
        "items": [
          "The log fills in automatically when you check items off the reorder list or receive a PO.",
          "Use \"+ Log a purchase\" for a receipt bought on the fly — pick a catalog item or type a name, with quantity, unit cost, vendor, and date.",
          "Set the date range (30 / 90 days, 12 months, all time); the header shows the total spend in range."
        ]
      },
      {
        "h": "Good to know",
        "body": "Purchases received against a PO are tagged with the PO number, so you can trace any line of spend back to its order."
      }
    ]
  }
]

export const ROUTE_HELP = {
  "/supplies/reorder": "supplies-reorder",
  "/supplies/orders": "supplies-orders",
  "/supplies/purchases": "supplies-purchases",
  "/supplies": "supplies-catalog"
}
