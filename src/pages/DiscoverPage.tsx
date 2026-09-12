import { useQuery } from '@tanstack/react-query'
import { SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { TrackCard } from '../components/Cards'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { listPublishedTracks } from '../lib/catalog'

export function DiscoverPage() {
  const tracks = useQuery({ queryKey: ['tracks', 'discover'], queryFn: () => listPublishedTracks(100) })
  const [genre, setGenre] = useState('All')
  const [mood, setMood] = useState('All')
  const genres = useMemo(() => ['All', ...new Set((tracks.data ?? []).map((track) => track.genre).filter(Boolean) as string[])], [tracks.data])
  const moods = useMemo(() => ['All', ...new Set((tracks.data ?? []).map((track) => track.mood).filter(Boolean) as string[])], [tracks.data])
  const filtered = useMemo(() => (tracks.data ?? []).filter((track) => (genre === 'All' || track.genre === genre) && (mood === 'All' || track.mood === mood)), [genre, mood, tracks.data])
  if (tracks.isLoading) return <LoadingState label="Finding music..." />
  if (tracks.error) return <ErrorState error={tracks.error} retry={() => tracks.refetch()} />
  return <div><div className="page-heading"><div><span className="eyebrow"><SlidersHorizontal />Discover</span><h1>Music for right now</h1></div><div className="filter-row"><label>Genre<select value={genre} onChange={(event) => setGenre(event.target.value)}>{genres.map((value) => <option key={value}>{value}</option>)}</select></label><label>Mood<select value={mood} onChange={(event) => setMood(event.target.value)}>{moods.map((value) => <option key={value}>{value}</option>)}</select></label></div></div>{filtered.length ? <div className="media-grid">{filtered.map((track) => <TrackCard key={track.id} track={track} queue={filtered} />)}</div> : <EmptyState title="No matching songs" text="Try another genre or mood." />}</div>
}
