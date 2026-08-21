import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AdminLayout } from '../../components/AdminLayout'
import {
  AddEntryButton,
  BackLink,
  Button,
  CaptionText,
  DeleteDivisionButton,
  EmptyMessage,
  EventAdminTitle,
  FormLabel,
  InfoNoteCard,
  IconActionButton,
  PanelSectionTitle,
  Pill,
  SectionHeaderRow,
  TextInput,
  WarningBanner,
} from '../../components/ui/primitives'
import { GroupStandingsTable } from '../../components/GroupStandingsTable'
import { GroupRankEditor } from '../../components/GroupRankEditor'
import { GroupStageNavigator } from '../../components/GroupStageNavigator'
import { KnockoutBracket } from '../../components/KnockoutBracket'
import { MatchScoreEntry } from '../../components/MatchScoreEntry'
import { EntryEditDialog, type EntryEditFormState } from '../../components/EntryEditDialog'
import { ConflictWarnings } from '../../components/ConflictWarnings'
import { SeededSelect } from '../../components/SeededSelect'
import { LateEntryDialog } from '../../components/LateEntryDialog'
import { MoveEntryDialog } from '../../components/MoveEntryDialog'
import { GenerateGroupStageDialog } from '../../components/GenerateGroupStageDialog'
import { ParticipantsListDialog } from '../../components/ParticipantsListDialog'
import { SetRulesEditorDialog } from '../../components/SetRulesEditorDialog'
import { formatSetRulesSummary, normalizeSetRules } from '../../lib/setRules'
import {
  fetchTournament,
  fetchEvent,
  fetchEntries,
  updateEvent,
  updateEventSetRules,
  deleteEvent,
  deleteEntry,
  moveEntryToGroup,
  addTeamEntry,
  addPlayerEntry,
  addPairEntry,
  updatePlayerEntry,
  updatePairEntry,
  updateTeamEntry,
  generateGroupStage,
  addLateJoinEntry,
  type LateJoinEntryInput,
  fetchGroups,
  fetchGroupMembers,
  fetchGroupMatches,
  fetchKnockoutMatches,
  saveGroupMatchResult,
  saveGroupRankOrder,
  clearGroupRankOrder,
  regenerateKnockoutFromRanks,
  recreateGroupStageFromEntries,
  saveKnockoutMatchResult,
  fetchTeamRosters,
} from '../../lib/tournamentService'
import { assignEntriesToGroups, assignmentWarningsForMembers, canAddEntryToGroup } from '../../lib/groupAssignment'
import {
  getStartLayoutOptions,
  isLayoutCompatibleWithBlock,
  parseSeededValue,
} from '../../lib/groupLayout'
import { suggestBalanceGroup, type GroupSummary } from '../../lib/lateJoinAssignment'
import { buildKnockoutStageTabs, filterKnockoutMatchesForStage, isKnockoutStage, knockoutRoundFromStageId, matchEffectiveRound } from '../../lib/knockoutTabs'
import { hasPendingEarlierKnockoutRound, setRulesStageForRound } from '../../lib/knockoutRounds'
import { computeStandings, resolveGroupStandings, needsManualRankResolution } from '../../lib/standings'
import { validateTournamentStart } from '../../lib/matchOutcomes'
import { getEntryDisplayName, getEventDisplayName, isPlayerEventType } from '../../lib/displayNames'
import {
  duplicateEntryWarnings,
  hasBlockingDuplicates,
  normalizeEntryName,
  rosterNameCollisionWarnings,
  validateNewEntry,
} from '../../lib/entryValidation'
import { FirebaseSetupBanner } from '../../components/FirebaseSetupBanner'
import {
  DivisionConfigForm,
  divisionDraftToSettingsUpdate,
  eventToDivisionDraft,
  type DivisionDraft,
} from '../../components/DivisionConfigForm'
import { STATUS_LABELS } from '../../lib/constants'
import { useRealtimeEvent } from '../../hooks/useRealtimeEvent'
import { useMinLoading } from '../../hooks/useMinLoading'
import { AdminEventPageSkeleton } from '../../components/ui/Skeleton'
import { StatusPopups } from '../../components/ui/StatusPopups'
import { DeleteConfirmDialog } from '../../components/ui/DeleteConfirmDialog'
import type { Tournament, TournamentEvent, TournamentEntry, Group, KnockoutBracketType } from '../../types'

type AdminDivisionTab = 'participants' | 'late-check-in' | 'brackets'

type PendingLateEntry = {
  label: string
  mock: TournamentEntry
  input: LateJoinEntryInput
}

