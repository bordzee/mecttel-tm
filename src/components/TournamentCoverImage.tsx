export function TournamentCoverImage({
  imageUrl,
  alt,
  className = '',
}: {
  imageUrl?: string | null
  alt: string
  className?: string
}) {
  if (!imageUrl) {
    return (
      <div
        className={`overflow-hidden rounded-2xl border border-border bg-card-raised ${className}`}
        aria-hidden
      >
        <div className="flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-card-raised to-navy text-text-steel">
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
    <div className={`overflow-hidden rounded-2xl border border-border ${className}`}>
      <img src={imageUrl} alt={alt} className="w-full aspect-[16/9] object-cover" />
    </div>
  )
}
