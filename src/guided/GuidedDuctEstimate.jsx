import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { DUCT_ROOMS, DUCT_AHU, DUCT_LAST, DUCT_TYPES, DUCT_VENTS, offeredServices, buildDuctQuote, ductSettings, supplyCount } from './ductQuote'

// Guided Duct Cleaning Estimate — the online duct cleaning quote (/ducts in the Estimate App),
// inside Journey (office and field app). Same questions, same pricing engine, same pricebook,
// so the price matches what the customer would get online. "Use This Quote" writes the lines
// onto this duct cleaning estimate (EDC-) and opens it for approval, signature and sending.

const C = { bg: '#CAEEFB', blue: '#00B0F0', navy: '#163E64', white: '#FFFFFF', gray: '#D9D9D9', gold: '#f59e0b' }
const SH = '3px 3px 8px rgba(0,0,0,0.16)'
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100
const money = (n) => '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: (Number(n) || 0) % 1 ? 2 : 0, maximumFractionDigits: 2 })
const HOME = [['sitebuilt', 'Site-Built Single-Family'], ['plex', 'Duplex, Triplex or Quad'], ['mobile', 'Mobile Home'], ['modular', 'Modular Home'], ['apt', 'Multi-Story Apt or Condo'], ['multistory', 'Multi-Story Single-Family']]

function Btn({ children, onClick, primary, disabled, style }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{
      width: '100%', padding: '14px 18px', borderRadius: 50, fontWeight: 800, fontSize: 16, cursor: disabled ? 'default' : 'pointer',
      border: `2px solid ${C.blue}`, background: primary ? C.blue : C.white, color: primary ? C.white : C.blue,
      boxShadow: SH, opacity: disabled ? 0.5 : 1, fontFamily: 'inherit', ...style,
    }}>{children}</button>
  )
}
function Choices({ options, onPick, current }) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {options.map(([id, label], i) => (
        <Btn key={id} primary={i % 2 === 0} onClick={() => onPick(id)} style={current === id ? { outline: `3px solid ${C.navy}` } : null}>{label}</Btn>
      ))}
    </div>
  )
}
function Stepper({ value, onChange }) {
  const b = (t, fn, off) => <button type="button" onClick={fn} disabled={off} style={{ width: 34, height: 34, borderRadius: '50%', border: `2px solid ${C.blue}`, background: off ? C.gray : C.white, color: C.blue, fontWeight: 900, fontSize: 18, cursor: off ? 'default' : 'pointer' }}>{t}</button>
  return <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{b('−', () => onChange(Math.max(0, value - 1)), value <= 0)}<span style={{ minWidth: 22, textAlign: 'center', fontWeight: 900, fontSize: 18, color: C.navy }}>{value}</span>{b('+', () => onChange(Math.min(20, value + 1)), value >= 20)}</div>
}

