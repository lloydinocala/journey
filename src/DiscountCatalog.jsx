import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

export default function DiscountCatalog({ profile }) {
  const isSuperAdmin = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [discounts, setDiscounts] = useState([])
  const [loading, setLoading] = useState(true)

  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState('percent')
  const [newValue, setNewValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [editingId, setEditingId] = useState(null)
  const [editLabel, setEditLabel] = useState('')
  const [editType, setEditType] = useState('percent')
  const [editValue, setEditValue] = useState('')

  useEffect(() => {
    if (!isSuperAdmin) return
    supabase
      .from('organizations')
      .select('id, name')
      .order('name')
      .then(({ data }) => setOrgs(data || []))
  }, [isSuperAdmin])

  useEffect(() => {
    if (!selectedOrg) return
    loadDiscounts()
  }, [selectedOrg])

  async function loadDiscounts() {
    setLoading(true)
    const { data } = await supabase
      .from('discount_catalog')
      .select('*')
      .eq('org_id', selectedOrg)
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true })
    setDiscounts(data || [])
    setLoading(false)
  }

  function fmtValue(d) {
    return d.discount_type === 'percent' ? `${Number(d.value)}%` : `$${Number(d.value).toFixed(2)}`
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    const label = newLabel.trim()
    if (!label) {
      setError('Enter a name for the discount.')
      return
    }
    const value = parseFloat(newValue)
    if (isNaN(value) || value < 0) {
      setError('Enter a value of 0 or more.')
      return
    }
    if (newType === 'percent' && value > 100) {
      setError('A percentage cannot exceed 100.')
      return
    }
    setSaving(true)
    const nextSort = discounts.length > 0 ? Math.max(...discounts.map((d) => d.sort_order || 0)) + 1 : 1
    const { error: insErr } = await supabase.from('discount_catalog').insert({
      org_id: selectedOrg,
      label,
      discount_type: newType,
      value,
      sort_order: nextSort,
    })
    setSaving(false)
    if (insErr) {
      setError(insErr.message)
      return
    }
    setNewLabel('')
    setNewValue('')
    setNewType('percent')
    loadDiscounts()
  }

  function startEdit(d) {
    setEditingId(d.id)
    setEditLabel(d.label)
    setEditType(d.discount_type)
    setEditValue(String(d.value))
    setError('')
  }

  async function saveEdit(id) {
    setError('')
    const label = editLabel.trim()
    const value = parseFloat(editValue)
    if (!label) {
      setError('Enter a name for the discount.')
      return
    }
    if (isNaN(value) || value < 0 || (editType === 'percent' && value > 100)) {
      setError('Enter a valid value (0-100 for percent).')
      return
    }
    await supabase
      .from('discount_catalog')
      .update({ label, discount_type: editType, value })
      .eq('id', id)
      .eq('org_id', selectedOrg)
    setEditingId(null)
    loadDiscounts()
  }

  async function toggleActive(d) {
    await supabase
      .from('discount_catalog')
      .update({ is_active: !d.is_active })
      .eq('id', d.id)
      .eq('org_id', selectedOrg)
    loadDiscounts()
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        <h2 className="page-title" style={{ margin: 0 }}>Discount Catalog</h2>
        <span className="badge">{discounts.length} total</span>
      </div>

      <p style={{ fontSize: 13, color: 'var(--mist)', maxWidth: 620, marginTop: 0 }}>
        Discounts your team can apply. Percentage discounts are pre-approved and apply on their own
        (Veteran, Senior, PMA level). Flat-dollar amounts require a field supervisor. Only the single
        highest applicable discount is used on an invoice &mdash; they never stack.
      </p>

      {isSuperAdmin && (
        <div style={{ marginBottom: 16, maxWidth: 360 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>
            Viewing organization
          </label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      <form className="inline-form" onSubmit={handleAdd} style={{ marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="field">
          <label htmlFor="discLabel">Name</label>
          <input
            id="discLabel"
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Veteran, Senior, PMA Gold"
          />
        </div>
        <div className="field">
          <label htmlFor="discType">Type</label>
          <select id="discType" value={newType} onChange={(e) => setNewType(e.target.value)}>
            <option value="percent">Percent</option>
            <option value="flat">Flat dollar</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="discValue">{newType === 'percent' ? 'Percent' : 'Amount'}</label>
          <input
            id="discValue"
            type="number"
            step={newType === 'percent' ? '1' : '0.01'}
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder={newType === 'percent' ? '5' : '50.00'}
          />
        </div>
        <button className="logout-button" type="submit" disabled={saving || !selectedOrg}>
          {saving ? 'Adding\u2026' : 'Add discount'}
        </button>
      </form>

      {error && <p style={{ color: 'var(--danger, #c0392b)', fontSize: 13, marginTop: -8 }}>{error}</p>}

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading\u2026</p>
      ) : discounts.length === 0 ? (
        <p style={{ color: 'var(--mist)' }}>No discounts yet. Add your first one above.</p>
      ) : (
        <table className="data-table" style={{ width: '100%', maxWidth: 720 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Name</th>
              <th style={{ textAlign: 'left' }}>Type</th>
              <th style={{ textAlign: 'right' }}>Value</th>
              <th style={{ textAlign: 'center' }}>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {discounts.map((d) => (
              <tr key={d.id} style={{ opacity: d.is_active ? 1 : 0.5 }}>
                {editingId === d.id ? (
                  <>
                    <td>
                      <input type="text" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
                    </td>
                    <td>
                      <select value={editType} onChange={(e) => setEditType(e.target.value)}>
                        <option value="percent">Percent</option>
                        <option value="flat">Flat dollar</option>
                      </select>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <input
                        type="number"
                        step={editType === 'percent' ? '1' : '0.01'}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        style={{ width: 80 }}
                      />
                    </td>
                    <td style={{ textAlign: 'center' }}>{d.is_active ? 'Yes' : 'No'}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="logout-button" type="button" onClick={() => saveEdit(d.id)}>Save</button>
                      <button className="logout-button" type="button" onClick={() => setEditingId(null)} style={{ marginLeft: 6 }}>Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{d.label}</td>
                    <td>{d.discount_type === 'percent' ? 'Percent' : 'Flat dollar'}</td>
                    <td style={{ textAlign: 'right' }}>{fmtValue(d)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="logout-button"
                        type="button"
                        onClick={() => toggleActive(d)}
                        title={d.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {d.is_active ? 'On' : 'Off'}
                      </button>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="logout-button" type="button" onClick={() => startEdit(d)}>Edit</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
