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

  if (!imageUrl) return null

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
