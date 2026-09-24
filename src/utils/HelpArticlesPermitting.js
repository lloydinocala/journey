// Help articles — Permitting section. One file per section so edits stay local.
// Shape: export const HELP_ARTICLES (array) + ROUTE_HELP (route -> article id).
// Aggregated by ./HelpArticles.js. Keep article ids unique across ALL section files.

export const HELP_ARTICLES = [
  {
    "id": "warranty-registrations",
    "title": "Warranty Registrations",
    "area": "Permitting",
    "keywords": [
      "warranty",
      "registration",
      "register",
      "new system",
      "retrofit",
      "install",
      "serial",
      "model",
      "manufacturer",
      "30 days",
      "extended warranty",
      "pull from equipment"
    ],
    "purpose": "New systems must be registered with the manufacturer within 30 days of install to secure the extended warranty. This page tracks every new install so none slip past the deadline.",
    "sections": [
      {
        "h": "What it is for",
        "body": "Every new-system (Retrofit) install creates a warranty record here automatically, so there is nothing to remember to add. Your job is to fill in the equipment details, register the system on the manufacturer’s site, and record the date — before the 30-day clock runs out."
      },
      {
        "h": "Working a registration",
        "items": [
          "Use the filter buttons — Unregistered (default), All, Registered — to focus the list.",
          "Each card shows the customer (linked to their file) and the job (linked to the job), with a countdown pill: grey \"N days left\", amber at 7 or fewer, red when overdue, green once registered.",
          "Fill the equipment grid (install date, brand, outdoor/indoor/furnace models and serials), or click \"Pull from Equipment on File\" to auto-fill the blank fields from the property’s equipment record.",
          "Register the system on the manufacturer’s website (outside Journey), then enter that date in \"Registered on\" and click Save. The pill flips to green and the record leaves the Unregistered list."
        ]
      },
      {
        "h": "Good to know",
        "body": "Records are generated from Retrofit jobs — there is no way (and no need) to create one by hand here. Unregistered systems within the window also surface on the Operations Dashboard, most urgent first, and on the customer’s file. Platform owners get an organization picker."
      }
    ]
  },
  {
    "id": "permits",
    "title": "Permits (Permitting Station)",
    "area": "Permitting",
    "keywords": [
      "permit",
      "permits",
      "permitting",
      "noc",
      "notice of commencement",
      "ahri",
      "inspection",
      "package",
      "authority",
      "application",
      "install"
    ],
    "purpose": "The Permitting Station tracks new-system installs through the whole permit lifecycle — from an approved system estimate, through applying for and receiving the permit, to passing final inspection. Each install becomes a permit \"package\" you work step by step.",
    "sections": [
      {
        "h": "What it is for",
        "body": "Open Permits to see what needs a hand and to start or resume a package. Like the other stations it shows \"Needs a hand\" tiles that jump to the matching list; each tile appears only when it has work."
      },
      {
        "h": "The board",
        "items": [
          "Approved — start the permit: approved system estimates not yet started. Click Next Step → to create the package (System 1 is seeded from the estimate’s equipment) and open the workflow.",
          "In progress: packages mid-workflow — Resume → picks up where you left off.",
          "Awaiting inspection: installs completed but not inspected — Schedule inspection → opens the package to book it. A failed inspection is tagged in red to reschedule.",
          "The table also shows each install’s invoice and whether it is paid."
        ]
      },
      {
        "h": "The permit workflow (per package)",
        "items": [
          "Step 1 Order equipment / verify availability — record the actual vendor, models, cost, and AHRI, and optionally place the PO. Step 2 Job — link/confirm the install job and date.",
          "Step 3 AHRI verification — enter the AHRI number and upload the certificate (AHRI Directory link provided). Step 4 Property card — pull parcel and legal description from the county appraiser.",
          "Step 5 Apply for permit — open the authority’s form or download the blank, and upload the completed application. Step 6 Notice of Commencement — required when the job total meets your NOC threshold or the authority requires it; upload each system’s notarized NOC (a NOC is tracked per system) and send them to the recorder.",
          "Step 7 Receive & record permit — enter the permit number and date and upload the permit. Step 8 Print & send — email the package to the authority and copy the permit/AHRI/NOC to the permanent customer & property record.",
          "Step 9 Inspections — once the install is complete, schedule the inspection, then mark each Pass or Fail; passing all of a package’s permits closes it out."
        ]
      },
      {
        "h": "Good to know",
        "body": "Later steps stay locked until the earlier ones are done, and the workflow only moves forward. A finished package moves to the \"Completed\" section at the bottom of this page and also shows on the customer’s profile under Permits; you can Cancel a package from its workflow header if it is abandoned. Building authorities, counties, and the NOC threshold that drive these steps are set on the Building Authorities page. Platform owners get an organization picker."
      }
    ]
  },
  {
    "id": "building-authorities",
    "title": "Building Authorities",
    "area": "Permitting",
    "keywords": [
      "building authority",
      "authorities",
      "ahj",
      "county",
      "noc threshold",
      "notice of commencement",
      "recorder",
      "appraiser",
      "inspection scheduling",
      "permit settings"
    ],
    "purpose": "Building Authorities is the reference data the permit workflow runs on — the jurisdictions you pull permits from, the counties they sit in, and the NOC threshold. Set these up once and every permit package uses them.",
    "sections": [
      {
        "h": "What it is for",
        "body": "A permit package is only as good as the authority info behind it. This page holds each building department’s contact details, forms, and links, plus your counties and the Notice-of-Commencement rule — all of which auto-populate the permit steps."
      },
      {
        "h": "Permit settings and counties",
        "items": [
          "NOC threshold — set the dollar amount at or above which a Notice of Commencement is required (Florida’s default is $15,000) and Save. This is what triggers Step 6 in the permit workflow.",
          "Counties — add each county you permit in with its name, property-appraiser URL, and the recorder vendor used for NOCs. Counties can be added, edited, archived (use \"Show archived\" to see them), or deleted when no authority is assigned to them."
        ]
      },
      {
        "h": "Managing authorities",
        "items": [
          "Click + Add authority and fill in contact info, the county, online-application link and/or an uploaded blank PDF application, inspection scheduling URL/phone, and whether it Requires Notice of Commencement.",
          "Each authority card offers quick links (Website, Online form, NOC form, Blank PDF) plus Edit and Archive/Restore. Search by name and filter Active/Archived."
        ]
      },
      {
        "h": "Good to know",
        "body": "These records feed every permit step — application links and blank forms (Step 5), the NOC rule and recorder (Step 6), inspection scheduling (Step 9), and the authority email address the finished package is sent to (Step 8). Keep them current. Platform owners get an organization picker."
      }
    ]
  },
  {
    "id": "refrigerant-dashboard",
    "title": "Refrigerant Dashboard (608 Compliance)",
    "area": "608 Compliance",
    "keywords": [
      "refrigerant",
      "freon",
      "epa",
      "608",
      "section 608",
      "aim act",
      "leak",
      "compliance",
      "dashboard",
      "covered",
      "exempt",
      "cylinder",
      "reclaim"
    ],
    "purpose": "The landing page for EPA Section 608 / AIM Act refrigerant compliance — added and recovered pounds, covered systems over their leak threshold (with the 30-day repair clock), cylinders on hand, and what is awaiting reclaim or disposal.",
    "sections": [
      {
        "h": "What it is for",
        "body": "Open this first for an at-a-glance compliance read. It rolls up your refrigerant activity and, most importantly, flags any covered system that has exceeded its leak-rate limit and is now on a 30-day repair clock. The QuincyAI briefing leads with those deadlines, then cylinders to ship, then the added-vs-recovered balance."
      },
      {
        "h": "What it shows",
        "items": [
          "KPI tiles: Over leak threshold (→ Systems), Added and Recovered in the last 90 days (→ Usage Log), and Cylinders on hand with total pounds (→ Cylinders).",
          "A red panel lists each covered system over threshold — its estimated leak rate vs. limit — with a \"Record a repair →\" link to the Usage Log.",
          "Navigation cards to Usage Log, Systems, and Cylinders round out the page."
        ]
      },
      {
        "h": "The two rule layers",
        "body": "Section 608 of the Clean Air Act applies to ALL refrigerant work — certified techs only, no venting, recover before opening a system, keep records. The AIM Act leak-repair rules (leak-rate thresholds and the 30-day repair clock) apply only to COVERED systems: 15 lb or more of refrigerant and not a residential/light-commercial AC or heat pump. Each system’s sector, set on the Systems page, decides which it is."
      },
      {
        "h": "Good to know",
        "body": "The leak rate shown is a trailing-12-month estimate: refrigerant added divided by the system’s full charge, compared strictly against the sector limit. It flags where to look; the formal determination is yours to make. Read-only rollup — you act on the Log, Systems, and Cylinders pages. Platform owners get an organization picker."
      }
    ]
  },
  {
    "id": "refrigerant-log",
    "title": "Refrigerant Usage Log",
    "area": "608 Compliance",
    "keywords": [
      "refrigerant",
      "log",
      "usage",
      "added",
      "charged",
      "recovered",
      "topoff",
      "repair",
      "record",
      "technician",
      "cert",
      "608",
      "cylinder",
      "location",
      "filter"
    ],
    "purpose": "The Usage Log records every pound of refrigerant added or recovered on a job — tied to a system, a technician, a cert, and the cylinder it came from or went into. It is the record the whole compliance program is built on.",
    "sections": [
      {
        "h": "What it is for",
        "body": "Whenever a tech charges or recovers refrigerant, log it here. Those pounds feed each covered system’s trailing-12-month leak rate, so keeping this current is what surfaces a leak before it becomes a violation — and gives you the records Section 608 requires."
      },
      {
        "h": "Recording an event",
        "items": [
          "Click \"+ Record event\". Pick the Date and the System (which auto-fills its property and refrigerant), the Technician and cert type, pounds Added and/or Recovered, and optionally the Cylinder.",
          "Choose a Reason: top-off / leak add, repair (post-fix charge), new install charge, recovery, retirement/disposal recovery, or other; add notes (leak location, repair made).",
          "The tech’s EPA cert is checked against your HR records — a warning shows if none is on file or it has expired. This is a reminder, not a hard stop: Section 608 requires a certified tech, so heed it.",
          "Picking a cylinder moves refrigerant in or out of it automatically — pick the correct one, since the log doesn’t verify the cylinder’s type or kind matches."
        ]
      },
      {
        "h": "History and leak rate",
        "items": [
          "The covered-systems summary shows each covered system’s pounds added vs. full charge and its leak rate, green within limit or red \"over — repair within 30 days\".",
          "The history table lists every event and filters by location and by refrigerant. To close a leak flagged on the dashboard, log a \"Repair (post-fix charge)\" event."
        ]
      },
      {
        "h": "Good to know",
        "body": "Edit or delete an event with the row actions — the cylinder’s on-hand pounds are reversed automatically. Export CSV pulls the filtered log for your records (keep refrigerant records at least three years). Platform owners get an organization picker."
      }
    ]
  },
  {
    "id": "refrigerant-systems",
    "title": "Refrigerant Systems",
    "area": "608 Compliance",
    "keywords": [
      "refrigerant",
      "system",
      "systems",
      "charge",
      "full charge",
      "sector",
      "subsector",
      "covered",
      "exempt",
      "threshold",
      "type",
      "r-410a",
      "r-454b",
      "comfort cooling",
      "commercial refrigeration"
    ],
    "purpose": "Give each installed system its refrigerant profile — refrigerant type, full charge in pounds, and sector. This single setup is what drives the covered-vs-exempt flag and the leak-rate math everywhere else.",
    "sections": [
      {
        "h": "What it is for",
        "body": "Compliance tracking only works if each system knows what it holds and what rules apply. Systems come from each property’s equipment on file — you don’t add or retire them here, you profile them. Getting the charge and sector right is the one control that turns AIM Act leak tracking on for a system."
      },
      {
        "h": "Profiling a system",
        "items": [
          "Click Edit on a system and set its Refrigerant, Full charge (lb), and Sector (Residential/light-commercial, Comfort cooling, Commercial refrigeration, or Industrial process).",
          "A system becomes COVERED (leak rules apply) when its full charge is 15 lb or more AND its sector is not residential/light-commercial. Everything else is Exempt — a simple usage log with no 30-day clock.",
          "The status column shows Covered, Exempt, or a red \"Over T% · repair\" badge, plus the estimated annual leak rate. Use the \"Only systems with a refrigerant on file\" filter to review what’s configured."
        ]
      },
      {
        "h": "The thresholds",
        "body": "Once covered, the leak-rate limit that forces a repair depends on the sector: 10% for comfort cooling, 20% for commercial refrigeration, 30% for industrial process refrigeration. Set the sector correctly and the dashboard, log, and 30-day clock all follow. Platform owners get an organization picker."
      }
    ]
  },
  {
    "id": "refrigerant-cylinders",
    "title": "Refrigerant Cylinders",
    "area": "608 Compliance",
    "keywords": [
      "cylinder",
      "cylinders",
      "virgin",
      "recovered",
      "reclaim",
      "disposal",
      "cradle to grave",
      "on hand",
      "ship",
      "manifest",
      "doc reference"
    ],
    "purpose": "Track each cylinder cradle-to-grave — virgin refrigerant purchased and put in service, recovered refrigerant accumulating on hand, then shipped to a certified reclaimer or disposal facility.",
    "sections": [
      {
        "h": "What it is for",
        "body": "Section 608 expects refrigerant to be accounted for from purchase to final disposition. This page is that chain: virgin cylinders you buy, recovery cylinders that collect what you pull out, and the record of sending full recovery cylinders to a reclaimer or disposal."
      },
      {
        "h": "Managing cylinders",
        "items": [
          "Click \"+ Add cylinder\" and set Kind (Virgin purchased or Recovered), refrigerant, size, currently-on-hand pounds, vendor, acquired date, and notes (cylinder ID/serial).",
          "On-hand pounds move on their own from the Usage Log — charging a system draws down a virgin cylinder, recovering credits a recovered one.",
          "When a recovered cylinder is full, click \"Send out\", choose Certified reclaimer or Certified disposal, enter the recipient facility and a document reference (manifest / ticket / invoice #), and Record shipment — that captures the pounds shipped, zeroes the cylinder, and closes the chain.",
          "Use \"Show cylinders sent to reclaim / disposal\" to pull the closed-cylinder audit history (shipped weight and disposition are shown)."
        ]
      },
      {
        "h": "Good to know",
        "body": "Recovered cylinders with refrigerant sitting on hand are counted on the dashboard as \"awaiting reclaim\", so nothing lingers unshipped. Export CSV downloads the full cylinder log. Platform owners get an organization picker."
      }
    ]
  }
]

export const ROUTE_HELP = {
  "/permits": "permits",
  "/building-authorities": "building-authorities",
  "/warranty-registrations": "warranty-registrations",
  "/refrigerant/log": "refrigerant-log",
  "/refrigerant/systems": "refrigerant-systems",
  "/refrigerant/cylinders": "refrigerant-cylinders",
  "/refrigerant": "refrigerant-dashboard"
}
