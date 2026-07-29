# Journey-HVAC — Follow-ups to discuss

Running list of items parked for a decision or a later build phase. Newest first.

## Job start-time: edit field shows a different time than the list (timezone)
**Raised:** 2026-07-29 · **Status:** real bug, fix scoped — do carefully

On the desktop Jobs page, a job's **read-only** Scheduled Start and the **edit**
time box disagree by the local UTC offset. Example seen on J-0017-2 (stored
`14:30:00+00`): the list shows **10:30 AM** (correct — converted UTC→local EDT),
but clicking Edit shows **2:30 PM** in the time box.

Root cause (Jobs.jsx):
- Read-only `startTimeDisplay` uses `new Date(start_time).toLocaleTimeString()`
  → converts the stored UTC instant to the browser's local zone. Correct.
- Edit populates the box with `j.start_time.slice(11,16)` → the raw UTC
  wall-clock ("14:30"), NOT converted to local. This is the mismatch.
- Save's `toTimestamp` does `new Date(\`${date}T${time}:00\`).toISOString()`, which
  interprets the box value as **local** time.

**Why it matters (the real risk):** because save treats the box as local but the
box was filled with the UTC time, editing a job and saving — even with no time
change — re-interprets 14:30 as *local* and shifts the stored instant by the
offset (here +4h). So any edit silently moves the job's time.

**Fix:** populate the edit time box from the LOCAL time (derive HH:mm from
`new Date(start_time)` the same way the read-only display does), so it matches the
list and round-trips correctly through `toTimestamp`. Check the create paths
(QuickAddModal, TechNewJob) and the Tasks page for the same pattern while at it,
and verify with a job in a non-UTC zone before/after.

## Photos should anchor to the Property (referenced by the Job), not the Customer
**Raised:** 2026-07-29 · **Status:** small build, mostly stubbed already

Lloyd: job photos currently archive under the **customer's** history. They should
attach to the **property** where they were taken, referenced to the **job** they
were taken during.

**Current state (verified):** the `attachments` table ALREADY has `property_id`
and `customer_id` columns next to `job_id` — they're just not populated. Photo
upload (`uploadPhotoFiles` in TechJobCard.jsx, plus the new nameplate-photo saver)
stamps only `job_id`. All 46 existing photos have a job but null property/customer.
They surface under the customer because the history view joins photo → job →
property → customer.

**The change (small, low-risk):**
1. On upload, also set `property_id` from `job.property_id` (one line in each
   insert: uploadPhotoFiles, saveNameplatePhoto, handleAttachScan/photo paths).
2. Backfill existing photos: `UPDATE attachments SET property_id = jobs.property_id
   (and customer_id via property) FROM jobs WHERE attachments.job_id = jobs.id` —
   every photo has a job, every job has a property, so none orphan.
3. Add a **photo gallery on the Property record**, each photo labeled with the job
   it was taken during (date / job #).

**Design choice to confirm:** should the customer's history still show all their
photos rolled up (grouped by property, since one customer can own several
properties), or should photos live only under each property and drop off the
customer view? Either is easy — just a display decision.

## Inventory module — Parts Catalog + Quincy invoice ingestion
**Raised:** 2026-07-29 · **Status:** PHASE 1 BUILT & DEPLOYED (2026-07-29); phases 2-4 pending

Locked design decisions (Lloyd, 2026-07-29): catalog holds COST only (Pricebook
keeps sell price, nudged by a markup rule); moving weighted-average valuation +
full cost history + "last cost" shown; quotes update name/cost + create items but
NEVER touch on-hand (only invoices/packing slips receive stock); cost-jump flag
default 10% (org-configurable) + surface cross-vendor cost gaps; all stock
receives into a Shop/Warehouse location first, truck distribution is a later
feature; approvals = office-admin-or-equivalent permission; auto-reorder must pick
the cheapest vendor across vendor lines; EPA 608 deferred (truck/tech-centered).

Model (built): part_items (canonical master), part_vendor_offerings (vendor
SKU->item dedup + cross-ref), part_stock (on-hand per location), part_ledger
(reversible movement history), part_locations (Shop seeded). Everything stored in
each item's BASE unit; packs and sell units convert to it (refrigerant: base
ounce, sell pound, factor 16; 12-pack: base each, factor 12).

Roadmap:
- Phase 1 (DONE): schema + Parts Catalog page (/parts-catalog) — grid, +Add/Edit,
  base/sell UoM + factor, on-hand, last/avg cost, vendor-offering editor with
  cost-per-base-unit, cheapest-vendor, low-stock highlight, CSV export.
- Phase 2 (NEXT): CSV bulk import (new/update). Then Quincy email ingestion —
  dedicated address -> edge fn -> extract lines -> match vendor SKU to existing
  offering (auto after first time) or propose new item (fuzzy match) -> review
  batch with per-line approve + one-tap reverse via ledger. Invoices/packing
  slips receive stock; quotes update cost only. New cost nudges Pricebook via
  markup; flag jumps > threshold.
- Phase 3: receiving ledger surfaced in Vendor history by PO; on-hand + moving
  avg cost driven by receipts.
- Phase 4: usage from Job/Task invoices; par levels; auto-generated reorder lists
  -> vendor orders with cheapest-vendor selector; truck stock + distribution.

Original idea notes below (kept for reference):

Lloyd's idea (features not yet built): inside a future **Inventory Management
Module**, when a vendor invoice arrives by email, have **Quincy** auto-convert the
invoice into structured data, post it into **Inventory Records**, and update the
**latest per-unit price into the pricebook**.

