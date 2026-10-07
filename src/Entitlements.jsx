import { useState, useEffect, Fragment } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

// Super-admin control panel for the entitlements model.
//  Tab 1 "Plans & Features" — edit tier prices/seats and the MATRIX (which plan-gated
//    feature belongs to which tier). Core features are always-on; add-ons are sold per org.
//  Tab 2 "Subscriber Setup" — put an org on a plan, toggle its add-ons, set overrides
//    (comp/deny), and see the resolved entitlement list the app would load for them.
// Everything here writes straight to the plans / features / plan_features / org_* tables
// (RLS restricts writes to super_admin), so it's the click-driven version of the SQL.

const KIND_LABEL = { core: 'Always on (Core)', plan: 'Plan-gated', addon: 'Add-on (sold per org)' }
const pfKey = (planId, featId) => `${planId}:${featId}`

export default function Entitlements({ profile }) {
  const isSuper = profile?.role === 'super_admin'
  const [tab, setTab] = useState('catalog')
  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState([])
  const [features, setFeatures] = useState([])
  const [pfSet, setPfSet] = useState(new Set()) // "planId:featureId"
  const [planDraft, setPlanDraft] = useState({})
  const [msg, setMsg] = useState('')

  async function loadCatalog() {
    setLoading(true)
    const [pRes, fRes, pfRes] = await Promise.all([
      supabase.from('plans').select('*').order('rank'),
      supabase.from('features').select('*').order('kind').order('name'),
      supabase.from('plan_features').select('plan_id, feature_id'),
    ])
    setPlans(pRes.data || [])
    setFeatures(fRes.data || [])
    setPfSet(new Set((pfRes.data || []).map((r) => pfKey(r.plan_id, r.feature_id))))
    const d = {}
    for (const p of pRes.data || []) d[p.id] = { ...p }
    setPlanDraft(d)
    setLoading(false)
  }
  useEffect(() => { if (isSuper) loadCatalog() }, [])

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2200) }

  async function togglePlanFeature(planId, featId) {
    const k = pfKey(planId, featId)
    const next = new Set(pfSet)
    if (next.has(k)) {
      next.delete(k)
      setPfSet(next)
      await supabase.from('plan_features').delete().eq('plan_id', planId).eq('feature_id', featId)
    } else {
      next.add(k)
      setPfSet(next)
      await supabase.from('plan_features').insert({ plan_id: planId, feature_id: featId })
    }
  }

  async function savePlan(planId) {
    const d = planDraft[planId]
    await supabase.from('plans').update({
      name: d.name, base_price_monthly: numOrNull(d.base_price_monthly),
      base_price_annual: numOrNull(d.base_price_annual), included_seats: intOrNull(d.included_seats),
      price_per_extra_seat: numOrNull(d.price_per_extra_seat), is_active: d.is_active !== false,
    }).eq('id', planId)
    flash('Plan saved')
    loadCatalog()
  }

  async function setFeatureKind(featId, kind) {
    setFeatures((fs) => fs.map((f) => (f.id === featId ? { ...f, kind } : f)))
    await supabase.from('features').update({ kind }).eq('id', featId)
    // Moving a feature out of 'plan' makes its matrix rows meaningless; clean them up.
    if (kind !== 'plan') {
      await supabase.from('plan_features').delete().eq('feature_id', featId)
      setPfSet((s) => { const n = new Set(s); for (const p of plans) n.delete(pfKey(p.id, featId)); return n })
    }
  }

  if (!isSuper) return <div style={{ padding: 24 }}><p style={{ color: 'var(--mist)' }}>This page is for platform administrators.</p></div>

  const byKind = (k) => features.filter((f) => f.kind === k)
  const input = { width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #D5DAE1', fontSize: 13, boxSizing: 'border-box' }

  return (
    <div>
      <h2 className="page-title">Plans &amp; Entitlements</h2>
      <p style={{ color: 'var(--mist)', fontSize: 13.5, marginTop: -8, marginBottom: 16, maxWidth: 720 }}>
        Control what each subscription tier includes, and set up each subscriber. Changes here take effect the next time that user signs in.
      </p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        {[['catalog', 'Plans & Features'], ['subscribers', 'Subscriber Setup']].map(([k, label]) => (
          <button key={k} className={tab === k ? 'auth-button' : 'logout-button'} style={{ width: 'auto', padding: '7px 16px' }} onClick={() => setTab(k)}>{label}</button>
        ))}
        {msg && <span style={{ alignSelf: 'center', marginLeft: 8, color: '#15803D', fontWeight: 700, fontSize: 13 }}>{msg}</span>}
      </div>

      {loading ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : tab === 'catalog' ? (
        <>
          {/* ---------- Plan editor ---------- */}
          <h3 style={{ fontSize: 16, margin: '4px 0 10px' }}>Tiers</h3>
          <div className="jm-scroll" style={{ maxHeight: 'none', marginBottom: 26 }}>
            <table className="data-table" style={{ minWidth: 760 }}>
              <thead><tr>
                <th>Tier</th><th>Price / mo</th><th>Price / yr (per mo)</th><th>Seats incl.</th><th>Extra seat $</th><th>Active</th><th></th>
              </tr></thead>
              <tbody>
                {plans.map((p) => {
                  const d = planDraft[p.id] || {}
                  const set = (field, v) => setPlanDraft((pd) => ({ ...pd, [p.id]: { ...pd[p.id], [field]: v } }))
                  return (
                    <tr key={p.id}>
                      <td><input style={input} value={d.name ?? ''} onChange={(e) => set('name', e.target.value)} /></td>
                      <td><input style={input} type="number" value={d.base_price_monthly ?? ''} onChange={(e) => set('base_price_monthly', e.target.value)} /></td>
                      <td><input style={input} type="number" value={d.base_price_annual ?? ''} onChange={(e) => set('base_price_annual', e.target.value)} /></td>
                      <td><input style={input} type="number" value={d.included_seats ?? ''} onChange={(e) => set('included_seats', e.target.value)} /></td>
                      <td><input style={input} type="number" value={d.price_per_extra_seat ?? ''} onChange={(e) => set('price_per_extra_seat', e.target.value)} /></td>
                      <td style={{ textAlign: 'center' }}><input type="checkbox" checked={d.is_active !== false} onChange={(e) => set('is_active', e.target.checked)} /></td>
                      <td><button className="auth-button" style={{ width: 'auto', padding: '5px 12px' }} onClick={() => savePlan(p.id)}>Save</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ---------- The matrix ---------- */}
          <h3 style={{ fontSize: 16, margin: '4px 0 6px' }}>Feature matrix</h3>
          <p style={{ color: 'var(--mist)', fontSize: 12.5, margin: '0 0 10px' }}>
            Check a box to include a <strong>plan-gated</strong> feature in a tier. <strong>Core</strong> features are always on for everyone; <strong>add-ons</strong> are sold per subscriber on the next tab. Change a feature&rsquo;s type with the dropdown.
          </p>
          <div className="jm-scroll" style={{ maxHeight: 'calc(100vh - 230px)' }}>
            <table className="data-table" style={{ minWidth: 720 }}>
              <thead><tr>
                <th style={{ minWidth: 240 }}>Feature</th>
                <th style={{ minWidth: 140 }}>Type</th>
                {plans.map((p) => <th key={p.id} style={{ textAlign: 'center' }}>{p.name}</th>)}
              </tr></thead>
              <tbody>
                {['core', 'plan', 'addon'].map((kind) => {
                  const rows = byKind(kind)
                  if (rows.length === 0) return null
                  return (
                    <Fragment key={kind}>
                      <tr><td colSpan={2 + plans.length} style={{ background: '#EEF2F6', fontWeight: 800, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.04em', color: '#475569' }}>{KIND_LABEL[kind]}</td></tr>
                      {rows.map((f) => (
                        <tr key={f.id}>
                          <td>{f.name} {f.is_metered && <span style={{ fontSize: 10, fontWeight: 800, color: '#B45309', background: '#FEF3E2', borderRadius: 5, padding: '1px 6px', marginLeft: 4 }}>METERED</span>}<div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{f.key}</div></td>
                          <td>
                            <select value={f.kind} onChange={(e) => setFeatureKind(f.id, e.target.value)} style={{ ...input, width: 130 }}>
                              <option value="core">Core (always on)</option>
                              <option value="plan">Plan-gated</option>
                              <option value="addon">Add-on</option>
                            </select>
                          </td>
                          {plans.map((p) => (
                            <td key={p.id} style={{ textAlign: 'center' }}>
                              {f.kind === 'plan'
                                ? <input type="checkbox" checked={pfSet.has(pfKey(p.id, f.id))} onChange={() => togglePlanFeature(p.id, f.id)} style={{ width: 17, height: 17 }} />
                                : <span style={{ color: '#CBD5E1' }}>{f.kind === 'core' ? '✓ all' : '—'}</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <SubscriberSetup plans={plans} features={features} input={input} flash={flash} profile={profile} />
      )}
    </div>
  )
}

function numOrNull(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : null }
function intOrNull(v) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null }

// ============================================================
// Subscriber Setup tab
// ============================================================
function SubscriberSetup({ plans, features, input, flash, profile }) {
  const [orgs, setOrgs] = useState([])
  const [orgId, setOrgId] = useState('')
  const [sub, setSub] = useState(null)
  const [seats, setSeats] = useState('')
  const [planId, setPlanId] = useState('')
  const [addonSet, setAddonSet] = useState(new Set()) // feature_key enabled
  const [overrides, setOverrides] = useState({}) // feature_key -> {state, reason, expires_at}
  const [ents, setEnts] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
      setOrgs(data || [])
      if (!orgId && data && data.length) setOrgId(data[0].id)
    })
  }, [])

  async function loadOrg(id) {
    if (!id) return
    setLoading(true)
    const [sRes, aRes, oRes, eRes] = await Promise.all([
      supabase.from('org_subscriptions').select('*').eq('org_id', id).maybeSingle(),
      supabase.from('org_addons').select('feature_key, enabled').eq('org_id', id),
      supabase.from('org_feature_overrides').select('feature_key, state, reason, expires_at').eq('org_id', id),
      supabase.rpc('org_entitlements', { p_org_id: id }),
    ])
    setSub(sRes.data || null)
    setPlanId(sRes.data?.plan_id || '')
    setSeats(sRes.data?.seats_purchased ?? '')
    setAddonSet(new Set((aRes.data || []).filter((a) => a.enabled).map((a) => a.feature_key)))
    const om = {}
    for (const o of oRes.data || []) om[o.feature_key] = { state: o.state, reason: o.reason, expires_at: o.expires_at }
    setOverrides(om)
    setEnts(eRes.data || [])
    setLoading(false)
  }
  useEffect(() => { loadOrg(orgId) }, [orgId])

  const refreshEnts = async () => {
    const { data } = await supabase.rpc('org_entitlements', { p_org_id: orgId })
    setEnts(data || [])
  }

  async function saveSub() {
    await supabase.from('org_subscriptions').upsert({
      org_id: orgId, plan_id: planId || null, status: 'active', seats_purchased: intOrNull(seats),
    }, { onConflict: 'org_id' })
    flash('Subscription saved')
    refreshEnts()
  }

  async function toggleAddon(key, enabled) {
    const next = new Set(addonSet)
    if (enabled) {
      next.add(key)
      await supabase.from('org_addons').upsert({ org_id: orgId, feature_key: key, enabled: true, source: 'purchased' }, { onConflict: 'org_id,feature_key' })
    } else {
      next.delete(key)
      await supabase.from('org_addons').delete().eq('org_id', orgId).eq('feature_key', key)
    }
    setAddonSet(next)
    refreshEnts()
  }

  async function setOverride(key, state) {
    const next = { ...overrides }
    if (!state) {
      delete next[key]
      await supabase.from('org_feature_overrides').delete().eq('org_id', orgId).eq('feature_key', key)
    } else {
      next[key] = { ...(next[key] || {}), state }
      await supabase.from('org_feature_overrides').upsert({ org_id: orgId, feature_key: key, state, reason: next[key].reason || null, expires_at: next[key].expires_at || null }, { onConflict: 'org_id,feature_key' })
    }
    setOverrides(next)
    refreshEnts()
  }

  const addons = features.filter((f) => f.kind === 'addon')
  const entSet = new Set(ents)

  return (
    <div>
      <div style={{ maxWidth: 340, marginBottom: 18 }}>
        <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Subscriber</label>
        <OrgPicker orgs={orgs} value={orgId} onChange={setOrgId} />
      </div>

      {loading ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18, alignItems: 'start' }}>
          {/* Plan */}
          <div className="section-card" style={{ padding: 16 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Plan</h3>
            <label style={{ fontSize: 12.5, color: 'var(--mist)' }}>Tier</label>
            <select value={planId} onChange={(e) => setPlanId(e.target.value)} style={{ ...input, marginBottom: 10 }}>
              <option value="">— none —</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name}{p.base_price_monthly != null ? ` ($${p.base_price_monthly}/mo)` : ''}</option>)}
            </select>
            <label style={{ fontSize: 12.5, color: 'var(--mist)' }}>Seats purchased</label>
            <input type="number" value={seats} onChange={(e) => setSeats(e.target.value)} style={{ ...input, marginBottom: 12 }} />
            <button className="auth-button" style={{ width: 'auto', padding: '7px 16px' }} onClick={saveSub}>Save plan</button>
          </div>

          {/* Add-ons */}
          <div className="section-card" style={{ padding: 16 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Add-ons</h3>
            {addons.length === 0 && <p style={{ color: 'var(--mist)', fontSize: 13 }}>No add-on features defined.</p>}
            {addons.map((f) => (
              <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 13.5, cursor: 'pointer' }}>
                <input type="checkbox" checked={addonSet.has(f.key)} onChange={(e) => toggleAddon(f.key, e.target.checked)} style={{ width: 16, height: 16 }} />
                {f.name}{f.is_metered && <span style={{ fontSize: 10, fontWeight: 800, color: '#B45309' }}>· metered</span>}
              </label>
            ))}
          </div>

          {/* Resolved entitlements */}
          <div className="section-card" style={{ padding: 16 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>What the app will load ({ents.length})</h3>
            <p style={{ color: 'var(--mist)', fontSize: 12, margin: '0 0 8px' }}>The resolved feature list this subscriber gets (core + plan + add-ons − denies).</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {ents.map((k) => <span key={k} style={{ fontSize: 11, fontFamily: 'monospace', background: '#EEF5FF', color: '#0f2d52', borderRadius: 5, padding: '2px 7px' }}>{k}</span>)}
            </div>
          </div>
        </div>
      )}

      {/* Overrides */}
      {!loading && (
        <div style={{ marginTop: 20 }}>
          <h3 style={{ fontSize: 15, margin: '0 0 6px' }}>Overrides &nbsp;<span style={{ fontWeight: 400, fontSize: 12.5, color: 'var(--mist)' }}>— comp a feature on, or force it off, for this subscriber only</span></h3>
          <div className="jm-scroll" style={{ maxHeight: 360 }}>
            <table className="data-table" style={{ minWidth: 620 }}>
              <thead><tr><th>Feature</th><th>Type</th><th>In plan now?</th><th>Override</th></tr></thead>
              <tbody>
                {features.map((f) => {
                  const ov = overrides[f.key]?.state || ''
                  return (
                    <tr key={f.id}>
                      <td>{f.name}<div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{f.key}</div></td>
                      <td style={{ color: '#64748B', fontSize: 12.5 }}>{KIND_LABEL[f.kind]}</td>
                      <td style={{ textAlign: 'center' }}>{entSet.has(f.key) ? <span style={{ color: '#15803D', fontWeight: 700 }}>✓ yes</span> : <span style={{ color: '#CBD5E1' }}>no</span>}</td>
                      <td>
                        <select value={ov} onChange={(e) => setOverride(f.key, e.target.value)} style={{ ...input, width: 150 }}>
                          <option value="">— none —</option>
                          <option value="grant">Grant (comp on)</option>
                          <option value="deny">Deny (force off)</option>
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
