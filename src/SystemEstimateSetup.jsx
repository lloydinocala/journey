import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

// The system types Journey ships with, in the order the office thinks about them.
// Any additional system_type actually present in the org's equipment is merged in
// below, so a type that exists in the pricebook always gets its own block here.
const CANONICAL_TYPES = ['Apt CrossOver', 'Apt Split', 'CrossOver', 'Gas', 'Packaged', 'Split', 'Mini-Split']

// Org-level templates that appear on every system estimate. The warranty exact-words
// block is one template (year numbers are pulled from the chosen system at render time).
// "Installation includes" is now per system type — with a default that covers any type
// left blank — because what an install includes differs by system type.
export default function SystemEstimateSetup({ profile }) {
  const isSuperAdmin = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [installIncludes, setInstallIncludes] = useState('')      // the default block
  const [byType, setByType] = useState({})                        // { [system_type]: text }
  const [equipTypes, setEquipTypes] = useState([])                // distinct types in equipment
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
    const [{ data: org }, { data: equip }] = await Promise.all([
      supabase.from('organizations')
        .select('system_installation_includes, system_installation_includes_by_type, system_warranty_template')
        .eq('id', orgId).single(),
      supabase.from('equipment').select('system_type').eq('org_id', orgId).eq('active', true),
    ])
    setInstallIncludes(org?.system_installation_includes || '')
    setByType(org?.system_installation_includes_by_type || {})
    setWarrantyTemplate(org?.system_warranty_template || '')
    setEquipTypes([...new Set((equip || []).map((e) => e.system_type))].filter(Boolean))
    setLoading(false)
  }
  useEffect(() => { load(selectedOrg); setSaved(false) }, [selectedOrg])

  // Show every canonical type, plus any extra type the org actually has equipment for,
  // so no type in the pricebook is left without a block.
  const types = [
    ...CANONICAL_TYPES,
    ...equipTypes.filter((t) => !CANONICAL_TYPES.includes(t)).sort(),
  ]

  const setTypeText = (t, v) => setByType((m) => ({ ...m, [t]: v }))

  async function save() {
    setSaving(true); setSaved(false)
    // Prune blank entries so a type left empty cleanly falls back to the default.
    const cleaned = {}
    Object.entries(byType).forEach(([k, v]) => { if (v && v.trim()) cleaned[k] = v })
    await supabase.from('organizations').update({
      system_installation_includes: installIncludes,
      system_installation_includes_by_type: cleaned,
      system_warranty_template: warrantyTemplate,
    }).eq('id', selectedOrg)
    setByType(cleaned)
    setSaving(false); setSaved(true)
  }

  const ta = { width: '100%', minHeight: 130, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line, #D5DAE1)', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: 1.5 }
  const taSmall = { ...ta, minHeight: 96 }

  return (
    <div>
      <h2 className="page-title">System Estimate Setup</h2>
      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: -8, marginBottom: 18, maxWidth: 680 }}>
        These blocks appear on every system estimate. Set them once here. Installation includes is set per system type, so each install shows exactly what it comes with.
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
            <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Installation includes — default</h3>
            <p style={{ color: 'var(--mist)', fontSize: 12.5, marginTop: 0, marginBottom: 8 }}>
              The fallback &ldquo;what&rsquo;s included&rdquo; block. It is used for any system type below that you leave blank.
            </p>
            <textarea style={ta} value={installIncludes} onChange={(e) => setInstallIncludes(e.target.value)} />
          </div>

          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Installation includes — by system type</h3>
            <p style={{ color: 'var(--mist)', fontSize: 12.5, marginTop: 0, marginBottom: 12 }}>
              Write the exact &ldquo;what&rsquo;s included&rdquo; block for each system type. The estimate uses the block for the
              type you pick; a type left blank falls back to the default above.
            </p>
            <div style={{ display: 'grid', gap: 16 }}>
              {types.map((t) => {
                const val = byType[t] || ''
                return (
                  <div key={t}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <label style={{ fontSize: 13.5, fontWeight: 600 }}>{t}</label>
                      {installIncludes && !val.trim() && (
                        <button
                          type="button"
                          onClick={() => setTypeText(t, installIncludes)}
                          style={{ border: '1px solid var(--line, #D5DAE1)', background: '#fff', color: 'var(--route-blue, #176E7A)', borderRadius: 6, padding: '3px 10px', fontSize: 12, cursor: 'pointer' }}
                        >
                          Start from default
                        </button>
                      )}
                    </div>
                    <textarea
                      style={taSmall}
                      value={val}
                      placeholder="Leave blank to use the default block above."
                      onChange={(e) => setTypeText(t, e.target.value)}
                    />
                  </div>
                )
              })}
            </div>
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
