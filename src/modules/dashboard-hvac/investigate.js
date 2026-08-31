// Dashboard-HVAC · "Investigate" (P5). Turns one KPI + its current data into the
// props for the shared <AiAssist> panel, which calls the `ai-assist` edge
// function. The AI only ever sees the compact facts we pass in `context` — the
// metric, its target, and its numbers for the selected period.

const SYSTEM = `You are an operations analyst for a residential & commercial HVAC field-service company. You are handed ONE metric (KPI) from the owner's dashboard, its data for a period, and any target. Help the owner investigate it.

Reply in short, skimmable plain text using exactly these labels:
Read: one sentence on what the number is saying (healthy / concerning / mixed).
Likely drivers: 2-4 bullets, most likely first, specific to HVAC field service (pricing, dispatch & scheduling, callbacks/warranty, membership & agreement mix, parts markup, tech productivity & overtime, estimate close rate, seasonality, fuel/mileage, AR/collections).
Do next: 2-4 concrete steps the owner can take this week and where in the business to look.
Watch: one signal to track to confirm it's improving.

Rules: Use ONLY the numbers provided — never invent figures or name specific people beyond those given. If the data is too sparse to judge, say so and name what to collect. Keep the whole reply under ~180 words. This is advisory, not a guarantee.`

function summarize(rows, def) {
  if (!rows || !rows.length) return 'No data for this period.'
  if (def.viz === 'tile' || def.viz === 'gauge') return { value: Number(rows[0].value) }
  if (def.viz === 'estimates') {
    const g = (b) => { const r = rows.find((x) => x.bucket === b); return r ? Number(r.value) : null }
    return { presented: g('Presented $'), sold: g('Sold $'), close_rate_pct: g('Close rate %') }
  }
  // category / time / flags → up to 10 labelled rows
  return rows.slice(0, 10).map((r) => ({ name: r.bucket, value: r.value == null ? null : Number(r.value) }))
}

export function investigateProps(card, meta) {
  const d = card.def
  const context = {
    company_type: 'HVAC field service',
    organization: meta.orgName || null,
    metric: d.label,
    what_it_measures: d.sub || null,
    unit: d.unit,
    period: meta.period,
    target: d.target != null ? d.target : null,
    target_rule: d.target != null ? (d.targetDir === 'ceiling' ? 'should stay at or below target' : 'should stay at or above target') : null,
    data: summarize(card.rows, d),
  }
  return {
    title: 'Investigate: ' + d.label,
    system: SYSTEM,
    prompt: 'Analyze "' + d.label + '" for the ' + meta.period + ' period. What should I investigate, and what should I do?',
    context,
  }
}
