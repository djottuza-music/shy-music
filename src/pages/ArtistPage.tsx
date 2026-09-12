import { useQuery } from '@tanstack/react-query'
import { BadgeCheck, Heart, Play } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { AlbumCard } from '../components/Cards'
import { Cover, ErrorState, LoadingState } from '../components/States'
import { TrackRow } from '../components/TrackRow'
import { getArtist, listArtistCatalog } from '../lib/catalog'
import { formatCount } from '../lib/format'
import { usePlayer } from '../contexts/PlayerContext'
import { useArtistFollow } from '../hooks/social'
import { MotivateButton } from '../components/MotivateButton'
import { ReportButton } from '../components/ReportButton'

export function ArtistPage() {
  const { slug = '' } = useParams()
  const artist = useQuery({ queryKey: ['artist', slug], queryFn: () => getArtist(slug) })
  const catalog = useQuery({ queryKey: ['artist-catalog', artist.data?.id], queryFn: () => listArtistCatalog(artist.data!.id), enabled: Boolean(artist.data?.id) })
  const player = usePlayer()
  const follow = useArtistFollow(artist.data?.id ?? '')
  if (artist.isLoading) return <LoadingState label="Loading artist..." />
  if (artist.error || !artist.data) return <ErrorState error={artist.error ?? new Error('Artist not found.')} />
  const tracks = catalog.data?.tracks ?? []
  const totalStreams = tracks.reduce((sum, track) => sum + track.plays_count, 0)
  return <div className="artist-page">
    <section className="artist-hero" style={artist.data.banner_url ? { backgroundImage: `linear-gradient(0deg, rgba(2,1,7,.9), rgba(2,1,7,.2)), url(${artist.data.banner_url})` } : undefined}>
      <Cover src={artist.data.avatar_url} alt={artist.data.display_name} className="hero-avatar" />
      <div><span className="eyebrow">Artist</span><h1>{artist.data.display_name}{artist.data.verified && <BadgeCheck className="verified large" />}</h1><p>{artist.data.bio}</p><div className="stat-line"><span>{formatCount(artist.data.followers_count)} followers</span><span>{formatCount(totalStreams)} streams</span><span>{tracks.length} songs</span></div><div className="hero-actions">{tracks[0] && <button className="button primary" onClick={() => player.play(tracks[0], tracks)}><Play fill="currentColor" />Play</button>}<button className="button secondary" onClick={follow.toggle} disabled={follow.busy} aria-pressed={follow.followed}><Heart fill={follow.followed ? 'currentColor' : 'none'} />{follow.followed ? 'Following' : 'Follow'}</button>{artist.data.motivation_phone && <MotivateButton artistName={artist.data.display_name} phone={artist.data.motivation_phone} />}<ReportButton targetType="artist" targetId={artist.data.id} targetName={artist.data.display_name} /></div></div>
    </section>
    {catalog.isLoading ? <LoadingState label="Loading music..." /> : <><section><div className="section-heading"><h2>Popular</h2></div><div className="track-list">{tracks.slice(0, 8).map((track, index) => <TrackRow key={track.id} track={track} queue={tracks} index={index} />)}</div></section>{(catalog.data?.albums.length ?? 0) > 0 && <section><div className="section-heading"><h2>Albums and EPs</h2></div><div className="media-grid">{catalog.data!.albums.map((album) => <AlbumCard key={album.id} album={{ ...album, artist: artist.data }} />)}</div></section>}</>}
  </div>
}
