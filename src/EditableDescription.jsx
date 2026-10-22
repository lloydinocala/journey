// A line item's description with a small ✎ edit — used on every estimate and invoice editor.
// Add to or trim a description (e.g. serial numbers next to the model numbers on an install
// invoice). Only the wording changes: quantities, prices and totals are untouched.
// `locked` = approved/declined estimate, so a signed estimate's wording can't drift.
import { useState } from 'react'
import { supabase } from './utils/supabase'

export function patchDescription(setLineItems, id, description) {
  setLineItems((list) => list.map((x) => (x.id === id ? { ...x, description } : x)))
}

export default function EditableDescription({ li, setLineItems, locked, render, children }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  function start() { setText(li.description || ''); setErr(''); setEditing(true) }
  async function save() {
    const v = text.replace(/\s+$/, '')
    if (!v.trim()) { setErr('A description is required.'); return }
    if (v === (li.description || '')) { setEditing(false); return }
    setBusy(true)
    const { error } = await supabase.from('invoice_line_items').update({ description: v }).eq('id', li.id)
    setBusy(false)
    if (error) { setErr(error.message); return }
    patchDescription(setLineItems, li.id, v)
    setEditing(false)
  }

  if (editing) {
    const rows = Math.min(12, Math.max(2, text.split('\n').length + 1))
    return (
      <div style={{ width: '100%' }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={rows} autoFocus
          onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save() }}
          style={{ width: '100%', fontSize: 14, fontFamily: 'inherit', padding: 6, borderRadius: 6, border: '1px solid #215F9A', boxSizing: 'border-box', resize: 'vertical' }} />
        {err && <div style={{ color: '#B00020', fontSize: 12 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          <button type="button" className="auth-button" style={{ width: 'auto', margin: 0, padding: '4px 12px', fontSize: 12.5 }} onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          <button type="button" className="logout-button" style={{ padding: '4px 10px', fontSize: 12.5 }} onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
        </div>
      </div>
    )
  }
  return (
    <span style={{ display: 'inline' }}>
      {render ? render(li.description) : <span style={{ whiteSpace: 'pre-line' }}>{li.description}</span>}
      {!locked && (
        <button type="button" onClick={start} title="Edit description" aria-label="Edit description"
          style={{ marginLeft: 6, border: 'none', background: 'none', color: '#215F9A', cursor: 'pointer', fontSize: 13, padding: '0 2px', verticalAlign: 'baseline' }}>✎</button>
      )}
      {children}
    </span>
  )
}
