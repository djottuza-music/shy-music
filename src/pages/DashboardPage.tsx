import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BarChart3, CalendarClock, Disc3, Gift, LayoutDashboard, MessageSquare, Music2, Save, Settings, ShoppingBag, UserCog } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { listArtistCatalog } from '../lib/catalog'
import { formatCount } from '../lib/format'
import { requireSupabase } from '../lib/supabase'
import type { Album, Artist, Track } from '../types'
import { Cover, EmptyState, ErrorState, LoadingState } from '../components/States'

const tabs = [
  ['overview', 'Overview', LayoutDashboard], ['songs', 'My Songs', Music2], ['albums', 'My Albums', Disc3],
  ['watch', 'Watch Out', CalendarClock], ['sales', 'Sales & Contracts', ShoppingBag], ['gifts', 'Gifts & Earnings', Gift],
  ['analytics', 'Analytics', BarChart3], ['messages', 'Messages', MessageSquare], ['profile', 'Profile', UserCog], ['settings', 'Settings', Settings],
] as const

export function DashboardPage() {
  const auth = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? 'overview'
  const artist = useQuery({
    queryKey: ['my-artist', auth.user?.id],
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('artists').select('*').eq('user_id', auth.user!.id).single()
      if (error) throw error
      return data as Artist
    },
    enabled: Boolean(auth.user && auth.isArtist),
  })
  const catalog = useQuery({ queryKey: ['my-catalog', artist.data?.id], queryFn: () => listArtistCatalog(artist.data!.id, true), enabled: Boolean(artist.data?.id) })

  if (auth.loading) return <LoadingState />
  if (!auth.user) return <Navigate to="/auth" replace />
  if (!auth.isArtist) return <Navigate to="/" replace />
  if (artist.isLoading || catalog.isLoading) return <LoadingState label="Loading artist tools..." />
  if (artist.error || !artist.data) return <ErrorState error={artist.error ?? new Error('Your artist profile is missing.')} retry={() => artist.refetch()} />

  return <div className="dashboard-layout">
    <aside className="dashboard-sidebar"><span className="eyebrow">Artist tools</span><strong>Songwriter Dashboard</strong><nav>{tabs.map(([id, label, Icon]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setParams({ tab: id })}><Icon />{label}</button>)}</nav></aside>
    <section className="dashboard-main">
      <div className="dashboard-title"><div><span className="eyebrow">{artist.data.display_name}</span><h1>{tabs.find(([id]) => id === tab)?.[1] ?? 'Overview'}</h1></div><Link className="button primary" to="/upload">Upload music</Link></div>
      <DashboardTab tab={tab} artist={artist.data} tracks={catalog.data?.tracks ?? []} albums={catalog.data?.albums ?? []} />
    </section>
  </div>
}

function DashboardTab({ tab, artist, tracks, albums }: { tab: string; artist: Artist; tracks: Track[]; albums: Album[] }) {
  if (tab === 'overview') return <Overview artist={artist} tracks={tracks} albums={albums} />
  if (tab === 'songs') return <Songs tracks={tracks} />
  if (tab === 'albums') return <Albums albums={albums} />
  if (tab === 'watch') return <WatchOut tracks={tracks} albums={albums} />
  if (tab === 'profile') return <ProfileEditor artist={artist} />
  if (tab === 'settings') return <SettingsPanel />
  if (tab === 'analytics') return <Analytics tracks={tracks} />
  if (tab === 'gifts') return <EmptyState title="No motivation payments yet" text="Payments sent through your configured mobile money details will be summarized here." />
  if (tab === 'sales') return <EmptyState title="No active sales or contracts" text="Song sale enquiries and completed agreements will appear here." />
  return <EmptyState title="No messages yet" text="Listener and buyer conversations will appear here." />
}

