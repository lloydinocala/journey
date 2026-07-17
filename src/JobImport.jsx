import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import ImportEngine from './ImportEngine'
import { fetchAllRows } from './utils/csvImport'

function normalize(s) {
  return (s || '').toLowerCase().trim().replace(/\s+/g, ' ')
}

const VALID_STATUSES = ['scheduled', 'on_my_way', 'in_progress', 'incomplete', 'completed', 'canceled']

const CONFIG = {
  title: 'Import Jobs',
  table: 'jobs',
  templateHeaders: [
    'Customer Name', 'Property Address', 'Job Number', 'Job Date', 'Status',
    'Job Type', 'Service Complaint', 'Job Notes', 'Technician',
  ],
  fields: [
    { key: 'customer_name', header: 'Customer Name', required: true, aliases: ['customer'] },
    { key: 'property_address', header: 'Property Address', required: true, aliases: ['address', 'street address'] },
    { key: 'job_number', header: 'Job Number', required: true, aliases: ['job #', 'invoice number', 'ticket number'] },
    { key: 'job_date', header: 'Job Date', required: true, aliases: ['date', 'service date'] },
    { key: 'status', header: 'Status', aliases: ['job status'] },
    { key: 'job_type', header: 'Job Type', aliases: ['type'] },
    { key: 'service_complaint', header: 'Service Complaint', aliases: ['description', 'complaint', 'problem'] },
    { key: 'job_notes', header: 'Job Notes', aliases: ['notes'] },
    { key: 'technician', header: 'Technician', aliases: ['tech', 'assigned to'] },
  ],
  lookupCaches: async (orgId) => {
    const [customersData, propertiesData, usersData] = await Promise.all([
      fetchAllRows(() => supabase.from('customers').select('id, display_name').eq('org_id', orgId)),
      fetchAllRows(() => supabase.from('properties').select('id, customer_id, street_address').eq('org_id', orgId)),
      fetchAllRows(() => supabase.from('users').select('id, full_name').eq('org_id', orgId)),
    ])
    const customerMap = {}
    ;(customersData || []).forEach((c) => {
      customerMap[normalize(c.display_name)] = c.id
    })
    const propertyMap = {}
    ;(propertiesData || []).forEach((p) => {
      propertyMap[`${p.customer_id}::${normalize(p.street_address)}`] = p.id
    })
    const techMap = {}
    ;(usersData || []).forEach((u) => {
      techMap[normalize(u.full_name)] = u.id
    })
    return { customerMap, propertyMap, techMap }
  },
  resolveRow: (row, caches) => {
    const customerId = caches.customerMap[normalize(row.customer_name)]
    if (!customerId) {
      return { error: `Customer "${row.customer_name}" not found — import customers first, or check spelling` }
    }
    const propertyId = caches.propertyMap[`${customerId}::${normalize(row.property_address)}`]
    if (!propertyId) {
      return {
        error: `Property "${row.property_address}" not found for customer "${row.customer_name}" — import properties first, or check spelling`,
      }
    }
    let status = normalize(row.status).replace(/\s+/g, '_')
    if (!VALID_STATUSES.includes(status)) status = 'completed'

    const technicianId = row.technician ? caches.techMap[normalize(row.technician)] || null : null

    return {
      data: {
        customer_id: customerId,
        property_id: propertyId,
        job_number: row.job_number,
        job_date: row.job_date,
        status,
        job_type: row.job_type || null,
        service_complaint: row.service_complaint || null,
        job_notes: row.job_notes || null,
      },
      extra: { technicianId },
    }
  },
  afterInsert: async (inserted, extra, orgId) => {
    if (!extra.technicianId) return
    await supabase.from('job_technicians').insert({
      org_id: orgId,
      job_id: inserted.id,
      user_id: extra.technicianId,
      sort_order: 1,
    })
  },
}

export default function JobImport({ profile }) {
  const isSuperAdmin = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        if (!selectedOrg && data && data.length > 0) setSelectedOrg(data[0].id)
      })
    }
  }, [])

  return (
    <div>
      <p style={{ color: 'var(--mist)', marginBottom: 16 }}>
        Jobs with no matching Status column (or an unrecognized one) import as <strong>completed</strong> — the
        assumption for historical data. Valid statuses: {VALID_STATUSES.join(', ')}.
      </p>
      {isSuperAdmin && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>
            Importing into organization
          </label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}
      {selectedOrg && <ImportEngine config={CONFIG} orgId={selectedOrg} />}
    </div>
  )
}
