// Duct cleaning quote engine — shared by the online Estimate App and Journey's guided duct
// estimate, so both always produce the same price from the same answers.
// Prices come from the Duct Cleaning Pricebook; how answers map to items comes from the org's
// Duct Cleaning App settings (Journey → Estimate App Setup). Missing settings fall back to the
// pricebook item names below.

export const DUCT_ROOMS = [
  ['master', 'Master Bedroom', 'Dormitorio Principal', 2],
  ['bedroom', 'Other Bedrooms', 'Otros Dormitorios', 1],
  ['bath', 'Bathrooms', 'Baños', 1],
  ['other', 'Other Rooms', 'Otras Habitaciones', 1],
  ['kitchen', 'Kitchen', 'Cocina', 1],
  ['dining', 'Dining Area', 'Comedor', 1],
  ['living', 'Living Area', 'Sala', 2],
  ['family', 'Family Room', 'Cuarto Familiar', 2],
]
export const DUCT_AHU = [
  ['garage', 'Garage', 'Garaje'],
  ['ceiling', 'Hanging From Ceiling', 'Colgado del Techo'],
  ['attic', 'Attic', 'Ático'],
  ['laundry', 'Laundry Room', 'Cuarto de Lavado'],
  ['closet1', '1st Floor Closet', 'Clóset del 1er Piso'],
  ['closet2', '2nd Floor Closet', 'Clóset del 2do Piso'],
  ['closet12', '1st & 2nd Floor Closets', 'Clósets del 1er y 2do Piso'],
]
export const DUCT_LAST = [
  ['1_3', '1-3 Years Ago', 'Hace 1-3 Años'], ['4_6', '4-6 Years Ago', 'Hace 4-6 Años'], ['7_10', '7-10 Years Ago', 'Hace 7-10 Años'],
  ['10_plus', 'More Than 10 Years Ago', 'Hace Más de 10 Años'], ['never', 'They Have Never Been Cleaned', 'Nunca Se Han Limpiado'],
]
export const DUCT_TYPES = [
  ['metal', 'Metal Ducts', 'Ductos de Metal'], ['flex', 'Flex Ducts', 'Ductos Flexibles'], ['fiberglass', 'Fiberglass', 'Fibra de Vidrio'],
  ['mixed', 'Mixed Types', 'Tipos Mixtos'], ['unsure', "I'm Not Sure", 'No Estoy Seguro'],
]
export const DUCT_VENTS = [['ceiling', 'In the Ceiling', 'En el Techo'], ['floor', 'In the Floor', 'En el Piso'], ['both', 'Both', 'Ambos']]
export const DUCT_SERVICES = [
  ['covers', 'Clean All Vent Covers (included)', 'Limpiar Todas las Rejillas (incluido)'],
  ['ducts', 'Clean All Ducts', 'Limpiar Todos los Ductos'],
  ['sanitize', 'Sanitize All Ducts*', 'Desinfectar Todos los Ductos*'],
  ['blower', 'Clean Blower Motor & Wheel', 'Limpiar Motor y Rueda del Soplador'],
  ['coil', 'Clean Evaporator Coil in Place', 'Limpiar el Serpentín Evaporador en Sitio'],
  ['uv', 'Install UV Light', 'Instalar Luz UV'],
  ['dryer', 'Clean Dryer Vent', 'Limpiar Ducto de Secadora'],
]

const FALLBACK_NAMES = {
  supply_ceiling: 'Residential Supply Ducts', supply_floor: 'Mobile Home Supply Ducts (in Floor)',
  return_closet: 'Closet Return', return_remote: 'Remote Returns',
  blower: 'Pull & Clean Blower Assembly', coil: 'Clean Coil in Place', uv: 'UV Light',
  dryer_ground: 'Drier Vent Ground Floor', dryer_multi: 'Drier Vent Multi-Floor',
}
export const DUCT_ITEM_SLOTS = [
  ['supply_ceiling', 'Supply vent — ceiling, or ceiling & floor mixed'], ['supply_floor', 'Supply vent — floor vents only'],
  ['return_closet', 'Return — air handler in a closet (1 per system)'], ['return_remote', 'Return — any other location (2 per system)'],
  ['blower', 'Clean blower motor & wheel'], ['coil', 'Clean evaporator coil'], ['uv', 'Install UV light'],
  ['dryer_ground', 'Dryer vent — single-story home'], ['dryer_multi', 'Dryer vent — multi-story home'],
]
export const DUCT_DEFAULT_SETTINGS = {
  vents_per_room: Object.fromEntries(DUCT_ROOMS.map(([k, , , n]) => [k, n])),
  items: {}, min_charge: 0, guarantee_days: 14,
  sanitize_note: 'Animals and people are not required to vacate the home during the process, with the exception that birds should be removed for 30 minutes.',
  warranty_text: '',
}
export const ductSettings = (s) => ({ ...DUCT_DEFAULT_SETTINGS, ...(s || {}), vents_per_room: { ...DUCT_DEFAULT_SETTINGS.vents_per_room, ...((s || {}).vents_per_room || {}) }, items: { ...((s || {}).items || {}) } })

