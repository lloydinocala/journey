// Tools Management · Maintenance queue
// Every tool flagged on inspection or sitting in the shop for repair, with the
// open work record. A tool can't be redeployed until its repair is verified here.
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { listTools, listToolMaintenance, sendToMaintenance, resolveMaintenance, toolLabel } from './toolsData'
import { useOrgSelector, OrgBar } from './shared'

export default function ToolMaintenance({ profile }) {
  const org = useOrgSelector(profile)
  const [tools, setTools] = useState([])
  const [open, setOpen] = useState([])       // open tool_maintenance records
  const [loading, setLoading] = useState(false)
  const [verifyId, setVerifyId] = useState(null)
  const [verifyForm, setVerifyForm] = useState({ cost: '', notes: '' })
  const [busy, setBusy] = useState(false)

  async function load() {
    if (!org.selectedOrg) return
    setLoading(true)
    const [t, m] = await Promise.all([
      listTools(org.selectedOrg, { includeRetired: false }),
      listToolMaintenance(org.selectedOrg, { openOnly: true }),
    ])
    setTools(t); setOpen(m); setLoading(false)
  }
  useEffect(() => { load() }, [org.selectedOrg])

  // Tools needing attention: in the shop for repair, or flagged on inspection.
  const queue = tools.filter((t) => t.status === 'in_maintenance' || t.needs_maintenance)
  const openFor = (toolId) => open.find((m) => m.tool_id === toolId) || null

  async function pullToShop(t) {
    setBusy(true); await sendToMaintenance(org.selectedOrg, t.id, 'Flagged on inspection'); setBusy(false); load()
  }
  function startVerify(t) {
    setVerifyId(t.id); setVerifyForm({ cost: '', notes: '' })
  }
  async function saveVerify(t) {
    const rec = openFor(t.id)
    setBusy(true)
    if (!rec) {
      // No open record (edge case) — open then immediately resolve so history is intact.
      await sendToMaintenance(org.selectedOrg, t.id, 'Repair')
      const fresh = await listToolMaintenance(org.selectedOrg, { openOnly: true, toolId: t.id })
      const r = fresh[0]
      if (r) await resolveMaintenance(org.selectedOrg, r.id, t.id, { verified_by: profile?.id || null, cost: verifyForm.cost === '' ? null : Number(verifyForm.cost), notes: verifyForm.notes.trim() || null })
    } else {
      await resolveMaintenance(org.selectedOrg, rec.id, t.id, { verified_by: profile?.id || null, cost: verifyForm.cost === '' ? null : Number(verifyForm.cost), notes: verifyForm.notes.trim() || null })
    }
    setBusy(false); setVerifyId(null); load()
  }

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Tool Maintenance</h2>
          <span className="badge">{queue.length} in queue</span>
        </div>
        <button className="logout-button" style={{ margin: 0 }} disabled={loading} onClick={load}>{loading ? 'Loading…' : 'Refresh'}</button>
      </div>
      <OrgBar {...org} />

      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0, maxWidth: 760 }}>
        Tools flagged on inspection or sent to the shop show here. Record the repair and{' '}
        <strong>Verify &amp; return to shop</strong> — only then is the tool cleared to redeploy from the{' '}
        <Link to="/tools/catalog">Tool Catalog</Link>.
      </p>

      {queue.length === 0 ? (
        <div style={{ color: '#166534', fontWeight: 600, fontSize: 14, marginTop: 12 }}>Nothing in the shop — every tool is in good standing.</div>
      ) : (
        <table className="data-table">
          <thead><tr><th>Tool</th><th>Status</th><th>Reported issue</th><th>Since</th><th></th></tr></thead>
          <tbody>
            {queue.map((t) => {
              const rec = openFor(t.id)
              const inShopForRepair = t.status === 'in_maintenance'
              return (
                <tr key={t.id}>
                  <td><strong>{toolLabel(t, tools)}</strong>{t.brand ? <span style={{ color: 'var(--mist)' }}> · {t.brand}</span> : ''}</td>
                  <td>{inShopForRepair ? 'In shop for repair' : <span style={{ color: '#B00020', fontWeight: 600 }}>Flagged — still deployed</span>}</td>
                  <td style={{ color: 'var(--mist)' }}>{rec?.description || (t.needs_maintenance ? 'Flagged on inspection' : '—')}</td>
                  <td style={{ color: 'var(--mist)' }}>{rec ? new Date(rec.opened_at).toLocaleDateString() : '—'}</td>
                  <td>
                    {verifyId === t.id ? (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div className="field" style={{ marginBottom: 0, width: 100 }}><label>Cost</label><input type="number" step="any" value={verifyForm.cost} onChange={(e) => setVerifyForm({ ...verifyForm, cost: e.target.value })} /></div>
                        <div className="field" style={{ marginBottom: 0, minWidth: 200 }}><label>What was done</label><input type="text" value={verifyForm.notes} onChange={(e) => setVerifyForm({ ...verifyForm, notes: e.target.value })} /></div>
                        <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={busy} onClick={() => saveVerify(t)}>Verify &amp; return to shop</button>
                        <button className="logout-button" onClick={() => setVerifyId(null)}>Cancel</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {!inShopForRepair && <button className="logout-button" disabled={busy} onClick={() => pullToShop(t)}>Pull to shop</button>}
                        <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => startVerify(t)}>Verify &amp; return</button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
