import { Download, Heart, MoreHorizontal, Pause, Play, Share2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Track } from '../types'
import { formatCount, formatDuration } from '../lib/format'
import { getDownloadUrl } from '../lib/catalog'
import { usePlayer } from '../contexts/PlayerContext'
import { Cover } from './States'

export function TrackRow({ track, queue, index, compact = false }: { track: Track; queue: Track[]; index?: number; compact?: boolean }) {
  const player = usePlayer()
  const active = player.current?.id === track.id
  const [downloading, setDownloading] = useState(false)
  const [message, setMessage] = useState('')

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
      const url = await getDownloadUrl(track.id)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${track.artist?.display_name ?? 'SHY'} - ${track.title}.mp3`
      anchor.rel = 'noopener'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
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
      <button className="icon-button" aria-label={`Like ${track.title}`}><Heart /></button>
      <button className="icon-button" onClick={share} aria-label={`Share ${track.title}`}><Share2 /></button>
      {track.downloadable && <button className="icon-button" onClick={download} disabled={downloading} aria-label={`Download ${track.title}`}><Download /></button>}
      <button className="icon-button" aria-label={`More options for ${track.title}`}><MoreHorizontal /></button>
    </div>
  </article>
}
