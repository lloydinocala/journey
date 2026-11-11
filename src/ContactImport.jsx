import { useMemo, useRef, useState } from 'react'
import { supabase } from './utils/supabase'
import { isNative } from './native/native'

// Import a phone's contact list into Known Others, so the Call Console recognizes those callers.
// Accepts a contacts export (.vcf from iPhone / Android, or .csv from Google / Outlook), or — on
// Android Chrome — picking straight from the phone's contacts. Anyone already on file as a
// customer, vendor, employee or Known Other is skipped. Nothing is saved until Import is tapped.
const CATS = [['friends_family', 'Friends & Family'], ['salesman', 'Salesman'], ['other', 'Other contact']]
const SHORT = { friends_family: 'Family/Friend', salesman: 'Salesman', other: 'Other' }
const last10 = (p) => String(p || '').replace(/\D/g, '').slice(-10)
const pretty = (p) => { const d = last10(p); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : String(p || '').trim() }

// ---------- vCard ----------
function decodeQP(s, charset) {
  const bytes = []
  const str = s.replace(/=\r?\n/g, '')
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '=' && /^[0-9A-F]{2}$/i.test(str.substr(i + 1, 2))) { bytes.push(parseInt(str.substr(i + 1, 2), 16)); i += 2 } else bytes.push(str.charCodeAt(i) & 0xff)
  }
  try { return new TextDecoder(charset || 'utf-8').decode(new Uint8Array(bytes)) } catch { return String.fromCharCode(...bytes) }
}
const unescapeV = (v) => v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim()
function parseVcf(text) {
  // Unfold continued lines; quoted-printable soft breaks end with "=".
  const raw = text.replace(/\r\n/g, '\n').split('\n')
  const lines = []
  for (const l of raw) {
    if (/^[ \t]/.test(l) && lines.length) lines[lines.length - 1] += l.slice(1)
    else if (lines.length && /ENCODING=QUOTED-PRINTABLE/i.test(lines[lines.length - 1]) && lines[lines.length - 1].endsWith('=')) lines[lines.length - 1] = lines[lines.length - 1].slice(0, -1) + l
    else lines.push(l)
  }
  const out = []
  let cur = null
  for (const line of lines) {
    if (/^BEGIN:VCARD/i.test(line)) { cur = { fn: '', n: '', org: '', phones: [], emails: [] }; continue }
    if (/^END:VCARD/i.test(line)) { if (cur) out.push(cur); cur = null; continue }
    if (!cur) continue
    const idx = line.indexOf(':')
    if (idx < 0) continue
    const head = line.slice(0, idx)
    let val = line.slice(idx + 1)
    const [prop0, ...params] = head.split(';')
    const prop = prop0.replace(/^item\d+\./i, '').toUpperCase()
    if (params.some((p) => /QUOTED-PRINTABLE/i.test(p))) {
      const cs = (params.find((p) => /^CHARSET=/i.test(p)) || '').split('=')[1]
      val = decodeQP(val, cs)
    }
    if (prop === 'FN') cur.fn = unescapeV(val)
    else if (prop === 'N') { const [last, first, middle] = val.split(';').map(unescapeV); cur.n = [first, middle, last].filter(Boolean).join(' ') }
    else if (prop === 'ORG') cur.org = unescapeV(val.split(';')[0] || '')
    else if (prop === 'TEL') cur.phones.push(val.replace(/^tel:/i, '').trim())
    else if (prop === 'EMAIL') cur.emails.push(unescapeV(val))
  }
  return out.map((c) => ({ name: c.fn || c.n || c.org, company: c.org, phones: c.phones, email: c.emails[0] || '' }))
}

