import { Album, ArrowRight, Clock3, FileAudio, Music2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { AlbumUploadFlow } from '../components/upload/AlbumUploadFlow'
import { SingleUploadFlow } from '../components/upload/SingleUploadFlow'
import { Cover, EmptyState, ErrorState, LoadingState } from '../components/States'
import { useAuth } from '../contexts/AuthContext'
import { formatReleaseDate } from '../lib/format'
import { publicStorageUrl, requireSupabase } from '../lib/supabase'

type UploadKind = 'single' | 'album'
interface ArtistIdentity { id: string; slug: string }
interface DraftItem { id: string; title: string; slug: string; cover_path: string | null; release_type?: string; updated_at?: string; created_at: string; kind: UploadKind }

export function UploadPage() {
  const auth = useAuth()
  const [params, setParams] = useSearchParams()
  const requested = params.get('type')
  const [kind, setKind] = useState<UploadKind | null>(requested === 'single' || requested === 'album' ? requested : null)

  const artist = useQuery({
    queryKey: ['my-artist', auth.user?.id],
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('artists').select('id,slug').eq('user_id', auth.user!.id).single()
      if (error) throw error
      return data as ArtistIdentity
    },
    enabled: Boolean(auth.user && auth.isArtist),
  })
  const subscription = useQuery({
    queryKey: ['artist-subscription', artist.data?.id],
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('artist_subscriptions').select('status,plan_name,expires_at').eq('artist_id', artist.data!.id).maybeSingle()
      if (error && !['42P01', 'PGRST205'].includes(error.code ?? '')) throw error
      return data as { status: 'active' | 'pending' | 'expired'; plan_name: string; expires_at: string | null } | null
    },
    enabled: Boolean(artist.data),
    retry: false,
  })

  if (auth.loading) return <LoadingState label="Checking artist access..." />
  if (!auth.user) return <Navigate to="/auth" replace />
  if (!auth.isArtist) return <Navigate to="/" replace />
  if (artist.isLoading) return <LoadingState label="Loading upload tools..." />
  if (artist.error) return <ErrorState error={artist.error} retry={() => void artist.refetch()} />
  if (!artist.data) return <ErrorState error={new Error('Your artist profile is not ready yet.')} />

  const choose = (next: UploadKind | null) => { setKind(next); setParams(next ? { type: next } : {}) }
  if (kind === 'single') return <main className="upload-page"><SingleUploadFlow artist={artist.data} onExit={() => choose(null)} /></main>
  if (kind === 'album') return <main className="upload-page"><AlbumUploadFlow artist={artist.data} onExit={() => choose(null)} /></main>
  return <UploadChooser artist={artist.data} subscription={subscription.data} subscriptionLoading={subscription.isLoading} onChoose={choose} />
}

function UploadChooser({ artist, subscription, subscriptionLoading, onChoose }: {
  artist: ArtistIdentity
  subscription?: { status: 'active' | 'pending' | 'expired'; plan_name: string; expires_at: string | null } | null
  subscriptionLoading: boolean
  onChoose: (kind: UploadKind) => void
}) {
  const drafts = useQuery({
    queryKey: ['upload-drafts', artist.id],
    queryFn: async () => {
      const db = requireSupabase()
      const [trackResult, albumResult] = await Promise.all([
        db.from('tracks').select('id,title,slug,cover_path,created_at,updated_at').eq('artist_id', artist.id).eq('release_status', 'draft').order('updated_at', { ascending: false }),
        db.from('albums').select('id,title,slug,cover_path,release_type,created_at,updated_at').eq('artist_id', artist.id).eq('release_status', 'draft').order('updated_at', { ascending: false }),
      ])
      if (trackResult.error) throw trackResult.error
      if (albumResult.error) throw albumResult.error
      return [...(trackResult.data ?? []).map((item) => ({ ...item, kind: 'single' as const })), ...(albumResult.data ?? []).map((item) => ({ ...item, kind: 'album' as const }))].sort((a, b) => new Date(b.updated_at ?? b.created_at).getTime() - new Date(a.updated_at ?? a.created_at).getTime()) as DraftItem[]
    },
  })
  const blocked = !subscriptionLoading && Boolean(subscription && subscription.status !== 'active')
  return <main className="upload-page upload-chooser">
    <header className="page-heading"><div><p className="eyebrow">Artist studio</p><h1>Upload to SHY</h1><p>Choose a release type and build it one clear step at a time.</p></div></header>
    {blocked && <aside className="subscription-block" role="status"><Clock3 /><div><strong>Uploads are currently unavailable</strong><p>Your subscription is {subscription?.status}. You cannot upload until it is active.</p></div><Link className="button secondary" to={`/artists/${artist.slug}`}>Check Subscription Status</Link></aside>}
    <div className="upload-choice-grid">
      <article className="upload-choice-card"><span><Music2 /></span><h2>Upload a Single Track</h2><p>Share one song with the world</p><button className="button primary" disabled={blocked || subscriptionLoading} onClick={() => onChoose('single')}>Get Started <ArrowRight /></button><small>MP3, WAV, FLAC, AAC · Up to 100MB per file</small></article>
      <article className="upload-choice-card"><span><Album /></span><h2>Upload an Album or EP</h2><p>Release a full project with multiple tracks</p><button className="button primary" disabled={blocked || subscriptionLoading} onClick={() => onChoose('album')}>Get Started <ArrowRight /></button><small>Up to 30 tracks per project</small></article>
    </div>
    <section className="drafts-section"><div className="section-heading"><div><p className="eyebrow">Private workspace</p><h2>My Drafts</h2></div></div>{drafts.isLoading ? <LoadingState label="Loading drafts..." /> : drafts.error ? <ErrorState error={drafts.error} retry={() => void drafts.refetch()} /> : drafts.data?.length ? <div className="management-list">{drafts.data.map((draft) => <article className="management-row" key={`${draft.kind}-${draft.id}`}><Cover src={publicStorageUrl('covers', draft.cover_path)} alt={draft.title} /><div><strong>{draft.title}</strong><span><FileAudio /> {draft.kind === 'single' ? 'Single track' : draft.release_type ?? 'Album'} · Edited {formatReleaseDate(draft.updated_at ?? draft.created_at)}</span></div><Link className="button secondary" to="/dashboard">Continue</Link></article>)}</div> : <EmptyState title="No drafts yet" text="Saved tracks and albums will stay private here." />}</section>
  </main>
}
