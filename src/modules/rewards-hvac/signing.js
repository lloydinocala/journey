// Shared helpers for electronically signed employee forms.
import { supabase } from '../../utils/supabase'
import { printHrDocument } from './hrRecords'

export const W4_PERJURY = 'Under penalties of perjury, I declare that this certificate, to the best of my knowledge and belief, is true, correct, and complete.'
const FILING = { single: 'Single or Married filing separately', married: 'Married filing jointly or Qualifying surviving spouse', hoh: 'Head of household' }
const money = (n) => '$' + (Number(n) || 0).toFixed(2)

export async function listSignedForms(orgId, { employeeId } = {}) {
  let q = supabase.from('rewards_signed_forms').select('*').eq('org_id', orgId).order('signed_at', { ascending: false })
  if (employeeId) q = q.eq('employee_id', employeeId)
  const { data } = await q
  return data || []
}
export async function listAckDocs(orgId, { includeInactive = false } = {}) {
  let q = supabase.from('rewards_ack_documents').select('*').eq('org_id', orgId).order('kind').order('title')
  if (!includeInactive) q = q.eq('active', true)
  const { data } = await q
  return data || []
}
// Has this employee signed the CURRENT version of an ack document?
export function hasSigned(signed, employeeId, doc) {
  return signed.some((s) => s.employee_id === employeeId && s.form_type === 'ack' && s.ack_document_id === doc.id && s.form_version === 'v' + doc.version)
}

// Printable signature certificate (the signed content + the audit trail).
export function printCertificate({ orgName, employeeName, form, ackDoc }) {
  const d = form.data || {}
  const audit = [
    ['Signed by (typed name)', form.signed_name], ['Employee', employeeName], ['Signed at', new Date(form.signed_at).toLocaleString()],
    ['IP address', form.ip || '—'], ['Device / browser', form.user_agent || '—'], ['Form version', form.form_version || '—'],
    ['Fingerprint (SHA-256)', form.data_hash],
  ]
  if (form.form_type === 'w4') {
    printHrDocument({
      orgName, title: 'Form W-4 — Employee\'s Withholding Certificate (electronic)', subtitle: employeeName,
      rows: [
        ['Name', `${d.first_name || ''} ${d.last_name || ''}`.trim()], ['Address', [d.address, d.city_state_zip].filter(Boolean).join(', ')],
        ['Step 1(c) Filing status', d.exempt ? 'Exempt claimed' : FILING[d.filing_status] || '—'],
        ['Step 2(c) Multiple jobs / spouse works', d.step2_checked ? 'Checked' : 'Not checked'],
        ['Step 3 Dependents', `${money(d.step3_children)} children + ${money(d.step3_other)} other = ${money(d.step3_total)}`],
        ['Step 4(a) Other income', money(d.step4a_other_income)], ['Step 4(b) Deductions', money(d.step4b_deductions)], ['Step 4(c) Extra withholding per pay period', money(d.step4c_extra)],
        ['Social Security number', 'On file with the employer (stored encrypted)'],
        ...audit,
      ],
      ack: 'Step 5 — Employee signature: ' + (d.statement || W4_PERJURY) + ' (Signed electronically.)',
      footer: 'Electronic W-4 signed in Journey. The fingerprint is a SHA-256 hash of the signed content, name and time — any change after signing would produce a different fingerprint.',
    })
    return
  }
  printHrDocument({
    orgName, title: 'Acknowledgment certificate', subtitle: `${d.title || ackDoc?.title || ''} — ${employeeName}`,
    rows: [['Document', d.title || ackDoc?.title], ['Version', d.version], ['Document text fingerprint', d.document_text_sha256], ...audit],
    sections: ackDoc?.body ? [['Document text', ackDoc.body]] : [],
    ack: d.statement,
    footer: 'Signed electronically in Journey (ESIGN Act). The fingerprints prove what was signed and that it hasn\'t changed.',
  })
}