// ---------- CSV ----------
function parseCsvRows(text) {
  const rows = []; let row = []; let f = ''; let q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++ } else q = false } else f += ch; continue }
    if (ch === '"') q = true
    else if (ch === ',') { row.push(f); f = '' }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = '' }
    else f += ch
  }
  if (f || row.length) { row.push(f); rows.push(row) }
  return rows.filter((r) => r.some((x) => x.trim()))
}
function parseCsv(text) {
  const rows = parseCsvRows(text.replace(/^﻿/, ''))
  if (rows.length < 2) return []
  const h = rows[0].map((x) => x.trim().toLowerCase())
  const find = (re, not) => h.findIndex((x) => re.test(x) && !(not && not.test(x)))
  const iName = find(/^(name|full name|display name|file as)$/)
  const iFirst = find(/first name|given name/, /phonetic|yomi/)
  const iMid = find(/middle name|additional name/, /phonetic|yomi/)
  const iLast = find(/last name|family name|surname/, /phonetic|yomi/)
  const iOrg = find(/^(company|organization name|organization 1 - name|organization)$/)
  const iEmail = find(/e-?mail/, /type|label|display/)
  const iPhones = h.map((x, i) => ((/phone|mobile|tel|cell/.test(x) && !/type|label|fax|pager/.test(x)) ? i : -1)).filter((i) => i >= 0)
  return rows.slice(1).map((r) => {
    const g = (i) => (i >= 0 ? String(r[i] || '').trim() : '')
    const name = g(iName) || [g(iFirst), g(iMid), g(iLast)].filter(Boolean).join(' ') || g(iOrg)
    const phones = iPhones.flatMap((i) => g(i).split(':::').map((p) => p.trim())).filter(Boolean)
    return { name, company: g(iOrg), phones, email: g(iEmail).split(':::')[0].trim() }
  })
}

// Clean, de-duplicate, and keep only contacts with a usable phone number.
function tidy(list) {
  const seen = new Set()
  const out = []
  for (const c of list) {
    const phones = [...new Set((c.phones || []).map(last10).filter((d) => d.length === 10))]
    const name = String(c.name || '').trim()
    if (!phones.length || !name) continue
    const key = name.toLowerCase() + '|' + phones[0]
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ key, name, company: String(c.company || '').trim(), email: String(c.email || '').trim(), phones })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

