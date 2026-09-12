import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AdminPage } from './pages/AdminPage'
import { AlbumPage } from './pages/AlbumPage'
import { ArtistPage } from './pages/ArtistPage'
import { ArtistsPage } from './pages/ArtistsPage'
import { AuthPage } from './pages/AuthPage'
import { DashboardPage } from './pages/DashboardPage'
import { DiscoverPage } from './pages/DiscoverPage'
import { HomePage } from './pages/HomePage'
import { LibraryPage } from './pages/LibraryPage'
import { LegalPage, NotFoundPage, SupportPage } from './pages/SimplePages'
import { TrackPage } from './pages/TrackPage'
import { UploadPage } from './pages/UploadPage'

export default function App() {
  return <Routes>
    <Route element={<Layout />}>
      <Route index element={<HomePage />} />
      <Route path="artists" element={<ArtistsPage />} />
      <Route path="artists/:slug" element={<ArtistPage />} />
      <Route path="albums/:slug" element={<AlbumPage />} />
      <Route path="tracks/:slug" element={<TrackPage />} />
      <Route path="library" element={<LibraryPage />} />
      <Route path="discover" element={<DiscoverPage />} />
      <Route path="auth" element={<AuthPage />} />
      <Route path="dashboard" element={<DashboardPage />} />
      <Route path="upload" element={<UploadPage />} />
      <Route path="admin" element={<AdminPage />} />
      <Route path="legal" element={<LegalPage />} />
      <Route path="support" element={<SupportPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Route>
  </Routes>
}
