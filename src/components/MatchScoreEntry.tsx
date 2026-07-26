import type {
  EventType,
  GroupMatch,
  KnockoutMatch,
  MatchOutcome,
  TeamFormat,
  TournamentConfig,
  RubberResult,
} from '../types'
import { useState } from 'react'
import { RubberScoreEntry, calculateTieFromRubbers } from './RubberScoreEntry'
import { getEntryDisplayName } from '../lib/displayNames'
import { validateSetScore, getBestOfForStage } from '../lib/scoring'
import { forfeitScores } from '../lib/matchOutcomes'
import { Button, CaptionText, Card, FormLabel, SelectInput } from './ui/primitives'
import { MatchCard } from './MatchCard'

interface Props {
  eventType: EventType
  config: TournamentConfig
  match: GroupMatch | KnockoutMatch
  stage?: 'group' | 'quarters' | 'semis' | 'finals' | 'knockout_early'
  onSave: (data: {
    score_a: number
    score_b: number
    rubber_results: { home: RubberResult[] } | null
    winner_entry_id: string
    outcome: MatchOutcome
  }) => Promise<void>
}

export function MatchScoreEntry({ eventType, config, match, stage = 'group', onSave }: Props) {
  const isTeam = eventType === 'team'
  const format = config.team_format ?? 'SSS'
  const homeName = match.entry_a ? getEntryDisplayName(match.entry_a) : 'TBD'
  const awayName = match.entry_b ? getEntryDisplayName(match.entry_b) : 'TBD'

  const [rubbers, setRubbers] = useState<RubberResult[]>(match.rubber_results?.home ?? [])
  const [scoreA, setScoreA] = useState(match.score_a?.toString() ?? '')
  const [scoreB, setScoreB] = useState(match.score_b?.toString() ?? '')
  const [outcome, setOutcome] = useState<MatchOutcome>(match.outcome ?? 'normal')
  const [winnerSide, setWinnerSide] = useState<'a' | 'b'>('a')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const bestOf = getBestOfForStage(stage, config)

  const handleSave = async () => {
    setError('')
    if (!match.entry_a_id || !match.entry_b_id) return

    let finalA: number
    let finalB: number
    let rubberResults: { home: RubberResult[] } | null = null

    if (outcome !== 'normal') {
      const scores = forfeitScores(isTeam, isTeam ? format : undefined, bestOf)
      const winnerIsA = winnerSide === 'a'
      finalA = winnerIsA ? scores.scoreB : scores.scoreA
      finalB = winnerIsA ? scores.scoreA : scores.scoreB
    } else if (isTeam) {
      const calc = calculateTieFromRubbers(rubbers, format as TeamFormat)
      if (!calc.valid || calc.scoreA === calc.scoreB) {
        setError(calc.error ?? 'Enter a complete tie result')
        return
      }
      finalA = calc.scoreA
      finalB = calc.scoreB
      rubberResults = { home: rubbers }
    } else {
      const parsedA = Number(scoreA)
      const parsedB = Number(scoreB)
      if (!Number.isInteger(parsedA) || !Number.isInteger(parsedB)) {
        setError('Scores must be whole numbers')
        return
      }
      if (parsedA < 0 || parsedB < 0) {
        setError('Scores cannot be negative')
        return
      }
      finalA = parsedA
      finalB = parsedB
      const validation = validateSetScore(finalA, finalB, bestOf)
      if (!validation.valid) {
        setError(validation.error ?? 'Invalid score')
        return
      }
    }

    const winnerId =
      finalA > finalB ? match.entry_a_id : finalB > finalA ? match.entry_b_id : null
    if (!winnerId) {
      setError('Could not determine winner')
      return
    }

    setSaving(true)
    try {
      await onSave({
        score_a: finalA,
        score_b: finalB,
        rubber_results: rubberResults,
        winner_entry_id: winnerId,
        outcome,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (match.status === 'completed') {
    return (
      <MatchCard
        homeName={homeName}
        awayName={awayName}
        scoreA={match.score_a}
        scoreB={match.score_b}
        homeWon={match.winner_entry_id === match.entry_a_id}
        awayWon={match.winner_entry_id === match.entry_b_id}
      />
    )
  }

  return (
    <Card className="p-4 space-y-3">
      <p className="text-sm font-semibold text-text-bluewhite">
        {homeName} vs {awayName}
      </p>

      <div>
        <FormLabel>Outcome</FormLabel>
        <SelectInput value={outcome} onChange={(e) => setOutcome(e.target.value as MatchOutcome)}>
          <option value="normal">Normal</option>
          <option value="forfeit">Forfeit</option>
          <option value="no_show">No-show</option>
          <option value="dq">DQ</option>
        </SelectInput>
      </div>

      {outcome !== 'normal' && (
        <div>
          <FormLabel>Award win to</FormLabel>
          <SelectInput value={winnerSide} onChange={(e) => setWinnerSide(e.target.value as 'a' | 'b')}>
            <option value="a">{homeName}</option>
            <option value="b">{awayName}</option>
          </SelectInput>
          <CaptionText>
            {winnerSide === 'a' ? awayName : homeName} will be recorded as{' '}
            {outcome === 'no_show' ? 'no-show' : outcome}.
          </CaptionText>
        </div>
      )}

      {outcome === 'normal' && isTeam && (
        <RubberScoreEntry
          format={format as TeamFormat}
          homeName={homeName}
          awayName={awayName}
          rubbers={rubbers}
          onChange={setRubbers}
        />
      )}

      {outcome === 'normal' && !isTeam && (
        <>
          <div className="flex items-center justify-center gap-2">
            <input
              type="number"
              step={1}
              min={0}
              value={scoreA}
              onChange={(e) => setScoreA(e.target.value)}
              className="w-16 h-10 bg-navy border border-border rounded-xl text-center text-base font-extrabold text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500"
              aria-label={`Sets won by ${homeName}`}
            />
            <span className="text-text-steel">–</span>
            <input
              type="number"
              step={1}
              min={0}
              value={scoreB}
              onChange={(e) => setScoreB(e.target.value)}
              className="w-16 h-10 bg-navy border border-border rounded-xl text-center text-base font-extrabold text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500"
              aria-label={`Sets won by ${awayName}`}
            />
          </div>
          <CaptionText>Best of {bestOf}</CaptionText>
        </>
      )}

      {error && <p className="text-sm text-live">{error}</p>}

      <Button type="button" onClick={handleSave} disabled={saving} fullWidth>
        {saving ? 'Saving…' : 'Save result'}
      </Button>
    </Card>
  )
}
