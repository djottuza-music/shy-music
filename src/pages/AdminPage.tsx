import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, UserRoundCog } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { useAuth } from '../contexts/AuthContext'
import { requireSupabase } from '../lib/supabase'
import type { Role } from '../types'

export function AdminPage() {
  const auth = useAuth()
  const client = useQueryClient()
  const users = useQuery({ queryKey: ['admin-users'], queryFn: async () => {
    const { data, error } = await requireSupabase().from('profiles').select('id,display_name,username,is_suspended,user_roles(role)').order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  }, enabled: auth.isAdmin })
  const role = useMutation({ mutationFn: async ({ userId, role: roleName, enabled }: { userId: string; role: Role; enabled: boolean }) => {
    const { error } = await requireSupabase().rpc('admin_set_user_role', { p_user_id: userId, p_role: roleName, p_enabled: enabled })
    if (error) throw error
  }, onSuccess: () => client.invalidateQueries({ queryKey: ['admin-users'] }) })
  const suspend = useMutation({ mutationFn: async ({ userId, suspended }: { userId: string; suspended: boolean }) => {
    const { error } = await requireSupabase().rpc('admin_set_user_suspension', { p_user_id: userId, p_suspended: suspended })
    if (error) throw error
  }, onSuccess: () => client.invalidateQueries({ queryKey: ['admin-users'] }) })
  if (auth.loading) return <LoadingState />
  if (!auth.user || !auth.isAdmin) return <Navigate to="/" replace />
  if (users.isLoading) return <LoadingState label="Loading administration..." />
  if (users.error) return <ErrorState error={users.error} retry={() => users.refetch()} />
  return <div><div className="page-heading"><div><span className="eyebrow"><ShieldCheck />Administration</span><h1>People and access</h1><p>Role and suspension changes are enforced by Supabase policies.</p></div></div><section className="dashboard-panel">{users.data?.length ? <div className="admin-table">{users.data.map((user: any) => { const roles = (user.user_roles ?? []).map((row: any) => row.role as Role); return <div className="admin-row" key={user.id}><div className="admin-user"><UserRoundCog /><span><strong>{user.display_name}</strong><small>{user.id}</small></span></div><div className="role-controls">{(['listener','artist','admin'] as Role[]).map((value) => <label key={value}><input type="checkbox" checked={roles.includes(value)} onChange={(event) => role.mutate({ userId: user.id, role: value, enabled: event.target.checked })} />{value}</label>)}</div><button className={`button ${user.is_suspended ? 'primary' : 'danger'}`} onClick={() => suspend.mutate({ userId: user.id, suspended: !user.is_suspended })}>{user.is_suspended ? 'Restore' : 'Suspend'}</button></div> })}</div> : <EmptyState title="No accounts found" />}{(role.error || suspend.error) && <p className="form-message error">{(role.error ?? suspend.error)?.message}</p>}</section></div>
}
