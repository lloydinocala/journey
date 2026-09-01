// Tools Management · Reconcile card purchases
// Match tool purchases paid by card (no PO) to the bank/credit-card statement.
// Import the statement (CSV or a PDF Quincy reads), then confirm the auto-matches
// — matched on amount + date + merchant + card last-4, the way you'd reconcile a
// bank statement. Exceptions surface both ways: charges with no receipt, and
// receipts not yet on a statement.
import { useState, useEffect, useMemo } from 'react'
import Papa from 'papaparse'
import { Link } from 'react-router-dom'
import {
  extractCardStatement, importCardTransactions, listCardTransactions, listCardAcquisitions,
  reconcileMatch, unmatchTxn,
} from './toolsData'
import { useOrgSelector, OrgBar } from './shared'

const money = (n) => (n == null || n === '' || isNaN(n) ? '—' : `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
const num = (x) => { if (x == null || x === '') return null; const n = parseFloat(String(x).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? null : n }
const normDate = (s) => { if (!s) return null; if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; const d = new Date(s); return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10) }
const norm = (s) => (s || '').toString().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const last4 = (s) => (s ? String(s).replace(/\D/g, '').slice(-4) : '')
const CSV_TARGETS = [{ key: 'txn_date', label: 'Date' }, { key: 'amount', label: 'Amount' }, { key: 'merchant', label: 'Merchant' }, { key: 'card_last4', label: 'Card last 4' }]
function fileToBase64(file) {
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1] || ''); r.onerror = reject; r.readAsDataURL(file) })
}

// How well a receipt (acquisition) matches a statement charge.
function scoreMatch(txn, acq) {
  let s = 0
  const ta = num(txn.amount), aa = num(acq.amount)
  if (ta != null && aa != null) {
    if (Math.abs(ta - aa) < 0.01) s += 100
    else if (ta > 0 && Math.abs(ta - aa) <= 0.05 * ta) s += 40
    else return 0 // amounts too far apart — not a candidate
  }
  if (txn.txn_date && acq.acquired_date) {
    const d = Math.abs((new Date(txn.txn_date) - new Date(acq.acquired_date)) / 86400000)
    if (d <= 1) s += 30; else if (d <= 3) s += 20; else if (d <= 7) s += 8
  }
  if (last4(txn.card_last4) && last4(acq.card_last4) && last4(txn.card_last4) === last4(acq.card_last4)) s += 25
  const a = norm(acq.vendor), b = norm(txn.merchant)
  if (a && b && (b.includes(a) || a.includes(b))) s += 20
  return s
}

export default function ToolReconcile({ profile }) {
  const org = useOrgSelector(profile)
  const [txns, setTxns] = useState([])       // unmatched card transactions
  const [acqs, setAcqs] = useState([])       // unmatched card acquisitions (receipts)
  const [sel, setSel] = useState({})         // txnId -> acquisitionId to match
  const [mode, setMode] = useState('csv')
  const [csvRows, setCsvRows] = useState([])
  const [csvHeaders, setCsvHeaders] = useState([])
  const [mapping, setMapping] = useState({})
  const [reading, setReading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function load() {
    if (!org.selectedOrg) return
    const [t, a] = await Promise.all([
      listCardTransactions(org.selectedOrg, { unmatchedOnly: true }),
      listCardAcquisitions(org.selectedOrg, { unmatchedOnly: true }),
    ])
    setTxns(t); setAcqs(a)
    // seed each txn's suggested match with the best-scoring receipt
    const seed = {}
    for (const tx of t) {
      const ranked = a.map((ac) => ({ id: ac.id, score: scoreMatch(tx, ac) })).filter((x) => x.score >= 100).sort((x, y) => y.score - x.score)
      if (ranked[0]) seed[tx.id] = ranked[0].id
    }
    setSel(seed)
  }
  useEffect(() => { load() }, [org.selectedOrg])

  const candidatesFor = (tx) => acqs.map((ac) => ({ ac, score: scoreMatch(tx, ac) })).filter((x) => x.score > 0).sort((x, y) => y.score - x.score)

  // ---- statement import ----
  function onCsv(e) {
    const file = e.target.files?.[0]; if (!file) return
    setMsg('')
    Papa.parse(file, { header: true, skipEmptyLines: true, complete: (res) => {
      const headers = res.meta.fields || []
      setCsvHeaders(headers); setCsvRows(res.data || [])
      const find = (re) => headers.find((h) => re.test(h))
      setMapping({ txn_date: find(/date/i), amount: find(/amount|debit|charge|total|\$/i), merchant: find(/desc|merchant|payee|name|vendor/i), card_last4: find(/card|last ?4|acct|account/i) })
    } })
    e.target.value = ''
  }
  async function importCsv() {
    const rows = csvRows.map((r) => ({
      txn_date: normDate(mapping.txn_date ? r[mapping.txn_date] : null),
      amount: Math.abs(num(mapping.amount ? r[mapping.amount] : null) || 0) || null,
      merchant: mapping.merchant ? (r[mapping.merchant] || null) : null,
      card_last4: mapping.card_last4 ? last4(r[mapping.card_last4]) : null,
      source: 'csv',
    })).filter((r) => r.amount != null)
    if (rows.length === 0) { setMsg('No charges found — check the column mapping.'); return }
    setBusy(true)
    const { inserted, error } = await importCardTransactions(org.selectedOrg, rows)
    setBusy(false); setCsvRows([]); setCsvHeaders([]); setMapping({})
    setMsg(error ? error.message : `Imported ${inserted} charge${inserted === 1 ? '' : 's'}.`)
    if (!error) load()
  }
  async function onPdf(e) {
    const file = e.target.files?.[0]; if (!file) return
    setReading(true); setMsg('')
    try {
      const b64 = await fileToBase64(file)
      const res = await extractCardStatement(b64, file.type || 'application/pdf')
      if (res.error) { setMsg(res.error); return }
      const rows = (res.transactions || []).map((t) => ({
        txn_date: normDate(t.date), amount: num(t.amount), merchant: (t.merchant || '').trim() || null,
        card_last4: last4(t.card_last4 || res.card_last4), source: 'quincy-pdf',
      })).filter((r) => r.amount != null)
      if (rows.length === 0) { setMsg('Quincy found no charges in that file.'); return }
      const { inserted, error } = await importCardTransactions(org.selectedOrg, rows)
      setMsg(error ? error.message : `Quincy imported ${inserted} charge${inserted === 1 ? '' : 's'}.`)
      if (!error) load()
    } catch (err) { setMsg(String(err)) } finally { setReading(false); e.target.value = '' }
  }

  async function matchOne(tx) {
    const acqId = sel[tx.id]; if (!acqId) return
    setBusy(true); await reconcileMatch(tx.id, acqId); setBusy(false); load()
  }

  const acqById = useMemo(() => Object.fromEntries(acqs.map((a) => [a.id, a])), [acqs])

  return (
    <div>
      <div className="page-header-bar"><h2>Reconcile Card Purchases</h2></div>
      <OrgBar {...org} />
      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0, maxWidth: 800 }}>
        Match card/debit tool purchases to your bank statement — no PO needed. Record purchases as receipts on{' '}
        <Link to="/tools/orders">Orders &amp; Receipts</Link>, import the statement here, then confirm each match
        (suggested by amount + date + merchant + card last-4).
      </p>

      {/* Statement import */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, margin: '4px 0 18px', background: '#F8FAFC' }}>
        <strong style={{ fontSize: 14 }}>Import a bank / card statement</strong>
        <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', margin: '10px 0' }}>
          {[['csv', 'CSV / spreadsheet'], ['pdf', 'PDF / photo (Quincy reads it)']].map(([k, label]) => (
            <button key={k} type="button" onClick={() => { setMode(k); setMsg('') }}
              style={{ border: 'none', padding: '7px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700, background: mode === k ? '#1B3A6B' : '#fff', color: mode === k ? '#fff' : '#334155' }}>{label}</button>
          ))}
        </div>
        {mode === 'csv' ? (
          <div>
            <input type="file" accept=".csv,text/csv" onChange={onCsv} />
            {csvHeaders.length > 0 && (
              <>
                <p style={{ color: 'var(--mist)', fontSize: 13, margin: '10px 0 6px' }}>{csvRows.length} rows — match the columns:</p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {CSV_TARGETS.map((t) => (
                    <div className="field" key={t.key} style={{ marginBottom: 6, minWidth: 150 }}>
                      <label>{t.label}</label>
                      <select value={mapping[t.key] || ''} onChange={(e) => setMapping({ ...mapping, [t.key]: e.target.value })}>
                        <option value="">—</option>{csvHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                <button className="auth-button" style={{ width: 'auto', marginTop: 8 }} disabled={busy} onClick={importCsv}>Import charges</button>
              </>
            )}
          </div>
        ) : (
          <div>
            <p style={{ color: 'var(--mist)', fontSize: 13, margin: '8px 0' }}>Upload the statement as a PDF or clear photo — Quincy pulls out each charge.</p>
            <label className="auth-button" style={{ width: 'auto', padding: '9px 18px', cursor: 'pointer', display: 'inline-block' }}>
              {reading ? 'Quincy is reading…' : 'Choose PDF / image'}
              <input type="file" accept="application/pdf,image/*" onChange={onPdf} disabled={reading} style={{ display: 'none' }} />
            </label>
          </div>
        )}
      </div>
      {msg && <div style={{ marginBottom: 12, color: msg.startsWith('Imported') || msg.startsWith('Quincy imported') ? '#166534' : '#B00020' }}>{msg}</div>}

      {/* Charges to reconcile */}
      <h3 style={{ marginBottom: 6 }}>Charges to reconcile ({txns.length})</h3>
      {txns.length === 0 ? (
        <div style={{ color: '#166534', fontSize: 14, marginBottom: 20 }}>No unmatched charges — everything is reconciled.</div>
      ) : (
        <table className="data-table" style={{ marginBottom: 22 }}>
          <thead><tr><th>Date</th><th style={{ textAlign: 'right' }}>Amount</th><th>Merchant</th><th>Card</th><th>Match to receipt</th><th></th></tr></thead>
          <tbody>
            {txns.map((tx) => {
              const cands = candidatesFor(tx)
              const noReceipt = cands.length === 0
              return (
                <tr key={tx.id} style={noReceipt ? { background: '#FFF7ED' } : undefined}>
                  <td>{tx.txn_date || '—'}</td>
                  <td style={{ textAlign: 'right' }}>{money(tx.amount)}</td>
                  <td style={{ color: 'var(--mist)' }}>{tx.merchant || '—'}</td>
                  <td style={{ color: 'var(--mist)' }}>{tx.card_last4 ? `••${tx.card_last4}` : '—'}</td>
                  <td>
                    {noReceipt ? <span style={{ color: '#B0600A', fontWeight: 600 }}>No matching receipt — add it on Orders &amp; Receipts</span> : (
                      <select value={sel[tx.id] || ''} onChange={(e) => setSel({ ...sel, [tx.id]: e.target.value })} style={{ minWidth: 240 }}>
                        <option value="">— pick a receipt —</option>
                        {cands.map(({ ac, score }) => (
                          <option key={ac.id} value={ac.id}>{(ac.vendor || 'receipt')} · {money(ac.amount)} · {ac.acquired_date || '?'}{score >= 100 ? ' ✓' : ''}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td>{!noReceipt && <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={busy || !sel[tx.id]} onClick={() => matchOne(tx)}>Match</button>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {/* Receipts awaiting a statement */}
      <h3 style={{ marginBottom: 6 }}>Receipts awaiting a statement ({acqs.length})</h3>
      {acqs.length === 0 ? (
        <div style={{ color: 'var(--mist)', fontSize: 14 }}>None — every card receipt is matched.</div>
      ) : (
        <table className="data-table">
          <thead><tr><th>Date</th><th>Vendor</th><th style={{ textAlign: 'right' }}>Amount</th><th>Card</th></tr></thead>
          <tbody>
            {acqs.map((a) => (
              <tr key={a.id}>
                <td>{a.acquired_date || '—'}</td>
                <td>{a.vendor || '—'}</td>
                <td style={{ textAlign: 'right' }}>{money(a.amount)}</td>
                <td style={{ color: 'var(--mist)' }}>{a.card_last4 ? `••${a.card_last4}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
