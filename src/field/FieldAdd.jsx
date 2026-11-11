import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import FieldShell from './FieldShell'
import QuickAddModal from '../QuickAddModal'

// +ADD — one dropdown of the things a supervisor creates from the field. When it was opened from
// the Call Console, the caller's customer record (or phone number) is picked up automatically.
const OPTIONS = [
  { key: 'job', label: 'New Job', route: '/tech/new-job' },
  { key: 'task', label: 'New Task', modal: 'task' },
  { key: 'segment', label: 'Add Segment', modal: 'continueJob' },
  { key: 'customer', label: 'New Customer', modal: 'customer' },
  { key: 'property', label: 'New Property', modal: 'property' },
  { key: 'repair', label: 'New Repair Estimate', route: '/tech/new-service-estimate', jobTypeLike: 'repair' },
  { key: 'system', label: 'New System Estimate', route: '/tech/new-system-estimate' },
  { key: 'iaq', label: 'New IAQ Estimate', route: '/tech/new-service-estimate', jobTypeLike: 'duct estimate' },
  { key: 'invoice', label: 'New Invoice', modal: 'pickInvoiceJob' },
  { key: 'filter', label: 'New Filter Order (Add-On)', modal: 'filterOrder' },
]

export default function FieldAdd({ profile }) {
  const navigate = useNavigate()
  const handoff = useLocation().state || {}
  const customer = handoff.customer || null
  const [pick, setPick] = useState(handoff.mode === 'customer' ? 'customer' : '')
  const [modal, setModal] = useState(null)
  const [done, setDone] = useState('')

  function create() {
    const o = OPTIONS.find((x) => x.key === pick)
    if (!o) return
    setDone('')
    if (o.route) navigate(o.route, { state: { customer, phone: handoff.phone || '', jobTypeLike: o.jobTypeLike || '' } })
    else setModal(o.modal)
  }

  return (
    <FieldShell profile={profile} title="+ADD" onBack={() => navigate(-1)}>
      <select className="fa-select" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="What to add">
        <option value="">+ADD ▾</option>
        {OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
      <div className="fa-panel" style={{ marginTop: 10, minHeight: 220 }}>
        {customer ? (
          <div className="fa-info">
            <div className="fa-muted" style={{ fontWeight: 700 }}>From the call</div>
            <div className="fa-info-name">{customer.display_name}</div>
            {customer.primary_phone && <div className="fa-info-line">{customer.primary_phone}</div>}
          </div>
        ) : <p className="fa-muted" style={{ margin: 4 }}>Choose what to add from the list above.</p>}
        {pick && <p style={{ margin: '4px', fontWeight: 700 }}>{OPTIONS.find((o) => o.key === pick)?.label}</p>}
        {done && <div className="fa-msg ok">{done}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
          <button type="button" className="fa-navbtn" style={{ flex: 1 }} disabled={!pick} onClick={create}>Create</button>
          <button type="button" className="fa-navbtn ghost" style={{ flex: 1 }} onClick={() => navigate(-1)}>Cancel</button>
        </div>
      </div>
      {modal && (
        <QuickAddModal mode={modal} field orgId={profile.org_id} profile={profile} prefillCustomerId={customer?.id || ''}
          onClose={() => setModal(null)}
          onCreated={() => { setModal(null); setDone('Saved.') }} />
      )}
    </FieldShell>
  )
}
