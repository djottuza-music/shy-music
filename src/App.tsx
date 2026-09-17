import { lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'

const AdminPage = lazy(() => import('./pages/AdminPage').then((module) => ({ default: module.AdminPage })))
const AlbumPage = lazy(() => import('./pages/AlbumPage').then((module) => ({ default: module.AlbumPage })))
const ArtistPage = lazy(() => import('./pages/ArtistPage').then((module) => ({ default: module.ArtistPage })))
const ArtistsPage = lazy(() => import('./pages/ArtistsPage').then((module) => ({ default: module.ArtistsPage })))
const AuthPage = lazy(() => import('./pages/AuthPage').then((module) => ({ default: module.AuthPage })))
const ChartsPage = lazy(() => import('./pages/ChartsPage').then((module) => ({ default: module.ChartsPage })))
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const DiscoverPage = lazy(() => import('./pages/DiscoverPage').then((module) => ({ default: module.DiscoverPage })))
const HomePage = lazy(() => import('./pages/HomePage').then((module) => ({ default: module.HomePage })))
const FansPage = lazy(() => import('./pages/FansPage').then((module) => ({ default: module.FansPage })))
const MyArtistPage = lazy(() => import('./pages/MyArtistPage').then((module) => ({ default: module.MyArtistPage })))
const LibraryPage = lazy(() => import('./pages/LibraryPage').then((module) => ({ default: module.LibraryPage })))
const PlaylistPage = lazy(() => import('./pages/PlaylistPage').then((module) => ({ default: module.PlaylistPage })))
const RadioPage = lazy(() => import('./pages/RadioPage').then((module) => ({ default: module.RadioPage })))
const TrackPage = lazy(() => import('./pages/TrackPage').then((module) => ({ default: module.TrackPage })))
const UploadPage = lazy(() => import('./pages/UploadPage').then((module) => ({ default: module.UploadPage })))
const simplePages = () => import('./pages/SimplePages')
const AccountPage = lazy(() => simplePages().then((module) => ({ default: module.AccountPage })))
const LegalPage = lazy(() => simplePages().then((module) => ({ default: module.LegalPage })))
const NotFoundPage = lazy(() => simplePages().then((module) => ({ default: module.NotFoundPage })))
const SupportPage = lazy(() => simplePages().then((module) => ({ default: module.SupportPage })))

export default function App() {
  return <Routes>
    <Route element={<Layout />}>
      <Route index element={<HomePage />} />
      <Route path="artists" element={<ArtistsPage />} />
      <Route path="artists/:slug" element={<ArtistPage />} />
      <Route path="my-artist" element={<MyArtistPage />} />
      <Route path="artist/:slug" element={<ArtistPage />} />
      <Route path="albums/:slug" element={<AlbumPage />} />
      <Route path="album/:slug" element={<AlbumPage />} />
      <Route path="tracks/:slug" element={<TrackPage />} />
      <Route path="song/:slug" element={<TrackPage />} />
      <Route path="library" element={<LibraryPage />} />
      <Route path="playlists/:id" element={<PlaylistPage />} />
      <Route path="discover" element={<DiscoverPage />} />
      <Route path="charts" element={<ChartsPage />} />
      <Route path="fans" element={<FansPage />} />
      <Route path="radio" element={<RadioPage />} />
      <Route path="auth" element={<AuthPage />} />
      <Route path="dashboard" element={<DashboardPage />} />
      <Route path="upload" element={<UploadPage />} />
      <Route path="admin" element={<AdminPage />} />
      <Route path="legal" element={<LegalPage />} />
      <Route path="support" element={<SupportPage />} />
      <Route path="account" element={<AccountPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Route>
  </Routes>
}
