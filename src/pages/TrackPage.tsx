import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Download, Gauge, Heart, Pause, Play, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AddToPlaylistButton } from '../components/AddToPlaylistButton'
import { TrackCard } from '../components/Cards'
import { Comments } from '../components/Comments'
import { MetadataChips } from '../components/MetadataChips'
import { ReportButton } from '../components/ReportButton'
import { Cover, ErrorState, LoadingState } from '../components/States'
import { usePlayer } from '../contexts/usePlayer'
import { useTrackLike } from '../hooks/social'
import { getTrack, listArtistCatalog } from '../lib/catalog'
import { startTrackDownload } from '../lib/download'
import { formatCount, formatDuration } from '../lib/format'

export function TrackPage() {
  const { slug = '' } = useParams()
  const track = useQuery({ queryKey: ['track', slug], queryFn: () => getTrack(slug) })
  const more = useQuery({ queryKey: ['more-from-artist', track.data?.artist_id], queryFn: () => listArtistCatalog(track.data!.artist_id), enabled: Boolean(track.data?.artist_id) })
  const player = usePlayer()
  const like = useTrackLike(track.data?.id ?? '')
  const [message, setMessage] = useState('')
  const [downloading, setDownloading] = useState(false)
  if (track.isLoading) return <LoadingState label="Loading song..." />
  if (track.error || !track.data) return <ErrorState error={track.error ?? new Error('Song not found.')} retry={() => void track.refetch()} />
  const item = track.data
  const active = player.current?.id === item.id
  const download = async () => {
    setDownloading(true); setMessage('')
    try { await startTrackDownload(item); setMessage('Download started.') } catch (caught) { setMessage(caught instanceof Error ? caught.message : 'Download failed.') } finally { setDownloading(false) }
  }
  const play = () => active ? void player.toggle() : void player.play(item, [item])
  const otherTracks = more.data?.tracks.filter((candidate) => candidate.id !== item.id).slice(0, 4) ?? []

  return <div className="release-detail-page">
    <section className="track-detail-hero"><Cover src={item.cover_url} alt={item.title} className="track-cover-large" /><div className="release-copy"><span className="eyebrow">Song</span><h1>{item.title}{item.explicit && <span className="explicit-badge">E</span>}</h1>{item.artist && <Link to={`/artists/${item.artist.slug}`} className="artist-link">{item.artist.display_name}</Link>}{item.featured_artists?.length ? <p>Featuring {item.featured_artists.join(', ')}</p> : null}<MetadataChips values={item.genres} /><MetadataChips values={item.moods} tone="neutral" /><div className="release-meta">{item.ai_tool && <span><Sparkles />{item.ai_tool}</span>}{item.bpm && <span><Gauge />{item.bpm} BPM{item.key_signature ? ` · ${item.key_signature}` : ''}</span>}{item.release_at && <span><CalendarDays />{new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(item.release_at))}</span>}</div><div className="stat-line"><span>{formatCount(item.plays_count)} streams</span><span>{formatCount(item.downloads_count ?? 0)} downloads</span><span>{formatCount(item.artist?.motivation_count ?? 0)} motivations</span><span>{formatDuration(item.duration_seconds)}</span></div><div className="hero-actions"><button className="button primary large-action" onClick={play}>{active && player.isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}{active && player.isPlaying ? 'Pause' : 'Play'}</button><button className="button secondary" onClick={like.toggle} disabled={like.busy} aria-pressed={like.liked}><Heart fill={like.liked ? 'currentColor' : 'none'} />{like.liked ? 'Liked' : 'Like'}</button>{item.downloadable && <button className="button secondary" onClick={() => void download()} disabled={downloading}><Download />{downloading ? 'Preparing...' : 'Free download'}</button>}<AddToPlaylistButton trackId={item.id} /><ReportButton targetType="track" targetId={item.id} targetName={item.title} /></div>{message && <p className="form-message" role="status">{message}</p>}</div></section>
    {(item.description || item.lyrics) && <section className="release-section"><h2>About this song</h2><details className="expandable-copy" open={(item.description ?? item.lyrics ?? '').length < 320}><summary>Read song notes</summary><p>{item.description ?? item.lyrics}</p></details>{item.custom_tags?.length ? <div className="tag-list">{item.custom_tags.map((tag) => <span key={tag}>#{tag}</span>)}</div> : null}</section>}
    <Comments trackId={item.id} />
    {otherTracks.length > 0 && <section className="release-section"><div className="section-heading"><h2>More from {item.artist?.display_name}</h2><Link to={`/artists/${item.artist?.slug}`}>View artist</Link></div><div className="media-grid">{otherTracks.map((candidate) => <TrackCard key={candidate.id} track={candidate} queue={otherTracks} />)}</div></section>}
  </div>
}
