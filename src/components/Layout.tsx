import { BarChart3, Headphones, LogOut, Mic2, Search, Settings, Upload, UserPlus, UserRound, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { GlobalPlayer } from './GlobalPlayer'
import { NotificationsMenu } from './NotificationsMenu'
import { NavigationEffects } from './NavigationEffects'
import { NativeBackHandler } from './NativeBackHandler'
import { requireSupabase } from '../lib/supabase'

const desktopNavItems = [
  { to: '/', label: 'Home' }, { to: '/artists', label: 'Artists' }, { to: '/library', label: 'Library' },
  { to: '/discover', label: 'Discover' }, { to: '/charts', label: 'Charts' }, { to: '/fans', label: 'Fans' }, { to: '/radio', label: 'Radio' },
]
const mobileNavItems = [
  { to: '/', label: 'Home', end: true }, { to: '/artists', label: 'Artists' }, { to: '/library', label: 'Library' },
  { to: '/discover', label: 'Discover' }, { to: '/fans', label: 'Fans' },
]
type Overlay = 'search' | 'profile' | 'logout' | null

export function Layout() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [artistBusy, setArtistBusy] = useState(false)
  const [artistError, setArtistError] = useState('')
  const [search, setSearch] = useState('')
  const initial = auth.profile?.display_name?.charAt(0) || auth.user?.email?.charAt(0) || 'S'
  const myArtist = useQuery({
    queryKey: ['layout-artist', auth.user?.id],
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('artists').select('slug').eq('user_id', auth.user!.id).maybeSingle()
      if (error) throw error
      return data as { slug: string } | null
    },
    enabled: Boolean(auth.user && auth.isArtist),
  })

  useEffect(() => {
    const onPopState = () => setOverlay(null)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const openOverlay = (next: Exclude<Overlay, null>) => {
    if (overlay === next) return
    window.history.pushState({ ...window.history.state, shyOverlay: next }, '')
    setOverlay(next)
  }
  const closeOverlay = () => {
    if (window.history.state?.shyOverlay) window.history.back()
    else setOverlay(null)
  }
  const closeAndNavigate = (to: string) => {
    if (window.history.state?.shyOverlay) window.history.replaceState({ ...window.history.state, shyOverlay: undefined }, '')
    setOverlay(null)
    navigate(to)
  }
  const logout = async () => {
    await auth.signOut()
    if (window.history.state?.shyOverlay) window.history.replaceState({ ...window.history.state, shyOverlay: undefined }, '')
    setOverlay(null)
    navigate('/')
  }
  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    const query = search.trim()
    closeAndNavigate(query ? `/discover?q=${encodeURIComponent(query)}` : '/discover')
  }
  const switchMode = (mode: 'listener' | 'artist') => {
    auth.setAccountMode(mode)
    closeAndNavigate(mode === 'artist' ? '/dashboard' : '/')
  }
  const openArtistTools = async () => {
    if (artistBusy) return
    setArtistBusy(true)
    setArtistError('')
    try {
      await auth.activateArtist()
      closeAndNavigate('/dashboard')
    } catch (caught) {
      setArtistError(caught instanceof Error ? caught.message : 'Artist tools could not be opened.')
      setOverlay('profile')
    } finally { setArtistBusy(false) }
  }

  const artistPath = myArtist.data?.slug ? `/artists/${myArtist.data.slug}` : '/dashboard'
  return <div className="app-shell">
    <NavigationEffects /><NativeBackHandler />
    <header className={`topbar ${auth.isArtist ? 'artist-topbar' : ''}`}>
      <div className="topbar-main">
        <Link to="/" className="brand" aria-label="SHY home"><img className="brand-logo" src={`${import.meta.env.BASE_URL}assets/brand/shy-logo-192.png`} alt="SHY Music logo" /><span>SHY<small>MUSIC</small></span></Link>
        <nav className="desktop-nav" aria-label="Primary navigation">{desktopNavItems.map(({ to, label }) => <NavLink key={to} to={to}>{label}</NavLink>)}{auth.isAdmin && <AdminNavLink />}{auth.isArtist && <NavLink to={artistPath}>Artist Profile</NavLink>}</nav>
        <form className="search-box desktop-search" role="search" onSubmit={submitSearch}><Search aria-hidden="true" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tracks, artists, albums" aria-label="Search SHY" /></form>
        <button className="mobile-search-trigger" type="button" onClick={() => openOverlay('search')} aria-label="Open search"><Search /><span>Search tracks...</span></button>
        <div className="nav-actions">
          <NotificationsMenu />
          {auth.user && !auth.isArtist && <button className="button secondary compact-button" onClick={() => void openArtistTools()} disabled={artistBusy}><UserPlus />{artistBusy ? 'Opening...' : 'Artist tools'}</button>}
          {auth.isArtist && <Link className="button primary compact-button" to="/upload"><Upload />Upload</Link>}
          {auth.isArtist && <Link className="button secondary compact-button" to="/dashboard"><Headphones />Dashboard</Link>}
          {auth.user ? <div className="profile-menu"><button className="avatar-button" onClick={() => openOverlay('profile')} aria-expanded={overlay === 'profile'} aria-label="Open account menu">{auth.profile?.avatar_url ? <img src={auth.profile.avatar_url} alt={`${auth.profile.display_name} profile photo`} /> : initial.toUpperCase()}</button></div> : <Link className="button primary compact-button sign-in-button" to="/auth"><UserRound />Sign in</Link>}
        </div>
      </div>
      <nav className="mobile-tabbar" aria-label="Mobile navigation">{mobileNavItems.map(({ to, label, end }) => <NavLink key={to} to={to} end={end}>{label}</NavLink>)}</nav>
    </header>

    {overlay === 'search' && <section className="mobile-search-overlay" role="dialog" aria-modal="true" aria-label="Search SHY"><header><button className="icon-button" onClick={closeOverlay} aria-label="Close search"><X /></button><strong>Search SHY</strong></header><form onSubmit={submitSearch}><label className="search-box"><Search /><input autoFocus type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tracks, artists, albums" aria-label="Search tracks" /></label></form></section>}
    {overlay === 'profile' && <><button className="sheet-backdrop" onClick={closeOverlay} aria-label="Close account menu" /><section className="profile-popover profile-sheet" role="dialog" aria-modal="true" aria-label="Account menu"><span className="modal-drag-handle" /><header><div><strong>{auth.profile?.display_name ?? 'SHY member'}</strong><span>{auth.user?.email}</span></div><button className="icon-button" onClick={closeOverlay} aria-label="Close account menu"><X /></button></header>{auth.isArtist ? <><button onClick={() => closeAndNavigate(artistPath)}><Mic2 />My Artist Profile</button><button onClick={() => closeAndNavigate(`${artistPath}?tab=dashboard`)}><BarChart3 />Dashboard &amp; Analytics</button><button onClick={() => closeAndNavigate('/upload')}><Upload />Upload Music</button><button onClick={() => closeAndNavigate(`${artistPath}?edit=1`)}><UserRound />Edit Profile</button></> : <><button onClick={() => closeAndNavigate('/account')}><UserRound />My Profile</button><button onClick={() => void openArtistTools()} disabled={artistBusy}><UserPlus />{artistBusy ? 'Opening artist tools...' : 'Become an Artist'}</button></>}{auth.isArtist && <div className="account-mode-switch" aria-label="SHY experience"><button className={auth.activeMode === 'listener' ? 'active' : ''} onClick={() => switchMode('listener')}>Listener view</button><button className={auth.activeMode === 'artist' ? 'active' : ''} onClick={() => switchMode('artist')}>Artist view</button></div>}{artistError && <span className="form-message error" role="alert">{artistError}</span>}<button onClick={() => closeAndNavigate('/account')}><Settings />Settings</button><button className="logout-option" onClick={() => openOverlay('logout')}><LogOut />Log Out</button></section></>}
    {overlay === 'logout' && <><button className="sheet-backdrop" onClick={closeOverlay} aria-label="Cancel log out" /><section className="logout-dialog" role="alertdialog" aria-modal="true" aria-labelledby="logout-title"><h2 id="logout-title">Log out of SHY?</h2><p>Are you sure you want to log out?</p><div className="button-row"><button className="button secondary" onClick={closeOverlay}>Cancel</button><button className="button danger" onClick={() => void logout()}>Log Out</button></div></section></>}
    <main className="page"><Outlet /></main>
    <footer className="footer"><Link to="/" className="brand" aria-label="SHY home"><img className="brand-logo small" src={`${import.meta.env.BASE_URL}assets/brand/shy-logo-192.png`} alt="SHY Music logo" /><span>SHY<small>MUSIC</small></span></Link><p>Independent music, owned by its artists. <small className="build-id">{__SHY_VERSION__}</small></p><nav><Link to="/legal">Legal</Link><Link to="/support">Support</Link></nav></footer>
    <GlobalPlayer />
  </div>
}

function AdminNavLink() {
  const pending = useQuery({ queryKey: ['admin-pending-count'], queryFn: async () => { const { data, error } = await requireSupabase().rpc('admin_pending_count'); if (error) throw error; return Number(data ?? 0) }, refetchInterval: 60_000 })
  const count = pending.data ?? 0
  return <NavLink to="/admin" className="admin-nav-link"><span className="admin-nav-icon"><Settings aria-hidden="true" />{count > 0 && <b aria-label={`${count} pending admin items`}>{count > 9 ? '9+' : count}</b>}</span>Admin</NavLink>
}
