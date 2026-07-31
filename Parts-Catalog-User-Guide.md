# Parts Catalog — User Guide

*Journey HVAC · Operations → Parts Catalog*

A plain-language guide to what the Parts Catalog does, how to use it step by step, and what it will and won't do. Written for an office user with no technical background, and structured so it can be turned into an instructional video and a feature/marketing video.

---

## 1. What this page is (purpose)

The Parts Catalog is your company's **master list of every part and material you buy** — capacitors, refrigerant, copper line, thermostats, equipment, and so on. For each item it keeps three things in one place:

1. **What it costs you** — pulled automatically from your vendor invoices, tracked over time.
2. **How much you have on hand** — your current shop stock.
3. **Who sells it, and for how much** — every vendor's part number, pack, and price, side by side.

The headline idea: **you keep one clean, generic item** (for example, "R‑410a Refrigerant"), and every vendor's different name and part number for that same thing attaches underneath it. That's what lets the system read an invoice from any supplier, know exactly which of your items each line is, cost it correctly, and tell you who's cheapest.

**Where cost and price live:** the Parts Catalog holds your **cost** (what you pay). Your **selling price** stays in the Pricebook. When a new invoice comes in and your cost changes, the catalog can nudge the matching Pricebook price for you — so your pricing never silently falls behind a vendor increase.

---

## 2. A few simple ideas that make everything click

You don't have to be technical, but four small concepts explain the whole page:

**Base unit** — the smallest unit you actually use or count an item in. Refrigerant is used by the **ounce**, so its base unit is "ounce." A thermostat is used one at a time, so its base unit is "each." Everything the system tracks — stock, cost — is measured in this base unit.

