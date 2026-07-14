// Minimal, dependency-free CSV parser (RFC 4180-ish): handles quoted fields,
// embedded commas, embedded newlines inside quotes, and doubled-quote escaping.
export function parseCSV(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  let i = 0
  const len = text.length

  while (i < len) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += char
      i++
      continue
    }
    if (char === '"') {
      inQuotes = true
      i++
      continue
    }
    if (char === ',') {
      row.push(field)
      field = ''
      i++
      continue
    }
    if (char === '\r') {
      i++
      continue
    }
    if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i++
      continue
    }
    field += char
    i++
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  if (rows.length === 0) return { headers: [], rows: [] }
  const headers = rows[0].map((h) => h.trim())
  const dataRows = rows.slice(1).filter((r) => r.some((c) => c.trim() !== ''))
  return {
    headers,
    rows: dataRows.map((r) => {
      const obj = {}
      headers.forEach((h, idx) => {
        obj[h] = (r[idx] || '').trim()
      })
      return obj
    }),
  }
}

export function guessColumn(headers, fieldKey, fieldLabel) {
  const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const targets = [normalize(fieldKey), normalize(fieldLabel)]
  return headers.find((h) => targets.includes(normalize(h))) || ''
}
