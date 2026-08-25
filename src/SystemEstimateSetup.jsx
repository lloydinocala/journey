import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

// Org-level templates that appear on every system estimate verbatim: the standard
// "Installation includes" block, and the warranty exact-words (with the year numbers
// pulled from the chosen system at render time).
export default function SystemEstimateSetup({ profile }) {
  const isSuperAdmin = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [installIncludes, setInstallIncludes] = useState('')
  const [warrantyTemplate, setWarrantyTemplate] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        if (!selectedOrg && data && data.length) setSelectedOrg(data[0].id)
      })
    }
  }, [])

  async function load(orgId) {
    if (!orgId) return
    setLoading(true)
    const { data } = await supabase.from('organizations').select('system_installation_includes, system_warranty_template').eq('id', orgId).single()
    setInstallIncludes(data?.system_installation_includes || '')
    setWarrantyTemplate(data?.system_warranty_template || '')
    setLoading(false)
  }
  useEffect(() => { load(selectedOrg); setSaved(false) }, [selectedOrg])

  async function save() {
    setSaving(true); setSaved(false)
    await supabase.from('organizations').update({
      system_installation_includes: installIncludes,
      system_warranty_template: warrantyTemplate,
    }).eq('id', selectedOrg)
    setSaving(false); setSaved(true)
  }

  const ta = { width: '100%', minHeight: 130, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line, #D5DAE1)', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: 1.5 }

  return (
    <div>
      <h2 className="page-title">System Estimate Setup</h2>
      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: -8, marginBottom: 18, maxWidth: 680 }}>
        These blocks appear on every system estimate exactly as written. Set them once here.
      </p>

      {isSuperAdmin && (
        <div style={{ marginBottom: 18, maxWidth: 420 }}>
          <label style={{ fontSize: 12, color: 'var(--mist)' }}>Organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : (
        <div style={{ maxWidth: 680, display: 'grid', gap: 22 }}>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Installation includes</h3>
            <p style={{ color: 'var(--mist)', fontSize: 12.5, marginTop: 0, marginBottom: 8 }}>The standard &ldquo;what&rsquo;s included&rdquo; block, shown on every system estimate.</p>
            <textarea style={ta} value={installIncludes} onChange={(e) => setInstallIncludes(e.target.value)} />
          </div>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Warranty (exact words)</h3>
            <p style={{ color: 'var(--mist)', fontSize: 12.5, marginTop: 0, marginBottom: 8 }}>
              Shown verbatim. Use <code>{'{manufacturer_years}'}</code> and <code>{'{contractor_years}'}</code> where the year numbers go &mdash; they&rsquo;re filled in from the system you choose on each estimate.
            </p>
            <textarea style={{ ...ta, minHeight: 200 }} value={warrantyTemplate} onChange={(e) => setWarrantyTemplate(e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="auth-button" style={{ width: 'auto', padding: '9px 24px' }} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            {saved && <span style={{ color: '#16A34A', fontSize: 13 }}>Saved.</span>}
          </div>
        </div>
      )}
    </div>
  )
}
