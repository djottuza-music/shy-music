import { createContext } from 'react'
import type { Track } from '../types'

export interface PlayerContextValue {
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
  addToQueue: (track: Track) => void
  moveQueueItem: (fromIndex: number, toIndex: number) => void
}

export const PlayerContext = createContext<PlayerContextValue | null>(null)
