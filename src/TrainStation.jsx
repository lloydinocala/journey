import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'

// The Train Station — a landing/triage screen. Every tile is a door; no work is
// done here. Alert-capable ("teeth") areas each run a real "what's wrong" count.
// value>0 → "Needs a hand"; value===0 → "Handled". Tiles travel between the two
// on their own as the underlying work changes elsewhere. Per-org Alerts/Off in Edit.

const ACCENT = {
  amber: { fg: '#9C6A12', bg: '#FAF2E0', line: '#EAD3A0' },
  red: { fg: '#B5462F', bg: '#FBECE8', line: '#EAC5BC' },
}
const GREEN = '#2E7D52', GREEN_BG = '#EAF3EC', GREEN_LINE = '#CADFCF', BRAND = '#176E7A', FAINT = '#98A2AD'

// Each tile owns its own count query. Add tiles here as their data firms up.
const REGISTRY = [
  { key: 'ar', name: 'Accounts Receivable', href: '/financials', tone: 'red',
    line: (n) => `${n} invoice${n === 1 ? '' : 's'} with a balance owing`,
    q: (org) => supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('org_id', org).eq('kind', 'invoice').gt('balance', 0).is('deleted_at', null) },
  { key: 'service_requests', name: 'Service Requests', href: '/service-requests', tone: 'amber',
    line: (n) => `${n} new request${n === 1 ? '' : 's'} to review`,
    q: (org) => supabase.from('service_requests').select('*', { count: 'exact', head: true }).eq('org_id', org).eq('status', 'pending') },
  { key: 'estimates', name: 'Estimates to convert', href: '/estimates', tone: 'amber',
    line: (n) => `${n} approved, not yet turned into a job`,
    q: (org) => supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('org_id', org).eq('kind', 'estimate').ilike('approval_status', 'approved').is('spawned_job_id', null).is('converted_to_job_id', null).is('deleted_at', null).eq('is_archived', false) },
  { key: 'estimates_sent', name: 'Estimates out', href: '/estimates', tone: 'amber',
    line: (n) => `${n} sent, awaiting a customer decision`,
    q: (org) => supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('org_id', org).eq('kind', 'estimate').not('sent_at', 'is', null).is('deleted_at', null).eq('is_archived', false).or('approval_status.eq.Pending,approval_status.is.null') },
  { key: 'jobs', name: 'Jobs to schedule', href: '/calendar', tone: 'amber',
    line: (n) => `${n} approved job${n === 1 ? '' : 's'} not on the calendar`,
    q: (org) => supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('org_id', org).eq('status', 'unscheduled') },
  { key: 'permits', name: 'Permitting', href: '/permits', tone: 'amber',
    line: (n) => `${n} permit package${n === 1 ? '' : 's'} in progress`,
    q: (org) => supabase.from('permit_packages').select('*', { count: 'exact', head: true }).eq('org_id', org).eq('status', 'in_progress') },
  { key: 'maintenance', name: 'Maintenance', href: '/maintenance-dashboard', tone: 'amber',
    line: (n) => `${n} PM visit${n === 1 ? '' : 's'} due`,
    q: (org) => supabase.from('maintenance_visits').select('*', { count: 'exact', head: true }).eq('org_id', org).eq('status', 'due') },
  { key: 'inventory', name: 'Inventory', href: '/elements/purchasing', tone: 'amber',
    line: (n) => `${n} purchase order${n === 1 ? '' : 's'} awaiting receipt`,
    q: (org) => supabase.from('elements_purchase_orders').select('*', { count: 'exact', head: true }).eq('org_id', org).eq('status', 'ordered').is('received_at', null) },
  { key: 'marketing', name: 'Marketing', href: '/marketing/queue', tone: 'amber',
    line: (n) => `${n} item${n === 1 ? '' : 's'} waiting for your approval`,
    q: (org) => supabase.from('marketing_content_items').select('*', { count: 'exact', head: true }).eq('org_id', org).eq('status', 'pending_review') },
  { key: 'todos', name: 'To-Dos', href: '/to-do', tone: 'amber',
    line: (n) => `${n} open on the office list`,
    q: (org) => supabase.from('office_reminders').select('*', { count: 'exact', head: true }).eq('org_id', org).eq('done', false) },
]

