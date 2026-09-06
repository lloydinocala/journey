// Customer-friendly PM report rendered from a completed checklist run.
// Shows only items flagged Add-to-Report. Shared by the public page, portal, and profile.
export default function ChecklistReport({ data }) {
  const { run, job, org, property, customer, technicians, results } = data || {}
  const primary = org?.brand_primary_color || '#102A43'
  const reportItems = (results || [])  // customer sees every inspected item
  const redTags = reportItems.filter((r) => r.status === 'problem' && r.red_tag)

  const groups = []
  for (const r of reportItems) {
    let g = groups[groups.length - 1]
    if (!g || g.name !== r.section_name) { g = { name: r.section_name, rows: [] }; groups.push(g) }
    g.rows.push(r)
  }
  const statusView = (s) => s === 'ok' ? { t: 'Good', c: '#16A34A' } : s === 'problem' ? { t: 'Needs attention', c: '#C0392B' } : s === 'na' ? { t: 'N/A', c: '#6B7280' } : { t: 'Not checked', c: '#9CA3AF' }
  const addr = property ? [[property.street_address, property.unit].filter(Boolean).join(' '), property.city, [property.state, property.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ') : ''
  const dt = run?.completed_at ? new Date(run.completed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', background: '#fff', color: '#1a2733', fontFamily: 'Arial, Helvetica, sans-serif', padding: 28, borderRadius: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `3px solid ${primary}`, paddingBottom: 14, marginBottom: 18, gap: 16 }}>
        <div>
          {org?.logo_url ? <img src={org.logo_url} alt={org?.name} style={{ maxHeight: 56, maxWidth: 220 }} /> : <div style={{ fontSize: 22, fontWeight: 800, color: primary }}>{org?.name}</div>}
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 6, lineHeight: 1.5 }}>
            {[org?.business_street, [org?.business_city, org?.business_state, org?.business_zip].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}<br />
            {[org?.business_phone, org?.business_email].filter(Boolean).join(' · ')}{org?.license_number ? ` · Lic# ${org.license_number}` : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: primary }}>Maintenance Report</div>
          <div style={{ fontSize: 13, color: '#64748B' }}>{dt}</div>
          <div style={{ fontSize: 13, color: '#64748B' }}>{job?.job_number}{job?.segment > 1 ? `-${job.segment}` : ''}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 18, fontSize: 13.5, flexWrap: 'wrap' }}>
        <div><div style={{ fontSize: 11, textTransform: 'uppercase', color: '#94A3B8', fontWeight: 700 }}>Prepared for</div><div style={{ fontWeight: 700 }}>{customer?.display_name || 'Customer'}</div><div style={{ color: '#64748B' }}>{addr}</div></div>
        <div style={{ textAlign: 'right' }}><div style={{ fontSize: 11, textTransform: 'uppercase', color: '#94A3B8', fontWeight: 700 }}>Service</div><div style={{ fontWeight: 700 }}>{run?.checklist_name}</div>{technicians?.length > 0 && <div style={{ color: '#64748B' }}>Technician: {technicians.join(', ')}</div>}</div>
      </div>

      {redTags.length > 0 && (
        <div style={{ border: '1px solid #F5C6C6', background: '#FDECEC', borderRadius: 8, padding: '12px 14px', marginBottom: 18 }}>
          <div style={{ fontWeight: 800, color: '#B0342F', fontSize: 14 }}>⚠ Safety items needing immediate attention</div>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: '#7a1f1a', fontSize: 13 }}>{redTags.map((r, i) => <li key={i}>{r.inspection_task}</li>)}</ul>
        </div>
      )}

      {groups.map((g, gi) => (
        <div key={gi} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: primary, borderBottom: '1px solid #E2E8F0', paddingBottom: 5, marginBottom: 8 }}>{g.name}</div>
          {g.rows.map((r, ri) => {
            const sv = statusView(r.status)
            return (
              <div key={ri} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '1px solid #F1F5F9', fontSize: 13 }}>
                <div style={{ flex: 1 }}>
                  {r.inspection_task}
                  {r.item_type === 'measure' && r.value_recorded && <span style={{ color: '#334155' }}> — <b>{r.value_recorded}{r.record_units ? ` ${r.record_units}` : ''}</b>{r.spec_label ? ` (spec: ${r.spec_label})` : ''}</span>}
                  {r.notes && <div style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>{r.notes}</div>}
                </div>
                <div style={{ flex: '0 0 auto', fontWeight: 700, color: sv.c }}>{sv.t}</div>
              </div>
            )
          })}
        </div>
      ))}

      <div style={{ marginTop: 20, paddingTop: 12, borderTop: '1px solid #E2E8F0', fontSize: 11.5, color: '#94A3B8' }}>
        Thank you for choosing {org?.name || 'us'}. This report reflects the condition of the system at the time of service.
      </div>
    </div>
  )
}
