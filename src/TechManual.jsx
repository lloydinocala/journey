// Journey · Mobile · Supervisor — Field Manual
// A plain-language training + reference guide to the mobile app, readable in
// the field. Field supervisors + admins only (same gate as Cycle Counts); the
// route is gated too, so a non-supervisor who guesses the URL just sees a note.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isFieldAdmin } from './MobileNav'
import { IconChevronLeft } from './MobileIcons'

const useDark = () => {
  const [dark] = useState(() => { try { return localStorage.getItem('jc-theme') === 'dark' } catch { return false } })
  return dark
}

// The manual. Keep it plain and short — this is a field reference, not a spec.
const SECTIONS = [
  {
    h: 'Getting around',
    items: [
      'Your job list is the home screen — it opens when you sign in.',
      'Tap any job to open its job card. Tap the back arrow (‹) at the top left to go back a screen.',
      'As a supervisor you also see a Supervisor Tools row with extra actions — this manual is one of them.',
    ],
  },
  {
    h: 'Running a service call',
    items: [
      'Tap On My Way when you head to the site, so the office and customer know you are coming.',
      'Tap Start My Time when you begin work, Pause My Time for a break, and Stop My Time when you finish. Your time on the job is tracked for you.',
      'The Customer card has the address (tap for directions), the phone number (tap to call), and messaging — use Open Messages to text the customer.',
      'Start Here walks you through the visit. Service History shows past work at the property. Private Notes are internal — the customer never sees them.',
    ],
  },
  {
    h: 'Estimates & invoices',
    items: [
      'Build a job estimate or a system (equipment) estimate right from the job. Add your line items and any approved discounts, then present it to the customer.',
      'When the work is done, create an invoice for it.',
      'Use Collect Payment on the job to take payment in the field.',
    ],
  },
  {
    h: 'Maintenance checklists',
    items: [
      'On a maintenance visit, open the PM checklist and complete each item as you go.',
      'It saves as you work — there is nothing extra to press to keep your progress.',
    ],
  },
  {
    h: 'Ask Quincy',
    items: [
      'Tap Ask Quincy on a job or any of its screens to open Quincy without leaving your work — ask your question and your place is kept.',
      'From the home screen, Chat with Quincy opens the full Quincy screen. It is the same conversation either way.',
    ],
  },
  {
    h: 'Supervisor tools',
    items: [
      'Cycle Count — count stock on a truck or in a warehouse from your phone. Start a count, pick the location, and enter what you physically see (the expected number stays hidden so the count is honest). Then Reveal variances and Post to correct inventory. Posting is permanent — to fix a mistake, run another count.',
      'The Tower — a live overview of the team.',
      "Everyone's Schedule — see the whole team's day, not just your own.",
      'Create work on the fly — + New Job, + Service Estimate, + Follow-up Estimate, and + System Estimate.',
    ],
  },
  {
    h: 'Good to know',
    items: [
      'Anything shown in red means a problem or a negative number — stop and check it before moving on.',
      'Most screens save as you go, so you rarely need a Save button.',
      'If a screen looks stuck, tap the back arrow and open it again.',
    ],
  },
]

export default function TechManual({ profile }) {
  const navigate = useNavigate()
  const dark = useDark()
  const admin = isFieldAdmin(profile)
  const [open, setOpen] = useState(0) // first section open by default

  const shell = `mobile-shell job-card-v2${dark ? ' jc-dark' : ''}`

  // ---- Access gate --------------------------------------------------------
  if (!admin) {
    return (
      <div className={shell}>
        <div className="jc-header">
          <button className="jc-back" onClick={() => navigate('/tech')}><IconChevronLeft /></button>
          <div className="jc-header-text"><div className="jc-title">Field Manual</div></div>
        </div>
        <div className="jc-body"><p className="jc-muted-note" style={{ padding: 16 }}>The Field Manual is for field supervisors.</p></div>
      </div>
    )
  }

  return (
    <div className={shell}>
      <div className="jc-header">
        <button className="jc-back" onClick={() => navigate('/tech')}><IconChevronLeft /></button>
        <div className="jc-header-text">
          <div className="jc-title">Field Manual</div>
          <div className="jc-subtitle">How to use the mobile app</div>
        </div>
      </div>
      <div className="jc-body">
        <p className="jc-muted-note" style={{ marginTop: 0 }}>
          A quick guide to everything you do on your phone. Tap a section to open it.
        </p>

        {SECTIONS.map((sec, i) => {
          const isOpen = open === i
          return (
            <div key={i} className="jc-task" style={{ marginBottom: 10 }}>
              <button
                className="jc-task-head blue"
                onClick={() => setOpen(isOpen ? -1 : i)}
                style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }}
              >
                <span className="jc-th-title">{sec.h}</span>
                <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{isOpen ? '–' : '+'}</span>
              </button>
              {isOpen && (
                <div className="jc-task-body">
                  {sec.items.map((it, j) => (
                    <div key={j} style={{ display: 'flex', gap: 8, padding: '6px 0', color: '#152238', fontSize: 15, lineHeight: 1.45 }}>
                      <span style={{ color: 'var(--mist)', flex: '0 0 auto' }}>•</span>
                      <span>{it}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        <p className="jc-muted-note" style={{ marginTop: 14 }}>
          Stuck on something this guide doesn't cover? Tap Ask Quincy on any job.
        </p>
      </div>
    </div>
  )
}
