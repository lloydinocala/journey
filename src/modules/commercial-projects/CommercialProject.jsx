import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import { money, pct, num, fmtDate, today, PHASES, phaseLabel, createNextPayApp, tileStyle, tabBtn, approvedCoTotal, pendingCoTotal } from './data'
import ChangeOrdersTab from './ChangeOrdersTab'
import LienWaiversTab from './LienWaiversTab'
import { SubmittalsRfisTab, EquipmentTab, FieldTab, CloseoutTab, DocumentsTab } from './ProjectLogsTabs'

// Commercial Projects · one project's workspace
// (Overview · Schedule of Values · Pay Applications · Change Orders · Lien Waivers).
export default function CommercialProject({ profile }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [tab, setTab] = useState(params.get('tab') || 'overview')
  const [project, setProject] = useState(null)
  const [sov, setSov] = useState([])
  const [apps, setApps] = useState([])
  const [invoices, setInvoices] = useState({})
  const [cos, setCos] = useState([])
  const [docs, setDocs] = useState([])
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const [{ data: p, error }, { data: s }, { data: a }, { data: c }, { data: ld }] = await Promise.all([
      supabase.from('cp_projects').select('*, customers(display_name), properties(street_address, unit, city, state, zip)').eq('id', id).maybeSingle(),
      supabase.from('cp_sov_lines').select('*').eq('project_id', id).order('sort_order').order('item_no'),
      supabase.from('cp_pay_apps').select('*').eq('project_id', id).order('app_number'),
      supabase.from('cp_change_orders').select('*').eq('project_id', id).order('co_number'),
      supabase.from('cp_lien_documents').select('*').eq('project_id', id).order('created_at', { ascending: false }),
    ])
    if (error || !p) { setErr(error?.message || 'Project not found'); return }
    setProject(p); setSov(s || []); setApps(a || []); setCos(c || []); setDocs(ld || [])
    const invIds = (a || []).map((x) => x.invoice_id).filter(Boolean)
    if (invIds.length) {
      const { data: inv } = await supabase.from('invoices').select('id, invoice_number, paid_at, total_paid, amount_due, sent_at').in('id', invIds)
      setInvoices(Object.fromEntries((inv || []).map((i) => [i.id, i])))
    } else setInvoices({})
  }, [id])
  useEffect(() => { load() }, [load])

  if (err) return <div><h2 className="page-title">Commercial Project</h2><p>{err}</p><Link to="/commercial/projects">← All commercial projects</Link></div>
  if (!project) return <div><h2 className="page-title">Commercial Project</h2><p style={{ color: 'var(--mist)' }}>Loading…</p></div>

  const submitted = apps.filter((a) => a.status === 'submitted')
  const latest = submitted.at(-1) || null
  const draft = apps.find((a) => a.status === 'draft') || null
  const site = project.properties
  const siteText = site ? `${site.street_address}${site.unit ? ' #' + site.unit : ''}, ${site.city || ''}` : ''

  async function startPayApp() {
    if (draft) { navigate(`/commercial/pay-apps/${draft.id}`); return }
    const r = await createNextPayApp(project)
    if (r.error) { alert(r.error); return }
    navigate(`/commercial/pay-apps/${r.id}`)
  }

  return (
    <div>
      <h2 className="page-title">{project.name}</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
        <Link to="/commercial/projects" className="logout-button" style={{ textDecoration: 'none', fontSize: 14 }}>← All commercial projects</Link>
        <span className="badge">{project.project_number}</span>
        <span className="badge">{phaseLabel(project.phase)}</span>
        <span style={{ color: 'var(--mist)', fontSize: 14 }}>{project.customers?.display_name || 'No customer'}{siteText ? ' · ' + siteText : ''}</span>
        <button className="auth-button" style={{ width: 'auto', padding: '8px 16px', marginLeft: 'auto' }} onClick={startPayApp}>
          {draft ? `Continue pay application #${draft.app_number}` : `+ Pay application #${(apps.at(-1)?.app_number || 0) + 1}`}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', borderBottom: '1px solid var(--line-strong)', margin: '14px 0 18px' }}>
        <button style={tabBtn(tab === 'overview')} onClick={() => setTab('overview')}>Overview</button>
        <button style={tabBtn(tab === 'sov')} onClick={() => setTab('sov')}>Schedule of Values</button>
        <button style={tabBtn(tab === 'payapps')} onClick={() => setTab('payapps')}>Pay Applications ({apps.length})</button>
        <button style={tabBtn(tab === 'cos')} onClick={() => setTab('cos')}>Change Orders ({cos.length})</button>
        <button style={tabBtn(tab === 'liens')} onClick={() => setTab('liens')}>Lien Waivers ({docs.length})</button>
        <span style={{ borderLeft: '1px solid var(--line-strong)', margin: '6px 6px' }} />
        <button style={tabBtn(tab === 'subs')} onClick={() => setTab('subs')}>Submittals & RFIs</button>
        <button style={tabBtn(tab === 'equip')} onClick={() => setTab('equip')}>Equipment</button>
        <button style={tabBtn(tab === 'field')} onClick={() => setTab('field')}>Field</button>
        <button style={tabBtn(tab === 'closeout')} onClick={() => setTab('closeout')}>Closeout</button>
        <button style={tabBtn(tab === 'docs')} onClick={() => setTab('docs')}>Documents</button>
      </div>

      {tab === 'overview' && <Overview project={project} sov={sov} latest={latest} cos={cos} onSaved={load} />}
      {tab === 'sov' && <SovTab project={project} sov={sov} cos={cos} hasSubmitted={submitted.length > 0} onSaved={load} />}
      {tab === 'cos' && <ChangeOrdersTab project={project} changeOrders={cos} profile={profile} />}
      {tab === 'liens' && <LienWaiversTab project={project} docs={docs} apps={apps} />}
      {tab === 'subs' && <SubmittalsRfisTab project={project} profile={profile} />}
      {tab === 'equip' && <EquipmentTab project={project} profile={profile} />}
      {tab === 'field' && <FieldTab project={project} profile={profile} />}
      {tab === 'closeout' && <CloseoutTab project={project} docs={docs} apps={apps} />}
      {tab === 'docs' && <DocumentsTab project={project} profile={profile} />}
      {tab === 'payapps' && <PayAppsTab apps={apps} invoices={invoices} onOpen={(a) => navigate(`/commercial/pay-apps/${a.id}`)} onNew={startPayApp} draft={draft} />}
    </div>
  )
}

