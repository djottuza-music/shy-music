import { useQuery } from '@tanstack/react-query'
import { Disc3, Headphones, Music2, Pause, Play, Share2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MotivateButton } from '../components/MotivateButton'
import { Shelf } from '../components/Shelf'
import { Cover, EmptyState, ErrorState, LoadingState } from '../components/States'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { usePlayer } from '../contexts/usePlayer'
import { getAlbum, getFanOfTheWeek, listArtists, listFreshTracks, listUpcomingReleases, listPublishedAlbums, listPublishedTracks, listRankedAlbums, listRankedTracks, listRisingArtists, type RisingArtist } from '../lib/catalog'
import { formatCount } from '../lib/format'
import { isSupabaseConfigured } from '../lib/supabase'
import type { Album, Track } from '../types'
import { useTrackStreamCount } from '../hooks/useTrackStreamCount'

export function HomePage() {
  const trending = useQuery({ queryKey: ['home-ranking', 'plays', 7], queryFn: async () => { const items = await listRankedTracks('plays', 7, 20); return items.length ? items : listPublishedTracks(20) }, enabled: isSupabaseConfigured })
  const fansLove = useQuery({ queryKey: ['home-ranking', 'listeners', 7], queryFn: async () => { const items = await listRankedTracks('listeners', 7, 20); return items.length ? items : listPublishedTracks(20) }, enabled: isSupabaseConfigured })
  const fan = useQuery({ queryKey: ['fan-of-the-week'], queryFn: getFanOfTheWeek, enabled: isSupabaseConfigured })
  const weeklyAlbums = useQuery({ queryKey: ['album-ranking', 7], queryFn: async () => { const items = await listRankedAlbums(7, 4); return items.length ? items : listPublishedAlbums(4) }, enabled: isSupabaseConfigured })
  const monthlyAlbums = useQuery({ queryKey: ['album-ranking', 30], queryFn: async () => { const items = await listRankedAlbums(30, 4); return items.length ? items : listPublishedAlbums(4) }, enabled: isSupabaseConfigured })
  const risingArtists = useQuery({ queryKey: ['rising-artists', 30], queryFn: () => listRisingArtists(30, 10), enabled: isSupabaseConfigured })
  const artists = useQuery({ queryKey: ['artists'], queryFn: listArtists, enabled: isSupabaseConfigured })
  const fresh = useQuery({ queryKey: ['fresh-drops'], queryFn: async () => (await listFreshTracks(30)).filter((track) => new Date(track.release_at ?? track.created_at).getTime() >= Date.now() - 7 * 86400000), enabled: isSupabaseConfigured })
  const upcoming = useQuery({ queryKey: ['upcoming-releases'], queryFn: listUpcomingReleases, enabled: isSupabaseConfigured })

  if (!isSupabaseConfigured) return <SetupPanel />
  if (trending.error) return <ErrorState error={trending.error} retry={() => trending.refetch()} />
  const songs = trending.data ?? []
  return <div className="home-page">
    {trending.isLoading ? <LoadingState label="Loading Track of the Week" /> : songs[0] ? <TrackOfWeek track={songs[0]} queue={songs} /> : <EmptyState title="The stage is ready" text="Published music will appear here as soon as the first artist goes live." />}
    <section className="fresh-drops"><div className="section-heading"><h2>Fresh Drops</h2><Link to="/discover">See all</Link></div>{fresh.isLoading ? <LoadingState /> : fresh.error ? <ErrorState error={fresh.error} retry={() => void fresh.refetch()} /> : fresh.data?.length ? <div className="shelf">{fresh.data.map((track) => <HomeTrackCard key={track.id} track={track} queue={fresh.data} />)}</div> : <EmptyState title="No new releases yet" text="Check back next week or be the first to upload." />}</section>
    <Shelf title="Trending Now" action={<Link to="/charts">See all</Link>}>{trending.isLoading ? <ShelfSkeleton /> : songs.map((track) => <HomeTrackCard key={track.id} track={track} queue={songs} />)}</Shelf>
    <Shelf title="Rising Artists" action={<Link to="/artists">See all</Link>}>{risingArtists.isLoading ? <ShelfSkeleton /> : (risingArtists.data?.length ? risingArtists.data : (artists.data ?? []).map((artist) => ({ ...artist, listener_count: 0, recent_play_count: 0 }))).map((artist) => <RisingArtistCard key={artist.id} artist={artist} />)}</Shelf>
    <Shelf title="Fans Love" action={<Link to="/charts">See all</Link>}>{fansLove.isLoading ? <ShelfSkeleton /> : (fansLove.data ?? []).map((track) => <HomeTrackCard key={track.id} track={track} queue={fansLove.data ?? []} />)}</Shelf>
    {fan.isLoading ? <LoadingState label="Loading Fan of the Week" /> : <FanBanner fan={fan.data ?? null} />}
    <FeatureAlbums title="Album of the Week" albums={weeklyAlbums.data ?? []} loading={weeklyAlbums.isLoading} />
    <FeatureAlbums title="Album of the Month" albums={monthlyAlbums.data ?? []} loading={monthlyAlbums.isLoading} />
    <section className="watch-out-home"><h2>Watch Out</h2>{upcoming.isPending ? <LoadingState /> : upcoming.error ? <ErrorState error={new Error('Upcoming releases are temporarily unavailable.')} retry={() => void upcoming.refetch()} /> : upcoming.data?.length ? upcoming.data.map((release) => <article key={release.id}><h3>{release.title}</h3><p>{release.artist_name}</p><time dateTime={release.release_at}>{new Date(release.release_at).toLocaleString()}</time></article>) : <EmptyState title="No upcoming releases yet" text="Scheduled songs and albums appear here before release day." />}</section>
  </div>
}

