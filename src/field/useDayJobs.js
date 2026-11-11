import { useEffect, useState } from 'react'
import { supabase } from '../utils/supabase'

// All of a company's jobs (and field tasks) for one day, with the assigned techs and their
// calendar colors. Canceled work is left out.
export default function useDayJobs(orgId, date) {
  const [state, setState] = useState({ loading: true, jobs: [], tasks: [], techs: {} })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!orgId || !date) return
    let live = true
    setState((s) => ({ ...s, loading: true }))
    ;(async () => {
      const dayStart = new Date(date + 'T00:00:00')
      const dayEnd = new Date(dayStart.getTime() + 86400000)
      const [{ data: jobs }, { data: tasks }, { data: users }] = await Promise.all([
        supabase.from('jobs').select('id, job_number, segment, status, job_date, start_time, duration_hours, arrival_at, job_type, service_complaint, customer_id, property_id, customers ( display_name, primary_phone ), properties ( street_address, unit, city )')
          .eq('org_id', orgId).eq('job_date', date).is('deleted_at', null).order('start_time', { ascending: true, nullsFirst: false }),
        supabase.from('field_tasks').select('id, destination_name, address, scheduled_at, status, assigned_user_id')
          .eq('org_id', orgId).is('deleted_at', null).gte('scheduled_at', dayStart.toISOString()).lt('scheduled_at', dayEnd.toISOString()),
        supabase.from('users').select('id, full_name, calendar_color').eq('org_id', orgId),
      ])
      const list = (jobs || []).filter((j) => j.status !== 'canceled' && j.status !== 'cancelled')
      const ids = list.map((j) => j.id)
      const { data: jt } = ids.length ? await supabase.from('job_technicians').select('job_id, user_id').in('job_id', ids) : { data: [] }
      const techs = Object.fromEntries((users || []).map((u) => [u.id, u]))
      const byJob = {}
      for (const r of jt || []) (byJob[r.job_id] = byJob[r.job_id] || []).push(r.user_id)
      if (!live) return
      setState({
        loading: false, techs,
        jobs: list.map((j) => ({ ...j, techIds: byJob[j.id] || [] })),
        tasks: (tasks || []).filter((t) => t.status !== 'canceled' && t.status !== 'cancelled'),
      })
    })()
    return () => { live = false }
  }, [orgId, date, tick])
  return { ...state, reload: () => setTick((t) => t + 1) }
}

export const techNames = (ids, techs) => ids.map((id) => techs[id]?.full_name).filter(Boolean).join(', ')
