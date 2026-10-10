export default function Logo({ size = 36 }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-xl"
      style={{ width: size, height: size, background: 'var(--pri)', color: 'var(--on-pri)' }}>
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
        <circle cx="12" cy="9.5" r="2.6" style={{ fill: 'var(--pri)' }} />
      </svg>
    </span>
  )
}
