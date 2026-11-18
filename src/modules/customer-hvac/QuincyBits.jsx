import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'

// Quincy's pieces outside the chat window:
//   <QuincyNotices />          — "Quincy noticed…" cards on Home (filters due, tune-up due,
//                                estimate waiting, warranty ending, tech on the way, visit soon)
//   <QuincyExplain kind id />  — "Explain this" on an invoice, estimate or service report:
//                                plain English + Quincy's honest take, kept separate
//   <QuincyAction action />    — the confirm card when Quincy offers to DO something in chat
// Everything is scoped server-side to the signed-in customer (quincy-portal function).

const WLABEL = { '8_11': '8–11 AM', '10_1': '10 AM–1 PM', '12_3': '12–3 PM', '2_5': '2–5 PM', asap: 'As soon as possible' }
const dayLabel = (d) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
const money = (n) => `$${Number(n || 0).toFixed(2)}`
const TYPE_WORD = { repair: 'Repair visit', pm: 'Maintenance tune-up', system_quote: 'New-system estimate' }

export function QuincyNotices() {
  const nav = useNavigate()
  const [items, setItems] = useState(null)
  const [open, setOpen] = useState(null) // notice id whose explain panel is open
  useEffect(() => {
    let live = true
    supabase.functions.invoke('quincy-portal', { body: { mode: 'notices' } }).then(({ data }) => { if (live) setItems(data?.notices || []) })
    return () => { live = false }
  }, [])
  if (!items || !items.length) return null
  return (
    <div className="qn-wrap">
      <div className="qn-head"><img src="/quincy-logo.png" alt="" /> Quincy noticed…</div>
      {items.map((n) => (
        <div key={n.id} className={'qn-card ' + (n.tone || '')}>
          <b>{n.title}</b>
          <span>{n.body}</span>
          {n.cta && (
            <button className="cp-btn sm qn-cta" onClick={() => {
              if (n.cta.to) nav(n.cta.to)
              else if (n.cta.ask) nav('/portal/quincy', { state: { ask: n.cta.ask } })
              else if (n.cta.explain) setOpen(open === n.id ? null : n.id)
            }}>{n.cta.label}</button>
          )}
          {n.cta?.explain && open === n.id && <QuincyExplain kind={n.cta.explain.kind} id={n.cta.explain.id} autoOpen />}
        </div>
      ))}
    </div>
  )
}