function Overview({ artist, tracks, albums }: { artist: Artist; tracks: Track[]; albums: Album[] }) {
  const streams = tracks.reduce((sum, track) => sum + track.plays_count, 0)
  const scheduled = tracks.filter((track) => track.release_status === 'scheduled').length + albums.filter((album) => album.release_status === 'scheduled').length
  return <><div className="stats-grid"><Stat label="Total streams" value={formatCount(streams)} /><Stat label="Followers" value={formatCount(artist.followers_count)} /><Stat label="Songs" value={String(tracks.length)} /><Stat label="Scheduled" value={String(scheduled)} /></div><section className="dashboard-panel"><h2>Recent songs</h2>{tracks.length ? <div className="management-list">{tracks.slice(0, 5).map((track) => <ManagementRow key={track.id} cover={track.cover_url} title={track.title} meta={`${track.release_status} · ${formatCount(track.plays_count)} streams`} />)}</div> : <EmptyState title="No songs uploaded" />}</section></>
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="stat-card"><span>{label}</span><strong>{value}</strong></div> }

function Songs({ tracks }: { tracks: Track[] }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const visible = tracks.filter((track) => (!query.trim() || track.title.toLowerCase().includes(query.trim().toLowerCase())) && (status === 'all' || track.release_status === status))
  return <section className="dashboard-panel"><div className="management-filters"><label>Search songs<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All</option><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="published">Published</option><option value="archived">Archived</option></select></label></div>{visible.length ? <div className="editor-list">{visible.map((track) => <TrackEditor key={track.id} track={track} />)}</div> : <EmptyState title={tracks.length ? 'No matching songs' : 'No songs yet'} text={tracks.length ? 'Try another title or status.' : 'Upload your first single.'} />}</section>
}

function Albums({ albums }: { albums: Album[] }) {
  return <section className="dashboard-panel">{albums.length ? <div className="editor-list">{albums.map((album) => <AlbumEditor key={album.id} album={album} />)}</div> : <EmptyState title="No albums yet" text="Albums imported or created for this artist will appear here." />}</section>
}

function TrackEditor({ track }: { track: Track }) {
  const client = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ title: track.title, release_status: track.release_status, release_at: toLocalDateTime(track.release_at), downloadable: track.downloadable })
  const save = useMutation({ mutationFn: async () => {
    const title = form.title.trim()
    if (!title) throw new Error('Title is required.')
    const releaseAt = form.release_at ? new Date(form.release_at) : null
    if (form.release_status === 'scheduled' && (!releaseAt || releaseAt <= new Date())) throw new Error('A scheduled song needs a future date and time.')
    if (form.release_status === 'published' && !releaseAt) throw new Error('A published song needs a release date.')
    const releaseIso = releaseAt?.toISOString() ?? null
    const { error } = await requireSupabase().from('tracks').update({ title, release_status: form.release_status, release_at: releaseIso, scheduled_at: form.release_status === 'scheduled' ? releaseIso : null, downloadable: form.downloadable }).eq('id', track.id)
    if (error) throw error
  }, onSuccess: async () => { await client.invalidateQueries({ queryKey: ['my-catalog'] }); setEditing(false) } })
  if (!editing) return <ManagementRow cover={track.cover_url} title={track.title} meta={`${track.release_status} · ${formatCount(track.plays_count)} streams · ${track.downloadable ? 'download enabled' : 'stream only'}`} action={<div className="row-buttons"><Link className="button secondary" to={`/tracks/${track.slug}`}>View</Link><button className="button secondary" onClick={() => setEditing(true)}>Edit</button></div>} />
  return <form className="editor-row" onSubmit={(event) => { event.preventDefault(); save.mutate() }}><Cover src={track.cover_url} alt={track.title} /><div className="editor-fields"><label>Title<input value={form.title} onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} /></label><label>Status<select value={form.release_status} onChange={(event) => setForm((value) => ({ ...value, release_status: event.target.value as Track['release_status'] }))}><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="published">Published</option><option value="archived">Archived</option></select></label><label>Release date and time<input type="datetime-local" value={form.release_at} onChange={(event) => setForm((value) => ({ ...value, release_at: event.target.value }))} /></label><label className="check-label"><input type="checkbox" checked={form.downloadable} onChange={(event) => setForm((value) => ({ ...value, downloadable: event.target.checked }))} />Allow free download</label>{save.error && <p className="form-message error">{save.error.message}</p>}<div className="row-buttons"><button type="button" className="button secondary" onClick={() => setEditing(false)}>Cancel</button><button className="button primary" disabled={save.isPending}><Save />{save.isPending ? 'Saving...' : 'Save song'}</button></div></div></form>
}