export default function TrainStation({ profile }) {
  const nav = useNavigate()
  const org = profile.org_id
  const [modes, setModes] = useState({})
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState(false)
  const firstName = (profile.full_name || '').trim().split(' ')[0] || 'there'

  useEffect(() => { load() }, [org])

  async function load() {
    setLoading(true)
    const { data: cfg } = await supabase.from('train_station_tiles').select('area_key, mode').eq('org_id', org)
    const m = {}; REGISTRY.forEach((t) => { m[t.key] = 'alerts' }); (cfg || []).forEach((r) => { m[r.area_key] = r.mode })
    setModes(m)
    const enabled = REGISTRY.filter((t) => m[t.key] !== 'off')
    const results = await Promise.all(enabled.map(async (t) => {
      try { const { count, error } = await t.q(org); return [t.key, error ? null : (count || 0)] } catch { return [t.key, null] }
    }))
    setCounts(Object.fromEntries(results))
    setLoading(false)
  }

  async function setMode(key, mode) {
    setModes((x) => ({ ...x, [key]: mode }))
    await supabase.from('train_station_tiles').upsert({ org_id: org, area_key: key, mode, updated_at: new Date().toISOString() }, { onConflict: 'org_id,area_key' })
    if (mode === 'alerts' && counts[key] === undefined) {
      const t = REGISTRY.find((r) => r.key === key)
      try { const { count, error } = await t.q(org); setCounts((x) => ({ ...x, [key]: error ? null : (count || 0) })) } catch { setCounts((x) => ({ ...x, [key]: null })) }
    }
  }

  const enabled = REGISTRY.filter((t) => modes[t.key] !== 'off')
  const needs = enabled.filter((t) => (counts[t.key] || 0) > 0)
  const handled = enabled.filter((t) => counts[t.key] === 0)
  const offTiles = REGISTRY.filter((t) => modes[t.key] === 'off')
  const totalPending = needs.reduce((n, t) => n + (counts[t.key] || 0), 0)

  const card = { background: '#fff', border: '1px solid var(--border)', borderRadius: 12 }

  return (
    <div style={{ padding: '22px 24px 70px', maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 0.3, color: BRAND }}>The Train Station</div>
          <h2 style={{ fontSize: 25, fontWeight: 800, letterSpacing: -0.5, margin: '4px 0 0' }}>Hi {firstName}.</h2>
          <p style={{ margin: '7px 0 0', fontSize: 15, color: 'var(--mist)', maxWidth: 600 }}>
            {loading ? 'Checking what needs attention…'
              : totalPending > 0
                ? <>There {totalPending === 1 ? 'is' : 'are'} <b style={{ color: 'inherit' }}>{totalPending}</b> {totalPending === 1 ? 'thing' : 'things'} across {needs.length} area{needs.length === 1 ? '' : 's'} that could use a hand.</>
                : <>You're all caught up — nothing's waiting on you.</>}
          </p>
        </div>
        <button className="logout-button" style={{ fontSize: 13, padding: '7px 14px', border: `1px solid ${edit ? BRAND : 'var(--border)'}`, background: edit ? BRAND : '#fff', color: edit ? '#fff' : 'inherit', fontWeight: 600 }} onClick={() => setEdit((e) => !e)}>{edit ? 'Done' : 'Edit'}</button>
      </div>

      {edit && (
        <div style={{ marginTop: 14, background: '#EAF1F1', border: `1px solid ${BRAND}22`, borderRadius: 10, padding: '11px 14px', fontSize: 13.5 }}>
          Set each area to <b>Alerts</b> (watch it and show its work here) or <b>Off</b> (someone else owns it — reach it from the menu). Set per company.
        </div>
      )}

      {/* NEEDS A HAND */}
      <div style={{ marginTop: 26 }}>
        <SectionHead title="Needs a hand" hint="Work piling up on a clock. Each tile is a door into the screen that clears it." />
        {!loading && needs.length === 0 ? (
          <div style={{ background: GREEN_BG, border: `1px solid ${GREEN_LINE}`, borderRadius: 12, padding: '20px', display: 'flex', gap: 13, alignItems: 'center' }}>
            <span style={{ width: 32, height: 32, borderRadius: 999, background: '#fff', border: `1px solid ${GREEN_LINE}`, color: GREEN, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>✓</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink, #1C2430)' }}>Nothing needs a hand right now.</div>
              <div style={{ fontSize: 13.5, color: 'var(--mist)', marginTop: 2 }}>Every area below is being watched and is clear. A tile appears here the moment something comes up.</div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(258px, 1fr))', gap: 14 }}>
            {needs.map((t) => {
              const a = ACCENT[t.tone] || ACCENT.amber; const n = counts[t.key] || 0
              return (
                <div key={t.key} onClick={() => nav(t.href)} style={{ ...card, borderLeft: `3px solid ${a.fg}`, padding: '15px 16px 13px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 124 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 15.5, fontWeight: 700 }}>{t.name}</span>
                    <span style={{ minWidth: 30, height: 30, padding: '0 9px', borderRadius: 999, background: a.bg, color: a.fg, border: `1px solid ${a.line}`, fontWeight: 800, fontSize: 15, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--mist)', lineHeight: 1.4, flex: 1 }}>{t.line(n)}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: BRAND }}>Open {t.name.split(' ')[0]}</div>
                  {edit && <div onClick={(e) => e.stopPropagation()}><ModeSwitch value={modes[t.key]} onChange={(mm) => setMode(t.key, mm)} /></div>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* HANDLED */}
      {(handled.length > 0 || edit) && (
        <div style={{ marginTop: 28 }}>
          <SectionHead title="Handled" hint="These areas watch for work too — nothing's pending, so they rest here. A tile jumps up the instant it has something." />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
            {handled.map((t) => (
              <div key={t.key} onClick={() => nav(t.href)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, ...card, borderRadius: 999, padding: '7px 13px', fontSize: 13.5, cursor: 'pointer' }}>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: GREEN }} />
                {t.name}
                {edit && <span onClick={(e) => e.stopPropagation()} style={{ marginLeft: 4 }}><ModeSwitch small value={modes[t.key]} onChange={(mm) => setMode(t.key, mm)} /></span>}
              </div>
            ))}
            {handled.length === 0 && <span style={{ fontSize: 13, color: FAINT }}>Nothing resting here right now.</span>}
          </div>
        </div>
      )}

      {/* OFF — edit only */}
      {edit && offTiles.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <SectionHead title="Off" hint="Not on this company's Station. Flip to Alerts to start watching it here." />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
            {offTiles.map((t) => (
              <div key={t.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, border: '1px dashed var(--border)', borderRadius: 10, padding: '8px 12px', fontSize: 13.5, color: FAINT }}>
                {t.name}
                <ModeSwitch small value={modes[t.key]} onChange={(mm) => setMode(t.key, mm)} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SectionHead({ title, hint }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.2, margin: 0 }}>{title}</h3>
      {hint && <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#98A2AD', maxWidth: 640 }}>{hint}</p>}
    </div>
  )
}

function ModeSwitch({ value, onChange, small }) {
  const opts = [['alerts', 'Alerts'], ['off', 'Off']]
  return (
    <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginTop: small ? 0 : 4 }}>
      {opts.map(([o, label]) => (
        <button key={o} onClick={() => onChange(o)} style={{ border: 'none', cursor: 'pointer', padding: small ? '3px 9px' : '5px 12px', fontSize: small ? 11 : 12, fontWeight: value === o ? 700 : 500, background: value === o ? '#176E7A' : 'transparent', color: value === o ? '#fff' : 'var(--mist)' }}>{label}</button>
      ))}
    </div>
  )
}
