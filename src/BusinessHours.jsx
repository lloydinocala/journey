import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'

const DAYS = [
  ['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'],
  ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday'],
]
const DEFAULT_DAY = { closed: false, open: '08:00', close: '17:00', extended: false }
const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const ORDINAL = { '1': '1st', '2': '2nd', '3': '3rd', '4': '4th', '5': '5th', '-1': 'last' }

const COMMON_HOLIDAYS = [
  { name: "New Year's Day", month: 1, day: 1 },
  { name: 'MLK Day', month: 1, week: 3, weekday: 1 },
  { name: "Presidents' Day", month: 2, week: 3, weekday: 1 },
  { name: 'Memorial Day', month: 5, week: -1, weekday: 1 },
  { name: 'Juneteenth', month: 6, day: 19 },
  { name: 'Independence Day', month: 7, day: 4 },
  { name: 'Labor Day', month: 9, week: 1, weekday: 1 },
  { name: 'Halloween', month: 10, day: 31 },
  { name: 'Veterans Day', month: 11, day: 11 },
  { name: 'Thanksgiving', month: 11, week: 4, weekday: 4 },
  { name: 'Day after Thanksgiving', month: 11, week: 4, weekday: 5 },
  { name: 'Christmas Eve', month: 12, day: 24 },
  { name: 'Christmas Day', month: 12, day: 25 },
  { name: "New Year's Eve", month: 12, day: 31 },
]

function holidayDate(h) {
  if (h.day) return `${MONTHS[h.month]} ${h.day}`
  return `${ORDINAL[String(h.week)] || h.week} ${WD[h.weekday]} of ${MONTHS[h.month]}`
}
function hm(t) { return t ? String(t).slice(0, 5) : '' }

