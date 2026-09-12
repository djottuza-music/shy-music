import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { listArtists, listFreshTracks, listPublishedAlbums, listPublishedTracks } from '../lib/catalog'
import { isSupabaseConfigured } from '../lib/supabase'
import { AlbumCard, ArtistCard, TrackCard } from '../components/Cards'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { Shelf } from '../components/Shelf'

export function HomePage() {
  const tracks = useQuery({ queryKey: ['tracks', 'trending'], queryFn: () => listPublishedTracks(30), enabled: isSupabaseConfigured })
  const fresh = useQuery({ queryKey: ['tracks', 'fresh'], queryFn: () => listFreshTracks(20), enabled: isSupabaseConfigured })
  const albums = useQuery({ queryKey: ['albums'], queryFn: () => listPublishedAlbums(20), enabled: isSupabaseConfigured })
  const artists = useQuery({ queryKey: ['artists'], queryFn: listArtists, enabled: isSupabaseConfigured })

  if (!isSupabaseConfigured) return <SetupPanel />
  if (tracks.isLoading || albums.isLoading || artists.isLoading) return <LoadingState />
  if (tracks.error) return <ErrorState error={tracks.error} retry={() => tracks.refetch()} />
  const trending = tracks.data ?? []

  return <div className="home-page">
    <section className="home-intro"><div><span className="eyebrow"><Sparkles />Independent music, closer</span><h1>What should we play?</h1><p>Fresh music from artists who own their sound.</p></div></section>
    <Shelf title="Trending Now" action={<Link to="/discover">See all <ArrowRight /></Link>}>{trending.map((track) => <TrackCard key={track.id} track={track} queue={trending} />)}</Shelf>
    {(fresh.data?.length ?? 0) > 0 && <Shelf title="Fresh Drops">{fresh.data!.map((track) => <TrackCard key={track.id} track={track} queue={fresh.data!} />)}</Shelf>}
    {(albums.data?.length ?? 0) > 0 && <Shelf title="Albums to know">{albums.data!.map((album) => <AlbumCard key={album.id} album={album} />)}</Shelf>}
    {(artists.data?.length ?? 0) > 0 && <Shelf title="Rising Artists">{artists.data!.map((artist) => <ArtistCard key={artist.id} artist={artist} />)}</Shelf>}
    {trending.length === 0 && <EmptyState title="The stage is ready" text="Published music will appear here as soon as the first artist goes live." />}
  </div>
}

function SetupPanel() {
  return <section className="setup-panel"><span className="eyebrow">New SHY backend</span><h1>Connect the music catalog</h1><p>This clean rebuild is ready for its new Supabase project. Once the database URL and publishable key are added, real artists, albums, and tracks will appear here.</p><code>VITE_SUPABASE_URL</code><code>VITE_SUPABASE_PUBLISHABLE_KEY</code></section>
}
