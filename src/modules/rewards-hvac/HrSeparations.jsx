// Rewards-HVAC · Separations — the offboarding / termination record.
// Deliberately constrained: the official, printable record shows only the
// separation type, dates, rehire eligibility, and generic BEHAVIOR reason
// codes. It intentionally offers NO competency reason (which would support an
// unemployment claim) and NO accusatory reason such as theft without an arrest
// (lawsuit exposure). The confidential note is internal only and never printed.
import { useState, useEffect } from 'react'
import { listEmployees, updateEmployee, listSeparations, addSeparation, SEPARATION_REASONS, separationReasonLabel } from './hrData'
import { useOrgSelector, OrgBar } from './shared'
import AiAssist from '../../AiAssist'
import { supabase } from '../../utils/supabase'
import { recordChange, listHistory, ReasonDialog, HistoryList, printHrDocument, orgName } from './hrRecords'

const TYPE_LABEL = { voluntary: 'Voluntary', involuntary: 'Involuntary', layoff: 'Layoff' }

// Drafts a PROCESS checklist for offboarding — property return, access removal,
// final pay, benefits notices. It deliberately never touches WHY the person left:
// no reason, no performance narrative, nothing that could feed an unemployment
// claim or a lawsuit. Same posture as this module's behavior-only record.
const OFFBOARDING_SYS = `You are an HR coordinator for an HVAC contractor drafting an OFFBOARDING CHECKLIST for a departing employee, given only their role and separation type (voluntary / involuntary / layoff). List the concrete steps to close out cleanly: recover company property (truck, keys/fobs, tools, phone/tablet, uniforms, fuel/purchase cards), revoke system and building access, disable logins, collect final timesheet, confirm final-pay timing per state rules, provide required benefits/COBRA and final-pay notices, and note documents to retain. Tailor property items to the role. STRICT RULES: do NOT state or infer the REASON for the separation, and never include performance commentary, accusations, or any characterization of the person — this is a process list only. Group as Immediate (last day) / Within a few days / Within 30 days. Keep it concise.`
const blank = {
  employee_id: '', separation_type: 'involuntary', effective_date: '', last_day_worked: '',
  rehire_eligible: 'yes', reason: '', confidential_note: '', mark_inactive: true,
}
const reasonOf = (r) => r.reason || (r.reasons || [])[0] || ''
const STATUS_TAG = { reinstated: ['Reinstated', '#166534', '#DCFCE7'], deleted: ['Deleted', '#7F1D1D', '#FEE2E2'] }

