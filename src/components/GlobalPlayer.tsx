import { ArrowDown, ArrowUp, ChevronDown, Heart, ListMusic, Maximize2, Pause, Play, Repeat2, Shuffle, SkipBack, SkipForward, Volume2, X } from 'lucide-react'
import { useState } from 'react'
import { usePlayer } from '../contexts/PlayerContext'
import { useTrackLike } from '../hooks/social'
import { formatDuration } from '../lib/format'
import { Cover } from './States'
import { VerifiedBadge } from './VerifiedBadge'

export function GlobalPlayer() {
  const player = usePlayer()
  const [queueOpen, setQueueOpen] = useState(false)
  if (!player.current) return null
  const progressMax = Math.max(player.duration, 1)
  return <>
    <aside className="global-player" aria-label="Now playing">
      <button className="now-playing-copy" onClick={() => player.setExpanded(true)} aria-label="Open now playing">
        <Cover src={player.current.cover_url} alt={`${player.current.title} cover art`} />
        <span><strong title={player.current.title}>{player.current.title}</strong><small>{player.current.artist?.display_name}{player.current.artist?.verified && <VerifiedBadge />}{player.current.genres?.[0] ? ` · ${player.current.genres[0]}` : ''}</small></span>
      </button>
      <div className="player-center">
        <div className="player-controls">
          <button className={`icon-button ${player.shuffle ? 'selected' : ''}`} onClick={() => player.setShuffle(!player.shuffle)} aria-pressed={player.shuffle} aria-label="Shuffle"><Shuffle /></button>
          <button className="icon-button" onClick={player.previous} aria-label="Previous"><SkipBack fill="currentColor" /></button>
          <button className="main-play" onClick={player.toggle} aria-label={player.isPlaying ? 'Pause' : 'Play'}>{player.isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</button>
          <button className="icon-button" onClick={player.next} aria-label="Next"><SkipForward fill="currentColor" /></button>
          <button className={`icon-button ${player.repeat ? 'selected' : ''}`} onClick={() => player.setRepeat(!player.repeat)} aria-pressed={player.repeat} aria-label="Repeat"><Repeat2 /></button>
        </div>
        <div className="progress-line"><span>{formatDuration(player.currentTime)}</span><input type="range" min="0" max={progressMax} value={Math.min(player.currentTime, progressMax)} onChange={(event) => player.seek(Number(event.target.value))} aria-label="Song progress" /><span>{formatDuration(player.duration)}</span></div>
      </div>
      <div className="player-tools"><button className={`icon-button ${queueOpen ? 'selected' : ''}`} onClick={() => setQueueOpen((value) => !value)} aria-label="Open play queue" aria-expanded={queueOpen}><ListMusic /></button><button className="icon-button" onClick={() => player.setVolume(player.volume > 0 ? 0 : 0.85)} aria-label={player.volume > 0 ? 'Mute' : 'Unmute'}><Volume2 /></button><input type="range" min="0" max="1" step="0.05" value={player.volume} onChange={(event) => player.setVolume(Number(event.target.value))} aria-label="Volume" /><button className="icon-button" onClick={() => player.setExpanded(true)} aria-label="Expand player"><Maximize2 /></button></div>
      {player.error && <p className="player-error">{player.error}</p>}
    </aside>
    {queueOpen && <QueuePanel close={() => setQueueOpen(false)} />}
    {player.expanded && <div className="now-playing" role="dialog" aria-modal="true" aria-label="Now playing view">
      <div className="now-playing-top"><button className="icon-button" onClick={() => player.setExpanded(false)} aria-label="Close now playing"><ChevronDown /></button><span>Now playing</span><div className="now-playing-actions"><button className="icon-button" onClick={() => setQueueOpen(true)} aria-label="Open play queue"><ListMusic /></button><CurrentTrackLike trackId={player.current.id} /></div></div>
      <Cover src={player.current.cover_url} alt={player.current.title} className="now-cover" />
      <div className="now-copy"><h1 title={player.current.title}>{player.current.title}</h1><p>{player.current.artist?.display_name}{player.current.artist?.verified && <VerifiedBadge />}{player.current.genres?.length ? ` · ${player.current.genres.join(' · ')}` : ''}{player.current.moods?.length ? ` · ${player.current.moods.join(' · ')}` : ''}</p></div>
      <div className="progress-line large"><span>{formatDuration(player.currentTime)}</span><input type="range" min="0" max={progressMax} value={Math.min(player.currentTime, progressMax)} onChange={(event) => player.seek(Number(event.target.value))} aria-label="Song progress" /><span>{formatDuration(player.duration)}</span></div>
      <div className="player-controls large"><button className={`icon-button ${player.shuffle ? 'selected' : ''}`} onClick={() => player.setShuffle(!player.shuffle)} aria-label="Shuffle"><Shuffle /></button><button className="icon-button" onClick={player.previous} aria-label="Previous"><SkipBack fill="currentColor" /></button><button className="main-play" onClick={player.toggle} aria-label={player.isPlaying ? 'Pause' : 'Play'}>{player.isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</button><button className="icon-button" onClick={player.next} aria-label="Next"><SkipForward fill="currentColor" /></button><button className={`icon-button ${player.repeat ? 'selected' : ''}`} onClick={() => player.setRepeat(!player.repeat)} aria-label="Repeat"><Repeat2 /></button></div>
    </div>}
  </>
}

function CurrentTrackLike({ trackId }: { trackId: string }) {
  const like = useTrackLike(trackId)
  return <button className={`icon-button ${like.liked ? 'selected' : ''}`} onClick={like.toggle} disabled={like.busy} aria-label={like.liked ? 'Unlike current song' : 'Like current song'} aria-pressed={like.liked}><Heart fill={like.liked ? 'currentColor' : 'none'} /></button>
}

function QueuePanel({ close }: { close: () => void }) {
  const player = usePlayer()
  return <aside className="queue-panel" aria-label="Play queue">
    <header><div><span className="eyebrow"><ListMusic />Up next</span><strong>{player.queue.length} songs</strong></div><button className="icon-button" onClick={close} aria-label="Close play queue"><X /></button></header>
    <div className="queue-list">{player.queue.map((track, index) => <article key={track.id} className={player.current?.id === track.id ? 'active' : ''}>
      <button className="queue-track" onClick={() => player.play(track)}><Cover src={track.cover_url} alt={`${track.title} cover art`} /><span><strong title={track.title}>{track.title}</strong><small>{track.artist?.display_name}{track.artist?.verified && <VerifiedBadge />}</small></span></button>
      <div><button className="icon-button" onClick={() => player.moveQueueItem(index, index - 1)} disabled={index === 0} aria-label={`Move ${track.title} up`}><ArrowUp /></button><button className="icon-button" onClick={() => player.moveQueueItem(index, index + 1)} disabled={index === player.queue.length - 1} aria-label={`Move ${track.title} down`}><ArrowDown /></button></div>
    </article>)}</div>
  </aside>
}
