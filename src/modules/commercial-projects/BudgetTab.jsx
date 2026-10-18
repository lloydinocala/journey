import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../utils/supabase'
import { money, pct, num, r2, fmtDate, today, tileStyle } from './data'
import { loadCostPicture, FADE_TOLERANCE } from './cost'

const COST_TYPES = [['labor', 'Labor'], ['material', 'Material'], ['equipment', 'Equipment'], ['subcontract', 'Subcontract'], ['other', 'Other']]

// Project workspace · Budget: estimated cost by cost code vs actual cost,
// earned value, forecast at completion, and over/under billing.
export default function BudgetTab({ project, profile, onProjectSaved }) {
  const [pic, setPic] = useState(null)
  const [sov, setSov] = useState([])
  const [rows, setRows] = useState([])
  const [dirty, setDirty] = useState(false)
  const [entries, setEntries] = useState([])
  const [entry, setEntry] = useState(null)
  const [settings, setSettings] = useState({ labor_rate: project.labor_rate ?? '', count_daily_log_labor: project.count_daily_log_labor !== false })
  const [margin, setMargin] = useState('20')
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const p = await loadCostPicture(project)
    const [{ data: s }, { data: e }] = await Promise.all([
      supabase.from('cp_sov_lines').select('id, item_no, description, scheduled_value').eq('project_id', project.id).order('sort_order'),
      supabase.from('cp_cost_entries').select('*').eq('project_id', project.id).order('entry_date', { ascending: false }),
    ])
    setPic(p); setSov(s || []); setEntries(e || []); setRows(p.lines.map((l) => ({ ...l.line }))); setDirty(false)
  }, [project])
  useEffect(() => { load() }, [load])

  async function saveSettings() {
    await supabase.from('cp_projects').update({ labor_rate: settings.labor_rate === '' ? null : num(settings.labor_rate), count_daily_log_labor: settings.count_daily_log_labor }).eq('id', project.id)
    setMsg('Labor settings saved.'); onProjectSaved && onProjectSaved()
  }
  async function seedFromSov() {
    const m = Math.min(Math.max(num(margin), 0), 90) / 100
    await supabase.from('cp_budget_lines').insert(sov.map((s, i) => ({
      org_id: project.org_id, project_id: project.id, sov_line_id: s.id, cost_code: s.item_no || null, description: s.description,
      other: r2(num(s.scheduled_value) * (1 - m)), sort_order: i + 1,
    })))
    load()
  }
  const upd = (i, k, v) => { const n = rows.slice(); n[i] = { ...n[i], [k]: v }; setRows(n); setDirty(true) }
  async function saveBudget() {
    for (const [i, r] of rows.entries()) {
      const row = { cost_code: r.cost_code || null, description: (r.description || '').trim() || 'Cost item', sov_line_id: r.sov_line_id || null,
        labor_hours: num(r.labor_hours), labor_cost: r2(r.labor_cost), material: r2(r.material), equipment: r2(r.equipment), subcontract: r2(r.subcontract), other: r2(r.other),
        etc_override: r.etc_override === '' || r.etc_override == null ? null : r2(r.etc_override), sort_order: i + 1 }
      if (r._new) await supabase.from('cp_budget_lines').insert({ ...row, org_id: project.org_id, project_id: project.id })
      else await supabase.from('cp_budget_lines').update(row).eq('id', r.id)
    }
    setMsg('Budget saved.'); load()
  }
  async function removeRow(i) {
    const r = rows[i]
    if (r._new) { setRows(rows.filter((_, j) => j !== i)); return }
    if (!window.confirm(`Remove budget line "${r.description}"? Costs charged to it become unallocated.`)) return
    await supabase.from('cp_budget_lines').delete().eq('id', r.id); load()
  }
  async function saveEntry() {
    if (!entry.description?.trim() || entry.amount === '' || entry.amount == null) { setMsg('Enter a description and an amount.'); return }
    const row = { entry_date: entry.entry_date || today(), cost_type: entry.cost_type, budget_line_id: entry.budget_line_id || null, description: entry.description.trim(),
      hours: entry.hours === '' || entry.hours == null ? null : num(entry.hours), amount: r2(entry.amount), vendor_name: entry.vendor_name || null, reference: entry.reference || null }
    const { error } = entry.id ? await supabase.from('cp_cost_entries').update(row).eq('id', entry.id)
      : await supabase.from('cp_cost_entries').insert({ ...row, org_id: project.org_id, project_id: project.id, created_by: profile?.id || null })
    if (error) { setMsg(error.message); return }
    setEntry(null); setMsg(''); load()
  }
  async function deleteEntry() {
    if (!entry?.id || !window.confirm('Delete this cost entry?')) return
    await supabase.from('cp_cost_entries').delete().eq('id', entry.id); setEntry(null); load()
  }

  if (!pic) return <p style={{ color: 'var(--mist)' }}>Loading…</p>
  const tile = (label, val, note, color) => (
    <div style={tileStyle}><div style={{ fontSize: 12, color: 'var(--mist)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: color || 'inherit' }}>{val}</div>{note ? <div style={{ fontSize: 12, color: 'var(--mist)', marginTop: 2 }}>{note}</div> : null}</div>
  )
  const marginPct = pic.contract ? pic.projectedMargin / pic.contract : 0
  const budgetMarginPct = pic.contract ? pic.budgetMargin / pic.contract : 0
  const numIn = (i, k, w = 96) => <input type="number" step="0.01" value={rows[i][k] ?? ''} onChange={(e) => upd(i, k, e.target.value)} style={{ width: w, textAlign: 'right' }} />
  const cell = { textAlign: 'right', whiteSpace: 'nowrap' }
  const lineName = (id) => { const b = rows.find((r) => r.id === id); return b ? `${b.cost_code ? b.cost_code + ' ' : ''}${b.description}` : 'Unallocated' }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {tile('Contract sum to date', money(pic.contract))}
        {tile('Budgeted cost', money(pic.budgetTotal), pic.hasBudget ? `Planned margin ${money(pic.budgetMargin)} (${pct(budgetMarginPct)})` : 'No budget yet')}
        {tile('Actual cost to date', money(pic.actualTotal), pic.useLogs ? `Includes daily-log labor at ${money(pic.rate)}/hr` : 'Daily-log labor not counted')}
        {tile('Forecast cost at completion', money(pic.eacTotal), `Cost ${pct(pic.costPctProject)} complete`)}
        {tile('Projected margin', money(pic.projectedMargin), `${pct(marginPct)} of contract`, pic.projectedMargin < pic.budgetMargin - 0.005 ? '#B00020' : '#1F7A43')}
        {tile(pic.overUnder >= 0 ? 'Overbilled' : 'Underbilled', money(Math.abs(pic.overUnder)), `Billed ${money(pic.billedGross)} vs earned ${money(pic.earnedRevenue)}`, Math.abs(pic.overUnder) > pic.contract * FADE_TOLERANCE ? '#9a6a12' : undefined)}
      </div>
      <p style={{ fontSize: 13.5, color: 'var(--mist)', margin: '-10px 0 0' }}>
        <strong>How to read this:</strong> earned revenue is the contract times the share of forecast cost already spent. Billing ahead of that ("overbilled") is common on commercial work, but Journey shows it openly so it never hides a job that is losing money. Billing behind ("underbilled") means you have done work you have not billed.
      </p>

      <section>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', background: 'var(--panel)', border: '1px solid var(--line-strong)', borderRadius: 10, padding: 12 }}>
          <div style={{ fontWeight: 700, flex: '1 1 100%' }}>Labor from daily logs</div>
          <div className="field" style={{ minWidth: 200 }}><label>Blended labor cost per crew hour ($)</label>
            <input type="number" step="0.01" value={settings.labor_rate} onChange={(e) => setSettings({ ...settings, labor_rate: e.target.value })} placeholder="e.g. 48.50" /></div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}><input type="checkbox" checked={settings.count_daily_log_labor} onChange={(e) => setSettings({ ...settings, count_daily_log_labor: e.target.checked })} />Count crew hours from daily logs as labor cost</label>
          <button className="logout-button" onClick={saveSettings}>Save</button>
          <div style={{ fontSize: 13, color: 'var(--mist)', flex: '1 1 100%' }}>Use your loaded cost (wages plus taxes, insurance, and benefits), not the billing rate. Daily logs can be charged to a budget line; uncharged hours count as unallocated labor. {pic.unallocated.logHours ? `${pic.unallocated.logHours} unallocated crew hours so far.` : ''}</div>
        </div>
      </section>

      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          <h3 style={{ fontSize: 16, margin: 0 }}>Budget and performance</h3>
          {msg && <span style={{ fontWeight: 600, color: /saved/i.test(msg) ? '#1F7A43' : '#B00020' }}>{msg}</span>}
        </div>
        {rows.length === 0 ? (
          <div style={{ background: 'var(--panel)', border: '1px dashed var(--line-strong)', borderRadius: 10, padding: 18 }}>
            <p style={{ marginTop: 0 }}>No budget yet. Start from the schedule of values: one budget line per line of work, with an estimated cost at a target margin. Then split each into labor, material, equipment, and subcontract.</p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ fontSize: 14 }}>Target margin % <input type="number" value={margin} onChange={(e) => setMargin(e.target.value)} style={{ width: 70 }} /></label>
              <button className="auth-button" style={{ width: 'auto', padding: '7px 16px' }} onClick={seedFromSov} disabled={!sov.length}>Start budget from schedule of values</button>
              <button className="logout-button" onClick={() => { setRows([{ _new: true, description: '', labor_hours: 0, labor_cost: 0, material: 0, equipment: 0, subcontract: 0, other: 0 }]); setDirty(true) }}>Start blank</button>
            </div>
          </div>
        ) : (<>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ minWidth: 1250 }}>
              <thead><tr><th>Code</th><th>Description</th><th>Billed against (SOV)</th><th style={cell}>Labor hrs</th><th style={cell}>Labor $</th><th style={cell}>Material</th><th style={cell}>Equipment</th><th style={cell}>Subcontract</th><th style={cell}>Other</th><th style={cell}>Budget</th><th style={cell}>Est. to complete</th><th></th></tr></thead>
              <tbody>{rows.map((r, i) => (
                <tr key={r.id || 'n' + i}>
                  <td><input value={r.cost_code || ''} onChange={(e) => upd(i, 'cost_code', e.target.value)} style={{ width: 70 }} /></td>
                  <td><input value={r.description || ''} onChange={(e) => upd(i, 'description', e.target.value)} style={{ width: '100%', minWidth: 180 }} /></td>
                  <td><select value={r.sov_line_id || ''} onChange={(e) => upd(i, 'sov_line_id', e.target.value || null)} style={{ maxWidth: 200 }}>
                    <option value="">— none —</option>{sov.map((s) => <option key={s.id} value={s.id}>{s.item_no ? s.item_no + ' ' : ''}{s.description}</option>)}</select></td>
                  <td style={cell}>{numIn(i, 'labor_hours', 70)}</td><td style={cell}>{numIn(i, 'labor_cost')}</td><td style={cell}>{numIn(i, 'material')}</td>
                  <td style={cell}>{numIn(i, 'equipment')}</td><td style={cell}>{numIn(i, 'subcontract')}</td><td style={cell}>{numIn(i, 'other')}</td>
                  <td style={{ ...cell, fontWeight: 700 }}>{money(num(r.labor_cost) + num(r.material) + num(r.equipment) + num(r.subcontract) + num(r.other))}</td>
                  <td style={cell}><input type="number" step="0.01" placeholder="auto" title="Leave blank to forecast from progress; enter what you expect is still left to spend to override" value={r.etc_override ?? ''} onChange={(e) => upd(i, 'etc_override', e.target.value)} style={{ width: 96, textAlign: 'right' }} /></td>
                  <td><button className="logout-button" style={{ padding: '2px 8px', fontSize: 13 }} onClick={() => removeRow(i)}>✕</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 10, margin: '10px 0 18px' }}>
            <button className="logout-button" onClick={() => { setRows([...rows, { _new: true, description: '', labor_hours: 0, labor_cost: 0, material: 0, equipment: 0, subcontract: 0, other: 0, sort_order: rows.length + 1 }]); setDirty(true) }}>+ Add budget line</button>
            <button className="auth-button" style={{ width: 'auto', padding: '7px 16px' }} onClick={saveBudget} disabled={!dirty}>Save budget</button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ minWidth: 1150 }}>
              <thead><tr><th>Budget line</th><th style={cell}>Budget</th><th style={cell}>Actual cost</th><th style={cell}>% billed</th><th style={cell}>Earned value</th><th style={cell}>Cost variance</th><th style={cell}>Forecast at completion</th><th style={cell}>Over / under budget</th><th>Attention</th></tr></thead>
              <tbody>
                {pic.lines.map((l) => (
                  <tr key={l.line.id}>
                    <td>{l.line.cost_code ? l.line.cost_code + ' ' : ''}{l.line.description}</td>
                    <td style={cell}>{money(l.budget)}</td>
                    <td style={cell}>{money(l.actual)}{l.logHours ? <div style={{ fontSize: 11.5, color: 'var(--mist)' }}>incl. {l.logHours} log hrs</div> : null}</td>
                    <td style={cell} title={l.pctSource === 'line' ? 'From the linked schedule-of-values line on the latest submitted pay application' : 'No linked SOV line — uses the whole project\'s billed %'}>{pct(l.billedPct)}{l.pctSource === 'project' ? '*' : ''}</td>
                    <td style={cell}>{money(l.ev)}</td>
                    <td style={{ ...cell, color: l.cv < 0 ? '#B00020' : '#1F7A43' }}>{money(l.cv)}</td>
                    <td style={cell}>{money(l.eac)}{l.line.etc_override != null ? <div style={{ fontSize: 11.5, color: 'var(--mist)' }}>your estimate</div> : null}</td>
                    <td style={{ ...cell, color: l.vac < 0 ? '#B00020' : 'inherit' }}>{l.vac < 0 ? `${money(-l.vac)} over` : `${money(l.vac)} under`}</td>
                    <td style={{ color: l.fade ? '#B00020' : l.overbilled ? '#9a6a12' : 'inherit', fontWeight: l.fade || l.overbilled ? 600 : 400 }}>
                      {l.fade ? 'Spending ahead of progress' : l.overbilled ? `Billed ${pct(l.billedPct)}, cost ${pct(l.costPct)}` : ''}</td>
                  </tr>
                ))}
                {pic.unallocated.actual > 0 && (
                  <tr><td style={{ fontStyle: 'italic' }}>Unallocated costs</td><td style={cell}>—</td><td style={cell}>{money(pic.unallocated.actual)}</td><td colSpan={3}></td><td style={cell}>{money(pic.unallocated.actual)}</td><td colSpan={2} style={{ color: 'var(--mist)', fontSize: 13 }}>Charge these to a budget line for line-level tracking</td></tr>
                )}
                <tr style={{ fontWeight: 800 }}><td>Totals</td><td style={cell}>{money(pic.budgetTotal)}</td><td style={cell}>{money(pic.actualTotal)}</td><td></td><td style={cell}>{money(pic.evTotal)}</td>
                  <td style={{ ...cell, color: pic.evTotal - pic.actualTotal < 0 ? '#B00020' : '#1F7A43' }}>{money(pic.evTotal - pic.actualTotal)}</td><td style={cell}>{money(pic.eacTotal)}</td><td style={cell}>{money(pic.budgetTotal - pic.eacTotal)}</td><td></td></tr>
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--mist)' }}>Earned value = budget × % billed on the linked line. Cost variance below zero means more has been spent than the progress is worth. Forecast at completion assumes the budget holds; when a line is spending ahead of its progress, it projects that line at the current rate instead. Enter your own estimate to complete to override. {pic.cpi != null ? `Cost performance index: ${pic.cpi.toFixed(2)} (below 1.00 means over budget for the work done).` : ''} * = no linked SOV line, project-wide % used.</p>
        </>)}
      </section>

      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <h3 style={{ fontSize: 16, margin: 0 }}>Cost entries</h3>
          <span style={{ fontSize: 13, color: 'var(--mist)' }}>{entries.length} entries · {money(entries.reduce((a, e) => a + num(e.amount), 0))}</span>
          <button className="auth-button" style={{ width: 'auto', padding: '6px 14px', marginLeft: 'auto' }} onClick={() => setEntry({ entry_date: today(), cost_type: 'material', amount: '', description: '' })}>+ Cost entry</button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--mist)', margin: '0 0 10px' }}>Material and equipment invoices, subcontractor bills, rentals, permits, and any labor not captured in daily logs.</p>
        {entry && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', background: 'var(--panel)', border: '1px solid var(--line-strong)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
            <div className="field" style={{ minWidth: 150 }}><label>Date</label><input type="date" value={entry.entry_date || ''} onChange={(e) => setEntry({ ...entry, entry_date: e.target.value })} /></div>
            <div className="field" style={{ minWidth: 140 }}><label>Type</label><select value={entry.cost_type} onChange={(e) => setEntry({ ...entry, cost_type: e.target.value })}>{COST_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <div className="field" style={{ minWidth: 220 }}><label>Budget line</label><select value={entry.budget_line_id || ''} onChange={(e) => setEntry({ ...entry, budget_line_id: e.target.value || null })}>
              <option value="">Unallocated</option>{pic.lines.map((l) => <option key={l.line.id} value={l.line.id}>{l.line.cost_code ? l.line.cost_code + ' ' : ''}{l.line.description}</option>)}</select></div>
            <div className="field" style={{ minWidth: 240, flex: '1 1 240px' }}><label>Description</label><input value={entry.description || ''} onChange={(e) => setEntry({ ...entry, description: e.target.value })} /></div>
            <div className="field" style={{ minWidth: 120 }}><label>Amount ($)</label><input type="number" step="0.01" value={entry.amount ?? ''} onChange={(e) => setEntry({ ...entry, amount: e.target.value })} /></div>
            {entry.cost_type === 'labor' && <div className="field" style={{ minWidth: 90 }}><label>Hours</label><input type="number" step="0.25" value={entry.hours ?? ''} onChange={(e) => setEntry({ ...entry, hours: e.target.value })} /></div>}
            <div className="field" style={{ minWidth: 160 }}><label>Vendor / sub</label><input value={entry.vendor_name || ''} onChange={(e) => setEntry({ ...entry, vendor_name: e.target.value })} /></div>
            <div className="field" style={{ minWidth: 120 }}><label>Invoice / ref #</label><input value={entry.reference || ''} onChange={(e) => setEntry({ ...entry, reference: e.target.value })} /></div>
            <button className="auth-button" style={{ width: 'auto', padding: '7px 16px' }} onClick={saveEntry}>Save</button>
            <button className="logout-button" onClick={() => setEntry(null)}>Cancel</button>
            {entry.id && <button className="logout-button" onClick={deleteEntry}>Delete</button>}
          </div>
        )}
        {entries.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ minWidth: 820 }}>
              <thead><tr><th>Date</th><th>Type</th><th>Budget line</th><th>Description</th><th>Vendor</th><th>Ref</th><th style={cell}>Amount</th></tr></thead>
              <tbody>{entries.map((e) => (
                <tr key={e.id} onClick={() => setEntry({ ...e })} style={{ cursor: 'pointer' }}>
                  <td>{fmtDate(e.entry_date)}</td><td>{(COST_TYPES.find((c) => c[0] === e.cost_type) || [])[1]}</td><td>{lineName(e.budget_line_id)}</td>
                  <td>{e.description}</td><td>{e.vendor_name || '—'}</td><td>{e.reference || '—'}</td><td style={cell}>{money(e.amount)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
