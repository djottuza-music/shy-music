import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ArtistCard } from '../components/Cards'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { listArtists } from '../lib/catalog'
import { isSupabaseConfigured } from '../lib/supabase'

export function ArtistsPage() {
  const [query, setQuery] = useState('')
  const artists = useQuery({ queryKey: ['artists'], queryFn: listArtists, enabled: isSupabaseConfigured })
  const filtered = useMemo(() => (artists.data ?? []).filter((artist) => `${artist.display_name} ${artist.country ?? ''} ${artist.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())), [artists.data, query])
  if (artists.isLoading) return <LoadingState label="Loading artists..." />
  if (artists.error) return <ErrorState error={artists.error} retry={() => artists.refetch()} />
  return <div><div className="page-heading"><div><span className="eyebrow">Artists</span><h1>Find your next favourite voice</h1></div><label className="search-box page-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search artists" aria-label="Search artists" /></label></div>{filtered.length ? <div className="artist-grid">{filtered.map((artist) => <ArtistCard key={artist.id} artist={artist} />)}</div> : <EmptyState title="No artists found" text="Try a different name, country, or tag." />}</div>
}
