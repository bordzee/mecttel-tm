import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { beforeAll, describe, expect, it } from 'vitest'
import { auth } from '../src/lib/firebaseAuth'
import { changeOwnPassword, createAdminAccount, generatePassword, listAdmins, removeAdminAccess } from '../src/lib/adminAccounts'
import { createTournament } from '../src/lib/tournamentService'
import { signInAdmin, signInPlainAdmin } from './helpers'

const stamp = Date.now()
const email = `new.admin.${stamp}@example.test`

beforeAll(signInAdmin)

describe('admin accounts without Cloud Functions', () => {
  it('generates readable passwords', () => {
    const a = generatePassword()
    expect(a).toHaveLength(14)
    expect(a).not.toMatch(/[0OIl1]/)
    expect(generatePassword()).not.toBe(a)
  })

  it('the superadmin creates an admin and stays signed in', async () => {
    const me = auth.currentUser!.uid
    const { uid, password } = await createAdminAccount(`  New.Admin.${stamp}@Example.Test `, me)
    expect(uid).toBeTruthy()
    expect(password).toHaveLength(14)
    expect(auth.currentUser!.uid).toBe(me) // the helper app did not replace the superadmin's session

    const list = await listAdmins()
    const created = list.find((p) => p.id === uid)!
    expect(created.role).toBe('admin')
    expect(created.email).toBe(email)
    expect(list[0]!.role).toBe('superadmin')

    // the new admin can sign in and work, with the generated password
    await signOut(auth)
    await signInWithEmailAndPassword(auth, email, password)
    const t = await createTournament({ name: 'Made by the new admin', venue: '', start_date: '2026-12-09' })
    expect(t.id).toBeTruthy()

    // ...and change their own password
    await expect(changeOwnPassword('wrong-password', 'a-brand-new-password')).rejects.toThrow(/current password is wrong/)
    await expect(changeOwnPassword(password, 'short')).rejects.toThrow(/at least 8/)
    await expect(changeOwnPassword(password, password)).rejects.toThrow(/different/)
    await changeOwnPassword(password, 'a-brand-new-password')
    await signOut(auth)
    await signInWithEmailAndPassword(auth, email, 'a-brand-new-password')
    await signOut(auth)
    await signInAdmin()
  })

  it('rejects a bad or duplicate email', async () => {
    const me = auth.currentUser!.uid
    await expect(createAdminAccount('not-an-email', me)).rejects.toThrow(/valid email/i)
    await expect(createAdminAccount(email, me)).rejects.toThrow(/already exists/i)
  })

  it('a normal admin can neither list nor create admins', async () => {
    await signOut(auth)
    await signInPlainAdmin()
    try {
      await expect(listAdmins()).rejects.toThrow()
      await expect(createAdminAccount(`sneaky.${stamp}@example.test`, auth.currentUser!.uid)).rejects.toThrow(/Could not save the admin profile/)
    } finally {
      await signOut(auth)
      await signInAdmin()
    }
    // the failed attempt cleaned up after itself: the address is free again
    const { uid } = await createAdminAccount(`sneaky.${stamp}@example.test`, auth.currentUser!.uid)
    await removeAdminAccess(uid)
  })

  it('removing an admin ends their access straight away', async () => {
    const list = await listAdmins()
    const target = list.find((p) => p.email === email)!
    await removeAdminAccess(target.id)
    await signOut(auth)
    await signInWithEmailAndPassword(auth, email, 'a-brand-new-password') // the login still works...
    await expect(createTournament({ name: 'Should fail', venue: '', start_date: '2026-12-09' })).rejects.toThrow() // ...but opens nothing
    await signOut(auth)
    await signInAdmin()
    expect((await listAdmins()).some((p) => p.id === target.id)).toBe(false)
  })

  it('the superadmin cannot be removed', async () => {
    await expect(removeAdminAccess(auth.currentUser!.uid)).rejects.toThrow()
  })
})
