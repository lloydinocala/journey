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

// Supabase's REST API caps any single request at 1000 rows. Live search UIs
// sidestep this by never fetching the whole table (see CustomerSearchSelect).
// Bulk CSV import matching is different — it genuinely needs the complete set
// to match every row against, so it has to page through it instead.
// `buildQuery` must return a FRESH query builder each call (Supabase builders
// can only be awaited once), with .range() applied fresh per page.
export async function fetchAllRows(buildQuery, pageSize = 1000) {
  let allRows = []
  let from = 0
  while (true) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1)
    if (error) throw error
    allRows = allRows.concat(data || [])
    if (!data || data.length < pageSize) break
    from += pageSize
  }
  return allRows
}

// For MATCHING purposes only (never for what's actually stored/displayed) —
// treats "Ground Level", "ground level", and "Ground  Level" as the same
// value, so re-imports with inconsistent capitalization or spacing (common
// across years of hand-entered data) update the existing record instead of
// silently creating a duplicate.
export function normalizeForMatch(v) {
  return (v || '').toString().trim().toLowerCase().replace(/\s+/g, ' ')
}

// Excel on Windows commonly saves CSVs as Windows-1252 (aka CP1252), not
// UTF-8 — smart quotes, em-dashes, and accented characters all encode
// differently. The browser's default file-reading assumes UTF-8, so those
// bytes come through corrupted (usually replaced with a broken glyph)
// without ever raising an error. This tries strict UTF-8 first; if the file
// isn't actually valid UTF-8, it falls back to Windows-1252, which can
// decode any byte sequence, rather than silently mangling the text.
export async function readFileSmart(file) {
  const buffer = await file.arrayBuffer()
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    return new TextDecoder('windows-1252').decode(buffer)
  }
}

// parseFloat("$175.00") returns NaN, not 175 — dollar signs and thousand-
// separator commas are common in hand-formatted spreadsheet exports and need
// stripping before parsing, or the value silently becomes 0 instead of
// erroring or importing correctly.
export function normPrice(v) {
  const cleaned = (v || '').toString().replace(/[$,]/g, '').trim()
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : 0
}
