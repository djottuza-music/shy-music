import { Download, Heart, MoreHorizontal, Pause, Play, Share2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Track } from '../types'
import { formatCount, formatDuration } from '../lib/format'
import { startTrackDownload } from '../lib/download'
import { usePlayer } from '../contexts/PlayerContext'
import { useTrackLike } from '../hooks/social'
import { Cover } from './States'

export function TrackRow({ track, queue, index, compact = false }: { track: Track; queue: Track[]; index?: number; compact?: boolean }) {
  const player = usePlayer()
  const like = useTrackLike(track.id)
  const active = player.current?.id === track.id
  const [downloading, setDownloading] = useState(false)
  const [message, setMessage] = useState('')
  const [moreOpen, setMoreOpen] = useState(false)

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
      <div className="more-menu"><button className="icon-button" onClick={() => setMoreOpen((value) => !value)} aria-label={`More options for ${track.title}`} aria-expanded={moreOpen}><MoreHorizontal /></button>{moreOpen && <div className="context-menu"><button onClick={() => { player.addToQueue(track); setMessage('Added to queue.'); setMoreOpen(false) }}>Add to queue</button>{track.artist && <Link to={`/artists/${track.artist.slug}`} onClick={() => setMoreOpen(false)}>Go to artist</Link>}<button onClick={() => { void share(); setMoreOpen(false) }}>Share</button></div>}</div>
    </div>
  </article>
}
