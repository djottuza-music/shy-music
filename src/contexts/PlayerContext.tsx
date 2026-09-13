import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Track } from '../types'
import { getTrackStreamUrl, recordQualifiedPlay } from '../lib/catalog'
import { PlayerContext, type PlayerContextValue } from './playerContextValue'
const PLAYER_KEY = 'shy-player-state-v1'

interface PlayerSnapshot {
  current: Track | null
  queue: Track[]
  currentTime: number
  volume: number
  shuffle: boolean
  repeat: boolean
}

function readPlayerSnapshot(): PlayerSnapshot {
  const fallback = { current: null, queue: [], currentTime: 0, volume: 0.85, shuffle: false, repeat: false }
  try {
    const value = JSON.parse(localStorage.getItem(PLAYER_KEY) ?? 'null') as Partial<PlayerSnapshot> | null
    return value ? { ...fallback, ...value, current: value.current ? { ...value.current, stream_url: undefined } : null } : fallback
  } catch { return fallback }
}

function sessionId() {
  const key = 'shy-play-session'
  const existing = sessionStorage.getItem(key)
  if (existing) return existing
  const created = crypto.randomUUID()
  sessionStorage.setItem(key, created)
  return created
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [initialSnapshot] = useState(readPlayerSnapshot)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const preloadRef = useRef<HTMLAudioElement | null>(null)
  const countedTrackRef = useRef<string | null>(null)
  const preloadedTrackRef = useRef<string | null>(null)
  const playbackRetryRef = useRef<string | null>(null)
  const trackRef = useRef<Track | null>(initialSnapshot.current)
  const queueRef = useRef<Track[]>(initialSnapshot.queue)
  const lastVolumeRef = useRef(initialSnapshot.volume || 0.85)
  const [current, setCurrent] = useState<Track | null>(initialSnapshot.current)
  const [queue, setQueueState] = useState<Track[]>(initialSnapshot.queue)
  const [isPlaying, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(initialSnapshot.currentTime)
  const [duration, setDuration] = useState(0)
  const [volumeState, setVolumeState] = useState(initialSnapshot.volume)
  const [shuffle, setShuffle] = useState(initialSnapshot.shuffle)
  const [repeat, setRepeat] = useState(initialSnapshot.repeat)
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setQueue = useCallback((items: Track[]) => {
    queueRef.current = items
    setQueueState(items)
  }, [])

  const addToQueue = useCallback((track: Track) => {
    setQueueState((items) => {
      if (items.some((item) => item.id === track.id)) return items
      const nextItems = [...items, track]
      queueRef.current = nextItems
      return nextItems
    })
  }, [])

  const moveQueueItem = useCallback((fromIndex: number, toIndex: number) => {
    setQueueState((items) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) return items
      const nextItems = [...items]
      const [moved] = nextItems.splice(fromIndex, 1)
      nextItems.splice(toIndex, 0, moved)
      queueRef.current = nextItems
      return nextItems
    })
  }, [])

  const play = useCallback(async (track: Track, nextQueue?: Track[]) => {
    const audio = audioRef.current
    if (!audio) return
    setError(null)
    if (nextQueue?.length) setQueue(nextQueue)
    if (trackRef.current?.id === track.id && audio.src) {
      await audio.play()
      return
    }
    const url = track.stream_url || await getTrackStreamUrl(track.id)
    trackRef.current = { ...track, stream_url: url }
    countedTrackRef.current = null
    setCurrent(trackRef.current)
    setCurrentTime(0)
    playbackRetryRef.current = null
    preloadedTrackRef.current = null
    audio.src = url
    audio.load()
    await audio.play()
  }, [setQueue])

  const next = useCallback(async () => {
    const active = trackRef.current
    const items = queueRef.current
    if (!active || items.length === 0) return
    const currentIndex = items.findIndex((item) => item.id === active.id)
    const nextIndex = shuffle
      ? Math.floor(Math.random() * items.length)
      : currentIndex + 1 < items.length ? currentIndex + 1 : repeat ? 0 : -1
    if (nextIndex >= 0) await play(items[nextIndex])
  }, [play, repeat, shuffle])

  const previous = useCallback(async () => {
    const audio = audioRef.current
    const active = trackRef.current
    const items = queueRef.current
    if (!audio || !active) return
    if (audio.currentTime > 4) {
      audio.currentTime = 0
      return
    }
    const currentIndex = items.findIndex((item) => item.id === active.id)
    if (currentIndex > 0) await play(items[currentIndex - 1])
  }, [play])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = volumeState
    const onTime = () => {
      setCurrentTime(audio.currentTime)
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
      const active = trackRef.current
      const threshold = Math.min(30, Math.max(10, audio.duration * 0.3))
      if (active && audio.currentTime >= threshold && countedTrackRef.current !== active.id) {
        countedTrackRef.current = active.id
        recordQualifiedPlay(active.id, sessionId())
          .then((count) => setCurrent((value) => value?.id === active.id ? { ...value, plays_count: count } : value))
          .catch(() => { countedTrackRef.current = null })
      }
      if (active && audio.duration > 0 && audio.currentTime / audio.duration >= 0.7 && preloadedTrackRef.current !== active.id) {
        preloadedTrackRef.current = active.id
        const items = queueRef.current
        const index = items.findIndex((item) => item.id === active.id)
        const upcoming = items[index + 1]
        if (upcoming && preloadRef.current) void getTrackStreamUrl(upcoming.id).then((url) => {
          if (preloadRef.current) preloadRef.current.src = url
        }).catch(() => undefined)
      }
    }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => { void next() }
    const onError = () => {
      const active = trackRef.current
      if (!active || playbackRetryRef.current === active.id) {
        setError('Playback was interrupted. Select the song to retry.')
        return
      }
      playbackRetryRef.current = active.id
      const resumeAt = audio.currentTime
      void getTrackStreamUrl(active.id).then((url) => {
        audio.src = url
        audio.currentTime = resumeAt
        return audio.play()
      }).catch(() => setError('Playback was interrupted. Select the song to retry.'))
    }
    const onPlaying = () => setError(null)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)
    audio.addEventListener('playing', onPlaying)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
      audio.removeEventListener('playing', onPlaying)
    }
  }, [next, volumeState])

  useEffect(() => {
    const storedCurrent = current ? { ...current, stream_url: undefined } : null
    localStorage.setItem(PLAYER_KEY, JSON.stringify({ current: storedCurrent, queue, currentTime, volume: volumeState, shuffle, repeat }))
  }, [current, currentTime, queue, repeat, shuffle, volumeState])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    if (!current) {
      navigator.mediaSession.metadata = null
      return
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artist?.display_name,
      album: current.album?.title,
      artwork: current.cover_url ? [{ src: current.cover_url, sizes: '512x512' }] : [],
    })
    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ['play', () => { void audioRef.current?.play() }],
      ['pause', () => audioRef.current?.pause()],
      ['previoustrack', () => { void previous() }],
      ['nexttrack', () => { void next() }],
    ]
    handlers.forEach(([action, handler]) => {
      try { navigator.mediaSession.setActionHandler(action, handler) } catch { /* unsupported media action */ }
    })
    return () => handlers.forEach(([action]) => {
      try { navigator.mediaSession.setActionHandler(action, null) } catch { /* unsupported media action */ }
    })
  }, [current, next, previous])

  const toggle = useCallback(async () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      if (!audio.src && trackRef.current) {
        const url = await getTrackStreamUrl(trackRef.current.id)
        audio.src = url
        audio.load()
        const savedTime = initialSnapshot.currentTime
        if (savedTime > 0) audio.currentTime = savedTime
      }
      await audio.play()
    }
    else audio.pause()
  }, [initialSnapshot.currentTime])

  const seek = useCallback((seconds: number) => {
    if (audioRef.current) audioRef.current.currentTime = seconds
  }, [])

  const setVolume = useCallback((value: number) => {
    const bounded = Math.max(0, Math.min(1, value))
    if (audioRef.current) audioRef.current.volume = bounded
    if (bounded > 0) lastVolumeRef.current = bounded
    setVolumeState(bounded)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return
      if (event.code === 'Space') { event.preventDefault(); void toggle() }
      if (event.code === 'ArrowRight') { event.preventDefault(); seek(Math.min(duration || Infinity, currentTime + 10)) }
      if (event.code === 'ArrowLeft') { event.preventDefault(); seek(Math.max(0, currentTime - 10)) }
      if (event.key.toLowerCase() === 'm') setVolume(volumeState > 0 ? 0 : lastVolumeRef.current)
      if (event.key.toLowerCase() === 'n') void next()
      if (event.key.toLowerCase() === 'p') void previous()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [currentTime, duration, next, previous, seek, setVolume, toggle, volumeState])

  const value = useMemo<PlayerContextValue>(() => ({
    current, queue, isPlaying, currentTime, duration, volume: volumeState, shuffle, repeat, expanded, error,
    play, toggle, next, previous, seek, setVolume, setShuffle, setRepeat, setExpanded, addToQueue, moveQueueItem,
  }), [addToQueue, current, currentTime, duration, error, expanded, isPlaying, moveQueueItem, next, play, previous, queue, repeat, seek, setVolume, shuffle, toggle, volumeState])

  return <PlayerContext.Provider value={value}>
    {children}
    <audio ref={audioRef} preload="auto" playsInline hidden />
    <audio ref={preloadRef} preload="auto" playsInline hidden />
  </PlayerContext.Provider>
}