export default function ContactImport({ orgId, profile, onDone, onCancel, field = false }) {
  const fileRef = useRef(null)
  const [rows, setRows] = useState(null)      // parsed contacts
  const [skippedNoPhone, setSkippedNoPhone] = useState(0)
  const [pick, setPick] = useState({})        // key -> { on, cat }
  const [bulkCat, setBulkCat] = useState('friends_family')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState(null)
  const native = isNative()
  const canPick = native || (typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window)

  // Mark each contact with who it already is in Journey (if anyone).
  async function annotate(list, rawCount) {
    setBusy('check'); setMsg(null)
    const [cu, ve, us, kc] = await Promise.all([
      supabase.from('customers').select('display_name, primary_phone, secondary_phone').eq('org_id', orgId).limit(20000),
      supabase.from('vendors').select('name, phone, sales_rep_phone').eq('org_id', orgId),
      supabase.from('users').select('full_name, phone').eq('org_id', orgId),
      supabase.from('known_contacts').select('name, phone, phone_alt').eq('org_id', orgId),
    ])
    const on = new Map()
    const add = (p, label) => { const d = last10(p); if (d.length === 10 && !on.has(d)) on.set(d, label) }
    for (const c of cu.data || []) { add(c.primary_phone, `Customer: ${c.display_name}`); add(c.secondary_phone, `Customer: ${c.display_name}`) }
    for (const v of ve.data || []) { add(v.phone, `Vendor: ${v.name}`); add(v.sales_rep_phone, `Vendor rep: ${v.name}`) }
    for (const u of us.data || []) add(u.phone, `Employee: ${u.full_name}`)
    for (const k of kc.data || []) { add(k.phone, `Known Other: ${k.name}`); add(k.phone_alt, `Known Other: ${k.name}`) }
    const marked = list.map((c) => ({ ...c, existing: c.phones.map((d) => on.get(d)).find(Boolean) || '' }))
    const p = {}
    for (const c of marked) p[c.key] = { on: !c.existing, cat: 'friends_family' }
    setRows(marked); setPick(p); setSkippedNoPhone(Math.max(0, rawCount - list.length)); setBusy('')
  }

  async function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setMsg(null)
    const text = await file.text()
    const isVcf = /\.vcf$/i.test(file.name) || /BEGIN:VCARD/i.test(text.slice(0, 2000))
    const raw = isVcf ? parseVcf(text) : parseCsv(text)
    if (!raw.length) { setMsg({ ok: false, t: 'No contacts were found in that file. Use a .vcf (vCard) or .csv contacts export.' }); return }
    await annotate(tidy(raw), raw.length)
  }
  async function pickFromPhone() {
    setMsg(null)
    if (native) {
      // Store app: read the phone's contacts directly (with permission).
      try {
        const { Contacts } = await import('@capacitor-community/contacts')
        const perm = await Contacts.requestPermissions()
        if (perm.contacts !== 'granted') { setMsg({ ok: false, t: 'Journey needs permission to read your contacts. Allow it in the phone\'s settings.' }); return }
        setBusy('check')
        const { contacts } = await Contacts.getContacts({ projection: { name: true, phones: true, emails: true, organization: true } })
        const raw = (contacts || []).map((c) => ({ name: c.name?.display || [c.name?.given, c.name?.family].filter(Boolean).join(' '), company: c.organization?.company || '', phones: (c.phones || []).map((p) => p.number), email: c.emails?.[0]?.address || '' }))
        setBusy('')
        await annotate(tidy(raw), raw.length)
      } catch (err) { setBusy(''); setMsg({ ok: false, t: err?.message || 'Could not read your contacts.' }) }
      return
    }
    try {
      const got = await navigator.contacts.select(['name', 'tel', 'email'], { multiple: true })
      if (!got?.length) return
      const raw = got.map((c) => ({ name: (c.name || [])[0] || '', phones: c.tel || [], email: (c.email || [])[0] || '' }))
      await annotate(tidy(raw), raw.length)
    } catch (err) { setMsg({ ok: false, t: err?.message || 'Could not open your contacts.' }) }
  }

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (rows || []).filter((c) => !t || c.name.toLowerCase().includes(t) || c.company.toLowerCase().includes(t) || c.phones.some((d) => d.includes(t.replace(/\D/g, '') || '~')))
  }, [rows, q])
  const chosen = (rows || []).filter((c) => pick[c.key]?.on)
  const setOne = (k, patch) => setPick((p) => ({ ...p, [k]: { ...p[k], ...patch } }))
  function setAll(on) { setPick((p) => { const n = { ...p }; for (const c of shown) if (!c.existing) n[c.key] = { ...n[c.key], on }; return n }) }
  function applyBulk(cat) { setBulkCat(cat); setPick((p) => { const n = { ...p }; for (const c of rows || []) n[c.key] = { ...n[c.key], cat }; return n }) }

  async function doImport() {
    if (!chosen.length) return
    setBusy('save'); setMsg(null)
    const payload = chosen.map((c) => ({
      org_id: orgId, category: pick[c.key]?.cat || 'other', name: c.name, company: c.company || null,
      phone: pretty(c.phones[0]), phone_alt: c.phones[1] ? pretty(c.phones[1]) : null, email: c.email || null,
      is_active: true, created_by: profile?.id || null, notes: 'Imported from phone contacts',
    }))
    for (let i = 0; i < payload.length; i += 200) {
      const { error } = await supabase.from('known_contacts').insert(payload.slice(i, i + 200))
      if (error) { setBusy(''); setMsg({ ok: false, t: `Stopped after ${i} contacts: ${error.message}` }); return }
    }
    setBusy('')
    setMsg({ ok: true, t: `Imported ${payload.length} contact${payload.length === 1 ? '' : 's'} into Known Others. The Call Console will now recognize them.` })
    setRows(null)
    onDone && onDone(payload.length)
  }

  const S = field ? {
    btn: { border: '2px solid var(--fa-cyan)', background: 'var(--fa-navy)', color: '#fff', borderRadius: 12, padding: '11px 14px', fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit', width: '100%' },
    ghost: { border: '2px solid var(--fa-cyan)', background: '#fff', color: 'var(--fa-navy)', borderRadius: 12, padding: '9px 12px', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
    box: { background: '#fff', border: '1.5px solid var(--fa-cyan)', borderRadius: 14, padding: 12 },
  } : {
    btn: { border: 'none', background: '#215F9A', color: '#fff', borderRadius: 8, padding: '9px 16px', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
    ghost: { border: '1px solid #CBD5E1', background: '#fff', color: '#1F3A5F', borderRadius: 8, padding: '7px 12px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
    box: { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: 14 },
  }
  const muted = { color: '#5A6B7B', fontSize: 13 }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <input ref={fileRef} type="file" accept=".vcf,.csv,text/vcard,text/x-vcard,text/csv" style={{ display: 'none' }} onChange={onFile} />
      {!rows && (
        <div style={{ ...S.box, display: 'grid', gap: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Import your phone contacts</div>
          <div style={muted}>Adds them to Known Others so the Call Console recognizes them when they call. People already on file as customers, vendors or employees are left alone. You choose who comes in before anything is saved.</div>
          {canPick && <button type="button" style={S.btn} disabled={!!busy} onClick={pickFromPhone}>{native ? 'Import from this phone\'s contacts' : 'Pick from this phone\'s contacts'}</button>}
          <button type="button" style={canPick ? S.ghost : S.btn} disabled={!!busy} onClick={() => fileRef.current?.click()}>{busy === 'check' ? 'Reading…' : 'Choose a contacts file (.vcf or .csv)'}</button>
          <details style={muted}>
            <summary style={{ cursor: 'pointer', fontWeight: 700 }}>How to get a contacts file</summary>
            <div style={{ marginTop: 6, lineHeight: 1.45 }}>
              <b>iPhone:</b> open Contacts → tap <i>Lists</i> (top left) → press and hold <i>All Contacts</i> → <i>Export</i> → save to Files. Then choose that file here.<br />
              <b>Android:</b> open Contacts → menu → <i>Manage contacts</i> or <i>Settings</i> → <i>Export</i> → save the .vcf file. Then choose it here.<br />
              <b>Google Contacts (computer):</b> contacts.google.com → <i>Export</i> → Google CSV or vCard.
            </div>
          </details>
          {onCancel && <button type="button" style={S.ghost} onClick={onCancel}>Cancel</button>}
        </div>
      )}
      {msg && <div style={{ padding: '9px 12px', borderRadius: 10, fontWeight: 600, fontSize: 14, background: msg.ok ? '#E3F1E8' : '#FDECEC', color: msg.ok ? '#166534' : '#B0342F' }}>{msg.t}</div>}
      {rows && (
        <div style={{ ...S.box, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{rows.length} contacts found</div>
          <div style={muted}>
            {rows.filter((c) => c.existing).length} already in Journey (skipped){skippedNoPhone ? ` · ${skippedNoPhone} without a phone number left out` : ''}. {chosen.length} selected to import.
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" style={{ flex: '1 1 160px', minWidth: 0, border: '1px solid #C9D6E2', borderRadius: 8, padding: '8px 10px', fontSize: 15, fontFamily: 'inherit' }} />
            <button type="button" style={S.ghost} onClick={() => setAll(true)}>All</button>
            <button type="button" style={S.ghost} onClick={() => setAll(false)}>None</button>
          </div>
          <label style={{ ...muted, display: 'flex', gap: 6, alignItems: 'center' }}>Put everyone in:
            <select value={bulkCat} onChange={(e) => applyBulk(e.target.value)} style={{ border: '1px solid #C9D6E2', borderRadius: 8, padding: '5px 8px', fontFamily: 'inherit', fontSize: 14 }}>
              {CATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <div style={{ maxHeight: field ? 'none' : 460, overflow: 'auto', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 4 }}>
            {shown.map((c) => (
              <div key={c.key} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '7px 4px', borderTop: '1px solid #EEF2F6', opacity: c.existing ? 0.55 : 1 }}>
                <input type="checkbox" style={{ width: 20, height: 20, flex: '0 0 20px' }} disabled={!!c.existing} checked={!!pick[c.key]?.on} onChange={(e) => setOne(c.key, { on: e.target.checked })} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}{c.company && c.company !== c.name ? <span style={{ fontWeight: 500, color: '#5A6B7B' }}> · {c.company}</span> : ''}</div>
                  <div style={{ fontSize: 12.5, color: '#5A6B7B' }}>{c.existing || c.phones.map(pretty).join(' · ')}</div>
                </div>
                {!c.existing && (
                  <select value={pick[c.key]?.cat || 'other'} onChange={(e) => setOne(c.key, { cat: e.target.value })} style={{ border: '1px solid #C9D6E2', borderRadius: 8, padding: '4px 4px', fontSize: 12.5, fontFamily: 'inherit', flex: '0 0 auto', maxWidth: 112 }}>
                    {CATS.map(([k]) => <option key={k} value={k}>{SHORT[k]}</option>)}
                  </select>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={{ ...S.btn, flex: 1 }} disabled={!!busy || !chosen.length} onClick={doImport}>{busy === 'save' ? 'Importing…' : `Import ${chosen.length}`}</button>
            <button type="button" style={S.ghost} disabled={!!busy} onClick={() => { setRows(null); setMsg(null) }}>Start over</button>
          </div>
        </div>
      )}
    </div>
  )
}
