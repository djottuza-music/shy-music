import { MessageCircle, Send } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { requireSupabase } from '../lib/supabase'
import { Cover, EmptyState, ErrorState, LoadingState } from './States'
import type { Comment } from '../types'
import { formatFriendlyDate, sanitizePlainText } from '../lib/presentation'

export function Comments({ trackId, albumId }: { trackId?: string; albumId?: string }) {
  const auth = useAuth()
  const client = useQueryClient()
  const [body, setBody] = useState('')
  const target = trackId ? ['track', trackId] : ['album', albumId]
  const comments = useQuery({
    queryKey: ['comments', ...target],
    queryFn: async () => {
      let query = requireSupabase().from('comments').select('*, profile:profiles!comments_user_id_fkey(display_name,avatar_url)').order('created_at', { ascending: false })
      query = trackId ? query.eq('track_id', trackId) : query.eq('album_id', albumId!)
      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as Comment[]
    },
  })
  const add = useMutation({
    mutationFn: async () => {
      const message = sanitizePlainText(body)
      if (!auth.user) throw new Error('Sign in to comment.')
      if (!message) throw new Error('Write a comment first.')
      const { error } = await requireSupabase().from('comments').insert({ user_id: auth.user.id, track_id: trackId ?? null, album_id: albumId ?? null, body: message })
      if (error) throw error
    },
    onSuccess: async () => { setBody(''); await client.invalidateQueries({ queryKey: ['comments', ...target] }) },
  })
  const submit = (event: FormEvent) => { event.preventDefault(); add.mutate() }

  return <section className="comments-section">
    <div className="section-heading"><h2><MessageCircle /> Comments</h2><span>{comments.data?.length ?? 0}</span></div>
    {auth.user ? <form className="comment-form" onSubmit={submit}><label className="sr-only" htmlFor={`comment-${trackId ?? albumId}`}>Write a comment</label><div className="textarea-counter"><textarea id={`comment-${trackId ?? albumId}`} maxLength={1000} rows={3} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Join the conversation" /><small className={body.length >= 980 ? 'near-limit' : ''}>{body.length} / 1000</small></div><button className="button primary" disabled={add.isPending || !body.trim()}><Send />{add.isPending ? 'Posting...' : 'Post comment'}</button>{add.error && <span className="form-message error" role="alert">{add.error.message}</span>}</form> : <p className="sign-in-prompt"><Link to="/auth">Sign in</Link> to join the conversation.</p>}
    {comments.isLoading ? <LoadingState label="Loading comments..." /> : comments.error ? <ErrorState error={comments.error} retry={() => void comments.refetch()} /> : comments.data?.length ? <div className="comment-list">{comments.data.map((comment) => <article key={comment.id}><Cover src={comment.profile?.avatar_url} alt={`${comment.profile?.display_name ?? 'SHY listener'} profile photo`} /><div><strong>{comment.profile?.display_name ?? 'SHY listener'}</strong><time dateTime={comment.created_at}>{formatFriendlyDate(comment.created_at)}</time><p>{comment.body}</p></div></article>)}</div> : <EmptyState title="No comments yet" text="Be the first to leave a comment." />}
  </section>
}
