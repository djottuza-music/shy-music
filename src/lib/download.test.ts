import { describe, expect, it } from 'vitest'
import { trackDownloadName } from './download'
import type { Track } from '../types'

function track(overrides: Partial<Track> = {}): Track {
  return {
    id: 'track-1', artist_id: 'artist-1', album_id: null, title: 'Night: Drive?', slug: 'night-drive',
    audio_path: 'artist-1/night-drive.M4A', cover_path: null, duration_seconds: 180, track_number: 1,
    genre: null, mood: null, lyrics: null, explicit: false, downloadable: true,
    release_status: 'published', release_at: '2026-09-13T00:00:00Z', plays_count: 0,
    created_at: '2026-09-13T00:00:00Z', artist: { display_name: 'DJ / Ottuza', slug: 'dj-ottuza', avatar_url: null, verified: false },
    ...overrides,
  }
}

describe('trackDownloadName', () => {
  it('keeps the actual audio type and removes unsafe filename characters', () => {
    expect(trackDownloadName(track())).toBe('DJ Ottuza - Night Drive.m4a')
  })

  it('uses a stable fallback when metadata is empty', () => {
    expect(trackDownloadName(track({ title: '', artist: undefined, audio_path: 'track' }))).toBe('SHY - SHY Music.mp3')
  })
})
