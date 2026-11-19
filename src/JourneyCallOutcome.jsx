import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import JourneyAppointmentModal, { JOURNEY_ORG, fmtPhone, TZ } from './JourneyAppointmentModal'

// Call Console, Journey (Platform) org: every call ends in one of three outcomes — and every call is logged.
//   📅 Book an appointment  ·  📌 Create a follow-up  ·  📝 Just log it
// Unknown callers can be turned into a demo request on the spot. Support issues always start as a follow-up.
const KINDS = [
  { k: 'demo', l: 'Demo request', fu: 'callback', appt: 'demo' },
  { k: 'signup', l: 'Sign-up', fu: 'callback', appt: 'setup' },
  { k: 'support', l: 'Support issue', fu: 'support', appt: null },
  { k: 'suggestion', l: 'Suggestion', fu: 'suggestion', appt: null },
  { k: 'vendor', l: 'Vendor', fu: 'vendor', appt: null },
  { k: 'employee', l: 'Employee', fu: 'other', appt: null },
  { k: 'offer', l: 'Sales pitch / offer', fu: null, appt: null },
  { k: 'inquiry', l: 'Inquiry (bank, gov’t…)', fu: 'inquiry', appt: null },
  { k: 'family', l: 'Family / friend', fu: null, appt: null },
  { k: 'other', l: 'Other', fu: 'other', appt: 'other' },
]
const todayET = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
const DEFAULT_KIND = { customer: 'support', vendor: 'vendor', employee: 'employee', known_other: 'other' }

