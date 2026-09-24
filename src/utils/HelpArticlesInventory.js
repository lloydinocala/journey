// Help articles — Inventory section. One file per section so edits stay local.
// Shape: export const HELP_ARTICLES (array) + ROUTE_HELP (route -> article id).
// Aggregated by ./HelpArticles.js. Keep article ids unique across ALL section files.

export const HELP_ARTICLES = [
  {
    "id": "inv-overview",
    "title": "Inventory Dashboard",
    "area": "Inventory",
    "keywords": [
      "inventory",
      "overview",
      "dashboard",
      "module",
      "landing",
      "elements",
      "enabled",
      "trucks",
      "warehouses",
      "parts",
      "mapped",
      "low stock",
      "open pos",
      "at a glance"
    ],
    "purpose": "The landing page for Inventory Management — an at-a-glance dashboard of the four things worth watching (low stock, open POs, recent variance, and inventory value), plus module stats and shortcuts into each area.",
    "sections": [
      {
        "h": "At a glance",
        "items": [
          "Low stock — how many stock lines are at or under their reorder point; click through to Replenishment. It turns red when anything needs reordering.",
          "Open purchase orders — POs that are ordered or partially received, with the next expected delivery date and the dollar value on order; click through to Purchase Orders.",
          "Variance (90 days) — the net dollar impact of posted count adjustments and matched-invoice price/qty differences over the last 90 days; click through to Inventory Variance.",
          "Inventory value — what stock on hand is worth right now at cost; click through to Inventory Valuation."
        ]
      },
      {
        "h": "The rest of the page",
        "items": [
          "Below the cards, the stat tiles count your trucks, warehouses, catalog parts, and services with a parts kit mapped.",
          "The navigation cards link into Locations, Item Catalog, Stock & Receiving, Cycle Counts, Purchase Orders, Service → Part Mapping, and Inventory Settings.",
          "The pill by the title shows whether the module is enabled; turn it on in Inventory Settings once your items, trucks, and mappings are ready. Use Refresh to repull the live numbers."
        ]
      }
    ]
  },
  {
    "id": "inv-locations",
    "title": "Locations (Warehouses & Trucks)",
    "area": "Inventory",
    "keywords": [
      "locations",
      "warehouse",
      "shop",
      "truck",
      "vehicle",
      "fleet",
      "assigned",
      "available",
      "archive",
      "retire",
      "delete",
      "transfer",
      "spare",
      "status"
    ],
    "purpose": "Your stocking locations: warehouses / shops and service trucks. On-hand is tracked per location, so you always know what is where. Trucks carry a lifecycle status so stock and history are never lost when a vehicle changes hands or leaves service.",
    "sections": [
      {
        "h": "How to use it",
        "items": [
          "Add a Warehouse / Shop with a name and address.",
          "Add a Truck by picking a vehicle from Fleet — its name and assigned technician come straight from the Fleet record, so the two never drift apart.",
          "The Stock column shows what each location is currently carrying (parts and value)."
        ]
      },
      {
        "h": "Truck status (set automatically)",
        "items": [
          "Assigned — an active truck with a driver assigned in Fleet.",
          "Available — an active truck with no driver right now. It is still live and can hold stock; a truck between drivers belongs here, not in Archive. This follows Fleet automatically — assign a driver and it becomes Assigned again.",
          "Archived — benched or surplus, kept for future use. History is preserved and it can be restored.",
          "Retired — permanently out of the fleet. History is kept forever, and it can still be restored if the vehicle ever returns."
        ]
      },
      {
        "h": "Archive, Retire, and Delete",
        "items": [
          "Archive or Retire is blocked while a location still holds stock — transfer the stock to another location first (Stock & Receiving → Transfer), so inventory is never hidden.",
          "Archive is for a vehicle temporarily out of rotation (surplus, or off the road for now) that stays in the fleet.",
          "Retire is for a vehicle permanently out of fleet service. It keeps all history — nothing is destroyed.",
          "Delete is only for empty records created by mistake — it is disabled the moment a location holds stock, and the database blocks it if any history exists. Use Retire, not Delete, for a real vehicle.",
          "Turn on \"Show archived & retired\" to see inactive locations and Restore them."
        ]
      },
      {
        "h": "Good to know",
        "body": "Trucks must be recorded in Fleet → Vehicles first. A truck’s assigned technician is read-only here — change it on the Fleet vehicle and it follows automatically, including whether the truck shows as Assigned or Available."
      }
    ]
  },
  {
    "id": "inv-items",
    "title": "Item Catalog",
    "area": "Inventory",
    "keywords": [
      "item",
      "items",
      "catalog",
      "part",
      "parts",
      "sku",
      "consumable",
      "stock type",
      "special order",
      "cost",
      "uom",
      "unit",
      "barcode",
      "import",
      "export"
    ],
    "purpose": "Your parts and consumables — one entry per part, with its cost, vendor, units, and whether you stock it or special-order it.",
    "sections": [
      {
        "h": "Key fields",
        "items": [
          "Description & Category — how the part reads everywhere else in the module.",
          "Type (stock vs special order) — stock parts feed replenishment and forecasting; special-order parts are bought per job and skip both. Set it when you create a part, and change it any time.",
          "Cost, vendor part number, barcode, and units (each, or a stock unit like a box with a conversion)."
        ]
      },
      {
        "h": "How to use it",
        "items": [
          "Add a part with \"+ New\", or bulk-load your whole catalog from a spreadsheet with Import (and Export for a template or a backup).",
          "Search, filter by class, and toggle \"Show archived\" to see retired parts.",
          "The On hand column shows current stock across all locations; parts carrying stock read in bold.",
          "Archive a part you no longer use instead of deleting it, so its history stays intact — Delete is disabled for any part that still has stock or is mapped to a service, and is reserved for empty records created by mistake."
        ]
      },
      {
        "h": "Good to know",
        "body": "Special-order parts show a tag and are deliberately kept out of replenishment and demand forecast — since nothing stays the same forever, you can flip a part between stock and special order whenever it changes."
      }
    ]
  },
  {
    "id": "inv-stock",
    "title": "Stock & Receiving",
    "area": "Inventory",
    "keywords": [
      "stock",
      "on hand",
      "on-hand",
      "receive",
      "receiving",
      "transfer",
      "reorder point",
      "max",
      "par",
      "levels",
      "ledger"
    ],
    "purpose": "On-hand by location, and where you receive stock in and move it between locations. Every change is written to the stock ledger, the single source of truth for quantities and cost.",
    "sections": [
      {
        "h": "How to use it",
        "items": [
          "Pick a location to see its on-hand for every part.",
          "Receive adds stock at a unit cost (e.g. a delivery straight to the shop) — this updates the part’s last cost.",
          "Transfer moves stock from one location to another (e.g. shop → truck). You can’t transfer more than the From location holds — receive it there first.",
          "Set a Reorder point and a Max (par) per part per location — these drive Replenishment."
        ]
      },
      {
        "h": "What the Status column means",
        "items": [
          "In stock (green) — above the reorder point.",
          "Low (amber) — at or below the reorder point; it will show up on Replenishment.",
          "Out (red) — a part you carry here (a reorder point is set) has hit zero.",
          "Check (red) — on-hand is negative, which should never happen; fix it with a cycle count. A negative on-hand also shows the number in red.",
          "Not stocked / Special order (grey) — this location does not carry the part, or it is a special-order part bought per job; neither is a shortage."
        ]
      },
      {
        "h": "Good to know",
        "body": "Receiving against a purchase order is done from Purchase Orders (not here), so PO progress and costs stay in sync. Use this screen for manual receipts and transfers. Every change writes to the stock ledger — nothing is overwritten."
      }
    ]
  },
  {
    "id": "inv-cycle-counts",
    "title": "Cycle Counts",
    "area": "Inventory",
    "keywords": [
      "cycle count",
      "count",
      "counts",
      "physical count",
      "blind count",
      "variance",
      "adjust",
      "shrinkage",
      "audit",
      "reconcile"
    ],
    "purpose": "Count what is physically on a truck or in the warehouse, review the variances, and post corrections to on-hand. This is how you keep your numbers honest — replenishment, job costing, and forecasting are only as good as your counts.",
    "sections": [
      {
        "h": "How to use it",
        "items": [
          "Start a count, pick a location, and choose the scope — everything stocked there, one category, or start empty and add items by hand.",
          "By default it is a blind count: the expected quantity is hidden while you enter what you actually see, so the count is not biased.",
          "Enter your counts (they save as you go), then \"Reveal variances\" to see the book quantity and the difference per line.",
          "Post the count to write the corrections to the ledger and bring on-hand to exactly what you counted."
        ]
      },
      {
        "h": "Good to know",
        "body": "Posting adjusts to the current on-hand at the moment you post, so a part pulled mid-count is respected. Posted counts are permanent history — to fix a mistake, run another count. Use \"Add an item found on the shelf\" for stock that shouldn’t be there but is."
      }
    ]
  },
  {
    "id": "inv-replenishment",
    "title": "Replenishment",
    "area": "Inventory",
    "keywords": [
      "replenishment",
      "restock",
      "reorder",
      "par",
      "max",
      "transfer",
      "refill truck",
      "shortfall",
      "top up"
    ],
    "purpose": "Everything sitting at or below its reorder point, with how much to buy or move to bring it back up to Max. Refill a truck from the warehouse in one click; warehouse shortfalls are flagged to purchase.",
    "sections": [
      {
        "h": "How to use it",
        "items": [
          "Pick the warehouse to \"Refill trucks from\". For each truck shortfall, Transfer moves the suggested quantity from that warehouse in one click.",
          "When the warehouse itself is short, the row is flagged to purchase instead.",
          "Filter by location or search by part; the header shows the total dollar value to top up."
        ]
      },
      {
        "h": "Good to know",
        "body": "This list is driven by the Reorder and Max levels you set on Stock & Receiving. Special-order parts are excluded — they are bought per job. Set restock days and lead/safety defaults in Inventory Settings."
      }
    ]
  },
  {
    "id": "inv-health",
    "title": "Inventory Health (Anomalies)",
    "area": "Inventory",
    "keywords": [
      "health",
      "anomaly",
      "anomalies",
      "alerts",
      "negative stock",
      "stockout",
      "cost outlier",
      "dead stock",
      "shrinkage",
      "usage spike",
      "missing cost"
    ],
    "purpose": "A live scan for the inventory problems worth acting on — negative stock, stockouts, cost outliers, dead stock, usage spikes, and shrinkage. It changes nothing; fix the underlying issue and the flag clears itself.",
    "sections": [
      {
        "h": "What it flags",
        "items": [
          "Negative on-hand (high) — stock went below zero; run a count.",
          "Stockouts — a stocked part at zero where a reorder point is set.",
          "Cost outliers — a receipt priced well off the expected cost.",
          "Usage spikes — last 30 days well above the recent average.",
          "Shrinkage — parts that came up short across recent cycle counts.",
          "Dead stock & Missing cost (low) — cash sitting idle, or stock with no cost on record."
        ]
      },
      {
        "h": "How to use it",
        "body": "Flags are grouped by type and ranked by severity, each with a plain-English note on what it means and what to do. Filter by severity, and hit Refresh after you’ve made fixes to confirm they cleared."
      }
    ]
  },
  {
    "id": "inv-purchase-orders",
    "title": "Purchase Orders",
    "area": "Inventory",
    "keywords": [
      "purchase order",
      "po",
      "purchasing",
      "order",
      "receive",
      "vendor",
      "job name",
      "draft",
      "cancel",
      "numbering",
      "specialty part"
    ],
    "purpose": "Create and receive purchase orders to your vendors. POs are numbered automatically, can carry a job name, and receiving flows straight into stock and cost.",
    "sections": [
      {
        "h": "How to use it",
        "items": [
          "Create a PO, pick the vendor and deliver-to location, add parts, and (optionally) a job name so you know what the order is for.",
          "Add catalog parts by searching, or type a part that isn’t in your catalog yet and create it on the spot (it defaults to special-order).",
          "Use \"Pull low items\" to auto-fill the PO with everything below its reorder point at the deliver-to location — the quick way to turn a Replenishment shortfall into an order.",
          "When goods arrive, open the PO and receive against it — on-hand and costs update, and the PO advances to Partial or Received.",
          "Search by number, job name, vendor, or part. The default \"Relevant\" view shows in-flight POs plus anything received in the last 30 days; switch the filter to see all, cancelled, or older receipts."
        ]
      },
      {
        "h": "Numbering",
        "body": "New POs get the next number automatically (PO-1001, PO-1002…). If you’re moving from another system, use the numbering control on this screen to set the next number so your sequence continues where you left off."
      },
      {
        "h": "Good to know",
        "body": "A draft you change your mind about can be deleted; an ordered PO can be cancelled. Open POs awaiting receipt also surface on the Inventory Dashboard."
      }
    ]
  },
  {
    "id": "inv-special-orders",
    "title": "Special Orders",
    "area": "Inventory",
    "keywords": [
      "special order",
      "special orders",
      "per job",
      "customer part",
      "requested",
      "ordered",
      "ready",
      "pickup",
      "needed by"
    ],
    "purpose": "A tracking board for parts you order for a specific customer or job that you don’t keep in stock — so nothing ordered for a customer gets lost.",
    "sections": [
      {
        "h": "How to use it",
        "items": [
          "Create a special order, search your customer list to link it (or just type a name), describe the part, and add a vendor, estimated cost, PO reference, and needed-by date.",
          "Move it along with one click: Requested → Ordered → Received → Ready → Closed. Each step is timestamped.",
          "Filter by stage; the header shows how many are active and how many are ready for pickup. Anything past its needed-by date is flagged overdue."
        ]
      },
      {
        "h": "Good to know",
        "body": "Special orders are intentionally separate from stock — marking one \"received\" never touches your on-hand, because the part goes straight to the job. The part is free text by default (special-order parts usually aren’t in your catalog), but you can link a catalog item if it is one."
      }
    ]
  },
  {
    "id": "inv-vendor-invoices",
    "title": "Vendor Invoices (A/P)",
    "area": "Inventory",
    "keywords": [
      "vendor invoice",
      "a/p",
      "accounts payable",
      "bill",
      "capture",
      "3-way match",
      "three way match",
      "variance",
      "stage for payment",
      "packing slip",
      "quote"
    ],
    "purpose": "Capture a vendor’s bill, match it against its purchase order and what was received (a 3-way match), and stage it for payment. The original file is kept on the record.",
    "sections": [
      {
        "h": "How to use it",
        "items": [
          "Capture a bill by uploading a photo or PDF — Quincy reads the vendor, invoice number, dates, and line items, and matches them to a vendor, a PO, and your catalog parts for you to confirm.",
          "The 3-way match compares ordered vs received vs billed on each line and flags price or quantity variances.",
          "Stage for payment when a bill is good to go; put it On hold if something is off. Staged bills wait for the future Bookkeeping module.",
          "From a matched bill you can receive the goods into stock, and open the original file any time."
        ]
      },
      {
        "h": "Good to know",
        "body": "Every confirmed line teaches the Vendor Cross-Reference, so the next bill from that vendor auto-matches the same part by its SKU. Filter the queue by Needs review, Staged, or On hold."
      }
    ]
  },
  {
    "id": "inv-vendor-crossref",
    "title": "Vendor Cross-Reference",
    "area": "Inventory",
    "keywords": [
      "cross reference",
      "crossref",
      "alias",
      "vendor sku",
      "crosswalk",
      "reconcile",
      "suggest matches",
      "learn",
      "seed"
    ],
    "purpose": "Bridges each vendor’s own part names and SKUs to your generic catalog, so their invoices match automatically. It learns as you capture bills, and you can seed it from purchase history.",
    "sections": [
      {
        "h": "How to use it",
        "items": [
          "Pick a vendor and \"Suggest matches from history\" — Quincy proposes which of that vendor’s past parts map to your catalog items, judged so single vs dual capacitors, exact sizes, and accessories are sorted out.",
          "Review the picks (pre-selected, with a dropdown to override or clear), select the ones you trust, and save. Nothing is stored until you confirm.",
          "The \"Learned aliases\" list shows what is saved for that vendor; remove any that are wrong."
        ]
      },
      {
        "h": "Good to know",
        "body": "The crosswalk also fills itself in every time you confirm a captured vendor invoice — seeding here just gives it a head start. Once a vendor’s SKU is learned, their future bills auto-match without guessing."
      }
    ]
  },
  {
    "id": "inv-service-map",
    "title": "Service → Part Mapping",
    "area": "Inventory",
    "keywords": [
      "service map",
      "mapping",
      "kit",
      "bom",
      "bill of materials",
      "parts kit",
      "deplete",
      "consume"
    ],
    "purpose": "Link a service to the parts it consumes — a \"kit\" or bill of materials. When that service lands on an invoice and you record parts used, the kit is what depletes from stock.",
    "sections": [
      {
        "h": "How to use it",
        "items": [
          "Pick a service on the left, then build its parts list on the right — add catalog parts with a quantity each.",
          "Use \"Auto-create kits\" to bulk-seed a single-part kit for every unmapped parts service at once (labor and diagnostic services are skipped) — then refine any kit by hand.",
          "Services that read as labor, fees, or memberships are filtered out of the default view, since they consume no parts; switch the view to see kitted, empty, or all services."
        ]
      },
      {
        "h": "Good to know",
        "body": "A well-built kit is what makes \"Record Parts Used\" one click — the parts are already suggested from the services on the invoice."
      }
    ]
  },
  {
    "id": "inv-parts-used",
    "title": "Record Parts Used",
    "area": "Inventory",
    "keywords": [
      "parts used",
      "record parts",
      "consumption",
      "deplete",
      "truck",
      "invoice",
      "work order"
    ],
    "purpose": "Record the parts that actually left the truck on a job. This depletes stock and powers Parts Usage, Job Costing, and Demand Forecast — the single most valuable habit for keeping inventory accurate.",
    "sections": [
      {
        "h": "How to use it",
        "items": [
          "Pick an invoice on the left (filter by recorded / not recorded, or search).",
          "Confirm the parts that really moved — seeded from the kits of the services billed — and record them.",
          "Recording depletes the technician’s truck and marks the invoice recorded."
        ]
      },
      {
        "h": "Good to know",
        "body": "The billed invoice is what the customer pays; Parts Used is what physically moved — they don’t have to match. The same panel is used in the field on the mobile work order, so office and tech post through identical logic."
      }
    ]
  },
  {
    "id": "inv-usage",
    "title": "Parts Usage",
    "area": "Inventory",
    "keywords": [
      "usage",
      "parts usage",
      "consumed",
      "report",
      "truck",
      "technician",
      "cost"
    ],
    "purpose": "What each truck and technician has consumed over a date range, valued at cost — a read-only report drawn from the stock ledger.",
    "sections": [
      {
        "h": "How to use it",
        "body": "Set a From / To range and Run report. Results group by truck, with each part’s quantity and cost, and a grand total of parts cost consumed."
      },
      {
        "h": "Good to know",
        "body": "This reflects what was entered in Record Parts Used. The more consistently parts are recorded, the more complete this report — and Job Costing and Demand Forecast — become."
      }
    ]
  },
  {
    "id": "inv-valuation",
    "title": "Inventory Valuation",
    "area": "Inventory",
    "keywords": [
      "valuation",
      "value",
      "worth",
      "inventory value",
      "cost",
      "on hand value",
      "by location",
      "by category",
      "asset"
    ],
    "purpose": "What your stock on hand is worth right now, valued at cost — broken down by location and by category. A live, current-value snapshot you can pull any time.",
    "sections": [
      {
        "h": "How to use it",
        "items": [
          "The tiles show total value, how many parts are in stock, and across how many locations.",
          "Switch the breakdown between By location and By category to see where the value sits.",
          "The detail table lists every stocked part, its on-hand, unit cost, and value — highest value first."
        ]
      },
      {
        "h": "Good to know",
        "body": "Each part is valued at its average cost, falling back to last cost, then standard cost. Parts with no cost on record are flagged \"not valued\" and excluded from the total — set a cost in the Item Catalog to include them. This is current value only; it is not stored as a weekly history."
      }
    ]
  },
  {
    "id": "inv-variance",
    "title": "Inventory Variance",
    "area": "Inventory",
    "keywords": [
      "variance",
      "shrink",
      "shrinkage",
      "count variance",
      "purchase variance",
      "price variance",
      "overbilled",
      "adjustment",
      "discrepancy",
      "loss",
      "exception"
    ],
    "purpose": "Where reality did not match the plan — in dollars. Count variance is what a posted cycle count changed versus the expected quantity; purchase variance is where a vendor invoice billed a different price or quantity than its purchase order.",
    "sections": [
      {
        "h": "How to use it",
        "items": [
          "The tiles show net variance, count adjustments, purchase variance, and how many exceptions are in view.",
          "Filter by All, Count, or Purchase, and choose a time window (last 30 / 90 days, last year, or all time).",
          "The table lists each exception, largest dollar impact first — date, type, item, where (location for counts, vendor for purchases), expected vs. actual, quantity change, and the dollar impact."
        ]
      },
      {
        "h": "What the numbers mean",
        "body": "Count value impact = adjusted quantity times item cost (average, else last, else standard). Purchase value impact = (invoiced unit price minus PO unit price) times invoiced quantity. For counts, a negative number is shrink — inventory was worth less than the books said. For purchases, a positive number means the invoice cost more than the PO."
      },
      {
        "h": "Good to know",
        "body": "Count variance appears once you post a cycle count that had adjustments; purchase variance appears once a vendor invoice is matched to a PO line with a price or quantity difference. It is computed live — refresh any time."
      }
    ]
  },
  {
    "id": "inv-job-costing",
    "title": "Job Costing",
    "area": "Inventory",
    "keywords": [
      "job costing",
      "margin",
      "material cost",
      "billed",
      "profit",
      "cost of job",
      "material percent"
    ],
    "purpose": "What each job actually cost you in parts, next to what you billed — so you can see material spend and margin by job. Labor is not included.",
    "sections": [
      {
        "h": "How to use it",
        "items": [
          "Pick a date range. Each row shows the invoice, customer, job, amount billed, material cost, what is left after materials, and material as a percent of billed (green under 35%, amber to 55%, red above).",
          "The summary strip totals billed, material, and the blended material percentage."
        ]
      },
      {
        "h": "Good to know",
        "body": "Only jobs where parts were recorded appear (an invoice with no parts recorded would misleadingly look like 100% margin). \"Billed\" is the pre-tax subtotal; each part is valued at its recorded cost. This sharpens as Record Parts Used becomes routine."
      }
    ]
  },
  {
    "id": "inv-forecast",
    "title": "Demand Forecast",
    "area": "Inventory",
    "keywords": [
      "forecast",
      "demand",
      "usage rate",
      "days of cover",
      "run out",
      "reorder",
      "order to cover",
      "trend",
      "predict"
    ],
    "purpose": "Projects how fast each part is used into days of cover, a run-out date, and a suggested order quantity — so you can buy ahead of demand instead of reacting to a stockout.",
    "sections": [
      {
        "h": "How to use it",
        "items": [
          "Choose the history window it learns from and the number of days of cover you want to hold.",
          "Each part shows its monthly usage, on-hand, days of cover, projected run-out, a trend arrow (rising / steady / easing), and how many to order to hit your coverage target. Most urgent sorts to the top."
        ]
      },
      {
        "h": "Good to know",
        "body": "Rates are a simple trailing average, not seasonal — they sharpen with a full year of history. Trend compares the last 30 days to the whole window. Special-order parts are excluded, and the whole report grows more useful the more parts usage is recorded."
      }
    ]
  },
  {
    "id": "inv-settings",
    "title": "Inventory Settings",
    "area": "Inventory",
    "keywords": [
      "inventory settings",
      "enable",
      "restock day",
      "issue day",
      "lead time",
      "safety stock",
      "par",
      "cadence"
    ],
    "purpose": "Turn the Inventory module on or off and set the defaults that drive restocking.",
    "sections": [
      {
        "h": "What lives here",
        "items": [
          "Enable Inventory — when on, invoiced pricebook parts deduct from the assigned technician’s truck. Leave it off until items, trucks, and service mappings are ready.",
          "Weekly truck restock day(s) — the days trucks are refilled to par. More frequent restocks keep both truck and shop stock leaner.",
          "Default vendor lead time and Safety stock (days) — fallbacks used when planning replenishment (lead time can also be set per vendor)."
        ]
      },
      {
        "h": "Good to know",
        "body": "The starting number for purchase orders is set on the Purchase Orders screen, not here."
      }
    ]
  }
]

export const ROUTE_HELP = {
  "/elements/locations": "inv-locations",
  "/elements/items": "inv-items",
  "/elements/stock": "inv-stock",
  "/elements/cycle-counts": "inv-cycle-counts",
  "/elements/replenishment": "inv-replenishment",
  "/elements/health": "inv-health",
  "/elements/purchasing": "inv-purchase-orders",
  "/elements/special-orders": "inv-special-orders",
  "/elements/ap": "inv-vendor-invoices",
  "/elements/vendor-crossref": "inv-vendor-crossref",
  "/elements/service-map": "inv-service-map",
  "/elements/parts-used": "inv-parts-used",
  "/elements/usage": "inv-usage",
  "/elements/valuation": "inv-valuation",
  "/elements/variance": "inv-variance",
  "/elements/job-costing": "inv-job-costing",
  "/elements/forecast": "inv-forecast",
  "/elements/settings": "inv-settings",
  "/elements": "inv-overview"
}
