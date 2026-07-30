# Journey-HVAC — Session Handoff

**Purpose:** let a fresh chat (or Lloyd) resume with zero lost momentum.
**Last updated:** 2026-07-30

---

## 1. What this is

Journey-HVAC is a multi-tenant SaaS field-service app.

- **Stack:** React + Vite (plain JSX), react-router-dom v6, Supabase (Postgres +
  RLS + edge functions + storage), Vercel (auto-deploys on push to `main`).
- **Live at:** journey-hvac.app
- **Brand colors:** `#FF0000` red, `#002060` navy, `#FFFFFF`, `#000000`.
- **Supabase project:** `journey-core` — project id `gatndtsmjrxdgxquvydw`
  (region us-east-2). There is a second, older project `air-care-connect1`
  (`dalertxugwgkfsyizmly`) — **do not touch it**; all current work is journey-core.
- **GitHub:** `github.com/lloydinocala/journey`. Deploy = push to `main`:
  `git push "https://x-access-token:${PAT}@github.com/lloydinocala/journey.git" HEAD:main`
  where `${PAT}` is the fine-grained GitHub PAT Lloyd pastes into chat (it is
  **not** stored in this repo; ask him for a fresh one if pushes 401).

## 2. Lloyd's standing priorities (design compass)

- Build for **SaaS scale** — thousands of subscribers, per-tenant, zero
  per-subscriber manual infra.
- **Minimize human interaction** and **minimize human error** (guard rails,
  confirmations, sane defaults over free typing).
- **Aesthetically attractive** UI; hold it to a high standard ("set the standard").
- If Lloyd is away and a decision is needed, **use judgment aligned with the
  above and proceed**, then report the assumption.
- Never rewrite deployed git history; never enter his passwords / sign in as him.
- He prefers **generic item names** (e.g. "R-410a Refrigerant") even though each
  vendor names things differently.

## 3. Timezone layer (built & deployed)

`src/utils/tz.js` — per-organization timezone so times render/parse in the org's
zone, not the viewer's device zone (Texas/Central is a marketing target).
`organizations.timezone` column drives it; `loadOrgTz(orgId)` primes a cache on
login (App.jsx) and per-page org pickers set it for super-admins. All job/calendar/
task time surfaces route through the helpers. **One known bug remains** — see
FOLLOWUPS.md "Job start-time: edit field shows a different time" (edit box shows
raw UTC wall-clock; any save silently shifts the instant). Fix is scoped there.

## 4. Parts Catalog / Inventory module (Phase 1 built & deployed)

Full locked design + roadmap live in **FOLLOWUPS.md** ("Inventory module"). Summary:

