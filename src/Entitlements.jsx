import { useState, useEffect, useMemo } from 'react'
import { supabase } from './utils/supabase'

// Journey office only (super admin): every subscriber's custom subscription.
//   Subscribers  — Basic + packages per account: on / trial with end date / comp / house, price,
//                  scheduled end, notes, usage, monthly total.
//   Packages     — the catalog: what each package holds, price, what it requires, usage pricing.
//   Territories  — who holds which counties for the stand-alone Estimate Apps, caps, waitlist.
//   Requests     — what subscribers asked for ("I'm interested", "Keep it", "Suggest a feature").
//   Signals      — what sells, what's used, what's asked for.
// Writes go straight to features / org_addons / plans / app_territories / territory_caps /
// feature_requests; RLS limits writes to super admin.

const money = (n) => (n == null || n === '' || isNaN(n) ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 }))
const box = { padding: '6px 9px', border: '1px solid var(--border, #D5DAE1)', borderRadius: 7, fontSize: 13.5, fontFamily: 'inherit' }
const th = { textAlign: 'left', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--mist)', padding: '6px 8px', borderBottom: '1px solid var(--border, #D5DAE1)' }
const td = { padding: '7px 8px', borderBottom: '1px solid #EEF1F5', fontSize: 13.5, verticalAlign: 'top' }
const day = (d) => (d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '')
const isoDay = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '')
const STATES = [['off', 'Off'], ['purchased', 'On — paid'], ['trial', 'Trial'], ['comp', 'Comp (free)'], ['house', 'House account']]
const FL_COUNTIES = ['Alachua', 'Baker', 'Bay', 'Bradford', 'Brevard', 'Broward', 'Calhoun', 'Charlotte', 'Citrus', 'Clay', 'Collier', 'Columbia', 'DeSoto', 'Dixie', 'Duval', 'Escambia', 'Flagler', 'Franklin', 'Gadsden', 'Gilchrist', 'Glades', 'Gulf', 'Hamilton', 'Hardee', 'Hendry', 'Hernando', 'Highlands', 'Hillsborough', 'Holmes', 'Indian River', 'Jackson', 'Jefferson', 'Lafayette', 'Lake', 'Lee', 'Leon', 'Levy', 'Liberty', 'Madison', 'Manatee', 'Marion', 'Martin', 'Miami-Dade', 'Monroe', 'Nassau', 'Okaloosa', 'Okeechobee', 'Orange', 'Osceola', 'Palm Beach', 'Pasco', 'Pinellas', 'Polk', 'Putnam', 'Santa Rosa', 'Sarasota', 'Seminole', 'St. Johns', 'St. Lucie', 'Sumter', 'Suwannee', 'Taylor', 'Union', 'Volusia', 'Wakulla', 'Walton', 'Washington']

