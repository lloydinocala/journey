// Rewards-HVAC · State income-tax withholding (R5)
// Config-driven from rewards_state_rules. No-tax and flat states compute
// accurately; progressive/local states are flagged as needing a tax engine
// (or hand-configured brackets) rather than producing a wrong number.
import { supabase } from '../../utils/supabase'
import { PERIODS_PER_YEAR } from './taxTables'

const round2 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100

export async function loadStateRules() {
  const { data } = await supabase.from('rewards_state_rules').select('*').order('effective_date', { ascending: true })
  const map = {}
  ;(data || []).forEach((r) => { map[r.state] = r }) // latest effective wins (ordered asc)
  return map
}

export async function listStateRules() {
  const { data } = await supabase.from('rewards_state_rules').select('*').order('state')
  return data || []
}
export async function upsertStateRule(row) {
  return supabase.from('rewards_state_rules').upsert(
    { ...row, updated_at: new Date().toISOString() }, { onConflict: 'state,effective_date' }
  ).select().single()
}

export async function loadStateBrackets(state) {
  const { data } = await supabase.from('rewards_state_brackets').select('*').eq('state', state).order('at_least')
  return data || []
}

// deductions: { pretax401k, pretax125 } — pre-tax amounts, state may or may not exempt them.
export function computeStateWithholding({ state, gross, pretax401k = 0, pretax125 = 0, frequency = 'weekly', rule, brackets, filingStatus = 'single' }) {
  if (!rule || rule.income_tax_type === 'none' || !state) return { amount: 0, method: 'none' }

  const exempt = (rule.pretax_401k_exempt ? pretax401k : 0) + (rule.pretax_125_exempt ? pretax125 : 0)
  const stateTaxable = Math.max(0, (Number(gross) || 0) - exempt)

  if (rule.income_tax_type === 'flat') {
    return { amount: round2(stateTaxable * (Number(rule.flat_rate) || 0)), method: 'flat' }
  }

  if (rule.income_tax_type === 'progressive') {
    if (brackets && brackets.length) {
      const periods = PERIODS_PER_YEAR[frequency] || 52
      const annual = stateTaxable * periods
      let row = brackets[0]
      for (const b of brackets) { if (annual >= b.at_least) row = b; else break }
      const annualTax = Math.max(0, row.base + row.rate * (annual - row.over))
      return { amount: round2(annualTax / periods), method: 'progressive' }
    }
    return { amount: 0, method: 'progressive', flag: 'No brackets configured for this state — withholding not computed.' }
  }

  // 'engine'
  return { amount: 0, method: 'engine', flag: `${state} withholding needs a tax engine (progressive/local). Configure brackets or integrate an engine.` }
}
