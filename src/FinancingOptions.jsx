import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

const KINDS = [['traditional', 'Traditional'], ['lease_to_own', 'Lease-to-Own'], ['bnpl', 'Buy-now-pay-later']]
const blank = { name: '', kind: 'traditional', best_for: '', apply_url: '', dashboard_url: '', dealer_id: '', terms_note: '', min_amount: '', max_amount: '', for_service: true, for_system: true, suppress_top_tier: false, sort_order: 100, is_active: true }
const numOrNull = (v) => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v))

export default function FinancingOptions({ profile }) {
  const isSuper = profile?.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile?.org_id || '')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(blank)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (isSuper) supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
      setOrgs(data || []); if (!selectedOrg && data?.length) setSelectedOrg(data[0].id)
    })
  }, [])

  async function load() {
    if (!selectedOrg) return
    setLoading(true)
    const { data } = await supabase.from('financing_options').select('*').eq('org_id', selectedOrg).order('sort_order')
    setRows(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [selectedOrg])

  function startAdd() { setForm(blank); setEditingId(null); setShowForm(true); setErr('') }
  function startEdit(o) {
    setEditingId(o.id); setShowForm(true); setErr('')
    setForm({
      name: o.name || '', kind: o.kind || 'traditional', best_for: o.best_for || '', apply_url: o.apply_url || '',
      dashboard_url: o.dashboard_url || '', dealer_id: o.dealer_id || '',
      terms_note: o.terms_note || '', min_amount: o.min_amount ?? '', max_amount: o.max_amount ?? '',
      for_service: !!o.for_service, for_system: !!o.for_system, suppress_top_tier: !!o.suppress_top_tier,
      sort_order: o.sort_order ?? 100, is_active: !!o.is_active,
    })
  }
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  async function save(e) {
    e.preventDefault()
    if (!form.name.trim()) { setErr('Give the option a name.'); return }
    setSaving(true); setErr('')
    const payload = {
      org_id: selectedOrg, name: form.name.trim(), kind: form.kind, best_for: form.best_for.trim() || null,
      apply_url: form.apply_url.trim() || null, dashboard_url: form.dashboard_url.trim() || null,
      dealer_id: form.dealer_id.trim() || null, terms_note: form.terms_note.trim() || null,
      min_amount: numOrNull(form.min_amount), max_amount: numOrNull(form.max_amount),
      for_service: form.for_service, for_system: form.for_system, suppress_top_tier: form.suppress_top_tier,
      sort_order: Number(form.sort_order) || 100, is_active: form.is_active,
    }
    const res = editingId
      ? await supabase.from('financing_options').update(payload).eq('id', editingId)
      : await supabase.from('financing_options').insert(payload)
    setSaving(false)
    if (res.error) { setErr(res.error.message); return }
    setShowForm(false); setEditingId(null); setForm(blank); load()
  }
  async function toggleActive(o) { await supabase.from('financing_options').update({ is_active: !o.is_active }).eq('id', o.id); load() }
  async function remove(o) {
    if (!window.confirm(`Delete "${o.name}"? This removes it from the customer financing menu.`)) return
    await supabase.from('financing_options').delete().eq('id', o.id); load()
  }

  return (
    <div className="page">
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0 }}>Financing Options</h2>
          {isSuper && <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />}
        </div>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => (showForm ? setShowForm(false) : startAdd())}>{showForm ? 'Cancel' : '+ New option'}</button>
      </div>
      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0, maxWidth: 800 }}>
        The financing options a customer sees when they pick "Apply for financing" on an invoice or System Estimate. Paste your direct application link for each lender so the button opens their portal. Amount and context (service vs. system) control which options show; "Suppress on top tier" hides a lender on the top "Total Comfort" system tier.
      </p>
      {err && <div className="auth-error" style={{ marginBottom: 12 }}>{err}</div>}

      {showForm && (
        <form onSubmit={save} className="inline-form" style={{ marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div className="field" style={{ minWidth: 200 }}><label>Name</label><input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. FTL — 10-Year Plan" required /></div>
          <div className="field"><label>Kind</label><select value={form.kind} onChange={(e) => set('kind', e.target.value)}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div className="field" style={{ minWidth: 220 }}><label>Best for (one line)</label><input value={form.best_for} onChange={(e) => set('best_for', e.target.value)} placeholder="Lowest monthly, with approved credit" /></div>
          <div className="field" style={{ minWidth: 260 }}><label>Customer application URL</label><input value={form.apply_url} onChange={(e) => set('apply_url', e.target.value)} placeholder="https://… where the customer applies" /></div>
          <div className="field" style={{ minWidth: 260 }}><label>Your dashboard URL</label><input value={form.dashboard_url} onChange={(e) => set('dashboard_url', e.target.value)} placeholder="https://… your dealer login to follow up" /></div>
          <div className="field" style={{ minWidth: 140 }}><label>Dealer ID (optional)</label><input value={form.dealer_id} onChange={(e) => set('dealer_id', e.target.value)} placeholder="your dealer #" /></div>
          <div className="field" style={{ minWidth: 180 }}><label>Terms note</label><input value={form.terms_note} onChange={(e) => set('terms_note', e.target.value)} placeholder="10-year term, WAC" /></div>
          <div className="field" style={{ width: 120 }}><label>Min $ (optional)</label><input type="number" value={form.min_amount} onChange={(e) => set('min_amount', e.target.value)} /></div>
          <div className="field" style={{ width: 120 }}><label>Max $ (optional)</label><input type="number" value={form.max_amount} onChange={(e) => set('max_amount', e.target.value)} placeholder="e.g. 7500" /></div>
          <div className="field" style={{ width: 90 }}><label>Sort</label><input type="number" value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} /></div>
          <div className="field" style={{ display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'flex-end' }}>
            <label style={{ cursor: 'pointer' }}><input type="checkbox" checked={form.for_service} onChange={(e) => set('for_service', e.target.checked)} /> Show on service/invoices</label>
            <label style={{ cursor: 'pointer' }}><input type="checkbox" checked={form.for_system} onChange={(e) => set('for_system', e.target.checked)} /> Show on System Estimates</label>
            <label style={{ cursor: 'pointer' }}><input type="checkbox" checked={form.suppress_top_tier} onChange={(e) => set('suppress_top_tier', e.target.checked)} /> Suppress on top tier</label>
          </div>
          <button className="auth-button" type="submit" disabled={saving} style={{ width: 'auto' }}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Add option'}</button>
        </form>
      )}

      {loading ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : rows.length === 0 ? (
        <p style={{ color: 'var(--mist)' }}>No financing options yet. Add your lenders so customers can apply.</p>
      ) : (
        <table className="data-table">
          <thead><tr><th>Name</th><th>Kind</th><th>Best for</th><th>Link</th><th>Shows on</th><th>Active</th><th></th></tr></thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} style={o.is_active ? undefined : { opacity: 0.55 }}>
                <td style={{ fontWeight: 600 }}>{o.name}{o.suppress_top_tier ? <span style={{ fontSize: 11, color: 'var(--mist)' }}> · not on top tier</span> : null}</td>
                <td>{(KINDS.find((k) => k[0] === o.kind) || [])[1] || o.kind}</td>
                <td style={{ color: 'var(--mist)', fontSize: 13 }}>{o.best_for || '—'}{o.terms_note ? <div style={{ fontSize: 11 }}>{o.terms_note}</div> : null}</td>
                <td>
                  {o.apply_url ? <a href={o.apply_url} target="_blank" rel="noreferrer">apply ↗</a> : <span style={{ color: '#B0600A', fontSize: 12 }}>no link yet</span>}
                  {o.dashboard_url ? <div style={{ fontSize: 11 }}><a href={o.dashboard_url} target="_blank" rel="noreferrer">dashboard ↗</a></div> : null}
                </td>
                <td style={{ fontSize: 12, color: 'var(--mist)' }}>{[o.for_service && 'Service', o.for_system && 'System'].filter(Boolean).join(' + ') || '—'}{o.max_amount ? ` · ≤ $${o.max_amount}` : ''}{o.min_amount ? ` · ≥ $${o.min_amount}` : ''}</td>
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