function TrackOfWeek({ track, queue }: { track: Track; queue: Track[] }) {
  const player = usePlayer()
  const active = player.current?.id === track.id
  const streamCount = useTrackStreamCount(track.id, track.plays_count)
  const toggle = () => active ? player.toggle() : player.play(track, queue)
  return <section className="week-hero">
    <div className="week-copy"><span className="week-brand"><img src={import.meta.env.BASE_URL + 'assets/brand/shy-logo-192.png'} alt="SHY Music logo" /><b>SHY<small>MUSIC</small></b></span><span className="eyebrow">Track of the week</span><h1 title={track.title}>{track.title}</h1><p>by {track.artist ? <Link to={'/artists/' + track.artist.slug}>{track.artist.display_name}{track.artist.verified && <VerifiedBadge />}</Link> : 'SHY Artist'}{track.ai_tool ? ' · Made with ' + track.ai_tool : ''}{track.genres?.[0] ? ' · ' + track.genres[0] : ''}</p><button className="button primary week-play" onClick={() => void toggle()}>{active && player.isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}{active && player.isPlaying ? 'Pause' : 'Play now'}</button></div>
    <button className={'week-art ' + (active && player.isPlaying ? 'playing' : '')} onClick={() => void toggle()} aria-label={(active && player.isPlaying ? 'Pause ' : 'Play ') + track.title}><Cover src={track.cover_url} alt={track.title + ' by ' + (track.artist?.display_name ?? 'SHY Artist') + ' cover art'} /></button>
    <div className="week-streams"><strong>{formatCount(streamCount)}</strong><span>total streams</span></div>
  </section>
}

export function HomeTrackCard({ track, queue }: { track: Track; queue: Track[] }) {
  const player = usePlayer()
  const active = player.current?.id === track.id
  const streamCount = useTrackStreamCount(track.id, track.plays_count)
  const toggle = () => active ? player.toggle() : player.play(track, queue)
  const share = async () => {
    const url = window.location.origin + import.meta.env.BASE_URL + 'tracks/' + track.slug
    if (navigator.share) await navigator.share({ title: track.title + ' on SHY', url }).catch(() => undefined)
    else await navigator.clipboard.writeText(url)
  }
  return <article className="home-track-card"><div className={'home-track-art ' + (active && player.isPlaying ? 'playing' : '')}><span className="song-card-glow" aria-hidden="true" /><Cover src={track.cover_url} alt={track.title + ' by ' + (track.artist?.display_name ?? 'SHY Artist') + ' cover art'} /><span className="track-hover-shade" /><button className="play-song-pill" onClick={() => void toggle()} aria-label={(active && player.isPlaying ? 'Pause ' : 'Play ') + track.title}>{active && player.isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}<span>{active && player.isPlaying ? 'Pause' : 'Play song'}</span></button><button className="track-share" onClick={() => void share()} aria-label={'Share ' + track.title}><Share2 /></button></div><Link className="card-title" title={track.title} to={'/tracks/' + track.slug}>{track.title}</Link>{track.artist && <Link className="card-artist" title={track.artist.display_name} to={'/artists/' + track.artist.slug}>{track.artist.display_name}{track.artist.verified && <VerifiedBadge />}</Link>}<small className="stream-count"><Headphones />{formatCount(streamCount)} streams</small>{track.artist?.motivation_phone && <MotivateButton artistId={track.artist_id} artistName={track.artist.display_name} phone={track.artist.motivation_phone} />}</article>
}

