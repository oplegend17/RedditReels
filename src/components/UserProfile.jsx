import { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function UserProfile({ user }) {
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (user) getProfile();
  }, [user]);

  const getProfile = async () => {
    try {
      setLoading(true);
      
      // Try to load from Firestore
      const profileRef = doc(db, 'users', user.uid);
      const profileSnap = await getDoc(profileRef);

      if (profileSnap.exists()) {
        const data = profileSnap.data();
        setUsername(data.username || user.displayName);
        setAvatarUrl(data.avatarUrl || user.photoURL);
      } else {
        // Create default profile
        const defaultUsername = user.displayName || user.email.split('@')[0];
        await setDoc(profileRef, {
          username: defaultUsername,
          avatarUrl: user.photoURL || null,
          email: user.email,
          createdAt: new Date() 
        });
        setUsername(defaultUsername);
        setAvatarUrl(user.photoURL);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateUserProfile = async (e) => {
    e.preventDefault();
    try {
      setUpdating(true);

      if (!username?.trim()) throw new Error('Username cannot be empty');

      // Update Firebase Auth profile
      await updateProfile(auth.currentUser, {
        displayName: username.trim(),
        photoURL: avatarUrl?.trim() || null
      });

      // Update Firestore profile
      const profileRef = doc(db, 'users', user.uid);
      await setDoc(profileRef, {
        username: username.trim(),
        avatarUrl: avatarUrl?.trim() || null,
        email: user.email,
        updatedAt: new Date()
      }, { merge: true });

      alert('Profile updated successfully!');
    } catch (error) {
      alert(error.message || 'Error updating profile!');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-10 h-10 border-4 border-neon-pink border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-8 md:p-12 glass-panel rounded-3xl animate-in fade-in slide-in-from-bottom-4 duration-500 relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-neon-blue/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-neon-pink/10 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>

      <h2 className="text-4xl font-black italic tracking-tighter text-center mb-10 text-transparent bg-clip-text bg-gradient-to-r from-white via-neon-blue to-neon-pink drop-shadow-lg relative z-10">
        PROFILE SETTINGS
      </h2>
      
      <form onSubmit={updateUserProfile} className="space-y-8 relative z-10">
        <div className="flex flex-col items-center gap-6">
          <div className="relative group">
            <div className="w-40 h-40 rounded-full overflow-hidden border-4 border-white/10 group-hover:border-neon-pink transition-all duration-300 shadow-[0_0_30px_rgba(0,0,0,0.5)] group-hover:shadow-[0_0_30px_rgba(255,47,86,0.3)]">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-black/40 flex items-center justify-center text-5xl font-bold text-neutral-600 group-hover:text-neon-pink transition-colors">
                  {username ? username[0].toUpperCase() : '?'}
                </div>
              )}
            </div>
          </div>
          <div className="text-center">
            <p className="text-neutral-400 font-mono text-sm tracking-wider">{user.email}</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="username" className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Username</label>
            <input
              id="username"
              type="text"
              value={username || ''}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-6 py-4 bg-black/40 border border-white/10 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue/50 transition-all duration-300 font-medium"
              placeholder="Enter username"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="avatar" className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Avatar URL</label>
            <input
              id="avatar"
              type="url"
              value={avatarUrl || ''}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className="w-full px-6 py-4 bg-black/40 border border-white/10 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue/50 transition-all duration-300 font-mono text-sm"
              placeholder="https://example.com/image.jpg"
            />
          </div>

          <button
            type="submit"
            disabled={updating}
            className="w-full py-4 bg-neon-pink hover:bg-red-600 text-white rounded-xl font-bold text-lg shadow-[0_0_20px_rgba(255,47,86,0.3)] hover:shadow-[0_0_30px_rgba(255,47,86,0.5)] hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
          >
            {updating ? 'SAVING...' : 'UPDATE PROFILE'}
          </button>
        </div>
      </form>
    </div>
  );
}
