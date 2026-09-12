import { Bell, Compass, Headphones, Home, Library, LogOut, Menu, Mic2, Search, Shield, Upload, UserRound, X } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { GlobalPlayer } from './GlobalPlayer'

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/artists', label: 'Artists', icon: Mic2 },
  { to: '/library', label: 'Library', icon: Library },
  { to: '/discover', label: 'Discover', icon: Compass },
]

export function Layout() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const initial = auth.profile?.display_name?.charAt(0) || auth.user?.email?.charAt(0) || 'S'

  const logout = async () => {
    await auth.signOut()
    setProfileOpen(false)
    navigate('/')
  }

  return <div className="app-shell">
    <header className={`topbar ${auth.isArtist ? 'artist-topbar' : ''}`}>
      <Link to="/" className="brand" aria-label="SHY home"><span className="brand-mark">S</span><span>SHY<small>MUSIC</small></span></Link>
      <nav className="desktop-nav" aria-label="Primary navigation">{navItems.map(({ to, label }) => <NavLink key={to} to={to}>{label}</NavLink>)}</nav>
      <label className="search-box"><Search aria-hidden="true" /><input type="search" placeholder="Search tracks, artists, albums" aria-label="Search SHY" /></label>
      <div className="nav-actions">
        <button className="icon-button" aria-label="Notifications"><Bell /></button>
        {auth.isArtist && <Link className="button primary compact-button" to="/upload"><Upload />Upload</Link>}
        {auth.isArtist && <Link className="button secondary compact-button" to="/dashboard"><Headphones />Dashboard</Link>}
        {auth.isAdmin && <Link className="button secondary compact-button" to="/admin"><Shield />Admin</Link>}
        {auth.user ? <div className="profile-menu"><button className="avatar-button" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen} aria-label="Open account menu">{initial.toUpperCase()}</button>{profileOpen && <div className="profile-popover"><strong>{auth.profile?.display_name ?? 'SHY member'}</strong><span>{auth.user.email}</span><button onClick={logout}><LogOut />Sign out</button></div>}</div> : <Link className="button primary compact-button" to="/auth"><UserRound />Sign in</Link>}
        <button className="icon-button mobile-menu-button" onClick={() => setMenuOpen((value) => !value)} aria-label="Toggle navigation">{menuOpen ? <X /> : <Menu />}</button>
      </div>
    </header>
    {menuOpen && <nav className="mobile-menu" aria-label="Mobile navigation">{navItems.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setMenuOpen(false)}><Icon />{label}</NavLink>)}</nav>}
    <main className="page"><Outlet /></main>
    <footer className="footer"><Link to="/" className="brand"><span className="brand-mark small">S</span><span>SHY<small>MUSIC</small></span></Link><p>Independent music, owned by its artists.</p><nav><Link to="/legal">Legal</Link><Link to="/support">Support</Link></nav></footer>
    <GlobalPlayer />
  </div>
}