**Sell unit & pack size** — you often *buy* and *sell* in bigger chunks than the base unit. You might buy refrigerant as a 25‑lb jug (that's a *pack*) and sell it by the *pound*. The system just needs to know how many base units are in each: a 25‑lb jug = 400 ounces, a pound = 16 ounces. Once it knows, it does all the math for you and always shows a true **cost per base unit** so you can compare apples to apples.

**Last cost vs. average cost** — **Last Cost** is what you paid most recently. **Average Cost** is a running, weighted average across everything you've received, so one odd price doesn't throw off your numbers. Both are shown.

**On hand** — how many base units are physically in your shop right now. It only ever changes when you **receive** stock (goes up) or use it (goes down). Editing an item never changes on hand.

---

## 3. The screen at a glance

**The action buttons across the top:**

- **+ Add Item** — create a new catalog item by hand.
- **Receive Stock** — record parts arriving into the shop (raises on‑hand and updates cost).
- **Import from Invoice · Quincy** *(red button — the star feature)* — upload a vendor invoice or photo and let Quincy read it, match the lines, and file everything for your approval.
- **Quincy Inbox** — vendor invoices that were **emailed** to your intake address, waiting for review. A number in parentheses means that many are waiting.
- **Receipts** — the history of everything received, each one reversible with one click.
- **Export CSV / Import CSV** — download the whole catalog to a spreadsheet, or bulk‑load items from one.
- **Search box** — type any part of a name, category, or vendor SKU to filter instantly.

**The columns in the table:**

Updated · Name · Category · Base Unit · Sells As · On Hand · Last Cost · Avg Cost · Vendors · Reorder · (Edit / Delete).

Low‑stock items show their On Hand in **red**. Items you don't stock show a **NON‑INV** tag and a dash for On Hand (more on that below). The **Vendors** column shows how many suppliers carry the item and who's cheapest — click it to open the vendor list.

---

## 4. How to use it — step by step

### A. Add an item by hand

1. Click **+ Add Item**.
2. Enter a clean, **generic name** you'll recognize (e.g., "Dual Run Capacitor 45/5 MFD 440V"). Keep it generic — vendor‑specific names attach later.
3. Optionally set a **Category**.
4. Leave **Track in inventory** checked for anything you stock. *Uncheck it* for equipment or one‑off items you never keep on a shelf (heat pumps, air handlers) — those keep price history but never show an on‑hand count.
5. Set the **Base unit** and, if you sell it in a larger unit, the **Sell unit** and how many base units it contains. (The system suggests common conversions, like 16 ounces per pound.)
6. Optionally set a **Reorder level** (you'll be warned in red when stock drops to it) and a **Markup %**.
7. Click save. Cost and on‑hand stay empty until you receive the item — that's normal.

### B. Add or compare vendors for an item (the "Vendors" popup)

Click the **Vendors** count on any row to open its vendor list. This is the cross‑reference between your one item and each supplier's version of it.

1. Review the vendors already listed — each shows their **SKU/part number**, **pack**, **cost per pack**, and **cost each** (per base unit), so you can see who's cheapest at a glance.
2. To add one, pick the **Vendor**, enter their **SKU / Part #**, their **description**, the **pack label** and **pack size**, and the **cost per pack**. Click **Add Vendor Offering**.
3. Use **Remove** to delete a vendor line.

You usually won't do this by hand — Quincy fills it in automatically when you approve an invoice. Add one manually when you want to **price‑shop a vendor before buying**, or to **pre‑load a part number** so the first invoice from that vendor matches automatically.

### C. Receive stock manually

Use this when parts arrive and you're entering them yourself (rather than from an invoice scan).

1. Click **Receive Stock**.
2. Choose the **vendor**, a **reference** (PO or invoice number), the **received date**, and an optional note.
3. Add a line per item: choose the item, the vendor's pack, how many packs, and the cost per pack. The system shows what it will add in base units and the cost per base unit.
4. Use **+ Add line** for more items, then approve. On‑hand rises and cost updates automatically.

### D. Import from an invoice with Quincy (the star feature)

1. Click **Import from Invoice · Quincy** and choose a PDF or photo of a vendor invoice, quote, or packing slip.
2. Quincy reads it and shows every line, already matched to your items where it can, with the vendor and date filled in.
3. **Classify the purchase.** Every line is sorted into one of four buckets — you can set them all at once at the top, then override any single line:
   - **Shop / Truck Stock** — goes into inventory (the only bucket that changes on‑hand).
   - **Hand Tools** and **Shop Supplies** — expensed, never inventoried.
   - **Job‑Specific** — the cost books to a specific job; pick the job.
   Quincy pre‑fills this from the **"Ordered under (PO/Job)"** field: a job number (like J‑0017) attaches to that job, "Truck Stock" goes to Shop, "Tools" goes to Hand Tools, and a customer's last name finds their job.
4. **Check pack sizes and matches.** For new items, confirm the base unit and pack size — Quincy guesses from the description (a "25 lb" jug becomes 400 ounces) and shows the live cost‑per‑unit so a mistake is obvious before you approve.
5. When every line is classified, click **Approve**. Shop lines receive into stock; job and tool lines are expensed. New vendor part numbers are remembered, so next time this vendor's invoice matches and classifies itself.

### E. Quincy Inbox (emailed invoices)

Vendors can email invoices straight to your company's intake address. Each one lands in the **Quincy Inbox** already read and waiting.

1. Click **Quincy Inbox** (the number shows how many are waiting).
2. Click **Review** on one — it opens the same screen as an upload, pre‑filled.
3. Classify and approve, or **Dismiss** to ignore it.

### F. Reverse a receipt

Made a mistake, or a shipment got returned?

1. Click **Receipts**.
2. Find the receipt and click **Reverse**.

This backs the quantity out (on‑hand drops, cost recalculates) and marks the receipt reversed. **The item itself stays in your catalog** — reversing undoes the *stock*, not the *item*. An item at zero on‑hand is completely normal.

### G. Edit, Delete, or Deactivate an item

- **Edit** — change any detail (name, units, category, reorder level, inventory toggle). Cleaning up a messy vendor name into a tidy generic one is done here.
- **Delete** — for a junk or accidental duplicate item. You'll get a confirmation. If the item has stock or history, it offers a safer **Deactivate (hide but keep history)** instead. An empty item deletes cleanly.

### H. Bulk import / export

- **Export CSV** downloads the whole catalog to a spreadsheet.
- **Import CSV** bulk‑loads or updates items from a spreadsheet, matched by name. (This sets up items only — cost and on‑hand still come from receiving.)

---

## 5. Limitations & restrictions (important)

- **Cost isn't typed in by hand.** An item's cost and on‑hand come from **receiving and invoices**, not from editing the item. This is deliberate — it keeps your cost basis honest and traceable to real documents.
- **Quotes never change stock.** A quote or estimate updates pricing and can create items, but never receives inventory.
- **Packing slips carry no price.** A packing slip confirms *what arrived* and can receive the quantity, but it never sets cost — cost only ever comes from a **priced invoice**. (This matches the practice of giving field staff unpriced slips while pricing arrives by email.)
- **Only Shop purchases touch on‑hand.** Hand Tools, Shop Supplies, and Job‑Specific purchases are expensed and never appear as inventory.
- **Non‑inventory items never show an on‑hand count** — by design. They exist for cost/price history (equipment, one‑offs).
- **Reversing keeps the item.** To remove an item entirely, use **Delete**; to hide one you no longer stock while keeping its history, use **Deactivate**.
- **Everything receives into the Shop first.** Distributing stock out to individual trucks is a planned future feature; today all stock lands in the shop/warehouse.
- **Duplicate protection.** If you try to import an invoice number you've already brought in, you'll get a duplicate warning before anything is saved.
- **Dates and times** display in your organization's time zone.

---

## 6. Best‑practice tips

- **Keep names generic and clean.** "R‑410a Refrigerant," not the vendor's 12‑word description. Approve invoices with an eye for quirks — a vendor's case‑pack phrase ("10 per case") can slip into a name; just tidy it in Edit.
- **Confirm pack size the first time** you see a new item from a vendor. Once it's right, it's remembered forever.
- **Let Quincy learn.** The first invoice from a vendor may need a match or two confirmed; after that, that vendor's parts recognize and classify themselves.
- **Use the Vendors popup to price‑shop** — load a competitor's price even before you buy, and the cheapest source shows right on the row.

---

## Suggested angles for the marketing/feature video

- *"Snap a photo of any vendor invoice — Quincy reads it, files it, and knows your cost."*
- *"One item, every vendor. The system always knows who's cheapest."*
- *"It learns your suppliers. The second invoice practically files itself."*
- *"Buy a 25‑lb jug, stock it by the ounce, sell it by the pound — the math is automatic."*
- *"Every dollar sorted the moment it's spent: shelf stock, shop tools, or a specific job."*
