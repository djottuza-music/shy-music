import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, BadgeCheck, ClipboardList, FileWarning, Headphones, LifeBuoy, ShieldCheck, Trash2, UserRoundCog, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { useAuth } from '../contexts/AuthContext'
import { formatFriendlyDate } from '../lib/presentation'
import { requireSupabase } from '../lib/supabase'
import type { Role } from '../types'

type AdminTab = 'people' | 'artists' | 'music' | 'reports' | 'support' | 'deletions' | 'audit'
type MutationLike = { mutate: (value: never) => void; isPending: boolean }

const tabs = [
  ['people', 'People', UserRoundCog], ['artists', 'Artists', UsersRound], ['music', 'Music', Headphones],
  ['reports', 'Reports', FileWarning], ['support', 'Support', LifeBuoy], ['deletions', 'Deletion requests', Trash2], ['audit', 'Audit log', ClipboardList],
] as const

export function AdminPage() {
  const auth = useAuth()
  const client = useQueryClient()
  const [tab, setTab] = useState<AdminTab>('people')
  const enabled = auth.isAdmin
  const users = useQuery({ queryKey: ['admin-users'], queryFn: async () => {
    const { data, error } = await requireSupabase().from('profiles').select('id,display_name,username,is_suspended,is_admin,user_roles(role)').order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  }, enabled: enabled && tab === 'people' })
  const artists = useQuery({ queryKey: ['admin-artists'], queryFn: async () => {
    const { data, error } = await requireSupabase().from('artists').select('id,display_name,slug,verified,followers_count,is_active,created_at').order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  }, enabled: enabled && tab === 'artists' })
  const music = useQuery({ queryKey: ['admin-music'], queryFn: async () => {
    const { data, error } = await requireSupabase().from('tracks').select('id,title,release_status,release_at,artist:artists(display_name)').order('created_at', { ascending: false }).limit(100)
    if (error) throw error
    return data ?? []
  }, enabled: enabled && tab === 'music' })
  const reports = useQuery({ queryKey: ['admin-reports'], queryFn: () => loadCases('reports', 'id,target_type,target_id,reason,status,created_at'), enabled: enabled && tab === 'reports' })
  const support = useQuery({ queryKey: ['admin-support'], queryFn: () => loadCases('support_requests', 'id,contact_email,category,subject,message,status,created_at'), enabled: enabled && tab === 'support' })
  const deletions = useQuery({ queryKey: ['admin-deletions'], queryFn: () => loadCases('account_deletion_requests', 'id,user_id,reason,status,created_at,profile:profiles(display_name)'), enabled: enabled && tab === 'deletions' })
  const audit = useQuery({ queryKey: ['admin-audit'], queryFn: () => loadCases('audit_log', 'id,actor_id,action,target_type,target_id,details,created_at'), enabled: enabled && tab === 'audit' })

  const role = useMutation({ mutationFn: async ({ userId, role: roleName, active }: { userId: string; role: Role; active: boolean }) => {
    const { error } = await requireSupabase().rpc('admin_set_user_role', { p_user_id: userId, p_role: roleName, p_enabled: active })
    if (error) throw error
  }, onSuccess: () => client.invalidateQueries({ queryKey: ['admin-users'] }) })
  const suspend = useMutation({ mutationFn: async ({ userId, suspended }: { userId: string; suspended: boolean }) => {
    const { error } = await requireSupabase().rpc('admin_set_user_suspension', { p_user_id: userId, p_suspended: suspended })
    if (error) throw error
  }, onSuccess: () => client.invalidateQueries({ queryKey: ['admin-users'] }) })
  const verify = useMutation({ mutationFn: async ({ artistId, verified }: { artistId: string; verified: boolean }) => {
    const { error } = await requireSupabase().rpc('admin_set_artist_verified', { p_artist_id: artistId, p_verified: verified })
    if (error) throw error
  }, onSuccess: () => Promise.all([client.invalidateQueries({ queryKey: ['admin-artists'] }), client.invalidateQueries({ queryKey: ['artists'] })]) })
  const release = useMutation({ mutationFn: async ({ id, status }: { id: string; status: string }) => {
    const { error } = await requireSupabase().rpc('admin_set_release_status', { p_table: 'tracks', p_id: id, p_status: status })
    if (error) throw error
  }, onSuccess: () => client.invalidateQueries({ queryKey: ['admin-music'] }) })
  const caseStatus = useMutation({ mutationFn: async ({ table, id, status }: { table: string; id: string; status: string }) => {
    const { error } = await requireSupabase().rpc('admin_set_case_status', { p_table: table, p_id: id, p_status: status })
    if (error) throw error
  }, onSuccess: () => client.invalidateQueries({ queryKey: ['admin'] }) })

  if (auth.loading) return <LoadingState />
  if (!auth.user || !auth.isAdmin) return <Navigate to="/" replace />
  const currentQuery = { people: users, artists, music, reports, support, deletions, audit }[tab]

  return <div className="admin-page">
    <header className="page-heading"><div><span className="eyebrow"><ShieldCheck />Restricted administration</span><h1>SHY control room</h1><p>Manage artists, accounts, releases, reports, support, and the audit trail.</p></div><Link className="button secondary" to="/"><ArrowLeft />Back to SHY</Link></header>
    <nav className="admin-tabs" aria-label="Administration sections">{tabs.map(([id, label, Icon]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon />{label}</button>)}</nav>
    {currentQuery.isLoading && <LoadingState label={`Loading ${tab}...`} />}
    {currentQuery.error && <ErrorState error={currentQuery.error} retry={() => currentQuery.refetch()} />}
    {!currentQuery.isLoading && !currentQuery.error && <>
      {tab === 'people' && <PeoplePanel users={users.data ?? []} role={role as unknown as MutationLike} suspend={suspend as unknown as MutationLike} />}
      {tab === 'artists' && <ArtistsPanel artists={artists.data ?? []} verify={verify as unknown as MutationLike} />}
      {tab === 'music' && <MusicPanel tracks={music.data ?? []} update={release as unknown as MutationLike} />}
      {tab === 'reports' && <CasePanel rows={reports.data ?? []} table="reports" statuses={['open','reviewing','resolved','dismissed']} update={caseStatus as unknown as MutationLike} />}
      {tab === 'support' && <CasePanel rows={support.data ?? []} table="support_requests" statuses={['open','reviewing','resolved','closed']} update={caseStatus as unknown as MutationLike} />}
      {tab === 'deletions' && <CasePanel rows={deletions.data ?? []} table="account_deletion_requests" statuses={['open','reviewing','completed','cancelled']} update={caseStatus as unknown as MutationLike} />}
      {tab === 'audit' && <CasePanel rows={audit.data ?? []} table="audit_log" statuses={[]} update={caseStatus as unknown as MutationLike} />}
    </>}
    {(role.error || suspend.error || verify.error || release.error || caseStatus.error) && <p className="form-message error" role="alert">{(role.error ?? suspend.error ?? verify.error ?? release.error ?? caseStatus.error)?.message}</p>}
  </div>
}

async function loadCases(table: string, select: string) {
  const { data, error } = await requireSupabase().from(table).select(select).order('created_at', { ascending: false }).limit(100)
  if (error) throw error
  return (data ?? []) as unknown as Record<string, unknown>[]
}

function PeoplePanel({ users, role, suspend }: { users: Record<string, unknown>[]; role: MutationLike; suspend: MutationLike }) {
  if (!users.length) return <EmptyState title="No accounts found" text="New SHY accounts will appear here." />
  return <section className="dashboard-panel"><div className="admin-table">{users.map((user) => {
    const roles = ((user.user_roles as Array<{ role: Role }>) ?? []).map((row) => row.role)
    const protectedAdmin = Boolean(user.is_admin)
    return <div className="admin-row" key={String(user.id)}><div className="admin-user"><UserRoundCog /><span><strong>{String(user.display_name)}</strong><small>{String(user.username ?? user.id)}</small></span></div><div className="role-controls">{(['listener','artist','admin'] as Role[]).map((value) => <label key={value}><input type="checkbox" checked={value === 'admin' ? protectedAdmin || roles.includes(value) : roles.includes(value)} disabled={role.isPending || (value === 'admin' && protectedAdmin)} onChange={(event) => role.mutate({ userId: user.id, role: value, active: event.target.checked } as never)} />{value}</label>)}</div><button className={`button ${user.is_suspended ? 'primary' : 'danger'}`} disabled={suspend.isPending || protectedAdmin} onClick={() => suspend.mutate({ userId: user.id, suspended: !user.is_suspended } as never)}>{protectedAdmin ? 'Protected admin' : user.is_suspended ? 'Restore' : 'Suspend'}</button></div>
  })}</div></section>
}

function ArtistsPanel({ artists, verify }: { artists: Record<string, unknown>[]; verify: MutationLike }) {
  if (!artists.length) return <EmptyState title="No artists found" text="Artist profiles will appear here after signup." />
  return <section className="dashboard-panel"><h2>Artist management</h2><div className="admin-table">{artists.map((artist) => <div className="admin-row" key={String(artist.id)}><div className="admin-user"><UsersRound /><span><strong>{String(artist.display_name)}{Boolean(artist.verified) && <VerifiedBadge />}</strong><small>{String(artist.followers_count ?? 0)} followers</small></span></div><label className="verified-toggle"><input type="checkbox" checked={Boolean(artist.verified)} disabled={verify.isPending} onChange={(event) => verify.mutate({ artistId: artist.id, verified: event.target.checked } as never)} /><BadgeCheck />Verified</label><Link className="button secondary" to={`/artists/${artist.slug}`}>Open profile</Link></div>)}</div></section>
}

function MusicPanel({ tracks, update }: { tracks: Record<string, unknown>[]; update: MutationLike }) {
  if (!tracks.length) return <EmptyState title="No catalogue entries" text="Uploaded releases will appear here." />
  return <section className="dashboard-panel"><h2>Catalogue moderation</h2><div className="case-list">{tracks.map((track) => <article key={String(track.id)}><div><strong>{String(track.title)}</strong><small>{String((track.artist as { display_name?: string })?.display_name ?? 'Unknown artist')}</small></div><label>Status<select value={String(track.release_status)} disabled={update.isPending} onChange={(event) => update.mutate({ id: track.id, status: event.target.value } as never)}>{['draft','scheduled','published','archived'].map((status) => <option key={status}>{status}</option>)}</select></label></article>)}</div></section>
}

function CasePanel({ rows, table, statuses, update }: { rows: Record<string, unknown>[]; table: string; statuses: string[]; update: MutationLike }) {
  if (!rows.length) return <EmptyState title="Nothing waiting here" text="This queue is clear." />
  return <section className="dashboard-panel"><div className="case-list">{rows.map((row) => <article key={String(row.id)}><div><strong>{String(row.subject ?? row.action ?? row.reason ?? row.target_type ?? 'Item')}</strong><small>{row.created_at ? formatFriendlyDate(String(row.created_at)) : ''}</small>{row.message ? <p>{String(row.message)}</p> : null}</div>{statuses.length > 0 && <label>Status<select value={String(row.status)} disabled={update.isPending} onChange={(event) => update.mutate({ table, id: row.id, status: event.target.value } as never)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>}</article>)}</div></section>
}
