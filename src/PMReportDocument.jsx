// Customer-facing Preventive Maintenance report. Renders the completed checklist(s) for a job
// in plain language: a pass/attention summary, measured values WITH last-visit trend, and any
// items needing attention. Shown above the recommended-work estimate on the public page.
export default function PMReportDocument({ report, org, property, customer }) {
  if (!report || !report.units || !report.units.length) return null
  const brand = org?.brand_primary_color || '#1F3A5F'
  const addr = property ? [property.street_address, property.city, property.state].filter(Boolean).join(', ') : ''

  return (
    <div style={{ maxWidth: 800, margin: '0 auto 24px', background: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.10)' }}>
      <div style={{ background: brand, color: 'white', padding: '20px 28px' }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Preventive Maintenance Report</div>
        <div style={{ fontSize: 13, opacity: 0.9, marginTop: 3 }}>{org?.name}{addr ? ` · ${addr}` : ''}</div>
      </div>

      <div style={{ padding: '20px 28px' }}>
        {customer?.display_name && (
          <div style={{ fontSize: 14, marginBottom: 16 }}>Prepared for <strong>{customer.display_name}</strong></div>
        )}
        {report.units.map((u) => <UnitBlock key={u.id} unit={u} brand={brand} />)}
        <p style={{ fontSize: 11.5, color: '#8A93A6', marginTop: 16, borderTop: '1px solid #EEF1F6', paddingTop: 12, lineHeight: 1.5 }}>
          Measured values are recorded on every visit so you can see how your system trends over time. This report reflects the inspection performed and is not a warranty. Any recommended work appears below.
        </p>
      </div>
    </div>
  )
}

function UnitBlock({ unit, brand }) {
  const results = unit.results || []
  const measures = results.filter((r) => r.item_type === 'measure' && r.value_recorded && r.value_recorded !== '')
  const fails = results.filter((r) => r.result === 'fail')
  const checked = results.filter((r) => r.result || (r.value_recorded && r.value_recorded !== '')).length
  const completed = unit.completed_at ? new Date(unit.completed_at).toLocaleDateString() : ''

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: brand }}>{unit.equipment}</div>
      <div style={{ fontSize: 12.5, color: '#64748B', marginBottom: 10 }}>
        {unit.template_name}{completed ? ` · ${completed}` : ''} · {checked} checks performed
      </div>

      <div style={{ fontSize: 14, marginBottom: 14, padding: '9px 13px', borderRadius: 8, fontWeight: 600,
        background: fails.length ? '#FBE9E7' : '#E8F5EC', color: fails.length ? '#B0281A' : '#1F7A43' }}>
        {fails.length ? `${fails.length} item${fails.length > 1 ? 's' : ''} need attention` : 'All checks passed — your system is operating normally'}
      </div>

      {measures.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 5 }}>Measurements &amp; trends</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: '#64748B' }}>
                <th style={{ padding: '4px 6px', fontWeight: 600, textAlign: 'left' }}>Check</th>
                <th style={{ padding: '4px 6px', fontWeight: 600, textAlign: 'right' }}>This visit</th>
                <th style={{ padding: '4px 6px', fontWeight: 600, textAlign: 'right' }}>Last visit</th>
              </tr>
            </thead>
            <tbody>
              {measures.map((m, i) => {
                const prior = unit.prior?.[m.item_text]
                return (
                  <tr key={i} style={{ borderTop: '1px solid #EEF1F6' }}>
                    <td style={{ padding: '6px' }}>{m.item_text}</td>
                    <td style={{ padding: '6px', textAlign: 'right', fontWeight: 600 }}>{m.value_recorded}</td>
                    <td style={{ padding: '6px', textAlign: 'right', color: '#8A93A6' }}>{prior ? prior.value : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {fails.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 5 }}>Items needing attention</div>
          {fails.map((f, i) => (
            <div key={i} style={{ fontSize: 13, padding: '4px 0', lineHeight: 1.4 }}>
              <span style={{ color: '#B0281A', fontWeight: 700 }}>•</span> {f.item_text}
              {f.notes ? <span style={{ color: '#64748B' }}> — {f.notes}</span> : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
