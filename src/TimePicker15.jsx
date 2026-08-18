// A hard 15-minute-only time picker. Value/onChange use "HH:MM" (24h) — the same
// format the native <input type="time"> used — so it's a drop-in replacement, but
// only :00/:15/:30/:45 are selectable on every device (native time wheels ignore step).
const SLOTS = []
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 15) {
    SLOTS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }
}

function to12h(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  const ap = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`
}

export default function TimePicker15({ value, onChange, id, className, required }) {
  const v = value || ''
  const offGrid = v && !SLOTS.includes(v) // preserve a legacy non-quarter-hour value so it still shows
  return (
    <select id={id} className={className} value={v} onChange={(e) => onChange(e.target.value)} required={required}>
      <option value="">&mdash;</option>
      {offGrid && <option value={v}>{to12h(v)}</option>}
      {SLOTS.map((s) => <option key={s} value={s}>{to12h(s)}</option>)}
    </select>
  )
}
