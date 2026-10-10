// Small pieces used by several screens.

export const CATEGORIES = ['Food', 'Cafe', 'Healthy', 'Dessert']

export const norm = s => (s || '').trim().toLowerCase()

const hue = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 360; return h }
export const tint = s => `hsl(${hue(s)} 38% 42%)`            // a calm, distinct color per person / group
export const initial = s => ((s || '?').trim()[0] || '?').toUpperCase()

export function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return Math.floor(s / 60) + 'm ago'
  if (s < 86400) return Math.floor(s / 3600) + 'h ago'
  if (s < 604800) return Math.floor(s / 86400) + 'd ago'
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export const Stars = ({ n = 0 }) => (
  <span className="text-sm tracking-tight">
    {[1, 2, 3, 4, 5].map(i => <span key={i} style={{ color: i <= n ? 'var(--star)' : 'var(--star-off)' }}>★</span>)}
  </span>
)

export function Avatar({ text, color, size = 28 }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: color, fontSize: size * 0.42 }}>{initial(text)}</span>
  )
}
