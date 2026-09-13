import { ArrowLeft, Eye, EyeOff, Headphones, LockKeyhole, Mail, Mic2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { readAccountMode, type AccountMode } from '../lib/accountMode'

type Mode = 'welcome' | 'signin' | 'signup' | 'forgot' | 'recovery'

export function AuthPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [mode, setMode] = useState<Mode>(() => params.get('mode') === 'recovery' ? 'recovery' : typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 760px)').matches ? 'welcome' : 'signin')
  const [email, setEmail] = useState(() => localStorage.getItem('shy-remembered-email') ?? '')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [accountType, setAccountType] = useState<'listener' | 'artist'>('listener')
  const [signInMode, setSignInMode] = useState<AccountMode>(readAccountMode)
  const [remember, setRemember] = useState(Boolean(localStorage.getItem('shy-remembered-email')))
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [signupPendingEmail, setSignupPendingEmail] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)

  useEffect(() => {
    if (auth.user && !auth.loading && !busy && mode !== 'recovery') navigate(auth.activeMode === 'artist' ? '/dashboard' : '/', { replace: true })
  }, [auth.activeMode, auth.loading, auth.user, busy, mode, navigate])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      if (mode === 'recovery') {
        if (password.length < 8) throw new Error('Use at least 8 characters for your new password.')
        if (password !== passwordConfirmation) throw new Error('The passwords do not match.')
        await auth.updatePassword(password)
        setMessage('Your password has been updated. You can continue using SHY.')
      } else if (mode === 'forgot') {
        await auth.requestPasswordReset(email.trim())
        setMessage('Password reset instructions were sent to your email.')
      } else if (mode === 'signup') {
        if (displayName.trim().length < 2) throw new Error('Enter your name or artist name.')
        if (password.length < 8) throw new Error('Use at least 8 characters for your password.')
        if (!termsAccepted) throw new Error('Agree to the Terms of Service and Privacy Policy to continue.')
        const result = await auth.signUp({ email: email.trim(), password, displayName: displayName.trim(), accountType })
        setSignupPendingEmail(result.needsVerification ? email.trim() : '')
        setMessage(result.needsVerification ? 'Signup received. New accounts get a confirmation email. If none arrives, this email may already have a SHY account.' : 'Your SHY account is ready.')
      } else {
        await auth.signIn(email.trim(), password, signInMode)
        if (remember) localStorage.setItem('shy-remembered-email', email.trim())
        else localStorage.removeItem('shy-remembered-email')
        navigate(signInMode === 'artist' ? '/dashboard' : '/', { replace: true })
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Authentication failed.')
    } finally {
      setBusy(false)
    }
  }

  const resendConfirmation = async () => {
    setBusy(true)
    setError('')
    try {
      await auth.resendSignUpConfirmation(signupPendingEmail)
      setMessage('Confirmation email requested. Check your inbox and spam folder. Already confirmed? Sign in or reset your password.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The confirmation email could not be resent.')
    } finally {
      setBusy(false)
    }
  }

  const changeMode = (nextMode: Mode) => {
    setMode(nextMode)
    setError('')
    setMessage('')
    setSignupPendingEmail('')
  }

  if (mode === 'welcome') return <div className="auth-welcome"><div className="auth-welcome-brand"><img src={`${import.meta.env.BASE_URL}assets/brand/shy-logo-192.png`} alt="SHY Music logo" /><h1>SHY</h1><strong>MUSIC</strong><p>Where AI Finds Its Voice</p></div><div className="auth-welcome-actions"><button className="button primary" onClick={() => { setAccountType('listener'); changeMode('signup') }}><Headphones />I'm a Listener</button><button className="button secondary" onClick={() => { setAccountType('artist'); changeMode('signup') }}><Mic2 />I'm an Artist</button><p>Already have an account? <button className="text-button" onClick={() => changeMode('signin')}>Sign In</button></p></div></div>

  return <div className="auth-page"><section className="auth-card">
    <button className="auth-back icon-button" type="button" onClick={() => changeMode('welcome')} aria-label="Back"><ArrowLeft /></button>
    <div className="auth-brand"><img className="brand-logo auth-logo" src={`${import.meta.env.BASE_URL}assets/brand/shy-logo-192.png`} alt="SHY Music" /><div><strong>SHY MUSIC</strong><span>Closer to the music.</span></div></div>
    {(mode === 'signin' || mode === 'signup') && <div className="segmented"><button className={mode === 'signin' ? 'active' : ''} onClick={() => changeMode('signin')}>Sign in</button><button className={mode === 'signup' ? 'active' : ''} onClick={() => changeMode('signup')}>Sign up</button></div>}
    <div className="auth-heading"><h1>{mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Join SHY' : mode === 'forgot' ? 'Reset your password' : 'Choose a new password'}</h1><p>{mode === 'signup' ? 'Choose how you want to use SHY.' : mode === 'recovery' ? 'Use a strong password you do not use elsewhere.' : 'Use the email connected to your account.'}</p></div>
    <form onSubmit={submit} className="form-stack">
      {mode === 'signin' && <fieldset><legend>Continue to SHY as</legend><div className="segmented"><button type="button" className={signInMode === 'listener' ? 'active' : ''} onClick={() => setSignInMode('listener')}>Listener</button><button type="button" className={signInMode === 'artist' ? 'active' : ''} onClick={() => setSignInMode('artist')}>Artist / songwriter</button></div><small className="field-help">Artist access is checked against your SHY account.</small></fieldset>}
      {mode === 'signup' && <><label>Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" required /></label><fieldset><legend>Account type</legend><div className="segmented"><button type="button" className={accountType === 'listener' ? 'active' : ''} onClick={() => setAccountType('listener')}>Listener</button><button type="button" className={accountType === 'artist' ? 'active' : ''} onClick={() => setAccountType('artist')}>Artist / songwriter</button></div></fieldset></>}
      {mode !== 'recovery' && <label>Email address<div className="input-with-icon"><Mail /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" required /></div></label>}
      {mode !== 'forgot' && <label>Password<div className="input-with-icon"><LockKeyhole /><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required minLength={8} /><button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff /> : <Eye />}</button></div></label>}
      {mode === 'recovery' && <label>Confirm new password<div className="input-with-icon"><LockKeyhole /><input type={showPassword ? 'text' : 'password'} value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} autoComplete="new-password" required minLength={8} /></div></label>}
      {mode === 'signin' && <div className="form-split"><label className="check-label"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />Remember email</label><button type="button" className="text-button" onClick={() => setMode('forgot')}>Forgot password?</button></div>}
      {mode === 'signup' && <label className="check-label terms-check"><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} required /><span>I agree to the <a href={`${import.meta.env.BASE_URL}legal`}>Terms of Service and Privacy Policy</a></span></label>}
      {error && <p className="form-message error" role="alert">{error}</p>}
      {message && <p className="form-message success" role="status">{message}</p>}
      {mode === 'signup' && signupPendingEmail && <div className="auth-recovery-actions"><button type="button" className="button secondary" onClick={() => void resendConfirmation()} disabled={busy}>Resend email</button><button type="button" className="text-button" onClick={() => changeMode('signin')}>Sign in instead</button><button type="button" className="text-button" onClick={() => changeMode('forgot')}>Reset password</button></div>}
      <button className="button primary full" disabled={busy}>{busy ? 'Please wait...' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset email' : 'Update password'}</button>
      {mode === 'forgot' && <button type="button" className="text-button" onClick={() => changeMode('signin')}>Back to sign in</button>}
    </form>
  </section></div>
}
