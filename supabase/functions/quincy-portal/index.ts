import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// quincy-portal — Quincy inside the homeowner app. Every mode works ONLY on the signed-in
// customer's own records (looked up from the auth user server-side; ids from the client are
// checked against that customer before use).
//
//   { mode: 'chat', messages }      → { reply, action? }
//        Quincy can PROPOSE an action (book a visit, reorder their usual filters, approve or
//        decline a pending estimate). Nothing happens until the customer taps Confirm in the app,
//        which runs the same steps the app's own screens use. Quincy is only offered the actions
//        that are actually possible for this customer (e.g. no filter reorder without sizes on file).
//   { mode: 'explain', kind, id }   → { plain, take }   kind: 'invoice' | 'estimate' | 'report'
//        Plain-language explanation + Quincy's honest, neutral take — kept separate from the
//        company's offer, grounded only in the document's own lines / readings.
//   { mode: 'notices' }             → { notices: [...] }
//        "Quincy noticed…" cards for Home. Deterministic (no AI): tech on the way, upcoming visit,
//        estimate waiting, balance due, plan tune-up due, filters due, warranty ending.
//        Each card's button opens that specific item (the appointments page, that invoice), not all records.
//        More than one open invoice → ONE card with the full count and total (never just one of them).
//
// (Staff previewing the portal may chat; explain/notices need a customer.)

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const MODEL = "claude-sonnet-4-5";
const TZ = "America/New_York";
const WIN: Record<string, string> = { "8_11": "8–11 AM", "10_1": "10 AM–1 PM", "12_3": "12–3 PM", "2_5": "2–5 PM", asap: "as soon as possible" };
const money = (n: unknown) => `$${Number(n || 0).toFixed(2)}`;
const todayISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const addDays = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysBetween = (a: string, b: string) => Math.round((new Date(b + "T12:00:00Z").getTime() - new Date(a + "T12:00:00Z").getTime()) / 86400000);
const fmtDay = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
const fmtDate = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const sizeOf = (f: any) => [f.width, f.height, f.thickness].filter(Boolean).join("×");
const balOf = (i: any) => Number(i.balance ?? i.amount_due ?? 0);

async function claude(apiKey: string, body: Record<string, unknown>) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, ...body }),
  });
  if (!r.ok) throw new Error(`Quincy had trouble responding (${r.status}).`);
  return await r.json();
}

