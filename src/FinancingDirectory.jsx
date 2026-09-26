import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'

// Journey (super-admin) maintained directory of lenders subscribers can enroll with.
// Platform-level: not org-scoped. Readable by every subscriber (and available for Quincy
// to reference); editable only here by the Journey super admin.
const KINDS = [['traditional', 'Traditional'], ['lease_to_own', 'Lease-to-Own'], ['bnpl', 'Buy-now-pay-later']]
const blank = { name: '', kind: 'traditional', best_for: '', signup_url: '', website: '', terms_note: '', notes_for_subscriber: '', typical_merchant_fee: '', sort_order: 100, is_active: true }

export default function FinancingDirectory({ profile }) {
  const isSuper = profile?.role === 'super_admin'
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(blank)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('financing_lender_directory').select('*').order('sort_order')
    setRows(data || []); setLoading(false)
  }
  useEffect(() => { if (isSuper) load() }, [])

  function startAdd() { setForm(blank); setEditingId(null); setShowForm(true); setErr('') }
  function startEdit(o) {
    setEditingId(o.id); setShowForm(true); setErr('')
    setForm({
      name: o.name || '', kind: o.kind || 'traditional', best_for: o.best_for || '', signup_url: o.signup_url || '',
      website: o.website || '', terms_note: o.terms_note || '', notes_for_subscriber: o.notes_for_subscriber || '',
      typical_merchant_fee: o.typical_merchant_fee || '', sort_order: o.sort_order ?? 100, is_active: !!o.is_active,
    })
  }
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  async function save(e) {
    e.preventDefault()
    if (!form.name.trim()) { setErr('Give the lender a name.'); return }
    setSaving(true); setErr('')
    const payload = {
      name: form.name.trim(), kind: form.kind, best_for: form.best_for.trim() || null,
      signup_url: form.signup_url.trim() || null, website: form.website.trim() || null,
      terms_note: form.terms_note.trim() || null, notes_for_subscriber: form.notes_for_subscriber.trim() || null,
      typical_merchant_fee: form.typical_merchant_fee.trim() || null,
      sort_order: Number(form.sort_order) || 100, is_active: form.is_active, updated_at: new Date().toISOString(),
    }
    const res = editingId
      ? await supabase.from('financing_lender_directory').update(payload).eq('id', editingId)
      : await supabase.from('financing_lender_directory').insert(payload)
    setSaving(false)
    if (res.error) { setErr(res.error.message); return }
    setShowForm(false); setEditingId(null); setForm(blank); load()
  }
  async function toggleActive(o) { await supabase.from('financing_lender_directory').update({ is_active: !o.is_active }).eq('id', o.id); load() }
  async function remove(o) {
    if (!window.confirm(`Remove "${o.name}" from the directory?`)) return
    await supabase.from('financing_lender_directory').delete().eq('id', o.id); load()
  }

  if (!isSuper) {
    return <div className="page"><h2>Lender Directory</h2><p style={{ color: 'var(--mist)' }}>This is a Journey platform admin page.</p></div>
  }

  return (
    <div className="page">
      <div className="page-header-bar">
        <h2 style={{ margin: 0 }}>Lender Directory <span style={{ fontSize: 12, color: 'var(--mist)', fontWeight: 400 }}>(platform)</span></h2>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => (showForm ? setShowForm(false) : startAdd())}>{showForm ? 'Cancel' : '+ New lender'}</button>
      </div>
      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0, maxWidth: 820 }}>
        The lenders every Journey subscriber can enroll with. This list is shown to subscribers under Financing Central → "Join a lender," and is available for Quincy to reference when helping a contractor set up financing. Enrollment links here are the "become a dealer" pages; each subscriber's own customer-apply and dashboard links live per-org in their Financing Options.
      </p>
      {err && <div className="auth-error" style={{ marginBottom: 12 }}>{err}</div>}

      {showForm && (
        <form onSubmit={save} className="inline-form" style={{ marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div className="field" style={{ minWidth: 180 }}><label>Name</label><input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. FTL Finance" required /></div>
          <div className="field"><label>Kind</label><select value={form.kind} onChange={(e) => set('kind', e.target.value)}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div className="field" style={{ minWidth: 220 }}><label>Best for</label><input value={form.best_for} onChange={(e) => set('best_for', e.target.value)} placeholder="Full-system installs, WAC" /></div>
          <div className="field" style={{ minWidth: 260 }}><label>Enrollment / become-a-dealer URL</label><input value={form.signup_url} onChange={(e) => set('signup_url', e.target.value)} placeholder="https://…" /></div>
          <div className="field" style={{ minWidth: 220 }}><label>Website</label><input value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="https://…" /></div>
          <div className="field" style={{ minWidth: 180 }}><label>Terms note</label><input value={form.terms_note} onChange={(e) => set('terms_note', e.target.value)} placeholder="Up to 10-yr, WAC" /></div>
          <div className="field" style={{ minWidth: 220 }}><label>Typical dealer cost</label><input value={form.typical_merchant_fee} onChange={(e) => set('typical_merchant_fee', e.target.value)} placeholder="e.g. ~6% merchant fee" /></div>
          <div className="field" style={{ width: 90 }}><label>Sort</label><input type="number" value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} /></div>
          <div className="field" style={{ flexBasis: '100%' }}><label>Notes for subscriber (how to get set up)</label><textarea value={form.notes_for_subscriber} onChange={(e) => set('notes_for_subscriber', e.target.value)} rows={2} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #E2E8F0' }} /></div>
          <label style={{ cursor: 'pointer', alignSelf: 'flex-end' }}><input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} /> Active</label>
          <button className="auth-button" type="submit" disabled={saving} style={{ width: 'auto' }}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Add lender'}</button>
        </form>
      )}

      {loading ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : rows.length === 0 ? (
        <p style={{ color: 'var(--mist)' }}>No lenders in the directory yet.</p>
      ) : (
        <table className="data-table">
          <thead><tr><th>Name</th><th>Kind</th><th>Best for</th><th>Enroll</th><th>Dealer cost</th><th>Active</th><th></th></tr></thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} style={o.is_active ? undefined : { opacity: 0.55 }}>
                <td style={{ fontWeight: 600 }}>{o.name}</td>
                <td>{(KINDS.find((k) => k[0] === o.kind) || [])[1] || o.kind}</td>
                <td style={{ color: 'var(--mist)', fontSize: 13 }}>{o.best_for || '—'}</td>
                <td>{o.signup_url ? <a href={o.signup_url} target="_blank" rel="noreferrer">link ↗</a> : <span style={{ color: '#B0600A', fontSize: 12 }}>none</span>}</td>
                <td style={{ fontSize: 12, color: 'var(--mist)' }}>{o.typical_merchant_fee || '—'}</td>
                <td><button className="logout-button" onClick={() => toggleActive(o)}>{o.is_active ? 'Active' : 'Off'}</button></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="auth-button" style={{ width: 'auto', margin: 0, marginRight: 6, padding: '4px 10px' }} onClick={() => startEdit(o)}>Edit</button>
                  <button className="logout-button" style={{ color: '#B00020', borderColor: '#F0B4B4' }} onClick={() => remove(o)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
