// Context for an estimate that isn't tied to a job yet (written before any job exists).
// Returns an object shaped like the job record the estimate editors already read — customer,
// property, trip charge for pricing — with id / job_number left empty.
import { supabase } from './utils/supabase'

export async function loadEstimateContext(estimateId) {
  if (!estimateId) return null
  const { data: est } = await supabase.from('invoices')
    .select('id, org_id, property_id, bills_to_customer_id, trip_charge_price_id')
    .eq('id', estimateId).maybeSingle()
  if (!est) return null
  const [{ data: prop }, { data: tc }] = await Promise.all([
    est.property_id
      ? supabase.from('properties').select('id, street_address, customer_id, customers!properties_customer_id_fkey(display_name, primary_phone, email_1)').eq('id', est.property_id).maybeSingle()
      : Promise.resolve({ data: null }),
    est.trip_charge_price_id
      ? supabase.from('service_prices').select('location, access, hours, price, cost, task_hours, customer_display, services(id, name, is_tax_exempt)').eq('id', est.trip_charge_price_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  return {
    id: null, job_number: null, job_date: null, diagnosis_note: null, jobless: true,
    org_id: est.org_id, customer_id: est.bills_to_customer_id || prop?.customer_id || null, property_id: est.property_id,
    trip_charge_price_id: est.trip_charge_price_id, trip_charge: tc || null, properties: prop || null,
  }
}

// Where to open an estimate: job estimates on their job's page, follow-ups with their
// context job, system estimates in the system builder, everything else by its own id.
export function estimatePath(est, mobile) {
  const p = mobile ? '/tech' : ''
  if (!est) return p + '/estimates'
  if (est.estimate_type === 'system') return `${p}/system-estimate-p/${est.id}`
  if (est.job_id) return `${p}/estimate/${est.job_id}`
  if (est.reference_job_id) return `${p}/estimate/${est.reference_job_id}?followup=${est.id}`
  return `${p}/estimate-doc/${est.id}`
}