// ---------- the customer's own world ----------
async function loadWorld(admin: any, cust: any) {
  const today = todayISO();
  const { data: props } = await admin.from("properties").select("id, street_address, unit, city").or(`customer_id.eq.${cust.id},bill_to_customer_id.eq.${cust.id}`);
  const propIds = (props || []).map((p: any) => p.id);
  const none = { data: [] as any[] };
  const [eq, fl, plans, visits, jobs, invs, filterInv] = await Promise.all([
    propIds.length ? admin.from("property_equipment").select("system_label, install_date, manufacture_year, outdoor_brand, indoor_brand, furnace_brand, refrigerant_type").in("property_id", propIds).neq("status", "retired") : none,
    propIds.length ? admin.from("property_filters").select("property_id, width, height, thickness, merv, quantity, location").in("property_id", propIds) : none,
    admin.from("maintenance_agreements").select("status, billing_cycle, next_visit_due_date, tier:maintenance_agreement_tiers(name)").eq("customer_id", cust.id).eq("status", "active"),
    admin.from("maintenance_visits").select("due_date, period_label, status, job_id").eq("customer_id", cust.id).neq("status", "completed").order("due_date").limit(3),
    propIds.length ? admin.from("jobs").select("id, job_type, status, job_date, start_time, requested_window, completed_at, date_pending").in("property_id", propIds).is("deleted_at", null).order("job_date", { ascending: false }).limit(40) : none,
    admin.from("invoices").select("id, invoice_number, kind, estimate_type, approval_status, job_total, balance, amount_due, invoice_date, is_filter_order, paid_at, created_at").eq("bills_to_customer_id", cust.id).is("deleted_at", null).order("created_at", { ascending: false }).limit(40),
    propIds.length ? admin.from("invoices").select("created_at").in("property_id", propIds).eq("is_filter_order", true).is("deleted_at", null).order("created_at", { ascending: false }).limit(1) : none,
  ]);
  const allJobs = jobs.data || [];
  const upcoming = allJobs.filter((j: any) => !["completed", "canceled", "cancelled", "incomplete"].includes(j.status) && j.job_date && j.job_date >= today)
    .sort((a: any, b: any) => a.job_date.localeCompare(b.job_date));
  const onMyWay = allJobs.filter((j: any) => j.status === "on_my_way" && j.job_date === today);
  const completed = allJobs.filter((j: any) => j.status === "completed").slice(0, 3);
  const invoices = invs.data || [];
  const pendingEst = invoices.filter((i: any) => i.kind === "estimate" && (!i.approval_status || /pending/i.test(i.approval_status)));
  // Oldest first — that's the one to settle first.
  const unpaid = invoices.filter((i: any) => i.kind !== "estimate" && balOf(i) > 0.009)
    .sort((a: any, b: any) => String(a.invoice_date || a.created_at || "").localeCompare(String(b.invoice_date || b.created_at || "")));
  let lastFilterOrder: string | null = filterInv.data?.[0]?.created_at ? String(filterInv.data[0].created_at).slice(0, 10) : null;
  if (propIds.length) {
    const { data: subs } = await admin.from("filter_subscriptions").select("last_ordered_at").in("property_id", propIds).not("last_ordered_at", "is", null).order("last_ordered_at", { ascending: false }).limit(1);
    const s = subs?.[0]?.last_ordered_at ? String(subs[0].last_ordered_at).slice(0, 10) : null;
    if (s && (!lastFilterOrder || s > lastFilterOrder)) lastFilterOrder = s;
  }
  return { today, props: props || [], equip: eq.data || [], filters: fl.data || [], plans: plans.data || [], visits: visits.data || [], upcoming, onMyWay, completed, pendingEst, unpaid, lastFilterOrder };
}

