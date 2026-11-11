import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FieldShell, { todayISO } from './FieldShell'
import { supabase } from '../utils/supabase'

// MILEAGE — odometer readings per truck and the miles driven each month (for the accountant).
function monthStart(offset = 0) {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
const monthEnd = (start) => { const d = new Date(start + 'T12:00:00'); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10) }
const monthLabel = (start) => new Date(start + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
const miles = (n) => Math.round(Number(n || 0)).toLocaleString('en-US')

export default function FieldMileage({ profile }) {
  const navigate = useNavigate()
  const orgId = profile?.org_id
  const [month, setMonth] = useState(monthStart(0))
  const [vehicles, setVehicles] = useState(null)
  const [reads, setReads] = useState([])
  const [entry, setEntry] = useState({})
  const [newTruck, setNewTruck] = useState(null)
  const [msg, setMsg] = useState(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!orgId) return
    let live = true
    ;(async () => {
      const [{ data: v }, { data: r }] = await Promise.all([
        supabase.from('elements_vehicles').select('id, name, year, make, model, assigned_user_id').eq('org_id', orgId).neq('is_active', false).order('name'),
        supabase.from('elements_vehicle_meters').select('id, vehicle_id, reading, reading_date').eq('org_id', orgId).eq('meter_type', 'odometer').order('reading_date', { ascending: true }).limit(5000),
      ])
      if (live) { setVehicles(v || []); setReads(r || []) }
    })()
    return () => { live = false }
  }, [orgId, reload])

  const end = monthEnd(month)
  function summary(vid) {
    const mine = reads.filter((r) => r.vehicle_id === vid)
    const before = mine.filter((r) => r.reading_date < month)
    const inMonth = mine.filter((r) => r.reading_date >= month && r.reading_date <= end)
    const last = mine[mine.length - 1]
    if (!inMonth.length) return { last, driven: null, count: 0 }
    const startRead = before.length ? Number(before[before.length - 1].reading) : Number(inMonth[0].reading)
    const endRead = Math.max(...inMonth.map((r) => Number(r.reading)))
    return { last, driven: Math.max(0, endRead - startRead), count: inMonth.length, partial: !before.length }
  }
  async function saveReading(v) {
    setMsg(null)
    const n = Number(String(entry[v.id] || '').replace(/[,\s]/g, ''))
    const last = summary(v.id).last
    if (!(n > 0)) { setMsg({ id: v.id, ok: false, t: 'Enter the odometer number.' }); return }
    if (last && n < Number(last.reading)) { setMsg({ id: v.id, ok: false, t: `That's lower than the last reading (${miles(last.reading)}).` }); return }
    const { error } = await supabase.from('elements_vehicle_meters').insert({ org_id: orgId, vehicle_id: v.id, meter_type: 'odometer', reading: n, reading_date: todayISO(), source: 'manual', created_by: profile?.id || null })
    if (error) { setMsg({ id: v.id, ok: false, t: error.message }); return }
    setEntry({ ...entry, [v.id]: '' }); setMsg({ id: v.id, ok: true, t: 'Saved.' }); setReload((x) => x + 1)
  }
  async function addTruck() {
    const name = newTruck.name.trim()
    if (!name) return
    const { error } = await supabase.from('elements_vehicles').insert({ org_id: orgId, name, year: newTruck.year ? Number(newTruck.year) : null, make: newTruck.make.trim() || null, model: newTruck.model.trim() || null, primary_meter: 'odometer', is_active: true, status: 'active' })
    if (error) { setMsg({ id: 'new', ok: false, t: error.message }); return }
    setNewTruck(null); setReload((x) => x + 1)
  }

  const total = (vehicles || []).reduce((a, v) => a + (summary(v.id).driven || 0), 0)
  return (
    <FieldShell profile={profile} title="Admin" onBack={() => navigate('/tech/field/admin')}>
      <div className="fa-panel">
        <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 18 }}>Mileage</div>
        <select className="fa-select" value={month} onChange={(e) => setMonth(e.target.value)}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => { const m = monthStart(i); return <option key={m} value={m}>{monthLabel(m)}</option> })}
        </select>
        {!vehicles ? <p className="fa-empty">Loading…</p> : (<>
          {vehicles.length > 0 && <div className="fa-info" style={{ textAlign: 'center' }}><div className="fa-muted" style={{ fontSize: 12.5 }}>Miles driven — {monthLabel(month)}</div><div style={{ fontWeight: 900, fontSize: 24 }}>{miles(total)}</div></div>}
          {vehicles.map((v) => {
            const s = summary(v.id)
            return (
              <div key={v.id} className="fa-info">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div><div style={{ fontWeight: 800 }}>{v.name}</div><div className="fa-muted" style={{ fontSize: 12.5 }}>{[v.year, v.make, v.model].filter(Boolean).join(' ')}</div></div>
                  <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 900 }}>{s.driven == null ? '—' : `${miles(s.driven)} mi`}</div><div className="fa-muted" style={{ fontSize: 11.5 }}>{s.count ? `${s.count} reading${s.count === 1 ? '' : 's'}${s.partial ? ' · first month' : ''}` : 'no readings this month'}</div></div>
                </div>
                {s.last && <div className="fa-muted" style={{ fontSize: 12.5, marginTop: 4 }}>Last odometer: {miles(s.last.reading)} on {new Date(s.last.reading_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>}
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <input className="fa-input" style={{ flex: 1, fontSize: 16 }} inputMode="numeric" placeholder="Today's odometer" value={entry[v.id] || ''} onChange={(e) => setEntry({ ...entry, [v.id]: e.target.value })} />
                  <button type="button" className="fa-small-btn" disabled={!entry[v.id]} onClick={() => saveReading(v)}>Save</button>
                </div>
                {msg?.id === v.id && <div className={`fa-msg ${msg.ok ? 'ok' : 'err'}`} style={{ marginTop: 6 }}>{msg.t}</div>}
              </div>
            )
          })}
          <div className="fa-muted" style={{ fontSize: 12.5, margin: '0 4px' }}>Enter the odometer at the start of each month (or more often). Miles = this month&apos;s last reading minus last month&apos;s last reading.</div>
          {newTruck ? (
            <div className="fa-info" style={{ display: 'grid', gap: 6 }}>
              <input className="fa-input" style={{ fontSize: 16 }} placeholder="Name, e.g. Truck 1" value={newTruck.name} onChange={(e) => setNewTruck({ ...newTruck, name: e.target.value })} />
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: 6 }}>
                <input className="fa-input" style={{ fontSize: 16 }} inputMode="numeric" placeholder="Year" value={newTruck.year} onChange={(e) => setNewTruck({ ...newTruck, year: e.target.value })} />
                <input className="fa-input" style={{ fontSize: 16 }} placeholder="Make" value={newTruck.make} onChange={(e) => setNewTruck({ ...newTruck, make: e.target.value })} />
                <input className="fa-input" style={{ fontSize: 16 }} placeholder="Model" value={newTruck.model} onChange={(e) => setNewTruck({ ...newTruck, model: e.target.value })} />
              </div>
              {msg?.id === 'new' && <div className="fa-msg err">{msg.t}</div>}
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="fa-small-btn" disabled={!newTruck.name.trim()} onClick={addTruck}>Add Truck</button>
                <button type="button" className="fa-small-btn" style={{ background: '#fff', color: 'var(--fa-navy)' }} onClick={() => setNewTruck(null)}>Cancel</button>
              </div>
            </div>
          ) : <button type="button" className="fa-navbtn ghost" style={{ borderColor: 'var(--fa-cyan)' }} onClick={() => setNewTruck({ name: '', year: '', make: '', model: '' })}>+ Add a Truck</button>}
        </>)}
      </div>
    </FieldShell>
  )
}
