import { supabase } from './utils/supabase'

// The Permitting bucket counts — approved-to-start, in-progress, awaiting-inspection,
// and failed — using the exact classification the Permits page uses. Extracted so the
// signal registry (Train Station roll-up + the station tiles) reads one source.
export async function permitCounts(org) {
  const empty = { approved: 0, inProgress: 0, awaitingInspection: 0, failed: 0 }
  if (!org) return empty
  const [{ data: ests }, { data: pkgs }] = await Promise.all([
    supabase.from('invoices').select('id').eq('org_id', org).eq('estimate_type', 'system').ilike('approval_status', 'approved').eq('is_archived', false).is('deleted_at', null),
    supabase.from('permit_packages').select('id, estimate_id, job_id, status, install_completed_at').eq('org_id', org).neq('status', 'cancelled'),
  ])
  const estimates = ests || [], packages = pkgs || []
  const packagedEstIds = new Set(packages.map((p) => p.estimate_id))
  const approved = estimates.filter((e) => !packagedEstIds.has(e.id)).length

  const pkgEstIds = packages.map((p) => p.estimate_id).filter(Boolean)
  const [{ data: pkgEsts }, { data: prm }, { data: insps }] = await Promise.all([
    pkgEstIds.length ? supabase.from('invoices').select('id, spawned_job_id, converted_to_job_id').in('id', pkgEstIds) : Promise.resolve({ data: [] }),
    packages.length ? supabase.from('permits').select('id, package_id').in('package_id', packages.map((p) => p.id)) : Promise.resolve({ data: [] }),
    packages.length ? supabase.from('permit_inspections').select('package_id, permit_id, result, created_at').in('package_id', packages.map((p) => p.id)) : Promise.resolve({ data: [] }),
  ])
  const pkgEstById = Object.fromEntries((pkgEsts || []).map((e) => [e.id, e]))
  const permitsByPkg = {}; (prm || []).forEach((x) => { (permitsByPkg[x.package_id] = permitsByPkg[x.package_id] || []).push(x) })
  const inspByPkg = {}; (insps || []).forEach((x) => { (inspByPkg[x.package_id] = inspByPkg[x.package_id] || []).push(x) })
  const jobIds = [...new Set(packages.map((p) => p.job_id || pkgEstById[p.estimate_id]?.spawned_job_id || pkgEstById[p.estimate_id]?.converted_to_job_id).filter(Boolean))]
  const { data: jobs } = jobIds.length ? await supabase.from('jobs').select('id, status').in('id', jobIds) : { data: [] }
  const jobById = Object.fromEntries((jobs || []).map((j) => [j.id, j]))

  let inProgress = 0, awaitingInspection = 0, failed = 0
  packages.forEach((p) => {
    if (p.status === 'complete') return
    const jobId = p.job_id || pkgEstById[p.estimate_id]?.spawned_job_id || pkgEstById[p.estimate_id]?.converted_to_job_id
    const jstatus = jobById[jobId]?.status
    if (jstatus === 'completed' || p.install_completed_at) {
      awaitingInspection++
      const permits = permitsByPkg[p.id] || [], insp = inspByPkg[p.id] || []
      const isFailed = permits.some((pm) => {
        const rows = insp.filter((i) => i.permit_id === pm.id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        return rows.length > 0 && rows[rows.length - 1].result === 'fail'
      })
      if (isFailed) failed++
    } else {
      inProgress++
    }
  })
  return { approved, inProgress, awaitingInspection, failed }
}
