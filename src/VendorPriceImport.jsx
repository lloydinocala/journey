import { useState, useEffect } from 'react'
import Papa from 'papaparse'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

// Bulk-load a vendor price file (e.g. a distributor catalog export) into the parts
// reference library. Items are consolidated across vendors by manufacturer Model #;
// each vendor row becomes a vendor offering (SKU + price). Everything lands as
// reference (no on-hand) until you actually receive it. Re-runnable: items whose
// Model # already exists are reused, so adding a new vendor's file just attaches
// its offerings to the parts already there.

function norm(s) { return (s || '').toString().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() }
function modelKey(s) { return (s || '').toString().toUpperCase().replace(/[^A-Z0-9]/g, '') }
function overlap(a, b) {
  const ta = new Set(norm(a).split(' ').filter(Boolean)), tb = new Set(norm(b).split(' ').filter(Boolean))
  if (!ta.size || !tb.size) return 0
  let h = 0; for (const t of ta) if (tb.has(t)) h++
  return h / Math.max(ta.size, tb.size)
}
function pickCol(headers, ...names) {
  const low = headers.map((h) => h.toLowerCase().trim())
  for (const n of names) { const i = low.indexOf(n.toLowerCase()); if (i >= 0) return headers[i] }
  return null
}
function priceNum(v) {
  const t = (v ?? '').toString().replace(/[$,]/g, '').trim()
  if (t === '') return null
  const n = parseFloat(t)
  if (isNaN(n) || n <= 0 || n > 50000) return null   // scrub obvious glitches
  return n
}

