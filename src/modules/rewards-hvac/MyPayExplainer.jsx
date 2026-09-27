// Rewards-HVAC · Employee self-service "explain my pay" helper for the portal.
// Lets an employee understand their OWN paycheck and benefits in plain language —
// pick a check for a step-by-step breakdown, or ask a pay/benefits question. It
// only ever uses the employee's own data (already scoped to them by RLS), answers
// in their portal language, and defers tax/financial decisions to HR/a pro.
import { useState } from 'react'
import AiAssist from '../../AiAssist'

const money = (n) => (n == null || isNaN(n) ? '—' : `$${Number(n).toFixed(2)}`)

const sysFor = (lang) => `You help an employee of an HVAC company understand their OWN pay and benefits in plain, friendly language. You are given the employee's own paycheck breakdown(s) and PTO balances. Answer using ONLY these numbers — never invent a figure. Be warm and clear, not technical; explain what was earned, what was withheld and why, and the take-home. You are NOT a tax or financial advisor: for tax-filing or personal financial decisions, tell them to check with HR or a professional. If a question can't be answered from the data given, say what you can and point them to HR.${lang === 'es' ? ' Responde en español.' : ''}`

const checkContext = (c) => ({
  week: `${c.week_start} to ${c.week_end}`,
  gross_pay: c.gross_pay,
  federal_income_tax: c.fed_income_wh, social_security: c.ss_employee, medicare: c.medicare_employee,
  state_income_tax: c.state_income_wh,
  pretax_deductions: c.pretax_deductions, posttax_deductions: c.posttax_deductions,
  total_withheld: c.employee_taxes, net_pay: c.net_pay,
})

export default function MyPayExplainer({ checks, pto, lang = 'en' }) {
  const [checkId, setCheckId] = useState('')
  const [q, setQ] = useState('')
  const sys = sysFor(lang)
  const es = lang === 'es'
  const selected = (checks || []).find((c) => c.id === checkId) || null

  if (!checks || checks.length === 0) return null

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 18, background: '#FBFCFE' }}>
      <div style={{ fontWeight: 700, color: '#1B3A6B', marginBottom: 4 }}>{es ? '¿Preguntas sobre tu pago?' : 'Questions about your pay?'}</div>
      <p style={{ color: 'var(--mist)', fontSize: 12.5, margin: '0 0 12px' }}>
        {es ? 'Entiende tu propio cheque y beneficios. Usa solo tu información.' : 'Understand your own paycheck and benefits. Uses only your information.'}
      </p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>{es ? 'Explicar un cheque' : 'Explain a paycheck'}</label>
        <select value={checkId} onChange={(e) => setCheckId(e.target.value)} style={{ border: '1px solid #D5DAE1', borderRadius: 8, padding: '6px 8px', fontSize: 13 }}>
          <option value="">{es ? '— elige —' : '— pick one —'}</option>
          {checks.map((c) => <option key={c.id} value={c.id}>{c.week_start} → {c.week_end} · {money(c.net_pay)}</option>)}
        </select>
      </div>
      {selected && (
        <div style={{ marginBottom: 14 }}>
          <AiAssist key={checkId} inline title={`${selected.week_start} → ${selected.week_end}`} label={es ? '✦ Explícame este cheque' : '✦ Explain this check'}
            system={sys}
            prompt={es ? 'Explícame este cheque de pago paso a paso, en español.' : 'Explain this paycheck to me step by step.'}
            context={{ paycheck: checkContext(selected) }} />
        </div>
      )}

      <div style={{ borderTop: '1px solid #EEF2F8', paddingTop: 12 }}>
        <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>{es ? 'Pregunta sobre tu pago o beneficios' : 'Ask about your pay or benefits'}</label>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={es ? 'p. ej. ¿Por qué mi cheque fue menor esta vez?' : 'e.g. Why was my check lower this time?'} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #D5DAE1', borderRadius: 8, padding: '7px 10px', fontSize: 13.5, marginBottom: 8 }} />
        {q.trim() ? (
          <AiAssist inline title={es ? 'Tu pago' : 'Your pay'} label={es ? 'Preguntar' : 'Ask'}
            system={sys}
            prompt={q.trim()}
            context={{ question: q.trim(), recent_paychecks: (checks || []).slice(0, 4).map(checkContext), pto_balances: pto }} />
        ) : (
          <span style={{ fontSize: 12.5, color: 'var(--mist)' }}>{es ? 'Escribe una pregunta y presiona Preguntar.' : 'Type a question, then Ask.'}</span>
        )}
        <div style={{ fontSize: 11.5, color: 'var(--mist)', marginTop: 6 }}>{es ? 'Para decisiones de impuestos, consulta con RR. HH.' : 'For tax or filing decisions, check with HR.'}</div>
      </div>
    </div>
  )
}
