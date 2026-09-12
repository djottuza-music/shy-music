import { useQuery } from '@tanstack/react-query'
import { Play, Share2 } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { Cover, ErrorState, LoadingState } from '../components/States'
import { TrackRow } from '../components/TrackRow'
import { usePlayer } from '../contexts/PlayerContext'
import { getAlbum } from '../lib/catalog'
import { formatCount } from '../lib/format'

export function AlbumPage() {
  const { slug = '' } = useParams()
  const result = useQuery({ queryKey: ['album', slug], queryFn: () => getAlbum(slug) })
  const player = usePlayer()
  if (result.isLoading) return <LoadingState label="Loading album..." />
  if (result.error || !result.data) return <ErrorState error={result.error ?? new Error('Album not found.')} />
  const { album, tracks } = result.data
  const share = async () => {
    const url = window.location.href
    if (navigator.share) await navigator.share({ title: `${album.title} on SHY`, url })
    else await navigator.clipboard.writeText(url)
  }
  return <div><section className="album-hero"><Cover src={album.cover_url} alt={album.title} className="album-cover-large" /><div><span className="eyebrow">{album.release_type}</span><h1>{album.title}</h1><p>{album.artist?.display_name}</p><p>{tracks.length} tracks · {formatCount(tracks.reduce((sum, track) => sum + track.plays_count, 0))} streams</p><div className="hero-actions">{tracks[0] && <button className="button primary" onClick={() => player.play(tracks[0], tracks)}><Play fill="currentColor" />Play album</button>}<button className="button secondary" onClick={share}><Share2 />Share</button></div></div></section><div className="track-list">{tracks.map((track, index) => <TrackRow key={track.id} track={track} queue={tracks} index={index} />)}</div></div>
}
