import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db, isFirebaseConfigured } from '../lib/firebase'
import type { Profile } from '../types'

interface AuthContextValue {
  user: User | null
  profile: Profile | null
  loading: boolean
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<Profile | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function fetchProfile(uid: string): Promise<Profile | null> {
  const snap = await getDoc(doc(db, 'profiles', uid))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Profile
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const profileFetchGen = useRef(0)

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false)
      return
    }

    return onAuthStateChanged(auth, async (nextUser) => {
      const gen = ++profileFetchGen.current
      setUser(nextUser)
      if (nextUser) {
        try {
          const p = await fetchProfile(nextUser.uid)
          if (gen === profileFetchGen.current) setProfile(p)
        } catch {
          if (gen === profileFetchGen.current) setProfile(null)
        }
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
  }, [])

  const signIn = async (email: string, password: string) => {
    const credential = await signInWithEmailAndPassword(auth, email, password)
    const gen = ++profileFetchGen.current
    const p = await fetchProfile(credential.user.uid)
    if (gen === profileFetchGen.current) {
      setUser(credential.user)
      setProfile(p)
    }
    if (p?.role !== 'admin') {
      await firebaseSignOut(auth)
      setUser(null)
      setProfile(null)
      throw new Error('This account does not have admin access')
    }
    return p
  }

  const signOut = async () => {
    profileFetchGen.current++
    await firebaseSignOut(auth)
    setProfile(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isAdmin: profile?.role === 'admin',
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
