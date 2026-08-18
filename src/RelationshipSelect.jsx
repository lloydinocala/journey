const PRESET_RELS = ['Homeowner', 'Property Manager', 'Owner', 'Tenant']

// A relationship picker whose value IS the saved string. Presets save as-is;
// choosing "Other…" reveals a text box, and whatever is typed (e.g. "Security Guard",
// "Fire Chief") becomes the saved relationship. An unspecified Other saves as "Other".
export default function RelationshipSelect({ value, onChange, id, className }) {
  const v = value || ''
  const isPreset = PRESET_RELS.includes(v)
  const showOther = !!v && !isPreset // v is 'Other' or a custom term
  const selectValue = isPreset ? v : (v ? 'Other' : '')

  return (
    <>
      <select
        id={id}
        className={className}
        value={selectValue}
        onChange={(e) => onChange(e.target.value === 'Other' ? 'Other' : e.target.value)}
      >
        <option value="">&mdash;</option>
        {PRESET_RELS.map((r) => <option key={r} value={r}>{r}</option>)}
        <option value="Other">Other&hellip;</option>
      </select>
      {showOther && (
        <input
          type="text"
          value={v === 'Other' ? '' : v}
          onChange={(e) => onChange(e.target.value || 'Other')}
          placeholder="Specify (e.g. Security Guard, Fire Chief)"
          style={{ marginTop: 4, width: '100%' }}
        />
      )}
    </>
  )
}