**Tables (all in journey-core):**
- `part_items` — canonical master. Cost lives here (`last_cost`, `avg_cost` in the
  item's BASE unit); sell price stays in Pricebook. `is_active` (false = hidden).
  `sell_unit_factor` = base units per sell unit (refrigerant: base ounce, sell
  pound, factor 16).
- `part_vendor_offerings` — vendor SKU → item cross-reference / dedup. Holds
  `pack_base_qty` (base units per purchase pack — a 25 lb R-410A jug = 400 oz),
  `last_cost_per_pack`, `last_cost_per_base_unit`. Unique index on
  (org, vendor, lower(vendor_sku)).
- `part_stock` — on-hand per (item, location).
- `part_ledger` — reversible movement history; `seq bigint` gives deterministic
  ordering for last-cost. `flagged`/`flag_reason` for cost-jump alerts.
- `part_locations` — Shop/Warehouse seeded per org (trucks later).
- `part_inbound_invoices` / `part_inbound_config` — emailed-invoice queue.

**Two conversions — do not conflate (this caused the R-410A bug):**
- `sell_unit_factor` = base units per SELL unit (Pricebook side; 16 oz/lb).
- `pack_base_qty` = base units per PURCHASE pack (receiving side; 400 oz/jug).

**Key RPCs:** `part_receive(p_org, p_vendor, p_reference, p_received_at, p_note,
p_lines jsonb)` — inserts receipt header + ledger + updates part_stock + recomputes
cost + nudges Pricebook by markup. **Does NOT touch part_vendor_offerings** (manage
offerings separately). Lines: `[{item_id, qty_base, cost_per_base}]`.
`part_reverse_receipt(p_batch)` cancels a batch. `part_recompute_item_cost(p_item)`.

**Cost recompute:** moving weighted average over cost-bearing ledger entries;
`last_cost` = newest non-reversed receive by `seq desc`.

**FK cascade:** `part_vendor_offerings`, `part_stock`, `part_ledger` all
ON DELETE CASCADE from `part_items` — deleting an item cleans up its children
(the receipt *header* in `part_receipts` is keyed by vendor, not item, so delete
it explicitly when removing an item's sole receipt).

**Pages/components:**
- `src/PartsCatalog.jsx` — grid (search, Add/Edit, **Delete/Deactivate** [new],
  base/sell UoM + factor, on-hand, last/avg cost, cheapest vendor, low-stock red,
  vendor-offerings drawer, CSV export, Receive Stock modal, Receipts panel with
  reverse, "Import from Invoice · Quincy" button, Quincy Inbox panel, Import CSV).
- `src/PartsCatalogImport.jsx` — CSV bulk import/update (match by name).
- `src/QuincyInvoiceImport.jsx` — upload→extract→review→apply modal.

**Edge functions (deployed):** `scan-nameplate` (Sonnet 4.5), `invoice-extract`
(report_invoice tool, PDF via document block), `inbound-invoice` (verify_jwt=false,
token-guarded, routes recipient local-part → `organizations.invoice_inbox_slug`,
stores attachment, extracts, inserts pending queue row). Secrets used:
`ANTHROPIC_API_KEY`, `SENDGRID_API_KEY`.

## 5. Email invoice intake (built & tested end-to-end)

SendGrid **Inbound Parse** on an authenticated subdomain — one MX + one parse
config catches all mail to `*@inbox.journey-hvac.app`, POSTs to the
`inbound-invoice` webhook; per-subscriber routing by recipient local-part →
`organizations.invoice_inbox_slug`. Scales to thousands with zero per-subscriber
infra. `journey-hvac.app` was domain-authenticated in SendGrid (3 CNAMEs added to
GoDaddy, verified). A simulated SendGrid POST created a pending queue row with 4
extracted lines; test data was scrubbed. **Not yet done:** the optional Microsoft
365 auto-forward rule (vendor invoices currently land in lloyd@dynamicair-care.com;
forward them to the intake address) and a live end-to-end email test.

## 6. Just completed this session

1. **R-410A data corrected.** Item `c4c30b13-...` "R-410a Refrigerant" now:
   base ounce / sell pound / factor 16, `last_cost = avg_cost = 0.5417/oz`
   (= $8.67/lb), on-hand 400 oz (the 25 lb jug), one Johnstone offering
   (SKU B92-910, "25 lb jug", pack_base_qty 400, $216.68/pack). The duplicate
   item `9552013a-...` (which had pack size 1 → the wrong $216.68/oz) was deleted
   (cascaded its offering/stock/ledger) and its orphan receipt header removed.
2. **Delete/Deactivate added to Parts Catalog** (Lloyd's explicit ask). Row Delete
   button → in-app confirmation modal. Items with stock/offerings/cost history
   warn and offer a safe **Deactivate (hide, keep history)** alongside permanent
   delete; empty items delete cleanly. Grid now hides `is_active=false` items.
   Deployed (commit 612be33).

## 7. Next up (priority order)

1. **Quincy matching + pack-size intelligence** (the crux of Lloyd's last
   question — "will Quincy recognize R-410a from each new vendor without me
   editing?"). Work in `src/QuincyInvoiceImport.jsx`:
   - **(a) Infer pack size from the vendor description** ("25 LBS", "1 GAL",
     "12/CS") so new items get the right `pack_base_qty` instead of the current
     hard-coded `each`/`1`. This is what forced the R-410A manual fix.
   - **(b) Let the reviewer set base unit + pack size for NEW items** in the
     review screen (today they're forced to base `each`, factor 1).
   - **(c) Show live cost-per-base-unit** in the review row so a bad pack size is
     obvious before approval.
   - **(d) Smarter first-time fuzzy match** on key tokens (R410A, "45/5
     capacitor") so generic items match across vendors; after the first approval
     the vendor SKU→item mapping is remembered via `part_vendor_offerings`.
   - Net effect Lloyd wants: first time he approves R-410A from a new vendor he
     may confirm the mapping once; every time after, Quincy auto-recognizes it.
2. **M365 auto-forward rule** + a live email intake test (optional, his call).
3. **FOLLOWUPS.md** items: job start-time edit bug (real, scoped); photos →
   property anchoring (small); git attribution/signing decision (needs Lloyd).

## 8. Gotchas

- `execute_sql` with multiple statements returns only the **last** result set —
  wrap multi-part inspection in a single `json_build_object(...)` query.
- `part_receive` runs `auth.uid()` for created_by → NULL under service-role SQL;
  harmless for data fixes.
- Screenshots via claude-in-chrome intermittently time out — retry works.
- GoDaddy DNS form: target Name/Value inputs **by element ref** (page
  auto-scrolls, fixed coords miss) and save records **one at a time**.
