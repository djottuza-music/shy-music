import { describe, expect, it } from 'vitest'
import type { Track } from '../types'
import { shuffled, tracksForStation } from './radio'

const track = (id: string, genre: string, mood: string) => ({ id, genre, mood } as Track)

describe('radio stations', () => {
  const tracks = [track('1', 'Afrobeats', 'Happy'), track('2', 'Electronic', 'Dark')]

  it('filters moods without depending on capitalization', () => {
    expect(tracksForStation(tracks, { kind: 'mood', value: 'happy' }).map((item) => item.id)).toEqual(['1'])
  })

  it('does not mutate the catalogue while shuffling', () => {
    const result = shuffled(tracks, () => 0)
    expect(result.map((item) => item.id)).toEqual(['2', '1'])
    expect(tracks.map((item) => item.id)).toEqual(['1', '2'])
  })

  it('matches array metadata', () => {
    const item = { ...track('3', 'Pop', 'Happy'), genres: ['Pop', 'Soul'], moods: ['Happy', 'Uplifting'] }
    expect(tracksForStation([item], { kind: 'genre', value: 'soul' })).toEqual([item])
    expect(tracksForStation([item], { kind: 'mood', value: 'uplifting' })).toEqual([item])
  })
})
