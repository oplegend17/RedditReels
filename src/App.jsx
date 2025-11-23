import { useEffect, useState, useRef } from 'react';
import Masonry from 'react-masonry-css';
import { auth } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useFavorites } from './lib/useFavorites';
import Auth from './components/Auth';
import UserProfile from './components/UserProfile';
import Favorites from './components/Favorites';
import Reels from './components/Reels';
import { LazyVideo, LazyImage } from './components/LazyMedia';
import { MOODS } from './lib/subreddits';
import ChallengeMode from './components/ChallengeMode';
import Leaderboard from './components/Leaderboard';
import { AchievementGallery } from './components/AchievementSystem';
import { useAchievements } from './lib/useAchievements';

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL;

function VideoModal({ video, onClose }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    videoRef.current?.play();
  }, []);

  const handleDownload = async () => {
    try {
      const response = await fetch(video.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${video.title}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}>
      <div className="relative flex flex-col md:flex-row gap-8 max-w-[95vw] max-h-[90vh] p-4 md:p-8 bg-black/40 border border-white/10 rounded-3xl backdrop-blur-xl shadow-2xl animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
        <button 
          className="absolute -top-4 -right-4 md:top-4 md:right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 hover:rotate-90 transition-all duration-300 z-50 backdrop-blur-md" 
          onClick={onClose}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        
        <div className="order-2 md:order-1 w-full md:w-80 flex flex-col gap-6 h-fit self-center">
          <h2 className="text-2xl font-bold text-white leading-tight text-glow">{video.title}</h2>
          <div className="flex flex-col gap-4 mt-auto">
             <button 
              className="flex items-center justify-center gap-3 px-6 py-4 bg-neon-pink hover:bg-red-600 text-white rounded-xl font-bold shadow-[0_0_20px_rgba(255,47,86,0.3)] hover:shadow-[0_0_30px_rgba(255,47,86,0.5)] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer" 
              onClick={handleDownload}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download Video
            </button>
          </div>
        </div>

        <div className="order-1 md:order-2 relative rounded-2xl overflow-hidden shadow-2xl shadow-black/50 border border-white/5">
          <video
            ref={videoRef}
            src={video.url}
            controls
            autoPlay
            loop
            className="max-h-[50vh] md:max-h-[80vh] w-auto object-contain bg-black"
          >
            <source src={video.url} type="video/mp4" />
          </video>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSubreddit, setSelectedSubreddit] = useState('');
  const [availableSubreddits, setAvailableSubreddits] = useState([]);
  const [afterId, setAfterId] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const loadingRef = useRef(null);
  const [playingVideoId, setPlayingVideoId] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [activeTab, setActiveTab] = useState('gallery');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { favorites, addFavorite, removeFavorite, isFavorite } = useFavorites();
  const [consentGiven, setConsentGiven] = useState(() => localStorage.getItem('reddit-reels-consent') === 'true');
  const [customSubreddit, setCustomSubreddit] = useState('');
  const [usingCustomSubreddit, setUsingCustomSubreddit] = useState(false);
  const [customAfterId, setCustomAfterId] = useState(null);
  const [customHasMore, setCustomHasMore] = useState(true);
  const [selectedMood, setSelectedMood] = useState(null);
  
  // Achievement & Challenge state
  const achievements = useAchievements();
  
  // Immersive Scroll State
  const [showNav, setShowNav] = useState(true);
  const lastScrollY = useRef(0);

  // Image Gallery State
  const [imageGalleryImages, setImageGalleryImages] = useState([]);
  const [imageGalleryIsLoading, setImageGalleryIsLoading] = useState(false);
  const [imageGalleryError, setImageGalleryError] = useState(null);
  const [imageGallerySelectedSubreddit, setImageGallerySelectedSubreddit] = useState('');
  const [imageGalleryAvailableSubreddits, setImageGalleryAvailableSubreddits] = useState([]);
  const [imageGalleryAfterId, setImageGalleryAfterId] = useState(null);
  const [imageGalleryHasMore, setImageGalleryHasMore] = useState(true);
  const imageGalleryLoadingRef = useRef(null);
  const [imageGalleryCustomSubreddit, setImageGalleryCustomSubreddit] = useState('');
  const [imageGalleryUsingCustomSubreddit, setImageGalleryUsingCustomSubreddit] = useState(false);
  const [imageGalleryCustomAfterId, setImageGalleryCustomAfterId] = useState(null);
  const [imageGalleryCustomHasMore, setImageGalleryCustomHasMore] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        setShowNav(false);
      } else {
        setShowNav(true);
      }
      
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const fetchSubreddits = async () => {
      try {
        const response = await fetch(`${BACKEND_API_URL}/api/subreddits`);
        const data = await response.json();
        setAvailableSubreddits(data.subreddits);
        setImageGalleryAvailableSubreddits(data.subreddits);
        setSelectedSubreddit(data.subreddits[0]);
        setImageGallerySelectedSubreddit(data.subreddits[0]);
      } catch (err) {
        console.error('Error fetching subreddits:', err);
        setError('Failed to load subreddits');
      }
    };
    fetchSubreddits();
  }, []);

  const calculateHeat = (ups, created) => {
    // Simple heuristic: ups relative to others in batch + recency
    // Since we don't have batch stats easily, we'll just use raw ups thresholds for now
    // In a real app, you'd normalize this against the subreddit's average
    if (ups > 5000) return 'nuclear';
    if (ups > 1000) return 'fire';
    if (ups > 500) return 'spicy';
    return null;
  };

  const fetchVideos = async (isNewSubreddit = false) => {
    const isCustom = usingCustomSubreddit;
    const isMood = !!selectedMood;
    
    let sub = selectedSubreddit;
    if (isCustom) sub = customSubreddit.trim();
    if (isMood) sub = selectedMood.subreddits.join('+');

    const after = (isCustom || isMood) ? (isNewSubreddit ? '' : customAfterId) : (isNewSubreddit ? '' : afterId);
    const hasMoreCheck = (isCustom || isMood) ? (isNewSubreddit || customHasMore) : (isNewSubreddit || hasMore);

    if (!sub || !hasMoreCheck) return;

    try {
      setIsLoading(true);
      setError(null);
      const url = `${BACKEND_API_URL}/api/reddit/${sub}${after ? `?after=${after}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      
      const vids = (data?.data?.children || [])
        .map(post => post?.data)
        .filter(p => 
          (p?.is_video && p?.media?.reddit_video?.fallback_url) ||
          (p?.preview?.reddit_video_preview?.fallback_url)
        )
        .map(p => ({
          id: p.id,
          title: p.title,
          url: p?.media?.reddit_video?.fallback_url || p?.preview?.reddit_video_preview?.fallback_url,
          thumbnail: p?.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, '&') || '',
          subreddit: p.subreddit,
          heat: calculateHeat(p.ups, p.created_utc)
        }));

      const newAfter = data?.data?.after;
      
      if (isCustom || isMood) {
        setCustomAfterId(newAfter);
        setCustomHasMore(!!newAfter && vids.length > 0);
      } else {
        setAfterId(newAfter);
        setHasMore(!!newAfter && vids.length > 0);
      }
      
      setVideos(prev => isNewSubreddit ? vids : [...prev, ...vids]);
    } catch (err) {
      setError('Failed to load videos.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchImages = async (isNewSubreddit = false) => {
    const isCustom = imageGalleryUsingCustomSubreddit;
    const sub = isCustom ? imageGalleryCustomSubreddit.trim() : imageGallerySelectedSubreddit;
    const after = isCustom ? (isNewSubreddit ? '' : imageGalleryCustomAfterId) : (isNewSubreddit ? '' : imageGalleryAfterId);
    const hasMoreCheck = isCustom ? (isNewSubreddit || imageGalleryCustomHasMore) : (isNewSubreddit || imageGalleryHasMore);

    if (!sub || !hasMoreCheck) return;

    try {
      setImageGalleryIsLoading(true);
      setImageGalleryError(null);
      const url = `${BACKEND_API_URL}/api/reddit/${sub}${after ? `?after=${after}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      
      const imgs = (data?.data?.children || [])
        .map(post => post?.data)
        .filter(p => p?.post_hint === 'image' && p?.url && /\.(jpg|jpeg|png|gif)$/i.test(p.url))
        .map(p => ({
          id: p.id,
          title: p.title,
          url: p.url,
          thumbnail: p.thumbnail?.startsWith('http') ? p.thumbnail : p.url,
          subreddit: p.subreddit
        }));

      const newAfter = data?.data?.after;
      
      if (isCustom) {
        setImageGalleryCustomAfterId(newAfter);
        setImageGalleryCustomHasMore(!!newAfter && imgs.length > 0);
      } else {
        setImageGalleryAfterId(newAfter);
        setImageGalleryHasMore(!!newAfter && imgs.length > 0);
      }
      
      setImageGalleryImages(prev => isNewSubreddit ? imgs : [...prev, ...imgs]);
    } catch (err) {
      setImageGalleryError('Failed to load images.');
    } finally {
      setImageGalleryIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'gallery') {
      if (selectedMood) {
        fetchVideos(true);
      } else if (usingCustomSubreddit) {
        if (customSubreddit) fetchVideos(true);
      } else if (selectedSubreddit) {
        fetchVideos(true);
      }
    }
  }, [selectedSubreddit, usingCustomSubreddit, activeTab, selectedMood]);

  useEffect(() => {
    if (activeTab === 'image-gallery') {
      if (imageGalleryUsingCustomSubreddit) {
        if (imageGalleryCustomSubreddit) fetchImages(true);
      } else if (imageGallerySelectedSubreddit) {
        fetchImages(true);
      }
    }
  }, [imageGallerySelectedSubreddit, imageGalleryUsingCustomSubreddit, activeTab]);

  // Infinite Scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          if (activeTab === 'gallery' && !isLoading) fetchVideos();
          if (activeTab === 'image-gallery' && !imageGalleryIsLoading) fetchImages();
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );
    
    if (activeTab === 'gallery' && loadingRef.current) observer.observe(loadingRef.current);
    if (activeTab === 'image-gallery' && imageGalleryLoadingRef.current) observer.observe(imageGalleryLoadingRef.current);
    
    return () => observer.disconnect();
  }, [isLoading, imageGalleryIsLoading, activeTab, hasMore, customHasMore, imageGalleryHasMore, imageGalleryCustomHasMore]);

  // Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleFavoriteClick = async (e, video) => {
    e.stopPropagation();
    if (isFavorite(video.id)) {
      await removeFavorite(video.id);
    } else {
      await addFavorite({ ...video, subreddit: video.subreddit });
    }
  };

  const handleDownload = async (e, item) => {
    e.stopPropagation();
    try {
      const response = await fetch(item.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${item.title.slice(0, 20)}.${item.url.split('.').pop()}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      window.open(item.url, '_blank');
    }
  };

  const handleMoodSelect = (mood) => {
    setSelectedMood(mood);
    setUsingCustomSubreddit(false);
    setCustomSubreddit('');
    setVideos([]); // Clear videos to force fresh fetch
  };

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

  const breakpointColumns = { default: 4, 1440: 3, 1100: 2, 700: 1 };

  return (
    <div className="min-h-screen text-white pb-20">
      {/* Header */}
      <header 
        className={`fixed top-0 left-0 right-0 z-50 glass-panel border-b-0 rounded-none mb-8 transition-transform duration-300 ${showNav ? 'translate-y-0' : '-translate-y-full'}`}
      >
        <div className="max-w-[1800px] mx-auto px-6 h-20 flex items-center justify-between">
          <h1 className="text-3xl font-black tracking-tighter italic bg-clip-text text-transparent bg-gradient-to-r from-white via-neon-blue to-neon-pink drop-shadow-[0_0_10px_rgba(0,243,255,0.3)]">
            REDDIT REELS
          </h1>
          
          <nav className="hidden md:flex items-center gap-2 bg-black/20 p-1.5 rounded-full border border-white/5 backdrop-blur-md">
            {[
              { 
                id: 'gallery', 
                label: 'Videos', 
                icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              },
              { 
                id: 'image-gallery', 
                label: 'Images', 
                icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              },
              { 
                id: 'reels', 
                label: 'Reels', 
                icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
              },
              { 
                id: 'challenges', 
                label: 'Challenges', 
                icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              },
              { 
                id: 'stats', 
                label: 'Stats', 
                icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              },
              { 
                id: 'favorites', 
                label: 'Favorites', 
                icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
              },
              { 
                id: 'profile', 
                label: 'Profile', 
                icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              }
            ].map(tab => (
              <button 
                key={tab.id}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 cursor-pointer ${
                  activeTab === tab.id 
                    ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)]' 
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          <button 
            className="hidden md:block px-6 py-2.5 rounded-full border border-white/20 text-white font-medium hover:bg-white/10 transition-all cursor-pointer" 
            onClick={() => auth.signOut()}
          >
            Sign Out
          </button>
          
          <button className="md:hidden text-white" onClick={() => setMobileNavOpen(!mobileNavOpen)}>
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
        </div>
      </header>

      {/* Mobile Nav */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center gap-8 md:hidden" onClick={() => setMobileNavOpen(false)}>
          {['gallery', 'image-gallery', 'reels', 'challenges', 'stats', 'favorites', 'profile'].map(tab => (
            <button key={tab} className="text-2xl font-bold capitalize text-white" onClick={() => setActiveTab(tab)}>{tab.replace('-', ' ')}</button>
          ))}
          <button className="text-xl text-red-500 font-bold" onClick={() => auth.signOut()}>Sign Out</button>
        </div>
      )}

      <main className="max-w-[1800px] mx-auto px-4 md:px-8 pt-24">
        {(activeTab === 'gallery' || activeTab === 'image-gallery') && (
          <div 
            className={`flex flex-col gap-6 mb-12 sticky top-24 z-30 pointer-events-none transition-all duration-300 ${showNav ? 'translate-y-0 opacity-100' : '-translate-y-20 opacity-0'}`}
          >
            {/* Mood Selector */}
            {activeTab === 'gallery' && (
              <div className="pointer-events-auto flex gap-3 overflow-x-auto pb-4 no-scrollbar max-w-full mx-auto">
                {MOODS.map(mood => (
                  <button
                    key={mood.id}
                    onClick={() => handleMoodSelect(mood)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-300 border ${
                      selectedMood?.id === mood.id
                        ? 'bg-neon-pink text-white border-neon-pink shadow-[0_0_15px_rgba(255,47,86,0.4)] scale-105'
                        : 'bg-black/60 text-neutral-400 border-white/10 hover:bg-white/10 hover:text-white backdrop-blur-xl'
                    }`}
                  >
                    <span>{mood.icon}</span>
                    <span>{mood.label}</span>
                  </button>
                ))}
                <button
                  onClick={() => { setSelectedMood(null); setUsingCustomSubreddit(false); setVideos([]); }}
                  className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-300 border ${
                    !selectedMood && !usingCustomSubreddit
                      ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.3)]'
                      : 'bg-black/60 text-neutral-400 border-white/10 hover:bg-white/10 hover:text-white backdrop-blur-xl'
                  }`}
                >
                  All
                </button>
              </div>
            )}

            <div className="pointer-events-auto flex gap-4 bg-black/60 backdrop-blur-xl p-2 rounded-2xl border border-white/10 shadow-2xl mx-auto w-fit">
              <select 
                value={activeTab === 'gallery' ? (usingCustomSubreddit ? '' : selectedSubreddit) : (imageGalleryUsingCustomSubreddit ? '' : imageGallerySelectedSubreddit)}
                onChange={(e) => {
                  if (activeTab === 'gallery') {
                    setUsingCustomSubreddit(false);
                    setSelectedMood(null);
                    setSelectedSubreddit(e.target.value);
                  } else {
                    setImageGalleryUsingCustomSubreddit(false);
                    setImageGallerySelectedSubreddit(e.target.value);
                  }
                }}
                className="bg-transparent text-white font-bold px-4 py-2 outline-none cursor-pointer"
              >
                <option value="" className="bg-black">Select Subreddit</option>
                {availableSubreddits.map(sub => (
                  <option key={sub} value={sub} className="bg-black">r/{sub}</option>
                ))}
              </select>
              
              <div className="w-px bg-white/20"></div>

              <input
                type="text"
                placeholder="Custom r/..."
                value={activeTab === 'gallery' ? customSubreddit : imageGalleryCustomSubreddit}
                onChange={(e) => activeTab === 'gallery' ? setCustomSubreddit(e.target.value) : setImageGalleryCustomSubreddit(e.target.value)}
                className="bg-transparent text-white px-4 py-2 outline-none w-32 focus:w-48 transition-all"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (activeTab === 'gallery') {
                      setUsingCustomSubreddit(true);
                      setSelectedMood(null);
                      fetchVideos(true);
                    } else {
                      setImageGalleryUsingCustomSubreddit(true);
                      fetchImages(true);
                    }
                  }
                }}
              />
              
              <button 
                onClick={() => {
                   if (activeTab === 'gallery') {
                      setUsingCustomSubreddit(true);
                      setSelectedMood(null);
                      fetchVideos(true);
                    } else {
                      setImageGalleryUsingCustomSubreddit(true);
                      fetchImages(true);
                    }
                }}
                className="bg-white/10 hover:bg-white/20 px-4 rounded-xl text-sm font-bold transition-colors cursor-pointer"
              >
                GO
              </button>
            </div>
          </div>
        )}

        {activeTab === 'gallery' && (
          <>
            <Masonry breakpointCols={breakpointColumns} className="flex w-auto -ml-6" columnClassName="pl-6 bg-clip-padding">
              {videos.map(vid => (
                <div 
                  key={vid.id} 
                  className="group relative mb-6 bg-dark-card rounded-2xl overflow-hidden border border-white/5 shadow-lg transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_10px_40px_rgba(0,0,0,0.5)] hover:border-white/20 cursor-pointer"
                  onMouseEnter={() => setPlayingVideoId(vid.id)}
                  onMouseLeave={() => setPlayingVideoId(null)}
                  onClick={() => setSelectedVideo(vid)}
                >
                  <div className="relative aspect-[9/16] bg-black">
                    <LazyVideo 
                      src={vid.url}
                      poster={vid.thumbnail}
                      isPlaying={playingVideoId === vid.id}
                      title={vid.title}
                      isLiked={isFavorite(vid.id)}
                      onToggleLike={(e) => handleFavoriteClick(e, vid)}
                      onDownload={(e) => handleDownload(e, vid)}
                      className="w-full h-full"
                      heat={vid.heat}
                    />
                  </div>
                </div>
              ))}
            </Masonry>
            <div ref={loadingRef} className="h-20 flex items-center justify-center">
              {isLoading && <div className="w-8 h-8 border-4 border-neon-pink border-t-transparent rounded-full animate-spin"></div>}
            </div>
          </>
        )}

        {activeTab === 'image-gallery' && (
          <>
            <Masonry breakpointCols={breakpointColumns} className="flex w-auto -ml-6" columnClassName="pl-6 bg-clip-padding">
              {imageGalleryImages.map(img => (
                <div 
                  key={img.id} 
                  className="group relative mb-6 bg-dark-card rounded-2xl overflow-hidden border border-white/5 shadow-lg transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_10px_40px_rgba(0,0,0,0.5)] hover:border-white/20"
                >
                  <div className="relative">
                    <LazyImage
                      src={img.url}
                      alt={img.title}
                      onDownload={(e) => handleDownload(e, img)}
                    />
                  </div>
                </div>
              ))}
            </Masonry>
            <div ref={imageGalleryLoadingRef} className="h-20 flex items-center justify-center">
              {imageGalleryIsLoading && <div className="w-8 h-8 border-4 border-neon-blue border-t-transparent rounded-full animate-spin"></div>}
            </div>
          </>
        )}

        {activeTab === 'reels' && <Reels />}
        {activeTab === 'challenges' && <ChallengeMode />}
        {activeTab === 'stats' && (
          <div className="space-y-8">
            <Leaderboard currentStats={achievements.stats} />
            <AchievementGallery 
              achievements={achievements.allAchievements}
              unlockedIds={achievements.unlockedAchievements}
              stats={achievements.stats}
              getProgress={achievements.getProgress}
            />
          </div>
        )}
        {activeTab === 'favorites' && <Favorites />}
        {activeTab === 'profile' && <UserProfile user={user} />}
      </main>

      {selectedVideo && <VideoModal video={selectedVideo} onClose={() => setSelectedVideo(null)} />}
    </div>
  );
}

export default App;
