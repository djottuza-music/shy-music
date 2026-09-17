// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MyArtistPage } from './MyArtistPage'

const mocks = vi.hoisted(() => ({ auth: { user: { id: 'owner' } as { id: string } | null, loading: false }, lookup: vi.fn() }))
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => mocks.auth }))
vi.mock('../lib/supabase', () => ({ requireSupabase: () => ({ from: () => ({ select: () => ({ eq: () => ({ abortSignal: () => ({ maybeSingle: mocks.lookup }) }) }) }) }) }))
function Destination() { const location = useLocation(); return <p>{location.pathname}{location.search}</p> }
function open() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/my-artist?tab=dashboard']}><Routes><Route path="/my-artist" element={<MyArtistPage />} /><Route path="*" element={<Destination />} /></Routes></MemoryRouter></QueryClientProvider>)
}
beforeEach(() => { mocks.auth.user = { id: 'owner' }; mocks.auth.loading = false; vi.clearAllMocks() })
afterEach(cleanup)
it('resolves the owner profile and preserves its requested tab', async () => {
  mocks.lookup.mockResolvedValue({ data: { slug: 'kopa' }, error: null })
  open()
  expect(await screen.findByText('/artists/kopa?tab=dashboard')).toBeTruthy()
})
it('shows artist setup when no artist record exists', async () => {
  mocks.lookup.mockResolvedValue({ data: null, error: null })
  open()
  expect(await screen.findByText('Your artist profile is not set up yet')).toBeTruthy()
})
it('shows retry when profile lookup fails', async () => {
  mocks.lookup.mockResolvedValue({ data: null, error: new Error('Connection failed') })
  open()
  expect(await screen.findByRole('button', { name: 'Try again' })).toBeTruthy()
})
it('directs signed-out visitors to sign in', async () => {
  mocks.auth.user = null
  open()
  expect(await screen.findByText('/auth')).toBeTruthy()
  expect(mocks.lookup).not.toHaveBeenCalled()
})
