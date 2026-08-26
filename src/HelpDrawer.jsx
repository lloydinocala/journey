import { useState, useEffect } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { HELP_ARTICLES, ROUTE_HELP, searchArticles } from './utils/HelpArticles'

// Floating "?" button + a right-side Help drawer. Works with zero AI (searchable docs) for users
// who aren't comfortable with AI yet; the "Ask AI" tab is the on-ramp for those who are.
export default function HelpDrawer() {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('docs') // 'docs' | 'ai'
  const [query, setQuery] = useState('')
  const [articleId, setArticleId] = useState(null)

  // On open, jump to the article that matches the current page (context-aware).
  useEffect(() => {
    if (!open) return
    const routeKey = Object.keys(ROUTE_HELP).find((k) => location.pathname.startsWith(k))
    setArticleId(routeKey ? ROUTE_HELP[routeKey] : null)
    setQuery('')
    setTab('docs')
  }, [open])

  const article = articleId ? HELP_ARTICLES.find((a) => a.id === articleId) : null
  const results = searchArticles(query)

  const brand = '#1F3A5F'

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} aria-label="Help"
          style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 900, width: 48, height: 48, borderRadius: 999,
            background: brand, color: '#fff', border: 'none', fontSize: 22, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(20,30,50,0.28)' }}>?</button>
      )}

      {open && <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.28)', zIndex: 950 }} />}

      <div style={{ position: 'fixed', top: 0, right: 0, height: '100vh', width: 'min(420px, 92vw)', background: '#fff', zIndex: 960,
        boxShadow: '-4px 0 24px rgba(20,30,50,0.18)', transform: open ? 'translateX(0)' : 'translateX(105%)',
        transition: 'transform 0.22s ease', display: 'flex', flexDirection: 'column' }}>

        {/* header */}
        <div style={{ background: brand, color: '#fff', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Help</span>
          <button onClick={() => setOpen(false)} aria-label="Close" style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {/* tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E7EBF0' }}>
          {[['docs', 'Browse & Search'], ['ai', 'Ask AI']].map(([k, lbl]) => (
            <button key={k} onClick={() => setTab(k)} style={{ flex: 1, padding: '10px 8px', border: 'none', cursor: 'pointer',
              background: tab === k ? '#fff' : '#F5F7FA', color: tab === k ? brand : '#64748B', fontWeight: tab === k ? 700 : 500,
              borderBottom: tab === k ? `2px solid ${brand}` : '2px solid transparent', fontSize: 13.5 }}>{lbl}</button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
          {tab === 'ai' ? (
            <div style={{ textAlign: 'center', color: '#64748B', paddingTop: 40 }}>
              <div style={{ fontSize: 30, marginBottom: 10 }}>✨</div>
              <div style={{ fontWeight: 700, color: '#1F2A37', marginBottom: 6 }}>Ask Journey anything — coming soon</div>
              <p style={{ fontSize: 13.5, lineHeight: 1.5, maxWidth: 300, margin: '0 auto' }}>
                You’ll be able to ask in plain English — “how do I send a system estimate?”, “which invoices should I chase first?” — and get an answer drawn from these same help docs and your live data. For now, browse or search the guides.
              </p>
            </div>
          ) : article ? (
            <div>
              <button onClick={() => setArticleId(null)} style={{ background: 'none', border: 'none', color: brand, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 12 }}>← All topics</button>
              <ArticleView article={article} brand={brand} />
            </div>
          ) : (
            <div>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search help…" autoFocus
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #D5DAE1', fontSize: 14, boxSizing: 'border-box', marginBottom: 14 }} />
              {results.length === 0 ? (
                <p style={{ color: '#64748B', fontSize: 13.5 }}>No help topics match “{query}”. Try a feature name like “estimate” or “dashboard”.</p>
              ) : results.map((a) => (
                <button key={a.id} onClick={() => setArticleId(a.id)} style={{ display: 'block', width: '100%', textAlign: 'left', background: '#F7F9FB',
                  border: '1px solid #E7EBF0', borderRadius: 10, padding: '11px 13px', marginBottom: 9, cursor: 'pointer' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#1F2A37' }}>{a.title}</div>
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{a.purpose}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function ArticleView({ article, brand }) {
  return (
    <div style={{ color: '#1F2A37' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#8A93A6', textTransform: 'uppercase', letterSpacing: 0.5 }}>{article.area}</div>
      <h3 style={{ margin: '2px 0 8px', fontSize: 18, color: brand }}>{article.title}</h3>
      <p style={{ fontSize: 13.5, lineHeight: 1.55, color: '#3B4757', marginTop: 0 }}>{article.purpose}</p>
      {article.sections.map((s, i) => (
        <div key={i} style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 6 }}>{s.h}</div>
          {s.body && <p style={{ fontSize: 13, lineHeight: 1.55, color: '#3B4757', margin: 0 }}>{s.body}</p>}
          {s.items && (
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              {s.items.map((it, j) => <li key={j} style={{ fontSize: 13, lineHeight: 1.5, color: '#3B4757', marginBottom: 4 }}>{it}</li>)}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}
