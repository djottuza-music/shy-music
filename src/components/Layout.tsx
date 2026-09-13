import { BarChart3, Compass, Headphones, Home, Library, LogOut, Menu, Mic2, Radio, Search, Settings, Upload, UserPlus, UserRound, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { GlobalPlayer } from './GlobalPlayer'
import { NotificationsMenu } from './NotificationsMenu'
import { NavigationEffects } from './NavigationEffects'
import { requireSupabase } from '../lib/supabase'

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/artists', label: 'Artists', icon: Mic2 },
  { to: '/library', label: 'Library', icon: Library },
  { to: '/discover', label: 'Discover', icon: Compass },
  { to: '/charts', label: 'Charts', icon: BarChart3 },
  { to: '/radio', label: 'Radio', icon: Radio },
]

export function Layout() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [artistBusy, setArtistBusy] = useState(false)
  const [artistError, setArtistError] = useState('')
  const [search, setSearch] = useState('')
  const initial = auth.profile?.display_name?.charAt(0) || auth.user?.email?.charAt(0) || 'S'

  const logout = async () => {
    await auth.signOut()
    setProfileOpen(false)
    navigate('/')
  }

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    const query = search.trim()
    navigate(query ? `/discover?q=${encodeURIComponent(query)}` : '/discover')
  }

  const switchMode = (mode: 'listener' | 'artist') => {
    auth.setAccountMode(mode)
    setProfileOpen(false)
    navigate(mode === 'artist' ? '/dashboard' : '/')
  }

  const openArtistTools = async () => {
    if (artistBusy) return
    setArtistBusy(true)
    setArtistError('')
    try {
      await auth.activateArtist()
      setProfileOpen(false)
      navigate('/dashboard')
    } catch (caught) {
      setArtistError(caught instanceof Error ? caught.message : 'Artist tools could not be opened.')
      setProfileOpen(true)
    } finally {
      setArtistBusy(false)
    }
  }

  return <div className="app-shell">
    <NavigationEffects />
    <header className={`topbar ${auth.isArtist ? 'artist-topbar' : ''}`}>
      <Link to="/" className="brand" aria-label="SHY home"><img className="brand-logo" src={`${import.meta.env.BASE_URL}assets/brand/shy-logo-192.png`} alt="" /><span>SHY<small>MUSIC</small></span></Link>
      <nav className="desktop-nav" aria-label="Primary navigation">{navItems.map(({ to, label }) => <NavLink key={to} to={to}>{label}</NavLink>)}{auth.isAdmin && <AdminNavLink />}</nav>
      <form className="search-box" role="search" onSubmit={submitSearch}><Search aria-hidden="true" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tracks, artists, albums" aria-label="Search SHY" /></form>
      <div className="nav-actions">
        <NotificationsMenu />
        {auth.user && !auth.isArtist && <button className="button secondary compact-button" onClick={() => void openArtistTools()} disabled={artistBusy}><UserPlus />{artistBusy ? 'Opening...' : 'Artist tools'}</button>}
        {auth.isArtist && <Link className="button primary compact-button" to="/upload"><Upload />Upload</Link>}
        {auth.isArtist && <Link className="button secondary compact-button" to="/dashboard"><Headphones />Dashboard</Link>}
        {auth.user ? <div className="profile-menu"><button className="avatar-button" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen} aria-label="Open account menu">{initial.toUpperCase()}</button>{profileOpen && <div className="profile-popover"><strong>{auth.profile?.display_name ?? 'SHY member'}</strong><span>{auth.user.email}</span>{auth.isArtist ? <><div className="account-mode-switch" aria-label="SHY experience"><button className={auth.activeMode === 'listener' ? 'active' : ''} onClick={() => switchMode('listener')}>Listener view</button><button className={auth.activeMode === 'artist' ? 'active' : ''} onClick={() => switchMode('artist')}>Artist view</button></div><Link to="/upload" onClick={() => setProfileOpen(false)}><Upload />Upload music</Link><Link to="/dashboard" onClick={() => setProfileOpen(false)}><Headphones />Artist dashboard</Link></> : <button onClick={() => void openArtistTools()} disabled={artistBusy}><UserPlus />{artistBusy ? 'Opening artist tools...' : 'Enable artist tools'}</button>}{artistError && <span className="form-message error" role="alert">{artistError}</span>}<Link to="/account" onClick={() => setProfileOpen(false)}><UserRound />Account settings</Link><button onClick={logout}><LogOut />Sign out</button></div>}</div> : <Link className="button primary compact-button" to="/auth"><UserRound />Sign in</Link>}
        <button className="icon-button mobile-menu-button" onClick={() => setMenuOpen((value) => !value)} aria-label="Toggle navigation">{menuOpen ? <X /> : <Menu />}</button>
      </div>
    </header>
    {menuOpen && <nav className="mobile-menu" aria-label="Mobile navigation">{navItems.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setMenuOpen(false)}><Icon />{label}</NavLink>)}{auth.isAdmin && <AdminNavLink mobile close={() => setMenuOpen(false)} />}</nav>}
    <main className="page"><Outlet /></main>
    <footer className="footer"><Link to="/" className="brand" aria-label="SHY home"><img className="brand-logo small" src={`${import.meta.env.BASE_URL}assets/brand/shy-logo-192.png`} alt="" /><span>SHY<small>MUSIC</small></span></Link><p>Independent music, owned by its artists. <small className="build-id">{__SHY_VERSION__}</small></p><nav><Link to="/legal">Legal</Link><Link to="/support">Support</Link></nav></footer>
    <GlobalPlayer />
  </div>
}

function AdminNavLink({ mobile = false, close }: { mobile?: boolean; close?: () => void }) {
  const pending = useQuery({
    queryKey: ['admin-pending-count'],
    queryFn: async () => {
      const { data, error } = await requireSupabase().rpc('admin_pending_count')
      if (error) throw error
      return Number(data ?? 0)
    },
    refetchInterval: 60_000,
  })
  const count = pending.data ?? 0
  return <NavLink to="/admin" className={mobile ? undefined : 'admin-nav-link'} onClick={close}>
    <span className="admin-nav-icon"><Settings aria-hidden="true" />{count > 0 && <b aria-label={`${count} pending admin items`}>{count > 9 ? '9+' : count}</b>}</span>Admin
  </NavLink>
}
