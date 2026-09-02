import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import { PARTS_YEARS, LABOR_YEARS } from './warranty'

const addYears = (iso, n) => {
  if (!iso) return null
  const d = new Date(iso + 'T00:00:00'); d.setFullYear(d.getFullYear() + n)
  return d.toLocaleDateString('en-US')
}
function unitsOf(q) {
  return [
    { kind: 'Outdoor Unit', brand: q.outdoor_brand, model: q.outdoor_model, serial: q.outdoor_serial },
    { kind: 'Indoor Unit',  brand: q.indoor_brand,  model: q.indoor_model,  serial: q.indoor_serial },
    { kind: 'Furnace',      brand: q.furnace_brand, model: q.furnace_model, serial: q.furnace_serial },
  ].filter(u => u.brand || u.model || u.serial)
}

export default function CustomerEquipment({ customer, properties }) {
  const nav = useNavigate()
  const [equip, setEquip] = useState(null)
  const prop = (properties || [])[0]

  useEffect(() => {
    let live = true
    supabase.from('property_equipment')
      .select('id, install_date, status, outdoor_brand, outdoor_model, outdoor_serial, indoor_brand, indoor_model, indoor_serial, furnace_brand, furnace_model, furnace_serial')
      .neq('status', 'retired')
      .then(({ data }) => { if (live) setEquip(data || []) })
    return () => { live = false }
  }, [])

  const first = equip && equip[0]
  const install = first && first.install_date
  const partsExp = addYears(install, PARTS_YEARS)
  const laborExp = addYears(install, LABOR_YEARS)
  const name = customer ? ([customer.first_name, customer.last_name].filter(Boolean).join(' ') || customer.display_name || '') : ''

  return (
    <div className="cp-wrap">
      <button className="cp-back" onClick={() => nav('/portal')}>‹ Home</button>
      <h2 className="cp-h2">My Equipment & Warranty</h2>

      <div className="cp-card cp-inforows">
        {name && <div className="cp-inforow"><span className="lbl">Name</span><span className="val">{name}</span></div>}
        {prop && <div className="cp-inforow"><span className="lbl">Address</span><span className="val">{[prop.street_address, prop.unit].filter(Boolean).join(' ')}</span></div>}
        {prop && (prop.city || prop.state || prop.zip) && (
          <div className="cp-inforow"><span className="lbl">City, State, Zip</span><span className="val">{[prop.city, prop.state].filter(Boolean).join(', ')} {prop.zip}</span></div>
        )}
        {customer && customer.primary_phone && <div className="cp-inforow"><span className="lbl">Phone</span><span className="val">{customer.primary_phone}</span></div>}
        {customer && customer.secondary_phone && <div className="cp-inforow"><span className="lbl">Alt Phone</span><span className="val">{customer.secondary_phone}</span></div>}
        {customer && customer.email_1 && <div className="cp-inforow"><span className="lbl">Email</span><span className="val">{customer.email_1}</span></div>}
      </div>

      <div className="cp-card cp-warr">
        {equip === null ? <div>Loading…</div> : (
          <>
            <div>Limited Parts Warranty Expires:<br /><b>{partsExp || 'Verify with office'}</b></div>
            <div>Limited Labor Warranty Expires:<br /><b>{laborExp || 'Verify with office'}</b></div>
            <div className="note">Freon not a covered expense.</div>
          </>
        )}
      </div>

      <div className="cp-card cp-equip">
        {equip === null ? <div>Loading…</div>
          : equip.length === 0 ? <div className="note">We’ll record your system’s make, model &amp; serial at your next visit.</div>
          : equip.flatMap(q => unitsOf(q)).map((u, i) => (
            <div className="unit" key={i}>
              <b>{u.kind}: {u.brand || '—'}</b>
              {u.model && <div>Model: {u.model}</div>}
              {u.serial && <div>Serial: {u.serial}</div>}
            </div>
          ))}
      </div>
    </div>
  )
}