export default function Entitlements({ profile }) {
  const isSuper = profile?.role === 'super_admin'
  const [tab, setTab] = useState('subs')
  const [loading, setLoading] = useState(true)
  const [orgs, setOrgs] = useState([])
  const [features, setFeatures] = useState([])
  const [basicPlan, setBasicPlan] = useState(null)
  const [addons, setAddons] = useState([])
  const [usage, setUsage] = useState([])
  const [requests, setRequests] = useState([])
  const [msg, setMsg] = useState('')

  async function load() {
    setLoading(true)
    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const [o, f, p, a, u, r] = await Promise.all([
      supabase.from('organizations').select('id, name, created_at').order('name'),
      supabase.from('features').select('*').order('sort_order').order('name'),
      supabase.from('plans').select('*').eq('key', 'core').maybeSingle(),
      supabase.from('org_addons').select('*'),
      supabase.from('package_usage').select('org_id, feature_key, opens, actions, day').gte('day', since),
      supabase.from('feature_requests').select('*').order('created_at', { ascending: false }).limit(500),
    ])
    setOrgs(o.data || []); setFeatures(f.data || []); setBasicPlan(p.data || null)
    setAddons(a.data || []); setUsage(u.data || []); setRequests(r.data || [])
    setLoading(false)
  }
  useEffect(() => { if (isSuper) load() }, [isSuper])

  if (!isSuper) return <div className="page"><p>This page is for the Journey office only.</p></div>
  const packages = features.filter((f) => f.kind === 'addon' && f.is_active)
  const basic = features.filter((f) => f.kind === 'core' && f.is_active)
  const tabs = [['subs', 'Subscribers'], ['pkgs', 'Packages'], ['terr', 'Territories'], ['reqs', `Requests${requests.filter((x) => x.status === 'new').length ? ` (${requests.filter((x) => x.status === 'new').length})` : ''}`], ['signals', 'Market signals']]

  return (
    <div className="page" style={{ maxWidth: 1180 }}>
      <h2 className="page-title">Plans &amp; Entitlements</h2>
      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: -8, marginBottom: 14, maxWidth: 820 }}>
        Each subscriber gets Basic plus the packages switched on here. Changes take effect the next time their users sign in or refresh. Turning a package off never deletes data.
      </p>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {tabs.map(([k, l]) => <button key={k} className={tab === k ? 'auth-button' : 'logout-button'} style={{ width: 'auto', padding: '6px 16px', margin: 0 }} onClick={() => { setTab(k); setMsg('') }}>{l}</button>)}
      </div>
      {msg && <div style={{ marginBottom: 12, fontSize: 13.5, color: msg.startsWith('Error') ? '#B00020' : '#1a7f37' }}>{msg}</div>}
      {loading ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : (
        <>
          {tab === 'subs' && <Subscribers orgs={orgs} packages={packages} basic={basic} basicPlan={basicPlan} addons={addons} usage={usage} reload={load} setMsg={setMsg} />}
          {tab === 'pkgs' && <Packages packages={packages} basic={basic} basicPlan={basicPlan} reload={load} setMsg={setMsg} />}
          {tab === 'terr' && <Territories orgs={orgs} packages={packages} addons={addons} setMsg={setMsg} />}
          {tab === 'reqs' && <Requests orgs={orgs} features={features} requests={requests} reload={load} setMsg={setMsg} />}
          {tab === 'signals' && <Signals orgs={orgs} packages={packages} addons={addons} usage={usage} requests={requests} />}
        </>
      )}
    </div>
  )
}

// A package's state for one org: off | purchased | trial | comp | house (+ ended/expired).
function stateOf(row) {
  if (!row || !row.enabled) return 'off'
  return row.trial_ends_at ? 'trial' : row.source || 'purchased'
}
function liveNow(row) {
  if (!row || !row.enabled) return false
  const now = Date.now()
  if (row.trial_ends_at && new Date(row.trial_ends_at).getTime() <= now) return false
  if (row.ends_at && new Date(row.ends_at).getTime() <= now) return false
  return true
}
function monthlyTotal(orgId, packages, addons, basicPlan) {
  if (addons.some((a) => a.org_id === orgId && a.source === 'house' && a.enabled)) return 0 // house accounts aren't billed
  let t = Number(basicPlan?.base_price_monthly) || 0
  for (const p of packages) {
    const r = addons.find((a) => a.org_id === orgId && a.feature_key === p.key)
    if (liveNow(r) && stateOf(r) === 'purchased') t += Number(r.price_override ?? p.addon_price_monthly) || 0
  }
  return t
}

