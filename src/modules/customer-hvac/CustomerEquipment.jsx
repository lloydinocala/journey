import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import { warrantyFor } from './warranty'

const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : null
const pillClass = (state) => state === 'active' ? 'ok' : state === 'expired' ? 'due' : 'pend'

// Break a property_equipment row into its up-to-three physical units.
function unitsOf(q) {
  return [
    { kind: 'Outdoor unit', brand: q.outdoor_brand, model: q.outdoor_model, serial: q.outdoor_serial },
    { kind: 'Indoor unit',  brand: q.indoor_brand,  model: q.indoor_model,  serial: q.indoor_serial },
    { kind: 'Furnace',      brand: q.furnace_brand, model: q.furnace_model, serial: q.furnace_serial },
  ].filter(u => u.brand || u.model || u.serial)
}

export default function CustomerEquipment() {
  const nav = useNavigate()
  const [equip, setEquip] = useState(null)

  useEffect(() => {
    let live = true
    supabase.from('property_equipment')
      .select('id, system_label, install_date, status, outdoor_brand, outdoor_model, outdoor_serial, indoor_brand, indoor_model, indoor_serial, furnace_brand, furnace_model, furnace_serial')
      .neq('status', 'retired')
      .then(({ data }) => { if (live) setEquip(data || []) })
    return () => { live = false }
  }, [])

  return (
    <div className="cp-wrap">
      <button className="cp-back" onClick={() => nav('/portal')}>‹ Home</button>
      <h2 className="cp-h2">Your Equipment</h2>
      <p className="cp-lead">The systems we’ve installed and serviced at your home, with warranty status.</p>

      {equip === null ? (
        <div className="cp-empty">Loading your systems…</div>
      ) : equip.length === 0 ? (
        <div className="cp-card">
          <p style={{ margin: 0, fontSize: 14.5 }}>
            We don’t have equipment recorded for your home yet. We capture make, model, and serial
            at each visit, so this fills in after your next service call.
          </p>
        </div>
      ) : equip.map(q => {
        const units = unitsOf(q)
        return (
          <div className="cp-card" key={q.id}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <b style={{ fontSize: 15.5 }}>{q.system_label || 'HVAC system'}</b>
              <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                {fmtDate(q.install_date) ? `Installed ${fmtDate(q.install_date)}` : 'Install date not on file'}
              </span>
            </div>
            {units.length === 0 ? (
              <p className="cp-note" style={{ marginTop: 8 }}>Details on file with the office.</p>
            ) : units.map((u, idx) => {
              const w = warrantyFor({ installDate: q.install_date, brand: u.brand, serial: u.serial })
              return (
                <div key={idx} style={{ padding: '11px 0', borderBottom: idx < units.length - 1 ? '1px solid var(--line)' : 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>
                    {u.kind}{u.brand ? ` · ${u.brand}` : ''}
                  </div>
                  {u.model && <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Model {u.model}{u.serial ? ` · S/N ${u.serial}` : ''}</div>}
                  <div className="cp-chips" style={{ marginTop: 8 }}>
                    <span className={`cp-pill ${pillClass(w.parts.state)}`}>{w.parts.label}</span>
                    <span className={`cp-pill ${pillClass(w.labor.state)}`}>{w.labor.label}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}

      {equip && equip.length > 0 && (
        <p className="cp-note">
          Parts coverage is shown from your install date when we have it. Where we don’t, parts are
          estimated from the equipment’s manufacture date (marked “est.”) and labor is shown as
          expired. Call the office to confirm exact coverage before scheduling warranty work.
        </p>
      )}
    </div>
  )
}
