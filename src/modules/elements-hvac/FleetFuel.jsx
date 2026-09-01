// Elements-HVAC · Fleet · Fuel log
// Manual entry + statement import. Import has two sources that feed ONE shared
// review-and-map step: a CSV export (column-mapped) or a PDF/image statement that
// Quincy reads with AI. Either way you land on the same screen where each card /
// vehicle identifier on the statement is mapped to a truck, so a single statement
// covering the whole fleet splits to the right vehicles.
import { useState, useEffect, useMemo } from 'react'
import Papa from 'papaparse'
import { listVehicles, listFuel, addFuel, importFuel, extractFuelStatement, updateVehicle, computeFuelMetrics, FLAG_COLORS } from './fleetData'
import { useOrgSelector, OrgBar } from './shared'

const blankFill = { fill_date: new Date().toISOString().slice(0, 10), odometer: '', gallons: '', total_cost: '', station: '', card_last4: '', fuel_type: '' }
const CSV_TARGETS = [
  { key: 'fill_date', label: 'Date' },
  { key: 'gallons', label: 'Gallons' },
  { key: 'total_cost', label: 'Total cost' },
  { key: 'odometer', label: 'Odometer' },
  { key: 'station', label: 'Station' },
  { key: 'card_id', label: 'Card # / Vehicle' },
]

function normDate(raw) {
  if (!raw) return null
  const d = new Date(raw)
  if (isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}
const numOrNull = (x) => { if (x == null || x === '') return null; const n = parseFloat(String(x).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? null : n }
const normKey = (s) => (s ?? '').toString().trim().toLowerCase()
const NONE = '__none__'
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] || '')
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

function FlagPills({ flags }) {
  if (!flags?.length) return <span style={{ color: '#16A34A' }}>✓</span>
  return (
    <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
      {flags.map((f, i) => (
        <span key={i} title={f.label} style={{ background: FLAG_COLORS[f.color], color: '#fff', borderRadius: 6, padding: '2px 6px', fontSize: 11, fontWeight: 700 }}>{f.label}</span>
      ))}
    </span>
  )
}

