import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, Bell, BellOff, CheckCheck, Gift, Music2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { requireSupabase, supabase } from '../lib/supabase'
import { formatFriendlyDate } from '../lib/presentation'

interface NotificationRow {
  id: string
  title: string
  body: string
  link: string | null
  type: string
  is_read: boolean
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
      const { data, error } = await requireSupabase().from('notifications').select('id,title,body,link,type,is_read,read_at,created_at').eq('user_id', auth.user!.id).order('created_at', { ascending: false }).limit(50)
      if (error) throw error
      return (data ?? []) as NotificationRow[]
    },
    enabled: Boolean(auth.user),
  })
  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!auth.user) return
      const { error } = await requireSupabase().from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('user_id', auth.user.id).eq('is_read', false)
      if (error) throw error
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['notifications', auth.user?.id] }),
  })
  const markRead = useMutation({ mutationFn: async (id: string) => {
    const { error } = await requireSupabase().from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id)
    if (error) throw error
  }, onSuccess: () => client.invalidateQueries({ queryKey: ['notifications', auth.user?.id] }) })

  useEffect(() => {
    if (!supabase || !auth.user) return
    const db = supabase
    const channel = db.channel(`notifications:${auth.user.id}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${auth.user.id}` }, () => {
        void client.invalidateQueries({ queryKey: ['notifications', auth.user?.id] })
      }).subscribe()
    return () => { void db.removeChannel(channel) }
  }, [auth.user, client])

  const toggle = () => {
    if (!auth.user) {
      navigate('/auth')
      return
    }
    setOpen((value) => !value)
  }
  const unread = (notifications.data ?? []).filter((item) => !item.is_read && !item.read_at).length
  const openItem = async (item: NotificationRow) => {
    if (!item.is_read) await markRead.mutateAsync(item.id).catch(() => undefined)
    setOpen(false)
    if (item.link) navigate(item.link)
  }

  return <div className="notifications-menu">
    <button className="icon-button" onClick={toggle} aria-label="Notifications" aria-expanded={open}>
      <Bell />{unread > 0 && <span className="notification-dot" aria-label={`${unread} unread`}>{unread > 9 ? '9+' : unread}</span>}
    </button>
    {open && <section className="notification-popover" aria-label="Notifications">
      <header><strong>Notifications</strong><button className="text-button" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending || unread === 0}><CheckCheck />Mark all read</button></header>
      {notifications.isLoading && <p>Loading notifications...</p>}
      {notifications.error && <p role="alert">Notifications could not be loaded.</p>}
      {!notifications.isLoading && !notifications.error && notifications.data?.length === 0 && <div className="notification-empty"><BellOff /><p>No notifications yet.</p></div>}
      <div className="notification-list">{notifications.data?.map((item) => <button key={item.id} type="button" onClick={() => void openItem(item)} className={item.is_read || item.read_at ? '' : 'unread'}><NotificationIcon type={item.type} /><span><strong>{item.title}</strong><span>{item.body}</span><time>{formatFriendlyDate(item.created_at)}</time></span></button>)}</div>
    </section>}
  </div>
}

function NotificationIcon({ type }: { type: string }) {
  if (type === 'motivation') return <Gift aria-hidden="true" />
  if (type === 'upload') return <Music2 aria-hidden="true" />
  if (type === 'verification') return <BadgeCheck aria-hidden="true" />
  return <Bell aria-hidden="true" />
}
