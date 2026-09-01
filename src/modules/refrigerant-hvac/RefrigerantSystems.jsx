// Refrigerant Management · Systems
// Give each installed system a refrigerant profile — refrigerant type, full
// charge (lb), and sector. This drives the covered-vs-exempt flag and the
// leak-rate math on the dashboard and log.
import { useState, useEffect, Fragment } from 'react'
import {
  listRefrigerantSystems, updateSystemRefrigerant, listRefrigerantTypes,
  listTransactions, systemLocation, systemLeakStatus, SUBSECTORS,
} from './refrigerantData'
import { useOrgSelector, OrgBar } from '../elements-hvac/shared'

const subsectorLabel = (v) => (SUBSECTORS.find((s) => s.v === v) || {}).label || v

export default function RefrigerantSystems({ profile }) {
  const org = useOrgSelector(profile)
  const [systems, setSystems] = useState([])
  const [types, setTypes] = useState([])
  const [addedByEquip, setAddedByEquip] = useState({})
  const [onlyConfigured, setOnlyConfigured] = useState(false)
  const [loading, setLoading] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ refrigerant_type: '', refrigerant_charge_lbs: '', refrigerant_subsector: 'residential_light_commercial' })
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!org.selectedOrg) return
    setLoading(true)
    const [sys, tp, txns] = await Promise.all([
      listRefrigerantSystems(org.selectedOrg, { configuredOnly: onlyConfigured }),
      listRefrigerantTypes(),
      listTransactions(org.selectedOrg, { sinceDays: 365 }),
    ])
    const by = {}
    txns.forEach((t) => { if (t.equipment_id) by[t.equipment_id] = (by[t.equipment_id] || 0) + (Number(t.pounds_added) || 0) })
    setSystems(sys); setTypes(tp); setAddedByEquip(by); setLoading(false)
  }
  useEffect(() => { load() }, [org.selectedOrg, onlyConfigured])

  function startEdit(s) {
    setEditId(s.id)
    setForm({
      refrigerant_type: s.refrigerant_type || '',
      refrigerant_charge_lbs: s.refrigerant_charge_lbs ?? '',
      refrigerant_subsector: s.refrigerant_subsector || 'residential_light_commercial',
    })
  }
  function cancel() { setEditId(null) }

  async function save(s) {
    setSaving(true)
    const num = (x) => (x === '' || x == null ? null : Number(x))
    await updateSystemRefrigerant(s.id, {
      refrigerant_type: form.refrigerant_type || null,
      refrigerant_charge_lbs: num(form.refrigerant_charge_lbs),
      refrigerant_subsector: form.refrigerant_subsector || 'residential_light_commercial',
    })
    setSaving(false); setEditId(null); load()
  }

  const sysName = (s) => s.system_label || [s.outdoor_brand, s.outdoor_model].filter(Boolean).join(' ') || 'System'

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Refrigerant Systems</h2>
          <span className="badge">{systems.length} shown</span>
        </div>
        <button className="logout-button" style={{ margin: 0 }} disabled={loading} onClick={load}>{loading ? 'Loading…' : 'Refresh'}</button>
      </div>
      <OrgBar {...org} />

      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0, maxWidth: 820 }}>
        A system is <strong>covered</strong> by the AIM Act leak-repair rules when its full charge is <strong>15 lb or more</strong>
        {' '}and it is <strong>not</strong> a residential / light-commercial AC or heat pump. Covered systems get a leak-rate
        estimate and a 30-day repair clock; everything else is a simple usage log. Set the sector accordingly.
      </p>

      <label className="nav-link" style={{ cursor: 'pointer', display: 'inline-block', marginBottom: 12 }}>
        <input type="checkbox" checked={onlyConfigured} onChange={(e) => setOnlyConfigured(e.target.checked)} style={{ marginRight: 6 }} />
        Only systems with a refrigerant on file
      </label>

      <table className="data-table">
        <thead>
          <tr><th></th><th>System</th><th>Location</th><th>Refrigerant</th><th>Full charge</th><th>Sector</th><th>Status</th></tr>
        </thead>
        <tbody>
          {systems.map((s) => {
            const st = systemLeakStatus(s, addedByEquip[s.id] || 0)
            const editing = editId === s.id
            return (
              <Fragment key={s.id}>
                <tr>
                  <td><button className="logout-button" onClick={() => (editing ? cancel() : startEdit(s))}>{editing ? 'Cancel' : 'Edit'}</button></td>
                  <td><strong>{sysName(s)}</strong></td>
                  <td style={{ color: 'var(--mist)' }}>{systemLocation(s)}</td>
                  <td>{s.refrigerant_type || <span style={{ color: 'var(--mist)' }}>— not set —</span>}</td>
                  <td>{s.refrigerant_charge_lbs != null ? `${s.refrigerant_charge_lbs} lb` : '—'}</td>
                  <td style={{ fontSize: 13 }}>{subsectorLabel(s.refrigerant_subsector)}</td>
                  <td>
                    {s.refrigerant_type == null ? <span style={{ color: 'var(--mist)' }}>—</span>
                      : st.covered
                        ? <span className="badge" style={{ background: st.over ? '#B00020' : '#1B3A6B', color: '#fff' }}>{st.over ? `Over ${st.threshold}% · repair` : 'Covered'}</span>
                        : <span className="badge">Exempt</span>}
                    {st.covered && st.leakRate != null && <span style={{ fontSize: 12, color: 'var(--mist)', marginLeft: 6 }}>~{Math.round(st.leakRate)}%/yr</span>}
                  </td>
                </tr>
                {editing && (
                  <tr><td colSpan="7" style={{ background: '#EEF3FB' }}>
                    <div style={{ padding: '6px 2px', display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <div className="field" style={{ marginBottom: 0, minWidth: 180 }}>
                        <label>Refrigerant</label>
                        <select value={form.refrigerant_type} onChange={(e) => setForm({ ...form, refrigerant_type: e.target.value })}>
                          <option value="">— select —</option>
                          {types.map((t) => <option key={t.code} value={t.code}>{t.code}{t.name && t.name !== t.code ? ` — ${t.name}` : ''}</option>)}
                        </select>
                      </div>
                      <div className="field" style={{ marginBottom: 0, width: 140 }}>
                        <label>Full charge (lb)</label>
                        <input type="number" step="any" value={form.refrigerant_charge_lbs} onChange={(e) => setForm({ ...form, refrigerant_charge_lbs: e.target.value })} placeholder="e.g. 8" />
                      </div>
                      <div className="field" style={{ marginBottom: 0, minWidth: 300, flex: 1 }}>
                        <label>Sector (drives covered vs. exempt)</label>
                        <select value={form.refrigerant_subsector} onChange={(e) => setForm({ ...form, refrigerant_subsector: e.target.value })}>
                          {SUBSECTORS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                        </select>
                      </div>
                      <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={saving} onClick={() => save(s)}>{saving ? 'Saving…' : 'Save'}</button>
                    </div>
                  </td></tr>
                )}
              </Fragment>
            )
          })}
          {systems.length === 0 && <tr><td colSpan="7" style={{ color: 'var(--mist)' }}>{loading ? 'Loading…' : 'No systems found. Systems come from each property’s installed equipment.'}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
