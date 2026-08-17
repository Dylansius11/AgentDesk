/*
 * Shared sparkline: smooth-ish black stroke with a faint fill, sized by CSS.
 * Pure SVG — safe in server components.
 */
export default function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const width = 200
  const height = 120
  const pad = 5
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const step = (width - pad * 2) / (values.length - 1)
  const line = values
    .map((value, i) => {
      const x = pad + i * step
      const y = pad + (1 - (value - min) / range) * (height - pad * 2)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const area = `${line} L${width - pad},${height} L${pad},${height} Z`

  return (
    <svg
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={area} fill="rgba(0, 0, 0, 0.05)" stroke="none" />
      <path
        d={line}
        fill="none"
        stroke="#000000"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
