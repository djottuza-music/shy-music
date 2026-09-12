/* oxlint-disable react/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { Profile, Role } from '../types'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

interface SignUpInput {
  email: string
  password: string
  displayName: string
  accountType: 'listener' | 'artist'
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  configured: boolean
  isArtist: boolean
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (input: SignUpInput) => Promise<{ needsVerification: boolean }>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  const loadProfile = useCallback(async (userId: string) => {
    if (!supabase) return setProfile(null)
    const [{ data: profileRow, error }, { data: roleRows }] = await Promise.all([
      supabase.from('profiles').select('id,display_name,username,avatar_url').eq('id', userId).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', userId),
    ])
    if (error) throw error
    if (!profileRow) return setProfile(null)
    setProfile({ ...profileRow, roles: (roleRows ?? []).map((row) => row.role as Role) } as Profile)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (session?.user.id) await loadProfile(session.user.id)
  }, [loadProfile, session])

  useEffect(() => {
    if (!supabase) {
      return
    }
    let active = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      if (data.session) await loadProfile(data.session.user.id).catch(() => setProfile(null))
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      if (!nextSession) setProfile(null)
      else queueMicrotask(() => loadProfile(nextSession.user.id).catch(() => setProfile(null)))
    })
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('SHY is not connected to Supabase yet.')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signUp = useCallback(async ({ email, password, displayName, accountType }: SignUpInput) => {
    if (!supabase) throw new Error('SHY is not connected to Supabase yet.')
    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}auth`
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo, data: { display_name: displayName, account_type: accountType } },
    })
    if (error) throw error
    return { needsVerification: !data.session }
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  const requestPasswordReset = useCallback(async (email: string) => {
    if (!supabase) throw new Error('SHY is not connected to Supabase yet.')
    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}auth?mode=recovery`
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) throw error
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    if (!supabase) throw new Error('SHY is not connected to Supabase yet.')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
  }, [])

  const roles = useMemo(() => profile?.roles ?? [], [profile?.roles])
  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    profile,
    loading,
    configured: isSupabaseConfigured,
    isArtist: roles.includes('artist') || roles.includes('admin'),
    isAdmin: roles.includes('admin'),
    signIn,
    signUp,
    signOut,
    requestPasswordReset,
    updatePassword,
    refreshProfile,
  }), [loading, profile, refreshProfile, requestPasswordReset, session, signIn, signOut, signUp, updatePassword, roles])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
