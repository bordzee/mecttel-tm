import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'

const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8381').split(':')
let env: RulesTestEnvironment

const PROOF = 'a'.repeat(64)
const T = 'tour1'
const E = 'event1'

function baseMatch(over: Record<string, unknown> = {}) {
  return {
    tournament_id: T,
    event_id: E,
    group_id: 'g1',
    entry_a_id: 'a',
    entry_b_id: 'b',
    score_a: null,
    score_b: null,
    winner_entry_id: null,
    status: 'scheduled',
    outcome: 'normal',
    ...over,
  }
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-tt-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: host!, port: Number(port) },
  })
})

afterAll(async () => {
  await env.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'profiles/admin1'), { role: 'admin' })
    await setDoc(doc(db, 'profiles/super1'), { role: 'superadmin' })
    await setDoc(doc(db, 'system/config'), { master_proof: PROOF })
    await setDoc(doc(db, `tournaments/${T}`), { name: 'T', public_visible: true })
    await setDoc(doc(db, `tournaments/${T}/events/${E}`), { status: 'ongoing' })
    await setDoc(doc(db, 'group_matches/m1'), baseMatch())
  })
})

const admin = () => env.authenticatedContext('admin1').firestore()
const superAdmin = () => env.authenticatedContext('super1').firestore()
const stranger = () => env.authenticatedContext('someone').firestore()
const anon = () => env.unauthenticatedContext().firestore()

describe('group_matches', () => {
  it('lets anyone read a public event’s matches but only admins write', async () => {
    await assertSucceeds(
      (await import('firebase/firestore')).getDoc(doc(anon(), 'group_matches/m1')),
    )
    await assertFails(updateDoc(doc(stranger(), 'group_matches/m1'), { status: 'scheduled' }))
    await assertFails(updateDoc(doc(anon(), 'group_matches/m1'), { status: 'scheduled' }))
  })

  it('accepts a valid completed result', async () => {
    await assertSucceeds(
      updateDoc(doc(admin(), 'group_matches/m1'), {
        score_a: 3,
        score_b: 1,
        winner_entry_id: 'a',
        status: 'completed',
      }),
    )
  })

  it('rejects a winner who is not in the match', async () => {
    await assertFails(
      updateDoc(doc(admin(), 'group_matches/m1'), {
        score_a: 3,
        score_b: 1,
        winner_entry_id: 'zzz',
        status: 'completed',
      }),
    )
  })

  it('rejects a completed match with no winner, missing scores, or a tie', async () => {
    const ref = doc(admin(), 'group_matches/m1')
    await assertFails(updateDoc(ref, { score_a: 3, score_b: 1, status: 'completed' }))
    await assertFails(updateDoc(ref, { winner_entry_id: 'a', status: 'completed' }))
    await assertFails(
      updateDoc(ref, { score_a: 2, score_b: 2, winner_entry_id: 'a', status: 'completed' }),
    )
  })

  it('rejects negative or non-integer scores', async () => {
    const ref = doc(admin(), 'group_matches/m1')
    await assertFails(updateDoc(ref, { score_a: -1 }))
    await assertFails(updateDoc(ref, { score_a: 1.5 }))
    await assertFails(updateDoc(ref, { score_a: '3' }))
  })

  it('does not let a match change who is playing or its group', async () => {
    const ref = doc(admin(), 'group_matches/m1')
    await assertFails(updateDoc(ref, { entry_a_id: 'c' }))
    await assertFails(updateDoc(ref, { entry_b_id: 'c' }))
    await assertFails(updateDoc(ref, { group_id: 'g2' }))
  })

  it('still allows pinning a table', async () => {
    await assertSucceeds(
      updateDoc(doc(admin(), 'group_matches/m1'), { assigned_table: 2, called_at: 'now' }),
    )
  })
})

