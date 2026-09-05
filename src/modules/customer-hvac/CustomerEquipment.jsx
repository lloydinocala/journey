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

// A circular 0-100 health gauge, colored by band.
function HealthRing({ score, color }) {
  const r = 33, c = 2 * Math.PI * r, off = c * (1 - score / 100)
  return (
    <svg width="86" height="86" viewBox="0 0 86 86" style={{ flex: '0 0 auto' }}>
      <circle cx="43" cy="43" r={r} fill="none" stroke="#E6EBF0" strokeWidth="8" />
      <circle cx="43" cy="43" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 43 43)" />
      <text x="43" y="43" textAnchor="middle" dominantBaseline="central" fontSize="23" fontWeight="800" fill={color}>{score}</text>
    </svg>
  )
}

// System Health score: a HONEST, sourced guide from age vs. ~15yr life, warranty
// status, and (age-inferred) R-22 refrigerant. Returns null if the age is unknown.
function systemHealth(w) {
  const my = w.manufactureYear
  if (!my) return null
  const age = Math.max(0, new Date().getFullYear() - my)
  const likelyR22 = my < 2010
  const partsExpired = w.parts?.state === 'expired'
  let score = 100
  score -= Math.min(age / 15, 1.35) * 55
  if (partsExpired) score -= 12
  if (likelyR22) score -= 15
  score = Math.round(Math.max(5, Math.min(100, score)))
  const band = score >= 70 ? 'green' : score >= 40 ? 'amber' : 'red'
  const color = band === 'green' ? '#1F7A43' : band === 'amber' ? '#C8811B' : '#C0392B'
  const verdict = band === 'green' ? 'Healthy' : band === 'amber' ? 'Aging' : 'End of life'
  const summary = band === 'green'
    ? 'Running well — worth keeping maintained.'
    : band === 'amber'
    ? 'Still serviceable, but worth planning ahead for a replacement.'
    : 'Near the end of its service life — repairs get riskier and less economical.'
  const reasons = [
    `About ${age} year${age === 1 ? '' : 's'} old (a typical HVAC system lasts ~15 years).`,
    partsExpired ? 'Parts warranty has expired — repairs now come at full cost.' : 'Still within the manufacturer parts-warranty window.',
  ]
  if (likelyR22) reasons.push('Likely uses R‑22 refrigerant (phased out and costly to service) — based on its age.')
  const cta = band === 'green' ? { label: 'Book a tune-up', to: '/portal/book/pm' } : { label: 'Get a free estimate', to: '/portal/book/system_quote' }
  return { score, band, color, verdict, summary, reasons, cta, showQuincy: band !== 'green' }
}

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
          const h = systemHealth(w)
          const units = unitsOf(q)
          return (
            <div className="cp-card cp-equip" key={q.id}>
              {q.system_label && <div className="cp-equip-sys"><b>{q.system_label}</b></div>}

              {h && (
                <div className={`cp-health cp-health-${h.band}`}>
                  <HealthRing score={h.score} color={h.color} />
                  <div className="cp-health-body">
                    <div className="cp-health-label">System Health</div>
                    <div className="cp-health-verdict" style={{ color: h.color }}>{h.verdict}</div>
                    <div className="cp-health-sub">{h.summary}</div>
                    <div className="cp-health-cta">
                      <button className="cp-btn" style={{ width: 'auto', padding: '8px 16px', margin: 0 }} onClick={() => nav(h.cta.to)}>{h.cta.label}</button>
                      {h.showQuincy && <button className="cp-btn ghost" style={{ width: 'auto', padding: '8px 16px', margin: 0 }} onClick={() => nav('/portal/quincy')}>Ask Quincy</button>}
                    </div>
                  </div>
                </div>
              )}
              {h && (
                <details className="cp-health-why">
                  <summary>Why this score</summary>
                  <ul>{h.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
                  <div className="cp-health-disc">A general guide based on age &amp; warranty — only an on-site inspection is definitive.</div>
                </details>
              )}

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
