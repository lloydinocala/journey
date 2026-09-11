import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

const money = (v) => (v == null ? '—' : '$' + Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const STEP_LABELS = ['', 'Order equipment', 'Create job', 'AHRI verify', 'Property lookup', 'Apply permit', 'Apply NOC', 'Receive permit', 'Print & send']

function parseEquip(items) {
  const get = (cat) => (items.find((l) => l.category === cat)?.description || '')
  const modelOf = (d) => (d.match(/Model #\s*([^\n]+)/i)?.[1] || '').trim()
  const ahriOf = (d) => (d.match(/AHRI#?\s*([^\n]+)/i)?.[1] || '').trim()
  const brandOf = (d) => { const ls = d.split('\n'); return ((ls[1] || '').trim().split(/\s+/)[0] || '') }
  const outdoor = get('OUTDOOR_UNIT'), indoor = get('INDOOR_UNIT'), furnace = get('FURNACE')
  return { brand: brandOf(outdoor), condenser: modelOf(outdoor), ahu: modelOf(indoor), furnace: modelOf(furnace), ahri: ahriOf(outdoor) || ahriOf(indoor) }
}

function Tile({ label, value, color }) {
  return (
    <div className="section-card" style={{ padding: '14px 16px', minWidth: 150, flex: 1 }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: color || 'var(--ink)' }}>{value}</div>
      <div style={{ fontSize: 12.5, color: 'var(--mist)' }}>{label}</div>
    </div>
  )
}

export default function Permits({ profile }) {
  const isSuper = profile.role === 'super_admin'
  const nav = useNavigate()
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [approved, setApproved] = useState([])
  const [inProgress, setInProgress] = useState([])
  const [awaitingInspection, setAwaitingInspection] = useState([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState('')

  useEffect(() => { if (isSuper) supabase.from('organizations').select('id, name').order('name').then(({ data }) => setOrgs(data || [])) }, [])
  useEffect(() => { if (selectedOrg) load() }, [selectedOrg])

  async function load() {
    setLoading(true)
    const [{ data: ests }, { data: pkgs }] = await Promise.all([
      supabase.from('invoices')
        .select('id, invoice_number, bills_to_customer_id, property_id, building_authority_id, job_total, spawned_job_id, converted_to_job_id')
        .eq('org_id', selectedOrg).eq('estimate_type', 'system').ilike('approval_status', 'approved').eq('is_archived', false).is('deleted_at', null),
      supabase.from('permit_packages').select('*').eq('org_id', selectedOrg).neq('status', 'cancelled'),
    ])
    const estimates = ests || []
    const packages = pkgs || []
    const packagedEstIds = new Set(packages.map((p) => p.estimate_id))

    // supporting lookups
    const custIds = [...new Set([...estimates.map((e) => e.bills_to_customer_id), ...packages.map((p) => p.customer_id)].filter(Boolean))]
    const propIds = [...new Set(estimates.map((e) => e.property_id).filter(Boolean))]
    const pkgEstIds = packages.map((p) => p.estimate_id).filter(Boolean)
    const [{ data: custs }, { data: props }, { data: lines }, { data: pkgEsts }, { data: prm }, { data: insps }] = await Promise.all([
      custIds.length ? supabase.from('customers').select('id, display_name').in('id', custIds) : Promise.resolve({ data: [] }),
      propIds.length ? supabase.from('properties').select('id, street_address, city').in('id', propIds) : Promise.resolve({ data: [] }),
      estimates.length ? supabase.from('invoice_line_items').select('invoice_id, category, description').in('invoice_id', estimates.map((e) => e.id)).in('category', ['OUTDOOR_UNIT', 'INDOOR_UNIT', 'FURNACE']) : Promise.resolve({ data: [] }),
      pkgEstIds.length ? supabase.from('invoices').select('id, invoice_number, spawned_job_id, converted_to_job_id').in('id', pkgEstIds) : Promise.resolve({ data: [] }),
      packages.length ? supabase.from('permits').select('id, package_id, finaled, permit_number').in('package_id', packages.map((p) => p.id)) : Promise.resolve({ data: [] }),
      packages.length ? supabase.from('permit_inspections').select('id, package_id, permit_id, result, created_at').in('package_id', packages.map((p) => p.id)) : Promise.resolve({ data: [] }),
    ])
    const custById = Object.fromEntries((custs || []).map((c) => [c.id, c]))
    const propById = Object.fromEntries((props || []).map((p) => [p.id, p]))
    const pkgEstById = Object.fromEntries((pkgEsts || []).map((e) => [e.id, e]))
    const linesByEst = {}; (lines || []).forEach((l) => { (linesByEst[l.invoice_id] = linesByEst[l.invoice_id] || []).push(l) })
    const permitsByPkg = {}; (prm || []).forEach((x) => { (permitsByPkg[x.package_id] = permitsByPkg[x.package_id] || []).push(x) })
    const inspByPkg = {}; (insps || []).forEach((x) => { (inspByPkg[x.package_id] = inspByPkg[x.package_id] || []).push(x) })

    // jobs for the packages (from package.job_id or estimate's spawned job)
    const jobIds = [...new Set(packages.map((p) => p.job_id || pkgEstById[p.estimate_id]?.spawned_job_id || pkgEstById[p.estimate_id]?.converted_to_job_id).filter(Boolean))]
    const { data: jobs } = jobIds.length ? await supabase.from('jobs').select('id, job_number, status').in('id', jobIds) : { data: [] }
    const jobById = Object.fromEntries((jobs || []).map((j) => [j.id, j]))
    // invoices for those jobs (for paid flag)
    const { data: jobInvs } = jobIds.length ? await supabase.from('invoices').select('id, invoice_number, job_id, paid_at, balance, kind').in('job_id', jobIds).eq('kind', 'invoice').is('deleted_at', null) : { data: [] }
    const invByJob = {}; (jobInvs || []).forEach((iv) => { if (!invByJob[iv.job_id]) invByJob[iv.job_id] = iv })

    // start list
    setApproved(estimates.filter((e) => !packagedEstIds.has(e.id)).map((e) => ({
      ...e, customer: custById[e.bills_to_customer_id] || null, equip: parseEquip(linesByEst[e.id] || []),
    })))

    // classify packages
    const prog = [], insp2 = []
    packages.forEach((p) => {
      if (p.status === 'complete') return
      const jobId = p.job_id || pkgEstById[p.estimate_id]?.spawned_job_id || pkgEstById[p.estimate_id]?.converted_to_job_id
      const jstatus = jobById[jobId]?.status
      const enriched = {
        ...p, jobId, job: jobById[jobId] || null, estimate: pkgEstById[p.estimate_id] || null,
        customer: custById[p.customer_id] || null, invoice: invByJob[jobId] || null,
        permits: permitsByPkg[p.id] || [], insp: inspByPkg[p.id] || [],
      }
      if (jstatus === 'completed' || p.install_completed_at) insp2.push(enriched)
      else prog.push(enriched)
    })
    // failed-inspection helper
    const failed = (e) => (e.permits || []).some((pm) => {
      const rows = (e.insp || []).filter((i) => i.permit_id === pm.id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      return rows.length > 0 && rows[rows.length - 1].result === 'fail'
    })
    insp2.forEach((e) => { e.failed = failed(e) })
    setInProgress(prog)
    setAwaitingInspection(insp2)
    setLoading(false)
    // opportunistic, throttled once/day: purge temp files of packages archived >30d ago
    try {
      const k = 'permit_sweep_' + selectedOrg
      const today = new Date().toISOString().slice(0, 10)
      if (localStorage.getItem(k) !== today) { localStorage.setItem(k, today); supabase.functions.invoke('permit-temp-sweep', { body: {} }).catch(() => {}) }
    } catch (_) {}
  }

  async function startPackage(est) {
    setStarting(est.id)
    let authId = est.building_authority_id || null
    if (!authId) {
      const { data: pr } = await supabase.from('permits').select('building_authority_id').eq('estimate_id', est.id).not('building_authority_id', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle()
      authId = pr?.building_authority_id || null
    }
    const { data: pkg, error } = await supabase.from('permit_packages').insert({
      org_id: selectedOrg, estimate_id: est.id, property_id: est.property_id || null, customer_id: est.bills_to_customer_id || null,
      building_authority_id: authId, current_step: 1, status: 'in_progress',
    }).select().single()
    if (error) { setStarting(''); alert(error.message); return }
    const eq = est.equip || {}
    await supabase.from('permits').insert({
      org_id: selectedOrg, package_id: pkg.id, estimate_id: est.id, property_id: est.property_id || null,
      building_authority_id: authId, system_label: 'System 1', status: 'not_applied',
      req_brand: eq.brand || null, req_condenser_model: eq.condenser || null, req_ahu_model: eq.ahu || null, req_furnace_model: eq.furnace || null, req_ahri: eq.ahri || null,
    })
    nav(`/permits/${pkg.id}`)
  }

  const failedCount = awaitingInspection.filter((e) => e.failed).length
  const awaitingNonFailed = Math.max(0, awaitingInspection.length - failedCount)
  const PBRAND = '#176E7A'
  const P_TILES = [
    { key: 'approved', name: 'Approved — start the permit', n: approved.length, tone: 'amber', line: `${approved.length} approved estimate${approved.length === 1 ? '' : 's'} not yet started`, cta: 'See estimates ↓', anchor: 'p-approved' },
    { key: 'inprogress', name: 'In progress', n: inProgress.length, tone: 'amber', line: `${inProgress.length} package${inProgress.length === 1 ? '' : 's'} mid-workflow`, cta: 'Resume ↓', anchor: 'p-inprogress' },
    { key: 'inspection', name: 'Awaiting inspection', n: awaitingNonFailed, tone: 'amber', line: `${awaitingNonFailed} install${awaitingNonFailed === 1 ? '' : 's'} ready to schedule`, cta: 'Schedule ↓', anchor: 'p-inspect' },
    { key: 'failed', name: 'Failed — reschedule', n: failedCount, tone: 'red', line: `${failedCount} inspection${failedCount === 1 ? '' : 's'} to re-book`, cta: 'Reschedule ↓', anchor: 'p-inspect' },
  ]
  const pNeeds = P_TILES.filter((t) => t.n > 0)
  const pHandled = P_TILES.filter((t) => t.n === 0)
  const pTotal = pNeeds.reduce((sm, t) => sm + t.n, 0)

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 0.3, color: PBRAND }}>Permitting Station</div>
          <h2 style={{ fontSize: 25, fontWeight: 800, letterSpacing: -0.5, margin: '4px 0 0' }}>Your permitting tasks</h2>
          <p style={{ margin: '7px 0 0', fontSize: 15, color: 'var(--mist)', maxWidth: 600 }}>
            {loading ? 'Checking what needs attention…' : pTotal > 0
              ? <>Permits moving through the pipeline — <b style={{ color: 'inherit' }}>{pTotal}</b> across {pNeeds.length} area{pNeeds.length === 1 ? '' : 's'} need a hand.</>
              : <>You're all caught up — no permits are waiting on you.</>}
          </p>
        </div>
        {isSuper && (
          <div>
            <div style={{ fontSize: 11.5, color: '#98A2AD', marginBottom: 4, textAlign: 'right' }}>Organization</div>
            <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
          </div>
        )}
      </div>

      {loading ? <p style={{ color: 'var(--mist)', marginTop: 20 }}>Loading…</p> : (
        <>
          <div style={{ marginTop: 24 }}>
            <div style={{ marginBottom: 12 }}><h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.2, margin: 0 }}>Needs a hand</h3><p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#98A2AD' }}>Permits with work waiting. Each tile jumps to the list below.</p></div>
            {pNeeds.length === 0 ? (
              <div style={{ background: '#EAF3EC', border: '1px solid #CADFCF', borderRadius: 12, padding: '20px', display: 'flex', gap: 13, alignItems: 'center' }}>
                <span style={{ width: 32, height: 32, borderRadius: 999, background: '#fff', border: '1px solid #CADFCF', color: '#2E7D52', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>✓</span>
                <div><div style={{ fontWeight: 700, fontSize: 15 }}>Nothing needs a hand right now.</div><div style={{ fontSize: 13.5, color: 'var(--mist)', marginTop: 2 }}>No permits are waiting to start, resume, or inspect.</div></div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(258px, 1fr))', gap: 14 }}>
                {pNeeds.map((t) => {
                  const a = t.tone === 'red' ? { fg: '#B5462F', bg: '#FBECE8', line: '#EAC5BC' } : { fg: '#9C6A12', bg: '#FAF2E0', line: '#EAD3A0' }
                  return (
                    <div key={t.key} onClick={() => document.getElementById(t.anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })} style={{ background: '#fff', border: '1px solid var(--border)', borderLeft: `3px solid ${a.fg}`, borderRadius: 12, padding: '15px 16px 13px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 124 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 15, fontWeight: 700 }}>{t.name}</span>
                        <span style={{ minWidth: 30, height: 30, padding: '0 9px', borderRadius: 999, background: a.bg, color: a.fg, border: `1px solid ${a.line}`, fontWeight: 800, fontSize: 15, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{t.n}</span>
                      </div>
                      <div style={{ fontSize: 14, color: 'var(--mist)', lineHeight: 1.4, flex: 1 }}>{t.line}</div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: PBRAND }}>{t.cta}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          {pHandled.length > 0 && (
            <div style={{ marginTop: 26 }}>
              <div style={{ marginBottom: 12 }}><h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.2, margin: 0 }}>Handled</h3><p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#98A2AD' }}>Watching, nothing pending.</p></div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
                {pHandled.map((t) => (
                  <span key={t.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--border)', borderRadius: 999, padding: '7px 13px', fontSize: 13.5 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 999, background: '#2E7D52' }} />{t.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div style={{ marginTop: 30, paddingTop: 6, borderTop: '1px dashed var(--border)' }} />

          {/* In progress / resume */}
          {inProgress.length > 0 && (
            <div id="p-inprogress" style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 15, marginBottom: 8 }}>In progress</h3>
              <div style={{ display: 'grid', gap: 8 }}>
                {inProgress.map((p) => (
                  <div key={p.id} className="section-card" style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <strong>{p.estimate?.invoice_number || 'Estimate'}</strong><span style={{ color: 'var(--mist)' }}> · {p.customer?.display_name || ''}</span>
                      <div style={{ fontSize: 12.5, color: 'var(--mist)' }}>Step {p.current_step}: {STEP_LABELS[p.current_step] || ''}</div>
                    </div>
                    <button className="auth-button" style={{ width: 'auto' }} onClick={() => nav(`/permits/${p.id}`)}>Resume →</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Approved / not started */}
          <h3 id="p-approved" style={{ fontSize: 15, marginBottom: 8, scrollMarginTop: 12 }}>New System Estimates — Approved / Not Scheduled</h3>
          {approved.length === 0 ? (
            <div className="section-card" style={{ padding: 18, marginBottom: 24 }}><p style={{ margin: 0 }}>No approved estimates waiting to be processed.</p></div>
          ) : (
            <div style={{ overflowX: 'auto', marginBottom: 24 }}>
              <table className="data-table">
                <thead><tr><th>EST #</th><th>Customer</th><th>Brand</th><th>Condenser</th><th>AHU/Coil</th><th>Furnace</th><th>AHRI #</th><th>Sales Price</th><th></th></tr></thead>
                <tbody>
                  {approved.map((e) => (
                    <tr key={e.id}>
                      <td>{e.invoice_number}</td><td>{e.customer?.display_name || '—'}</td><td>{e.equip.brand || '—'}</td>
                      <td>{e.equip.condenser || '—'}</td><td>{e.equip.ahu || '—'}</td><td>{e.equip.furnace || '—'}</td>
                      <td>{e.equip.ahri || '—'}</td><td>{money(e.job_total)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}><button className="auth-button" style={{ width: 'auto', padding: '5px 12px' }} disabled={starting === e.id} onClick={() => startPackage(e)}>{starting === e.id ? '…' : 'Next Step →'}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Installs completed / not inspected */}
          <h3 id="p-inspect" style={{ fontSize: 15, marginBottom: 8, scrollMarginTop: 12 }}>Installs Completed / Not Inspected</h3>
          {awaitingInspection.length === 0 ? (
            <div className="section-card" style={{ padding: 18 }}><p style={{ margin: 0 }}>No installed jobs awaiting inspection.</p></div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead><tr><th>Job #</th><th>Customer</th><th>Invoice</th><th>Invoice Status</th><th></th></tr></thead>
                <tbody>
                  {awaitingInspection.map((e) => {
                    const paid = e.invoice ? (e.invoice.paid_at != null || Number(e.invoice.balance || 0) <= 0.005) : null
                    return (
                      <tr key={e.id}>
                        <td>{e.job?.job_number || '—'} {e.failed && <span style={{ color: '#C0392B', fontWeight: 700 }}>· FAILED</span>}</td>
                        <td>{e.customer?.display_name || '—'}</td>
                        <td>{e.invoice?.invoice_number || '—'}</td>
                        <td>{paid == null ? '—' : paid
                          ? <span style={{ background: '#e6f4ea', color: '#1a7f37', fontWeight: 700, fontSize: 12, padding: '2px 10px', borderRadius: 20 }}>PAID</span>
                          : <span style={{ background: '#fde8e8', color: '#C0392B', fontWeight: 700, fontSize: 12, padding: '2px 10px', borderRadius: 20 }}>NOT PAID</span>}</td>
                        <td style={{ whiteSpace: 'nowrap' }}><button className="auth-button" style={{ width: 'auto', padding: '5px 12px' }} onClick={() => nav(`/permits/${e.id}`)}>Schedule inspection →</button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
