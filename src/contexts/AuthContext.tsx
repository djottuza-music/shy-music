/* oxlint-disable react/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { Profile, Role } from '../types'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { canUseAccountMode, readAccountMode, storeAccountMode, type AccountMode } from '../lib/accountMode'

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
  activeMode: AccountMode
  isArtist: boolean
  isAdmin: boolean
  signIn: (email: string, password: string, mode: AccountMode) => Promise<void>
  setAccountMode: (mode: AccountMode) => void
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
  const [activeMode, setActiveModeState] = useState<AccountMode>(readAccountMode)
  const activeModeRef = useRef(activeMode)

  const setAccountMode = useCallback((mode: AccountMode) => {
    const roles = profile?.roles ?? []
    if (!canUseAccountMode(roles, mode)) throw new Error('This account does not have artist access.')
    activeModeRef.current = mode
    setActiveModeState(mode)
    storeAccountMode(mode)
  }, [profile?.roles])

  const loadProfile = useCallback(async (userId: string) => {
    if (!supabase) return setProfile(null)
    const [{ data: profileRow, error }, { data: roleRows }] = await Promise.all([
      supabase.from('profiles').select('id,display_name,username,avatar_url').eq('id', userId).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', userId),
    ])
    if (error) throw error
    if (!profileRow) return setProfile(null)
    const nextProfile = { ...profileRow, roles: (roleRows ?? []).map((row) => row.role as Role) } as Profile
    setProfile(nextProfile)
    if (!canUseAccountMode(nextProfile.roles, activeModeRef.current)) {
      activeModeRef.current = 'listener'
      setActiveModeState('listener')
      storeAccountMode('listener')
    }
    return nextProfile
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

  const signIn = useCallback(async (email: string, password: string, mode: AccountMode) => {
    if (!supabase) throw new Error('SHY is not connected to Supabase yet.')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    try {
      const nextProfile = await loadProfile(data.user.id)
      const roles = nextProfile?.roles ?? []
      if (!canUseAccountMode(roles, mode)) {
        await supabase.auth.signOut()
        throw new Error('This account is registered as a listener. Choose Listener, or ask SHY support to enable artist access.')
      }
      activeModeRef.current = mode
      setActiveModeState(mode)
      storeAccountMode(mode)
    } catch (caught) {
      await supabase.auth.signOut()
      throw caught
    }
  }, [loadProfile])

  const signUp = useCallback(async ({ email, password, displayName, accountType }: SignUpInput) => {
    if (!supabase) throw new Error('SHY is not connected to Supabase yet.')
    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}auth`
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo, data: { display_name: displayName, account_type: accountType } },
    })
    if (error) throw error
    if (data.session) {
      activeModeRef.current = accountType
      setActiveModeState(accountType)
      storeAccountMode(accountType)
    }
    return { needsVerification: !data.session }
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    activeModeRef.current = 'listener'
    setActiveModeState('listener')
    storeAccountMode('listener')
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
    activeMode,
    isArtist: activeMode === 'artist' && (roles.includes('artist') || roles.includes('admin')),
    isAdmin: activeMode === 'artist' && roles.includes('admin'),
    signIn,
    setAccountMode,
    signUp,
    signOut,
    requestPasswordReset,
    updatePassword,
    refreshProfile,
  }), [activeMode, loading, profile, refreshProfile, requestPasswordReset, session, setAccountMode, signIn, signOut, signUp, updatePassword, roles])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
