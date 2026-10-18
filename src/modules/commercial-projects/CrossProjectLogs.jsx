import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import OrgPicker from '../../OrgPicker'
import { useOrg, fmtDate } from './data'
import { SUBMITTAL_STATUS, RFI_STATUS, EQUIP_STATUS, submittalFlag, rfiFlag, equipmentFlag } from './logConfigs'

const label = (opts, v) => (opts.find((o) => o.value === v) || {}).label || v
const tone = { red: '#B00020', amber: '#9a6a12' }

function useRows(orgId, table, select) {
  const [rows, setRows] = useState(null)
  const load = useCallback(async () => {
    if (!orgId) { setRows([]); return }
    const { data } = await supabase.from(table).select(`${select}, cp_projects(id, name, project_number, status)`).eq('org_id', orgId)
    setRows((data || []).filter((r) => r.cp_projects?.status !== 'cancelled'))
  }, [orgId, table, select])
  useEffect(() => { load() }, [load])
  return rows
}

function Table({ rows, cols, flag, onOpen, empty }) {
  if (!rows) return <p style={{ color: 'var(--mist)' }}>Loading…</p>
  if (!rows.length) return <p style={{ color: 'var(--mist)' }}>{empty}</p>
  const sorted = rows.slice().sort((a, b) => (flag(b) ? (flag(b).tone === 'red' ? 2 : 1) : 0) - (flag(a) ? (flag(a).tone === 'red' ? 2 : 1) : 0))
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table" style={{ minWidth: 900 }}>
        <thead><tr><th>Project</th>{cols.map(([h]) => <th key={h}>{h}</th>)}<th>Attention</th></tr></thead>
        <tbody>{sorted.map((r) => {
          const f = flag(r)
          return (
            <tr key={r.id} onClick={() => onOpen(r)} style={{ cursor: 'pointer' }}>
              <td>{r.cp_projects?.name}</td>{cols.map(([h, fn]) => <td key={h}>{fn(r)}</td>)}
              <td style={{ color: f ? tone[f.tone] : 'inherit', fontWeight: f ? 600 : 400 }}>{f ? f.text : ''}</td>
            </tr>
          )
        })}</tbody>
      </table>
    </div>
  )
}

// Commercial Projects · Submittals & RFIs across every project.
export function SubmittalsRfis({ profile }) {
  const navigate = useNavigate()
  const { isSuper, orgs, orgId, setOrgId } = useOrg(profile)
  const [showClosed, setShowClosed] = useState(false)
  const subs = useRows(orgId, 'cp_submittals', 'id, number, revision, title, spec_section, submitted_to, status, sent_date, due_date')
  const rfis = useRows(orgId, 'cp_rfis', 'id, number, subject, asked_to, status, needed_by, cost_impact, schedule_impact, change_order_id')
  const open = (r) => navigate(`/commercial/projects/${r.cp_projects.id}?tab=subs`)
  const fs = (rows, closed) => (rows ? rows.filter((r) => showClosed || !closed.includes(r.status)) : null)
  return (
    <div>
      <h2 className="page-title">Submittals & RFIs</h2>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        {isSuper && <OrgPicker orgs={orgs} value={orgId} onChange={setOrgId} />}
        <label style={{ fontSize: 14, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />Show approved / closed</label>
      </div>
      <h3 style={{ fontSize: 16 }}>Submittals</h3>
      <Table rows={fs(subs, ['approved', 'approved_as_noted'])} flag={submittalFlag} onOpen={open} empty="No open submittals."
        cols={[['#', (r) => `${r.number}${r.revision ? '.' + r.revision : ''}`], ['Item', (r) => r.title], ['Spec', (r) => r.spec_section || '—'], ['To', (r) => r.submitted_to || '—'], ['Status', (r) => label(SUBMITTAL_STATUS, r.status)], ['Review due', (r) => fmtDate(r.due_date)]]} />
      <h3 style={{ fontSize: 16, marginTop: 26 }}>RFIs</h3>
      <Table rows={fs(rfis, ['closed'])} flag={rfiFlag} onOpen={open} empty="No open RFIs."
        cols={[['#', (r) => r.number], ['Subject', (r) => r.subject], ['Asked to', (r) => r.asked_to || '—'], ['Status', (r) => label(RFI_STATUS, r.status)], ['Needed by', (r) => fmtDate(r.needed_by)], ['Impact', (r) => [r.cost_impact && 'Cost', r.schedule_impact && 'Schedule'].filter(Boolean).join(', ') || '—']]} />
    </div>
  )
}

// Commercial Projects · Equipment & procurement across every project.
export function EquipmentProcurement({ profile }) {
  const navigate = useNavigate()
  const { isSuper, orgs, orgId, setOrgId } = useOrg(profile)
  const [showSet, setShowSet] = useState(false)
  const rows = useRows(orgId, 'cp_equipment', 'id, tag, description, model, status, lead_time_weeks, ordered_date, promised_ship_date, need_by_date, delivered_date, vendors(name)')
  const shown = rows ? rows.filter((r) => showSet || r.status !== 'set') : null
  return (
    <div>
      <h2 className="page-title">Equipment & Procurement</h2>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        {isSuper && <OrgPicker orgs={orgs} value={orgId} onChange={setOrgId} />}
        <label style={{ fontSize: 14, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={showSet} onChange={(e) => setShowSet(e.target.checked)} />Show equipment already set</label>
      </div>
      <p style={{ fontSize: 14, color: 'var(--mist)', marginTop: 0 }}>Every major unit on every project, late or at-risk items first. A unit turns red when its promised ship date runs past the date it's needed on site, or when it should already have been ordered.</p>
      <Table rows={shown} flag={equipmentFlag} onOpen={(r) => navigate(`/commercial/projects/${r.cp_projects.id}?tab=equip`)} empty="No equipment on open projects."
        cols={[['Tag', (r) => r.tag || '—'], ['Description', (r) => r.description], ['Vendor', (r) => r.vendors?.name || '—'], ['Status', (r) => label(EQUIP_STATUS, r.status)], ['Lead (wks)', (r) => r.lead_time_weeks ?? '—'], ['Promised ship', (r) => fmtDate(r.promised_ship_date)], ['Needed by', (r) => fmtDate(r.need_by_date)]]} />
    </div>
  )
}
