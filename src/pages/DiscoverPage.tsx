import { useQuery } from '@tanstack/react-query'
import { SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlbumCard, ArtistCard, TrackCard } from '../components/Cards'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { listArtists, listPublishedAlbums, listPublishedTracks } from '../lib/catalog'

export function DiscoverPage() {
  const tracks = useQuery({ queryKey: ['tracks', 'discover'], queryFn: () => listPublishedTracks(100) })
  const artists = useQuery({ queryKey: ['artists'], queryFn: listArtists })
  const albums = useQuery({ queryKey: ['albums', 'discover'], queryFn: () => listPublishedAlbums(100) })
  const [params] = useSearchParams()
  const query = params.get('q')?.trim().toLowerCase() ?? ''
  const [genre, setGenre] = useState('All')
  const [mood, setMood] = useState('All')
  const genres = useMemo(() => ['All', ...new Set((tracks.data ?? []).map((track) => track.genre).filter(Boolean) as string[])], [tracks.data])
  const moods = useMemo(() => ['All', ...new Set((tracks.data ?? []).map((track) => track.mood).filter(Boolean) as string[])], [tracks.data])
  const filtered = useMemo(() => (tracks.data ?? []).filter((track) => {
    const matchesFilters = (genre === 'All' || track.genre === genre) && (mood === 'All' || track.mood === mood)
    const searchable = [track.title, track.artist?.display_name, track.album?.title, track.genre, track.mood].filter(Boolean).join(' ').toLowerCase()
    return matchesFilters && (!query || searchable.includes(query))
  }), [genre, mood, query, tracks.data])
  const matchingArtists = query ? (artists.data ?? []).filter((artist) => [artist.display_name, artist.bio, artist.country, ...artist.tags].filter(Boolean).join(' ').toLowerCase().includes(query)) : []
  const matchingAlbums = query ? (albums.data ?? []).filter((album) => [album.title, album.artist?.display_name].filter(Boolean).join(' ').toLowerCase().includes(query)) : []
  if (tracks.isLoading || (query && (artists.isLoading || albums.isLoading))) return <LoadingState label="Finding music..." />
  const loadError = tracks.error || artists.error || albums.error
  if (loadError) return <ErrorState error={loadError} retry={() => { void tracks.refetch(); void artists.refetch(); void albums.refetch() }} />
  const noResults = filtered.length === 0 && matchingArtists.length === 0 && matchingAlbums.length === 0
  return <div><div className="page-heading"><div><span className="eyebrow"><SlidersHorizontal />Discover</span><h1>{query ? `Results for “${params.get('q')}”` : 'Music for right now'}</h1></div><div className="filter-row"><label>Genre<select value={genre} onChange={(event) => setGenre(event.target.value)}>{genres.map((value) => <option key={value}>{value}</option>)}</select></label><label>Mood<select value={mood} onChange={(event) => setMood(event.target.value)}>{moods.map((value) => <option key={value}>{value}</option>)}</select></label></div></div>{matchingArtists.length > 0 && <section className="search-section"><h2>Artists</h2><div className="artist-grid">{matchingArtists.map((artist) => <ArtistCard key={artist.id} artist={artist} />)}</div></section>}{matchingAlbums.length > 0 && <section className="search-section"><h2>Albums</h2><div className="media-grid">{matchingAlbums.map((album) => <AlbumCard key={album.id} album={album} />)}</div></section>}{filtered.length > 0 && <section className="search-section"><h2>{query ? 'Songs' : 'All songs'}</h2><div className="media-grid">{filtered.map((track) => <TrackCard key={track.id} track={track} queue={filtered} />)}</div></section>}{noResults && <EmptyState title="No matching music" text={query ? 'Try another search or clear the filters.' : 'Try another genre or mood.'} />}</div>
}
