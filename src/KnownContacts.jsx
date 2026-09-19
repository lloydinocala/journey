import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

// "Known Others" — everyone who isn't a Customer, Vendor, or Employee:
// salesmen, friends & family, and any other named contact we want on file.
// This is their management home (view / add / edit / deactivate).
const CATS = [
  { key: 'salesman', label: 'Salesman' },
  { key: 'friends_family', label: 'Friends & Family' },
  { key: 'other', label: 'Other contact' },
]
const CAT_LABEL = { salesman: 'Salesman', friends_family: 'Friends & Family', other: 'Other contact' }
const CAT_COLOR = { salesman: '#6A4FB6', friends_family: '#B5477F', other: '#176E7A' }
const FILTERS = [{ key: 'all', label: 'All' }, ...CATS]

const blank = { id: null, category: 'other', name: '', company: '', phone: '', phone_alt: '', email: '', default_assignee: '', notes: '' }

export default function KnownContacts({ profile }) {
  const isSuper = profile?.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile?.org_id || '')
  const [rows, setRows] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [showInactive, setShowInactive] = useState(false)
  const [form, setForm] = useState(null)      // null = closed; object = add/edit
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => { if (isSuper) supabase.from('organizations').select('id, name').order('name').then(({ data }) => setOrgs(data || [])) }, [isSuper])
  useEffect(() => {
    if (!selectedOrg) { setLoading(false); return }
    supabase.from('users').select('id, full_name').eq('org_id', selectedOrg).eq('is_active', true).order('full_name').then(({ data }) => setUsers(data || []))
    load()
  }, [selectedOrg, showInactive])

  async function load() {
    setLoading(true)
    let q = supabase.from('known_contacts')
      .select('id, category, name, company, phone, phone_alt, email, default_assignee, notes, is_active')
      .eq('org_id', selectedOrg).order('name')
    if (!showInactive) q = q.eq('is_active', true)
    const { data } = await q
    setRows(data || []); setLoading(false)
  }

  function openAdd() { setErr(''); setForm({ ...blank }) }
  function openEdit(r) { setErr(''); setForm({ id: r.id, category: r.category, name: r.name || '', company: r.company || '', phone: r.phone || '', phone_alt: r.phone_alt || '', email: r.email || '', default_assignee: r.default_assignee || '', notes: r.notes || '' }) }

  async function save() {
    if (!form.name.trim() || !selectedOrg) return
    setSaving(true); setErr('')
    const payload = {
      category: form.category, name: form.name.trim(),
      company: form.company.trim() || null, phone: form.phone.trim() || null,
      phone_alt: form.phone_alt.trim() || null, email: form.email.trim() || null,
      default_assignee: form.default_assignee || null, notes: form.notes.trim() || null,
    }
    let error
    if (form.id) {
      ({ error } = await supabase.from('known_contacts').update(payload).eq('id', form.id))
    } else {
      ({ error } = await supabase.from('known_contacts').insert({ ...payload, org_id: selectedOrg, is_active: true, created_by: profile?.user_id || null }))
    }
    setSaving(false)
    if (error) { setErr(error.message || 'Could not save.'); return }
    setForm(null); load()
  }

  async function setActive(r, active) {
    setRows((rs) => rs.map((x) => x.id === r.id ? { ...x, is_active: active } : x))
    await supabase.from('known_contacts').update({ is_active: active }).eq('id', r.id)
    if (!showInactive && !active) setRows((rs) => rs.filter((x) => x.id !== r.id))
  }

  const term = search.trim().toLowerCase()
  const termDigits = term.replace(/\D/g, '')
  const shown = rows.filter((r) => (filter === 'all' || r.category === filter) && (!term
    || (r.name || '').toLowerCase().includes(term)
    || (r.company || '').toLowerCase().includes(term)
    || (r.email || '').toLowerCase().includes(term)
    || (termDigits && `${r.phone || ''}${r.phone_alt || ''}`.replace(/\D/g, '').includes(termDigits))))
  const userName = (id) => users.find((u) => u.id === id)?.full_name || ''

  const field = (label, node) => (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 12.5, color: 'var(--mist)', marginBottom: 4 }}>{label}</span>{node}
    </label>
  )
  const inputStyle = { width: '100%', padding: '9px 11px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 24px' }}>
      <div className="page-header-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Known Others</h2>
        <button className="auth-button" style={{ width: 'auto', margin: 0, padding: '9px 16px' }} onClick={openAdd} disabled={!selectedOrg}>+ Add contact</button>
      </div>
      {isSuper && (
        <div style={{ marginBottom: 12, maxWidth: 340 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}
      <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--mist)' }}>Everyone who isn't a customer, vendor, or employee — salesmen, friends &amp; family, and any other contact worth keeping. These are the people the Call Console can recognize by phone number.</p>

      {form && (
        <div className="section-card" style={{ padding: 18, marginBottom: 16, border: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 800, marginBottom: 14 }}>{form.id ? 'Edit contact' : 'New contact'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {field('Category', (
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={inputStyle}>
                {CATS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            ))}
            {field('Name *', <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} placeholder="Full name" />)}
            {field('Company', <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} style={inputStyle} />)}
            {field('Phone', <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={inputStyle} placeholder="(555) 555-5555" />)}
            {field('Alternate phone', <input value={form.phone_alt} onChange={(e) => setForm({ ...form, phone_alt: e.target.value })} style={inputStyle} />)}
            {field('Email', <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inputStyle} />)}
            {field('Default assignee', (
              <select value={form.default_assignee} onChange={(e) => setForm({ ...form, default_assignee: e.target.value })} style={inputStyle}>
                <option value="">— none —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>{field('Notes', <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />)}</div>
          {err && <div style={{ color: '#B5462F', fontSize: 13, marginTop: 10 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="auth-button" style={{ width: 'auto', margin: 0, padding: '9px 18px' }} disabled={saving || !form.name.trim()} onClick={save}>{saving ? 'Saving…' : form.id ? 'Save changes' : 'Add contact'}</button>
            <button onClick={() => setForm(null)} style={{ border: '1px solid var(--border)', background: '#fff', borderRadius: 8, padding: '9px 18px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, company, phone, email…" style={{ flex: 1, minWidth: 220, padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8 }} />
        <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{ border: 'none', cursor: 'pointer', padding: '9px 13px', fontSize: 13, fontWeight: filter === f.key ? 700 : 500, background: filter === f.key ? '#176E7A' : 'transparent', color: filter === f.key ? '#fff' : 'var(--mist)' }}>{f.label}</button>
          ))}
        </div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--mist)', cursor: 'pointer' }}>
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show inactive
        </label>
      </div>

      {loading ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : shown.length === 0 ? (
        <div className="section-card" style={{ padding: 20 }}><p style={{ margin: 0, color: 'var(--mist)' }}>No contacts{filter !== 'all' ? ' in this group' : ''}{term ? ' matching your search' : ''}. Use “+ Add contact” to create one.</p></div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr>
              <th>Name</th><th>Company</th><th>Category</th><th>Phone</th><th>Alt</th><th>Email</th><th>Default assignee</th><th style={{ width: 150 }}></th>
            </tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} style={r.is_active ? undefined : { opacity: 0.55 }}>
                  <td style={{ fontWeight: 600 }}>{r.name}{!r.is_active && <span style={{ fontSize: 11, color: 'var(--mist)', fontWeight: 500 }}> (inactive)</span>}</td>
                  <td>{r.company || '—'}</td>
                  <td><span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.03em', textTransform: 'uppercase', color: CAT_COLOR[r.category] || 'var(--mist)' }}>{CAT_LABEL[r.category] || 'Contact'}</span></td>
                  <td style={{ whiteSpace: 'nowrap' }}>{r.phone ? <a href={`tel:${r.phone.replace(/[^\d+]/g, '')}`}>{r.phone}</a> : '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{r.phone_alt ? <a href={`tel:${r.phone_alt.replace(/[^\d+]/g, '')}`}>{r.phone_alt}</a> : '—'}</td>
                  <td>{r.email ? <a href={`mailto:${r.email}`}>{r.email}</a> : '—'}</td>
                  <td>{userName(r.default_assignee) || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <button onClick={() => openEdit(r)} style={{ border: '1px solid var(--border)', background: '#fff', borderRadius: 6, padding: '4px 11px', fontSize: 12.5, cursor: 'pointer', marginRight: 6 }}>Edit</button>
                    {r.is_active
                      ? <button onClick={() => setActive(r, false)} style={{ border: '1px solid var(--border)', background: '#fff', borderRadius: 6, padding: '4px 11px', fontSize: 12.5, cursor: 'pointer', color: '#B5462F' }}>Deactivate</button>
                      : <button onClick={() => setActive(r, true)} style={{ border: '1px solid var(--border)', background: '#fff', borderRadius: 6, padding: '4px 11px', fontSize: 12.5, cursor: 'pointer', color: '#2E7D32' }}>Reactivate</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 12, color: 'var(--mist)', marginTop: 8 }}>{shown.length} contact{shown.length === 1 ? '' : 's'}</div>
        </div>
      )}
    </div>
  )
}
