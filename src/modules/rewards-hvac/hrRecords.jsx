// Rewards-HVAC · shared helpers for HR records that must keep a trail:
//   • recordChange — every edit / delete / rescind / reinstate writes the BEFORE and AFTER
//     plus the reason to rewards_hr_history, then applies the change. Deletes are soft
//     (status 'deleted'), so nothing is lost while retention rules still apply.
//   • ReasonDialog — the "why are you changing this?" box those actions require.
//   • printHrDocument — a clean printable page with acknowledgment + signature lines.
import { useState } from 'react'
import { supabase } from '../../utils/supabase'

export async function recordChange({ orgId, table, recordType, row, patch, action, reason }) {
  const { error: hErr } = await supabase.from('rewards_hr_history').insert({
    org_id: orgId, record_type: recordType, record_id: row.id, employee_id: row.employee_id || null,
    action, reason: reason || null, before: row, after: patch,
  })
  if (hErr) return { error: hErr }
  return supabase.from(table).update({ ...patch, updated_at: new Date().toISOString() }).eq('id', row.id)
}

export async function listHistory(recordType, recordId) {
  const { data } = await supabase.from('rewards_hr_history').select('*').eq('record_type', recordType).eq('record_id', recordId).order('created_at', { ascending: false })
  return data || []
}

const ACTION_LABEL = { edit: 'Edited', delete: 'Deleted', rescind: 'Rescinded', reinstate: 'Reinstated', archive: 'Archived', unarchive: 'Unarchived', share: 'Shared with employee', unshare: 'Hidden from employee' }
export const actionLabel = (a) => ACTION_LABEL[a] || a

// Modal asking for the reason. onConfirm(reason) runs only with a non-empty reason.
export function ReasonDialog({ title, verb = 'Confirm', danger, note, onConfirm, onClose }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function go() {
    if (!reason.trim()) { setErr('A reason is required — it is kept in the record history.'); return }
    setBusy(true); setErr('')
    const r = await onConfirm(reason.trim())
    setBusy(false)
    if (r?.error) setErr(r.error.message || String(r.error)); else onClose()
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        {note && <p style={{ fontSize: 13.5, color: 'var(--mist)', marginTop: -4 }}>{note}</p>}
        <label style={{ fontSize: 13, fontWeight: 700 }}>Reason</label>
        <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus style={{ width: '100%', marginTop: 4 }} />
        {err && <div className="auth-error" style={{ marginTop: 8 }}>{err}</div>}
        <div className="form-actions" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
          <button className="logout-button" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="auth-button" style={{ width: 'auto', margin: 0, background: danger ? '#B42318' : undefined }} onClick={go} disabled={busy}>{busy ? 'Saving…' : verb}</button>
        </div>
      </div>
    </div>
  )
}

// Change history list for one record.
export function HistoryList({ items, people }) {
  if (!items?.length) return <div style={{ fontSize: 12.5, color: 'var(--mist)' }}>No changes since it was created.</div>
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {items.map((h) => (
        <div key={h.id} style={{ fontSize: 12.5, color: '#475569' }}>
          <b>{actionLabel(h.action)}</b> {new Date(h.created_at).toLocaleString()} by {people?.[h.actor] || 'a user'}
          {h.reason ? <> — “{h.reason}”</> : null}
        </div>
      ))}
    </div>
  )
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')

// Opens a print window. rows: [[label, value]], sections: [[heading, text]], signatures: [label].
export function printHrDocument({ orgName, title, subtitle, rows = [], sections = [], ack, signatures = [], footer, watermark }) {
  const w = window.open('', '_blank', 'width=780,height=960'); if (!w) return
  w.document.write(`<html><head><title>${esc(title)}${subtitle ? ' — ' + esc(subtitle) : ''}</title>
  <style>
    body{font-family:Arial,sans-serif;padding:36px;color:#111;max-width:680px;margin:0 auto;position:relative}
    .org{font-size:13px;color:#555;font-weight:bold;letter-spacing:.03em;text-transform:uppercase}
    h1{font-size:21px;margin:4px 0 2px}.sub{color:#666;font-size:13px;margin-bottom:20px}
    table{border-collapse:collapse;width:100%;margin-bottom:16px}td{padding:7px 6px;border-bottom:1px solid #e5e5e5;font-size:13.5px;vertical-align:top}
    td.l{color:#555;width:190px}h2{font-size:14px;margin:18px 0 6px;border-bottom:1px solid #ccc;padding-bottom:3px}
    .sec{font-size:13.5px;line-height:1.5;white-space:normal}.ack{margin-top:22px;font-size:12.5px;color:#333;border:1px solid #ddd;padding:10px;border-radius:6px}
    .sigs{margin-top:34px;display:grid;grid-template-columns:1fr 1fr;gap:34px 28px}.sig{border-top:1px solid #111;padding-top:4px;font-size:12px;color:#444}
    .foot{margin-top:28px;color:#888;font-size:11px}
    .wm{position:fixed;top:40%;left:0;right:0;text-align:center;font-size:72px;color:rgba(180,35,24,.14);transform:rotate(-24deg);font-weight:bold}
  </style></head><body>
  ${watermark ? `<div class="wm">${esc(watermark)}</div>` : ''}
  ${orgName ? `<div class="org">${esc(orgName)}</div>` : ''}
  <h1>${esc(title)}</h1>${subtitle ? `<div class="sub">${esc(subtitle)}</div>` : ''}
  ${rows.length ? `<table><tbody>${rows.map(([l, v]) => `<tr><td class="l">${esc(l)}</td><td>${esc(v || '—')}</td></tr>`).join('')}</tbody></table>` : ''}
  ${sections.filter(([, t]) => t).map(([h, t]) => `<h2>${esc(h)}</h2><div class="sec">${esc(t)}</div>`).join('')}
  ${ack ? `<div class="ack">${esc(ack)}</div>` : ''}
  ${signatures.length ? `<div class="sigs">${signatures.map((s) => `<div><div style="height:30px"></div><div class="sig">${esc(s)}</div></div><div><div style="height:30px"></div><div class="sig">Date</div></div>`).join('')}</div>` : ''}
  ${footer ? `<div class="foot">${esc(footer)}</div>` : ''}
  </body></html>`)
  w.document.close(); w.focus(); setTimeout(() => w.print(), 250)
}

export async function orgName(orgId) {
  const { data } = await supabase.from('organizations').select('name, dba_name').eq('id', orgId).maybeSingle()
  return data?.dba_name || data?.name || ''
}
