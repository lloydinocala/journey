import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'

export default function TripChargePicker({ orgId, value, onChange }) {
  const [tripTypes, setTripTypes] = useState([])
  const [selectedTypeId, setSelectedTypeId] = useState('')
  const [variants, setVariants] = useState([])
  const [location, setLocation] = useState('')
  const [access, setAccess] = useState('')
  const [hours, setHours] = useState('')
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (!orgId) return
    supabase
      .from('services')
      .select('id, name')
      .eq('org_id', orgId)
      .eq('category', 'TRIP CHARGES')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        setTripTypes(data || [])
        setLoading(false)
      })
  }, [orgId])

  useEffect(() => {
    if (!value || initialized || tripTypes.length === 0) return
    supabase
      .from('service_prices')
      .select('id, service_id, location, access, hours')
      .eq('id', value)
      .single()
      .then(({ data }) => {
        if (data) {
          setSelectedTypeId(data.service_id)
          setLocation(data.location || '')
          setAccess(data.access || '')
          setHours(data.hours || '')
        }
        setInitialized(true)
      })
  }, [value, tripTypes, initialized])

  useEffect(() => {
    if (!selectedTypeId) {
      setVariants([])
      return
    }
    supabase
      .from('service_prices')
      .select('id, location, access, hours, price')
      .eq('service_id', selectedTypeId)
      .eq('is_active', true)
      .then(({ data }) => setVariants(data || []))
  }, [selectedTypeId])

  useEffect(() => {
    if (!selectedTypeId || !location || !access || !hours) return
    const match = variants.find((v) => v.location === location && v.access === access && v.hours === hours)
    if (match && match.id !== value) {
      onChange(match.id)
    } else if (!match && value) {
      onChange(null)
    }
  }, [selectedTypeId, location, access, hours, variants])

  const locations = [...new Set(variants.map((v) => v.location))].filter(Boolean)
  const accessOpts = [...new Set(variants.map((v) => v.access))].filter(Boolean)
  const hoursOpts = [...new Set(variants.map((v) => v.hours))].filter(Boolean)
  const resolvedPrice = variants.find((v) => v.location === location && v.access === access && v.hours === hours)

  if (loading) return <p style={{ color: 'var(--mist)', fontSize: 13 }}>Loading trip charges…</p>

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <div className="field" style={{ marginBottom: 0, minWidth: 220 }}>
        <label>Trip charge</label>
        <select
          value={selectedTypeId}
          onChange={(e) => {
            setSelectedTypeId(e.target.value)
            setLocation('')
            setAccess('')
            setHours('')
          }}
        >
          <option value="">Select…</option>
          {tripTypes.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
      {selectedTypeId && (
        <>
          <div className="field" style={{ marginBottom: 0, minWidth: 150 }}>
            <label>Location</label>
            <select value={location} onChange={(e) => setLocation(e.target.value)}>
              <option value="">Select…</option>
              {locations.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0, minWidth: 150 }}>
            <label>Access</label>
            <select value={access} onChange={(e) => setAccess(e.target.value)}>
              <option value="">Select…</option>
              {accessOpts.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0, minWidth: 150 }}>
            <label>Time of day</label>
            <select value={hours} onChange={(e) => setHours(e.target.value)}>
              <option value="">Select…</option>
              {hoursOpts.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
        </>
      )}
      {resolvedPrice && (
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--route-blue)', paddingBottom: 10 }}>
          ${resolvedPrice.price.toFixed(2)}
        </div>
      )}
    </div>
  )
}
