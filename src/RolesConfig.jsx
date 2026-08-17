import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

const CATEGORY_LABEL = {
  jobs: 'Jobs & Scheduling',
  field: 'Field / Mobile',
  estimates: 'Estimates & Approvals',
  pricing: 'Pricing & Money',
  customers: 'Customers',
  accounting: 'Accounting & Reporting',
  marketing: 'Marketing',
  admin: 'Company & Admin',
}
const CATEGORY_ORDER = ['jobs', 'field', 'estimates', 'pricing', 'customers', 'accounting', 'marketing', 'admin']
const DEPT_ORDER = ['Admin', 'Field', 'Shop', 'Front Office', 'Back Office']

export default function RolesConfig({ profile }) {
  const isSuperAdmin = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [catalog, setCatalog] = useState([])
  const [tags, setTags] = useState([])
  const [permsByTag, setPermsByTag] = useState({})
  const [loading, setLoading] = useState(true)

  const [selectedTagId, setSelectedTagId] = useState(null)
  const [draftPerms, setDraftPerms] = useState(new Set())
  const [draftName, setDraftName] = useState('')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (isSuperAdmin) supabase.from('organizations').select('id, name').order('name').then(({ data }) => setOrgs(data || []))
  }, [isSuperAdmin])
  useEffect(() => { if (selectedOrg) load() }, [selectedOrg])

  async function load() {
    setLoading(true)
    const [{ data: cat }, { data: tg }, { data: rp }] = await Promise.all([
      supabase.from('permissions').select('key, label, category, sort_order').order('sort_order'),
      supabase.from('job_roles').select('id, name, department, is_oncall, sort_order').eq('org_id', selectedOrg).order('sort_order'),
      supabase.from('role_permissions').select('role_id, permission_key').eq('org_id', selectedOrg),
    ])
    setCatalog(cat || [])
    setTags(tg || [])
    const map = {}
    ;(rp || []).forEach((r) => { (map[r.role_id] = map[r.role_id] || new Set()).add(r.permission_key) })
    setPermsByTag(map)
    setLoading(false)
  }

  function selectTag(tag) {
    if (dirty && !window.confirm('Discard unsaved changes to this tag?')) return
    setSelectedTagId(tag.id)
    setDraftName(tag.name)
    setDraftPerms(new Set(permsByTag[tag.id] || []))
    setDirty(false)
  }

  function togglePerm(key) {
    setDraftPerms((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
    setDirty(true)
  }

  async function saveTag() {
    if (!selectedTagId) return
    setSaving(true)
    const tag = tags.find((t) => t.id === selectedTagId)
    if (tag && draftName.trim() && draftName.trim() !== tag.name) {
      await supabase.from('job_roles').update({ name: draftName.trim() }).eq('id', selectedTagId)
    }
    await supabase.from('role_permissions').delete().eq('role_id', selectedTagId)
    const keys = [...draftPerms]
    if (keys.length) {
      await supabase.from('role_permissions').insert(keys.map((permission_key) => ({ org_id: selectedOrg, role_id: selectedTagId, permission_key })))
    }
    setSaving(false)
    setDirty(false)
    await load()
  }

  async function addTag(department) {
    const name = window.prompt(`New tag name in ${department}:`)
    if (!name || !name.trim()) return
    const maxSort = Math.max(0, ...tags.filter((t) => t.department === department).map((t) => t.sort_order || 0))
    const { data } = await supabase.from('job_roles')
      .insert({ org_id: selectedOrg, name: name.trim(), department, is_active: true, sort_order: maxSort + 1, is_oncall: false })
      .select().single()
    await load()
    if (data) {
      setSelectedTagId(data.id); setDraftName(data.name); setDraftPerms(new Set()); setDirty(false)
    }
  }

  const byDept = {}
  tags.filter((t) => !t.is_oncall && t.department).forEach((t) => { (byDept[t.department] = byDept[t.department] || []).push(t) })
  const onCallTags = tags.filter((t) => t.is_oncall)
  const catalogByCategory = CATEGORY_ORDER.map((cat) => ({ cat, perms: catalog.filter((p) => p.category === cat) })).filter((g) => g.perms.length)
  const selectedTag = tags.find((t) => t.id === selectedTagId)

  function TagButton({ t, accent }) {
    const active = selectedTagId === t.id
    return (
      <button type="button" onClick={() => selectTag(t)}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', textAlign: 'left',
          padding: '7px 10px', marginBottom: 3, borderRadius: 8,
          border: '1px solid ' + (active ? accent : 'var(--border,#e0e0e0)'),
          background: active ? (accent === '#d9a441' ? '#fff6e5' : 'var(--surface-2,#eef4f8)') : '#fff', cursor: 'pointer',
        }}>
        <span>{t.name}</span>
        <span style={{ color: 'var(--mist)', fontSize: 12 }}>{(permsByTag[t.id] || new Set()).size}</span>
      </button>
    )
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <h2 className="page-title" style={{ margin: 0 }}>Roles &amp; Tags</h2>
        {isSuperAdmin && <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />}
      </div>
      <p style={{ color: 'var(--mist)', marginTop: 8, maxWidth: 760 }}>
        Roles are your departments; tags are the positions inside them. Each tag carries a set of permissions &mdash; set them once here and everyone who holds that tag inherits them. Rename a tag to fit your shop, or add your own.
      </p>

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading&hellip;</p>
      ) : (
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: '0 0 280px', minWidth: 250 }}>
            {DEPT_ORDER.filter((d) => byDept[d]).map((dept) => (
              <div key={dept} style={{ marginBottom: 18 }}>
                <div style={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--ink,#0f2f44)', marginBottom: 6 }}>{dept}</div>
                {byDept[dept].map((t) => <TagButton key={t.id} t={t} accent="var(--ink,#0f2f44)" />)}
                <button type="button" onClick={() => addTag(dept)}
                  style={{ fontSize: 12, color: 'var(--accent,#2e6b8a)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>+ Add tag</button>
              </div>
            ))}
            {onCallTags.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: '#8a5a00', marginBottom: 6 }}>On-Call</div>
                {onCallTags.map((t) => <TagButton key={t.id} t={t} accent="#d9a441" />)}
                <div style={{ fontSize: 11, color: 'var(--mist)', marginTop: 2 }}>Applies only while a person is on call.</div>
              </div>
            )}
          </div>

          <div style={{ flex: '1 1 440px', minWidth: 340 }}>
            {!selectedTag ? (
              <p style={{ color: 'var(--mist)' }}>Select a tag on the left to view and edit its permissions.</p>
            ) : (
              <div style={{ border: '0.5px solid var(--border,#d0d0d0)', borderRadius: 12, padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
                  <div className="field" style={{ margin: 0, flex: 1 }}>
                    <label style={{ fontSize: 11 }}>Tag name{selectedTag.department ? ` \u00b7 ${selectedTag.department}` : ''}</label>
                    <input value={draftName} onChange={(e) => { setDraftName(e.target.value); setDirty(true) }} />
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--mist)', whiteSpace: 'nowrap', paddingBottom: 6 }}>{draftPerms.size} permission{draftPerms.size === 1 ? '' : 's'}</div>
                </div>
                {selectedTag.is_oncall && (
                  <p style={{ fontSize: 12, color: '#8a5a00', margin: '6px 0 0' }}>On-call tag &mdash; these permissions apply only during an active on-call window.</p>
                )}

                <div style={{ display: 'flex', gap: 8, margin: '10px 0 14px' }}>
                  <button type="button" className="logout-button" onClick={() => { setDraftPerms(new Set(catalog.map((p) => p.key))); setDirty(true) }}>Select all</button>
                  <button type="button" className="logout-button" onClick={() => { setDraftPerms(new Set()); setDirty(true) }}>Clear all</button>
                </div>

                {catalogByCategory.map(({ cat, perms }) => (
                  <div key={cat} style={{ marginBottom: 14 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.3, color: 'var(--accent,#2e6b8a)', borderBottom: '1px solid var(--border,#eee)', paddingBottom: 3, marginBottom: 6 }}>{CATEGORY_LABEL[cat] || cat}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '4px 14px' }}>
                      {perms.map((p) => (
                        <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer' }}>
                          <input type="checkbox" checked={draftPerms.has(p.key)} onChange={() => togglePerm(p.key)} />
                          <span>{p.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}

                <div style={{ display: 'flex', gap: 10, marginTop: 8, alignItems: 'center' }}>
                  <button type="button" className="auth-button" onClick={saveTag} disabled={saving || !dirty} style={{ width: 'auto', padding: '8px 24px' }}>
                    {saving ? 'Saving\u2026' : 'Save tag'}
                  </button>
                  {dirty && <span style={{ fontSize: 12, color: '#8a5a00' }}>Unsaved changes</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
