import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Auth() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [username, setUsername] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const handleAuth = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    try {
      setLoading(true)
      if (isSignUp) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
        })
        if (authError) throw authError
        setSuccessMsg('Sign up successful! Please check your email to verify your account before logging in.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
      }
    } catch (error) {
      setErrorMsg(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(120deg, #232526, #414345)' }}>
      <div className="auth-box" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.25)', borderRadius: 18, background: 'rgba(255,255,255,0.07)', padding: '2.5rem 2rem', maxWidth: 400, width: '100%' }}>
        <h2 style={{ textAlign: 'center', fontSize: '2rem', marginBottom: '1.5rem', background: 'linear-gradient(120deg, #646cff, #8f96ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{isSignUp ? 'Create Account' : 'Sign In'}</h2>
        {successMsg && <div style={{ color: '#4BB543', background: 'rgba(75,181,67,0.08)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: 16, textAlign: 'center' }}>{successMsg}</div>}
        {errorMsg && <div style={{ color: '#ff6b6b', background: 'rgba(255,107,107,0.08)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: 16, textAlign: 'center' }}>{errorMsg}</div>}
        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor="email" style={{ color: '#bfc7d5', fontSize: '1rem', marginBottom: 2 }}>Email</label>
            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ padding: '12px 16px', borderRadius: 8, border: '1px solid #646cff33', background: 'rgba(255,255,255,0.12)', color: '#fff', fontSize: '1rem', outline: 'none', transition: 'border 0.2s' }}
            />
          </div>
          {isSignUp && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor="username" style={{ color: '#bfc7d5', fontSize: '1rem', marginBottom: 2 }}>Username</label>
              <input
                id="username"
                type="text"
                placeholder="Choose a username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ padding: '12px 16px', borderRadius: 8, border: '1px solid #646cff33', background: 'rgba(255,255,255,0.12)', color: '#fff', fontSize: '1rem', outline: 'none', transition: 'border 0.2s' }}
              />
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
            <label htmlFor="password" style={{ color: '#bfc7d5', fontSize: '1rem', marginBottom: 2 }}>Password</label>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ padding: '12px 16px', borderRadius: 8, border: '1px solid #646cff33', background: 'rgba(255,255,255,0.12)', color: '#fff', fontSize: '1rem', outline: 'none', transition: 'border 0.2s' }}
            />
            <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: 12, top: 36, background: 'none', border: 'none', color: '#646cff', cursor: 'pointer', fontSize: 14 }}>
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <button type="submit" disabled={loading} style={{ padding: '12px', borderRadius: 8, border: 'none', background: '#646cff', color: '#fff', fontSize: '1.1rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 8, transition: 'background 0.2s' }}>
            {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>
        <button 
          className="toggle-auth"
          style={{ marginTop: 18, background: 'none', border: 'none', color: '#bfc7d5', fontSize: '1rem', cursor: 'pointer', textAlign: 'center', textDecoration: 'underline', transition: 'color 0.2s' }}
          onClick={() => { setIsSignUp(!isSignUp); setErrorMsg(''); setSuccessMsg(''); }}
        >
          {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
        </button>
        {isSignUp && (
          <div style={{ marginTop: 18, color: '#ffb347', background: 'rgba(255,179,71,0.08)', borderRadius: 8, padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.98rem' }}>
            After signing up, you must verify your email before you can log in.<br />Check your inbox (and spam folder) for a verification email from Supabase.
          </div>
        )}
      </div>
    </div>
  )
}
