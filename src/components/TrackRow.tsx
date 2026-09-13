import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Heart, ListPlus, MoreHorizontal, Pause, Play, Share2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Track } from '../types'
import { formatCount, formatDuration } from '../lib/format'
import { startTrackDownload } from '../lib/download'
import { requireSupabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { usePlayer } from '../contexts/PlayerContext'
import { useTrackLike } from '../hooks/social'
import { Cover } from './States'

export function TrackRow({ track, queue, index, compact = false }: { track: Track; queue: Track[]; index?: number; compact?: boolean }) {
  const player = usePlayer()
  const auth = useAuth()
  const queryClient = useQueryClient()
  const like = useTrackLike(track.id)
  const active = player.current?.id === track.id
  const [downloading, setDownloading] = useState(false)
  const [message, setMessage] = useState('')
  const [moreOpen, setMoreOpen] = useState(false)
  const [choosingPlaylist, setChoosingPlaylist] = useState(false)
  const playlists = useQuery({
    queryKey: ['playlists', auth.user?.id],
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('playlists').select('id,name').eq('user_id', auth.user!.id).order('updated_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: Boolean(auth.user && moreOpen && choosingPlaylist),
  })
  const addToPlaylist = useMutation({ mutationFn: async (playlistId: string) => {
    const db = requireSupabase()
    const { data: last, error: positionError } = await db.from('playlist_tracks').select('position').eq('playlist_id', playlistId).order('position', { ascending: false }).limit(1)
    if (positionError) throw positionError
    const { error } = await db.from('playlist_tracks').insert({ playlist_id: playlistId, track_id: track.id, position: (last?.[0]?.position ?? -1) + 1 })
    if (error?.code === '23505') throw new Error('This song is already in that playlist.')
    if (error) throw error
  }, onSuccess: async () => {
    setMessage('Added to playlist.')
    setMoreOpen(false)
    setChoosingPlaylist(false)
    await queryClient.invalidateQueries({ queryKey: ['playlist'] })
  } })

  const toggle = async () => {
    try {
      if (active) await player.toggle()
      else await player.play(track, queue)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Playback failed.')
    }
  }

  const share = async () => {
    const url = `${window.location.origin}${import.meta.env.BASE_URL}tracks/${track.slug}`
    try {
      if (navigator.share) await navigator.share({ title: `${track.title} on SHY`, text: `Listen to ${track.title} by ${track.artist?.display_name ?? 'SHY'}`, url })
      else {
        await navigator.clipboard.writeText(url)
        setMessage('Song link copied.')
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setMessage('Could not share this song.')
    }
  }

  const download = async () => {
    setDownloading(true)
    setMessage('')
    try {
      await startTrackDownload(track)
      setMessage('Download started.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Download failed.')
    } finally {
      setDownloading(false)
    }
  }

  return <article className={`track-row ${active ? 'active' : ''} ${compact ? 'compact' : ''}`} data-testid={`track-${track.id}`}>
    {index !== undefined && <span className="track-index">{index + 1}</span>}
    <button className="track-play" onClick={toggle} aria-label={`${active && player.isPlaying ? 'Pause' : 'Play'} ${track.title}`}>
      <Cover src={track.cover_url} alt={track.title} />
      <span className="play-overlay">{active && player.isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</span>
    </button>
    <div className="track-copy">
      <Link to={`/tracks/${track.slug}`} className="track-title">{track.title}</Link>
      <span>{track.artist?.display_name ?? 'SHY Artist'} · {formatCount(track.plays_count)} streams</span>
      {message && <small role="status">{message}</small>}
    </div>
    <span className="track-duration">{formatDuration(track.duration_seconds)}</span>
    <div className="row-actions">
      <button className={`icon-button ${like.liked ? 'selected' : ''}`} onClick={like.toggle} disabled={like.busy} aria-pressed={like.liked} aria-label={`${like.liked ? 'Unlike' : 'Like'} ${track.title}`}><Heart fill={like.liked ? 'currentColor' : 'none'} /></button>
      <button className="icon-button" onClick={share} aria-label={`Share ${track.title}`}><Share2 /></button>
      {track.downloadable && <button className="icon-button" onClick={download} disabled={downloading} aria-label={`Download ${track.title}`}><Download /></button>}
      <div className="more-menu"><button className="icon-button" onClick={() => { setMoreOpen((value) => !value); setChoosingPlaylist(false) }} aria-label={`More options for ${track.title}`} aria-expanded={moreOpen}><MoreHorizontal /></button>{moreOpen && <div className="context-menu">{choosingPlaylist ? <><button className="context-back" onClick={() => setChoosingPlaylist(false)}>Back</button>{playlists.isLoading && <span className="context-status">Loading playlists...</span>}{playlists.error && <span className="context-status">Could not load playlists.</span>}{playlists.data?.map((playlist) => <button key={playlist.id} onClick={() => addToPlaylist.mutate(playlist.id)} disabled={addToPlaylist.isPending}>{playlist.name}</button>)}{playlists.data?.length === 0 && <Link to="/library" onClick={() => setMoreOpen(false)}>Create a playlist</Link>}</> : <><button onClick={() => { player.addToQueue(track); setMessage('Added to queue.'); setMoreOpen(false) }}>Add to queue</button>{auth.user ? <button onClick={() => setChoosingPlaylist(true)}><ListPlus />Add to playlist</button> : <Link to="/auth" onClick={() => setMoreOpen(false)}>Sign in to add to playlist</Link>}{track.artist && <Link to={`/artists/${track.artist.slug}`} onClick={() => setMoreOpen(false)}>Go to artist</Link>}<button onClick={() => { void share(); setMoreOpen(false) }}>Share</button></>}{addToPlaylist.error && <span className="context-status error">{addToPlaylist.error.message}</span>}</div>}</div>
    </div>
  </article>
}
