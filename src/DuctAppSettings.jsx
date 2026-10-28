import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import { DUCT_ROOMS, DUCT_ITEM_SLOTS, ductSettings, ductItem } from './guided/ductQuote'

// Duct Cleaning App settings (organizations.duct_app_settings) — used by the online duct
// cleaning quote (/ducts in the Estimate App) and by Journey's guided duct estimate.
// Prices themselves always come from the Duct Cleaning Pricebook.
const box = { padding: '7px 10px', border: '1px solid var(--line, #D5DAE1)', borderRadius: 8, fontSize: 14, fontFamily: 'inherit' }

export default function DuctAppSettings({ orgId }) {
  const [st, setSt] = useState(null)
  const [items, setItems] = useState([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!orgId) return
    setSt(null); setMsg('')
    Promise.all([
      supabase.from('organizations').select('duct_app_settings').eq('id', orgId).single(),
      supabase.from('duct_pricebook_items').select('id, category, name, price, taxable, is_active, sort_order').eq('org_id', orgId).eq('is_active', true).order('sort_order'),
    ]).then(([{ data: o }, { data: it }]) => { setSt(ductSettings(o?.duct_app_settings)); setItems(it || []) })
  }, [orgId])

  if (!st) return <p style={{ color: 'var(--mist)' }}>Loading…</p>
  const set = (k, v) => { setSt((p) => ({ ...p, [k]: v })); setMsg('') }
  const setVpr = (k, v) => set('vents_per_room', { ...st.vents_per_room, [k]: v })
  const setItem = (k, v) => { const n = { ...st.items }; if (v) n[k] = v; else delete n[k]; set('items', n) }

  async function save() {
    setSaving(true); setMsg('')
    const clean = {
      ...st,
      min_charge: Math.max(0, Number(st.min_charge) || 0),
      guarantee_days: Math.min(90, Math.max(1, parseInt(st.guarantee_days, 10) || 14)),
      job_hours: Math.max(0.5, Number(st.job_hours) || 3),
      start_time: /^\d{1,2}:\d{2}$/.test(String(st.start_time || '')) ? st.start_time : '09:00',
      vents_per_room: Object.fromEntries(Object.entries(st.vents_per_room).map(([k, v]) => [k, Math.max(0, parseInt(v, 10) || 0)])),
    }
    const { error } = await supabase.from('organizations').update({ duct_app_settings: clean }).eq('id', orgId)
    setSaving(false)
    if (error) setMsg(error.message); else { setSt(clean); setMsg('Saved ✓') }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="section-card" style={{ padding: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 14.5 }}>Supply vents per room</div>
        <div style={{ fontSize: 12, color: 'var(--mist)', marginBottom: 10 }}>The customer counts rooms; this turns rooms into supply vents.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
          {DUCT_ROOMS.map(([k, label]) => (
            <label key={k} style={{ fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              {label}
              <input type="number" min="0" style={{ ...box, width: 60 }} value={st.vents_per_room[k] ?? 0} onChange={(e) => setVpr(k, e.target.value)} />
            </label>
          ))}
        </div>
      </div>

      <div className="section-card" style={{ padding: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 14.5 }}>Which pricebook item each answer uses</div>
        <div style={{ fontSize: 12, color: 'var(--mist)', marginBottom: 10 }}>
          “Automatic” picks the item by its usual name. Sanitizing is always priced from the “Sanitize Ducts First System / Add&rsquo;l System Up to … Sq Ft” items,
          with the home&rsquo;s square feet split evenly when there are two systems.
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {DUCT_ITEM_SLOTS.map(([k, label]) => {
            const auto = ductItem(items, { items: {} }, k)
            return (
              <label key={k} style={{ fontSize: 13.5, fontWeight: 600, display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) minmax(220px, 1.3fr)', gap: 10, alignItems: 'center' }}>
                {label}
                <select style={box} value={st.items[k] || ''} onChange={(e) => setItem(k, e.target.value)}>
                  <option value="">Automatic{auto ? ` — ${auto.name} ($${Number(auto.price)})` : ' — none found'}</option>
                  {items.map((i) => <option key={i.id} value={i.id}>{i.category} · {i.name} (${Number(i.price)})</option>)}
                </select>
              </label>
            )
          })}
        </div>
      </div>

      <div className="section-card" style={{ padding: 14, display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ fontSize: 14, fontWeight: 600 }}>Quote guaranteed for{' '}
            <input type="number" min="1" max="90" style={{ ...box, width: 66 }} value={st.guarantee_days} onChange={(e) => set('guarantee_days', e.target.value)} /> days
          </label>
          <label style={{ fontSize: 14, fontWeight: 600 }}>Minimum charge ${' '}
            <input type="number" min="0" step="1" style={{ ...box, width: 86 }} value={st.min_charge} onChange={(e) => set('min_charge', e.target.value)} />
          </label>
          <label style={{ fontSize: 14, fontWeight: 600 }}>Arrival time{' '}
            <input type="time" style={box} value={st.start_time || '09:00'} onChange={(e) => set('start_time', e.target.value)} />
          </label>
          <label style={{ fontSize: 14, fontWeight: 600 }}>Job length{' '}
            <input type="number" min="0.5" step="0.5" style={{ ...box, width: 66 }} value={st.job_hours ?? 3} onChange={(e) => set('job_hours', e.target.value)} /> hours
          </label>
        </div>
        <label style={{ fontSize: 14, fontWeight: 600 }}>Performance warranty line (blank shows “Ask About Our Performance Warranty”)
          <input style={{ ...box, width: '100%', marginTop: 4 }} value={st.warranty_text || ''} placeholder="e.g. 1-Year Performance Warranty" onChange={(e) => set('warranty_text', e.target.value)} />
        </label>
        <label style={{ fontSize: 14, fontWeight: 600 }}>Note under sanitizing
          <textarea rows={2} style={{ ...box, width: '100%', marginTop: 4 }} value={st.sanitize_note || ''} onChange={(e) => set('sanitize_note', e.target.value)} />
        </label>
        <div style={{ fontSize: 12, color: 'var(--mist)' }}>How many online duct cleanings per day, and which days, is set in Settings → Booking Rules → Online duct cleanings.</div>
      </div>
      <div>
        <button className="auth-button" style={{ width: 'auto', padding: '8px 22px', margin: 0 }} disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save duct cleaning settings'}</button>
        {msg && <span style={{ marginLeft: 12, fontSize: 14, color: msg === 'Saved ✓' ? '#1a7f37' : '#B00020' }}>{msg}</span>}
      </div>
    </div>
  )
}
