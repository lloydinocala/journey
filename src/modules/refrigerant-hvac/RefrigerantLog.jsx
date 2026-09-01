// Refrigerant Management · Usage Log
// Record refrigerant added (charged) or recovered on a job, tied to a system,
// a technician (with an EPA-cert check), and the cylinder it came from / went
// into. History filters by location and refrigerant, and a per-system leak-rate
// summary rolls up the trailing 12 months against each covered system's charge.
import { useState, useEffect, useMemo } from 'react'
import {
  listRefrigerantSystems, listTransactions, addTransaction, listCylinders,
  listTechCerts, systemLocation, systemLeakStatus, CERT_TYPES,
} from './refrigerantData'
import { listTechnicians } from '../elements-hvac/data'
import { useOrgSelector, OrgBar } from '../elements-hvac/shared'

const today = () => new Date().toISOString().slice(0, 10)
const lbs = (n) => (n == null || n === 0 || isNaN(n) ? '—' : `${Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 })} lb`)
const REASONS = [
  { v: 'topoff', label: 'Top-off / leak add' },
  { v: 'repair', label: 'Repair (post-fix charge)' },
  { v: 'install', label: 'New install charge' },
  { v: 'recovery', label: 'Recovery (service/removal)' },
  { v: 'retirement', label: 'Retirement / disposal recovery' },
  { v: 'other', label: 'Other' },
]
const reasonLabel = (v) => (REASONS.find((r) => r.v === v) || {}).label || v
const blankTxn = { txn_date: today(), equipment_id: '', technician_user_id: '', tech_cert_type: '', refrigerant_type: '', pounds_added: '', pounds_recovered: '', cylinder_id: '', reason: 'topoff', notes: '' }