export default function JourneyCallOutcome({ phone, caller, customer, profile, onLogged }) {
  const digits = String(phone || '').replace(/\D/g, '').slice(-10)
  const [lead, setLead] = useState(null)
  const [kind, setKind] = useState(DEFAULT_KIND[caller?.caller_type] || 'demo')
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [note, setNote] = useState('')
  const [mode, setMode] = useState(null)       // 'followup' | 'appt'
  const [fu, setFu] = useState(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setKind(DEFAULT_KIND[caller?.caller_type] || (caller?.known_category === 'friends_family' ? 'family' : caller?.known_category === 'salesman' ? 'offer' : 'demo'))
    setMode(null); setMsg(''); setNote('')
    if (digits.length < 7 || customer) { setLead(null); return }
    supabase.from('sales_leads').select('id, kind, status, contact_name, company_name, email, callback_at, callback_status, plan_chosen').ilike('phone', `%${digits}%`)
      .order('created_at', { ascending: false }).limit(1).then(({ data }) => setLead((data || [])[0] || null))
  }, [digits, customer?.id, caller?.caller_type])

  const K = KINDS.find((x) => x.k === kind) || KINDS[KINDS.length - 1]
  const who = () => ({
    name: caller?.name || lead?.contact_name || name.trim() || null,
    company: customer?.company || lead?.company_name || company.trim() || null,
  })

  async function log(purpose, extra = {}) {
    const w = who()
    await supabase.from('call_logs').insert({
      org_id: JOURNEY_ORG, customer_id: customer?.id || null, vendor_id: caller?.vendor_id || null, known_contact_id: caller?.known_contact_id || null,
      caller_type: caller?.caller_type || (lead ? 'demo_request' : 'unknown'), phone: fmtPhone(digits) || phone, caller_name: w.name,
      purpose: [K.l, purpose, note.trim()].filter(Boolean).join(' — '), direction: 'inbound', source: 'console',
      taken_by: profile?.user_id || null, taken_by_name: profile?.full_name || null, ...extra,
    })
    onLogged && onLogged()
  }
  // Unknown caller asking for a demo becomes a Demo Request first, so the appointment / follow-up links to it.
  async function ensureLead() {
    if (customer || lead || kind !== 'demo') return lead
    const w = who()
    const { data, error } = await supabase.from('sales_leads').insert({
      kind: 'demo', status: 'new', source: 'phone', call_id: `console-${crypto.randomUUID()}`, contact_name: w.name, company_name: w.company,
      phone: digits || null, wants_followup: true, special_interests: note.trim() || null,
    }).select('id, kind, status, contact_name, company_name, email, callback_at, callback_status, plan_chosen').single()
    if (error) { setMsg('Could not create the demo request: ' + error.message); return null }
    setLead(data); return data
  }

  async function justLog() {
    setBusy(true); await log('logged'); setBusy(false)
    setMsg('Call logged.'); setNote('')
  }
  async function startFollowup() {
    const l = await ensureLead()
    const w = who()
    setFu({ type: K.fu || 'other', title: note.trim() || `${K.l}${w.name ? ' — ' + w.name : ''}`, due_date: todayET(), priority: kind === 'inquiry' ? 'important' : 'normal', lead_id: l?.id || null })
    setMode('followup')
  }
  async function saveFollowup() {
    setBusy(true)
    const w = who()
    const { error } = await supabase.from('journey_followups').insert({
      type: fu.type, title: fu.title.trim() || K.l, due_date: fu.due_date, priority: fu.priority, source: 'call',
      customer_id: customer?.id || null, sales_lead_id: fu.lead_id, contact_name: w.name, company: w.company, phone: digits || null,
      email: customer?.email_1 || lead?.email || null, notes: note.trim() || null, created_by: profile?.id || null,
    })
    if (error) { setBusy(false); setMsg('Could not save: ' + error.message); return }
    await log('follow-up created', { follow_up: true, needs_callback: fu.type === 'callback' || fu.type === 'support' })
    setBusy(false); setMode(null); setMsg('Follow-up created and call logged.'); setNote('')
  }
  async function startAppt() {
    const l = await ensureLead()
    const w = who()
    setMode({ appt: { type: K.appt || 'other', customer_id: customer?.id || null, sales_lead_id: customer ? null : (l?.id || null), contact_name: w.name || '', company: w.company || '', phone: digits, email: customer?.email_1 || l?.email || '', notes: note.trim(), day: todayET() } })
  }

  const chip = (on) => ({ fontSize: 12.5, padding: '5px 11px', borderRadius: 999, cursor: 'pointer', border: on ? '1.5px solid #2F79C4' : '1px solid var(--border, #CBD5E1)', background: on ? '#2F79C4' : '#fff', color: on ? '#fff' : 'inherit', fontWeight: on ? 700 : 500 })
  const support = kind === 'support'

  return (
    <div className="section-card" style={{ padding: 18, marginTop: 12, borderLeft: '4px solid #2F79C4' }}>
      {lead && !customer && (
        <div style={{ background: '#EEF4FB', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 14 }}>
          <b>{lead.kind === 'signup' ? 'Signed up on the website' : lead.kind === 'call' ? 'Called Clara before' : 'Demo request'}</b>
          {' · '}{lead.contact_name || ''}{lead.company_name ? ` · ${lead.company_name}` : ''}
          {lead.callback_at && <> · {lead.callback_status === 'booked' ? 'demo booked for' : 'demo was'} {new Date(lead.callback_at).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ })}</>}
          {' '}<Link to="/sales-leads" style={{ marginLeft: 6 }}>Open Sales →</Link>
        </div>
      )}
      <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>What's this call about?</h3>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {KINDS.map((x) => <button key={x.k} type="button" style={chip(kind === x.k)} onClick={() => { setKind(x.k); setMode(null) }}>{x.l}</button>)}
      </div>
      {!caller && !lead && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Caller name" style={{ padding: '8px 11px', border: '1px solid var(--border)', borderRadius: 8, minWidth: 170 }} />
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" style={{ padding: '8px 11px', border: '1px solid var(--border)', borderRadius: 8, minWidth: 170 }} />
        </div>
      )}
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={support ? 'What’s the problem? (becomes the follow-up)' : 'Notes — what they said / want'} style={{ width: '100%', padding: '8px 11px', border: '1px solid var(--border)', borderRadius: 8, boxSizing: 'border-box' }} />

      {!mode && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
          {K.appt && <button className="auth-button" style={{ width: 'auto', margin: 0, padding: '9px 16px' }} disabled={busy} onClick={startAppt}>📅 Book {K.appt === 'setup' ? 'setup call' : K.appt === 'demo' ? 'demo' : 'appointment'}</button>}
          {K.fu && <button className={support ? 'auth-button' : 'logout-button'} style={{ width: 'auto', margin: 0, padding: '9px 16px' }} disabled={busy} onClick={startFollowup}>📌 Create follow-up</button>}
          <button className="logout-button" style={{ margin: 0, padding: '9px 16px' }} disabled={busy} onClick={justLog}>📝 Just log it</button>
          {support && <span style={{ fontSize: 12.5, color: 'var(--mist)' }}>Support issues start as a follow-up — schedule the support call from Follow-ups.</span>}
          {kind === 'demo' && !customer && !lead && <span style={{ fontSize: 12.5, color: 'var(--mist)' }}>Booking or a follow-up also adds them to Demo Requests.</span>}
        </div>
      )}

      {mode === 'followup' && fu && (
        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', background: '#F8FAFC', borderRadius: 8, padding: 10 }}>
          <input value={fu.title} onChange={(e) => setFu({ ...fu, title: e.target.value })} placeholder="What needs to happen" style={{ flex: 1, minWidth: 220, padding: '8px 11px', border: '1px solid var(--border)', borderRadius: 8 }} />
          <input type="date" value={fu.due_date} onChange={(e) => setFu({ ...fu, due_date: e.target.value })} style={{ padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8 }} />
          <select value={fu.priority} onChange={(e) => setFu({ ...fu, priority: e.target.value })} style={{ padding: '8px 9px', border: '1px solid var(--border)', borderRadius: 8 }}><option value="normal">Normal</option><option value="important">⚑ Important</option></select>
          <button className="auth-button" style={{ width: 'auto', margin: 0, padding: '8px 16px' }} disabled={busy} onClick={saveFollowup}>Save follow-up</button>
          <button className="logout-button" style={{ margin: 0 }} onClick={() => setMode(null)}>Cancel</button>
        </div>
      )}

      {msg && <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: msg.startsWith('Could') ? '#B42318' : '#1a7f37' }}>{msg}</div>}

      {mode?.appt && (
        <JourneyAppointmentModal appt={mode.appt} profile={profile} onClose={() => setMode(null)}
          onSaved={async () => { await log(`${K.appt === 'setup' ? 'setup call' : K.appt === 'demo' ? 'demo' : 'appointment'} booked`); setMsg('Appointment booked and call logged.'); setNote('') }} />
      )}
    </div>
  )
}

