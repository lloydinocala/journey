// Rewards-HVAC · Worker Classification checker (1099 vs W-2)
// Guided IRS common-law control test. Misclassification is the #1 construction
// audit trigger — this flags risky 1099 relationships before they cost you.
import { useState, useEffect } from 'react'
import { CLASSIFICATION_QUESTIONS, scoreClassification, saveClassification, listClassifications } from './taxCenterData'
import { useOrgSelector, OrgBar, FlagChip } from './shared'

const RISK_TEXT = {
  likely_w2: 'Strongly points to EMPLOYEE (W-2). Paying this worker as a 1099 is high audit risk — you likely owe W-2 treatment, payroll taxes, and withholding.',
  review: 'Mixed signals. Some employee-like control exists. Document your reasoning and consider a Form SS-8 determination or professional review.',
  likely_1099: 'Consistent with an INDEPENDENT CONTRACTOR (1099-NEC). Keep a signed contract, their insurance certificate, and invoices on file.',
}

export default function ClassificationCheck({ profile }) {
  const org = useOrgSelector(profile)
  const [workerName, setWorkerName] = useState('')
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!org.selectedOrg) return
    setHistory(await listClassifications(org.selectedOrg))
  }
  useEffect(() => { load() }, [org.selectedOrg])

  const answered = CLASSIFICATION_QUESTIONS.filter((q) => answers[q.key] !== undefined).length
  const live = scoreClassification(answers)

  async function save() {
    if (!workerName.trim()) return
    setSaving(true)
    const sc = scoreClassification(answers)
    await saveClassification(org.selectedOrg, {
      worker_name: workerName.trim(), answers, employee_score: sc.employee_score, risk: sc.risk, determination: sc.determination,
    })
    setSaving(false); setResult(sc); setWorkerName(''); setAnswers({}); load()
  }

  return (
    <div>
      <div className="page-header-bar"><h2>Worker Classification</h2></div>
      <OrgBar {...org} />
      <p style={{ color: 'var(--mist)', maxWidth: 760 }}>
        Answer for the worker in question. Each "Yes" indicates employer control, pointing toward W-2 employee status.
        This is guidance based on the IRS common-law test — not a legal determination.
      </p>

      <div className="field" style={{ maxWidth: 340, margin: '10px 0 16px' }}>
        <label>Worker name</label>
        <input value={workerName} onChange={(e) => setWorkerName(e.target.value)} placeholder="e.g. Jim's Welding / John Smith" />
      </div>

      {['Behavioral', 'Financial', 'Relationship'].map((cat) => (
        <div key={cat} style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{cat} control</div>
          {CLASSIFICATION_QUESTIONS.filter((q) => q.cat === cat).map((q) => (
            <div key={q.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 280 }}>{q.text}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="logout-button" style={answers[q.key] === true ? { background: '#1B3A6B', color: '#fff' } : undefined} onClick={() => setAnswers({ ...answers, [q.key]: true })}>Yes</button>
                <button className="logout-button" style={answers[q.key] === false ? { background: '#64748B', color: '#fff' } : undefined} onClick={() => setAnswers({ ...answers, [q.key]: false })}>No</button>
              </div>
            </div>
          ))}
        </div>
      ))}

      <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16, maxWidth: 760, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <strong>Live read ({answered}/{CLASSIFICATION_QUESTIONS.length} answered):</strong>
          <FlagChip severity={live.risk === 'likely_1099' ? 'amber' : 'red'}>{live.determination.replace('_', '-').toUpperCase()}</FlagChip>
          <span style={{ color: 'var(--mist)' }}>{live.employee_score} employee-control signals</span>
        </div>
        <div style={{ fontSize: 13 }}>{RISK_TEXT[live.determination]}</div>
        <button className="auth-button" style={{ width: 'auto', marginTop: 12 }} disabled={saving || !workerName.trim() || answered === 0} onClick={save}>{saving ? 'Saving…' : 'Save assessment'}</button>
      </div>

      {result && <div style={{ color: '#166534', marginBottom: 16 }}>Saved. Determination: {result.determination.replace('_', '-')}.</div>}

      {history.length > 0 && (
        <>
          <h3>History</h3>
          <table className="data-table">
            <thead><tr><th>Date</th><th>Worker</th><th>Signals</th><th>Determination</th></tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>{new Date(h.created_at).toLocaleDateString()}</td>
                  <td>{h.worker_name}</td>
                  <td>{h.employee_score}/{CLASSIFICATION_QUESTIONS.length}</td>
                  <td>{(h.determination || '').replace('_', '-')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