export default function GuidedDuctEstimate({ mobile }) {
  const { estimateId } = useParams()
  const navigate = useNavigate()
  const base = mobile ? '/tech' : ''
  const [est, setEst] = useState(null)
  const [prop, setProp] = useState(null)
  const [cat, setCat] = useState(null)
  const [err, setErr] = useState('')
  const [step, setStep] = useState('home')
  const [hist, setHist] = useState([])
  const [a, setA] = useState({ rooms: Object.fromEntries(DUCT_ROOMS.map(([k]) => [k, 0])), services: ['covers', 'ducts'], sqft: '' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    (async () => {
      const { data: e, error } = await supabase.from('invoices').select('id, org_id, invoice_number, kind, estimate_type, approval_status, property_id, service_line, total_paid').eq('id', estimateId).single()
      if (error || !e) { setErr('Estimate not found.'); return }
      if (e.kind !== 'estimate' || e.service_line !== 'duct_cleaning') { setErr('This is not a duct cleaning estimate.'); return }
      setEst(e)
      const [{ data: p }, { data: o }, { data: items }] = await Promise.all([
        supabase.from('properties').select('id, street_address, city, customers!properties_customer_id_fkey(display_name)').eq('id', e.property_id).maybeSingle(),
        supabase.from('organizations').select('name, sales_tax_rate, duct_app_settings').eq('id', e.org_id).single(),
        supabase.from('duct_pricebook_items').select('id, category, name, price, taxable, sort_order, is_active').eq('org_id', e.org_id).eq('is_active', true).order('sort_order'),
      ])
      setProp(p || null)
      setCat({ orgName: String(o?.name || '').replace(/\s+(LLC|Inc\.?|Corp\.?)$/i, ''), taxRate: Number(o?.sales_tax_rate) || 0, settings: o?.duct_app_settings || {}, items: (items || []).filter((i) => Number(i.price) > 0) })
    })()
  }, [estimateId])

  const go = (s) => { setHist((h) => [...h, step]); setStep(s); try { window.scrollTo(0, 0) } catch { /* noop */ } }
  const back = () => { if (!hist.length) { navigate(-1); return } setStep(hist[hist.length - 1]); setHist((h) => h.slice(0, -1)) }
  const set = (k, v) => setA((p) => ({ ...p, [k]: v }))
  const pick = (k, next) => (v) => { set(k, v); go(next) }
  const answers = { ...a, sqft: Number(String(a.sqft).replace(/\D/g, '')) || 0 }
  const q = useMemo(() => (cat ? buildDuctQuote(answers, cat.items, cat.settings, cat.taxRate, 'en') : null), [cat, a]) // eslint-disable-line react-hooks/exhaustive-deps
  const locked = est && (est.approval_status === 'Approved' || est.approval_status === 'Declined')

  async function useQuote() {
    if (!q || !q.lines.length || busy) return
    setBusy(true); setErr('')
    try {
      // Replace the estimate's pricebook lines (and an old minimum-charge line); custom lines stay.
      const { data: old } = await supabase.from('invoice_line_items').select('id, duct_item_id, description').eq('invoice_id', est.id)
      const del = (old || []).filter((l) => l.duct_item_id || l.description === 'Minimum service charge').map((l) => l.id)
      if (del.length) { const { error } = await supabase.from('invoice_line_items').delete().in('id', del); if (error) throw error }
      const rows = q.lines.map((l, i) => ({
        invoice_id: est.id, org_id: est.org_id, description: l.label, unit_price: l.price, quantity: l.qty, taxable: l.taxable,
        is_custom: !l.item, sort_order: (l.item?.sort_order || 0) * 10 + i, category: l.item?.category || 'Other', duct_item_id: l.item?.id || null,
      }))
      const { error: ie } = await supabase.from('invoice_line_items').insert(rows)
      if (ie) throw ie
      const { data: all } = await supabase.from('invoice_line_items').select('quantity, unit_price, taxable').eq('invoice_id', est.id)
      const sub = r2((all || []).reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unit_price || 0), 0))
      const tax = r2((all || []).filter((l) => l.taxable).reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unit_price || 0), 0) * cat.taxRate / 100)
      const paid = Number(est.total_paid || 0)
      await supabase.from('invoices').update({ subtotal: sub, sales_tax: tax, job_total: r2(sub + tax), amount_due: r2(sub + tax - paid), balance: r2(sub + tax - paid) }).eq('id', est.id)
      navigate(`${base}/estimate-doc/${est.id}`)
    } catch (x) { setErr(x.message || 'Could not save the quote.'); setBusy(false) }
  }

  const wrap = (title, sub, body) => (
    <div style={{ background: C.bg, minHeight: mobile ? '100vh' : 'auto', borderRadius: mobile ? 0 : 16, padding: '14px 16px 28px', fontFamily: "'Nunito','Segoe UI',sans-serif" }}>
      <div style={{ maxWidth: 460, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <button type="button" onClick={back} style={{ background: C.white, border: `2px solid ${C.blue}`, color: C.blue, borderRadius: 50, width: 38, height: 38, fontWeight: 900, cursor: 'pointer' }}>←</button>
          <span style={{ fontSize: 11, fontWeight: 900, color: C.blue, letterSpacing: 2, textTransform: 'uppercase' }}>{cat?.orgName || ''}</span>
          <button type="button" onClick={() => navigate(`${base}/estimate-doc/${estimateId}`)} style={{ background: 'none', border: 'none', color: C.navy, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Build manually</button>
        </div>
        {prop && step === 'home' && <div style={{ textAlign: 'center', fontSize: 12.5, color: C.navy, marginBottom: 6 }}>{est?.invoice_number} · {prop.customers?.display_name} · {prop.street_address}{prop.city ? `, ${prop.city}` : ''}</div>}
        {title && <h1 style={{ textAlign: 'center', fontSize: 21, fontWeight: 900, color: '#000', margin: '4px 0 4px' }}>{title}</h1>}
        {sub && <p style={{ textAlign: 'center', fontSize: 13, color: '#64748b', margin: '0 0 12px' }}>{sub}</p>}
        {body}
        {err && <div style={{ color: '#B00020', fontWeight: 700, textAlign: 'center', marginTop: 10 }}>{err}</div>}
      </div>
    </div>
  )

  if (err && !est) return wrap(null, null, null)
  if (!est || !cat) return wrap('Loading…', null, null)
  if (locked) return wrap('This estimate is already ' + est.approval_status.toLowerCase(), null, <Btn primary onClick={() => navigate(`${base}/estimate-doc/${est.id}`)}>Open the estimate</Btn>)
  if (!cat.items.length) return wrap('The Duct Cleaning Pricebook is empty', 'Add prices in Pricebooks → Duct Cleaning first.', null)

  const st = ductSettings(cat.settings)
  const opt = (list) => list.map(([id, en]) => [id, en])
  switch (step) {
    case 'home': return wrap('What Type of Home Is It?', 'Sets the dryer vent price (single vs. multi-story).', <Choices options={HOME} current={a.homeKind} onPick={pick('homeKind', 'vents')} />)
    case 'vents': return wrap('Where Are the Vents Located?', 'Where are they mostly located?', <Choices options={opt(DUCT_VENTS)} current={a.vents} onPick={pick('vents', 'last')} />)
    case 'last': return wrap('When Were the Ducts Last Cleaned?', 'Info only — tells us how deep a cleaning to plan.', <Choices options={opt(DUCT_LAST)} current={a.lastCleaned} onPick={pick('lastCleaned', 'type')} />)
    case 'type': return wrap('What Type Ducts Are They?', 'Info only — decides the cleaning equipment.', <Choices options={opt(DUCT_TYPES)} current={a.ductType} onPick={pick('ductType', 'rooms')} />)
    case 'rooms': {
      const supply = supplyCount(a.rooms, st)
      return wrap('How Many Rooms of Each Type?', `${supply} supply vent${supply === 1 ? '' : 's'} so far`, (
        <>
          <div style={{ background: C.white, borderRadius: 16, padding: '6px 14px', boxShadow: SH, border: `2px solid ${C.blue}` }}>
            {DUCT_ROOMS.map(([k, label], i) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderTop: i ? `1px solid ${C.gray}` : 'none' }}>
                <span style={{ fontWeight: 800, color: C.navy, fontSize: 15 }}>{label}</span>
                <Stepper value={a.rooms[k] || 0} onChange={(v) => set('rooms', { ...a.rooms, [k]: v })} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, fontSize: 11, fontWeight: 800, color: C.navy, letterSpacing: 1.5, marginBottom: 6 }}>HEATED &amp; COOLED SQUARE FEET (for sanitizing)</div>
          <input value={a.sqft} inputMode="numeric" placeholder="1,800" onChange={(e) => set('sqft', e.target.value.replace(/[^\d,]/g, ''))}
            style={{ width: '100%', border: `2px solid ${C.blue}`, borderRadius: 12, padding: '12px 16px', fontSize: 16, boxSizing: 'border-box', color: C.navy, fontWeight: 700 }} />
          <Btn primary disabled={supply < 1} onClick={() => go('ahu')} style={{ marginTop: 16 }}>Continue</Btn>
        </>
      ))
    }
    case 'ahu': return wrap('Where Is the Air Handler?', 'Hanging from the ceiling or in the attic rules out blower and coil cleaning.', <Choices options={opt(DUCT_AHU)} current={a.ahu} onPick={(v) => { setA((p) => ({ ...p, ahu: v, services: p.services.filter((k) => offeredServices(v).some(([o]) => o === k)) })); go('services') }} />)
    case 'services': {
      const offered = offeredServices(a.ahu)
      const sel = new Set(a.services)
      const toggle = (k) => { if (k === 'covers') return; const n = new Set(sel); n.has(k) ? n.delete(k) : n.add(k); set('services', [...n]) }
      return wrap('Services', 'Tap each one the customer wants.', (
        <div style={{ display: 'grid', gap: 10 }}>
          {offered.map(([k, label]) => {
            const on = sel.has(k) || k === 'covers'
            return (
              <button key={k} type="button" onClick={() => toggle(k)} style={{ display: 'flex', alignItems: 'center', gap: 12, background: on ? C.blue : C.white, color: on ? C.white : C.navy, border: `2px solid ${C.blue}`, borderRadius: 50, padding: '13px 20px', fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: SH, textAlign: 'left', fontFamily: 'inherit' }}>
                <span style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${on ? C.white : C.blue}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{on ? '✓' : ''}</span>{label}
              </button>
            )
          })}
          <Btn primary disabled={!a.services.some((k) => k !== 'covers')} onClick={() => go('quote')} style={{ marginTop: 6 }}>See the Quote</Btn>
        </div>
      ))
    }
    case 'quote': return wrap(`${st.guarantee_days}-Day Guaranteed Quote`, 'Duct Cleaning & Dryer Vent Cleaning', (
      <>
        <div style={{ background: C.white, borderRadius: 16, padding: 16, boxShadow: SH, border: `2px solid ${C.blue}` }}>
          {q.lines.map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', borderTop: i ? `1px solid ${C.gray}` : 'none', fontSize: 14, color: C.navy, fontWeight: 700 }}>
              <span style={{ color: C.blue }}>✓</span><span style={{ flex: 1 }}>{l.label}</span>
              <span style={{ color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>{l.qty > 1 ? `${l.qty} × ${money(l.price)}` : money(l.price)}</span>
            </div>
          ))}
          {q.needsVisit && <div style={{ background: '#fefce8', border: `1.5px solid ${C.gold}`, borderRadius: 10, padding: '8px 12px', marginTop: 8, fontSize: 12.5, color: '#854d0e', fontWeight: 700 }}>Sanitizing isn&rsquo;t priced for this size home (or square feet is missing) — add it as a custom line if needed.</div>}
          <div style={{ textAlign: 'center', borderTop: `2px solid ${C.gray}`, marginTop: 10, paddingTop: 10 }}>
            <div style={{ fontSize: 32, fontWeight: 900, color: C.navy }}>{money(q.total)}</div>
            {q.tax > 0 && <div style={{ fontSize: 12, color: '#64748b' }}>Includes {money(q.tax)} sales tax</div>}
          </div>
        </div>
        <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          <Btn primary disabled={busy || !q.lines.length} onClick={useQuote}>{busy ? 'Saving…' : 'Use This Quote'}</Btn>
          <Btn onClick={() => go('services')}>Edit Services</Btn>
        </div>
        <p style={{ fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 8 }}>Writes these lines onto {est.invoice_number} and opens it for approval and sending. Custom lines already on it stay.</p>
      </>
    ))
    default: return null
  }
}
