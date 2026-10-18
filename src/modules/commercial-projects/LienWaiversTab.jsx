import { useNavigate } from 'react-router-dom'
import { money, fmtDate, LIEN_DOC_LABEL, createLienDoc } from './data'

// Project workspace · Lien Waivers tab (Florida statutory forms).
export default function LienWaiversTab({ project, docs, apps }) {
  const navigate = useNavigate()
  const submitted = apps.filter((a) => a.status === 'submitted')
  const latest = submitted.at(-1) || null
  const finalApp = submitted.find((a) => a.is_final) || null
  async function make(type) {
    const app = type === 'progress_waiver' ? latest : (finalApp || null)
    const r = await createLienDoc(project, type, app)
    if (r.error) { alert(r.error); return }
    navigate(`/commercial/lien-documents/${r.id}`)
  }
  return (
    <div>
      <p style={{ fontSize: 14, color: 'var(--mist)', marginTop: 0 }}>Florida's statutory lien waivers and the contractor's final payment affidavit, filled in from this project. Progress waivers prefill from the latest submitted pay application.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <button className="logout-button" onClick={() => make('progress_waiver')}>+ Progress payment waiver{latest ? ` (app #${latest.app_number})` : ''}</button>
        <button className="logout-button" onClick={() => make('final_waiver')}>+ Final payment waiver</button>
        <button className="logout-button" onClick={() => make('final_affidavit')}>+ Final payment affidavit</button>
      </div>
      {docs.length === 0 ? <p style={{ color: 'var(--mist)' }}>No lien documents yet.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: 760 }}>
            <thead><tr><th>Document</th><th style={{ textAlign: 'right' }}>Amount</th><th>Through</th><th>Pay app</th><th>Status</th></tr></thead>
            <tbody>{docs.map((d) => {
              const app = apps.find((a) => a.id === d.pay_app_id)
              return (
                <tr key={d.id} onClick={() => navigate(`/commercial/lien-documents/${d.id}`)} style={{ cursor: 'pointer' }}>
                  <td>{LIEN_DOC_LABEL[d.doc_type]}{d.conditional_on_check ? <span className="badge" style={{ marginLeft: 6 }}>conditional</span> : null}</td>
                  <td style={{ textAlign: 'right' }}>{money(d.amount)}</td><td>{fmtDate(d.through_date)}</td>
                  <td>{app ? `#${app.app_number}` : '—'}</td>
                  <td>{d.status === 'delivered' ? <span style={{ color: '#1F7A43', fontWeight: 600 }}>Delivered {fmtDate(d.delivered_date)}</span> : d.status === 'void' ? 'Void' : 'Prepared'}</td>
                </tr>
              )
            })}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}
