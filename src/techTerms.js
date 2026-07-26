// Field-app terms shown on the mobile consent gate. Bump TERMS_VERSION whenever
// the wording changes — everyone will be prompted to re-accept, and each
// acceptance is recorded separately for the audit trail.
export const TERMS_VERSION = '2026-07-26'

export const TERMS = [
  {
    title: 'Messages are recorded',
    body: 'Text messages you send or receive through the app about a job are archived to the office and are part of the company record — they are not private.',
  },
  {
    title: 'Location is tracked',
    body: "While you are signed in, this device's GPS location is tracked at all times, for routing, safety, and job verification.",
  },
  {
    title: 'Acceptance is required to work',
    body: 'If you decline these conditions, you will not be able to view or work any jobs.',
  },
]