export default function HrSeparations({ profile }) {
  const org = useOrgSelector(profile)
  const [employees, setEmployees] = useState([])
  const [people, setPeople] = useState({})
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(blank)
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [view, setView] = useState('current')   // current | archived | all
  const [open, setOpen] = useState(null)
  const [history, setHistory] = useState([])
  const [dialog, setDialog] = useState(null)

  async function load() {
    if (!org.selectedOrg) return
    const [emps, seps, us] = await Promise.all([
      listEmployees(org.selectedOrg, { includeInactive: true }),
      listSeparations(org.selectedOrg),
      supabase.from('users').select('id, full_name').eq('org_id', org.selectedOrg),
    ])
    setEmployees(emps); setRows(seps)
    setPeople(Object.fromEntries((us.data || []).map((u) => [u.id, u.full_name])))
  }
  useEffect(() => { load() }, [org.selectedOrg]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) listHistory('separation', open).then(setHistory) }, [open])

  const empName = (id) => (employees.find((e) => e.id === id) || {}).full_name || '—'
  const shown = rows.filter((r) => {
    const st = r.status || 'active'
    if (view === 'all') return true
    if (view === 'archived') return !!r.archived_at && st !== 'deleted'
    return !r.archived_at && st !== 'deleted'
  })

  const formPatch = () => ({
    employee_id: form.employee_id, separation_type: form.separation_type, effective_date: form.effective_date,
    last_day_worked: form.last_day_worked || null, rehire_eligible: form.rehire_eligible === 'yes',
    reason: form.reason || null, reasons: form.reason ? [form.reason] : [], confidential_note: form.confidential_note || null,
  })

  function startEdit(r) {
    setEditing(r)
    setForm({ employee_id: r.employee_id, separation_type: r.separation_type, effective_date: r.effective_date || '', last_day_worked: r.last_day_worked || '',
      rehire_eligible: r.rehire_eligible ? 'yes' : 'no', reason: reasonOf(r), confidential_note: r.confidential_note || '', mark_inactive: false })
    setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function submit(e) {
    e.preventDefault(); setError('')
    if (!form.employee_id || !form.effective_date) { setError('Employee and effective date are required.'); return }
    if (!form.reason) { setError('Pick the reason.'); return }
    if (editing) { setDialog({ kind: 'edit', row: editing }); return }
    setSaving(true)
    const { error: err } = await addSeparation(org.selectedOrg, { ...formPatch(), created_by: profile.id || null })
    if (!err && form.mark_inactive) await updateEmployee(form.employee_id, { is_active: false })
    setSaving(false)
    if (err) { setError(err.message); return }
    setForm(blank); setShowForm(false); load()
  }

  async function change(row, patch, action, reason) {
    const r = await recordChange({ orgId: org.selectedOrg, table: 'rewards_separations', recordType: 'separation', row, patch, action, reason })
    if (!r.error) { load(); if (open === row.id) listHistory('separation', row.id).then(setHistory) }
    return r
  }
  async function applyDialog(reason) {
    const { kind, row } = dialog
    const stamp = { status_reason: reason, status_at: new Date().toISOString(), status_by: profile.id || null }
    if (kind === 'edit') {
      const r = await change(row, formPatch(), 'edit', reason)
      if (!r.error) { setEditing(null); setForm(blank); setShowForm(false) }
      return r
    }
    if (kind === 'delete') return change(row, { status: 'deleted', employee_visible: false, ...stamp }, 'delete', reason)
    if (kind === 'reinstate') {
      const r = await change(row, { status: 'reinstated', ...stamp }, 'reinstate', reason)
      if (!r.error) await updateEmployee(row.employee_id, { is_active: true })
      load()
      return r
    }
    if (kind === 'restore') return change(row, { status: 'active', ...stamp }, 'reinstate', reason)
  }

  async function print(r) {
    printHrDocument({
      orgName: await orgName(org.selectedOrg),
      title: 'Separation Record', subtitle: empName(r.employee_id),
      watermark: r.status === 'reinstated' ? 'REINSTATED' : r.status === 'deleted' ? 'VOID' : null,
      rows: [
        ['Separation type', TYPE_LABEL[r.separation_type] || r.separation_type],
        ['Effective date', r.effective_date], ['Last day worked', r.last_day_worked],
        ['Eligible for rehire', r.rehire_eligible ? 'Eligible for Rehire' : 'Not Eligible for Rehire'],
        ['Reason', separationReasonLabel(reasonOf(r))],
      ],
      footer: 'This record is limited to separation status and a general reason. It does not describe job performance or make any accusation.',
    })
  }

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><h2>Separations</h2><span className="badge">{shown.length} shown</span></div>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => { if (showForm) { setShowForm(false); setEditing(null); setForm(blank) } else setShowForm(true) }}>{showForm ? 'Cancel' : '+ New Separation'}</button>
      </div>
      <OrgBar {...org} />

      {showForm && (
        <form onSubmit={submit} style={{ marginBottom: 22, border: '1px solid ' + (editing ? '#2E6FB5' : 'var(--border)'), borderRadius: 12, padding: 18 }}>
          {editing && <div style={{ fontWeight: 800, color: '#1F3A5F', marginBottom: 10 }}>Editing a separation — you'll be asked for the reason; the original is kept in its history.</div>}
          <div className="inline-form" style={{ flexWrap: 'wrap', gap: 12 }}>
            <div className="field" style={{ minWidth: 220 }}><label>Employee</label>
              <select value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} required disabled={!!editing}>
                <option value="">— select —</option>{employees.filter((e) => e.is_active || e.id === form.employee_id).map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select></div>
            <div className="field"><label>Type</label>
              <select value={form.separation_type} onChange={(e) => setForm({ ...form, separation_type: e.target.value })}>
                <option value="involuntary">Involuntary</option><option value="voluntary">Voluntary</option><option value="layoff">Layoff</option></select></div>
            <div className="field"><label>Effective date</label><input type="date" value={form.effective_date} onChange={(e) => setForm({ ...form, effective_date: e.target.value })} required /></div>
            <div className="field"><label>Last day worked</label><input type="date" value={form.last_day_worked} onChange={(e) => setForm({ ...form, last_day_worked: e.target.value })} /></div>
            <div className="field" style={{ minWidth: 220 }}><label>Reason — general behavior only</label>
              <select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required>
                <option value="">— select —</option>
                {SEPARATION_REASONS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select></div>
          </div>

          <div style={{ marginTop: 16 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Eligible for rehire</label>
            <div style={{ display: 'flex', gap: 16 }}>
              <label style={{ cursor: 'pointer' }}><input type="radio" name="rehire" checked={form.rehire_eligible === 'yes'} onChange={() => setForm({ ...form, rehire_eligible: 'yes' })} /> Eligible for Rehire</label>
              <label style={{ cursor: 'pointer' }}><input type="radio" name="rehire" checked={form.rehire_eligible === 'no'} onChange={() => setForm({ ...form, rehire_eligible: 'no' })} /> Not Eligible for Rehire</label>
            </div>
          </div>

          <div style={{ marginTop: 16, background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '10px 14px' }}>
            <label style={{ display: 'block', fontSize: 13, color: '#9A3412', fontWeight: 700, marginBottom: 4 }}>Confidential internal note — never printed or shared</label>
            <textarea rows="2" value={form.confidential_note} onChange={(e) => setForm({ ...form, confidential_note: e.target.value })} style={{ width: '100%' }} placeholder="Optional. Do not record performance/competency judgments or unproven accusations." />
            <div style={{ fontSize: 11.5, color: '#9A3412', marginTop: 4 }}>
              Keep the official record to behavior and eligibility only. Competency reasons can support an unemployment claim; unproven accusations (e.g. theft without an arrest) create lawsuit exposure.
            </div>
          </div>

          {!editing && (
            <label style={{ display: 'inline-block', marginTop: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.mark_inactive} onChange={(e) => setForm({ ...form, mark_inactive: e.target.checked })} style={{ marginRight: 6 }} />
              Also mark this employee inactive
            </label>
          )}

          {!editing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              {form.employee_id ? (
                <AiAssist inline title="Offboarding checklist" label="✦ Draft offboarding checklist"
                  system={OFFBOARDING_SYS}
                  prompt="Draft the offboarding checklist for this departure — process steps only, no reason."
                  context={{ separation_type: form.separation_type, role: (employees.find((e) => e.id === form.employee_id) || {}).role || 'field employee' }} />
              ) : (
                <span style={{ fontSize: 12.5, color: 'var(--mist)' }}>Select an employee to draft their offboarding checklist.</span>
              )}
              <span style={{ fontSize: 12, color: 'var(--mist)' }}>Process steps only — never the reason for leaving. Copy into your offboarding notes.</span>
            </div>
          )}

          {error && <div className="auth-error" style={{ marginTop: 12 }}>{error}</div>}
          <div><button className="auth-button" type="submit" style={{ width: 'auto', marginTop: 14 }} disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes…' : 'Record separation'}</button></div>
        </form>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {[['current', 'Current'], ['archived', 'Archived'], ['all', 'All (incl. deleted)']].map(([k, l]) => (
          <button key={k} onClick={() => setView(k)} style={{ padding: '6px 13px', borderRadius: 999, border: '1px solid ' + (view === k ? '#1F3A5F' : 'var(--border)'), background: view === k ? '#1F3A5F' : '#fff', color: view === k ? '#fff' : '#334155', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>{l}</button>
        ))}
      </div>

      <table className="data-table">
        <thead><tr><th>Employee</th><th>Type</th><th>Effective</th><th>Rehire</th><th>Reason</th><th>Employee file</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
        <tbody>
          {shown.map((r) => {
            const st = r.status || 'active'
            const tag = STATUS_TAG[st]
            return [
              <tr key={r.id} style={{ opacity: st === 'deleted' ? 0.6 : 1 }}>
                <td><button onClick={() => setOpen(open === r.id ? null : r.id)} style={{ background: 'none', border: 'none', padding: 0, color: '#1F3A5F', fontWeight: 700, cursor: 'pointer' }}>{empName(r.employee_id)} {open === r.id ? '▲' : '▼'}</button>
                  {tag && <span style={{ fontSize: 11, fontWeight: 800, color: tag[1], background: tag[2], borderRadius: 999, padding: '1px 7px', marginLeft: 6 }}>{tag[0]}</span>}
                  {r.archived_at && <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', background: '#F1F5F9', borderRadius: 999, padding: '1px 7px', marginLeft: 6 }}>Archived</span>}</td>
                <td>{TYPE_LABEL[r.separation_type] || r.separation_type}</td>
                <td>{r.effective_date || '—'}</td>
                <td style={{ color: r.rehire_eligible ? '#166534' : '#B00020', fontWeight: 600 }}>{r.rehire_eligible ? 'Eligible' : 'Not eligible'}</td>
                <td>{reasonOf(r) ? separationReasonLabel(reasonOf(r)) : '—'}</td>
                <td>
                  <label style={{ fontSize: 12.5, cursor: st === 'deleted' ? 'default' : 'pointer' }} title="Add to the employee's own records (My Records)">
                    <input type="checkbox" disabled={st === 'deleted'} checked={!!r.employee_visible} onChange={() => change(r, { employee_visible: !r.employee_visible }, r.employee_visible ? 'unshare' : 'share')} /> {r.employee_visible ? 'Shared' : 'Add to file'}
                  </label>
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="logout-button" onClick={() => print(r)} title="Print record">🖨</button>{' '}
                  {st !== 'deleted' && <button className="logout-button" onClick={() => change(r, { archived_at: r.archived_at ? null : new Date().toISOString() }, r.archived_at ? 'unarchive' : 'archive')}>{r.archived_at ? 'Unarchive' : 'Archive'}</button>}{' '}
                  {st !== 'deleted' && <button className="logout-button" style={{ color: '#B42318' }} onClick={() => setDialog({ kind: 'delete', row: r })}>Delete…</button>}
                </td>
              </tr>,
              open === r.id && (
                <tr key={r.id + '-d'}><td colSpan="7" style={{ background: '#F8FAFC' }}>
                  <div style={{ display: 'grid', gap: 8, padding: '6px 2px' }}>
                    <div style={{ fontSize: 12.5, color: 'var(--mist)' }}>Recorded by {people[r.created_by] || '—'} on {new Date(r.created_at).toLocaleDateString()}{r.last_day_worked ? ` · last day worked ${r.last_day_worked}` : ''}</div>
                    {r.confidential_note && <div style={{ fontSize: 13, color: '#9A3412' }}><b>Confidential note:</b> {r.confidential_note}</div>}
                    {st !== 'active' && <div style={{ fontSize: 13 }}><b>{tag?.[0]}</b> {r.status_at ? new Date(r.status_at).toLocaleDateString() : ''} by {people[r.status_by] || '—'}: {r.status_reason}</div>}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {st === 'active' && <button className="logout-button" onClick={() => startEdit(r)}>Edit…</button>}
                      {st === 'active' && <button className="logout-button" onClick={() => setDialog({ kind: 'reinstate', row: r })}>Reinstate employee…</button>}
                      {st === 'deleted' && <button className="logout-button" onClick={() => setDialog({ kind: 'restore', row: r })}>Restore record…</button>}
                    </div>
                    <div><div style={{ fontSize: 12, fontWeight: 800, color: 'var(--mist)', textTransform: 'uppercase', margin: '6px 0 4px' }}>History</div><HistoryList items={history} people={people} /></div>
                  </div>
                </td></tr>
              ),
            ]
          })}
          {shown.length === 0 && <tr><td colSpan="7" style={{ color: 'var(--mist)' }}>No separations here.</td></tr>}
        </tbody>
      </table>

      {dialog && (
        <ReasonDialog
          title={{ edit: 'Save changes to this separation', delete: 'Delete this separation record', reinstate: 'Reinstate this employee', restore: 'Restore this record' }[dialog.kind]}
          verb={{ edit: 'Save changes', delete: 'Delete', reinstate: 'Reinstate', restore: 'Restore' }[dialog.kind]}
          danger={dialog.kind === 'delete'}
          note={{ edit: 'The original is kept in the record history.', delete: 'Removed from view but kept (marked Deleted) to meet record-retention rules. You can restore it.', reinstate: 'Marks this separation Reinstated and makes the employee active again. The record stays on file.', restore: 'Makes the record active again.' }[dialog.kind]}
          onConfirm={applyDialog} onClose={() => setDialog(null)} />
      )}
    </div>
  )
}