const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')
export function ductItem(items, settings, slot) {
  const id = settings.items?.[slot]
  return (id && items.find((i) => i.id === id && i.is_active !== false)) || items.find((i) => norm(i.name) === norm(FALLBACK_NAMES[slot])) || null
}
// "Sanitize Ducts First System Up to 2000 Sq Ft" → tiers by size.
export function sanitizeTiers(items) {
  const tiers = { first: [], addl: [] }
  for (const i of items) {
    const m = String(i.name).match(/(first|add'?l|additional)\s+system.*?up to\s*([\d,]+)/i)
    if (!m || !/sanitiz/i.test(i.name + ' ' + i.category)) continue
    const kind = /first/i.test(m[1]) ? 'first' : 'addl'
    tiers[kind].push({ upTo: Number(m[2].replace(/,/g, '')), item: i })
  }
  tiers.first.sort((a, b) => a.upTo - b.upTo); tiers.addl.sort((a, b) => a.upTo - b.upTo)
  return tiers
}
export const isClosetAhu = (ahu) => /^closet/.test(ahu || '')
export const ahuSystems = (ahu) => (ahu === 'closet12' ? 2 : 1)
export const blowerCoilAllowed = (ahu) => !(ahu === 'ceiling' || ahu === 'attic')
export function offeredServices(ahu) {
  return DUCT_SERVICES.filter(([k]) => !((k === 'blower' || k === 'coil') && !blowerCoilAllowed(ahu)))
}
export function supplyCount(rooms, settings) {
  const vpr = settings.vents_per_room
  return DUCT_ROOMS.reduce((s, [k]) => s + (Number(rooms?.[k]) || 0) * (Number(vpr[k]) || 0), 0)
}

// answers: { homeKind, vents, rooms, ahu, services: [keys], sqft, lastCleaned, ductType }
// → { lines: [{ item, qty, price, taxable, label, group }], notes, subtotal, tax, total, supply, returns, systems, needsVisit }
export function buildDuctQuote(answers, items, settingsRaw, taxRate, lang = 'en') {
  const st = ductSettings(settingsRaw)
  const es = lang === 'es'
  const sel = new Set(answers.services || [])
  const systems = ahuSystems(answers.ahu)
  const lines = []
  const notes = []
  let needsVisit = false
  const add = (item, qty, label, group) => { if (item && qty > 0) lines.push({ item, qty, price: Number(item.price) || 0, taxable: !!item.taxable, label: label || item.name, group }) }

  const supply = supplyCount(answers.rooms, st)
  const returnsPer = isClosetAhu(answers.ahu) ? 1 : 2
  const returns = returnsPer * systems
  if (sel.has('ducts')) {
    // Floor vents only → the floor item (Mobile Home Supply Ducts); ceiling, or a mix → Residential.
    const slot = answers.vents === 'floor' ? 'supply_floor' : 'supply_ceiling'
    add(ductItem(items, st, slot) || ductItem(items, st, 'supply_ceiling'), supply, es ? `${supply} Rejillas de Suministro Limpiadas` : `${supply} Supply Vents Cleaned`, 'ducts')
    add(ductItem(items, st, isClosetAhu(answers.ahu) ? 'return_closet' : 'return_remote'), returns, es ? `${returns} Rejilla${returns > 1 ? 's' : ''} de Retorno Limpiada${returns > 1 ? 's' : ''}` : `${returns} Return Vent${returns > 1 ? 's' : ''} Cleaned`, 'ducts')
  }
  if (sel.has('sanitize')) {
    const tiers = sanitizeTiers(items)
    const per = Math.ceil((Number(answers.sqft) || 0) / systems)
    const pick = (list) => list.find((t) => per <= t.upTo)
    const first = pick(tiers.first)
    if (!per || !first) { needsVisit = true; notes.push(es ? 'Desinfección: su casa necesita un precio en persona.' : 'Sanitizing: your home needs an in-person price.') }
    else {
      add(first.item, 1, es ? 'Todos los Ductos Desinfectados por Retornos y A/C' : 'All Ducts Sanitized thru Returns & AC', 'sanitize')
      if (systems > 1) { const second = pick(tiers.addl); if (second) add(second.item, systems - 1, es ? 'Segundo Sistema Desinfectado' : 'Second System Sanitized', 'sanitize'); else needsVisit = true }
      if (st.sanitize_note) notes.push(st.sanitize_note)
    }
  }
  if (sel.has('blower') && blowerCoilAllowed(answers.ahu)) add(ductItem(items, st, 'blower'), systems, es ? 'Retirar y Limpiar el Ensamble del Soplador' : 'Pull and Clean Blower Assembly', 'blower')
  if (sel.has('coil') && blowerCoilAllowed(answers.ahu)) add(ductItem(items, st, 'coil'), systems, es ? 'Limpiar el Serpentín Evaporador en Sitio' : 'Clean Evaporator Coil in Place', 'coil')
  if (sel.has('uv')) add(ductItem(items, st, 'uv'), systems, es ? 'Instalar Luz UV en el Manejador de Aire' : 'Install UV Light in AHU', 'uv')
  if (sel.has('dryer')) {
    const multi = answers.homeKind === 'multistory' || answers.homeKind === 'apt'
    add(ductItem(items, st, multi ? 'dryer_multi' : 'dryer_ground'), 1, es ? '1 Ducto de Secadora Limpiado' : '1 Dryer Vent Cleaned', 'dryer')
  }
  const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100
  let subtotal = r2(lines.reduce((s, l) => s + l.qty * l.price, 0))
  const minC = Number(st.min_charge) || 0
  if (lines.length && minC > subtotal) { lines.push({ item: null, qty: 1, price: r2(minC - subtotal), taxable: false, label: es ? 'Cargo mínimo de servicio' : 'Minimum service charge', group: 'min' }); subtotal = minC }
  const tax = r2(lines.filter((l) => l.taxable).reduce((s, l) => s + l.qty * l.price, 0) * (Number(taxRate) || 0) / 100)
  return { lines, notes, subtotal, tax, total: r2(subtotal + tax), supply, returns, systems, needsVisit, settings: st }
}
