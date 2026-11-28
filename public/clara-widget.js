/* Journey website widget — "Talk to us" (in-browser voice call with the company's receptionist)
 * and an optional "Text us" button. Put one tag on any website:
 *
 *   <script src="https://journey-hvac.app/clara-widget.js" data-org="COMPANY-ID"
 *           data-text="+13525551234" data-label="Talk to us" data-color="#00A6D6" async></script>
 *
 * data-org    the company's Journey id (required for the voice button)
 * data-text   the company's texting number (optional — shows a "Text us" button)
 * data-label  voice button wording (optional)      data-color  button color (optional)
 * data-voice  "off" to show only the Text us button
 * The call is started by Journey's server (web-call), so no keys are ever in the page.
 */
(function () {
  if (window.__journeyWidget) return; window.__journeyWidget = true
  var me = document.currentScript || document.querySelector('script[src*="clara-widget.js"]')
  var org = me && me.getAttribute('data-org')
  var textNum = ((me && me.getAttribute('data-text')) || '').replace(/[^\d+]/g, '')
  var label = (me && me.getAttribute('data-label')) || 'Talk to us'
  var color = (me && me.getAttribute('data-color')) || '#00A6D6'
  var voiceOn = !(me && me.getAttribute('data-voice') === 'off') && !!org
  var API = 'https://gatndtsmjrxdgxquvydw.supabase.co/functions/v1/web-call'
  var SDK = 'https://esm.sh/retell-client-js-sdk@3.0.4'
  var isPhone = /iPhone|iPad|Android|Mobile/i.test(navigator.userAgent)

  var css = '.jw-wrap{position:fixed;right:18px;bottom:18px;z-index:2147483000;display:flex;flex-direction:column;align-items:flex-end;gap:8px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}' +
    '.jw-btn{display:flex;align-items:center;gap:8px;border:0;border-radius:999px;padding:12px 18px;font-size:15px;font-weight:700;color:#fff;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.22);text-decoration:none}' +
    '.jw-btn.jw-alt{background:#fff;color:#163E64;border:1px solid #d6dde6}' +
    '.jw-panel{background:#fff;color:#163E64;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.25);padding:14px 16px;width:250px;font-size:14px;line-height:1.4}' +
    '.jw-panel b{display:block;font-size:15px;margin-bottom:4px}.jw-small{font-size:12px;color:#6b7785;margin-top:6px}' +
    '.jw-dot{width:10px;height:10px;border-radius:50%;background:#2ecc71;display:inline-block;margin-right:6px;animation:jwp 1.2s infinite}' +
    '@keyframes jwp{0%{opacity:1}50%{opacity:.3}100%{opacity:1}}' +
    '.jw-end{margin-top:10px;width:100%;border:0;border-radius:10px;padding:9px;background:#B00020;color:#fff;font-weight:700;cursor:pointer}'
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st)

  var wrap = document.createElement('div'); wrap.className = 'jw-wrap'
  var panel = null, client = null, busy = false

  function svgMic() { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/></svg>' }
  function svgText() { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' }
  function pretty(n) { var d = n.replace(/\D/g, '').slice(-10); return d.length === 10 ? '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6) : n }

  function showPanel(html) {
    if (!panel) { panel = document.createElement('div'); panel.className = 'jw-panel'; wrap.insertBefore(panel, wrap.firstChild) }
    panel.innerHTML = html
  }
  function hidePanel() { if (panel) { panel.remove(); panel = null } }

  async function startCall() {
    if (busy) return; busy = true
    showPanel('<b>Connecting…</b>Please allow the microphone when your browser asks.')
    try {
      var r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ org: org, page: location.href }) })
      var d = await r.json().catch(function () { return {} })
      if (!r.ok || !d.access_token) throw new Error(d.error || 'Could not start the call.')
      var mod = await import(SDK)
      client = new mod.RetellWebClient()
      client.on('call_started', function () {
        showPanel('<b><span class="jw-dot"></span>Connected</b>Go ahead and talk. You can end the call any time.<button class="jw-end" type="button">End call</button>')
        panel.querySelector('.jw-end').onclick = endCall
      })
      client.on('call_ended', function () { done('Thanks for calling!') })
      client.on('error', function () { done('The call ended. Please try again, or call or text us.') })
      var cfg = { accessToken: d.access_token }
      if (d.call_id) cfg.callId = d.call_id
      if (d.transport) cfg.transport = d.transport
      if (d.ice_servers) cfg.iceServers = d.ice_servers
      await client.startCall(cfg)
    } catch (e) {
      done((e && e.message) || 'Could not start the call.')
    }
  }
  function endCall() { try { client && client.stopCall() } catch (e) {} done('Thanks for calling!') }
  function done(msg) {
    busy = false; client = null
    showPanel('<b>' + msg + '</b>' + (textNum ? '<div class="jw-small">You can also text us at ' + pretty(textNum) + '.</div>' : ''))
    setTimeout(hidePanel, 6000)
  }

  if (textNum) {
    var t = document.createElement(isPhone ? 'a' : 'button'); t.className = 'jw-btn jw-alt'
    t.innerHTML = svgText() + '<span>' + (isPhone ? 'Text us' : 'Text us: ' + pretty(textNum)) + '</span>'
    if (isPhone) t.href = 'sms:' + textNum + (/iPhone|iPad/i.test(navigator.userAgent) ? '&' : '?') + 'body=' + encodeURIComponent("Hi, I'd like to schedule service.")
    else t.onclick = function () { showPanel('<b>Text us from your phone</b>Send a text to <b style="display:inline">' + pretty(textNum) + '</b> and we\'ll get you scheduled.'); setTimeout(hidePanel, 8000) }
    wrap.appendChild(t)
  }
  if (voiceOn) {
    var v = document.createElement('button'); v.type = 'button'; v.className = 'jw-btn'; v.style.background = color
    v.innerHTML = svgMic() + '<span>' + label + '</span>'
    v.onclick = function () { if (client) endCall(); else startCall() }
    wrap.appendChild(v)
  }
  if (wrap.children.length) (document.body ? document.body.appendChild(wrap) : window.addEventListener('DOMContentLoaded', function () { document.body.appendChild(wrap) }))
})()
