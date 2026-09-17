import { expect, it, vi } from 'vitest'
import { listRankedTracks } from './catalog'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), rows: vi.fn() }))
vi.mock('./supabase', () => ({ publicStorageUrl: () => null, requireSupabase: () => ({ rpc: mocks.rpc, from: () => ({ select: () => ({ in: mocks.rows }) }) }) }))
it('uses weekly play counts for ordering without replacing lifetime totals', async () => {
  mocks.rpc.mockResolvedValue({ data: [{ track_id: 'song', play_count: 2, unique_listeners: 1 }], error: null })
  mocks.rows.mockResolvedValue({ data: [{ id: 'song', title: 'Song', plays_count: 20400, genre: 'Pop', mood: null }], error: null })
  const tracks = await listRankedTracks('plays')
  expect(tracks[0].plays_count).toBe(20400)
})
