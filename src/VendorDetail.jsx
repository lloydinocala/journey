import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'

function vendorSiteUrl(url) {
  if (!url) return null
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

export default function VendorDetail({ profile }) {
  const { vendorId } = useParams()
  const navigate = useNavigate()

  const [vendor, setVendor] = useState(null)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  const [editingId, setEditingId] = useState(null)
  const [editPo, setEditPo] = useState('')
  const [editDeliveryDate, setEditDeliveryDate] = useState('')

  const [editingWebsite, setEditingWebsite] = useState(false)
  const [websiteInput, setWebsiteInput] = useState('')
  const [savingWebsite, setSavingWebsite] = useState(false)

  const [brands, setBrands] = useState([])
  const [knownBrands, setKnownBrands] = useState([])
  const [newBrand, setNewBrand] = useState('')
  const [brandBusy, setBrandBusy] = useState(false)

  async function saveWebsite() {
    setSavingWebsite(true)
    const val = websiteInput.trim() || null
    await supabase.from('vendors').update({ website: val }).eq('id', vendorId)
    setVendor((v) => ({ ...v, website: val }))
    setSavingWebsite(false)
    setEditingWebsite(false)
  }

  async function addBrand() {
    const b = newBrand.trim().toUpperCase()
    if (!b) return
    if (brands.some((x) => x.brand.toUpperCase() === b)) { setNewBrand(''); return }
    setBrandBusy(true)
    const { data } = await supabase.from('vendor_brands').insert({ org_id: vendor.org_id, vendor_id: vendorId, brand: b, is_preferred: false }).select().single()
    if (data) setBrands((xs) => [...xs, data].sort((a, c) => a.brand.localeCompare(c.brand)))
    setNewBrand(''); setBrandBusy(false)
  }
  async function removeBrand(id) {
    setBrandBusy(true)
    await supabase.from('vendor_brands').delete().eq('id', id)
    setBrands((xs) => xs.filter((x) => x.id !== id)); setBrandBusy(false)
  }
  async function togglePreferred(row) {
    setBrandBusy(true)
    if (!row.is_preferred) {
      // Only one vendor can be preferred per brand — clear any existing holder first.
      await supabase.from('vendor_brands').update({ is_preferred: false }).eq('org_id', vendor.org_id).ilike('brand', row.brand).eq('is_preferred', true)
      await supabase.from('vendor_brands').update({ is_preferred: true }).eq('id', row.id)
      setBrands((xs) => xs.map((x) => (x.id === row.id ? { ...x, is_preferred: true } : x)))
    } else {
      await supabase.from('vendor_brands').update({ is_preferred: false }).eq('id', row.id)
      setBrands((xs) => xs.map((x) => (x.id === row.id ? { ...x, is_preferred: false } : x)))
    }
    setBrandBusy(false)
  }

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
    if (vendorData) {
      const [{ data: vb }, { data: eq }] = await Promise.all([
        supabase.from('vendor_brands').select('*').eq('vendor_id', vendorId).order('brand'),
        supabase.from('equipment').select('outdoor_brand').eq('org_id', vendorData.org_id),
      ])
      setBrands(vb || [])
      setKnownBrands([...new Set((eq || []).map((e) => (e.outdoor_brand || '').trim().toUpperCase()).filter(Boolean))].sort())
    }
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
          <p style={{ margin: '2px 0' }}>
            {editingWebsite ? (
              <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={websiteInput}
                  onChange={(e) => setWebsiteInput(e.target.value)}
                  placeholder="e.g. acme.com"
                  style={{ minWidth: 180 }}
                />
                <button className="auth-button" style={{ width: 'auto', padding: '4px 10px', margin: 0 }} disabled={savingWebsite} onClick={saveWebsite}>
                  {savingWebsite ? 'Saving…' : 'Save'}
                </button>
                <button className="logout-button" onClick={() => setEditingWebsite(false)}>Cancel</button>
              </span>
            ) : vendor.website ? (
              <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                <a href={vendorSiteUrl(vendor.website)} target="_blank" rel="noreferrer">{vendor.website}</a>
                <button className="logout-button" onClick={() => { setWebsiteInput(vendor.website || ''); setEditingWebsite(true) }}>Edit</button>
              </span>
            ) : (
              <button className="logout-button" onClick={() => { setWebsiteInput(''); setEditingWebsite(true) }}>+ Add website</button>
            )}
          </p>
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

      <h3 style={{ fontSize: 15, marginBottom: 8 }}>Brands Sold</h3>
      <div className="section-card" style={{ padding: 16, marginBottom: 24, maxWidth: 640 }}>
        <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--mist)' }}>Brands this vendor supplies. Star one as the <strong>preferred</strong> source for that brand — the permit workflow auto-fills this vendor when equipment of that brand is ordered.</p>
        {brands.length === 0 && <p style={{ margin: '0 0 10px', fontSize: 13 }}>No brands yet.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {brands.map((b) => (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontWeight: 700, minWidth: 120 }}>{b.brand}</span>
              <button className="logout-button" style={{ fontSize: 12, padding: '3px 10px', color: b.is_preferred ? '#B8860B' : 'var(--mist)', borderColor: b.is_preferred ? '#E6C200' : 'var(--border)', fontWeight: b.is_preferred ? 700 : 400 }} disabled={brandBusy} onClick={() => togglePreferred(b)}>{b.is_preferred ? '★ Preferred' : '☆ Set preferred'}</button>
              <button className="logout-button" style={{ fontSize: 12, padding: '3px 10px' }} disabled={brandBusy} onClick={() => removeBrand(b.id)}>Remove</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input list="known-brands" value={newBrand} onChange={(e) => setNewBrand(e.target.value)} placeholder="Add a brand (e.g. GOODMAN)" style={{ minWidth: 220 }} onKeyDown={(e) => e.key === 'Enter' && addBrand()} />
          <datalist id="known-brands">{knownBrands.map((b) => <option key={b} value={b} />)}</datalist>
          <button className="auth-button" style={{ width: 'auto', padding: '6px 14px', margin: 0 }} disabled={brandBusy || !newBrand.trim()} onClick={addBrand}>Add</button>
        </div>
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

