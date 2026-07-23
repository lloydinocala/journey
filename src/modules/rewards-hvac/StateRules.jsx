// Rewards-HVAC · State Tax Rules — platform config for multi-state payroll.
// Super-admin edits per-state withholding type/rate, SUTA, min wage, pre-tax flags.
// Org admins see it read-only. No-tax & flat states compute accurately; progressive
// ("engine") states withhold 0 until brackets are configured or an engine is added.
import { useState, useEffect } from 'react'
import { listStateRules, upsertStateRule } from './stateTax'

const TYPES = ['none', 'flat', 'progressive', 'engine']

export default function StateRules({ profile }) {
  const isSuper = profile.role === 'super_admin'
  const [rows, setRows] = useState([])
  const [edited, setEdited] = useState({})
  const [savingState, setSavingState] = useState(null)
  const [msg, setMsg] = useState('')

  async function load() { setRows(await listStateRules()) }
  useEffect(() => { load() }, [])

  function setField(state, field, value) {
    setEdited((e) => ({ ...e, [state]: { ...(e[state] || {}), [field]: value } }))
  }
  function val(r, field) {
    const e = edited[r.state] || {}
    return e[field] !== undefined ? e[field] : r[field]
  }

  async function saveRow(r) {
    setSavingState(r.state); setMsg('')
    const e = edited[r.state] || {}
    const { error } = await upsertStateRule({
      state: r.state, effective_date: r.effective_date,
      income_tax_type: e.income_tax_type ?? r.income_tax_type,
      flat_rate: parseFloat(e.flat_rate ?? r.flat_rate) || 0,
      suta_wage_base: parseFloat(e.suta_wage_base ?? r.suta_wage_base) || 0,
      min_wage: e.min_wage != null ? parseFloat(e.min_wage) : r.min_wage,
      pretax_401k_exempt: e.pretax_401k_exempt ?? r.pretax_401k_exempt,
      pretax_125_exempt: e.pretax_125_exempt ?? r.pretax_125_exempt,
      daily_ot: r.daily_ot, notes: e.notes ?? r.notes,
    })
    setSavingState(null)
    if (error) { setMsg(error.message); return }
    setEdited((x) => { const n = { ...x }; delete n[r.state]; return n })
    setMsg(`Saved ${r.state}.`); load()
  }

  return (
    <div>
      <div className="page-header-bar"><h2>State Tax Rules</h2></div>
      <p style={{ color: 'var(--mist)', maxWidth: 780 }}>
        Per-state payroll config. Florida (and other no-tax states) need nothing here. <strong>Flat</strong>-tax states compute
        withholding as rate × taxable wages. <strong>Progressive / engine</strong> states withhold $0 with a flag until brackets
        are configured or a tax engine is integrated — the module never guesses a wrong number.
        {!isSuper && ' (Read-only — contact the platform owner to change rates.)'}
      </p>
      {msg && <div style={{ margin: '8px 0', color: msg.startsWith('Saved') ? '#166534' : '#B00020' }}>{msg}</div>}

      <table className="data-table">
        <thead><tr><th>State</th><th>Income tax</th><th>Flat rate %</th><th>SUTA base</th><th>Min wage</th><th>401k exempt</th><th>125 exempt</th>{isSuper && <th></th>}</tr></thead>
        <tbody>
          {rows.map((r) => {
            const type = val(r, 'income_tax_type')
            const dirty = !!edited[r.state]
            return (
              <tr key={r.state} style={dirty ? { background: '#FFFBEB' } : undefined}>
                <td style={{ fontWeight: 700 }}>{r.state}{r.daily_ot ? ' ⏱' : ''}</td>
                <td>{isSuper ? (
                  <select value={type} onChange={(e) => setField(r.state, 'income_tax_type', e.target.value)}>
                    {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                ) : type}</td>
                <td>{isSuper && type === 'flat' ? (
                  <input type="number" step="0.0001" style={{ width: 90 }} value={val(r, 'flat_rate')} onChange={(e) => setField(r.state, 'flat_rate', e.target.value)} />
                ) : (type === 'flat' ? (Number(r.flat_rate) * 100).toFixed(2) + '%' : '—')}</td>
                <td>{isSuper ? <input type="number" style={{ width: 90 }} value={val(r, 'suta_wage_base') || ''} onChange={(e) => setField(r.state, 'suta_wage_base', e.target.value)} /> : r.suta_wage_base}</td>
                <td>{isSuper ? <input type="number" step="0.01" style={{ width: 80 }} value={val(r, 'min_wage') || ''} onChange={(e) => setField(r.state, 'min_wage', e.target.value)} /> : (r.min_wage || '—')}</td>
                <td style={{ textAlign: 'center' }}><input type="checkbox" disabled={!isSuper} checked={!!val(r, 'pretax_401k_exempt')} onChange={(e) => setField(r.state, 'pretax_401k_exempt', e.target.checked)} /></td>
                <td style={{ textAlign: 'center' }}><input type="checkbox" disabled={!isSuper} checked={!!val(r, 'pretax_125_exempt')} onChange={(e) => setField(r.state, 'pretax_125_exempt', e.target.checked)} /></td>
                {isSuper && <td>{dirty && <button className="auth-button" style={{ width: 'auto', padding: '4px 12px', margin: 0 }} disabled={savingState === r.state} onClick={() => saveRow(r)}>Save</button>}</td>}
              </tr>
            )
          })}
        </tbody>
      </table>
      <p style={{ color: 'var(--mist)', fontSize: 12, marginTop: 10 }}>
        ⏱ = state has daily-overtime rules. Flat rates are seeded approximate — verify against the state DOR before running live
        payroll in that state. An employee's work state is set on their HR profile (defaults to the org's work state).
      </p>
    </div>
  )
}
