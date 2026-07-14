import { useState, useEffect, useMemo } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

const TOPIC_COLORS = {
  'App Usage': '#2F5DE3',
  'HVAC Technical': '#1F7A43',
  'Account/Access': '#B8720A',
  'Billing/Payment': '#7A3FB8',
  'Other': '#6B7785',
}

function dateKey(iso) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function ApolloLog({ profile }) {
  const isSuperAdmin = profile.role === 'super_admin'
  const isOrgAdmin = profile.role === 'org_admin'

  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const [searchText, setSearchText] = useState('')
  const [topicFilter, setTopicFilter] = useState('all')

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        if (!selectedOrg && data && data.length > 0) setSelectedOrg(data[0].id)
      })
    }
  }, [])

  async function loadRows(orgId) {
    if (!orgId) return
    setLoading(true)
    const { data } = await supabase
      .from('apollo_messages')
      .select('id, role, content, topic, created_at, user:users!apollo_messages_user_id_fkey(id, full_name, role)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true })
      .limit(5000)
    setRows(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadRows(selectedOrg)
  }, [selectedOrg])

  // Group into conversation blocks: one block per (employee, calendar day).
  const groups = useMemo(() => {
    const map = new Map()
    for (const r of rows) {
      const name = r.user?.full_name || 'Unknown'
      const day = dateKey(r.created_at)
      const key = name + '|' + day
      if (!map.has(key)) {
        map.set(key, { name, role: r.user?.role, day, sortTime: r.created_at, messages: [] })
      }
      map.get(key).messages.push(r)
    }
    return Array.from(map.values()).sort((a, b) => new Date(b.sortTime) - new Date(a.sortTime))
  }, [rows])

  const filteredGroups = groups
    .map((g) => {
      const messages = g.messages.filter((m) => {
        if (topicFilter !== 'all' && m.role === 'user' && m.topic !== topicFilter) return false
        return true
      })
      return { ...g, messages }
    })
    .filter((g) => {
      if (searchText && !g.name.toLowerCase().includes(searchText.toLowerCase())) return false
      if (topicFilter !== 'all' && !g.messages.some((m) => m.role === 'user' && m.topic === topicFilter)) return false
      return g.messages.length > 0
    })

  const topicCounts = useMemo(() => {
    const counts = {}
    for (const r of rows) {
      if (r.role !== 'user') continue
      const t = r.topic || 'Other'
      counts[t] = (counts[t] || 0) + 1
    }
    return counts
  }, [rows])

  const totalQuestions = Object.values(topicCounts).reduce((a, b) => a + b, 0)

  if (!isSuperAdmin && !isOrgAdmin) {
    return (
      <div>
        <h2 className="page-title">Apollo Conversation Log</h2>
        <p style={{ color: 'var(--mist)' }}>Only Admins can view this log.</p>
      </div>
    )
  }

  return (
    <div>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .apollo-log-group { break-inside: avoid; margin-bottom: 16px; }
          body { color: #000; }
          .screen-only { display: none !important; }
          .print-only { display: inline !important; }
        }
        .print-only { display: none; }
      `}</style>

      <h2 className="page-title">Apollo Conversation Log</h2>
      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: -8, marginBottom: 20 }}>
        Conversations are not private — this log is visible to Admins. Conversations older than 14 days are deleted automatically.
      </p>

      <div className="no-print">
        {isSuperAdmin && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>
              Viewing organization
            </label>
            <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
          </div>
        )}

        {/* Topic breakdown — scan for training/usage issues at a glance */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {Object.keys(TOPIC_COLORS).map((topic) => (
            <button
              key={topic}
              onClick={() => setTopicFilter(topicFilter === topic ? 'all' : topic)}
              className="stat-tile"
              style={{
                cursor: 'pointer',
                border: topicFilter === topic ? `2px solid ${TOPIC_COLORS[topic]}` : '2px solid transparent',
                textAlign: 'left',
              }}
            >
              <div className="stat-value" style={{ color: TOPIC_COLORS[topic] }}>{topicCounts[topic] || 0}</div>
              <div className="stat-label">{topic}</div>
            </button>
          ))}
          <div className="stat-tile" style={{ textAlign: 'left' }}>
            <div className="stat-value">{totalQuestions}</div>
            <div className="stat-label">Total questions</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ marginBottom: 0, minWidth: 220 }}>
            <label htmlFor="searchBox">Search by employee</label>
            <input
              id="searchBox"
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Name…"
            />
          </div>
          {topicFilter !== 'all' && (
            <button className="logout-button" style={{ marginBottom: 10 }} onClick={() => setTopicFilter('all')}>
              Clear topic filter ({topicFilter})
            </button>
          )}
          <button className="logout-button" style={{ marginBottom: 10 }} onClick={() => window.print()}>
            Print / Save as PDF
          </button>
          <p style={{ color: 'var(--mist)', fontSize: 14, margin: '0 0 12px' }}>
            {filteredGroups.length} conversation{filteredGroups.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : filteredGroups.length === 0 ? (
        <p style={{ color: 'var(--mist)' }}>No Apollo conversations match.</p>
      ) : (
        filteredGroups.map((g, i) => (
          <div key={i} className="apollo-log-group" style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <strong>
                <span className="screen-only">{g.name}{g.role ? ` (${g.role})` : ''}</span>
                <span className="print-only">Employee{g.role ? ` (${g.role})` : ''}</span>
              </strong>
              <span style={{ color: 'var(--mist)', fontSize: 13 }}>{g.day}</span>
            </div>
            {g.messages.map((m) => (
              <div key={m.id} style={{ marginBottom: 8, fontSize: 13.5 }}>
                <span style={{ fontWeight: 700, marginRight: 6 }}>
                  {m.role === 'user' ? (
                    <>
                      <span className="screen-only">{g.name.split(' ')[0] || 'User'}</span>
                      <span className="print-only">Employee</span>
                    </>
                  ) : 'Apollo'}:
                </span>
                <span>{m.content}</span>
                {m.role === 'user' && m.topic && (
                  <span
                    className="badge"
                    style={{ marginLeft: 8, background: TOPIC_COLORS[m.topic] || '#6B7785', color: '#fff', fontSize: 10 }}
                  >
                    {m.topic}
                  </span>
                )}
                <span style={{ marginLeft: 8, color: 'var(--mist)', fontSize: 11 }}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  )
}
