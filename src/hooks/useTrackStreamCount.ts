import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useTrackStreamCount(trackId: string, initial: number) {
  const [snapshot, setSnapshot] = useState({ trackId, count: initial })
  useEffect(() => {
    if (!supabase) return
    const db = supabase
    const channel = db.channel(`track-streams:${trackId}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tracks', filter: `id=eq.${trackId}` }, (payload) => {
        const next = Number((payload.new as { plays_count?: number }).plays_count)
        if (Number.isFinite(next)) setSnapshot({ trackId, count: next })
      }).subscribe()
    return () => { void db.removeChannel(channel) }
  }, [trackId])
  return snapshot.trackId === trackId ? Math.max(snapshot.count, initial) : initial
}
