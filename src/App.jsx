import { useEffect, useState, useRef } from 'react';
import Masonry from 'react-masonry-css';
import { supabase } from './lib/supabase';
import { useFavorites } from './lib/useFavorites';
import Auth from './components/Auth';
import UserProfile from './components/UserProfile';
import Favorites from './components/Favorites';
import Reels from './components/Reels';
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
  const [showUnder10MB, setShowUnder10MB] = useState(false);
  const [videoSizes, setVideoSizes] = useState({}); // { [videoId]: sizeInBytes }
  const [fetchingSizes, setFetchingSizes] = useState(false);
  const [customSubreddit, setCustomSubreddit] = useState('');
  const [usingCustomSubreddit, setUsingCustomSubreddit] = useState(false);
  const [customAfterId, setCustomAfterId] = useState(null);
  const [customHasMore, setCustomHasMore] = useState(true);
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

  useEffect(() => {
    // Fetch sizes for all videos if the filter is enabled and sizes are missing (only in gallery tab)
    if (activeTab === 'gallery' && showUnder10MB && videos.length > 0) {
      const missing = videos.filter(v => videoSizes[v.id] === undefined);
      if (missing.length > 0) {
        setFetchingSizes(true);
        Promise.all(
          missing.map(async (v) => {
            try {
              const res = await fetch(v.url, { method: 'HEAD' });
              const size = res.headers.get('Content-Length');
              return { id: v.id, size: size ? parseInt(size, 10) : null };
            } catch {
              return { id: v.id, size: null };
            }
          })
        ).then(results => {
          setVideoSizes(prev => {
            const next = { ...prev };
            results.forEach(({ id, size }) => { next[id] = size; });
            return next;
          });
          setFetchingSizes(false);
        });
      }
    }
  }, [showUnder10MB, videos, activeTab]);

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

  const handleDownload = async (video) => {
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

  const fetchFromCustomSubreddit = async (isNew = false) => {
    if (!customSubreddit.trim()) return;
    setIsLoading(true);
    setError(null);
    setUsingCustomSubreddit(true);
    try {
      const after = isNew ? '' : customAfterId;
      const url = `${BACKEND_API_URL}/api/reddit/${customSubreddit.trim()}${after ? `?after=${after}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch subreddit');
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
          subreddit: customSubreddit.trim()
        }));
      const newAfter = data?.data?.after;
      setCustomAfterId(newAfter);
      setCustomHasMore(!!newAfter && vids.length > 0);
      setVideos(prev => isNew ? vids : [...prev, ...vids]);
      if (isNew) setAfterId(null);
    } catch (err) {
      setError('Failed to load videos from subreddit.');
    } finally {
      setIsLoading(false);
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

  // Fetch available subreddits for images on mount
  useEffect(() => {
    const fetchImageSubreddits = async () => {
      try {
        const response = await fetch(`${BACKEND_API_URL}/api/subreddits`);
        const data = await response.json();
        setImageGalleryAvailableSubreddits(data.subreddits);
        setImageGallerySelectedSubreddit(data.subreddits[0]);
      } catch (err) {
        setImageGalleryError('Failed to load subreddits');
      }
    };
    fetchImageSubreddits();
  }, [BACKEND_API_URL]);

  // Fetch images from subreddit
  const fetchImages = async (isNewSubreddit = false) => {
    if (!imageGallerySelectedSubreddit || (!isNewSubreddit && !imageGalleryHasMore)) return;
    try {
      setImageGalleryIsLoading(true);
      setImageGalleryError(null);
      const response = await fetch(`${BACKEND_API_URL}/api/reddit/${imageGallerySelectedSubreddit}${imageGalleryAfterId && !isNewSubreddit ? `?after=${imageGalleryAfterId}` : ''}`);
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const data = await response.json();
      // Extract images from posts
      const imgs = (data?.data?.children || [])
        .map(post => post?.data)
        .filter(p => p?.post_hint === 'image' && p?.url && (p?.url.endsWith('.jpg') || p?.url.endsWith('.png') || p?.url.endsWith('.jpeg') || p?.url.endsWith('.gif')))
        .map(p => ({
          id: p.id,
          title: p.title,
          url: p.url,
          thumbnail: p.thumbnail && p.thumbnail.startsWith('http') ? p.thumbnail : p.url,
          subreddit: imageGallerySelectedSubreddit
        }));
      const newAfterId = data.data.after;
      setImageGalleryAfterId(newAfterId);
      setImageGalleryHasMore(!!newAfterId && imgs.length > 0);
      setImageGalleryImages(prev => isNewSubreddit ? imgs : [...prev, ...imgs]);
    } catch (err) {
      setImageGalleryError('Failed to load images. Please try again later.');
    } finally {
      setImageGalleryIsLoading(false);
    }
  };

  useEffect(() => {
    if (imageGallerySelectedSubreddit) {
      setImageGalleryImages([]);
      setImageGalleryAfterId(null);
      setImageGalleryHasMore(true);
      fetchImages(true);
    }
  }, [imageGallerySelectedSubreddit]);

  // Infinite scroll for image gallery
  useEffect(() => {
    let currentObserver = null;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && imageGalleryHasMore && !imageGalleryIsLoading && imageGallerySelectedSubreddit) {
          fetchImages();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '200px'
      }
    );
    if (imageGalleryLoadingRef.current) {
      currentObserver = imageGalleryLoadingRef.current;
      observer.observe(imageGalleryLoadingRef.current);
    }
    return () => {
      if (currentObserver) {
        observer.unobserve(currentObserver);
      }
    };
  }, [imageGalleryHasMore, imageGalleryIsLoading, imageGalleryAfterId, imageGallerySelectedSubreddit]);

  // Custom subreddit fetch for images
  const fetchImagesFromCustomSubreddit = async (isNew = false) => {
    if (!imageGalleryCustomSubreddit.trim()) return;
    setImageGalleryIsLoading(true);
    setImageGalleryError(null);
    setImageGalleryUsingCustomSubreddit(true);
    try {
      const after = isNew ? '' : imageGalleryCustomAfterId;
      const url = `${BACKEND_API_URL}/api/reddit/${imageGalleryCustomSubreddit.trim()}${after ? `?after=${after}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch subreddit');
      const data = await response.json();
      const imgs = (data?.data?.children || [])
        .map(post => post?.data)
        .filter(p => p?.post_hint === 'image' && p?.url && (p?.url.endsWith('.jpg') || p?.url.endsWith('.png') || p?.url.endsWith('.jpeg') || p?.url.endsWith('.gif')))
        .map(p => ({
          id: p.id,
          title: p.title,
          url: p.url,
          thumbnail: p.thumbnail && p.thumbnail.startsWith('http') ? p.thumbnail : p.url,
          subreddit: imageGalleryCustomSubreddit.trim()
        }));
      const newAfter = data?.data?.after;
      setImageGalleryCustomAfterId(newAfter);
      setImageGalleryCustomHasMore(!!newAfter && imgs.length > 0);
      setImageGalleryImages(prev => isNew ? imgs : [...prev, ...imgs]);
      if (isNew) setImageGalleryAfterId(null);
    } catch (err) {
      setImageGalleryError('Failed to load images from subreddit.');
    } finally {
      setImageGalleryIsLoading(false);
    }
  };

  // Download handler for images
  const handleImageDownload = async (img) => {
    // Helper to sanitize filename
    const sanitize = (str) => str.replace(/[^a-z0-9\-_. ]/gi, '_').slice(0, 80);
    try {
      let blob;
      try {
        const response = await fetch(img.url, { mode: 'cors' });
        blob = await response.blob();
      } catch (err) {
        // CORS error fallback: try no-cors (may not work for all images)
        try {
          const response = await fetch(img.url, { mode: 'no-cors' });
          blob = await response.blob();
        } catch (e) {
          // Fallback to direct link
          window.open(img.url, '_blank');
          return;
        }
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Try to infer extension from url
      const ext = img.url.split('.').pop().split('?')[0];
      a.download = `${sanitize(img.title || 'image')}.${ext}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      // As a last resort, open the image in a new tab
      window.open(img.url, '_blank');
      console.error('Download failed:', error);
    }
  };

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

  const filteredVideos = activeTab === 'gallery' && showUnder10MB
    ? videos.filter(v => videoSizes[v.id] !== undefined && videoSizes[v.id] !== null && videoSizes[v.id] < 10 * 1024 * 1024)
    : videos;

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
              className={`nav-button ${activeTab === 'image-gallery' ? 'active' : ''}`}
              onClick={() => setActiveTab('image-gallery')}
            >
              Image Gallery
            </button>
            <button 
              className={`nav-button ${activeTab === 'reels' ? 'active' : ''}`}
              onClick={() => setActiveTab('reels')}
            >
              Reels
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
            className={`nav-button${activeTab === 'image-gallery' ? ' active' : ''}`}
            onClick={e => { e.stopPropagation(); setActiveTab('image-gallery'); setMobileNavOpen(false); }}
          >
            Image Gallery
          </button>
          <button 
            className={`nav-button${activeTab === 'reels' ? ' active' : ''}`}
            onClick={e => { e.stopPropagation(); setActiveTab('reels'); setMobileNavOpen(false); }}
          >
            Reels
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
                  disabled={usingCustomSubreddit}
                >
                  <option value="">Choose Subreddit</option>
                  {availableSubreddits.map(sub => (
                    <option key={sub} value={sub}>r/{sub}</option>
                  ))}
                </select>
                <span className="select-icon">▼</span>
              </div>
            </div>
            {/* Custom subreddit input */}
            <div style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
              <input
                type="text"
                placeholder="Enter subreddit (no r/)"
                value={customSubreddit}
                onChange={e => setCustomSubreddit(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #646cff', fontSize: 15, width: 180 }}
                onKeyDown={e => { if (e.key === 'Enter') fetchFromCustomSubreddit(true); }}
                disabled={isLoading}
              />
              <button
                onClick={() => fetchFromCustomSubreddit(true)}
                style={{ padding: '8px 16px', borderRadius: 8, background: '#646cff', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: 15 }}
                disabled={isLoading}
              >
                Fetch
              </button>
              {usingCustomSubreddit && (
                <button
                  onClick={() => { setUsingCustomSubreddit(false); setCustomSubreddit(''); setVideos([]); setAfterId(null); setCustomAfterId(null); setCustomHasMore(true); setHasMore(true); setError(null); setIsLoading(true); setSelectedSubreddit(availableSubreddits[0]); }}
                  style={{ padding: '8px 12px', borderRadius: 8, background: '#232347', color: '#fff', border: 'none', fontWeight: 500, cursor: 'pointer', fontSize: 14 }}
                >
                  Reset
                </button>
              )}
            </div>
            {/* Filter Switch UI */}
            <div style={{ margin: '16px 0 8px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ color: '#fff', fontSize: 16, fontWeight: 500, cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={showUnder10MB}
                  onChange={e => setShowUnder10MB(e.target.checked)}
                  style={{ marginRight: 8 }}
                />
                Show only videos under 10MB
              </label>
              {fetchingSizes && (
                <span style={{ color: '#fff', fontSize: 14, marginLeft: 8 }}>Checking sizes...</span>
              )}
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
              {filteredVideos.map(vid => (
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
                    {/* Download button below like button */}
                    <button
                      className="download-button"
                      style={{ marginTop: 8, width: '100%', background: '#232347', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 0', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(vid);
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" style={{ marginRight: 4 }}>
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Download
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
              {isLoading && ((usingCustomSubreddit ? customHasMore : hasMore)) && (
                <div className="loading-animation">
                  <div className="loading-dot"></div>
                  <div className="loading-dot"></div>
                  <div className="loading-dot"></div>
                </div>
              )}
              {(!(usingCustomSubreddit ? customHasMore : hasMore) && filteredVideos.length > 0) && (
                <div className="end-message">
                  <span>You've reached the end</span>
                  <div className="end-line"></div>
                </div>
              )}
              {(!isLoading && filteredVideos.length === 0) && (
                <div className="empty-message">
                  <span>No videos found</span>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'image-gallery' && (
          <>
            <div className="subreddit-selector">
              <div className="select-wrapper">
                <select 
                  value={imageGallerySelectedSubreddit} 
                  onChange={e => setImageGallerySelectedSubreddit(e.target.value)}
                  className="subreddit-select"
                  disabled={imageGalleryUsingCustomSubreddit}
                >
                  <option value="">Choose Subreddit</option>
                  {imageGalleryAvailableSubreddits.map(sub => (
                    <option key={sub} value={sub}>r/{sub}</option>
                  ))}
                </select>
                <span className="select-icon">▼</span>
              </div>
            </div>
            {/* Custom subreddit input */}
            <div style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
              <input
                type="text"
                placeholder="Enter subreddit (no r/)"
                value={imageGalleryCustomSubreddit}
                onChange={e => setImageGalleryCustomSubreddit(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #646cff', fontSize: 15, width: 180 }}
                onKeyDown={e => { if (e.key === 'Enter') fetchImagesFromCustomSubreddit(true); }}
                disabled={imageGalleryIsLoading}
              />
              <button
                onClick={() => fetchImagesFromCustomSubreddit(true)}
                style={{ padding: '8px 16px', borderRadius: 8, background: '#646cff', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: 15 }}
                disabled={imageGalleryIsLoading}
              >
                Fetch
              </button>
              {imageGalleryUsingCustomSubreddit && (
                <button
                  onClick={() => { setImageGalleryUsingCustomSubreddit(false); setImageGalleryCustomSubreddit(''); setImageGalleryImages([]); setImageGalleryAfterId(null); setImageGalleryCustomAfterId(null); setImageGalleryCustomHasMore(true); setImageGalleryHasMore(true); setImageGalleryError(null); setImageGalleryIsLoading(true); setImageGallerySelectedSubreddit(imageGalleryAvailableSubreddits[0]); }}
                  style={{ padding: '8px 12px', borderRadius: 8, background: '#232347', color: '#fff', border: 'none', fontWeight: 500, cursor: 'pointer', fontSize: 14 }}
                >
                  Reset
                </button>
              )}
            </div>
            {imageGalleryError && (
              <div className="error-container">
                <svg className="error-icon" viewBox="0 0 24 24" width="24" height="24">
                  <path fill="currentColor" d="M12 4c4.4 0 8 3.6 8 8s-3.6 8-8 8-8-3.6-8-8 3.6-8 8-8zm0-2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm1 13h-2v2h2v-2zm0-8h-2v6h2V7z"/>
                </svg>
                <p>{imageGalleryError}</p>
              </div>
            )}
            <Masonry
              breakpointCols={breakpointColumns}
              className="masonry-grid"
              columnClassName="masonry-grid_column"
            >
              {imageGalleryImages.map(img => (
                <div key={img.id} className="card">
                  <div className="image-container" style={{ position: 'relative', width: '100%' }}>
                    <img
                      src={img.url}
                      alt={img.title}
                      style={{ 
                        width: '100%', 
                        height: '100%',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        objectFit: 'cover'
                      }}
                      onClick={() => handleImageDownload(img)}
                    />
                  </div>
                  <div className="card-actions">
                    <button
                      className="download-button"
                      style={{ marginTop: 8, width: '100%', background: '#232347', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 0', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                      onClick={e => {
                        e.stopPropagation();
                        handleImageDownload(img);
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" style={{ marginRight: 4 }}>
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Download
                    </button>
                  </div>
                  <h3 className="video-title">{img.title}</h3>
                </div>
              ))}
            </Masonry>
            <div ref={imageGalleryLoadingRef} className="loading-indicator">
              {imageGalleryIsLoading && ((imageGalleryUsingCustomSubreddit ? imageGalleryCustomHasMore : imageGalleryHasMore)) && (
                <div className="loading-animation">
                  <div className="loading-dot"></div>
                  <div className="loading-dot"></div>
                  <div className="loading-dot"></div>
                </div>
              )}
              {(!(imageGalleryUsingCustomSubreddit ? imageGalleryCustomHasMore : imageGalleryHasMore) && imageGalleryImages.length > 0) && (
                <div className="end-message">
                  <span>You've reached the end</span>
                  <div className="end-line"></div>
                </div>
              )}
              {(!imageGalleryIsLoading && imageGalleryImages.length === 0) && (
                <div className="empty-message">
                  <span>No images found</span>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'reels' && (
          <Reels availableSubreddits={availableSubreddits} />
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
