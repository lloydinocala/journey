import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import { warrantyFor, decodeSerial } from './warranty'

function unitsOf(q) {
  return [
    { kind: 'Outdoor Unit', brand: q.outdoor_brand, model: q.outdoor_model, serial: q.outdoor_serial },
    { kind: 'Indoor Unit',  brand: q.indoor_brand,  model: q.indoor_model,  serial: q.indoor_serial },
    { kind: 'Furnace',      brand: q.furnace_brand, model: q.furnace_model, serial: q.furnace_serial },
  ].filter((u) => u.brand || u.model || u.serial)
}

// The system's manufacture year drives the parts warranty. Prefer a confirmed
// manufacture_year on the record; else decode the outdoor unit (the condenser is
// what the parts warranty tracks), then indoor, then furnace.
function systemWarranty(q) {
  const order = [
    [q.outdoor_brand, q.outdoor_serial],
    [q.indoor_brand, q.indoor_serial],
    [q.furnace_brand, q.furnace_serial],
  ]
  let brand = q.outdoor_brand, serial = q.outdoor_serial
  if (q.manufacture_year == null) {
    for (const [b, s] of order) {
      if (decodeSerial(b, s).year) { brand = b; serial = s; break }
    }
  }
  return warrantyFor({ manufactureYear: q.manufacture_year, installDate: q.install_date, brand, serial })
}

const pillClass = (state) => (state === 'active' ? 'cp-warr-ok' : state === 'expired' ? 'cp-warr-exp' : 'cp-warr-verify')

export default function CustomerEquipment({ customer, properties, activePropertyId }) {
  const nav = useNavigate()
  const [equip, setEquip] = useState(null)
  const prop = (properties || [])[0]
  const propIds = activePropertyId ? [activePropertyId] : (properties || []).map((p) => p.id)

  useEffect(() => {
    let live = true
    if (!propIds.length) { setEquip([]); return }
    supabase.from('property_equipment')
      .select('id, system_label, install_date, manufacture_year, status, outdoor_brand, outdoor_model, outdoor_serial, indoor_brand, indoor_model, indoor_serial, furnace_brand, furnace_model, furnace_serial')
      .in('property_id', propIds)
      .neq('status', 'retired')
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (live) setEquip(data || []) })
    return () => { live = false }
  }, [properties]) // eslint-disable-line react-hooks/exhaustive-deps

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
        {customer && customer.email_1 && <div className="cp-inforow"><span className="lbl">Email</span><span className="val">{customer.email_1}</span></div>}
      </div>

      {equip === null ? (
        <div className="cp-card">Loading…</div>
      ) : equip.length === 0 ? (
        <div className="cp-card"><div className="note">We’ll record your system’s make, model &amp; serial at your next visit.</div></div>
      ) : (
        equip.map((q) => {
          const w = systemWarranty(q)
          const units = unitsOf(q)
          return (
            <div className="cp-card cp-equip" key={q.id}>
              {q.system_label && <div className="cp-equip-sys"><b>{q.system_label}</b></div>}

              <div className="cp-inforow">
                <span className="lbl">Manufactured</span>
                <span className="val">
                  {w.manufactureYear
                    ? `${w.manufactureYear}${w.manufactureSource === 'serial' ? ' (from serial)' : ''}`
                    : 'Verify — see note'}
                </span>
              </div>

              {q.install_date && (
                <div className="cp-inforow">
                  <span className="lbl">Installed</span>
                  <span className="val">{new Date(q.install_date + 'T00:00:00').toLocaleDateString('en-US')}</span>
                </div>
              )}

              <div className="cp-warrpills">
                <span className={`cp-warr-pill ${pillClass(w.parts.state)}`}>{w.parts.label}</span>
                <span className={`cp-warr-pill ${pillClass(w.labor.state)}`}>{w.labor.label}</span>
                <span className={`cp-warr-pill ${pillClass(w.freon.state)}`}>{w.freon.label}</span>
              </div>

              {w.note && <div className="note" style={{ marginTop: 8 }}>{w.note}</div>}
              <div className="note" style={{ marginTop: 8 }}>
                Parts: 10 years — from the install date when we installed it, otherwise from the manufacture date (honored to any owner). Labor &amp; refrigerant: 1 year from install only. Diagnostic/service fees may apply.
              </div>

              <div style={{ marginTop: 10 }}>
                {units.map((u, i) => {
                  const d = decodeSerial(u.brand, u.serial)
                  return (
                    <div className="unit" key={i}>
                      <b>{u.kind}: {u.brand || '—'}</b>
                      {u.model && <div>Model: {u.model}</div>}
                      {u.serial && <div>Serial: {u.serial}</div>}
                      {d.year && <div>Mfg: {d.year}</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