function AlbumEditor({ album }: { album: Album }) {
  const client = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ title: album.title, release_status: album.release_status, release_at: toLocalDateTime(album.release_at) })
  const save = useMutation({ mutationFn: async () => {
    const title = form.title.trim()
    if (!title) throw new Error('Title is required.')
    const releaseAt = form.release_at ? new Date(form.release_at) : null
    if (form.release_status === 'scheduled' && (!releaseAt || releaseAt <= new Date())) throw new Error('A scheduled album needs a future date and time.')
    if (form.release_status === 'published' && !releaseAt) throw new Error('A published album needs a release date.')
    const db = requireSupabase()
    const releaseIso = releaseAt?.toISOString() ?? null
    const patch = { title, release_status: form.release_status, release_at: releaseIso, scheduled_at: form.release_status === 'scheduled' ? releaseIso : null }
    const [albumResult, tracksResult] = await Promise.all([db.from('albums').update(patch).eq('id', album.id), db.from('tracks').update({ release_status: form.release_status, release_at: patch.release_at, scheduled_at: patch.scheduled_at }).eq('album_id', album.id)])
    if (albumResult.error) throw albumResult.error
    if (tracksResult.error) throw tracksResult.error
  }, onSuccess: async () => { await client.invalidateQueries({ queryKey: ['my-catalog'] }); setEditing(false) } })
  if (!editing) return <ManagementRow cover={album.cover_url} title={album.title} meta={`${album.release_type} · ${album.release_status} · ${album.track_count ?? 0} tracks`} action={<div className="row-buttons"><Link className="button secondary" to={`/albums/${album.slug}`}>View</Link><button className="button secondary" onClick={() => setEditing(true)}>Edit</button></div>} />
  return <form className="editor-row" onSubmit={(event) => { event.preventDefault(); save.mutate() }}><Cover src={album.cover_url} alt={album.title} /><div className="editor-fields"><label>Album title<input value={form.title} onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} /></label><label>Status<select value={form.release_status} onChange={(event) => setForm((value) => ({ ...value, release_status: event.target.value as Album['release_status'] }))}><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="published">Published</option><option value="archived">Archived</option></select></label><label>Release date and time<input type="datetime-local" value={form.release_at} onChange={(event) => setForm((value) => ({ ...value, release_at: event.target.value }))} /></label>{save.error && <p className="form-message error">{save.error.message}</p>}<div className="row-buttons"><button type="button" className="button secondary" onClick={() => setEditing(false)}>Cancel</button><button className="button primary" disabled={save.isPending}><Save />{save.isPending ? 'Saving...' : 'Save album'}</button></div></div></form>
}

function WatchOut({ tracks, albums }: { tracks: Track[]; albums: Album[] }) {
  const scheduled = useMemo(() => [
    ...tracks.filter((item) => item.release_status === 'scheduled').map((item) => ({ ...item, kind: 'track' as const })),
    ...albums.filter((item) => item.release_status === 'scheduled').map((item) => ({ ...item, kind: 'album' as const })),
  ], [albums, tracks])
  return <section className="dashboard-panel"><h2>Scheduled releases</h2>{scheduled.length ? <div className="scheduled-grid">{scheduled.map((item) => <ScheduledEditor key={`${item.kind}-${item.id}`} item={item} />)}</div> : <EmptyState title="Nothing scheduled" text="Choose a future date when uploading music and it will appear here." />}</section>
}

