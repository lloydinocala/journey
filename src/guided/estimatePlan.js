// Shared rules for the guided New System Estimate (the Estimate App flow inside Journey).
// Mirrors the customer-facing Estimate App so a quote built here matches what a homeowner
// would see online: same pricebook rows, sizing, brand groups, favorites, Best Value and adders.
import { supabase } from '../utils/supabase'

export const PLACEHOLDER_PRICES = new Set([25000, 6500])
export const FAMILY_KEYS = ['budget', 'common', 'trending', 'premium']

export const famKey = (f) => {
  const s = String(f || '').toLowerCase()
  if (s.includes('budget')) return 'budget'
  if (s.includes('common')) return 'common'
  if (s.includes('trend')) return 'trending'
  if (s.includes('premium')) return 'premium'
  return null
}
export const brandKey = (b) => String(b || '').trim().toUpperCase()
export const brandDisplay = (b) => String(b || '').trim().split(/(\s+|\(|\))/).map((w) =>
  !w.trim() || w === '(' || w === ')' ? w : w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()
).join('')
export const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('en-US')

// Everything the guided flow needs for one org, in one load.
export async function loadGuidedCatalog(orgId) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from('equipment')
      .select('id, system_type, size_tons, outdoor_brand, outdoor_series, outdoor_model, outdoor_description, indoor_brand, indoor_model, indoor_description, furnace_model, furnace_description, ahri_ref, cooling_capacity, eer2, seer2, home_type, energy_star, labor_warranty, manufacturer_warranty_years, lineset_requirements, installation_price, recommended, best_value, brand_family')
      .eq('org_id', orgId).eq('active', true).not('installation_price', 'is', null).range(from, from + 999)
    rows.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  const systems = rows
    .filter((r) => { const p = Number(r.installation_price), t = Number(r.size_tons); return p > 0 && !PLACEHOLDER_PRICES.has(p) && t > 0 && t <= 10 })
    .map((r) => ({ ...r, size_tons: Number(r.size_tons), seer2: r.seer2 == null ? null : Number(r.seer2), installation_price: Number(r.installation_price), brandKey: brandKey(r.outdoor_brand), brandName: brandDisplay(r.outdoor_brand), fam: famKey(r.brand_family) }))
  const [{ data: org }, { data: logoRows }, { data: quals }] = await Promise.all([
    supabase.from('organizations').select('name, system_installation_includes, system_installation_includes_by_type, system_warranty_template, system_thermostat_default, system_thermostat_price').eq('id', orgId).single(),
    supabase.from('brand_logos').select('brand_key, logo_url').eq('org_id', orgId),
    supabase.from('equipment_qualifiers').select('qualifier_key, qualifier_label, price_adder').eq('org_id', orgId).eq('active', true),
  ])
  const logos = {}; (logoRows || []).forEach((l) => { logos[brandKey(l.brand_key)] = l.logo_url })
  const qualifiers = {}; (quals || []).forEach((q) => { qualifiers[q.qualifier_key] = q })
  return {
    systems, logos, qualifiers,
    orgName: String(org?.name || '').replace(/\s+(LLC|Inc\.?|Corp\.?)$/i, ''),
    templates: {
      install: org?.system_installation_includes || '',
      installByType: org?.system_installation_includes_by_type || {},
      warranty: org?.system_warranty_template || '',
      thermostat: org?.system_thermostat_default || '',
    },
  }
}

