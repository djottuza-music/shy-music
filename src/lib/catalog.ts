import type { Album, Artist, Track } from '../types'
import { publicStorageUrl, requireSupabase } from './supabase'
import { normalizedMetadata } from './taxonomy'

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

export async function listRankedTracks(metric: 'plays' | 'listeners', days = 7, limit = 20): Promise<Track[]> {
  const db = requireSupabase()
  const { data: ranking, error: rankingError } = await db.rpc('get_track_rankings', { p_days: days, p_limit: limit, p_metric: metric })
  if (rankingError) throw rankingError
  const rows = (ranking ?? []) as Array<{ track_id: string; play_count: number; unique_listeners: number }>
  if (!rows.length) return []
  const { data, error } = await db.from('tracks')
    .select('*, artist:artists(display_name,slug,avatar_url,verified,country,motivation_phone,motivation_count), album:albums(title,slug,cover_path)')
    .in('id', rows.map((row) => row.track_id))
  if (error) throw error
  const byId = new Map(hydrateTracks((data ?? []) as Track[]).map((track) => [track.id, track]))
  return rows.map((row) => {
    const track = byId.get(row.track_id)
    return track ? { ...track, plays_count: Number(row.play_count) } : null
  }).filter((track): track is Track => Boolean(track))
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
    genres: normalizedMetadata(row.genres),
    moods: normalizedMetadata(row.moods),
    track_count: row.tracks?.length ?? 0,
    stream_count: (row.tracks ?? []).reduce((sum: number, track: { plays_count?: number }) => sum + Number(track.plays_count ?? 0), 0),
  })) as Album[]
}

export async function listRankedAlbums(days: number, limit = 4): Promise<Album[]> {
  const db = requireSupabase()
  const { data: ranking, error: rankingError } = await db.rpc('get_album_rankings', { p_days: days, p_limit: limit })
  if (rankingError) throw rankingError
  const rows = (ranking ?? []) as Array<{ album_id: string; play_count: number }>
  if (!rows.length) return []
  const { data, error } = await db.from('albums')
    .select('*, artist:artists(display_name,slug,avatar_url,verified), tracks(id)')
    .in('id', rows.map((row) => row.album_id))
  if (error) throw error
  const byId = new Map((data ?? []).map((row: any) => [row.id, {
    ...row,
    cover_url: publicStorageUrl('covers', row.cover_path),
    genres: normalizedMetadata(row.genres),
    moods: normalizedMetadata(row.moods),
    track_count: row.tracks?.length ?? 0,
  } as Album]))
  return rows.reduce<Album[]>((items, row) => {
    const album = byId.get(row.album_id)
    if (album) items.push({ ...album, stream_count: Number(row.play_count) })
    return items
  }, [])
}

export interface FanOfWeek {
  user_id: string
  total_plays: number
  profile: { display_name: string; avatar_url: string | null } | null
  artist: Pick<Artist, 'display_name' | 'slug' | 'verified'> | null
  track: Track | null
}

export interface TopListener {
  profile_id: string
  display_name: string
  avatar_url: string | null
  play_count: number
}

export interface RisingArtist extends Artist {
  listener_count: number
  recent_play_count: number
}

export async function listTopListeners(days = 7, limit = 10): Promise<TopListener[]> {
  const { data, error } = await requireSupabase().rpc('get_top_listeners', { p_days: days, p_limit: limit })
  if (error && ['42883', 'PGRST202'].includes(error.code ?? '')) return []
  if (error) throw error
  return (data ?? []).map((row: Record<string, unknown>) => ({
    profile_id: String(row.profile_id),
    display_name: String(row.display_name),
    avatar_url: row.avatar_url ? String(row.avatar_url) : null,
    play_count: Number(row.play_count ?? 0),
  }))
}

