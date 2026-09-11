import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import { useSignals } from './signals/useSignals'

// The Train Station — the top hub. Every tile now comes from the shared signal
// registry (useSignals({ hub: 'start' })), so it rolls up exactly the domains under
// it: Dispatch, Jobs, Maintenance, Permitting, 608. Inventory and Marketing live
// under their own hubs now and no longer appear here. Per-org Alerts/Off (Edit)
// still applies, keyed on each signal.

const ACCENT = {
  amber: { fg: '#9C6A12', bg: '#FAF2E0', line: '#EAD3A0' },
  red: { fg: '#B5462F', bg: '#FBECE8', line: '#EAC5BC' },
}
const GREEN = '#2E7D52', GREEN_BG = '#EAF3EC', GREEN_LINE = '#CADFCF', BRAND = '#176E7A', FAINT = '#98A2AD'

export default function TrainStation({ profile }) {
  const nav = useNavigate()
  const org = profile.org_id
  const [modes, setModes] = useState({})
  const [edit, setEdit] = useState(false)
  const firstName = (profile.full_name || '').trim().split(' ')[0] || 'there'

  const { defs, counts, loading } = useSignals({ hub: 'start' }, org, nav)

  useEffect(() => {
    if (!org) return
    supabase.from('train_station_tiles').select('area_key, mode').eq('org_id', org).then(({ data }) => {
      const m = {}; (data || []).forEach((r) => { m[r.area_key] = r.mode }); setModes(m)
    })
  }, [org])

  async function setMode(key, mode) {
    setModes((x) => ({ ...x, [key]: mode }))
    await supabase.from('train_station_tiles').upsert({ org_id: org, area_key: key, mode, updated_at: new Date().toISOString() }, { onConflict: 'org_id,area_key' })
  }

  const enabled = defs.filter((t) => modes[t.key] !== 'off')
  const needs = enabled.filter((t) => (counts[t.key] || 0) > 0)
  const handled = enabled.filter((t) => counts[t.key] === 0)
  const offTiles = defs.filter((t) => modes[t.key] === 'off')
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
