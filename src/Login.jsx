import { useMemo, useState } from 'react'
import { supabase } from './supabase'
import Logo from './Logo'

const QUOTES = [
  { q: 'Memory is the diary that we all carry about with us.', by: 'Oscar Wilde' },
  { q: 'Tell me what you eat, and I will tell you what you are.', by: 'Jean Anthelme Brillat-Savarin' },
  { q: 'One cannot think well, love well, sleep well, if one has not dined well.', by: 'Virginia Woolf' },
]

const TRUST = [
  ['🔒', 'Private by design', 'Every entry is tied to your account. Only you can see your journal.'],
  ['🛡️', 'Secure sign-in', 'Passwords are encrypted, and your connection is protected.'],
  ['🚫', 'No ads, no sharing', 'Your places and dishes are never sold or shared.'],
]

export default function Login({ notice }) {
  const [identity, setIdentity] = useState('')   // login: username or email
  const [username, setUsername] = useState('')     // signup only
  const [email, setEmail] = useState('')           // signup only
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [isSignup, setIsSignup] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [showNotice, setShowNotice] = useState(true)
  const [busy, setBusy] = useState(false)
  const quote = useMemo(() => QUOTES[new Date().getDate() % QUOTES.length], [])

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError(''); setInfo(''); setShowNotice(false)
    try {
      if (isSignup) {
        const uname = username.trim()
        if (!/^[A-Za-z0-9_.]{3,20}$/.test(uname)) throw new Error('Username must be 3-20 characters: letters, numbers, _ or .')
        const { data: free, error: e0 } = await supabase.rpc('username_available', { u: uname })
        if (e0) throw e0
        if (!free) throw new Error('That username is taken. Please choose another.')
        const { data, error: e1 } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { data: { username: uname }, emailRedirectTo: `${window.location.origin}/?confirmed=1` },
        })
        if (e1) throw e1
        if (!data.session) setInfo('Almost done! Check your inbox to confirm your email, then log in with your username or email.')
      } else {
        let loginEmail = identity.trim()
        if (!loginEmail.includes('@')) {            // it is a username: find its email
          const { data: found, error: e0 } = await supabase.rpc('email_for_username', { u: loginEmail })
          if (e0) throw e0
          if (!found) throw new Error('Incorrect username/email or password.')
          loginEmail = found
        }
        const { error: e1 } = await supabase.auth.signInWithPassword({ email: loginEmail, password })
        if (e1) throw new Error(/invalid login/i.test(e1.message) ? 'Incorrect username/email or password.' : e1.message)
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    }
    setBusy(false)
  }

  return (
    <div className="login">
      {/* Brand */}
      <section className="l-brand"><div className="l-inner">
        <div className="rise flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo size={40} />
            <span className="text-xl font-bold tracking-tight">Tastemark</span>
          </div>
        </div>
        <h1 className="rise mt-5 text-2xl font-bold leading-tight tracking-tight lg:mt-16 lg:text-5xl" style={{ animationDelay: '80ms' }}>
          Remember every<br className="hidden lg:block" /> great bite.
        </h1>
        <p className="rise mt-3 hidden max-w-md text-base lg:mt-5 lg:block lg:text-lg" style={{ color: 'var(--mute)', animationDelay: '140ms' }}>
          Your private food journal. Save the places you eat, the dishes you loved, what they cost,
          and what you'd order again, then find it all in seconds.
        </p>
        </div>
      </section>

      {/* Form */}
      <section className="l-form">
        <div className="card login-card rise w-full max-w-sm !p-6 sm:!p-7" style={{ animationDelay: '120ms' }}>
          <h2 className="text-2xl font-bold">{isSignup ? 'Create your account' : 'Welcome back'}</h2>
          <p className="mb-6 mt-1 text-sm" style={{ color: 'var(--mute)' }}>
            {isSignup ? 'It takes less than a minute. No card needed.' : 'Log in to open your journal.'}
          </p>
          {notice && showNotice && (
            <p className="fade mb-4 rounded-lg px-3 py-2.5 text-sm" style={{ background: 'var(--okbg)', color: 'var(--ok)' }}>{notice}</p>
          )}
          <form onSubmit={submit} className="space-y-3">
            {isSignup ? (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--mute)' }}>Username</label>
                  <input required autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="e.g. kandarp29"
                    value={username} onChange={e => setUsername(e.target.value.replace(/\s/g, ''))} className="input" maxLength={20} />
                  <p className="mt-1 text-xs" style={{ color: 'var(--mute)' }}>3-20 characters: letters, numbers, _ or .</p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--mute)' }}>Email</label>
                  <input type="email" required autoComplete="email" placeholder="you@example.com" value={email}
                    onChange={e => setEmail(e.target.value)} className="input" />
                </div>
              </>
            ) : (
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--mute)' }}>Username or email</label>
                <input required autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Username or you@example.com"
                  value={identity} onChange={e => setIdentity(e.target.value)} className="input" />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--mute)' }}>Password</label>
              <div className="relative">
                <input type={show ? 'text' : 'password'} required minLength={6}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  placeholder={isSignup ? 'At least 6 characters' : 'Your password'} value={password}
                  onChange={e => setPassword(e.target.value)} className="input !pr-16" />
                <button type="button" onClick={() => setShow(!show)}
                  className="tbtn absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: 'var(--pri)' }}>
                  {show ? 'Hide' : 'Show'}</button>
              </div>
            </div>
            {error && <p className="fade rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--errbg)', color: 'var(--bad)' }}>{error}</p>}
            {info && <p className="fade rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--okbg)', color: 'var(--ok)' }}>{info}</p>}
            <button disabled={busy} className="btn btn-pri w-full !mt-5">
              {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Log in'}</button>
          </form>
          <p className="mt-5 text-center text-sm" style={{ color: 'var(--mute)' }}>
            {isSignup ? 'Already have an account?' : 'New to Tastemark?'}{' '}
            <button onClick={() => { setIsSignup(!isSignup); setError(''); setInfo(''); setPassword('') }}
              className="tbtn font-semibold" style={{ color: 'var(--pri)' }}>{isSignup ? 'Log in' : 'Create an account'}</button>
          </p>
          <p className="mt-4 border-t pt-4 text-center text-xs" style={{ color: 'var(--mute)', borderColor: 'var(--line)' }}>
            🔒 Encrypted connection · Your journal is visible only to you
          </p>
        </div>
      </section>

      {/* Trust + quote */}
      <section className="l-info"><div className="l-inner">
        <ul className="space-y-4">
          {TRUST.map(([icon, title, text], i) => (
            <li key={title} className="rise flex gap-3" style={{ animationDelay: `${200 + i * 70}ms` }}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-base"
                style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>{icon}</span>
              <div>
                <div className="text-sm font-semibold">{title}</div>
                <div className="text-sm" style={{ color: 'var(--mute)' }}>{text}</div>
              </div>
            </li>
          ))}
        </ul>
        <blockquote className="rise mt-8 border-l-2 pl-4" style={{ borderColor: 'var(--pri)', animationDelay: '420ms' }}>
          <p className="text-base italic">“{quote.q}”</p>
          <footer className="mt-1 text-sm" style={{ color: 'var(--mute)' }}>{quote.by}</footer>
        </blockquote>
        </div>
      </section>
    </div>
  )
}
