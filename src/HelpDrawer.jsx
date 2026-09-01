import { useState, useEffect } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import { HELP_ARTICLES, ROUTE_HELP } from './utils/HelpArticles'
import { FLEET_HELP_ARTICLES, FLEET_ROUTE_HELP } from './utils/HelpArticlesFleet'

// Core articles + the Fleet section, and their route maps, merged into one set.
// Fleet route keys are ordered specific-before-base within their file; spreading
// them after the core map preserves that order for the startsWith match.
const ALL_ARTICLES = [...HELP_ARTICLES, ...FLEET_HELP_ARTICLES]
const ALL_ROUTE_HELP = { ...ROUTE_HELP, ...FLEET_ROUTE_HELP }

const hay = (a) => [a.title, a.area, a.purpose, a.keywords.join(' '),
  a.sections.map((s) => [s.h, s.body || '', (s.items || []).join(' ')].join(' ')).join(' ')].join(' ').toLowerCase()
function searchAll(query) {
  const q = (query || '').trim().toLowerCase()
  if (!q) return ALL_ARTICLES
  return ALL_ARTICLES.filter((a) => q.split(/\s+/).every((w) => hay(a).includes(w)))
}

// Common words carry no topic signal — dropping them keeps ranking on the nouns
// that actually name a feature ("supplies", "estimate", "refrigerant").
const STOPWORDS = new Set(['how', 'do', 'does', 'did', 'the', 'and', 'for', 'you', 'your', 'with', 'what', 'where', 'when', 'why', 'who', 'can', 'get', 'got', 'are', 'was', 'this', 'that', 'from', 'into', 'out', 'not', 'but', 'has', 'have', 'had', 'will', 'would', 'should', 'could', 'about', 'set', 'use', 'using', 'add', 'see', 'view', 'find', 'need', 'want', 'make', 'new', 'app', 'page', 'screen', 'here', 'there', 'them', 'they', 'its', 'our'])

// Rank articles by how many of the question's meaningful words they touch — used to
// pick the handful of docs QuincyAI reads to answer, so the prompt stays small and
// on-topic. Prefix-matches so "raise" hits "raising", "invoices" hits "invoice".
function rankArticles(query, n = 6) {
  const words = (query || '').toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  if (!words.length) return []
  const hit = (h, w) => h.includes(w) || (w.length > 4 && h.includes(w.slice(0, w.length - 1)))
  return ALL_ARTICLES
    .map((a) => { const h = hay(a); return { a, score: words.reduce((s, w) => s + (hit(h, w) ? 1 : 0), 0) } })
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, n)
    .map((x) => x.a)
}

// Flatten an article to the compact text QuincyAI is given as context.
function articleToDoc(a) {
  return {
    title: a.title, area: a.area, purpose: a.purpose,
    details: a.sections.map((s) => [s.h, s.body || '', ...(s.items || [])].filter(Boolean).join(' — ')).join(' | '),
  }
}

const AI_SYSTEM = 'You are QuincyAI, the in-app help assistant for Journey, an HVAC field-service platform used by contractors. Answer the user\'s question using ONLY the provided help documentation about the app. Be concrete and practical: name the exact screen, tab, or button, and tell them where to go to do it. Keep it short — a few sentences or a short bulleted list. If the documentation provided does not cover the question, say so plainly and point them to the closest topic rather than guessing. Never invent features, prices, or steps that are not in the documentation.'

const AI_EXAMPLES = [
  'How do I send a system estimate?',
  'Where do I record a tool sent for repair?',
  'How does a covered refrigerant system get flagged?',
  'How do I raise a PO for supplies?',
]

