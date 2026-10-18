import { useState } from 'react'
import { supabase } from '../../utils/supabase'
import { pct, num, money, fmtDate } from './data'

const SYSTEM = `You help an HVAC project manager fill in a monthly pay application (continuation sheet).
From the field records for this billing period, propose the percent complete TO DATE for schedule-of-values lines that the records show progress on, and the stored-material balance where equipment was delivered but not yet set.
Rules:
- Only propose a line when a specific record supports it. Skip lines with no evidence.
- Never propose a percent lower than the line's current percent to date, and never above 100.
- Be conservative: when the records are vague, propose a small step or skip the line.
- The evidence must cite the actual records (dates, crew hours, equipment tags, inspections). Do not invent facts.
Output ONLY a JSON array, no prose, like:
[{"line": 3, "pct_to_date": 45, "stored_to_date": null, "evidence": "Oct 21 and Oct 24 logs: main supply duct hung on floors 2-3, 64 crew hours"}]
"line" is the line number given in the context. "stored_to_date" is a dollar amount or null.`

// Pay application · "Quincy: suggest this period". Drafts % complete per line
// from daily logs, deliveries, and inspections — each with its evidence. The PM
// accepts or ignores each suggestion; nothing is applied on its own.
export default function QuincyPayAppSuggest({ d, rows, periodTo, onAccept }) {
  const [state, setState] = useState('idle')  // idle | loading | done | error
  const [sugs, setSugs] = useState([])
  const [err, setErr] = useState('')
  const [accepted, setAccepted] = useState({})

  async function run() {
    setState('loading'); setErr(''); setAccepted({})
    const from = d.prevPeriodEnd || '1900-01-01'
    const pid = d.app.project_id
    const [{ data: logs }, { data: equip }, { data: insp }] = await Promise.all([
      supabase.from('cp_daily_logs').select('log_date, crew, crew_hours, work_performed, deliveries').eq('project_id', pid).gt('log_date', from).lte('log_date', periodTo).order('log_date'),
      supabase.from('cp_equipment').select('tag, description, status, delivered_date, set_date').eq('project_id', pid),
      supabase.from('cp_inspections').select('inspection_type, status, result_date').eq('project_id', pid).gt('result_date', from).lte('result_date', periodTo),
    ])
    const inWin = (x) => x && x > from && x <= periodTo
    const context = {
      billing_period: { after: d.prevPeriodEnd || 'project start', through: periodTo },
      lines: rows.map((r, i) => ({ line: i + 1, item: r.sov.item_no, description: r.sov.description, scheduled_value: r.C,
        pct_to_date_before_this_period: Math.round(((r.D + r.F) / (r.C || 1)) * 1000) / 10, stored_balance_now: r.F })),
      daily_logs: (logs || []).map((l) => ({ date: l.log_date, crew: l.crew, crew_hours: l.crew_hours, work: l.work_performed, deliveries: l.deliveries })),
      equipment_this_period: (equip || []).filter((e) => inWin(e.delivered_date) || inWin(e.set_date)).map((e) => ({ tag: e.tag, description: e.description, status: e.status, delivered: e.delivered_date, set: e.set_date })),
      equipment_delivered_not_set: (equip || []).filter((e) => e.status === 'delivered').map((e) => ({ tag: e.tag, description: e.description, delivered: e.delivered_date })),
      inspections_this_period: (insp || []).map((x) => ({ type: x.inspection_type, result: x.status, date: x.result_date })),
    }
    if (!context.daily_logs.length && !context.equipment_this_period.length && !context.inspections_this_period.length) {
      setState('error'); setErr(`No daily logs, deliveries, or inspections were recorded between ${d.prevPeriodEnd ? fmtDate(d.prevPeriodEnd) : 'the start'} and ${fmtDate(periodTo)}, so Quincy has nothing to go on. File daily logs to use this.`); return
    }
    const { data, error } = await supabase.functions.invoke('ai-assist', { body: { system: SYSTEM, prompt: 'Propose this period\'s percent complete per line from the records.', context, max_tokens: 1500 } })
    if (error || data?.error) { setState('error'); setErr(data?.error || error?.message || 'Quincy could not respond right now.'); return }
    try {
      const t = data.text || ''
      const arr = JSON.parse(t.slice(t.indexOf('['), t.lastIndexOf(']') + 1))
      const clean = arr.map((x) => {
        const row = rows[num(x.line) - 1]
        if (!row) return null
        const before = ((row.D + row.F) / (row.C || 1)) * 100
        const p = x.pct_to_date == null ? null : Math.min(100, Math.max(before, num(x.pct_to_date)))
        return { row, pct: p, stored: x.stored_to_date == null ? null : Math.max(0, num(x.stored_to_date)), evidence: String(x.evidence || '') }
      }).filter(Boolean)
      setSugs(clean); setState('done')
    } catch { setState('error'); setErr('Quincy answered in a form Journey could not read. Try again.') }
  }

  const accept = (s, i) => { onAccept(s.row, s.pct, s.stored); setAccepted((a) => ({ ...a, [i]: true })) }
  return (
    <div style={{ marginBottom: 12 }}>
      {state === 'idle' && <button className="logout-button" onClick={run}>✨ Quincy: suggest this period from field records</button>}
      {state === 'loading' && <span style={{ color: 'var(--mist)' }}>Quincy is reading this period's daily logs, deliveries, and inspections…</span>}
      {state === 'error' && <div style={{ color: '#9a6a12', fontSize: 14 }}>{err} <button className="logout-button" style={{ marginLeft: 8 }} onClick={run}>Try again</button></div>}
      {state === 'done' && (
        <div style={{ background: 'var(--panel)', border: '1px solid var(--line-strong)', borderRadius: 10, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <strong>Quincy's suggestions</strong><span style={{ fontSize: 12, color: 'var(--mist)' }}>AI draft from your field records · review each one</span>
            {sugs.length > 1 && <button className="logout-button" style={{ marginLeft: 'auto', fontSize: 13 }} onClick={() => sugs.forEach((s, i) => !accepted[i] && accept(s, i))}>Accept all</button>}
            <button className="logout-button" style={{ fontSize: 13, marginLeft: sugs.length > 1 ? 0 : 'auto' }} onClick={() => setState('idle')}>Close</button>
          </div>
          {sugs.length === 0 ? <p style={{ margin: 0, fontSize: 14 }}>The records don't clearly show progress on any line this period. Enter the amounts yourself.</p> : sugs.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '8px 0', borderTop: '1px solid var(--line-strong)', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 220px' }}><strong>{s.row.sov.item_no} {s.row.sov.description}</strong>
                <div style={{ fontSize: 13 }}>Now {pct((s.row.D + s.row.F) / (s.row.C || 1))} → suggested {s.pct != null ? s.pct.toFixed(1) + '%' : 'no change'}{s.stored != null ? ` · stored balance ${money(s.stored)}` : ''}</div></div>
              <div style={{ flex: '2 1 320px', fontSize: 13, color: 'var(--mist)' }}>{s.evidence}</div>
              {accepted[i] ? <span style={{ color: '#1F7A43', fontWeight: 600 }}>Applied</span> : <button className="logout-button" onClick={() => accept(s, i)}>Accept</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
