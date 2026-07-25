import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AdminLayout } from '../../components/AdminLayout'
import {
  AdminPageTitle,
  BackLink,
  Button,
  CaptionText,
  Card,
  DestructiveTextButton,
  ErrorMessage,
  MutedPanel,
  Pill,
  SubsectionTitle,
  SuccessMessage,
  TextInput,
} from '../../components/ui/primitives'
import { GroupStandingsTable } from '../../components/GroupStandingsTable'
import { GroupRankEditor } from '../../components/GroupRankEditor'
import { GroupStageNavigator } from '../../components/GroupStageNavigator'
import { KnockoutBracket } from '../../components/KnockoutBracket'
import { MatchScoreEntry } from '../../components/MatchScoreEntry'
import { EntryRow } from '../../components/EntryRow'
import { ConflictWarnings } from '../../components/ConflictWarnings'
import { SeededSelect } from '../../components/SeededSelect'
import {
  fetchTournament,
  fetchEvent,
  fetchEntries,
  updateEvent,
  deleteEvent,
  deleteEntry,
  addTeamEntry,
  addPlayerEntry,
  addPairEntry,
  setupGroupsAndMatches,
  fetchGroups,
  fetchGroupMembers,
  fetchGroupMatches,
  fetchKnockoutMatches,
  saveGroupMatchResult,
  saveGroupRankOrder,
  clearGroupRankOrder,
  regenerateKnockoutFromRanks,
  saveKnockoutMatchResult,
  propagateKnockoutWinners,
} from '../../lib/tournamentService'
import { assignEntriesToGroups } from '../../lib/groupAssignment'
import { getStartLayoutOptions, parseSeededValue } from '../../lib/groupLayout'
import { buildKnockoutStageTabs, isKnockoutStage, knockoutRoundFromStageId } from '../../lib/knockoutTabs'
import { computeStandings, resolveGroupStandings } from '../../lib/standings'
import { validateTournamentStart } from '../../lib/matchOutcomes'
import { getEntryDisplayName, getEventDisplayName, isPlayerEventType } from '../../lib/displayNames'
import {
  duplicateEntryWarnings,
  hasBlockingDuplicates,
  validateNewEntry,
} from '../../lib/entryValidation'
import { STATUS_LABELS } from '../../lib/constants'
import { useRealtimeEvent } from '../../hooks/useRealtimeEvent'
import type { Tournament, TournamentEvent, TournamentEntry, Group } from '../../types'

function statusPillVariant(status: TournamentEvent['status']): 'live' | 'upcoming' | 'draft' | 'ended' {
  if (status === 'ongoing') return 'live'
  if (status === 'upcoming') return 'upcoming'
  if (status === 'draft') return 'draft'
  return 'ended'
}