function contextText(cust: any, w: any) {
  const p: string[] = [`Customer name: ${cust.display_name || "the customer"}. Today is ${fmtDay(w.today)}.`];
  if (w.equip.length) p.push("Equipment: " + w.equip.map((e: any) => {
    const brand = [e.outdoor_brand, e.indoor_brand, e.furnace_brand].filter(Boolean)[0] || "system";
    return `${e.system_label || brand} (${brand}${e.install_date ? `, installed ${e.install_date}` : ""}${e.manufacture_year ? `, made ${e.manufacture_year}` : ""}${e.refrigerant_type ? `, ${e.refrigerant_type}` : ""})`;
  }).join("; ") + ".");
  else p.push("No equipment recorded yet.");
  if (w.filters.length) p.push("Filters: " + w.filters.map((f: any) => `${f.quantity || 1}× ${sizeOf(f)} MERV ${f.merv || "?"}${f.location ? ` (${f.location})` : ""}`).join("; ") + (w.lastFilterOrder ? `. Last filter order: ${fmtDate(w.lastFilterOrder)}.` : ". No filter orders through the app yet."));
  else {
    const next = w.upcoming[0];
    p.push(`Filter sizes: NOT on file yet, so you can NOT reorder filters for them. Don't offer to. If filters come up, say plainly that you don't have their filter size yet and ` +
      (next ? `that the technician can measure and record it at their ${String(next.job_type || "visit").toLowerCase()} on ${fmtDay(next.job_date)}` : "offer to book a visit, or have them use \"Ask us to identify my filters\" on the Order My AC Filters screen") +
      `. They can also read the size printed on the edge of their current filter and tell the office.`);
  }
  if (w.plans.length) p.push(`Maintenance plan: ${w.plans.map((x: any) => x.tier?.name || "plan").join(", ")} (active).` + (w.visits.length ? ` Next plan visit due ${fmtDate(w.visits[0].due_date)}${w.visits[0].job_id ? " (already scheduled)" : " (not booked yet)"}.` : ""));
  else p.push("No active maintenance plan.");
  if (w.onMyWay.length) p.push("A technician is ON THE WAY right now.");
  if (w.upcoming.length) p.push("Upcoming visits: " + w.upcoming.slice(0, 3).map((j: any) => `${j.job_type || "Visit"} on ${fmtDay(j.job_date)}${j.requested_window && WIN[j.requested_window] ? `, ${WIN[j.requested_window]}` : ""}${j.date_pending ? " (time to be confirmed by the office)" : ""}`).join("; ") + ".");
  else p.push("No upcoming visits booked.");
  if (w.completed.length) p.push("Recent completed visits: " + w.completed.map((j: any) => `${j.job_type || "Visit"} ${j.job_date ? fmtDate(j.job_date) : ""}`).join("; ") + ".");
  if (w.pendingEst.length) p.push("Estimates waiting for the customer's decision (estimate_id → details): " + w.pendingEst.map((e: any) => `${e.id} → ${e.estimate_type === "system" ? "System estimate" : "Estimate"} #${e.invoice_number}, ${money(e.job_total)}`).join("; ") + ".");
  if (w.unpaid.length) {
    const total = w.unpaid.reduce((t: number, i: any) => t + balOf(i), 0);
    p.push(`Unpaid invoices (${w.unpaid.length}, ${money(total)} total): ` + w.unpaid.map((i: any) => `#${i.invoice_number} balance ${money(balOf(i))}`).join("; ") + ".");
  }
  return p.join(" ");
}

