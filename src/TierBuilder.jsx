// System Estimate · AI Good/Better/Best tier builder with honest ROI.
// From the REAL equipment options available for the job (brand, SEER2, price,
// warranty), it assembles three tiers and shows a transparent efficiency-savings
// estimate — assumptions stated in the open, never a guarantee. Honesty is the
// point: the customer sees the math, not a sales pitch. Advisory; the estimator
// builds the actual estimate.
import AiAssist from './AiAssist'

const TIER_SYS = `You help an HVAC estimator assemble a Good / Better / Best proposal for a homeowner, honestly. You are given the REAL equipment options available for this job (brand, size in tons, SEER2 efficiency, price, warranty). Build three tiers:
- GOOD: a solid, lowest-cost option that meets the need.
- BETTER: a mid-efficiency step up.
- BEST: the highest-efficiency option.
Use ONLY the equipment and prices given — never invent a unit, price, or spec. For each tier list the equipment, the price, and the warranty. Then give an HONEST efficiency-savings comparison of Better and Best versus Good: state every assumption out loud (e.g. "assuming ~$0.15/kWh and typical Central-Florida cooling runtime"), estimate the approximate annual energy saving from the higher SEER2 (savings scale roughly with 1 − lower_SEER/higher_SEER of cooling cost), and give a rough payback in years for the price difference. Present all savings as ESTIMATES the customer's actual bill would refine — never a promise. Be clear and plain, not salesy. If only one option is given, say tiers need more equipment options.`

export default function TierBuilder({ equipment, systemType, size }) {
  const options = (equipment || [])
    .filter((e) => e.seer2 != null)
    .map((e) => ({
      brand: e.outdoor_brand, size_tons: e.size_tons, seer2: e.seer2, eer2: e.eer2,
      energy_star: !!e.energy_star, price: e.installation_price,
      warranty_years: e.manufacturer_warranty_years, labor_warranty: e.labor_warranty,
      description: e.outdoor_description,
    }))
    .sort((a, b) => (a.seer2 || 0) - (b.seer2 || 0))

  if (options.length < 2) return null

  return (
    <div style={{ border: '1px solid #E2E8F0', background: '#FBFCFE', borderRadius: 10, padding: 12, margin: '4px 0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <strong style={{ color: '#132A4C', fontSize: 13.5 }}>Good / Better / Best builder</strong>
        <span style={{ fontSize: 12.5, color: 'var(--mist)', marginLeft: 'auto' }}>{options.length} equipment options</span>
      </div>
      <p style={{ color: 'var(--mist)', fontSize: 12, margin: '6px 0 10px' }}>
        Assembles three honest tiers from the real options for this job, with an efficiency-savings estimate and its assumptions shown. Review before presenting.
      </p>
      <AiAssist inline title="Good / Better / Best" label="✦ Build tiers with honest ROI"
        system={TIER_SYS}
        prompt="Assemble Good/Better/Best from these real options, with a transparent savings estimate and stated assumptions."
        context={{ system_type: systemType || null, size_tons: size || null, region: 'Central Florida', equipment_options: options }} />
    </div>
  )
}
