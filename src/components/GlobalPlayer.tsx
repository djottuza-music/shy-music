import { ChevronDown, Heart, ListMusic, Maximize2, Pause, Play, Repeat2, Shuffle, SkipBack, SkipForward, Volume2 } from 'lucide-react'
import { usePlayer } from '../contexts/PlayerContext'
import { formatDuration } from '../lib/format'
import { Cover } from './States'

export function GlobalPlayer() {
  const player = usePlayer()
  if (!player.current) return null
  const progressMax = Math.max(player.duration, 1)
  return <>
    <aside className="global-player" aria-label="Now playing">
      <button className="now-playing-copy" onClick={() => player.setExpanded(true)} aria-label="Open now playing">
        <Cover src={player.current.cover_url} alt={player.current.title} />
        <span><strong>{player.current.title}</strong><small>{player.current.artist?.display_name}</small></span>
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
      <div className="player-tools"><ListMusic /><Volume2 /><input type="range" min="0" max="1" step="0.05" value={player.volume} onChange={(event) => player.setVolume(Number(event.target.value))} aria-label="Volume" /><button className="icon-button" onClick={() => player.setExpanded(true)} aria-label="Expand player"><Maximize2 /></button></div>
      {player.error && <p className="player-error">{player.error}</p>}
    </aside>
    {player.expanded && <div className="now-playing" role="dialog" aria-modal="true" aria-label="Now playing view">
      <div className="now-playing-top"><button className="icon-button" onClick={() => player.setExpanded(false)} aria-label="Close now playing"><ChevronDown /></button><span>Now playing</span><button className="icon-button" aria-label="Like current song"><Heart /></button></div>
      <Cover src={player.current.cover_url} alt={player.current.title} className="now-cover" />
      <div className="now-copy"><h1>{player.current.title}</h1><p>{player.current.artist?.display_name}</p></div>
      <div className="progress-line large"><span>{formatDuration(player.currentTime)}</span><input type="range" min="0" max={progressMax} value={Math.min(player.currentTime, progressMax)} onChange={(event) => player.seek(Number(event.target.value))} aria-label="Song progress" /><span>{formatDuration(player.duration)}</span></div>
      <div className="player-controls large"><button className={`icon-button ${player.shuffle ? 'selected' : ''}`} onClick={() => player.setShuffle(!player.shuffle)} aria-label="Shuffle"><Shuffle /></button><button className="icon-button" onClick={player.previous} aria-label="Previous"><SkipBack fill="currentColor" /></button><button className="main-play" onClick={player.toggle} aria-label={player.isPlaying ? 'Pause' : 'Play'}>{player.isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</button><button className="icon-button" onClick={player.next} aria-label="Next"><SkipForward fill="currentColor" /></button><button className={`icon-button ${player.repeat ? 'selected' : ''}`} onClick={() => player.setRepeat(!player.repeat)} aria-label="Repeat"><Repeat2 /></button></div>
    </div>}
  </>
}
