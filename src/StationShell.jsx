import { useState } from 'react'

// Reusable Station UI — the common shell every domain station shares.
// The DOMAIN computes its signals + admin cards and passes them in; the shell
// renders the two-zone office view, the audience toggle, and the admin tiers.
// signals: [{ key, name, n, line, cta, tone: 'amber'|'red', onClick }] — n>0 → Needs a hand, n===0 → Handled.

const ACCENT = { amber: { fg: '#9C6A12', bg: '#FAF2E0', line: '#EAD3A0' }, red: { fg: '#B5462F', bg: '#FBECE8', line: '#EAC5BC' } }
const GREEN = '#2E7D52', GREEN_BG = '#EAF3EC', GREEN_LINE = '#CADFCF', BRAND = '#176E7A', FAINT = '#98A2AD'

function Head({ title, hint }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.2, margin: 0 }}>{title}</h3>
      {hint && <p style={{ margin: '3px 0 0', fontSize: 12.5, color: FAINT, maxWidth: 640 }}>{hint}</p>}
    </div>
  )
}

export function StationKpi({ label, big, sub, tone, onClick }) {
  const top = tone === 'opp' ? BRAND : tone === 'alert' ? '#B5462F' : 'var(--border)'
  return (
    <div onClick={onClick} style={{ background: '#fff', border: '1px solid var(--border)', borderTop: `3px solid ${top}`, borderRadius: 12, padding: '15px 16px', cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ fontSize: 12.5, color: FAINT, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -1, margin: '6px 0 2px' }}>{big}</div>
      <div style={{ fontSize: 13, color: 'var(--mist)' }}>{sub}</div>
    </div>
  )
}

export default function StationShell({ eyebrow, officeTitle, adminTitle = 'Health', officeSubtitle, loading, signals = [], opsAdmin = false, ownerAdmin = false, opsCards = null, ownerCards = null, fanoutNote = null, headerRight = null, emptyHint, quincy = null }) {
  const hasAdmin = opsAdmin || ownerAdmin
  const [view, setView] = useState('office')
  const needs = signals.filter((s) => (s.n || 0) > 0)
  const handled = signals.filter((s) => s.n === 0)
  const card = { background: '#fff', border: '1px solid var(--border)', borderRadius: 12 }

  return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 0.3, color: BRAND }}>{eyebrow}</div>
          <h2 style={{ fontSize: 25, fontWeight: 800, letterSpacing: -0.5, margin: '4px 0 0' }}>{view === 'admin' ? adminTitle : officeTitle}</h2>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {headerRight}
          {hasAdmin && (
            <div>
              <div style={{ fontSize: 11.5, color: FAINT, marginBottom: 4, textAlign: 'right' }}>Viewing as</div>
              <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 9, overflow: 'hidden', background: '#fff' }}>
                {[['office', 'Office'], ['admin', 'Owner / Admin']].map(([v, l]) => (
                  <button key={v} onClick={() => setView(v)} style={{ border: 'none', cursor: 'pointer', padding: '8px 16px', fontSize: 13, fontWeight: view === v ? 700 : 500, background: view === v ? BRAND : 'transparent', color: view === v ? '#fff' : 'var(--mist)' }}>{l}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {(() => {
        const tone = view === 'admin' ? 'info' : loading ? 'muted' : needs.length > 0 ? 'amber' : 'green'
        const B = ({ amber: { bg: '#FAF2E0', line: '#EAD3A0', fg: '#9C6A12', icon: '!' }, green: { bg: '#EAF3EC', line: '#CADFCF', fg: '#2E7D52', icon: '✓' }, muted: { bg: 'var(--surface-2, #f6f7f9)', line: 'var(--border)', fg: '#98A2AD', icon: '·' }, info: { bg: '#EAF1F1', line: '#B9D3D3', fg: BRAND, icon: '✦' } })[tone]
        const text = view === 'admin' ? 'The same signals your team works — framed as the metrics you watch.' : (loading ? 'Checking what needs attention…' : officeSubtitle)
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginTop: 14, padding: '11px 15px', borderRadius: 12, background: B.bg, border: '1px solid ' + B.line }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <span style={{ width: 26, height: 26, flex: 'none', borderRadius: 999, background: '#fff', border: '1px solid ' + B.line, color: B.fg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>{B.icon}</span>
              <span style={{ fontSize: 14.5, fontWeight: 600, color: B.fg }}>{text}</span>
            </div>
            {quincy}
          </div>
        )
      })()}

      {view === 'admin' ? (
        <div style={{ marginTop: 26 }}>
          <Head title="What only you watch" hint="The health and the dollars behind the tasks." />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(232px, 1fr))', gap: 14 }}>
            {opsAdmin && opsCards}
            {ownerAdmin && ownerCards}
          </div>
          {opsAdmin && !ownerAdmin && <p style={{ fontSize: 12, color: FAINT, marginTop: 12 }}>You see operational health. Dollar figures are limited to owner-metrics access.</p>}
        </div>
      ) : (
        <>
          <div style={{ marginTop: 24 }}>
            <Head title="Needs a hand" hint="Work waiting. Each tile opens the task." />
            {!loading && needs.length === 0 ? (
              <div style={{ background: GREEN_BG, border: `1px solid ${GREEN_LINE}`, borderRadius: 12, padding: '20px', display: 'flex', gap: 13, alignItems: 'center' }}>
                <span style={{ width: 32, height: 32, borderRadius: 999, background: '#fff', border: `1px solid ${GREEN_LINE}`, color: GREEN, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{'\u2713'}</span>
                <div><div style={{ fontWeight: 700, fontSize: 15 }}>Nothing needs a hand right now.</div><div style={{ fontSize: 13.5, color: 'var(--mist)', marginTop: 2 }}>{emptyHint || 'Everything is watched and clear.'}</div></div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(258px, 1fr))', gap: 14 }}>
                {needs.map((t) => {
                  const a = ACCENT[t.tone] || ACCENT.amber
                  return (
                    <div key={t.key} onClick={t.onClick} style={{ ...card, borderLeft: `3px solid ${a.fg}`, padding: '15px 16px 13px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 124 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 15, fontWeight: 700 }}>{t.name}</span>
                        <span style={{ minWidth: 30, height: 30, padding: '0 9px', borderRadius: 999, background: a.bg, color: a.fg, border: `1px solid ${a.line}`, fontWeight: 800, fontSize: 15, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{t.n}</span>
                      </div>
                      <div style={{ fontSize: 14, color: 'var(--mist)', lineHeight: 1.4, flex: 1 }}>{t.line}</div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: BRAND }}>{t.cta}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          {handled.length > 0 && (
            <div style={{ marginTop: 26 }}>
              <Head title="Handled" hint="Watching, nothing pending." />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
                {handled.map((t) => (
                  <span key={t.key} onClick={t.onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, ...card, borderRadius: 999, padding: '7px 13px', fontSize: 13.5, cursor: t.onClick ? 'pointer' : 'default' }}>
                    <span style={{ width: 7, height: 7, borderRadius: 999, background: GREEN }} />{t.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {hasAdmin && fanoutNote && (
        <div style={{ marginTop: 30, paddingTop: 14, borderTop: '1px dashed var(--border)', fontSize: 12.5, color: FAINT }}>{fanoutNote}</div>
      )}
    </div>
  )
}
