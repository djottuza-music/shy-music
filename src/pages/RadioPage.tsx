import { useQuery } from '@tanstack/react-query'
import { Radio, Shuffle, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { TrackRow } from '../components/TrackRow'
import { usePlayer } from '../contexts/PlayerContext'
import { listPublishedTracks } from '../lib/catalog'
import { shuffled, tracksForStation, type RadioFilter } from '../lib/radio'

export function RadioPage() {
  const player = usePlayer()
  const query = useQuery({ queryKey: ['tracks', 'radio'], queryFn: () => listPublishedTracks(200) })
  const [station, setStation] = useState<RadioFilter>({ kind: 'all' })
  const moods = useMemo(() => [...new Set((query.data ?? []).map((track) => track.mood).filter(Boolean) as string[])].sort(), [query.data])
  const genres = useMemo(() => [...new Set((query.data ?? []).map((track) => track.genre).filter(Boolean) as string[])].sort(), [query.data])
  const stationTracks = useMemo(() => shuffled(tracksForStation(query.data ?? [], station)), [query.data, station])

  const start = async (nextStation: RadioFilter) => {
    const queue = shuffled(tracksForStation(query.data ?? [], nextStation))
    setStation(nextStation)
    player.setShuffle(true)
    if (queue[0]) await player.play(queue[0], queue)
  }

  if (query.isLoading) return <LoadingState label="Tuning SHY Radio..." />
  if (query.error) return <ErrorState error={query.error} retry={() => query.refetch()} />
  if (!query.data?.length) return <EmptyState title="Radio is waiting for music" text="Stations will appear when published songs have genres and moods." />

  return <div><div className="page-heading"><div><span className="eyebrow"><Radio />Mood Radio</span><h1>Start with a feeling</h1><p>Choose a mood or genre for an endless shuffled queue from SHY artists.</p></div><button className="button primary" onClick={() => void start({ kind: 'all' })}><Shuffle />Surprise me</button></div>{moods.length > 0 && <section className="station-section"><div className="section-heading"><h2>Moods</h2></div><div className="station-grid">{moods.map((mood) => <button key={mood} className={station.kind === 'mood' && station.value === mood ? 'active' : ''} onClick={() => void start({ kind: 'mood', value: mood })}><Sparkles /><span>{mood}</span></button>)}</div></section>}{genres.length > 0 && <section className="station-section"><div className="section-heading"><h2>Genres</h2></div><div className="station-grid">{genres.map((genre) => <button key={genre} className={station.kind === 'genre' && station.value === genre ? 'active' : ''} onClick={() => void start({ kind: 'genre', value: genre })}><Radio /><span>{genre}</span></button>)}</div></section>}<section className="station-results"><div className="section-heading"><h2>{station.kind === 'all' ? 'All-station queue' : `${station.value} queue`}</h2><span>{stationTracks.length} songs</span></div><div className="track-list">{stationTracks.slice(0, 30).map((track, index) => <TrackRow key={track.id} track={track} queue={stationTracks} index={index} />)}</div></section></div>
}
