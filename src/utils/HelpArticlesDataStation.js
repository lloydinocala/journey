// Help articles — DataStation section. One file per section so edits stay local.
// Shape: export const HELP_ARTICLES (array) + ROUTE_HELP (route -> article id).
// Aggregated by ./HelpArticles.js. Keep article ids unique across ALL section files.

export const HELP_ARTICLES = [
  {
    "id": "pricebook",
    "title": "Pricebook (Services)",
    "area": "Data Station",
    "keywords": [
      "pricebook",
      "services",
      "service prices",
      "price variant",
      "trip charge",
      "location",
      "access",
      "hours",
      "part source",
      "taxable",
      "checklist visit",
      "import csv",
      "catalog"
    ],
    "purpose": "The Pricebook is your service and repair price catalog. Each service holds one or more priced variants — a price for each real-world combination of location, access, hours, and part source — so the right number drops onto an estimate or invoice automatically.",
    "sections": [
      {
        "h": "What it is for",
        "body": "This is where every service and its pricing lives. A service (e.g. \"Capacitor replacement\") carries variants because the same job costs differently in an attic vs. at ground level, or with OEM vs. aftermarket parts. Set it up once and estimates and invoices build themselves at the right price."
      },
      {
        "h": "Building services and prices",
        "items": [
          "Add a service: pick or create a Category, name it, and set Taxable (defaults from your org setting).",
          "Click Prices on a service to open its variants, then add one variant per real condition — Location (Ground / Attic / Roof), Access (Standard / Difficult), Hours (Standard / Extended), Part source (N/A / OEM / Aftermarket), a customer-facing display text, price, cost, and task hours. Re-adding the same combination updates it rather than duplicating.",
          "A variant can be turned On/Off, and a service can be Renamed. Deleting a service that was never used removes it; one that has been billed is archived instead (kept for records)."
        ]
      },
      {
        "h": "Checklist visits",
        "body": "In a service’s variants panel, the \"Checklist for this trip charge\" dropdown attaches a checklist (from the Checklists page). That makes the service a checklist visit — the tech performs that checklist in place of a diagnosis, and its name is what the customer sees on the report."
      },
      {
        "h": "Bulk editing",
        "items": [
          "Filter by category, service, and status (Active / Archived / Both).",
          "Download Template, fill it, and Import CSV to load prices in bulk; to mass-edit, Export CSV (keep the PriceID column), change the numbers, and re-import. Rows with a PriceID update in place; rows without one create new price points. Failed rows can be downloaded to fix and re-import."
        ]
      },
      {
        "h": "Good to know",
        "body": "Deleting an unused service is permanent (its confirm says so). Platform owners get an organization picker."
      }
    ]
  },
  {
    "id": "systems-pricebook",
    "title": "Systems Pricebook (Equipment)",
    "area": "Data Station",
    "keywords": [
      "systems pricebook",
      "equipment",
      "system",
      "install",
      "replacement",
      "ahri",
      "seer2",
      "eer2",
      "tonnage",
      "installation price",
      "import csv",
      "columns"
    ],
    "purpose": "The Systems Pricebook is your catalog of installable equipment/systems — the full-system packages, with their specs and installation price, that populate the System Estimate builder.",
    "sections": [
      {
        "h": "What it is for",
        "body": "Every option a salesperson can put on a new-system estimate comes from here. Each row is a complete system (outdoor + indoor + furnace) with its ratings, warranties, cost, and installation price, so a System Estimate is built by picking from this list."
      },
      {
        "h": "Working the catalog",
        "items": [
          "The header counts active / inactive / total. Filter by System Type, Brand, and status (Active / Inactive / Both), and use Columns to show or hide the many spec columns (your choice is remembered). Click a column header to sort.",
          "Edit a row inline to change any spec, cost, or the installation price. Deactivate/Reactivate just hides or shows a system in the System Estimate picker — it never deletes."
        ]
      },
      {
        "h": "Bulk editing",
        "items": [
          "Download Template, fill it, and Import CSV to load systems; Export CSV to mass-edit (keep the hidden ID column so changes update existing rows — leave ID blank to add a new system). Failed rows can be downloaded, fixed, and re-imported.",
          "Re-imports without an ID auto-match on AHRI reference (or a model signature) so prices update instead of duplicating."
        ]
      },
      {
        "h": "Good to know",
        "body": "Active systems feed the System Estimate picker; System Estimate Setup supplies the install/warranty boilerplate, and Special Features supplies the add-ons. Platform owners get an organization picker."
      }
    ]
  },
  {
    "id": "special-features",
    "title": "Special Features",
    "area": "Data Station",
    "keywords": [
      "special features",
      "add-on",
      "add on",
      "air purifier",
      "surge protector",
      "uv light",
      "system estimate",
      "upgrade",
      "accessory",
      "warranty"
    ],
    "purpose": "Special Features is the catalog of estimate add-ons — air purifiers, surge protectors, UV lights, and the like — that can be attached to a system estimate, each a repeatable priced line with its own price and warranty.",
    "sections": [
      {
        "h": "What it is for",
        "body": "These are the upgrades and accessories your team offers alongside a new system. Set each one up once here and it becomes selectable on system estimates (and can be added more than once per estimate)."
      },
      {
        "h": "Managing features",
        "items": [
          "Add a feature with a name, description, price, your cost, and warranty text.",
          "Edit a feature inline; Archive/Restore retires one without losing history (Show archived to see them); Delete removes a true mistake."
        ]
      },
      {
        "h": "Good to know",
        "body": "This catalog is hand-managed (no CSV import/export). Platform owners get an organization picker."
      }
    ]
  },
  {
    "id": "discount-catalog",
    "title": "Discount Catalog",
    "area": "Data Station",
    "keywords": [
      "discount",
      "discount catalog",
      "percent",
      "flat dollar",
      "veteran",
      "senior",
      "pma",
      "approval",
      "supervisor",
      "invoice",
      "estimate"
    ],
    "purpose": "The Discount Catalog holds the reusable discounts your team applies to estimates and invoices, with the approval rules baked in — so the right discount is applied the right way.",
    "sections": [
      {
        "h": "What it is for",
        "body": "Instead of ad-hoc price cuts, discounts are defined here as named, governed items. The rules: percentage discounts (Veteran, Senior, PMA level) are pre-approved and apply on their own; flat-dollar amounts require a field supervisor. Only the single highest applicable discount is used on an invoice — they never stack."
      },
      {
        "h": "Managing discounts",
        "items": [
          "Add a discount with a name, a type (Percent or Flat dollar), and a value (percent capped at 100).",
          "Toggle a discount On/Off to control whether the team can apply it; Edit adjusts it inline. Discounts are deactivated rather than deleted, so history is preserved."
        ]
      },
      {
        "h": "Good to know",
        "body": "Percent = auto-applies and pre-approved; flat = needs supervisor approval at the point of use. Platform owners get an organization picker."
      }
    ]
  },
  {
    "id": "system-estimate-setup",
    "title": "System Estimate Setup",
    "area": "Data Station",
    "keywords": [
      "system estimate setup",
      "included",
      "installation",
      "warranty",
      "template",
      "boilerplate",
      "what is included",
      "manufacturer years",
      "contractor years"
    ],
    "purpose": "Sets the \"what’s included\" installation blocks and the exact warranty wording that print on every System Estimate — write them once here instead of on every quote. Installation includes is set per system type, since what an install comes with differs by type.",
    "sections": [
      {
        "h": "What it is for",
        "body": "These blocks appear on every system estimate exactly as written, so your proposals are consistent and you never retype boilerplate. Set them once and forget them — the estimate pulls the right installation block for whichever system type you choose."
      },
      {
        "h": "Installation includes (by system type)",
        "items": [
          "Default — the fallback \"what’s included with the install\" text. It is used for any system type you leave blank.",
          "Per system type — a separate block for each type (Apt CrossOver, Apt Split, CrossOver, Gas, Packaged, Split, Mini-Split, plus any extra type in your equipment). Write the exact inclusions for that type.",
          "On a System Estimate, the block for the chosen system type is inserted automatically; a type with no block of its own uses the default.",
          "\"Start from default\" copies the default text into a blank type so you can tweak rather than retype."
        ]
      },
      {
        "h": "Warranty (exact words)",
        "items": [
          "Shown verbatim to the customer. It supports two placeholders, {manufacturer_years} and {contractor_years}, which are filled automatically from the specific system chosen on each estimate."
        ]
      },
      {
        "h": "Good to know",
        "body": "Fill in the default, any per-type blocks, and the warranty, then click Save — they flow onto every System Estimate with the correct installation block per type and the warranty year numbers substituted per selected system. Platform owners get an organization picker."
      }
    ]
  },
  {
    "id": "pm-checklists",
    "title": "PM Checklists",
    "area": "Data Station",
    "keywords": [
      "pm checklists",
      "preventive maintenance",
      "checklist",
      "template",
      "master",
      "fork",
      "assignments",
      "system type",
      "tier",
      "inspect",
      "measure"
    ],
    "purpose": "PM Checklists is the preventive-maintenance template library — the inspections and measurements a tech performs on a maintenance visit. Journey ships master templates; you save your own editable versions and assign which one runs for each system type and plan tier.",
    "sections": [
      {
        "h": "What it is for",
        "body": "This defines what actually happens on a maintenance visit. It uses a master/fork model: Journey provides read-only master templates, an admin saves a master as their own editable copy, and techs run whichever template is assigned — they never edit. (This is separate from the Checklists page, which builds service/diagnostic checklists.)"
      },
      {
        "h": "Building your templates",
        "items": [
          "In Templates, browse \"Journey Masters\" and \"Your Custom Forms\". On a master, click \"Save as my version\" to fork an editable copy.",
          "On your fork, add checks (each with text, a section, and a type — Inspect, Measure, Perform, or Safety-test; measures capture a reading with units), and Rename or Delete as needed. Items are grouped by section with a color-coded type badge."
        ]
      },
      {
        "h": "Assigning templates",
        "items": [
          "In Assignments, for each system type (e.g. Heat Pump, Package Heat Pump, Gas Furnace + AC) and each plan tier, pick which template auto-attaches to a PM job.",
          "Tiers come from your own Maintenance Tiers setup, plus \"Basic (no agreement)\". Leave one \"not set\" to choose manually on the job."
        ]
      },
      {
        "h": "Good to know",
        "body": "Editing is limited to admins on their own forks (masters stay read-only). Once assigned, the right checklist auto-attaches to a maintenance job by the property’s system type and the customer’s tier. Platform owners get an organization picker."
      }
    ]
  },
  {
    "id": "job-checklists",
    "title": "Checklists",
    "area": "Data Station",
    "keywords": [
      "checklist",
      "checklists",
      "template",
      "diagnostic",
      "inspection task",
      "maintenance task",
      "measure",
      "flags",
      "estimate",
      "report",
      "red tag",
      "system health",
      "trip charge",
      "import excel"
    ],
    "purpose": "Checklists is the service/diagnostic checklist builder — the step-by-step forms a technician runs on a job. What makes them powerful is routing flags: each finding can add a repair-estimate line, a customer-report line, a System Health input, a new-system estimate, or a red-tag.",
    "sections": [
      {
        "h": "What it is for",
        "body": "A checklist turns a tech’s inspection into structured output. You attach a finished checklist to a trip charge on the Pricebook so the tech runs it in place of a diagnosis; the flags on each item then decide what each finding does downstream. (This is separate from PM Checklists, which are the preventive-maintenance templates.)"
      },
      {
        "h": "Building a checklist",
        "items": [
          "Create a checklist (or Import from Excel/CSV using the downloadable template), set its Equipment type and Active state.",
          "Add sections, then items. Each item has an Inspection Task (what to check) and a Maintenance Task (what to do), and an item type — Checkbox, or Measure (which captures a reading with units and a nameplate spec, e.g. amp draw or superheat).",
          "Set the routing flags per item: Estimate (adds to a repair estimate), Report (adds to the customer report — on by default), Health (feeds the System Health score), Sys Est (creates a new-system estimate), and Red Tag (flags the unit for safety). Edits auto-save."
        ]
      },
      {
        "h": "Good to know",
        "body": "Attach the checklist to a trip charge in the Pricebook to put it in front of techs. You can Export a checklist to Excel and Import one to replace it. Platform owners get an organization picker."
      }
    ]
  },
  {
    "id": "bulk-import",
    "title": "Data Station (Import Hub)",
    "area": "Data Station",
    "keywords": [
      "data station",
      "import",
      "import hub",
      "bulk",
      "spreadsheet",
      "csv",
      "upload",
      "migrate",
      "onboarding",
      "customers",
      "properties",
      "jobs",
      "parts",
      "pricebook"
    ],
    "purpose": "The Data Station is where you load your existing data into Journey from spreadsheets instead of entering it by hand. Each tile opens a guided importer that walks you through matching your columns and previewing rows before anything is saved.",
    "sections": [
      {
        "h": "What it is for",
        "body": "This is the onboarding and bulk-load hub — the fastest way to get an existing business’s records into Journey, and to keep price files current afterward. Pick the tile for the kind of data you have and the importer handles column-matching and a preview so nothing lands blind."
      },
      {
        "h": "The import tools",
        "items": [
          "Import Customers — names, contacts, and billing details. Import Properties — service addresses linked to their owning customers. Import Jobs — historical or in-flight jobs for complete records and reporting.",
          "Import Services Pricebook — your service and labor pricing (incl. trip charges and variants). Import Systems Pricebook — equipment/full-system pricing for install estimates. Import Filter Price Book — retail filter prices by size/type/MERV (feeds the customer portal).",
          "Import Parts Catalog — the parts master (names, units, reorder levels, markups). Import Vendor Price File — a vendor’s parts prices to keep material costs current. Import Tools — durable tools (brand, model/serial, purchase date and cost)."
        ]
      },
      {
        "h": "Good to know",
        "body": "Import in dependency order — Customers and Properties before Jobs — so each job can find its customer and property. Also on the Data Station rail: the Pricebook, Systems Pricebook, Special Features, Discount Catalog, PM Checklists, System Estimate Setup, and Checklists setup pages. Platform owners get an organization picker on the individual importers."
      }
    ]
  }
]

export const ROUTE_HELP = {
  "/system-estimate-setup": "system-estimate-setup",
  "/pm-checklists": "pm-checklists",
  "/pricebook": "pricebook",
  "/systems-pricebook": "systems-pricebook",
  "/special-features": "special-features",
  "/discount-catalog": "discount-catalog",
  "/checklists": "job-checklists",
  "/import": "bulk-import"
}
