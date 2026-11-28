// Settings → AI Agents → Texting receptionist.
// Lets a subscriber turn on the receptionist for text messages: it answers texts to the company's own
// texting number with the same instructions and booking tools as its phone receptionist (sms-agent).
// Subscribers only — Journey (Platform) never gets this switch.
import { useEffect, useState } from 'react'
import { supabase } from './utils/supabase'

const JOURNEY_ORG = '5bb0e0a2-9a0a-4f45-96b9-69e7fe31ba8b'

export default function TextAssistantSettings({ orgId }) {
  const [row, setRow] = useState(null)
  const [org, setOrg] = useState(null)
  const [agent, setAgent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  useEffect(() => { if (orgId && orgId !== JOURNEY_ORG) load() }, [orgId])

  async function load() {
    setLoading(true); setMsg('')
    const [{ data: s }, { data: o }, { data: va }] = await Promise.all([
      supabase.from('sms_ai_settings').select('org_id, enabled, mode, line_number').eq('org_id', orgId).maybeSingle(),
      supabase.from('organizations').select('id, sms_from_number, sms_number_status').eq('id', orgId).single(),
      supabase.from('voice_agents').select('agent_id, mode').eq('org_id', orgId).eq('is_active', true).limit(1).maybeSingle(),
    ])
    setRow(s || { org_id: orgId, enabled: false, mode: 'after_hours', line_number: null })
    setOrg(o || null); setAgent(va || null); setLoading(false)
  }

  async function save(patch) {
    const next = { ...row, ...patch }
    setRow(next)
    const { error } = await supabase.from('sms_ai_settings').upsert({ org_id: orgId, enabled: !!next.enabled, mode: next.mode || 'after_hours' }, { onConflict: 'org_id' })
    setMsg(error ? error.message : 'Saved.')
    if (error) load()
  }

  if (!orgId || orgId === JOURNEY_ORG) return null
  if (loading) return null

  const hasNumber = !!org?.sms_from_number
  const hasAgent = !!agent && agent.mode !== 'sales_demo'
  const ready = hasNumber && hasAgent
  const box = { border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', margin: '0 0 18px', background: '#fff' }

  return (
    <div style={box}>
      <h3 style={{ fontSize: 16, margin: '0 0 4px' }}>Texting receptionist</h3>
      <p style={{ fontSize: 13, color: 'var(--mist)', margin: '0 0 10px', maxWidth: 680 }}>
        Answers texts to your company number and books visits, using the same instructions and calendar rules as your phone receptionist.
        It says it is a virtual assistant, steps back the moment anyone on your team texts that person, and never answers STOP or HELP messages.
        Everything it sends shows in the Text Archive.
      </p>
      {!ready && (
        <div style={{ fontSize: 13, background: '#FFF8E6', border: '1px solid #F0DFA8', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
          Needs {!hasAgent ? 'the AI Receptionist add-on' : ''}{!hasAgent && !hasNumber ? ' and ' : ''}{!hasNumber ? 'your own texting number (Settings → Company → Texting)' : ''} before it can be turned on.
        </div>
      )}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, marginBottom: 10 }}>
        <input type="checkbox" checked={!!row?.enabled} disabled={!ready && !row?.enabled} onChange={(e) => save({ enabled: e.target.checked })} />
        Answer texts with the receptionist
      </label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, opacity: row?.enabled ? 1 : 0.55 }}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="radio" name="sms-ai-mode" checked={row?.mode !== 'always'} disabled={!row?.enabled} onChange={() => save({ mode: 'after_hours' })} />
          Only when the office is closed (after hours, weekends, holidays)
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="radio" name="sms-ai-mode" checked={row?.mode === 'always'} disabled={!row?.enabled} onChange={() => save({ mode: 'always' })} />
          Any time a text comes in
        </label>
      </div>
      {msg && <div style={{ fontSize: 13, marginTop: 8, color: msg === 'Saved.' ? '#166534' : '#B00020' }}>{msg}</div>}
    </div>
  )
}
