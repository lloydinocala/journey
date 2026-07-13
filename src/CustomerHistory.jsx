import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from './utils/supabase'

export default function CustomerHistory({ profile }) {
  const { customerId } = useParams()

  const [customer, setCustomer] = useState(null)
  const [properties, setProperties] = useState([])
  const [jobs, setJobs] = useState([])
  const [invoices, setInvoices] = useState([])
  const [agreements, setAgreements] = useState([])
  const [attachments, setAttachments] = useState([])
  const [photoUrls, setPhotoUrls] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadAll()
  }, [customerId])

  async function loadAll() {
    setLoading(true)
    setError('')

    const { data: custData, error: custError } = await supabase
      .from('customers')
      .select('id, org_id, display_name, company, first_name, last_name, spouse_name, primary_phone, secondary_phone, email_1, email_2, acquire_date, notes, is_active, is_banned, banned_reason')
      .eq('id', customerId)
      .single()

    if (custError || !custData) {
      setError(custError?.message || 'Customer not found.')
      setLoading(false)
      return
    }
    setCustomer(custData)

    const [propsRes, jobsRes, invoicesRes, agreementsRes] = await Promise.all([
      supabase
        .from('properties')
        .select('id, street_address, unit, city, county, state, zip, gate_code, notes, is_active')
        .eq('customer_id', customerId)
        .order('is_active', { ascending: false }),
      supabase
        .from('jobs')
        .select(`
          id, job_number, segment, status, job_date, job_type, service_complaint, job_notes, completed_at,
          property:properties(street_address, unit, city, state, zip),
          technician_1:users!jobs_technician_1_id_fkey(full_name),
          technician_2:users!jobs_technician_2_id_fkey(full_name)
        `)
        .eq('customer_id', customerId)
        .order('job_date', { ascending: false }),
      supabase
        .from('invoices')
        .select('id, invoice_number, invoice_date, kind, job_total, amount_due, balance, paid_at, approval_status')
        .eq('bills_to_customer_id', customerId)
        .order('invoice_date', { ascending: false }),
      supabase
        .from('maintenance_agreements')
        .select(`
          id, status, billing_cycle, price, start_date, next_visit_due_date, last_visit_completed_date, canceled_at,
          tier:maintenance_agreement_tiers(name, visit_count_per_year, discount_pct)
        `)
        .eq('customer_id', customerId)
        .order('start_date', { ascending: false }),
    ])

    setProperties(propsRes.data || [])
    setJobs(jobsRes.data || [])
    setInvoices(invoicesRes.data || [])
    setAgreements(agreementsRes.data || [])

    const jobIds = (jobsRes.data || []).map((j) => j.id)
    let attachmentRows = []
    if (jobIds.length > 0) {
      const { data } = await supabase
        .from('attachments')
        .select('id, job_id, file_path, file_name, category, caption, taken_at')
        .or(`customer_id.eq.${customerId},job_id.in.(${jobIds.join(',')})`)
        .order('taken_at', { ascending: false })
      attachmentRows = data || []
    } else {
      const { data } = await supabase
        .from('attachments')
        .select('id, job_id, file_path, file_name, category, caption, taken_at')
        .eq('customer_id', customerId)
        .order('taken_at', { ascending: false })
      attachmentRows = data || []
    }
    setAttachments(attachmentRows)

    const urlEntries = await Promise.all(
      attachmentRows
        .filter((a) => a.category === 'photo')
        .map(async (a) => {
          const { data } = await supabase.storage.from('job-photos').createSignedUrl(a.file_path, 3600)
          return [a.id, data?.signedUrl || null]
        })
    )
    setPhotoUrls(Object.fromEntries(urlEntries))

    setLoading(false)
  }

  function formatDate(d) {
    if (!d) return '—'
    return new Date(d.length <= 10 ? d + 'T00:00:00' : d).toLocaleDateString()
  }

  function formatMoney(n) {
    if (n === null || n === undefined) return '—'
    return '$' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  function techNames(job) {
    const names = [job.technician_1?.full_name, job.technician_2?.full_name].filter(Boolean)
    return names.length ? names.join(', ') : '—'
  }

  function propertyLine(p) {
    if (!p) return '—'
    return [p.street_address, p.unit, p.city, p.state, p.zip].filter(Boolean).join(', ')
  }

  if (loading) return <p style={{ color: 'var(--mist)' }}>Loading…</p>
  if (error) return <div className="auth-error">{error}</div>
  if (!customer) return null

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .ch-printable, .ch-printable * { visibility: visible; }
          .ch-printable { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Link to="/customers" className="logout-button">← Back to Customers</Link>
        <button className="auth-button" style={{ width: 'auto', margin: 0, padding: '8px 20px' }} onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      </div>

      <div className="ch-printable">
        <div className="page-header-bar">
          <h2>{customer.display_name}</h2>
          {customer.is_banned && <span className="badge" style={{ background: '#a33', color: '#fff' }}>Do Not Service</span>}
        </div>
        {customer.is_banned && customer.banned_reason && (
          <p style={{ color: '#a33', marginTop: -8 }}>Reason: {customer.banned_reason}</p>
        )}

        <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap', margin: '16px 0 28px' }}>
          <div>
            <h3 style={{ marginBottom: 6 }}>Contact</h3>
            {customer.company && <p style={{ margin: '2px 0' }}>{customer.company}</p>}
            {(customer.first_name || customer.last_name) && (
              <p style={{ margin: '2px 0' }}>{[customer.first_name, customer.last_name].filter(Boolean).join(' ')}</p>
            )}
            {customer.spouse_name && <p style={{ margin: '2px 0' }}>Spouse: {customer.spouse_name}</p>}
            <p style={{ margin: '2px 0' }}>{customer.primary_phone || '—'}</p>
            {customer.secondary_phone && <p style={{ margin: '2px 0' }}>{customer.secondary_phone}</p>}
            <p style={{ margin: '2px 0' }}>{customer.email_1 || '—'}</p>
            {customer.email_2 && <p style={{ margin: '2px 0' }}>{customer.email_2}</p>}
            <p style={{ margin: '2px 0', color: 'var(--mist)' }}>Customer since {formatDate(customer.acquire_date)}</p>
          </div>

          <div>
            <h3 style={{ marginBottom: 6 }}>Properties</h3>
            {properties.length === 0 && <p style={{ color: 'var(--mist)' }}>No properties on file.</p>}
            {properties.map((p) => (
              <p key={p.id} style={{ margin: '2px 0' }}>
                {propertyLine(p)}{!p.is_active ? ' (inactive)' : ''}
                {p.gate_code ? ` — Gate: ${p.gate_code}` : ''}
              </p>
            ))}
          </div>

          <div>
            <h3 style={{ marginBottom: 6 }}>Maintenance Agreement</h3>
            {agreements.length === 0 && <p style={{ color: 'var(--mist)' }}>No maintenance agreement on file.</p>}
            {agreements.map((a) => (
              <div key={a.id} style={{ marginBottom: 8 }}>
                <p style={{ margin: '2px 0' }}>
                  {a.tier?.name || 'Tier'} — <span className="badge">{a.status}</span>
                </p>
                <p style={{ margin: '2px 0', color: 'var(--mist)' }}>
                  {a.billing_cycle} · {formatMoney(a.price)} · {a.tier?.visit_count_per_year || '—'} visits/yr
                </p>
                <p style={{ margin: '2px 0', color: 'var(--mist)' }}>
                  Next visit due {formatDate(a.next_visit_due_date)} · Last visit {formatDate(a.last_visit_completed_date)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {customer.notes && (
          <div style={{ marginBottom: 28 }}>
            <h3 style={{ marginBottom: 6 }}>Notes</h3>
            <p style={{ whiteSpace: 'pre-wrap' }}>{customer.notes}</p>
          </div>
        )}

        <div style={{ marginBottom: 28 }}>
          <h3 style={{ marginBottom: 10 }}>Job History</h3>
          {jobs.length === 0 ? (
            <p style={{ color: 'var(--mist)' }}>No jobs on file.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Job #</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Property</th>
                    <th>Technician(s)</th>
                    <th>Complaint / Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j) => (
                    <tr key={j.id}>
                      <td>{j.job_number}{j.segment > 1 ? `-${j.segment}` : ''}</td>
                      <td>{formatDate(j.job_date)}</td>
                      <td>{j.job_type || '—'}</td>
                      <td><span className="badge">{j.status}</span></td>
                      <td>{propertyLine(j.property)}</td>
                      <td>{techNames(j)}</td>
                      <td>{j.service_complaint || j.job_notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 28 }}>
          <h3 style={{ marginBottom: 10 }}>Invoices &amp; Estimates</h3>
          {invoices.length === 0 ? (
            <p style={{ color: 'var(--mist)' }}>No invoices or estimates on file.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Total</th>
                    <th>Balance</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>{inv.invoice_number}</td>
                      <td>{formatDate(inv.invoice_date)}</td>
                      <td>{inv.kind === 'estimate' ? 'Estimate' : 'Invoice'}</td>
                      <td>{formatMoney(inv.job_total)}</td>
                      <td>{formatMoney(inv.balance)}</td>
                      <td>
                        {inv.kind === 'estimate'
                          ? inv.approval_status
                          : inv.paid_at ? 'Paid' : 'Unpaid'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <h3 style={{ marginBottom: 10 }}>Photos &amp; Attachments</h3>
          {attachments.length === 0 ? (
            <p style={{ color: 'var(--mist)' }}>No photos or attachments on file.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              {attachments.map((a) => (
                <div key={a.id} style={{ width: 180 }}>
                  {a.category === 'photo' && photoUrls[a.id] ? (
                    <img
                      src={photoUrls[a.id]}
                      alt={a.caption || a.file_name}
                      style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 6, border: '1px solid #ddd' }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #ddd', borderRadius: 6, color: 'var(--mist)' }}>
                      {a.file_name}
                    </div>
                  )}
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--mist)' }}>{formatDate(a.taken_at)}</p>
                  {a.caption && <p style={{ margin: '2px 0 0', fontSize: 12 }}>{a.caption}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
