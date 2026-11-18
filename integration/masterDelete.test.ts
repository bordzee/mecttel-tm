import { signOut } from 'firebase/auth'
import { beforeAll, describe, expect, it } from 'vitest'
import { auth } from '../src/lib/firebaseAuth'
import { createTournament, fetchEvents, fetchTournament } from '../src/lib/tournamentService'
import { deleteDivision, deleteTournament, setMasterPassword } from '../src/lib/guardedDelete'
import { createDivision, fetchEntries, fetchGroupMatches, rememberEvent, signInAdmin, signInPlainAdmin, startGroupStage, type DivisionSpec, type Finding } from './helpers'

const MASTER = 'a-long-master-password'
const findings: Finding[] = []
let tournamentId = ''

async function newDivision(label: string, entries = 6) {
  const spec: DivisionSpec = { label, type: 'single', category: 'open', entries, advance: 2 }
  const ev = await createDivision(tournamentId, spec, findings)
  rememberEvent(label, ev.id)
  await startGroupStage(tournamentId, spec, findings)
  return ev.id
}

beforeAll(async () => {
  await signInAdmin()
  await setMasterPassword(MASTER)
  tournamentId = (await createTournament({ name: 'Master delete', venue: 'Hall', start_date: '2026-12-03' })).id
})

describe('deleting with the master password (no Cloud Functions)', () => {
  it('rejects a wrong password and deletes nothing', async () => {
    const eventId = await newDivision('Guarded A')
    await expect(deleteDivision(tournamentId, eventId, 'nope')).rejects.toThrow(/Wrong master password/)
    expect((await fetchEntries(tournamentId, eventId)).length).toBe(6)
    expect((await fetchGroupMatches(tournamentId, eventId)).length).toBeGreaterThan(0)
    expect((await fetchEvents(tournamentId)).some((e) => e.id === eventId)).toBe(true)
    await deleteDivision(tournamentId, eventId, MASTER)
  })

  it('deletes everything in the division with the right password and updates public visibility', async () => {
    const eventId = await newDivision('Guarded B')
    const other = await newDivision('Guarded C')
    await deleteDivision(tournamentId, eventId, MASTER)
    expect((await fetchEntries(tournamentId, eventId)).length).toBe(0)
    expect((await fetchGroupMatches(tournamentId, eventId)).length).toBe(0)
    const events = await fetchEvents(tournamentId)
    expect(events.some((e) => e.id === eventId)).toBe(false)
    expect(events.some((e) => e.id === other)).toBe(true)
    expect((await fetchTournament(tournamentId)).public_visible).toBe(true)
    await deleteDivision(tournamentId, other, MASTER)
    expect((await fetchTournament(tournamentId)).public_visible).toBe(false)
  })

  it('a normal admin can delete too, but only with the password', async () => {
    const eventId = await newDivision('Guarded D')
    await signOut(auth)
    await signInPlainAdmin()
    try {
      await expect(deleteDivision(tournamentId, eventId, 'guess')).rejects.toThrow(/Wrong master password/)
      await deleteDivision(tournamentId, eventId, MASTER)
    } finally {
      await signOut(auth)
      await signInAdmin()
    }
    expect((await fetchEntries(tournamentId, eventId)).length).toBe(0)
  })

  it('only the superadmin can change the master password', async () => {
    await signOut(auth)
    await signInPlainAdmin()
    try {
      await expect(setMasterPassword('another-long-password')).rejects.toThrow()
    } finally {
      await signOut(auth)
      await signInAdmin()
    }
    // the old password still works
    const eventId = await newDivision('Guarded E')
    await deleteDivision(tournamentId, eventId, MASTER)
  })

  it('a changed master password replaces the old one', async () => {
    await setMasterPassword('second-long-password')
    const eventId = await newDivision('Guarded F')
    await expect(deleteDivision(tournamentId, eventId, MASTER)).rejects.toThrow(/Wrong master password/)
    await deleteDivision(tournamentId, eventId, 'second-long-password')
    await setMasterPassword(MASTER)
  })

  it('deletes a whole tournament with the right password only', async () => {
    const t = (await createTournament({ name: 'Doomed', venue: 'Hall', start_date: '2026-12-04' })).id
    const spec: DivisionSpec = { label: 'Doomed div', type: 'single', category: 'open', entries: 6, advance: 2 }
    const ev = await createDivision(t, spec, findings)
    await expect(deleteTournament(t, 'wrong')).rejects.toThrow(/Wrong master password/)
    expect((await fetchTournament(t)).name).toBe('Doomed')
    await deleteTournament(t, MASTER)
    await expect(fetchTournament(t)).rejects.toThrow()
    expect((await fetchEntries(t, ev.id)).length).toBe(0)
  })

  it('refuses a weak new master password', async () => {
    await expect(setMasterPassword('short')).rejects.toThrow(/at least 10/)
  })
})
