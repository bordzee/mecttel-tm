import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AdminLayout } from '../../components/AdminLayout'
import { BackLink, Button, DeleteDivisionButton, EmptyMessage, EventAdminTitle, InfoNoteCard, IconActionButton, PanelSectionTitle, Pill, SectionHeaderRow, WarningBanner } from '../../components/ui/primitives'
import { GroupStageNavigator } from '../../components/GroupStageNavigator'
import { EntryEditDialog, type EntryEditFormState } from '../../components/EntryEditDialog'
import { ConflictWarnings } from '../../components/ConflictWarnings'
import { LateEntryDialog } from '../../components/LateEntryDialog'
import { MoveEntryDialog } from '../../components/MoveEntryDialog'
import { GenerateGroupStageDialog } from '../../components/GenerateGroupStageDialog'
import { GenerateKnockoutDialog } from '../../components/GenerateKnockoutDialog'
import { EntryInfoDialog } from '../../components/EntryInfoDialog'
import { EventQueueView } from '../../components/EventQueueView'
import { ParticipantsListDialog } from '../../components/ParticipantsListDialog'
import { SetRulesEditorDialog } from '../../components/SetRulesEditorDialog'
import { formatSetRulesSummary, normalizeSetRules } from '../../lib/setRules'
import { fetchTournament, fetchEvent, fetchEntries, updateEvent, updateEventSetRules, deleteEntry, moveEntryToGroup, addTeamEntry, addPlayerEntry, addPairEntry, updatePlayerEntry, updatePairEntry, updateTeamEntry, generateGroupStage, addLateJoinEntry, type LateJoinEntryInput, fetchGroups, fetchGroupMembers, fetchGroupMatches, fetchKnockoutMatches, saveGroupRankOrder, clearGroupRankOrder, regenerateKnockoutFromRanks, fetchTeamRosters } from '../../lib/tournamentService'
import { assignEntriesToGroups, assignmentWarningsForMembers, canAddEntryToGroup } from '../../lib/groupAssignment'
import { buildGroupStageData } from '../../lib/groupStageData'
import {
  getStartLayoutOptions,
  isLayoutCompatibleWithBlock,
  MIN_PER_GROUP,
  parseSeededValue,
} from '../../lib/groupLayout'
import { suggestBalanceGroup, type GroupSummary } from '../../lib/lateJoinAssignment'
import { buildKnockoutStageTabs, filterKnockoutMatchesForStage, isKnockoutStage, knockoutRoundFromStageId } from '../../lib/knockoutTabs'
import { formatKnockoutByePreviewFromGroupSizes } from '../../lib/knockoutRounds'
import { resolveGroupStandings, needsManualRankResolution } from '../../lib/standings'
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
import { STATUS_LABELS, KNOCKOUT_BRACKET_LABELS } from '../../lib/constants'
import { useRealtimeEvent } from '../../hooks/useRealtimeEvent'
import { useMinLoading } from '../../hooks/useMinLoading'
import { AdminEventPageSkeleton } from '../../components/ui/Skeleton'
import { StatusPopups } from '../../components/ui/StatusPopups'
import { DeleteConfirmDialog } from '../../components/ui/DeleteConfirmDialog'
import { MasterPasswordDialog } from '../../components/ui/MasterPasswordDialog'
import { deleteDivision } from '../../lib/guardedDelete'
import { BracketsPanel } from './division/BracketsPanel'
import { EntryForm } from './division/EntryForm'
import type { Tournament, TournamentEvent, TournamentEntry, Group, KnockoutBracketType } from '../../types'


/** Two groups of the minimum size is the smallest division that can start. */
const MIN_ENTRIES_TO_START = MIN_PER_GROUP * 2

