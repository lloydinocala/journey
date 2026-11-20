// A small notice at the bottom of the screen that fades out on its own (or when tapped).
export function showToast(text, ms = 6000) {
  try {
    const el = document.createElement('div')
    el.setAttribute('role', 'status')
    el.textContent = text
    Object.assign(el.style, {
      position: 'fixed', left: '50%', bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))', transform: 'translateX(-50%)',
      maxWidth: '88vw', padding: '12px 16px', borderRadius: '12px', background: '#14324F', color: '#fff',
      fontSize: '15px', lineHeight: '1.35', fontWeight: '600', textAlign: 'center', boxShadow: '0 6px 24px rgba(0,0,0,.25)',
      zIndex: '100000', transition: 'opacity .4s', opacity: '1',
    })
    const close = () => { el.style.opacity = '0'; setTimeout(() => el.remove(), 450) }
    el.addEventListener('click', close)
    document.body.appendChild(el)
    setTimeout(close, ms)
  } catch { /* ignore */ }
}