export default function RefrigerantLog({ profile }) {
  const org = useOrgSelector(profile)
  const [systems, setSystems] = useState([])
  const [techs, setTechs] = useState([])
  const [certs, setCerts] = useState({})
  const [cyls, setCyls] = useState([])
  const [txns, setTxns] = useState([])
  const [filterLoc, setFilterLoc] = useState('')
  const [filterType, setFilterType] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(blankTxn)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function load() {
    if (!org.selectedOrg) return
    setLoading(true)
    const [sys, tech, cert, cyl, tx] = await Promise.all([
      listRefrigerantSystems(org.selectedOrg, { configuredOnly: true }),
      listTechnicians(org.selectedOrg),
      listTechCerts(org.selectedOrg),
      listCylinders(org.selectedOrg, { includeSent: false }),
      listTransactions(org.selectedOrg, { sinceDays: 400 }),
    ])
    setSystems(sys); setTechs(tech); setCerts(cert); setCyls(cyl); setTxns(tx); setLoading(false)
  }
  useEffect(() => { load() }, [org.selectedOrg])

  const sysById = useMemo(() => Object.fromEntries(systems.map((s) => [s.id, s])), [systems])
  const techName = (id) => techs.find((t) => t.id === id)?.full_name || '—'
  const sysName = (s) => s?.system_label || [s?.outdoor_brand, s?.outdoor_model].filter(Boolean).join(' ') || 'System'

  function onPickSystem(id) {
    const s = sysById[id]
    setForm((f) => ({ ...f, equipment_id: id, property_id: s?.property_id || '', refrigerant_type: s?.refrigerant_type || f.refrigerant_type }))
  }
  function onPickTech(id) {
    const c = certs[id]
    setForm((f) => ({ ...f, technician_user_id: id, tech_cert_type: f.tech_cert_type || '' }))
  }

  const selectedCert = form.technician_user_id ? certs[form.technician_user_id] : null
  const certExpired = selectedCert && selectedCert.expiry_date && selectedCert.expiry_date < today()

  async function handleSubmit(e) {
    e.preventDefault(); setError('')
    if (!form.equipment_id) { setError('Pick the system this refrigerant applies to.'); return }
    if (!Number(form.pounds_added) && !Number(form.pounds_recovered)) { setError('Enter pounds added and/or recovered.'); return }
    setSaving(true)
    const s = sysById[form.equipment_id]
    const { error: err } = await addTransaction(org.selectedOrg, {
      ...form,
      property_id: s?.property_id || null,
      refrigerant_type: form.refrigerant_type || s?.refrigerant_type || null,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    setForm(blankTxn); setShowForm(false); load()
  }

  // History with filters.
  const shown = txns.filter((t) => {
    if (filterType && t.refrigerant_type !== filterType) return false
    if (filterLoc && (sysById[t.equipment_id]?.property_id || '') !== filterLoc) return false
    return true
  })

  // By-system leak-rate summary (trailing 12 months added vs. full charge).
  const since365 = (() => { const d = new Date(); d.setDate(d.getDate() - 365); return d.toISOString().slice(0, 10) })()
  const addedByEquip = useMemo(() => {
    const by = {}
    txns.forEach((t) => { if (t.equipment_id && t.txn_date >= since365) by[t.equipment_id] = (by[t.equipment_id] || 0) + (Number(t.pounds_added) || 0) })
    return by
  }, [txns, since365])

  const locations = useMemo(() => {
    const seen = {}
    systems.forEach((s) => { if (s.property_id && !seen[s.property_id]) seen[s.property_id] = systemLocation(s) })
    return Object.entries(seen).map(([id, label]) => ({ id, label }))
  }, [systems])
  const typesInUse = useMemo(() => Array.from(new Set(txns.map((t) => t.refrigerant_type).filter(Boolean))).sort(), [txns])

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Refrigerant Usage Log</h2>
          <span className="badge">{shown.length} shown</span>
        </div>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => { setShowForm((s) => !s); setError('') }}>
          {showForm ? 'Cancel' : '+ Record event'}
        </button>
      </div>
      <OrgBar {...org} />

      {showForm && (
        <form className="inline-form" onSubmit={handleSubmit} style={{ marginBottom: 20, flexWrap: 'wrap' }}>
          <div className="field" style={{ width: 150 }}><label>Date</label><input type="date" value={form.txn_date} onChange={(e) => setForm({ ...form, txn_date: e.target.value })} /></div>
          <div className="field" style={{ minWidth: 260 }}>
            <label>System</label>
            <select value={form.equipment_id} onChange={(e) => onPickSystem(e.target.value)} required>
              <option value="">— select system —</option>
              {systems.map((s) => <option key={s.id} value={s.id}>{sysName(s)} · {systemLocation(s)}</option>)}
            </select>
          </div>
          <div className="field" style={{ minWidth: 180 }}>
            <label>Technician</label>
            <select value={form.technician_user_id} onChange={(e) => onPickTech(e.target.value)}>
              <option value="">— select —</option>
              {techs.map((t) => <option key={t.id} value={t.id}>{t.full_name}{certs[t.id] ? '' : ' (no 608 on file)'}</option>)}
            </select>
          </div>
          <div className="field" style={{ minWidth: 150 }}>
            <label>Cert type</label>
            <select value={form.tech_cert_type} onChange={(e) => setForm({ ...form, tech_cert_type: e.target.value })}>
              <option value="">— select —</option>
              {CERT_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field" style={{ width: 130 }}><label>Added (lb)</label><input type="number" step="any" value={form.pounds_added} onChange={(e) => setForm({ ...form, pounds_added: e.target.value })} placeholder="0" /></div>
          <div className="field" style={{ width: 130 }}><label>Recovered (lb)</label><input type="number" step="any" value={form.pounds_recovered} onChange={(e) => setForm({ ...form, pounds_recovered: e.target.value })} placeholder="0" /></div>
          <div className="field" style={{ minWidth: 200 }}>
            <label>Cylinder</label>
            <select value={form.cylinder_id} onChange={(e) => setForm({ ...form, cylinder_id: e.target.value })}>
              <option value="">— none / unspecified —</option>
              {cyls.map((c) => <option key={c.id} value={c.id}>{c.kind === 'virgin' ? 'Virgin' : 'Recovered'} · {c.refrigerant_type || '?'} · {lbs(c.on_hand_lbs)} on hand</option>)}
            </select>
          </div>
          <div className="field" style={{ minWidth: 190 }}>
            <label>Reason</label>
            <select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
              {REASONS.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
            </select>
          </div>
          <div className="field" style={{ minWidth: 220, flex: 1 }}><label>Notes</label><input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Leak location, repair made, etc." /></div>
          {form.technician_user_id && !selectedCert && (
            <div style={{ flexBasis: '100%', color: '#B8720A', fontSize: 13, fontWeight: 600 }}>⚠ No Section 608 / EPA certification on file for this technician. Section 608 requires a certified tech to handle refrigerant.</div>
          )}
          {certExpired && (
            <div style={{ flexBasis: '100%', color: '#B00020', fontSize: 13, fontWeight: 600 }}>⚠ This technician’s certification on file expired {selectedCert.expiry_date}.</div>
          )}
          <button className="auth-button" type="submit" disabled={saving} style={{ width: 'auto' }}>{saving ? 'Saving…' : 'Record event'}</button>
        </form>
      )}
      {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Per-system leak-rate summary (covered systems, trailing 12 months) */}
      {systems.some((s) => systemLeakStatus(s, addedByEquip[s.id] || 0).covered) && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, color: '#1B3A6B', marginBottom: 8 }}>Covered systems — trailing-12-month leak rate</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {systems.filter((s) => systemLeakStatus(s, addedByEquip[s.id] || 0).covered).map((s) => {
              const st = systemLeakStatus(s, addedByEquip[s.id] || 0)
              return (
                <div key={s.id} style={{ fontSize: 13 }}>
                  <strong>{sysName(s)}</strong> <span style={{ color: 'var(--mist)' }}>· {systemLocation(s)} · {s.refrigerant_type} · {addedByEquip[s.id] ? `${lbs(addedByEquip[s.id])} added / ${s.refrigerant_charge_lbs} lb charge` : 'no adds'} · </span>
                  <span style={{ color: st.over ? '#B00020' : '#0B7A3B', fontWeight: 700 }}>~{Math.round(st.leakRate || 0)}%{st.over ? ` — over ${st.threshold}%, repair within 30 days` : ` (limit ${st.threshold}%)`}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12 }}>
        <div className="field" style={{ marginBottom: 0, minWidth: 220 }}>
          <label>Filter by location</label>
          <select value={filterLoc} onChange={(e) => setFilterLoc(e.target.value)}>
            <option value="">All locations</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0, minWidth: 160 }}>
          <label>Filter by refrigerant</label>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">All refrigerants</option>
            {typesInUse.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {(filterLoc || filterType) && <button className="logout-button" style={{ margin: 0 }} onClick={() => { setFilterLoc(''); setFilterType('') }}>Clear</button>}
      </div>

      <table className="data-table">
        <thead>
          <tr><th>Date</th><th>System</th><th>Location</th><th>Refrigerant</th><th>Added</th><th>Recovered</th><th>Reason</th><th>Technician</th><th>Notes</th></tr>
        </thead>
        <tbody>
          {shown.map((t) => {
            const s = sysById[t.equipment_id]
            return (
              <tr key={t.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{t.txn_date}</td>
                <td>{sysName(s)}</td>
                <td style={{ color: 'var(--mist)' }}>{s ? systemLocation(s) : '—'}</td>
                <td>{t.refrigerant_type || '—'}</td>
                <td>{lbs(t.pounds_added)}</td>
                <td>{lbs(t.pounds_recovered)}</td>
                <td style={{ fontSize: 13 }}>{reasonLabel(t.reason)}</td>
                <td style={{ color: 'var(--mist)' }}>{techName(t.technician_user_id)}{t.tech_cert_type ? ` · ${t.tech_cert_type}` : ''}</td>
                <td style={{ color: 'var(--mist)', fontSize: 13 }}>{t.notes || ''}</td>
              </tr>
            )
          })}
          {shown.length === 0 && <tr><td colSpan="9" style={{ color: 'var(--mist)' }}>{loading ? 'Loading…' : 'No refrigerant events recorded yet.'}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
