import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import ImportEngine from './ImportEngine'
import { fetchAllRows } from './utils/csvImport'

function normalize(s) {
  return (s || '').toLowerCase().trim().replace(/\s+/g, ' ')
}

const CONFIG = {
  title: 'Import Properties',
  table: 'properties',
  templateHeaders: [
    'Customer Name', 'Street Address', 'Unit', 'City', 'County', 'State', 'Zip', 'Gate Code', 'Notes',
  ],
  fields: [
    { key: 'customer_name', header: 'Customer Name', required: true, aliases: ['customer', 'name'] },
    { key: 'street_address', header: 'Street Address', required: true, aliases: ['address', 'street'] },
    { key: 'unit', header: 'Unit', aliases: ['apt', 'suite'] },
    { key: 'city', header: 'City' },
    { key: 'county', header: 'County' },
    { key: 'state', header: 'State' },
    { key: 'zip', header: 'Zip', aliases: ['zip code', 'postal code'] },
    { key: 'gate_code', header: 'Gate Code', aliases: ['gate'] },
    { key: 'notes', header: 'Notes' },
  ],
  defaults: { is_active: true },
  lookupCaches: async (orgId) => {
    const data = await fetchAllRows(() =>
      supabase.from('customers').select('id, display_name').eq('org_id', orgId)
    )
    const customerMap = {}
    ;(data || []).forEach((c) => {
      customerMap[normalize(c.display_name)] = c.id
    })
    return { customerMap }
  },
  resolveRow: (row, caches) => {
    const customerId = caches.customerMap[normalize(row.customer_name)]
    if (!customerId) {
      return { error: `Customer "${row.customer_name}" not found — import customers first, or check spelling` }
    }
    return {
      data: {
        customer_id: customerId,
        street_address: row.street_address,
        unit: row.unit || null,
        city: row.city || null,
        county: row.county || null,
        state: row.state || null,
        zip: row.zip || null,
        gate_code: row.gate_code || null,
        notes: row.notes || null,
      },
    }
  },
}

export default function PropertyImport({ profile }) {
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