type DeleteConfirmState = {
  title: string
  description: string
  confirmLabel?: string
  confirmingLabel?: string
  onConfirm: () => Promise<void>
}

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
  const [addingEntry, setAddingEntry] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const showPageSkeleton = useMinLoading(pageLoading)
  const [loadError, setLoadError] = useState('')
  const [refreshError, setRefreshError] = useState('')
  const [rosterWarnings, setRosterWarnings] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [activeStage, setActiveStage] = useState<string>('')
  const [adminTab, setAdminTab] = useState<AdminDivisionTab>('participants')
  const [startLayoutKey, setStartLayoutKey] = useState<string>()
  const [pendingLateEntry, setPendingLateEntry] = useState<PendingLateEntry | null>(null)
  const [editingDivision, setEditingDivision] = useState(false)
  const [editDraft, setEditDraft] = useState<DivisionDraft | null>(null)
  const [editingEntry, setEditingEntry] = useState<TournamentEntry | null>(null)
  const [editingEntryRoster, setEditingEntryRoster] = useState<string[] | undefined>()
  const [entryEditError, setEntryEditError] = useState('')
  const [pageErrorDismissed, setPageErrorDismissed] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null)
  const [participantsDialogOpen, setParticipantsDialogOpen] = useState(false)
  const [movingEntry, setMovingEntry] = useState<TournamentEntry | null>(null)
  const [setRulesDialogOpen, setSetRulesDialogOpen] = useState(false)
  const [readyDialogOpen, setReadyDialogOpen] = useState(false)
  const loadSeq = useRef(0)
  const isInitialLoad = useRef(true)

  const fetchEventData = useCallback(async () => {
    if (!tournamentId || !eventId) return
    const seq = ++loadSeq.current
    try {
      const [t, ev, e, g, gm, km] = await Promise.all([
        fetchTournament(tournamentId),
        fetchEvent(tournamentId, eventId),
        fetchEntries(tournamentId, eventId),
        fetchGroups(tournamentId, eventId),
        fetchGroupMatches(tournamentId, eventId),
        fetchKnockoutMatches(tournamentId, eventId),
      ])
      if (seq !== loadSeq.current) return
      const m = g.length ? await fetchGroupMembers(tournamentId, eventId, g.map((x) => x.id)) : []
      if (seq !== loadSeq.current) return
      setTournament(t)
      setEvent(ev)
      setEntries(e)
      setGroups(g)
      setGroupMatches(gm)
      setKnockoutMatches(km)
      setMembers(m.map((x) => ({ group_id: x.group_id, entry_id: x.entry_id })))
      setLoadError('')
      setRefreshError('')
      if (isInitialLoad.current) {
        isInitialLoad.current = false
        setPageLoading(false)
      }
    } catch (e) {
      if (seq !== loadSeq.current) return
      const msg = e instanceof Error ? e.message : 'Failed to load division'
      if (isInitialLoad.current) {
        setLoadError(msg)
        isInitialLoad.current = false
        setPageLoading(false)
      } else {
        setRefreshError(msg)
      }
    }
  }, [tournamentId, eventId])

  useEffect(() => {
    isInitialLoad.current = true
    setPageLoading(true)
    setLoadError('')
    setPageErrorDismissed(false)
    setTournament(null)
    setEvent(null)
    void fetchEventData()
  }, [eventId, fetchEventData])

  const handleRealtimeError = useCallback((msg: string) => {
    setRefreshError(msg)
  }, [])

  useRealtimeEvent(
    pageLoading ? undefined : tournamentId,
    pageLoading ? undefined : eventId,
    fetchEventData,
    handleRealtimeError,
  )

  useEffect(() => {
    if (!event || event.event_type !== 'team') {
      setRosterWarnings([])
      return
    }
    const teamIds = entries.filter((e) => e.team_id).map((e) => e.team_id!)
    if (!teamIds.length) {
      setRosterWarnings([])
      return
    }
    let cancelled = false
    fetchTeamRosters(teamIds).then((rosters) => {
      if (cancelled) return
      const map = new Map<string, string[]>()
      for (const entry of entries) {
        if (entry.team_id) {
          map.set(
            entry.team_id,
            rosters.filter((r) => r.team_id === entry.team_id).map((r) => r.name),
          )
        }
      }
      setRosterWarnings(rosterNameCollisionWarnings(entries, map))
    })
    return () => {
      cancelled = true
    }
  }, [entries, event])

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

  const pendingGroupMatchCount = groupStageData.reduce((n, g) => n + g.pending.length, 0)
  const groupsAwaitingScores = groupStageData.filter((g) => !g.groupPlayComplete)

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
  const activeKnockoutMatches = isKnockoutStage(activeStage)
    ? filterKnockoutMatchesForStage(knockoutMatches, activeStage)
    : []

  const isBlockBracket = (event?.config.knockout_bracket ?? 'cross') === 'block'

  const allLayoutOptions = useMemo(() => {
    if (!event) return []
    return getStartLayoutOptions(entries.length, event.config)
  }, [event, entries.length])

  const isLayoutSelectable = useCallback(
    (option: (typeof allLayoutOptions)[number]) =>
      !isBlockBracket || isLayoutCompatibleWithBlock(option),
    [isBlockBracket],
  )

  const selectableLayoutOptions = useMemo(
    () => allLayoutOptions.filter(isLayoutSelectable),
    [allLayoutOptions, isLayoutSelectable],
  )

  useEffect(() => {
    if (!selectableLayoutOptions.length) {
      setStartLayoutKey(undefined)
      return
    }
    setStartLayoutKey((prev) =>
      prev && selectableLayoutOptions.some((o) => o.key === prev)
        ? prev
        : selectableLayoutOptions[0].key,
    )
  }, [selectableLayoutOptions])

  useEffect(() => {
    setWarnings([])
  }, [startLayoutKey])

  const startPreview = useMemo(() => {
    if (!event) return null
    return validateTournamentStart(entries.length, event.config, startLayoutKey)
  }, [event, entries.length, startLayoutKey])

  const duplicateWarnings = useMemo(
    () => [...duplicateEntryWarnings(entries), ...rosterWarnings],
    [entries, rosterWarnings],
  )

  const assignmentWarnings = useMemo(() => {
    if (entries.length === 0) return []

    if (event?.status === 'ongoing' && groups.length > 0) {
      const assignedCount = members.filter((m) => entries.some((e) => e.id === m.entry_id)).length
      if (assignedCount === entries.length) {
        return assignmentWarningsForMembers(entries, groups, members).map((x) => x.message)
      }
      if (assignedCount < entries.length) {
        const unassigned = entries.length - assignedCount
        return [
          `${unassigned} participant${unassigned === 1 ? '' : 's'} not assigned to a group`,
        ]
      }
      return []
    }

    let groupCount: number | undefined
    let groupSizes: number[] | undefined
    if (startPreview?.ok) {
      groupCount = startPreview.groupCount
      groupSizes = startPreview.groupSizes
    }
    if (!groupCount) return []
    const result = assignEntriesToGroups(entries, groupCount, groupSizes)
    if (result.error) return [result.error]
    return result.warnings.map((x) => x.message)
  }, [entries, event, startPreview, groups, members])

  const knockoutGenerated = knockoutMatches.length > 0

  const canManageOngoingParticipants =
    event?.status === 'ongoing' && !knockoutGenerated && groups.length > 0

  const conflictWarnings = useMemo(() => {
    const list = [...duplicateWarnings, ...assignmentWarnings]
    if (event?.status === 'ongoing' || knockoutGenerated) {
      list.push(...warnings)
    }
    return [...new Set(list.filter(Boolean))]
  }, [duplicateWarnings, assignmentWarnings, warnings, event?.status, knockoutGenerated])

  const groupSummaries = useMemo((): GroupSummary[] => {
    return groups.map((group) => ({
      groupId: group.id,
      label: group.label,
      entries: members
        .filter((m) => m.group_id === group.id)
        .map((m) => entryMap.get(m.entry_id))
        .filter(Boolean) as TournamentEntry[],
    }))
  }, [groups, members, entryMap])

  const entryGroupLabelMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const member of members) {
      const group = groups.find((g) => g.id === member.group_id)
      if (group) map.set(member.entry_id, group.label)
    }
    return map
  }, [members, groups])

  const moveTargetGroups = useMemo(() => {
    if (!movingEntry) return []
    const currentGroupId = members.find((m) => m.entry_id === movingEntry.id)?.group_id
    return groupSummaries.filter((g) => g.groupId !== currentGroupId)
  }, [movingEntry, members, groupSummaries])

  useEffect(() => {
    if (movingEntry && moveTargetGroups.length === 0) {
      setMovingEntry(null)
    }
  }, [movingEntry, moveTargetGroups.length])

  const lateJoinSuggestion = useMemo(() => {
    if (!pendingLateEntry) return null
    return suggestBalanceGroup(groupSummaries, pendingLateEntry.mock)
  }, [pendingLateEntry, groupSummaries])

  const buildMockEntry = (
    partial: Partial<TournamentEntry> & Pick<TournamentEntry, 'entry_type' | 'seeded'>,
  ): TournamentEntry => ({
    id: '__pending__',
    tournament_id: tournamentId ?? '',
    event_id: eventId ?? '',
    team_id: null,
    player_id: null,
    pair_id: null,
    ...partial,
  })

  const handleLateJoinConfirm = async (mode: 'balance' | 'pick' | 'new_group', groupId?: string) => {
    if (!tournamentId || !eventId || !pendingLateEntry) return
    setLoading(true)
    setError('')
    try {
      const { warnings: lateWarnings } = await addLateJoinEntry(
        tournamentId,
        eventId,
        pendingLateEntry.input,
        mode === 'new_group'
          ? { mode: 'new_group' }
          : { mode, groupId: groupId! },
      )
      if (lateWarnings.length) setWarnings(lateWarnings)
      setPendingLateEntry(null)
      setMessage('Late entry added')
      await fetchEventData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add late entry')
    } finally {
      setLoading(false)
    }
  }

  const handleAddEntry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!tournamentId || !eventId || !event) return
    const formEl = e.currentTarget
    const form = new FormData(formEl)
    setAddingEntry(true)
    setError('')
    try {
      const seeded = parseSeededValue(form.get('seeded'))
      const isLateJoin = event.status === 'ongoing' && !knockoutGenerated

      if (event.event_type === 'team') {
        const roster = (form.get('roster') as string).split(',').map((s) => s.trim()).filter(Boolean)
        const name = form.get('name') as string
        const organization = form.get('organization') as string
        const teamIds = entries.filter((e) => e.team_id).map((e) => e.team_id!)
        const existingRosters = teamIds.length ? await fetchTeamRosters(teamIds) : []
        const otherTeamRosterNames = existingRosters.map((r) => normalizeEntryName(r.name))
        const dup = validateNewEntry(entries, event.event_type, { type: 'team', name, roster }, {
          rosterSize: event.config.roster_size,
          otherTeamRosterNames,
        })
        if (dup) {
          setError(dup)
          return
        }
        if (isLateJoin) {
          const mock = buildMockEntry({
            entry_type: 'team',
            seeded,
            team: {
              id: 'pending',
              tournament_id: tournamentId,
              event_id: eventId,
              name,
              organization: organization || null,
              seeded,
            },
          })
          setPendingLateEntry({
            label: name,
            mock,
            input: { type: 'team', name, organization, seeded, roster },
          })
          formEl.reset()
          return
        }
        await addTeamEntry(tournamentId, eventId, {
          name,
          organization,
          seeded,
          roster,
        })
      } else if (isPlayerEventType(event.event_type)) {
        const name = form.get('name') as string
        const organization = form.get('organization') as string
        const dup = validateNewEntry(entries, event.event_type, { type: 'player', name })
        if (dup) {
          setError(dup)
          return
        }
        if (isLateJoin) {
          const mock = buildMockEntry({
            entry_type: 'player',
            seeded,
            player: {
              id: 'pending',
              tournament_id: tournamentId,
              event_id: eventId,
              name,
              organization: organization || null,
              seeded,
            },
          })
          setPendingLateEntry({
            label: name,
            mock,
            input: { type: 'player', name, organization, seeded },
          })
          formEl.reset()
          return
        }
        await addPlayerEntry(tournamentId, eventId, {
          name,
          organization,
          seeded,
        })
      } else if (event.event_type === 'doubles') {
        const pairInput = {
          type: 'pair' as const,
          pair_name: form.get('pair_name') as string,
          player_a: form.get('player_a') as string,
          player_b: form.get('player_b') as string,
        }
        const organization = form.get('organization') as string
        const dup = validateNewEntry(entries, event.event_type, pairInput)
        if (dup) {
          setError(dup)
          return
        }
        if (isLateJoin) {
          const label = pairInput.pair_name.trim() || `${pairInput.player_a} / ${pairInput.player_b}`
          const mock = buildMockEntry({
            entry_type: 'pair',
            seeded,
            pair: {
              id: 'pending',
              tournament_id: tournamentId,
              event_id: eventId,
              pair_name: pairInput.pair_name || null,
              player_a: pairInput.player_a,
              player_b: pairInput.player_b,
              organization: organization || null,
              seeded,
            },
          })
          setPendingLateEntry({
            label,
            mock,
            input: {
              type: 'pair',
              pair_name: pairInput.pair_name,
              player_a: pairInput.player_a,
              player_b: pairInput.player_b,
              organization,
              seeded,
            },
          })
          formEl.reset()
          return
        }
        await addPairEntry(tournamentId, eventId, {
          ...pairInput,
          organization,
          seeded,
        })
      } else {
        setError('Unsupported event type')
        return
      }
      formEl.reset()
      setMessage('Entry added')
      await fetchEventData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add entry')
    } finally {
      setAddingEntry(false)
    }
  }

  const openDivisionEdit = () => {
    if (!event) return
    setEditDraft(eventToDivisionDraft(event))
    setEditingDivision(true)
    setError('')
  }

  const closeDivisionEdit = () => {
    setEditingDivision(false)
    setEditDraft(null)
  }

  const handleSaveDivisionSettings = async () => {
    if (!tournamentId || !event || !editDraft) return
    setLoading(true)
    setError('')
    try {
      if (event.event_type === 'team' && entries.length > 0) {
        const teamIds = entries.filter((e) => e.team_id).map((e) => e.team_id!)
        const rosters = teamIds.length ? await fetchTeamRosters(teamIds) : []
        const wrongSize = teamIds.some((teamId) => {
          const count = rosters.filter((r) => r.team_id === teamId).length
          return count !== editDraft.roster_size
        })
        if (wrongSize) {
          setError(
            `Cannot set roster size to ${editDraft.roster_size} — existing teams have a different roster size. Remove teams first or keep ${event.config.roster_size ?? 3}.`,
          )
          return
        }
      }

      const patch = divisionDraftToSettingsUpdate(editDraft, event)
      await updateEvent(tournamentId, event.id, patch)
      setMessage('Division settings saved')
      setEditingDivision(false)
      setEditDraft(null)
      await fetchEventData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save division settings')
    } finally {
      setLoading(false)
    }
  }

  const applyFormToEntry = (
    entry: TournamentEntry,
    form: EntryEditFormState,
    ev: TournamentEvent,
  ): TournamentEntry => {
    const seeded = form.seeded
    if (ev.event_type === 'team' && entry.team) {
      return {
        ...entry,
        seeded,
        team: {
          ...entry.team,
          name: form.name.trim(),
          organization: form.organization.trim() || null,
          seeded,
        },
      }
    }
    if (isPlayerEventType(ev.event_type) && entry.player) {
      return {
        ...entry,
        seeded,
        player: {
          ...entry.player,
          name: form.name.trim(),
          organization: form.organization.trim() || null,
          seeded,
        },
      }
    }
    if (ev.event_type === 'doubles' && entry.pair) {
      return {
        ...entry,
        seeded,
        pair: {
          ...entry.pair,
          pair_name: form.pair_name.trim() || null,
          player_a: form.player_a.trim(),
          player_b: form.player_b.trim(),
          organization: form.organization.trim() || null,
          seeded,
        },
      }
    }
    return entry
  }

  const handleKnockoutBracketChange = async (knockout_bracket: KnockoutBracketType) => {
    if (!tournamentId || !event) return
    const current = event.config.knockout_bracket ?? 'cross'
    if (knockout_bracket === current) return
    setLoading(true)
    setError('')
    try {
      await updateEvent(tournamentId, event.id, {
        config: { ...event.config, knockout_bracket },
      })
      await fetchEventData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update knockout bracket')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenEditEntry = async (entry: TournamentEntry) => {
    setEntryEditError('')
    setLoading(true)
    try {
      if (entry.entry_type === 'team' && entry.team_id) {
        const rosters = await fetchTeamRosters([entry.team_id])
        setEditingEntryRoster(
          rosters.filter((r) => r.team_id === entry.team_id).map((r) => r.name),
        )
      } else {
        setEditingEntryRoster(undefined)
      }
      setEditingEntry(entry)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load entry')
    } finally {
      setLoading(false)
    }
  }

  const handleCloseEditEntry = () => {
    setEditingEntry(null)
    setEditingEntryRoster(undefined)
    setEntryEditError('')
  }

  const handleSaveEntryEdit = async (form: EntryEditFormState) => {
    if (!event || !editingEntry) return
    setLoading(true)
    setEntryEditError('')
    try {
      const seeded = form.seeded
      const allowRosterEdit =
        event.status === 'draft' || event.status === 'upcoming'

      if (event.event_type === 'team') {
        const rosterNames = allowRosterEdit
          ? form.roster
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : editingEntryRoster ?? []
        const teamIds = entries
          .filter((e) => e.team_id && e.id !== editingEntry.id)
          .map((e) => e.team_id!)
        const existingRosters = teamIds.length ? await fetchTeamRosters(teamIds) : []
        const otherTeamRosterNames = existingRosters.map((r) => normalizeEntryName(r.name))
        const dup = validateNewEntry(
          entries,
          event.event_type,
          { type: 'team', name: form.name, roster: rosterNames },
          {
            excludeEntryId: editingEntry.id,
            rosterSize: allowRosterEdit ? event.config.roster_size : undefined,
            otherTeamRosterNames,
          },
        )
        if (dup) {
          setEntryEditError(dup)
          return
        }

        if (event.status === 'ongoing') {
          const memberGroupId = members.find((m) => m.entry_id === editingEntry.id)?.group_id
          if (memberGroupId) {
            const groupEntries = members
              .filter((m) => m.group_id === memberGroupId && m.entry_id !== editingEntry.id)
              .map((m) => entryMap.get(m.entry_id))
              .filter((e): e is TournamentEntry => !!e)
            const mock = applyFormToEntry(editingEntry, form, event)
            const check = canAddEntryToGroup(groupEntries, mock)
            if (!check.ok) {
              setEntryEditError(check.reason)
              return
            }
          }
        }

        await updateTeamEntry(editingEntry, {
          name: form.name.trim(),
          organization: form.organization.trim() || null,
          seeded,
          roster: allowRosterEdit ? rosterNames : undefined,
        })
      } else if (isPlayerEventType(event.event_type)) {
        const dup = validateNewEntry(
          entries,
          event.event_type,
          { type: 'player', name: form.name },
          { excludeEntryId: editingEntry.id },
        )
        if (dup) {
          setEntryEditError(dup)
          return
        }

        if (event.status === 'ongoing') {
          const memberGroupId = members.find((m) => m.entry_id === editingEntry.id)?.group_id
          if (memberGroupId) {
            const groupEntries = members
              .filter((m) => m.group_id === memberGroupId && m.entry_id !== editingEntry.id)
              .map((m) => entryMap.get(m.entry_id))
              .filter((e): e is TournamentEntry => !!e)
            const mock = applyFormToEntry(editingEntry, form, event)
            const check = canAddEntryToGroup(groupEntries, mock)
            if (!check.ok) {
              setEntryEditError(check.reason)
              return
            }
          }
        }

        await updatePlayerEntry(editingEntry, {
          name: form.name.trim(),
          organization: form.organization.trim() || null,
          seeded,
        })
      } else if (event.event_type === 'doubles') {
        const pairInput = {
          type: 'pair' as const,
          pair_name: form.pair_name,
          player_a: form.player_a,
          player_b: form.player_b,
        }
        const dup = validateNewEntry(entries, event.event_type, pairInput, {
          excludeEntryId: editingEntry.id,
        })
        if (dup) {
          setEntryEditError(dup)
          return
        }

        if (event.status === 'ongoing') {
          const memberGroupId = members.find((m) => m.entry_id === editingEntry.id)?.group_id
          if (memberGroupId) {
            const groupEntries = members
              .filter((m) => m.group_id === memberGroupId && m.entry_id !== editingEntry.id)
              .map((m) => entryMap.get(m.entry_id))
              .filter((e): e is TournamentEntry => !!e)
            const mock = applyFormToEntry(editingEntry, form, event)
            const check = canAddEntryToGroup(groupEntries, mock)
            if (!check.ok) {
              setEntryEditError(check.reason)
              return
            }
          }
        }

        await updatePairEntry(editingEntry, {
          pair_name: form.pair_name.trim(),
          player_a: form.player_a.trim(),
          player_b: form.player_b.trim(),
          organization: form.organization.trim() || null,
          seeded,
        })
      }

      setMessage('Entry updated')
      handleCloseEditEntry()
      await fetchEventData()
    } catch (err) {
      setEntryEditError(err instanceof Error ? err.message : 'Failed to update entry')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteEntry = (entry: TournamentEntry) => {
    setDeleteConfirm({
      title: `Remove ${getEntryDisplayName(entry)}?`,
      description: canManageOngoingParticipants
        ? 'This removes the player and deletes all of their group-stage matches.'
        : 'This entry will be permanently removed from the division.',
      confirmLabel: 'Remove',
      confirmingLabel: 'Removing…',
      onConfirm: async () => {
        await deleteEntry(entry)
        if (editingEntry?.id === entry.id) handleCloseEditEntry()
        setMessage('Entry removed')
        setParticipantsDialogOpen(false)
        await fetchEventData()
      },
    })
  }

  const handleOpenMoveEntry = (entry: TournamentEntry) => {
    const currentGroupId = members.find((m) => m.entry_id === entry.id)?.group_id
    const otherGroups = groupSummaries.filter((g) => g.groupId !== currentGroupId)
    if (!otherGroups.length) {
      setError('No other groups available to move this player into')
      return
    }
    setParticipantsDialogOpen(false)
    setMovingEntry(entry)
  }

  const handleMoveConfirm = async (targetGroupId: string) => {
    if (!tournamentId || !eventId || !movingEntry) return
    setLoading(true)
    setError('')
    try {
      const { warnings: moveWarnings } = await moveEntryToGroup(
        tournamentId,
        eventId,
        movingEntry.id,
        targetGroupId,
      )
      if (moveWarnings.length) setWarnings((prev) => [...new Set([...prev, ...moveWarnings])])
      setMessage('Player moved to new group')
      setMovingEntry(null)
      await fetchEventData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move player')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSetRules = async (setRules: ReturnType<typeof normalizeSetRules>) => {
    if (!tournamentId || !eventId) return
    setLoading(true)
    setError('')
    try {
      await updateEventSetRules(tournamentId, eventId, setRules)
      setMessage('Set rules saved')
      setSetRulesDialogOpen(false)
      await fetchEventData()
    } catch (err) {
      throw err
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteEvent = () => {
    if (!tournament || !event || !tournamentId) return
    setDeleteConfirm({
      title: `Delete "${getEventDisplayName(event)}"?`,
      description: 'This permanently removes the division and all its data.',
      onConfirm: async () => {
        await deleteEvent(tournamentId, event.id)
        navigate(`/admin/tournaments/${tournamentId}`)
      },
    })
  }

  const handleDeleteDivisionData = () => {
    if (!tournamentId || !event) return
    setDeleteConfirm({
      title: 'Delete division data?',
      description: 'This permanently removes all division records. This cannot be undone.',
      onConfirm: async () => {
        await updateEvent(tournamentId, event.id, { status: 'ended' })
        navigate(`/admin/tournaments/${tournamentId}`)
      },
    })
  }

  const handleConfirmDelete = async () => {
    if (!deleteConfirm || loading) return
    setLoading(true)
    setError('')
    try {
      await deleteConfirm.onConfirm()
      setDeleteConfirm(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setLoading(false)
    }
  }

  const refreshKnockoutFromRanks = async () => {
    if (!tournamentId || !eventId) return
    const warnings = await regenerateKnockoutFromRanks(tournamentId, eventId)
    if (warnings.length) setWarnings(warnings.map((w) => w.message))
    await fetchEventData()
    const kmUpdated = await fetchKnockoutMatches(tournamentId, eventId)
    const firstKnockoutTab = buildKnockoutStageTabs(kmUpdated)[0]
    if (firstKnockoutTab) setActiveStage(firstKnockoutTab.id)
  }

  const handleSaveGroupRanks = async (
    groupId: string,
    orderedEntryIds: string[],
    note: string | null,
  ) => {
    if (!tournamentId || !eventId) return
    if (knockoutHasScores) {
      setError('Cannot change group ranks — knockout matches are already scored')
      return
    }
    setLoading(true)
    setError('')
    try {
      await saveGroupRankOrder(groupId, orderedEntryIds, note, { tournamentId, eventId })
      setMessage('Group ranks saved')
      await fetchEventData()
      const km = await fetchKnockoutMatches(tournamentId, eventId)
      if (km.length > 0 && !km.some((m) => m.status === 'completed')) {
        try {
          await refreshKnockoutFromRanks()
          setMessage('Group ranks saved — knockout bracket updated')
        } catch (regenErr) {
          setError(
            regenErr instanceof Error
              ? regenErr.message
              : 'Group ranks saved but knockout bracket could not be regenerated',
          )
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save ranks')
    } finally {
      setLoading(false)
    }
  }

  const handleClearGroupRanks = async (groupId: string) => {
    if (!tournamentId || !eventId) return
    if (knockoutHasScores) {
      setError('Cannot reset group ranks — knockout matches are already scored')
      return
    }
    setLoading(true)
    setError('')
    try {
      await clearGroupRankOrder(groupId, { tournamentId, eventId })
      setMessage('Ranks reset to automatic tie-break')
      await fetchEventData()
      const km = await fetchKnockoutMatches(tournamentId, eventId)
      if (km.length > 0 && !km.some((m) => m.status === 'completed')) {
        try {
          await refreshKnockoutFromRanks()
          setMessage('Ranks reset — knockout bracket updated')
        } catch (regenErr) {
          setError(
            regenErr instanceof Error
              ? regenErr.message
              : 'Ranks reset but knockout bracket could not be regenerated',
          )
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset ranks')
    } finally {
      setLoading(false)
    }
  }

  const handleRecreateGroupStage = () => {
    if (!tournamentId || !eventId) return
    setDeleteConfirm({
      title: 'Recreate group assignment?',
      description:
        'This removes all group-stage scores and the knockout bracket, then re-assigns every participant to groups using the current org-spread rules. Registrations and seeded flags are kept. Knockout is not generated — you can review groups first.',
      confirmLabel: 'Recreate groups',
      confirmingLabel: 'Recreating…',
      onConfirm: async () => {
        const { warnings: recreateWarnings, layoutLabel } =
          await recreateGroupStageFromEntries(tournamentId, eventId, startLayoutKey)
        if (recreateWarnings.length) setWarnings(recreateWarnings)
        setMessage(`Group stage recreated — ${layoutLabel}`)
        setActiveStage('')
        await fetchEventData()
      },
    })
  }

  const handleGenerateKnockout = async () => {
    if (!tournamentId || !eventId) return
    const unresolved = groupStageData.filter(
      (g) =>
        g.groupPlayComplete &&
        needsManualRankResolution(g.computedRows) &&
        !g.group.manual_rank_order?.length,
    )
    if (unresolved.length) {
      setError(
        `Set manual ranks for group${unresolved.length === 1 ? '' : 's'} ${unresolved.map((g) => g.group.label).join(', ')} before generating knockout`,
      )
      return
    }
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
        const freshEvent = await fetchEvent(tournamentId, event.id)
        const freshEntries = await fetchEntries(tournamentId, event.id)
        let rostersByTeamId: Map<string, string[]> | undefined
        if (freshEvent.event_type === 'team') {
          const teamIds = freshEntries.filter((e) => e.team_id).map((e) => e.team_id!)
          const rosters = teamIds.length ? await fetchTeamRosters(teamIds) : []
          rostersByTeamId = new Map<string, string[]>()
          for (const entry of freshEntries) {
            if (entry.team_id) {
              rostersByTeamId.set(
                entry.team_id,
                rosters.filter((r) => r.team_id === entry.team_id).map((r) => r.name),
              )
            }
          }
        }
        if (hasBlockingDuplicates(freshEntries, freshEvent.event_type, rostersByTeamId)) {
          setError('Remove duplicate entries before generating the group stage')
          return
        }
        const check = validateTournamentStart(freshEntries.length, freshEvent.config, startLayoutKey)
        if (!check.ok) {
          setError(check.error ?? 'Cannot generate group stage')
          return
        }
        const assignCheck = assignEntriesToGroups(
          freshEntries,
          check.groupCount!,
          check.groupSizes,
        )
        if (assignCheck.error) {
          setError(assignCheck.error)
          return
        }
        const { group_sizes: _prev, ...configBase } = freshEvent.config
        const updatedConfig = {
          ...configBase,
          entries_per_group: check.entriesPerGroup!,
          group_count: check.groupCount!,
          ...(check.groupSizes ? { group_sizes: check.groupSizes } : {}),
        }
        await generateGroupStage(
          tournamentId,
          freshEvent,
          freshEntries,
          updatedConfig,
        )
        const layoutLabel = check.uneven
          ? `${check.groupCount} groups (${check.groupSizes!.join('+')})`
          : `${check.groupCount} groups × ${check.entriesPerGroup}`
        statusMessage = `Group stage generated — ${freshEntries.length} entries → ${layoutLabel}`
      } else {
        await updateEvent(tournamentId, event.id, { status })
      }
      setMessage(statusMessage)
      if (status === 'ongoing') setReadyDialogOpen(false)
      await fetchEventData()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Status update failed'
      if (msg.includes('permission') || msg.includes('insufficient')) {
        setError(
          'Firestore denied the write. Deploy the latest security rules with `firebase deploy --only firestore:rules`, then try again.',
        )
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  if (showPageSkeleton) {
    return (
      <AdminLayout>
        <AdminEventPageSkeleton />
      </AdminLayout>
    )
  }

  if (loadError || !tournament || !event) {
    const pageError = loadError || 'Division not found'
    return (
      <AdminLayout>
        <BackLink to={tournamentId ? `/admin/tournaments/${tournamentId}` : '/admin'}>
          {tournament?.name ?? 'Tournament'}
        </BackLink>
        {!pageErrorDismissed ? (
          <StatusPopups
            error={pageError}
            onErrorDismiss={() => setPageErrorDismissed(true)}
          />
        ) : (
          <EmptyMessage>{pageError}</EmptyMessage>
        )}
      </AdminLayout>
    )
  }

  const cfg = event.config
  const canEditDivisionSettings = event.status === 'draft' || event.status === 'upcoming'
  const canEditSetRules = event.status === 'ongoing'
  const canEditEntries = canEditDivisionSettings
  const canRemoveEntry = canEditEntries || canManageOngoingParticipants
  const canMoveEntry = canManageOngoingParticipants
  const canEditEntryDetails =
    canEditDivisionSettings || (event.status === 'ongoing' && !knockoutGenerated)
  const canLateJoin = event.status === 'ongoing' && !knockoutGenerated && groups.length > 0
  const entryCountLabel =
    cfg.total_slots != null ? `${entries.length} / ${cfg.total_slots}` : String(entries.length)
  const setRulesSummary = formatSetRulesSummary(normalizeSetRules(cfg.set_rules))
  const rosterSize = cfg.roster_size ?? 3
  const groupAssignmentBlocked = assignmentWarnings.some((w) => w.startsWith('Cannot assign'))
  const startDisabled =
    loading ||
    entries.length < 2 ||
    hasBlockingDuplicates(entries, event.event_type) ||
    rosterWarnings.length > 0 ||
    groupAssignmentBlocked ||
    !startPreview?.ok ||
    selectableLayoutOptions.length === 0
  const canShowReadyButton = event.status === 'upcoming' && allLayoutOptions.length > 0

  const adminTabs: { id: AdminDivisionTab; label: string }[] = [
    { id: 'participants', label: 'Participants' },
  ]
  if (canLateJoin) adminTabs.push({ id: 'late-check-in', label: 'Late check-in' })
  if (event.status === 'ongoing' && groups.length > 0) {
    adminTabs.push({ id: 'brackets', label: 'Brackets' })
  }

  const activeAdminTab: AdminDivisionTab = adminTabs.some((t) => t.id === adminTab)
    ? adminTab
    : adminTabs[0]!.id

  const renderEntryForm = (lateOnly: boolean) => (
    <form onSubmit={handleAddEntry} className="bg-card border border-border rounded-2xl p-4 space-y-3">
      {event.event_type === 'team' && (
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
      {isPlayerEventType(event.event_type) && (
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
      {event.event_type === 'doubles' && (
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
        disabled={
          addingEntry ||
          loading ||
          (!lateOnly && canEditEntries && cfg.total_slots != null && entries.length >= cfg.total_slots)
        }
        fullWidth
      >
        {addingEntry ? 'Adding…' : lateOnly ? 'Add late entry' : 'Add entry'}
      </AddEntryButton>
      {!lateOnly && (
        <Button
          type="button"
          variant="secondary"
          onClick={() => setParticipantsDialogOpen(true)}
          fullWidth
        >
          Show participants
        </Button>
      )}
    </form>
  )

  return (
    <AdminLayout>
      <div className="space-y-4">
        <FirebaseSetupBanner />
        <BackLink to={`/admin/tournaments/${tournamentId}`}>{tournament.name}</BackLink>

        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2.5">
              <EventAdminTitle>{getEventDisplayName(event)}</EventAdminTitle>
              <Pill variant={statusPillVariant(event.status)}>
                {event.status === 'ongoing' ? 'Live' : STATUS_LABELS[event.status]}
              </Pill>
            </div>
            <p className="inline-flex items-center gap-1.5 text-xs text-text-steel font-medium">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M6 21V9" /><path d="M18 6v12" /><path d="M6 9a9 9 0 0 0 9 9" />
              </svg>
              Knockout type — {cfg.knockout_bracket === 'cross' ? 'Cross' : 'Block'}
            </p>
            <p className="text-xs text-text-steel font-medium">
              Group {setRulesSummary.group.replace('Best of ', 'Bo')}
              {' · '}
              Knockout {setRulesSummary.knockout.replace('Best of ', 'Bo')}
              {' · '}
              Finals {setRulesSummary.finals.replace('Best of ', 'Bo')}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {canEditSetRules && (
              <IconActionButton onClick={() => setSetRulesDialogOpen(true)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 20h9" /><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.855z" />
                </svg>
              </IconActionButton>
            )}
          {canEditDivisionSettings && (
            <IconActionButton onClick={editingDivision ? closeDivisionEdit : openDivisionEdit}>
              <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 20h9" /><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.855z" />
              </svg>
            </IconActionButton>
          )}
          </div>
        </div>

        {editingDivision && editDraft && (
          <div className="bg-card border border-border-strong rounded-2xl p-4 space-y-4">
            <PanelSectionTitle>Edit division settings</PanelSectionTitle>
            <DivisionConfigForm
              draft={editDraft}
              onChange={setEditDraft}
              lockEventStructure
            />
            <div className="grid grid-cols-2 gap-2.5">
              <Button variant="secondary" onClick={closeDivisionEdit} disabled={loading} fullWidth>
                Cancel
              </Button>
              <Button onClick={handleSaveDivisionSettings} disabled={loading} fullWidth>
                {loading ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        )}

        <StatusPopups
          success={message}
          error={error}
          onSuccessDismiss={() => setMessage('')}
          onErrorDismiss={() => setError('')}
        />
        {refreshError && <WarningBanner>{refreshError}</WarningBanner>}
        <ConflictWarnings warnings={conflictWarnings} />

        {adminTabs.length > 1 && (
          <GroupStageNavigator
            tabs={adminTabs}
            activeId={activeAdminTab}
            onChange={(id) => setAdminTab(id as AdminDivisionTab)}
          />
        )}

        {activeAdminTab === 'participants' && (
          <section className="space-y-3">
            <SectionHeaderRow
              title="Participants"
              trailing={
                <span className="text-[13px] font-bold text-text-steel tabular-nums">
                  {entryCountLabel}
                </span>
              }
            />
            {canEditEntries && renderEntryForm(false)}
            {!canEditEntries && (
              <>
                {canManageOngoingParticipants && (
                  <InfoNoteCard>
                    Remove players or move them to another group before knockout is generated.
                    Moving a player deletes their matches in the old group and creates new
                    round-robin matches in the target group.
                  </InfoNoteCard>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setParticipantsDialogOpen(true)}
                  fullWidth
                >
                  {canManageOngoingParticipants ? 'Manage participants' : 'Show participants'}
                </Button>
              </>
            )}
            {event.status === 'draft' && (
              <Button disabled={loading} onClick={() => changeStatus('upcoming')} fullWidth>
                Open registration
              </Button>
            )}
            {canShowReadyButton && (
              <Button
                onClick={() => setReadyDialogOpen(true)}
                disabled={loading}
                fullWidth
              >
                Ready
              </Button>
            )}
            {canEditEntries && (
              <DeleteDivisionButton onClick={handleDeleteEvent} disabled={loading}>
                Delete division
              </DeleteDivisionButton>
            )}
          </section>
        )}

        {activeAdminTab === 'late-check-in' && canLateJoin && (
          <section className="space-y-3">
            <SectionHeaderRow title="Late check-in" />
            <InfoNoteCard>
              Knockout bracket is not generated yet. New entries are assigned to a group with only
              missing round-robin matches added.
            </InfoNoteCard>
            {renderEntryForm(true)}
          </section>
        )}

        {event.status === 'ongoing' && groups.length === 0 && (
          <WarningBanner>
            Group stage data is missing. End this division and start it again if setup failed.
          </WarningBanner>
        )}

        {activeAdminTab === 'brackets' && event.status === 'ongoing' && groups.length > 0 && (
        <>
          <GroupStageNavigator tabs={stageTabs} activeId={activeStage} onChange={setActiveStage} />

          <div className="space-y-3">
            <div className="bg-card border border-border-strong rounded-2xl p-4 space-y-3.5">
              <PanelSectionTitle>Knockout stage</PanelSectionTitle>
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
                  <Button type="button" onClick={handleGenerateKnockout} disabled={loading} fullWidth>
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
                    onClick={handleGenerateKnockout}
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
            <Button
              type="button"
              variant="secondary"
              onClick={handleRecreateGroupStage}
              disabled={loading}
              fullWidth
            >
              Recreate group assignment (same participants)
            </Button>
          </div>

          {activeGroupStage && (
            <section className="space-y-4">
              <PanelSectionTitle>Group {activeGroupStage.group.label} standings</PanelSectionTitle>
              <GroupStandingsTable
                label={activeGroupStage.group.label}
                rows={activeGroupStage.rows}
                manualRanks={activeGroupStage.hasManualRanks}
                manualRankNote={activeGroupStage.group.manual_rank_note}
              />

              {activeGroupStage.groupPlayComplete &&
                (activeGroupStage.hasManualRanks ||
                  needsManualRankResolution(activeGroupStage.computedRows)) && (
                <GroupRankEditor
                  groupLabel={activeGroupStage.group.label}
                  rows={activeGroupStage.computedRows}
                  manualRankOrder={activeGroupStage.group.manual_rank_order}
                  manualRankNote={activeGroupStage.group.manual_rank_note}
                  saving={loading}
                  disabled={knockoutHasScores}
                  diffLabel={event.event_type === 'team' ? 'rubbers' : 'sets'}
                  onSave={(orderedEntryIds, note) =>
                    handleSaveGroupRanks(activeGroupStage.group.id, orderedEntryIds, note)
                  }
                  onClear={() => handleClearGroupRanks(activeGroupStage.group.id)}
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
                          await fetchEventData()
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {activeGroupStage.completed.length > 0 && (
                <details className="group">
                  <summary className="flex items-center justify-between bg-card rounded-xl border border-border px-3.5 py-3 cursor-pointer list-none">
                    <span className="text-sm font-bold text-text-bluewhite">
                      Completed ({activeGroupStage.completed.length})
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-steel group-open:rotate-180 transition-transform" aria-hidden>
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </summary>
                  <div className="mt-2 space-y-2">
                    {activeGroupStage.completed.map((m) => (
                      <div key={m.id} className="rounded-[10px] border border-border bg-[#0C284780] px-3.5 py-2.5">
                        <MatchScoreEntry
                          eventType={event.event_type}
                          config={cfg}
                          match={m}
                          stage="group"
                          onSave={async () => {}}
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
                          await fetchEventData()
                        }}
                      />
                    ))}
                  </div>
                )}
                {scorable.length === 0 &&
                  activeKnockoutRound === 'semi' &&
                  finalMatch &&
                  finalMatch.status !== 'completed' &&
                  !waitingOnEarlierRound && (
                  <div className="rounded-xl border border-border bg-[#0C284780] p-3.5 space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-text-steel">FINAL · WAITING</p>
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
                  <p className="text-sm text-brand-500 font-semibold">
                    Division complete. Click <strong>Delete division data</strong> below to remove all records.
                  </p>
                )}
              </section>
            )
          })()}
        </>
        )}

        {event.status === 'ongoing' && (
        <DeleteDivisionButton onClick={handleDeleteDivisionData} disabled={loading} className="mt-6">
          Delete division data
        </DeleteDivisionButton>
      )}

      {pendingLateEntry && (
        <LateEntryDialog
          entryLabel={pendingLateEntry.label}
          groups={groupSummaries}
          mockEntry={pendingLateEntry.mock}
          suggestion={lateJoinSuggestion}
          confirming={loading}
          onCancel={() => setPendingLateEntry(null)}
          onConfirm={handleLateJoinConfirm}
        />
      )}

      {editingEntry && (
        <EntryEditDialog
          key={editingEntry.id}
          entry={editingEntry}
          eventType={event.event_type}
          rosterSize={rosterSize}
          allowRosterEdit={canEditEntries}
          initialRoster={editingEntryRoster}
          error={entryEditError}
          onErrorDismiss={() => setEntryEditError('')}
          confirming={loading}
          onCancel={handleCloseEditEntry}
          onSave={handleSaveEntryEdit}
        />
      )}

      {movingEntry && moveTargetGroups.length > 0 && (
        <MoveEntryDialog
          entry={movingEntry}
          currentGroupLabel={entryGroupLabelMap.get(movingEntry.id) ?? null}
          groups={moveTargetGroups}
          confirming={loading}
          onCancel={() => setMovingEntry(null)}
          onConfirm={handleMoveConfirm}
        />
      )}

      <ParticipantsListDialog
        open={participantsDialogOpen}
        onClose={() => setParticipantsDialogOpen(false)}
        entries={entries}
        canEditEntryDetails={canEditEntryDetails}
        canRemoveEntry={canRemoveEntry}
        canMoveEntry={canMoveEntry}
        entryGroupLabels={entryGroupLabelMap}
        onEdit={handleOpenEditEntry}
        onMove={handleOpenMoveEntry}
        onRemove={handleDeleteEntry}
      />

      <SetRulesEditorDialog
        open={setRulesDialogOpen}
        initialRules={normalizeSetRules(cfg.set_rules)}
        saving={loading}
        onClose={() => setSetRulesDialogOpen(false)}
        onSave={handleSaveSetRules}
      />

      <GenerateGroupStageDialog
        open={readyDialogOpen}
        onClose={() => setReadyDialogOpen(false)}
        entryCountLabel={entryCountLabel}
        entryCount={entries.length}
        isBlockBracket={isBlockBracket}
        allLayoutOptions={allLayoutOptions}
        selectableLayoutOptions={selectableLayoutOptions}
        startLayoutKey={startLayoutKey}
        onSelectLayout={setStartLayoutKey}
        isLayoutSelectable={isLayoutSelectable}
        startPreview={startPreview}
        startDisabled={startDisabled}
        loading={loading}
        canEditKnockoutBracket={canEditDivisionSettings}
        knockoutBracket={cfg.knockout_bracket ?? 'cross'}
        onKnockoutBracketChange={handleKnockoutBracketChange}
        onGenerate={() => changeStatus('ongoing')}
      />

      <DeleteConfirmDialog
        open={!!deleteConfirm}
        title={deleteConfirm?.title ?? ''}
        description={deleteConfirm?.description ?? ''}
        confirmLabel={deleteConfirm?.confirmLabel}
        confirmingLabel={deleteConfirm?.confirmingLabel}
        onCancel={() => setDeleteConfirm(null)}
        onConfirm={handleConfirmDelete}
        confirming={loading}
      />
      </div>
    </AdminLayout>
  )
}
