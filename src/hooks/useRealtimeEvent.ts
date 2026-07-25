import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'

export function useRealtimeEvent(eventId: string | undefined, onUpdate: () => void) {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!eventId) return

    const groupQ = query(collection(db, 'group_matches'), where('event_id', '==', eventId))
    const knockoutQ = query(collection(db, 'knockout_matches'), where('event_id', '==', eventId))

    let groupReady = false
    let knockoutReady = false

    const unsubGroup = onSnapshot(groupQ, () => {
      groupReady = true
      if (groupReady && knockoutReady) setConnected(true)
      onUpdate()
    })

    const unsubKnockout = onSnapshot(knockoutQ, () => {
      knockoutReady = true
      if (groupReady && knockoutReady) setConnected(true)
      onUpdate()
    })

    return () => {
      unsubGroup()
      unsubKnockout()
    }
  }, [eventId, onUpdate])

  return { connected }
}
