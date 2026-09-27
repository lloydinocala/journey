// Invoices · AI collections sequencing.
// Ranks the open balances so the office chases the right invoices first (biggest
// and oldest money), buckets them by age, and drafts a prioritized, escalating
// collections plan — friendly early, firmer as it ages, honest throughout.
// Read-only; it never sends anything (the per-invoice reminder does that).
import { useState, useMemo } from 'react'
import AiAssist from './AiAssist'

const money = (n) => (n == null || isNaN(n) ? '$0' : `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`)

const COLLECT_SYS = `You are a collections strategist for an HVAC contractor. You are given the open (unpaid) invoices with the customer, balance, and days outstanding. Produce a prioritized chase plan: whom to contact first (weigh both size and age — big and old money first), and for each, the right approach by age — a friendly reminder under 30 days, a firmer follow-up at 30-60, a direct call and clear terms at 60-90, and a final notice / escalation past 90. Keep it honest and professional, never aggressive or threatening. Be specific with names, balances, and days. Use ONLY the data given. Most urgent first, concise.`

const bucketOf = (d) => (d <= 30 ? '0–30' : d <= 60 ? '31–60' : d <= 90 ? '61–90' : '90+')
const bucketColor = (b) => (b === '0–30' ? { bg: '#E3F1E8', c: '#166534' } : b === '31–60' ? { bg: '#F8EEDD', c: '#B0600A' } : { bg: '#FBE7E7', c: '#B00020' })

export default function CollectionsSequencer({ invoices }) {
  const rows = useMemo(() => {
    const now = Date.now()
    return (invoices || [])
      .map((i) => {
        const balance = Number(i.balance || 0)
        const dt = i.invoice_date ? new Date(i.invoice_date + 'T12:00:00') : null
        const days = dt ? Math.max(0, Math.round((now - dt.getTime()) / 86400000)) : 0
        return { id: i.id, number: i.invoice_number, customer: i.customer, balance, days, bucket: bucketOf(days), score: balance * (1 + days / 30) }
      })
      .filter((r) => r.balance > 0.005)
      .sort((a, b) => b.score - a.score)
  }, [invoices])

  const totals = useMemo(() => {
    const t = { total: 0, over60: 0, count: rows.length }
    rows.forEach((r) => { t.total += r.balance; if (r.days > 60) t.over60 += r.balance })
    return t
  }, [rows])

  if (rows.length === 0) return null

  return (
    <div style={{ border: '1px solid #E2E8F0', background: '#FBFCFE', borderRadius: 10, padding: 12, margin: '4px 0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <strong style={{ color: '#132A4C', fontSize: 13.5 }}>Collections priority</strong>
        <span style={{ fontSize: 12.5, color: 'var(--mist)', marginLeft: 'auto' }}>
          {money(totals.total)} open · <span style={{ color: totals.over60 ? '#B00020' : 'var(--mist)', fontWeight: 600 }}>{money(totals.over60)} over 60 days</span>
        </span>
      </div>
      <p style={{ color: 'var(--mist)', fontSize: 12, margin: '6px 0 10px' }}>Ranked by size and age so you chase the right money first. It plans the sequence — you send with the reminder button.</p>

      <div style={{ marginBottom: 10 }}>
        <AiAssist inline title="Collections plan" label="✦ Sequence the collections"
          system={COLLECT_SYS}
          prompt="Give me a prioritized, escalating collections plan for these open invoices."
          context={{ open_invoices: rows.slice(0, 30).map((r) => ({ customer: r.customer, invoice: r.number, balance: Math.round(r.balance), days_outstanding: r.days })) }} />
      </div>

      <table className="data-table" style={{ fontSize: 12.5 }}>
        <thead><tr><th>#</th><th>Customer</th><th>Invoice</th><th style={{ textAlign: 'right' }}>Balance</th><th style={{ textAlign: 'right' }}>Age</th><th>Bucket</th></tr></thead>
        <tbody>
          {rows.slice(0, 15).map((r, i) => {
            const bc = bucketColor(r.bucket)
            return (
              <tr key={r.id}>
                <td style={{ color: 'var(--mist)' }}>{i + 1}</td>
                <td style={{ fontWeight: 600, color: '#152238' }}>{r.customer || '—'}</td>
                <td style={{ color: 'var(--mist)' }}>{r.number || '—'}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{money(r.balance)}</td>
                <td style={{ textAlign: 'right' }}>{r.days}d</td>
                <td><span className="badge" style={{ background: bc.bg, color: bc.c }}>{r.bucket}</span></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