// ---------- notices ----------
function notices(w: any) {
  const out: any[] = [];
  const t = w.today;
  for (const j of w.onMyWay) out.push({ id: `omw-${j.id}`, tone: "go", title: "Your technician is on the way", body: `For your ${String(j.job_type || "visit").toLowerCase()} today.`, cta: { label: "See my appointments", to: "/portal/appointments" } });
  const soon = w.upcoming.filter((j: any) => j.status !== "on_my_way" && daysBetween(t, j.job_date) <= 3);
  for (const j of soon.slice(0, 2)) {
    const d = daysBetween(t, j.job_date);
    const when = d === 0 ? "today" : d === 1 ? "tomorrow" : fmtDay(j.job_date);
    out.push({ id: `up-${j.id}`, tone: "info", title: `Your ${String(j.job_type || "visit").toLowerCase()} is ${when}`, body: j.date_pending ? "The office will confirm the exact time." : (WIN[j.requested_window] ? `Arrival window ${WIN[j.requested_window]}.` : "We'll see you then."), cta: { label: "See my appointments", to: "/portal/appointments" } });
  }
  for (const e of w.pendingEst.slice(0, 2)) out.push({ id: `est-${e.id}`, tone: "warn", title: `An estimate is waiting for you`, body: `${e.estimate_type === "system" ? "System estimate" : "Estimate"} #${e.invoice_number}. I can explain every line in plain English, and give you my honest take.`, cta: { label: "Explain it", explain: { kind: "estimate", id: e.id } } });
  const v = w.visits.find((x: any) => !x.job_id && x.due_date && daysBetween(t, x.due_date) <= 30);
  if (v && w.plans.length) out.push({ id: `pm-${v.due_date}`, tone: "go", title: daysBetween(t, v.due_date) < 0 ? "Your tune-up is past due" : "Your tune-up is due soon", body: `It's included in your maintenance plan${v.period_label ? ` (${v.period_label})` : ""}. Want me to book it?`, cta: { label: "Book my tune-up", ask: "Please book my maintenance tune-up." } });
  if (w.filters.length && w.lastFilterOrder) {
    const thick = Math.max(...w.filters.map((f: any) => Number(f.thickness) || 1));
    const life = thick >= 4 ? 180 : 90;
    const age = daysBetween(w.lastFilterOrder, t);
    if (age >= life - 14) out.push({ id: `flt-${w.lastFilterOrder}`, tone: "info", title: "Your filters are about due", body: `It's been about ${Math.round(age / 30)} months since your last order (${w.filters.map((f: any) => sizeOf(f)).join(", ")}). Most ${thick >= 4 ? "4–5 inch" : "1–2 inch"} filters last about ${life === 90 ? "3" : "6"} months.`, cta: { label: "Reorder my filters", ask: "Please reorder my usual filters." } });
  }
  for (const e of w.equip) {
    if (!e.install_date) continue;
    const name = e.system_label || [e.outdoor_brand, e.indoor_brand].filter(Boolean)[0] || "your system";
    const labor = addDays(e.install_date, 365);
    const dl = daysBetween(t, labor);
    if (dl >= 0 && dl <= 60) out.push({ id: `lw-${e.install_date}`, tone: "warn", title: "Your labor warranty ends soon", body: `The 1-year labor & refrigerant coverage on ${name} ends ${fmtDate(labor)}. If anything seems off, now's the time to have it looked at.`, cta: { label: "See my warranty", to: "/portal/equipment" } });
  }
  // Balances: the whole picture, never just one of several.
  if (w.unpaid.length === 1) {
    const i = w.unpaid[0];
    out.push({ id: `bal-${i.id}`, tone: "info", title: `Invoice #${i.invoice_number} has a balance`, body: `${money(balOf(i))} due. You can pay securely by card on the invoice.`, cta: { label: "View invoice", invoice: i.id } });
  } else if (w.unpaid.length > 1) {
    const total = w.unpaid.reduce((t2: number, i: any) => t2 + balOf(i), 0);
    out.push({ id: `bal-all-${w.unpaid.length}-${total.toFixed(2)}`, tone: "info", title: `You have ${w.unpaid.length} open invoices`, body: `${money(total)} due in total. You can view each one and pay securely by card.`, cta: { label: "See my invoices", to: "/portal/records?tab=invoices" } });
  }
  return out;
}

// ---------- explain ----------
const EXPLAIN_SYS = `You are Quincy, the honest helper inside a heating & cooling company's homeowner app. You explain one document to the homeowner who received it.
Reply with ONLY a JSON object: {"plain": "...", "take": "..."}
- "plain": what this document says, in plain friendly language, a few short sentences. Group charges or items simply. No jargon without a one-line explanation.
- "take": your honest, neutral opinion, kept separate from the company's offer. Rules:
  • Ground every statement in the lines/readings given. Never invent details, prices, or findings.
  • For an estimate: say which items look needed now, which could reasonably wait, and which look optional — but only as far as the descriptions and recorded readings support. When a recorded reading supports an item, cite the reading next to the claim (e.g. "reads 31 µF against a 45 µF rating"). If the reason for a recommendation isn't shown, say so and suggest asking the technician for the reading or measurement behind it. You can't see the system, so never claim a part is definitely bad.
  • For a service report: name anything flagged or out of range, WITH its recorded reading. If everything passed, say plainly that the system checked out fine and nothing needs doing.
  • For an invoice: explain what was paid for; don't suggest more work.
  • Never pressure, never upsell. It is fine — good, even — to say "nothing here needs doing right now" or "it's reasonable to get a second opinion."
Keep each field under about 90 words.`;

