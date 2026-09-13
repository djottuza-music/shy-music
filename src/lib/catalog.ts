import type { Album, Artist, Track } from '../types'
import { publicStorageUrl, requireSupabase } from './supabase'

function published(query: any) {
  return query.eq('release_status', 'published').lte('release_at', new Date().toISOString())
}

export async function listArtists(): Promise<Artist[]> {
  const { data, error } = await requireSupabase().from('artists').select('*').eq('is_active', true).order('followers_count', { ascending: false })
  if (error) throw error
  return (data ?? []) as Artist[]
}

export async function getArtist(slug: string): Promise<Artist> {
  const { data, error } = await requireSupabase().from('artists').select('*').eq('slug', slug).single()
  if (error) throw error
  return data as Artist
}

export async function listPublishedTracks(limit = 50): Promise<Track[]> {
  const query = requireSupabase()
    .from('tracks')
    .select('*, artist:artists(display_name,slug,avatar_url,verified,country), album:albums(title,slug,cover_path)')
    .order('plays_count', { ascending: false })
    .limit(limit)
  const { data, error } = await published(query)
  if (error) throw error
  return hydrateTracks((data ?? []) as Track[])
}

export async function listFreshTracks(limit = 20): Promise<Track[]> {
  const query = requireSupabase()
    .from('tracks')
    .select('*, artist:artists(display_name,slug,avatar_url,verified,country), album:albums(title,slug,cover_path)')
    .order('release_at', { ascending: false })
    .limit(limit)
  const { data, error } = await published(query)
  if (error) throw error
  return hydrateTracks((data ?? []) as Track[])
}

export async function listPublishedAlbums(limit = 30): Promise<Album[]> {
  const query = requireSupabase()
    .from('albums')
    .select('*, artist:artists(display_name,slug,avatar_url,verified), tracks(plays_count)')
    .order('release_at', { ascending: false })
    .limit(limit)
  const { data, error } = await published(query)
  if (error) throw error
  return (data ?? []).map((row: any) => ({
    ...row,
    cover_url: publicStorageUrl('covers', row.cover_path),
    track_count: row.tracks?.length ?? 0,
    stream_count: (row.tracks ?? []).reduce((sum: number, track: { plays_count?: number }) => sum + Number(track.plays_count ?? 0), 0),
  })) as Album[]
}

export async function getAlbum(slug: string): Promise<{ album: Album; tracks: Track[] }> {
  const db = requireSupabase()
  const { data: album, error } = await db
    .from('albums')
    .select('*, artist:artists(display_name,slug,avatar_url,verified)')
    .eq('slug', slug)
    .single()
  if (error) throw error
  const { data: tracks, error: tracksError } = await db
    .from('tracks')
    .select('*, artist:artists(display_name,slug,avatar_url,verified), album:albums(title,slug,cover_path)')
    .eq('album_id', album.id)
    .eq('release_status', 'published')
    .lte('release_at', new Date().toISOString())
    .order('track_number')
  if (tracksError) throw tracksError
  return {
    album: { ...album, cover_url: publicStorageUrl('covers', album.cover_path) } as Album,
    tracks: hydrateTracks((tracks ?? []) as Track[]),
  }
}

export async function getTrack(slug: string): Promise<Track> {
  const { data, error } = await requireSupabase()
    .from('tracks')
    .select('*, artist:artists(display_name,slug,avatar_url,verified), album:albums(title,slug,cover_path)')
    .eq('slug', slug)
    .single()
  if (error) throw error
  return hydrateTracks([data as Track])[0]
}

export async function listArtistCatalog(artistId: string, includePrivate = false): Promise<{ albums: Album[]; tracks: Track[] }> {
  const db = requireSupabase()
  let albumQuery = db.from('albums').select('*, tracks(count)').eq('artist_id', artistId).order('created_at', { ascending: false })
  let trackQuery = db.from('tracks').select('*, artist:artists(display_name,slug,avatar_url,verified), album:albums(title,slug,cover_path)').eq('artist_id', artistId).order('created_at', { ascending: false })
  if (!includePrivate) {
    albumQuery = albumQuery.eq('release_status', 'published').lte('release_at', new Date().toISOString())
    trackQuery = trackQuery.eq('release_status', 'published').lte('release_at', new Date().toISOString())
  }
  const [albumsResult, tracksResult] = await Promise.all([albumQuery, trackQuery])
  if (albumsResult.error) throw albumsResult.error
  if (tracksResult.error) throw tracksResult.error
  return {
    albums: (albumsResult.data ?? []).map((row: any) => ({ ...row, cover_url: publicStorageUrl('covers', row.cover_path), track_count: row.tracks?.[0]?.count ?? 0 })) as Album[],
    tracks: hydrateTracks((tracksResult.data ?? []) as Track[]),
  }
}

export async function getTrackStreamUrl(trackId: string): Promise<string> {
  const db = requireSupabase()
  const { data, error } = await db.rpc('get_track_media_path', { p_track_id: trackId, p_download: false })
  if (error) throw error
  if (!data) throw new Error('This track is not available for playback.')
  const signed = await db.storage.from('audio').createSignedUrl(String(data), 6 * 60 * 60)
  if (signed.error) throw signed.error
  return signed.data.signedUrl
}

export async function recordQualifiedPlay(trackId: string, sessionId: string): Promise<number> {
  const { data, error } = await requireSupabase().rpc('record_track_play', { p_track_id: trackId, p_session_id: sessionId })
  if (error) throw error
  return Number(data ?? 0)
}

export async function getDownloadUrl(trackId: string, fileName?: string): Promise<string> {
  const db = requireSupabase()
  const { data, error } = await db.rpc('get_track_media_path', { p_track_id: trackId, p_download: true })
  if (error) throw error
  if (!data) throw new Error('This download is unavailable.')
  const signed = await db.storage.from('audio').createSignedUrl(String(data), 10 * 60, { download: fileName || true })
  if (signed.error) throw signed.error
  return signed.data.signedUrl
}

function hydrateTracks(rows: Track[]): Track[] {
  return rows.map((row) => ({
    ...row,
    cover_url: publicStorageUrl('covers', row.cover_path ?? row.album?.cover_path),
  }))
}
