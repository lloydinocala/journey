import { useRef } from 'react'

// Training Manual — the operator manual served in-app. Everyone can read it (view-only,
// in an iframe); only a super-admin sees Print and Download PDF. The manual itself is a
// static file in public/ (training-manual.html + Journey-Training-Manual.pdf), so updating
// it is a one-file swap and the content never becomes stale JSX.
export default function Training({ profile }) {
  const isSuper = profile?.role === 'super_admin'
  const frameRef = useRef(null)

  function printManual() {
    try {
      const w = frameRef.current?.contentWindow
      if (w) { w.focus(); w.print() }
    } catch { /* ignore */ }
  }

  return (
    <div style={{ height: 'calc(100vh - 140px)', minHeight: 540, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px 12px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <h2 className="page-title" style={{ margin: 0, fontSize: 19 }}>Training Manual</h2>
        <span style={{ color: 'var(--mist)', fontSize: 13 }}>Journey — office &amp; field app, screen by screen</span>
        {isSuper && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="logout-button" style={{ padding: '7px 14px' }} onClick={printManual}>Print</button>
            <a className="auth-button" style={{ width: 'auto', padding: '8px 16px', textDecoration: 'none' }}
              href="/Journey-Training-Manual.pdf" download>Download PDF</a>
          </div>
        )}
      </div>
      <iframe
        ref={frameRef}
        title="Journey Operator Training Manual"
        src="/training-manual.html"
        style={{ flex: 1, width: '100%', border: 'none', borderRadius: 10, marginTop: 10, background: '#fff' }}
      />
    </div>
  )
}