async function explain(admin: any, apiKey: string, cust: any, w: any, kind: string, id: string) {
  const propIds = new Set(w.props.map((p: any) => p.id));
  let content = "";
  if (kind === "invoice" || kind === "estimate") {
    const { data: inv } = await admin.from("invoices").select("id, invoice_number, kind, estimate_type, job_total, amount_due, balance, bills_to_customer_id, property_id, invoice_date, job_id, reference_job_id").eq("id", id).maybeSingle();
    if (!inv || (inv.bills_to_customer_id !== cust.id && !propIds.has(inv.property_id))) return { error: "Document not found." };
    const { data: lines } = await admin.from("invoice_line_items").select("description, quantity, unit_price, sort_order").eq("invoice_id", id).order("sort_order");
    const lt = (lines || []).map((l: any) => `- ${l.description || "Item"}${l.quantity ? ` (qty ${l.quantity})` : ""}${l.unit_price != null ? ` @ ${money(l.unit_price)}` : ""}`).join("\n");
    content = `${inv.kind === "estimate" ? (inv.estimate_type === "system" ? "SYSTEM ESTIMATE" : "ESTIMATE") : "INVOICE"} #${inv.invoice_number}, total ${money(inv.job_total ?? inv.amount_due)}.\nLines:\n${lt || "(no itemized lines)"}`;
    // Readings the technician recorded on the same visit, so the take can cite them.
    const jobRef = inv.job_id || inv.reference_job_id;
    if (inv.kind === "estimate" && jobRef) {
      const { data: runs } = await admin.from("checklist_runs").select("id").eq("job_id", jobRef).eq("status", "completed").limit(3);
      const ids = (runs || []).map((r: any) => r.id);
      if (ids.length) {
        const { data: rr } = await admin.from("checklist_results").select("inspection_task, maintenance_task, value_recorded, record_units, spec_label, red_tag, status, notes").in("run_id", ids).or("red_tag.eq.true,value_recorded.not.is.null").limit(40);
        const rl = (rr || []).map((r: any) => `- ${r.inspection_task || r.maintenance_task || "Item"}: ${r.value_recorded ? `${r.value_recorded}${r.record_units ? " " + r.record_units : ""}` : r.status || ""}${r.spec_label ? ` (spec ${r.spec_label})` : ""}${r.red_tag ? " — RED TAG" : ""}${r.notes ? ` — ${r.notes}` : ""}`).join("\n");
        if (rl) content += `\nReadings the technician recorded on that visit:\n${rl}`;
      }
    }
    if (inv.estimate_type === "system" && w.equip.length) content += `\nCurrent equipment on file: ${w.equip.map((e: any) => `${e.system_label || "system"}${e.install_date ? ` installed ${e.install_date}` : ""}${e.manufacture_year ? `, made ${e.manufacture_year}` : ""}`).join("; ")}.`;
  } else if (kind === "report") {
    const { data: run } = await admin.from("checklist_runs").select("id, job_id, checklist_name, completed_at").eq("id", id).maybeSingle();
    if (!run) return { error: "Report not found." };
    const { data: job } = await admin.from("jobs").select("property_id").eq("id", run.job_id).maybeSingle();
    if (!job || !propIds.has(job.property_id)) return { error: "Report not found." };
    const { data: res } = await admin.from("checklist_results").select("section_name, inspection_task, maintenance_task, item_type, record_units, spec_label, red_tag, status, value_recorded, notes, sort_order").eq("run_id", id).order("sort_order");
    const lt = (res || []).map((r: any) => `- [${r.section_name || ""}] ${r.inspection_task || r.maintenance_task || "Item"}: ${r.status || ""}${r.value_recorded ? `, reading ${r.value_recorded}${r.record_units ? " " + r.record_units : ""}` : ""}${r.spec_label ? ` (spec ${r.spec_label})` : ""}${r.red_tag ? " — RED TAG" : ""}${r.notes ? ` — note: ${r.notes}` : ""}`).join("\n");
    content = `SERVICE REPORT: ${run.checklist_name || "Maintenance report"}${run.completed_at ? `, completed ${String(run.completed_at).slice(0, 10)}` : ""}.\nItems:\n${lt || "(no items recorded)"}`;
  } else return { error: "Unknown document type." };
  const data = await claude(apiKey, { max_tokens: 700, system: EXPLAIN_SYS, messages: [{ role: "user", content }] });
  const text = (data?.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("").trim();
  const m = text.match(/\{[\s\S]*\}/);
  try { const o = JSON.parse(m ? m[0] : text); return { plain: String(o.plain || ""), take: String(o.take || "") }; }
  catch { return { plain: text, take: "" }; }
}

// ---------- chat ----------
const TOOLS = [
  { name: "propose_booking", description: "Offer to book a visit for the customer. The app then shows them real open times to pick from and confirm. Use when they ask to book, or agree to book after a symptom answer.", input_schema: { type: "object", properties: { visit_type: { type: "string", enum: ["repair", "pm", "system_quote"], description: "repair = something is wrong; pm = maintenance tune-up; system_quote = estimate for a new system" }, details: { type: "string", description: "Short note for the technician in the customer's words, e.g. 'AC running but not cooling since this morning'." } }, required: ["visit_type"] } },
  { name: "propose_filter_reorder", description: "Offer to reorder the customer's usual filters (the sizes on file). The app shows the items and they confirm.", input_schema: { type: "object", properties: {} } },
  { name: "propose_estimate_decision", description: "Offer to record the customer's decision on one of their pending estimates. Only when they clearly say they want to approve or decline it.", input_schema: { type: "object", properties: { estimate_id: { type: "string" }, decision: { type: "string", enum: ["approved", "declined"] } }, required: ["estimate_id", "decision"] } },
];

// Only hand Quincy the actions that can actually happen for this customer.
function toolsFor(w: any) {
  return TOOLS.filter((t) =>
    (t.name !== "propose_filter_reorder" || w.filters.length > 0) &&
    (t.name !== "propose_estimate_decision" || w.pendingEst.length > 0));
}

function chatSystem(orgName: string, ctx: string, canReorder: boolean) {
  return `You are Quincy, the friendly AI helper inside ${orgName}'s app for homeowners. Warm, plain-spoken, genuinely helpful — like a knowledgeable friend in the HVAC business. Keep replies short and conversational (it's a phone chat). No headers or long lists unless they ask for steps.

SAFETY FIRST: If they mention a gas smell, a carbon monoxide alarm, smoke, a burning smell, or sparking, tell them to leave the home now and call 911 or the gas company. Nothing else in that reply.

HOW TO HELP:
- For a symptom, briefly explain the LIKELY causes in plain language and the few safe checks a homeowner can do: the air filter, the thermostat (setting/batteries), the breaker, vents open, outdoor unit not blocked. Then offer to book a visit — use propose_booking.
- General questions (filters, MERV, how often, what a plan covers) — just answer. They don't need to end in a visit.
- Use their own info below when it helps: their equipment and ages, filter sizes, plan, upcoming visits, estimates, balances. If they ask "when's my next visit?" answer from it.

YOU CAN DO THINGS (always with their confirmation in the app — never say it's done until they confirm):
- propose_booking — book a repair, a maintenance tune-up, or a new-system estimate.
${canReorder ? "- propose_filter_reorder — reorder their usual filters.\n" : ""}- propose_estimate_decision — approve or decline one of their pending estimates, only when they clearly say so.
When you use one, also write one short sentence telling them to confirm below.
ONLY OFFER WHAT YOU CAN ACTUALLY DO FOR THIS CUSTOMER. Never close with an offer ("need to reorder? just let me know!") for something their info below says isn't possible yet — tell them what's missing and the real next step instead.

HONESTY: Never pressure or upsell. It's fine to say something can wait, or that their system sounds fine. You can't see the system, so don't state a definite diagnosis or that a part is bad. Never give hands-on repair steps (no refrigerant, no opening equipment, no electrical work beyond a breaker). Never quote repair prices.

APP SCREENS you can point to (use these exact names): "See My Equipment Details" (system, warranties, System Health), "My Upcoming Appointments" (visits in the next 30 days), "Schedule My Appointment", "Preventive Maintenance" (their plan), "Access My Service Records" (all appointments, invoices, estimates — each has an Explain button), "View My Service Reports", "Order My AC Filters".

WARRANTY POLICY (general; exact dates are in "See My Equipment Details"): parts 10 years — from install if this company installed it, otherwise from the unit's manufacture date, honored to any owner. Labor and refrigerant 1 year from install.
${ctx ? "\nWHAT WE KNOW ABOUT THIS CUSTOMER (speak naturally; never mention a database): " + ctx : ""}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "chat";
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Please sign in." }, 401);
    const caller = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await caller.auth.getUser().catch(() => ({ data: { user: null } } as any));
    if (!user) return json({ error: "Please sign in." }, 401);

    const { data: cust } = await admin.from("customers").select("id, display_name, org_id").eq("auth_user_id", user.id).maybeSingle();
    if (!cust) {
      const { data: staff } = await admin.from("users").select("is_active").eq("id", user.id).maybeSingle();
      if (!staff?.is_active) return json({ error: "Not authorized." }, 403);
      if (mode !== "chat") return json(mode === "notices" ? { notices: [] } : { error: "Sign in as a customer to use this." });
    }
    const w = cust ? await loadWorld(admin, cust) : null;

    if (mode === "notices") return json({ notices: notices(w) });

    if (!apiKey) return json({ error: "Quincy is not configured yet." }, 500);

    if (mode === "explain") {
      const r = await explain(admin, apiKey, cust, w, String(body.kind || ""), String(body.id || ""));
      return json(r, (r as any).error ? 404 : 200);
    }

    // chat
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length) return json({ error: "messages array is required" }, 400);
    let orgName = "your heating & cooling company";
    if (cust) { const { data: org } = await admin.from("organizations").select("name, dba_name").eq("id", cust.org_id).single(); orgName = org?.dba_name || org?.name || orgName; }
    const ctx = cust && w ? contextText(cust, w) : "";
    const tools = cust && w ? toolsFor(w) : undefined;
    const canReorder = !!(w && w.filters.length);
    const msgs = messages.filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string").slice(-20).map((m: any) => ({ role: m.role, content: m.content }));
    const data = await claude(apiKey, { max_tokens: 700, system: chatSystem(orgName, ctx, canReorder), messages: msgs, tools });
    let reply = (data?.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
    const tool = (data?.content || []).find((b: any) => b.type === "tool_use");
    let action: any = null;
    if (tool && cust && w) {
      const inp = tool.input || {};
      const pid = w.props.some((p: any) => p.id === body.property_id) ? body.property_id : (w.props[0]?.id || null);
      const myFilters = w.filters.filter((f: any) => f.property_id === pid);
      if (tool.name === "propose_booking" && ["repair", "pm", "system_quote"].includes(inp.visit_type)) {
        action = { kind: "book", visit_type: inp.visit_type, details: String(inp.details || "").slice(0, 400), property_id: pid };
      } else if (tool.name === "propose_filter_reorder" && myFilters.length) {
        action = { kind: "filters", property_id: pid, items: myFilters.map((f: any) => ({ width: f.width, height: f.height, thickness: f.thickness, merv: f.merv, qty: Math.max(1, Number(f.quantity) || 1) })) };
      } else if (tool.name === "propose_estimate_decision") {
        const est = w.pendingEst.find((e: any) => e.id === inp.estimate_id);
        if (est && ["approved", "declined"].includes(inp.decision)) action = { kind: "estimate", estimate_id: est.id, number: est.invoice_number, total: Number(est.job_total || 0), decision: inp.decision };
      }
      if (!action && tool.name === "propose_filter_reorder") reply = "I don't have the filter size for this home on file yet, so I can't reorder just yet. The technician can measure it at your next visit — or check the size printed on the edge of your current filter and let the office know.";
    }
    if (!reply) reply = action ? "Here you go — just confirm below." : "Sorry, I didn't catch that — could you try that again?";
    return json({ reply, action });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
