// Rewards-HVAC · hiring form definitions + printing.
// Three forms: Application (the applicant fills it — online or on paper), Screening (a short
// phone screen the office fills), Interview (structured, rated questions the interviewer
// fills). Every question is job-related on purpose: no age/date of birth, marital or family
// status, religion, national origin, health, or other protected information. Companies add
// their own questions (overall or per position) in Hiring → Manage questions.
import { supabase } from '../../utils/supabase'
import { printHrDocument } from './hrRecords'

export const FORM_LABEL = { application: 'Job Application', screening: 'Phone Screening', interview: 'Interview Evaluation' }

export const SCREENING_DEFAULTS = [
  { id: 's_interest', question: 'What interests you about this position and our company?', kind: 'text' },
  { id: 's_start', question: 'When could you start?', kind: 'text' },
  { id: 's_schedule', question: 'Are you able to work the schedule this position requires (including any on-call rotation)?', kind: 'yesno' },
  { id: 's_pay', question: 'Is the posted pay range acceptable to you?', kind: 'yesno' },
  { id: 's_license', question: 'Do you have a valid driver\'s license (required to drive a company vehicle)?', kind: 'yesno' },
  { id: 's_epa', question: 'EPA 608 certification — type held (or none)?', kind: 'text' },
  { id: 's_experience', question: 'Years of hands-on HVAC experience, and what kind (install, service, commercial, residential)?', kind: 'text' },
  { id: 's_duties', question: 'Can you perform the essential duties of this job, with or without reasonable accommodation?', kind: 'yesno' },
]

export const INTERVIEW_DEFAULTS = [
  { id: 'i_trouble', question: 'Walk me through how you would diagnose a system that is running but not cooling.', kind: 'rating' },
  { id: 'i_safety', question: 'Describe how you stay safe working with electrical, refrigerant, and in attics or on roofs.', kind: 'rating' },
  { id: 'i_customer', question: 'Tell me about a time you had to explain a repair or a "no repair needed" result to a customer.', kind: 'rating' },
  { id: 'i_honesty', question: 'What would you do if a customer asked for work their system doesn\'t actually need?', kind: 'rating' },
  { id: 'i_team', question: 'Describe working with a crew or helper on a difficult job. What made it go well or badly?', kind: 'rating' },
  { id: 'i_learning', question: 'How do you keep your skills current? What would you like to learn next?', kind: 'rating' },
]

// Merge company questions (overall + for this position) after the defaults.
export async function loadQuestions(orgId, formType, jobDescriptionId) {
  const { data } = await supabase.from('rewards_hiring_questions').select('*').eq('org_id', orgId).eq('form_type', formType).eq('active', true).order('sort')
  const custom = (data || []).filter((q) => !q.job_description_id || q.job_description_id === jobDescriptionId)
  const base = formType === 'screening' ? SCREENING_DEFAULTS : formType === 'interview' ? INTERVIEW_DEFAULTS : []
  return [...base, ...custom.map((q) => ({ id: q.id, question: q.question, kind: q.kind, required: q.required }))]
}

const yn = (v) => (v === 'yes' ? 'Yes' : v === 'no' ? 'No' : v || '')
const BLANK = '\n\n'

