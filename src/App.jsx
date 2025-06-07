import { useEffect, useState, useRef } from 'react';
import Masonry from 'react-masonry-css';
import { supabase } from './lib/supabase';
import { useFavorites } from './lib/useFavorites';
import Auth from './components/Auth';
import UserProfile from './components/UserProfile';
import Favorites from './components/Favorites';
import './App.css';

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL;

function VideoModal({ video, onClose }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
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
    <div className="video-modal-overlay" onClick={onClose}>
      <div className="video-modal-content" onClick={e => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>×</button>
        <div className="video-controls-sidebar">
          <h2 className="modal-title">{video.title}</h2>
          <button className="download-button" onClick={handleDownload}>
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download
          </button>
        </div>
        <video
          ref={videoRef}
          src={video.url}
          controls
          autoPlay
          loop
          className="modal-video"
        >
          <source src={video.url} type="video/mp4" />
        </video>
      </div>
    </div>
  );
}

function App() {
  const [session, setSession] = useState(null);
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSubreddit, setSelectedSubreddit] = useState('');
  const [availableSubreddits, setAvailableSubreddits] = useState([]);
  const [afterId, setAfterId] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const loadingRef = useRef(null);
  const [playingVideos, setPlayingVideos] = useState(new Set());
  const [clickedVideos, setClickedVideos] = useState(new Set());
  const [loadingVideos, setLoadingVideos] = useState(new Set());
  const videoRefs = useRef({});
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [activeTab, setActiveTab] = useState('gallery');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { favorites, loading: favoritesLoading, addFavorite, removeFavorite, isFavorite } = useFavorites();
  const [consentGiven, setConsentGiven] = useState(() => {
    return localStorage.getItem('reddit-reels-consent') === 'true';
  });

  // Fetch available subreddits on component mount
  useEffect(() => {
    const fetchSubreddits = async () => {
      try {
        const response = await fetch(`${BACKEND_API_URL}/api/subreddits`);
        const data = await response.json();
        setAvailableSubreddits(data.subreddits);
        setSelectedSubreddit(data.subreddits[0]); // Set first subreddit as default
      } catch (err) {
        console.error('Error fetching subreddits:', err);
        setError('Failed to load subreddits');
      }
    };

    fetchSubreddits();
  }, [BACKEND_API_URL]);
  const fetchVideos = async (isNewSubreddit = false) => {
    if (!selectedSubreddit || (!isNewSubreddit && !hasMore)) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`${BACKEND_API_URL}/api/reddit/${selectedSubreddit}${afterId && !isNewSubreddit ? `?after=${afterId}` : ''}`);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();

      // Extract videos from posts
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
          subreddit: selectedSubreddit
        }));

      const newAfterId = data.data.after;
      setAfterId(newAfterId);
      setHasMore(!!newAfterId && vids.length > 0);
      setVideos(prev => isNewSubreddit ? vids : [...prev, ...vids]);
    } catch (err) {
      console.error('Error fetching videos:', err);
      setError('Failed to load videos. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSubreddit) {
      setVideos([]);
      setAfterId(null);
      setHasMore(true);
      fetchVideos(true);
    }
  }, [selectedSubreddit]);  // Intersection Observer setup
  useEffect(() => {
    let currentObserver = null;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && selectedSubreddit) {
          fetchVideos();
        }
      },
      { 
        threshold: 0.1,
        rootMargin: '200px'
      }
    );

    if (loadingRef.current) {
      currentObserver = loadingRef.current;
      observer.observe(loadingRef.current);
    }

    return () => {
      if (currentObserver) {
        observer.unobserve(currentObserver);
      }
    };
  }, [hasMore, isLoading, afterId, selectedSubreddit]);

  const handleSubredditChange = (event) => {
    setSelectedSubreddit(event.target.value);
  };

  const handleVideoMouseEnter = (videoId) => {
    if (!clickedVideos.has(videoId)) {
      setPlayingVideos(prev => new Set([...prev, videoId]));
      videoRefs.current[videoId]?.play().catch(err => console.warn('Playback failed:', err));
    }
  };

  const handleVideoMouseLeave = (videoId) => {
    if (!clickedVideos.has(videoId)) {
      setPlayingVideos(prev => {
        const next = new Set([...prev]);
        next.delete(videoId);
        return next;
      });
      videoRefs.current[videoId]?.pause();
    }
  };

  const handleVideoClick = (video) => {
    setSelectedVideo(video);
  };

  const handleVideoLoadStart = (videoId) => {
    setLoadingVideos(prev => new Set([...prev, videoId]));
  };

  const handleVideoCanPlay = (videoId) => {
    setLoadingVideos(prev => {
      const next = new Set([...prev]);
      next.delete(videoId);
      return next;
    });
  };

  const handleFavoriteClick = async (video) => {
    if (isFavorite(video.id)) {
      await removeFavorite(video.id);
    } else {
      await addFavorite({
        ...video,
        subreddit: selectedSubreddit
      });
    }
  };

  // Reset video states when changing subreddit
  useEffect(() => {
    setPlayingVideos(new Set());
    setClickedVideos(new Set());
  }, [selectedSubreddit]);

  // Authentication effect
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const breakpointColumns = {
    default: 4,
    1440: 3,
    1100: 2,
    700: 1
  };

  if (!session) {
    return <Auth />;
  }

  if (!consentGiven) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(to bottom, #0f0f0f, #1a1a1a)',
        color: '#fff',
        padding: '2rem',
        textAlign: 'center',
      }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem', background: 'linear-gradient(120deg, #646cff, #8f96ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Reddit Reels - Consent Required</h1>
        <p style={{ fontSize: '1.1rem', marginBottom: '2rem', maxWidth: 500 }}>
          This site contains user-generated video content from Reddit, which may include adult or sensitive material. By continuing, you confirm that you are at least 18 years old and consent to viewing such content.
        </p>
        <button
          style={{
            padding: '1rem 2rem',
            borderRadius: 12,
            background: '#646cff',
            color: '#fff',
            fontSize: '1.1rem',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            marginBottom: '1rem',
          }}
          onClick={() => {
            localStorage.setItem('reddit-reels-consent', 'true');
            setConsentGiven(true);
          }}
        >
          I am 18+ and consent
        </button>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.95rem' }}>
          If you do not consent, please close this page.
        </p>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="app-header">
        <div className="header-content">
          <h1>Reddit Reels</h1>
          <nav className="main-nav">
            <button 
              className={`nav-button ${activeTab === 'gallery' ? 'active' : ''}`}
              onClick={() => setActiveTab('gallery')}
            >
              Gallery
            </button>
            <button 
              className={`nav-button ${activeTab === 'favorites' ? 'active' : ''}`}
              onClick={() => setActiveTab('favorites')}
            >
              Favorites
            </button>
            <button 
              className={`nav-button ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              Profile
            </button>
            <button 
              className="sign-out-button" 
              onClick={() => supabase.auth.signOut()}
            >
              Sign Out
            </button>
          </nav>
          {/* Hamburger for mobile */}
          <button
            className={`hamburger${mobileNavOpen ? ' active' : ''}`}
            aria-label="Open navigation menu"
            onClick={() => setMobileNavOpen((open) => !open)}
            style={{ background: 'none', border: 'none', padding: 0 }}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
        {/* Mobile nav overlay */}
        <div className={`mobile-nav${mobileNavOpen ? ' open' : ''}`}
          onClick={() => setMobileNavOpen(false)}
        >
          <button 
            className={`nav-button${activeTab === 'gallery' ? ' active' : ''}`}
            onClick={e => { e.stopPropagation(); setActiveTab('gallery'); setMobileNavOpen(false); }}
          >
            Gallery
          </button>
          <button 
            className={`nav-button${activeTab === 'favorites' ? ' active' : ''}`}
            onClick={e => { e.stopPropagation(); setActiveTab('favorites'); setMobileNavOpen(false); }}
          >
            Favorites
          </button>
          <button 
            className={`nav-button${activeTab === 'profile' ? ' active' : ''}`}
            onClick={e => { e.stopPropagation(); setActiveTab('profile'); setMobileNavOpen(false); }}
          >
            Profile
          </button>
          <button 
            className="sign-out-button"
            onClick={e => { e.stopPropagation(); supabase.auth.signOut(); setMobileNavOpen(false); }}
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="main-content">
        {activeTab === 'gallery' && (
          <>
            <div className="subreddit-selector">
              <div className="select-wrapper">
                <select 
                  value={selectedSubreddit} 
                  onChange={handleSubredditChange}
                  className="subreddit-select"
                >
                  <option value="">Choose Subreddit</option>
                  {availableSubreddits.map(sub => (
                    <option key={sub} value={sub}>r/{sub}</option>
                  ))}
                </select>
                <span className="select-icon">▼</span>
              </div>
            </div>

            {error && (
              <div className="error-container">
                <svg className="error-icon" viewBox="0 0 24 24" width="24" height="24">
                  <path fill="currentColor" d="M12 4c4.4 0 8 3.6 8 8s-3.6 8-8 8-8-3.6-8-8 3.6-8 8-8zm0-2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm1 13h-2v2h2v-2zm0-8h-2v6h2V7z"/>
                </svg>
                <p>{error}</p>
              </div>
            )}

            <Masonry
              breakpointCols={breakpointColumns}
              className="masonry-grid"
              columnClassName="masonry-grid_column"
            >
              {videos.map(vid => (
                <div 
                  key={vid.id} 
                  className={`card ${loadingVideos.has(vid.id) ? 'loading' : ''}`}
                  onMouseEnter={() => handleVideoMouseEnter(vid.id)}
                  onMouseLeave={() => handleVideoMouseLeave(vid.id)}
                >
                  {loadingVideos.has(vid.id) && (
                    <div className="video-loading-overlay">
                      <div className="loading-spinner"></div>
                    </div>
                  )}
                  <div className="card-actions">
                    <button 
                      className={`favorite-button ${isFavorite(vid.id) ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFavoriteClick(vid);
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="24" height="24">
                        <path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                      </svg>
                    </button>
                  </div>
                  <div className="video-container" style={{ position: 'relative', width: '100%' }}>
                    <img
                      src={vid.thumbnail}
                      alt={vid.title}
                      style={{ 
                        width: '100%', 
                        height: '100%',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        objectFit: 'cover'
                      }}
                      onClick={() => handleVideoClick(vid)}
                    />
                    <div className="play-overlay" 
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        color: 'white',
                        fontSize: '48px',
                        opacity: '0.8'
                      }}
                    >
                      ▶
                    </div>
                  </div>
                  <h3 className="video-title">{vid.title}</h3>
                </div>
              ))}
            </Masonry>
              <div ref={loadingRef} className="loading-indicator">
              {isLoading && hasMore && (
                <div className="loading-animation">
                  <div className="loading-dot"></div>
                  <div className="loading-dot"></div>
                  <div className="loading-dot"></div>
                </div>
              )}
              {(!hasMore && videos.length > 0) && (
                <div className="end-message">
                  <span>You've reached the end</span>
                  <div className="end-line"></div>
                </div>
              )}
              {(!isLoading && videos.length === 0) && (
                <div className="empty-message">
                  <span>No videos found</span>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'favorites' && (
          <Favorites 
            videoRefs={videoRefs}
            handleVideoClick={handleVideoClick}
            handleVideoMouseEnter={handleVideoMouseEnter}
            handleVideoMouseLeave={handleVideoMouseLeave}
          />
        )}

        {activeTab === 'profile' && (
          <UserProfile session={session} />
        )}
      </main>

      {selectedVideo && (
        <VideoModal
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
        />
      )}
    </div>
  );
}

export default App;
