import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import CustomerSearchSelect from './CustomerSearchSelect'
import QuickAddModal from './QuickAddModal'

// Projects = the progress-billing overlay. A project groups the stage jobs
// (New Construction Rough-In / Trim / Start-Up, plus Punchlist) at one property
// under a contract total. Each stage stays a normal job with its own
// estimate/invoice, so billing a stage is just invoicing that job — a draw
// against the contract. This screen groups those jobs and rolls up
// Contract / Estimated / Billed / Paid / Remaining.
const money = (v) => (v == null ? '—' : '$' + Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

export default function Projects({ profile }) {
  const navigate = useNavigate()
  const isSuperAdmin = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')

  const [projects, setProjects] = useState([])
  const [jobsByProject, setJobsByProject] = useState({})   // project_id -> [jobs]
  const [rollups, setRollups] = useState({})               // project_id -> { estimated, billed, paid }
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

  // attach picker (detail view)
  const [attachable, setAttachable] = useState([])
  const [attachId, setAttachId] = useState('')
  const [showAdd, setShowAdd] = useState(false)

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
      .select('id, project_number, name, customer_id, property_id, contract_total, status, created_at, customers(display_name), properties(street_address, unit, city)')
      .eq('org_id', orgId).order('created_at', { ascending: false })
    const { data: pjobs } = await supabase.from('jobs')
      .select('id, project_id, job_number, segment, job_type, status')
      .eq('org_id', orgId).not('project_id', 'is', null).is('deleted_at', null)
      .order('job_number')
    const jobIds = (pjobs || []).map((j) => j.id)
    let invs = []
    if (jobIds.length) {
      const { data } = await supabase.from('invoices')
        .select('job_id, kind, job_total, total_paid')
        .in('job_id', jobIds).is('deleted_at', null).neq('is_archived', true)
      invs = data || []
    }
    const byProject = {}
    for (const j of (pjobs || [])) { (byProject[j.project_id] = byProject[j.project_id] || []).push(j) }
    const jobProject = Object.fromEntries((pjobs || []).map((j) => [j.id, j.project_id]))
    const roll = {}
    for (const p of (projs || [])) roll[p.id] = { estimated: 0, billed: 0, paid: 0 }
    for (const inv of invs) {
      const pid = jobProject[inv.job_id]
      if (!pid || !roll[pid]) continue
      if (inv.kind === 'estimate') roll[pid].estimated += Number(inv.job_total || 0)
      else { roll[pid].billed += Number(inv.job_total || 0); roll[pid].paid += Number(inv.total_paid || 0) }
    }
    setProjects(projs || [])
    setJobsByProject(byProject)
    setRollups(roll)
    setLoading(false)
  }, [])

  useEffect(() => { load(selectedOrg) }, [selectedOrg, load])

  // Load this customer's properties for the create form.
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
      org_id: selectedOrg,
      name: newName.trim(),
      customer_id: newCustomer || null,
      property_id: newProperty || null,
      contract_total: newContract === '' ? null : parseFloat(newContract),
      project_number: num,
      created_by: profile.id || null,
    }).select('id').maybeSingle()
    setSaving(false)
    if (error) { setErr(error.message); return }
    setShowCreate(false); setNewName(''); setNewCustomer(''); setNewProperty(''); setNewContract('')
    await load(selectedOrg)
    if (data?.id) setSelectedId(data.id)
  }

  async function loadAttachable(project) {
    // Unattached, non-deleted jobs for the same customer/property.
    let q = supabase.from('jobs').select('id, job_number, segment, job_type, status')
      .eq('org_id', selectedOrg).is('project_id', null).is('deleted_at', null)
    if (project.property_id) q = q.eq('property_id', project.property_id)
    else if (project.customer_id) q = q.eq('customer_id', project.customer_id)
    const { data } = await q.order('job_number').limit(100)
    setAttachable(data || [])
  }

  async function attachJob() {
    if (!attachId) return
    await supabase.from('jobs').update({ project_id: selectedId }).eq('id', attachId)
    setAttachId('')
    await load(selectedOrg)
    const proj = projects.find((p) => p.id === selectedId)
    if (proj) loadAttachable(proj)
  }

  async function detachJob(jobId) {
    await supabase.from('jobs').update({ project_id: null }).eq('id', jobId)
    await load(selectedOrg)
    const proj = projects.find((p) => p.id === selectedId)
    if (proj) loadAttachable(proj)
  }

  function openDetail(p) {
    setSelectedId(p.id)
    loadAttachable(p)
  }

  const selected = projects.find((p) => p.id === selectedId) || null

  // ---------- Detail view ----------
  if (selected) {
    const r = rollups[selected.id] || { estimated: 0, billed: 0, paid: 0 }
    const contract = selected.contract_total
    const remaining = contract != null ? Number(contract) - r.billed : null
    const stageJobs = jobsByProject[selected.id] || []
    const jobInv = {}  // built below from a fresh invoice read is overkill; show rollup only
    const tile = (label, val, color) => (
      <div style={{ background: 'var(--panel)', border: '1px solid var(--jc-line, rgba(0,0,0,0.08))', borderRadius: 10, padding: '14px 16px', minWidth: 130 }}>
        <div style={{ fontSize: 12, color: 'var(--mist)', marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: color || 'var(--ink-strong, inherit)' }}>{val}</div>
      </div>
    )
    return (
      <div>
        <button className="logout-button" onClick={() => { setSelectedId(null); setAttachable([]) }} style={{ marginBottom: 14 }}>← All projects</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
          <h2 className="page-title" style={{ margin: 0 }}>{selected.name}</h2>
          <span className="badge">{selected.project_number}</span>
          <span className={`status-pill ${selected.status === 'active' ? 'status-active' : 'status-canceled'}`}>{selected.status}</span>
          <button className="auth-button" style={{ width: 'auto', padding: '8px 16px', marginLeft: 'auto' }} onClick={() => setShowAdd(true)}>+ Add</button>
        </div>
        <div style={{ color: 'var(--mist)', fontSize: 13, marginBottom: 16 }}>
          {selected.customers?.display_name || '—'}
          {selected.properties?.street_address ? ` · ${selected.properties.street_address}${selected.properties.unit ? ' #' + selected.properties.unit : ''}, ${selected.properties.city || ''}` : ''}
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
          {tile('Contract', money(contract))}
          {tile('Estimated', money(r.estimated))}
          {tile('Billed', money(r.billed), '#1F7A43')}
          {tile('Paid', money(r.paid), '#1F7A43')}
          {tile('Remaining', remaining == null ? '—' : money(remaining), remaining != null && remaining < 0 ? '#B00020' : undefined)}
        </div>

        <h3 style={{ fontSize: 16, marginBottom: 10 }}>Stages ({stageJobs.length})</h3>
        <div style={{ overflowX: 'auto', marginBottom: 20 }}>
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
          <label style={{ fontSize: 13, color: 'var(--mist)' }}>Attach a job as a stage:</label>
          <select value={attachId} onChange={(e) => setAttachId(e.target.value)} style={{ minWidth: 260 }}>
            <option value="">— pick a job —</option>
            {attachable.map((j) => <option key={j.id} value={j.id}>{j.job_number}{j.segment > 1 ? `-${j.segment}` : ''} · {j.job_type || 'Job'} · {j.status}</option>)}
          </select>
          <button className="auth-button" style={{ width: 'auto', padding: '8px 16px' }} onClick={attachJob} disabled={!attachId}>Attach</button>
        </div>
        <p style={{ color: 'var(--mist)', fontSize: 12.5, marginTop: 10 }}>
          Stages are regular jobs. Create a Rough-In / Trim / Start-Up / Punchlist job the normal way, then attach it here;
          each stage is billed by invoicing that job (a draw against the contract).
        </p>
        {showAdd && (
          <QuickAddModal
            mode="job"
            orgId={selectedOrg}
            profile={profile}
            projectId={selected.id}
            prefillCustomerId={selected.customer_id || ''}
            onClose={() => setShowAdd(false)}
            onCreated={async () => { setShowAdd(false); await load(selectedOrg); loadAttachable(selected) }}
          />
        )}
      </div>
    )
  }

  // ---------- List view ----------
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 className="page-title" style={{ margin: 0 }}>Projects</h2>
        <span className="badge">{projects.length} total</span>
        <button className="auth-button" style={{ width: 'auto', padding: '8px 16px', marginLeft: 'auto' }} onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'Cancel' : '+ New project'}
        </button>
      </div>

      {isSuperAdmin && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      {showCreate && (
        <form onSubmit={createProject} style={{ background: 'var(--panel)', borderRadius: 10, padding: 16, marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div className="field" style={{ minWidth: 220 }}>
            <label>Project name</label>
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. 123 Oak St — New Construction" />
          </div>
          <div className="field" style={{ minWidth: 220 }}>
            <label>Customer</label>
            <CustomerSearchSelect orgId={selectedOrg} value={newCustomer} onChange={(id) => setNewCustomer(id)} />
          </div>
          <div className="field" style={{ minWidth: 200 }}>
            <label>Property</label>
            <select value={newProperty} onChange={(e) => setNewProperty(e.target.value)} disabled={!newCustomer}>
              <option value="">{newCustomer ? '— pick a property —' : 'pick a customer first'}</option>
              {newProps.map((p) => <option key={p.id} value={p.id}>{p.street_address}{p.unit ? ' #' + p.unit : ''}, {p.city || ''}</option>)}
            </select>
          </div>
          <div className="field" style={{ minWidth: 140 }}>
            <label>Contract total</label>
            <input type="number" step="0.01" value={newContract} onChange={(e) => setNewContract(e.target.value)} placeholder="optional" />
          </div>
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
                <div key={p.id} style={{ display: 'contents', cursor: 'pointer' }} onClick={() => openDetail(p)}>
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
