import { Button, CaptionText, InfoNoteCard, PanelSectionTitle, WarningBanner } from '../../../components/ui/primitives'
import { GroupStandingsTable } from '../../../components/GroupStandingsTable'
import { GroupRankEditor } from '../../../components/GroupRankEditor'
import { GroupStageNavigator } from '../../../components/GroupStageNavigator'
import { KnockoutBracket } from '../../../components/KnockoutBracket'
import { MatchScoreEntry } from '../../../components/MatchScoreEntry'
import { saveGroupMatchResult, updateGroupMatchResult, updateKnockoutMatchResult, saveKnockoutMatchResult } from '../../../lib/tournamentService'
import { matchEffectiveRound } from '../../../lib/knockoutTabs'
import { hasPendingEarlierKnockoutRound, setRulesStageForRound } from '../../../lib/knockoutRounds'
import { knockoutMatchHasCompletedDependents } from '../../../lib/knockoutSeeding'
import { needsManualRankResolution } from '../../../lib/standings'
import { getEntryDisplayName } from '../../../lib/displayNames'
import type { GroupStageData } from '../../../lib/groupStageData'
import type { StageTab } from '../../../components/GroupStageNavigator'
import type { KnockoutMatch, KnockoutRound, TournamentEntry, TournamentEvent } from '../../../types'

export interface BracketsPanelProps {
  event: TournamentEvent
  loading: boolean
  entryMap: Map<string, TournamentEntry>
  stageTabs: StageTab[]
  activeStage: string
  onStageChange: (id: string) => void
  liveKnockoutByePreview: string | null
  knockoutMatches: KnockoutMatch[]
  allGroupPlayComplete: boolean
  pendingGroupMatchCount: number
  groupsAwaitingScores: GroupStageData[]
  knockoutHasScores: boolean
  onGenerateKnockout: (mode: 'generate' | 'regenerate') => void
  activeGroupStage: GroupStageData | undefined
  activeKnockoutRound: KnockoutRound | null
  activeKnockoutMatches: KnockoutMatch[]
  onShowEntryInfo: (entry: TournamentEntry) => void
  onSaveGroupRanks: (groupId: string, orderedEntryIds: string[], note: string | null) => Promise<void>
  onClearGroupRanks: (groupId: string) => Promise<void>
  onRefresh: () => Promise<void>
  onWarnings: (warnings: string[]) => void
  onMessage: (message: string) => void
}

