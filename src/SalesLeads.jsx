import { Fragment, useEffect, useState } from 'react'
import { supabase } from './utils/supabase'

// Journey's own sales leads (super admin only) — mostly contractors who called Clara.
// "Follow-up OK" = said yes on the call (a personal phone call is fine).
// Texting them for marketing needs their written YES (reply to the confirmation text).
const fmtPhone = (s) => { const d = String(s || '').replace(/\D/g, '').slice(-10); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : '' }
const fmtWhen = (ts) => ts ? new Date(ts).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) : ''
const STATUSES = ['new', 'contacted', 'won', 'lost']

export default function SalesLeads({ profile }) {
  const [rows, setRows] = useState(null)
  const [filter, setFilter] = useState('followup')
  const [open, setOpen] = useState(null)

  const load = async () => {
    const { data } = await supabase.from('sales_leads').select('*').order('created_at', { ascending: false }).limit(500)
    setRows(data || [])
  }
  useEffect(() => { load() }, [])
  if (profile?.role !== 'super_admin') return <div className="page-container">Journey platform account only.</div>

  const list = (rows || []).filter((r) =>
    filter === 'all' ? true : filter === 'followup' ? r.wants_followup : filter === 'callbacks' ? !!r.callback_at : r.wants_followup === false)
    .sort((a, b) => filter === 'callbacks' ? new Date(a.callback_at) - new Date(b.callback_at) : 0)

  const setStatus = async (r, status) => {
    await supabase.from('sales_leads').update({ status, updated_at: new Date().toISOString() }).eq('id', r.id)
    load()
  }

  return (
    <div className="page-container" style={{ maxWidth: 1200 }}>
      <h1 style={{ marginBottom: 4 }}>Sales Leads</h1>
      <p style={{ color: '#64748B', marginTop: 0 }}>Contractors who called Clara. A yes on the call covers a personal phone call; texting them needs their written YES (shown as ✓ Text OK).</p>
      <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
        {[['followup', 'Follow-up OK'], ['callbacks', 'Callbacks booked'], ['declined', 'Said no'], ['all', 'All']].map(([k, l]) => (
          <button key={k} className={filter === k ? 'btn btn-primary' : 'btn'} onClick={() => setFilter(k)}>{l}</button>
        ))}
        <span style={{ marginLeft: 'auto', alignSelf: 'center', color: '#64748B' }}>{rows ? `${list.length} shown` : 'Loading…'}</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="ledger-table" style={{ width: '100%' }}>
          <thead><tr><th>Called</th><th>Name</th><th>Company</th><th>Phone</th><th>Email</th><th>Callback</th><th>Consent</th><th>Lang</th><th>Status</th></tr></thead>
          <tbody>
            {list.map((r) => (
              <Fragment key={r.id}>
                <tr onClick={() => setOpen(open === r.id ? null : r.id)} style={{ cursor: 'pointer' }}>
                  <td>{fmtWhen(r.created_at)}</td>
                  <td><b>{r.contact_name || '—'}</b></td>
                  <td>{r.company_name || ''}</td>
                  <td>{r.phone ? <a href={`tel:${r.phone}`} onClick={(e) => e.stopPropagation()}>{fmtPhone(r.phone)}</a> : ''}</td>
                  <td>{r.email || ''}</td>
                  <td>{fmtWhen(r.callback_at)}</td>
                  <td style={{ fontSize: 12.5 }}>
                    {r.wants_followup === true ? 'Call OK' : r.wants_followup === false ? 'Declined' : '—'}
                    {r.sms_optin_at ? ' · ✓ Text OK' : ''}{r.email_optin_at ? ' · ✓ Email OK' : ''}
                  </td>
                  <td>{r.language === 'Spanish' ? 'ES' : r.language ? 'EN' : ''}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <select value={r.status} onChange={(e) => setStatus(r, e.target.value)}>
                      {STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
                    </select>
                  </td>
                </tr>
                {open === r.id && (
                  <tr><td colSpan={9} style={{ background: '#F8FAFC', whiteSpace: 'pre-wrap', fontSize: 13.5 }}>
                    {r.notes || 'No call summary yet (it arrives a minute after the call ends).'}
                    {(r.text_sent_at || r.email_sent_at) && `\n\nConfirmation sent: ${[r.text_sent_at && 'text', r.email_sent_at && 'email'].filter(Boolean).join(' + ')}`}
                  </td></tr>
                )}
              </Fragment>
            ))}
            {rows && !list.length && <tr><td colSpan={9} style={{ color: '#64748B' }}>Nothing here yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
