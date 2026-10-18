import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import { money, pct, num, r2, fmtDate, computeSheet, summarize, loadPayApp, AIA_FORMAT_NOTE, AIA_TRADEMARK_NOTE } from './data'

// Commercial Projects · one Application for Payment with its Continuation Sheet.
// Drafts are edited here (work this period + materials stored); Submit locks it,
// snapshots the totals, and creates the customer invoice for the payment due.
export default function PayAppEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [d, setD] = useState(null)
  const [org, setOrg] = useState(null)
  const [edits, setEdits] = useState({})          // sov_line_id -> { work_this_period, stored_to_date }
  const [hdr, setHdr] = useState({ application_date: '', period_to: '', notes: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [confirming, setConfirming] = useState(false)

  const load = useCallback(async () => {
    const r = await loadPayApp(id)
    if (r.error) { setMsg(r.error); return }
    setD(r)
    setEdits(Object.fromEntries(r.lines.map((l) => [l.sov_line_id, { work_this_period: l.work_this_period, stored_to_date: l.stored_to_date }])))
    setHdr({ application_date: r.app.application_date || '', period_to: r.app.period_to || '', notes: r.app.notes || '' })
    const { data: o } = await supabase.from('organizations').select('name, business_phone, business_email').eq('id', r.app.org_id).maybeSingle()
    setOrg(o || null)
  }, [id])
  useEffect(() => { load() }, [load])

  const locked = d?.app.status === 'submitted'
  const rates = useMemo(() => ({
    rw: locked ? d?.app.retainage_percent : d?.project?.retainage_percent,
    rs: locked ? d?.app.retainage_stored_percent : (d?.project?.retainage_stored_percent ?? d?.project?.retainage_percent),
  }), [d, locked])
  const lineRows = useMemo(() => (d ? d.sov.map((s) => {
    const base = d.lines.find((l) => l.sov_line_id === s.id) || { sov_line_id: s.id }
    return locked ? base : { ...base, ...(edits[s.id] || {}) }
  }) : []), [d, edits, locked])
  const sheet = useMemo(() => (d ? computeSheet(d.sov, lineRows, d.priorWork, rates, locked) : null), [d, lineRows, rates, locked])
  const sum = useMemo(() => {
    if (!d || !sheet) return null
    if (locked) {
      const a = d.app
      return { original: num(a.original_contract), netCO: num(a.net_change_orders), contractToDate: num(a.contract_sum_to_date), completed: num(a.total_completed),
        retainage: num(a.retainage_amount), earned: num(a.earned_less_retainage), prev: num(a.previous_certificates), due: num(a.current_payment_due),
        balanceToFinish: num(a.contract_sum_to_date) - num(a.earned_less_retainage) }
    }
    return summarize(d.project, sheet.totals, d.previousCertificates)
  }, [d, sheet, locked])

  if (msg && !d) return <div><h2 className="page-title">Pay Application</h2><p>{msg}</p></div>
  if (!d || !sheet) return <div><h2 className="page-title">Pay Application</h2><p style={{ color: 'var(--mist)' }}>Loading…</p></div>

  const { app, project } = d
  const setE = (sid, k, v) => setEdits({ ...edits, [sid]: { ...(edits[sid] || {}), [k]: v } })
  const setPctToDate = (row, v) => {
    if (v === '') return
    const target = (num(v) / 100) * row.C
    setE(row.sov.id, 'work_this_period', r2(target - row.D - row.F))
  }
  const overLines = sheet.rows.filter((r) => r.over)
  const sovMismatch = Math.abs(sheet.totals.C - num(project.original_contract)) > 0.005

  async function saveDraft(silent) {
    setBusy(true); setMsg('')
    const { error: he } = await supabase.from('cp_pay_apps').update({
      application_date: hdr.application_date || null, period_to: hdr.period_to || null, notes: hdr.notes || null,
    }).eq('id', app.id)
    if (he) { setBusy(false); setMsg(he.message); return false }
    for (const s of d.sov) {
      const e = edits[s.id] || {}
      const existing = d.lines.find((l) => l.sov_line_id === s.id)
      const payload = { work_this_period: r2(e.work_this_period), stored_to_date: r2(e.stored_to_date) }
      const { error } = existing
        ? await supabase.from('cp_pay_app_lines').update(payload).eq('id', existing.id)
        : await supabase.from('cp_pay_app_lines').insert({ ...payload, org_id: app.org_id, pay_app_id: app.id, sov_line_id: s.id })
      if (error) { setBusy(false); setMsg(error.message); return false }
    }
    setBusy(false)
    if (!silent) { setMsg('Draft saved.'); load() }
    return true
  }

  async function submit() {
    setConfirming(false)
    if (!hdr.period_to) { setMsg('Enter the "Period to" date before submitting.'); return }
    const ok = await saveDraft(true)
    if (!ok) return
    setBusy(true)
    const { data, error } = await supabase.rpc('cp_submit_pay_app', { p_pay_app: app.id })
    setBusy(false)
    if (error) { setMsg(error.message); return }
    setMsg(data?.invoice_number ? `Submitted. Invoice ${data.invoice_number} created for ${money(data.payment_due)}.` : 'Submitted. Nothing is due this period, so no invoice was created.')
    load()
  }

  async function deleteDraft() {
    if (!window.confirm(`Delete draft pay application #${app.app_number}?`)) return
    await supabase.from('cp_pay_apps').delete().eq('id', app.id)
    navigate(`/commercial/projects/${project.id}`)
  }

  const site = project.properties
  const siteText = site ? `${site.street_address}${site.unit ? ' #' + site.unit : ''}, ${site.city || ''}${site.state ? ', ' + site.state : ''} ${site.zip || ''}` : ''
  const cell = { textAlign: 'right', whiteSpace: 'nowrap' }
  const numInput = { width: 110, textAlign: 'right' }

  return (
    <div>
      <style>{`@media print {
        body * { visibility: hidden !important; }
        .cp-print, .cp-print * { visibility: visible !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .cp-print { position: absolute; left: 0; top: 0; width: 100%; color: #000; }
        .cp-noprint { display: none !important; }
        .cp-print table { font-size: 10px; }
        }
      .cp-printonly { display: none; }
      @media print { .cp-printonly { display: inline !important; } }`}</style>

      <div className="cp-noprint">
        <h2 className="page-title">Application for Payment #{app.app_number}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,32,96,0.06)', border: '1px solid var(--line-strong)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 14 }}>
          <span className="badge">AIA G702 / G703 format</span>
          <span>{AIA_FORMAT_NOTE} Application for Payment = G702 · Continuation Sheet = G703.</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <Link to={`/commercial/projects/${project.id}`} className="logout-button" style={{ textDecoration: 'none', fontSize: 14 }}>← {project.name}</Link>
          {locked ? <span className="status-pill status-active">Submitted {fmtDate(app.submitted_at?.slice(0, 10))} · locked</span> : <span className="badge">Draft</span>}
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="logout-button" onClick={() => window.print()}>Print / Save PDF</button>
            {!locked && <button className="logout-button" onClick={deleteDraft} disabled={busy}>Delete draft</button>}
            {!locked && <button className="logout-button" onClick={() => saveDraft(false)} disabled={busy}>Save draft</button>}
            {!locked && <button className="auth-button" style={{ width: 'auto', padding: '8px 18px' }} onClick={() => setConfirming(true)} disabled={busy}>Submit application</button>}
          </span>
        </div>

        {confirming && (
          <div style={{ background: 'rgba(242,169,60,0.12)', border: '1px solid rgba(242,169,60,0.5)', borderRadius: 10, padding: 14, marginBottom: 14 }}>
            <strong>Submit application #{app.app_number} for {money(sum.due)}?</strong>
            <div style={{ fontSize: 14, margin: '6px 0 10px' }}>Submitting locks this application (corrections go on the next one) and creates an invoice for the payment due.
              {overLines.length ? ` ${overLines.length} line${overLines.length > 1 ? 's are' : ' is'} billed past its scheduled value.` : ''}</div>
            <button className="auth-button" style={{ width: 'auto', padding: '6px 16px', marginRight: 8 }} onClick={submit}>Yes, submit</button>
            <button className="logout-button" onClick={() => setConfirming(false)}>Not yet</button>
          </div>
        )}
        {msg && <div style={{ margin: '0 0 12px', fontWeight: 600, color: /saved|Submitted/.test(msg) ? '#1F7A43' : '#B00020' }}>{msg}</div>}
        {sovMismatch && !locked && <div style={{ color: '#B00020', marginBottom: 10, fontSize: 14 }}>The schedule of values totals {money(sheet.totals.C)} but the contract is {money(project.original_contract)}. Fix the schedule of values before submitting.</div>}
        {overLines.length > 0 && <div style={{ color: '#9a6a12', marginBottom: 10, fontSize: 14 }}>Billed past scheduled value: {overLines.map((r) => r.sov.item_no || r.sov.description).join(', ')}. Check the entry or add a change order.</div>}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <div className="field" style={{ minWidth: 160 }}><label>Application date</label>
            <input type="date" value={hdr.application_date} disabled={locked} onChange={(e) => setHdr({ ...hdr, application_date: e.target.value })} /></div>
          <div className="field" style={{ minWidth: 160 }}><label>Period to</label>
            <input type="date" value={hdr.period_to} disabled={locked} onChange={(e) => setHdr({ ...hdr, period_to: e.target.value })} /></div>
          <div className="field" style={{ minWidth: 260, flex: '1 1 260px' }}><label>Notes (internal)</label>
            <input value={hdr.notes} disabled={locked} onChange={(e) => setHdr({ ...hdr, notes: e.target.value })} /></div>
        </div>
        {!locked && <p style={{ fontSize: 13, color: 'var(--mist)', margin: '0 0 8px' }}>Enter <strong>work this period</strong> in dollars, or type a <strong>% to date</strong> and Journey fills it in. <strong>Materials stored</strong> is the balance on hand now (delivered or stored offsite, not yet installed) — it carries forward from the last application.</p>}
      </div>

      <div className="cp-print">
        <PrintHeader org={org} project={project} app={app} siteText={siteText} hdr={hdr} />
        <h3 style={{ fontSize: 16, margin: '10px 0 8px' }}>Continuation Sheet <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--mist)' }}>(G703 format)</span></h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: 1180 }}>
            <thead><tr>
              <th>A<br />Item</th><th>B<br />Description of work</th><th style={cell}>C<br />Scheduled value</th><th style={cell}>D<br />From previous apps</th>
              <th style={cell}>E<br />This period</th>{!locked && <th className="cp-noprint" style={cell}>% to date</th>}<th style={cell}>F<br />Materials stored</th>
              <th style={cell}>G<br />Completed & stored</th><th style={cell}>%<br />(G÷C)</th><th style={cell}>H<br />Balance to finish</th><th style={cell}>I<br />Retainage</th>
            </tr></thead>
            <tbody>
              {sheet.rows.map((r) => (
                <tr key={r.sov.id} style={r.over ? { background: 'rgba(242,169,60,0.15)' } : undefined}>
                  <td>{r.sov.item_no}</td><td>{r.sov.description}</td><td style={cell}>{money(r.C)}</td><td style={cell}>{money(r.D)}</td>
                  <td style={cell}>{locked ? money(r.E) : <><span className="cp-printonly">{money(r.E)}</span><input className="cp-noprint" type="number" step="0.01" style={numInput} value={edits[r.sov.id]?.work_this_period ?? 0} onChange={(e) => setE(r.sov.id, 'work_this_period', e.target.value)} /></>}</td>
                  {!locked && <td className="cp-noprint" style={cell}><input type="number" step="0.1" style={{ width: 70, textAlign: 'right' }} placeholder={(r.pct * 100).toFixed(0)} onBlur={(e) => { setPctToDate(r, e.target.value); e.target.value = '' }} /></td>}
                  <td style={cell}>{locked ? money(r.F) : <><span className="cp-printonly">{money(r.F)}</span><input className="cp-noprint" type="number" step="0.01" style={numInput} value={edits[r.sov.id]?.stored_to_date ?? 0} onChange={(e) => setE(r.sov.id, 'stored_to_date', e.target.value)} /></>}</td>
                  <td style={cell}>{money(r.G)}</td><td style={cell}>{pct(r.pct)}</td><td style={cell}>{money(r.H)}</td><td style={cell}>{money(r.ret)}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 800 }}>
                <td></td><td>Totals</td><td style={cell}>{money(sheet.totals.C)}</td><td style={cell}>{money(sheet.totals.D)}</td><td style={cell}>{money(sheet.totals.E)}</td>
                {!locked && <td className="cp-noprint"></td>}<td style={cell}>{money(sheet.totals.F)}</td><td style={cell}>{money(sheet.totals.G)}</td>
                <td style={cell}>{pct(sheet.totals.pct)}</td><td style={cell}>{money(sheet.totals.H)}</td><td style={cell}>{money(sheet.totals.ret)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Summary sum={sum} rates={rates} sheet={sheet} />
        <div style={{ marginTop: 16, paddingTop: 8, borderTop: '1px solid var(--line-strong)', fontSize: 11.5, color: 'var(--mist)' }}>
          {AIA_FORMAT_NOTE} {AIA_TRADEMARK_NOTE}
        </div>
      </div>
    </div>
  )
}

function PrintHeader({ org, project, app, siteText, hdr }) {
  const kv = (k, v) => <div style={{ fontSize: 13, padding: '2px 0' }}><span style={{ color: '#555', display: 'inline-block', width: 130 }}>{k}</span>{v || '—'}</div>
  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--line-strong)', borderRadius: 10, padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
      <div>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Application for Payment{app.status === 'draft' ? ' — DRAFT, not submitted' : ''}</div>
        {kv('Application no.', String(app.app_number).padStart(3, '0'))}{kv('Application date', fmtDate(hdr.application_date))}{kv('Period to', fmtDate(hdr.period_to))}
      </div>
      <div>
        {kv('Project', `${project.name} (${project.project_number || ''})`)}{kv('Job site', siteText)}{kv('Contract #', project.contract_number)}{kv('Contract date', fmtDate(project.contract_date))}
      </div>
      <div>
        {kv('To (owner)', project.owner_name || project.customers?.display_name)}{kv('Via (GC)', project.gc_name)}{kv('Architect', project.architect_name)}
        {kv('From (contractor)', [org?.name, org?.business_phone].filter(Boolean).join(' · '))}
      </div>
    </div>
  )
}

