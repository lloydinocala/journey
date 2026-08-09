// Faint, always-on confidential watermark for field views. Hides nothing, but
// stamps every screen with who is viewing it and when — so it deters screenshot
// theft of customer data and makes any leaked screenshot traceable evidence.
// pointer-events: none so it never interferes with taps. Sits below modals.
export default function Watermark({ label }) {
  if (!label) return null
  const line = Array.from({ length: 5 }).map((_, j) => (
    <span key={j} style={{ marginRight: 44 }}>{label}</span>
  ))
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 5, pointerEvents: 'none',
        overflow: 'hidden', opacity: 0.055,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-around',
      }}
    >
      {Array.from({ length: 18 }).map((_, i) => (
        <div key={i} style={{
          transform: 'rotate(-28deg)', whiteSpace: 'nowrap',
          fontSize: 12, fontWeight: 800, color: '#0F2A47', letterSpacing: 1,
        }}>{line}</div>
      ))}
    </div>
  )
}
