// Living help/documentation for Journey — Fleet Management section.
// Kept in its own file so the large HelpArticles.js stays stable; HelpDrawer
// merges these in. Same article shape as HELP_ARTICLES:
//   { id, title, area, keywords:[], purpose, sections:[ { h, items?:[], body? } ] }
export const FLEET_HELP_ARTICLES = [
  {
    id: 'fleet-dashboard',
    title: 'Fleet Dashboard',
    area: 'Fleet',
    keywords: ['fleet', 'dashboard', 'flags', 'red', 'amber', 'compliance', 'monitor', 'overview'],
    purpose: 'Your at-a-glance health check for every vehicle, with red and amber flags pulled from across the Fleet section so nothing slips.',
    sections: [
      { h: 'What you see', items: [
        'Two counters up top: red flags (act now) and amber flags (worth a look) across the whole fleet.',
        'A Compliance panel: insurance and document expirations, and vehicles due for an inspection.',
        'A card per vehicle with its odometer, last MPG, average cost per gallon, last fill date, and any flags.',
      ]},
      { h: 'What gets flagged', items: [
        'Unusual fuel or mileage — over-tank fills, low MPG, a price spike, or a strange odometer reading.',
        'Maintenance coming due — within 500 miles or 7 days (amber), or past due (red).',
        'Insurance or registration expiring — inside the warning window (amber) or lapsed (red).',
        'A vehicle due for its periodic inspection.',
      ]},
      { h: 'Good to know', body: 'The flags are produced by the other Fleet screens — Fuel, Maintenance, Inspections, and Insurance & Documents — so the dashboard stays honest as those are kept current. Mileage comes from the odometer entered on fuel fills.' },
    ],
  },
  {
    id: 'fleet-vehicles',
    title: 'Vehicles',
    area: 'Fleet',
    keywords: ['vehicle', 'truck', 'vin', 'plate', 'roster', 'driver', 'assign', 'make', 'model', 'mpg', 'tank'],
    purpose: 'The fleet roster — add each vehicle, its details, and who drives it.',
    sections: [
      { h: 'What you can do', items: [
        'Add a vehicle with year, make, model, VIN, license plate, and color.',
        'Record tank capacity and the expected MPG range — these power the fuel flags on the dashboard.',
        'Track purchase date, purchase price, in-service date, and ownership (owned, leased, financed).',
        'Assign a driver; reassigning keeps a dated history of who was responsible when.',
      ]},
      { h: 'Good to know', body: 'The current driver also shows on the vehicle card and links a truck to its stocking location in Inventory. A tight expected-MPG range makes the low/high-MPG flags more useful.' },
    ],
  },
  {
    id: 'fleet-fuel',
    title: 'Fuel Log',
    area: 'Fleet',
    keywords: ['fuel', 'gas', 'fill', 'odometer', 'mpg', 'gallons', 'cost', 'import', 'card', 'station'],
    purpose: 'Every fill-up. This is the source of both fuel cost and the mileage the rest of Fleet relies on.',
    sections: [
      { h: 'How to use it', items: [
        'Log each fill: date, odometer, gallons, total cost, station, and fuel card if you use one.',
        'Or import a batch of fills from a fuel-card export.',
        'Enter the odometer every time — it is what makes MPG and mileage-based flags work.',
      ]},
      { h: 'What it computes', items: [
        'Cost per gallon, miles per gallon, and cost per mile for each fill.',
        'Flags for a fill that exceeds the tank, low or unusually high MPG, or a price spike.',
      ]},
      { h: 'Good to know', body: 'The odometer here drives the dashboard mileage, the oil-change-by-miles maintenance flag, and the mileage side of inspection due dates. No odometer means MPG and those flags cannot be computed.' },
    ],
  },
  {
    id: 'fleet-maintenance',
    title: 'Maintenance',
    area: 'Fleet',
    keywords: ['maintenance', 'pm', 'oil change', 'service', 'schedule', 'interval', 'miles', 'days', 'wash', 'tune-up', 'due'],
    purpose: 'Preventive-maintenance schedules that flag when service is due — and the place to pre-schedule recurring date-driven tasks like washes.',
    sections: [
      { h: 'How to use it', items: [
        'Create a task with an interval by miles, days, or engine hours — e.g. oil change every 5,000 miles, or an exterior wash every 14 days.',
        'Set the last-done baseline (odometer or date) so the countdown is accurate.',
        'When the work is done, complete the task — that logs a service record and resets the schedule.',
      ]},
      { h: 'When it flags', items: [
        'Mileage-based tasks turn amber within 500 miles of due; time-based tasks within 7 days.',
        'Anything past due turns red. Both show on the Fleet Dashboard.',
      ]},
      { h: 'Good to know', body: 'Mileage comes from the fuel log odometer, so oil changes flag on their own once fills are being logged. Use days-based tasks for car washes, tune-ups, and any other recurring date-driven job so they flag the same way.' },
    ],
  },
  {
    id: 'fleet-repairs',
    title: 'Repairs & Cost',
    area: 'Fleet',
    keywords: ['repair', 'issue', 'breakdown', 'cost', 'labor', 'parts', 'downtime', 'vendor', 'defect'],
    purpose: 'Track what is wrong with a vehicle and what the repairs cost.',
    sections: [
      { h: 'How to use it', items: [
        'Log an issue with a severity; open issues flag on the dashboard.',
        'Record a repair with labor, parts, vendor, and downtime hours.',
        'Resolving a repair closes the issue it fixed.',
      ]},
      { h: 'What it rolls up', body: 'Total repair cost and downtime per vehicle, so you can see which trucks are getting expensive.' },
      { h: 'Good to know', body: 'Failed inspection items open issues here automatically, so a bad inspection turns straight into a repair to-do.' },
    ],
  },
  {
    id: 'fleet-routes',
    title: 'Routes & GPS',
    area: 'Fleet',
    keywords: ['route', 'gps', 'miles', 'mileage', 'driven', 'explained', 'honest', 'usage', 'personal use'],
    purpose: 'Compare the miles a vehicle actually drove against the miles its jobs explain — an honest-use check.',
    sections: [
      { h: 'What it shows', items: [
        'Miles driven (from the fuel-log odometer) versus miles explained by scheduled jobs, per vehicle, over a trailing window.',
        'A red flag when driving is well above what the jobs account for.',
      ]},
      { h: 'Good to know', body: 'It needs fuel odometer readings and job routes to compare. GPS breadcrumbs are shown when a driver has them, as supporting context.' },
    ],
  },
  {
    id: 'fleet-inspections',
    title: 'Inspections',
    area: 'Fleet',
    keywords: ['inspection', 'checklist', 'dvir', 'pass', 'fail', 'housekeeping', 'tires', 'wash', 'cadence', 'due'],
    purpose: 'A walk-around vehicle checklist. Failed items become repairs, and each vehicle is flagged when an inspection comes due.',
    sections: [
      { h: 'How to use it', items: [
        'Pick a vehicle, run the checklist marking each item pass, fail, or N/A, and add a note on anything wrong.',
        'Submitting opens a repair issue for every failed item, so defects are not lost.',
      ]},
      { h: 'Customize the checklist', items: [
        'Use Manage checklist to copy the standard list, then add your own items — Tech housekeeping, tire wear, exterior wash, tune-up — and remove any you do not use.',
        'Your list is what techs see on every inspection from then on.',
      ]},
      { h: 'When it is due', items: [
        'Use Schedule to set a cadence by time or miles, whichever comes first (for example every 90 days or 5,000 miles).',
        'Each vehicle shows OK, Due soon, or Overdue, and due vehicles flag on the dashboard.',
      ]},
      { h: 'Good to know', body: 'The mileage side of the cadence uses the odometer from fuel logs, so keep fills current for the miles trigger to work.' },
    ],
  },
  {
    id: 'fleet-insurance',
    title: 'Insurance & Documents',
    area: 'Fleet',
    keywords: ['insurance', 'policy', 'proof', 'card', 'registration', 'title', 'dot', 'legal', 'document', 'expiration', 'plate renewal'],
    purpose: 'Keep every vehicle legal: insurance policy details with printable proof, plus registration and other legal documents, all with expiration flags.',
    sections: [
      { h: 'Insurance policies', items: [
        'Record the carrier, policy number, NAIC, effective and expiration dates, coverage summary, and agent.',
        'A policy can cover the whole fleet or a specific set of vehicles.',
        'Upload the insurer card as proof; View / Print opens it in a new tab to print from the office.',
      ]},
      { h: 'Registration & other legal documents', items: [
        'Track registration, title, DOT/MC number, emissions, and permits.',
        'Each can carry its number, an expiration date, and a scan of the document.',
      ]},
      { h: 'When it flags', body: 'Expirations show amber inside their warning window and red once lapsed, on the dashboard Compliance panel. License-plate/registration defaults to a 30-day warning.' },
      { h: 'Good to know', body: 'Proof of insurance prints from the desktop only, to keep it under office control — it is never exposed on the mobile app. Insurance and financing payment records are a bookkeeping function and are intentionally not tracked here.' },
    ],
  },
]

// Route -> article id for context-aware Help. Specific /fleet/* paths must come
// BEFORE the bare /fleet base, because the drawer matches by startsWith.
export const FLEET_ROUTE_HELP = {
  '/fleet/vehicles': 'fleet-vehicles',
  '/fleet/fuel': 'fleet-fuel',
  '/fleet/maintenance': 'fleet-maintenance',
  '/fleet/repairs': 'fleet-repairs',
  '/fleet/routes': 'fleet-routes',
  '/fleet/inspections': 'fleet-inspections',
  '/fleet/insurance': 'fleet-insurance',
  '/fleet': 'fleet-dashboard',
}
