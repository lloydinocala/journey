import Papa from 'papaparse'

export function exportToCSV(rows, columns, filename) {
  const data = rows.map((row) => {
    const record = {}
    columns.forEach((col) => {
      record[col.label] = typeof col.value === 'function' ? col.value(row) : row[col.key]
    })
    return record
  })

  const csv = Papa.unparse(data)
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
