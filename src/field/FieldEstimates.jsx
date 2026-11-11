import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FieldShell from './FieldShell'
import { supabase } from '../utils/supabase'
import AgentInbox from '../AgentInbox'
import { usd, daysSince, shortDay, sendDoc } from './fieldUtil'

// ESTIMATES — the quotes still waiting on a yes. Follow up by email or text, record a yes taken
// over the phone, and turn approved estimates into jobs. Agent Inbox holds Quincy's drafted follow-ups.
const isDuct = (e) => e.service_line === 'duct' || /-E$/i.test(e.invoice_number || '')

export default function FieldEstimates({ profile }) {
  const navigate = useNavigate()
  const orgId = profile?.org_id
  const [tab, setTab] = useState('waiting')
  const [rows, setRows] = useState(null)
  const [open, setOpen] = useState(null)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!orgId) return
    let live = true
    ;(async () => {
      const { data } = await supabase.from('invoices')
        .select('id, invoice_number, estimate_type, service_line, approval_status, approved_at, sent_at, sent_count, created_at, job_total, job_id, reference_job_id, spawned_job_id, converted_to_job_id, bills_to_customer_id, is_archived')
        .eq('org_id', orgId).eq('kind', 'estimate').is('deleted_at', null).in('approval_status', ['Pending', 'Approved'])
        .order('created_at', { ascending: false }).limit(200)
      const list = (data || []).filter((e) => !e.is_archived && Number(e.job_total) > 0)
      const ids = [...new Set(list.map((e) => e.bills_to_customer_id).filter(Boolean))]
      const { data: cs } = ids.length ? await supabase.from('customers').select('id, display_name').in('id', ids) : { data: [] }
      const names = Object.fromEntries((cs || []).map((c) => [c.id, c.display_name]))
      if (live) setRows(list.map((e) => ({ ...e, customer_name: names[e.bills_to_customer_id] || '' })))
    })()
    return () => { live = false }
  }, [orgId, reload])

  const waiting = (rows || []).filter((e) => e.approval_status === 'Pending')
  // Approved, but no job made from it yet. (Duct estimates become the visit's own job, so they don't land here.)
  const approved = (rows || []).filter((e) => e.approval_status === 'Approved' && !e.spawned_job_id && !e.converted_to_job_id && !isDuct(e))

  async function followUp(e, channel) {
    setBusy(e.id + channel); setMsg(null)
    const r = await sendDoc(e.id, channel)
    setBusy(''); setMsg({ id: e.id, ...r })
    if (r.ok) setReload((n) => n + 1)
  }
  async function makeJob(e, markApproved) {
    setBusy(e.id + 'job'); setMsg(null)
    const by = `${profile?.full_name || 'Office'} (by phone)`
    let error
    if (isDuct(e)) {
      ({ error } = await supabase.rpc('convert_approved_estimate', { p_estimate_id: e.id, p_approved_by: by }))
    } else {
      if (markApproved) ({ error } = await supabase.from('invoices').update({ approval_status: 'Approved', approved_at: new Date().toISOString(), approved_by: by }).eq('id', e.id))
      if (!error) {
        ({ error } = e.estimate_type === 'system'
          ? await supabase.rpc('convert_system_estimate_to_job', { p_estimate_id: e.id })
          : await supabase.rpc('convert_estimate_to_service_call', { p_estimate_id: e.id, p_mode: (e.job_id || e.reference_job_id) ? 'segment' : 'job' }))
      }
    }
    setBusy('')
    if (error) { setMsg({ id: e.id, ok: false, t: error.message }); setReload((n) => n + 1); return }
    setMsg({ id: e.id, ok: true, t: isDuct(e) ? 'Approved — the invoice is ready on the job.' : 'Approved — the new job is waiting to be scheduled (Calendar → Needs a date).' })
    setOpen(null); setReload((n) => n + 1)
  }
  async function decline(e) {
    setBusy(e.id + 'no')
    await supabase.from('invoices').update({ approval_status: 'Declined' }).eq('id', e.id)
    setBusy(''); setOpen(null); setReload((n) => n + 1)
  }

  const list = tab === 'waiting' ? waiting : approved
  return (
    <FieldShell profile={profile} title="Estimates" onBack={() => navigate('/tech/field')}>
      <div className="fa-seg">
        <button type="button" className={tab === 'waiting' ? 'on' : ''} onClick={() => setTab('waiting')}>Waiting{rows ? ` (${waiting.length})` : ''}</button>
        <button type="button" className={tab === 'approved' ? 'on' : ''} onClick={() => setTab('approved')}>Needs a Job{rows ? ` (${approved.length})` : ''}</button>
        <button type="button" className={tab === 'agent' ? 'on' : ''} onClick={() => setTab('agent')}>Agent Inbox</button>
      </div>
      {tab === 'agent' ? (
        <div className="fa-panel fa-agent-wrap"><AgentInbox profile={profile} /></div>
      ) : (
        <div className="fa-panel">
          {!rows ? <p className="fa-empty">Loading…</p> : !list.length ? <p className="fa-empty">{tab === 'waiting' ? 'No estimates waiting on an answer.' : 'Every approved estimate has its job.'}</p> : list.map((e) => {
            const age = daysSince(e.sent_at || e.created_at)
            return (
              <div key={e.id} className="fa-info" role="button" tabIndex={0} style={{ cursor: 'pointer' }} onClick={() => setOpen(open === e.id ? null : e.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15.5 }}>{e.customer_name || 'Customer'}</div>
                    <div className="fa-muted" style={{ fontSize: 12.5 }}>#{e.invoice_number} · {e.estimate_type === 'system' ? 'System' : isDuct(e) ? 'Duct cleaning' : 'Repair'} · {e.sent_at ? `sent ${shortDay(e.sent_at)}${e.sent_count > 1 ? ` (${e.sent_count}×)` : ''}` : 'not sent yet'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 900 }}>{usd(e.job_total)}</div>
                    {tab === 'waiting' && <span className={`fa-chip ${age > 7 ? 'red' : ''}`} style={{ margin: 0 }}>{age === 0 ? 'today' : `${age}d`}</span>}
                  </div>
                </div>
                {open === e.id && (
                  <div onClick={(ev) => ev.stopPropagation()} style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {tab === 'waiting' && <>
                      <button type="button" className="fa-small-btn" disabled={!!busy} onClick={() => followUp(e, 'email')}>{busy === e.id + 'email' ? 'Sending…' : e.sent_at ? 'Email again' : 'Email it'}</button>
                      <button type="button" className="fa-small-btn" disabled={!!busy} onClick={() => followUp(e, 'sms')}>{busy === e.id + 'sms' ? 'Sending…' : e.sent_at ? 'Text again' : 'Text it'}</button>
                      <button type="button" className="fa-small-btn" style={{ background: '#1B7A3D', borderColor: '#1B7A3D' }} disabled={!!busy} onClick={() => makeJob(e, true)}>{busy === e.id + 'job' ? 'Saving…' : 'Customer said yes'}</button>
                      <button type="button" className="fa-small-btn" style={{ background: '#fff', color: 'var(--fa-red)', borderColor: 'var(--fa-red)' }} disabled={!!busy} onClick={() => decline(e)}>Said no</button>
                    </>}
                    {tab === 'approved' && <button type="button" className="fa-small-btn" disabled={!!busy} onClick={() => makeJob(e, false)}>{busy === e.id + 'job' ? 'Making…' : 'Turn into a job'}</button>}
                    {(e.job_id || e.reference_job_id) && <button type="button" className="fa-small-btn" style={{ background: '#fff', color: 'var(--fa-navy)' }} onClick={() => navigate(`/tech/field/job/${e.job_id || e.reference_job_id}`)}>Open the job</button>}
                  </div>
                )}
                {msg?.id === e.id && <div className={`fa-msg ${msg.ok ? 'ok' : 'err'}`} style={{ marginTop: 8 }}>{msg.t}</div>}
              </div>
            )
          })}
        </div>
      )}
    </FieldShell>
  )
}