export function AdminEventPage() {
  const { tournamentId, eventId } = useParams<{ tournamentId: string; eventId: string }>()
  const navigate = useNavigate()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [event, setEvent] = useState<TournamentEvent | null>(null)
  const [entries, setEntries] = useState<TournamentEntry[]>([])
  const [groupMatches, setGroupMatches] = useState<Awaited<ReturnType<typeof fetchGroupMatches>>>([])
  const [knockoutMatches, setKnockoutMatches] = useState<Awaited<ReturnType<typeof fetchKnockoutMatches>>>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [members, setMembers] = useState<{ group_id: string; entry_id: string }[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [activeStage, setActiveStage] = useState<string>('')
  const [startLayoutKey, setStartLayoutKey] = useState<string>()
  const loadSeq = useRef(0)
  const knockoutSynced = useRef<string | null>(null)

  const fetchEventData = useCallback(async () => {
    if (!tournamentId || !eventId) return
    const seq = ++loadSeq.current
    const [t, ev, e, g, gm, km] = await Promise.all([
      fetchTournament(tournamentId),
      fetchEvent(tournamentId, eventId),
      fetchEntries(eventId),
      fetchGroups(eventId),
      fetchGroupMatches(eventId),
      fetchKnockoutMatches(eventId),
    ])
    if (seq !== loadSeq.current) return
    const m = g.length ? await fetchGroupMembers(eventId, g.map((x) => x.id)) : []
    setTournament(t)
    setEvent(ev)
    setEntries(e)
    setGroups(g)
    setGroupMatches(gm)
    setKnockoutMatches(km)
    setMembers(m.map((x) => ({ group_id: x.group_id, entry_id: x.entry_id })))
  }, [tournamentId, eventId])

  useEffect(() => {
    let cancelled = false
    async function init() {
      setError('')
      try {
        await fetchEventData()
        if (cancelled || !eventId) return
        if (knockoutSynced.current !== eventId) {
          knockoutSynced.current = eventId
          await propagateKnockoutWinners(eventId)
          if (!cancelled) await fetchEventData()
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      }
    }
    init()
    return () => {
      cancelled = true
      loadSeq.current++
    }
  }, [eventId, fetchEventData])

  useRealtimeEvent(eventId, fetchEventData)

  const entryMap = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries])

  const groupStageData = useMemo(() => {
    return groups.map((group) => {
      const entryIds = members.filter((m) => m.group_id === group.id).map((m) => m.entry_id)
      const matches = groupMatches.filter((m) => m.group_id === group.id)
      const pending = matches.filter((m) => m.status !== 'completed')
      const completed = matches.filter((m) => m.status === 'completed')
      const computedRows = computeStandings(entryIds, matches, entryMap)
      return {
        group,
        entryIds,
        matches,
        pending,
        completed,
        computedRows,
        rows: resolveGroupStandings(entryIds, matches, entryMap, group.manual_rank_order),
        groupPlayComplete: matches.length > 0 && pending.length === 0,
        hasManualRanks: !!group.manual_rank_order?.length,
      }
    })
  }, [groups, members, groupMatches, entryMap])

  const allGroupPlayComplete =
    groupStageData.length > 0 && groupStageData.every((g) => g.groupPlayComplete)

  const knockoutHasScores = knockoutMatches.some((m) => m.status === 'completed')

  const stageTabs = useMemo(() => {
    const tabs = groupStageData.map(({ group, pending }) => ({
      id: group.id,
      label: `Group ${group.label}`,
      pendingCount: pending.length,
    }))
    tabs.push(...buildKnockoutStageTabs(knockoutMatches))
    return tabs
  }, [groupStageData, knockoutMatches])

  useEffect(() => {
    if (!stageTabs.length) return
    setActiveStage((prev) => (stageTabs.some((t) => t.id === prev) ? prev : stageTabs[0].id))
  }, [stageTabs])

  const activeGroupStage = groupStageData.find((g) => g.group.id === activeStage)

  const activeKnockoutRound = isKnockoutStage(activeStage) ? knockoutRoundFromStageId(activeStage) : null
  const activeKnockoutMatches = activeKnockoutRound
    ? knockoutMatches.filter((m) => m.round === activeKnockoutRound)
    : []

  const startLayoutOptions = useMemo(() => {
    if (!event) return []
    return getStartLayoutOptions(entries.length, event.config)
  }, [event, entries.length])

  useEffect(() => {
    if (!startLayoutOptions.length) return
    setStartLayoutKey((prev) =>
      prev && startLayoutOptions.some((o) => o.key === prev) ? prev : startLayoutOptions[0].key,
    )
  }, [startLayoutOptions])

  const startPreview = useMemo(() => {
    if (!event) return null
    return validateTournamentStart(entries.length, event.config, startLayoutKey)
  }, [event, entries.length, startLayoutKey])

  const duplicateWarnings = useMemo(() => duplicateEntryWarnings(entries), [entries])

  const assignmentWarnings = useMemo(() => {
    let groupCount: number | undefined
    let groupSizes: number[] | undefined
    if (event?.status === 'ongoing') {
      groupCount = event.config.group_count
      groupSizes = event.config.group_sizes
    } else if (startPreview?.ok) {
      groupCount = startPreview.groupCount
      groupSizes = startPreview.groupSizes
    }
    if (!groupCount || entries.length === 0) return []
    const { warnings: w } = assignEntriesToGroups(entries, groupCount, groupSizes)
    return w.map((x) => x.message)
  }, [entries, event, startPreview])

  const canManageEntries =
    event?.status === 'draft' || event?.status === 'upcoming'

  const handleAddEntry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!tournamentId || !eventId || !event) return
    const formEl = e.currentTarget
    const form = new FormData(formEl)
    setLoading(true)
    setError('')
    try {
      const seeded = parseSeededValue(form.get('seeded'))
      if (event.event_type === 'team') {
        const roster = (form.get('roster') as string).split(',').map((s) => s.trim()).filter(Boolean)
        const name = form.get('name') as string
        const dup = validateNewEntry(entries, event.event_type, { type: 'team', name, roster })
        if (dup) {
          setError(dup)
          return
        }
        await addTeamEntry(tournamentId, eventId, {
          name,
          organization: form.get('organization') as string,
          seeded,
          roster,
        })
      } else if (isPlayerEventType(event.event_type)) {
        const name = form.get('name') as string
        const dup = validateNewEntry(entries, event.event_type, { type: 'player', name })
        if (dup) {
          setError(dup)
          return
        }
        await addPlayerEntry(tournamentId, eventId, {
          name,
          organization: form.get('organization') as string,
          seeded,
        })
      } else if (event.event_type === 'doubles') {
        const pairInput = {
          type: 'pair' as const,
          pair_name: form.get('pair_name') as string,
          player_a: form.get('player_a') as string,
          player_b: form.get('player_b') as string,
        }
        const dup = validateNewEntry(entries, event.event_type, pairInput)
        if (dup) {
          setError(dup)
          return
        }
        await addPairEntry(tournamentId, eventId, {
          ...pairInput,
          organization: form.get('organization') as string,
          seeded,
        })
      }
      formEl.reset()
      setMessage('Entry added')
      await fetchEventData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add entry')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteEntry = async (entry: TournamentEntry) => {
    if (!confirm(`Remove ${getEntryDisplayName(entry)}?`)) return
    setLoading(true)
    setError('')
    try {
      await deleteEntry(entry)
      setMessage('Entry removed')
      await fetchEventData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove entry')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteEvent = async () => {
    if (!tournament || !event || !tournamentId) return
    if (!confirm(`Delete "${getEventDisplayName(event)}" and all its data?`)) return
    setLoading(true)
    try {
      await deleteEvent(tournamentId, event.id)
      navigate(`/admin/tournaments/${tournamentId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
      setLoading(false)
    }
  }

  const refreshKnockoutFromRanks = async () => {
    if (!tournamentId || !eventId) return
    const warnings = await regenerateKnockoutFromRanks(tournamentId, eventId)
    if (warnings.length) setWarnings(warnings.map((w) => w.message))
    await fetchEventData()
    const kmUpdated = await fetchKnockoutMatches(eventId)
    const firstKnockoutTab = buildKnockoutStageTabs(kmUpdated)[0]
    if (firstKnockoutTab) setActiveStage(firstKnockoutTab.id)
  }

  const handleSaveGroupRanks = async (
    groupId: string,
    orderedEntryIds: string[],
    note: string | null,
  ) => {
    if (!tournamentId || !eventId) return
    setLoading(true)
    setError('')
    try {
      await saveGroupRankOrder(groupId, orderedEntryIds, note)
      setMessage('Group ranks saved')
      await fetchEventData()
      const km = await fetchKnockoutMatches(eventId)
      if (km.length > 0 && !km.some((m) => m.status === 'completed')) {
        await refreshKnockoutFromRanks()
        setMessage('Group ranks saved — knockout bracket updated')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save ranks')
    } finally {
      setLoading(false)
    }
  }

  const handleClearGroupRanks = async (groupId: string) => {
    if (!tournamentId || !eventId) return
    setLoading(true)
    setError('')
    try {
      await clearGroupRankOrder(groupId)
      setMessage('Ranks reset to automatic tie-break')
      await fetchEventData()
      const km = await fetchKnockoutMatches(eventId)
      if (km.length > 0 && !km.some((m) => m.status === 'completed')) {
        await refreshKnockoutFromRanks()
        setMessage('Ranks reset — knockout bracket updated')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset ranks')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateKnockout = async () => {
    if (!tournamentId || !eventId) return
    setLoading(true)
    setError('')
    try {
      await refreshKnockoutFromRanks()
      setMessage('Knockout bracket generated')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate knockout')
    } finally {
      setLoading(false)
    }
  }

  const changeStatus = async (status: TournamentEvent['status']) => {
    if (!tournamentId || !event) return
    setLoading(true)
    setError('')
    try {
      let statusMessage = `Status updated to ${status}`
      if (status === 'ongoing') {
        const freshEntries = await fetchEntries(event.id)
        if (hasBlockingDuplicates(freshEntries, event.event_type)) {
          setError('Remove duplicate entries before starting this division')
          return
        }
        const check = validateTournamentStart(freshEntries.length, event.config, startLayoutKey)
        if (!check.ok) {
          setError(check.error ?? 'Cannot start')
          return
        }
        const { group_sizes: _prev, ...configBase } = event.config
        const updatedConfig = {
          ...configBase,
          entries_per_group: check.entriesPerGroup!,
          group_count: check.groupCount!,
          ...(check.groupSizes ? { group_sizes: check.groupSizes } : {}),
        }
        const updated = await updateEvent(tournamentId, event.id, { config: updatedConfig })
        await setupGroupsAndMatches(tournamentId, { ...updated, config: updatedConfig }, freshEntries)
        await updateEvent(tournamentId, event.id, { status: 'ongoing' })
        const layoutLabel = check.uneven
          ? `${check.groupCount} groups (${check.groupSizes!.join('+')})`
          : `${check.groupCount} groups × ${check.entriesPerGroup}`
        statusMessage = `Started with ${freshEntries.length} entries → ${layoutLabel}`
      } else if (status === 'ended') {
        if (!confirm('End this division? All its data will be deleted.')) return
        await updateEvent(tournamentId, event.id, { status: 'ended' })
        navigate(`/admin/tournaments/${tournamentId}`)
        return
      } else {
        await updateEvent(tournamentId, event.id, { status })
      }
      setMessage(statusMessage)
      await fetchEventData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed')
    } finally {
      setLoading(false)
    }
  }

  if (!tournament || !event) {
    return (
      <AdminLayout>
        <p className="text-slate-500">Loading…</p>
      </AdminLayout>
    )
  }

  const cfg = event.config
  const rosterSize = cfg.roster_size ?? 3
  const startDisabled =
    loading ||
    entries.length < 2 ||
    hasBlockingDuplicates(entries, event.event_type) ||
    !startPreview?.ok

  return (
    <AdminLayout>
      <div className="space-y-4">
        <BackLink to={`/admin/tournaments/${tournamentId}`}>← {tournament.name}</BackLink>

        <div className="flex items-start justify-between gap-2">
          <AdminPageTitle>{getEventDisplayName(event)}</AdminPageTitle>
          <Pill variant={statusPillVariant(event.status)}>
            {event.status === 'ongoing' ? 'Live' : STATUS_LABELS[event.status]}
          </Pill>
        </div>

        <CaptionText>
          Knockout: {(cfg.knockout_bracket ?? 'cross') === 'block' ? 'Block (A vs B, C vs D)' : 'Cross'}
        </CaptionText>

        {(event.status === 'draft' || event.status === 'upcoming') && (
          <DestructiveTextButton onClick={handleDeleteEvent}>Delete division</DestructiveTextButton>
        )}

        {event.status === 'ongoing' && (
          <DestructiveTextButton onClick={() => changeStatus('ended')}>End division</DestructiveTextButton>
        )}

        {message && <SuccessMessage>{message}</SuccessMessage>}
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <ConflictWarnings warnings={[...duplicateWarnings, ...assignmentWarnings, ...warnings]} />

        {event.status === 'draft' && (
          <Button disabled={loading} onClick={() => changeStatus('upcoming')} fullWidth>
            Publish
          </Button>
        )}

        {event.status === 'upcoming' && (
          <Button
            disabled={startDisabled}
            onClick={() => changeStatus('ongoing')}
            fullWidth
            title={
              hasBlockingDuplicates(entries, event.event_type)
                ? 'Remove duplicate entries first'
                : undefined
            }
          >
            Start division
          </Button>
        )}

        {event.status === 'upcoming' && entries.length >= 2 && (
          <MutedPanel>
            <p className="text-sm font-medium text-slate-900">Ready to start</p>
            {entries.length < cfg.total_slots && (
              <p className="text-[13px] text-slate-600">
                {entries.length} of {cfg.total_slots} slots filled — groups based on registered entries
              </p>
            )}
            {startPreview?.ok ? (
              <>
                <p className="text-xs text-slate-400">
                  Layout preview:{' '}
                  {startPreview.uneven
                    ? `${startPreview.groupCount} groups (${startPreview.groupSizes!.join('+')})`
                    : `${startPreview.groupCount} groups × ${startPreview.entriesPerGroup}`}
                  {startPreview.adjusted && ' (adjusted)'}
                </p>
                {startLayoutOptions.length > 0 && (
                  <div className="space-y-2 pt-1">
                    {startLayoutOptions.map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setStartLayoutKey(opt.key)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg border text-[13px] ${
                          startLayoutKey === opt.key
                            ? 'border-brand-600 bg-brand-50 text-slate-900'
                            : 'border-slate-200 bg-white text-slate-900'
                        }`}
                      >
                        {opt.label}
                        {opt.uneven && (
                          <span className="text-xs text-slate-500 ml-2">uneven groups</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              startPreview && <p className="text-sm text-red-600">{startPreview.error}</p>
            )}
          </MutedPanel>
        )}

      {canManageEntries && (
        <section className="mt-8 space-y-3">
          <SubsectionTitle>
            Add entries ({entries.length}/{cfg.total_slots})
          </SubsectionTitle>
          <CaptionText>Max {cfg.total_slots} slots — publish empty and add entries as they register.</CaptionText>
          <form onSubmit={handleAddEntry} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
            {event.event_type === 'team' && (
              <>
                <TextInput name="name" placeholder="Team name" required />
                <TextInput name="organization" placeholder="Organization (e.g. Mecttel)" />
                <TextInput name="roster" placeholder={`Roster names, comma-separated (e.g. 3–${rosterSize} players)`} required />
                <SeededSelect />
              </>
            )}
            {isPlayerEventType(event.event_type) && (
              <>
                <TextInput name="name" placeholder="Player name" required />
                <TextInput name="organization" placeholder="Organization (e.g. Mecttel)" required />
                <SeededSelect />
              </>
            )}
            {event.event_type === 'doubles' && (
              <>
                <TextInput name="pair_name" placeholder="Pair name (optional)" />
                <TextInput name="player_a" placeholder="Player A" required />
                <TextInput name="player_b" placeholder="Player B" required />
                <TextInput name="organization" placeholder="Organization (optional)" />
                <SeededSelect />
              </>
            )}
            <Button type="submit" disabled={loading || entries.length >= cfg.total_slots} fullWidth>
              {loading ? 'Adding…' : 'Add entry'}
            </Button>
          </form>

          <div className="space-y-2">
            {entries.map((entry) => (
              <EntryRow key={entry.id} entry={entry} onRemove={() => handleDeleteEntry(entry)} />
            ))}
          </div>
        </section>
      )}

      {event.status === 'ongoing' && groups.length > 0 && (
        <>
          <GroupStageNavigator tabs={stageTabs} activeId={activeStage} onChange={setActiveStage} />

          {activeGroupStage && (
            <section className="space-y-4">
              <GroupStandingsTable
                label={activeGroupStage.group.label}
                rows={activeGroupStage.rows}
                manualRanks={activeGroupStage.hasManualRanks}
                manualRankNote={activeGroupStage.group.manual_rank_note}
              />

              {activeGroupStage.groupPlayComplete && (
                <GroupRankEditor
                  groupLabel={activeGroupStage.group.label}
                  rows={activeGroupStage.computedRows}
                  manualRankOrder={activeGroupStage.group.manual_rank_order}
                  manualRankNote={activeGroupStage.group.manual_rank_note}
                  saving={loading}
                  onSave={(orderedEntryIds, note) =>
                    handleSaveGroupRanks(activeGroupStage.group.id, orderedEntryIds, note)
                  }
                  onClear={() => handleClearGroupRanks(activeGroupStage.group.id)}
                />
              )}

              {activeGroupStage.pending.length > 0 && (
                <div>
                  <SubsectionTitle>To score ({activeGroupStage.pending.length})</SubsectionTitle>
                  <div className="space-y-3">
                    {activeGroupStage.pending.map((m) => (
                      <MatchScoreEntry
                        key={m.id}
                        eventType={event.event_type}
                        config={cfg}
                        match={m}
                        stage="group"
                        onSave={async (data) => {
                          await saveGroupMatchResult(m.id, data)
                          await fetchEventData()
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {activeGroupStage.completed.length > 0 && (
                <details className="mt-4 group">
                  <summary className="text-sm font-medium text-slate-500 cursor-pointer list-none flex items-center gap-1">
                    <span className="group-open:rotate-90 transition-transform">▸</span>
                    Completed ({activeGroupStage.completed.length})
                  </summary>
                  <div className="mt-2 space-y-2">
                    {activeGroupStage.completed.map((m) => (
                      <MatchScoreEntry
                        key={m.id}
                        eventType={event.event_type}
                        config={cfg}
                        match={m}
                        stage="group"
                        onSave={async () => {}}
                      />
                    ))}
                  </div>
                </details>
              )}
            </section>
          )}

          {allGroupPlayComplete && (
            <Card className="p-4 space-y-3">
              <SubsectionTitle>Knockout stage</SubsectionTitle>
              {knockoutMatches.length === 0 ? (
                <>
                  <CaptionText>
                    Knockout does not generate automatically. Score all group matches first. If any group
                    needs head-to-head ranks from paper, set and save ranks on each group tab, then generate
                    the bracket below.
                  </CaptionText>
                  <Button type="button" onClick={handleGenerateKnockout} disabled={loading} fullWidth>
                    Generate knockout bracket
                  </Button>
                </>
              ) : (
                <>
                  <CaptionText>
                    {knockoutHasScores
                      ? 'Knockout matches are already scored — group ranks can no longer update the bracket.'
                      : 'Update group ranks above, then refresh the bracket before scoring knockout matches.'}
                  </CaptionText>
                  {!knockoutHasScores && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleGenerateKnockout}
                      disabled={loading}
                      fullWidth
                    >
                      Regenerate knockout from ranks
                    </Button>
                  )}
                </>
              )}
            </Card>
          )}

          {activeKnockoutRound && activeKnockoutMatches.length > 0 && (() => {
            const scorable = activeKnockoutMatches.filter(
              (m) => m.status !== 'completed' && m.entry_a_id && m.entry_b_id && m.outcome !== 'bye',
            )
            const finalMatch = knockoutMatches.find((m) => m.round === 'final')
            const knockoutDone = finalMatch?.status === 'completed'

            return (
              <section className="space-y-4">
                <KnockoutBracket matches={activeKnockoutMatches} round={activeKnockoutRound} />
                {scorable.length > 0 && (
                  <div>
                    <SubsectionTitle>
                      Pending{' '}
                      {activeKnockoutRound === 'final'
                        ? 'final'
                        : activeKnockoutRound === 'semi'
                          ? 'semifinals'
                          : 'quarterfinals'}
                    </SubsectionTitle>
                    <div className="mt-3 space-y-3">
                      {scorable.map((m) => (
                        <MatchScoreEntry
                          key={m.id}
                          eventType={event.event_type}
                          config={cfg}
                          match={m}
                          stage={
                            m.round === 'final' ? 'finals' : m.round === 'semi' ? 'semis' : 'quarters'
                          }
                          onSave={async (data) => {
                            await saveKnockoutMatchResult(m.id, data)
                            await fetchEventData()
                          }}
                        />
                      ))}
                    </div>
                    <p className="mt-4 text-sm text-slate-600">
                      Score the{' '}
                      {activeKnockoutRound === 'final'
                        ? 'final'
                        : activeKnockoutRound === 'semi'
                          ? 'semifinal'
                          : 'quarterfinal'}{' '}
                      above to continue.
                    </p>
                  </div>
                )}
                {scorable.length === 0 && activeKnockoutRound !== 'final' && !knockoutDone && (
                  <p className="text-sm text-slate-500">
                    Waiting for earlier round results — winners advance automatically.
                  </p>
                )}
                {knockoutDone && activeKnockoutRound === 'final' && (
                  <p className="text-sm text-brand-700 font-medium">
                    Division complete. Click <strong>End division</strong> to remove data.
                  </p>
                )}
              </section>
            )
          })()}
        </>
      )}
      </div>
    </AdminLayout>
  )
}