// ── Subscribers ──────────────────────────────────────────────────────────────
function Subscribers({ orgs, packages, basic, basicPlan, addons, usage, reload, setMsg }) {
  const [sel, setSel] = useState(orgs[0]?.id || '')
  const [texts, setTexts] = useState(null)
  const org = orgs.find((o) => o.id === sel)
  useEffect(() => {
    if (!sel) return
    const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0)
    supabase.from('org_messaging_usage').select('channel, segments, billed_cents').eq('org_id', sel).gte('created_at', start.toISOString())
      .then(({ data }) => {
        const sms = (data || []).filter((d) => d.channel === 'sms')
        setTexts({ count: sms.length, segments: sms.reduce((s, d) => s + (d.segments || 1), 0), billed: (data || []).reduce((s, d) => s + Number(d.billed_cents || 0), 0) / 100 })
      }, () => setTexts(null))
  }, [sel])
  const rowFor = (key) => addons.find((a) => a.org_id === sel && a.feature_key === key)
  const liveKeys = new Set(packages.filter((p) => liveNow(rowFor(p.key))).map((p) => p.key))
  const use30 = (key) => usage.filter((u) => u.org_id === sel && u.feature_key === key).reduce((s, u) => s + u.opens + u.actions, 0)
  const cats = [...new Set(packages.map((p) => p.category || 'Other'))]

  async function save(pkg, patch) {
    const cur = rowFor(pkg.key)
    const st = patch.state ?? stateOf(cur)
    // Turning on a package switches on what it requires (as the same kind of grant).
    if (st !== 'off') {
      const missing = (pkg.requires || []).filter((k) => !liveKeys.has(k))
      for (const k of missing) {
        const dep = packages.find((p) => p.key === k)
        if (dep) await upsert(dep, { state: st === 'house' ? 'house' : st === 'trial' ? 'trial' : st === 'comp' ? 'comp' : 'purchased', trial_ends_at: patch.trial_ends_at ?? cur?.trial_ends_at }, true)
      }
    } else {
      const dependents = packages.filter((p) => (p.requires || []).includes(pkg.key) && liveKeys.has(p.key))
      if (dependents.length && !window.confirm(`${dependents.map((d) => d.name).join(', ')} require${dependents.length === 1 ? 's' : ''} ${pkg.name} and will stop working too. Turn ${pkg.name} off?`)) return
    }
    await upsert(pkg, patch)
    await reload()
  }
  async function upsert(pkg, patch, quiet) {
    const cur = rowFor(pkg.key)
    const st = patch.state ?? stateOf(cur)
    const row = {
      org_id: sel, feature_key: pkg.key,
      enabled: st !== 'off',
      source: st === 'off' ? (cur?.source || 'purchased') : st,
      trial_ends_at: st === 'trial' ? (patch.trial_ends_at !== undefined ? patch.trial_ends_at : (cur?.trial_ends_at || new Date(Date.now() + 30 * 86400000).toISOString())) : null,
      ends_at: patch.ends_at !== undefined ? patch.ends_at : (st === 'off' ? null : cur?.ends_at ?? null),
      price_override: patch.price_override !== undefined ? patch.price_override : (cur?.price_override ?? null),
      notes: patch.notes !== undefined ? patch.notes : (cur?.notes ?? null),
      updated_at: new Date().toISOString(),
    }
    if (st === 'trial' && row.source === 'trial') row.source = 'trial'
    const { error } = await supabase.from('org_addons').upsert(row, { onConflict: 'org_id,feature_key' })
    if (error) setMsg('Error: ' + error.message); else if (!quiet) setMsg(`${pkg.name} updated for ${org?.name}.`)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 280px) 1fr', gap: 18, alignItems: 'start' }}>
      <div className="section-card" style={{ padding: 0, overflow: 'hidden' }}>
        {orgs.map((o) => {
          const n = packages.filter((p) => liveNow(addons.find((a) => a.org_id === o.id && a.feature_key === p.key))).length
          return (
            <button key={o.id} onClick={() => setSel(o.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', borderBottom: '1px solid #EEF1F5', background: sel === o.id ? '#E8F6FD' : '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{o.name}</div>
              <div style={{ fontSize: 12, color: 'var(--mist)' }}>{n} package{n === 1 ? '' : 's'} · {money(monthlyTotal(o.id, packages, addons, basicPlan))}/mo</div>
            </button>
          )
        })}
      </div>
      {org && (
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: 18 }}>{org.name}</h3>
            <div style={{ fontSize: 15 }}>Monthly: <b>{money(monthlyTotal(org.id, packages, addons, basicPlan))}</b> <span style={{ fontSize: 12, color: 'var(--mist)' }}>(Basic {money(basicPlan?.base_price_monthly)} + paid packages)</span></div>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--mist)', margin: '4px 0 12px' }}>
            Basic always on: {basic.map((b) => b.name).join(', ')}.
            {texts && <> · Texts this month: <b>{texts.count}</b> ({texts.segments} segments{texts.billed ? `, ${money(texts.billed)} billed` : ''}).</>}
          </div>
          {cats.map((c) => (
            <div key={c} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--mist)', margin: '0 0 6px' }}>{c}</div>
              <div className="section-card" style={{ padding: 0 }}>
                {packages.filter((p) => (p.category || 'Other') === c).map((p) => (
                  <PkgRow key={p.key} pkg={p} row={rowFor(p.key)} live={liveKeys.has(p.key)} uses={use30(p.key)} packages={packages} liveKeys={liveKeys} onSave={(patch) => save(p, patch)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PkgRow({ pkg, row, live, uses, packages, liveKeys, onSave }) {
  const st = stateOf(row)
  const [price, setPrice] = useState(row?.price_override ?? '')
  const [notes, setNotes] = useState(row?.notes ?? '')
  useEffect(() => { setPrice(row?.price_override ?? ''); setNotes(row?.notes ?? '') }, [row?.price_override, row?.notes])
  const needs = (pkg.requires || []).filter((k) => !liveKeys.has(k)).map((k) => packages.find((p) => p.key === k)?.name || k)
  const expired = row?.enabled && !live
  return (
    <div style={{ padding: '10px 12px', borderBottom: '1px solid #EEF1F5', display: 'grid', gridTemplateColumns: 'minmax(180px, 1.4fr) 150px minmax(240px, 2fr)', gap: 12, alignItems: 'start' }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 5, background: live ? '#16a34a' : '#CBD5E1', marginRight: 7 }} />
          {pkg.name}{pkg.territorial && <span title="Sold by territory" style={{ marginLeft: 6, fontSize: 11, color: '#7A4B00', background: '#FFF3D6', borderRadius: 4, padding: '1px 5px' }}>territory</span>}
          {pkg.status === 'planned' && <span style={{ marginLeft: 6, fontSize: 11, color: '#475569', background: '#EEF1F5', borderRadius: 4, padding: '1px 5px' }}>coming</span>}
        </div>
        <div style={{ fontSize: 12, color: 'var(--mist)' }}>{money(pkg.addon_price_monthly)}/mo list · {uses} uses in 30 days</div>
        {needs.length > 0 && st === 'off' && <div style={{ fontSize: 11.5, color: '#7A4B00' }}>Turns on {needs.join(', ')} too</div>}
        {expired && <div style={{ fontSize: 11.5, color: '#B00020' }}>{row.trial_ends_at && new Date(row.trial_ends_at) <= new Date() ? `Trial ended ${day(row.trial_ends_at)}` : `Ended ${day(row.ends_at)}`}</div>}
      </div>
      <select style={box} value={st} onChange={(e) => onSave({ state: e.target.value })}>
        {STATES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: 12.5 }}>
        {st === 'trial' && (
          <label>Trial ends <input type="date" style={box} value={isoDay(row?.trial_ends_at)} onChange={(e) => e.target.value && onSave({ trial_ends_at: new Date(e.target.value + 'T23:59:00').toISOString() })} /></label>
        )}
        {st === 'purchased' && (
          <label>Price <input type="number" min="0" step="1" placeholder={pkg.addon_price_monthly ?? 'list'} style={{ ...box, width: 80 }} value={price} onChange={(e) => setPrice(e.target.value)} onBlur={() => onSave({ price_override: price === '' ? null : Number(price) })} /></label>
        )}
        {st !== 'off' && (
          <label title="Package switches off by itself on this date (e.g. end of the paid period)">Ends <input type="date" style={box} value={isoDay(row?.ends_at)} onChange={(e) => onSave({ ends_at: e.target.value ? new Date(e.target.value + 'T23:59:00').toISOString() : null })} /></label>
        )}
        <input placeholder="Notes" style={{ ...box, flex: 1, minWidth: 120 }} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => (notes || '') !== (row?.notes || '') && onSave({ notes: notes || null })} />
      </div>
    </div>
  )
}

// ── Packages (catalog) ───────────────────────────────────────────────────────
function Packages({ packages, basic, basicPlan, reload, setMsg }) {
  const [basicPrice, setBasicPrice] = useState(basicPlan?.base_price_monthly ?? '')
  async function saveBasic() {
    const { error } = await supabase.from('plans').update({ base_price_monthly: basicPrice === '' ? null : Number(basicPrice) }).eq('key', 'core')
    setMsg(error ? 'Error: ' + error.message : 'Basic price saved.'); reload()
  }
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="section-card" style={{ padding: 14 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>Basic</div>
          <label style={{ fontSize: 13.5 }}>Monthly price $ <input type="number" min="0" style={{ ...box, width: 90 }} value={basicPrice} onChange={(e) => setBasicPrice(e.target.value)} onBlur={saveBasic} /></label>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--mist)', marginTop: 6 }}>Always on for every subscriber: {basic.map((b) => b.name).join(', ')}.</div>
      </div>
      {packages.map((p) => <PackageEditor key={p.key} pkg={p} packages={packages} reload={reload} setMsg={setMsg} />)}
    </div>
  )
}

function PackageEditor({ pkg, packages, reload, setMsg }) {
  const [d, setD] = useState(pkg)
  const [dirty, setDirty] = useState(false)
  useEffect(() => { setD(pkg); setDirty(false) }, [pkg])
  const set = (k, v) => { setD((x) => ({ ...x, [k]: v })); setDirty(true) }
  async function save() {
    const patch = {
      name: d.name, description: d.description, category: d.category,
      addon_price_monthly: d.addon_price_monthly === '' || d.addon_price_monthly == null ? null : Number(d.addon_price_monthly),
      requires: d.requires || [], status: d.status, territorial: !!d.territorial, is_metered: !!d.is_metered,
      usage_unit: d.usage_unit || null,
      included_qty: d.included_qty === '' || d.included_qty == null ? null : Number(d.included_qty),
      overage_price: d.overage_price === '' || d.overage_price == null ? null : Number(d.overage_price),
      sort_order: Number(d.sort_order) || 100,
    }
    const { error } = await supabase.from('features').update(patch).eq('key', pkg.key)
    setMsg(error ? 'Error: ' + error.message : `${d.name} saved.`)
    if (!error) reload()
  }
  return (
    <div className="section-card" style={{ padding: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 120px 110px', gap: 10, alignItems: 'end' }}>
        <label style={{ fontSize: 12 }}>Name<input style={{ ...box, width: '100%', fontWeight: 700 }} value={d.name || ''} onChange={(e) => set('name', e.target.value)} /></label>
        <label style={{ fontSize: 12 }}>Group<input style={{ ...box, width: '100%' }} value={d.category || ''} onChange={(e) => set('category', e.target.value)} /></label>
        <label style={{ fontSize: 12 }}>Price $/mo<input type="number" min="0" style={{ ...box, width: '100%' }} value={d.addon_price_monthly ?? ''} onChange={(e) => set('addon_price_monthly', e.target.value)} /></label>
        <label style={{ fontSize: 12 }}>Status<select style={{ ...box, width: '100%' }} value={d.status || 'live'} onChange={(e) => set('status', e.target.value)}><option value="live">Live</option><option value="planned">Coming</option></select></label>
      </div>
      <label style={{ fontSize: 12, display: 'block', marginTop: 8 }}>What's in it<textarea rows={2} style={{ ...box, width: '100%' }} value={d.description || ''} onChange={(e) => set('description', e.target.value)} /></label>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginTop: 8, fontSize: 12.5 }}>
        <span>Requires:</span>
        {packages.filter((p) => p.key !== pkg.key).map((p) => (
          <label key={p.key} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
            <input type="checkbox" checked={(d.requires || []).includes(p.key)} onChange={(e) => set('requires', e.target.checked ? [...(d.requires || []), p.key] : (d.requires || []).filter((k) => k !== p.key))} />{p.name}
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginTop: 8, fontSize: 12.5 }}>
        <label><input type="checkbox" checked={!!d.territorial} onChange={(e) => set('territorial', e.target.checked)} /> Sold by territory</label>
        <label><input type="checkbox" checked={!!d.is_metered} onChange={(e) => set('is_metered', e.target.checked)} /> Usage-priced</label>
        {d.is_metered && <>
          <label>Unit <input style={{ ...box, width: 120 }} value={d.usage_unit || ''} placeholder="AI actions" onChange={(e) => set('usage_unit', e.target.value)} /></label>
          <label>Included / mo <input type="number" min="0" style={{ ...box, width: 90 }} value={d.included_qty ?? ''} onChange={(e) => set('included_qty', e.target.value)} /></label>
          <label>Overage $ each <input type="number" min="0" step="0.01" style={{ ...box, width: 90 }} value={d.overage_price ?? ''} onChange={(e) => set('overage_price', e.target.value)} /></label>
        </>}
        <label>Order <input type="number" style={{ ...box, width: 64 }} value={d.sort_order ?? 100} onChange={(e) => set('sort_order', e.target.value)} /></label>
        <span style={{ flex: 1 }} />
        <button className="auth-button" style={{ width: 'auto', padding: '6px 18px', margin: 0 }} disabled={!dirty} onClick={save}>Save</button>
      </div>
    </div>
  )
}

// ── Territories ──────────────────────────────────────────────────────────────
function Territories({ orgs, packages, addons, setMsg }) {
  const apps = packages.filter((p) => p.territorial)
  const [app, setApp] = useState(apps[0]?.key || '')
  const [rows, setRows] = useState([])
  const [caps, setCaps] = useState([])
  const [add, setAdd] = useState({ county: '', org_id: '', status: 'held' })
  async function load() {
    if (!app) return
    const [r, c] = await Promise.all([
      supabase.from('app_territories').select('*').eq('app_key', app).order('county'),
      supabase.from('territory_caps').select('*').eq('app_key', app),
    ])
    setRows(r.data || []); setCaps(c.data || [])
  }
  useEffect(() => { load() }, [app]) // eslint-disable-line react-hooks/exhaustive-deps
  const capOf = (county) => caps.find((c) => c.county === county)?.cap ?? 1
  const holders = (county) => rows.filter((r) => r.county === county && r.status === 'held')
  const orgName = (id) => orgs.find((o) => o.id === id)?.name || '—'
  const hasApp = (orgId) => addons.some((a) => a.org_id === orgId && a.feature_key === app && a.enabled)

  async function addRow() {
    if (!add.county) return
    if (add.status === 'held' && holders(add.county).length >= capOf(add.county) && !window.confirm(`${add.county} already has ${holders(add.county).length} holder(s) and a cap of ${capOf(add.county)}. Add anyway?`)) return
    const { error } = await supabase.from('app_territories').insert({ app_key: app, county: add.county, org_id: add.org_id || null, status: add.status, starts_on: add.status === 'held' ? new Date().toISOString().slice(0, 10) : null })
    if (error) { setMsg('Error: ' + error.message); return }
    setAdd({ county: '', org_id: '', status: 'held' }); load()
  }
  async function patch(id, p) { const { error } = await supabase.from('app_territories').update(p).eq('id', id); if (error) setMsg('Error: ' + error.message); load() }
  async function remove(id) { if (!window.confirm('Remove this territory row?')) return; await supabase.from('app_territories').delete().eq('id', id); load() }
  async function setCap(county, cap) { const { error } = await supabase.from('territory_caps').upsert({ app_key: app, state: 'FL', county, cap: Math.max(1, Number(cap) || 1) }); if (error) setMsg('Error: ' + error.message); load() }

  const counties = [...new Set(rows.map((r) => r.county))].sort()
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {apps.map((a) => <button key={a.key} className={app === a.key ? 'auth-button' : 'logout-button'} style={{ width: 'auto', padding: '5px 14px', margin: 0 }} onClick={() => setApp(a.key)}>{a.name}</button>)}
        <span style={{ fontSize: 12.5, color: 'var(--mist)' }}>Florida counties. Default cap is 1 holder per county.</span>
      </div>
      <div className="section-card" style={{ padding: 12, marginBottom: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select style={box} value={add.county} onChange={(e) => setAdd({ ...add, county: e.target.value })}><option value="">County…</option>{FL_COUNTIES.map((c) => <option key={c}>{c}</option>)}</select>
        <select style={box} value={add.org_id} onChange={(e) => setAdd({ ...add, org_id: e.target.value })}><option value="">Subscriber… (blank = reserved)</option>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
        <select style={box} value={add.status} onChange={(e) => setAdd({ ...add, status: e.target.value })}><option value="held">Holds it</option><option value="waitlist">Waitlist</option><option value="reserved">Reserved (not for sale)</option><option value="closed">Closed</option></select>
        <button className="auth-button" style={{ width: 'auto', padding: '6px 16px', margin: 0 }} onClick={addRow} disabled={!add.county}>Add</button>
      </div>
      {!counties.length ? <p style={{ color: 'var(--mist)' }}>No territories yet for this app.</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
          <thead><tr><th style={th}>County</th><th style={th}>Cap</th><th style={th}>Subscriber</th><th style={th}>Status</th><th style={th}>Starts</th><th style={th}>Renews</th><th style={th}>Notes</th><th style={th} /></tr></thead>
          <tbody>
            {counties.flatMap((c) => rows.filter((r) => r.county === c).sort((a, b) => (a.status === 'held' ? -1 : 1) - (b.status === 'held' ? -1 : 1) || String(a.created_at).localeCompare(String(b.created_at))).map((r, i) => (
              <tr key={r.id} style={holders(c).length > capOf(c) && r.status === 'held' ? { background: '#FDECEC' } : null}>
                <td style={td}>{i === 0 ? <b>{c}</b> : ''}</td>
                <td style={td}>{i === 0 ? <input type="number" min="1" style={{ ...box, width: 54 }} defaultValue={capOf(c)} onBlur={(e) => Number(e.target.value) !== capOf(c) && setCap(c, e.target.value)} /> : ''}</td>
                <td style={td}>{r.org_id ? orgName(r.org_id) : <i>Reserved</i>}{r.org_id && r.status === 'held' && !hasApp(r.org_id) && <div style={{ fontSize: 11.5, color: '#B00020' }}>App not switched on for them</div>}</td>
                <td style={td}><select style={box} value={r.status} onChange={(e) => patch(r.id, { status: e.target.value, starts_on: e.target.value === 'held' && !r.starts_on ? new Date().toISOString().slice(0, 10) : r.starts_on })}><option value="held">Holds it</option><option value="waitlist">Waitlist</option><option value="reserved">Reserved</option><option value="closed">Closed</option></select></td>
                <td style={td}><input type="date" style={box} value={r.starts_on || ''} onChange={(e) => patch(r.id, { starts_on: e.target.value || null })} /></td>
                <td style={td}><input type="date" style={box} value={r.renews_on || ''} onChange={(e) => patch(r.id, { renews_on: e.target.value || null })} /></td>
                <td style={td}><input style={{ ...box, width: '100%' }} defaultValue={r.notes || ''} onBlur={(e) => e.target.value !== (r.notes || '') && patch(r.id, { notes: e.target.value || null })} /></td>
                <td style={td}><button className="logout-button" style={{ width: 'auto', padding: '3px 10px', margin: 0, fontSize: 12 }} onClick={() => remove(r.id)}>Remove</button></td>
              </tr>
            )))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Requests ─────────────────────────────────────────────────────────────────
function Requests({ orgs, features, requests, reload, setMsg }) {
  const [filter, setFilter] = useState('open')
  const [names, setNames] = useState({})
  useEffect(() => {
    const ids = [...new Set(requests.map((r) => r.user_id).filter(Boolean))]
    if (!ids.length) return
    supabase.from('users').select('id, full_name, email').in('id', ids).then(({ data }) => {
      const m = {}; (data || []).forEach((u) => { m[u.id] = u.full_name || u.email }); setNames(m)
    })
  }, [requests])
  const SRC = { locked_page: "Interested (locked page)", trial: 'Keep after trial', help: 'Suggestion' }
  const shown = requests.filter((r) => (filter === 'open' ? !['built', 'declined'].includes(r.status) : true))
  async function patch(id, p) { const { error } = await supabase.from('feature_requests').update(p).eq('id', id); setMsg(error ? 'Error: ' + error.message : 'Saved.'); reload() }
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className={filter === 'open' ? 'auth-button' : 'logout-button'} style={{ width: 'auto', padding: '5px 14px', margin: 0 }} onClick={() => setFilter('open')}>Open</button>
        <button className={filter === 'all' ? 'auth-button' : 'logout-button'} style={{ width: 'auto', padding: '5px 14px', margin: 0 }} onClick={() => setFilter('all')}>All</button>
      </div>
      {!shown.length ? <p style={{ color: 'var(--mist)' }}>No requests yet. They arrive from “I&rsquo;m interested” on locked pages, “Keep it” on trial banners, and “Suggest a feature” in Help.</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
          <thead><tr><th style={th}>Date</th><th style={th}>Subscriber</th><th style={th}>Request</th><th style={th}>Kind</th><th style={th}>Status</th><th style={th}>Your notes</th></tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td style={td}>{day(r.created_at)}</td>
                <td style={td}>{orgs.find((o) => o.id === r.org_id)?.name || '—'}<div style={{ fontSize: 11.5, color: 'var(--mist)' }}>{names[r.user_id] || ''}</div></td>
                <td style={td}><b>{r.title}</b>{r.details && <div style={{ fontSize: 12.5, color: '#334155' }}>{r.details}</div>}{r.feature_key && <div style={{ fontSize: 11.5, color: 'var(--mist)' }}>{features.find((f) => f.key === r.feature_key)?.name || r.feature_key}</div>}</td>
                <td style={td}>{SRC[r.source] || r.source}</td>
                <td style={td}><select style={box} value={r.status} onChange={(e) => patch(r.id, { status: e.target.value })}>{['new', 'reviewing', 'planned', 'built', 'declined'].map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}</select></td>
                <td style={td}><input style={{ ...box, width: '100%' }} defaultValue={r.admin_notes || ''} onBlur={(e) => e.target.value !== (r.admin_notes || '') && patch(r.id, { admin_notes: e.target.value || null })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Market signals ───────────────────────────────────────────────────────────
function Signals({ orgs, packages, addons, usage, requests }) {
  const subscribers = orgs.filter((o) => !addons.some((a) => a.org_id === o.id && a.source === 'house'))
  const rows = useMemo(() => packages.map((p) => {
    const rs = addons.filter((a) => a.feature_key === p.key && subscribers.some((o) => o.id === a.org_id))
    const paying = rs.filter((r) => liveNow(r) && stateOf(r) === 'purchased')
    const trials = rs.filter((r) => liveNow(r) && stateOf(r) === 'trial')
    const trialsEnded = rs.filter((r) => r.trial_ends_at && new Date(r.trial_ends_at) <= new Date())
    const liveOrgs = rs.filter(liveNow).map((r) => r.org_id)
    const used = new Set(usage.filter((u) => u.feature_key === p.key && liveOrgs.includes(u.org_id) && (u.opens + u.actions) > 0).map((u) => u.org_id))
    const asks = requests.filter((r) => r.feature_key === p.key).length
    let signal = ''
    if (!rs.length && !asks) signal = 'Never bought or asked for'
    else if (liveOrgs.length && used.size < liveOrgs.length) signal = `${liveOrgs.length - used.size} subscriber(s) have it but aren't using it`
    else if (trialsEnded.length) signal = `${trialsEnded.length} trial(s) not kept`
    else if (asks && !liveOrgs.length) signal = 'Asked for, not yet sold'
    return { p, paying: paying.length, trials: trials.length, trialsEnded: trialsEnded.length, used: used.size, live: liveOrgs.length, asks, signal }
  }), [packages, addons, usage, requests, subscribers])
  const suggestions = requests.filter((r) => r.source === 'help')
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ fontSize: 13, color: 'var(--mist)' }}>{subscribers.length} subscriber accounts (house accounts excluded). Usage covers the last 30 days.</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
        <thead><tr><th style={th}>Package</th><th style={th}>Paying</th><th style={th}>On trial</th><th style={th}>Used (of on)</th><th style={th}>Trials not kept</th><th style={th}>Asked for</th><th style={th}>Signal</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.p.key}>
              <td style={td}><b>{r.p.name}</b></td><td style={td}>{r.paying}</td><td style={td}>{r.trials}</td>
              <td style={td}>{r.live ? `${r.used} of ${r.live}` : '—'}</td><td style={td}>{r.trialsEnded || ''}</td><td style={td}>{r.asks || ''}</td>
              <td style={{ ...td, color: r.signal ? '#7A4B00' : 'var(--mist)' }}>{r.signal}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div>
        <h3 style={{ fontSize: 15, margin: '0 0 6px' }}>Suggested features ({suggestions.length})</h3>
        {!suggestions.length ? <p style={{ color: 'var(--mist)', fontSize: 13 }}>None yet — subscribers suggest features from the Help drawer.</p> : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>{suggestions.slice(0, 30).map((s) => <li key={s.id} style={{ fontSize: 13.5, marginBottom: 3 }}>{s.title} <span style={{ color: 'var(--mist)', fontSize: 12 }}>— {orgs.find((o) => o.id === s.org_id)?.name || ''}, {day(s.created_at)}</span></li>)}</ul>
        )}
      </div>
    </div>
  )
}