export async function listRisingArtists(days = 30, limit = 10): Promise<RisingArtist[]> {
  const db = requireSupabase()
  const { data: ranking, error: rankingError } = await db.rpc('get_rising_artists', { p_days: days, p_limit: limit })
  if (rankingError && ['42883', 'PGRST202'].includes(rankingError.code ?? '')) return []
  if (rankingError) throw rankingError
  const rows = (ranking ?? []) as Array<{ artist_id: string; listener_count: number; play_count: number }>
  if (!rows.length) return []
  const { data, error } = await db.from('artists').select('*').in('id', rows.map((row) => row.artist_id)).eq('is_active', true)
  if (error) throw error
  const byId = new Map(((data ?? []) as Artist[]).map((artist) => [artist.id, artist]))
  return rows.flatMap((row) => {
    const artist = byId.get(row.artist_id)
    return artist ? [{ ...artist, listener_count: Number(row.listener_count), recent_play_count: Number(row.play_count) }] : []
  })
}

export async function listRecommendedTracks(limit = 20): Promise<Track[]> {
  const db = requireSupabase()
  const { data: ranking, error: rankingError } = await db.rpc('get_recommended_track_ids', { p_limit: limit })
  if (rankingError && ['42883', 'PGRST202'].includes(rankingError.code ?? '')) return listPublishedTracks(limit)
  if (rankingError) throw rankingError
  const ids = (ranking ?? []).map((row: { track_id: string }) => row.track_id)
  if (!ids.length) return []
  const { data, error } = await db.from('tracks')
    .select('*, artist:artists(display_name,slug,avatar_url,verified,country,motivation_phone,motivation_count), album:albums(title,slug,cover_path)')
    .in('id', ids)
  if (error) throw error
  const byId = new Map(hydrateTracks((data ?? []) as Track[]).map((track) => [track.id, track]))
  return ids.flatMap((id: string) => {
    const track = byId.get(id)
    return track ? [track] : []
  })
}

export async function getFanOfTheWeek(): Promise<FanOfWeek | null> {
  const { data, error } = await requireSupabase().from('fan_of_the_week')
    .select('user_id,total_plays,profile:profiles(display_name,avatar_url),artist:artists(display_name,slug,verified),track:tracks(*,artist:artists(display_name,slug,avatar_url,verified,motivation_phone,motivation_count),album:albums(title,slug,cover_path))')
    .order('week_start', { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  if (!data) return null
  const row = data as unknown as Omit<FanOfWeek, 'track'> & { track: Track | null }
  return { ...row, total_plays: Number(row.total_plays), track: row.track ? hydrateTracks([row.track])[0] : null }
}

export async function getAlbum(slug: string): Promise<{ album: Album; tracks: Track[] }> {
  const db = requireSupabase()
  const { data: album, error } = await db
    .from('albums')
    .select('*, artist:artists(display_name,slug,avatar_url,verified,motivation_phone,motivation_count)')
    .eq('slug', slug)
    .single()
  if (error) throw error
  const { data: tracks, error: tracksError } = await db
    .from('tracks')
    .select('*, artist:artists(display_name,slug,avatar_url,verified,motivation_phone,motivation_count), album:albums(title,slug,cover_path)')
    .eq('album_id', album.id)
    .eq('release_status', 'published')
    .lte('release_at', new Date().toISOString())
    .order('track_number')
  if (tracksError) throw tracksError
  return {
    album: { ...album, cover_url: publicStorageUrl('covers', album.cover_path), genres: normalizedMetadata(album.genres), moods: normalizedMetadata(album.moods) } as Album,
    tracks: hydrateTracks((tracks ?? []) as Track[]),
  }
}

export async function getTrack(slug: string): Promise<Track> {
  const { data, error } = await requireSupabase()
    .from('tracks')
    .select('*, artist:artists(display_name,slug,avatar_url,verified,motivation_phone,motivation_count), album:albums(title,slug,cover_path)')
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
    albums: (albumsResult.data ?? []).map((row: any) => ({ ...row, cover_url: publicStorageUrl('covers', row.cover_path), genres: normalizedMetadata(row.genres), moods: normalizedMetadata(row.moods), track_count: row.tracks?.[0]?.count ?? 0 })) as Album[],
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
    genres: normalizedMetadata(row.genres, row.genre),
    moods: normalizedMetadata(row.moods, row.mood),
    cover_url: publicStorageUrl('covers', row.cover_path ?? row.album?.cover_path),
  }))
}
