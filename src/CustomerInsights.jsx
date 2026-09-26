// Account insights panel for Customer History.
// Honesty-forward by design: every flag is computed from real account data and
// shows the evidence (the reading) beside it. AI only NARRATES/prioritizes the
// next best action from those computed flags — it never invents a flag.
import AiAssist from './AiAssist'

const TONE = {
  risk: ['#FBE7E7', '#B00020'],
  opportunity: ['#E3F1E8', '#166534'],
  info: ['#EEF2F8', '#2E5E8C'],
}
const money = (n) => (n == null || isNaN(n) ? '$0' : `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`)
const monthsSince = (d) => {
  if (!d) return null
  const then = new Date(d); if (isNaN(then)) return null
  return Math.floor((Date.now() - then.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
}
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '')

const NBA_SYS = `You are helping HVAC office staff decide the single best next action for a customer.
You are given a list of already-computed account flags (each with its evidence). Do NOT invent new facts.
Respond in 3 short parts, plainly:
1) The ONE next action to take now, and why (one sentence, cite the flag).
2) A second action if warranted (one sentence), else omit.
3) A short, courteous one- or two-sentence note the office could say to the customer (for a human to review and send). Keep honest — never pressure, never claim work is needed that the flags don't support.`

export default function CustomerInsights({ customer, properties = [], jobs = [], invoices = [], agreements = [], equipment = [], warranties = [] }) {
  const flags = []
  const nowYear = new Date().getFullYear()

  // --- Maintenance plan / overdue visit ---
  const activeAgreement = agreements.find((a) => (a.status || '').toLowerCase() === 'active')
  if (activeAgreement) {
    const due = activeAgreement.next_visit_due_date
    if (due && new Date(due) < new Date()) {
      flags.push({ tone: 'risk', label: 'Maintenance visit overdue', evidence: `Plan visit was due ${fmtDate(due)}` })
    }
  } else {
    flags.push({ tone: 'opportunity', label: 'No active maintenance plan', evidence: `${properties.length || 0} propert${properties.length === 1 ? 'y' : 'ies'} on file, no recurring plan — retention + recurring-revenue opportunity` })
  }

  // --- Aging equipment (replacement / financing candidate) ---
  const eqAges = []
  equipment.forEach((e) => {
    const yr = e.manufacture_year || (e.install_date ? new Date(e.install_date).getFullYear() : null)
    if (yr && yr > 1980) eqAges.push({ yr, label: e.system_label || [e.outdoor_brand, e.outdoor_model].filter(Boolean).join(' ') || 'System' })
  })
  if (eqAges.length === 0) {
    warranties.forEach((w) => {
      if (w.install_date) { const yr = new Date(w.install_date).getFullYear(); if (yr > 1980) eqAges.push({ yr, label: w.brand || 'System' }) }
    })
  }
  const oldest = eqAges.sort((a, b) => a.yr - b.yr)[0]
  if (oldest) {
    const age = nowYear - oldest.yr
    if (age >= 12) {
      flags.push({ tone: 'opportunity', label: `Aging system — ~${age} yrs old`, evidence: `${oldest.label}, from ${oldest.yr}. Replacement candidate; good financing fit.` })
    }
  }

  // --- Outstanding balance ---
  const openInvoices = invoices.filter((i) => (i.kind === 'invoice' || !i.kind) && !i.paid_at && Number(i.balance) > 0)
  if (openInvoices.length) {
    const total = openInvoices.reduce((s, i) => s + Number(i.balance || 0), 0)
    flags.push({ tone: 'risk', label: `Open balance ${money(total)}`, evidence: `${openInvoices.length} unpaid invoice${openInvoices.length > 1 ? 's' : ''}: ${openInvoices.slice(0, 4).map((i) => `${i.invoice_number || '#'} (${money(i.balance)})`).join(', ')}` })
  }

  // --- Open estimate (decision pending) + financing candidate ---
  const openEstimates = invoices.filter((i) => i.kind === 'estimate' && (i.approval_status || '').toLowerCase() !== 'approved')
  if (openEstimates.length) {
    const biggest = openEstimates.slice().sort((a, b) => Number(b.job_total || 0) - Number(a.job_total || 0))[0]
    flags.push({ tone: 'opportunity', label: `Estimate awaiting decision — ${money(biggest.job_total)}`, evidence: `${openEstimates.length} open estimate${openEstimates.length > 1 ? 's' : ''}; largest ${biggest.invoice_number || ''} (${money(biggest.job_total)})` })
    if (Number(biggest.job_total) >= 3000) {
      flags.push({ tone: 'opportunity', label: 'Financing candidate', evidence: `Open estimate of ${money(biggest.job_total)} — a good fit for a financing offer at the honest terms.` })
    }
  }

  // --- Churn risk (no recent service, no plan) ---
  const lastJob = jobs.find((j) => j.job_date) // jobs are ordered newest-first
  const m = monthsSince(lastJob?.job_date)
  if (m != null && m >= 15 && !activeAgreement) {
    flags.push({ tone: 'risk', label: `No service in ${m} months`, evidence: `Last job ${fmtDate(lastJob.job_date)} — win-back / re-engagement candidate.` })
  }

  const hasFlags = flags.length > 0

  return (
    <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: 14, margin: '10px 0 18px', background: '#FBFCFE' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: hasFlags ? 10 : 4 }}>
        <span style={{ fontWeight: 700, color: '#1F2A37', fontSize: 15 }}>Account insights</span>
        <span style={{ fontSize: 11, color: '#94A3B8' }}>computed from this account · evidence shown beside each flag</span>
      </div>

      {!hasFlags ? (
        <p style={{ color: 'var(--mist)', fontSize: 13, margin: '4px 0' }}>Nothing needs attention right now — no overdue plan, aging system, open balance, or stale account. Nothing to sell here.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {flags.map((f, i) => {
            const [bg, c] = TONE[f.tone] || TONE.info
            return (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ flex: '0 0 auto', marginTop: 2, background: bg, color: c, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, minWidth: 78, textAlign: 'center' }}>
                  {f.tone === 'risk' ? 'Attention' : f.tone === 'opportunity' ? 'Opportunity' : 'Note'}
                </span>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1F2A37' }}>{f.label}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--mist)' }}>{f.evidence}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <AiAssist inline title="Next best action" label="✨ AI: suggest next best action"
          system={NBA_SYS}
          prompt="From the computed flags below, give the single best next action for this customer, then an optional second, then a short honest note the office could send. Use only these flags."
          context={{
            customer: customer?.display_name,
            flags: hasFlags ? flags.map((f) => `${f.label} — ${f.evidence}`) : ['No open flags: account is healthy; do not manufacture a reason to sell.'],
          }} />
      </div>
    </div>
  )
}