export const Plan = {
  dbTypes(sysAnswer, homeKind, fam) {
    const apt = homeKind === 'apt'
    if (sysAnswer === 'electric') {
      if (fam === 'trending') return [apt ? 'Apt Side-Discharge' : 'Side-Discharge']
      if (fam) return [apt ? 'Apt Split' : 'Split']
      return apt ? ['Apt Split', 'Apt Side-Discharge'] : ['Split', 'Side-Discharge']
    }
    if (sysAnswer === 'package') return ['Packaged']
    if (sysAnswer === 'gas') return ['Gas']
    return ['Split']
  },
  families: (sysAnswer) => (sysAnswer === 'electric' ? FAMILY_KEYS : ['budget', 'common', 'premium']),
  homeOk(row, homeKind) {
    const h = String(row.home_type || 'Both').toLowerCase()
    if (h.includes('both')) return true
    const manufOnly = h.includes('manufactured') || h.includes('mobile')
    return manufOnly ? homeKind === 'mobile' : homeKind !== 'mobile'
  },
  rows(systems, { sysAnswer, homeKind, fam }) {
    const types = Plan.dbTypes(sysAnswer, homeKind, fam)
    return systems.filter((r) => types.includes(r.system_type) && (!fam || r.fam === fam) && Plan.homeOk(r, homeKind))
  },
  // Never undersize: the requested size, or the next size up this lineup offers. Side-discharge = whole tons.
  sized(rows, tons) {
    const target = (r) => (String(r.system_type).includes('Side-Discharge') ? Math.ceil(tons) : tons)
    const ok = rows.filter((r) => r.size_tons >= target(r) - 0.001)
    if (!ok.length) return { size: null, rows: [] }
    const size = Math.min(...ok.map((r) => r.size_tons))
    return { size, rows: ok.filter((r) => r.size_tons === size) }
  },
  brands(systems, ctx, tons) {
    const byBrand = new Map()
    for (const r of Plan.rows(systems, ctx)) {
      const b = byBrand.get(r.brandKey) || { key: r.brandKey, name: r.brandName, fav: false, bestValue: false, all: [] }
      b.all.push(r); if (r.recommended) b.fav = true; if (r.best_value) b.bestValue = true
      byBrand.set(r.brandKey, b)
    }
    const out = []
    for (const b of byBrand.values()) { const { size, rows } = Plan.sized(b.all, tons); if (rows.length) out.push({ ...b, size, rows }) }
    return out.sort((a, b) => (b.fav - a.fav) || (b.bestValue - a.bestValue) || a.name.localeCompare(b.name))
  },
  seerLevels(rows) {
    const m = new Map()
    for (const r of rows) { const k = r.seer2 ?? 0; if (!m.has(k) || r.installation_price < m.get(k).installation_price) m.set(k, r) }
    return [...m.values()].sort((a, b) => (a.seer2 || 0) - (b.seer2 || 0))
  },
  typeLabel(row) {
    const t = String(row?.system_type || '')
    if (t.includes('Side-Discharge')) return 'Side-Discharge Heat Pump'
    if (t === 'Packaged') return 'Package Unit'
    if (t === 'Gas') return 'Gas Furnace System'
    return 'Split System Heat Pump'
  },
  groupSubtitle(sysAnswer, fam) {
    if (sysAnswer === 'package') return 'Packaged Units'
    if (sysAnswer === 'gas') return 'Gas Furnace Systems'
    if (fam === 'trending') return 'Side-Discharge Heat Pumps'
    return 'Split System Heat Pumps'
  },
  familyLabel(fam) {
    return { budget: 'Budget-Friendly', common: 'Commonly Purchased', trending: `Trending in ${new Date().getFullYear()}`, premium: 'Premium Products' }[fam]
  },
  familyHeading(fam) {
    return { budget: 'BUDGET-MINDED', common: 'COMMONLY PURCHASED', trending: 'TRENDING THIS YEAR', premium: 'PREMIUM BRANDS' }[fam]
  },
  familySub(fam) {
    return {
      budget: 'Reliable options designed to keep replacement costs practical.',
      common: 'Commonly selected brands with a strong balance of price, features, and availability.',
      trending: 'Side-discharge systems — higher efficiency, quieter, and slimmer.',
      premium: 'Higher-end brand options with stronger features, efficiency choices, or warranty support.',
    }[fam]
  },
  tonsFromSqft(sqft, homeKind, coolWell) {
    const divisor = homeKind === 'mobile' ? 500 : 650
    let t = Math.max(1.5, Math.ceil(((Number(sqft) || 0) / divisor) * 2) / 2)
    if (coolWell === 'struggled') t = Math.ceil((t + 0.5) * 2) / 2
    return Math.min(t, 5)
  },
  isRooftop: (loc) => String(loc || '').includes('rooftop'),
}