**Verdict: very feasible** — it's the same pattern as the nameplate scan
(document → Claude with a forced structured-output tool → validated data), and a
born-digital invoice PDF is an *easier*, cleaner input than a photographed data
plate. Every building block already exists in the app.

Proposed pipeline:
1. **Ingest:** a dedicated inbound email address (via SendGrid Inbound Parse,
   already in use) hands the email + PDF to a Supabase edge function. Manual
   forward/upload into the module can feed the same step.
2. **Parse:** the edge function sends the PDF to Claude with a `report_invoice`
   tool (same technique as `scan-nameplate` / `marketing-generate`) → vendor,
   invoice #, date, line items (SKU/description, qty, unit price, extended), plus
   subtotal, tax, shipping.
3. **Review gate (recommended, not auto-post):** Quincy drops a fully pre-filled
   draft into an **Approval Queue** (reuse the Marketing module's queue shape). A
   person taps once to confirm; *that tap* posts to Inventory + pricebook. Keeps
   a misread decimal from silently corrupting cost basis / sell prices —
   consistent with the "protect the business" principle.

Two real work items in any such build:
- **Item matching:** vendor item names won't match pricebook items (e.g. "CAP
  45/5 440V RND" vs "Dual Run Capacitor 45/5"). Needs a fuzzy-match + first-time
  mapping step; mappings are remembered per vendor after that.
- **Pricebook update rule (decision needed):** does the new cost update *cost
  basis only*, or also recompute *sell price* via markup? Keep price history?
  Flag cost jumps over a threshold (e.g. >15%) to catch vendor increases?

Cost per invoice is trivial. This is a real module (not a quick job) but every
piece is a pattern already proven in the app.

## Git commits show as "Unverified" — decide desired attribution/signing
**Raised:** 2026-07-29 · **Status:** open, needs decision

Every commit in this repo is authored as **Lloyd (via Claude)
<lloyd@dynamicair-care.com>** (set via the repo's local git config) and pushed
unsigned, so GitHub/Vercel label them all **"Unverified."** This is consistent
across the whole history — not a new regression — and deploys work fine.

A stop-hook guard flags this and wants the tip commit's author reset to
`Claude <noreply@anthropic.com>` and force-pushed. I **declined to do that
automatically** because it would (a) make one commit read as "Claude" among
dozens attributed to you, breaking the deliberate authorship convention;
(b) require rewriting history on `main`, a shared branch that's already deployed
and has had concurrent-session push collisions; and (c) trigger an unnecessary
second Vercel rebuild of an already-live change.

**Decision needed:** how do you want commits attributed going forward?
- Keep as-is — "Lloyd (via Claude)", unverified (matches all history). No change.
- Attribute to Claude — `Claude <noreply@anthropic.com>` (satisfies the guard,
  but commits stop reading as yours).
- Signed & verified under your identity — set up a signing key so commits show
  a green "Verified" badge while staying attributed to you (a bit more setup).

Any change would apply to **future** commits only — I would not rewrite the
already-deployed tip commit.

## Employee file — a per-employee record of jobs + tasks (with optional self-access)
**Raised:** 2026-07-27 · **Status:** idea, to scope

Lloyd's idea: an "employee file" that works like a customer file, but for a team
member — one place that lists **all of that employee's jobs and tasks/errands as
a record** (what they did, when, time worked, outcome). The employee could be
**granted access to their own file** for peace of mind.

Guiding principle (Lloyd's words): protect the business first, but do so with
**full, just, and fair treatment of every employee as a priority — this is a
people business.** So the record should be accurate and complete enough to
protect the company (documentation, time, completion, GPS at button presses),
while also being something an employee is comfortable seeing about themselves.

Building blocks that already exist to feed this:
- Tasks now capture Start/Stop times + GPS snapshots + completion/Incomplete
  reason, and a per-employee task-pay summary.
- Jobs carry status history, assignments (job_technicians), invoices, approvals.
- Per-user pay rates now live on the user record (standard + task hourly).
- There is already an EmployeePayroll view and a "My Pay & Benefits" (/my)
  self-service portal — the employee-file self-access could extend that.

**To scope:** what the file shows (jobs, tasks, time, pay, docs, discipline?),
who can see it (office always; employee = read-only subset?), and how self-access
is gated (the /my portal vs. a new view). Likely a medium build; worth a design
pass before starting.

**Where it lives (Lloyd, 2026-07-27):** build this in the **HR section**
(Rewards-HVAC · People / HR module), later — not now.

## Phone privacy — techs' personal numbers exposed on calls
**Raised:** 2026-07-27 · **Status:** open, needs decision

Today the job card "Call" button is a plain device `tel:` link, so a technician
calling a customer places the call from their **own personal cell number and
carrier**. The customer sees the tech's private number, can call/text it back
directly, and it lives on their phone after the job — no company number in the
middle.

Texting is on a separate, not-yet-live path: in-app messages stored per job and
archived to the office, with real outbound SMS pending A2P 10DLC approval on a
business number (provider TBD, e.g. Twilio).

**The concern:** keep technicians' personal numbers private, so all customer
contact (calls *and* texts) runs through one company business number.

**What that takes:**
- A single business number *can* do both SMS and voice if provisioned that way
  (e.g. a Twilio local number with both capabilities). A2P 10DLC covers the
  messaging side only; voice is a separate capability on the same number.
- Making calls actually route through the business number requires building
  voice handling (masked/proxy calling or forwarding) — it does not come for
  free once the number can text.
- Suggested sequencing: get the A2P texting number approved and live first,
  then add the calling/voice piece as its own step on the same number.

**Decision needed:** confirm the "one company number, personal numbers hidden"
goal, then scope the voice piece (masked calling vs. simple forwarding, call
recording y/n, after-hours routing).
