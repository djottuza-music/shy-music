import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, FileWarning, Headphones, LifeBuoy, ShieldCheck, Trash2, UserRoundCog } from 'lucide-react'
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { useAuth } from '../contexts/AuthContext'
import { requireSupabase } from '../lib/supabase'
import type { Role } from '../types'

type AdminTab = 'people' | 'music' | 'reports' | 'support' | 'deletions' | 'audit'

export function AdminPage() {
  const auth = useAuth()
  const client = useQueryClient()
  const [tab, setTab] = useState<AdminTab>('people')
  const users = useQuery({ queryKey: ['admin-users'], queryFn: async () => {
    const { data, error } = await requireSupabase().from('profiles').select('id,display_name,username,is_suspended,user_roles(role)').order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  }, enabled: auth.isAdmin && tab === 'people' })
  const music = useQuery({ queryKey: ['admin-music'], queryFn: async () => {
    const { data, error } = await requireSupabase().from('tracks').select('id,title,release_status,release_at,artist:artists(display_name)').order('created_at', { ascending: false }).limit(100)
    if (error) throw error
    return data ?? []
  }, enabled: auth.isAdmin && tab === 'music' })
  const reports = useQuery({ queryKey: ['admin-reports'], queryFn: () => loadCases('reports', 'id,target_type,target_id,reason,status,created_at'), enabled: auth.isAdmin && tab === 'reports' })
  const support = useQuery({ queryKey: ['admin-support'], queryFn: () => loadCases('support_requests', 'id,contact_email,category,subject,message,status,created_at'), enabled: auth.isAdmin && tab === 'support' })
  const deletions = useQuery({ queryKey: ['admin-deletions'], queryFn: () => loadCases('account_deletion_requests', 'id,user_id,reason,status,created_at,profile:profiles(display_name)'), enabled: auth.isAdmin && tab === 'deletions' })
  const audit = useQuery({ queryKey: ['admin-audit'], queryFn: () => loadCases('audit_log', 'id,actor_id,action,target_type,target_id,details,created_at'), enabled: auth.isAdmin && tab === 'audit' })

  const role = useMutation({ mutationFn: async ({ userId, role: roleName, enabled }: { userId: string; role: Role; enabled: boolean }) => {
    const { error } = await requireSupabase().rpc('admin_set_user_role', { p_user_id: userId, p_role: roleName, p_enabled: enabled })
    if (error) throw error
  }, onSuccess: () => client.invalidateQueries({ queryKey: ['admin-users'] }) })
  const suspend = useMutation({ mutationFn: async ({ userId, suspended }: { userId: string; suspended: boolean }) => {
    const { error } = await requireSupabase().rpc('admin_set_user_suspension', { p_user_id: userId, p_suspended: suspended })
    if (error) throw error
  }, onSuccess: () => client.invalidateQueries({ queryKey: ['admin-users'] }) })
  const caseStatus = useMutation({ mutationFn: async ({ table, id, status }: { table: string; id: string; status: string }) => {
    const { error } = await requireSupabase().rpc('admin_set_case_status', { p_table: table, p_id: id, p_status: status })
    if (error) throw error
  }, onSuccess: () => client.invalidateQueries({ queryKey: ['admin'] }) })
  const releaseStatus = useMutation({ mutationFn: async ({ id, status }: { id: string; status: string }) => {
    const { error } = await requireSupabase().rpc('admin_set_release_status', { p_table: 'tracks', p_id: id, p_status: status })
    if (error) throw error
  }, onSuccess: () => client.invalidateQueries({ queryKey: ['admin-music'] }) })

  if (auth.loading) return <LoadingState />
  if (!auth.user || !auth.isAdmin) return <Navigate to="/" replace />
  const currentQuery = { people: users, music, reports, support, deletions, audit }[tab]
  if (currentQuery.isLoading) return <LoadingState label="Loading administration..." />
  if (currentQuery.error) return <ErrorState error={currentQuery.error} retry={() => currentQuery.refetch()} />

  return <div><div className="page-heading"><div><span className="eyebrow"><ShieldCheck />Restricted administration</span><h1>SHY control room</h1><p>Review access, catalogue status, reports, support, deletion requests, and the administrative audit trail.</p></div></div><nav className="admin-tabs" aria-label="Administration sections">{([['people','People',UserRoundCog],['music','Music',Headphones],['reports','Reports',FileWarning],['support','Support',LifeBuoy],['deletions','Deletion requests',Trash2],['audit','Audit log',ClipboardList]] as const).map(([id,label,Icon]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon />{label}</button>)}</nav>
    {tab === 'people' && <PeoplePanel users={users.data ?? []} role={role} suspend={suspend} />}
    {tab === 'music' && <MusicPanel tracks={music.data ?? []} changeStatus={(id, status) => releaseStatus.mutate({ id, status })} busy={releaseStatus.isPending} />}
    {tab === 'reports' && <CasePanel rows={reports.data ?? []} table="reports" statuses={['open','reviewing','resolved','dismissed']} update={(id,status) => caseStatus.mutate({ table: 'reports', id, status })} />}
    {tab === 'support' && <CasePanel rows={support.data ?? []} table="support_requests" statuses={['open','reviewing','resolved','closed']} update={(id,status) => caseStatus.mutate({ table: 'support_requests', id, status })} />}
    {tab === 'deletions' && <CasePanel rows={deletions.data ?? []} table="account_deletion_requests" statuses={['open','reviewing','completed','cancelled']} update={(id,status) => caseStatus.mutate({ table: 'account_deletion_requests', id, status })} />}
    {tab === 'audit' && <CasePanel rows={audit.data ?? []} table="audit_log" statuses={[]} />}
    {(role.error || suspend.error || caseStatus.error || releaseStatus.error) && <p className="form-message error" role="alert">{(role.error ?? suspend.error ?? caseStatus.error ?? releaseStatus.error)?.message}</p>}
  </div>
}

async function loadCases(table: string, select: string) {
  const { data, error } = await requireSupabase().from(table).select(select).order('created_at', { ascending: false }).limit(100)
  if (error) throw error
  return (data ?? []) as unknown as Record<string, unknown>[]
}

function PeoplePanel({ users, role, suspend }: { users: any[]; role: any; suspend: any }) {
  return <section className="dashboard-panel">{users.length ? <div className="admin-table">{users.map((user) => { const roles = (user.user_roles ?? []).map((row: any) => row.role as Role); return <div className="admin-row" key={user.id}><div className="admin-user"><UserRoundCog /><span><strong>{user.display_name}</strong><small>{user.id}</small></span></div><div className="role-controls">{(['listener','artist','admin'] as Role[]).map((value) => <label key={value}><input type="checkbox" checked={roles.includes(value)} onChange={(event) => role.mutate({ userId: user.id, role: value, enabled: event.target.checked })} />{value}</label>)}</div><button className={`button ${user.is_suspended ? 'primary' : 'danger'}`} onClick={() => suspend.mutate({ userId: user.id, suspended: !user.is_suspended })}>{user.is_suspended ? 'Restore' : 'Suspend'}</button></div> })}</div> : <EmptyState title="No accounts found" />}</section>
}

function MusicPanel({ tracks, changeStatus, busy }: { tracks: any[]; changeStatus: (id: string, status: string) => void; busy: boolean }) {
  return <section className="dashboard-panel"><h2>Catalogue moderation</h2>{tracks.length ? <div className="case-list">{tracks.map((track) => <article key={track.id}><div><strong>{track.title}</strong><span>{track.artist?.display_name ?? 'Unknown artist'} · {track.release_status}</span></div><button className={`button ${track.release_status === 'archived' ? 'secondary' : 'danger'}`} disabled={busy} onClick={() => changeStatus(track.id, track.release_status === 'archived' ? 'published' : 'archived')}>{track.release_status === 'archived' ? 'Restore' : 'Archive'}</button></article>)}</div> : <EmptyState title="No music found" />}</section>
}

function CasePanel({ rows, table, statuses, update }: { rows: Record<string, any>[]; table: string; statuses: string[]; update?: (id: string, status: string) => void }) {
  return <section className="dashboard-panel">{rows.length ? <div className="case-list">{rows.map((row) => <article key={String(row.id)}><div><strong>{caseTitle(row, table)}</strong><span>{caseDetail(row, table)}</span><small>{new Date(row.created_at).toLocaleString()}</small></div>{statuses.length > 0 && <label>Status<select value={row.status} onChange={(event) => update?.(row.id, event.target.value)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>}</article>)}</div> : <EmptyState title="Nothing to review" />}</section>
}

function caseTitle(row: Record<string, any>, table: string) {
  if (table === 'support_requests') return row.subject
  if (table === 'reports') return `${row.target_type} report`
  if (table === 'account_deletion_requests') return row.profile?.display_name ?? row.user_id
  return row.action
}

function caseDetail(row: Record<string, any>, table: string) {
  if (table === 'support_requests') return `${row.category} · ${row.contact_email} · ${row.message}`
  if (table === 'reports') return `${row.reason} · target ${row.target_id}`
  if (table === 'account_deletion_requests') return row.reason || 'No reason supplied.'
  return `${row.target_type}${row.target_id ? ` · ${row.target_id}` : ''}`
}