// Settings for Journey's own phone line (journey-voice). Shown at the bottom of the Call Console for the Journey org.
export function JourneyPhoneSettings() {
  const [s, setS] = useState(null)
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState('')
  useEffect(() => { supabase.from('journey_phone_settings').select('*').eq('id', 1).maybeSingle().then(({ data }) => setS(data)) }, [])
  if (!s) return null
  const save = async () => {
    const { error } = await supabase.from('journey_phone_settings').update({ active: s.active, forward_number: s.forward_number || null, ring_seconds: Number(s.ring_seconds) || 20, unknown_callers: s.unknown_callers, clara_number: s.clara_number || null, voicemail_greeting: s.voicemail_greeting, updated_at: new Date().toISOString() }).eq('id', 1)
    setSaved(error ? 'Could not save: ' + error.message : 'Saved.'); setTimeout(() => setSaved(''), 3000)
  }
  const inp = { padding: '8px 11px', border: '1px solid var(--border)', borderRadius: 8 }
  return (
    <div className="section-card" style={{ padding: 16, marginTop: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <b>☎ Journey phone line</b>
        <span style={{ fontSize: 12.5, color: s.active ? '#1a7f37' : 'var(--mist)', fontWeight: 700 }}>{s.active ? `On — rings ${fmtPhone(s.forward_number) || '(no number set)'}` : 'Off — calls go to voicemail'}</span>
        <span style={{ marginLeft: 'auto', color: 'var(--mist)' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={s.active} onChange={(e) => setS({ ...s, active: e.target.checked })} /> Ring calls through (otherwise every call goes to voicemail)</label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span>Ring</span><input style={{ ...inp, width: 170 }} value={s.forward_number || ''} onChange={(e) => setS({ ...s, forward_number: e.target.value })} placeholder="(352) 555-0123" />
            <span>for</span><select style={inp} value={s.ring_seconds} onChange={(e) => setS({ ...s, ring_seconds: e.target.value })}>{[15, 20, 25, 30, 40].map((n) => <option key={n} value={n}>{n} seconds</option>)}</select>
            <span>then voicemail.</span>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span>Callers Journey doesn't know:</span>
            <select style={inp} value={s.unknown_callers} onChange={(e) => setS({ ...s, unknown_callers: e.target.value })}><option value="forward">Ring through like everyone else</option><option value="clara">Go to Clara</option></select>
            {s.unknown_callers === 'clara' && <input style={{ ...inp, width: 170 }} value={s.clara_number || ''} onChange={(e) => setS({ ...s, clara_number: e.target.value })} placeholder="Clara's number" />}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--mist)' }}>Friends &amp; family (Known Others) always ring through, then voicemail. Every call is logged.</div>
          <label style={{ display: 'grid', gap: 4 }}>Voicemail greeting<textarea rows={2} style={inp} value={s.voicemail_greeting} onChange={(e) => setS({ ...s, voicemail_greeting: e.target.value })} /></label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><button className="auth-button" style={{ width: 'auto', margin: 0, padding: '8px 18px' }} onClick={save}>Save</button>{saved && <span style={{ fontSize: 13, fontWeight: 700, color: saved.startsWith('Could') ? '#B42318' : '#1a7f37' }}>{saved}</span>}</div>
        </div>
      )}
    </div>
  )
}
