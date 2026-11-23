import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'

// Subscriber Watch (super admin) — watches subscribers' activity against the Subscriber Agreement
// and flags possible problems early, so Lloyd can reach out before they grow. REPORT ONLY:
// nothing on this page suspends, restricts, or contacts a subscriber.
// Data: platform_watch_rules / platform_watch_alerts / platform_watch_settings, filled by
// run_platform_watch() every 10 minutes (pg_cron 'platform-watch'). New urgent and warning
// alerts are pushed to Lloyd's phone.

const SEV = {
  urgent: { label: 'Urgent', bg: '#FDECEC', fg: '#B42318', border: '#F5B5B0' },
  warning: { label: 'Warning', bg: '#FFF6E5', fg: '#B45309', border: '#F7D49A' },
  info: { label: 'Heads-up', bg: '#EAF2FB', fg: '#1D5FA8', border: '#B9D3F0' },
}
const SEV_ORDER = { urgent: 0, warning: 1, info: 2 }
const STATUS_LABEL = { open: 'New', acknowledged: "I'm on it", resolved: 'Resolved', cleared: 'Cleared on its own' }

const fmt = (ts) => (ts ? new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—')
function ago(ts) {
  if (!ts) return 'never'
  const m = Math.round((Date.now() - new Date(ts).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 48) return `${h} hr ago`
  return `${Math.round(h / 24)} days ago`
}

function Chip({ sev }) {
  const s = SEV[sev] || SEV.info
  return (
    <span style={{ background: s.bg, color: s.fg, border: `1px solid ${s.border}`, borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

export default function SubscriberWatch({ profile }) {
  const [alerts, setAlerts] = useState([])
  const [rules, setRules] = useState([])
  const [settings, setSettings] = useState(null)
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('active') // active | history
  const [orgFilter, setOrgFilter] = useState('')
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [noteFor, setNoteFor] = useState(null)
  const [noteText, setNoteText] = useState('')
  const [showRules, setShowRules] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const since = new Date(Date.now() - 90 * 86400000).toISOString()
    const [a, r, s, o] = await Promise.all([
      supabase.from('platform_watch_alerts').select('*').gte('last_seen_at', since).order('last_seen_at', { ascending: false }).limit(1000),
      supabase.from('platform_watch_rules').select('*').order('sort'),
      supabase.from('platform_watch_settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('organizations').select('id, name, dba_name, billing_status').order('name'),
    ])
    if (a.error) setMsg('Could not load alerts: ' + a.error.message)
    setAlerts(a.data || [])
    setRules(r.data || [])
    setSettings(s.data || null)
    setOrgs(o.data || [])
    setLoading(false)
  }

  const orgName = useMemo(() => {
    const m = {}
    orgs.forEach((o) => { m[o.id] = o.dba_name || o.name })
    return m
  }, [orgs])
  const ruleBy = useMemo(() => {
    const m = {}
    rules.forEach((r) => { m[r.rule_key] = r })
    return m
  }, [rules])

  const active = alerts.filter((a) => a.status === 'open' || a.status === 'acknowledged')
  const shown = (view === 'active' ? active : alerts.filter((a) => a.status === 'resolved' || a.status === 'cleared'))
    .filter((a) => !orgFilter || a.org_id === orgFilter)
    .sort((x, y) => (view === 'active'
      ? (SEV_ORDER[x.severity] - SEV_ORDER[y.severity]) || (new Date(y.first_seen_at) - new Date(x.first_seen_at))
      : new Date(y.resolved_at || y.last_seen_at) - new Date(x.resolved_at || x.last_seen_at)))

  const counts = { urgent: 0, warning: 0, info: 0 }
  active.forEach((a) => { counts[a.severity] = (counts[a.severity] || 0) + 1 })

  // Group by subscriber so one company's problems read together.
  const groups = []
  const idx = {}
  shown.forEach((a) => {
    const k = a.org_id || 'none'
    if (idx[k] === undefined) { idx[k] = groups.length; groups.push({ org_id: a.org_id, items: [] }) }
    groups[idx[k]].items.push(a)
  })

  async function scanNow() {
    setBusy('scan'); setMsg('')
    const { data, error } = await supabase.rpc('platform_watch_scan_now')
    setBusy('')
    if (error) { setMsg('Scan failed: ' + error.message); return }
    setMsg(`Scan done: ${data?.new || 0} new, ${data?.cleared || 0} cleared on their own.`)
    loadAll()
  }

  async function setStatus(a, status, note) {
    setBusy(a.id); setMsg('')
    const { data: u } = await supabase.auth.getUser()
    const now = new Date().toISOString()
    const patch = { status }
    if (status === 'acknowledged') Object.assign(patch, { acknowledged_at: now, acknowledged_by: u?.user?.id || null })
    if (status === 'resolved') Object.assign(patch, { resolved_at: now, resolved_by: u?.user?.id || null })
    if (status === 'open') Object.assign(patch, { acknowledged_at: null, acknowledged_by: null })
    if (note !== undefined) patch.note = note
    const { error } = await supabase.from('platform_watch_alerts').update(patch).eq('id', a.id)
    setBusy('')
    if (error) { setMsg('Could not save: ' + error.message); return }
    setAlerts((prev) => prev.map((x) => (x.id === a.id ? { ...x, ...patch } : x)))
  }

  async function saveNote(a) {
    const { error } = await supabase.from('platform_watch_alerts').update({ note: noteText.trim() || null }).eq('id', a.id)
    if (error) { setMsg('Could not save the note: ' + error.message); return }
    setAlerts((prev) => prev.map((x) => (x.id === a.id ? { ...x, note: noteText.trim() || null } : x)))
    setNoteFor(null); setNoteText('')
  }

  async function updateRule(rule, patch) {
    const { error } = await supabase.from('platform_watch_rules').update(patch).eq('rule_key', rule.rule_key)
    if (error) { setMsg('Could not save the rule: ' + error.message); return }
    setRules((prev) => prev.map((r) => (r.rule_key === rule.rule_key ? { ...r, ...patch } : r)))
  }

  async function updateSettings(patch) {
    const { error } = await supabase.from('platform_watch_settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1)
    if (error) { setMsg('Could not save settings: ' + error.message); return }
    setSettings((s) => ({ ...s, ...patch }))
  }

  function toggleExcluded(orgId) {
    const cur = settings?.excluded_org_ids || []
    updateSettings({ excluded_org_ids: cur.includes(orgId) ? cur.filter((x) => x !== orgId) : [...cur, orgId] })
  }

  if (profile && profile.role !== 'super_admin') return <p>This page is for the Journey platform owner.</p>

  const orgsWithAlerts = [...new Set(alerts.map((a) => a.org_id).filter(Boolean))]

  return (
    <div style={{ maxWidth: 1100 }}>
      <h2 className="page-title">Subscriber Watch</h2>
      <p style={{ color: 'var(--mist)', fontSize: 14, marginTop: -12, marginBottom: 18, maxWidth: 820 }}>
        Journey checks every subscriber against the Subscriber Agreement every 10 minutes and flags anything that
        could turn into a problem, so you can reach out early. <b>Report only:</b> nothing here changes, restricts or
        contacts a subscriber. New urgent and warning items are sent to your phone.
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        {['urgent', 'warning', 'info'].map((k) => (
          <div key={k} style={{ background: SEV[k].bg, border: `1px solid ${SEV[k].border}`, borderRadius: 10, padding: '10px 16px', minWidth: 130 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: SEV[k].fg, lineHeight: 1.1 }}>{counts[k] || 0}</div>
            <div style={{ fontSize: 13, color: SEV[k].fg, fontWeight: 600 }}>{SEV[k].label}</div>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', textAlign: 'right', alignSelf: 'center' }}>
          <div style={{ fontSize: 12.5, color: 'var(--mist)' }}>Last check: {ago(settings?.last_run_at)}</div>
          <button className="auth-button" style={{ width: 'auto', padding: '8px 16px', marginTop: 6 }} onClick={scanNow} disabled={busy === 'scan'}>
            {busy === 'scan' ? 'Checking…' : 'Check now'}
          </button>
        </div>
      </div>

      {msg && <div className="auth-error" style={{ background: msg.startsWith('Scan done') ? '#ECFDF3' : undefined, color: msg.startsWith('Scan done') ? '#027A48' : undefined }}>{msg}</div>}

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className={view === 'active' ? 'auth-button' : 'logout-button'} style={{ width: 'auto', padding: '6px 14px', margin: 0 }} onClick={() => setView('active')}>
            Needs attention ({active.length})
          </button>
          <button className={view === 'history' ? 'auth-button' : 'logout-button'} style={{ width: 'auto', padding: '6px 14px', margin: 0 }} onClick={() => setView('history')}>
            History
          </button>
        </div>
        <div className="field" style={{ marginBottom: 0, minWidth: 240 }}>
          <label htmlFor="pwOrg">Subscriber</label>
          <select id="pwOrg" value={orgFilter} onChange={(e) => setOrgFilter(e.target.value)}>
            <option value="">All subscribers</option>
            {orgsWithAlerts.map((id) => <option key={id} value={id}>{orgName[id] || 'Unknown'}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : groups.length === 0 ? (
        <div style={{ border: '1px solid #D1FADF', background: '#F6FEF9', borderRadius: 10, padding: 18, color: '#027A48' }}>
          {view === 'active' ? 'All clear. Nothing needs your attention right now.' : 'No history yet.'}
        </div>
      ) : groups.map((g) => (
        <div key={g.org_id || 'none'} style={{ marginBottom: 22 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 17 }}>
            {orgName[g.org_id] || 'Unknown subscriber'}
            <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--mist)' }}> · {g.items.length} item{g.items.length !== 1 ? 's' : ''}</span>
          </h3>
          {g.items.map((a) => {
            const rule = ruleBy[a.rule_key] || {}
            const s = SEV[a.severity] || SEV.info
            return (
              <div key={a.id} style={{ border: `1px solid ${s.border}`, borderLeft: `5px solid ${s.fg}`, borderRadius: 10, padding: '12px 14px', marginBottom: 10, background: '#fff' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Chip sev={a.severity} />
                  <b style={{ fontSize: 15 }}>{a.title}</b>
                  <span style={{ fontSize: 12, color: 'var(--mist)' }}>Agreement {/^\d/.test(rule.clause || '') ? '§' : ''}{rule.clause}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: a.status === 'acknowledged' ? '#1D5FA8' : a.status === 'open' ? s.fg : '#475467' }}>
                    {STATUS_LABEL[a.status]}
                  </span>
                </div>
                {a.detail && <div style={{ marginTop: 6, fontSize: 14 }}>{a.detail}</div>}
                {rule.suggestion && (
                  <div style={{ marginTop: 8, fontSize: 13.5, background: '#F8FAFC', borderRadius: 8, padding: '8px 10px' }}>
                    <b>Friendly first step:</b> {rule.suggestion}
                  </div>
                )}
                {a.note && noteFor !== a.id && <div style={{ marginTop: 8, fontSize: 13.5 }}><b>Your note:</b> {a.note}</div>}
                {noteFor === a.id && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={2} style={{ flex: 1, fontSize: 14 }} placeholder="What you did or agreed with them…" />
                    <button className="auth-button" style={{ width: 'auto', padding: '6px 12px', margin: 0 }} onClick={() => saveNote(a)}>Save</button>
                    <button className="logout-button" onClick={() => { setNoteFor(null); setNoteText('') }}>Cancel</button>
                  </div>
                )}
                <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--mist)' }}>
                    First seen {fmt(a.first_seen_at)} · last seen {ago(a.last_seen_at)}
                    {a.status === 'resolved' && a.resolved_at ? ` · resolved ${fmt(a.resolved_at)}` : ''}
                    {a.status === 'cleared' && a.resolved_at ? ` · cleared ${fmt(a.resolved_at)}` : ''}
                  </span>
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {a.status === 'open' && (
                      <button className="logout-button" disabled={busy === a.id} onClick={() => setStatus(a, 'acknowledged')}>I'm on it</button>
                    )}
                    {(a.status === 'open' || a.status === 'acknowledged') && (
                      <button className="logout-button" disabled={busy === a.id} onClick={() => setStatus(a, 'resolved')}
                        title="Marks it handled. It stays quiet while the condition lasts and reopens only if it goes away and comes back.">
                        Resolved
                      </button>
                    )}
                    {a.status === 'acknowledged' && (
                      <button className="logout-button" disabled={busy === a.id} onClick={() => setStatus(a, 'open')}>Undo</button>
                    )}
                    <button className="logout-button" onClick={() => { setNoteFor(a.id); setNoteText(a.note || '') }}>{a.note ? 'Edit note' : 'Add note'}</button>
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      ))}

      <div style={{ marginTop: 28, borderTop: '1px solid #E4E7EC', paddingTop: 16 }}>
        <button className="logout-button" onClick={() => setShowRules((v) => !v)}>{showRules ? 'Hide' : 'Show'} what Journey watches ({rules.filter((r) => r.enabled).length} of {rules.length} on)</button>
        {showRules && (
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table className="data-table">
              <thead>
                <tr><th>On</th><th>What it watches</th><th>Agreement</th><th>Level</th></tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.rule_key}>
                    <td><input type="checkbox" checked={r.enabled} onChange={(e) => updateRule(r, { enabled: e.target.checked })} /></td>
                    <td style={{ maxWidth: 560 }}>
                      <b>{r.label}</b> <span style={{ color: 'var(--mist)', fontSize: 12 }}>· {r.area}</span>
                      <div style={{ fontSize: 13, color: '#344054' }}>{r.description}</div>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{/^\d/.test(r.clause) ? '§' : ''}{r.clause}</td>
                    <td>
                      <select value={r.severity} onChange={(e) => updateRule(r, { severity: e.target.value })}>
                        <option value="urgent">Urgent</option>
                        <option value="warning">Warning</option>
                        <option value="info">Heads-up</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: 12.5, color: 'var(--mist)', marginTop: 8 }}>
              A new level applies to new alerts. Not watched automatically: training-manual sharing, copying the software,
              and how techs talk to customers in person. Those need a person's judgment.
            </p>
          </div>
        )}
      </div>

      <div style={{ marginTop: 14 }}>
        <button className="logout-button" onClick={() => setShowSettings((v) => !v)}>{showSettings ? 'Hide' : 'Show'} alert settings</button>
        {showSettings && settings && (
          <div style={{ marginTop: 12, border: '1px solid #E4E7EC', borderRadius: 10, padding: 14 }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <input type="checkbox" checked={settings.push_urgent} onChange={(e) => updateSettings({ push_urgent: e.target.checked })} />
              Send <b>urgent</b> items to my phone right away
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <input type="checkbox" checked={settings.push_warning} onChange={(e) => updateSettings({ push_warning: e.target.checked })} />
              Send <b>warnings</b> to my phone right away
            </label>
            <div style={{ fontSize: 13, color: 'var(--mist)', marginBottom: 12 }}>
              Heads-up items only show here. Phone alerts go to the Journey app on your iPhone (your Air-Care login).
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Don't watch these companies</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 18px' }}>
              {orgs.filter((o) => o.billing_status !== 'canceled').map((o) => (
                <label key={o.id} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }}>
                  <input type="checkbox" checked={(settings.excluded_org_ids || []).includes(o.id)} onChange={() => toggleExcluded(o.id)} />
                  {o.dba_name || o.name}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <p style={{ fontSize: 12.5, color: 'var(--mist)', marginTop: 22 }}>
        Want to see a subscriber's account? <Link to="/organizations">Organizations</Link>
      </p>
    </div>
  )
}

// Small summary for the super-admin Dashboard.
export function SubscriberWatchSummary() {
  const [c, setC] = useState(null)
  useEffect(() => {
    supabase.from('platform_watch_alerts').select('severity').in('status', ['open', 'acknowledged'])
      .then(({ data }) => {
        const n = { urgent: 0, warning: 0, info: 0 }
        ;(data || []).forEach((a) => { n[a.severity] = (n[a.severity] || 0) + 1 })
        setC(n)
      })
  }, [])
  if (!c) return null
  const total = c.urgent + c.warning + c.info
  const tone = c.urgent ? SEV.urgent : c.warning ? SEV.warning : total ? SEV.info : { bg: '#F6FEF9', fg: '#027A48', border: '#D1FADF' }
  return (
    <div style={{ background: tone.bg, border: `1px solid ${tone.border}`, borderRadius: 10, padding: '10px 14px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <b style={{ color: tone.fg }}>Subscriber Watch</b>
      <span style={{ color: tone.fg, fontSize: 14 }}>
        {total === 0 ? 'All clear.' : `${c.urgent} urgent · ${c.warning} warning · ${c.info} heads-up`}
      </span>
      <Link to="/subscriber-watch" className="logout-button" style={{ marginLeft: 'auto', fontSize: 12 }}>Open →</Link>
    </div>
  )
}
