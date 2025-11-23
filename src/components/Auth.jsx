import { useState } from 'react';
import { auth } from '../lib/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  updateProfile 
} from 'firebase/auth';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    try {
      setLoading(true);
      if (isSignUp) {
        // Create user with Firebase
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        // Update profile with username if provided
        if (username) {
          await updateProfile(userCredential.user, {
            displayName: username
          });
        }
        
        setSuccessMsg('Sign up successful! Welcome to Reddit Reels!');
      } else {
        // Sign in with Firebase
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      // Firebase error handling
      let message = error.message;
      if (error.code === 'auth/email-already-in-use') {
        message = 'This email is already registered. Please sign in.';
      } else if (error.code === 'auth/weak-password') {
        message = 'Password should be at least 6 characters long.';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Invalid email address.';
      } else if (error.code === 'auth/user-not-found') {
        message = 'No account found with this email.';
      } else if (error.code === 'auth/wrong-password') {
        message = 'Incorrect password.';
      } else if (error.code === 'auth/invalid-credential') {
        message = 'Invalid credentials. Please check your email and password.';
      }
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-neon-pink/20 rounded-full blur-[120px] opacity-30 animate-pulse"></div>
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-neon-blue/10 rounded-full blur-[100px] opacity-20"></div>

      <div className="w-full max-w-md p-8 md:p-10 glass-panel rounded-3xl relative z-10 animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-neon-blue to-neon-pink mb-2 drop-shadow-lg">
            {isSignUp ? 'JOIN THE CLUB' : 'WELCOME BACK'}
          </h1>
          <p className="text-neutral-400 font-medium">
            {isSignUp ? 'Create your account to start watching' : 'Sign in to continue your session'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-6">
          <div className="space-y-4">
            <div className="group">
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5 ml-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-5 py-4 bg-black/40 border border-white/10 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue/50 transition-all duration-300"
                placeholder="name@example.com"
              />
            </div>

            {isSignUp && (
              <div className="group animate-in slide-in-from-top-2 fade-in">
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5 ml-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-5 py-4 bg-black/40 border border-white/10 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue/50 transition-all duration-300"
                  placeholder="Choose a username"
                />
              </div>
            )}

            <div className="group relative">
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5 ml-1">Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-5 py-4 bg-black/40 border border-white/10 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue/50 transition-all duration-300"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-[38px] text-neutral-500 hover:text-white text-sm font-medium transition-colors"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-200 text-sm font-medium text-center animate-in slide-in-from-top-2">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-200 text-sm font-medium text-center animate-in slide-in-from-top-2">
              {successMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-neon-pink hover:bg-red-600 text-white rounded-xl font-bold text-lg shadow-[0_0_20px_rgba(255,47,86,0.3)] hover:shadow-[0_0_30px_rgba(255,47,86,0.5)] hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 mt-4"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Processing...</span>
              </div>
            ) : (
              isSignUp ? 'Create Account' : 'Sign In'
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className="text-neutral-400 hover:text-white text-sm font-medium transition-colors duration-300 underline decoration-neutral-700 underline-offset-4 hover:decoration-white"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
}