// Which adders apply (same rules as the online app); prices come from Equipment Qualifiers.
export function calcAdders(answers, qualifiers) {
  const applied = []
  const apply = (key) => { const q = qualifiers[key]; if (q) applied.push({ key, label: q.qualifier_label, amount: Number(q.price_adder) || 0 }) }
  if (answers.floodZone === 'yes') apply('flood_zone')
  if (answers.systemAge === 'new') apply('system_age_new')
  if (answers.systemAge === 'old') apply('system_age_old')
  if (answers.hoa === 'yes') apply('hoa_approval')
  if (answers.buildingFloor === 'second') apply('second_floor_lineset')
  if (answers.installLocation) apply(`install_${answers.installLocation}`)
  return { applied, total: applied.reduce((s, a) => s + a.amount, 0) }
}

export function quoteLines(eq, cat) {
  if (!eq) return []
  const t = String(eq.system_type || '')
  const isPkg = t === 'Packaged', isGas = t === 'Gas'
  const lines = []
  if (eq.ahri_ref) lines.push(`AHRI # ${eq.ahri_ref}`)
  if (isPkg) { if (eq.outdoor_model) lines.push(`Package Unit: ${eq.outdoor_model}`) } else {
    if (isGas && eq.furnace_model) lines.push(`Gas Furnace: ${eq.furnace_model}`)
    if (eq.indoor_model) lines.push(`${isGas ? 'Evaporator Coil' : 'Air Handler (AHU)'}: ${eq.indoor_model}`)
    const kw = !isGas && String(eq.indoor_description || '').match(/(\d+(?:\.\d+)?)\s*-?\s*KW/i)
    if (kw) lines.push(`${kw[1]} KW Auxiliary Heat`)
    if (eq.outdoor_model) lines.push(`Condenser: ${eq.outdoor_model}`)
  }
  if (cat?.templates?.thermostat) lines.push(cat.templates.thermostat)
  if (!isPkg && eq.lineset_requirements) lines.push(String(eq.lineset_requirements).replace(/Copper Lines\b/i, 'Copper Lineset'))
  const block = cat?.templates?.installByType?.[t] || cat?.templates?.install || ''
  block.split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean).forEach((s) => lines.push(s))
  return lines
}
export function warrantyLines(eq) {
  const out = []
  const m = Number(eq?.manufacturer_warranty_years); if (m) out.push(`${m}-Year Manufacturer's Warranty`)
  const lab = Number(eq?.labor_warranty); if (lab) out.push(`${lab}-Year Labor Warranty`)
  return out
}

const BASE_CATS = ['INDOOR_UNIT', 'OUTDOOR_UNIT', 'FURNACE', 'INSTALLATION', 'ALSO_INCLUDES', 'THERMOSTAT', 'WARRANTY']
export const ADDER_PREFIX = 'Site condition — '

