import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Download, Heart, ListMusic, Maximize2, Mic2, Pause, Play, Repeat2, Share2, Shuffle, SkipBack, SkipForward, Volume1, Volume2, X } from 'lucide-react'
import { useEffect, useState, type CSSProperties } from 'react'
import { usePlayer } from '../contexts/usePlayer'
import { useToast } from '../contexts/ToastContext'
import { useTrackLike } from '../hooks/social'
import { startTrackDownload } from '../lib/download'
import { formatDuration } from '../lib/format'
import { MotivateButton } from './MotivateButton'
import { Cover } from './States'
import { VerifiedBadge } from './VerifiedBadge'

export function GlobalPlayer() {
  const player = usePlayer()
  const { showToast } = useToast()
  const [queueOpen, setQueueOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [lyricsOpen, setLyricsOpen] = useState(false)
  const { expanded, setExpanded } = player
  useEffect(() => {
    const onPopState = () => { if (expanded) setExpanded(false) }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [expanded, setExpanded])
  if (!player.current) return null
  const progressMax = Math.max(player.duration, 1)
  const progress = Math.min(100, (player.currentTime / progressMax) * 100)
  const progressStyle = { '--player-progress': `${progress}%` } as CSSProperties
  const openPlayer = () => {
    if (!window.history.state?.shyPlayer) window.history.pushState({ ...window.history.state, shyPlayer: true }, '')
    player.setExpanded(true)
  }
  const closePlayer = () => {
    if (window.history.state?.shyPlayer) window.history.back()
    else player.setExpanded(false)
  }
  const share = async () => {
    const url = `${window.location.origin}${import.meta.env.BASE_URL}tracks/${player.current!.slug}`
    try {
      if (navigator.share) await navigator.share({ title: `${player.current!.title} on SHY`, url })
      else { await navigator.clipboard.writeText(url); showToast('Song link copied.', 'success') }
    } catch { /* The native share sheet was dismissed. */ }
  }
  const download = async () => {
    if (downloading) return
    setDownloading(true)
    try { await startTrackDownload(player.current!); showToast('Download started.', 'success') }
    catch (caught) { showToast(caught instanceof Error ? caught.message : 'Download failed. Please try again.', 'error') }
    finally { setDownloading(false) }
  }

  return <>
    <aside className="global-player" aria-label="Now playing" style={progressStyle}>
      <button className="now-playing-copy" onClick={openPlayer} aria-label="Open now playing"><Cover src={player.current.cover_url} alt={`${player.current.title} cover art`} /><span><strong title={player.current.title}>{player.current.title}</strong><small>{player.current.artist?.display_name}{player.current.artist?.verified && <VerifiedBadge />}{player.current.genres?.[0] ? ` · ${player.current.genres[0]}` : ''}</small></span></button>
      <div className="player-center"><div className="player-controls"><button className={`icon-button ${player.shuffle ? 'selected' : ''}`} onClick={() => player.setShuffle(!player.shuffle)} aria-pressed={player.shuffle} aria-label="Shuffle"><Shuffle /></button><button className="icon-button" onClick={player.previous} aria-label="Previous"><SkipBack fill="currentColor" /></button><button className="main-play" onClick={player.toggle} aria-label={player.isPlaying ? 'Pause' : 'Play'}>{player.isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</button><button className="icon-button" onClick={player.next} aria-label="Next"><SkipForward fill="currentColor" /></button><button className={`icon-button ${player.repeat ? 'selected' : ''}`} onClick={() => player.setRepeat(!player.repeat)} aria-pressed={player.repeat} aria-label="Repeat"><Repeat2 /></button></div><div className="progress-line"><span>{formatDuration(player.currentTime)}</span><input type="range" min="0" max={progressMax} value={Math.min(player.currentTime, progressMax)} onChange={(event) => player.seek(Number(event.target.value))} aria-label="Song progress" /><span>{formatDuration(player.duration)}</span></div></div>
      <div className="player-tools"><button className={`icon-button ${queueOpen ? 'selected' : ''}`} onClick={() => setQueueOpen((value) => !value)} aria-label="Open play queue" aria-expanded={queueOpen}><ListMusic /></button><button className="icon-button" onClick={() => player.setVolume(player.volume > 0 ? 0 : 0.85)} aria-label={player.volume > 0 ? 'Mute' : 'Unmute'}><Volume2 /></button><input type="range" min="0" max="1" step="0.05" value={player.volume} onChange={(event) => player.setVolume(Number(event.target.value))} aria-label="Volume" /><button className="icon-button" onClick={openPlayer} aria-label="Expand player"><Maximize2 /></button></div>
      <div className="mobile-player-controls"><button className="icon-button" onClick={player.previous} aria-label="Previous"><SkipBack fill="currentColor" /></button><button className="main-play" onClick={player.toggle} aria-label={player.isPlaying ? 'Pause' : 'Play'}>{player.isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</button><button className="icon-button" onClick={player.next} aria-label="Next"><SkipForward fill="currentColor" /></button><button className={`icon-button ${player.repeat ? 'selected' : ''}`} onClick={() => player.setRepeat(!player.repeat)} aria-pressed={player.repeat} aria-label="Repeat"><Repeat2 /></button></div>
      <button className="mobile-player-current" onClick={openPlayer} aria-label="Open now playing"><Cover src={player.current.cover_url} alt="" /><ChevronUp /></button><span className="mobile-player-progress" aria-hidden="true" />
      {player.error && <p className="player-error">{player.error}</p>}
    </aside>
    {queueOpen && <QueuePanel close={() => setQueueOpen(false)} />}
    {player.expanded && <div className="now-playing" role="dialog" aria-modal="true" aria-label="Now playing view">
      <div className="now-playing-top"><button className="icon-button" onClick={closePlayer} aria-label="Close now playing"><ChevronDown /></button><span>Now playing</span><div className="now-playing-actions"><button className="icon-button" onClick={() => setQueueOpen(true)} aria-label="Open play queue"><ListMusic /></button><CurrentTrackLike trackId={player.current.id} /></div></div>
      <button className="button secondary lyrics-toggle" aria-expanded={lyricsOpen} onClick={() => setLyricsOpen(!lyricsOpen)}><Mic2 />Lyrics</button>
      {lyricsOpen ? <section className="now-lyrics"><h2>{player.current.title}</h2><p>{player.current.lyrics || 'Lyrics have not been added for this song.'}</p></section> : <Cover src={player.current.cover_url} alt={`${player.current.title} cover art`} className="now-cover" />}
      <div className={`player-waveform ${player.isPlaying ? 'is-playing' : ''}`} aria-hidden="true">{Array.from({ length: 48 }, (_, index) => <i key={index} style={{ height: `${18 + 62 * Math.abs(Math.sin(index * .24) * Math.cos(index * .09))}%`, animationDelay: `${index * -.08}s` }} />)}</div>
      <div className="now-copy"><h1 title={player.current.title}>{player.current.title}</h1><p>{player.current.artist?.display_name}{player.current.artist?.verified && <VerifiedBadge />}</p></div>
      <div className="now-social"><CurrentTrackLike trackId={player.current.id} /><button className="icon-button" onClick={() => void share()} aria-label="Share current song"><Share2 /></button></div>
      <div className="progress-line large"><span>{formatDuration(player.currentTime)}</span><input type="range" min="0" max={progressMax} value={Math.min(player.currentTime, progressMax)} onChange={(event) => player.seek(Number(event.target.value))} aria-label="Song progress" /><span>{formatDuration(player.duration)}</span></div>
      <div className="player-controls large"><button className={`icon-button ${player.shuffle ? 'selected' : ''}`} onClick={() => player.setShuffle(!player.shuffle)} aria-pressed={player.shuffle} aria-label="Shuffle"><Shuffle /></button><button className={`icon-button ${player.repeat ? 'selected' : ''}`} onClick={() => player.setRepeat(!player.repeat)} aria-pressed={player.repeat} aria-label="Repeat"><Repeat2 /></button><button className="icon-button" onClick={player.previous} aria-label="Previous"><SkipBack /></button><button className="main-play" onClick={player.toggle} aria-label={player.isPlaying ? 'Pause' : 'Play'}>{player.isPlaying ? <Pause /> : <Play fill="currentColor" />}</button><button className="icon-button" onClick={player.next} aria-label="Next"><SkipForward /></button></div>
      <div className="now-secondary-controls"><button className="icon-button" onClick={() => void download()} disabled={downloading} aria-label="Download song"><Download /></button><button className="icon-button" onClick={() => setQueueOpen(true)} aria-label="Open play queue"><ListMusic /></button></div>
      <div className="now-volume"><Volume1 /><input type="range" min="0" max="1" step="0.05" value={player.volume} onChange={(event) => player.setVolume(Number(event.target.value))} aria-label="Volume" /><Volume2 /></div>
      {player.current.artist?.motivation_phone && <MotivateButton artistId={player.current.artist_id} artistName={player.current.artist.display_name} phone={player.current.artist.motivation_phone} />}
    </div>}
  </>
}

function CurrentTrackLike({ trackId }: { trackId: string }) {
  const like = useTrackLike(trackId)
  return <button className={`icon-button ${like.liked ? 'selected' : ''}`} onClick={like.toggle} disabled={like.busy} aria-label={like.liked ? 'Unlike current song' : 'Like current song'} aria-pressed={like.liked}><Heart fill={like.liked ? 'currentColor' : 'none'} /></button>
}

function QueuePanel({ close }: { close: () => void }) {
  const player = usePlayer()
  return <aside className="queue-panel" aria-label="Play queue"><header><div><span className="eyebrow"><ListMusic />Up next</span><strong>{player.queue.length} songs</strong></div><button className="icon-button" onClick={close} aria-label="Close play queue"><X /></button></header><div className="queue-list">{player.queue.map((track, index) => <article key={track.id} className={player.current?.id === track.id ? 'active' : ''}><button className="queue-track" onClick={() => player.play(track)}><Cover src={track.cover_url} alt={`${track.title} cover art`} /><span><strong title={track.title}>{track.title}</strong><small>{track.artist?.display_name}{track.artist?.verified && <VerifiedBadge />}</small></span></button><div><button className="icon-button" onClick={() => player.moveQueueItem(index, index - 1)} disabled={index === 0} aria-label={`Move ${track.title} up`}><ArrowUp /></button><button className="icon-button" onClick={() => player.moveQueueItem(index, index + 1)} disabled={index === player.queue.length - 1} aria-label={`Move ${track.title} down`}><ArrowDown /></button></div></article>)}</div></aside>
}
