// Elements-HVAC · Fleet · Fuel log (manual + fuel-card CSV import) with MPG/CPG/CPM + flags
import { useState, useEffect, useMemo } from 'react'
import Papa from 'papaparse'
import { listVehicles, listFuel, addFuel, importFuel, computeFuelMetrics, FLAG_COLORS } from './fleetData'
import { useOrgSelector, OrgBar } from './shared'

const blankFill = { fill_date: new Date().toISOString().slice(0, 10), odometer: '', gallons: '', total_cost: '', station: '', card_last4: '', fuel_type: '' }
const TARGETS = [
  { key: 'fill_date', label: 'Date' },
  { key: 'gallons', label: 'Gallons' },
  { key: 'total_cost', label: 'Total cost' },
  { key: 'odometer', label: 'Odometer' },
  { key: 'station', label: 'Station' },
  { key: 'card_last4', label: 'Card (last 4)' },
]

function normDate(raw) {
  if (!raw) return null
  const d = new Date(raw)
  if (isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}
const numOrNull = (x) => { const n = parseFloat(String(x).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? null : n }

function FlagPills({ flags }) {
  if (!flags?.length) return <span style={{ color: '#16A34A' }}>✓</span>
  return (
    <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
      {flags.map((f, i) => (
        <span key={i} title={f.label} style={{ background: FLAG_COLORS[f.color], color: '#fff', borderRadius: 6, padding: '2px 6px', fontSize: 11, fontWeight: 700 }}>
          {f.label}
        </span>
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
  const [csvRows, setCsvRows] = useState([])
  const [csvHeaders, setCsvHeaders] = useState([])
  const [mapping, setMapping] = useState({})
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
  const display = [...enriched].reverse() // newest first

  async function handleAdd(e) {
    e.preventDefault()
    if (!vehicleId || !form.gallons) { setMsg('Pick a vehicle and enter gallons.'); return }
    setSaving(true); setMsg('')
    const { error } = await addFuel(org.selectedOrg, {
      vehicle_id: vehicleId,
      fill_date: form.fill_date || new Date().toISOString().slice(0, 10),
      odometer: numOrNull(form.odometer),
      gallons: numOrNull(form.gallons),
      total_cost: numOrNull(form.total_cost),
      station: form.station.trim() || null,
      card_last4: form.card_last4.trim() || null,
      fuel_type: form.fuel_type.trim() || null,
      created_by: profile.id,
    })
    setSaving(false)
    if (error) { setMsg(error.message); return }
    setForm(blankFill); loadFuel()
  }

  function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        const headers = res.meta.fields || []
        setCsvHeaders(headers)
        setCsvRows(res.data || [])
        // naive auto-map by header name
        const guess = {}
        const find = (re) => headers.find((h) => re.test(h))
        guess.fill_date = find(/date/i)
        guess.gallons = find(/gal|qty|volume|units/i)
        guess.total_cost = find(/amount|total|cost|\$/i)
        guess.odometer = find(/odom|mile|odo/i)
        guess.station = find(/station|merchant|site|location|vendor/i)
        guess.card_last4 = find(/card|last ?4|acct|account/i)
        setMapping(guess)
      },
    })
  }

  async function doImport() {
    if (!vehicleId || csvRows.length === 0) return
    setImporting(true); setMsg('')
    const rows = csvRows.map((r) => ({
      vehicle_id: vehicleId,
      fill_date: normDate(mapping.fill_date ? r[mapping.fill_date] : null) || new Date().toISOString().slice(0, 10),
      gallons: numOrNull(mapping.gallons ? r[mapping.gallons] : null),
      total_cost: numOrNull(mapping.total_cost ? r[mapping.total_cost] : null),
      odometer: numOrNull(mapping.odometer ? r[mapping.odometer] : null),
      station: mapping.station ? (r[mapping.station] || null) : null,
      card_last4: mapping.card_last4 ? String(r[mapping.card_last4] || '').slice(-4) : null,
      created_by: profile.id,
    })).filter((r) => r.gallons != null)
    const { inserted, error } = await importFuel(org.selectedOrg, rows)
    setImporting(false)
    setMsg(error ? error.message : `Imported ${inserted} fill${inserted === 1 ? '' : 's'} to ${vehicle?.name}.`)
    setCsvRows([]); setCsvHeaders([]); setMapping({})
    loadFuel()
  }

  return (
    <div>
      <div className="page-header-bar">
        <h2>Fuel Log</h2>
      </div>
      <OrgBar {...org} />

      <div className="field" style={{ maxWidth: 320 }}>
        <label>Vehicle</label>
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

      {/* CSV import */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, margin: '10px 0 18px', background: '#F8FAFC' }}>
        <strong style={{ fontSize: 14 }}>Import fuel-card statement (CSV)</strong>
        <div style={{ marginTop: 8 }}>
          <input type="file" accept=".csv,text/csv" onChange={onFile} />
        </div>
        {csvHeaders.length > 0 && (
          <>
            <p style={{ color: 'var(--mist)', fontSize: 13, margin: '10px 0 6px' }}>
              {csvRows.length} rows found — map the columns, then import to <strong>{vehicle?.name || '(pick a vehicle)'}</strong>:
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {TARGETS.map((t) => (
                <div className="field" key={t.key} style={{ marginBottom: 6, minWidth: 150 }}>
                  <label>{t.label}</label>
                  <select value={mapping[t.key] || ''} onChange={(e) => setMapping({ ...mapping, [t.key]: e.target.value })}>
                    <option value="">—</option>
                    {csvHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <button className="auth-button" style={{ width: 'auto', marginTop: 8 }} disabled={importing || !vehicleId} onClick={doImport}>
              {importing ? 'Importing…' : `Import ${csvRows.length} fills`}
            </button>
          </>
        )}
      </div>
      {msg && <div style={{ marginBottom: 12, color: msg.startsWith('Imported') || msg.includes('Added') ? '#166534' : '#B00020' }}>{msg}</div>}

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
