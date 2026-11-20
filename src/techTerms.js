// Field-app terms (App Use Terms) shown on the mobile consent gate. Bump TERMS_VERSION whenever
// the wording changes — everyone will be prompted to re-accept, and each
// acceptance is recorded separately for the audit trail.
export const TERMS_VERSION = '2026-11-19.2'

export const TERMS = [
  {
    title: 'Messages are recorded',
    body: 'Text messages you send or receive through the app about a job are archived to the office and are part of the company record — they are not private.',
  },
  {
    title: 'Location is tracked',
    body: "While you are signed in to Journey, this device's location is shared with your company at all times — on or off the clock, with the app open, in the background, closed, or after the phone restarts — for dispatch, routing, safety, and job verification. Signing out is the only way to stop it. If location sharing stops while you are signed in, you and the office are alerted and the event is recorded.",
  },
  {
    title: 'Keep location and notifications on',
    body: "While you are signed in, keep this device's location set to Always and Journey's notifications turned on. Turning off location or notifications, or otherwise blocking location sharing, while you are signed in is a violation of company policy and may result in disciplinary action, up to and including termination of employment. Each time location sharing stops, it is recorded along with the alerts sent to you.",
  },
  {
    title: 'Acceptance is required to work',
    body: 'If you decline these conditions, you will not be able to view or work any jobs.',
  },
  {
    title: 'Quincy conversations are not private',
    body: 'Questions you ask Quincy, the in-app assistant, may be reviewed by your company.',
  },
  {
    title: 'Customer information stays private',
    body: "Customer names, addresses, phone numbers, photos, and payment details are for doing the job only. Don't copy, share, or post them anywhere outside the app.",
  },
  {
    title: 'Honest work',
    body: 'Record what you actually find and do. Recommend only what the customer’s system needs, and never mark work done that wasn’t done.',
  },
  {
    title: 'Accurate time',
    body: 'Clock in and out only for time you actually work. Changes to your time are recorded.',
  },
  {
    title: 'Keep your sign-in to yourself',
    body: "Don't share your password or let anyone else use the app as you. Tell your supervisor right away if your phone is lost.",
  },
  {
    title: 'Safety recommendation',
    body: 'We recommend not using the app while driving. If you need it for navigation or to reach a customer, set it up before you pull out, use hands-free or voice features, or pull over somewhere safe first — and always follow traffic laws.',
  },
]
