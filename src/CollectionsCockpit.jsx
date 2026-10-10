// Collections cockpit — the live view of the automated dunning engine ("Quincy collections").
// Lists unpaid, sent invoices with age, status, reminders sent, and next reminder date,
// and flags customers frozen at 90-day uncollectable. Read-only; the collections-run engine
// does the sending on the subscriber's cadence and stops the instant an invoice is paid.
import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'

const money = (n) => (n == null || isNaN(n) ? '$0' : `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`)
const daysSince = (d) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null)
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '—')

const STATUS_LABEL = { active: 'Reminding', paused: 'Paused', uncollectable: 'Uncollectable', paid: 'Paid', 'not started': 'Queued' }
const statusTone = (s) =>
  s === 'uncollectable' ? { bg: '#FBE7E7', c: '#B00020' }
    : s === 'paid' ? { bg: '#E3F1E8', c: '#166534' }
      : s === 'not started' ? { bg: '#EEF2F6', c: '#64748B' }
        : { bg: '#E3ECF7', c: '#1B3A6B' }
const ageTone = (d) =>
  d == null ? { bg: '#EEF2F6', c: '#64748B' }
    : d > 90 ? { bg: '#FBE7E7', c: '#B00020' }
      : d > 60 ? { bg: '#F8EEDD', c: '#B0600A' }
        : d > 30 ? { bg: '#FEF3C7', c: '#92560A' }
          : { bg: '#E3F1E8', c: '#166534' }

