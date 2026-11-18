import { AddEntryButton, Button, FormLabel, TextInput } from '../../../components/ui/primitives'
import { SeededSelect } from '../../../components/SeededSelect'
import { isPlayerEventType } from '../../../lib/displayNames'
import type { EventType } from '../../../types'

/** The "add a participant" form; its fields depend on the division's event type. */
export function EntryForm({
  eventType,
  rosterSize,
  lateOnly,
  adding,
  submitDisabled,
  onSubmit,
  onShowParticipants,
}: {
  eventType: EventType
  rosterSize: number
  /** Late check-in: no participants shortcut, button says "Add late entry". */
  lateOnly: boolean
  adding: boolean
  submitDisabled: boolean
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  onShowParticipants: () => void
}) {
  return (
  <form onSubmit={onSubmit} className="bg-card border border-border rounded-2xl p-4 space-y-3">
    {eventType === 'team' && (
      <>
        <div>
          <FormLabel>Team name</FormLabel>
          <TextInput name="name" placeholder="Enter team name" required />
        </div>
        <div>
          <FormLabel>Organization (optional)</FormLabel>
          <TextInput name="organization" placeholder="Club or organization" />
        </div>
        <div>
          <FormLabel>Roster</FormLabel>
          <TextInput name="roster" placeholder={`Roster names, comma-separated (e.g. 3–${rosterSize} players)`} required />
        </div>
        <SeededSelect />
      </>
    )}
    {isPlayerEventType(eventType) && (
      <>
        <div>
          <FormLabel>Player name</FormLabel>
          <TextInput name="name" placeholder="Enter player name" required />
        </div>
        <div>
          <FormLabel>Organization (optional)</FormLabel>
          <TextInput name="organization" placeholder="Club or organization" />
        </div>
        <SeededSelect />
      </>
    )}
    {eventType === 'doubles' && (
      <>
        <div>
          <FormLabel>Pair name</FormLabel>
          <TextInput name="pair_name" placeholder="Pair name (optional)" />
        </div>
        <div>
          <FormLabel>Player A</FormLabel>
          <TextInput name="player_a" placeholder="Player A" required />
        </div>
        <div>
          <FormLabel>Player B</FormLabel>
          <TextInput name="player_b" placeholder="Player B" required />
        </div>
        <div>
          <FormLabel>Organization</FormLabel>
          <TextInput name="organization" placeholder="Organization (optional)" />
        </div>
        <SeededSelect />
      </>
    )}
    <AddEntryButton
      type="submit"
      disabled={submitDisabled}
      fullWidth
    >
      {adding ? 'Adding…' : lateOnly ? 'Add late entry' : 'Add entry'}
    </AddEntryButton>
    {!lateOnly && (
      <Button
        type="button"
        variant="secondary"
        onClick={onShowParticipants}
        fullWidth
      >
        Show participants
      </Button>
    )}
  </form>
  )
}
