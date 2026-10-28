import { useState, useEffect, useRef } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import DuctAppSettings from './DuctAppSettings'

// Setup for the customer-facing online Estimate App (and System Estimates):
//   • "What's included" lists — one per system group. They are the same per-type blocks that
//     System Estimate Setup uses, so a change here shows on both.
//   • Brand logos — shown on the app's brand pages and on each quote.
const GROUPS = [
  { key: 'split', label: 'All Split Systems', sub: 'Electric split, side-discharge, and apartment versions of both', types: ['Split', 'Apt Split', 'Side-Discharge', 'Apt Side-Discharge'] },
  { key: 'package', label: 'Package Units', sub: 'Packaged units (all outdoors)', types: ['Packaged'] },
  { key: 'gas', label: 'Gas Furnace Systems', sub: 'Gas furnace + AC split systems', types: ['Gas'] },
]
const toList = (text) => String(text || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
const box = { padding: '7px 10px', border: '1px solid var(--line, #D5DAE1)', borderRadius: 8, fontSize: 14, fontFamily: 'inherit' }
const smallBtn = { border: '1px solid var(--line, #D5DAE1)', background: '#fff', borderRadius: 6, padding: '4px 9px', fontSize: 13, cursor: 'pointer', lineHeight: 1.2 }

function ListEditor({ items, onChange }) {
  const [draft, setDraft] = useState('')
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= items.length) return; const n = [...items]; [n[i], n[j]] = [n[j], n[i]]; onChange(n) }
  const add = () => { const v = draft.trim(); if (!v) return; onChange([...items, v]); setDraft('') }
  return (
    <div>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
          <span style={{ color: '#176E7A', fontWeight: 800, width: 14 }}>✓</span>
          <input style={{ ...box, flex: 1 }} value={it} onChange={(e) => { const n = [...items]; n[i] = e.target.value; onChange(n) }} />
          <button type="button" style={smallBtn} title="Move up" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
          <button type="button" style={smallBtn} title="Move down" onClick={() => move(i, 1)} disabled={i === items.length - 1}>↓</button>
          <button type="button" style={{ ...smallBtn, color: '#B00020' }} title="Remove" onClick={() => onChange(items.filter((_, k) => k !== i))}>✕</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <span style={{ width: 14 }} />
        <input style={{ ...box, flex: 1 }} value={draft} placeholder="Add an item, e.g. Concrete Pad" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} />
        <button type="button" className="auth-button" style={{ width: 'auto', margin: 0, padding: '6px 14px' }} onClick={add}>+ Add</button>
      </div>
    </div>
  )
}

