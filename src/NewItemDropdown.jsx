import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// Every menu item this dropdown can show, keyed so a caller can restrict/reorder
// them via the optional `items` prop. Default (no prop) = the full app-wide menu
// in its original order, so existing callers are unaffected.
// An item either emits a mode via onSelect, or navigates to a route itself.
const ITEMS = {
  job:            { label: 'New Job', mode: 'job' },
  task:           { label: 'New Task', mode: 'task' },
  todo:           { label: 'New To-Do Item', route: '/to-do' },
  segment:        { label: 'New Segment', mode: 'continueJob' },      // the continue-an-existing-job (add a segment) flow
  continueJob:    { label: 'Continue an Existing Job', mode: 'continueJob' },
  customer:       { label: 'New Customer', mode: 'customer' },
  property:       { label: 'New Property', mode: 'property' },
  estimate:       { label: 'New Estimate', mode: 'pickEstimateJob' },
  followupEstimate: { label: 'Follow-up Estimate', route: '/new-followup-estimate' },
  systemEstimate: { label: 'New System Estimate', route: '/new-system-estimate' },
  invoice:        { label: 'New Invoice', mode: 'pickInvoiceJob' },
}

const DEFAULT_ORDER = ['job', 'task', 'todo', 'continueJob', 'customer', 'property', 'estimate', 'followupEstimate', 'systemEstimate', 'invoice']

export default function NewItemDropdown({ onSelect, items }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const order = (Array.isArray(items) && items.length ? items : DEFAULT_ORDER).filter((k) => ITEMS[k])

  function pick(key) {
    const it = ITEMS[key]
    setOpen(false)
    if (it.route) navigate(it.route)
    else onSelect(it.mode)
  }

  return (
    <div className="org-picker-wrap" ref={wrapRef} style={{ width: 320 }}>
      <button className="auth-button" style={{ width: 'auto', padding: '10px 16px', margin: 0 }} onClick={() => setOpen((o) => !o)}>
        + New ▾
      </button>
      {open && (
        <div className="org-picker-list">
          {order.map((key) => (
            <div key={key} className="org-picker-item" onClick={() => pick(key)}>{ITEMS[key].label}</div>
          ))}
        </div>
      )}
    </div>
  )
}
