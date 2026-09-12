/* oxlint-disable react/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Track } from '../types'
import { getTrackStreamUrl, recordQualifiedPlay } from '../lib/catalog'

interface PlayerContextValue {
  current: Track | null
  queue: Track[]
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  shuffle: boolean
  repeat: boolean
  expanded: boolean
  error: string | null
  play: (track: Track, queue?: Track[]) => Promise<void>
  toggle: () => Promise<void>
  next: () => Promise<void>
  previous: () => Promise<void>
  seek: (seconds: number) => void
  setVolume: (value: number) => void
  setShuffle: (value: boolean) => void
  setRepeat: (value: boolean) => void
  setExpanded: (value: boolean) => void
}

const PlayerContext = createContext<PlayerContextValue | null>(null)

function sessionId() {
  const key = 'shy-play-session'
  const existing = sessionStorage.getItem(key)
  if (existing) return existing
  const created = crypto.randomUUID()
  sessionStorage.setItem(key, created)
  return created
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const countedTrackRef = useRef<string | null>(null)
  const trackRef = useRef<Track | null>(null)
  const queueRef = useRef<Track[]>([])
  const [current, setCurrent] = useState<Track | null>(null)
  const [queue, setQueueState] = useState<Track[]>([])
  const [isPlaying, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volumeState, setVolumeState] = useState(0.85)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const element = new Audio()
    element.preload = 'auto'
    element.volume = 0.85
    audioRef.current = element
    return () => {
      element.pause()
      element.removeAttribute('src')
      audioRef.current = null
    }
  }, [])

  const setQueue = useCallback((items: Track[]) => {
    queueRef.current = items
    setQueueState(items)
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
    }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => { void next() }
    const onError = () => setError('Playback was interrupted. Select the song to retry.')
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
    }
  }, [next])

  const toggle = useCallback(async () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) await audio.play()
    else audio.pause()
  }, [])

  const seek = useCallback((seconds: number) => {
    if (audioRef.current) audioRef.current.currentTime = seconds
  }, [])

  const setVolume = useCallback((value: number) => {
    const bounded = Math.max(0, Math.min(1, value))
    if (audioRef.current) audioRef.current.volume = bounded
    setVolumeState(bounded)
  }, [])

  const value = useMemo<PlayerContextValue>(() => ({
    current, queue, isPlaying, currentTime, duration, volume: volumeState, shuffle, repeat, expanded, error,
    play, toggle, next, previous, seek, setVolume, setShuffle, setRepeat, setExpanded,
  }), [current, currentTime, duration, error, expanded, isPlaying, next, play, previous, queue, repeat, seek, setVolume, shuffle, toggle, volumeState])

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
}

export function usePlayer() {
  const value = useContext(PlayerContext)
  if (!value) throw new Error('usePlayer must be used inside PlayerProvider')
  return value
}
