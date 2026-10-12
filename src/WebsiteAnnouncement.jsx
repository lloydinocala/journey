import { useEffect, useState } from 'react'
import { supabase } from './utils/supabase'

// Website Announcement — the banner across the top of the public journey-hvac.com
// site. Separate from in-app Announcements. One row; turn it on/off and edit the
// text here. The website reads it live (only when it's turned on).
export default function WebsiteAnnouncement({ profile }) {
  const isSuper = profile?.role === 'super_admin'
  const [row, setRow] = useState(null)
  const [message, setMessage] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [active, setActive] = useState(false)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    supabase.from('website_announcements').select('*').order('updated_at', { ascending: false }).limit(1)
      .then(({ data }) => {
        const r = data?.[0] || null
        setRow(r)
        if (r) { setMessage(r.message || ''); setLinkUrl(r.link_url || ''); setLinkLabel(r.link_label || ''); setActive(!!r.is_active) }
      })
  }, [])

  async function save(nextActive = active) {
    setSaving(true); setNote('')
    const fields = {
      message: message.trim(), link_url: linkUrl.trim() || null, link_label: linkLabel.trim() || null,
      is_active: nextActive && !!message.trim(), updated_at: new Date().toISOString(), updated_by: profile?.id || null,
    }
    const q = row
      ? supabase.from('website_announcements').update(fields).eq('id', row.id).select().single()
      : supabase.from('website_announcements').insert(fields).select().single()
    const { data, error } = await q
    setSaving(false)
    if (error) { setNote('Could not save: ' + error.message); return }
    setRow(data); setActive(data.is_active)
    setNote(data.is_active ? 'Saved — the banner is LIVE on journey-hvac.com.' : 'Saved — the banner is OFF.')
  }

  if (!isSuper) return <div><h2 className="page-title">Website Announcement</h2><p>Only platform admins can manage the website banner.</p></div>

  return (
    <div style={{ maxWidth: 760 }}>
      <h2 className="page-title">Website Announcement</h2>
      <p style={{ color: 'var(--mist)', marginTop: 0 }}>
        The banner across the top of the public website, journey-hvac.com. This is separate from in-app Announcements.
      </p>

      <div style={{ padding: 20, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 12 }}>
        <label style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>Banner message</label>
        <textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={200}
          placeholder="e.g. See us at the Florida HVAC Expo — Booth 214!" style={{ width: '100%', padding: 10, fontSize: 15 }} />
        <div style={{ fontSize: 12, color: 'var(--mist)', textAlign: 'right' }}>{message.length}/200</div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
          <div style={{ flex: '2 1 280px' }}>
            <label style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>Link (optional)</label>
            <input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" style={{ width: '100%', padding: 10 }} />
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <label style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>Link text</label>
            <input type="text" value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Learn more" style={{ width: '100%', padding: 10 }} />
          </div>
        </div>

        <div style={{ marginTop: 18, padding: '12px 14px', borderRadius: 8, background: '#053CEB', color: '#fff', fontWeight: 700, textAlign: 'center', opacity: message.trim() ? 1 : 0.4 }}>
          {message.trim() || 'Preview of your banner'}{linkUrl && <u style={{ marginLeft: 8 }}>{linkLabel || 'Learn more'} →</u>}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 18, flexWrap: 'wrap' }}>
          <span className="badge" style={active ? { background: 'rgba(22,163,74,.12)', color: '#15803D', borderColor: 'rgba(22,163,74,.35)' } : {}}>
            {active ? 'LIVE on the website' : 'Off'}
          </span>
          <button className="logout-button" disabled={saving} onClick={() => save(active)}>Save</button>
          {active
            ? <button className="logout-button" disabled={saving} onClick={() => save(false)}>Turn off</button>
            : <button className="auth-button" style={{ width: "auto", marginTop: 0, padding: "9px 16px", fontSize: 15 }} disabled={saving || !message.trim()} onClick={() => save(true)}>Save &amp; turn on</button>}
          {note && <span style={{ fontSize: 13, color: note.startsWith('Could not') ? '#B91C1C' : 'var(--mist)' }}>{note}</span>}
        </div>
      </div>
    </div>
  )
}
