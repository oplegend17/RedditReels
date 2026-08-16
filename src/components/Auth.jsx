import { useState } from 'react';
import { auth, db } from '../lib/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  updateProfile 
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

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
            displayName: username.trim()
          });
        }

        // Create user profile in Firestore
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          username: username.trim() || email.split('@')[0],
          email: email.trim(),
          role: 'user',
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
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
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <div className="w-full max-w-md p-6 sm:p-8 bg-[#15171e] border border-white/10 rounded-xl shadow-xl relative z-10">
        <div className="text-center mb-8">
          <div className="w-10 h-10 rounded-lg bg-neon-pink text-white font-black flex items-center justify-center text-sm mx-auto mb-3">
            RR
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-1">
            {isSignUp ? 'Create an Account' : 'Welcome Back'}
          </h1>
          <p className="text-white/40 text-xs font-medium">
            {isSignUp ? 'Create your account to start watching' : 'Sign in to continue your session'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-white/60 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-lg text-white text-xs placeholder-white/30 focus:outline-none focus:border-white/30 transition-all"
                placeholder="name@example.com"
              />
            </div>

            {isSignUp && (
              <div>
                <label className="block text-xs font-semibold text-white/60 mb-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-lg text-white text-xs placeholder-white/30 focus:outline-none focus:border-white/30 transition-all"
                  placeholder="Choose a username"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-white/60 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 pr-14 bg-black/40 border border-white/10 rounded-lg text-white text-xs placeholder-white/30 focus:outline-none focus:border-white/30 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs font-semibold"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-950/80 border border-red-500/30 rounded-lg text-red-200 text-xs font-medium text-center">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-500/30 rounded-lg text-emerald-200 text-xs font-medium text-center">
              {successMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-neon-pink hover:bg-neon-pink/80 text-white rounded-lg font-bold text-xs transition-all cursor-pointer disabled:opacity-50 mt-2"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Processing...</span>
              </div>
            ) : (
              isSignUp ? 'Create Account' : 'Sign In'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className="text-white/50 hover:text-white text-xs font-medium transition-colors"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
}
