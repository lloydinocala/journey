// Rewards-HVAC · shared UI helpers (org selection + section chrome)
// Mirrors the Elements module pattern so the two modules feel identical.
import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
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

export function EnabledPill({ enabled }) {
  return (
    <span className="badge" style={{ background: enabled ? '#1B3A6B' : 'var(--mist)', color: '#fff' }}>
      {enabled ? 'Payroll live' : 'Setup mode'}
    </span>
  )
}

// Shown across HR screens until the org flips the go-live switch. HR features
// work in setup mode; only live paychecks/tax filings require "enabled".
export function SetupNotice({ enabled }) {
  if (enabled) return null
  return (
    <div style={{
      background: '#FFF7ED', border: '1px solid #FED7AA', color: '#9A3412',
      padding: '10px 14px', borderRadius: 10, marginBottom: 18, fontSize: 14,
    }}>
      Rewards is in <strong>setup mode</strong> for this organization. You can build out people,
      job descriptions, onboarding, and certifications now. Live paychecks and tax filing turn on in{' '}
      <Link to="/rewards/settings" style={{ color: '#9A3412', fontWeight: 700 }}>Rewards Settings</Link>{' '}
      once payroll (Phase R2) is ready.
    </div>
  )
}

// A small red/amber compliance chip used on the dashboard + cert screens.
export function FlagChip({ severity, children }) {
  const red = severity === 'red'
  return (
    <span className="badge" style={{
      background: red ? '#FEE2E2' : '#FEF3C7',
      color: red ? '#DC2626' : '#B8720A',
      border: `1px solid ${red ? '#FCA5A5' : '#FDE68A'}`,
    }}>
      {children}
    </span>
  )
}

// Days until a date (negative = past due). Null-safe.
export function daysUntil(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.round((d - now) / 86400000)
}
