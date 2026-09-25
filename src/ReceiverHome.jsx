// Journey · Mobile · Receiver — Home / dock.
// The day at a glance: deliveries to receive and emailed invoices waiting. The
// big button starts a receiving run. Quantities only — prices/payment are the
// office's job (A/P), which keeps the person who confirms what arrived separate
// from the person who ordered and pays for it.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconReceipt } from './MobileIcons'
import { listPurchaseOrders, countInboundInvoices } from './modules/elements-hvac/data'

const tile = { border: '1px solid var(--border,#e2e8f0)', borderRadius: 12, padding: '16px', textAlign: 'center', background: '#fff' }
const num = { fontSize: 30, fontWeight: 800, color: '#1B3A6B' }
const lbl = { fontSize: 12.5, color: 'var(--mist)', marginTop: 4 }

export default function ReceiverHome({ profile }) {
  const navigate = useNavigate()
  const orgId = profile?.org_id
  const [openPos, setOpenPos] = useState(null)
  const [emailed, setEmailed] = useState(null)

  useEffect(() => {
    if (!orgId) return
    listPurchaseOrders(orgId)
      .then((pos) => setOpenPos((pos || []).filter((p) => p.status === 'ordered' || p.status === 'partial').length))
      .catch(() => setOpenPos(0))
    countInboundInvoices(orgId).then(setEmailed).catch(() => setEmailed(0))
  }, [orgId])

  return (
    <div className="mobile-shell job-card-v2">
      <div className="jc-header">
        <div className="jc-header-text">
          <div className="jc-title">Receiving</div>
          {profile?.full_name ? <div style={{ fontSize: 13, opacity: 0.8 }}>{profile.full_name}</div> : null}
        </div>
      </div>
      <div className="jc-body" style={{ paddingBottom: 96 }}>
        <button
          className="auth-button"
          style={{ width: '100%', padding: '16px', fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, margin: 0 }}
          onClick={() => navigate('/receiver/receive')}
        >
          <IconReceipt /> Receive a delivery
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
          <div style={{ ...tile, cursor: 'pointer' }} onClick={() => navigate('/receiver/receive')}>
            <div style={num}>{openPos == null ? '…' : openPos}</div>
            <div style={lbl}>Deliveries to receive</div>
          </div>
          <div style={tile}>
            <div style={num}>{emailed == null ? '…' : emailed}</div>
            <div style={lbl}>Emailed invoices</div>
          </div>
        </div>

        <p className="jc-muted-note" style={{ marginTop: 18 }}>
          Count in what physically arrives, against its purchase order. Prices and payment are handled later in the office — you confirm quantities.
        </p>
      </div>
    </div>
  )
}
