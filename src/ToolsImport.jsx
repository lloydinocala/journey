import { useState, useEffect } from 'react'
import Papa from 'papaparse'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import { fetchAllRows, normalizeForMatch, readFileSmart } from './utils/csvImport'
import OrgPicker from './OrgPicker'

function txt(v) { const t = (v ?? '').toString().trim(); return t === '' ? null : t }
function num(v) {
  const t = (v ?? '').toString().trim().replace(/[$,]/g, '')
  if (t === '') return null
  const n = parseFloat(t)
  return isNaN(n) ? null : n
}
function bool(v) {
  const t = (v ?? '').toString().trim().toLowerCase()
  return ['y', 'yes', 'true', '1', 'hand', 'hand tool'].includes(t)
}
function dateVal(v) {
  const t = (v ?? '').toString().trim()
  if (!t) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const d = new Date(t)
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

// Column headers the importer understands. Each row is a distinct physical tool
// (identical names auto-number as "Reclaimer 1", "Reclaimer 2"), so this importer
// only ever CREATES tools — it never updates or de-dupes.
const TEMPLATE_ROW = {
  Name: 'Reclaimer',
  Brand: 'Appion',
  'Hand Tool': 'no',
  'Model No.': 'G5TWIN',
  'Serial No.': 'A12345',
  'Purchase Date': '2026-01-15',
  Cost: '899.00',
  'Maintenance Requirements': 'Change oil every 10 uses',
}

export default function ToolsImport({ profile }) {
  const isSuperAdmin = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const orgId = selectedOrg
  const [importing, setImporting] = useState(false)
  const [summary, setSummary] = useState(null)
  const [failed, setFailed] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        if (!selectedOrg && data && data.length > 0) setSelectedOrg(data[0].id)
      })
    }
  }, [])

  function downloadTemplate() {
    const blob = new Blob([Papa.unparse([TEMPLATE_ROW])], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'tools-template.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file || !orgId) return
    setError(''); setSummary(null); setFailed([]); setImporting(true)
    try {
      const text = await readFileSmart(file)
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
      if (parsed.errors?.length) throw new Error(`CSV parse error: ${parsed.errors[0].message} (row ${parsed.errors[0].row})`)

      const rows = parsed.data
        .map((r) => {
          const hand = bool(r['Hand Tool'] ?? r['Hand tool'] ?? r.HandTool)
          return {
            name: txt(r.Name ?? r['Name / Description'] ?? r.Tool ?? r.Description),
            brand: txt(r.Brand),
            is_hand_tool: hand,
            model_no: hand ? null : txt(r['Model No.'] ?? r['Model No'] ?? r.Model),
            serial_no: hand ? null : txt(r['Serial No.'] ?? r['Serial No'] ?? r.Serial),
            purchase_date: dateVal(r['Purchase Date'] ?? r.Purchased),
            cost: num(r.Cost),
            maintenance_requirements: txt(r['Maintenance Requirements'] ?? r['Maintenance Notes'] ?? r.Notes),
          }
        })
        .filter((r) => r.name)

      if (rows.length === 0) throw new Error('No valid rows. Each row needs at least a Name.')

      // Seed the per-name instance counter from tools already on file, so imported
      // duplicates continue the numbering (e.g. an existing "Reclaimer 1" makes the
      // next import "Reclaimer 2").
      const existing = await fetchAllRows(() =>
        supabase.from('tools').select('name, instance_no').eq('org_id', orgId).is('deleted_at', null))
      const maxByName = new Map()
      for (const t of existing) {
        const k = normalizeForMatch(t.name)
        if ((t.instance_no || 0) > (maxByName.get(k) || 0)) maxByName.set(k, t.instance_no || 0)
      }

      const toInsert = rows.map((r) => {
        const k = normalizeForMatch(r.name)
        const next = (maxByName.get(k) || 0) + 1
        maxByName.set(k, next)
        return {
          org_id: orgId, name: r.name, brand: r.brand, is_hand_tool: r.is_hand_tool,
          model_no: r.model_no, serial_no: r.serial_no, instance_no: next,
          purchase_date: r.purchase_date, cost: r.cost,
          maintenance_requirements: r.maintenance_requirements,
          status: 'in_shop', holder_type: 'shop', holder_id: null,
        }
      })

      let created = 0
      const fails = []
      const createdIds = []
      for (let i = 0; i < toInsert.length; i += 300) {
        const batch = toInsert.slice(i, i + 300)
        const { data: ins, error: insErr } = await supabase.from('tools').insert(batch).select('id')
        if (!insErr) { created += batch.length; (ins || []).forEach((x) => createdIds.push(x.id)); continue }
        for (const row of batch) {
          const { data: one, error: rowErr } = await supabase.from('tools').insert(row).select('id').single()
          if (rowErr) fails.push({ Name: row.name, reason: rowErr.message })
          else { created++; if (one) createdIds.push(one.id) }
        }
      }

      // Open the initial "received by shop" assignment so each tool's history starts
      // here (best-effort; a failure here doesn't fail the import).
      if (createdIds.length) {
        const asg = createdIds.map((id) => ({ org_id: orgId, tool_id: id, holder_type: 'shop', holder_id: null, note: 'Received by shop (import)' }))
        for (let i = 0; i < asg.length; i += 300) {
          await supabase.from('tool_assignments').insert(asg.slice(i, i + 300))
        }
      }

      setSummary({ created, failed: fails.length, total: rows.length })
      setFailed(fails)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  function downloadFailed() {
    const blob = new Blob([Papa.unparse(failed)], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'tools-import-errors.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div>
      <h2 className="page-title">Import Tools</h2>
      <p style={{ color: 'var(--mist)', fontSize: 14, marginBottom: 16 }}>
        Bulk-load durable tools from a spreadsheet. Every row creates a new tool received into the shop —
        identical names auto-number (e.g. <b>Reclaimer 1</b>, <b>Reclaimer 2</b>). For hand tools, set
        <b> Hand Tool</b> to <i>yes</i> and leave Model/Serial blank. <Link to="/tools/catalog">← Back to Tool Catalog</Link>
      </p>

      {isSuperAdmin && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="logout-button" onClick={downloadTemplate}>Download template</button>
        <label className="auth-button" style={{ width: 'auto', padding: '9px 18px', cursor: 'pointer', display: 'inline-block' }}>
          {importing ? 'Importing…' : 'Choose CSV & Import'}
          <input type="file" accept=".csv,text/csv" onChange={handleFile} disabled={importing || !orgId} style={{ display: 'none' }} />
        </label>
      </div>

      <p style={{ fontSize: 13, color: 'var(--mist)' }}>
        Columns: <b>Name</b> (required), Brand, Hand Tool (yes/no), Model No., Serial No., Purchase Date, Cost, Maintenance Requirements.
        Each row is a distinct physical tool — the importer only creates, it never merges duplicates.
      </p>

      {error && <div className="auth-error" style={{ marginTop: 12 }}>{error}</div>}

      {summary && (
        <div style={{ marginTop: 18, padding: 16, border: '1px solid var(--border,#e2e4e8)', borderRadius: 10, maxWidth: 460 }}>
          <h3 style={{ marginTop: 0 }}>Import complete</h3>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div><div style={{ fontSize: 26, fontWeight: 700, color: '#1a7f37' }}>{summary.created}</div><div style={{ fontSize: 12, color: 'var(--mist)' }}>created</div></div>
            <div><div style={{ fontSize: 26, fontWeight: 700, color: summary.failed ? '#FF0000' : 'var(--mist)' }}>{summary.failed}</div><div style={{ fontSize: 12, color: 'var(--mist)' }}>failed</div></div>
          </div>
          {summary.failed > 0 && <button className="logout-button" style={{ marginTop: 12 }} onClick={downloadFailed}>Download failed rows</button>}
        </div>
      )}
    </div>
  )
}
