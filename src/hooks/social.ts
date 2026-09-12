import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { requireSupabase } from '../lib/supabase'

export function useTrackLike(trackId: string) {
  const auth = useAuth()
  const navigate = useNavigate()
  const client = useQueryClient()
  const queryKey = ['track-like', auth.user?.id, trackId]
  const query = useQuery({ queryKey, queryFn: async () => {
    const { data, error } = await requireSupabase().from('likes').select('track_id').eq('user_id', auth.user!.id).eq('track_id', trackId).maybeSingle()
    if (error) throw error
    return Boolean(data)
  }, enabled: Boolean(auth.user && trackId) })
  const mutation = useMutation({ mutationFn: async () => {
    if (!auth.user) { navigate('/auth'); return false }
    if (!trackId) throw new Error('Track is unavailable.')
    const db = requireSupabase()
    if (query.data) {
      const { error } = await db.from('likes').delete().eq('user_id', auth.user.id).eq('track_id', trackId)
      if (error) throw error
      return false
    }
    const { error } = await db.from('likes').insert({ user_id: auth.user.id, track_id: trackId })
    if (error) throw error
    return true
  }, onSuccess: (liked) => { if (typeof liked === 'boolean') client.setQueryData(queryKey, liked) } })
  return { liked: query.data ?? false, toggle: () => mutation.mutate(), busy: mutation.isPending }
}

export function useArtistFollow(artistId: string) {
  const auth = useAuth()
  const navigate = useNavigate()
  const client = useQueryClient()
  const queryKey = ['artist-follow', auth.user?.id, artistId]
  const query = useQuery({ queryKey, queryFn: async () => {
    const { data, error } = await requireSupabase().from('follows').select('artist_id').eq('user_id', auth.user!.id).eq('artist_id', artistId).maybeSingle()
    if (error) throw error
    return Boolean(data)
  }, enabled: Boolean(auth.user && artistId) })
  const mutation = useMutation({ mutationFn: async () => {
    if (!auth.user) { navigate('/auth'); return false }
    if (!artistId) throw new Error('Artist is unavailable.')
    const db = requireSupabase()
    if (query.data) {
      const { error } = await db.from('follows').delete().eq('user_id', auth.user.id).eq('artist_id', artistId)
      if (error) throw error
      return false
    }
    const { error } = await db.from('follows').insert({ user_id: auth.user.id, artist_id: artistId })
    if (error) throw error
    return true
  }, onSuccess: (followed) => { if (typeof followed === 'boolean') client.setQueryData(queryKey, followed) } })
  return { followed: query.data ?? false, toggle: () => mutation.mutate(), busy: mutation.isPending }
}