type AdminDivisionTab = 'participants' | 'late-check-in' | 'queue' | 'brackets'

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
  const [masterDelete, setMasterDelete] = useState<{
    title: string
    description: string
    confirmLabel: string
  } | null>(null)
  const [participantsDialogOpen, setParticipantsDialogOpen] = useState(false)
  const [movingEntry, setMovingEntry] = useState<TournamentEntry | null>(null)
  const [setRulesDialogOpen, setSetRulesDialogOpen] = useState(false)
  const [readyDialogOpen, setReadyDialogOpen] = useState(false)
  const [knockoutDialogOpen, setKnockoutDialogOpen] = useState(false)
  const [knockoutDialogMode, setKnockoutDialogMode] = useState<'generate' | 'regenerate'>('generate')
  const [infoEntry, setInfoEntry] = useState<TournamentEntry | null>(null)
  const [infoEntryRoster, setInfoEntryRoster] = useState<string[] | undefined>()
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

  const groupStageData = useMemo(
    () => buildGroupStageData(groups, members, groupMatches, entryMap),
    [groups, members, groupMatches, entryMap],
  )

  const allGroupPlayComplete =
    groupStageData.length > 0 && groupStageData.every((g) => g.groupPlayComplete)

  const pendingGroupMatchCount = groupStageData.reduce((n, g) => n + g.pending.length, 0)
  const groupsAwaitingScores = groupStageData.filter((g) => !g.groupPlayComplete)

  const knockoutHasScores = knockoutMatches.some((m) => m.status === 'completed')

  const knockoutDialogGroupOrder = useMemo(
    () => [...groups].sort((a, b) => a.label.localeCompare(b.label)).map((g) => g.id),
    [groups],
  )

  const knockoutDialogGroupLabels = useMemo(
    () => new Map(groups.map((g) => [g.id, g.label])),
    [groups],
  )

  const knockoutDialogStandings = useMemo(() => {
    const standingsByGroup = new Map<string, ReturnType<typeof resolveGroupStandings>>()
    for (const g of groupStageData) {
      standingsByGroup.set(g.group.id, g.rows)
    }
    return standingsByGroup
  }, [groupStageData])

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

  const handleShowEntryInfo = async (entry: TournamentEntry) => {
    setInfoEntry(entry)
    if (entry.entry_type === 'team' && entry.team_id) {
      const rosters = await fetchTeamRosters([entry.team_id])
      setInfoEntryRoster(
        rosters.filter((r) => r.team_id === entry.team_id).map((r) => r.name),
      )
    } else {
      setInfoEntryRoster(undefined)
    }
  }

  const needsEvenGroupsForKnockout =
    (event?.config.knockout_bracket ?? 'cross') === 'block' ||
    (event?.config.knockout_bracket ?? 'cross') === 'mirror'

  const allLayoutOptions = useMemo(() => {
    if (!event) return []
    return getStartLayoutOptions(entries.length, event.config)
  }, [event, entries.length])

  const isLayoutSelectable = useCallback(
    (option: (typeof allLayoutOptions)[number]) =>
      !needsEvenGroupsForKnockout || isLayoutCompatibleWithBlock(option),
    [needsEvenGroupsForKnockout],
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

  const liveKnockoutByePreview = useMemo(() => {
    if (!event || event.status !== 'ongoing' || knockoutGenerated || !groups.length) return null
    const sizes = groupSummaries.map((g) => g.entries.length)
    return formatKnockoutByePreviewFromGroupSizes(sizes, event.config.advance_count, {
      blockBracket:
        (event.config.knockout_bracket ?? 'cross') === 'block' ||
        (event.config.knockout_bracket ?? 'cross') === 'mirror',
    })
  }, [event, knockoutGenerated, groups.length, groupSummaries])

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
        ? completedMatchesFor(entry.id) > 0
          ? `This removes the player and deletes all of their group-stage matches, including ${completedMatchesFor(entry.id)} already scored. Their opponents' standings will change.`
          : 'This removes the player and deletes all of their group-stage matches.'
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

  const completedMatchesFor = (entryId: string) =>
    groupMatches.filter(
      (m) => m.status === 'completed' && (m.entry_a_id === entryId || m.entry_b_id === entryId),
    ).length

  const handleOpenMoveEntry = (entry: TournamentEntry) => {
    const played = completedMatchesFor(entry.id)
    if (played > 0) {
      setError(
        `${getEntryDisplayName(entry)} has already played ${played} match${played === 1 ? '' : 'es'}, so they can no longer be moved. Moving would delete those results.`,
      )
      return
    }
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
    } finally {
      // Errors propagate to the dialog, which shows them inline.
      setLoading(false)
    }
  }

  // Deleting a division is irreversible, so it asks for the master password (checked on the server).
  const handleDeleteEvent = () => {
    if (!tournament || !event || !tournamentId) return
    setMasterDelete({
      title: `Delete "${getEventDisplayName(event)}"?`,
      description:
        'This permanently deletes the division and everything in it: entries, groups and results. It cannot be undone.',
      confirmLabel: 'Delete division',
    })
  }

  const handleDeleteDivisionData = () => {
    if (!tournamentId || !event) return
    setMasterDelete({
      title: 'Delete division data?',
      description:
        'This permanently deletes the division and all of its entries, groups and match results, and removes it from the public site. It cannot be undone.',
      confirmLabel: 'Delete division data',
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

  const openGenerateKnockoutDialog = (mode: 'generate' | 'regenerate') => {
    if (!tournamentId || !eventId) return
    const unresolved = groupStageData.filter(
      (g) =>
        g.groupPlayComplete &&
        needsManualRankResolution(g.computedRows, event?.config.advance_count) &&
        !g.group.manual_rank_order?.length,
    )
    if (unresolved.length) {
      setError(
        `Set manual ranks for group${unresolved.length === 1 ? '' : 's'} ${unresolved.map((g) => g.group.label).join(', ')} before generating knockout`,
      )
      return
    }
    setError('')
    setKnockoutDialogMode(mode)
    setKnockoutDialogOpen(true)
  }

  const handleConfirmGenerateKnockout = async (knockoutBracket: KnockoutBracketType) => {
    if (!tournamentId || !eventId || !event) return
    setLoading(true)
    setError('')
    try {
      const current = event.config.knockout_bracket ?? 'cross'
      if (knockoutBracket !== current) {
        await updateEvent(tournamentId, event.id, {
          config: { ...event.config, knockout_bracket: knockoutBracket },
        })
      }
      await refreshKnockoutFromRanks()
      setMessage(
        knockoutDialogMode === 'generate'
          ? 'Knockout bracket generated'
          : 'Knockout bracket regenerated',
      )
      setKnockoutDialogOpen(false)
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
    adminTabs.push({ id: 'queue', label: 'Queue' })
    adminTabs.push({ id: 'brackets', label: 'Brackets' })
  }

  const activeAdminTab: AdminDivisionTab = adminTabs.some((t) => t.id === adminTab)
    ? adminTab
    : adminTabs[0]!.id

  const renderEntryForm = (lateOnly: boolean) => (
    <EntryForm
      eventType={event.event_type}
      rosterSize={rosterSize}
      lateOnly={lateOnly}
      adding={addingEntry}
      submitDisabled={
        addingEntry ||
        loading ||
        (!lateOnly && canEditEntries && cfg.total_slots != null && entries.length >= cfg.total_slots)
      }
      onSubmit={handleAddEntry}
      onShowParticipants={() => setParticipantsDialogOpen(true)}
    />
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
              Knockout type — {KNOCKOUT_BRACKET_LABELS[cfg.knockout_bracket ?? 'cross']}
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
              <IconActionButton label="Edit set rules" onClick={() => setSetRulesDialogOpen(true)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 20h9" /><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.855z" />
                </svg>
              </IconActionButton>
            )}
          {canEditDivisionSettings && (
            <IconActionButton
              label="Edit division settings"
              onClick={editingDivision ? closeDivisionEdit : openDivisionEdit}
            >
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
                <span className="text-[13px] font-semibold text-text-steel tabular-nums">
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
                    Only a player who has not played any match yet can be moved; their
                    unplayed matches are replaced by new ones in the target group.
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
            {event.status === 'upcoming' && !canShowReadyButton && (
              <InfoNoteCard>
                {entries.length < MIN_ENTRIES_TO_START
                  ? `A division needs at least ${MIN_ENTRIES_TO_START} entries to make two groups of ${MIN_PER_GROUP}. Add ${MIN_ENTRIES_TO_START - entries.length} more to start the group stage.`
                  : 'No group layout fits this many entries. Add or remove an entry to start the group stage.'}
              </InfoNoteCard>
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
              missing round-robin matches added. A new late group may have as few as 2 players (minimum
              3 applies at initial registration only).
            </InfoNoteCard>
            {liveKnockoutByePreview && (
              <InfoNoteCard>
                Current knockout estimate: {liveKnockoutByePreview}
              </InfoNoteCard>
            )}
            {renderEntryForm(true)}
          </section>
        )}

        {event.status === 'ongoing' && groups.length === 0 && (
          <WarningBanner>
            Group stage data is missing. Delete this division's data and start it again if setup failed.
          </WarningBanner>
        )}

        {activeAdminTab === 'queue' && event.status === 'ongoing' && groups.length > 0 && tournamentId && eventId && (
          <EventQueueView
            tournamentId={tournamentId}
            eventId={eventId}
            admin
            onRefresh={fetchEventData}
          />
        )}

        {activeAdminTab === 'brackets' && event.status === 'ongoing' && groups.length > 0 && (
          <BracketsPanel
            event={event}
            loading={loading}
            entryMap={entryMap}
            stageTabs={stageTabs}
            activeStage={activeStage}
            onStageChange={setActiveStage}
            liveKnockoutByePreview={liveKnockoutByePreview}
            knockoutMatches={knockoutMatches}
            allGroupPlayComplete={allGroupPlayComplete}
            pendingGroupMatchCount={pendingGroupMatchCount}
            groupsAwaitingScores={groupsAwaitingScores}
            knockoutHasScores={knockoutHasScores}
            onGenerateKnockout={openGenerateKnockoutDialog}
            activeGroupStage={activeGroupStage}
            activeKnockoutRound={activeKnockoutRound}
            activeKnockoutMatches={activeKnockoutMatches}
            onShowEntryInfo={handleShowEntryInfo}
            onSaveGroupRanks={handleSaveGroupRanks}
            onClearGroupRanks={handleClearGroupRanks}
            onRefresh={fetchEventData}
            onWarnings={(w) => setWarnings((prev) => [...new Set([...prev, ...w])])}
            onMessage={setMessage}
          />
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
        allLayoutOptions={allLayoutOptions}
        startLayoutKey={startLayoutKey}
        onSelectLayout={setStartLayoutKey}
        advanceCount={cfg.advance_count}
        startPreview={startPreview}
        startDisabled={startDisabled}
        loading={loading}
        canEditKnockoutBracket={canEditDivisionSettings}
        knockoutBracket={cfg.knockout_bracket ?? 'cross'}
        onKnockoutBracketChange={handleKnockoutBracketChange}
        onGenerate={() => changeStatus('ongoing')}
      />

      <GenerateKnockoutDialog
        open={knockoutDialogOpen}
        onClose={() => setKnockoutDialogOpen(false)}
        loading={loading}
        mode={knockoutDialogMode}
        knockoutBracket={cfg.knockout_bracket ?? 'cross'}
        groupCount={groups.length}
        groupOrder={knockoutDialogGroupOrder}
        groupLabels={knockoutDialogGroupLabels}
        standingsByGroup={knockoutDialogStandings}
        advanceCount={cfg.advance_count}
        entryMap={entryMap}
        onConfirm={handleConfirmGenerateKnockout}
      />

      <EntryInfoDialog
        open={!!infoEntry}
        entry={infoEntry}
        eventType={event.event_type}
        groupLabel={infoEntry ? entryGroupLabelMap.get(infoEntry.id) ?? null : null}
        roster={infoEntryRoster}
        onClose={() => {
          setInfoEntry(null)
          setInfoEntryRoster(undefined)
        }}
      />

      {masterDelete && tournamentId && event && (
        <MasterPasswordDialog
          title={masterDelete.title}
          description={masterDelete.description}
          confirmLabel={masterDelete.confirmLabel}
          onCancel={() => setMasterDelete(null)}
          onConfirm={async (password) => {
            await deleteDivision(tournamentId, event.id, password)
            navigate(`/admin/tournaments/${tournamentId}`)
          }}
        />
      )}

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