// Floating "?" button + a right-side Help drawer. Works with zero AI (searchable docs) for users
// who aren't comfortable with AI yet; the "Ask AI" tab is the on-ramp for those who are.
export default function HelpDrawer() {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('docs') // 'docs' | 'ai'
  const [query, setQuery] = useState('')
  const [articleId, setArticleId] = useState(null)
  // Ask AI (QuincyAI) state.
  const [aiQ, setAiQ] = useState('')
  const [aiAnswer, setAiAnswer] = useState('')
  const [aiSources, setAiSources] = useState([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  // On open, jump to the article that matches the current page (context-aware).
  useEffect(() => {
    if (!open) return
    const routeKey = Object.keys(ALL_ROUTE_HELP).find((k) => location.pathname.startsWith(k))
    setArticleId(routeKey ? ALL_ROUTE_HELP[routeKey] : null)
    setQuery('')
    setTab('docs')
  }, [open])

  async function askQuincy(question) {
    const q = (question || '').trim()
    if (!q || aiLoading) return
    setAiQ(q); setAiLoading(true); setAiError(''); setAiAnswer(''); setAiSources([])
    const picked = rankArticles(q, 6)
    const docs = (picked.length ? picked : ALL_ARTICLES.slice(0, 4)).map(articleToDoc)
    try {
      const { data, error } = await supabase.functions.invoke('ai-assist', {
        body: { system: AI_SYSTEM, prompt: q, context: { question: q, helpDocs: docs } },
      })
      if (error || data?.error) {
        setAiError(data?.error || error?.message || 'QuincyAI could not answer right now — try Browse & Search.')
      } else {
        setAiAnswer((data?.text || '').trim())
        setAiSources(picked)
      }
    } catch (e) {
      setAiError('QuincyAI could not answer right now — try Browse & Search.')
    }
    setAiLoading(false)
  }
  function openSource(a) { setArticleId(a.id); setTab('docs') }

  const article = articleId ? ALL_ARTICLES.find((a) => a.id === articleId) : null
  const results = searchAll(query)

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
            <div>
              <form onSubmit={(e) => { e.preventDefault(); askQuincy(aiQ) }} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input value={aiQ} onChange={(e) => setAiQ(e.target.value)} placeholder="Ask QuincyAI about Journey…" autoFocus
                  style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: '1px solid #D5DAE1', fontSize: 14, boxSizing: 'border-box' }} />
                <button type="submit" disabled={aiLoading || !aiQ.trim()}
                  style={{ padding: '9px 14px', borderRadius: 8, border: 'none', background: brand, color: '#fff', fontWeight: 700, fontSize: 13, cursor: aiLoading ? 'default' : 'pointer', opacity: aiLoading || !aiQ.trim() ? 0.6 : 1 }}>Ask</button>
              </form>

              {aiLoading ? (
                <div style={{ color: '#64748B', fontSize: 13.5, padding: '10px 2px' }}>QuincyAI is reading the guides…</div>
              ) : aiError ? (
                <div style={{ color: '#B00020', fontSize: 13, background: '#FBE7E7', border: '1px solid #E3B0B0', borderRadius: 8, padding: '9px 11px' }}>{aiError}</div>
              ) : aiAnswer ? (
                <div>
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 1.55, color: '#1F2A37' }}>{aiAnswer}</div>
                  {aiSources.length > 0 && (
                    <div style={{ marginTop: 14, borderTop: '1px solid #EEF1F6', paddingTop: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#8A93A6', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Based on</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {aiSources.map((s) => (
                          <button key={s.id} onClick={() => openSource(s)}
                            style={{ background: '#F1F5FB', border: '1px solid #DCE6F3', borderRadius: 999, padding: '4px 11px', fontSize: 12, color: brand, fontWeight: 600, cursor: 'pointer' }}>{s.title}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 12 }}>AI-generated from Journey’s help — double-check anything important.</div>
                </div>
              ) : (
                <div style={{ color: '#64748B' }}>
                  <p style={{ fontSize: 13.5, lineHeight: 1.55, marginTop: 4 }}>Ask in plain English and QuincyAI answers from Journey’s help guides — where to go and what to click.</p>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#8A93A6', textTransform: 'uppercase', letterSpacing: 0.4, margin: '14px 0 8px' }}>Try asking</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {AI_EXAMPLES.map((ex) => (
                      <button key={ex} onClick={() => askQuincy(ex)}
                        style={{ textAlign: 'left', background: '#F7F9FB', border: '1px solid #E7EBF0', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#1F2A37', cursor: 'pointer' }}>{ex}</button>
                    ))}
                  </div>
                </div>
              )}
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
                <p style={{ color: '#64748B', fontSize: 13.5 }}>No help topics match "{query}". Try a feature name like "estimate" or "dashboard".</p>
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