export default function BusinessHours({ orgId }) {
  const [week, setWeek] = useState(null)
  const [holidays, setHolidays] = useState([])
  const [savingHours, setSavingHours] = useState(false)
  const [hoursSaved, setHoursSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [hName, setHName] = useState('')
  const [hMonth, setHMonth] = useState('12')
  const [hDay, setHDay] = useState('25')

  useEffect(() => { if (orgId) load() }, [orgId])

  async function load() {
    setLoading(true)
    const [{ data: org }, { data: hols }] = await Promise.all([
      supabase.from('organizations').select('business_hours, business_hours_start, business_hours_end').eq('id', orgId).single(),
      supabase.from('org_holidays').select('*').eq('org_id', orgId).order('month').order('day', { nullsFirst: true }),
    ])
    let bh = org && org.business_hours
    if (!bh || typeof bh !== 'object') {
      const open = hm(org && org.business_hours_start) || '08:00'
      const close = hm(org && org.business_hours_end) || '17:00'
      bh = {}
      DAYS.forEach(([k]) => { bh[k] = { closed: k === 'sun', open, close, extended: false } })
    }
    DAYS.forEach(([k]) => { if (!bh[k]) bh[k] = { ...DEFAULT_DAY } })
    setWeek(bh)
    setHolidays(hols || [])
    setLoading(false)
  }

  function setDay(k, patch) {
    setWeek((w) => ({ ...w, [k]: { ...w[k], ...patch } }))
    setHoursSaved(false)
  }

  async function saveHours() {
    setSavingHours(true); setHoursSaved(false)
    const openDays = DAYS.map(([k]) => week[k]).filter((d) => !d.closed)
    const start = openDays.length ? openDays.reduce((a, d) => (d.open < a ? d.open : a), '23:59') : '08:00'
    const end = openDays.length ? openDays.reduce((a, d) => (d.close > a ? d.close : a), '00:00') : '17:00'
    await supabase.from('organizations').update({ business_hours: week, business_hours_start: start, business_hours_end: end }).eq('id', orgId)
    setSavingHours(false); setHoursSaved(true)
  }

  async function addCommonHolidays() {
    const existing = new Set(holidays.map((h) => h.name.toLowerCase()))
    const toAdd = COMMON_HOLIDAYS.filter((h) => !existing.has(h.name.toLowerCase())).map((h) => ({
      org_id: orgId, name: h.name, month: h.month, day: h.day ?? null, week: h.week ?? null, weekday: h.weekday ?? null,
      is_closed: true, open_time: null, close_time: null, extended: false,
    }))
    if (toAdd.length) await supabase.from('org_holidays').insert(toAdd)
    load()
  }
  async function addHoliday() {
    if (!hName.trim()) return
    await supabase.from('org_holidays').insert({ org_id: orgId, name: hName.trim(), month: Number(hMonth), day: Number(hDay), is_closed: true, extended: false })
    setHName('')
    load()
  }
  async function updateHoliday(id, patch) {
    setHolidays((hs) => hs.map((h) => (h.id === id ? { ...h, ...patch } : h)))
    await supabase.from('org_holidays').update(patch).eq('id', id)
  }
  async function removeHoliday(id) {
    await supabase.from('org_holidays').delete().eq('id', id)
    setHolidays((hs) => hs.filter((h) => h.id !== id))
  }

  if (loading || !week) return <p style={{ color: 'var(--mist)' }}>Loading hours&hellip;</p>

  const cell = { display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--border,#eee)', flexWrap: 'wrap' }
  const chk = { display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, cursor: 'pointer' }

  return (
    <div style={{ marginBottom: 28 }}>
      <p style={{ color: 'var(--mist)', fontSize: 14, marginTop: -6, marginBottom: 16 }}>
        Set standard hours per day. &ldquo;Extended hours&rdquo; marks a day as available for after-hours / on-call service outside the standard window.
      </p>

      <div style={{ marginBottom: 14, maxWidth: 720 }}>
        {DAYS.map(([k, label]) => {
          const d = week[k]
          return (
            <div key={k} style={cell}>
              <div style={{ width: 88, fontWeight: 600 }}>{label}</div>
              <label style={chk}>
                <input type="checkbox" checked={!d.closed} onChange={(e) => setDay(k, { closed: !e.target.checked })} /> Open
              </label>
              {!d.closed ? (
                <>
                  <input type="time" value={d.open} onChange={(e) => setDay(k, { open: e.target.value })} style={{ width: 118 }} />
                  <span style={{ color: 'var(--mist)' }}>to</span>
                  <input type="time" value={d.close} onChange={(e) => setDay(k, { close: e.target.value })} style={{ width: 118 }} />
                  <label style={{ ...chk, marginLeft: 6 }}>
                    <input type="checkbox" checked={!!d.extended} onChange={(e) => setDay(k, { extended: e.target.checked })} /> Extended hours
                  </label>
                </>
              ) : (
                <span style={{ color: 'var(--mist)', fontSize: 13 }}>Closed</span>
              )}
            </div>
          )
        })}
      </div>
      <button className="auth-button" onClick={saveHours} disabled={savingHours} style={{ width: 'auto', padding: '8px 22px' }}>
        {savingHours ? 'Saving\u2026' : 'Save hours'}
      </button>
      {hoursSaved && <span style={{ color: '#4CD97B', fontSize: 14, marginLeft: 10 }}>Saved</span>}

      <h3 style={{ fontSize: 16, margin: '30px 0 6px' }}>Holidays</h3>
      <p style={{ color: 'var(--mist)', fontSize: 14, marginTop: 0, marginBottom: 14, maxWidth: 720 }}>
        Override your weekly hours on specific dates &mdash; close for the day or set custom hours, each with its own extended-hours choice.
      </p>

      {holidays.length === 0 ? (
        <p style={{ color: 'var(--mist)', fontSize: 14 }}>
          None yet.{' '}
          <button type="button" className="logout-button" onClick={addCommonHolidays}>Add common U.S. holidays</button>
        </p>
      ) : (
        <div style={{ maxWidth: 820 }}>
          {holidays.map((h) => (
            <div key={h.id} style={cell}>
              <div style={{ width: 168, fontWeight: 600 }}>{h.name}</div>
              <div style={{ width: 118, color: 'var(--mist)', fontSize: 13 }}>{holidayDate(h)}</div>
              <label style={chk}>
                <input type="checkbox" checked={!h.is_closed}
                  onChange={(e) => updateHoliday(h.id, { is_closed: !e.target.checked, open_time: h.open_time || '08:00', close_time: h.close_time || '17:00' })} /> Open
              </label>
              {!h.is_closed ? (
                <>
                  <input type="time" value={hm(h.open_time) || '08:00'} onChange={(e) => updateHoliday(h.id, { open_time: e.target.value })} style={{ width: 112 }} />
                  <span style={{ color: 'var(--mist)' }}>to</span>
                  <input type="time" value={hm(h.close_time) || '17:00'} onChange={(e) => updateHoliday(h.id, { close_time: e.target.value })} style={{ width: 112 }} />
                  <label style={{ ...chk, marginLeft: 6 }}>
                    <input type="checkbox" checked={!!h.extended} onChange={(e) => updateHoliday(h.id, { extended: e.target.checked })} /> Extended
                  </label>
                </>
              ) : (
                <span style={{ color: '#c0392b', fontSize: 13, fontWeight: 600 }}>Closed &mdash; no hours</span>
              )}
              <button type="button" className="logout-button" style={{ marginLeft: 'auto', fontSize: 11 }} onClick={() => removeHoliday(h.id)}>Remove</button>
            </div>
          ))}
          <button type="button" className="logout-button" style={{ marginTop: 10 }} onClick={addCommonHolidays}>+ Add any missing common holidays</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginTop: 16, flexWrap: 'wrap' }}>
        <div className="field" style={{ margin: 0 }}><label style={{ fontSize: 11 }}>Add a holiday</label><input value={hName} onChange={(e) => setHName(e.target.value)} placeholder="Holiday name" /></div>
        <div className="field" style={{ margin: 0 }}><label style={{ fontSize: 11 }}>Month</label>
          <select value={hMonth} onChange={(e) => setHMonth(e.target.value)}>
            {MONTHS.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}><label style={{ fontSize: 11 }}>Day</label><input type="number" min="1" max="31" value={hDay} onChange={(e) => setHDay(e.target.value)} style={{ width: 70 }} /></div>
        <button type="button" className="logout-button" onClick={addHoliday}>+ Add holiday</button>
      </div>
    </div>
  )
}
