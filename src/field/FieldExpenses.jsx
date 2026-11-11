import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FieldShell, { todayISO } from './FieldShell'
import { supabase } from '../utils/supabase'

// CREDITS & EXPENSES — record a purchase (or a credit / return) against the company's chart of
// accounts, optionally tied to a job. SCAN DOCUMENT photographs the receipt and reads the vendor,
// date, total and how it was paid into the fields (line items are not sorted into inventory).
const PAID = [['cash', 'Cash'], ['check', 'Check'], ['credit_card', 'Credit Card']]
const GROUP = { cos: 'Cost of Sales', fleet: 'Vehicle / Fleet', overhead: 'Overhead' }
const blank = () => ({ jobNumber: '', date: todayISO(), vendor: '', accountId: '', amount: '', credit: false, paid: '', notes: '' })

// Shrink a phone photo to a readable JPEG (keeps uploads and the receipt read small).
async function prepImage(file) {
  if (!file.type.startsWith('image/')) return file
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file) })
  const scale = Math.min(1, 1800 / Math.max(img.width, img.height))
  const c = document.createElement('canvas'); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale)
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
  const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85))
  return blob ? new File([blob], 'receipt.jpg', { type: 'image/jpeg' }) : file
}
const toBase64 = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(file) })

export default function FieldExpenses({ profile }) {
  const navigate = useNavigate()
  const orgId = profile?.org_id
  const camRef = useRef(null)
  const [accounts, setAccounts] = useState([])
  const [f, setF] = useState(blank)
  const [doc, setDoc] = useState(null)        // { file, url }
  const [scanned, setScanned] = useState(null) // what the scan read
  const [locked, setLocked] = useState(false)  // fields read-only after a scan until Edit
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [saved, setSaved] = useState(null)
  const [editId, setEditId] = useState(null)   // editing an earlier entry
  const [hist, setHist] = useState(null)       // the month's entries
  const [showHist, setShowHist] = useState(false)
  const [histMonth, setHistMonth] = useState(() => todayISO().slice(0, 7))
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))

  useEffect(() => {
    if (!orgId) return
    supabase.rpc('ensure_chart_of_accounts', { p_org: orgId }).then(() =>
      supabase.from('chart_of_accounts').select('id, acct_group, name, sort_order, is_auto').eq('org_id', orgId).eq('is_active', true).order('sort_order')
        .then(({ data }) => setAccounts((data || []).filter((a) => !a.is_auto))))
  }, [orgId])

  async function onPhoto(e) {
    const raw = e.target.files?.[0]
    e.target.value = ''
    if (!raw) return
    setErr(''); setBusy('scan')
    try {
      const file = await prepImage(raw)
      setDoc({ file, url: file.type.startsWith('image/') ? URL.createObjectURL(file) : null, name: raw.name })
      const { data, error } = await supabase.functions.invoke('expense-scan', { body: { fileBase64: await toBase64(file), mediaType: file.type, accounts: accounts.map((a) => a.name) } })
      if (error || data?.error) throw new Error(data?.error || 'Could not read the receipt — fill in the fields by hand.')
      setScanned(data)
      const acct = accounts.find((a) => a.name === data.account)
      setF((x) => ({
        ...x,
        vendor: data.vendor || x.vendor,
        date: /^\d{4}-\d{2}-\d{2}$/.test(data.date || '') ? data.date : x.date,
        amount: data.total != null ? String(Math.abs(Number(data.total))) : x.amount,
        credit: !!data.is_credit,
        paid: data.paid_with || x.paid,
        accountId: acct?.id || x.accountId,
      }))
      setLocked(true)
    } catch (e2) {
      setErr(e2.message || 'Could not read the receipt — fill in the fields by hand.')
    }
    setBusy('')
  }
  function removeDoc() { setDoc(null); setScanned(null); setLocked(false); if (!editId) setF(blank()) }
  function resetAll() { setDoc(null); setScanned(null); setLocked(false); setF(blank()); setEditId(null) }

  async function loadHist(month = histMonth) {
    setHist(null); setShowHist(true)
    const start = month + '-01'
    const d = new Date(start + 'T12:00:00')
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10)
    const { data } = await supabase.from('expenses').select('id, expense_date, vendor, account_id, amount, payment_method, notes, document_path, job_id, jobs ( job_number )')
      .eq('org_id', orgId).is('deleted_at', null).gte('expense_date', start).lte('expense_date', end).order('expense_date', { ascending: false }).order('created_at', { ascending: false })
    setHist(data || [])
  }
  function openEntry(x) {
    setEditId(x.id); setDoc(x.document_path ? { path: x.document_path, name: 'Saved document' } : null); setScanned(null); setLocked(false); setErr('')
    setF({ jobNumber: x.jobs?.job_number || '', date: x.expense_date, vendor: x.vendor || '', accountId: x.account_id || '', amount: String(Math.abs(Number(x.amount))), credit: Number(x.amount) < 0, paid: x.payment_method || '', notes: x.notes || '' })
    setShowHist(false)
  }
  async function deleteEntry() {
    if (!editId) return
    setBusy('delete')
    const { error } = await supabase.from('expenses').update({ deleted_at: new Date().toISOString() }).eq('id', editId)
    setBusy('')
    if (error) { setErr(error.message); return }
    resetAll(); loadHist()
  }

  async function save() {
    setErr('')
    const amt = Number(String(f.amount).replace(/[$,\s]/g, ''))
    if (!f.accountId) { setErr('Pick a category.'); return }
    if (!(amt > 0)) { setErr('Enter the amount paid.'); return }
    setBusy('save')
    let jobId = null
    if (f.jobNumber.trim()) {
      const { data: j } = await supabase.from('jobs').select('id, job_number').eq('org_id', orgId).ilike('job_number', f.jobNumber.trim()).is('deleted_at', null).limit(1).maybeSingle()
      if (!j) { setBusy(''); setErr(`Job ${f.jobNumber.trim()} wasn't found — check the number or leave it blank.`); return }
      jobId = j.id
    }
    const id = editId || crypto.randomUUID()
    let path = doc?.path || null
    if (doc?.file) {
      const ext = doc.file.type.includes('pdf') ? 'pdf' : 'jpg'
      path = editId ? `${orgId}/${id}-${Date.now()}.${ext}` : `${orgId}/${id}.${ext}`
      const { error: upErr } = await supabase.storage.from('expense-docs').upload(path, doc.file, { contentType: doc.file.type })
      if (upErr) { setBusy(''); setErr('Could not save the document: ' + upErr.message); return }
    }
    const row = {
      job_id: jobId, expense_date: f.date, vendor: f.vendor.trim() || null, account_id: f.accountId,
      amount: f.credit ? -amt : amt, payment_method: f.paid || null, notes: f.notes.trim() || null, document_path: path,
    }
    const { error } = editId
      ? await supabase.from('expenses').update({ ...row, ...(scanned ? { extracted: scanned } : {}), updated_at: new Date().toISOString() }).eq('id', editId)
      : await supabase.from('expenses').insert({ id, org_id: orgId, ...row, extracted: scanned, created_by: profile?.id || null })
    setBusy('')
    if (error) { setErr(error.message); return }
    setSaved({ job: jobId ? f.jobNumber.trim().toUpperCase() : null, credit: f.credit, updated: !!editId })
  }

  if (saved) {
    return (
      <FieldShell profile={profile} title="Credits & Expenses" onBack={() => navigate('/tech/field')}>
        <div className="fa-panel" style={{ minHeight: 260, justifyContent: 'center' }}>
          <div className="fa-info" style={{ textAlign: 'center', padding: '40px 14px', fontSize: 21, fontWeight: 700 }}>
            {saved.updated ? <>Changes saved</> : saved.job ? <>Saved to Job # {saved.job}<br />{saved.credit ? 'Credits' : 'Expenses'}</> : <>Saved to Company<br />{saved.credit ? 'Credits' : 'Expenses'}</>}
          </div>
          <button type="button" className="fa-navbtn" onClick={() => { setSaved(null); resetAll() }}>Add Another</button>
          <button type="button" className="fa-navbtn ghost" onClick={() => navigate('/tech/field')}>Done</button>
        </div>
      </FieldShell>
    )
  }

  if (showHist) {
    const acctName = Object.fromEntries(accounts.map((a) => [a.id, a.name]))
    const total = (hist || []).reduce((a, x) => a + Number(x.amount || 0), 0)
    const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })
    return (
      <FieldShell profile={profile} title="Credits & Expenses" onBack={() => setShowHist(false)}>
        <div className="fa-panel">
          <select className="fa-select" value={histMonth} onChange={(e) => { setHistMonth(e.target.value); loadHist(e.target.value) }}>
            {months.map((m) => <option key={m} value={m}>{new Date(m + '-01T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</option>)}
          </select>
          {hist && <div className="fa-info" style={{ textAlign: 'center' }}><div className="fa-muted" style={{ fontSize: 12.5 }}>Total spent (credits subtracted)</div><div style={{ fontWeight: 900, fontSize: 22 }}>${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></div>}
          {!hist ? <p className="fa-empty">Loading…</p> : !hist.length ? <p className="fa-empty">Nothing entered this month.</p> : hist.map((x) => (
            <div key={x.id} className="fa-info" role="button" tabIndex={0} style={{ cursor: 'pointer', padding: '9px 12px', display: 'flex', justifyContent: 'space-between', gap: 8 }} onClick={() => openEntry(x)}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800 }}>{x.vendor || 'No vendor'}{x.document_path ? ' 📎' : ''}</div>
                <div className="fa-muted" style={{ fontSize: 12.5 }}>{new Date(x.expense_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {acctName[x.account_id] || '—'}{x.jobs?.job_number ? ` · Job ${x.jobs.job_number}` : ''}</div>
              </div>
              <div style={{ fontWeight: 900, whiteSpace: 'nowrap', color: Number(x.amount) < 0 ? '#1B7A3D' : undefined }}>{Number(x.amount) < 0 ? '−' : ''}${Math.abs(Number(x.amount)).toFixed(2)}</div>
            </div>
          ))}
        </div>
      </FieldShell>
    )
  }

  const row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: '#E4E6E8', border: '2px solid #1E5631', borderRadius: 10, padding: '4px 10px', minHeight: 40 }
  const inp = { border: 'none', background: 'transparent', textAlign: 'right', fontSize: 16, fontWeight: 600, color: 'var(--fa-ink)', flex: 1, minWidth: 0, fontFamily: 'inherit', padding: '6px 0' }
  const lab = { fontWeight: 600, fontSize: 15, whiteSpace: 'nowrap' }
  const groups = ['cos', 'fleet', 'overhead']
  return (
    <FieldShell profile={profile} title="Credits & Expenses" onBack={() => navigate('/tech/field')}>
      <div className="fa-panel">
        <label style={row}><span style={lab}>Job #</span><input style={inp} value={f.jobNumber} disabled={locked} onChange={(e) => set('jobNumber', e.target.value)} placeholder="optional" /></label>
        <label style={row}><span style={lab}>Date</span><input style={inp} type="date" value={f.date} disabled={locked} onChange={(e) => set('date', e.target.value)} /></label>
        <label style={row}><span style={lab}>Vendor</span><input style={inp} value={f.vendor} disabled={locked} onChange={(e) => set('vendor', e.target.value)} placeholder="Johnstone Supply" /></label>
        <label style={row}>
          <select style={{ ...inp, textAlign: 'right' }} value={f.accountId} disabled={locked} onChange={(e) => set('accountId', e.target.value)} aria-label="Category">
            <option value="">Category</option>
            {groups.map((g) => (
              <optgroup key={g} label={GROUP[g]}>
                {accounts.filter((a) => a.acct_group === g).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <label style={row}><span style={lab}>{f.credit ? 'Credit Amount' : 'Amount Paid'}</span><input style={inp} inputMode="decimal" value={f.amount} disabled={locked} onChange={(e) => set('amount', e.target.value)} placeholder="$ 0.00" /></label>
        <label style={row}><span style={lab}>How Paid</span>
          <select style={inp} value={f.paid} disabled={locked} onChange={(e) => set('paid', e.target.value)}>
            <option value="">Choose…</option>
            {PAID.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14.5, fontWeight: 600, padding: '0 4px' }}>
          <input type="checkbox" checked={f.credit} disabled={locked} onChange={(e) => set('credit', e.target.checked)} /> This is a credit or return (money back)
        </label>

        <input ref={camRef} type="file" accept="image/*,application/pdf" capture="environment" style={{ display: 'none' }} onChange={onPhoto} />
        <button type="button" className="fa-navbtn" style={{ fontSize: 16 }} disabled={!!busy || !accounts.length} onClick={() => camRef.current?.click()}>
          📷&nbsp;&nbsp;{busy === 'scan' ? 'Reading the receipt…' : doc ? 'SCAN AGAIN' : 'SCAN DOCUMENT'}
        </button>
        {doc?.url && <img src={doc.url} alt="Receipt" style={{ maxHeight: 160, objectFit: 'contain', borderRadius: 8, border: '1px solid #D5DEE6' }} />}
        {doc && !doc.url && <div className="fa-muted" style={{ textAlign: 'center' }}>📄 {doc.name || 'Document attached'}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="fa-navbtn ghost" style={{ flex: 1, fontSize: 16, padding: '8px', borderColor: 'var(--fa-navy)' }} disabled={!locked} onClick={() => setLocked(false)}>Edit</button>
          <button type="button" className="fa-navbtn ghost" style={{ flex: 1, fontSize: 16, padding: '8px', borderColor: 'var(--fa-red)', color: 'var(--fa-red)' }} disabled={!doc && !f.vendor && !f.amount} onClick={removeDoc}>Remove</button>
        </div>
        {err && <div className="fa-msg err">{err}</div>}
        <button type="button" className="fa-navbtn" style={{ fontSize: 17 }} disabled={!!busy} onClick={save}>{busy === 'save' ? 'Saving…' : editId ? 'Save Changes' : 'Save Document'}</button>
        {editId
          ? <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="fa-navbtn ghost" style={{ flex: 1, fontSize: 16 }} disabled={!!busy} onClick={() => { resetAll(); loadHist() }}>Back to List</button>
              <button type="button" className="fa-navbtn ghost" style={{ flex: 1, fontSize: 16, borderColor: 'var(--fa-red)', color: 'var(--fa-red)' }} disabled={!!busy} onClick={deleteEntry}>{busy === 'delete' ? 'Deleting…' : 'Delete Entry'}</button>
            </div>
          : <button type="button" className="fa-navbtn ghost" style={{ fontSize: 16, borderColor: 'var(--fa-cyan)' }} onClick={() => loadHist()}>This Month&apos;s Entries</button>}
      </div>
    </FieldShell>
  )
}