export default function CollectionsCockpit({ orgId, profile }) {
  const [rows, setRows] = useState(null)
  const [settings, setSettings] = useState(null)
  const canOverride = !!profile && (profile.role === 'super_admin' || profile.role === 'org_admin')

  useEffect(() => { if (orgId) load() }, [orgId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setRows(null)
    const [{ data: setg }, { data: invs }] = await Promise.all([
      supabase.from('collections_settings').select('*').eq('org_id', orgId).maybeSingle(),
      supabase.from('invoices').select('id, invoice_number, sent_at, paid_at, balance, bills_to_customer_id')
        .eq('org_id', orgId).eq('kind', 'invoice').not('sent_at', 'is', null).is('paid_at', null).gt('balance', 0.5),
    ])
    setSettings(setg || null)
    const list = invs || []
    const custIds = [...new Set(list.map((i) => i.bills_to_customer_id).filter(Boolean))]
    const invIds = list.map((i) => i.id)
    const [{ data: custs }, { data: trackers }, { data: rems }, { data: freezes }] = await Promise.all([
      custIds.length ? supabase.from('customers').select('id, display_name').in('id', custIds) : Promise.resolve({ data: [] }),
      invIds.length ? supabase.from('collections_tracker').select('*').in('invoice_id', invIds) : Promise.resolve({ data: [] }),
      invIds.length ? supabase.from('collections_reminders').select('invoice_id, sent_at, channel').in('invoice_id', invIds).order('sent_at', { ascending: false }) : Promise.resolve({ data: [] }),
      supabase.from('collections_freezes').select('customer_id, frozen').eq('org_id', orgId).eq('frozen', true),
    ])
    const custMap = Object.fromEntries((custs || []).map((c) => [c.id, c.display_name]))
    const trMap = Object.fromEntries((trackers || []).map((t) => [t.invoice_id, t]))
    const lastRem = {}
    for (const rm of rems || []) if (!lastRem[rm.invoice_id]) lastRem[rm.invoice_id] = rm
    const frz = Object.fromEntries((freezes || []).map((f) => [f.customer_id, true]))
    const r = list.map((i) => {
      const tr = trMap[i.id]
      return {
        id: i.id, custId: i.bills_to_customer_id, number: i.invoice_number,
        customer: custMap[i.bills_to_customer_id] || 'Unknown',
        balance: Number(i.balance || 0), sentAt: i.sent_at, days: daysSince(i.sent_at),
        status: tr?.status || 'not started', remindersSent: tr?.reminders_sent || 0,
        nextAt: tr?.next_reminder_at, lastRemAt: lastRem[i.id]?.sent_at || null,
        frozen: !!frz[i.bills_to_customer_id],
      }
    }).sort((a, b) => (b.days || 0) - (a.days || 0))
    setRows(r)
  }

  async function unfreeze(custId) {
    if (!custId) return
    if (!window.confirm('Override the freeze and allow new jobs for this customer again? The unpaid balance will remain.')) return
    await supabase.from('collections_freezes').update({ frozen: false, override_by: profile?.id || null, override_at: new Date().toISOString(), reason: 'manager override' }).eq('customer_id', custId).eq('org_id', orgId)
    load()
  }

  const totals = useMemo(() => {
    const t = { total: 0, over60: 0, frozen: 0 }
    for (const r of rows || []) { t.total += r.balance; if ((r.days || 0) > 60) t.over60 += r.balance; if (r.frozen) t.frozen++ }
    return t
  }, [rows])

  if (rows === null) return <p style={{ color: 'var(--mist)' }}>Loading collections…</p>
  if (rows.length === 0) return <div style={{ border: '1px solid #E2E8F0', background: '#FBFCFE', borderRadius: 10, padding: 16, color: 'var(--mist)' }}>No unpaid invoices — nothing to collect right now.</div>

  const on = settings?.enabled
  return (
    <div style={{ border: '1px solid #E2E8F0', background: '#FBFCFE', borderRadius: 10, padding: 12, margin: '4px 0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        <strong style={{ color: '#132A4C', fontSize: 13.5 }}>Unpaid invoices</strong>
        <span style={{ fontSize: 11.5, padding: '2px 9px', borderRadius: 999, fontWeight: 700, background: on ? '#E3F1E8' : '#EEF2F6', color: on ? '#166534' : '#64748B' }}>
          {on
            ? `Quincy auto-reminders: ON · ${settings.first_reminder_days}d, ${settings.second_reminder_days}d, then every ${settings.recurring_reminder_days}d · flag at ${settings.uncollectable_days}d`
            : 'Quincy auto-reminders: OFF'}
        </span>
        <span style={{ fontSize: 12.5, color: 'var(--mist)', marginLeft: 'auto' }}>
          {money(totals.total)} open · <span style={{ color: totals.over60 ? '#B00020' : 'var(--mist)', fontWeight: 600 }}>{money(totals.over60)} over 60 days</span>{totals.frozen ? ` · ${totals.frozen} frozen` : ''}
        </span>
      </div>

      <div style={{ maxHeight: 'calc(100vh - 430px)', overflowY: 'auto', overscrollBehavior: 'contain' }}>
        <table className="data-table" style={{ fontSize: 12.5, borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
          <thead>
            <tr>
              {[['Invoice', 'left'], ['Customer', 'left'], ['Balance', 'right'], ['Sent', 'left'], ['Overdue', 'right'], ['Status', 'left'], ['Reminders', 'right'], ['Next reminder', 'left']].map(([h, a]) => (
                <th key={h} style={{ position: 'sticky', top: 0, zIndex: 1, background: '#1B3A6B', textAlign: a }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const st = statusTone(r.status); const at = ageTone(r.days)
              return (
                <tr key={r.id}>
                  <td><Link to={'/view-invoice/' + r.id} target="_blank" rel="noreferrer" style={{ color: '#2E7FC4', textDecoration: 'underline' }}>{r.number || '—'}</Link></td>
                  <td style={{ fontWeight: 600 }}>
                    {r.custId ? <Link to={'/customers/' + r.custId} style={{ color: '#2E7FC4', textDecoration: 'underline' }}>{r.customer}</Link> : r.customer}
                    {r.frozen && <span title="New jobs frozen — account uncollectable" style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, color: '#B00020', background: '#FBE7E7', borderRadius: 4, padding: '1px 5px' }}>FROZEN</span>}
                    {r.frozen && canOverride && <button onClick={() => unfreeze(r.custId)} style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#1B3A6B', background: 'none', border: '1px solid #C3D2E8', borderRadius: 4, padding: '1px 6px', cursor: 'pointer' }}>Override</button>}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{money(r.balance)}</td>
                  <td style={{ color: 'var(--mist)' }}>{fmtDate(r.sentAt)}</td>
                  <td style={{ textAlign: 'right' }}><span style={{ fontWeight: 700, color: at.c, background: at.bg, borderRadius: 999, padding: '2px 8px' }}>{r.days == null ? '—' : r.days + 'd'}</span></td>
                  <td><span style={{ fontWeight: 700, color: st.c, background: st.bg, borderRadius: 999, padding: '2px 8px' }}>{STATUS_LABEL[r.status] || r.status}</span></td>
                  <td style={{ textAlign: 'right' }}>{r.remindersSent || '—'}</td>
                  <td style={{ color: 'var(--mist)' }}>{r.status === 'uncollectable' ? 'stopped' : r.status === 'paid' ? '—' : fmtDate(r.nextAt)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p style={{ color: 'var(--mist)', fontSize: 11.5, margin: '8px 2px 0' }}>
        Quincy sends friendly, escalating reminders (email + text) on your schedule and stops the moment an invoice is paid. At {settings?.uncollectable_days || 90} days an account is flagged uncollectable and its new jobs are frozen until the balance is paid or a manager overrides it.
      </p>
    </div>
  )
}
