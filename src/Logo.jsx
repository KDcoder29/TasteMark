// Tastemark logo: green serving cloche with a star, on cream
export default function Logo({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" className="shrink-0" role="img" aria-label="Tastemark">
      <rect width="512" height="512" rx="112" fill="#f3ead8" />
      <rect x="4" y="4" width="504" height="504" rx="108" fill="none" stroke="#1d3b2f" strokeOpacity=".18" strokeWidth="8" />
      <g transform="translate(256 256) scale(1.15) translate(-256 -250)">
        <path d="M116 322A140 140 0 0 1 396 322Z" fill="#1d3b2f" />
        <rect x="96" y="338" width="320" height="26" rx="13" fill="#1d3b2f" />
        <circle cx="256" cy="156" r="20" fill="#1d3b2f" />
        <polygon points="256.0,218.0 267.2,246.6 297.8,248.4 274.1,267.9 281.9,297.6 256.0,281.0 230.1,297.6 237.9,267.9 214.2,248.4 244.8,246.6" fill="#f3ead8" stroke="#f3ead8" strokeWidth="6" strokeLinejoin="round" />
      </g>
    </svg>
  )
}
