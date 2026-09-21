import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ListMusic, Play, Share2, Trash2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { TrackRow } from '../components/TrackRow'
import { useAuth } from '../contexts/AuthContext'
import { usePlayer } from '../contexts/usePlayer'
import { publicStorageUrl, requireSupabase } from '../lib/supabase'
import type { Playlist, Track } from '../types'

export function PlaylistPage() {
  const { id = '' } = useParams()
  const auth = useAuth()
  const player = usePlayer()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['playlist', id], queryFn: async () => {
    const db = requireSupabase()
    const [playlistResult, tracksResult] = await Promise.all([
      db.from('playlists').select('*').eq('id', id).single(),
      db.from('playlist_tracks').select('position, track:tracks(*, artist:artists(display_name,slug,avatar_url,verified,country), album:albums(title,slug,cover_path))').eq('playlist_id', id).order('position'),
    ])
    if (playlistResult.error) throw playlistResult.error
    if (tracksResult.error) throw tracksResult.error
    const tracks = (tracksResult.data ?? []).map((row: any) => ({ ...row.track, cover_url: publicStorageUrl('covers', row.track.cover_path ?? row.track.album?.cover_path) })) as Track[]
    return { playlist: playlistResult.data as Playlist, tracks }
  }, enabled: Boolean(id) })
  const remove = useMutation({ mutationFn: async (trackId: string) => {
    const { error } = await requireSupabase().from('playlist_tracks').delete().eq('playlist_id', id).eq('track_id', trackId)
    if (error) throw error
  }, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['playlist', id] }) })
  const deletePlaylist = useMutation({ mutationFn: async () => {
    const { error } = await requireSupabase().from('playlists').delete().eq('id', id)
    if (error) throw error
  }, onSuccess: () => navigate('/library') })

  if (query.isLoading) return <LoadingState label="Loading playlist..." />
  if (query.error) return <ErrorState error={query.error} retry={() => query.refetch()} />
  if (!query.data) return null
  const { playlist, tracks } = query.data
  const owner = auth.user?.id === playlist.user_id
  const share = async () => {
    const url = window.location.href
    if (navigator.share) await navigator.share({ title: `${playlist.name} on SHY`, url })
    else await navigator.clipboard.writeText(url)
  }

  return <div><section className="playlist-hero"><div className="playlist-cover"><ListMusic /></div><div><span className="eyebrow">{playlist.is_public ? 'Public playlist' : 'Private playlist'}</span><h1>{playlist.name}</h1>{playlist.description && <p>{playlist.description}</p>}<p>{tracks.length} songs</p><div className="hero-actions">{tracks[0] && <button className="button primary" onClick={() => void player.play(tracks[0], tracks)}><Play fill="currentColor" />Play</button>}{playlist.is_public && <button className="icon-button playlist-share-button" onClick={() => void share()} aria-label="Share playlist"><Share2 /></button>}{owner && <button className="button secondary" onClick={() => { if (window.confirm(`Delete ${playlist.name}?`)) deletePlaylist.mutate() }} disabled={deletePlaylist.isPending}><Trash2 />Delete</button>}</div></div></section>{tracks.length ? <div className="playlist-track-list">{tracks.map((track, index) => <div className="playlist-track" key={track.id}><TrackRow track={track} queue={tracks} index={index} showShare />{owner && <button className="text-button remove-track" onClick={() => remove.mutate(track.id)} disabled={remove.isPending}>Remove</button>}</div>)}</div> : <EmptyState title="This playlist is empty" text={owner ? 'Open a song menu and choose Add to playlist.' : 'The owner has not added any songs yet.'} />}</div>
}
