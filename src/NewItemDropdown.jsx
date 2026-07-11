import { useState, useRef, useEffect } from 'react'

export default function NewItemDropdown({ onSelect }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function choose(mode) {
    setOpen(false)
    onSelect(mode)
  }

  return (<div className="org-picker-wrap" ref={wrapRef} style={{ maxWidth: 320 }}>
    <div className="org-picker-wrap" ref={wrapRef} style={{ maxWidth: 320 }}>
      <button className="auth-button" style={{ width: 'auto', padding: '10px 16px', margin: 0 }} onClick={() => setOpen((o) => !o)}>
        + New ▾
      </button>
      {open && (
        <div className="org-picker-list">
          <div className="org-picker-item" onClick={() => choose('job')}>New Job</div>
          <div className="org-picker-item" onClick={() => choose('continueJob')}>Continue an Existing Job</div>
          <div className="org-picker-item" onClick={() => choose('customer')}>New Customer</div>
          <div className="org-picker-item" onClick={() => choose('property')}>New Property</div>
          <div className="org-picker-item" onClick={() => choose('pickEstimateJob')}>New Estimate</div>
<div className="org-picker-item" onClick={() => choose('pickInvoiceJob')}>New Invoice</div>
        </div>
      )}
    </div>
  )
}
