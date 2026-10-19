import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'

// Settings → AI Agents. The company-wide switch, the daily limit on automatic AI drafts,
// quiet hours (no customer messages go out on their own), and each skill's autonomy:
//   Suggest            — flags the situation and says why; no draft, no AI cost.
//   Draft for approval — prepares the message; a person approves it in the Agent Inbox.
//   Do it and report   — sends it on its own and logs it. Customer messages wait out quiet hours.

const MODES = [
  ['suggest', 'Suggest', 'Flags it and says why — nothing is drafted or sent.'],
  ['draft', 'Draft for approval', 'Prepares the message; someone approves it in the Agent Inbox.'],
  ['auto', 'Do it and report', 'Sends it on its own and logs it in the Activity log.'],
]
const PARAMS = {
  reschedule_offer: [['windows', 'Visit windows to offer', 'number']],
  estimate_followup: [['first_days', 'First follow-up after (days)', 'number'], ['second_days', 'Second follow-up after (days)', 'number'], ['max_age_days', 'Ignore estimates older than (days)', 'number']],
  collections: [['steps', 'Reminders at (days after sending, comma-separated)', 'list'], ['max_age_days', 'Ignore invoices older than (days)', 'number']],
}
const inp = { padding: '6px 9px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14 }

export default function AgentSettings({ orgId }) {
  const [org, setOrg] = useState(null)
  const [skills, setSkills] = useState([])
  const [set, setSet] = useState({})
  const [used, setUsed] = useState(0)
  const [saved, setSaved] = useState('')

  async function load() {
    if (!orgId) return
    const [o, sk, st, u] = await Promise.all([
      supabase.from('organizations').select('id, agent_enabled, agent_daily_cap, agent_quiet_start, agent_quiet_end').eq('id', orgId).single(),
      supabase.from('agent_skills').select('*').order('sort'),
      supabase.from('org_agent_skill_settings').select('*').eq('org_id', orgId),
      supabase.from('agent_actions').select('id', { count: 'exact', head: true }).eq('org_id', orgId).neq('mode', 'suggest').gte('created_at', new Date(Date.now() - 86400000).toISOString()),
    ])
    setOrg(o.data); setSkills((sk.data || []).filter((x) => x.configurable !== false)); setUsed(u.count || 0)
    const m = {}
    for (const s of sk.data || []) {
      const row = (st.data || []).find((x) => x.skill_key === s.key)
      m[s.key] = { enabled: row ? row.enabled : true, mode: row?.mode || s.default_mode, params: { ...(s.default_params || {}), ...(row?.params || {}) } }
    }
    setSet(m)
  }
  useEffect(() => { load() }, [orgId])

  function flash(t = 'Saved') { setSaved(t); setTimeout(() => setSaved(''), 1800) }
  async function saveOrg(patch) {
    setOrg((o) => ({ ...o, ...patch }))
    const { error } = await supabase.from('organizations').update(patch).eq('id', orgId)
    flash(error ? 'Could not save: ' + error.message : 'Saved')
  }
  async function saveSkill(key, patch) {
    const next = { ...set[key], ...patch }
    setSet((s) => ({ ...s, [key]: next }))
    const { error } = await supabase.from('org_agent_skill_settings').upsert({ org_id: orgId, skill_key: key, enabled: next.enabled, mode: next.mode, params: next.params, updated_at: new Date().toISOString() })
    flash(error ? 'Could not save: ' + error.message : 'Saved')
  }

  if (!org) return <p style={{ color: 'var(--mist)' }}>Loading…</p>
  const t5 = (t) => (t || '').slice(0, 5)

  return (
    <div>
      <p style={{ fontSize: 13.5, color: 'var(--mist)', marginTop: -4 }}>
        Agents act without being asked when a situation calls for it. Drafts land in each person's <Link to="/agent-inbox">Agent Inbox</Link> by role — dispatch items go to people with dispatch permissions, money items to people with financial access, and so on. {saved && <b style={{ color: saved.startsWith('Could') ? '#B42318' : '#15803D' }}>{saved}</b>}
      </p>

      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 18 }}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!org.agent_enabled} onChange={(e) => saveOrg({ agent_enabled: e.target.checked })} />
          AI agents on for this company
        </label>
        <label style={{ fontSize: 13 }}>Daily limit on automatic AI drafts<br />
          <input type="number" min={0} max={2000} value={org.agent_daily_cap ?? 100} onChange={(e) => setOrg({ ...org, agent_daily_cap: e.target.value })} onBlur={(e) => saveOrg({ agent_daily_cap: Math.max(0, Number(e.target.value) || 0) })} style={{ ...inp, width: 100 }} />
          <span style={{ color: 'var(--mist)', marginLeft: 8 }}>{used} used in the last 24 hours</span>
        </label>
        <label style={{ fontSize: 13 }}>Quiet hours (no automatic customer messages)<br />
          <input type="time" value={t5(org.agent_quiet_start)} onChange={(e) => saveOrg({ agent_quiet_start: e.target.value })} style={inp} />
          <span style={{ margin: '0 6px' }}>to</span>
          <input type="time" value={t5(org.agent_quiet_end)} onChange={(e) => saveOrg({ agent_quiet_end: e.target.value })} style={inp} />
        </label>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {skills.map((s) => {
          const v = set[s.key] || {}
          return (
            <div key={s.key} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, opacity: v.enabled ? 1 : 0.6, background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer', flex: '1 1 340px' }}>
                  <input type="checkbox" checked={!!v.enabled} onChange={(e) => saveSkill(s.key, { enabled: e.target.checked })} style={{ marginTop: 4 }} />
                  <span>
                    <b>{s.name}</b> <span style={{ fontSize: 11.5, color: '#1F3A5F', background: '#E8EEF6', borderRadius: 999, padding: '1px 7px', marginLeft: 4 }}>{s.area}</span>
                    <span style={{ display: 'block', fontSize: 13, color: 'var(--mist)' }}>{s.description}</span>
                  </span>
                </label>
                <div style={{ flex: '0 0 auto' }}>
                  <select value={v.mode} disabled={!v.enabled} onChange={(e) => saveSkill(s.key, { mode: e.target.value })} style={inp}>
                    {MODES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                  <div style={{ fontSize: 12, color: 'var(--mist)', maxWidth: 260, marginTop: 4 }}>{MODES.find((m) => m[0] === v.mode)?.[2]}</div>
                  {v.mode === 'auto' && s.customer_facing && <div style={{ fontSize: 12, color: '#B45309', maxWidth: 260, marginTop: 4 }}>⚠ This sends messages to customers without review. Recommended: Draft for approval until you trust its drafts.</div>}
                </div>
              </div>
              {PARAMS[s.key] && v.enabled && (
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10, paddingLeft: 26 }}>
                  {PARAMS[s.key].map(([k, label, type]) => (
                    <label key={k} style={{ fontSize: 12.5, color: '#475569' }}>{label}<br />
                      <input defaultValue={type === 'list' ? (v.params?.[k] || []).join(', ') : v.params?.[k] ?? ''} type={type === 'number' ? 'number' : 'text'} style={{ ...inp, width: type === 'list' ? 160 : 90 }}
                        onBlur={(e) => {
                          const val = type === 'list' ? e.target.value.split(',').map((x) => Number(x.trim())).filter((n) => n > 0) : Math.max(1, Number(e.target.value) || 1)
                          saveSkill(s.key, { params: { ...v.params, [k]: val } })
                        }} />
                    </label>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--mist)', marginTop: 12 }}>
        The agents check every 15 minutes. Each automatic draft is one AI request and counts toward the daily limit; "Suggest" items cost nothing. Drafts that stop being needed (the estimate was approved, the invoice was paid, someone already replied) clear themselves.
      </p>
    </div>
  )
}
