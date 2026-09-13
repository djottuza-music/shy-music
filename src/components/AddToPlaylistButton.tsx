import { ListPlus, X } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { requireSupabase } from '../lib/supabase'

export function AddToPlaylistButton({ trackId }: { trackId: string }) {
  const auth = useAuth()
  const navigate = useNavigate()
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const playlists = useQuery({
    queryKey: ['my-playlists', auth.user?.id],
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('playlists').select('id,name').eq('user_id', auth.user!.id).order('name')
      if (error) throw error
      return data ?? []
    },
    enabled: Boolean(auth.user && open),
  })
  const add = useMutation({
    mutationFn: async (playlistId: string) => {
      const db = requireSupabase()
      const count = await db.from('playlist_tracks').select('track_id', { count: 'exact', head: true }).eq('playlist_id', playlistId)
      if (count.error) throw count.error
      const { error } = await db.from('playlist_tracks').insert({ playlist_id: playlistId, track_id: trackId, position: count.count ?? 0 })
      if (error?.code === '23505') throw new Error('This song is already in that playlist.')
      if (error) throw error
    },
    onSuccess: async () => { setMessage('Added to playlist.'); await client.invalidateQueries({ queryKey: ['playlist'] }) },
  })
  const show = () => { if (!auth.user) { navigate('/auth'); return }; setMessage(''); setOpen(true) }
  return <><button className="button secondary" onClick={show}><ListPlus />Add to Playlist</button>{open && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="playlist-modal-title"><button className="icon-button modal-close" onClick={() => setOpen(false)} aria-label="Close playlist chooser"><X /></button><h2 id="playlist-modal-title">Add to playlist</h2>{playlists.isLoading && <p>Loading your playlists...</p>}{playlists.error && <p className="form-message error">Could not load your playlists.</p>}{playlists.data?.length ? <div className="playlist-picker">{playlists.data.map((playlist) => <button key={playlist.id} onClick={() => add.mutate(playlist.id)} disabled={add.isPending}>{playlist.name}</button>)}</div> : !playlists.isLoading && <p>You do not have a playlist yet. <Link to="/library">Create one in your library.</Link></p>}{message && <p className="form-message success">{message}</p>}{add.error && <p className="form-message error">{add.error.message}</p>}</section></div>}</>
}
