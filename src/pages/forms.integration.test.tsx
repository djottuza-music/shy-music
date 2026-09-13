// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AlbumUploadFlow } from '../components/upload/AlbumUploadFlow'
import { AuthPage } from './AuthPage'

const authMock = {
  user: null,
  loading: false,
  activeMode: 'listener',
  signIn: vi.fn(),
  signUp: vi.fn(),
  updatePassword: vi.fn(),
  requestPasswordReset: vi.fn(),
  resendSignUpConfirmation: vi.fn(),
}

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => authMock }))

function providers(children: React.ReactNode) {
  return <BrowserRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>{children}</QueryClientProvider></BrowserRouter>
}

describe('critical text-entry forms', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('keeps email and password text while signing in', async () => {
    const user = userEvent.setup()
    render(providers(<AuthPage />))
    const email = screen.getByRole('textbox', { name: 'Email address' }) as HTMLInputElement
    const password = screen.getByLabelText('Password') as HTMLInputElement
    await user.type(email, 'artist@example.com')
    await user.type(password, 'StrongPassword123!')
    expect(email.value).toBe('artist@example.com')
    expect(password.value).toBe('StrongPassword123!')
  })

  it('keeps album title text and metadata selections without remounting', async () => {
    const user = userEvent.setup()
    render(providers(<AlbumUploadFlow artist={{ id: 'artist-id', slug: 'artist' }} onExit={vi.fn()} />))
    const title = screen.getByRole('textbox', { name: 'Album title' }) as HTMLInputElement
    await user.type(title, 'A New SHY Album')
    await user.click(screen.getByRole('button', { name: 'Zamrock' }))
    await user.click(screen.getByRole('button', { name: 'Chill' }))
    expect(title.value).toBe('A New SHY Album')
    expect(screen.getByRole('button', { name: 'Zamrock' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Chill' }).getAttribute('aria-pressed')).toBe('true')
  })
})
