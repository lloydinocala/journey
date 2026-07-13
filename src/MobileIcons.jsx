// Minimal inline-SVG icons for the mobile tech views.
// Kept dependency-free (no lucide-react etc.) since the rest of the app has no icon library.

const base = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }

export function IconChevronLeft(props) {
  return <svg {...base} {...props}><polyline points="15 18 9 12 15 6" /></svg>
}
export function IconPhone(props) {
  return <svg {...base} {...props}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
}
export function IconMessage(props) {
  return <svg {...base} {...props}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
}
export function IconPin(props) {
  return <svg {...base} {...props}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
}
export function IconNavigation(props) {
  return <svg {...base} {...props}><polygon points="3 11 22 2 13 21 11 13 3 11" /></svg>
}
export function IconCamera(props) {
  return <svg {...base} {...props}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
}
export function IconReceipt(props) {
  return <svg {...base} {...props}><path d="M4 2h16v20l-3-2-3 2-3-2-3 2-3-2-1 1z" /><line x1="8" y1="7" x2="16" y2="7" /><line x1="8" y1="11" x2="16" y2="11" /></svg>
}
export function IconShield(props) {
  return <svg {...base} {...props}><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z" /></svg>
}
export function IconFile(props) {
  return <svg {...base} {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
}
export function IconCalculator(props) {
  return <svg {...base} {...props}><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="8" y1="10" x2="8" y2="10" /><line x1="12" y1="10" x2="12" y2="10" /><line x1="16" y1="10" x2="16" y2="10" /><line x1="8" y1="14" x2="8" y2="14" /><line x1="12" y1="14" x2="12" y2="14" /><line x1="16" y1="14" x2="16" y2="18" /><line x1="8" y1="18" x2="8" y2="18" /><line x1="12" y1="18" x2="12" y2="18" /></svg>
}
export function IconLock(props) {
  return <svg {...base} {...props}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
}
export function IconCalendar(props) {
  return <svg {...base} {...props}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
}
export function IconList(props) {
  return <svg {...base} {...props}><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
}
export function IconMore(props) {
  return <svg {...base} {...props}><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></svg>
}
export function IconSparkles(props) {
  return <svg {...base} {...props}><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" /><path d="M19 15l.7 1.9L21.5 17.5l-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z" /></svg>
}