function Overview({ project, sov, latest, cos, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [f, setF] = useState(project)
  const [saving, setSaving] = useState(false)
  useEffect(() => { setF(project) }, [project])
  const approvedCO = approvedCoTotal(cos), pendingCO = pendingCoTotal(cos)
  const contract = num(project.original_contract) + approvedCO
  const sovTotal = sov.reduce((s, l) => s + num(l.scheduled_value), 0)
  const completed = latest ? num(latest.total_completed) : 0
  const certified = latest ? num(latest.earned_less_retainage) : 0
  const retHeld = latest ? num(latest.retainage_amount) : 0
  const gates = project.gates || {}

  async function save() {
    setSaving(true)
    const blank = (v) => (v === '' || v == null ? null : v)
    await supabase.from('cp_projects').update({
      name: f.name, owner_name: blank(f.owner_name), gc_name: blank(f.gc_name), architect_name: blank(f.architect_name), engineer_name: blank(f.engineer_name),
      contract_number: blank(f.contract_number), contract_date: blank(f.contract_date), original_contract: num(f.original_contract),
      retainage_percent: num(f.retainage_percent), retainage_stored_percent: f.retainage_stored_percent === '' || f.retainage_stored_percent == null ? null : num(f.retainage_stored_percent),
      start_date: blank(f.start_date), substantial_completion_date: blank(f.substantial_completion_date), status: f.status, notes: blank(f.notes), updated_at: new Date().toISOString(),
    }).eq('id', project.id)
    setSaving(false); setEditing(false); onSaved()
  }

  // Checking a gate stamps today's date and moves the project to the next phase.
  async function toggleGate(idx) {
    const ph = PHASES[idx]
    const next = { ...gates }
    let phase = project.phase
    if (next[ph.gate]) { delete next[ph.gate]; phase = ph.key }
    else { next[ph.gate] = today(); phase = (PHASES[idx + 1] || ph).key }
    await supabase.from('cp_projects').update({ gates: next, phase, updated_at: new Date().toISOString() }).eq('id', project.id)
    onSaved()
  }

  const tile = (label, val, note, color) => (
    <div style={tileStyle}><div style={{ fontSize: 12, color: 'var(--mist)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: color || 'inherit' }}>{val}</div>
      {note ? <div style={{ fontSize: 12, color: 'var(--mist)', marginTop: 2 }}>{note}</div> : null}</div>
  )
  const row = (label, val) => <div style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--line-strong)' }}><span style={{ width: 170, color: 'var(--mist)', fontSize: 13 }}>{label}</span><span style={{ fontSize: 14 }}>{val || '—'}</span></div>
  const inp = (label, key, type = 'text') => (
    <div className="field" style={{ minWidth: 180, flex: '1 1 180px' }}><label>{label}</label>
      <input type={type} step={type === 'number' ? '0.01' : undefined} value={f[key] ?? ''} onChange={(e) => setF({ ...f, [key]: e.target.value })} /></div>
  )

  return (
    <div style={{ display: 'grid', gap: 22 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {tile('Contract sum to date', money(contract), approvedCO || pendingCO ? `Original ${money(project.original_contract)} · approved changes ${money(approvedCO)}${pendingCO ? ` · pending ${money(pendingCO)}` : ''}` : null)}
        {tile('Schedule of values', money(sovTotal), Math.abs(sovTotal - contract) > 0.005 ? `${money(Math.abs(contract - sovTotal))} ${sovTotal < contract ? 'not yet assigned' : 'over the contract'}` : 'Matches the contract', Math.abs(sovTotal - contract) > 0.005 ? '#B00020' : undefined)}
        {tile('Completed & stored', money(completed), contract ? pct(completed / contract) + ' of contract' : '')}
        {tile('Certified to date', money(certified), 'Earned less retainage', '#1F7A43')}
        {tile(`Retainage held (${num(project.retainage_percent)}%)`, money(retHeld), 'Released at closeout', '#9a6a12')}
        {tile('Balance to finish', money(contract - certified), 'Including retainage')}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 22 }}>
        <section>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
            <h3 style={{ fontSize: 16, margin: 0 }}>Contract & parties</h3>
            {!editing && <button className="logout-button" style={{ marginLeft: 'auto', fontSize: 14, padding: '4px 12px' }} onClick={() => setEditing(true)}>Edit</button>}
          </div>
          {!editing ? (<>
            {row('Owner', project.owner_name)}{row('General contractor', project.gc_name)}{row('Architect', project.architect_name)}{row('Engineer', project.engineer_name)}
            {row('Contract #', project.contract_number)}{row('Contract date', fmtDate(project.contract_date))}
            {row('Retainage', `${num(project.retainage_percent)}% on work${project.retainage_stored_percent != null ? `, ${num(project.retainage_stored_percent)}% on stored material` : ''}`)}
            {row('Start', fmtDate(project.start_date))}{row('Substantial completion', fmtDate(project.substantial_completion_date))}
            {row('Status', project.status.replace('_', ' '))}{project.notes ? row('Notes', project.notes) : null}
          </>) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {inp('Project name', 'name')}{inp('Owner', 'owner_name')}{inp('General contractor', 'gc_name')}{inp('Architect', 'architect_name')}{inp('Engineer', 'engineer_name')}
              {inp('Contract #', 'contract_number')}{inp('Contract date', 'contract_date', 'date')}{inp('Original contract sum', 'original_contract', 'number')}
              {inp('Retainage % (work)', 'retainage_percent', 'number')}{inp('Retainage % (stored; blank = same)', 'retainage_stored_percent', 'number')}
              {inp('Start date', 'start_date', 'date')}{inp('Substantial completion', 'substantial_completion_date', 'date')}
              <div className="field" style={{ minWidth: 160 }}><label>Status</label>
                <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
                  <option value="active">Active</option><option value="on_hold">On hold</option><option value="complete">Complete</option><option value="cancelled">Cancelled</option>
                </select></div>
              <div className="field" style={{ flex: '1 1 100%' }}><label>Notes</label>
                <textarea rows={3} value={f.notes || ''} onChange={(e) => setF({ ...f, notes: e.target.value })} style={{ width: '100%' }} /></div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="auth-button" style={{ width: 'auto', padding: '8px 16px' }} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                <button className="logout-button" onClick={() => { setF(project); setEditing(false) }}>Cancel</button>
              </div>
            </div>
          )}
        </section>

        <section>
          <h3 style={{ fontSize: 16, margin: '0 0 6px' }}>Phases & gates</h3>
          <p style={{ fontSize: 13, color: 'var(--mist)', margin: '0 0 8px' }}>Check a gate when it's met; the project moves to the next phase. Gates record the date — they never lock you out.</p>
          {PHASES.map((ph, i) => {
            const met = gates[ph.gate]
            const current = project.phase === ph.key
            return (
              <label key={ph.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, marginBottom: 4,
                background: current ? 'rgba(0,32,96,0.07)' : 'transparent', border: current ? '1px solid var(--line-strong)' : '1px solid transparent', cursor: 'pointer' }}>
                <input type="checkbox" checked={!!met} onChange={() => toggleGate(i)} />
                <span style={{ flex: 1 }}><strong>{i + 1}. {ph.label}</strong>{current ? <span className="badge" style={{ marginLeft: 8 }}>current</span> : null}
                  <div style={{ fontSize: 12.5, color: 'var(--mist)' }}>Gate: {ph.gateLabel}</div></span>
                <span style={{ fontSize: 13, color: met ? '#1F7A43' : 'var(--mist)' }}>{met ? fmtDate(met) : 'open'}</span>
              </label>
            )
          })}
        </section>
      </div>
    </div>
  )
}

