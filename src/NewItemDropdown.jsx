import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from './utils/supabase'

// Every menu item this dropdown can show, keyed so a caller can restrict/reorder
// them via the optional `items` prop. Default (no prop) = the full app-wide menu
// in its original order, so existing callers are unaffected.
// An item either emits a mode via onSelect, or navigates to a route itself.
const ITEMS = {
  job:            { label: 'New Job', mode: 'job' },
  task:           { label: 'New Task', mode: 'task' },
  todo:           { label: 'New To-Do Item', route: '/to-do' },
  segment:        { label: 'New Segment', mode: 'continueJob' },      // the continue-an-existing-job (add a segment) flow
  continueJob:    { label: 'Add Segment', mode: 'continueJob' },
  customer:       { label: 'New Customer', mode: 'customer' },
  property:       { label: 'New Property', mode: 'property' },
  estimate:       { label: 'New Estimate', mode: 'pickEstimateJob' },
  followupEstimate: { label: 'Follow-up Estimate', route: '/new-followup-estimate' },
  systemEstimate: { label: 'New System Estimate', route: '/new-system-estimate' },
  invoice:        { label: 'New Invoice', mode: 'pickInvoiceJob' },
  filterOrder:    { label: 'New Filter Order', mode: 'filterOrder' },
}

const DEFAULT_ORDER = ['job', 'task', 'todo', 'continueJob', 'customer', 'property', 'estimate', 'followupEstimate', 'systemEstimate', 'invoice', 'filterOrder']

// Each user can choose which forms this menu shows, page by page ("Choose what's in this
// menu" at the bottom). Saved per user + page in user_menu_prefs; the page's own list is
// the default and the set of choices.
let _uid = null
async function currentUid() {
  if (_uid) return _uid
  const { data } = await supabase.auth.getUser()
  _uid = data?.user?.id || null
  return _uid
}

export default function NewItemDropdown({ onSelect, items }) {
  const [open, setOpen] = useState(false)
  const [customizing, setCustomizing] = useState(false)
  const [chosen, setChosen] = useState(null)   // saved item keys for this page (null = page default)
  const [draft, setDraft] = useState([])
  const wrapRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()
  const pageKey = '/' + ((location.pathname || '/').split('/')[1] || '')
  useEffect(() => { if (!open) setCustomizing(false) }, [open])

  useEffect(() => {
    let cancel = false
    ;(async () => {
      const uid = await currentUid()
      if (!uid) return
      const { data } = await supabase.from('user_menu_prefs').select('items').eq('user_id', uid).eq('page_key', pageKey).maybeSingle()
      if (!cancel) setChosen(data?.items || null)
    })()
    return () => { cancel = true }
  }, [pageKey])

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const available = (Array.isArray(items) && items.length ? items : DEFAULT_ORDER).filter((k) => ITEMS[k])
  const order = chosen ? available.filter((k) => chosen.includes(k)) : available

  function startCustomize() { setDraft(order); setCustomizing(true) }
  async function saveCustomize() {
    const uid = await currentUid()
    const keep = available.filter((k) => draft.includes(k))
    if (uid) await supabase.from('user_menu_prefs').upsert({ user_id: uid, page_key: pageKey, items: keep, updated_at: new Date().toISOString() })
    setChosen(keep); setCustomizing(false)
  }
  async function resetCustomize() {
    const uid = await currentUid()
    if (uid) await supabase.from('user_menu_prefs').delete().eq('user_id', uid).eq('page_key', pageKey)
    setChosen(null); setCustomizing(false)
  }

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
          {!customizing ? (<>
            {order.map((key) => (
              <div key={key} className="org-picker-item" onClick={() => pick(key)}>{ITEMS[key].label}</div>
            ))}
            {order.length === 0 && <div style={{ padding: '8px 12px', fontSize: 13, color: 'var(--mist)' }}>No forms chosen for this page.</div>}
            <div onClick={startCustomize} style={{ padding: '8px 12px', fontSize: 12.5, color: '#176E7A', cursor: 'pointer', borderTop: '1px solid var(--border)', fontWeight: 600 }}>⚙ Choose what’s in this menu</div>
          </>) : (
            <div style={{ padding: '8px 12px' }}>
              <div style={{ fontSize: 12, color: 'var(--mist)', marginBottom: 6 }}>Forms shown on this page (just for you):</div>
              {available.map((key) => (
                <label key={key} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5, padding: '3px 0', cursor: 'pointer' }}>
                  <input type="checkbox" checked={draft.includes(key)} onChange={(e) => setDraft((d) => e.target.checked ? [...d, key] : d.filter((k) => k !== key))} />
                  {ITEMS[key].label}
                </label>
              ))}
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button className="auth-button" style={{ width: 'auto', margin: 0, padding: '6px 12px' }} onClick={saveCustomize}>Save</button>
                <button className="logout-button" style={{ margin: 0 }} onClick={resetCustomize} title="Show this page's standard list again">Reset</button>
                <button className="logout-button" style={{ margin: 0 }} onClick={() => setCustomizing(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
