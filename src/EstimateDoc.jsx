// /estimate-doc/:estimateId (and /tech/estimate-doc/:estimateId) — opens any estimate by its
// own id, so an estimate written before a job exists has somewhere to live. Job estimates,
// follow-ups and system estimates are passed on to their usual pages.
import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { supabase } from './utils/supabase'
import { estimatePath } from './estimateContext'
import DuctCleaningEditor from './DuctCleaningEditor'
import Estimate from './Estimate'
import TechEstimate from './TechEstimate'

export default function EstimateDoc({ profile, mobile }) {
  const { estimateId } = useParams()
  const [est, setEst] = useState(undefined)
  useEffect(() => {
    supabase.from('invoices').select('id, kind, estimate_type, service_line, job_id, reference_job_id').eq('id', estimateId).maybeSingle().then(({ data }) => setEst(data || null))
  }, [estimateId])
  if (est === undefined) return <div className="page"><p style={{ color: 'var(--mist)' }}>Loading…</p></div>
  if (!est || est.kind !== 'estimate') return <div className="page"><p style={{ color: 'var(--mist)' }}>Estimate not found.</p></div>
  const path = estimatePath(est, mobile)
  if (!path.includes('/estimate-doc/')) return <Navigate to={path} replace />
  if (est.service_line === 'duct_cleaning') return <DuctCleaningEditor estimateId={est.id} kind="estimate" mobile={mobile} profile={profile} />
  return mobile ? <TechEstimate profile={profile} estimateId={est.id} /> : <Estimate profile={profile} estimateId={est.id} />
}