function SovTab({ project, sov, cos, hasSubmitted, onSaved }) {
  const [rows, setRows] = useState(sov)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  useEffect(() => { setRows(sov); setDirty(false) }, [sov])
  const total = rows.reduce((s, r) => s + num(r.scheduled_value), 0)
  const contract = num(project.original_contract) + approvedCoTotal(cos)
  const diff = contract - total
  const upd = (i, k, v) => { const n = rows.slice(); n[i] = { ...n[i], [k]: v }; setRows(n); setDirty(true) }

  function addLine() {
    const last = rows.at(-1)
    const nextNo = last && /^\d+$/.test(last.item_no || '') ? String(Number(last.item_no) + 100) : ''
    setRows([...rows, { _new: true, item_no: nextNo, description: '', scheduled_value: 0, cost_code: '', sort_order: (last?.sort_order || 0) + 1 }])
    setDirty(true)
  }

  async function removeLine(i) {
    const r = rows[i]
    if (r._new) { setRows(rows.filter((_, j) => j !== i)); return }
    if (r.change_order_id) { setMsg('This line came from an approved change order. Unapprove the change order to remove it.'); return }
    if (!window.confirm(`Remove line ${r.item_no || ''} "${r.description}"?`)) return
    const { error } = await supabase.from('cp_sov_lines').delete().eq('id', r.id)
    if (error) { setMsg(error.message.includes('locked') ? 'This line has been billed on a submitted pay application, so it stays. Set it aside by leaving its value as billed.' : error.message); return }
    onSaved()
  }

  async function save() {
    if (hasSubmitted) {
      const changed = rows.some((r) => !r._new && num(sov.find((s) => s.id === r.id)?.scheduled_value) !== num(r.scheduled_value))
      if (changed && !window.confirm('A pay application has already been submitted. Changing scheduled values after billing normally goes through a change order. Save the new values anyway?')) return
    }
    setSaving(true); setMsg('')
    for (const [i, r] of rows.entries()) {
      const payload = { item_no: r.item_no || null, description: (r.description || '').trim() || 'Untitled line', scheduled_value: num(r.scheduled_value), cost_code: r.cost_code || null, sort_order: i + 1 }
      if (r._new) await supabase.from('cp_sov_lines').insert({ ...payload, org_id: project.org_id, project_id: project.id })
      else await supabase.from('cp_sov_lines').update(payload).eq('id', r.id)
    }
    setSaving(false); onSaved()
  }

  return (
    <div>
      <p style={{ fontSize: 14, color: 'var(--mist)', marginTop: 0 }}>Split the contract across the work. Every pay application bills against these lines, so they should total the contract sum. Approved change orders add their own lines (marked CO).</p>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table" style={{ minWidth: 760 }}>
          <thead><tr><th style={{ width: 90 }}>Item #</th><th>Description of work</th><th style={{ width: 170, textAlign: 'right' }}>Scheduled value</th><th style={{ width: 130 }}>Cost code</th><th style={{ width: 60 }}></th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id || 'n' + i}>
                <td><input value={r.item_no || ''} onChange={(e) => upd(i, 'item_no', e.target.value)} style={{ width: '100%' }} /></td>
                <td><input value={r.description || ''} onChange={(e) => upd(i, 'description', e.target.value)} style={{ width: '100%' }} placeholder="e.g. Chiller equipment supply" /></td>
                <td>{r.change_order_id
                  ? <div style={{ textAlign: 'right' }} title="Set by the approved change order">{money(r.scheduled_value)} <span className="badge">CO</span></div>
                  : <input type="number" step="0.01" value={r.scheduled_value ?? ''} onChange={(e) => upd(i, 'scheduled_value', e.target.value)} style={{ width: '100%', textAlign: 'right' }} />}</td>
                <td><input value={r.cost_code || ''} onChange={(e) => upd(i, 'cost_code', e.target.value)} style={{ width: '100%' }} /></td>
                <td><button className="logout-button" style={{ padding: '2px 10px', fontSize: 13 }} onClick={() => removeLine(i)} title="Remove line">✕</button></td>
              </tr>
            ))}
            <tr style={{ fontWeight: 700 }}>
              <td></td><td>Total</td><td style={{ textAlign: 'right' }}>{money(total)}</td>
              <td colSpan={2} style={{ fontWeight: 600, fontSize: 13, color: Math.abs(diff) > 0.005 ? '#B00020' : '#1F7A43' }}>
                {Math.abs(diff) > 0.005 ? `${money(Math.abs(diff))} ${diff > 0 ? 'left to assign' : 'over the contract'}` : 'Matches contract'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {msg && <div style={{ color: '#B00020', margin: '8px 0' }}>{msg}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <button className="logout-button" onClick={addLine}>+ Add line</button>
        <button className="auth-button" style={{ width: 'auto', padding: '8px 18px' }} onClick={save} disabled={!dirty || saving}>{saving ? 'Saving…' : 'Save schedule of values'}</button>
        <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--mist)' }}>Contract sum to date: {money(contract)}{approvedCoTotal(cos) ? ' (includes approved change orders)' : ''}</span>
      </div>
    </div>
  )
}

