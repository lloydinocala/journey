// Rewards-HVAC · Employee self-service portal. Any logged-in employee sees ONLY
// their own pay stubs, PTO balances, and W-2 (enforced by self_read RLS).
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import { buildW2s } from './yearEndData'
import { getLang, setLang, makeT } from './i18n'

const money = (n) => (n == null || isNaN(n) ? '—' : '$' + Number(n).toFixed(2))

export default function MyPortal({ profile }) {
  const [tab, setTab] = useState('pay')
  const [lang, setLangState] = useState(getLang())
  const t = makeT(lang)
  function toggleLang() { const nl = lang === 'en' ? 'es' : 'en'; setLang(nl); setLangState(nl) }
  const [calcs, setCalcs] = useState([])
  const [balances, setBalances] = useState([])
  const [policies, setPolicies] = useState({})
  const [hr, setHr] = useState({})
  const [year, setYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      const [c, b, pol, h] = await Promise.all([
        supabase.from('rewards_payroll_calcs').select('*').order('week_start', { ascending: false }),
        supabase.from('rewards_pto_balances').select('*'),
        supabase.from('rewards_pto_policies').select('id, name, leave_type'),
        supabase.from('rewards_employee_hr').select('ssn_last4, work_state').maybeSingle(),
      ])
      if (!alive) return
      setCalcs(c.data || [])
      setBalances(b.data || [])
      const pm = {}; (pol.data || []).forEach((p) => { pm[p.id] = p }); setPolicies(pm)
      setHr(h.data || {})
      setLoading(false)
    })()
    return () => { alive = false }
  }, [])

  const yearCalcs = calcs.filter((c) => (c.week_start || '').startsWith(String(year)))
  const w2 = buildW2s(yearCalcs, { [profile.id]: { full_name: profile.full_name, user_id: profile.id, hr } })[0]

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>{t('title')}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="logout-button" onClick={toggleLang}>{lang === 'en' ? 'Español' : 'English'}</button>
          <Link to="/" className="logout-button" style={{ textDecoration: 'none' }}>← {t('back')}</Link>
        </div>
      </div>
      <div style={{ color: 'var(--mist)', marginBottom: 18 }}>{profile.full_name}</div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {[['pay', t('tab_pay')], ['pto', t('tab_pto')], ['w2', t('tab_w2')]].map(([k, l]) => (
          <button key={k} className="logout-button" style={tab === k ? { background: '#1B3A6B', color: '#fff' } : undefined} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {loading ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : (
        <>
          {tab === 'pay' && (
            calcs.length === 0 ? <p style={{ color: 'var(--mist)' }}>{t('no_pay')}</p> : (
              <table className="data-table">
                <thead><tr><th>{t('pay_week')}</th><th>{t('gross')}</th><th>{t('taxes')}</th><th>{t('net')}</th><th></th></tr></thead>
                <tbody>
                  {calcs.map((c) => (
                    <tr key={c.id}>
                      <td>{c.week_start} – {c.week_end}</td>
                      <td>{money(c.gross_pay)}</td>
                      <td>{money(c.employee_taxes)}</td>
                      <td style={{ fontWeight: 700 }}>{money(c.net_pay)}</td>
                      <td><button className="logout-button" onClick={() => printStub(c, profile.full_name, t)}>🖨 {t('stub')}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {tab === 'pto' && (
            balances.length === 0 ? <p style={{ color: 'var(--mist)' }}>{t('no_pto')}</p> : (
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                {balances.map((b) => (
                  <div key={b.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '16px 22px', minWidth: 160 }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--route-blue, #1B3A6B)' }}>{Number(b.balance_hours || 0).toFixed(1)}<span style={{ fontSize: 13, color: 'var(--mist)' }}> {t('hrs')}</span></div>
                    <div style={{ color: 'var(--mist)', fontSize: 13 }}>{policies[b.policy_id]?.name || 'Time off'}</div>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'w2' && (
            <>
              <div style={{ marginBottom: 12 }}>{t('tax_year')} <select value={year} onChange={(e) => setYear(Number(e.target.value))}>{[year, year - 1, year - 2].map((y) => <option key={y} value={y}>{y}</option>)}</select></div>
              {!w2 ? <p style={{ color: 'var(--mist)' }}>{t('no_w2')} {year}.</p> : (
                <table className="data-table" style={{ maxWidth: 480 }}>
                  <tbody>
                    <tr><td>{t('box1')}</td><td style={{ textAlign: 'right' }}>{money(w2.box1)}</td></tr>
                    <tr><td>{t('box2')}</td><td style={{ textAlign: 'right' }}>{money(w2.box2)}</td></tr>
                    <tr><td>{t('box3')}</td><td style={{ textAlign: 'right' }}>{money(w2.box3)}</td></tr>
                    <tr><td>{t('box4')}</td><td style={{ textAlign: 'right' }}>{money(w2.box4)}</td></tr>
                    <tr><td>{t('box5')}</td><td style={{ textAlign: 'right' }}>{money(w2.box5)}</td></tr>
                    <tr><td>{t('box6')}</td><td style={{ textAlign: 'right' }}>{money(w2.box6)}</td></tr>
                    {w2.box12D ? <tr><td>{t('box12d')}</td><td style={{ textAlign: 'right' }}>{money(w2.box12D)}</td></tr> : null}
                    <tr><td>{t('box17')} ({w2.state || '—'})</td><td style={{ textAlign: 'right' }}>{money(w2.box17)}</td></tr>
                  </tbody>
                </table>
              )}
              <p style={{ color: 'var(--mist)', fontSize: 12, marginTop: 8 }}>{t('w2_note')}</p>
            </>
          )}
        </>
      )}
    </div>
  )
}

function printStub(c, name, t) {
  const w = window.open('', '_blank', 'width=760,height=900'); if (!w) return
  const m = (n) => '$' + (Number(n) || 0).toFixed(2)
  const row = (l, v, b) => `<tr><td>${l}</td><td class="r${b ? ' b' : ''}">${v}</td></tr>`
  w.document.write(`<html><head><title>${t('stub')} — ${name}</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#111}table{border-collapse:collapse;min-width:280px}td{padding:5px 4px;border-bottom:1px solid #e5e5e5;font-size:13px}.r{text-align:right;font-weight:600}.b{font-weight:800}.net{margin-top:16px;padding:12px 16px;background:#0f2f5f;color:#fff;border-radius:8px;display:flex;justify-content:space-between;font-weight:800}</style></head><body>
  <div style="font-weight:800">${name}</div><div style="color:#666;font-size:13px;margin-bottom:12px">${t('pay_period')} ${c.week_start} → ${c.week_end}</div>
  <table><tbody>
  ${row(t('gross_pay'), m(c.gross_pay), true)}
  ${row(t('fed_tax'), '-' + m(c.fed_income_wh))}
  ${row(t('ss'), '-' + m(c.ss_employee))}
  ${row(t('medicare'), '-' + m(c.medicare_employee))}
  ${Number(c.state_income_wh) ? row(t('state_tax'), '-' + m(c.state_income_wh)) : ''}
  ${Number(c.pretax_deductions) + Number(c.posttax_deductions) ? row(t('deductions'), '-' + m(Number(c.pretax_deductions) + Number(c.posttax_deductions))) : ''}
  ${row(t('total_withheld'), '-' + m(c.employee_taxes), true)}
  </tbody></table>
  <div class="net"><span>${t('net_pay')}</span><span>${m(c.net_pay)}</span></div>
  </body></html>`)
  w.document.close(); w.focus(); w.print()
}
