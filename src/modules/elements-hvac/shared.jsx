// Elements-HVAC · shared UI helpers (org selection + section chrome)
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import OrgPicker from '../../OrgPicker'

export function useOrgSelector(profile) {
  const isSuperAdmin = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        setSelectedOrg((s) => s || (data && data[0] ? data[0].id : ''))
      })
    }
  }, [])
  return { isSuperAdmin, orgs, selectedOrg, setSelectedOrg }
}

export function OrgBar({ isSuperAdmin, orgs, selectedOrg, setSelectedOrg }) {
  if (!isSuperAdmin) return null
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
      <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
    </div>
  )
}

// Small colored pill for module on/off state
export function EnabledPill({ enabled }) {
  return (
    <span
      className="badge"
      style={{ background: enabled ? '#1B3A6B' : 'var(--mist)', color: '#fff' }}
    >
      {enabled ? 'Module enabled' : 'Module disabled'}
    </span>
  )
}

export function DisabledNotice({ enabled }) {
  if (enabled) return null
  return (
    <div
      style={{
        background: '#FFF7ED', border: '1px solid #FED7AA', color: '#9A3412',
        padding: '10px 14px', borderRadius: 10, marginBottom: 18, fontSize: 14,
      }}
    >
      Elements-HVAC Inventory is currently <strong>disabled</strong> for this organization, so
      invoices won't deduct stock yet. Turn it on in{' '}
      <Link to="/elements/settings" style={{ color: '#9A3412', fontWeight: 700 }}>Inventory Settings</Link>{' '}
      once your items, trucks, and mappings are set up.
    </div>
  )
}
