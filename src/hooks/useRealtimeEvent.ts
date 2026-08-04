import { useEffect, useRef, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../lib/firebase'

export function useRealtimeEvent(
  tournamentId: string | undefined,
  eventId: string | undefined,
  onUpdate: () => void | Promise<void>,
  onError?: (message: string) => void,
) {
  const [connected, setConnected] = useState(false)
  const onUpdateRef = useRef(onUpdate)
  const onErrorRef = useRef(onError)
  onUpdateRef.current = onUpdate
  onErrorRef.current = onError

  useEffect(() => {
    if (!isFirebaseConfigured || !tournamentId || !eventId) {
      setConnected(false)
      return
    }

    setConnected(false)
    const groupMatchesQ = query(
      collection(db, 'group_matches'),
      where('tournament_id', '==', tournamentId),
      where('event_id', '==', eventId),
    )
    const knockoutQ = query(
      collection(db, 'knockout_matches'),
      where('tournament_id', '==', tournamentId),
      where('event_id', '==', eventId),
    )
    const groupsQ = query(
      collection(db, 'groups'),
      where('tournament_id', '==', tournamentId),
      where('event_id', '==', eventId),
    )

    let ready = 0
    const requiredReady = 3
    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    const markReady = () => {
      ready++
      if (ready >= requiredReady) setConnected(true)
    }

    const runUpdate = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        void Promise.resolve(onUpdateRef.current()).catch((err) => {
          onErrorRef.current?.(
            err instanceof Error ? err.message : 'Failed to refresh live data',
          )
        })
      }, 80)
    }

    const unsubGroupMatches = onSnapshot(
      groupMatchesQ,
      () => {
        markReady()
        runUpdate()
      },
      (err) => onErrorRef.current?.(err.message),
    )

    const unsubKnockout = onSnapshot(
      knockoutQ,
      () => {
        markReady()
        runUpdate()
      },
      (err) => onErrorRef.current?.(err.message),
    )

    const unsubGroups = onSnapshot(
      groupsQ,
      () => {
        markReady()
        runUpdate()
      },
      (err) => onErrorRef.current?.(err.message),
    )

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      unsubGroupMatches()
      unsubKnockout()
      unsubGroups()
      setConnected(false)
    }
  }, [tournamentId, eventId])

  return { connected }
}