function Summary({ sum, rates, sheet }) {
  const ln = (n, label, v, strong) => (
    <div style={{ display: 'flex', padding: '5px 0', borderBottom: '1px solid var(--line-strong)', fontWeight: strong ? 800 : 400, fontSize: strong ? 16 : 14 }}>
      <span style={{ width: 26, color: 'var(--mist)' }}>{n}</span><span style={{ flex: 1 }}>{label}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{money(v)}</span>
    </div>
  )
  const workRet = sheet.rows.reduce((s, r) => s + r2(((r.D + r.E) * num(rates.rw)) / 100), 0)
  const storedRet = sheet.rows.reduce((s, r) => s + r2((r.F * num(rates.rs)) / 100), 0)
  return (
    <div style={{ maxWidth: 560, marginTop: 18, marginLeft: 'auto', background: 'var(--panel)', border: '1px solid var(--line-strong)', borderRadius: 10, padding: '10px 16px' }}>
      <div style={{ fontWeight: 800, marginBottom: 4 }}>Contractor's application summary <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--mist)' }}>(G702 format)</span></div>
      {ln('1', 'Original contract sum', sum.original)}
      {ln('2', 'Net change by change orders', sum.netCO)}
      {ln('3', 'Contract sum to date (1 + 2)', sum.contractToDate)}
      {ln('4', 'Total completed & stored to date (column G)', sum.completed)}
      {ln('5', `Retainage: ${num(rates.rw)}% of completed work ${money(workRet)} + ${num(rates.rs)}% of stored ${money(storedRet)}`, sum.retainage)}
      {ln('6', 'Total earned less retainage (4 − 5)', sum.earned)}
      {ln('7', 'Less previous certificates for payment', sum.prev)}
      {ln('8', 'Current payment due (6 − 7)', sum.due, true)}
      {ln('9', 'Balance to finish, including retainage (3 − 6)', sum.balanceToFinish)}
    </div>
  )
}
