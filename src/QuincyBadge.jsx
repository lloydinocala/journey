// Quincy's badge — azure rounded square, white Q + sparkle, floating. Scales to any size.
export default function QuincyBadge({ size = 24, float = true }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'inline-block', verticalAlign: 'middle',
        filter: float ? 'drop-shadow(0 3px 5px rgba(26,86,176,0.5))' : 'none' }}>
      <defs>
        <linearGradient id="quincyQbg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2f7be0" />
          <stop offset="100%" stopColor="#5aa0ff" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="96" height="96" rx="22" fill="url(#quincyQbg)" />
      <circle cx="45" cy="44" r="18" fill="none" stroke="#ffffff" strokeWidth="8" />
      <line x1="55" y1="54" x2="69" y2="70" stroke="#ffffff" strokeWidth="8.5" strokeLinecap="round" />
      <path d="M78 18 C78 23.9 80.1 26 86 26 C80.1 26 78 28.1 78 34 C78 28.1 75.9 26 70 26 C75.9 26 78 23.9 78 18 Z" fill="#ffffff" />
    </svg>
  )
}
