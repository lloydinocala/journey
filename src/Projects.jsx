import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import CustomerSearchSelect from './CustomerSearchSelect'
import QuickAddModal from './QuickAddModal'

// Projects = the progress-billing overlay. A project groups the stage jobs
// (New Construction Rough-In / Trim / Start-Up, plus Punchlist) at one property
// under a contract total. Each stage is a normal job with its own
// estimate/invoice; a draw is an invoice billed against the contract. Draws can
// also be scheduled (% of contract) with a retainage hold-back released at the end.
const money = (v) => (v == null ? '—' : '$' + Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const today = () => new Date().toISOString().slice(0, 10)

export default function Projects({ profile }) {
  const navigate = useNavigate()
  const isSuperAdmin = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')

  const [projects, setProjects] = useState([])
  const [jobsByProject, setJobsByProject] = useState({})
  const [invByProject, setInvByProject] = useState({})   // project_id -> [invoice rows]
  const [rollups, setRollups] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)

  // create form
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCustomer, setNewCustomer] = useState('')
  const [newProps, setNewProps] = useState([])
  const [newProperty, setNewProperty] = useState('')
  const [newContract, setNewContract] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  // detail: attach, add-job modal, edit, draws
  const [attachable, setAttachable] = useState([])
  const [attachId, setAttachId] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(false)
  const [edit, setEdit] = useState({})
  const [draws, setDraws] = useState([])
  const [newDrawLabel, setNewDrawLabel] = useState('')
  const [newDrawPct, setNewDrawPct] = useState('')
  const [newDrawAmt, setNewDrawAmt] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        if (!selectedOrg && data && data.length > 0) setSelectedOrg(data[0].id)
      })
    }
  }, [])

  const load = useCallback(async (orgId) => {
    if (!orgId) { setProjects([]); setLoading(false); return }
    setLoading(true)
    const { data: projs } = await supabase.from('projects')
      .select('id, project_number, name, customer_id, property_id, contract_total, retainage_percent, billing_mode, status, created_at, customers(display_name), properties(street_address, unit, city)')
      .eq('org_id', orgId).order('created_at', { ascending: false })
    const projIds = (projs || []).map((p) => p.id)
    const { data: pjobs } = await supabase.from('jobs')
      .select('id, project_id, job_number, segment, job_type, status')
      .eq('org_id', orgId).not('project_id', 'is', null).is('deleted_at', null).order('job_number')
    const jobIds = (pjobs || []).map((j) => j.id)
    const jobProject = Object.fromEntries((pjobs || []).map((j) => [j.id, j.project_id]))

    // Invoices that count toward a project: those on its stage jobs, plus draws linked directly.
    const invMap = {}   // invoice id -> { project_id, kind, job_total, total_paid, paid_at }
    if (jobIds.length) {
      const { data } = await supabase.from('invoices')
        .select('id, job_id, kind, job_total, total_paid, paid_at').in('job_id', jobIds).is('deleted_at', null).neq('is_archived', true)
      for (const r of (data || [])) invMap[r.id] = { ...r, project_id: jobProject[r.job_id] }
    }
    if (projIds.length) {
      const { data } = await supabase.from('invoices')
        .select('id, project_id, kind, job_total, total_paid, paid_at').in('project_id', projIds).is('deleted_at', null).neq('is_archived', true)
      for (const r of (data || [])) invMap[r.id] = { ...(invMap[r.id] || {}), ...r }
    }

    const byProject = {}
    for (const j of (pjobs || [])) { (byProject[j.project_id] = byProject[j.project_id] || []).push(j) }
    const invByP = {}
    const roll = {}
    for (const p of (projs || [])) { roll[p.id] = { estimated: 0, billed: 0, paid: 0 }; invByP[p.id] = [] }
    for (const inv of Object.values(invMap)) {
      const pid = inv.project_id
      if (!pid || !roll[pid]) continue
      invByP[pid].push(inv)
      if (inv.kind === 'estimate') roll[pid].estimated += Number(inv.job_total || 0)
      else { roll[pid].billed += Number(inv.job_total || 0); roll[pid].paid += Number(inv.total_paid || 0) }
    }
    setProjects(projs || [])
    setJobsByProject(byProject)
    setInvByProject(invByP)
    setRollups(roll)
    setLoading(false)
  }, [])

  useEffect(() => { load(selectedOrg) }, [selectedOrg, load])

  useEffect(() => {
    if (!newCustomer) { setNewProps([]); setNewProperty(''); return }
    supabase.from('properties').select('id, street_address, unit, city').eq('customer_id', newCustomer).order('street_address')
      .then(({ data }) => setNewProps(data || []))
  }, [newCustomer])

  async function createProject(e) {
    e.preventDefault()
    setErr('')
    if (!newName.trim()) { setErr('Project name is required.'); return }
    setSaving(true)
    const num = 'P' + String((projects.length || 0) + 1).padStart(4, '0')
    const { data, error } = await supabase.from('projects').insert({
      org_id: selectedOrg, name: newName.trim(), customer_id: newCustomer || null,
      property_id: newProperty || null, contract_total: newContract === '' ? null : parseFloat(newContract),
      project_number: num, created_by: profile.id || null,
    }).select('id').maybeSingle()
    setSaving(false)
    if (error) { setErr(error.message); return }
    setShowCreate(false); setNewName(''); setNewCustomer(''); setNewProperty(''); setNewContract('')
    await load(selectedOrg)
    if (data?.id) openDetail({ id: data.id, customer_id: newCustomer, property_id: newProperty })
  }

  async function loadAttachable(project) {
    let q = supabase.from('jobs').select('id, job_number, segment, job_type, status')
      .eq('org_id', selectedOrg).is('project_id', null).is('deleted_at', null)
    if (project.property_id) q = q.eq('property_id', project.property_id)
    else if (project.customer_id) q = q.eq('customer_id', project.customer_id)
    const { data } = await q.order('job_number').limit(100)
    setAttachable(data || [])
  }

  async function loadDraws(projectId) {
    const { data } = await supabase.from('project_draws').select('*').eq('project_id', projectId).order('sort_order')
    setDraws(data || [])
  }

  function openDetail(p) {
    setSelectedId(p.id); setEditing(false)
    loadAttachable(p); loadDraws(p.id)
  }

  async function attachJob() {
    if (!attachId) return
    await supabase.from('jobs').update({ project_id: selectedId }).eq('id', attachId)
    setAttachId(''); await load(selectedOrg)
    const proj = projects.find((p) => p.id === selectedId); if (proj) loadAttachable(proj)
  }
  async function detachJob(jobId) {
    await supabase.from('jobs').update({ project_id: null }).eq('id', jobId)
    await load(selectedOrg)
    const proj = projects.find((p) => p.id === selectedId); if (proj) loadAttachable(proj)
  }

  function startEdit(p) {
    setEditing(true)
    setEdit({ name: p.name, contract_total: p.contract_total ?? '', retainage_percent: p.retainage_percent ?? 0, billing_mode: p.billing_mode || 'standalone', status: p.status || 'active' })
  }
  async function saveEdit(id) {
    await supabase.from('projects').update({
      name: edit.name.trim(),
      contract_total: edit.contract_total === '' ? null : parseFloat(edit.contract_total),
      retainage_percent: parseFloat(edit.retainage_percent) || 0,
      billing_mode: edit.billing_mode,
      status: edit.status,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    setEditing(false); await load(selectedOrg)
  }

  async function nextInvoiceNumber(orgId) {
    const { data } = await supabase.from('invoices').select('invoice_number').eq('org_id', orgId).like('invoice_number', 'INV-%')
    let max = 0
    for (const r of (data || [])) { const n = parseInt((r.invoice_number || '').replace('INV-', ''), 10); if (!isNaN(n) && n > max) max = n }
    return 'INV-' + String(max + 1).padStart(4, '0')
  }

  async function addDraw(project) {
    if (!newDrawLabel.trim()) return
    const pct = newDrawPct === '' ? null : parseFloat(newDrawPct)
    let amt = newDrawAmt === '' ? null : parseFloat(newDrawAmt)
    if (amt == null && pct != null && project.contract_total != null) amt = +(Number(project.contract_total) * pct / 100).toFixed(2)
    const sort = draws.length > 0 ? Math.max(...draws.map((d) => d.sort_order)) + 1 : 1
    await supabase.from('project_draws').insert({
      org_id: selectedOrg, project_id: project.id, label: newDrawLabel.trim(),
      percent: pct, amount: amt, sort_order: sort,
    })
    setNewDrawLabel(''); setNewDrawPct(''); setNewDrawAmt('')
    loadDraws(project.id)
  }

  async function billDraw(project, d) {
    setBusy(true)
    const gross = Number(d.amount || 0)
    const ret = Number(project.retainage_percent || 0)
    const held = +(gross * ret / 100).toFixed(2)
    const net = +(gross - held).toFixed(2)
    const invNum = await nextInvoiceNumber(selectedOrg)
    const { data: inv, error } = await supabase.from('invoices').insert({
      org_id: selectedOrg, project_id: project.id, invoice_number: invNum, kind: 'invoice',
      bills_to_customer_id: project.customer_id || null, property_id: project.property_id || null,
      invoice_date: today(), subtotal: net, job_total: net, amount_due: net, balance: net,
      approval_status: 'Approved',
    }).select('id').maybeSingle()
    if (error) { setBusy(false); alert('Could not create draw invoice: ' + error.message); return }
    await supabase.from('invoice_line_items').insert({
      org_id: selectedOrg, invoice_id: inv.id,
      description: `${d.label} — progress draw${held > 0 ? ` (net of ${ret}% retainage)` : ''}`,
      unit_price: net, quantity: 1, taxable: false, is_custom: true, sort_order: 0, category: 'Progress Billing',
    })
    await supabase.from('project_draws').update({ status: 'billed', invoice_id: inv.id, retainage_held: held, billed_at: new Date().toISOString() }).eq('id', d.id)
    setBusy(false)
    await load(selectedOrg); loadDraws(project.id)
  }

  async function releaseRetainage(project) {
    const held = draws.reduce((s, d) => s + Number(d.retainage_held || 0), 0)
    if (held <= 0) { alert('No retainage held yet.'); return }
    if (draws.some((d) => d.label === 'Retainage Release')) { alert('Retainage already released.'); return }
    setBusy(true)
    const invNum = await nextInvoiceNumber(selectedOrg)
    const { data: inv, error } = await supabase.from('invoices').insert({
      org_id: selectedOrg, project_id: project.id, invoice_number: invNum, kind: 'invoice',
      bills_to_customer_id: project.customer_id || null, property_id: project.property_id || null,
      invoice_date: today(), subtotal: held, job_total: held, amount_due: held, balance: held, approval_status: 'Approved',
    }).select('id').maybeSingle()
    if (error) { setBusy(false); alert('Could not create retainage invoice: ' + error.message); return }
    await supabase.from('invoice_line_items').insert({
      org_id: selectedOrg, invoice_id: inv.id, description: 'Retainage release',
      unit_price: held, quantity: 1, taxable: false, is_custom: true, sort_order: 0, category: 'Progress Billing',
    })
    const sort = draws.length > 0 ? Math.max(...draws.map((d) => d.sort_order)) + 1 : 1
    await supabase.from('project_draws').insert({
      org_id: selectedOrg, project_id: project.id, label: 'Retainage Release',
      amount: held, retainage_held: 0, status: 'billed', invoice_id: inv.id, billed_at: new Date().toISOString(), sort_order: sort,
    })
    setBusy(false); await load(selectedOrg); loadDraws(project.id)
  }

  async function deleteDraw(d, projectId) {
    await supabase.from('project_draws').delete().eq('id', d.id)
    loadDraws(projectId)
  }

  const selected = projects.find((p) => p.id === selectedId) || null

  // ---------- Detail ----------
  if (selected) {
    const r = rollups[selected.id] || { estimated: 0, billed: 0, paid: 0 }
    const invById = Object.fromEntries((invByProject[selected.id] || []).map((i) => [i.id, i]))
    const retHeld = draws.reduce((s, d) => s + Number(d.retainage_held || 0), 0)
    const contract = selected.contract_total
    const remaining = contract != null ? Number(contract) - r.billed : null
    const stageJobs = jobsByProject[selected.id] || []
    const drawTotal = draws.reduce((s, d) => s + Number(d.amount || 0), 0)
    const tile = (label, val, color) => (
      <div style={{ background: 'var(--panel)', border: '1px solid var(--jc-line, rgba(0,0,0,0.08))', borderRadius: 10, padding: '14px 16px', minWidth: 120 }}>
        <div style={{ fontSize: 12, color: 'var(--mist)', marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 19, fontWeight: 800, color: color || 'inherit' }}>{val}</div>
      </div>
    )
    return (
      <div>
        <button className="logout-button" onClick={() => { setSelectedId(null); setAttachable([]); setDraws([]) }} style={{ marginBottom: 14 }}>← All projects</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
          <h2 className="page-title" style={{ margin: 0 }}>{selected.name}</h2>
          <span className="badge">{selected.project_number}</span>
          <span className={`status-pill ${selected.status === 'active' ? 'status-active' : 'status-canceled'}`}>{selected.status}</span>
          {!editing && <button className="logout-button" onClick={() => startEdit(selected)}>Edit</button>}
          <button className="auth-button" style={{ width: 'auto', padding: '8px 16px', marginLeft: 'auto' }} onClick={() => setShowAdd(true)}>+ Add</button>
        </div>
        <div style={{ color: 'var(--mist)', fontSize: 13, marginBottom: 16 }}>
          {selected.customers?.display_name || '—'}
          {selected.properties?.street_address ? ` · ${selected.properties.street_address}${selected.properties.unit ? ' #' + selected.properties.unit : ''}, ${selected.properties.city || ''}` : ''}
        </div>

        {editing && (
          <div style={{ background: 'var(--panel)', borderRadius: 10, padding: 16, marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
            <div className="field" style={{ minWidth: 220 }}><label>Name</label><input type="text" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
            <div className="field" style={{ minWidth: 130 }}><label>Contract total</label><input type="number" step="0.01" value={edit.contract_total} onChange={(e) => setEdit({ ...edit, contract_total: e.target.value })} /></div>
            <div className="field" style={{ minWidth: 110 }}><label>Retainage %</label><input type="number" step="0.1" value={edit.retainage_percent} onChange={(e) => setEdit({ ...edit, retainage_percent: e.target.value })} /></div>
            <div className="field" style={{ minWidth: 150 }}><label>Billing mode</label>
              <select value={edit.billing_mode} onChange={(e) => setEdit({ ...edit, billing_mode: e.target.value })}>
                <option value="standalone">Standalone bids</option>
                <option value="draws">Progress draws</option>
              </select>
            </div>
            <div className="field" style={{ minWidth: 140 }}><label>Status</label>
              <select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="complete">Complete</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <button className="auth-button" style={{ width: 'auto', padding: '8px 16px' }} onClick={() => saveEdit(selected.id)}>Save</button>
            <button className="logout-button" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
          {tile('Contract', money(contract))}
          {tile('Estimated', money(r.estimated))}
          {tile('Billed', money(r.billed), '#1F7A43')}
          {tile('Paid', money(r.paid), '#1F7A43')}
          {tile('Remaining', remaining == null ? '—' : money(remaining), remaining != null && remaining < 0 ? '#B00020' : undefined)}
          {Number(selected.retainage_percent) > 0 && tile(`Retainage held (${selected.retainage_percent}%)`, money(retHeld), '#9a6a12')}
        </div>

        {/* Draw schedule */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          <h3 style={{ fontSize: 16, margin: 0 }}>Draw schedule</h3>
          {contract != null && <span style={{ fontSize: 12.5, color: drawTotal > Number(contract) ? '#B00020' : 'var(--mist)' }}>planned {money(drawTotal)} of {money(contract)}</span>}
          {retHeld > 0 && <button className="logout-button" onClick={() => releaseRetainage(selected)} disabled={busy}>Release retainage ({money(retHeld)})</button>}
        </div>
        <div style={{ overflowX: 'auto', marginBottom: 12 }}>
          <div className="grid-table" style={{ gridTemplateColumns: '1.6fr 0.7fr 1fr 1fr 1fr 0.9fr 1.3fr', minWidth: 820 }}>
            <div className="grid-cell grid-head">Draw</div>
            <div className="grid-cell grid-head">%</div>
            <div className="grid-cell grid-head">Amount</div>
            <div className="grid-cell grid-head">Retainage</div>
            <div className="grid-cell grid-head">Net billed</div>
            <div className="grid-cell grid-head">Status</div>
            <div className="grid-cell grid-head"></div>
            {draws.map((d, i) => {
              const bg = i % 2 ? 'var(--ink)' : 'var(--panel)'
              const inv = d.invoice_id ? invById[d.invoice_id] : null
              const paid = inv && (inv.paid_at || Number(inv.total_paid || 0) >= Number(inv.job_total || 0) && Number(inv.job_total || 0) > 0)
              const status = d.status === 'billed' ? (paid ? 'Paid' : 'Billed') : 'Planned'
              const net = d.status === 'billed' ? Number(d.amount || 0) - Number(d.retainage_held || 0) : null
              return (
                <div key={d.id} style={{ display: 'contents' }}>
                  <div className="grid-cell" style={{ background: bg }}>{d.label}</div>
                  <div className="grid-cell" style={{ background: bg }}>{d.percent != null ? d.percent + '%' : '—'}</div>
                  <div className="grid-cell" style={{ background: bg }}>{money(d.amount)}</div>
                  <div className="grid-cell" style={{ background: bg }}>{money(d.retainage_held)}</div>
                  <div className="grid-cell" style={{ background: bg }}>{net == null ? '—' : money(net)}</div>
                  <div className="grid-cell" style={{ background: bg }}>
                    <span className={`status-pill ${status === 'Paid' ? 'status-active' : status === 'Billed' ? '' : 'status-canceled'}`}>{status}</span>
                  </div>
                  <div className="grid-cell grid-actions" style={{ background: bg }}>
                    {d.status === 'planned'
                      ? (<><button className="auth-button" style={{ width: 'auto', padding: '5px 12px', margin: 0 }} onClick={() => billDraw(selected, d)} disabled={busy || !(Number(d.amount) > 0)}>Bill</button>
                           <button className="logout-button" onClick={() => deleteDraw(d, selected.id)}>Delete</button></>)
                      : (inv ? <button className="logout-button" onClick={() => navigate(`/invoices`)}>View invoice</button> : <span style={{ color: 'var(--mist)', fontSize: 12 }}>—</span>)}
                  </div>
                </div>
              )
            })}
            {draws.length === 0 && <div className="grid-cell" style={{ gridColumn: '1 / -1', color: 'var(--mist)' }}>No draws scheduled. Add one below (or bill stages directly).</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 24 }}>
          <div className="field" style={{ minWidth: 200 }}><label>New draw</label><input type="text" value={newDrawLabel} onChange={(e) => setNewDrawLabel(e.target.value)} placeholder="e.g. Rough-In" /></div>
          <div className="field" style={{ minWidth: 90 }}><label>% of contract</label><input type="number" step="0.1" value={newDrawPct} onChange={(e) => setNewDrawPct(e.target.value)} placeholder="40" /></div>
          <div className="field" style={{ minWidth: 110 }}><label>or fixed $</label><input type="number" step="0.01" value={newDrawAmt} onChange={(e) => setNewDrawAmt(e.target.value)} placeholder="amount" /></div>
          <button className="auth-button" style={{ width: 'auto', padding: '8px 16px' }} onClick={() => addDraw(selected)} disabled={!newDrawLabel.trim()}>Add draw</button>
        </div>

        {/* Stages */}
        <h3 style={{ fontSize: 16, marginBottom: 10 }}>Stages ({stageJobs.length})</h3>
        <div style={{ overflowX: 'auto', marginBottom: 16 }}>
          <div className="grid-table" style={{ gridTemplateColumns: '1fr 1.4fr 1fr 1.2fr', minWidth: 560 }}>
            <div className="grid-cell grid-head">Job #</div>
            <div className="grid-cell grid-head">Type</div>
            <div className="grid-cell grid-head">Status</div>
            <div className="grid-cell grid-head"></div>
            {stageJobs.map((j, i) => (
              <div key={j.id} style={{ display: 'contents' }}>
                <div className="grid-cell" style={{ background: i % 2 ? 'var(--ink)' : 'var(--panel)' }}>{j.job_number}{j.segment > 1 ? `-${j.segment}` : ''}</div>
                <div className="grid-cell" style={{ background: i % 2 ? 'var(--ink)' : 'var(--panel)' }}>{j.job_type || '—'}</div>
                <div className="grid-cell" style={{ background: i % 2 ? 'var(--ink)' : 'var(--panel)' }}>{j.status}</div>
                <div className="grid-cell grid-actions" style={{ background: i % 2 ? 'var(--ink)' : 'var(--panel)' }}>
                  <button className="logout-button" onClick={() => navigate(`/invoice/${j.id}`)}>Open</button>
                  <button className="logout-button" onClick={() => detachJob(j.id)}>Detach</button>
                </div>
              </div>
            ))}
            {stageJobs.length === 0 && <div className="grid-cell" style={{ gridColumn: '1 / -1', color: 'var(--mist)' }}>No stages attached yet.</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 13, color: 'var(--mist)' }}>Attach an existing job:</label>
          <select value={attachId} onChange={(e) => setAttachId(e.target.value)} style={{ minWidth: 260 }}>
            <option value="">— pick a job —</option>
            {attachable.map((j) => <option key={j.id} value={j.id}>{j.job_number}{j.segment > 1 ? `-${j.segment}` : ''} · {j.job_type || 'Job'} · {j.status}</option>)}
          </select>
          <button className="auth-button" style={{ width: 'auto', padding: '8px 16px' }} onClick={attachJob} disabled={!attachId}>Attach</button>
        </div>

        {showAdd && (
          <QuickAddModal mode="job" orgId={selectedOrg} profile={profile} projectId={selected.id} prefillCustomerId={selected.customer_id || ''}
            onClose={() => setShowAdd(false)}
            onCreated={async () => { setShowAdd(false); await load(selectedOrg); loadAttachable(selected) }} />
        )}
      </div>
    )
  }

  // ---------- List ----------
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 className="page-title" style={{ margin: 0 }}>Projects</h2>
        <span className="badge">{projects.length} total</span>
        <button className="auth-button" style={{ width: 'auto', padding: '8px 16px', marginLeft: 'auto' }} onClick={() => setShowCreate((v) => !v)}>{showCreate ? 'Cancel' : '+ New project'}</button>
      </div>

      {isSuperAdmin && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      {showCreate && (
        <form onSubmit={createProject} style={{ background: 'var(--panel)', borderRadius: 10, padding: 16, marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div className="field" style={{ minWidth: 220 }}><label>Project name</label><input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. 123 Oak St — New Construction" /></div>
          <div className="field" style={{ minWidth: 220 }}><label>Customer</label><CustomerSearchSelect orgId={selectedOrg} value={newCustomer} onChange={(id) => setNewCustomer(id)} /></div>
          <div className="field" style={{ minWidth: 200 }}><label>Property</label>
            <select value={newProperty} onChange={(e) => setNewProperty(e.target.value)} disabled={!newCustomer}>
              <option value="">{newCustomer ? '— pick a property —' : 'pick a customer first'}</option>
              {newProps.map((p) => <option key={p.id} value={p.id}>{p.street_address}{p.unit ? ' #' + p.unit : ''}, {p.city || ''}</option>)}
            </select>
          </div>
          <div className="field" style={{ minWidth: 140 }}><label>Contract total</label><input type="number" step="0.01" value={newContract} onChange={(e) => setNewContract(e.target.value)} placeholder="optional" /></div>
          <button className="auth-button" type="submit" style={{ width: 'auto', padding: '8px 18px' }} disabled={saving || !selectedOrg}>{saving ? 'Creating…' : 'Create'}</button>
          {err && <span style={{ color: '#B00020', fontSize: 13 }}>{err}</span>}
        </form>
      )}

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : projects.length === 0 ? (
        <p style={{ color: 'var(--mist)' }}>No projects yet. Create one to group New Construction stages and bill by draw.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div className="grid-table" style={{ gridTemplateColumns: '0.8fr 1.6fr 1.4fr 0.7fr 1fr 1fr 1fr 1fr', minWidth: 980 }}>
            <div className="grid-cell grid-head">#</div>
            <div className="grid-cell grid-head">Project</div>
            <div className="grid-cell grid-head">Customer</div>
            <div className="grid-cell grid-head">Stages</div>
            <div className="grid-cell grid-head">Contract</div>
            <div className="grid-cell grid-head">Billed</div>
            <div className="grid-cell grid-head">Paid</div>
            <div className="grid-cell grid-head">Remaining</div>
            {projects.map((p, i) => {
              const r = rollups[p.id] || { billed: 0, paid: 0 }
              const stages = (jobsByProject[p.id] || []).length
              const remaining = p.contract_total != null ? Number(p.contract_total) - r.billed : null
              const bg = i % 2 ? 'var(--ink)' : 'var(--panel)'
              return (
                <div key={p.id} style={{ display: 'contents' }} onClick={() => openDetail(p)}>
                  <div className="grid-cell" style={{ background: bg }}>{p.project_number}</div>
                  <div className="grid-cell" style={{ background: bg, fontWeight: 600 }}>{p.name}</div>
                  <div className="grid-cell" style={{ background: bg }}>{p.customers?.display_name || '—'}</div>
                  <div className="grid-cell" style={{ background: bg }}>{stages}</div>
                  <div className="grid-cell" style={{ background: bg }}>{money(p.contract_total)}</div>
                  <div className="grid-cell" style={{ background: bg }}>{money(r.billed)}</div>
                  <div className="grid-cell" style={{ background: bg }}>{money(r.paid)}</div>
                  <div className="grid-cell" style={{ background: bg, color: remaining != null && remaining < 0 ? '#B00020' : undefined }}>{remaining == null ? '—' : money(remaining)}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
