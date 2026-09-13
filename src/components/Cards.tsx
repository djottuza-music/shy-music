import { Pause, Play } from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePlayer } from '../contexts/PlayerContext'
import { formatCount } from '../lib/format'
import type { Album, Artist, Track } from '../types'
import { Cover } from './States'
import { MetadataChips } from './MetadataChips'
import { VerifiedBadge } from './VerifiedBadge'
import { useTrackStreamCount } from '../hooks/useTrackStreamCount'

export function TrackCard({ track, queue }: { track: Track; queue: Track[] }) {
  const player = usePlayer()
  const active = player.current?.id === track.id
  const streamCount = useTrackStreamCount(track.id, track.plays_count)
  const play = async () => {
    if (active) await player.toggle()
    else await player.play(track, queue)
  }
  return <article className="media-card">
    <div className="card-art"><Link to={`/tracks/${track.slug}`}><Cover src={track.cover_url} alt={`${track.title} by ${track.artist?.display_name ?? 'SHY Artist'} cover art`} /></Link><button className="card-play" onClick={play} aria-label={`${active && player.isPlaying ? 'Pause' : 'Play'} ${track.title}`}>{active && player.isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</button></div>
    <Link className="card-title" title={track.title} to={`/tracks/${track.slug}`}>{track.title}</Link>
    {track.artist ? <Link className="card-artist" to={`/artists/${track.artist.slug}`} title={track.artist.display_name}>{track.artist.display_name}{track.artist.verified && <VerifiedBadge />}</Link> : <span>SHY Artist</span>}
    <MetadataChips values={track.genres?.slice(0, 2)} tone="neutral" />
    <small>{formatCount(streamCount)} streams</small>
  </article>
}

export function AlbumCard({ album }: { album: Album }) {
  return <article className="media-card">
    <div className="card-art"><Link to={`/albums/${album.slug}`}><Cover src={album.cover_url} alt={`${album.title} by ${album.artist?.display_name ?? 'SHY Artist'} cover art`} /></Link></div>
    <Link className="card-title" title={album.title} to={`/albums/${album.slug}`}>{album.title}</Link>
    {album.artist ? <Link className="card-artist" to={`/artists/${album.artist.slug}`} title={album.artist.display_name}>{album.artist.display_name}{album.artist.verified && <VerifiedBadge />}</Link> : <span>SHY Artist</span>}
    <MetadataChips values={album.genres?.slice(0, 2)} tone="neutral" />
    <small>{album.track_count ?? 0} tracks</small>
  </article>
}

export function ArtistCard({ artist }: { artist: Artist }) {
  return <Link className="artist-card" to={`/artists/${artist.slug}`}>
    <Cover src={artist.avatar_url} alt={`${artist.display_name} profile photo`} className="artist-avatar" />
    <strong title={artist.display_name}>{artist.display_name}{artist.verified && <VerifiedBadge />}</strong>
    <span>{formatCount(artist.followers_count)} followers</span>
  </Link>
}
