interface StarRatingProps {
  value: number // 0-5
  onChange?: (value: number) => void
  size?: number
  readOnly?: boolean
}

export function StarRating({ value, onChange, size = 24, readOnly = false }: StarRatingProps) {
  const stars = [1, 2, 3, 4, 5]

  return (
    <div className="inline-flex gap-0.5" role="radiogroup" aria-label="Calificación en estrellas">
      {stars.map((star) => {
        const filled = star <= Math.round(value)
        return (
          <button
            key={star}
            type="button"
            disabled={readOnly}
            role="radio"
            aria-checked={filled}
            aria-label={`${star} estrella${star > 1 ? 's' : ''}`}
            onClick={() => onChange?.(star)}
            className={readOnly ? 'cursor-default' : 'cursor-pointer transition-transform hover:scale-110'}
            style={{ lineHeight: 0 }}
          >
            <svg
              width={size}
              height={size}
              viewBox="0 0 24 24"
              fill={filled ? '#f59e0b' : 'none'}
              stroke={filled ? '#f59e0b' : '#94a3b8'}
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.563.563 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
              />
            </svg>
          </button>
        )
      })}
    </div>
  )
}
