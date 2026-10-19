// Rewards-HVAC · Discipline — progressive discipline record trail
import { useState, useEffect } from 'react'
import { listEmployees, listDiscipline, addDiscipline, DISCIPLINE_TYPES } from './hrData'
import { useOrgSelector, OrgBar } from './shared'
import AiAssist from '../../AiAssist'
import { supabase } from '../../utils/supabase'
import { recordChange, listHistory, ReasonDialog, HistoryList, printHrDocument, orgName } from './hrRecords'
import MeetingRecorder, { RecordingsList } from './MeetingRecorder'

const TYPE_LABEL = { verbal: 'Verbal warning', written: 'Written warning', final: 'Final warning', suspension: 'Suspension', termination: 'Termination' }
const blank = { employee_id: '', type: 'verbal', incident_date: '', incident: '', description: '', improvement_plan: '', follow_up_date: '' }

// Drafts a consistent, defensible write-up from the facts the manager entered.
// Deliberately conservative — same posture as the Separations reason list: stick to
// observable behavior, never diagnose, never touch protected characteristics, and
// always leave the decision (and any termination) to a human reviewer.
const DISCIPLINE_SYS = `You are an HR writing assistant for an HVAC contractor, drafting a progressive-discipline write-up. Write in clear, neutral, professional language that is factual and defensible. STRICT RULES: use ONLY the facts given; never invent events, dates, or witnesses. Describe observable behavior and its business impact — never the person's character, motives, or presumed intent. NEVER reference or infer protected characteristics (age, race, sex, religion, national origin, disability, medical condition, pregnancy/family status, or any protected class) and never speculate about mental health or personal circumstances. Do not state legal conclusions. Keep it consistent with progressive discipline (state the expectation, the gap, and that continued issues may lead to further action up to termination). Return EXACTLY two sections:
### WRITE-UP
<the incident write-up: what was observed, the standard/policy expectation it fell short of, and prior related steps if given>
### IMPROVEMENT PLAN
<specific, measurable, time-bound corrective actions and the support offered>`