// Site-condition price adders (flood zone, HOA, lineset, install location…). The online app
// and the guided estimate both add these to the system price when the answers call for them.
function AddersEditor({ orgId }) {
  const [rows, setRows] = useState([])
  const [savingId, setSavingId] = useState(null)
  const [savedId, setSavedId] = useState(null)
  async function load() {
    const { data } = await supabase.from('equipment_qualifiers').select('id, qualifier_key, qualifier_label, price_adder, active').eq('org_id', orgId).order('qualifier_label')
    setRows((data || []).map((r) => ({ ...r, price_adder: r.price_adder ?? 0 })))
  }
  useEffect(() => { if (orgId) load() }, [orgId])
  async function save(r) {
    setSavingId(r.id)
    await supabase.from('equipment_qualifiers').update({ qualifier_label: r.qualifier_label, price_adder: Number(r.price_adder) || 0, active: !!r.active }).eq('id', r.id)
    setSavingId(null); setSavedId(r.id); setTimeout(() => setSavedId((x) => (x === r.id ? null : x)), 1500)
  }
  const setRow = (id, k, v) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [k]: v } : r)))
  if (!rows.length) return <p style={{ fontSize: 13, color: 'var(--mist)' }}>No price adders set up for this organization.</p>
  return (
    <table className="data-table" style={{ width: '100%', maxWidth: 720 }}>
      <thead><tr><th>Adder</th><th style={{ width: 110 }}>Price</th><th style={{ width: 70 }}>On</th><th style={{ width: 80 }} /></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td><input style={{ ...box, width: '100%' }} value={r.qualifier_label || ''} onChange={(e) => setRow(r.id, 'qualifier_label', e.target.value)} /></td>
            <td><input type="number" step="1" min="0" style={{ ...box, width: 90 }} value={r.price_adder} onChange={(e) => setRow(r.id, 'price_adder', e.target.value)} /></td>
            <td style={{ textAlign: 'center' }}><input type="checkbox" checked={!!r.active} onChange={(e) => setRow(r.id, 'active', e.target.checked)} /></td>
            <td><button type="button" style={smallBtn} disabled={savingId === r.id} onClick={() => save(r)}>{savingId === r.id ? '…' : savedId === r.id ? 'Saved ✓' : 'Save'}</button></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function LogoRow({ brand, url, orgId, onSaved }) {
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function upload(file) {
    if (!file) return
    setErr('')
    if (!/^image\//.test(file.type)) { setErr('Choose an image file (PNG, JPG, SVG or WebP).'); return }
    if (file.size > 2 * 1024 * 1024) { setErr('Please use an image under 2 MB.'); return }
    setBusy(true)
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '')
    const slug = brand.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const path = `${orgId}/${slug}-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('brand-logos').upload(path, file, { contentType: file.type, upsert: true })
    if (upErr) { setBusy(false); setErr(upErr.message); return }
    const { data: pub } = supabase.storage.from('brand-logos').getPublicUrl(path)
    const { error } = await supabase.from('brand_logos').upsert({ org_id: orgId, brand_key: brand, logo_url: pub.publicUrl, updated_at: new Date().toISOString() }, { onConflict: 'org_id,brand_key' })
    setBusy(false)
    if (error) setErr(error.message); else onSaved()
  }
  async function remove() {
    if (!window.confirm(`Remove the ${brand} logo? The app will show the brand name instead.`)) return
    await supabase.from('brand_logos').delete().eq('org_id', orgId).eq('brand_key', brand)
    onSaved()
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #EEF1F6' }}>
      <div style={{ width: 170, fontWeight: 700, fontSize: 13.5 }}>{brand}</div>
      <div style={{ width: 170, height: 52, border: '1px solid var(--line, #D5DAE1)', borderRadius: 6, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {url ? <img src={url} alt={brand} style={{ maxWidth: '92%', maxHeight: 42, objectFit: 'contain' }} /> : <span style={{ fontSize: 12, color: 'var(--mist)' }}>No logo — name shows</span>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = '' }} />
      <button type="button" style={smallBtn} disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? 'Uploading…' : url ? 'Replace' : 'Upload logo'}</button>
      {url && <button type="button" style={{ ...smallBtn, color: '#B00020' }} onClick={remove}>Remove</button>}
      {err && <span style={{ color: '#B00020', fontSize: 12.5 }}>{err}</span>}
    </div>
  )
}

export default function EstimateAppSetup({ profile }) {
  const isSuperAdmin = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [lists, setLists] = useState({ split: [], package: [], gas: [] })
  const [byType, setByType] = useState({})
  const [thermo, setThermo] = useState('')
  const [brands, setBrands] = useState([])
  const [logos, setLogos] = useState({})
  const [newBrand, setNewBrand] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        if (!selectedOrg && data && data.length) setSelectedOrg(data[0].id)
      })
    }
  }, [])

  async function loadLogos(orgId) {
    const { data } = await supabase.from('brand_logos').select('brand_key, logo_url').eq('org_id', orgId)
    const m = {}; (data || []).forEach((l) => { m[l.brand_key] = l.logo_url }); setLogos(m)
    return m
  }

  async function load(orgId) {
    if (!orgId) return
    setLoading(true); setMsg('')
    const [{ data: org }, { data: equip }, m] = await Promise.all([
      supabase.from('organizations').select('system_installation_includes, system_installation_includes_by_type, system_thermostat_default').eq('id', orgId).single(),
      supabase.from('equipment').select('outdoor_brand').eq('org_id', orgId).eq('active', true).limit(5000),
      loadLogos(orgId),
    ])
    const bt = org?.system_installation_includes_by_type || {}
    const def = org?.system_installation_includes || ''
    setByType(bt)
    const next = {}
    for (const g of GROUPS) next[g.key] = toList(bt[g.types[0]] ?? def)
    setLists(next)
    setThermo(org?.system_thermostat_default || '')
    const set = new Set((equip || []).map((e) => String(e.outdoor_brand || '').trim().toUpperCase()).filter(Boolean))
    Object.keys(m).forEach((k) => set.add(k))
    setBrands([...set].sort())
    setLoading(false)
  }
  useEffect(() => { load(selectedOrg) }, [selectedOrg])

  async function save() {
    setSaving(true); setMsg('')
    const nextByType = { ...byType }
    for (const g of GROUPS) {
      const text = lists[g.key].map((s) => s.trim()).filter(Boolean).join('\n')
      for (const t of g.types) { if (text) nextByType[t] = text; else delete nextByType[t] }
    }
    const { error } = await supabase.from('organizations').update({
      system_installation_includes_by_type: nextByType,
      system_thermostat_default: thermo.trim() || null,
    }).eq('id', selectedOrg)
    setSaving(false)
    if (error) setMsg(error.message); else { setByType(nextByType); setMsg('Saved ✓') }
  }

  function addBrand() {
    const b = newBrand.trim().toUpperCase()
    if (!b) return
    if (!brands.includes(b)) setBrands([...brands, b].sort())
    setNewBrand('')
  }

  return (
    <div>
      <h2 className="page-title">Estimate App Setup</h2>
      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: -8, marginBottom: 18, maxWidth: 720 }}>
        Controls what customers see in the online estimate app. Prices, brand groups, favorites and Best Value come from the Res Systems Pricebook;
        install dates come from Settings → Booking Rules → Online system installs.
      </p>

      {isSuperAdmin && (
        <div style={{ marginBottom: 18, maxWidth: 420 }}>
          <label style={{ fontSize: 12, color: 'var(--mist)' }}>Organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      {loading ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : (
        <div style={{ maxWidth: 760, display: 'grid', gap: 26 }}>
          <section>
            <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>What&rsquo;s included in the quote</h3>
            <p style={{ color: 'var(--mist)', fontSize: 12.5, marginTop: 0, marginBottom: 10 }}>
              These items list on every 45-day quote, after the lines that come from the chosen system automatically:
              size and SEER2, AHRI #, air handler / coil / furnace model, auxiliary heat, condenser model, the thermostat below,
              and the lineset size (not on package units). These lists are shared with System Estimates.
            </p>
            <div style={{ display: 'grid', gap: 16 }}>
              {GROUPS.map((g) => (
                <div key={g.key} className="section-card" style={{ padding: 14 }}>
                  <div style={{ fontWeight: 800, fontSize: 14.5 }}>{g.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--mist)', marginBottom: 10 }}>{g.sub}</div>
                  <ListEditor items={lists[g.key]} onChange={(items) => { setLists((l) => ({ ...l, [g.key]: items })); setMsg('') }} />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <label style={{ fontSize: 14, fontWeight: 600 }}>Thermostat shown on quotes</label>
              <input style={{ ...box, width: 300 }} value={thermo} placeholder="e.g. Honeywell T6 Pro Thermostat" onChange={(e) => { setThermo(e.target.value); setMsg('') }} />
            </div>
            <div style={{ marginTop: 14 }}>
              <button className="auth-button" style={{ width: 'auto', padding: '8px 22px', margin: 0 }} disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save included lists'}</button>
              {msg && <span style={{ marginLeft: 12, fontSize: 14, color: msg === 'Saved ✓' ? '#1a7f37' : '#B00020' }}>{msg}</span>}
            </div>
          </section>

          <section>
            <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Price adders</h3>
            <p style={{ color: 'var(--mist)', fontSize: 12.5, marginTop: 0, marginBottom: 10 }}>
              Added to the system price when the customer&rsquo;s answers call for them — flood zone, HOA approval, system age (lineset),
              upstairs air handler, and install location. Used by the online app and the guided estimate alike.
            </p>
            <AddersEditor orgId={selectedOrg} />
          </section>

          <section>
            <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Duct Cleaning App</h3>
            <p style={{ color: 'var(--mist)', fontSize: 12.5, marginTop: 0, marginBottom: 10 }}>
              The online duct cleaning quote (the Estimate App at <b>/ducts</b>) and the guided duct estimate in Journey both price from the
              Duct Cleaning Pricebook using these rules. Online bookings land on the calendar as DUCT CLEANING jobs with the invoice filled in.
            </p>
            <DuctAppSettings orgId={selectedOrg} />
          </section>

          <section>
            <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Brand logos</h3>
            <p style={{ color: 'var(--mist)', fontSize: 12.5, marginTop: 0, marginBottom: 10 }}>
              Upload each brand&rsquo;s logo (a wide PNG or SVG on a white or transparent background works best). Logos show on the brand pages
              and at the top of each quote; a brand without a logo shows its name. Logos save as soon as they upload.
            </p>
            {brands.map((b) => <LogoRow key={b} brand={b} url={logos[b]} orgId={selectedOrg} onSaved={() => loadLogos(selectedOrg)} />)}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
              <input style={{ ...box, width: 240 }} value={newBrand} placeholder="Another brand (e.g. MITSUBISHI)" onChange={(e) => setNewBrand(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addBrand() }} />
              <button type="button" style={smallBtn} onClick={addBrand}>+ Add brand</button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
