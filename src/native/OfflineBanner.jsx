import { useEffect, useState } from 'react'
import { onOfflineState, dismissFailed, flush } from './offline'

// A thin bar at the top of the Field App while there's no signal or changes are waiting to upload.
export default function OfflineBanner() {
  const [s, setS] = useState(null)
  const [open, setOpen] = useState(false)
  useEffect(() => onOfflineState(setS), [])
  if (!s) return null
  const failed = s.failed || []
  if (!s.offline && !s.pending && !failed.length) return null
  const bar = { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 3000, padding: '6px 12px', paddingTop: 'calc(6px + env(safe-area-inset-top, 0px))', fontSize: 13.5, fontWeight: 700, textAlign: 'center', fontFamily: 'inherit', boxShadow: '0 2px 8px rgba(0,0,0,.15)' }
  if (failed.length) {
    return (
      <div style={{ ...bar, background: '#FDECEC', color: '#B0342F' }}>
        <span role="button" tabIndex={0} onClick={() => setOpen((v) => !v)} style={{ cursor: 'pointer' }}>
          {failed.length} change{failed.length === 1 ? '' : 's'} made without signal couldn&apos;t be saved — tap to see
        </span>
        {open && (
          <div style={{ fontWeight: 500, textAlign: 'left', marginTop: 6 }}>
            {failed.map((f, i) => <div key={i}>• {f.what} ({new Date(f.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}): {f.detail}</div>)}
            <div style={{ marginTop: 6 }}>Please redo these. <button type="button" onClick={() => { dismissFailed(); setOpen(false) }} style={{ marginLeft: 6, border: '1px solid #B0342F', background: '#fff', color: '#B0342F', borderRadius: 8, padding: '3px 10px', fontWeight: 700 }}>OK</button></div>
          </div>
        )}
      </div>
    )
  }
  return (
    <div style={{ ...bar, background: s.offline ? '#FFF4D6' : '#E3F1E8', color: s.offline ? '#7A5300' : '#166534' }} role="status" onClick={() => flush()}>
      {s.offline
        ? <>No signal{s.pending ? ` — ${s.pending} change${s.pending === 1 ? '' : 's'} saved on this phone, will upload automatically` : ' — showing what was last loaded'}</>
        : <>{s.syncing ? 'Uploading' : 'Waiting to upload'} {s.pending} change{s.pending === 1 ? '' : 's'}…</>}
    </div>
  )
}