// Print a form — filled (answers given) or blank (answers null).
export function printHiringForm({ orgName, formType, applicant, positionTitle, answers, questions = [] }) {
  const a = answers || null
  const val = (v) => (a ? (v || '—') : BLANK)
  if (formType === 'application') {
    const emp = a?.employment?.length ? a.employment : [{}, {}, {}]
    printHrDocument({
      orgName, title: 'Job Application', subtitle: positionTitle ? `Position: ${positionTitle}` : undefined,
      rows: [
        ['Full name', a ? applicant?.name : ''], ['Phone', a ? applicant?.phone : ''], ['Email', a ? applicant?.email : ''],
        ['Address', a ? [a.address, a.city, a.zip].filter(Boolean).join(', ') : ''],
        ['Position applying for', positionTitle || ''], ['Available start date', a?.start_date || ''],
        ['Desired pay', a?.desired_pay || ''], ['Days / hours available', a?.availability || ''],
        ['Legally authorized to work in the U.S.?', a ? yn(a.work_authorized) : 'Yes ☐   No ☐'],
        ['Are you 18 or older?', a ? yn(a.over_18) : 'Yes ☐   No ☐'],
        ['Valid driver\'s license?', a ? yn(a.drivers_license) : 'Yes ☐   No ☐'],
        ['Years of HVAC experience', a?.experience_years || ''],
      ],
      sections: [
        ['Certifications & licenses (EPA 608, NATE, etc.)', val(a?.certifications)],
        ...emp.map((e, i) => [`Employment history ${i + 1}`, a
          ? [e.employer && `Employer: ${e.employer}`, e.title && `Title: ${e.title}`, (e.from || e.to) && `Dates: ${e.from || '?'} – ${e.to || 'present'}`, e.duties && `Duties: ${e.duties}`, e.reason && `Reason for leaving: ${e.reason}`, e.may_contact && `May we contact? ${yn(e.may_contact)}`].filter(Boolean).join('\n') || '—'
          : 'Employer: ______________________   Title: ______________________\nDates: ________ to ________   May we contact?  Yes ☐  No ☐\nDuties:\n\nReason for leaving:']),
        ['Education & training', val(a?.education)],
        ['References (name, relationship, phone)', val(a?.references)],
        ['Anything else you\'d like us to know?', val(a?.about)],
        ...questions.map((q) => [q.question, a ? (q.kind === 'yesno' ? yn(a.custom?.[q.id]) : (a.custom?.[q.id] || '—')) : (q.kind === 'yesno' ? 'Yes ☐   No ☐' : BLANK)]),
      ],
      ack: 'I certify that the information on this application is true and complete. I understand that false or missing information may disqualify me or lead to dismissal if discovered later, and that employment with this company is at will. This company is an equal opportunity employer and does not discriminate on the basis of race, color, religion, sex, national origin, age, disability, genetic information, or any other protected status.',
      signatures: a ? [] : ['Applicant signature'],
      footer: a?.certified_at ? `Submitted online ${new Date(a.certified_at).toLocaleString()}${a.ip ? ' from ' + a.ip : ''}; the applicant checked the certification above.` : 'Applications are kept 1 year after a hiring decision, as federal law requires, then securely deleted.',
    })
    return
  }
  // Screening / interview
  const isInterview = formType === 'interview'
  printHrDocument({
    orgName, title: FORM_LABEL[formType], subtitle: `${applicant?.name || ''}${positionTitle ? ' — ' + positionTitle : ''}`,
    rows: [['Candidate', applicant?.name || ''], ['Position', positionTitle || ''], ['Date', a?.date || ''], [isInterview ? 'Interviewer(s)' : 'Screened by', a?.by || '']],
    sections: [
      ...questions.map((q) => {
        const ans = a?.[q.id]
        if (!a) return [q.question, q.kind === 'yesno' ? 'Yes ☐   No ☐\nNotes:' : q.kind === 'rating' ? 'Rating:  1 ☐  2 ☐  3 ☐  4 ☐  5 ☐\nNotes:\n\n' : BLANK]
        if (q.kind === 'rating') return [q.question, `Rating: ${ans?.rating || '—'} of 5${ans?.notes ? '\nNotes: ' + ans.notes : ''}`]
        if (q.kind === 'yesno') return [q.question, `${yn(ans?.value ?? ans)}${ans?.notes ? ' — ' + ans.notes : ''}`]
        return [q.question, (ans?.value ?? ans) || '—']
      }),
      ['Overall notes', a ? (a.notes || '—') : BLANK],
      ['Recommendation', a ? ({ advance: 'Advance', hold: 'Hold', decline: 'Do not advance' }[a.recommendation] || '—') : 'Advance ☐   Hold ☐   Do not advance ☐'],
    ],
    signatures: a ? [] : [isInterview ? 'Interviewer signature' : 'Screener signature'],
    footer: 'Evaluate answers against the job requirements only. Notes must be job-related and factual — never about age, family, health, religion, national origin, or other protected characteristics.',
  })
}
