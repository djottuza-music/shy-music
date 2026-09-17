import { useQuery } from '@tanstack/react-query'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { useAuth } from '../contexts/AuthContext'
import { requireSupabase } from '../lib/supabase'

export function MyArtistPage() {
  const auth = useAuth()
  const location = useLocation()
  const artist = useQuery({
    queryKey: ['my-artist-profile', auth.user?.id],
    enabled: Boolean(auth.user),
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('artists').select('slug')
        .eq('user_id', auth.user!.id).abortSignal(AbortSignal.timeout(15000)).maybeSingle()
      if (error) throw error
      return data
    },
  })
  if (auth.loading || (auth.user && artist.isPending)) return <LoadingState label="Opening your artist profile..." />
  if (!auth.user) return <Navigate to="/auth" replace />
  if (artist.error) return <ErrorState error={artist.error} retry={() => void artist.refetch()} />
  if (artist.data?.slug) return <Navigate to={`/artists/${artist.data.slug}${location.search}`} replace />
  return <section><EmptyState title="Your artist profile is not set up yet" text="Open your dashboard to complete artist setup." /><Link className="button primary" to="/dashboard">Open artist dashboard</Link></section>
}
