import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

const money = (n) => (n == null || isNaN(n) ? '—' : `$${Number(n).toFixed(2)}`)
const fmt = (d) => (d ? new Date(d).toLocaleDateString() : '')

// The lifecycle every financed job passes through, independent of lender.
// decision (approve/deny) is handled separately; these are the sequential stamps.
const STAGES = [
  ['docs_sent_at', 'Loan docs sent'],
  ['invoice_provided_at', 'Invoice provided'],
  ['completion_signed_at', 'Completion signed'],
  ['equipment_installed_at', 'Equipment installed'],
  ['record_sent_at', 'Record sent to financier'],
]

const STATUS_STYLE = {
  applied: ['#F8EEDD', '#B0600A'],
  approved: ['#E3F1E8', '#166534'],
  denied: ['#FBE7E7', '#B00020'],
  funded: ['#E3F1E8', '#166534'],
  cancelled: ['#EEF1F6', '#475569'],
}

export default function FinancingCentral({ profile }) {
  const isSuper = profile?.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile?.org_id || '')
  const [lenders, setLenders] = useState([])
  const [directory, setDirectory] = useState([])
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ customer_name: '', lender_option_id: '', amount: '' })

  useEffect(() => {
    if (isSuper) supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
      setOrgs(data || []); if (!selectedOrg && data?.length) setSelectedOrg(data[0].id)
    })
  }, [])

  async function load() {
    if (!selectedOrg) return
    setLoading(true); setErr('')
    const [{ data: l }, { data: d }, { data: dir }] = await Promise.all([
      supabase.from('financing_options').select('*').eq('org_id', selectedOrg).eq('is_active', true).order('sort_order'),
      supabase.from('financing_deals').select('*').eq('org_id', selectedOrg).order('created_at', { ascending: false }),
      supabase.from('financing_lender_directory').select('*').eq('is_active', true).order('sort_order'),
    ])
    setLenders(l || []); setDeals(d || []); setDirectory(dir || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [selectedOrg])

  // Match a configured lender to a directory entry by name (for the Enroll link).
  const enrollFor = (name) => {
    if (!name) return null
    const hit = directory.find((x) => name.toLowerCase().includes(x.name.toLowerCase()) || x.name.toLowerCase().includes(name.toLowerCase()))
    return hit?.signup_url || null
  }

  async function addDeal(e) {
    e.preventDefault()
    if (!form.customer_name.trim()) { setErr('Enter a customer name.'); return }
    setBusy('add'); setErr(''); setMsg('')
    const lender = lenders.find((x) => x.id === form.lender_option_id)
    const { error } = await supabase.from('financing_deals').insert({
      org_id: selectedOrg,
      source_type: 'manual',
      customer_name: form.customer_name.trim(),
      lender_option_id: form.lender_option_id || null,
      lender_name: lender?.name || null,
      amount: form.amount === '' ? null : Number(form.amount),
      status: 'applied',
      created_by: profile?.id || null,
    })
    setBusy('')
    if (error) { setErr(error.message); return }
    setForm({ customer_name: '', lender_option_id: '', amount: '' }); setShowAdd(false)
    setMsg('Deal added to the pipeline.'); load()
  }

  async function patch(deal, fields, okMsg) {
    setBusy(deal.id); setErr(''); setMsg('')
    const { error } = await supabase.from('financing_deals')
      .update({ ...fields, updated_at: new Date().toISOString() }).eq('id', deal.id)
    setBusy('')
    if (error) { setErr(error.message); return }
    if (okMsg) setMsg(okMsg)
    load()
  }

  const decide = (deal, decision) => patch(deal, { decision, decision_at: new Date().toISOString(), status: decision }, `Marked ${decision}.`)
  const toggleStage = (deal, col) => patch(deal, { [col]: deal[col] ? null : new Date().toISOString() })
  const markFunded = (deal) => patch(deal, { funded_at: new Date().toISOString(), status: 'funded' }, 'Marked funded.')
  const cancel = (deal) => { if (window.confirm('Cancel this financing deal?')) patch(deal, { status: 'cancelled' }, 'Deal cancelled.') }
  const saveNotes = (deal, val) => { if ((deal.notes || '') !== val) patch(deal, { notes: val || null }) }

  const badge = (status) => {
    const [bg, c] = STATUS_STYLE[status] || STATUS_STYLE.applied
    return <span className="badge" style={{ background: bg, color: c }}>{status}</span>
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div className="page">
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0 }}>Financing Central</h2>
          {isSuper && <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />}
        </div>
        <Link to="/financing-options" className="logout-button">Configure lenders</Link>
      </div>
      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0, maxWidth: 820 }}>
        Your lenders, the financing pipeline, and where to enroll with new ones. The lender runs the application and approval on their own portal — Journey keeps your links handy, tracks each deal through to funding, and won't let an install be scheduled until payment is confirmed.
      </p>

      {msg && <div style={{ marginBottom: 12, background: '#E3F1E8', border: '1px solid #166534', color: '#166534', padding: '8px 12px', borderRadius: 8, fontWeight: 600, fontSize: 13 }}>{msg}</div>}
      {err && <div className="auth-error" style={{ marginBottom: 12 }}>{err}</div>}

      {loading ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : (
        <>
          {/* ---- Your lenders ---- */}
          <h3 style={{ marginBottom: 8 }}>Your lenders</h3>
          {lenders.length === 0 ? (
            <p style={{ color: 'var(--mist)' }}>No lenders configured yet. <Link to="/financing-options">Add your lenders</Link> so customers can apply.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
              {lenders.map((o) => {
                const enroll = enrollFor(o.name)
                return (
                  <div key={o.id} style={{ border: '1px solid var(--line, #E2E8F0)', borderRadius: 10, padding: 14, minWidth: 240, flex: '1 1 240px', maxWidth: 320 }}>
                    <div style={{ fontWeight: 700 }}>{o.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--mist)', marginBottom: 8 }}>{o.best_for || o.kind}{o.dealer_id ? ` · Dealer ${o.dealer_id}` : ''}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {o.apply_url
                        ? <a className="auth-button" style={{ width: 'auto', margin: 0, padding: '5px 10px', fontSize: 12 }} href={o.apply_url} target="_blank" rel="noreferrer">Customer apply ↗</a>
                        : <span style={{ fontSize: 11, color: '#B0600A' }}>no apply link</span>}
                      {o.dashboard_url && <a className="logout-button" style={{ padding: '5px 10px', fontSize: 12 }} href={o.dashboard_url} target="_blank" rel="noreferrer">My dashboard ↗</a>}
                      {enroll && <a className="logout-button" style={{ padding: '5px 10px', fontSize: 12 }} href={enroll} target="_blank" rel="noreferrer">Enroll ↗</a>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ---- Pipeline ---- */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Financing pipeline <span className="badge">{deals.filter((d) => !['funded', 'cancelled'].includes(d.status)).length} open</span></h3>
            <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => setShowAdd((v) => !v)}>{showAdd ? 'Cancel' : '+ Track a deal'}</button>
          </div>

          {showAdd && (
            <form onSubmit={addDeal} className="inline-form" style={{ marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
              <div className="field" style={{ minWidth: 200 }}><label>Customer</label><input value={form.customer_name} onChange={(e) => set('customer_name', e.target.value)} placeholder="Customer name" required /></div>
              <div className="field" style={{ minWidth: 180 }}><label>Lender</label>
                <select value={form.lender_option_id} onChange={(e) => set('lender_option_id', e.target.value)}>
                  <option value="">Select lender…</option>
                  {lenders.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div className="field" style={{ width: 130 }}><label>Amount</label><input type="number" value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder="0.00" /></div>
              <button className="auth-button" type="submit" disabled={busy === 'add'} style={{ width: 'auto' }}>{busy === 'add' ? 'Adding…' : 'Add to pipeline'}</button>
            </form>
          )}

          {deals.length === 0 ? (
            <p style={{ color: 'var(--mist)' }}>No financing deals yet. Add one above as customers choose to finance.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {deals.map((d) => (
                <div key={d.id} style={{ border: '1px solid var(--line, #E2E8F0)', borderRadius: 10, padding: 14, opacity: d.status === 'cancelled' ? 0.6 : 1 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontWeight: 700 }}>{d.customer_name || '—'}</span>
                    <span style={{ color: 'var(--mist)', fontSize: 13 }}>{d.lender_name || 'no lender'} · {money(d.amount)}</span>
                    {badge(d.status)}
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--mist)' }}>opened {fmt(d.created_at)}</span>
                  </div>

                  {/* decision */}
                  {!d.decision && d.status !== 'cancelled' && (
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                      <button className="auth-button" style={{ width: 'auto', margin: 0, padding: '5px 12px', fontSize: 12 }} disabled={busy === d.id} onClick={() => decide(d, 'approved')}>Approved</button>
                      <button className="logout-button" style={{ color: '#B00020', borderColor: '#F0B4B4' }} disabled={busy === d.id} onClick={() => decide(d, 'denied')}>Denied</button>
                    </div>
                  )}

                  {/* stage pills */}
                  {d.decision === 'approved' && d.status !== 'cancelled' && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                      {STAGES.map(([col, label]) => {
                        const done = !!d[col]
                        return (
                          <button key={col} disabled={busy === d.id} onClick={() => toggleStage(d, col)}
                            title={done ? `Done ${fmt(d[col])} — click to undo` : 'Click to mark done'}
                            style={{ cursor: 'pointer', border: '1px solid', borderColor: done ? '#166534' : '#CBD5E1', background: done ? '#E3F1E8' : '#fff', color: done ? '#166534' : '#475569', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>
                            {done ? '✓ ' : ''}{label}
                          </button>
                        )
                      })}
                      {d.record_sent_at && !d.funded_at && (
                        <button className="auth-button" style={{ width: 'auto', margin: 0, padding: '4px 12px', fontSize: 12 }} disabled={busy === d.id} onClick={() => markFunded(d)}>Mark funded</button>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <textarea defaultValue={d.notes || ''} placeholder="Notes (follow-up, docs outstanding, rep contact…)"
                      onBlur={(e) => saveNotes(d, e.target.value.trim())}
                      style={{ flex: 1, minHeight: 34, fontSize: 13, padding: 6, borderRadius: 6, border: '1px solid #E2E8F0', resize: 'vertical' }} />
                    {d.status !== 'cancelled' && d.status !== 'funded' && (
                      <button className="logout-button" style={{ fontSize: 12 }} disabled={busy === d.id} onClick={() => cancel(d)}>Cancel</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ---- Join a lender (directory) ---- */}
          <h3 style={{ marginBottom: 4 }}>Join a lender</h3>
          <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0, maxWidth: 820 }}>
            Lenders you can enroll with. Sign up on the lender's site; once approved, paste your customer application link and dashboard login into <Link to="/financing-options">Configure lenders</Link> so they show to customers here.
          </p>
          {directory.length === 0 ? (
            <p style={{ color: 'var(--mist)' }}>No lenders in the directory yet.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {directory.map((x) => (
                <div key={x.id} style={{ border: '1px solid var(--line, #E2E8F0)', borderRadius: 10, padding: 14, minWidth: 260, flex: '1 1 260px', maxWidth: 360 }}>
                  <div style={{ fontWeight: 700 }}>{x.name} <span style={{ fontSize: 11, color: 'var(--mist)', fontWeight: 400 }}>{x.kind}</span></div>
                  {x.best_for && <div style={{ fontSize: 12, marginTop: 2 }}>{x.best_for}</div>}
                  {x.terms_note && <div style={{ fontSize: 12, color: 'var(--mist)', marginTop: 2 }}>{x.terms_note}</div>}
                  {x.notes_for_subscriber && <div style={{ fontSize: 12, color: 'var(--mist)', marginTop: 6 }}>{x.notes_for_subscriber}</div>}
                  {x.typical_merchant_fee && <div style={{ fontSize: 11, color: '#B0600A', marginTop: 6 }}>Dealer cost: {x.typical_merchant_fee}</div>}
                  <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                    {x.signup_url && <a className="auth-button" style={{ width: 'auto', margin: 0, padding: '5px 12px', fontSize: 12 }} href={x.signup_url} target="_blank" rel="noreferrer">Enroll ↗</a>}
                    {x.website && <a className="logout-button" style={{ padding: '5px 12px', fontSize: 12 }} href={x.website} target="_blank" rel="noreferrer">Website ↗</a>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
