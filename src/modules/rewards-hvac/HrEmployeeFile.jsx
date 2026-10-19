// Rewards-HVAC · Employee File — one page per employee that pulls together everything HR
// keeps on them: position, discipline, separations, scorecards, certifications and
// documents. Each item has a "Shared with employee" switch that decides whether it shows in
// the employee's own records (My Records). Medical / leave records do NOT belong here —
// they go in a separate confidential file.
import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import { listEmployees, updateEmployee, listJobDescriptions, listDiscipline, listSeparations, listCertifications, listDocuments, separationReasonLabel } from './hrData'
import { listMetrics, listEntries, listMetricPositions, applicableMetricIds, companyAverages, vsAverage, fmtValue, currentQuarter } from './scorecardData'
import { useOrgSelector, OrgBar } from './shared'
import { recordChange, orgName as getOrgName } from './hrRecords'
import { listSignedForms, printCertificate } from './signing'

const DISC_LABEL = { verbal: 'Verbal warning', written: 'Written warning', final: 'Final warning', suspension: 'Suspension', termination: 'Termination' }
const box = { border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16, background: '#fff' }
const h3 = { margin: '0 0 10px', fontSize: 15.5 }

function Share({ on, disabled, onChange }) {
  return (
    <label style={{ fontSize: 12.5, cursor: disabled ? 'default' : 'pointer', whiteSpace: 'nowrap' }} title="Shows this in the employee's own records">
      <input type="checkbox" checked={!!on} disabled={disabled} onChange={onChange} /> {on ? 'Shared' : 'Hidden'}
    </label>
  )
}

