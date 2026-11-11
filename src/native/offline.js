// Low-signal support for the Field App (/tech pages, in the store app and in the browser).
//
// Sits under the Supabase client as its fetch:
//  - Reads: every successful read is remembered on the phone. With no signal, the last copy is
//    shown instead of an error, so job lists and job cards still open.
//  - Saves: with no signal, the change (including photos) is kept on the phone in an outbox and
//    the screen carries on as if it saved. The outbox uploads by itself, in order, as soon as
//    there's a connection. Anything the server then refuses is listed so it can be redone.
// Sending texts/emails and other server actions are not held — they need a connection.

const DB = 'journey-offline'
const READS = 'reads'
const OUTBOX = 'outbox'
const MAX_READS = 400
let dbp = null
function db() {
  if (dbp) return dbp
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => {
      const d = r.result
      if (!d.objectStoreNames.contains(READS)) d.createObjectStore(READS, { keyPath: 'k' })
      if (!d.objectStoreNames.contains(OUTBOX)) d.createObjectStore(OUTBOX, { keyPath: 'id', autoIncrement: true })
    }
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
  return dbp
}
async function tx(store, mode, fn) {
  const d = await db()
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode)
    const s = t.objectStore(store)
    let out
    Promise.resolve(fn(s)).then((v) => { out = v })
    t.oncomplete = () => res(out)
    t.onerror = () => rej(t.error)
  })
}
const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })

// ---------- state the banner listens to ----------
const listeners = new Set()
let state = { offline: typeof navigator !== 'undefined' ? !navigator.onLine : false, pending: 0, failed: [], syncing: false, usedCache: false }
function emit(patch) { state = { ...state, ...patch }; listeners.forEach((f) => { try { f(state) } catch { /* ignore */ } }) }
export function onOfflineState(f) { listeners.add(f); f(state); return () => listeners.delete(f) }
export function dismissFailed() { emit({ failed: [] }); try { localStorage.removeItem('journey_outbox_failed') } catch { /* ignore */ } }

let tokenGetter = async () => null
let apiKey = ''
export function setAuthSource(getToken, key) { tokenGetter = getToken; apiKey = key }

const isField = () => { try { return location.pathname === '/tech' || location.pathname.startsWith('/tech/') } catch { return false } }
const hdrs = (h) => { const o = {}; if (!h) return o; if (h instanceof Headers) h.forEach((v, k) => { o[k.toLowerCase()] = v }); else if (Array.isArray(h)) h.forEach(([k, v]) => { o[k.toLowerCase()] = v }); else Object.keys(h).forEach((k) => { o[k.toLowerCase()] = h[k] }); return o }
const isNetErr = (e) => e && (e.name === 'TypeError' || /network|failed to fetch|load failed/i.test(String(e.message || e)))

async function bodyToStorable(body) {
  if (body == null || typeof body === 'string') return { kind: 'text', v: body ?? null }
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const parts = []
    body.forEach((v, k) => parts.push([k, v, v instanceof File ? v.name : null]))
    return { kind: 'form', v: parts }
  }
  if (body instanceof Blob) return { kind: 'blob', v: body }
  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return { kind: 'blob', v: new Blob([body]) }
  return null // streams etc. — can't be held
}
function storableToBody(s) {
  if (!s) return undefined
  if (s.kind === 'form') { const f = new FormData(); s.v.forEach(([k, v, name]) => (name ? f.append(k, v, name) : f.append(k, v))); return f }
  return s.v ?? undefined
}

// ---------- reads ----------
async function cacheKey(url, method, h, body) {
  return `${method} ${url} ${h.accept || ''} ${h.prefer && h.prefer.includes('count') ? h.prefer : ''} ${method === 'POST' && typeof body === 'string' ? body : ''}`
}
async function remember(k, res) {
  try {
    const text = await res.clone().text()
    if (text.length > 1500000) return
    const headers = {}
    ;['content-type', 'content-range'].forEach((n) => { const v = res.headers.get(n); if (v) headers[n] = v })
    await tx(READS, 'readwrite', (s) => s.put({ k, status: res.status, headers, text, at: Date.now() }))
    if (Math.random() < 0.05) prune()
  } catch { /* storage full or private mode */ }
}
async function prune() {
  try {
    const all = await tx(READS, 'readonly', (s) => req(s.getAll()))
    if (all.length <= MAX_READS) return
    all.sort((a, b) => a.at - b.at)
    await tx(READS, 'readwrite', (s) => { all.slice(0, all.length - MAX_READS).forEach((r) => s.delete(r.k)) })
  } catch { /* ignore */ }
}
async function recall(k) {
  try {
    const r = await tx(READS, 'readonly', (s) => req(s.get(k)))
    if (!r) return null
    emit({ usedCache: true })
    return new Response(r.text, { status: r.status, headers: { ...r.headers, 'x-journey-offline': '1' } })
  } catch { return null }
}

