import { useEffect, useState, useRef } from 'react';
import { useFavorites } from '../lib/useFavorites';

export default function Reels({ availableSubreddits }) {
  const [videos, setVideos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [seen, setSeen] = useState(new Set());
  const [transitioning, setTransitioning] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const lastFetchLength = useRef(0);
  const lastScrollTime = useRef(0);
  const videoRef = useRef(null);
  const touchStartY = useRef(null);
  const { favorites, addFavorite, removeFavorite, isFavorite } = useFavorites();
  const [heartAnimate, setHeartAnimate] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [fadeIn, setFadeIn] = useState(true);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showUnder10MB, setShowUnder10MB] = useState(false);
  const [videoSizes, setVideoSizes] = useState({});
  const [fetchingSizes, setFetchingSizes] = useState(false);
  const [customSubreddit, setCustomSubreddit] = useState('');
  const [usingCustomSubreddit, setUsingCustomSubreddit] = useState(false);

  const fetchRandomReels = async () => {
    setLoadingMore(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_API_URL}/api/reels/random`);
      const data = await res.json();
      if (data?.reels?.length) {
        setVideos(prev => {
          const ids = new Set(prev.map(v => v.id));
          const newReels = data.reels.filter(v => !ids.has(v.id));
          return [...prev, ...newReels];
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMore(false);
    }
  };

  const fetchFromCustomSubreddit = async () => {
    if (!customSubreddit.trim()) return;
    setLoading(true);
    setError(null);
    setUsingCustomSubreddit(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_API_URL}/api/reddit/${customSubreddit.trim()}`);
      const data = await res.json();
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
      setVideos(vids);
      setCurrentIndex(0);
    } catch (err) {
      setError('Failed to load reels from subreddit.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchInitial = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${import.meta.env.VITE_BACKEND_API_URL}/api/reels/random`);
        const data = await res.json();
        setVideos(data?.reels || []);
        setCurrentIndex(0);
      } catch (err) {
        setError('Failed to load reels.');
      } finally {
        setLoading(false);
      }
    };
    fetchInitial();
  }, [availableSubreddits]);

  useEffect(() => {
    if (!loadingMore && videos.length > 0 && currentIndex === videos.length - 3 && lastFetchLength.current !== videos.length) {
      fetchRandomReels();
      lastFetchLength.current = videos.length;
    }
  }, [currentIndex, videos, loadingMore]);

  useEffect(() => {
    const handleWheel = (e) => {
      const now = Date.now();
      if (transitioning || now - lastScrollTime.current < 400) return;
      if (e.deltaY > 40 && currentIndex < videos.length - 1) {
        setTransitioning(true);
        setTimeout(() => {
          setSeen(prev => new Set(prev).add(videos[currentIndex]?.id));
          setCurrentIndex(idx => Math.min(idx + 1, videos.length - 1));
          setTransitioning(false);
        }, 250);
        lastScrollTime.current = now;
      } else if (e.deltaY < -40 && currentIndex > 0) {
        setTransitioning(true);
        setTimeout(() => {
          setCurrentIndex(idx => Math.max(idx - 1, 0));
          setTransitioning(false);
        }, 250);
        lastScrollTime.current = now;
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [currentIndex, videos, transitioning]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [currentIndex]);

  const handleTouchStart = (e) => {
    touchStartY.current = e.touches ? e.touches[0].clientY : e.clientY;
  };
  
  const handleTouchEnd = (e) => {
    if (transitioning) return;
    const endY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
    const diff = endY - touchStartY.current;
    if (Math.abs(diff) > 60) {
      if (diff < 0 && currentIndex < videos.length - 1) {
        setTransitioning(true);
        setTimeout(() => {
          setSeen(prev => new Set(prev).add(videos[currentIndex]?.id));
          setCurrentIndex(idx => Math.min(idx + 1, videos.length - 1));
          setTransitioning(false);
        }, 250);
      } else if (diff > 0 && currentIndex > 0) {
        setTransitioning(true);
        setTimeout(() => {
          setCurrentIndex(idx => Math.max(idx - 1, 0));
          setTransitioning(false);
        }, 250);
      }
    }
  };

  const handleLike = async (video) => {
    setHeartAnimate(true);
    setTimeout(() => setHeartAnimate(false), 350);
    if (isFavorite(video.id)) {
      await removeFavorite(video.id);
    } else {
      await addFavorite({ ...video, subreddit: video.subreddit });
    }
  };

  const handleVideoEnded = () => {
    if (currentIndex < videos.length - 1) {
      setTransitioning(true);
      setTimeout(() => {
        setSeen(prev => new Set(prev).add(videos[currentIndex]?.id));
        setCurrentIndex(idx => Math.min(idx + 1, videos.length - 1));
        setTransitioning(false);
      }, 250);
    }
  };

  useEffect(() => {
    const hideHint = () => setShowHint(false);
    window.addEventListener('wheel', hideHint);
    window.addEventListener('touchstart', hideHint);
    window.addEventListener('keydown', hideHint);
    return () => {
      window.removeEventListener('wheel', hideHint);
      window.removeEventListener('touchstart', hideHint);
      window.removeEventListener('keydown', hideHint);
    };
  }, []);

  useEffect(() => {
    setFadeIn(false);
    setTimeout(() => setFadeIn(true), 10);
  }, [currentIndex]);

  useEffect(() => {
    if (showUnder10MB && videos.length > 0) {
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
  }, [showUnder10MB, videos]);

  const filteredVideos = showUnder10MB
    ? videos.filter(v => videoSizes[v.id] !== undefined && videoSizes[v.id] !== null && videoSizes[v.id] < 10 * 1024 * 1024)
    : videos;
  const filteredCurrentIndex = Math.min(currentIndex, filteredVideos.length - 1);
  const filteredVideo = filteredVideos[filteredCurrentIndex] || null;

  if (loading) return <div className="h-[60vh] flex items-center justify-center text-neon-pink font-bold animate-pulse">Loading Reels...</div>;
  if (error) return <div className="text-red-500 text-center mt-20 font-bold">{error}</div>;
  if (!videos.length) return <div className="text-white text-center mt-20 font-bold">No reels found.</div>;

  const video = videos[currentIndex];
  const isSeen = seen.has(video.id);
  const progress = ((currentIndex + 1) / videos.length) * 100;

  return (
    <div 
      className="fixed top-20 left-0 w-screen h-[calc(100vh-80px)] bg-black flex flex-col items-center justify-center overflow-hidden z-40"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
    >
      {/* Controls Overlay */}
      <div className="absolute top-6 right-8 z-50 flex items-center gap-4">
        <label className="flex items-center gap-2 text-white font-medium cursor-pointer select-none bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
          <input
            type="checkbox"
            checked={showUnder10MB}
            onChange={e => setShowUnder10MB(e.target.checked)}
            className="accent-neon-pink"
          />
          <span className="text-sm">Under 10MB</span>
        </label>
        {fetchingSizes && <span className="text-xs text-neon-pink animate-pulse">Checking sizes...</span>}
      </div>

      {/* Background Blur */}
      {filteredVideo && (
        <div 
          className="absolute inset-0 bg-cover bg-center blur-3xl opacity-30 pointer-events-none transition-all duration-500"
          style={{ backgroundImage: `url(${filteredVideo.thumbnail})` }}
        />
      )}

      {/* Progress Bar */}
      <div className="absolute top-0 left-0 h-1.5 bg-gradient-to-r from-neon-pink to-neon-blue z-50 transition-all duration-300 shadow-[0_0_10px_rgba(255,47,86,0.5)]" style={{ width: `${progress}%` }} />

      {/* Swipe Hint */}
      {showHint && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md text-white px-6 py-3 rounded-full flex items-center gap-3 z-50 animate-bounce border border-white/10">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
          <span className="font-medium">Swipe for more</span>
        </div>
      )}

      {/* Video Card */}
      {filteredVideo ? (
        <div className={`relative w-full max-w-md h-[80vh] transition-transform duration-300 z-10 ${transitioning ? 'scale-95 opacity-80' : 'scale-100 opacity-100'}`}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xl rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden">
            <video
              ref={videoRef}
              src={filteredVideo.url}
              className={`w-full h-full object-cover transition-opacity duration-500 ${fadeIn ? 'opacity-100' : 'opacity-0'}`}
              autoPlay
              loop={false}
              onEnded={handleVideoEnded}
              playsInline
            />
            
            {/* Overlay Gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80 pointer-events-none"></div>

            {/* Right Actions */}
            <div className="absolute right-4 bottom-24 flex flex-col gap-6 items-center z-20">
              <button 
                className={`group relative w-14 h-14 rounded-full flex items-center justify-center backdrop-blur-md border transition-all duration-300 ${
                  isFavorite(filteredVideo.id) 
                    ? 'bg-neon-pink/20 border-neon-pink text-neon-pink shadow-[0_0_20px_rgba(255,47,86,0.4)] scale-110' 
                    : 'bg-black/40 border-white/10 text-white hover:bg-white/10'
                } ${heartAnimate ? 'scale-125' : ''}`}
                onClick={() => handleLike(filteredVideo)}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
              >
                <svg className={`w-7 h-7 ${isFavorite(filteredVideo.id) ? 'fill-current' : ''}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                {showTooltip && (
                  <span className="absolute right-16 bg-black/80 text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap backdrop-blur-md border border-white/10">
                    {isFavorite(filteredVideo.id) ? 'Unlike' : 'Like'}
                  </span>
                )}
              </button>
            </div>

            {/* Bottom Info */}
            <div className="absolute bottom-0 left-0 right-0 p-8 pt-20 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-blue to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                  {filteredVideo.subreddit[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm drop-shadow-md">r/{filteredVideo.subreddit}</h3>
                </div>
              </div>
              <h2 className="text-white text-lg font-bold leading-snug line-clamp-2 drop-shadow-lg mb-2">
                {filteredVideo.title}
              </h2>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-white text-xl font-bold">No videos found for this filter.</div>
      )}

      {/* Counter */}
      <div className="absolute top-6 left-8 z-50 text-white/80 font-mono text-sm tracking-widest bg-black/40 px-4 py-2 rounded-full backdrop-blur-md border border-white/10">
        {currentIndex + 1} / {videos.length} {isSeen && <span className="text-white/40 ml-2">(SEEN)</span>}
      </div>

      {/* Custom Subreddit Input */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-black/40 p-1.5 rounded-xl backdrop-blur-md border border-white/10">
        <input
          type="text"
          placeholder="r/..."
          value={customSubreddit}
          onChange={e => setCustomSubreddit(e.target.value)}
          className="bg-transparent text-white px-3 py-1.5 outline-none w-24 text-sm font-medium placeholder-white/30"
          onKeyDown={e => { if (e.key === 'Enter') fetchFromCustomSubreddit(); }}
        />
        <button
          onClick={fetchFromCustomSubreddit}
          className="bg-neon-blue/20 hover:bg-neon-blue/40 text-neon-blue px-3 py-1.5 rounded-lg text-xs font-bold transition-colors uppercase tracking-wider"
        >
          Go
        </button>
        {usingCustomSubreddit && (
          <button
            onClick={() => { setUsingCustomSubreddit(false); setCustomSubreddit(''); setVideos([]); setCurrentIndex(0); setError(null); setLoading(true); }}
            className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}