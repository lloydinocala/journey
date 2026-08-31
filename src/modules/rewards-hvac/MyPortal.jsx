// Rewards-HVAC · Employee self-service portal. Any logged-in employee sees ONLY
// their own pay stubs, PTO balances, and W-2 (enforced by self_read RLS).
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import { buildW2s } from './yearEndData'
import { addPtoRequest, listPtoRequests, cancelPtoRequest } from './r4Data'
import { listCertifications, listOnboarding, listDocuments, certLabel, signedHrUrl } from './hrData'
import { listMetrics, listEntries, listReviews, currentQuarter } from './scorecardData'
import { ScorecardTable } from './HrScorecards'
import { getLang, setLang, makeT } from './i18n'

const money = (n) => (n == null || isNaN(n) ? '—' : '$' + Number(n).toFixed(2))
async function openFile(path) { const u = await signedHrUrl(path); if (u) window.open(u, '_blank') }

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
  const [myEmpId, setMyEmpId] = useState('')
  const [policyList, setPolicyList] = useState([])
  const [requests, setRequests] = useState([])
  const [reqForm, setReqForm] = useState({ policy_id: '', start_date: '', end_date: '', hours: '', note: '' })
  const [reqMsg, setReqMsg] = useState('')
  const [reqSaving, setReqSaving] = useState(false)
  const [scMetrics, setScMetrics] = useState([])
  const [scEntries, setScEntries] = useState([])
  const [scReviews, setScReviews] = useState([])
  const [myCerts, setMyCerts] = useState([])
  const [myOnboarding, setMyOnboarding] = useState([])
  const [myDocs, setMyDocs] = useState([])

  async function loadRequests(empId) {
    if (!empId || !profile.org_id) { setRequests([]); return }
    setRequests(await listPtoRequests(profile.org_id, { employeeId: empId }))
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      const [c, b, pol, h, emp, mx] = await Promise.all([
        supabase.from('rewards_payroll_calcs').select('*').order('week_start', { ascending: false }),
        supabase.from('rewards_pto_balances').select('*'),
        supabase.from('rewards_pto_policies').select('id, name, leave_type'),
        supabase.from('rewards_employee_hr').select('ssn_last4, work_state').maybeSingle(),
        supabase.from('employees').select('id').eq('user_id', profile.id).maybeSingle(),
        profile.org_id ? listMetrics(profile.org_id) : Promise.resolve([]),
      ])
      if (!alive) return
      setCalcs(c.data || [])
      setBalances(b.data || [])
      const pm = {}; (pol.data || []).forEach((p) => { pm[p.id] = p }); setPolicies(pm)
      setPolicyList(pol.data || [])
      setReqForm((f) => ({ ...f, policy_id: f.policy_id || (pol.data && pol.data[0] ? pol.data[0].id : '') }))
      setHr(h.data || {})
      setScMetrics(mx || [])
      const empId = emp.data?.id || ''
      setMyEmpId(empId)
      await loadRequests(empId)
      if (empId && profile.org_id) {
        const [se, sr, ce, ob, dc] = await Promise.all([
          listEntries(profile.org_id, empId), listReviews(profile.org_id, empId),
          listCertifications(profile.org_id, { employeeId: empId }),
          listOnboarding(profile.org_id, empId),
          listDocuments(profile.org_id, { employeeId: empId }),
        ])
        setScEntries(se); setScReviews(sr); setMyCerts(ce); setMyOnboarding(ob); setMyDocs(dc)
      }
      setLoading(false)
    })()
    return () => { alive = false }
  }, [])

  async function submitRequest(e) {
    e.preventDefault(); setReqMsg('')
    if (!myEmpId || !reqForm.start_date || !reqForm.end_date || !reqForm.hours) return
    setReqSaving(true)
    const { error } = await addPtoRequest(profile.org_id, { employee_id: myEmpId, ...reqForm })
    setReqSaving(false)
    if (error) { setReqMsg(error.message); return }
    setReqForm((f) => ({ ...f, start_date: '', end_date: '', hours: '', note: '' }))
    setReqMsg(t('req_submitted'))
    loadRequests(myEmpId)
  }
  async function withdraw(id) {
    await cancelPtoRequest(id); loadRequests(myEmpId)
  }

  const yearCalcs = calcs.filter((c) => (c.week_start || '').startsWith(String(year)))
  const w2 = buildW2s(yearCalcs, { [profile.id]: { full_name: profile.full_name, user_id: profile.id, hr } })[0]

  // Scorecard periods — most recent with data is "Current", the one before is "Last".
  const scPeriods = [...new Set(scEntries.map((e) => e.period_label))]
    .map((l) => ({ l, d: (scEntries.find((e) => e.period_label === l) || {}).period_date || '' }))
    .sort((a, b) => (a.d < b.d ? 1 : -1))
  const scCur = scPeriods[0]?.l || currentQuarter().label
  const scLast = scPeriods[1]?.l || '—'
  const scValueOf = (mid, label) => (scEntries.find((e) => e.metric_id === mid && e.period_label === label) || {}).value

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
        {[['pay', t('tab_pay')], ['pto', t('tab_pto')], ['w2', t('tab_w2')], ...(scMetrics.length ? [['scorecard', t('tab_scorecard')]] : []), ['certs', t('tab_certs')], ['onboarding', t('tab_onboarding')], ['docs', t('tab_docs')]].map(([k, l]) => (
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
            <>
              {balances.length === 0 ? <p style={{ color: 'var(--mist)' }}>{t('no_pto')}</p> : (
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 22 }}>
                  {balances.map((b) => (
                    <div key={b.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '16px 22px', minWidth: 160 }}>
                      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--route-blue, #1B3A6B)' }}>{Number(b.balance_hours || 0).toFixed(1)}<span style={{ fontSize: 13, color: 'var(--mist)' }}> {t('hrs')}</span></div>
                      <div style={{ color: 'var(--mist)', fontSize: 13 }}>{policies[b.policy_id]?.name || 'Time off'}</div>
                    </div>
                  ))}
                </div>
              )}

              {myEmpId && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 18, marginBottom: 22 }}>
                  <h3 style={{ margin: '0 0 12px' }}>{t('req_title')}</h3>
                  <form onSubmit={submitRequest} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    {policyList.length > 0 && (
                      <div className="field" style={{ marginBottom: 0 }}><label>{t('req_policy')}</label>
                        <select value={reqForm.policy_id} onChange={(e) => setReqForm({ ...reqForm, policy_id: e.target.value })}>
                          {policyList.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select></div>
                    )}
                    <div className="field" style={{ marginBottom: 0 }}><label>{t('req_start')}</label>
                      <input type="date" value={reqForm.start_date} onChange={(e) => setReqForm({ ...reqForm, start_date: e.target.value })} required /></div>
                    <div className="field" style={{ marginBottom: 0 }}><label>{t('req_end')}</label>
                      <input type="date" value={reqForm.end_date} min={reqForm.start_date || undefined} onChange={(e) => setReqForm({ ...reqForm, end_date: e.target.value })} required /></div>
                    <div className="field" style={{ marginBottom: 0, maxWidth: 90 }}><label>{t('req_hours')}</label>
                      <input type="number" step="0.25" min="0" value={reqForm.hours} onChange={(e) => setReqForm({ ...reqForm, hours: e.target.value })} required /></div>
                    <div className="field" style={{ marginBottom: 0, minWidth: 180 }}><label>{t('req_note')}</label>
                      <input value={reqForm.note} onChange={(e) => setReqForm({ ...reqForm, note: e.target.value })} /></div>
                    <button className="auth-button" type="submit" style={{ width: 'auto' }} disabled={reqSaving}>{t('req_submit')}</button>
                  </form>
                  {reqMsg && <div style={{ marginTop: 10, color: '#166534', fontSize: 13 }}>{reqMsg}</div>}
                </div>
              )}

              <h3 style={{ margin: '0 0 8px' }}>{t('req_mine')}</h3>
              {requests.length === 0 ? <p style={{ color: 'var(--mist)' }}>{t('req_none')}</p> : (
                <table className="data-table">
                  <thead><tr><th>{t('req_dates')}</th><th>{t('req_policy')}</th><th style={{ textAlign: 'right' }}>{t('req_hours')}</th><th>{t('req_status')}</th><th></th></tr></thead>
                  <tbody>
                    {requests.map((r) => {
                      const label = r.status === 'approved' ? t('req_approved') : r.status === 'denied' ? t('req_denied') : t('req_pending')
                      const color = r.status === 'approved' ? '#166534' : r.status === 'denied' ? '#B00020' : '#B0600A'
                      return (
                        <tr key={r.id}>
                          <td>{r.start_date}{r.end_date !== r.start_date ? ` – ${r.end_date}` : ''}</td>
                          <td>{policies[r.policy_id]?.name || 'Time off'}</td>
                          <td style={{ textAlign: 'right' }}>{Number(r.hours || 0)}</td>
                          <td style={{ color, fontWeight: 600 }}>{label}</td>
                          <td style={{ textAlign: 'right' }}>{r.status === 'pending' && <button className="logout-button" onClick={() => withdraw(r.id)}>{t('req_cancel')}</button>}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </>
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

          {tab === 'scorecard' && (
            scEntries.length === 0 ? <p style={{ color: 'var(--mist)' }}>{t('sc_none')}</p> : (
              <>
                <p style={{ color: 'var(--mist)', fontSize: 13, marginBottom: 12 }}>{t('sc_intro')}</p>
                <ScorecardTable metrics={scMetrics} valueOf={scValueOf} curLabel={scCur} lastLabel={scLast} />
                {(() => {
                  const rv = scReviews.find((r) => r.period_label === scCur)
                  if (!rv || (!rv.summary && !rv.goals)) return null
                  return (
                    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginTop: 16 }}>
                      {rv.summary && <><div style={{ fontWeight: 700, marginBottom: 4 }}>{scCur} — {t('tab_scorecard')}</div><p style={{ margin: '0 0 12px', whiteSpace: 'pre-wrap' }}>{rv.summary}</p></>}
                      {rv.goals && <><div style={{ fontWeight: 700, marginBottom: 4 }}>{t('sc_goals')}</div><p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{rv.goals}</p></>}
                    </div>
                  )
                })()}
              </>
            )
          )}

          {tab === 'certs' && (
            myCerts.length === 0 ? <p style={{ color: 'var(--mist)' }}>{t('certs_none')}</p> : (
              <table className="data-table">
                <thead><tr><th>{t('col_type')}</th><th>{t('col_id')}</th><th>{t('col_expires')}</th><th>{t('col_status')}</th><th></th></tr></thead>
                <tbody>
                  {myCerts.map((c) => {
                    const exp = c.expires_date ? Math.round((new Date(c.expires_date + 'T00:00:00') - new Date().setHours(0, 0, 0, 0)) / 86400000) : null
                    const status = exp == null ? '—' : exp < 0 ? 'Expired' : exp <= 60 ? `${exp}d left` : 'Valid'
                    const color = exp == null ? 'var(--mist)' : exp < 0 ? '#B00020' : exp <= 60 ? '#B0600A' : '#166534'
                    return <tr key={c.id}><td>{certLabel(c.cert_type)}</td><td>{c.identifier || '—'}</td><td>{c.expires_date || '—'}</td><td style={{ color, fontWeight: 600 }}>{status}</td><td style={{ textAlign: 'right' }}>{c.storage_path ? <button className="logout-button" onClick={() => openFile(c.storage_path)}>View</button> : ''}</td></tr>
                  })}
                </tbody>
              </table>
            )
          )}

          {tab === 'onboarding' && (
            myOnboarding.length === 0 ? <p style={{ color: 'var(--mist)' }}>{t('onb_none')}</p> : (
              <table className="data-table">
                <thead><tr><th>{t('col_task')}</th><th>{t('col_status')}</th></tr></thead>
                <tbody>
                  {myOnboarding.map((o) => (
                    <tr key={o.id}><td>{o.label || o.task}</td>
                      <td style={{ textTransform: 'capitalize', color: o.status === 'complete' ? '#166534' : 'var(--mist)', fontWeight: 600 }}>{o.status}</td></tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {tab === 'docs' && (
            myDocs.length === 0 ? <p style={{ color: 'var(--mist)' }}>{t('docs_none')}</p> : (
              <table className="data-table">
                <thead><tr><th>{t('col_title')}</th><th>{t('col_category')}</th><th></th></tr></thead>
                <tbody>
                  {myDocs.map((d) => <tr key={d.id}><td>{d.title || '—'}</td><td style={{ textTransform: 'capitalize' }}>{(d.category || '').replace('_', ' ')}</td><td style={{ textAlign: 'right' }}>{d.storage_path ? <button className="logout-button" onClick={() => openFile(d.storage_path)}>View</button> : ''}</td></tr>)}
                </tbody>
              </table>
            )
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
