// Draft POs from shortfalls. Turns the replenishment list (items at/under reorder)
// into ready-to-review draft purchase orders, one per vendor+location, choosing
// each item's vendor by its sourcing preference: 'preferred' → the item's primary
// vendor; 'cheapest' → the lowest-cost vendor on file. Nothing is ordered — it
// creates DRAFT POs the buyer reviews, edits, and sends.
import { useState } from 'react'
import { supabase } from '../../utils/supabase'
import { listReplenishment, createPurchaseOrder } from './data'

const money = (n) => (n == null || isNaN(n) ? '—' : `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`)

export default function PoDrafter({ orgId, onCreated }) {
  const [open, setOpen] = useState(false)
  const [groups, setGroups] = useState(null)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')

  async function build() {
    setGroups(null); setMsg('')
    const short = await listReplenishment(orgId)
    if (!short.length) { setGroups([]); return }
    const itemIds = [...new Set(short.map((s) => s.item_id))]
    const [{ data: items }, { data: iv }, { data: vendors }] = await Promise.all([
      supabase.from('elements_items').select('id, primary_vendor_id, sourcing_pref, last_cost, standard_cost').in('id', itemIds),
      supabase.from('elements_item_vendors').select('item_id, vendor_id, last_cost').in('item_id', itemIds),
      supabase.from('vendors').select('id, name').eq('org_id', orgId),
    ])
    const itemMeta = Object.fromEntries((items || []).map((i) => [i.id, i]))
    const vName = Object.fromEntries((vendors || []).map((v) => [v.id, v.name]))
    const offersByItem = {}
    ;(iv || []).forEach((o) => { (offersByItem[o.item_id] ||= []).push(o) })

    const byGroup = {}; const noVendor = []
    short.forEach((s) => {
      const m = itemMeta[s.item_id] || {}
      const pref = m.sourcing_pref || 'preferred'
      const offers = (offersByItem[s.item_id] || []).filter((o) => o.vendor_id)
      let vendorId = null; let cost = null
      if (pref === 'cheapest' && offers.length) {
        const cheapest = offers.slice().filter((o) => o.last_cost != null).sort((a, b) => Number(a.last_cost) - Number(b.last_cost))[0] || offers[0]
        vendorId = cheapest.vendor_id; cost = cheapest.last_cost
      } else {
        vendorId = m.primary_vendor_id || (offers[0] && offers[0].vendor_id) || null
        const match = offers.find((o) => o.vendor_id === vendorId)
        cost = match ? match.last_cost : (m.last_cost ?? m.standard_cost ?? s.item?.last_cost ?? null)
      }
      const line = { item_id: s.item_id, description: s.item?.description || '', qty_ordered: s.suggest, unit_cost: cost, pref, on_hand: s.on_hand, reorder: s.reorder, location_name: s.location?.name }
      if (!vendorId) { noVendor.push(line); return }
      const key = `${vendorId}|${s.location_id}`
      ;(byGroup[key] ||= { vendor_id: vendorId, vendor_name: vName[vendorId] || 'Vendor', location_id: s.location_id, location_name: s.location?.name, lines: [] }).lines.push(line)
    })
    const out = Object.values(byGroup).sort((a, b) => a.vendor_name.localeCompare(b.vendor_name))
    if (noVendor.length) out.push({ noVendor: true, vendor_name: 'No vendor on file', lines: noVendor })
    setGroups(out)
  }

  function toggle() { const n = !open; setOpen(n); if (n && groups == null) build() }

  async function createOne(g, idx) {
    setBusy(String(idx)); setMsg('')
    const { po, error } = await createPurchaseOrder(orgId, {
      vendor_id: g.vendor_id, location_id: g.location_id,
      notes: 'Drafted from replenishment shortfalls',
      lines: g.lines.map((l) => ({ item_id: l.item_id, description: l.description, qty_ordered: l.qty_ordered, unit_cost: l.unit_cost })),
    })
    setBusy('')
    if (error) { setMsg('Could not create: ' + error.message); return }
    setMsg(`Created draft ${po?.po_number || 'PO'} for ${g.vendor_name}.`)
    setGroups((gs) => gs.filter((_, i) => i !== idx))
    onCreated && onCreated()
  }

  return (
    <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: 12, margin: '8px 0 16px', background: '#FBFCFE' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={toggle}
          style={{ border: '1px solid #1B3A6B', background: '#fff', color: '#1B3A6B', fontWeight: 600, fontSize: 13, borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
          {open ? 'Hide PO drafts' : '🧾 Draft POs from shortfalls'}
        </button>
        {open && groups != null && <span style={{ fontSize: 12.5, color: 'var(--mist)', marginLeft: 'auto' }}>{groups.filter((g) => !g.noVendor).length} draft{groups.filter((g) => !g.noVendor).length === 1 ? '' : 's'} · one per vendor + location</span>}
      </div>
      {msg && <div style={{ marginTop: 8, background: '#E3F1E8', border: '1px solid #166534', color: '#166534', padding: '6px 10px', borderRadius: 8, fontSize: 13 }}>{msg}</div>}

      {open && (
        groups == null ? <p style={{ color: 'var(--mist)', fontSize: 13, margin: '10px 2px 2px' }}>Reading shortfalls…</p> : groups.length === 0 ? (
          <p style={{ color: 'var(--mist)', fontSize: 13, margin: '10px 2px 2px' }}>Nothing is at or under its reorder point right now.</p>
        ) : (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {groups.map((g, idx) => (
              <div key={idx} style={{ border: '1px solid #EEF2F8', borderRadius: 8, padding: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <strong style={{ color: '#132A4C' }}>{g.vendor_name}</strong>
                  {g.location_name && <span style={{ fontSize: 12, color: 'var(--mist)' }}>· {g.location_name}</span>}
                  <span className="badge" style={{ background: '#EEF1F6', color: '#475569' }}>{g.lines.length} item{g.lines.length === 1 ? '' : 's'}</span>
                  {!g.noVendor && (
                    <button className="auth-button" style={{ width: 'auto', margin: '0 0 0 auto', padding: '5px 12px' }} disabled={busy === String(idx)} onClick={() => createOne(g, idx)}>{busy === String(idx) ? 'Creating…' : 'Create draft PO'}</button>
                  )}
                </div>
                <table className="data-table" style={{ fontSize: 12.5, width: '100%' }}>
                  <thead><tr><th>Item</th><th style={{ textAlign: 'right' }}>On hand</th><th style={{ textAlign: 'right' }}>Order</th><th style={{ textAlign: 'right' }}>Est. cost</th><th>Sourcing</th></tr></thead>
                  <tbody>
                    {g.lines.map((l, i) => (
                      <tr key={i}>
                        <td>{l.description}</td>
                        <td style={{ textAlign: 'right', color: 'var(--mist)' }}>{l.on_hand} / {l.reorder}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{l.qty_ordered}</td>
                        <td style={{ textAlign: 'right' }}>{l.unit_cost == null ? '—' : money(Number(l.unit_cost) * Number(l.qty_ordered))}</td>
                        <td style={{ color: 'var(--mist)' }}>{l.pref}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {g.noVendor && <div style={{ fontSize: 12, color: '#B0600A', marginTop: 4 }}>Set a primary vendor (or a vendor cost) on these items to include them in a draft.</div>}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
