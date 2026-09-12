import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, BellOff, CheckCheck } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { requireSupabase } from '../lib/supabase'

interface NotificationRow {
  id: string
  title: string
  body: string
  link: string | null
  read_at: string | null
  created_at: string
}

export function NotificationsMenu() {
  const auth = useAuth()
  const navigate = useNavigate()
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const notifications = useQuery({
    queryKey: ['notifications', auth.user?.id],
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('notifications').select('id,title,body,link,read_at,created_at').eq('user_id', auth.user!.id).order('created_at', { ascending: false }).limit(20)
      if (error) throw error
      return (data ?? []) as NotificationRow[]
    },
    enabled: Boolean(auth.user && open),
  })
  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!auth.user) return
      const { error } = await requireSupabase().from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', auth.user.id).is('read_at', null)
      if (error) throw error
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['notifications', auth.user?.id] }),
  })

  const toggle = () => {
    if (!auth.user) {
      navigate('/auth')
      return
    }
    setOpen((value) => !value)
  }
  const unread = (notifications.data ?? []).filter((item) => !item.read_at).length

  return <div className="notifications-menu">
    <button className="icon-button" onClick={toggle} aria-label="Notifications" aria-expanded={open}>
      <Bell />{unread > 0 && <span className="notification-dot" aria-label={`${unread} unread`} />}
    </button>
    {open && <section className="notification-popover" aria-label="Notifications">
      <header><strong>Notifications</strong><button className="text-button" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending || unread === 0}><CheckCheck />Mark all read</button></header>
      {notifications.isLoading && <p>Loading notifications...</p>}
      {notifications.error && <p role="alert">Notifications could not be loaded.</p>}
      {!notifications.isLoading && !notifications.error && notifications.data?.length === 0 && <div className="notification-empty"><BellOff /><p>No notifications yet.</p></div>}
      <div className="notification-list">{notifications.data?.map((item) => item.link ? <Link key={item.id} to={item.link} onClick={() => setOpen(false)} className={item.read_at ? '' : 'unread'}><strong>{item.title}</strong><span>{item.body}</span><time>{new Date(item.created_at).toLocaleDateString()}</time></Link> : <article key={item.id} className={item.read_at ? '' : 'unread'}><strong>{item.title}</strong><span>{item.body}</span><time>{new Date(item.created_at).toLocaleDateString()}</time></article>)}</div>
    </section>}
  </div>
}
