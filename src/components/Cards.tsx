import { BadgeCheck, Pause, Play } from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePlayer } from '../contexts/PlayerContext'
import { formatCount } from '../lib/format'
import type { Album, Artist, Track } from '../types'
import { Cover } from './States'

export function TrackCard({ track, queue }: { track: Track; queue: Track[] }) {
  const player = usePlayer()
  const active = player.current?.id === track.id
  const play = async () => {
    if (active) await player.toggle()
    else await player.play(track, queue)
  }
  return <article className="media-card">
    <div className="card-art"><Link to={`/tracks/${track.slug}`}><Cover src={track.cover_url} alt={track.title} /></Link><button className="card-play" onClick={play} aria-label={`${active && player.isPlaying ? 'Pause' : 'Play'} ${track.title}`}>{active && player.isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</button></div>
    <Link className="card-title" to={`/tracks/${track.slug}`}>{track.title}</Link>
    <span>{track.artist?.display_name ?? 'SHY Artist'}</span>
    <small>{formatCount(track.plays_count)} streams</small>
  </article>
}

export function AlbumCard({ album }: { album: Album }) {
  return <article className="media-card">
    <div className="card-art"><Link to={`/albums/${album.slug}`}><Cover src={album.cover_url} alt={album.title} /></Link></div>
    <Link className="card-title" to={`/albums/${album.slug}`}>{album.title}</Link>
    <span>{album.artist?.display_name ?? 'SHY Artist'}</span>
    <small>{album.track_count ?? 0} tracks</small>
  </article>
}

export function ArtistCard({ artist }: { artist: Artist }) {
  return <Link className="artist-card" to={`/artists/${artist.slug}`}>
    <Cover src={artist.avatar_url} alt={artist.display_name} className="artist-avatar" />
    <strong>{artist.display_name}{artist.verified && <BadgeCheck className="verified" aria-label="Verified artist" />}</strong>
    <span>{formatCount(artist.followers_count)} followers</span>
  </Link>
}
