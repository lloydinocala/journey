import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import { IconChevronLeft } from './MobileIcons'

function fmtTime(t) {
  const d = new Date(t)
  if (isNaN(d)) return ''
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  return sameDay
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// A dedicated, per-job text inbox. The thread lives only while the job is open;
// on Stop My Time it archives to the office and clears here (archived_at set), so
// the tech no longer has access to it. Never exposed to any customer-facing link.
export default function TechMessages({ profile }) {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const [job, setJob] = useState(null)
  const [texts, setTexts] = useState([])
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [uid, setUid] = useState(null)
  const endRef = useRef(null)

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUid(data?.user?.id || null)) }, [])

  useEffect(() => {
    loadJob(); loadTexts()
    const t = setInterval(loadTexts, 10000) // pick up inbound replies (once A2P is live)
    return () => clearInterval(t)
  }, [jobId])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [texts.length])

  async function loadJob() {
    const { data } = await supabase
      .from('jobs')
      .select('id, org_id, job_number, segment, status, customers ( display_name, primary_phone )')
      .eq('id', jobId)
      .single()
    setJob(data); setLoading(false)
  }
  async function loadTexts() {
    const { data } = await supabase
      .from('job_texts')
      .select('id, body, direction, created_at, to_phone')
      .eq('job_id', jobId)
      .is('archived_at', null)
      .order('created_at', { ascending: true })
    setTexts(data || [])
  }

  const closed = job && (job.status === 'completed' || job.status === 'incomplete')
  const custName = job?.customers?.display_name || 'Customer'
  const custPhone = job?.customers?.primary_phone || null

  async function send() {
    if (!body.trim() || !job || closed) return
    setSending(true)
    const payload = { org_id: job.org_id, job_id: jobId, to_phone: custPhone, body: body.trim(), direction: 'outbound', created_by: uid }
    const { error } = await supabase.from('job_texts').insert(payload)
    if (!error) { setBody(''); await loadTexts() }
    setSending(false)
  }

  return (
    <div className="mobile-shell job-card-v2 msg-shell">
      <div className="jc-header msg-header">
        <button className="jc-back" onClick={() => navigate(`/tech/${jobId}`)}><IconChevronLeft /></button>
        <div className="jc-header-text">
          <div className="jc-title">{custName}</div>
          <div className="jc-sub">Job {job?.job_number}{job?.segment > 1 ? `-${job.segment}` : ''} · Messages</div>
        </div>
      </div>

      <div className="msg-thread">
        <div className="msg-privacy">🔒 Private to your team — archives to the office when the job ends. The customer never sees this thread.</div>
        {loading ? (
          <p className="jc-muted-note" style={{ textAlign: 'center', marginTop: 20 }}>Loading…</p>
        ) : texts.length === 0 ? (
          <div className="msg-empty">
            {closed
              ? 'This job is closed — its messages have been archived to the office.'
              : 'No messages yet. Send one below to start the conversation.'}
          </div>
        ) : (
          texts.map((m) => (
            <div key={m.id} className={`msg-row ${m.direction === 'inbound' ? 'in' : 'out'}`}>
              <div className="msg-bubble">{m.body}</div>
              <div className="msg-time">{fmtTime(m.created_at)}</div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {closed ? (
        <div className="msg-closed">Job closed — messaging is disabled and the thread is archived to the office.</div>
      ) : (
        <div className="msg-compose">
          <textarea
            className="msg-input"
            rows={1}
            value={body}
            placeholder={custPhone ? `Message ${custName}…` : 'Message…'}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          />
          <button className="msg-send" disabled={sending || !body.trim()} onClick={send}>{sending ? '…' : 'Send'}</button>
        </div>
      )}
    </div>
  )
}
