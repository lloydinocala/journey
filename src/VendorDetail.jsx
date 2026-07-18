import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'

export default function VendorDetail({ profile }) {
  const { vendorId } = useParams()
  const navigate = useNavigate()

  const [vendor, setVendor] = useState(null)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  const [editingId, setEditingId] = useState(null)
  const [editPo, setEditPo] = useState('')
  const [editDeliveryDate, setEditDeliveryDate] = useState('')

  async function loadAll() {
    setLoading(true)
    const [{ data: vendorData }, { data: ordersData }] = await Promise.all([
      supabase.from('vendors').select('*').eq('id', vendorId).single(),
      supabase
        .from('parts_orders')
        .select('id, po_number, part_description, part_number, expected_delivery_date, delivery_verified, segment_assigned, created_at, jobs ( job_number, properties ( street_address, customers!properties_customer_id_fkey ( display_name ) ) )')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false }),
    ])
    setVendor(vendorData)
    setOrders(ordersData || [])
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
  }, [vendorId])

  function startEdit(o) {
    setEditingId(o.id)
    setEditPo(o.po_number || '')
    setEditDeliveryDate(o.expected_delivery_date || '')
  }

  async function saveEdit(id) {
    await supabase.from('parts_orders').update({ po_number: editPo.trim() || null, expected_delivery_date: editDeliveryDate || null }).eq('id', id)
    setEditingId(null)
    loadAll()
  }

  function emailOrderLink(o) {
    if (!vendor?.email) return null
    const subject = encodeURIComponent(`Parts order — Job ${o.jobs?.job_number || ''}${o.po_number ? ' — PO ' + o.po_number : ''}`)
    const body = encodeURIComponent(
      `Hi ${vendor.sales_rep_name || 'there'},\n\n` +
      `Placing an order for the following:\n\n` +
      `Part: ${o.part_description}${o.part_number ? ' (Part # ' + o.part_number + ')' : ''}\n` +
      `Job #: ${o.jobs?.job_number || ''}\n` +
      `Property: ${o.jobs?.properties?.street_address || ''}\n` +
      (o.po_number ? `PO #: ${o.po_number}\n` : '') +
      `\nPlease confirm availability and expected delivery date.\n\nThanks,\n`
    )
    return `mailto:${vendor.email}?subject=${subject}&body=${body}`
  }

  if (loading) return <p style={{ color: 'var(--mist)' }}>Loading…</p>
  if (!vendor) return <p style={{ color: '#C0392B' }}>Vendor not found.</p>

  return (
    <div>
      <div className="page-header-bar">
        <h2>{vendor.name}</h2>
        <button className="logout-button" onClick={() => navigate('/vendors')}>← All Vendors</button>
      </div>

      <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap', marginBottom: 28 }}>
        <div>
          <h3 style={{ fontSize: 15, marginBottom: 8 }}>Contact</h3>
          {vendor.phone && <p style={{ margin: '2px 0' }}><a href={`tel:${vendor.phone}`}>{vendor.phone}</a></p>}
          {vendor.email && <p style={{ margin: '2px 0' }}><a href={`mailto:${vendor.email}`}>{vendor.email}</a></p>}
          {vendor.street_address && <p style={{ margin: '2px 0' }}>{vendor.street_address}</p>}
          {(vendor.city || vendor.state || vendor.zip) && (
            <p style={{ margin: '2px 0' }}>{[vendor.city, vendor.state, vendor.zip].filter(Boolean).join(', ')}</p>
          )}
        </div>
        <div>
          <h3 style={{ fontSize: 15, marginBottom: 8 }}>Account</h3>
          {vendor.account_number && <p style={{ margin: '2px 0' }}>{vendor.account_number}</p>}
          {vendor.billing_type && <p style={{ margin: '2px 0' }}>{vendor.billing_type}</p>}
          {vendor.sales_rep_name && <p style={{ margin: '2px 0' }}>Sales Rep: {vendor.sales_rep_name}</p>}
          {vendor.sales_rep_phone && <p style={{ margin: '2px 0' }}><a href={`tel:${vendor.sales_rep_phone}`}>{vendor.sales_rep_phone}</a></p>}
        </div>
        {vendor.notes && (
          <div>
            <h3 style={{ fontSize: 15, marginBottom: 8 }}>Notes</h3>
            <p style={{ margin: '2px 0', maxWidth: 300 }}>{vendor.notes}</p>
          </div>
        )}
      </div>

      <h3 style={{ fontSize: 15, marginBottom: 12 }}>Orders Placed</h3>
      {orders.length === 0 ? (
        <p style={{ color: 'var(--mist)' }}>No orders on file with this vendor yet.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th></th>
              <th>Job #</th>
              <th>Property</th>
              <th>Part Description</th>
              <th>Part #</th>
              <th>PO #</th>
              <th>Expected Delivery</th>
              <th>Verified</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) =>
              editingId === o.id ? (
                <tr key={o.id}>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button className="auth-button" style={{ width: 'auto', padding: '4px 10px', margin: 0 }} onClick={() => saveEdit(o.id)}>Save</button>
                    <button className="logout-button" onClick={() => setEditingId(null)}>Cancel</button>
                  </td>
                  <td>{o.jobs?.job_number || '—'}</td>
                  <td>{o.jobs?.properties?.street_address || '—'}</td>
                  <td>{o.part_description}</td>
                  <td>{o.part_number || '—'}</td>
                  <td><input type="text" value={editPo} onChange={(e) => setEditPo(e.target.value)} /></td>
                  <td><input type="date" value={editDeliveryDate} onChange={(e) => setEditDeliveryDate(e.target.value)} /></td>
                  <td>{o.delivery_verified ? 'Yes' : 'No'}</td>
                </tr>
              ) : (
                <tr key={o.id}>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button className="logout-button" onClick={() => startEdit(o)}>Edit</button>
                    {emailOrderLink(o) && (
                      <a className="logout-button" style={{ textDecoration: 'none', display: 'inline-block' }} href={emailOrderLink(o)}>
                        Email Order
                      </a>
                    )}
                  </td>
                  <td>{o.jobs?.job_number || '—'}</td>
                  <td>{o.jobs?.properties?.street_address || '—'}</td>
                  <td>{o.part_description}</td>
                  <td>{o.part_number || '—'}</td>
                  <td>{o.po_number || '—'}</td>
                  <td>{o.expected_delivery_date ? new Date(o.expected_delivery_date + 'T00:00:00').toLocaleDateString() : '—'}</td>
                  <td>
                    <span className={`status-pill ${o.delivery_verified ? 'status-active' : 'status-pending'}`}>
                      {o.delivery_verified ? 'Verified' : 'Pending'}
                    </span>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}

