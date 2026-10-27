import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { loadGuidedCatalog, Plan, calcAdders, quoteLines, warrantyLines, writeSystemToEstimate, money } from './estimatePlan'

// Guided New System Estimate — the online Estimate App's flow, inside Journey (office and field
// app). Built to be walked through WITH the homeowner on a phone or tablet: big buttons, brand
// logos, real prices from the Res Systems Pricebook. "Choose This System" writes the system onto
// this System Estimate and opens it for approval, signature and deposit as usual.

const C = { bg: '#CAEEFB', blue: '#00B0F0', navy: '#163E64', white: '#FFFFFF', gray: '#D9D9D9', orange: '#C55A11', gold: '#f59e0b', green: '#16a34a' }
const SH = '3px 3px 8px rgba(0,0,0,0.16)'

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
      {options.map(([id, label, sub], i) => (
        <div key={id}>
          <Btn primary={i % 2 === 0} onClick={() => onPick(id)} style={current === id ? { outline: `3px solid ${C.navy}` } : null}>{label}</Btn>
          {sub && <div style={{ textAlign: 'center', fontSize: 12.5, color: C.navy, fontWeight: 600, marginTop: 4 }}>{sub}</div>}
        </div>
      ))}
    </div>
  )
}
function BrandTile({ name, logo, fav, bestValue, selected, onClick, hero }) {
  const [broken, setBroken] = useState(false)
  const h = hero ? 78 : 58
  return (
    <button type="button" onClick={onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, background: 'transparent', border: 'none', padding: 0, cursor: onClick ? 'pointer' : 'default', justifyContent: hero ? 'center' : 'flex-start', fontFamily: 'inherit' }}>
      <span style={{ flex: hero ? '0 0 80%' : '0 0 62%', height: h, boxSizing: 'border-box', background: C.white, border: `3px solid ${fav ? C.blue : C.orange}`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: SH, padding: '6px 12px' }}>
        {logo && !broken
          ? <img src={logo} alt={name} onError={() => setBroken(true)} style={{ maxWidth: '100%', maxHeight: h - 18, objectFit: 'contain' }} />
          : <span style={{ fontWeight: 900, fontSize: hero ? 22 : 18, color: C.navy, textTransform: 'uppercase', letterSpacing: 0.5 }}>{name}</span>}
      </span>
      {onClick && <span aria-hidden style={{ width: 26, height: 26, borderRadius: 6, border: `2px solid ${C.navy}`, background: selected ? C.blue : C.white, color: C.white, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{selected ? '✓' : ''}</span>}
      {bestValue && !hero && <span style={{ background: '#1F5C7A', color: C.white, fontWeight: 800, fontSize: 12, padding: '6px 12px', borderRadius: '4px 14px 4px 14px', whiteSpace: 'nowrap' }}>Best Value</span>}
    </button>
  )
}
const Legend = () => <div style={{ background: '#0F2D44', color: C.white, fontWeight: 800, fontSize: 13, textAlign: 'center', padding: '8px 10px', margin: '10px 0 12px' }}>BLUE BORDER = OUR FAVORITES</div>
const Note = ({ children }) => <div style={{ background: '#fefce8', border: `1.5px solid ${C.gold}`, borderRadius: 12, padding: '10px 14px', margin: '10px 0', fontSize: 12.5, color: '#854d0e', fontWeight: 700, lineHeight: 1.45 }}>{children}</div>
const ROOFTOP = 'Rooftop installs may add $800–$2,000 for crane/rigging. The exact amount is confirmed with you for approval before delivery.'

const HOME = [['sitebuilt', 'Site-Built Single-Family'], ['plex', 'Duplex, Triplex or Quad'], ['mobile', 'Mobile Home'], ['modular', 'Modular Home'], ['apt', 'Multi-Story Apt or Condo'], ['multistory', 'Multi-Story Single-Family']]
const COOL = [['yes', 'Yes, it cools well'], ['used_to', 'It used to, not anymore'], ['struggled', 'It has always struggled'], ['unsure', "I'm not sure"]]
const SYS = [['electric', 'It is all Electric, part Indoor and part Outdoor', 'This is a Split System Heat Pump'], ['package', 'It is a Package Unit — All Outdoors', 'Common in mobile and manufactured homes'], ['gas', 'It is a Gas Furnace & Air Conditioner System', 'Has both indoor gas furnace and outdoor AC unit']]
function locations(sys) {
  if (sys === 'package') return [['package_ground', 'Package Unit - Ground Level'], ['package_platform', 'Package Unit - Raised Platform'], ['package_rooftop', 'Package Unit - Rooftop']]
  const ah = { attic: 'Attic', ceiling: 'Ceiling', ground: 'Ground Level' }
  const out = []
  for (const a of (sys === 'gas' ? ['ground'] : ['attic', 'ceiling', 'ground'])) for (const c of ['ground', 'rooftop']) out.push([`ah_${a}_cond_${c}`, `Indoor: ${ah[a]}  +  Outdoor: ${c === 'ground' ? 'Ground' : 'Rooftop'}`])
  return out
}

export default function GuidedSystemEstimate({ profile, mobile }) {
  const { estimateId } = useParams()
  const navigate = useNavigate()
  const base = mobile ? '/tech' : ''
  const [est, setEst] = useState(null)
  const [prop, setProp] = useState(null)
  const [cat, setCat] = useState(null)
  const [err, setErr] = useState('')
  const [step, setStep] = useState('home')
  const [hist, setHist] = useState([])
  const [a, setA] = useState({})
  const [sqft, setSqft] = useState('')
  const [tons, setTons] = useState(null)
  const [fam, setFam] = useState(null)
  const [selBrands, setSelBrands] = useState([])
  const [eq, setEq] = useState(null)
  const [saved, setSaved] = useState([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    (async () => {
      const { data: e, error } = await supabase.from('invoices').select('id, org_id, invoice_number, kind, estimate_type, approval_status, property_id, bills_to_customer_id').eq('id', estimateId).single()
      if (error || !e) { setErr('Estimate not found.'); return }
      if (e.kind !== 'estimate' || e.estimate_type !== 'system') { setErr('This is not a system estimate.'); return }
      setEst(e)
      const { data: p } = await supabase.from('properties').select('id, street_address, unit, city, state, customers!properties_customer_id_fkey(display_name)').eq('id', e.property_id).maybeSingle()
      setProp(p || null)
      try { setCat(await loadGuidedCatalog(e.org_id)) } catch (x) { setErr('Could not load the pricebook.') }
    })()
  }, [estimateId])

  const go = (s) => { setHist((h) => [...h, step]); setStep(s); try { window.scrollTo(0, 0) } catch { /* noop */ } }
  const back = () => { if (!hist.length) { navigate(-1); return } setStep(hist[hist.length - 1]); setHist((h) => h.slice(0, -1)) }
  const set = (k, v) => setA((p) => ({ ...p, [k]: v }))

  const adders = useMemo(() => (cat ? calcAdders(a, cat.qualifiers) : { applied: [], total: 0 }), [a, cat])
  const ctx = { sysAnswer: a.systemType, homeKind: a.homeKind }
  const priceOf = (r) => Math.round((r?.installation_price || 0) + adders.total)
  const locked = est && (est.approval_status === 'Approved' || est.approval_status === 'Declined')

  async function choose() {
    if (!eq || busy) return
    setBusy(true); setErr('')
    try {
      await writeSystemToEstimate({ estimate: est, eq, cat, adders: adders.applied, answers: a })
      navigate(`${base}/system-estimate-p/${est.id}`)
    } catch (x) { setErr(x.message || 'Could not save the system.'); setBusy(false) }
  }

  const wrap = (title, body, opts = {}) => (
    <div style={{ background: C.bg, minHeight: mobile ? '100vh' : 'auto', borderRadius: mobile ? 0 : 16, margin: 0, padding: '14px 16px 28px', fontFamily: "'Nunito','Segoe UI',sans-serif" }}>
      <div style={{ maxWidth: 460, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <button type="button" onClick={back} style={{ background: C.white, border: `2px solid ${C.blue}`, color: C.blue, borderRadius: 50, width: 38, height: 38, fontWeight: 900, cursor: 'pointer' }}>←</button>
          <span style={{ fontSize: 11, fontWeight: 900, color: C.blue, letterSpacing: 2, textTransform: 'uppercase' }}>{cat?.orgName || ''}</span>
          <button type="button" onClick={() => navigate(`${base}/system-estimate-p/${estimateId}`)} style={{ background: 'none', border: 'none', color: C.navy, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Build manually</button>
        </div>
        {prop && step === 'home' && <div style={{ textAlign: 'center', fontSize: 12.5, color: C.navy, marginBottom: 6 }}>{est?.invoice_number} · {prop.customers?.display_name} · {prop.street_address}{prop.city ? `, ${prop.city}` : ''}</div>}
        {title && <h1 style={{ textAlign: 'center', fontSize: opts.big ? 24 : 21, fontWeight: 900, color: '#000', margin: '4px 0 12px' }}>{title}</h1>}
        {body}
        {err && <div style={{ color: '#B00020', fontWeight: 700, textAlign: 'center', marginTop: 10 }}>{err}</div>}
      </div>
    </div>
  )

  if (err && !cat) return wrap('', <p style={{ textAlign: 'center' }}>{err}</p>)
  if (!est || !cat) return wrap('', <p style={{ textAlign: 'center', color: C.blue, fontWeight: 700 }}>Loading…</p>)
  if (locked) return wrap('Estimate already decided', <div><p style={{ textAlign: 'center' }}>{est.invoice_number} is {est.approval_status}. Open it to view or change.</p><Btn primary onClick={() => navigate(`${base}/system-estimate-p/${est.id}`)}>Open estimate</Btn></div>)

  // ── Steps ──
  if (step === 'home') return wrap('What Type of Home Do You Have?', <Choices options={HOME} current={a.homeKind} onPick={(v) => { set('homeKind', v); go('cool') }} />)
  if (step === 'cool') return wrap('Has Your Existing AC Been Cooling Adequately?', <Choices options={COOL} onPick={(v) => { set('coolWell', v); go('flood') }} />)
  if (step === 'flood') return wrap('Is Your Home in a Flood Zone?', <Choices options={[['yes', 'Yes, my home is in a flood zone'], ['no', 'No, my home is not in a flood zone'], ['unsure', "I'm not sure"]]} onPick={(v) => { set('floodZone', v); go('age') }} />)
  if (step === 'age') return wrap('How Old Is Your Current System?', <Choices options={[['new', 'Less than 15 years old'], ['old', 'More than 15 years old'], ['unsure', "I'm not sure"]]} onPick={(v) => { set('systemAge', v); go('hoa') }} />)
  if (step === 'hoa') return wrap('Do You Need HOA or Community Approval?', <Choices options={[['yes', 'Yes'], ['no', 'No'], ['unsure', "I'm not sure"]]} onPick={(v) => { set('hoa', v); go('sys') }} />)
  if (step === 'sys') return wrap("Let's Look at Your Current AC & Heating System", <Choices options={SYS} onPick={(v) => { set('systemType', v); go('loc') }} />)
  if (step === 'loc') return wrap('Where Will Your System Be Installed?', <Choices options={locations(a.systemType)} onPick={(v) => {
    const upstairs = /^ah_(attic|ceiling)/.test(v)
    setA((p) => ({ ...p, installLocation: v, buildingFloor: p.homeKind === 'multistory' && upstairs ? 'second' : null }))
    go('size')
  }} />)

  if (step === 'size') {
    const calc = sqft ? Plan.tonsFromSqft(sqft, a.homeKind, a.coolWell) : null
    const shown = tons ?? calc
    return wrap('How Big Is the Home?', (
      <div style={{ background: C.white, borderRadius: 16, padding: 16, boxShadow: SH, border: `2px solid ${C.blue}` }}>
        <label style={{ fontSize: 12, fontWeight: 800, color: C.navy, letterSpacing: 1 }}>CONDITIONED SQUARE FEET</label>
        <input type="number" inputMode="numeric" value={sqft} onChange={(e) => { setSqft(e.target.value); setTons(null) }} placeholder="e.g. 1600"
          style={{ width: '100%', boxSizing: 'border-box', border: `2px solid ${C.blue}`, borderRadius: 12, padding: '12px 14px', fontSize: 18, fontWeight: 700, margin: '6px 0 14px' }} />
        <div style={{ textAlign: 'center', fontSize: 13, color: C.blue, fontWeight: 700 }}>Recommended size</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, margin: '6px 0 10px' }}>
          <button type="button" onClick={() => setTons(Math.max(1.5, (shown || 2) - 0.5))} style={{ width: 44, height: 44, borderRadius: 50, border: `2px solid ${C.blue}`, background: C.white, color: C.blue, fontSize: 22, fontWeight: 900 }}>−</button>
          <div style={{ fontSize: 32, fontWeight: 900, color: C.navy, minWidth: 110, textAlign: 'center' }}>{shown ? `${shown} Ton` : '—'}</div>
          <button type="button" onClick={() => setTons(Math.min(5, (shown || 1.5) + 0.5))} style={{ width: 44, height: 44, borderRadius: 50, border: `2px solid ${C.blue}`, background: C.white, color: C.blue, fontSize: 22, fontWeight: 900 }}>+</button>
        </div>
        <p style={{ fontSize: 12, color: '#64748b', textAlign: 'center', margin: '0 0 12px' }}>
          {a.homeKind === 'mobile' ? '500' : '650'} sq ft per ton, rounded up{a.coolWell === 'struggled' ? ', plus ½ ton because it has always struggled' : ''}. Adjust if your load calculation says otherwise.
        </p>
        <Btn primary disabled={!shown} onClick={() => { setTons(shown); setFam(null); setSelBrands([]); go('reco') }}>See Recommendations</Btn>
      </div>
    ))
  }

  const T = tons
  if (step === 'reco') {
    const rows = Plan.rows(cat.systems, ctx)
    const by = new Map(); rows.forEach((r) => { const k = r.brandKey + r.system_type; by.set(k, [...(by.get(k) || []), r]) })
    const prices = []; for (const list of by.values()) Plan.sized(list, T).rows.forEach((r) => prices.push(priceOf(r)))
    const label = a.systemType === 'gas' ? 'Gas Furnace System' : a.systemType === 'package' ? 'Package Unit' : 'Electric Heat Pump'
    return wrap('Your System Recommendations', (
      <div>
        <div style={{ background: C.white, borderRadius: 20, padding: 16, boxShadow: SH, border: `2px solid ${C.blue}` }}>
          <div style={{ background: C.navy, color: C.white, borderRadius: 10, padding: '8px 12px', textAlign: 'center', fontWeight: 800, fontSize: 13 }}>Based upon the information you have provided, this is our Recommendation</div>
          <div style={{ textAlign: 'center', padding: '12px 0', borderBottom: `1px solid ${C.gray}`, marginBottom: 10 }}>
            <div style={{ fontSize: 13, color: C.blue, fontWeight: 700 }}>Estimated Install Price Range</div>
            {prices.length ? <div style={{ fontSize: 30, fontWeight: 900, color: C.navy }}>{money(Math.min(...prices))} – {money(Math.max(...prices))}</div>
              : <div style={{ fontSize: 15, fontWeight: 800, color: C.navy, marginTop: 6 }}>No priced systems for this size yet</div>}
            <div style={{ fontSize: 11, color: '#64748b' }}>*Depends upon Brand and SEER Rating</div>
          </div>
          <div style={{ textAlign: 'center', fontSize: 12, color: C.blue, fontWeight: 700 }}>Recommended System</div>
          <div style={{ textAlign: 'center', fontSize: 17, fontWeight: 800, color: C.navy, marginBottom: 6 }}>{T} Ton {label}</div>
          {adders.applied.filter((x) => x.amount).length > 0 && (
            <div style={{ fontSize: 12, color: '#475569', textAlign: 'center' }}>Includes {adders.applied.filter((x) => x.amount).map((x) => `${x.label} (${money(x.amount)})`).join(', ')}</div>
          )}
          {Plan.isRooftop(a.installLocation) && <Note>{ROOFTOP}</Note>}
        </div>
        <div style={{ marginTop: 14 }}><Btn primary disabled={!prices.length} onClick={() => go('fam')}>Choose Brand Family</Btn></div>
      </div>
    ))
  }

  if (step === 'fam') return wrap('Choose Your Brand Family', (
    <div style={{ display: 'grid', gap: 12 }}>
      {Plan.families(a.systemType).map((f, i) => {
        const ok = Plan.brands(cat.systems, { ...ctx, fam: f }, T).length > 0
        return (
          <div key={f} style={{ opacity: ok ? 1 : 0.5 }}>
            <Btn primary={i % 2 === 0} disabled={!ok} onClick={() => { if (f !== fam) setSelBrands([]); setFam(f); go('brands') }}>{Plan.familyLabel(f)}</Btn>
            <div style={{ textAlign: 'center', fontSize: 12.5, color: C.navy, fontWeight: 600, marginTop: 4 }}>{ok ? Plan.familySub(f) : 'Pricing coming soon for this size.'}</div>
          </div>
        )
      })}
    </div>
  ))

  if (step === 'brands') {
    const list = Plan.brands(cat.systems, { ...ctx, fam }, T)
    return wrap(null, (
      <div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Choose a Brand Within This Group</div>
          <div style={{ fontSize: 24, fontWeight: 900 }}>{Plan.familyHeading(fam)}</div>
          <div style={{ fontSize: 14, color: C.navy }}>{Plan.groupSubtitle(a.systemType, fam)}</div>
          <div style={{ fontSize: 13, color: C.blue, fontWeight: 700 }}>Choose as many as you like</div>
        </div>
        {fam === 'trending' && <div style={{ background: C.white, fontWeight: 800, fontSize: 12.5, textAlign: 'center', padding: 10, marginTop: 10 }}>SIDE-DISCHARGE UNITS OFFER HIGHER EFFICIENCY, SAVE ELECTRICITY, AND QUALIFY FOR SOME REBATES</div>}
        <Legend />
        <div style={{ display: 'grid', gap: 12 }}>
          {list.map((b) => <BrandTile key={b.key} name={b.name} logo={cat.logos[b.key]} fav={b.fav} bestValue={b.bestValue} selected={selBrands.includes(b.key)}
            onClick={() => setSelBrands((p) => (p.includes(b.key) ? p.filter((x) => x !== b.key) : [...p, b.key]))} />)}
        </div>
        <div style={{ marginTop: 18 }}><Btn primary disabled={!selBrands.some((k) => list.find((b) => b.key === k))} onClick={() => go('recs')}>Show Selected Brands →</Btn></div>
      </div>
    ))
  }

  if (step === 'recs') {
    const list = Plan.brands(cat.systems, { ...ctx, fam }, T).filter((b) => selBrands.includes(b.key))
    return wrap(null, (
      <div>
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>Selected Recommendations</div>
          <div style={{ fontSize: 19, fontWeight: 900 }}>{Plan.familyHeading(fam)}</div>
        </div>
        {list.some((b) => b.size !== T) && <Note>Where the exact size isn&rsquo;t offered, the next size up is shown — never smaller.</Note>}
        {list.map((b) => (
          <div key={b.key} style={{ marginBottom: 18 }}>
            <div style={{ background: C.white, borderRadius: 14, border: `2px solid ${C.blue}`, padding: 14, boxShadow: SH }}>
              <BrandTile name={b.name} logo={cat.logos[b.key]} fav={b.fav} bestValue={b.bestValue} />
              <div style={{ color: C.blue, fontWeight: 900, fontSize: 20, marginTop: 10 }}>{b.size} Ton {Plan.typeLabel(b.rows[0])}</div>
            </div>
            <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 14, margin: '12px 0 8px' }}>Choose an Efficiency Level to See Full Details</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {Plan.seerLevels(b.rows).map((r, i) => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: '0 0 58%' }}><Btn primary={i % 2 === 0} onClick={() => { setEq(r); go('quote') }} style={{ padding: '10px 12px', fontSize: 14 }}>{r.seer2} SEER2</Btn></div>
                  <div style={{ flex: 1, textAlign: 'right', fontWeight: 900, fontSize: 18 }}>{money(priceOf(r))}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div style={{ display: 'grid', gap: 10 }}>
          {saved.length > 0 && <Btn onClick={() => go('saved')}>Saved Quotes ({saved.length})</Btn>}
          <Btn primary onClick={() => go('fam')}>Choose A Different System</Btn>
        </div>
      </div>
    ))
  }

  if (step === 'quote' && eq) {
    const total = priceOf(eq)
    const isSaved = saved.some((s) => s.id === eq.id)
    return wrap('Your 45-Day Guaranteed Quote', (
      <div>
        <div style={{ background: C.white, borderRadius: 16, padding: 16, boxShadow: SH, border: `2px solid ${C.blue}` }}>
          <BrandTile name={eq.brandName} logo={cat.logos[eq.brandKey]} fav={eq.recommended} hero />
          <div style={{ textAlign: 'center', margin: '14px 0 10px', paddingBottom: 12, borderBottom: `2px solid ${C.gray}` }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: C.navy, lineHeight: 1.15 }}>{eq.size_tons} Ton · {eq.seer2} SEER2</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.blue, marginTop: 4 }}>{Plan.typeLabel(eq)}</div>
          </div>
          {quoteLines(eq, cat).map((l, i) => <div key={i} style={{ display: 'flex', gap: 8, padding: '4px 0', fontSize: 14, color: C.navy, fontWeight: 600 }}><span style={{ color: C.blue, fontWeight: 900 }}>✓</span>{l}</div>)}
          {adders.applied.filter((x) => x.amount).map((x) => <div key={x.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#475569', padding: '2px 0' }}><span>+ {x.label}</span><span>{money(x.amount)}</span></div>)}
          <div style={{ textAlign: 'center', borderTop: `1px solid ${C.gray}`, marginTop: 10, paddingTop: 10 }}>
            <div style={{ fontSize: 32, fontWeight: 900, color: C.navy }}>{money(total)}</div>
            <div style={{ fontSize: 13, color: C.blue, fontWeight: 700 }}>As low as {money(total / 60)}/mo with financing</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>50% deposit due at scheduling: {money(total * 0.5)}</div>
          </div>
          {warrantyLines(eq).map((w) => <div key={w} style={{ background: C.navy, color: C.white, borderRadius: 10, padding: '8px 12px', marginTop: 8, fontWeight: 800, fontSize: 13, textAlign: 'center' }}>🛡️ {w}</div>)}
        </div>
        {Plan.isRooftop(a.installLocation) && <Note>{ROOFTOP}</Note>}
        <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          <Btn primary disabled={busy} onClick={choose}>{busy ? 'Saving…' : 'Choose This System'}</Btn>
          <Btn onClick={() => { if (!isSaved) setSaved((p) => [...p, eq]); go('recs') }}>{isSaved ? 'Saved ✓ — Make Another Choice' : 'Save Quote & Make Another Choice'}</Btn>
          {saved.length > 0 && <Btn onClick={() => go('saved')}>Saved Quotes ({saved.length})</Btn>}
        </div>
        <p style={{ fontSize: 12, color: '#475569', textAlign: 'center', marginTop: 10 }}>Choosing writes this system onto {est.invoice_number} and opens it for approval, signature and deposit.</p>
      </div>
    ))
  }

  if (step === 'saved') return wrap('Saved Quotes', (
    <div style={{ display: 'grid', gap: 12 }}>
      {saved.map((s) => (
        <div key={s.id} onClick={() => { setEq(s); go('quote') }} style={{ background: C.white, border: `2px solid ${C.blue}`, borderRadius: 12, padding: 12, cursor: 'pointer', textAlign: 'center', boxShadow: SH }}>
          <BrandTile name={s.brandName} logo={cat.logos[s.brandKey]} fav={s.recommended} hero />
          <div style={{ color: C.blue, fontWeight: 800, marginTop: 6 }}>{s.size_tons} Ton, {s.seer2} SEER2 · {Plan.typeLabel(s)}</div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>{money(priceOf(s))}</div>
        </div>
      ))}
      <Btn primary onClick={() => go('fam')}>Make Another Choice</Btn>
    </div>
  ))

  return wrap('', <Btn primary onClick={() => { setStep('home'); setHist([]) }}>Start over</Btn>)
}