function ScheduledEditor({ item }: { item: (Track | Album) & { kind: 'track' | 'album' } }) {
  const client = useQueryClient()
  const [title, setTitle] = useState(item.title)
  const [releaseAt, setReleaseAt] = useState(item.release_at ? new Date(item.release_at).toISOString().slice(0, 16) : '')
  const save = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error('Title is required.')
      if (!releaseAt || new Date(releaseAt) <= new Date()) throw new Error('Choose a future date and time.')
      const table = item.kind === 'track' ? 'tracks' : 'albums'
      const releaseIso = new Date(releaseAt).toISOString()
      const { error } = await requireSupabase().from(table).update({ title: title.trim(), release_at: releaseIso, scheduled_at: releaseIso }).eq('id', item.id)
      if (error) throw error
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['my-catalog'] }),
  })
  return <form className="scheduled-card" onSubmit={(event) => { event.preventDefault(); save.mutate() }}><Cover src={'cover_url' in item ? item.cover_url : null} alt={item.title} /><div><span className="status-pill">Scheduled {item.kind}</span><label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>Go live date and time<input type="datetime-local" value={releaseAt} onChange={(event) => setReleaseAt(event.target.value)} /></label>{save.error && <p className="form-message error">{save.error.message}</p>}{save.isSuccess && <p className="form-message success">Release updated.</p>}<button className="button primary" disabled={save.isPending}><Save />{save.isPending ? 'Saving...' : 'Save changes'}</button></div></form>
}

function Analytics({ tracks }: { tracks: Track[] }) {
  const sorted = [...tracks].sort((a, b) => b.plays_count - a.plays_count)
  return <section className="dashboard-panel"><h2>Top songs</h2>{sorted.length ? <div className="analytics-list">{sorted.map((track) => <div key={track.id}><span>{track.title}</span><div><i style={{ width: `${Math.max(4, (track.plays_count / Math.max(sorted[0].plays_count, 1)) * 100)}%` }} /></div><strong>{formatCount(track.plays_count)}</strong></div>)}</div> : <EmptyState title="No listening data yet" />}</section>
}

function ProfileEditor({ artist }: { artist: Artist }) {
  const client = useQueryClient()
  const [form, setForm] = useState({ display_name: artist.display_name, bio: artist.bio ?? '', country: artist.country ?? '', motivation_phone: artist.motivation_phone ?? '', tags: artist.tags.join(', ') })
  const save = useMutation({ mutationFn: async () => {
    const { error } = await requireSupabase().from('artists').update({ ...form, tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean) }).eq('id', artist.id)
    if (error) throw error
  }, onSuccess: () => client.invalidateQueries({ queryKey: ['my-artist'] }) })
  const field = (name: keyof typeof form) => ({ value: form[name], onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((value) => ({ ...value, [name]: event.target.value })) })
  return <form className="dashboard-panel form-grid" onSubmit={(event) => { event.preventDefault(); save.mutate() }}><label>Artist name<input {...field('display_name')} required /></label><label>Country<input {...field('country')} /></label><label className="wide">Biography<textarea {...field('bio')} rows={5} /></label><label>Motivation mobile number<input {...field('motivation_phone')} inputMode="tel" /></label><label>Tags<input {...field('tags')} placeholder="afropop, songwriter" /></label>{save.error && <p className="form-message error wide">{save.error.message}</p>}<button className="button primary" disabled={save.isPending}><Save />Save profile</button></form>
}

function SettingsPanel() {
  const [newMusic, setNewMusic] = useState(() => localStorage.getItem('shy-notify-new-music') !== 'false')
  const [weekly, setWeekly] = useState(() => localStorage.getItem('shy-notify-weekly') !== 'false')
  const save = () => { localStorage.setItem('shy-notify-new-music', String(newMusic)); localStorage.setItem('shy-notify-weekly', String(weekly)) }
  return <section className="dashboard-panel settings-list"><Toggle label="New music notifications" checked={newMusic} onChange={setNewMusic} /><Toggle label="Weekly artist summary" checked={weekly} onChange={setWeekly} /><button className="button primary" onClick={save}><Save />Save preferences</button></section>
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="toggle-row"><span>{label}</span><input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label> }

function ManagementRow({ cover, title, meta, action }: { cover?: string | null; title: string; meta: string; action?: React.ReactNode }) { return <div className="management-row"><Cover src={cover} alt={title} /><div><strong>{title}</strong><span>{meta}</span></div>{action}</div> }

function toLocalDateTime(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}
