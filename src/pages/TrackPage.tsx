import { useQuery } from '@tanstack/react-query'
import { Download, Heart, Play, Share2 } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Cover, ErrorState, LoadingState } from '../components/States'
import { usePlayer } from '../contexts/PlayerContext'
import { getDownloadUrl, getTrack } from '../lib/catalog'
import { formatCount, formatDuration } from '../lib/format'
import { useTrackLike } from '../hooks/social'

export function TrackPage() {
  const { slug = '' } = useParams()
  const track = useQuery({ queryKey: ['track', slug], queryFn: () => getTrack(slug) })
  const player = usePlayer()
  const like = useTrackLike(track.data?.id ?? '')
  if (track.isLoading) return <LoadingState label="Loading song..." />
  if (track.error || !track.data) return <ErrorState error={track.error ?? new Error('Song not found.')} />
  const item = track.data
  const share = async () => { if (navigator.share) await navigator.share({ title: `${item.title} on SHY`, url: window.location.href }); else await navigator.clipboard.writeText(window.location.href) }
  const download = async () => { const url = await getDownloadUrl(item.id); const link = document.createElement('a'); link.href = url; link.download = `${item.artist?.display_name ?? 'SHY'} - ${item.title}.mp3`; link.click() }
  return <section className="track-page"><Cover src={item.cover_url} alt={item.title} className="track-cover-large" /><div><span className="eyebrow">Song</span><h1>{item.title}</h1>{item.artist && <Link to={`/artists/${item.artist.slug}`} className="artist-link">{item.artist.display_name}</Link>}<p>{formatDuration(item.duration_seconds)} · {formatCount(item.plays_count)} streams {item.genre && `· ${item.genre}`} {item.mood && `· ${item.mood}`}</p><div className="hero-actions"><button className="button primary" onClick={() => player.play(item, [item])}><Play fill="currentColor" />Play</button><button className="button secondary" onClick={like.toggle} disabled={like.busy} aria-pressed={like.liked}><Heart fill={like.liked ? 'currentColor' : 'none'} />{like.liked ? 'Liked' : 'Like'}</button><button className="button secondary" onClick={share}><Share2 />Share</button>{item.downloadable && <button className="button secondary" onClick={download}><Download />Free download</button>}</div></div></section>
}
