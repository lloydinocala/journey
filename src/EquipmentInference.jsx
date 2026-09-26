// "Infer equipment from history" for a property.
// Reads the property's past jobs and asks AI to extract the HVAC systems that
// appear IN that history (type, any brand/model/age mentioned) WITH the evidence
// (which job/date/phrase). Honesty-forward: it only surfaces what the notes
// actually say, and a person confirms and adds each system via the normal form —
// nothing is written automatically.
import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import AiAssist from './AiAssist'

const SYS = `You extract the HVAC equipment/systems that appear in a property's service history for an HVAC contractor.
Rules:
- Use ONLY the job notes provided. Do not invent brands, models, ages, or systems that are not supported by the text.
- List each distinct system you can infer. For each: the type (e.g., split AC, heat pump, gas furnace, air handler, mini-split, package unit), any brand/model/tonnage/age actually mentioned, and the evidence — quote or paraphrase the job note + its date that supports it.
- If the history does not clearly indicate a system, say so plainly rather than guessing.
- End with a one-line reminder that these are inferred from notes and should be confirmed before adding.`

export default function EquipmentInference({ propertyId, orgId }) {
  const [jobs, setJobs] = useState(null)
  const [existing, setExisting] = useState([])

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [{ data: j }, { data: e }] = await Promise.all([
        supabase.from('jobs')
          .select('job_number, job_date, job_type, service_complaint, job_notes')
          .eq('property_id', propertyId).is('deleted_at', null)
          .order('job_date', { ascending: false }).limit(40),
        supabase.from('property_equipment')
          .select('system_label, outdoor_brand, outdoor_model').eq('property_id', propertyId).neq('status', 'retired'),
      ])
      if (!alive) return
      setJobs(j || [])
      setExisting(e || [])
    })()
    return () => { alive = false }
  }, [propertyId])

  const jobContext = (jobs || [])
    .map((j) => ({ date: j.job_date, type: j.job_type, complaint: j.service_complaint, notes: j.job_notes }))
    .filter((j) => j.complaint || j.notes || j.type)

  const ready = jobs != null
  const nothing = ready && jobContext.length === 0

  return (
    <div style={{ marginBottom: 12 }}>
      {!ready ? (
        <span style={{ fontSize: 12, color: 'var(--mist)' }}>Loading history…</span>
      ) : nothing ? (
        <span style={{ fontSize: 12, color: 'var(--mist)' }}>No job notes yet to infer equipment from.</span>
      ) : (
        <AiAssist inline title="Equipment inferred from job history" label="✨ AI: infer equipment from history"
          system={SYS}
          prompt="From this property's job history, list the HVAC systems that appear in the notes, each with the evidence. Do not invent anything not in the notes."
          context={{
            already_on_file: existing.map((e) => e.system_label || [e.outdoor_brand, e.outdoor_model].filter(Boolean).join(' ')).filter(Boolean),
            job_history: jobContext,
          }} />
      )}
    </div>
  )
}
