import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'

// A Journey subscriber's account details: what they signed up for, where they stand, and their demo / setup calls.
// Shown on the customer record and in the Call Console when the Journey (Platform) org is selected.
export const JOURNEY_ORG = '5bb0e0a2-9a0a-4f45-96b9-69e7fe31ba8b'
const TZ = 'America/New_York'
const STATUS = {
  pending_setup: { l: 'Waiting for setup', c: '#D97706' }, trial: { l: 'Free trial', c: '#2F79C4' }, active: { l: 'Active', c: '#16A34A' },
  past_due: { l: 'Past due', c: '#DC2626' }, canceled: { l: 'Canceled', c: '#94A3B8' },
}
const PLANS = ['None', 'Pro Starter', 'Growing', 'Ambitious', 'Established']
const TEAMS = ['', 'Just me +1', '2-5 people', '6-10 people', '11-15 people', '16 or more']
const BILLS = ['', 'Monthly, no commitment', 'Monthly, 1-year commitment', 'Annual']
const fmtDay = (d) => d ? new Date(String(d).slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '—'
const fmtWhen = (ts) => ts ? new Date(ts).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ }) : ''
const label = { fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--mist, #64748B)', marginBottom: 6 }

export default function JourneySubscriptionCard({ customerId, compact = false, canEdit = true }) {
  const [sub, setSub] = useState(undefined)
  const [calls, setCalls] = useState([])
  const [edit, setEdit] = useState(null)
  const [err, setErr] = useState('')

  const load = async () => {
    const [{ data: s }, { data: c }] = await Promise.all([
      supabase.from('journey_subscriptions').select('*, account:organizations!journey_subscriptions_subscriber_org_id_fkey(id, name)').eq('customer_id', customerId).maybeSingle(),
      supabase.from('sales_leads').select('id, kind, source, request_date, callback_at, callback_status, status, special_interests, title, contact_name').eq('customer_id', customerId).order('created_at', { ascending: false }).limit(10),
    ])
    setSub(s || null); setCalls(c || [])
  }
  useEffect(() => { if (customerId) load() }, [customerId])

  const startEdit = () => setEdit({ status: sub?.status || 'pending_setup', plan: sub?.plan || 'None', team_size: sub?.team_size || '', billing: sub?.billing || '', addons: (sub?.addons || []).join(', '), current_software: sub?.current_software || '', area_served: sub?.area_served || '', trial_starts: sub?.trial_starts || '', trial_ends: sub?.trial_ends || '', cancel_reason: sub?.cancel_reason || '', notes: sub?.notes || '' })
  const save = async () => {
    setErr('')
    const e = edit
    const row = {
      status: e.status, plan: e.plan, team_size: e.team_size || null, billing: e.billing || null,
      addons: e.addons.split(',').map((x) => x.trim()).filter(Boolean), current_software: e.current_software || null, area_served: e.area_served || null,
      trial_starts: e.trial_starts || null, trial_ends: e.trial_ends || null, notes: e.notes || null, updated_at: new Date().toISOString(),
      cancel_reason: e.status === 'canceled' ? (e.cancel_reason || null) : null,
      canceled_at: e.status === 'canceled' ? (sub?.canceled_at || new Date().toISOString()) : null,
    }
    // Starting a trial with no dates: 14 days from today.
    if (e.status === 'trial' && !row.trial_starts) {
      const t = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
      const end = new Date(t + 'T12:00:00Z'); end.setUTCDate(end.getUTCDate() + 14)
      row.trial_starts = t; row.trial_ends = row.trial_ends || end.toISOString().slice(0, 10)
    }
    const { error } = sub
      ? await supabase.from('journey_subscriptions').update(row).eq('id', sub.id)
      : await supabase.from('journey_subscriptions').insert({ ...row, customer_id: customerId })
    if (error) { setErr(error.message); return }
    setEdit(null); load()
  }

  if (sub === undefined) return <div style={{ color: 'var(--mist, #64748B)', fontSize: 14, margin: '10px 0' }}>Loading account…</div>
  const st = STATUS[sub?.status] || null
  const sel = (k, opts) => <select value={edit[k]} onChange={(ev) => setEdit({ ...edit, [k]: ev.target.value })}>{opts.map((o) => Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o} value={o}>{o || '—'}</option>)}</select>
  const inp = (k, type = 'text') => <input type={type} value={edit[k]} onChange={(ev) => setEdit({ ...edit, [k]: ev.target.value })} />
  const fld = (l, el, wide) => <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12.5, fontWeight: 600, color: '#475569', gridColumn: wide ? '1 / -1' : undefined }}>{l}{el}</label>

  return (
    <div style={{ margin: compact ? '14px 0 0' : '0 0 22px', border: '1px solid #DCE6F0', borderRadius: 12, padding: compact ? 14 : 18, background: '#F8FBFE' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <b style={{ color: '#163E64', fontSize: compact ? 15 : 17 }}>Journey subscription</b>
        {st ? <span style={{ background: st.c, color: '#fff', borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>{st.l}</span>
          : <span style={{ color: 'var(--mist, #64748B)', fontSize: 13 }}>Not signed up</span>}
        {sub?.account && <span style={{ fontSize: 13 }}>Account: <b>{sub.account.name}</b></span>}
        {canEdit && !edit && <button className="btn" style={{ marginLeft: 'auto', padding: '4px 12px' }} onClick={startEdit}>{sub ? 'Edit' : 'Add subscription'}</button>}
      </div>

      {edit ? (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
            {fld('Status', sel('status', Object.entries(STATUS).map(([k, v]) => [k, v.l])))}
            {fld('Plan', sel('plan', PLANS))}
            {fld('Team size', sel('team_size', TEAMS))}
            {fld('Billing', sel('billing', BILLS))}
            {fld('Trial starts', inp('trial_starts', 'date'))}
            {fld('Trial ends', inp('trial_ends', 'date'))}
            {fld('Add-ons (comma separated)', inp('addons'))}
            {fld('Using now', inp('current_software'))}
            {fld('Area served', inp('area_served'))}
            {edit.status === 'canceled' && fld('Why canceled', inp('cancel_reason'))}
            {fld('Notes', <textarea rows={2} value={edit.notes} onChange={(ev) => setEdit({ ...edit, notes: ev.target.value })} />, true)}
          </div>
          {err && <div style={{ color: '#B42318', marginTop: 6 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}><button className="btn btn-primary" onClick={save}>Save</button><button className="btn" onClick={() => setEdit(null)}>Cancel</button></div>
        </div>
      ) : sub ? (
        <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr 1fr' : 'repeat(auto-fill, minmax(200px, 1fr))', gap: '6px 20px', fontSize: 14 }}>
          <div><span style={{ color: '#64748B' }}>Plan:</span> <b>{sub.plan}</b></div>
          <div><span style={{ color: '#64748B' }}>Team:</span> {sub.team_size || '—'}</div>
          <div><span style={{ color: '#64748B' }}>Billing:</span> {sub.billing || '—'}</div>
          <div><span style={{ color: '#64748B' }}>Signed up:</span> {fmtDay(sub.signed_up_at)}</div>
          {(sub.trial_starts || sub.status === 'trial') && <div><span style={{ color: '#64748B' }}>Trial:</span> {fmtDay(sub.trial_starts)} – {fmtDay(sub.trial_ends)}</div>}
          {sub.addons?.length > 0 && <div><span style={{ color: '#64748B' }}>Add-ons:</span> {sub.addons.join(', ')}</div>}
          {sub.current_software && <div><span style={{ color: '#64748B' }}>Using now:</span> {sub.current_software}</div>}
          {sub.area_served && <div><span style={{ color: '#64748B' }}>Area:</span> {sub.area_served}</div>}
          {sub.language && sub.language !== 'English' && <div><span style={{ color: '#64748B' }}>Language:</span> {sub.language}</div>}
          {sub.status === 'canceled' && <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#64748B' }}>Canceled {fmtDay(sub.canceled_at)}:</span> {sub.cancel_reason || '—'}</div>}
          {sub.notes && <div style={{ gridColumn: '1 / -1', whiteSpace: 'pre-wrap' }}><span style={{ color: '#64748B' }}>Notes:</span> {sub.notes}</div>}
        </div>
      ) : null}

      {calls.length > 0 && !edit && (
        <div style={{ marginTop: 12 }}>
          <div style={label}>Demo &amp; setup calls</div>
          {calls.map((c) => (
            <div key={c.id} style={{ fontSize: 13.5, marginBottom: 3 }}>
              {c.kind === 'signup' ? 'Setup call' : c.kind === 'call' ? 'Clara call' : 'Demo'} · {c.callback_at ? fmtWhen(c.callback_at) : `requested ${fmtDay(c.request_date)}`}
              {c.callback_status && <span style={{ color: '#64748B' }}> ({c.callback_status.replace('_', ' ')})</span>}
              {c.special_interests && <span style={{ color: '#64748B' }}> — {c.special_interests}</span>}
            </div>
          ))}
          {!compact && <Link to="/sales-leads" style={{ fontSize: 13 }}>Open Sales →</Link>}
        </div>
      )}
    </div>
  )
}
