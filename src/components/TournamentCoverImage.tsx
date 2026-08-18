export function TournamentCoverImage({
  imageUrl,
  alt,
  className = '',
}: {
  imageUrl?: string | null
  alt: string
  className?: string
}) {
  const frameClass = `relative w-full overflow-hidden ${className}`

  if (!imageUrl) {
    return (
      <div
        className={`${frameClass} border border-border bg-gradient-to-br from-card-raised to-navy`}
        aria-hidden
      >
        <div className="w-full pt-[56.25%]" />
        <div className="absolute inset-0 flex items-center justify-center text-text-steel">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="44"
            height="44"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-5-5L5 21" />
          </svg>
        </div>
      </div>
    )
  }

  return (
    <div className={`${frameClass} border border-border bg-card-raised`}>
      <div className="w-full pt-[56.25%]" />
      <img
        src={imageUrl}
        alt={alt}
        className="absolute inset-0 h-full w-full object-cover"
        loading="lazy"
        decoding="async"
      />
    </div>
  )
}