describe('deleting divisions and tournaments', () => {
  const grant = (db: ReturnType<typeof admin>, id: string, proof = PROOF, uid = 'admin1') =>
    setDoc(doc(db, `delete_grants/${id}`), { uid, proof, created_at: serverTimestamp() })

  it('is refused without a grant, even for an admin', async () => {
    await assertFails(deleteDoc(doc(admin(), `tournaments/${T}/events/${E}`)))
    await assertFails(deleteDoc(doc(admin(), `tournaments/${T}`)))
  })

  it('refuses a grant made with the wrong master password', async () => {
    await assertFails(grant(admin(), `event-${E}`, 'b'.repeat(64)))
    await assertFails(deleteDoc(doc(admin(), `tournaments/${T}/events/${E}`)))
  })

  it('allows the delete after a grant made with the right proof', async () => {
    await assertSucceeds(grant(admin(), `event-${E}`))
    await assertSucceeds(deleteDoc(doc(admin(), `tournaments/${T}/events/${E}`)))
    await assertSucceeds(grant(admin(), `tournament-${T}`))
    await assertSucceeds(deleteDoc(doc(admin(), `tournaments/${T}`)))
  })

  it('a tournament grant also covers the divisions inside it', async () => {
    await assertSucceeds(grant(admin(), `tournament-${T}`))
    await assertSucceeds(deleteDoc(doc(admin(), `tournaments/${T}/events/${E}`)))
  })

  it('a grant for one division does not unlock another, or someone else', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `tournaments/${T}/events/other`), { status: 'ongoing' })
    })
    await assertSucceeds(grant(admin(), `event-${E}`))
    await assertFails(deleteDoc(doc(admin(), `tournaments/${T}/events/other`)))
    // another admin cannot use a grant that belongs to admin1
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'profiles/admin2'), { role: 'admin' })
    })
    await assertFails(deleteDoc(doc(env.authenticatedContext('admin2').firestore(), `tournaments/${T}/events/${E}`)))
  })

  it('a grant stops working after a few minutes', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `delete_grants/event-${E}`), { uid: 'admin1', proof: PROOF, created_at: new Date(Date.now() - 10 * 60 * 1000) })
    })
    await assertFails(deleteDoc(doc(admin(), `tournaments/${T}/events/${E}`)))
  })

  it('cannot be made by a non-admin, and the proof is never readable', async () => {
    await assertFails(grant(stranger(), `event-${E}`, PROOF, 'someone'))
    await assertFails(getDoc(doc(superAdmin(), 'system/config')))
    await assertSucceeds(grant(admin(), `event-${E}`))
    await assertFails(getDoc(doc(admin(), `delete_grants/event-${E}`)))
  })

  it('still lets an admin edit them and remove single matches', async () => {
    await assertSucceeds(updateDoc(doc(admin(), `tournaments/${T}/events/${E}`), { status: 'ongoing' }))
    await assertSucceeds(deleteDoc(doc(admin(), 'group_matches/m1')))
  })
})

describe('admin accounts', () => {
  it('only the superadmin creates admins, and only as plain admins', async () => {
    const data = { role: 'admin', email: 'a@b.co', created_at: 'now', created_by: 'super1' }
    await assertSucceeds(setDoc(doc(superAdmin(), 'profiles/newadmin'), data))
    await assertFails(setDoc(doc(admin(), 'profiles/newadmin2'), data))
    await assertFails(setDoc(doc(superAdmin(), 'profiles/sneaky'), { ...data, role: 'superadmin' }))
    await assertFails(setDoc(doc(superAdmin(), 'profiles/extra'), { ...data, power: 'all' }))
  })

  it('an admin cannot promote themselves or touch other profiles', async () => {
    await assertFails(updateDoc(doc(admin(), 'profiles/admin1'), { role: 'superadmin' }))
    await assertFails(setDoc(doc(admin(), 'profiles/admin1'), { role: 'superadmin' }))
    await assertFails(getDoc(doc(admin(), 'profiles/super1')))
    await assertSucceeds(getDoc(doc(admin(), 'profiles/admin1')))
  })

  it('the superadmin can list and remove admins but not remove themselves', async () => {
    const { getDocs, collection } = await import('firebase/firestore')
    await assertSucceeds(getDocs(collection(superAdmin(), 'profiles')))
    await assertFails(getDocs(collection(admin(), 'profiles')))
    await assertSucceeds(deleteDoc(doc(superAdmin(), 'profiles/admin1')))
    await assertFails(deleteDoc(doc(superAdmin(), 'profiles/super1')))
  })

  it('only the superadmin sets the master password, as a 64-character proof', async () => {
    await assertSucceeds(setDoc(doc(superAdmin(), 'system/config'), { master_proof: 'c'.repeat(64), updated_at: 'now' }))
    await assertFails(setDoc(doc(superAdmin(), 'system/config'), { master_proof: 'short', updated_at: 'now' }))
    await assertFails(setDoc(doc(admin(), 'system/config'), { master_proof: 'c'.repeat(64), updated_at: 'now' }))
  })

  it('a removed admin loses all access', async () => {
    await assertSucceeds(deleteDoc(doc(superAdmin(), 'profiles/admin1')))
    await assertFails(updateDoc(doc(admin(), 'group_matches/m1'), { assigned_table: 1 }))
  })
})

describe('knockout_matches', () => {
  const ko = (over: Record<string, unknown> = {}) => ({
    tournament_id: T,
    event_id: E,
    round: 'semi',
    slot: 0,
    bracket_side: 'left',
    entry_a_id: 'a',
    entry_b_id: 'b',
    score_a: null,
    score_b: null,
    winner_entry_id: null,
    status: 'scheduled',
    outcome: 'normal',
    ...over,
  })

  it('accepts a bye (1–0, winner set) and pending slots with null entries', async () => {
    await assertSucceeds(
      setDoc(
        doc(admin(), 'knockout_matches/k1'),
        ko({ entry_b_id: null, score_a: 1, score_b: 0, winner_entry_id: 'a', status: 'completed', outcome: 'bye' }),
      ),
    )
    await assertSucceeds(
      setDoc(doc(admin(), 'knockout_matches/k2'), ko({ entry_a_id: null, entry_b_id: null, status: 'pending' })),
    )
  })

  it('rejects an impossible completed result', async () => {
    await assertFails(
      setDoc(doc(admin(), 'knockout_matches/k3'), ko({ score_a: 3, score_b: 0, winner_entry_id: 'nobody', status: 'completed' })),
    )
    await assertFails(
      setDoc(doc(admin(), 'knockout_matches/k4'), ko({ score_a: 3, score_b: 3, winner_entry_id: 'a', status: 'completed' })),
    )
  })
})
