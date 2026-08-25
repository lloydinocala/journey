import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

// The Special Features catalog: add-ons the estimator attaches to a system estimate
// (air purifiers, surge protectors, UV lights, etc). Each is a repeatable priced line.
export default function SpecialFeatures({ profile }) {
  const isSuperAdmin = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [features, setFeatures] = useState([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [cost, setCost] = useState('')
  const [warranty, setWarranty] = useState('')
  const [err, setErr] = useState('')

  const [editId, setEditId] = useState(null)
  const [editVals, setEditVals] = useState({})

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        if (!selectedOrg && data && data.length) setSelectedOrg(data[0].id)
      })
    }
  }, [])

  async function load(orgId) {
    if (!orgId) return
    setLoading(true)
    const { data } = await supabase.from('special_features').select('*').eq('org_id', orgId).eq('active', !showArchived).order('name')
    setFeatures(data || [])
    setLoading(false)
  }
  useEffect(() => { load(selectedOrg) }, [selectedOrg, showArchived])

  async function addFeature() {
    setErr('')
    if (!name.trim()) { setErr('Name is required.'); return }
    const { error } = await supabase.from('special_features').insert({
      org_id: selectedOrg,
      name: name.trim(),
      description: description.trim() || null,
      price: parseFloat(price) || 0,
      cost: parseFloat(cost) || 0,
      warranty_text: warranty.trim() || null,
    })
    if (error) { setErr(error.message); return }
    setName(''); setDescription(''); setPrice(''); setCost(''); setWarranty('')
    load(selectedOrg)
  }

  function startEdit(f) {
    setEditId(f.id)
    setEditVals({ name: f.name, description: f.description || '', price: String(f.price ?? ''), cost: String(f.cost ?? ''), warranty_text: f.warranty_text || '' })
  }
  async function saveEdit() {
    setErr('')
    const { error } = await supabase.from('special_features').update({
      name: editVals.name.trim(),
      description: editVals.description.trim() || null,
      price: parseFloat(editVals.price) || 0,
      cost: parseFloat(editVals.cost) || 0,
      warranty_text: editVals.warranty_text.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', editId)
    if (error) { setErr(error.message); return }
    setEditId(null); load(selectedOrg)
  }
  async function toggleActive(f) {
    await supabase.from('special_features').update({ active: !f.active }).eq('id', f.id)
    load(selectedOrg)
  }
  async function del(f) {
    if (!window.confirm(`Delete "${f.name}"? This can't be undone.`)) return
    await supabase.from('special_features').delete().eq('id', f.id)
    load(selectedOrg)
  }

  const input = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line, #D5DAE1)', fontSize: 14, boxSizing: 'border-box' }
  const label = { display: 'block', fontSize: 12, color: 'var(--mist)', marginBottom: 3 }

  return (
    <div>
      <h2 className="page-title">Special Features</h2>
      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: -8, marginBottom: 18, maxWidth: 640 }}>
        Add-ons the estimator can attach to a system estimate — air purifiers, surge protectors, UV lights, and so on. Each carries its own price and warranty, and can be added more than once per estimate.
      </p>

      {isSuperAdmin && (
        <div style={{ marginBottom: 16, maxWidth: 420 }}>
          <label style={label}>Organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      <div style={{ maxWidth: 640, border: '1px solid var(--line, #E2E6ED)', borderRadius: 10, padding: 16, marginBottom: 22 }}>
        <h3 style={{ marginTop: 0, fontSize: 15 }}>Add a special feature</h3>
        <div style={{ display: 'grid', gap: 10 }}>
          <div><label style={label}>Name *</label><input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Remy Halo LED Purification System" /></div>
          <div><label style={label}>Description</label><input style={input} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What it is / what it does" /></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label style={label}>Price</label><input style={input} type="number" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
            <div style={{ flex: 1 }}><label style={label}>Our Cost</label><input style={input} type="number" value={cost} onChange={(e) => setCost(e.target.value)} /></div>
          </div>
          <div><label style={label}>Warranty text</label><input style={input} value={warranty} onChange={(e) => setWarranty(e.target.value)} placeholder="e.g. 5 Year Warranty" /></div>
          {err && !editId && <div className="auth-error">{err}</div>}
          <button className="auth-button" style={{ width: 'auto', padding: '8px 20px' }} onClick={addFeature}>Add feature</button>
        </div>
      </div>

      <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived
      </label>

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : (
        <div style={{ display: 'grid', gap: 8, maxWidth: 720 }}>
          {features.map((f) => (
            <div key={f.id} style={{ border: '1px solid var(--line, #E2E6ED)', borderRadius: 8, padding: '12px 14px', background: 'var(--panel)' }}>
              {editId === f.id ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  <input style={input} value={editVals.name} onChange={(e) => setEditVals((v) => ({ ...v, name: e.target.value }))} />
                  <input style={input} value={editVals.description} onChange={(e) => setEditVals((v) => ({ ...v, description: e.target.value }))} placeholder="Description" />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input style={input} type="number" value={editVals.price} onChange={(e) => setEditVals((v) => ({ ...v, price: e.target.value }))} placeholder="Price" />
                    <input style={input} type="number" value={editVals.cost} onChange={(e) => setEditVals((v) => ({ ...v, cost: e.target.value }))} placeholder="Our Cost" />
                  </div>
                  <input style={input} value={editVals.warranty_text} onChange={(e) => setEditVals((v) => ({ ...v, warranty_text: e.target.value }))} placeholder="Warranty text" />
                  {err && <div className="auth-error">{err}</div>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="auth-button" style={{ width: 'auto', padding: '6px 16px' }} onClick={saveEdit}>Save</button>
                    <button className="logout-button" style={{ width: 'auto', padding: '6px 16px' }} onClick={() => setEditId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{f.name}{!f.active && <span style={{ fontSize: 11, color: 'var(--mist)', marginLeft: 8 }}>(archived)</span>}</div>
                    {f.description && <div style={{ fontSize: 13, color: 'var(--mist)' }}>{f.description}</div>}
                    {f.warranty_text && <div style={{ fontSize: 12, color: 'var(--mist)' }}>{f.warranty_text}</div>}
                  </div>
                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 600 }}>${Number(f.price || 0).toFixed(2)}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <button className="logout-button" style={{ width: 'auto', padding: '4px 12px' }} onClick={() => startEdit(f)}>Edit</button>
                      <button className="logout-button" style={{ width: 'auto', padding: '4px 12px' }} onClick={() => toggleActive(f)}>{f.active ? 'Archive' : 'Restore'}</button>
                      <button className="logout-button" style={{ width: 'auto', padding: '4px 12px', color: '#C0392B' }} onClick={() => del(f)}>Delete</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          {features.length === 0 && <p style={{ color: 'var(--mist)' }}>No special features yet.</p>}
        </div>
      )}
    </div>
  )
}
