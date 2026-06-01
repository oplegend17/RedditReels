import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import Auth from './components/Auth';
import Layout from './components/Layout';
import VideoGallery from './pages/VideoGallery';
import ImageGallery from './pages/ImageGallery';
import Reels from './components/Reels';
import ChallengeMode from './components/ChallengeMode';
import Stats from './pages/Stats';
import Favorites from './components/Favorites';
import UserProfile from './components/UserProfile';
import Females from './pages/Females';
import Admin from './pages/Admin';


function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [consentGiven, setConsentGiven] = useState(() => localStorage.getItem('reddit-reels-consent') === 'true');

  // Firebase Auth & Real-time Profile Listener
  useEffect(() => {
    let unsubscribeProfile = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        // Subscribe to user profile document in Firestore
        const profileRef = doc(db, 'users', currentUser.uid);
        unsubscribeProfile = onSnapshot(profileRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setProfile(data);
            setIsAdmin(data.role === 'admin');
          } else {
            setProfile(null);
            setIsAdmin(false);
          }
          setLoading(false);
        }, (error) => {
          console.error("Error loading user profile:", error);
          setLoading(false);
        });
      } else {
        setProfile(null);
        setIsAdmin(false);
        setLoading(false);
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-12 h-12 border-4 border-neon-pink border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) return <Auth />;

  if (!consentGiven) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-8 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--color-neon-pink)_0%,_transparent_50%)] opacity-10 blur-3xl"></div>
        <div className="relative z-10 glass-panel p-12 rounded-3xl max-w-lg">
          <h1 className="text-5xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-white to-neon-pink text-glow">NSFW Warning</h1>
          <p className="text-xl mb-8 text-neutral-300 leading-relaxed">
            This gallery contains user-generated content that may be NSFW. 
            <br/>By entering, you confirm you are 18+.
          </p>
          <button
            className="px-10 py-4 rounded-full bg-neon-pink hover:bg-red-600 text-white text-lg font-bold shadow-[0_0_20px_rgba(255,47,86,0.4)] hover:shadow-[0_0_40px_rgba(255,47,86,0.6)] hover:scale-105 transition-all duration-300 cursor-pointer"
            onClick={() => {
              localStorage.setItem('reddit-reels-consent', 'true');
              setConsentGiven(true);
            }}
          >
            I Accept & Enter
          </button>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout profile={profile} isAdmin={isAdmin} />}>
          <Route index element={<VideoGallery />} />
          <Route path="images" element={<ImageGallery />} />
          <Route path="reels" element={<Reels />} />
          <Route path="females" element={<Females />} />
          <Route path="challenges" element={<ChallengeMode />} />
          <Route path="challenges/:challengeId" element={<ChallengeMode />} />
          <Route path="stats" element={<Stats />} />
          <Route path="favorites" element={<Favorites />} />
          <Route path="profile" element={<UserProfile user={user} />} />
          <Route path="admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