// Writes the chosen system onto a System Estimate, in the same sections the manual picker
// uses (indoor / outdoor / furnace / installation / thermostat / lineset / warranty), plus one
// line per site-condition adder. The total equals the guided quote's price.
export async function writeSystemToEstimate({ estimate, eq, cat, adders, answers }) {
  const orgId = estimate.org_id
  await supabase.from('invoice_line_items').delete().eq('invoice_id', estimate.id).in('category', BASE_CATS)
  await supabase.from('invoice_line_items').delete().eq('invoice_id', estimate.id).eq('category', 'SPECIAL_FEATURE').like('description', `${ADDER_PREFIX}%`)

  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim()
  const indoorDesc = [
    eq.ahri_ref ? `AHRI# ${eq.ahri_ref}` : null,
    ['INDOOR UNIT', clean(`${eq.indoor_brand || ''} ${eq.size_tons ?? ''} TON ${eq.indoor_description || ''}`)].join('\n'),
    eq.indoor_model ? `Model # ${eq.indoor_model}` : null,
  ].filter(Boolean).join('\n\n')
  const outdoorDesc = [
    ['OUTDOOR UNIT', clean(`${eq.outdoor_brand || ''} ${eq.size_tons ?? ''} TON, ${eq.seer2 ?? ''} SEER2 ${eq.outdoor_description || ''}`)].join('\n'),
    eq.outdoor_model ? `Model # ${eq.outdoor_model}` : null,
  ].filter(Boolean).join('\n\n')
  const t = cat.templates
  const forType = (t.installByType && t.installByType[eq.system_type]) || ''
  let installBody = (forType.trim() ? forType : t.install) || ''
  if (Plan.isRooftop(answers.installLocation)) installBody += `${installBody ? '\n\n' : ''}Rooftop installation: crane/rigging may add $800–$2,000. The exact amount is confirmed with the customer for approval before delivery.`
  const installDesc = ['Installation includes:', installBody].filter(Boolean).join('\n\n')
  const warrantyBody = (t.warranty || '')
    .replace(/\{manufacturer_years\}/g, eq.manufacturer_warranty_years != null ? String(eq.manufacturer_warranty_years) : '')
    .replace(/\{contractor_years\}/g, eq.labor_warranty != null ? String(eq.labor_warranty) : '')

  const rows = [
    { description: indoorDesc, unit_price: eq.installation_price || 0, category: 'INDOOR_UNIT', sort_order: 10 },
    { description: outdoorDesc, unit_price: 0, category: 'OUTDOOR_UNIT', sort_order: 20 },
  ]
  if (eq.furnace_model) rows.push({ description: [['FURNACE', clean(`${eq.indoor_brand || ''} ${eq.furnace_description || ''}`)].filter(Boolean).join('\n'), `Model # ${eq.furnace_model}`].join('\n\n'), unit_price: 0, category: 'FURNACE', sort_order: 25 })
  rows.push({ description: installDesc, unit_price: 0, category: 'INSTALLATION', sort_order: 30 })
  if (t.thermostat) rows.push({ description: `THERMOSTAT\n\n${t.thermostat}`, unit_price: 0, category: 'THERMOSTAT', sort_order: 35 })
  if (eq.system_type !== 'Packaged' && eq.lineset_requirements) rows.push({ description: ['Also includes:', eq.lineset_requirements].join('\n\n'), unit_price: 0, category: 'ALSO_INCLUDES', sort_order: 40 })
  ;(adders || []).filter((a) => a.amount).forEach((a, i) => rows.push({ description: `${ADDER_PREFIX}${a.label}`, unit_price: a.amount, category: 'SPECIAL_FEATURE', sort_order: 90 + i }))
  rows.push({ description: ['WARRANTY', warrantyBody].filter(Boolean).join('\n\n'), unit_price: 0, category: 'WARRANTY', sort_order: 10000 })

  const { error } = await supabase.from('invoice_line_items').insert(rows.map((r) => ({ ...r, invoice_id: estimate.id, org_id: orgId, quantity: 1, taxable: false, is_custom: false })))
  if (error) throw new Error(error.message)
  // Keep the estimate's totals current even before the estimate page is opened.
  const { data: all } = await supabase.from('invoice_line_items').select('quantity, unit_price, taxable, is_custom, custom_status').eq('invoice_id', estimate.id)
  const billable = (all || []).filter((li) => !(li.is_custom && li.custom_status === 'pending'))
  const subtotal = billable.reduce((s, li) => s + (Number(li.quantity) || 0) * (Number(li.unit_price) || 0), 0)
  await supabase.from('invoices').update({ subtotal, job_total: subtotal, amount_due: subtotal, balance: subtotal }).eq('id', estimate.id)
}
