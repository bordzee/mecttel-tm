import { Navigate, useParams } from 'react-router-dom'

/** Legacy live URL — redirects to the public division page Brackets tab. */
export function LivePage() {
  const { tournamentId, eventId } = useParams<{ tournamentId: string; eventId: string }>()
  if (!tournamentId || !eventId) {
    return <Navigate to="/" replace />
  }
  return (
    <Navigate
      to={`/tournaments/${tournamentId}/events/${eventId}?tab=brackets`}
      replace
    />
  )
}
