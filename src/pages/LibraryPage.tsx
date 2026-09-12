import { useQuery } from '@tanstack/react-query'
import { Navigate } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { TrackRow } from '../components/TrackRow'
import { useAuth } from '../contexts/AuthContext'
import { publicStorageUrl, requireSupabase } from '../lib/supabase'
import type { Track } from '../types'

export function LibraryPage() {
  const auth = useAuth()
  const liked = useQuery({ queryKey: ['library', auth.user?.id], queryFn: async () => {
    const { data, error } = await requireSupabase().from('likes').select('track:tracks(*, artist:artists(display_name,slug,avatar_url,verified), album:albums(title,slug,cover_path))').eq('user_id', auth.user!.id).order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map((row: any) => ({ ...row.track, cover_url: publicStorageUrl('covers', row.track.cover_path ?? row.track.album?.cover_path) })) as Track[]
  }, enabled: Boolean(auth.user) })
  if (auth.loading) return <LoadingState />
  if (!auth.user) return <Navigate to="/auth" replace />
  if (liked.isLoading) return <LoadingState label="Loading your library..." />
  if (liked.error) return <ErrorState error={liked.error} retry={() => liked.refetch()} />
  return <div><div className="page-heading"><div><span className="eyebrow">Your library</span><h1>Saved music</h1></div></div>{liked.data?.length ? <div className="track-list">{liked.data.map((track, index) => <TrackRow key={track.id} track={track} queue={liked.data!} index={index} />)}</div> : <EmptyState title="Your library is quiet" text="Like a song and it will appear here." />}</div>
}
