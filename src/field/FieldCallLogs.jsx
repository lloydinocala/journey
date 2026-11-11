import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FieldShell from './FieldShell'
import { supabase } from '../utils/supabase'

// Call Logs — today's and yesterday's calls (each night anything older drops off unless it's
// flagged for a call-back or follow-up). Flag, complete, or call back right from the phone.
const TYPE = { customer: 'Customer', vendor: 'Vendor', employee: 'Employee', known_other: 'Contact', unknown: 'Unknown' }
const fmtPhone = (p) => { const d = String(p || '').replace(/\D/g, '').slice(-10); return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : (p || '') }

export default function FieldCallLogs({ profile }) {
  const navigate = useNavigate()
  const [rows, setRows] = useState(null)
  async function load() {
    const { data } = await supabase.from('call_logs')
      .select('id, called_at, caller_name, phone, purpose, caller_type, needs_callback, follow_up, completed_at, taken_by_name, route_to')
      .eq('org_id', profile.org_id).is('deleted_at', null).order('called_at', { ascending: false }).limit(200)
    setRows(data || [])
  }
  useEffect(() => { if (profile?.org_id) load() }, [profile?.org_id]) // eslint-disable-line react-hooks/exhaustive-deps
  async function patch(r, p) {
    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, ...p } : x)))
    await supabase.from('call_logs').update(p).eq('id', r.id)
  }
  return (
    <FieldShell profile={profile} title="Call Logs" onBack={() => navigate(-1)}>
      <div className="fa-panel">
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Today&apos;s Call Logs</div>
          <div className="fa-muted" style={{ fontWeight: 600 }}>Clears overnight after the second day</div>
        </div>
        {!rows ? <p className="fa-empty">Loading…</p> : rows.length === 0 ? <p className="fa-empty">No calls logged.</p> : rows.map((r) => {
          const when = new Date(r.called_at)
          return (
            <div key={r.id} className="fa-info" style={{ opacity: r.completed_at ? 0.6 : 1 }}>
              <div className="fa-muted" style={{ fontWeight: 700 }}>{when.toLocaleDateString('en-US')} · {when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
              <div style={{ fontWeight: 800, fontSize: 16, marginTop: 2 }}>{r.caller_name || 'Unknown caller'} <span className="fa-muted" style={{ fontWeight: 600 }}>— {TYPE[r.caller_type] || 'Caller'}</span></div>
              {r.phone && <div className="fa-info-line">{fmtPhone(r.phone)}</div>}
              {r.purpose && <div className="fa-info-line" style={{ fontWeight: 600 }}>{r.purpose}</div>}
              {(r.taken_by_name || r.route_to) && <div className="fa-muted" style={{ fontSize: 12.5 }}>{r.taken_by_name ? `Taken by ${r.taken_by_name}` : ''}{r.route_to ? ` · for ${r.route_to}` : ''}</div>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {r.needs_callback && !r.completed_at && <span className="fa-chip red">Requests Call Back</span>}
                {r.follow_up && !r.completed_at && <span className="fa-chip">Follow-up</span>}
                {r.completed_at && <span className="fa-chip green">Done</span>}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {r.phone && <a className="fa-small-btn" style={{ textDecoration: 'none', fontSize: 14, padding: '7px 14px' }} href={`tel:${String(r.phone).replace(/[^\d+]/g, '')}`}>Call Back</a>}
                {!r.completed_at && <button type="button" className="fa-small-btn" style={{ background: '#fff', color: 'var(--fa-navy)', fontSize: 14, padding: '7px 14px' }} onClick={() => patch(r, { needs_callback: !r.needs_callback })}>{r.needs_callback ? 'Clear call-back' : 'Flag call-back'}</button>}
                <button type="button" className="fa-small-btn" style={{ background: '#fff', color: 'var(--fa-navy)', fontSize: 14, padding: '7px 14px' }} onClick={() => patch(r, r.completed_at ? { completed_at: null } : { completed_at: new Date().toISOString(), needs_callback: false, follow_up: false })}>{r.completed_at ? 'Reopen' : 'Mark done'}</button>
              </div>
            </div>
          )
        })}
      </div>
    </FieldShell>
  )
}
