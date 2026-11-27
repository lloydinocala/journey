import { useEffect, useMemo, useState } from 'react'
import { supabase } from './utils/supabase'
import { viewingOrg } from './utils/viewingOrg'

// Customer App Messages — push notifications to Home Comfort Connect (the customer app).
// Automatic messages (wording editable, each can be switched off), a "Send a message" composer
// for Optional Messages (news and offers), a test send to one customer, and a log of everything sent.
// Customers choose what they receive in the app; this page only reaches those who said yes.
const FILLINS = [
  ['{first_name}', "customer's first name"],
  ['{company}', 'your company name'],
  ['{tech_first_name}', "the technician's first name"],
  ['{signoff}', 'tech + company, e.g. "Orlando at Air-Care Connect"'],
]
// Display names for the three categories (keys stay service / greetings / news in the database).
const CAT_LABEL = { service: 'Service Updates', greetings: 'Goodwill', news: 'Optional Messages', test: 'Test' }

export default function CustomerAppMessages({ profile }) {
  const isSuper = profile.role === 'super_admin'
  const [orgId, setOrgId] = useState(() => profile.org_id || viewingOrg())
  const [orgs, setOrgs] = useState([])
  const [defs, setDefs] = useState([])
  const [own, setOwn] = useState({})
  const [edit, setEdit] = useState({})
  const [stats, setStats] = useState(null)
  const [log, setLog] = useState([])
  const [msgTitle, setMsgTitle] = useState('')
  const [msgBody, setMsgBody] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState('')
  const [testCustomer, setTestCustomer] = useState('')
  const [appCustomers, setAppCustomers] = useState([])
  const [suspended, setSuspended] = useState(false)
  const [phoneCheck, setPhoneCheck] = useState([])

  useEffect(() => {
    if (isSuper) supabase.from('organizations').select('id, name').order('name').then(({ data }) => setOrgs(data || []))
    supabase.from('customer_notify_template_defaults').select('*').order('sort').then(({ data }) => setDefs(data || []))
  }, [isSuper])

  async function load() {
    if (!orgId) return
    const [{ data: t }, { data: devs }, { data: prefs }, { data: lg }, { data: o }, { data: ev }] = await Promise.all([
      supabase.from('customer_notify_templates').select('*').eq('org_id', orgId),
      supabase.from('customer_app_devices').select('customer_id, customers(display_name)').eq('org_id', orgId),
      supabase.from('customer_notify_prefs').select('greetings, news').eq('org_id', orgId),
      supabase.from('customer_push_log').select('id, created_at, kind, category, title, body, devices_sent, devices_failed, customers(display_name)').eq('org_id', orgId).order('created_at', { ascending: false }).limit(100),
      supabase.from('organizations').select('customer_push_suspended').eq('id', orgId).maybeSingle(),
      supabase.from('customer_app_push_events').select('customer_id, in_app, platform, permission, step, error, created_at, customers(display_name)').eq('org_id', orgId).order('created_at', { ascending: false }).limit(300),
    ])
    const m = {}; (t || []).forEach((r) => { m[r.kind] = r }); setOwn(m); setEdit({})
    const people = new Map(); (devs || []).forEach((d) => people.set(d.customer_id, d.customers?.display_name || 'Customer'))
    setAppCustomers([...people.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)))
    setStats({ app: people.size, greetings: (prefs || []).filter((p) => p.greetings).length, news: (prefs || []).filter((p) => p.news).length })
    setLog(lg || [])
    setSuspended(!!o?.customer_push_suspended)
    // Phone check: latest event per customer, newest first.
    const seen = new Set(); setPhoneCheck((ev || []).filter((e) => (seen.has(e.customer_id) ? false : (seen.add(e.customer_id), true))))
  }
  useEffect(() => { load() }, [orgId]) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => defs.map((d) => {
    const o = own[d.kind]
    return { ...d, enabled: o ? o.enabled : true, curTitle: o?.title || d.title, curBody: o?.body || d.body, custom: !!(o?.title || o?.body) }
  }), [defs, own])

  async function upsert(kind, patch) {
    const cat = defs.find((d) => d.kind === kind)?.category
    if (cat === 'greetings' && /[$%]|\b(sale|discount|off|coupon|deal|offer)\b/i.test(`${patch.title || ''} ${patch.body || ''}`)) {
      alert('Goodwill messages can’t include prices, discounts or offers. Use "Send a message" (Optional Messages) for news and offers.')
      return
    }
    const o = own[kind] || {}
    const row = { org_id: orgId, kind, enabled: o.enabled ?? true, title: o.title ?? null, body: o.body ?? null, ...patch, updated_at: new Date().toISOString(), updated_by: profile.id }
    const { error } = await supabase.from('customer_notify_templates').upsert(row)
    if (error) { alert(error.message); return }
    load()
  }

  async function invoke(payload) {
    const { data: s } = await supabase.auth.getSession()
    const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://gatndtsmjrxdgxquvydw.supabase.co'}/functions/v1/customer-push`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token}` },
      body: JSON.stringify({ ...payload, org_id: orgId }),
    })
    return r.json().catch(() => ({ error: 'No response' }))
  }

  async function send() {
    if (!msgTitle.trim() || !msgBody.trim()) { setResult('Add a title and a message.'); return }
    if (!window.confirm(`Send this to the ${stats?.news || 0} customer(s) who turned on Optional Messages?`)) return
    setSending(true); setResult('')
    const r = await invoke({ mode: 'campaign', title: msgTitle, body: msgBody })
    setSending(false)
    if (r.error) { setResult(r.error); return }
    setResult(`Sent to ${r.customers_reached} customer(s).`); setMsgTitle(''); setMsgBody(''); load()
  }

  async function testSend(kind) {
    if (!testCustomer) { alert('Choose a customer for the test first (under "Test a message").'); return }
    const r = await invoke({ mode: 'test', kind, customer_id: testCustomer, title: msgTitle, body: msgBody })
    alert(r.error ? r.error : `Test sent to ${r.devices_sent} phone(s).`)
    load()
  }

  async function toggleSuspend() {
    const { error } = await supabase.from('organizations').update({ customer_push_suspended: !suspended }).eq('id', orgId)
    if (error) alert(error.message); else load()
  }

  const box = { background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 16 }

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <h1 style={{ marginTop: 0 }}>Customer App Messages</h1>
      <p style={{ color: 'var(--mist)', marginTop: -6 }}>Notifications to your customers' phones in the Home Comfort Connect app. Customers choose what they receive; you control the wording and can switch any message off.</p>

      {isSuper && (
        <div style={box}>
          <label>Company&nbsp;
            <select value={orgId || ''} onChange={(e) => setOrgId(e.target.value)}>
              <option value="">Choose…</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          {orgId && (
            <span style={{ marginLeft: 16 }}>
              Goodwill & Optional Messages for this company: <b style={{ color: suspended ? '#B42318' : '#067647' }}>{suspended ? 'Suspended' : 'Allowed'}</b>{' '}
              <button onClick={toggleSuspend}>{suspended ? 'Allow' : 'Suspend'}</button>
            </span>
          )}
        </div>
      )}
      {!orgId ? <p>Choose a company.</p> : (
        <>
          {stats && (
            <div style={{ ...box, display: 'flex', gap: 32 }}>
              <div><div style={{ fontSize: 26, fontWeight: 800 }}>{stats.app}</div>customers with the app</div>
              <div><div style={{ fontSize: 26, fontWeight: 800 }}>{stats.greetings}</div>allow Goodwill</div>
              <div><div style={{ fontSize: 26, fontWeight: 800 }}>{stats.news}</div>allow Optional Messages</div>
            </div>
          )}
          {suspended && <div style={{ ...box, borderColor: '#F5C6C0', background: '#FDECEA' }}>Goodwill and Optional Messages are turned off for this company by Journey. Service Updates still go out.</div>}

          <h2>Automatic messages</h2>
          <p style={{ color: 'var(--mist)', marginTop: -6 }}>Fill-ins: {FILLINS.map(([k, d], i) => <span key={k}>{i ? ' · ' : ''}<code>{k}</code> {d}</span>)}</p>
          {rows.map((r) => {
            const e = edit[r.kind]
            return (
              <div key={r.kind} style={{ ...box, opacity: r.enabled ? 1 : 0.6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                  <div><b style={{ fontSize: 16 }}>{r.label}</b> <span style={{ color: 'var(--mist)', fontSize: 13 }}>· {CAT_LABEL[r.category]} · {r.when_sent}</span></div>
                  <label style={{ whiteSpace: 'nowrap' }}><input type="checkbox" checked={r.enabled} onChange={(ev) => upsert(r.kind, { enabled: ev.target.checked })} /> On</label>
                </div>
                {e ? (
                  <div style={{ marginTop: 10 }}>
                    <input value={e.title} onChange={(ev) => setEdit({ ...edit, [r.kind]: { ...e, title: ev.target.value } })} maxLength={60} style={{ width: '100%', marginBottom: 6 }} />
                    <textarea value={e.body} onChange={(ev) => setEdit({ ...edit, [r.kind]: { ...e, body: ev.target.value } })} maxLength={240} rows={3} style={{ width: '100%' }} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      <button onClick={() => upsert(r.kind, { title: e.title.trim() || null, body: e.body.trim() || null })}>Save wording</button>
                      <button onClick={() => setEdit({ ...edit, [r.kind]: undefined })}>Cancel</button>
                      {r.custom && <button onClick={() => upsert(r.kind, { title: null, body: null })}>Back to the standard wording</button>}
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: 8 }}>
                    <div><b>{r.curTitle}</b></div>
                    <div>{r.curBody}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button onClick={() => setEdit({ ...edit, [r.kind]: { title: r.curTitle, body: r.curBody } })}>Edit wording</button>
                      <button onClick={() => testSend(r.kind)}>Send me a test</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          <h2>Send a message</h2>
          <div style={box}>
            <p style={{ marginTop: 0, color: 'var(--mist)' }}>Goes to customers who turned on <b>Optional Messages</b>{stats ? ` (${stats.news} right now)` : ''}. Up to 2 messages in any 7 days, sent between 9 AM and 8 PM.</p>
            <input value={msgTitle} onChange={(e) => setMsgTitle(e.target.value)} placeholder="Title (e.g. Fall tune-ups are open)" maxLength={60} style={{ width: '100%', marginBottom: 6 }} />
            <textarea value={msgBody} onChange={(e) => setMsgBody(e.target.value)} placeholder="Your message. You can use {first_name} and {company}." maxLength={240} rows={3} style={{ width: '100%' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
              <button onClick={send} disabled={sending}>{sending ? 'Sending…' : 'Send'}</button>
              <button onClick={() => testSend(null)}>Send me a test first</button>
              {result && <span>{result}</span>}
            </div>
          </div>

          <h2>Test a message</h2>
          <div style={box}>
            <p style={{ marginTop: 0, color: 'var(--mist)' }}>Tests go to one customer's phone (use your own customer record) and ignore their settings.</p>
            <select value={testCustomer} onChange={(e) => setTestCustomer(e.target.value)}>
              <option value="">{appCustomers.length ? 'Choose a customer with the app…' : 'No customers have the app yet'}</option>
              {appCustomers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <h2>Phone check</h2>
          <div style={box}>
            <p style={{ marginTop: 0, color: 'var(--mist)' }}>What happened the last time each customer opened the portal. Only the store app can get notifications; a phone's web browser or home-screen shortcut can't.</p>
            {!phoneCheck.length ? <p style={{ margin: 0 }}>No customer has opened the portal since this check was added.</p> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead><tr><th align="left">Customer</th><th align="left">Last opened</th><th align="left">Using</th><th align="left">Result</th></tr></thead>
                <tbody>
                  {phoneCheck.map((e) => {
                    const ok = e.step === 'registered'
                    const label = {
                      registered: 'Ready for notifications', opened_app: 'Opened the store app', opened_browser: 'Using a web browser, not the store app',
                      permission_denied: 'Notifications turned off on the phone', phone_refused: 'Phone refused to register', save_failed: 'Registration not saved', plugin_error: 'App error',
                    }[e.step] || e.step
                    return (
                      <tr key={e.customer_id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td>{e.customers?.display_name || '—'}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{new Date(e.created_at).toLocaleString()}</td>
                        <td>{e.in_app ? `Store app (${e.platform === 'ios' ? 'iPhone' : e.platform === 'android' ? 'Android' : e.platform})` : 'Web browser'}</td>
                        <td style={{ color: ok ? '#15803D' : e.step.startsWith('opened') ? 'inherit' : '#B91C1C' }}>{label}{e.error ? ` — ${e.error}` : ''}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          <h2>Sent</h2>
          <div style={box}>
            {!log.length ? <p style={{ margin: 0 }}>Nothing sent yet.</p> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead><tr><th align="left">When</th><th align="left">Customer</th><th align="left">Type</th><th align="left">Message</th><th align="right">Phones</th></tr></thead>
                <tbody>
                  {log.map((l) => (
                    <tr key={l.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ whiteSpace: 'nowrap' }}>{new Date(l.created_at).toLocaleString()}</td>
                      <td>{l.customers?.display_name || '—'}</td>
                      <td>{CAT_LABEL[l.category] || l.category}</td>
                      <td><b>{l.title}</b> {l.body}</td>
                      <td align="right">{l.devices_sent}{l.devices_failed ? ` (${l.devices_failed} failed)` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
