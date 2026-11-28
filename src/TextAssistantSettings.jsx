// Settings → AI Agents → Texting receptionist.
// Lets a subscriber turn on the receptionist for text messages: it answers texts to the company's own
// texting number with the same instructions and booking tools as its phone receptionist (sms-agent).
// Subscribers only — Journey (Platform) never gets this switch.
import { useEffect, useState } from 'react'
import { supabase } from './utils/supabase'

const JOURNEY_ORG = '5bb0e0a2-9a0a-4f45-96b9-69e7fe31ba8b'

export default function TextAssistantSettings({ orgId }) {
  const [row, setRow] = useState(null)
  const [org, setOrg] = useState(null)
  const [agent, setAgent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  useEffect(() => { if (orgId && orgId !== JOURNEY_ORG) load() }, [orgId])

  async function load() {
    setLoading(true); setMsg('')
    const [{ data: s }, { data: o }, { data: va }] = await Promise.all([
      supabase.from('sms_ai_settings').select('org_id, enabled, mode, line_number, missed_call_textback, missed_call_message, website_widget').eq('org_id', orgId).maybeSingle(),
      supabase.from('organizations').select('id, name, dba_name, sms_from_number, sms_number_status').eq('id', orgId).single(),
      supabase.from('voice_agents').select('agent_id, mode').eq('org_id', orgId).eq('is_active', true).limit(1).maybeSingle(),
    ])
    setRow(s || { org_id: orgId, enabled: false, mode: 'after_hours', line_number: null, missed_call_textback: false, missed_call_message: '', website_widget: false })
    setOrg(o || null); setAgent(va || null); setLoading(false)
  }

  async function save(patch) {
    const next = { ...row, ...patch }
    setRow(next)
    const { error } = await supabase.from('sms_ai_settings').upsert({ org_id: orgId, enabled: !!next.enabled, mode: next.mode || 'after_hours', missed_call_textback: !!next.missed_call_textback, missed_call_message: (next.missed_call_message || '').trim() || null, website_widget: !!next.website_widget }, { onConflict: 'org_id' })
    setMsg(error ? error.message : 'Saved.')
    if (error) load()
  }

  if (!orgId || orgId === JOURNEY_ORG) return null
  if (loading) return null

  const hasNumber = !!org?.sms_from_number
  const hasAgent = !!agent && agent.mode !== 'sales_demo'
  const ready = hasNumber && hasAgent
  const box = { border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', margin: '0 0 18px', background: '#fff' }
  const companyName = String(org?.dba_name || org?.name || 'our company').replace(/\s*\(demo\)\s*$/i, '')
  const num = org?.sms_from_number || ''
  const prettyNum = (() => { const d = num.replace(/\D/g, '').slice(-10); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : num })()
  const snippet = `<script src="https://journey-hvac.app/clara-widget.js" data-org="${orgId}"${num ? ` data-text="${num}"` : ''}${row?.website_widget ? '' : ' data-voice="off"'} async></script>`
  const qrData = `SMSTO:${num}:Hi, I'd like to schedule service.`
  const qrUrl = (size) => `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=0&data=${encodeURIComponent(qrData)}`
  function printSheet() {
    const w = window.open('', '_blank')
    if (!w) return
    const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
    const sticker = `<div class="st"><img src="${qrUrl(600)}"><div class="s1">Text us</div><div class="s2">${esc(prettyNum)}</div></div>`
    w.document.write(`<!doctype html><html><head><title>Text us — ${esc(companyName)}</title><style>
      body{font-family:Arial,Helvetica,sans-serif;margin:0;color:#163E64}
      .page{width:8in;min-height:10in;margin:0 auto;padding:.5in;box-sizing:border-box;page-break-after:always;text-align:center}
      .big img{width:4.6in;height:4.6in;margin:.3in auto}.h1{font-size:46px;font-weight:800;margin-top:.2in}.h2{font-size:30px;font-weight:700}.h3{font-size:22px;margin-top:.15in}
      .grid{display:grid;grid-template-columns:repeat(3,2.3in);gap:.25in;justify-content:center}
      .st{border:1px dashed #999;border-radius:12px;padding:.15in;text-align:center}.st img{width:1.8in;height:1.8in}.s1{font-weight:800;font-size:20px}.s2{font-size:16px}
      @media print{.noprint{display:none}}
    </style></head><body>
      <div class="noprint" style="padding:10px;text-align:center"><button onclick="window.print()" style="font-size:16px;padding:8px 16px">Print</button></div>
      <div class="page big"><div class="h1">Need service? Text us!</div><img src="${qrUrl(1200)}"><div class="h2">${esc(prettyNum)}</div><div class="h3">${esc(companyName)} · Scan with your phone's camera</div></div>
      <div class="page"><div class="grid">${sticker.repeat(9)}</div></div>
    </body></html>`)
    w.document.close()
  }

  return (
    <div style={box}>
      <h3 style={{ fontSize: 16, margin: '0 0 4px' }}>Texting receptionist</h3>
      <p style={{ fontSize: 13, color: 'var(--mist)', margin: '0 0 10px', maxWidth: 680 }}>
        Answers texts to your company number and books visits, using the same instructions and calendar rules as your phone receptionist.
        It says it is a virtual assistant, steps back the moment anyone on your team texts that person, and never answers STOP or HELP messages.
        Everything it sends shows in the Text Archive.
      </p>
      {!ready && (
        <div style={{ fontSize: 13, background: '#FFF8E6', border: '1px solid #F0DFA8', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
          Needs {!hasAgent ? 'the AI Receptionist add-on' : ''}{!hasAgent && !hasNumber ? ' and ' : ''}{!hasNumber ? 'your own texting number (Settings → Company → Texting)' : ''} before it can be turned on.
        </div>
      )}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, marginBottom: 10 }}>
        <input type="checkbox" checked={!!row?.enabled} disabled={!ready && !row?.enabled} onChange={(e) => save({ enabled: e.target.checked })} />
        Answer texts with the receptionist
      </label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, opacity: row?.enabled ? 1 : 0.55 }}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="radio" name="sms-ai-mode" checked={row?.mode !== 'always'} disabled={!row?.enabled} onChange={() => save({ mode: 'after_hours' })} />
          Only when the office is closed (after hours, weekends, holidays)
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="radio" name="sms-ai-mode" checked={row?.mode === 'always'} disabled={!row?.enabled} onChange={() => save({ mode: 'always' })} />
          Any time a text comes in
        </label>
      </div>
      {msg && <div style={{ fontSize: 13, marginTop: 8, color: /Saved|copied/.test(msg) ? '#166534' : '#B00020' }}>{msg}</div>}

      <h3 style={{ fontSize: 16, margin: '18px 0 4px' }}>Missed-call text-back</h3>
      <p style={{ fontSize: 13, color: 'var(--mist)', margin: '0 0 8px', maxWidth: 680 }}>
        When a caller hangs up on the receptionist within about 20 seconds, or without saying anything, they get one text from your number inviting them to reply and book.
        One text per number per day, never to someone your office is already texting, and none between 9 PM and 8 AM (those wait for the morning). Their reply goes to Text Archive → New texts and the Lead Board.
      </p>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, marginBottom: 8 }}>
        <input type="checkbox" checked={!!row?.missed_call_textback} disabled={!ready && !row?.missed_call_textback} onChange={(e) => save({ missed_call_textback: e.target.checked })} />
        Text back callers who hang up
      </label>
      <label style={{ fontSize: 13, display: 'block', maxWidth: 560 }}>Message (leave blank for the standard one)
        <textarea style={{ display: 'block', width: '100%', minHeight: 60, marginTop: 3 }} maxLength={280}
          placeholder={`Hi, this is ${companyName}. Sorry we missed your call! Reply here and we'll get you scheduled.`}
          value={row?.missed_call_message || ''} onChange={(e) => setRow({ ...row, missed_call_message: e.target.value })} onBlur={() => save({})} />
      </label>
      <div style={{ fontSize: 12, color: 'var(--mist)' }}>"Reply STOP to opt out." is added to the end automatically.</div>

      <h3 style={{ fontSize: 16, margin: '18px 0 4px' }}>Your website: Talk to us and Text us buttons</h3>
      <p style={{ fontSize: 13, color: 'var(--mist)', margin: '0 0 8px', maxWidth: 680 }}>
        Adds two buttons to the corner of your website. <b>Talk to us</b> lets a visitor talk with your receptionist right in their browser, and it books on your calendar like a phone call.
        <b> Text us</b> opens a text to your number on phones. Calls are limited per visitor so no one can run up your minutes.
      </p>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, marginBottom: 8 }}>
        <input type="checkbox" checked={!!row?.website_widget} disabled={!hasAgent && !row?.website_widget} onChange={(e) => save({ website_widget: e.target.checked })} />
        Turn on Talk to us (needs the AI Receptionist)
      </label>
      {(hasNumber || row?.website_widget) && (
        <>
          <div style={{ fontSize: 13, marginBottom: 4 }}>Copy this into your website, just before <code>&lt;/body&gt;</code> (or send it to whoever manages your site):</div>
          <textarea readOnly value={snippet} style={{ width: '100%', maxWidth: 680, minHeight: 74, fontFamily: 'monospace', fontSize: 12 }} onFocus={(e) => e.target.select()} />
          <div><button className="logout-button" type="button" onClick={() => { navigator.clipboard?.writeText(snippet); setMsg('Website code copied.') }}>Copy website code</button></div>
        </>
      )}

      {hasNumber && (
        <>
          <h3 style={{ fontSize: 16, margin: '18px 0 4px' }}>Text us QR code for print</h3>
          <p style={{ fontSize: 13, color: 'var(--mist)', margin: '0 0 8px', maxWidth: 680 }}>
            For trucks, yard signs, door hangers and unit stickers. Scanning it opens a text to {prettyNum} with "Hi, I'd like to schedule service." already typed.
          </p>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <img alt="Text us QR code" src={qrUrl(280)} style={{ width: 140, height: 140, border: '1px solid var(--border)', borderRadius: 8 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button className="auth-button" type="button" style={{ width: 'auto', margin: 0 }} onClick={printSheet}>Print sign and stickers</button>
              <button className="logout-button" type="button" onClick={() => window.open(qrUrl(1200), '_blank')}>Open QR code full size (for a printer or sign shop)</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