export function QuincyExplain({ kind, id, autoOpen = false }) {
  const [open, setOpen] = useState(autoOpen)
  const [res, setRes] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    if (!open || res || err) return
    supabase.functions.invoke('quincy-portal', { body: { mode: 'explain', kind, id } }).then(({ data, error }) => {
      if (error || data?.error) setErr(data?.error || 'Quincy couldn’t read this one just now. Please try again.')
      else setRes(data)
    })
  }, [open, kind, id, res, err])
  if (!open) return <button className="cp-btn ghost sm qx-btn" onClick={() => setOpen(true)}>✨ Explain this</button>
  return (
    <div className="qx-panel">
      {!res && !err && <div className="qx-loading">Quincy is reading it…</div>}
      {err && <div className="cp-err">{err}</div>}
      {res && (
        <>
          <div className="qx-label">In plain English</div>
          <div className="qx-text">{res.plain}</div>
          {res.take && (
            <div className="qx-take">
              <div className="qx-label"><img src="/quincy-logo.png" alt="" /> Quincy’s honest take</div>
              <div className="qx-text">{res.take}</div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Runs the same steps the app's own screens use (booking, filter order, estimate decision) —
// only after the customer taps Confirm.
export function QuincyAction({ action, onDone }) {
  const [state, setState] = useState('ready') // ready | busy | done | error
  const [msg, setMsg] = useState('')
  const [avail, setAvail] = useState(null)
  const [pick, setPick] = useState(null) // { d, w }

  useEffect(() => {
    if (action.kind !== 'book') return
    supabase.rpc('get_booking_availability', { p_type: action.visit_type, p_days: 21 }).then(({ data }) => setAvail((data || []).slice(0, 3)))
  }, [action])

  async function confirm() {
    setState('busy'); setMsg('')
    try {
      if (action.kind === 'book') {
        if (!pick) { setState('ready'); setMsg('Pick a time first.'); return }
        const { data, error } = await supabase.rpc('book_appointment', {
          p_property_id: action.property_id, p_type: action.visit_type, p_date: pick.d, p_window: pick.w, p_details: action.details || null,
        })
        if (error || !data) throw new Error(error?.message || 'That time was just taken — please pick another.')
        finish(`You’re booked: ${TYPE_WORD[action.visit_type]} on ${dayLabel(pick.d)}${pick.w === 'asap' ? ', as soon as possible' : `, ${WLABEL[pick.w]}`}. You’ll get a confirmation by text and email.`)
      } else if (action.kind === 'filters') {
        let invoiced = false
        try {
          const { data, error } = await supabase.functions.invoke('create-filter-invoice', { body: { propertyId: action.property_id, items: action.items } })
          invoiced = !error && !!data?.invoiced
        } catch { /* fall back to a request */ }
        if (!invoiced) {
          const details = 'Reorder usual filters (via Quincy):\n' + action.items.map((f) => `• ${f.qty}× ${[f.width, f.height, f.thickness].filter(Boolean).join('x')}${f.merv ? ` MERV ${f.merv}` : ''}`).join('\n')
          const { error } = await supabase.rpc('submit_customer_request', { p_property_id: action.property_id, p_type: 'filter_order', p_details: details, p_window: null })
          if (error) throw new Error(error.message)
        }
        finish(invoiced ? 'Done — your filter invoice is in your email with a secure link to pay by card.' : 'Done — your filter order is in. The office will follow up to confirm.')
      } else if (action.kind === 'estimate') {
        const { error } = await supabase.rpc('record_customer_estimate_decision', { p_estimate_id: action.estimate_id, p_decision: action.decision })
        if (error) throw new Error(error.message)
        finish(action.decision === 'approved' ? `Approved — Estimate #${action.number}. The office will be in touch to schedule.` : `Declined — Estimate #${action.number}. No problem at all.`)
      }
    } catch (e) { setState('error'); setMsg(e.message || 'Something went wrong. Please try again.') }
  }
  function finish(text) { setState('done'); setMsg(text); onDone?.(text) }

  if (state === 'done') return <div className="qa-card done">✅ {msg}</div>
  return (
    <div className="qa-card">
      {action.kind === 'book' && (
        <>
          <b>{TYPE_WORD[action.visit_type]}</b>
          {action.details && <span className="qa-sub">“{action.details}”</span>}
          {!avail ? <div className="qa-sub">Finding open times…</div> : !avail.length ? <div className="qa-sub">No open times in the next few weeks — please call the office.</div> : (
            <div className="qa-days">
              {avail.map((a) => (
                <div key={a.d} className="qa-day">
                  <div className="qa-dl">{dayLabel(a.d)}</div>
                  <div className="qa-wins">
                    {(a.windows || []).map((w) => (
                      <button key={w} className={'cp-chip' + (pick?.d === a.d && pick?.w === w ? ' on' : '')} onClick={() => setPick({ d: a.d, w })}>{WLABEL[w] || w}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {action.kind === 'filters' && (
        <>
          <b>Reorder my usual filters</b>
          {action.items.map((f, i) => <span key={i} className="qa-sub">{f.qty}× {[f.width, f.height, f.thickness].filter(Boolean).join('×')}{f.merv ? ` · MERV ${f.merv}` : ''}</span>)}
        </>
      )}
      {action.kind === 'estimate' && (
        <>
          <b>{action.decision === 'approved' ? 'Approve' : 'Decline'} Estimate #{action.number}</b>
          <span className="qa-sub">{money(action.total)}</span>
        </>
      )}
      {msg && <div className="cp-err">{msg}</div>}
      <button className={'cp-btn sm ' + (action.kind === 'estimate' && action.decision === 'declined' ? 'ghost' : 'pay')} style={{ marginTop: 10 }}
        disabled={state === 'busy' || (action.kind === 'book' && !pick)} onClick={confirm}>
        {state === 'busy' ? 'Working…' : action.kind === 'book' ? 'Confirm booking' : action.kind === 'filters' ? 'Confirm order' : 'Confirm'}
      </button>
    </div>
  )
}
