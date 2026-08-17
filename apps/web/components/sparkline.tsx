/*
 * Shared sparkline: generated SVG path (never an image), colored by trend
 * direction — money-positive/negative tokens when the series has a clear
 * up/down slope, neutral text otherwise. Pure SVG — safe in server components.
 */
export default function Sparkline({
  values,
  className,
  tone = 'auto',
}: {
  values: number[]
  className?: string
  /** 'auto' picks positive/negative from first-vs-last value; pass explicitly to override. */
  tone?: 'auto' | 'positive' | 'negative' | 'neutral'
}) {
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

  const resolvedTone =
    tone === 'auto'
      ? (values[values.length - 1] ?? 0) >= (values[0] ?? 0)
        ? 'positive'
        : 'negative'
      : tone

  const stroke =
    resolvedTone === 'positive'
      ? 'var(--color-money-positive)'
      : resolvedTone === 'negative'
        ? 'var(--color-money-negative)'
        : 'var(--color-text-primary)'
  const fill =
    resolvedTone === 'positive'
      ? 'var(--color-money-positive-soft)'
      : resolvedTone === 'negative'
        ? 'var(--color-money-negative-soft)'
        : 'var(--color-border-subtle)'

  return (
    <svg
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={area} fill={fill} stroke="none" />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