export default function HrEmployeeFile({ profile }) {
  const org = useOrgSelector(profile)
  const location = useLocation()
  const [employees, setEmployees] = useState([])
  const [empId, setEmpId] = useState(() => new URLSearchParams(window.location.search).get('emp') || '')
  const [jds, setJds] = useState([])
  const [d, setD] = useState(null)

  useEffect(() => {
    if (!org.selectedOrg) return
    Promise.all([listEmployees(org.selectedOrg, { includeInactive: true }), listJobDescriptions(org.selectedOrg)]).then(([e, j]) => {
      setEmployees(e); setJds(j)
      if (!empId && e[0]) setEmpId(e.find((x) => x.is_active)?.id || e[0].id)
    })
  }, [org.selectedOrg])
  useEffect(() => { const q = new URLSearchParams(location.search).get('emp'); if (q) setEmpId(q) }, [location.search])

  async function load() {
    if (!org.selectedOrg || !empId) return
    setD(null)
    const period = currentQuarter().label
    const [disc, seps, certs, docs, metrics, entries, positions, avgs] = await Promise.all([
      listDiscipline(org.selectedOrg, empId),
      listSeparations(org.selectedOrg).then((r) => r.filter((x) => x.employee_id === empId)),
      listCertifications(org.selectedOrg, { employeeId: empId }),
      listDocuments(org.selectedOrg, { employeeId: empId }),
      listMetrics(org.selectedOrg), listEntries(org.selectedOrg, empId), listMetricPositions(org.selectedOrg),
      companyAverages(org.selectedOrg, period),
    ])
    const [signed, appRes] = await Promise.all([listSignedForms(org.selectedOrg, { employeeId: empId }), supabase.from('rewards_applicants').select('id, name, applied_at').eq('hired_employee_id', empId)])
    setD({ signed, application: (appRes.data || [])[0] || null, disc: disc.filter((x) => (x.status || 'active') !== 'deleted'), seps: seps.filter((x) => (x.status || 'active') !== 'deleted'), certs, docs: docs.filter((x) => x.category !== 'medical'), metrics, entries, positions, avgs, period })
  }
  useEffect(() => { load() }, [org.selectedOrg, empId])

  const emp = employees.find((e) => e.id === empId)

  async function setPosition(jdId) {
    await updateEmployee(empId, { job_description_id: jdId || null })
    setEmployees((list) => list.map((e) => (e.id === empId ? { ...e, job_description_id: jdId || null } : e)))
    load()
  }
  async function share(table, recordType, row) {
    const v = !row.employee_visible
    if (recordType) await recordChange({ orgId: org.selectedOrg, table, recordType, row, patch: { employee_visible: v }, action: v ? 'share' : 'unshare' })
    else await supabase.from(table).update({ employee_visible: v }).eq('id', row.id)
    load()
  }

  const applicable = d && emp ? applicableMetricIds(d.positions, emp.job_description_id) : null
  const latest = d ? d.entries.filter((e) => e.period_label === d.period) : []

  return (
    <div>
      <div className="page-header-bar">
        <h2>Employee File</h2>
        <select value={empId} onChange={(e) => setEmpId(e.target.value)} style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 8, minWidth: 240 }}>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}{e.is_active ? '' : ' (inactive)'}</option>)}
        </select>
      </div>
      <OrgBar {...org} />
      <p style={{ color: 'var(--mist)', fontSize: 13.5, marginTop: -6 }}>
        Everything HR keeps on this person in one place. Switch an item to <b>Shared</b> to show it in the employee's own records (My Records). Medical, drug-test and leave (FMLA) records belong in a separate confidential file — not here.
      </p>

      {!emp ? <p style={{ color: 'var(--mist)' }}>No employees yet.</p> : !d ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : (
        <>
          <div style={box}>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div><div style={{ fontSize: 20, fontWeight: 800 }}>{emp.full_name}</div>
                <div style={{ fontSize: 13, color: 'var(--mist)' }}>{emp.is_active ? 'Active' : 'Inactive'}{emp.hire_date ? ` · hired ${emp.hire_date}` : ''}{emp.department ? ` · ${emp.department}` : ''}</div></div>
              <label style={{ fontSize: 13 }}>Position (job description)<br />
                <select value={emp.job_description_id || ''} onChange={(e) => setPosition(e.target.value)} style={{ padding: '6px 9px', border: '1px solid var(--border)', borderRadius: 8, minWidth: 220 }}>
                  <option value="">— not set —</option>
                  {jds.map((j) => <option key={j.id} value={j.id}>{j.title}{j.classification ? ` · ${j.classification}` : ''}</option>)}
                </select>
              </label>
              <Link to="/rewards/employees" style={{ fontSize: 13 }}>Employment &amp; tax details →</Link>
              <label style={{ fontSize: 13, cursor: 'pointer', color: emp.legal_hold ? '#7F1D1D' : undefined, fontWeight: emp.legal_hold ? 700 : 400 }} title={emp.legal_hold_reason || 'Stops automatic deletion of this person\'s records while a claim or charge is pending'}>
                <input type="checkbox" checked={!!emp.legal_hold} onChange={async (e) => {
                  const on = e.target.checked
                  const reason = on ? (window.prompt('Reason for the legal hold:') || '') : null
                  if (on && !reason) return
                  await updateEmployee(empId, { legal_hold: on, legal_hold_reason: reason })
                  setEmployees((l) => l.map((x) => (x.id === empId ? { ...x, legal_hold: on, legal_hold_reason: reason } : x)))
                }} /> Legal hold{emp.legal_hold && emp.legal_hold_reason ? ` — ${emp.legal_hold_reason}` : ''}
              </label>
            </div>
          </div>

          <div style={box}>
            <h3 style={h3}>Discipline <Link to="/rewards/discipline" style={{ fontSize: 12.5, fontWeight: 600, marginLeft: 8 }}>Open Discipline →</Link></h3>
            {!d.disc.length ? <div style={{ fontSize: 13, color: 'var(--mist)' }}>None on file.</div> : (
              <table className="data-table"><thead><tr><th>Date</th><th>Action</th><th>Incident</th><th>Status</th><th>Employee view</th></tr></thead><tbody>
                {d.disc.map((r) => (
                  <tr key={r.id}><td>{r.incident_date}</td><td>{DISC_LABEL[r.type] || r.type}</td><td>{r.incident || r.description || '—'}</td>
                    <td style={{ textTransform: 'capitalize' }}>{r.status || 'active'}</td>
                    <td><Share on={r.employee_visible} onChange={() => share('rewards_discipline', 'discipline', r)} /></td></tr>
                ))}
              </tbody></table>
            )}
          </div>

          <div style={box}>
            <h3 style={h3}>Separations <Link to="/rewards/separations" style={{ fontSize: 12.5, fontWeight: 600, marginLeft: 8 }}>Open Separations →</Link></h3>
            {!d.seps.length ? <div style={{ fontSize: 13, color: 'var(--mist)' }}>None on file.</div> : (
              <table className="data-table"><thead><tr><th>Effective</th><th>Type</th><th>Reason</th><th>Rehire</th><th>Status</th><th>Employee view</th></tr></thead><tbody>
                {d.seps.map((r) => (
                  <tr key={r.id}><td>{r.effective_date}</td><td style={{ textTransform: 'capitalize' }}>{r.separation_type}</td>
                    <td>{separationReasonLabel(r.reason || (r.reasons || [])[0] || '') || '—'}</td><td>{r.rehire_eligible ? 'Eligible' : 'Not eligible'}</td>
                    <td style={{ textTransform: 'capitalize' }}>{r.status || 'active'}{r.archived_at ? ' · archived' : ''}</td>
                    <td><Share on={r.employee_visible} onChange={() => share('rewards_separations', 'separation', r)} /></td></tr>
                ))}
              </tbody></table>
            )}
          </div>

          <div style={box}>
            <h3 style={h3}>Scorecard — {d.period} <Link to="/rewards/scorecards" style={{ fontSize: 12.5, fontWeight: 600, marginLeft: 8 }}>Open Scorecards →</Link></h3>
            <div style={{ fontSize: 12.5, color: 'var(--mist)', marginBottom: 8 }}>Compared with the company average for each measure — never with another individual. {applicable ? 'Measures that don\'t apply to this position are greyed out and not counted.' : 'All measures apply (no position-specific measures set).'} Scorecards always show in the employee's own records.</div>
            {!d.metrics.length ? <div style={{ fontSize: 13, color: 'var(--mist)' }}>Scorecards aren't set up.</div> : (
              <table className="data-table"><thead><tr><th>Measure</th><th>This quarter</th><th>Company average</th><th></th></tr></thead><tbody>
                {d.metrics.map((m) => {
                  const na = applicable && !applicable.has(m.id)
                  const v = latest.find((e) => e.metric_id === m.id)?.value
                  const a = d.avgs[m.id]?.avg
                  const cmp = na ? null : vsAverage(m, v, a)
                  return (
                    <tr key={m.id} style={{ opacity: na ? 0.4 : 1 }}>
                      <td>{m.name}{na ? ' · n/a for this position' : ''}</td>
                      <td>{na ? '—' : fmtValue(m.unit, v)}</td>
                      <td>{na ? '—' : fmtValue(m.unit, a)}</td>
                      <td style={{ fontWeight: 700, color: cmp === 'above' ? '#15803D' : cmp === 'below' ? '#B42318' : '#64748B' }}>{cmp === 'above' ? '▲ above average' : cmp === 'below' ? '▼ below average' : cmp === 'even' ? '= at average' : ''}</td>
                    </tr>
                  )
                })}
              </tbody></table>
            )}
          </div>

          <div style={box}>
            <h3 style={h3}>Certifications &amp; licenses <Link to="/rewards/certifications" style={{ fontSize: 12.5, fontWeight: 600, marginLeft: 8 }}>Open →</Link></h3>
            {!d.certs.length ? <div style={{ fontSize: 13, color: 'var(--mist)' }}>None on file.</div> : (
              <table className="data-table"><thead><tr><th>Certification</th><th>Number</th><th>Expires</th></tr></thead><tbody>
                {d.certs.map((c) => <tr key={c.id}><td>{c.label || c.cert_type}</td><td>{c.identifier || '—'}</td><td>{c.expires_date || '—'}</td></tr>)}
              </tbody></table>
            )}
            <div style={{ fontSize: 12, color: 'var(--mist)', marginTop: 6 }}>Certifications always show in the employee's own records.</div>
          </div>

          <div style={box}>
            <h3 style={h3}>Signed forms</h3>
            {!d.signed.length && !d.application ? <div style={{ fontSize: 13, color: 'var(--mist)' }}>None yet.</div> : (
              <table className="data-table"><tbody>
                {d.application && <tr><td>Job application</td><td>{new Date(d.application.applied_at).toLocaleDateString()}</td><td style={{ textAlign: 'right' }}><Link to={'/rewards/hiring?applicant=' + d.application.id}>Open</Link></td></tr>}
                {d.signed.map((s) => (
                  <tr key={s.id}><td>{s.form_type === 'w4' ? 'Form W-4' : (s.data?.title || 'Acknowledgment')} <span style={{ fontSize: 11.5, color: 'var(--mist)' }}>{s.form_version}</span></td><td>{new Date(s.signed_at).toLocaleString()}</td>
                    <td style={{ textAlign: 'right' }}><button className="logout-button" onClick={async () => printCertificate({ orgName: await getOrgName(org.selectedOrg), employeeName: emp.full_name, form: s })}>🖨 Certificate</button></td></tr>
                ))}
              </tbody></table>
            )}
            <div style={{ fontSize: 12, color: 'var(--mist)', marginTop: 6 }}>Employees always see their own signed forms.</div>
          </div>

          <div style={box}>
            <h3 style={h3}>Documents <Link to="/rewards/documents" style={{ fontSize: 12.5, fontWeight: 600, marginLeft: 8 }}>Open Documents →</Link></h3>
            {!d.docs.length ? <div style={{ fontSize: 13, color: 'var(--mist)' }}>None on file.</div> : (
              <table className="data-table"><thead><tr><th>Title</th><th>Category</th><th>Keep until</th><th>Employee view</th></tr></thead><tbody>
                {d.docs.map((x) => (
                  <tr key={x.id}><td>{x.title || x.file_name || '—'}</td><td style={{ textTransform: 'capitalize' }}>{(x.category || '').replace(/_/g, ' ')}</td><td>{x.retain_until || '—'}</td>
                    <td><Share on={x.employee_visible !== false} onChange={() => share('rewards_documents', null, { ...x, employee_visible: x.employee_visible !== false })} /></td></tr>
                ))}
              </tbody></table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