export function FanBanner({ fan }: { fan: Awaited<ReturnType<typeof getFanOfTheWeek>> }) {
  const player = usePlayer()
  if (!fan) return <section className="fan-banner fan-empty"><div><span className="eyebrow">Fan of the week</span><h2><Headphones />Keep listening to claim this spot!</h2><p>Every qualified play brings a listener closer to the weekly spotlight.</p></div></section>
  return <section className="fan-banner"><div><span className="eyebrow">Fan of the week</span><div className="fan-person"><Cover src={fan.profile?.avatar_url} alt={(fan.profile?.display_name ?? 'SHY fan') + ' profile photo'} /><span><h2>{fan.profile?.display_name ?? 'SHY fan'}</h2><p>{fan.artist?.display_name ?? 'SHY Artist'}{fan.artist?.verified && <VerifiedBadge />} · {formatCount(fan.total_plays)} fan plays</p></span></div></div>{fan.track && <button className="fan-play" onClick={() => void player.play(fan.track!)} aria-label={'Play ' + fan.track.title}><Play fill="currentColor" /></button>}</section>
}

function RisingArtistCard({ artist }: { artist: RisingArtist }) {
  return <Link className="rising-artist-card" to={`/artists/${artist.slug}`}><span className="rising-artist-art"><span className="song-card-glow" aria-hidden="true" /><Cover src={artist.avatar_url} alt={`${artist.display_name} profile photo`} /></span><strong title={artist.display_name}>{artist.display_name}{artist.verified && <VerifiedBadge />}</strong><small>{formatCount(artist.listener_count)} listeners</small></Link>
}

function FeatureAlbums({ title, albums, loading }: { title: string; albums: Album[]; loading: boolean }) {
  return <section className="feature-albums"><div className="section-heading"><h2>{title}</h2></div>{loading ? <div className="feature-album-grid"><i className="skeleton-block album-skeleton" /><i className="skeleton-block album-skeleton" /></div> : albums.length ? <div className="feature-album-grid">{albums.map((album) => <FeatureAlbumCard key={album.id} album={album} />)}</div> : <EmptyState title={'No ' + title.toLowerCase() + ' yet'} text="Listening activity will choose this feature automatically." />}</section>
}

function FeatureAlbumCard({ album }: { album: Album }) {
  const player = usePlayer()
  const [busy, setBusy] = useState(false)
  const play = async () => {
    if (busy) return
    setBusy(true)
    try {
      const result = await getAlbum(album.slug)
      if (result.tracks[0]) await player.play(result.tracks[0], result.tracks)
    } finally { setBusy(false) }
  }
  return <article className="feature-album-card"><div className="feature-album-art"><Link to={'/albums/' + album.slug}><Cover src={album.cover_url} alt={album.title + ' by ' + (album.artist?.display_name ?? 'SHY Artist') + ' cover art'} /></Link><button className="play-song-pill" onClick={() => void play()} disabled={busy} aria-label={'Play ' + album.title}><Play fill="currentColor" />{busy ? 'Loading' : 'Play album'}</button></div><Link className="card-title" title={album.title} to={'/albums/' + album.slug}>{album.title}</Link>{album.artist && <Link className="card-artist" to={'/artists/' + album.artist.slug}>{album.artist.display_name}{album.artist.verified && <VerifiedBadge />}</Link>}<small className="album-stats"><span><Disc3 />{album.track_count ?? 0}</span><span><Headphones />{formatCount(album.stream_count ?? 0)}</span></small></article>
}

export function ShelfSkeleton() { return <>{Array.from({ length: 5 }, (_, index) => <i key={index} className="skeleton-block track-card-skeleton" />)}</> }

function SetupPanel() {
  return <section className="setup-panel"><span className="eyebrow"><Music2 />SHY backend</span><h1>Connect the music catalog</h1><p>Add the Supabase project URL and publishable key to load real artists and releases.</p><code>VITE_SUPABASE_URL</code><code>VITE_SUPABASE_PUBLISHABLE_KEY</code></section>
}
