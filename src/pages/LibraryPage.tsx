import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Heart, ListMusic, Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { TrackRow } from '../components/TrackRow'
import { useAuth } from '../contexts/AuthContext'
import { publicStorageUrl, requireSupabase } from '../lib/supabase'
import type { Playlist, Track } from '../types'

type LibraryTab = 'liked' | 'playlists'

export function LibraryPage() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<LibraryTab>('liked')
  const [name, setName] = useState('')
  const [isPublic, setPublic] = useState(false)
  const liked = useQuery({ queryKey: ['library', auth.user?.id], queryFn: async () => {
    const { data, error } = await requireSupabase().from('likes').select('track:tracks(*, artist:artists(display_name,slug,avatar_url,verified,country), album:albums(title,slug,cover_path))').eq('user_id', auth.user!.id).order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map((row: any) => ({ ...row.track, cover_url: publicStorageUrl('covers', row.track.cover_path ?? row.track.album?.cover_path) })) as Track[]
  }, enabled: Boolean(auth.user) })
  const playlists = useQuery({ queryKey: ['playlists', auth.user?.id], queryFn: async () => {
    const { data, error } = await requireSupabase().from('playlists').select('*, playlist_tracks(count)').eq('user_id', auth.user!.id).order('updated_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map((playlist: any) => ({ ...playlist, track_count: playlist.playlist_tracks?.[0]?.count ?? 0 })) as Array<Playlist & { track_count: number }>
  }, enabled: Boolean(auth.user) })
  const create = useMutation({ mutationFn: async () => {
    const cleanName = name.trim()
    if (!cleanName) throw new Error('Give your playlist a name.')
    const { error } = await requireSupabase().from('playlists').insert({ user_id: auth.user!.id, name: cleanName, is_public: isPublic })
    if (error) throw error
  }, onSuccess: async () => {
    setName('')
    setPublic(false)
    await queryClient.invalidateQueries({ queryKey: ['playlists', auth.user?.id] })
  } })

  if (auth.loading) return <LoadingState />
  if (!auth.user) return <Navigate to="/auth" replace />
  if (liked.isLoading || playlists.isLoading) return <LoadingState label="Loading your library..." />
  const loadError = liked.error || playlists.error
  if (loadError) return <ErrorState error={loadError} retry={() => { void liked.refetch(); void playlists.refetch() }} />

  const submit = (event: FormEvent) => { event.preventDefault(); create.mutate() }
  return <div><div className="page-heading"><div><span className="eyebrow">Your library</span><h1>Saved music</h1><p>Keep liked songs and your own playlists together.</p></div></div><nav className="library-tabs" aria-label="Library sections"><button className={tab === 'liked' ? 'active' : ''} onClick={() => setTab('liked')}><Heart />Liked songs</button><button className={tab === 'playlists' ? 'active' : ''} onClick={() => setTab('playlists')}><ListMusic />Playlists</button></nav>{tab === 'liked' ? (liked.data?.length ? <div className="track-list">{liked.data.map((track, index) => <TrackRow key={track.id} track={track} queue={liked.data!} index={index} />)}</div> : <EmptyState title="Your liked songs are quiet" text="Like a song and it will appear here." />) : <div className="playlist-layout"><form className="dashboard-panel form-stack" onSubmit={submit}><h2>New playlist</h2><label>Playlist name<input value={name} maxLength={100} onChange={(event) => setName(event.target.value)} placeholder="Late night favourites" /></label><label className="check-label"><input type="checkbox" checked={isPublic} onChange={(event) => setPublic(event.target.checked)} />Allow anyone with the link to listen</label>{create.error && <p className="form-message error" role="alert">{create.error.message}</p>}{create.isSuccess && <p className="form-message success" role="status">Playlist created.</p>}<button className="button primary" disabled={create.isPending}><Plus />Create playlist</button></form><section><div className="section-heading"><h2>Your playlists</h2></div>{playlists.data?.length ? <div className="playlist-grid">{playlists.data.map((playlist) => <Link className="playlist-card" to={`/playlists/${playlist.id}`} key={playlist.id}><ListMusic /><div><strong>{playlist.name}</strong><span>{playlist.track_count} songs · {playlist.is_public ? 'Public' : 'Private'}</span></div></Link>)}</div> : <EmptyState title="No playlists yet" text="Create one, then add songs from any song menu." />}</section></div>}</div>
}