/** The Brackets tab: group standings and scoring, knockout generation, knockout scoring. */
export function BracketsPanel({
  event,
  loading,
  entryMap,
  stageTabs,
  activeStage,
  onStageChange,
  liveKnockoutByePreview,
  knockoutMatches,
  allGroupPlayComplete,
  pendingGroupMatchCount,
  groupsAwaitingScores,
  knockoutHasScores,
  onGenerateKnockout,
  activeGroupStage,
  activeKnockoutRound,
  activeKnockoutMatches,
  onShowEntryInfo,
  onSaveGroupRanks,
  onClearGroupRanks,
  onRefresh,
  onWarnings,
  onMessage,
}: BracketsPanelProps) {
  const cfg = event.config

  return (
    <>
    <GroupStageNavigator tabs={stageTabs} activeId={activeStage} onChange={onStageChange} />

    <div className="space-y-3">
      <div className="bg-card border border-border-strong rounded-2xl p-4 space-y-3.5">
        <PanelSectionTitle>Knockout stage</PanelSectionTitle>
        {liveKnockoutByePreview && !knockoutMatches.length && (
          <InfoNoteCard>
            Current knockout estimate: {liveKnockoutByePreview}
          </InfoNoteCard>
        )}
        {!allGroupPlayComplete ? (
          <>
            <CaptionText>
              Finish all group-stage matches before generating the knockout bracket.
              {pendingGroupMatchCount > 0
                ? ` ${pendingGroupMatchCount} match${pendingGroupMatchCount === 1 ? '' : 'es'} still to score`
                : groupsAwaitingScores.length > 0
                  ? ` — group${groupsAwaitingScores.length === 1 ? '' : 's'} ${groupsAwaitingScores.map((g) => g.group.label).join(', ')} ${groupsAwaitingScores.length === 1 ? 'has' : 'have'} no completed matches yet`
                  : ''}
              .
            </CaptionText>
            <Button type="button" disabled fullWidth>
              Generate knockout bracket
            </Button>
          </>
        ) : knockoutHasScores ? (
          <CaptionText>
            Knockout scoring has started — the bracket can no longer be regenerated from group
            ranks.
          </CaptionText>
        ) : knockoutMatches.length === 0 ? (
          <>
            <CaptionText>
              Save any manual group ranks first, then generate the bracket from the final
              positions.
            </CaptionText>
            <Button
              type="button"
              onClick={() => onGenerateKnockout('generate')}
              disabled={loading}
              fullWidth
            >
              Generate knockout bracket
            </Button>
          </>
        ) : (
          <>
            <CaptionText>
              Update manual group ranks if needed, then regenerate the bracket from the latest
              standings.
            </CaptionText>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onGenerateKnockout('regenerate')}
              disabled={loading}
              fullWidth
            >
              Regenerate knockout from ranks
            </Button>
          </>
        )}
      </div>
      {knockoutMatches.length > 0 && !knockoutHasScores && (
        <WarningBanner>
          Once knockout scoring starts, ranks can no longer update the bracket.
        </WarningBanner>
      )}
    </div>

    {activeGroupStage && (
      <section className="space-y-4">
        <PanelSectionTitle>Group {activeGroupStage.group.label} standings</PanelSectionTitle>

        <GroupStandingsTable
          label={activeGroupStage.group.label}
          rows={activeGroupStage.rows}
          manualRanks={activeGroupStage.hasManualRanks}
          manualRankNote={activeGroupStage.group.manual_rank_note}
          entryMap={entryMap}
          onShowEntryInfo={onShowEntryInfo}
        />

        {activeGroupStage.groupPlayComplete &&
          (activeGroupStage.hasManualRanks ||
            needsManualRankResolution(activeGroupStage.computedRows, cfg.advance_count)) && (
          <GroupRankEditor
            groupLabel={activeGroupStage.group.label}
            rows={activeGroupStage.computedRows}
            manualRankOrder={activeGroupStage.group.manual_rank_order}
            manualRankNote={activeGroupStage.group.manual_rank_note}
            saving={loading}
            disabled={knockoutHasScores}
            diffLabel={event.event_type === 'team' ? 'rubbers' : 'sets'}
            onSave={(orderedEntryIds, note) =>
              onSaveGroupRanks(activeGroupStage.group.id, orderedEntryIds, note)
            }
            onClear={() => onClearGroupRanks(activeGroupStage.group.id)}
          />
        )}

        {activeGroupStage.pending.length > 0 && (
          <div>
            <PanelSectionTitle>To score ({activeGroupStage.pending.length})</PanelSectionTitle>
            <div className="space-y-3 mt-3">
              {activeGroupStage.pending.map((m) => (
                <MatchScoreEntry
                  key={m.id}
                  eventType={event.event_type}
                  config={cfg}
                  match={m}
                  stage="group"
                  onSave={async (data) => {
                    await saveGroupMatchResult(m.id, data)
                    await onRefresh()
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {activeGroupStage.completed.length > 0 && (
          <details className="group">
            <summary className="flex items-center justify-between bg-card rounded-xl border border-border px-3.5 py-3 cursor-pointer list-none">
              <span className="text-sm font-semibold text-text-bluewhite">
                Completed ({activeGroupStage.completed.length})
              </span>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-steel group-open:rotate-180 transition-transform" aria-hidden>
                <path d="m6 9 6 6 6-6" />
              </svg>
            </summary>
            <div className="mt-2 space-y-2">
              {activeGroupStage.completed.map((m) => (
                <div key={m.id} className="rounded-[10px] border border-border bg-card-raised px-3.5 py-2.5">
                  <MatchScoreEntry
                    eventType={event.event_type}
                    config={cfg}
                    match={m}
                    stage="group"
                    allowEdit={!knockoutHasScores}
                    onSave={async (data) => {
                      const { warnings: editWarnings } = await updateGroupMatchResult(m.id, data)
                      if (editWarnings.length) {
                        onWarnings(editWarnings)
                      }
                      onMessage('Score updated.')
                      await onRefresh()
                    }}
                  />
                </div>
              ))}
            </div>
          </details>
        )}
      </section>
    )}

    {activeKnockoutRound && activeKnockoutMatches.length > 0 && (() => {
      const scorable = activeKnockoutMatches.filter(
        (m) => m.status !== 'completed' && m.entry_a_id && m.entry_b_id && m.outcome !== 'bye',
      )
      const completedKnockout = activeKnockoutMatches.filter(
        (m) => m.status === 'completed' && m.outcome !== 'bye',
      )
      const finalMatch = knockoutMatches.find(
        (m) => matchEffectiveRound(m, knockoutMatches) === 'final',
      )
      const knockoutDone = finalMatch?.status === 'completed'
      const waitingOnEarlierRound =
        activeKnockoutRound != null &&
        hasPendingEarlierKnockoutRound(knockoutMatches, activeKnockoutRound)

      return (
        <section className="space-y-4">
          <KnockoutBracket
            matches={activeKnockoutMatches}
            round={activeKnockoutRound ?? undefined}
            allMatches={knockoutMatches}
          />
          {scorable.length > 0 && (
            <div className="space-y-3">
              {scorable.map((m) => (
                <MatchScoreEntry
                  key={m.id}
                  eventType={event.event_type}
                  config={cfg}
                  match={m}
                  stage={setRulesStageForRound(matchEffectiveRound(m, knockoutMatches))}
                  onSave={async (data) => {
                    const stage = setRulesStageForRound(
                      matchEffectiveRound(m, knockoutMatches),
                    )
                    await saveKnockoutMatchResult(m.id, data, stage)
                    await onRefresh()
                  }}
                />
              ))}
            </div>
          )}
          {completedKnockout.length > 0 && (
            <details className="group">
              <summary className="flex items-center justify-between bg-card rounded-xl border border-border px-3.5 py-3 cursor-pointer list-none">
                <span className="text-sm font-semibold text-text-bluewhite">
                  Completed ({completedKnockout.length})
                </span>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-steel group-open:rotate-180 transition-transform" aria-hidden>
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </summary>
              <div className="mt-2 space-y-2">
                {completedKnockout.map((m) => (
                  <div key={m.id} className="rounded-[10px] border border-border bg-card-raised px-3.5 py-2.5">
                    <MatchScoreEntry
                      eventType={event.event_type}
                      config={cfg}
                      match={m}
                      stage={setRulesStageForRound(matchEffectiveRound(m, knockoutMatches))}
                      allowEdit={!knockoutMatchHasCompletedDependents(m.id, knockoutMatches)}
                      onSave={async (data) => {
                        const stage = setRulesStageForRound(
                          matchEffectiveRound(m, knockoutMatches),
                        )
                        const { warnings: editWarnings } = await updateKnockoutMatchResult(
                          m.id,
                          data,
                          stage,
                        )
                        if (editWarnings.length) {
                          onWarnings(editWarnings)
                        }
                        onMessage('Score updated.')
                        await onRefresh()
                      }}
                    />
                  </div>
                ))}
              </div>
            </details>
          )}
          {scorable.length === 0 &&
            activeKnockoutRound === 'semi' &&
            finalMatch &&
            finalMatch.status !== 'completed' &&
            !waitingOnEarlierRound && (
            <div className="rounded-xl border border-border bg-card-raised p-3.5 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-steel">FINAL · WAITING</p>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-text-steel truncate">
                  {finalMatch.entry_a ? getEntryDisplayName(finalMatch.entry_a) : 'Winner SF1'}
                </span>
                <span className="text-xs text-text-steel shrink-0">vs</span>
                <span className="font-semibold text-text-steel truncate text-right">
                  {finalMatch.entry_b ? getEntryDisplayName(finalMatch.entry_b) : 'Winner SF2'}
                </span>
              </div>
            </div>
          )}
          {scorable.length === 0 && activeKnockoutRound !== 'final' && !knockoutDone && waitingOnEarlierRound && (
            <p className="text-sm text-text-steel">
              Waiting for earlier round results — winners advance automatically.
            </p>
          )}
          {knockoutDone && activeKnockoutRound === 'final' && (
            <p className="text-sm text-accent-text font-semibold">
              Division complete. Use <strong>Delete division data</strong> below to remove all records.
            </p>
          )}
        </section>
      )
    })()}
    </>
  )
}
