import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

const money = (v) => (v == null ? '—' : '$' + Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

// Parse equipment out of the estimate's categorized line items (best-effort;
// the user confirms/edits the actual order in Step 1).
function parseEquip(items) {
  const get = (cat) => (items.find((l) => l.category === cat)?.description || '')
  const modelOf = (d) => (d.match(/Model #\s*([^\n]+)/i)?.[1] || '').trim()
  const ahriOf = (d) => (d.match(/AHRI#?\s*([^\n]+)/i)?.[1] || '').trim()
  const brandOf = (d) => { const ls = d.split('\n'); return ((ls[1] || '').trim().split(/\s+/)[0] || '') }
  const outdoor = get('OUTDOOR_UNIT'), indoor = get('INDOOR_UNIT'), furnace = get('FURNACE')
  return { brand: brandOf(outdoor), condenser: modelOf(outdoor), ahu: modelOf(indoor), furnace: modelOf(furnace), ahri: ahriOf(outdoor) || ahriOf(indoor) }
}

export default function Permits({ profile }) {
  const isSuper = profile.role === 'super_admin'
  const nav = useNavigate()
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [approved, setApproved] = useState([])     // approved estimates with no package yet
  const [inProgress, setInProgress] = useState([]) // packages in progress
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState('')

  useEffect(() => { if (isSuper) supabase.from('organizations').select('id, name').order('name').then(({ data }) => setOrgs(data || [])) }, [])
  useEffect(() => { if (selectedOrg) load() }, [selectedOrg])

  async function load() {
    setLoading(true)
    const [{ data: ests }, { data: pkgs }] = await Promise.all([
      supabase.from('invoices')
        .select('id, invoice_number, bills_to_customer_id, property_id, building_authority_id, job_total, approval_status, estimate_type, is_archived, deleted_at, spawned_job_id, converted_to_job_id')
        .eq('org_id', selectedOrg).eq('estimate_type', 'system').eq('approval_status', 'approved')
        .eq('is_archived', false).is('deleted_at', null),
      supabase.from('permit_packages').select('*').eq('org_id', selectedOrg).eq('status', 'in_progress'),
    ])
    const estimates = ests || []
    const packages = pkgs || []
    const packagedEstIds = new Set(packages.map((p) => p.estimate_id))

    // customer + property names
    const custIds = [...new Set(estimates.map((e) => e.bills_to_customer_id).filter(Boolean))]
    const propIds = [...new Set(estimates.map((e) => e.property_id).filter(Boolean))]
    const [{ data: custs }, { data: props }, { data: lines }] = await Promise.all([
      custIds.length ? supabase.from('customers').select('id, display_name, primary_phone').in('id', custIds) : Promise.resolve({ data: [] }),
      propIds.length ? supabase.from('properties').select('id, street_address, city').in('id', propIds) : Promise.resolve({ data: [] }),
      estimates.length ? supabase.from('invoice_line_items').select('invoice_id, category, description').in('invoice_id', estimates.map((e) => e.id)).in('category', ['OUTDOOR_UNIT', 'INDOOR_UNIT', 'FURNACE']) : Promise.resolve({ data: [] }),
    ])
    const custById = Object.fromEntries((custs || []).map((c) => [c.id, c]))
    const propById = Object.fromEntries((props || []).map((p) => [p.id, p]))
    const linesByEst = {}
    ;(lines || []).forEach((l) => { (linesByEst[l.invoice_id] = linesByEst[l.invoice_id] || []).push(l) })

    const start = estimates.filter((e) => !packagedEstIds.has(e.id)).map((e) => ({
      ...e,
      customer: custById[e.bills_to_customer_id] || null,
      property: propById[e.property_id] || null,
      equip: parseEquip(linesByEst[e.id] || []),
    }))
    setApproved(start)

    // in-progress: enrich with estimate #, customer
    const pkgEstIds = packages.map((p) => p.estimate_id).filter(Boolean)
    const pkgCustIds = packages.map((p) => p.customer_id).filter(Boolean)
    const [{ data: pEsts }, { data: pCusts }] = await Promise.all([
      pkgEstIds.length ? supabase.from('invoices').select('id, invoice_number').in('id', pkgEstIds) : Promise.resolve({ data: [] }),
      pkgCustIds.length ? supabase.from('customers').select('id, display_name').in('id', pkgCustIds) : Promise.resolve({ data: [] }),
    ])
    const pEstById = Object.fromEntries((pEsts || []).map((e) => [e.id, e]))
    const pCustById = Object.fromEntries((pCusts || []).map((c) => [c.id, c]))
    setInProgress(packages.map((p) => ({ ...p, estimate: pEstById[p.estimate_id] || null, customer: pCustById[p.customer_id] || null })))
    setLoading(false)
  }

  async function startPackage(est) {
    setStarting(est.id)
    const { data: pkg, error } = await supabase.from('permit_packages').insert({
      org_id: selectedOrg, estimate_id: est.id, property_id: est.property_id || null, customer_id: est.bills_to_customer_id || null,
      building_authority_id: est.building_authority_id || null, current_step: 1, status: 'in_progress',
    }).select().single()
    if (error) { setStarting(''); alert(error.message); return }
    const eq = est.equip || {}
    await supabase.from('permits').insert({
      org_id: selectedOrg, package_id: pkg.id, estimate_id: est.id, property_id: est.property_id || null,
      building_authority_id: est.building_authority_id || null, system_label: 'System 1', status: 'not_applied',
      req_brand: eq.brand || null, req_condenser_model: eq.condenser || null, req_ahu_model: eq.ahu || null,
      req_furnace_model: eq.furnace || null, req_ahri: eq.ahri || null,
    })
    nav(`/permits/${pkg.id}`)
  }

  const STEP_LABELS = ['', 'Order equipment', 'Create job', 'AHRI verify', 'Property lookup', 'Apply permit', 'Apply NOC', 'Receive permit', 'Print & send']

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div className="page-header-bar"><h2>Permits</h2></div>

      {isSuper && (
        <div style={{ marginBottom: 14, maxWidth: 340 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      {loading ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : (
        <>
          {/* In progress / resume */}
          {inProgress.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 15, marginBottom: 8 }}>In progress</h3>
              <div style={{ display: 'grid', gap: 8 }}>
                {inProgress.map((p) => (
                  <div key={p.id} className="section-card" style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <strong>{p.estimate?.invoice_number || 'Estimate'}</strong>
                      <span style={{ color: 'var(--mist)' }}> · {p.customer?.display_name || ''}</span>
                      <div style={{ fontSize: 12.5, color: 'var(--mist)' }}>On Step {p.current_step}: {STEP_LABELS[p.current_step] || ''}</div>
                    </div>
                    <button className="auth-button" style={{ width: 'auto' }} onClick={() => nav(`/permits/${p.id}`)}>Resume →</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Approved / not started */}
          <h3 style={{ fontSize: 15, marginBottom: 8 }}>New System Estimates — Approved / Not Scheduled</h3>
          {approved.length === 0 ? (
            <div className="section-card" style={{ padding: 18 }}><p style={{ margin: 0 }}>No approved estimates waiting to be processed.</p></div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead><tr><th>EST #</th><th>Customer</th><th>Brand</th><th>Condenser</th><th>AHU/Coil</th><th>Furnace</th><th>AHRI #</th><th>Sales Price</th><th></th></tr></thead>
                <tbody>
                  {approved.map((e) => (
                    <tr key={e.id}>
                      <td>{e.invoice_number}</td>
                      <td>{e.customer?.display_name || '—'}</td>
                      <td>{e.equip.brand || '—'}</td>
                      <td>{e.equip.condenser || '—'}</td>
                      <td>{e.equip.ahu || '—'}</td>
                      <td>{e.equip.furnace || '—'}</td>
                      <td>{e.equip.ahri || '—'}</td>
                      <td>{money(e.job_total)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}><button className="auth-button" style={{ width: 'auto', padding: '5px 12px' }} disabled={starting === e.id} onClick={() => startPackage(e)}>{starting === e.id ? '…' : 'Next Step →'}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
