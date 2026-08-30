// Shared AI helper used across the CRM. Drop it into any screen:
//   <AiAssist title="Draft reminder" system={SYS} prompt={PROMPT} context={ctx}
//             onInsert={(t) => setNote(t)} insertLabel="Use this" />
// It calls the generic `ai-assist` edge function and shows an EDITABLE draft with
// Copy / Use this / Regenerate. It never sends anything to a customer — a person
// copies or inserts the text and sends it themselves.
//
// Props:
//   title       heading shown in the panel
//   system      task-specific system prompt (what the AI should do)
//   prompt      the instruction / question
//   context     structured facts object (only these are used by the AI)
//   onInsert    optional (text) => void; shows a "Use this" button when provided
//   insertLabel label for the insert button (default "Use this")
//   label       button text (default "Ask AI")
//   inline      render the panel inline instead of as a popover button
//   compact     smaller trigger button
import { useState, useEffect, useRef } from 'react'
import { supabase } from './utils/supabase'

const BRAND = '#1B3A6B'
const Spark = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flex: '0 0 auto' }} aria-hidden="true">
    <path d="M12 2l1.9 5.1L19 9l-5.1 1.9L12 16l-1.9-5.1L5 9l5.1-1.9L12 2z" fill="currentColor" />
    <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z" fill="currentColor" opacity="0.7" />
  </svg>
)

function Panel({ title, system, prompt, context, onInsert, insertLabel, onClose, inline }) {
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const started = useRef(false)

  async function generate() {
    setLoading(true); setError(''); setCopied(false)
    const { data, error: fnErr } = await supabase.functions.invoke('ai-assist', {
      body: { system, prompt, context },
    })
    setLoading(false)
    if (fnErr || data?.error) { setError(data?.error || fnErr?.message || 'The AI could not respond right now.'); return }
    setText((data?.text || '').trim())
  }
  useEffect(() => { if (!started.current) { started.current = true; generate() } }, []) // eslint-disable-line

  function copy() {
    try { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  const body = (
    <div style={{ background: '#fff', border: inline ? '1px solid #E2E8F0' : 'none', borderRadius: 12, padding: 16, width: inline ? 'auto' : 'min(560px, 94vw)', maxWidth: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ color: BRAND, display: 'inline-flex' }}><Spark size={18} /></span>
        <span style={{ fontWeight: 700, color: '#1F2A37', fontSize: 15 }}>{title || 'AI draft'}</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94A3B8' }}>AI-generated · review before use</span>
        {!inline && <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: 20, lineHeight: 1, color: '#64748B', cursor: 'pointer', padding: '0 2px' }}>×</button>}
      </div>

      {loading ? (
        <div style={{ color: '#64748B', fontSize: 13.5, padding: '18px 2px' }}>Thinking…</div>
      ) : error ? (
        <div style={{ color: '#B00020', fontSize: 13, background: '#FBE7E7', border: '1px solid #E3B0B0', borderRadius: 8, padding: '8px 10px' }}>{error}</div>
      ) : (
        <textarea value={text} onChange={(e) => setText(e.target.value)}
          style={{ width: '100%', minHeight: 150, boxSizing: 'border-box', border: '1px solid #D5DAE1', borderRadius: 8, padding: 10, fontSize: 13.5, lineHeight: 1.5, fontFamily: 'inherit', color: '#1F2A37', resize: 'vertical' }} />
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <button onClick={generate} disabled={loading}
          style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #D5DAE1', background: '#F5F7FA', color: '#334155', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          {loading ? 'Working…' : '↻ Regenerate'}
        </button>
        <button onClick={copy} disabled={loading || !text}
          style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #D5DAE1', background: '#fff', color: '#334155', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
        {onInsert && (
          <button onClick={() => { onInsert(text); onClose && onClose() }} disabled={loading || !text}
            style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: BRAND, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            {insertLabel || 'Use this'}
          </button>
        )}
      </div>
    </div>
  )

  if (inline) return body
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()}>{body}</div>
    </div>
  )
}

export default function AiAssist({ title, system, prompt, context, onInsert, insertLabel, label = 'Ask AI', inline = false, compact = false }) {
  const [open, setOpen] = useState(false)

  if (inline) {
    // Render as an always-present inline panel with its own trigger to (re)load.
    return <InlineAssist title={title} system={system} prompt={prompt} context={context} onInsert={onInsert} insertLabel={insertLabel} label={label} />
  }

  return (
    <>
      <button onClick={() => setOpen(true)} title="AI draft"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: compact ? '4px 9px' : '6px 12px', borderRadius: 8,
          border: `1px solid ${BRAND}`, background: '#fff', color: BRAND, fontWeight: 600, fontSize: compact ? 12 : 13, cursor: 'pointer' }}>
        <Spark size={compact ? 12 : 14} /> {label}
      </button>
      {open && (
        <Panel title={title} system={system} prompt={prompt} context={context} onInsert={onInsert} insertLabel={insertLabel} onClose={() => setOpen(false)} />
      )}
    </>
  )
}

// Inline variant: a card the user expands on demand (kept collapsed so it costs
// nothing until asked for).
function InlineAssist({ title, system, prompt, context, onInsert, insertLabel, label }) {
  const [open, setOpen] = useState(false)
  const [nonce, setNonce] = useState(0)
  if (!open) {
    return (
      <button onClick={() => { setOpen(true); setNonce((n) => n + 1) }}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8,
          border: `1px solid ${BRAND}`, background: '#fff', color: BRAND, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
        <Spark size={14} /> {label}
      </button>
    )
  }
  return (
    <div style={{ marginTop: 8 }}>
      <Panel key={nonce} title={title} system={system} prompt={prompt} context={context} onInsert={onInsert} insertLabel={insertLabel} onClose={() => setOpen(false)} inline />
    </div>
  )
}