export default function FleetFuel({ profile }) {
  const org = useOrgSelector(profile)
  const [vehicles, setVehicles] = useState([])
  const [vehicleId, setVehicleId] = useState('')
  const [fuel, setFuel] = useState([])
  const [form, setForm] = useState(blankFill)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  // import state
  const [mode, setMode] = useState('csv')            // 'csv' | 'pdf'
  const [csvRows, setCsvRows] = useState([])
  const [csvHeaders, setCsvHeaders] = useState([])
  const [mapping, setMapping] = useState({})
  const [reading, setReading] = useState(false)      // PDF AI read in progress
  const [provider, setProvider] = useState('')
  const [parsedFills, setParsedFills] = useState(null) // review step when non-null
  const [cardMap, setCardMap] = useState({})          // groupKey -> vehicleId
  const [importing, setImporting] = useState(false)

  async function loadVehicles() {
    if (!org.selectedOrg) return
    const v = await listVehicles(org.selectedOrg)
    setVehicles(v)
    if (!vehicleId && v[0]) setVehicleId(v[0].id)
  }
  useEffect(() => { loadVehicles() }, [org.selectedOrg])

  async function loadFuel() {
    if (!org.selectedOrg || !vehicleId) { setFuel([]); return }
    setFuel(await listFuel(org.selectedOrg, vehicleId))
  }
  useEffect(() => { loadFuel() }, [org.selectedOrg, vehicleId])

  const vehicle = vehicles.find((v) => v.id === vehicleId) || null
  const enriched = useMemo(() => computeFuelMetrics(vehicle, fuel), [vehicle, fuel])
  const display = [...enriched].reverse()

  async function handleAdd(e) {
    e.preventDefault()
    if (!vehicleId || !form.gallons) { setMsg('Pick a vehicle and enter gallons.'); return }
    setSaving(true); setMsg('')
    const { error } = await addFuel(org.selectedOrg, {
      vehicle_id: vehicleId,
      fill_date: form.fill_date || new Date().toISOString().slice(0, 10),
      odometer: numOrNull(form.odometer), gallons: numOrNull(form.gallons), total_cost: numOrNull(form.total_cost),
      station: form.station.trim() || null, card_last4: form.card_last4.trim() || null, fuel_type: form.fuel_type.trim() || null,
      created_by: profile.id,
    })
    setSaving(false)
    if (error) { setMsg(error.message); return }
    setForm(blankFill); loadFuel()
  }

  // ---- map helpers: group fills by their card/vehicle identifier ----
  const groupKeyOf = (f) => normKey(f.card_id) || normKey(f.vehicle_label) || NONE
  const groupLabelOf = (f) => (f.card_id || '').trim() || (f.vehicle_label || '').trim() || '(no card/vehicle on statement)'
  function autoVehicleFor(sample) {
    const ck = normKey(sample.card_id), vl = normKey(sample.vehicle_label)
    if (ck) { const m = vehicles.find((v) => normKey(v.fuel_card_id) && normKey(v.fuel_card_id) === ck); if (m) return m.id }
    if (vl) { const m = vehicles.find((v) => normKey(v.name) === vl || (normKey(v.name) && vl.includes(normKey(v.name))) || (normKey(v.name).includes(vl) && vl)); if (m) return m.id }
    return ''
  }
  function enterReview(fills) {
    setParsedFills(fills)
    // seed the card→vehicle map with best-guess auto-matches
    const seed = {}
    for (const f of fills) { const k = groupKeyOf(f); if (!(k in seed)) seed[k] = autoVehicleFor(f) }
    // if there's only one group and one obvious vehicle selected above, prefill it
    if (Object.keys(seed).length === 1 && !Object.values(seed)[0] && vehicleId) seed[Object.keys(seed)[0]] = vehicleId
    setCardMap(seed)
  }

  const groups = useMemo(() => {
    if (!parsedFills) return []
    const by = {}
    for (const f of parsedFills) {
      const k = groupKeyOf(f)
      if (!by[k]) by[k] = { key: k, label: groupLabelOf(f), sampleCardId: (f.card_id || '').trim(), count: 0 }
      by[k].count += 1
    }
    return Object.values(by)
  }, [parsedFills]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- CSV path ----
  function onCsvFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setMsg('')
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        const headers = res.meta.fields || []
        setCsvHeaders(headers); setCsvRows(res.data || [])
        const find = (re) => headers.find((h) => re.test(h))
        setMapping({
          fill_date: find(/date/i), gallons: find(/gal|qty|volume|units/i),
          total_cost: find(/amount|total|cost|\$/i), odometer: find(/odom|mile|odo/i),
          station: find(/station|merchant|site|location|vendor/i), card_id: find(/card|last ?4|unit|vehicle|acct|account/i),
        })
      },
    })
    e.target.value = ''
  }
  function reviewCsv() {
    const fills = csvRows.map((r) => ({
      fill_date: normDate(mapping.fill_date ? r[mapping.fill_date] : null),
      gallons: numOrNull(mapping.gallons ? r[mapping.gallons] : null),
      total_cost: numOrNull(mapping.total_cost ? r[mapping.total_cost] : null),
      odometer: numOrNull(mapping.odometer ? r[mapping.odometer] : null),
      station: mapping.station ? (r[mapping.station] || '') : '',
      card_id: mapping.card_id ? String(r[mapping.card_id] || '') : '',
      vehicle_label: '', price_per_gallon: null, fuel_type: '',
    })).filter((f) => f.gallons != null || f.total_cost != null)
    if (fills.length === 0) { setMsg('No fuel rows found — check the column mapping.'); return }
    enterReview(fills)
  }

  // ---- PDF/image path ----
  async function onPdfFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setReading(true); setMsg(''); setProvider('')
    try {
      const b64 = await fileToBase64(file)
      const res = await extractFuelStatement(b64, file.type || 'application/pdf')
      if (res.error) { setMsg(res.error); setReading(false); e.target.value = ''; return }
      setProvider(res.provider || '')
      const fills = (res.fills || []).map((f) => ({
        fill_date: normDate(f.date), gallons: numOrNull(f.gallons), total_cost: numOrNull(f.total_cost),
        odometer: numOrNull(f.odometer), station: (f.station || '').trim(),
        card_id: (f.card_id || '').trim(), vehicle_label: (f.vehicle_label || '').trim(),
        price_per_gallon: numOrNull(f.price_per_gallon), fuel_type: (f.fuel_type || '').trim(),
      })).filter((f) => f.gallons != null || f.total_cost != null)
      if (fills.length === 0) { setMsg('Quincy could not find any fuel transactions in that file.'); setReading(false); e.target.value = ''; return }
      enterReview(fills)
    } catch (err) {
      setMsg(String(err))
    } finally { setReading(false); e.target.value = '' }
  }

  function cancelReview() { setParsedFills(null); setCardMap({}); setCsvRows([]); setCsvHeaders([]); setMapping({}); setProvider('') }

  const allGroupsMapped = groups.length > 0 && groups.every((g) => cardMap[g.key])

  async function doImport() {
    if (!parsedFills || !allGroupsMapped) return
    setImporting(true); setMsg('')
    const rows = parsedFills.map((f) => ({
      vehicle_id: cardMap[groupKeyOf(f)],
      fill_date: f.fill_date || new Date().toISOString().slice(0, 10),
      gallons: f.gallons, total_cost: f.total_cost, odometer: f.odometer,
      station: f.station || null, card_last4: f.card_id ? String(f.card_id).slice(-4) : null, fuel_type: f.fuel_type || null,
      source: mode === 'pdf' ? 'quincy-pdf' : 'import', created_by: profile.id,
    })).filter((r) => r.vehicle_id && (r.gallons != null || r.total_cost != null))
    const { inserted, error } = await importFuel(org.selectedOrg, rows)
    // Remember each card→vehicle mapping so next time it auto-matches.
    if (!error) {
      for (const g of groups) {
        const vid = cardMap[g.key]
        if (vid && g.sampleCardId) {
          const v = vehicles.find((x) => x.id === vid)
          if (v && normKey(v.fuel_card_id) !== normKey(g.sampleCardId)) await updateVehicle(vid, { fuel_card_id: g.sampleCardId })
        }
      }
    }
    setImporting(false)
    setMsg(error ? error.message : `Imported ${inserted} fill${inserted === 1 ? '' : 's'} across ${groups.length} card${groups.length === 1 ? '' : 's'}.`)
    if (!error) { cancelReview(); loadVehicles(); loadFuel() }
  }

  const vehName = (id) => vehicles.find((v) => v.id === id)?.name || ''

  return (
    <div>
      <div className="page-header-bar"><h2>Fuel Log</h2></div>
      <OrgBar {...org} />

      <div className="field" style={{ maxWidth: 320 }}>
        <label>Vehicle (for manual entry &amp; history below)</label>
        <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
          <option value="">— select —</option>
          {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>

      {/* Manual fill */}
      <form className="inline-form" onSubmit={handleAdd} style={{ margin: '12px 0 8px', flexWrap: 'wrap' }}>
        <div className="field" style={{ width: 150 }}><label>Date</label><input type="date" value={form.fill_date} onChange={(e) => setForm({ ...form, fill_date: e.target.value })} /></div>
        <div className="field" style={{ width: 120 }}><label>Odometer</label><input type="number" step="any" value={form.odometer} onChange={(e) => setForm({ ...form, odometer: e.target.value })} /></div>
        <div className="field" style={{ width: 100 }}><label>Gallons</label><input type="number" step="any" value={form.gallons} onChange={(e) => setForm({ ...form, gallons: e.target.value })} required /></div>
        <div className="field" style={{ width: 110 }}><label>Total $</label><input type="number" step="any" value={form.total_cost} onChange={(e) => setForm({ ...form, total_cost: e.target.value })} /></div>
        <div className="field" style={{ width: 150 }}><label>Station</label><input type="text" value={form.station} onChange={(e) => setForm({ ...form, station: e.target.value })} /></div>
        <div className="field" style={{ width: 90 }}><label>Card #</label><input type="text" value={form.card_last4} onChange={(e) => setForm({ ...form, card_last4: e.target.value })} /></div>
        <button className="auth-button" type="submit" disabled={saving} style={{ width: 'auto' }}>{saving ? 'Adding…' : 'Add fill'}</button>
      </form>

      {/* Statement import — CSV or PDF, feeding one review step */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, margin: '10px 0 18px', background: '#F8FAFC' }}>
        <strong style={{ fontSize: 14 }}>Import a fuel-card statement</strong>

        {!parsedFills ? (
          <>
            {/* Source toggle */}
            <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', margin: '10px 0' }}>
              {[['csv', 'CSV / spreadsheet'], ['pdf', 'PDF / photo (Quincy reads it)']].map(([k, label]) => (
                <button key={k} onClick={() => { setMode(k); setMsg('') }} type="button"
                  style={{ border: 'none', padding: '7px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                    background: mode === k ? '#1B3A6B' : '#fff', color: mode === k ? '#fff' : '#334155' }}>
                  {label}
                </button>
              ))}
            </div>

            {mode === 'csv' && (
              <div>
                <input type="file" accept=".csv,text/csv" onChange={onCsvFile} />
                {csvHeaders.length > 0 && (
                  <>
                    <p style={{ color: 'var(--mist)', fontSize: 13, margin: '10px 0 6px' }}>{csvRows.length} rows found — match the columns:</p>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {CSV_TARGETS.map((t) => (
                        <div className="field" key={t.key} style={{ marginBottom: 6, minWidth: 150 }}>
                          <label>{t.label}</label>
                          <select value={mapping[t.key] || ''} onChange={(e) => setMapping({ ...mapping, [t.key]: e.target.value })}>
                            <option value="">—</option>
                            {csvHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                    <button className="auth-button" style={{ width: 'auto', marginTop: 8 }} onClick={reviewCsv}>Continue to review →</button>
                  </>
                )}
              </div>
            )}

            {mode === 'pdf' && (
              <div>
                <p style={{ color: 'var(--mist)', fontSize: 13, margin: '8px 0' }}>
                  Upload the statement as a PDF or a clear photo — Quincy reads it and pulls out each fill. Works for fleet cards
                  (WEX, Comdata, Fuelman) and local convenience-store cards (Circle K, RaceTrac, Wawa) that don&apos;t offer a CSV.
                </p>
                <label className="auth-button" style={{ width: 'auto', padding: '9px 18px', cursor: 'pointer', display: 'inline-block' }}>
                  {reading ? 'Quincy is reading…' : 'Choose PDF / image'}
                  <input type="file" accept="application/pdf,image/*" onChange={onPdfFile} disabled={reading} style={{ display: 'none' }} />
                </label>
              </div>
            )}
          </>
        ) : (
          /* ---- Shared review & map step ---- */
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <strong style={{ fontSize: 13 }}>
                Review &amp; map — {parsedFills.length} fill{parsedFills.length === 1 ? '' : 's'}
                {provider ? ` from ${provider}` : ''} across {groups.length} card{groups.length === 1 ? '' : 's'}
              </strong>
              <button className="logout-button" onClick={cancelReview}>Start over</button>
            </div>

            <p style={{ color: 'var(--mist)', fontSize: 13, margin: '8px 0 6px' }}>Assign each card / vehicle on the statement to a truck:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {groups.map((g) => (
                <div key={g.key} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ minWidth: 220, fontWeight: 600 }}>{g.label} <span style={{ color: 'var(--mist)', fontWeight: 400 }}>· {g.count} fill{g.count === 1 ? '' : 's'}</span></span>
                  <span style={{ color: 'var(--mist)' }}>→</span>
                  <select value={cardMap[g.key] || ''} onChange={(e) => setCardMap({ ...cardMap, [g.key]: e.target.value })}
                    style={{ minWidth: 200, borderColor: cardMap[g.key] ? undefined : '#E3B0B0' }}>
                    <option value="">— pick a vehicle —</option>
                    {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              <table className="data-table" style={{ margin: 0 }}>
                <thead><tr><th>Date</th><th style={{ textAlign: 'right' }}>Gallons</th><th style={{ textAlign: 'right' }}>Total $</th><th>Station</th><th>Card / Vehicle</th><th>→ Truck</th></tr></thead>
                <tbody>
                  {parsedFills.map((f, i) => (
                    <tr key={i}>
                      <td>{f.fill_date || '—'}</td>
                      <td style={{ textAlign: 'right' }}>{f.gallons != null ? Number(f.gallons).toFixed(1) : '—'}</td>
                      <td style={{ textAlign: 'right' }}>{f.total_cost != null ? `$${Number(f.total_cost).toFixed(2)}` : '—'}</td>
                      <td style={{ color: 'var(--mist)' }}>{f.station || '—'}</td>
                      <td style={{ color: 'var(--mist)' }}>{groupLabelOf(f)}</td>
                      <td>{cardMap[groupKeyOf(f)] ? vehName(cardMap[groupKeyOf(f)]) : <span style={{ color: '#B00020' }}>unassigned</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button className="auth-button" style={{ width: 'auto', marginTop: 10 }} disabled={importing || !allGroupsMapped} onClick={doImport}>
              {importing ? 'Importing…' : `Import ${parsedFills.length} fill${parsedFills.length === 1 ? '' : 's'}`}
            </button>
            {!allGroupsMapped && <span style={{ color: '#B00020', fontSize: 12, marginLeft: 10 }}>Map every card to a vehicle to import.</span>}
          </div>
        )}
      </div>
      {msg && <div style={{ marginBottom: 12, color: msg.startsWith('Imported') ? '#166534' : '#B00020' }}>{msg}</div>}

      {/* History */}
      <table className="data-table">
        <thead>
          <tr><th>Date</th><th style={{ textAlign: 'right' }}>Odometer</th><th style={{ textAlign: 'right' }}>Gallons</th><th style={{ textAlign: 'right' }}>$/gal</th><th style={{ textAlign: 'right' }}>MPG</th><th style={{ textAlign: 'right' }}>$/mile</th><th>Station</th><th>Flags</th></tr>
        </thead>
        <tbody>
          {display.map((f) => (
            <tr key={f.id}>
              <td>{f.fill_date}</td>
              <td style={{ textAlign: 'right' }}>{f.odometer ?? '—'}</td>
              <td style={{ textAlign: 'right' }}>{Number(f.gallons).toFixed(1)}</td>
              <td style={{ textAlign: 'right' }}>{f.cpg != null ? `$${f.cpg.toFixed(2)}` : '—'}</td>
              <td style={{ textAlign: 'right' }}>{f.mpg != null ? f.mpg.toFixed(1) : '—'}</td>
              <td style={{ textAlign: 'right' }}>{f.cpm != null ? `$${f.cpm.toFixed(2)}` : '—'}</td>
              <td style={{ color: 'var(--mist)' }}>{f.station || '—'}</td>
              <td><FlagPills flags={f.flags} /></td>
            </tr>
          ))}
          {display.length === 0 && <tr><td colSpan="8" style={{ color: 'var(--mist)' }}>No fills yet. Add one above or import a statement.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
