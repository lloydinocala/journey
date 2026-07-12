import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

const emptyForm = {
  name: '',
  visit_count_per_year: '2',
  discount_pct: '',
  monthly_price: '',
  annual_price: '',
  description: '',
  includes_comfort_check: false,
}

export default function MaintenanceAgreementTiers({ profile }) {
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [tiers, setTiers] = useState([])
  const [loadingTiers, setLoadingTiers] = useState(true)
  const [showArchived, setShowArchived] = useState(false)

  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(emptyForm)

  const isSuperAdmin = profile.role === 'super_admin'

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        if (!selectedOrg && data && data.length > 0) setSelectedOrg(data[0].id)
      })
    }
  }, [])

  async function loadTiers(orgId) {
    if (!orgId) return
    setLoadingTiers(true)
    const { data } = await supabase
      .from('maintenance_agreement_tiers')
      .select('id, name, sort_order, visit_count_per_year, discount_pct, monthly_price, annual_price, description, includes_comfort_check, is_active')
      .eq('org_id', orgId)
      .eq('is_active', !showArchived)
      .order('sort_order')
      .order('name')
    setTiers(data || [])
    setLoadingTiers(false)
  }

  useEffect(() => {
    loadTiers(selectedOrg)
  }, [selectedOrg, showArchived])

  function updateForm(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function updateEditForm(field, value) {
    setEditForm((f) => ({ ...f, [field]: value }))
  }

  function resetForm() {
    setForm(emptyForm)
    setFormError('')
  }

  async function handleAddTier(e) {
    e.preventDefault()
    setFormError('')
    if (!form.name.trim()) return
    setSaving(true)
    const { error } = await supabase.from('maintenance_agreement_tiers').insert({
      org_id: selectedOrg,
      name: form.name.trim(),
      sort_order: tiers.length,
      visit_count_per_year: parseInt(form.visit_count_per_year, 10) || 2,
      discount_pct: parseFloat(form.discount_pct) || 0,
      monthly_price: parseFloat(form.monthly_price) || 0,
      annual_price: parseFloat(form.annual_price) || 0,
      description: form.description.trim() || null,
      includes_comfort_check: form.includes_comfort_check,
    })
    setSaving(false)
    if (error) {
      setFormError(error.message)
    } else {
      resetForm()
      loadTiers(selectedOrg)
    }
  }

  function startEdit(t) {
    setEditingId(t.id)
    setEditForm({
      name: t.name,
      visit_count_per_year: String(t.visit_count_per_year),
      discount_pct: String(t.discount_pct),
      monthly_price: String(t.monthly_price),
      annual_price: String(t.annual_price),
      description: t.description || '',
      includes_comfort_check: t.includes_comfort_check,
    })
  }

  async function saveEdit(id) {
    await supabase
      .from('maintenance_agreement_tiers')
      .update({
        name: editForm.name.trim(),
        visit_count_per_year: parseInt(editForm.visit_count_per_year, 10) || 2,
        discount_pct: parseFloat(editForm.discount_pct) || 0,
        monthly_price: parseFloat(editForm.monthly_price) || 0,
        annual_price: parseFloat(editForm.annual_price) || 0,
        description: editForm.description.trim() || null,
        includes_comfort_check: editForm.includes_comfort_check,
      })
      .eq('id', id)
    setEditingId(null)
    loadTiers(selectedOrg)
  }

  async function moveTier(t, direction) {
    const idx = tiers.findIndex((x) => x.id === t.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= tiers.length) return
    const other = tiers[swapIdx]
    await Promise.all([
      supabase.from('maintenance_agreement_tiers').update({ sort_order: other.sort_order }).eq('id', t.id),
      supabase.from('maintenance_agreement_tiers').update({ sort_order: t.sort_order }).eq('id', other.id),
    ])
    loadTiers(selectedOrg)
  }

  async function toggleTierActive(t) {
    const action = t.is_active ? 'archive' : 'reactivate'
    if (!window.confirm(`Are you sure you want to ${action} the "${t.name}" tier? Existing agreements on this tier are not affected.`)) return
    await supabase.from('maintenance_agreement_tiers').update({ is_active: !t.is_active }).eq('id', t.id)
    loadTiers(selectedOrg)
  }

  return (
    <div>
      <h2 className="page-title">Maintenance Agreement Tiers</h2>
      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: -8, marginBottom: 20 }}>
        Define the service plan tiers (e.g. Silver / Gold / Platinum) customers can be enrolled in. Pricing here is a template — each agreement snapshots its own price at signup.
      </p>

      {isSuperAdmin && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      <form className="inline-form" onSubmit={handleAddTier} style={{ marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="field">
          <label htmlFor="tierName">Tier name</label>
          <input id="tierName" type="text" value={form.name} onChange={(e) => updateForm('name', e.target.value)} placeholder="e.g. Gold" required />
        </div>
        <div className="field">
          <label htmlFor="tierVisits">Visits / year</label>
          <input id="tierVisits" type="number" min="1" value={form.visit_count_per_year} onChange={(e) => updateForm('visit_count_per_year', e.target.value)} style={{ width: 80 }} />
        </div>
        <div className="field">
          <label htmlFor="tierDiscount">Discount %</label>
          <input id="tierDiscount" type="number" step="0.1" value={form.discount_pct} onChange={(e) => updateForm('discount_pct', e.target.value)} style={{ width: 80 }} />
        </div>
        <div className="field">
          <label htmlFor="tierMonthly">Monthly price</label>
          <input id="tierMonthly" type="number" step="0.01" value={form.monthly_price} onChange={(e) => updateForm('monthly_price', e.target.value)} style={{ width: 100 }} />
        </div>
        <div className="field">
          <label htmlFor="tierAnnual">Annual price</label>
          <input id="tierAnnual" type="number" step="0.01" value={form.annual_price} onChange={(e) => updateForm('annual_price', e.target.value)} style={{ width: 100 }} />
        </div>
        <div className="field" style={{ minWidth: 240 }}>
          <label htmlFor="tierDesc">What's included</label>
          <input id="tierDesc" type="text" value={form.description} onChange={(e) => updateForm('description', e.target.value)} placeholder="e.g. 2 tune-ups/yr, priority scheduling, waived trip fees" />
        </div>
        <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 0 }}>
          <label style={{ marginBottom: 0, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.includes_comfort_check} onChange={(e) => updateForm('includes_comfort_check', e.target.checked)} style={{ marginRight: 4 }} />
            Includes comfort check
          </label>
        </div>
        <button className="auth-button" type="submit" disabled={saving}>
          {saving ? 'Adding…' : 'Add tier'}
        </button>
        <button type="button" className="logout-button" onClick={resetForm}>Cancel</button>
      </form>

      {formError && <div className="auth-error">{formError}</div>}

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <label className="nav-link" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} style={{ marginRight: 6 }} />
          Show archived
        </label>
      </div>

      {loadingTiers ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : (
        <div className="grid-table" style={{ gridTemplateColumns: '1.2fr 0.9fr 0.8fr 0.9fr 0.9fr 1.8fr 0.9fr 0.8fr 1.6fr' }}>
          <div className="grid-cell grid-head">Tier</div>
          <div className="grid-cell grid-head">Visits/yr</div>
          <div className="grid-cell grid-head">Discount</div>
          <div className="grid-cell grid-head">Monthly</div>
          <div className="grid-cell grid-head">Annual</div>
          <div className="grid-cell grid-head">Included</div>
          <div className="grid-cell grid-head">Comfort chk</div>
          <div className="grid-cell grid-head">Status</div>
          <div className="grid-cell grid-head"></div>

          {tiers.map((t, idx) =>
            editingId === t.id ? (
              <>
                <div className="grid-cell" style={{ background: 'var(--panel)' }}><input type="text" value={editForm.name} onChange={(e) => updateEditForm('name', e.target.value)} /></div>
                <div className="grid-cell" style={{ background: 'var(--panel)' }}><input type="number" min="1" value={editForm.visit_count_per_year} onChange={(e) => updateEditForm('visit_count_per_year', e.target.value)} /></div>
                <div className="grid-cell" style={{ background: 'var(--panel)' }}><input type="number" step="0.1" value={editForm.discount_pct} onChange={(e) => updateEditForm('discount_pct', e.target.value)} /></div>
                <div className="grid-cell" style={{ background: 'var(--panel)' }}><input type="number" step="0.01" value={editForm.monthly_price} onChange={(e) => updateEditForm('monthly_price', e.target.value)} /></div>
                <div className="grid-cell" style={{ background: 'var(--panel)' }}><input type="number" step="0.01" value={editForm.annual_price} onChange={(e) => updateEditForm('annual_price', e.target.value)} /></div>
                <div className="grid-cell" style={{ background: 'var(--panel)' }}><input type="text" value={editForm.description} onChange={(e) => updateEditForm('description', e.target.value)} /></div>
                <div className="grid-cell" style={{ background: 'var(--panel)' }}>
                  <input type="checkbox" checked={editForm.includes_comfort_check} onChange={(e) => updateEditForm('includes_comfort_check', e.target.checked)} />
                </div>
                <div className="grid-cell" style={{ background: 'var(--panel)' }}>{t.is_active ? 'Active' : 'Archived'}</div>
                <div className="grid-cell grid-actions" style={{ background: 'var(--panel)' }}>
                  <button className="auth-button" style={{ width: 'auto', padding: '6px 14px', margin: 0 }} onClick={() => saveEdit(t.id)}>Save</button>
                  <button className="logout-button" onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <div className="grid-cell" style={{ background: 'var(--panel)' }}>{t.name}</div>
                <div className="grid-cell" style={{ background: 'var(--panel)' }}>{t.visit_count_per_year}</div>
                <div className="grid-cell" style={{ background: 'var(--panel)' }}>{t.discount_pct}%</div>
                <div className="grid-cell" style={{ background: 'var(--panel)' }}>${Number(t.monthly_price).toFixed(2)}</div>
                <div className="grid-cell" style={{ background: 'var(--panel)' }}>${Number(t.annual_price).toFixed(2)}</div>
                <div className="grid-cell" style={{ background: 'var(--panel)' }}>{t.description || '—'}</div>
                <div className="grid-cell" style={{ background: 'var(--panel)' }}>{t.includes_comfort_check ? 'Yes' : '—'}</div>
                <div className="grid-cell" style={{ background: 'var(--panel)' }}>
                  <span className={`status-pill ${t.is_active ? 'status-active' : 'status-canceled'}`}>{t.is_active ? 'Active' : 'Archived'}</span>
                </div>
                <div className="grid-cell grid-actions" style={{ background: 'var(--panel)' }}>
                  <button className="logout-button" onClick={() => moveTier(t, 'up')} disabled={idx === 0} title="Move up">↑</button>
                  <button className="logout-button" onClick={() => moveTier(t, 'down')} disabled={idx === tiers.length - 1} title="Move down">↓</button>
                  <button className="logout-button" onClick={() => startEdit(t)}>Edit</button>
                  <button className="logout-button" onClick={() => toggleTierActive(t)}>{t.is_active ? 'Archive' : 'Reactivate'}</button>
                </div>
              </>
            )
          )}
          {tiers.length === 0 && (
            <div className="grid-cell" style={{ gridColumn: '1 / -1', color: 'var(--mist)' }}>No tiers yet. Add your first one above (e.g. Silver, Gold, Platinum).</div>
          )}
        </div>
      )}
    </div>
  )
}
