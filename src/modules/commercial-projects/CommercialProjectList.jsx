import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import OrgPicker from '../../OrgPicker'
import CustomerSearchSelect from '../../CustomerSearchSelect'
import { money, pct, num, today, phaseLabel, SOV_TEMPLATE, useOrg, nextProjectNumber } from './data'

// Commercial Projects · Project List — every commercial project as a ledger row,
// plus the "New commercial project" form.
export default function CommercialProjectList({ profile }) {
  const navigate = useNavigate()
  const { isSuper, orgs, orgId, setOrgId } = useOrg(profile)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('active')
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async () => {
    if (!orgId) { setRows([]); setLoading(false); return }
    setLoading(true)
    const [{ data: projects }, { data: apps }] = await Promise.all([
      supabase.from('cp_projects').select('*, customers(display_name)').eq('org_id', orgId).order('created_at', { ascending: false }),
      supabase.from('cp_pay_apps').select('project_id, app_number, status, total_completed, retainage_amount, earned_less_retainage').eq('org_id', orgId).order('app_number'),
    ])
    const latest = {}, drafts = {}
    for (const a of apps || []) {
      if (a.status === 'submitted') latest[a.project_id] = a
      else drafts[a.project_id] = a.app_number
    }
    setRows((projects || []).map((p) => ({ ...p, latest: latest[p.id] || null, draftNo: drafts[p.id] || null })))
    setLoading(false)
  }, [orgId])
  useEffect(() => { load() }, [load])

  const shown = rows.filter((r) => statusFilter === 'all' || r.status === statusFilter)

  return (
    <div>
      <h2 className="page-title">Commercial Projects</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {isSuper && <OrgPicker orgs={orgs} value={orgId} onChange={setOrgId} />}
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8 }}>
          <option value="active">Active</option>
          <option value="on_hold">On hold</option>
          <option value="complete">Complete</option>
          <option value="cancelled">Cancelled</option>
          <option value="all">All</option>
        </select>
        <button className="auth-button" style={{ width: 'auto', padding: '8px 18px', marginLeft: 'auto' }} onClick={() => setShowCreate(true)} disabled={!orgId}>+ New commercial project</button>
      </div>

      {showCreate && <CreateProject profile={profile} orgId={orgId} onClose={() => setShowCreate(false)}
        onCreated={(id) => { setShowCreate(false); navigate(`/commercial/projects/${id}`) }} />}

      {loading ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : shown.length === 0 ? (
        <div style={{ background: 'var(--panel)', border: '1px dashed var(--line-strong)', borderRadius: 10, padding: 28, textAlign: 'center', color: 'var(--mist)' }}>
          No {statusFilter === 'all' ? '' : statusFilter.replace('_', ' ') + ' '}commercial projects yet. Start one with <strong>+ New commercial project</strong>.
        </div>
      ) : (
        <div className="tbl-scroll" style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: 1050 }}>
            <thead><tr>
              <th>Project #</th><th>Project</th><th>Customer / GC</th><th style={{ textAlign: 'right' }}>Contract</th>
              <th style={{ textAlign: 'right' }}>% complete</th><th style={{ textAlign: 'right' }}>Certified to date</th>
              <th style={{ textAlign: 'right' }}>Retainage held</th><th>Phase</th><th>Pay apps</th>
            </tr></thead>
            <tbody>
              {shown.map((r) => {
                const c = num(r.original_contract)
                const done = r.latest ? num(r.latest.total_completed) : 0
                return (
                  <tr key={r.id} onClick={() => navigate(`/commercial/projects/${r.id}`)} style={{ cursor: 'pointer' }}>
                    <td>{r.project_number}</td>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td>{r.customers?.display_name || '—'}{r.gc_name ? <div style={{ fontSize: 12, color: 'var(--mist)' }}>GC: {r.gc_name}</div> : null}</td>
                    <td style={{ textAlign: 'right' }}>{money(c)}</td>
                    <td style={{ textAlign: 'right' }}>{c ? pct(done / c) : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{money(r.latest ? r.latest.earned_less_retainage : 0)}</td>
                    <td style={{ textAlign: 'right' }}>{money(r.latest ? r.latest.retainage_amount : 0)}</td>
                    <td>{phaseLabel(r.phase)}</td>
                    <td>{r.latest ? `#${r.latest.app_number} submitted` : 'None yet'}{r.draftNo ? <span className="badge" style={{ marginLeft: 6 }}>#{r.draftNo} draft</span> : null}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function CreateProject({ profile, orgId, onClose, onCreated }) {
  const [f, setF] = useState({
    name: '', customer_id: '', property_id: '', owner_name: '', gc_name: '', architect_name: '', engineer_name: '',
    contract_number: '', contract_date: today(), original_contract: '', retainage_percent: '10', start_date: '', substantial_completion_date: '',
  })
  const [props, setProps] = useState([])
  const [useTemplate, setUseTemplate] = useState(true)
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  useEffect(() => {
    if (!f.customer_id) { setProps([]); return }
    supabase.from('properties').select('id, street_address, unit, city').eq('customer_id', f.customer_id).order('street_address')
      .then(({ data }) => setProps(data || []))
  }, [f.customer_id])

  async function save(e) {
    e.preventDefault()
    setErr('')
    if (!f.name.trim()) { setErr('Give the project a name.'); return }
    if (f.original_contract === '' || num(f.original_contract) <= 0) { setErr('Enter the original contract sum.'); return }
    setSaving(true)
    const project_number = await nextProjectNumber(orgId)
    const blank = (v) => (v === '' ? null : v)
    const { data, error } = await supabase.from('cp_projects').insert({
      org_id: orgId, project_number, name: f.name.trim(), customer_id: blank(f.customer_id), property_id: blank(f.property_id),
      owner_name: blank(f.owner_name.trim()), gc_name: blank(f.gc_name.trim()), architect_name: blank(f.architect_name.trim()),
      engineer_name: blank(f.engineer_name.trim()), contract_number: blank(f.contract_number.trim()), contract_date: blank(f.contract_date),
      original_contract: num(f.original_contract), retainage_percent: f.retainage_percent === '' ? 10 : num(f.retainage_percent),
      start_date: blank(f.start_date), substantial_completion_date: blank(f.substantial_completion_date), created_by: profile?.id || null,
    }).select('id').maybeSingle()
    if (error) { setSaving(false); setErr(error.message); return }
    if (useTemplate) {
      await supabase.from('cp_sov_lines').insert(SOV_TEMPLATE.map(([item_no, description], i) => ({
        org_id: orgId, project_id: data.id, item_no, description, scheduled_value: 0, sort_order: i + 1,
      })))
    }
    setSaving(false)
    onCreated(data.id)
  }

  const fld = (label, key, type = 'text', w = 200) => (
    <div className="field" style={{ minWidth: w, flex: `1 1 ${w}px` }}><label>{label}</label>
      <input type={type} step={type === 'number' ? '0.01' : undefined} value={f[key]} onChange={set(key)} /></div>
  )
  return (
    <form onSubmit={save} style={{ background: 'var(--panel)', border: '1px solid var(--line-strong)', borderRadius: 12, padding: 18, marginBottom: 20 }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 17 }}>New commercial project</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {fld('Project name', 'name', 'text', 280)}
        <div className="field" style={{ minWidth: 240, flex: '1 1 240px' }}><label>Customer (who pays)</label>
          <CustomerSearchSelect orgId={orgId} value={f.customer_id} onChange={(id) => setF({ ...f, customer_id: id, property_id: '' })} /></div>
        <div className="field" style={{ minWidth: 220, flex: '1 1 220px' }}><label>Job site</label>
          <select value={f.property_id} onChange={set('property_id')} disabled={!props.length}>
            <option value="">{f.customer_id ? (props.length ? 'Choose a property' : 'No properties on file') : 'Pick a customer first'}</option>
            {props.map((p) => <option key={p.id} value={p.id}>{p.street_address}{p.unit ? ' #' + p.unit : ''}, {p.city}</option>)}
          </select></div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 4 }}>
        {fld('Owner', 'owner_name')}{fld('General contractor', 'gc_name')}{fld('Architect', 'architect_name')}{fld('Engineer', 'engineer_name')}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 4 }}>
        {fld('Original contract sum ($)', 'original_contract', 'number', 170)}{fld('Retainage %', 'retainage_percent', 'number', 110)}
        {fld('Contract #', 'contract_number', 'text', 140)}{fld('Contract date', 'contract_date', 'date', 150)}
        {fld('Start date', 'start_date', 'date', 150)}{fld('Substantial completion', 'substantial_completion_date', 'date', 170)}
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0 12px', fontSize: 14 }}>
        <input type="checkbox" checked={useTemplate} onChange={(e) => setUseTemplate(e.target.checked)} />
        Start with the HVAC schedule-of-values lines (engineering, demo, rigging, equipment, duct, piping, controls, TAB, closeout)
      </label>
      {err && <div style={{ color: '#B00020', marginBottom: 10 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="auth-button" type="submit" style={{ width: 'auto', padding: '8px 18px' }} disabled={saving}>{saving ? 'Creating…' : 'Create project'}</button>
        <button className="logout-button" type="button" onClick={onClose}>Cancel</button>
      </div>
    </form>
  )
}