function PayAppsTab({ apps, invoices, onOpen, onNew, draft }) {
  if (!apps.length) return (
    <div style={{ background: 'var(--panel)', border: '1px dashed var(--line-strong)', borderRadius: 10, padding: 24, color: 'var(--mist)' }}>
      No pay applications yet. When the first billing period closes, start <button className="logout-button" onClick={onNew}>Pay application #1</button>
    </div>
  )
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table" style={{ minWidth: 900 }}>
        <thead><tr><th>App #</th><th>Period to</th><th>Status</th><th style={{ textAlign: 'right' }}>Completed & stored</th><th style={{ textAlign: 'right' }}>Retainage</th><th style={{ textAlign: 'right' }}>Payment due</th><th>Invoice</th></tr></thead>
        <tbody>
          {apps.slice().reverse().map((a) => {
            const inv = a.invoice_id ? invoices[a.invoice_id] : null
            return (
              <tr key={a.id} onClick={() => onOpen(a)} style={{ cursor: 'pointer' }}>
                <td style={{ fontWeight: 600 }}>#{a.app_number}{a.is_final ? <span className="badge" style={{ marginLeft: 6 }}>Final</span> : null}</td>
                <td>{fmtDate(a.period_to)}</td>
                <td>{a.status === 'draft' ? <span className="badge">Draft</span> : <span className="status-pill status-active">Submitted {fmtDate(a.submitted_at?.slice(0, 10))}</span>}</td>
                <td style={{ textAlign: 'right' }}>{a.status === 'draft' ? '—' : money(a.total_completed)}</td>
                <td style={{ textAlign: 'right' }}>{a.status === 'draft' ? '—' : money(a.retainage_amount)}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{a.status === 'draft' ? '—' : money(a.current_payment_due)}</td>
                <td>{inv ? <>{inv.invoice_number} · {inv.paid_at ? <span style={{ color: '#1F7A43' }}>paid</span> : 'unpaid'}</> : (a.status === 'draft' ? '—' : 'none (nothing due)')}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {draft ? null : <button className="logout-button" style={{ marginTop: 12 }} onClick={onNew}>+ Next pay application</button>}
    </div>
  )
}
