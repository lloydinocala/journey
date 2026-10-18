import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import { money, num, r2, fmtDate, today, CO_REASONS, CO_STATUS, coLineAmount, approvedCoTotal } from './data'

// Commercial Projects · one change order: scope, priced lines, approval, printout.
// Approving adds its lines to the schedule of values and raises the contract sum.
export default function ChangeOrderEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [co, setCo] = useState(null)
  const [project, setProject] = useState(null)
  const [others, setOthers] = useState([])
  const [org, setOrg] = useState(null)
  const [lines, setLines] = useState([])
  const [removed, setRemoved] = useState([])
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [approving, setApproving] = useState(false)
  const [appr, setAppr] = useState({ date: today(), by: '' })
  const [showBreakdown, setShowBreakdown] = useState(true)

  const load = useCallback(async () => {
    const { data: c, error } = await supabase.from('cp_change_orders').select('*').eq('id', id).maybeSingle()
    if (error || !c) { setMsg(error?.message || 'Change order not found'); return }
    const [{ data: p }, { data: l }, { data: oth }] = await Promise.all([
      supabase.from('cp_projects').select('*, customers(display_name), properties(street_address, unit, city, state, zip)').eq('id', c.project_id).maybeSingle(),
      supabase.from('cp_change_order_lines').select('*').eq('change_order_id', id).order('sort_order'),
      supabase.from('cp_change_orders').select('id, co_number, status, amount').eq('project_id', c.project_id),
    ])
    const { data: o } = await supabase.from('organizations').select('name, business_phone').eq('id', c.org_id).maybeSingle()
    setCo(c); setProject(p); setLines(l || []); setOthers(oth || []); setOrg(o); setRemoved([]); setDirty(false)
  }, [id])
  useEffect(() => { load() }, [load])

  if (msg && !co) return <div><h2 className="page-title">Change Order</h2><p>{msg}</p></div>
  if (!co || !project) return <div><h2 className="page-title">Change Order</h2><p style={{ color: 'var(--mist)' }}>Loading…</p></div>

  const editable = co.status === 'draft' || co.status === 'sent'
  const total = lines.reduce((a, l) => a + coLineAmount(l), 0)
  const priorApproved = approvedCoTotal(others.filter((o) => o.id !== co.id))
  const original = num(project.original_contract)
  const setC = (k, v) => { setCo({ ...co, [k]: v }); setDirty(true) }
  const setL = (i, k, v) => { const n = lines.slice(); n[i] = { ...n[i], [k]: v }; setLines(n); setDirty(true) }
  const addLine = () => { setLines([...lines, { _new: true, description: '', labor: 0, material: 0, equipment: 0, subcontract: 0, other: 0, markup_percent: lines.at(-1)?.markup_percent ?? 15 }]); setDirty(true) }
  const delLine = (i) => { const l = lines[i]; if (!l._new) setRemoved([...removed, l.id]); setLines(lines.filter((_, j) => j !== i)); setDirty(true) }

  async function save(patch = {}) {
    setBusy(true); setMsg('')
    const { error } = await supabase.from('cp_change_orders').update({
      title: (co.title || '').trim() || 'Untitled change', description: co.description || null, reason: co.reason || null,
      owner_reference: co.owner_reference || null, days_added: Math.round(num(co.days_added)), amount: r2(total), ...patch,
    }).eq('id', co.id)
    if (error) { setBusy(false); setMsg(error.message); return false }
    if (editable) {
      if (removed.length) await supabase.from('cp_change_order_lines').delete().in('id', removed)
      for (const [i, l] of lines.entries()) {
        const row = { description: (l.description || '').trim() || 'Item', labor: r2(l.labor), material: r2(l.material), equipment: r2(l.equipment),
          subcontract: r2(l.subcontract), other: r2(l.other), markup_percent: num(l.markup_percent), sort_order: i + 1 }
        const { error: le } = l._new
          ? await supabase.from('cp_change_order_lines').insert({ ...row, org_id: co.org_id, change_order_id: co.id })
          : await supabase.from('cp_change_order_lines').update(row).eq('id', l.id)
        if (le) { setBusy(false); setMsg(le.message); return false }
      }
    }
    setBusy(false); await load(); return true
  }

  async function approve() {
    if (!(await save())) return
    setBusy(true)
    const { error } = await supabase.rpc('cp_approve_change_order', { p_co: co.id, p_approved_date: appr.date || today(), p_approved_by: appr.by })
    setBusy(false); setApproving(false)
    if (error) { setMsg(error.message); return }
    setMsg(`Approved. ${money(total)} added to the contract and to the schedule of values.`)
    load()
  }
  async function unapprove() {
    if (!window.confirm('Unapprove this change order? Its lines come off the schedule of values and the contract sum goes back down.')) return
    setBusy(true)
    const { error } = await supabase.rpc('cp_unapprove_change_order', { p_co: co.id })
    setBusy(false)
    if (error) setMsg(/does not exist|Could not find the function/i.test(error.message) ? 'Unapprove is not switched on yet: the database step for it still needs to be run in Supabase.' : error.message)
    else { setMsg('Unapproved. It is back to "Sent for approval".'); load() }
  }
  async function setStatus(status, extra = {}) {
    if (status === 'sent' && !(await save({ status, sent_date: co.sent_date || today(), ...extra }))) return
    if (status !== 'sent') { setBusy(true); await supabase.from('cp_change_orders').update({ status, ...extra }).eq('id', co.id); setBusy(false); load() }
  }
  async function del() {
    if (!window.confirm(`Delete change order #${co.co_number}?`)) return
    await supabase.from('cp_change_orders').delete().eq('id', co.id)
    navigate(`/commercial/projects/${project.id}`)
  }

  const site = project.properties
  const siteText = site ? `${site.street_address}${site.unit ? ' #' + site.unit : ''}, ${site.city || ''}${site.state ? ', ' + site.state : ''}` : ''
  const nIn = (i, k, w = 92) => <input type="number" step="0.01" value={lines[i][k] ?? 0} onChange={(e) => setL(i, k, e.target.value)} style={{ width: w, textAlign: 'right' }} disabled={!editable} />
  const cell = { textAlign: 'right', whiteSpace: 'nowrap' }
  const statusColor = { draft: 'var(--mist)', sent: '#9a6a12', approved: '#1F7A43', rejected: '#B00020', void: 'var(--mist)' }[co.status]

  return (
    <div>
      <style>{`@media print { body * { visibility: hidden !important; } .cp-print, .cp-print * { visibility: visible !important; }
        .cp-print { position: absolute; left: 0; top: 0; width: 100%; color: #000; } .cp-noprint { display: none !important; } }
        .cp-printonly { display: none; } @media print { .cp-printonly { display: block !important; } }`}</style>
      <div className="cp-noprint">
        <h2 className="page-title">Change Order #{co.co_number}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <Link to={`/commercial/projects/${project.id}`} className="logout-button" style={{ textDecoration: 'none', fontSize: 14 }}>← {project.name}</Link>
          <span style={{ fontWeight: 700, color: statusColor }}>{CO_STATUS[co.status]}{co.status === 'approved' ? ` ${fmtDate(co.approved_date)}${co.approved_by_name ? ' by ' + co.approved_by_name : ''}` : ''}</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="logout-button" onClick={() => window.print()}>Print / Save PDF</button>
            {co.status === 'draft' && <button className="logout-button" onClick={del} disabled={busy}>Delete</button>}
            {editable && <button className="logout-button" onClick={() => save()} disabled={busy || !dirty}>Save</button>}
            {co.status === 'draft' && <button className="logout-button" onClick={() => setStatus('sent')} disabled={busy}>Mark sent for approval</button>}
            {editable && <button className="logout-button" onClick={() => setStatus('rejected')} disabled={busy}>Rejected</button>}
            {editable && <button className="auth-button" style={{ width: 'auto', padding: '8px 18px' }} onClick={() => setApproving(true)} disabled={busy}>Approve</button>}
            {co.status === 'approved' && <button className="logout-button" onClick={unapprove} disabled={busy}>Unapprove</button>}
            {(co.status === 'rejected' || co.status === 'void') && <button className="logout-button" onClick={() => setStatus('draft')} disabled={busy}>Reopen as draft</button>}
            {co.status === 'rejected' && <button className="logout-button" onClick={() => setStatus('void')} disabled={busy}>Void</button>}
          </span>
        </div>
        {approving && (
          <div style={{ background: 'rgba(31,122,67,0.08)', border: '1px solid rgba(31,122,67,0.4)', borderRadius: 10, padding: 14, marginBottom: 14, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 100%', fontWeight: 700 }}>Approve change order #{co.co_number} for {money(total)}?</div>
            <div style={{ flex: '1 1 100%', fontSize: 14 }}>The contract sum becomes {money(original + priorApproved + total)} and {lines.length} line{lines.length === 1 ? '' : 's'} join the schedule of values so the work can be billed. Record the signed approval you received.</div>
            <div className="field" style={{ minWidth: 160 }}><label>Approved on</label><input type="date" value={appr.date} onChange={(e) => setAppr({ ...appr, date: e.target.value })} /></div>
            <div className="field" style={{ minWidth: 220 }}><label>Approved by (name)</label><input value={appr.by} onChange={(e) => setAppr({ ...appr, by: e.target.value })} placeholder="Owner or GC representative" /></div>
            <button className="auth-button" style={{ width: 'auto', padding: '8px 16px' }} onClick={approve} disabled={busy}>Yes, approve</button>
            <button className="logout-button" onClick={() => setApproving(false)}>Not yet</button>
          </div>
        )}
        {msg && <div style={{ margin: '0 0 12px', fontWeight: 600, color: /Approved|Unapproved/.test(msg) ? '#1F7A43' : '#B00020' }}>{msg}</div>}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div className="field" style={{ minWidth: 280, flex: '2 1 280px' }}><label>Title</label><input value={co.title || ''} onChange={(e) => setC('title', e.target.value)} disabled={!editable} /></div>
          <div className="field" style={{ minWidth: 200, flex: '1 1 200px' }}><label>Reason</label>
            <select value={co.reason || ''} onChange={(e) => setC('reason', e.target.value)} disabled={!editable}>
              <option value="">Choose…</option>{CO_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select></div>
          <div className="field" style={{ minWidth: 150 }}><label>Owner/GC CO #</label><input value={co.owner_reference || ''} onChange={(e) => setC('owner_reference', e.target.value)} disabled={!editable} /></div>
          <div className="field" style={{ minWidth: 120 }}><label>Days added</label><input type="number" value={co.days_added ?? 0} onChange={(e) => setC('days_added', e.target.value)} disabled={!editable} /></div>
          <div className="field" style={{ flex: '1 1 100%' }}><label>Scope of the change</label>
            <textarea rows={3} style={{ width: '100%' }} value={co.description || ''} onChange={(e) => setC('description', e.target.value)} disabled={!editable} placeholder="What is being added, removed, or changed, and why." /></div>
        </div>
        <p style={{ fontSize: 13, color: 'var(--mist)', margin: '0 0 8px' }}>Price each line from cost plus markup. Use negative numbers for work being removed (a deduct).</p>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: 1050 }}>
            <thead><tr><th>Description</th><th style={cell}>Labor</th><th style={cell}>Material</th><th style={cell}>Equipment</th><th style={cell}>Subcontract</th><th style={cell}>Other</th><th style={cell}>Markup %</th><th style={cell}>Amount</th><th></th></tr></thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.id || 'n' + i}>
                  <td><input value={l.description || ''} onChange={(e) => setL(i, 'description', e.target.value)} style={{ width: '100%', minWidth: 200 }} disabled={!editable} /></td>
                  <td style={cell}>{nIn(i, 'labor')}</td><td style={cell}>{nIn(i, 'material')}</td><td style={cell}>{nIn(i, 'equipment')}</td>
                  <td style={cell}>{nIn(i, 'subcontract')}</td><td style={cell}>{nIn(i, 'other')}</td><td style={cell}>{nIn(i, 'markup_percent', 64)}</td>
                  <td style={{ ...cell, fontWeight: 700 }}>{money(coLineAmount(l))}</td>
                  <td>{editable && <button className="logout-button" style={{ padding: '2px 10px', fontSize: 13 }} onClick={() => delLine(i)}>✕</button>}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 800 }}><td>Total change</td><td colSpan={6}></td><td style={cell}>{money(total)}</td><td></td></tr>
            </tbody>
          </table>
        </div>
        {editable && <button className="logout-button" style={{ marginTop: 10 }} onClick={addLine}>+ Add line</button>}
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '14px 0 6px', fontSize: 14 }}>
          <input type="checkbox" checked={showBreakdown} onChange={(e) => setShowBreakdown(e.target.checked)} /> Show the labor/material breakdown on the printout
        </label>
      </div>

      {/* Printable change order (also shown on screen as a preview) */}
      <div className="cp-print" style={{ background: 'var(--panel)', border: '1px solid var(--line-strong)', borderRadius: 10, padding: 18, marginTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div><div style={{ fontWeight: 800, fontSize: 18 }}>Change Order #{co.co_number}{co.status !== 'approved' ? ` — ${CO_STATUS[co.status].toUpperCase()}` : ''}</div>
            <div style={{ fontSize: 14 }}>{co.title}</div></div>
          <div style={{ fontSize: 13, textAlign: 'right' }}>{org?.name}{org?.business_phone ? <div>{org.business_phone}</div> : null}<div>Date: {fmtDate(co.sent_date || co.created_at?.slice(0, 10))}</div></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 6, fontSize: 13, margin: '12px 0' }}>
          <div>Project: <strong>{project.name}</strong> ({project.project_number})</div><div>Job site: {siteText || '—'}</div>
          <div>Owner: {project.owner_name || project.customers?.display_name || '—'}</div><div>General contractor: {project.gc_name || '—'}</div>
          <div>Contract #: {project.contract_number || '—'}</div><div>Owner/GC reference: {co.owner_reference || '—'}</div>
          <div>Reason: {co.reason || '—'}</div>
        </div>
        {co.description && <div style={{ fontSize: 14, whiteSpace: 'pre-wrap', margin: '0 0 12px' }}><strong>Scope:</strong> {co.description}</div>}
        <table className="data-table" style={{ width: '100%' }}>
          <thead><tr><th>Item</th>{showBreakdown && <><th style={cell}>Labor</th><th style={cell}>Material</th><th style={cell}>Equip.</th><th style={cell}>Sub</th><th style={cell}>Other</th><th style={cell}>Markup</th></>}<th style={cell}>Amount</th></tr></thead>
          <tbody>{lines.map((l, i) => (
            <tr key={'p' + i}><td>{l.description}</td>{showBreakdown && <><td style={cell}>{money(l.labor)}</td><td style={cell}>{money(l.material)}</td><td style={cell}>{money(l.equipment)}</td><td style={cell}>{money(l.subcontract)}</td><td style={cell}>{money(l.other)}</td><td style={cell}>{num(l.markup_percent)}%</td></>}<td style={cell}>{money(coLineAmount(l))}</td></tr>
          ))}</tbody>
        </table>
        <div style={{ maxWidth: 440, marginLeft: 'auto', marginTop: 12, fontSize: 14 }}>
          {[['Original contract sum', original], ['Net change by previously approved change orders', priorApproved], ['This change order', total], ['New contract sum including this change order', original + priorApproved + total]].map(([k, v], i) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--line-strong)', fontWeight: i === 3 ? 800 : 400 }}><span>{k}</span><span>{money(v)}</span></div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>Contract time change</span><span>{num(co.days_added) ? `${num(co.days_added) > 0 ? '+' : ''}${num(co.days_added)} days` : 'None'}</span></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24, marginTop: 36, fontSize: 13 }}>
          {['Contractor', 'General contractor', 'Owner'].map((who) => (
            <div key={who}><div style={{ borderTop: '1px solid #000', paddingTop: 4 }}>{who} — signature</div><div style={{ marginTop: 22, borderTop: '1px solid #000', paddingTop: 4 }}>Printed name and date</div></div>
          ))}
        </div>
      </div>
    </div>
  )
}
