import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'

const BROADCAST = '__broadcast__'

export default function Announcements() {
  const [orgs, setOrgs] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)

  const [targetOrg, setTargetOrg] = useState(BROADCAST)
  const [severity, setSeverity] = useState('info')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('organizations').select('id, name').order('name').then(({ data }) => setOrgs(data || []))
    loadAnnouncements()
  }, [])

  async function loadAnnouncements() {
    setLoading(true)
    const { data } = await supabase
      .from('org_announcements')
      .select('id, org_id, severity, message, is_active, created_at, organizations(name)')
      .order('created_at', { ascending: false })
    setAnnouncements(data || [])
    setLoading(false)
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    if (!message.trim()) return

    setSaving(true)
    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase.from('org_announcements').insert({
      org_id: targetOrg === BROADCAST ? null : targetOrg,
      severity,
      message: message.trim(),
      created_by: userData.user.id,
    })
    setSaving(false)

    if (error) {
      setError(error.message)
    } else {
      setMessage('')
      loadAnnouncements()
    }
  }

  async function toggleActive(a) {
    await supabase.from('org_announcements').update({ is_active: !a.is_active }).eq('id', a.id)
    loadAnnouncements()
  }

  return (
    <div>
      <h2 className="page-title">Announcements</h2>
      <p style={{ color: 'var(--mist)', fontSize: 14, marginTop: -12, marginBottom: 20 }}>
        Messages appear at the top of the app for whoever you target — above the
        navigation bar, before they can miss it. Turn one off once it's resolved.
      </p>

      <form className="inline-form" onSubmit={handleAdd} style={{ marginBottom: 28, flexWrap: 'wrap' }}>
        <div className="field">
          <label htmlFor="targetOrg">Send to</label>
          <select id="targetOrg" value={targetOrg} onChange={(e) => setTargetOrg(e.target.value)}>
            <option value={BROADCAST}>All organizations</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="severity">Type</label>
          <select id="severity" value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="info">Info (blue)</option>
            <option value="warning">Warning (amber)</option>
            <option value="critical">Critical (red)</option>
          </select>
        </div>
        <div className="field" style={{ minWidth: 320 }}>
          <label htmlFor="message">Message</label>
          <input
            id="message"
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. Your account is 5 days from suspension for non-payment."
            required
          />
        </div>
        <button className="auth-button" type="submit" disabled={saving}>
          {saving ? 'Sending…' : 'Send'}
        </button>
      </form>

      {error && <div className="auth-error">{error}</div>}

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : (
        <div className="grid-table" style={{ gridTemplateColumns: '1fr 0.7fr 2fr 0.7fr 1fr' }}>
          <div className="grid-cell grid-head">Target</div>
          <div className="grid-cell grid-head">Type</div>
          <div className="grid-cell grid-head">Message</div>
          <div className="grid-cell grid-head">Status</div>
          <div className="grid-cell grid-head"></div>

          {announcements.map((a) => (
            <>
              <div className="grid-cell">{a.organizations?.name || 'All organizations'}</div>
              <div className="grid-cell">
                <span className={`status-pill status-${a.severity === 'critical' ? 'past_due' : a.severity === 'warning' ? 'trial' : 'scheduled'}`}>
                  {a.severity}
                </span>
              </div>
              <div className="grid-cell">{a.message}</div>
              <div className="grid-cell">
                <span className={`status-pill ${a.is_active ? 'status-active' : 'status-canceled'}`}>
                  {a.is_active ? 'Active' : 'Off'}
                </span>
              </div>
              <div className="grid-cell grid-actions">
                <button className="logout-button" onClick={() => toggleActive(a)}>
                  {a.is_active ? 'Turn off' : 'Turn on'}
                </button>
              </div>
            </>
          ))}
          {announcements.length === 0 && (
            <div className="grid-cell" style={{ gridColumn: '1 / -1', color: 'var(--mist)' }}>No announcements yet.</div>
          )}
        </div>
      )}
    </div>
  )
}