// ---------- writes ----------
async function countPending() {
  try { const n = await tx(OUTBOX, 'readonly', (s) => req(s.count())); emit({ pending: n }); return n } catch { return 0 }
}
function fakeResponse(method, h, bodyText) {
  const wantsRows = (h.prefer || '').includes('return=representation')
  if (!wantsRows || method === 'DELETE') return new Response(null, { status: method === 'POST' ? 201 : 204, headers: { 'x-journey-offline': '1' } })
  let rows = []
  try { const b = JSON.parse(bodyText || 'null'); rows = Array.isArray(b) ? b : b ? [b] : [] } catch { /* not JSON */ }
  const single = (h.accept || '').includes('vnd.pgrst.object')
  return new Response(JSON.stringify(single ? rows[0] || {} : rows), { status: method === 'POST' ? 201 : 200, headers: { 'content-type': 'application/json', 'x-journey-offline': '1' } })
}
async function hold(url, method, h, storable, bodyText) {
  const keep = { ...h }
  delete keep.authorization; delete keep.apikey
  await tx(OUTBOX, 'readwrite', (s) => s.add({ url, method, headers: keep, body: storable, at: Date.now() }))
  await countPending()
  scheduleFlush(15000)
  return fakeResponse(method, h, bodyText)
}

let flushing = false
let flushTimer = null
function scheduleFlush(ms) { clearTimeout(flushTimer); flushTimer = setTimeout(flush, ms) }
export async function flush() {
  if (flushing) return
  flushing = true
  try {
    let items = await tx(OUTBOX, 'readonly', (s) => req(s.getAll()))
    if (!items.length) { emit({ syncing: false }); return }
    emit({ syncing: true })
    const token = await tokenGetter()
    for (const it of items) {
      let res
      try {
        res = await fetch(it.url, { method: it.method, headers: { ...it.headers, apikey: apiKey, ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: storableToBody(it.body) })
      } catch (e) {
        if (isNetErr(e)) { emit({ offline: true }); scheduleFlush(20000); break }
        res = null
      }
      if (res && res.status >= 500) { scheduleFlush(30000); break }
      if (res && (res.status === 401 || res.status === 403) && !token) { scheduleFlush(30000); break } // signed out — wait for sign-in
      if (res && res.status >= 400) {
        let detail = ''
        try { const j = await res.json(); detail = j.message || j.error || '' } catch { /* not JSON */ }
        const failed = [...state.failed, { what: describe(it), detail: detail || `Error ${res.status}`, at: it.at }]
        emit({ failed })
        try { localStorage.setItem('journey_outbox_failed', JSON.stringify(failed.slice(-20))) } catch { /* ignore */ }
      }
      await tx(OUTBOX, 'readwrite', (s) => s.delete(it.id))
      emit({ offline: false })
    }
  } catch { /* ignore */ } finally {
    flushing = false
    emit({ syncing: false })
    countPending()
  }
}
function describe(it) {
  const m = it.url.match(/\/(rest\/v1|storage\/v1\/object)\/([^?/]+)/)
  const what = it.url.includes('/storage/') ? 'photo / file upload' : (m ? m[2].replace(/_/g, ' ') : 'change')
  return `${{ POST: 'New', PATCH: 'Update to', PUT: 'Upload', DELETE: 'Delete from' }[it.method] || it.method} ${what}`
}

// ---------- the fetch Supabase uses ----------
export function offlineFetch(input, init = {}) {
  const url = typeof input === 'string' ? input : input?.url || String(input)
  const method = (init.method || (typeof input !== 'string' && input?.method) || 'GET').toUpperCase()
  const isRest = url.includes('/rest/v1/')
  const isUpload = url.includes('/storage/v1/object/') && !url.includes('/sign/') && (method === 'POST' || method === 'PUT')
  if ((!isRest && !isUpload) || !isField() || typeof indexedDB === 'undefined') return fetch(input, init)
  const h = hdrs(init.headers)
  const isRpc = url.includes('/rest/v1/rpc/')
  const isRead = method === 'GET' || method === 'HEAD' || isRpc

  if (isRead) {
    return (async () => {
      const k = await cacheKey(url, method, h, init.body)
      if (navigator.onLine === false) { const c = await recall(k); if (c) return c }
      try {
        const res = await fetch(input, init)
        if (res.ok) { remember(k, res); if (state.offline) { emit({ offline: false }); flush() } }
        return res
      } catch (e) {
        if (!isNetErr(e)) throw e
        emit({ offline: true })
        const c = await recall(k)
        if (c) return c
        throw e
      }
    })()
  }

  return (async () => {
    const storable = await bodyToStorable(init.body)
    const bodyText = typeof init.body === 'string' ? init.body : null
    if (navigator.onLine === false && storable) { emit({ offline: true }); return hold(url, method, h, storable, bodyText) }
    try {
      const res = await fetch(input, init)
      if (state.offline) { emit({ offline: false }); flush() }
      return res
    } catch (e) {
      if (!isNetErr(e) || !storable) throw e
      emit({ offline: true })
      return hold(url, method, h, storable, bodyText)
    }
  })()
}

// Upload as soon as a connection comes back, and check now and then.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { emit({ offline: false }); flush() })
  window.addEventListener('offline', () => emit({ offline: true }))
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') flush() })
  setInterval(() => { if (state.pending) flush() }, 60000)
  try { const f = JSON.parse(localStorage.getItem('journey_outbox_failed') || '[]'); if (f.length) state = { ...state, failed: f } } catch { /* ignore */ }
  setTimeout(() => { countPending().then((n) => { if (n) flush() }) }, 3000)
}