export default function VendorPriceImport({ profile }) {
  const isSuperAdmin = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const orgId = selectedOrg

  const [existingVendors, setExistingVendors] = useState([])
  const [parsed, setParsed] = useState(null)         // { items, offerings, vendorNames, cols, priced }
  const [vendorMap, setVendorMap] = useState({})     // fileVendorName -> existing vendor id | '__new__'
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isSuperAdmin) supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
      setOrgs(data || []); if (!selectedOrg && data?.length) setSelectedOrg(data[0].id)
    })
  }, [])
  useEffect(() => {
    if (orgId) supabase.from('vendors').select('id, name').eq('org_id', orgId).order('name').then(({ data }) => setExistingVendors(data || []))
  }, [orgId])

  function handleFile(e) {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file || !orgId) return
    setError(''); setSummary(null); setParsed(null); setBusy(true); setProgress('Reading file…')
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        try {
          const headers = res.meta.fields || []
          const cVendor = pickCol(headers, 'Vendor')
          const cCat = pickCol(headers, 'Top Category', 'Category')
          const cSub = pickCol(headers, 'Subcategory')
          const cBrand = pickCol(headers, 'Brand')
          const cDesc = pickCol(headers, 'Description', 'Product', 'Name')
          const cModel = pickCol(headers, 'Model #', 'Model', 'Model Number', 'MPN')
          const cItem = pickCol(headers, 'Item #', 'Item', 'SKU', 'Part #')
          const cPrice = pickCol(headers, 'Price per unit', 'Price', 'Cost', 'Unit Price')
          if (!cVendor || !cDesc || !cItem) throw new Error('File needs at least Vendor, Description, and Item # columns.')

          // Consolidate by identity: manufacturer Model # if present, else vendor+Item #.
          const itemsByIdent = new Map()
          const offerings = []
          const vendorNames = new Set()
          for (const r of res.data) {
            const vName = (r[cVendor] || '').trim(); if (!vName) continue
            vendorNames.add(vName)
            const desc = (r[cDesc] || '').trim()
            const model = cModel ? (r[cModel] || '').trim() : ''
            const item = (r[cItem] || '').trim()
            const mk = modelKey(model)
            const ident = mk.length >= 3 ? 'M:' + mk : 'I:' + norm(vName) + '-' + modelKey(item)
            const price = cPrice ? priceNum(r[cPrice]) : null
            if (!itemsByIdent.has(ident)) {
              itemsByIdent.set(ident, {
                ident, name: desc || item || 'Part',
                model: mk.length >= 3 ? model : null,
                category: cCat ? (r[cCat] || '').trim() || null : null,
              })
            } else {
              // keep the shortest (most generic) description as the name
              const cur = itemsByIdent.get(ident)
              if (desc && desc.length < cur.name.length) cur.name = desc
            }
            offerings.push({ ident, vName, sku: item || null, desc: desc || null, sub: cSub ? (r[cSub] || '').trim() : '', price })
          }
          const items = [...itemsByIdent.values()]
          const priced = offerings.filter((o) => o.price != null).length
          setParsed({ items, offerings, vendorNames: [...vendorNames], priced })

          // Auto-map each file vendor to an existing vendor (fuzzy) or "new".
          const vm = {}
          for (const vn of vendorNames) {
            let best = null, s = 0
            for (const ev of existingVendors) { const o = overlap(vn, ev.name); if (o > s) { s = o; best = ev } }
            vm[vn] = (best && s >= 0.4) ? best.id : '__new__'
          }
          setVendorMap(vm)
          setProgress('')
        } catch (err) { setError(err.message || String(err)) }
        setBusy(false)
      },
      error: (err) => { setError(err.message); setBusy(false) },
    })
  }

  async function runImport() {
    if (!parsed) return
    setBusy(true); setError(''); setSummary(null)
    try {
      // 1) Resolve vendors (create the ones mapped to "new").
      setProgress('Setting up vendors…')
      const nameToVendorId = {}
      for (const vn of parsed.vendorNames) {
        if (vendorMap[vn] && vendorMap[vn] !== '__new__') { nameToVendorId[vn] = vendorMap[vn]; continue }
        const { data, error: e } = await supabase.from('vendors').insert({ org_id: orgId, name: vn, is_active: true }).select('id').single()
        if (e) throw new Error(`Vendor "${vn}": ${e.message}`)
        nameToVendorId[vn] = data.id
      }

      // 2) Existing items by Model # (so re-runs merge instead of duplicating).
      setProgress('Checking existing catalog…')
      const existingByModel = new Map()
      for (let off = 0; ; off += 1000) {
        const { data } = await supabase.from('part_items').select('id, model_number')
          .eq('org_id', orgId).not('model_number', 'is', null).range(off, off + 999)
        for (const r of data || []) existingByModel.set(modelKey(r.model_number), r.id)
        if (!data || data.length < 1000) break
      }

      // 3) Assign an id to every identity (reuse existing model match, else new uuid).
      const identToId = {}
      const toInsert = []
      for (const it of parsed.items) {
        const mk = it.model ? modelKey(it.model) : ''
        const existingId = mk && existingByModel.get(mk)
        if (existingId) { identToId[it.ident] = existingId; continue }
        const id = crypto.randomUUID()
        identToId[it.ident] = id
        toInsert.push({
          id, org_id: orgId, generic_name: it.name.slice(0, 300), model_number: it.model,
          category: it.category, base_unit: 'each', sell_unit: 'each', sell_unit_factor: 1, is_inventory: true,
        })
      }

      // 4) Insert new items in batches.
      let itemsCreated = 0
      for (let i = 0; i < toInsert.length; i += 800) {
        const batch = toInsert.slice(i, i + 800)
        const { error: e } = await supabase.from('part_items').insert(batch)
        if (e) throw new Error(`Items batch ${i}: ${e.message}`)
        itemsCreated += batch.length
        setProgress(`Loading items… ${itemsCreated.toLocaleString()} / ${toInsert.length.toLocaleString()}`)
      }

      // 5) Insert offerings in batches.
      const offRows = parsed.offerings.map((o) => ({
        org_id: orgId, item_id: identToId[o.ident], vendor_id: nameToVendorId[o.vName],
        vendor_sku: o.sku, vendor_description: o.desc, pack_label: o.sub || null,
        pack_base_qty: 1, last_cost_per_pack: o.price, last_cost_per_base_unit: o.price,
        last_seen_at: o.price != null ? new Date().toISOString() : null,
      })).filter((o) => o.item_id && o.vendor_id)
      let offCreated = 0
      for (let i = 0; i < offRows.length; i += 800) {
        const batch = offRows.slice(i, i + 800)
        const { error: e } = await supabase.from('part_vendor_offerings').insert(batch)
        if (e) {
          // fall back to per-row so one bad row doesn't sink the batch (e.g. dup SKU)
          for (const row of batch) { const { error: re } = await supabase.from('part_vendor_offerings').insert(row); if (!re) offCreated++ }
        } else offCreated += batch.length
        setProgress(`Loading vendor prices… ${offCreated.toLocaleString()} / ${offRows.length.toLocaleString()}`)
      }

      setSummary({ itemsCreated, reused: parsed.items.length - toInsert.length, offCreated, vendors: parsed.vendorNames.length })
      setProgress('')
    } catch (err) { setError(err.message || String(err)) }
    setBusy(false)
  }

  const th = { textAlign: 'left', padding: '6px 8px', fontSize: 12, color: '#002060' }
  const td = { padding: '6px 8px', fontSize: 13 }

  return (
    <div>
      <h2 className="page-title">Import Vendor Price File</h2>
      <p style={{ color: 'var(--mist)', fontSize: 14, marginBottom: 16, maxWidth: 760 }}>
        Load a distributor catalog/price export into your parts <b>reference library</b>. Items are consolidated
        across vendors by manufacturer Model #; each row becomes a vendor price. Everything comes in as reference
        (no on-hand) — it appears when you search “All parts,” and moves into your active catalog once you receive it.
        Re-running with another vendor's file just adds their prices to the parts already here. <Link to="/parts-catalog">← Parts Catalog</Link>
      </p>

      {isSuperAdmin && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      {!parsed && (
        <label className="auth-button" style={{ width: 'auto', padding: '10px 22px', cursor: 'pointer', display: 'inline-block' }}>
          {busy ? (progress || 'Reading…') : 'Choose CSV file'}
          <input type="file" accept=".csv,text/csv" onChange={handleFile} disabled={busy || !orgId} style={{ display: 'none' }} />
        </label>
      )}

      {error && <div className="auth-error" style={{ marginTop: 12, maxWidth: 600 }}>{error}</div>}

      {parsed && !summary && (
        <div style={{ maxWidth: 720 }}>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', margin: '4px 0 16px' }}>
            <Stat n={parsed.items.length} label="catalog items" />
            <Stat n={parsed.offerings.length} label="vendor prices" />
            <Stat n={parsed.priced} label="priced" />
            <Stat n={parsed.vendorNames.length} label="vendors" />
          </div>

          <h3 style={{ marginBottom: 6 }}>Map each vendor</h3>
          <p style={{ fontSize: 13, color: 'var(--mist)', marginTop: 0 }}>Point each vendor in the file at one of your vendors, or create it.</p>
          <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 18 }}>
            <thead><tr><th style={th}>In the file</th><th style={th}>Maps to</th></tr></thead>
            <tbody>
              {parsed.vendorNames.map((vn) => (
                <tr key={vn} style={{ borderTop: '1px solid #eee' }}>
                  <td style={td}>{vn}</td>
                  <td style={td}>
                    <select value={vendorMap[vn] || '__new__'} onChange={(e) => setVendorMap((m) => ({ ...m, [vn]: e.target.value }))}>
                      <option value="__new__">➕ Create “{vn}”</option>
                      {existingVendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="auth-button" onClick={runImport} disabled={busy} style={{ width: 'auto', padding: '11px 26px' }}>
              {busy ? 'Importing…' : `Import ${parsed.items.length.toLocaleString()} items`}
            </button>
            <button className="logout-button" onClick={() => { setParsed(null); setProgress('') }} disabled={busy}>Cancel</button>
            {busy && progress && <span style={{ fontSize: 13, color: '#002060' }}>{progress}</span>}
          </div>
          <p style={{ fontSize: 12, color: 'var(--mist)', marginTop: 10 }}>This loads tens of thousands of rows in the background — keep this tab open; it can take a few minutes.</p>
        </div>
      )}

      {summary && (
        <div style={{ marginTop: 18, padding: 18, border: '1px solid #e2e4e8', borderRadius: 10, maxWidth: 520 }}>
          <h3 style={{ marginTop: 0 }}>Import complete 🎉</h3>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <Stat n={summary.itemsCreated} label="new items" color="#1a7f37" />
            {summary.reused > 0 && <Stat n={summary.reused} label="merged (existing)" color="#215F9A" />}
            <Stat n={summary.offCreated} label="vendor prices" color="#002060" />
          </div>
          <p style={{ fontSize: 13, color: 'var(--mist)', marginTop: 12 }}>
            Find them in the Parts Catalog under <b>Show → All parts</b>, or just search. They stay out of your active view until you stock them.
          </p>
          <Link to="/parts-catalog" className="auth-button" style={{ display: 'inline-block', width: 'auto', padding: '9px 18px', marginTop: 4, textDecoration: 'none' }}>Go to Parts Catalog</Link>
        </div>
      )}
    </div>
  )
}

function Stat({ n, label, color = '#002060' }) {
  return (
    <div>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{Number(n).toLocaleString()}</div>
      <div style={{ fontSize: 12, color: 'var(--mist,#777)' }}>{label}</div>
    </div>
  )
}
