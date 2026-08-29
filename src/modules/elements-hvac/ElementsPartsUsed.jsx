// Elements-HVAC · Parts Used (office view). Pick a recent invoice on the left,
// reconcile and record its parts on the right. Same panel the mobile work order
// uses, so office and field post consumption through identical logic.
import { useState, useEffect, useMemo } from 'react'
import { listRecentInvoices, partsUsedStatus } from './data'
import { useOrgSelector, OrgBar } from './shared'
import ElementsPartsUsedPanel from './ElementsPartsUsedPanel'

export default function ElementsPartsUsed({ profile }) {
  const org = useOrgSelector(profile)
  const [invoices, setInvoices] = useState([])
  const [recorded, setRecorded] = useState(new Set())
  const [selectedId, setSelectedId] = useState('')
  const [view, setView] = useState('all')     // all | recorded | pending
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  async function load() {
    if (!org.selectedOrg) return
    setLoading(true)
    const list = await listRecentInvoices(org.selectedOrg)
    setInvoices(list)
    const status = await partsUsedStatus(org.selectedOrg, list.map((i) => i.id))
    setRecorded(status)
    setLoading(false)
  }
  useEffect(() => { load() }, [org.selectedOrg])

  const rows = useMemo(() => invoices.filter((i) => {
    const isRec = recorded.has(i.id)
    if (view === 'recorded' && !isRec) return false
    if (view === 'pending' && isRec) return false
    if (search) {
      const hay = `${i.invoice_number || ''} ${i.customer_name || ''} ${i.job_number || ''}`.toLowerCase()
      if (!hay.includes(search.toLowerCase())) return false
    }
    return true
  }), [invoices, recorded, view, search])

  const recordedCount = invoices.filter((i) => recorded.has(i.id)).length

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Parts Used</h2>
          <span className="badge">{recordedCount}/{invoices.length} invoices recorded</span>
        </div>
      </div>
      <OrgBar {...org} />

      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0 }}>
        Pick an invoice, confirm the parts that actually left the truck, and record them. Recording depletes stock and
        feeds the Parts Usage report. The billed invoice is what the customer pays; Parts Used is what really moved —
        they don't have to match.
      </p>

      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* LEFT — invoice list */}
        <div style={{ flex: '1 1 340px', minWidth: 300, maxWidth: 460 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 150 }}><label>Search</label>
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Invoice, customer, job…" />
            </div>
            <div className="field" style={{ marginBottom: 0 }}><label>Show</label>
              <select value={view} onChange={(e) => setView(e.target.value)}>
                <option value="all">All</option>
                <option value="pending">Not recorded</option>
                <option value="recorded">Recorded</option>
              </select>
            </div>
          </div>
          <div style={{ border: '1px solid var(--line, #E2E8F0)', borderRadius: 10, overflow: 'hidden', maxHeight: 620, overflowY: 'auto' }}>
            {loading && <div style={{ padding: 16, color: 'var(--mist)' }}>Loading invoices…</div>}
            {!loading && rows.map((i) => {
              const active = i.id === selectedId
              const isRec = recorded.has(i.id)
              return (
                <div key={i.id} onClick={() => setSelectedId(i.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                    padding: '10px 13px', cursor: 'pointer', borderBottom: '1px solid #EEF1F6',
                    background: active ? '#EEF3FB' : '#fff',
                    borderLeft: active ? '3px solid #1B3A6B' : '3px solid transparent',
                  }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: '#132A4C', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {i.invoice_number || '(no #)'}{i.customer_name && i.customer_name !== '—' ? ` · ${i.customer_name}` : ''}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--mist)' }}>
                      {i.invoice_date ? new Date(i.invoice_date).toLocaleDateString() : '—'}{i.job_number ? ` · Job ${i.job_number}` : ''}
                    </div>
                  </div>
                  <span className="badge" style={isRec ? { background: '#166534', color: '#fff', flexShrink: 0 } : { flexShrink: 0 }}>
                    {isRec ? 'recorded' : 'pending'}
                  </span>
                </div>
              )
            })}
            {!loading && rows.length === 0 && <div style={{ padding: 16, color: 'var(--mist)' }}>No invoices match this filter.</div>}
          </div>
        </div>

        {/* RIGHT — panel */}
        <div style={{ flex: '2 1 460px', minWidth: 320 }}>
          {!selectedId ? (
            <div style={{ border: '1px dashed #CBD5E1', borderRadius: 12, padding: '48px 24px', textAlign: 'center', color: 'var(--mist)' }}>
              Select an invoice to review and record its parts used.
            </div>
          ) : (
            <ElementsPartsUsedPanel key={selectedId} orgId={org.selectedOrg} invoiceId={selectedId} />
          )}
        </div>
      </div>
    </div>
  )
}
