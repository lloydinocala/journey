import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

const daysSince = (d) => (d ? Math.floor((Date.now() - new Date(d + 'T00:00:00').getTime()) / 86400000) : null)

export default function WarrantyRegistrations({ profile }) {
  const isSuperAdmin = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('unregistered') // unregistered | all | registered
  const [savingId, setSavingId] = useState(null)

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        if (!selectedOrg && data && data.length) setSelectedOrg(data[0].id)
      })
    }
  }, [])

  async function load(orgId) {
    if (!orgId) return
    setLoading(true)
    const { data: recs } = await supabase.from('warranty_registrations')
      .select('*').eq('org_id', orgId).order('install_date', { ascending: false })
    let list = recs || []
    const custIds = [...new Set(list.map((r) => r.customer_id).filter(Boolean))]
    const propIds = [...new Set(list.map((r) => r.property_id).filter(Boolean))]
    const jobIds = [...new Set(list.map((r) => r.job_id).filter(Boolean))]
    const [cRes, pRes, jRes] = await Promise.all([
      custIds.length ? supabase.from('customers').select('id, display_name').in('id', custIds) : Promise.resolve({ data: [] }),
      propIds.length ? supabase.from('properties').select('id, street_address, city').in('id', propIds) : Promise.resolve({ data: [] }),
      jobIds.length ? supabase.from('jobs').select('id, job_number').in('id', jobIds) : Promise.resolve({ data: [] }),
    ])
    const cById = Object.fromEntries((cRes.data || []).map((c) => [c.id, c]))
    const pById = Object.fromEntries((pRes.data || []).map((p) => [p.id, p]))
    const jById = Object.fromEntries((jRes.data || []).map((j) => [j.id, j]))
    setRows(list.map((r) => ({ ...r, _customer: cById[r.customer_id], _property: pById[r.property_id], _job: jById[r.job_id], _dirty: false })))
    setLoading(false)
  }
  useEffect(() => { if (selectedOrg || !isSuperAdmin) load(selectedOrg) }, [selectedOrg])

  const setField = (id, field, val) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: val, _dirty: true } : r)))

  async function save(r) {
    setSavingId(r.id)
    const patch = {
      brand: r.brand || null, install_date: r.install_date || null,
      indoor_model: r.indoor_model || null, indoor_serial: r.indoor_serial || null,
      outdoor_model: r.outdoor_model || null, outdoor_serial: r.outdoor_serial || null,
      furnace_model: r.furnace_model || null, furnace_serial: r.furnace_serial || null,
      registered_at: r.registered_at || null, notes: r.notes || null,
      updated_at: new Date().toISOString(),
    }
    await supabase.from('warranty_registrations').update(patch).eq('id', r.id)
    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, _dirty: false } : x)))
    setSavingId(null)
  }

  async function pullFromEquipment(r) {
    if (!r.property_id) { alert('No property on this record.'); return }
    const { data: eq } = await supabase.from('property_equipment')
      .select('outdoor_brand, outdoor_model, outdoor_serial, indoor_brand, indoor_model, indoor_serial, furnace_brand, furnace_model, furnace_serial, install_date')
      .eq('property_id', r.property_id).is('retired_at', null).order('install_date', { ascending: false }).limit(1)
    const e = eq && eq[0]
    if (!e) { alert('No equipment on file for this property yet.'); return }
    setRows((rs) => rs.map((x) => x.id === r.id ? {
      ...x, _dirty: true,
      brand: x.brand || e.outdoor_brand || e.indoor_brand || '',
      indoor_model: x.indoor_model || e.indoor_model || '', indoor_serial: x.indoor_serial || e.indoor_serial || '',
      outdoor_model: x.outdoor_model || e.outdoor_model || '', outdoor_serial: x.outdoor_serial || e.outdoor_serial || '',
      furnace_model: x.furnace_model || e.furnace_model || '', furnace_serial: x.furnace_serial || e.furnace_serial || '',
      install_date: x.install_date || e.install_date || '',
    } : x))
  }

  const shown = rows.filter((r) => filter === 'all' ? true : filter === 'registered' ? r.registered_at : !r.registered_at)

  const input = { width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #D5DAE1', fontSize: 13, boxSizing: 'border-box' }
  const lbl = { fontSize: 11, color: 'var(--mist)', display: 'block', marginBottom: 2 }

  function daysLeftPill(r) {
    if (r.registered_at) return <span style={{ fontSize: 12, fontWeight: 700, color: '#15803D', background: '#E7F5EC', padding: '2px 10px', borderRadius: 999 }}>✓ Registered {new Date(r.registered_at + 'T00:00:00').toLocaleDateString()}</span>
    const age = daysSince(r.install_date)
    const left = age == null ? null : 30 - age
    const over = left != null && left < 0
    const soon = left != null && left <= 7
    const [fg, bg] = over ? ['#B0472B', '#F7E2DA'] : soon ? ['#B45309', '#FEF3C7'] : ['#64748B', '#EEF2F6']
    return <span style={{ fontSize: 12, fontWeight: 700, color: fg, background: bg, padding: '2px 10px', borderRadius: 999 }}>{left == null ? 'no install date' : over ? `${-left} days OVERDUE` : `${left} days left`}</span>
  }

  return (
    <div>
      <h2 className="page-title">Warranty Registrations</h2>
      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: -8, marginBottom: 16, maxWidth: 680 }}>
        New systems from Retrofit jobs, to register with the manufacturer for extended warranty. You have <strong>30 days from install</strong>. Fill in the equipment, then set the <strong>Registered</strong> date once it&rsquo;s done online.
      </p>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        {isSuperAdmin && <div style={{ maxWidth: 300 }}><OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} /></div>}
        <div style={{ display: 'flex', gap: 6 }}>
          {['unregistered', 'all', 'registered'].map((f) => (
            <button key={f} className={filter === f ? 'auth-button' : 'logout-button'} style={{ width: 'auto', padding: '6px 14px', textTransform: 'capitalize' }} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
      </div>

      {loading ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : shown.length === 0 ? (
        <p style={{ color: 'var(--mist)' }}>No {filter === 'all' ? '' : filter} warranty records.</p>
      ) : shown.map((r) => (
        <div key={r.id} style={{ border: '1px solid var(--line, #E2E6ED)', borderRadius: 12, padding: 16, marginBottom: 14, background: 'var(--panel)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>
                {r.customer_id ? <Link to={`/customers/${r.customer_id}`} style={{ color: '#2E6FB5' }}>{r._customer?.display_name || 'Customer'}</Link> : (r._customer?.display_name || 'Customer')}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--mist)' }}>
                {r._property ? [r._property.street_address, r._property.city].filter(Boolean).join(', ') : '—'}
                {r._job && <> · <Link to={`/jobs?job=${r.job_id}`} style={{ color: '#2E6FB5' }}>{r._job.job_number}</Link></>}
              </div>
            </div>
            {daysLeftPill(r)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 12 }}>
            <div><label style={lbl}>Install date</label><input type="date" style={input} value={r.install_date || ''} onChange={(e) => setField(r.id, 'install_date', e.target.value)} /></div>
            <div><label style={lbl}>Brand</label><input style={input} value={r.brand || ''} onChange={(e) => setField(r.id, 'brand', e.target.value)} /></div>
            <div><label style={lbl}>Outdoor model</label><input style={input} value={r.outdoor_model || ''} onChange={(e) => setField(r.id, 'outdoor_model', e.target.value)} /></div>
            <div><label style={lbl}>Outdoor serial</label><input style={input} value={r.outdoor_serial || ''} onChange={(e) => setField(r.id, 'outdoor_serial', e.target.value)} /></div>
            <div><label style={lbl}>Indoor model</label><input style={input} value={r.indoor_model || ''} onChange={(e) => setField(r.id, 'indoor_model', e.target.value)} /></div>
            <div><label style={lbl}>Indoor serial</label><input style={input} value={r.indoor_serial || ''} onChange={(e) => setField(r.id, 'indoor_serial', e.target.value)} /></div>
            <div><label style={lbl}>Furnace model</label><input style={input} value={r.furnace_model || ''} onChange={(e) => setField(r.id, 'furnace_model', e.target.value)} /></div>
            <div><label style={lbl}>Furnace serial</label><input style={input} value={r.furnace_serial || ''} onChange={(e) => setField(r.id, 'furnace_serial', e.target.value)} /></div>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ width: 170 }}>
              <label style={{ ...lbl, color: '#15803D', fontWeight: 700 }}>Registered on</label>
              <input type="date" style={{ ...input, borderColor: r.registered_at ? '#15803D' : '#D5DAE1' }} value={r.registered_at || ''} onChange={(e) => setField(r.id, 'registered_at', e.target.value)} />
            </div>
            <button className="logout-button" style={{ padding: '7px 14px' }} onClick={() => pullFromEquipment(r)}>Pull from Equipment on File</button>
            <button className="auth-button" style={{ width: 'auto', padding: '7px 18px' }} disabled={!r._dirty || savingId === r.id} onClick={() => save(r)}>
              {savingId === r.id ? 'Saving…' : r._dirty ? 'Save' : 'Saved'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