// Split the draft into the Details + Improvement plan fields.
function parseWriteup(text) {
  const t = (text || '').replace(/\r/g, '')
  const w = t.match(/###\s*WRITE-?UP\s*\n([\s\S]*?)(?=\n###\s*IMPROVEMENT|$)/i)
  const p = t.match(/###\s*IMPROVEMENT[^\n]*\n([\s\S]*)$/i)
  const writeup = w ? w[1].trim() : (p ? '' : t.trim())
  const plan = p ? p[1].trim() : ''
  return { writeup, plan }
}

export default function HrDiscipline({ profile }) {
  const org = useOrgSelector(profile)
  const [employees, setEmployees] = useState([])
  const [people, setPeople] = useState({})
  const [rows, setRows] = useState([])
  const [filterEmp, setFilterEmp] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [form, setForm] = useState(blank)
  const [editing, setEditing] = useState(null)   // the record being edited (null = new)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(null)
  const [history, setHistory] = useState([])
  const [dialog, setDialog] = useState(null)     // { kind, row }
  const [recording, setRecording] = useState(null)   // discipline row being recorded
  const [recKey, setRecKey] = useState(0)

  async function load() {
    if (!org.selectedOrg) return
    const [emps, recs, us] = await Promise.all([
      listEmployees(org.selectedOrg, { includeInactive: true }),
      listDiscipline(org.selectedOrg, filterEmp || undefined),
      supabase.from('users').select('id, full_name').eq('org_id', org.selectedOrg),
    ])
    setEmployees(emps); setRows(recs)
    setPeople(Object.fromEntries((us.data || []).map((u) => [u.id, u.full_name])))
  }
  useEffect(() => { load() }, [org.selectedOrg, filterEmp])
  useEffect(() => { if (open) listHistory('discipline', open).then(setHistory) }, [open])

  const empName = (id) => (employees.find((e) => e.id === id) || {}).full_name || '—'
  const shown = rows.filter((r) => showAll || (r.status || 'active') === 'active')

  function startEdit(r) {
    setEditing(r)
    setForm({ employee_id: r.employee_id, type: r.type, incident_date: r.incident_date || '', incident: r.incident || '', description: r.description || '', improvement_plan: r.improvement_plan || '', follow_up_date: r.follow_up_date || '' })
    setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const formPatch = () => ({
    employee_id: form.employee_id, type: form.type, incident_date: form.incident_date,
    incident: form.incident || null, description: form.description || null,
    improvement_plan: form.improvement_plan || null, follow_up_date: form.follow_up_date || null,
  })

  async function submit(e) {
    e.preventDefault()
    if (!form.employee_id || !form.incident_date) return
    if (editing) { setDialog({ kind: 'edit', row: editing }); return }   // edits need a reason
    setSaving(true)
    await addDiscipline(org.selectedOrg, { ...formPatch(), issued_by: profile.id || null })
    setSaving(false); setForm(blank); setShowForm(false); load()
  }

  async function applyDialog(reason) {
    const { kind, row } = dialog
    const stamp = { status_reason: reason, status_at: new Date().toISOString(), status_by: profile.id || null }
    let patch
    if (kind === 'edit') patch = formPatch()
    else if (kind === 'rescind') patch = { status: 'rescinded', ...stamp }
    else if (kind === 'delete') patch = { status: 'deleted', employee_visible: false, ...stamp }
    else if (kind === 'restore') patch = { status: 'active', ...stamp }
    const r = await recordChange({ orgId: org.selectedOrg, table: 'rewards_discipline', recordType: 'discipline', row, patch, action: kind === 'restore' ? 'reinstate' : kind, reason })
    if (!r.error) {
      if (kind === 'edit') { setEditing(null); setForm(blank); setShowForm(false) }
      load(); if (open === row.id) listHistory('discipline', row.id).then(setHistory)
    }
    return r
  }

  async function toggleShare(r) {
    const v = !r.employee_visible
    await recordChange({ orgId: org.selectedOrg, table: 'rewards_discipline', recordType: 'discipline', row: r, patch: { employee_visible: v }, action: v ? 'share' : 'unshare' })
    load()
  }

  async function print(r) {
    printHrDocument({
      orgName: await orgName(org.selectedOrg),
      title: 'Employee Discipline Notice',
      subtitle: empName(r.employee_id),
      watermark: r.status === 'rescinded' ? 'RESCINDED' : r.status === 'deleted' ? 'VOID' : null,
      rows: [
        ['Employee', empName(r.employee_id)],
        ['Action', TYPE_LABEL[r.type] || r.type],
        ['Incident date', r.incident_date],
        ['Issued by', people[r.issued_by] || ''],
        ['Follow-up date', r.follow_up_date],
        ...(r.status && r.status !== 'active' ? [['Status', `${r.status} — ${r.status_reason || ''}`]] : []),
      ],
      sections: [['Incident', r.incident], ['Details', r.description], ['Improvement plan', r.improvement_plan],
        ['Employee comments', '\n\n\n']],
      ack: 'Employee acknowledgment: My signature confirms that this notice was reviewed with me and I received a copy. It does not necessarily mean I agree with it. I may add written comments above or attach a statement.',
      signatures: ['Employee signature', 'Supervisor / manager signature', 'Witness (if the employee declines to sign)'],
      footer: 'Kept in the employee file. This notice describes observed conduct and the expectation going forward.',
    })
  }

  const TAG = { rescinded: ['Rescinded', '#92400E', '#FEF3C7'], deleted: ['Deleted', '#7F1D1D', '#FEE2E2'] }

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><h2>Discipline</h2><span className="badge">{shown.length} records</span></div>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => { if (showForm) { setShowForm(false); setEditing(null); setForm(blank) } else setShowForm(true) }}>{showForm ? 'Cancel' : '+ New Record'}</button>
      </div>
      <OrgBar {...org} />

      {showForm && (
        <form onSubmit={submit} style={{ marginBottom: 20, border: '1px solid ' + (editing ? '#2E6FB5' : 'var(--border)'), borderRadius: 12, padding: 18 }}>
          {editing && <div style={{ fontWeight: 800, color: '#1F3A5F', marginBottom: 10 }}>Editing a record — you'll be asked for the reason; the original is kept in its history.</div>}
          <div className="inline-form" style={{ flexWrap: 'wrap', gap: 12 }}>
            <div className="field" style={{ minWidth: 200 }}><label>Employee</label>
              <select value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} required>
                <option value="">— select —</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select></div>
            <div className="field"><label>Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {DISCIPLINE_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</select></div>
            <div className="field"><label>Incident date</label><input type="date" value={form.incident_date} onChange={(e) => setForm({ ...form, incident_date: e.target.value })} required /></div>
            <div className="field"><label>Follow-up date</label><input type="date" value={form.follow_up_date} onChange={(e) => setForm({ ...form, follow_up_date: e.target.value })} /></div>
          </div>
          <div className="field" style={{ marginTop: 12 }}><label>Incident summary</label><input value={form.incident} onChange={(e) => setForm({ ...form, incident: e.target.value })} style={{ width: '100%' }} /></div>
          <div className="field" style={{ marginTop: 12 }}><label>Details</label><textarea rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ width: '100%' }} /></div>
          <div className="field" style={{ marginTop: 12 }}><label>Improvement plan</label><textarea rows="2" value={form.improvement_plan} onChange={(e) => setForm({ ...form, improvement_plan: e.target.value })} style={{ width: '100%' }} /></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            {(form.incident || form.description) ? (
              <AiAssist inline title="Draft the write-up" label="✦ Draft write-up (HR-safe)"
                insertLabel="Fill Details + Improvement plan"
                system={DISCIPLINE_SYS}
                prompt="Draft a consistent, defensible write-up from these facts only."
                context={{
                  action_type: TYPE_LABEL[form.type] || form.type,
                  incident_summary: form.incident || null,
                  facts_entered: form.description || null,
                  improvement_notes_so_far: form.improvement_plan || null,
                }}
                onInsert={(text) => { const p = parseWriteup(text); setForm((f) => ({ ...f, description: p.writeup || f.description, improvement_plan: p.plan || f.improvement_plan })) }} />
            ) : (
              <span style={{ fontSize: 12.5, color: 'var(--mist)' }}>Enter the incident summary or details, then draft the write-up.</span>
            )}
            <span style={{ fontSize: 12, color: 'var(--mist)' }}>Facts-only, protected-class-safe. Review before saving; have counsel review any termination.</span>
          </div>
          <button className="auth-button" type="submit" style={{ width: 'auto', marginTop: 14 }} disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes…' : 'Add record'}</button>
        </form>
      )}

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12 }}>
        <div className="field" style={{ maxWidth: 300, margin: 0 }}>
          <label>Filter by employee</label>
          <select value={filterEmp} onChange={(e) => setFilterEmp(e.target.value)}>
            <option value="">All employees</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select>
        </div>
        <label style={{ fontSize: 13, cursor: 'pointer' }}><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show rescinded &amp; deleted</label>
      </div>

      <table className="data-table">
        <thead><tr><th>Date</th><th>Employee</th><th>Type</th><th>Incident</th><th>Follow-up</th><th>In employee's view</th><th></th></tr></thead>
        <tbody>
          {shown.map((r) => {
            const st = r.status || 'active'
            return [
              <tr key={r.id} style={{ opacity: st === 'active' ? 1 : 0.65, cursor: 'pointer' }} onClick={() => setOpen(open === r.id ? null : r.id)}>
                <td>{r.incident_date || '—'}</td>
                <td>{empName(r.employee_id)}</td>
                <td>{TYPE_LABEL[r.type] || r.type} {TAG[st] && <span style={{ fontSize: 11, fontWeight: 800, color: TAG[st][1], background: TAG[st][2], borderRadius: 999, padding: '1px 7px', marginLeft: 4 }}>{TAG[st][0]}</span>}</td>
                <td>{r.incident || r.description || '—'}</td>
                <td>{r.follow_up_date || '—'}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <label style={{ fontSize: 12.5, cursor: st === 'deleted' ? 'default' : 'pointer' }} title="Shows this record in the employee's own records (My Records)">
                    <input type="checkbox" disabled={st === 'deleted'} checked={!!r.employee_visible} onChange={() => toggleShare(r)} /> {r.employee_visible ? 'Shared' : 'Hidden'}
                  </label>
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{open === r.id ? '▲' : '▼'}</td>
              </tr>,
              open === r.id && (
                <tr key={r.id + '-d'}><td colSpan="7" style={{ background: '#F8FAFC' }}>
                  <div style={{ display: 'grid', gap: 8, padding: '6px 2px' }}>
                    {r.description && <div><b>Details:</b> <span style={{ whiteSpace: 'pre-wrap' }}>{r.description}</span></div>}
                    {r.improvement_plan && <div><b>Improvement plan:</b> <span style={{ whiteSpace: 'pre-wrap' }}>{r.improvement_plan}</span></div>}
                    <div style={{ fontSize: 12.5, color: 'var(--mist)' }}>Issued by {people[r.issued_by] || '—'} · created {new Date(r.created_at).toLocaleDateString()}</div>
                    {st !== 'active' && <div style={{ fontSize: 13, color: '#92400E' }}><b>{TAG[st][0]}</b> {r.status_at ? new Date(r.status_at).toLocaleDateString() : ''} by {people[r.status_by] || '—'}: {r.status_reason}</div>}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="logout-button" onClick={() => print(r)}>🖨 Print for signature</button>
                      {st === 'active' && <button className="logout-button" onClick={() => startEdit(r)}>Edit…</button>}
                      {st === 'active' && <button className="logout-button" onClick={() => setDialog({ kind: 'rescind', row: r })}>Override / rescind…</button>}
                      {st !== 'deleted' && <button className="logout-button" style={{ color: '#B42318' }} onClick={() => setDialog({ kind: 'delete', row: r })}>Delete…</button>}
                      {st !== 'active' && <button className="logout-button" onClick={() => setDialog({ kind: 'restore', row: r })}>Restore…</button>}
                    </div>
                    <RecordingsList key={recKey} disciplineId={r.id} onRecord={() => setRecording(r)} />
                    <div><div style={{ fontSize: 12, fontWeight: 800, color: 'var(--mist)', textTransform: 'uppercase', margin: '6px 0 4px' }}>History</div><HistoryList items={history} people={people} /></div>
                  </div>
                </td></tr>
              ),
            ]
          })}
          {shown.length === 0 && <tr><td colSpan="7" style={{ color: 'var(--mist)' }}>No discipline records.</td></tr>}
        </tbody>
      </table>

      {recording && <MeetingRecorder orgId={org.selectedOrg} employee={employees.find((e) => e.id === recording.employee_id)} disciplineId={recording.id} profile={profile}
        onClose={() => setRecording(null)} onSaved={() => { setRecording(null); setRecKey((k) => k + 1) }} />}

      {dialog && (
        <ReasonDialog
          title={{ edit: 'Save changes to this record', rescind: 'Override / rescind this record', delete: 'Delete this record', restore: 'Restore this record' }[dialog.kind]}
          verb={{ edit: 'Save changes', rescind: 'Rescind', delete: 'Delete', restore: 'Restore' }[dialog.kind]}
          danger={dialog.kind === 'delete'}
          note={{ edit: 'The original wording is kept in the record history.', rescind: 'The record stays on file, marked Rescinded, and no longer counts as active discipline.', delete: 'The record is removed from view but kept (marked Deleted) to meet record-retention rules. You can restore it.', restore: 'Makes the record active again.' }[dialog.kind]}
          onConfirm={applyDialog} onClose={() => setDialog(null)} />
      )}
    </div>
  )
}
