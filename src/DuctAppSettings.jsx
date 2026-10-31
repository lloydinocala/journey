import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import { DUCT_ROOMS, DUCT_ITEM_SLOTS, ductSettings, ductItem } from './guided/ductQuote'

// Duct Cleaning App settings (organizations.duct_app_settings) — used by the online duct
// cleaning quote (/ducts in the Estimate App) and by Journey's guided duct estimate.
// Prices themselves always come from the Duct Cleaning Pricebook.
// ISO weekdays (1 = Monday … 7 = Sunday), shown Sunday-first like a calendar.
const WEEK = [[7, 'Sun'], [1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat']]
const hm = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null }
const label12 = (t) => { const v = hm(t); if (v == null) return ''; const h = Math.floor(v / 60), m = v % 60; return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}` }

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
      supabase.from('organizations').select('duct_app_settings, booking_rules').eq('id', orgId).single(),
      supabase.from('duct_pricebook_items').select('id, category, name, price, taxable, is_active, sort_order').eq('org_id', orgId).eq('is_active', true).order('sort_order'),
    ]).then(([{ data: o }, { data: it }]) => {
      const s = ductSettings(o?.duct_app_settings)
      // No days saved yet → start from Booking Rules (Mon–Fri or Mon–Sat), which is what customers see today.
      if (!Array.isArray(s.days) || !s.days.length) s.days = o?.booking_rules?.duct_cleaning?.days === 'mon_sat' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5]
      setSt(s); setItems(it || [])
    })
  }, [orgId])

  if (!st) return <p style={{ color: 'var(--mist)' }}>Loading…</p>
  const set = (k, v) => { setSt((p) => ({ ...p, [k]: v })); setMsg('') }
  const setVpr = (k, v) => set('vents_per_room', { ...st.vents_per_room, [k]: v })
  const setItem = (k, v) => { const n = { ...st.items }; if (v) n[k] = v; else delete n[k]; set('items', n) }

  async function save() {
    const am = hm(st.start_time), pm = hm(st.afternoon_time)
    if (am == null || am >= 12 * 60) { setMsg('The morning arrival time has to be before 12:00 PM.'); return }
    if (pm == null || pm < 12 * 60) { setMsg('The early afternoon arrival time has to be 12:00 PM or later.'); return }
    if (!st.days?.length) { setMsg('Pick at least one day of the week.'); return }
    setSaving(true); setMsg('')
    const clean = {
      ...st,
      min_charge: Math.max(0, Number(st.min_charge) || 0),
      guarantee_days: Math.min(90, Math.max(1, parseInt(st.guarantee_days, 10) || 14)),
      job_hours: Math.max(0.5, Number(st.job_hours) || 3),
      start_time: /^\d{1,2}:\d{2}$/.test(String(st.start_time || '')) ? st.start_time : '09:00',
      afternoon_time: /^\d{1,2}:\d{2}$/.test(String(st.afternoon_time || '')) ? st.afternoon_time : '13:00',
      days: [...new Set(st.days.map(Number))].filter((d) => d >= 1 && d <= 7).sort(),
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
      </div>
      <div className="section-card" style={{ padding: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 14.5 }}>Appointment days &amp; arrival times</div>
        <div style={{ fontSize: 12, color: 'var(--mist)', marginBottom: 10 }}>
          What customers see on “Choose Your Service Day” and “What Time Would You Like For Your Appointment?” — and the time the job is booked on your calendar.
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 6 }}>Days you take duct cleanings</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          {WEEK.map(([d, lbl]) => {
            const on = st.days.includes(d)
            return (
              <button key={d} type="button" onClick={() => set('days', on ? st.days.filter((x) => x !== d) : [...st.days, d])}
                style={{ minWidth: 52, padding: '7px 10px', borderRadius: 8, fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
                  border: `1px solid ${on ? '#215F9A' : 'var(--line, #D5DAE1)'}`, background: on ? '#215F9A' : '#fff', color: on ? '#fff' : '#64748B' }}>
                {lbl}
              </button>
            )
          })}
        </div>
        <div style={{ fontSize: 12, color: 'var(--mist)', marginBottom: 14 }}>Holidays and days marked Closed in Business Hours are always skipped.</div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ fontSize: 14, fontWeight: 600 }}>Morning arrival{' '}
            <input type="time" min="05:00" max="11:59" style={box} value={st.start_time || '09:00'} onChange={(e) => set('start_time', e.target.value)} />
          </label>
          <label style={{ fontSize: 14, fontWeight: 600 }}>Early afternoon arrival{' '}
            <input type="time" min="12:00" max="18:00" style={box} value={st.afternoon_time || '13:00'} onChange={(e) => set('afternoon_time', e.target.value)} />
          </label>
        </div>
        <div style={{ marginTop: 10, fontSize: 13, background: '#F4F7FB', borderRadius: 8, padding: '8px 12px' }}>
          Customers will see: <b>Morning — {label12(st.start_time) || '—'}</b> · <b>Early Afternoon — {label12(st.afternoon_time) || '—'}</b>
          {' '}on {WEEK.filter(([d]) => st.days.includes(d)).map(([, l]) => l).join(', ') || 'no days'}.
        </div>
        <div style={{ fontSize: 12, color: 'var(--mist)', marginTop: 8 }}>How many duct cleanings per window, which windows are offered, and how much notice you need are in Settings → Booking Rules → Online duct cleanings.</div>
      </div>
      <div>
        <button className="auth-button" style={{ width: 'auto', padding: '8px 22px', margin: 0 }} disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save duct cleaning settings'}</button>
        {msg && <span style={{ marginLeft: 12, fontSize: 14, color: msg === 'Saved ✓' ? '#1a7f37' : '#B00020' }}>{msg}</span>}
      </div>
    </div>
  )
}
