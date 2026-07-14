import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import ImportEngine from './ImportEngine'

const CONFIG = {
  title: 'Import Customers',
  table: 'customers',
  templateHeaders: [
    'Customer Name', 'Company', 'First Name', 'Last Name', 'Spouse Name',
    'Phone', 'Phone 2', 'Email', 'Email 2', 'Acquired Date', 'Notes',
  ],
  fields: [
    { key: 'display_name', header: 'Customer Name', required: true, aliases: ['name', 'full name', 'customer'] },
    { key: 'company', header: 'Company' },
    { key: 'first_name', header: 'First Name', aliases: ['firstname'] },
    { key: 'last_name', header: 'Last Name', aliases: ['lastname'] },
    { key: 'spouse_name', header: 'Spouse Name' },
    { key: 'primary_phone', header: 'Phone', aliases: ['phone number', 'main phone', 'mobile', 'cell'] },
    { key: 'secondary_phone', header: 'Phone 2', aliases: ['second phone', 'home phone', 'alt phone'] },
    { key: 'email_1', header: 'Email', aliases: ['email address'] },
    { key: 'email_2', header: 'Email 2', aliases: ['second email', 'alt email'] },
    { key: 'acquire_date', header: 'Acquired Date', aliases: ['customer since', 'created', 'date added'] },
    { key: 'notes', header: 'Notes', aliases: ['comments'] },
  ],
  defaults: { is_active: true },
  resolveRow: (row) => ({
    data: {
      display_name: row.display_name,
      company: row.company || null,
      first_name: row.first_name || null,
      last_name: row.last_name || null,
      spouse_name: row.spouse_name || null,
      primary_phone: row.primary_phone || null,
      secondary_phone: row.secondary_phone || null,
      email_1: row.email_1 || null,
      email_2: row.email_2 || null,
      acquire_date: row.acquire_date || null,
      notes: row.notes || null,
    },
  }),
}

export default function CustomerImport({ profile }) {
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
