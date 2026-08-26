import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'

// Mobile PM checklist runner. Opens one instance (one equipment unit) and lets the tech work
// it: pass/fail, number entry (with the last visit's value inline for trended items), notes.
export default function TechPMChecklist({ profile }) {
  const { instanceId } = useParams()
  const navigate = useNavigate()
  const [instance, setInstance] = useState(null)
  const [equip, setEquip] = useState(null)
  const [results, setResults] = useState([])
  const [priorByText, setPriorByText] = useState({})
  const [openNotes, setOpenNotes] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [instanceId])

  async function load() {
    setLoading(true)
    const { data: inst } = await supabase.from('pm_checklist_instances').select('*').eq('id', instanceId).maybeSingle()
    if (!inst) { setInstance(null); setLoading(false); return }
    setInstance(inst)

    if (inst.equipment_id) {
      const { data: eq } = await supabase.from('property_equipment')
        .select('system_label, outdoor_brand, outdoor_model, indoor_brand, indoor_model')
        .eq('id', inst.equipment_id).maybeSingle()
      setEquip(eq)
    }

    const { data: res } = await supabase.from('pm_checklist_results').select('*').eq('instance_id', instanceId).order('sort_order')
    setResults(res || [])

    // Last recorded value per trended check, from this unit's prior completed visits.
    if (inst.equipment_id) {
      const { data: prior } = await supabase
        .from('pm_checklist_results')
        .select('item_text, value_recorded, pm_checklist_instances!inner(id, equipment_id, status, completed_at)')
        .eq('trend', true)
        .not('value_recorded', 'is', null)
        .eq('pm_checklist_instances.equipment_id', inst.equipment_id)
        .eq('pm_checklist_instances.status', 'completed')
      const map = {}
      for (const r of prior || []) {
        const ci = r.pm_checklist_instances
        if (!ci || ci.id === instanceId) continue
        const prev = map[r.item_text]
        if (!prev || (ci.completed_at || '') > (prev.at || '')) map[r.item_text] = { value: r.value_recorded, at: ci.completed_at }
      }
      setPriorByText(map)
    }
    setLoading(false)
  }

  async function setResult(id, patch) {
    setResults((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    await supabase.from('pm_checklist_results').update(patch).eq('id', id)
  }

  async function complete() {
    setSaving(true)
    await supabase.from('pm_checklist_instances').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', instanceId)
    setSaving(false)
    navigate(-1)
  }

  if (loading) return <div style={{ padding: 20, color: 'var(--mist)' }}>Loading…</div>
  if (!instance) return <div style={{ padding: 20 }}>Checklist not found.</div>

  const equipLabel = equip
    ? (equip.system_label || [equip.outdoor_brand, equip.outdoor_model].filter(Boolean).join(' ') || 'System')
    : 'System'

  // group by section, preserving order
  const sections = []
  for (const r of results) {
    let s = sections.find((x) => x.name === (r.section || 'Other'))
    if (!s) { s = { name: r.section || 'Other', rows: [] }; sections.push(s) }
    s.rows.push(r)
  }
  const answered = results.filter((r) => r.result || (r.value_recorded && r.value_recorded !== '')).length
  const done = instance.status === 'completed'

  const numeric = { border: '1px solid #C9D0DA', borderRadius: 8, padding: '8px 10px', fontSize: 15, width: 130 }

  function control(r) {
    if (r.item_type === 'measure') {
      const prior = priorByText[r.item_text]
      return (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <input
              style={numeric}
              inputMode="decimal"
              value={r.value_recorded || ''}
              onChange={(e) => setResult(r.id, { value_recorded: e.target.value })}
              placeholder={r.record_units || 'value'}
            />
            {r.record_units && <span style={{ fontSize: 12, color: 'var(--mist)' }}>{r.record_units}</span>}
          </div>
          {prior && <div style={{ fontSize: 12, color: '#2E7FC4', marginTop: 3 }}>last visit: <strong>{prior.value}</strong>{prior.at ? ` (${new Date(prior.at).toLocaleDateString()})` : ''}</div>}
        </div>
      )
    }
    if (r.item_type === 'perform') {
      const on = r.result === 'done'
      return (
        <button onClick={() => setResult(r.id, { result: on ? null : 'done' })}
          style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid ' + (on ? '#16A34A' : '#C9D0DA'), background: on ? '#16A34A' : '#fff', color: on ? '#fff' : '#333', fontSize: 14, fontWeight: 600 }}>
          {on ? '✓ Done' : 'Mark done'}
        </button>
      )
    }
    // inspect / safety → pass / fail / n/a
    const opts = [['pass', 'Pass', '#16A34A'], ['fail', 'Fail', '#DC2626'], ['na', 'N/A', '#8A93A6']]
    return (
      <div style={{ display: 'flex', gap: 6 }}>
        {opts.map(([v, label, color]) => {
          const on = r.result === v
          return (
            <button key={v} onClick={() => setResult(r.id, { result: on ? null : v })}
              style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid ' + (on ? color : '#C9D0DA'), background: on ? color : '#fff', color: on ? '#fff' : '#333', fontSize: 14, fontWeight: 600 }}>
              {label}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ padding: '12px 14px 90px', maxWidth: 640, margin: '0 auto' }}>
      <button onClick={() => navigate(-1)} style={{ border: 'none', background: 'none', color: '#2E7FC4', fontSize: 14, padding: '4px 0', marginBottom: 4 }}>‹ Back</button>
      <h2 style={{ margin: '0 0 2px', fontSize: 19 }}>{instance.template_name}</h2>
      <div style={{ fontSize: 13, color: 'var(--mist)', marginBottom: 4 }}>{equipLabel}</div>
      <div style={{ fontSize: 12, color: 'var(--mist)', marginBottom: 14 }}>{answered} of {results.length} done{done ? ' · completed' : ''}</div>

      {sections.map((sec) => (
        <div key={sec.name} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1F3A5F', borderBottom: '2px solid #E8EEF5', paddingBottom: 4, marginBottom: 8 }}>{sec.name}</div>
          {sec.rows.map((r) => (
            <div key={r.id} style={{ padding: '10px 0', borderBottom: '1px solid #F1F4F8' }}>
              <div style={{ fontSize: 14.5, marginBottom: 8 }}>
                {r.priority === 'safety' && <span style={{ color: '#B01818', fontWeight: 700 }}>⚠ </span>}
                {r.item_text}
              </div>
              {control(r)}
              <div style={{ marginTop: 6 }}>
                {openNotes[r.id] || r.notes ? (
                  <textarea
                    value={r.notes || ''}
                    onChange={(e) => setResult(r.id, { notes: e.target.value })}
                    placeholder="Notes / defect detail"
                    style={{ width: '100%', minHeight: 44, border: '1px solid #C9D0DA', borderRadius: 8, padding: '7px 9px', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }}
                  />
                ) : (
                  <button onClick={() => setOpenNotes((o) => ({ ...o, [r.id]: true }))} style={{ border: 'none', background: 'none', color: '#8A93A6', fontSize: 12.5, padding: 0 }}>+ note</button>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#fff', borderTop: '1px solid #E2E6ED', padding: '10px 14px', display: 'flex', justifyContent: 'center' }}>
        {done ? (
          <div style={{ color: '#16A34A', fontWeight: 700, padding: '10px' }}>✓ Checklist completed</div>
        ) : (
          <button onClick={complete} disabled={saving} style={{ background: '#16A34A', color: '#fff', border: 'none', borderRadius: 10, padding: '13px 0', fontSize: 15, fontWeight: 700, width: '100%', maxWidth: 400 }}>
            {saving ? 'Saving…' : 'Complete Checklist'}
          </button>
        )}
      </div>
    </div>
  )
}
