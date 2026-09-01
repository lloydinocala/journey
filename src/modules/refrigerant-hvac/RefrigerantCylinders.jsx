// Refrigerant Management · Cylinders (cradle-to-grave)
// Track each cylinder end-to-end: virgin refrigerant purchased and put in
// service, recovered refrigerant accumulating on hand, then sent to a reclaimer
// or to certified disposal with a date, recipient, and document reference.
import { useState, useEffect, Fragment } from 'react'
import { listCylinders, addCylinder, sendCylinder, listRefrigerantTypes } from './refrigerantData'
import { useOrgSelector, OrgBar } from '../elements-hvac/shared'

const today = () => new Date().toISOString().slice(0, 10)
const lbs = (n) => (n == null || isNaN(n) ? '—' : `${Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 })} lb`)
const blank = { refrigerant_type: '', kind: 'virgin', nominal_size_lbs: '', on_hand_lbs: '', vendor: '', acquired_date: today(), notes: '' }

const STATUS_LABEL = { in_service: 'In service', sent_reclaim: 'Sent to reclaim', sent_disposal: 'Sent to disposal' }

export default function RefrigerantCylinders({ profile }) {
  const org = useOrgSelector(profile)
  const [cyls, setCyls] = useState([])
  const [types, setTypes] = useState([])
  const [includeSent, setIncludeSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [sendId, setSendId] = useState(null)
  const [sendForm, setSendForm] = useState({ status: 'sent_reclaim', sent_to: '', doc_ref: '' })
  const [busy, setBusy] = useState(false)

  async function load() {
    if (!org.selectedOrg) return
    setLoading(true)
    const [c, tp] = await Promise.all([
      listCylinders(org.selectedOrg, { includeSent }),
      listRefrigerantTypes(),
    ])
    setCyls(c); setTypes(tp); setLoading(false)
  }
  useEffect(() => { load() }, [org.selectedOrg, includeSent])

  async function handleAdd(e) {
    e.preventDefault(); setError('')
    setSaving(true)
    const { error: err } = await addCylinder(org.selectedOrg, form)
    setSaving(false)
    if (err) { setError(err.message); return }
    setForm(blank); setShowForm(false); load()
  }

  function openSend(c) { setSendId(c.id); setSendForm({ status: 'sent_reclaim', sent_to: '', doc_ref: '' }) }
  async function doSend(c) {
    setBusy(true)
    await sendCylinder(org.selectedOrg, c.id, sendForm)
    setBusy(false); setSendId(null); load()
  }

  const typeLabel = (code) => { const t = types.find((x) => x.code === code); return t ? (t.name && t.name !== t.code ? `${t.code} — ${t.name}` : t.code) : (code || '—') }

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Refrigerant Cylinders</h2>
          <span className="badge">{cyls.length} shown</span>
        </div>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => { setShowForm((s) => !s); setError('') }}>
          {showForm ? 'Cancel' : '+ Add cylinder'}
        </button>
      </div>
      <OrgBar {...org} />

      {showForm && (
        <form className="inline-form" onSubmit={handleAdd} style={{ marginBottom: 20, flexWrap: 'wrap' }}>
          <div className="field" style={{ minWidth: 150 }}>
            <label>Kind</label>
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              <option value="virgin">Virgin (purchased)</option>
              <option value="recovered">Recovered (empty recovery cylinder)</option>
            </select>
          </div>
          <div className="field" style={{ minWidth: 180 }}>
            <label>Refrigerant</label>
            <select value={form.refrigerant_type} onChange={(e) => setForm({ ...form, refrigerant_type: e.target.value })}>
              <option value="">— select —</option>
              {types.map((t) => <option key={t.code} value={t.code}>{t.code}{t.name && t.name !== t.code ? ` — ${t.name}` : ''}</option>)}
            </select>
          </div>
          <div className="field" style={{ width: 130 }}><label>Cylinder size (lb)</label><input type="number" step="any" value={form.nominal_size_lbs} onChange={(e) => setForm({ ...form, nominal_size_lbs: e.target.value })} placeholder="e.g. 25" /></div>
          <div className="field" style={{ width: 130 }}><label>Currently on hand (lb)</label><input type="number" step="any" value={form.on_hand_lbs} onChange={(e) => setForm({ ...form, on_hand_lbs: e.target.value })} placeholder={form.kind === 'virgin' ? 'e.g. 25' : '0'} /></div>
          <div className="field" style={{ minWidth: 160 }}><label>Vendor</label><input type="text" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="Supply house" /></div>
          <div className="field" style={{ width: 150 }}><label>Acquired</label><input type="date" value={form.acquired_date} onChange={(e) => setForm({ ...form, acquired_date: e.target.value })} /></div>
          <div className="field" style={{ minWidth: 200, flex: 1 }}><label>Notes</label><input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Cylinder ID / serial, etc." /></div>
          <button className="auth-button" type="submit" disabled={saving} style={{ width: 'auto' }}>{saving ? 'Saving…' : 'Add cylinder'}</button>
        </form>
      )}
      {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}

      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0, maxWidth: 820 }}>
        On-hand pounds move automatically: charging a system on the <strong>Usage Log</strong> draws down a virgin cylinder,
        and recovering refrigerant credits a recovered cylinder. When a recovered cylinder is full, send it to a certified
        reclaimer or for disposal and record the shipment below — that closes the cradle-to-grave chain.
      </p>

      <label className="nav-link" style={{ cursor: 'pointer', display: 'inline-block', marginBottom: 12 }}>
        <input type="checkbox" checked={includeSent} onChange={(e) => setIncludeSent(e.target.checked)} style={{ marginRight: 6 }} />
        Show cylinders sent to reclaim / disposal
      </label>

      <table className="data-table">
        <thead>
          <tr><th></th><th>Kind</th><th>Refrigerant</th><th>On hand</th><th>Size</th><th>Vendor</th><th>Acquired</th><th>Status</th></tr>
        </thead>
        <tbody>
          {cyls.map((c) => (
            <Fragment key={c.id}>
              <tr>
                <td>
                  {c.status === 'in_service'
                    ? <button className="logout-button" onClick={() => (sendId === c.id ? setSendId(null) : openSend(c))}>{sendId === c.id ? 'Cancel' : 'Send out'}</button>
                    : <span style={{ color: 'var(--mist)', fontSize: 12 }}>closed</span>}
                </td>
                <td>{c.kind === 'virgin' ? 'Virgin' : 'Recovered'}</td>
                <td>{typeLabel(c.refrigerant_type)}</td>
                <td><strong>{lbs(c.on_hand_lbs)}</strong></td>
                <td style={{ color: 'var(--mist)' }}>{c.nominal_size_lbs != null ? `${c.nominal_size_lbs} lb` : '—'}</td>
                <td style={{ color: 'var(--mist)' }}>{c.vendor || '—'}</td>
                <td style={{ color: 'var(--mist)' }}>{c.acquired_date || '—'}</td>
                <td>
                  {STATUS_LABEL[c.status] || c.status}
                  {c.status !== 'in_service' && c.sent_at && <span style={{ fontSize: 12, color: 'var(--mist)', display: 'block' }}>{c.sent_at}{c.sent_to ? ` · ${c.sent_to}` : ''}{c.doc_ref ? ` · ${c.doc_ref}` : ''}</span>}
                </td>
              </tr>
              {sendId === c.id && (
                <tr><td colSpan="8" style={{ background: '#FFF7ED' }}>
                  <div style={{ padding: '6px 2px', display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div className="field" style={{ marginBottom: 0, minWidth: 180 }}>
                      <label>Send to</label>
                      <select value={sendForm.status} onChange={(e) => setSendForm({ ...sendForm, status: e.target.value })}>
                        <option value="sent_reclaim">Certified reclaimer</option>
                        <option value="sent_disposal">Certified disposal</option>
                      </select>
                    </div>
                    <div className="field" style={{ marginBottom: 0, minWidth: 200 }}>
                      <label>Recipient</label>
                      <input type="text" value={sendForm.sent_to} onChange={(e) => setSendForm({ ...sendForm, sent_to: e.target.value })} placeholder="Reclaimer / disposal facility" />
                    </div>
                    <div className="field" style={{ marginBottom: 0, minWidth: 200, flex: 1 }}>
                      <label>Document reference</label>
                      <input type="text" value={sendForm.doc_ref} onChange={(e) => setSendForm({ ...sendForm, doc_ref: e.target.value })} placeholder="Manifest / ticket / invoice #" />
                    </div>
                    <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={busy} onClick={() => doSend(c)}>Record shipment</button>
                  </div>
                </td></tr>
              )}
            </Fragment>
          ))}
          {cyls.length === 0 && <tr><td colSpan="8" style={{ color: 'var(--mist)' }}>{loading ? 'Loading…' : 'No cylinders on file. Add a virgin cylinder as it’s purchased, or a recovery cylinder to receive recovered refrigerant.'}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
