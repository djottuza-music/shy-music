import { useQuery } from '@tanstack/react-query'
import { Headphones } from 'lucide-react'
import { HomeTrackCard, FanBanner, ShelfSkeleton } from './HomePage'
import { Shelf } from '../components/Shelf'
import { Cover, EmptyState, ErrorState, LoadingState } from '../components/States'
import { getFanOfTheWeek, listPublishedTracks, listRankedTracks, listRecommendedTracks, listTopListeners } from '../lib/catalog'
import { formatCount } from '../lib/format'
import { isSupabaseConfigured } from '../lib/supabase'

export function FansPage() {
  const mostPlayed = useQuery({ queryKey: ['fans-most-played', 7], queryFn: async () => { const rows = await listRankedTracks('plays', 7, 20); return rows.length ? rows : listPublishedTracks(20) }, enabled: isSupabaseConfigured })
  const fan = useQuery({ queryKey: ['fan-of-the-week'], queryFn: getFanOfTheWeek, enabled: isSupabaseConfigured })
  const listeners = useQuery({ queryKey: ['top-listeners', 7], queryFn: () => listTopListeners(7, 10), enabled: isSupabaseConfigured })
  const recommendations = useQuery({ queryKey: ['recommendations'], queryFn: async () => { const rows = await listRecommendedTracks(20); return rows.length ? rows : listPublishedTracks(20) }, enabled: isSupabaseConfigured })

  if (mostPlayed.error) return <ErrorState error={mostPlayed.error} retry={() => void mostPlayed.refetch()} />
  const tracks = mostPlayed.data ?? []
  const suggested = recommendations.data ?? []
  return <div className="fans-page">
    <header className="page-heading"><div><span className="eyebrow"><Headphones />SHY listeners</span><h1>Fans</h1><p>The music and listeners shaping SHY this week.</p></div></header>
    <Shelf title="Most Played This Week">{mostPlayed.isLoading ? <ShelfSkeleton /> : tracks.length ? tracks.map((track) => <HomeTrackCard key={track.id} track={track} queue={tracks} />) : <EmptyState title="No plays this week" text="Play a song to start this week's ranking." />}</Shelf>
    {fan.isLoading ? <LoadingState label="Loading Fan of the Week..." /> : <FanBanner fan={fan.data ?? null} />}
    <section className="top-listeners-section"><div className="section-heading"><h2>Top Listeners</h2></div>
      {listeners.isLoading ? <LoadingState label="Loading top listeners..." /> : listeners.error ? <ErrorState error={listeners.error} retry={() => void listeners.refetch()} /> : listeners.data?.length ? <ol className="top-listeners-list">{listeners.data.map((listener, index) => <li key={listener.profile_id}><b>{index + 1}</b><Cover src={listener.avatar_url} alt={`${listener.display_name} profile photo`} /><span><strong>{listener.display_name}</strong><small>{formatCount(listener.play_count)} songs played this week</small></span><Headphones aria-label="Top listener" /></li>)}</ol> : <EmptyState title="The weekly ranking is open" text="Signed-in listening activity will appear here." />}
    </section>
    <Shelf title="You Might Like">{recommendations.isLoading ? <ShelfSkeleton /> : suggested.length ? suggested.map((track) => <HomeTrackCard key={track.id} track={track} queue={suggested} />) : <EmptyState title="No recommendations yet" text="Listen to a few songs and SHY will learn what you enjoy." />}</Shelf>
  </div>
}
