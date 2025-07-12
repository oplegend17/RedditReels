import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useFavorites } from '../lib/useFavorites';

function shuffle(array) {
  // Fisher-Yates shuffle
  let arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Replace HeartIcon with Material-style favorite button
const HeartIcon = ({ liked, onClick, animate, tooltip }) => (
  <div style={{ position: 'relative', display: 'inline-block' }}>
    <button
      className={`favorite-button${liked ? ' liked' : ''}`}
      onClick={onClick}
      style={{
        background: liked
          ? 'rgba(255,47,86,0.18)'
          : 'rgba(30,30,30,0.18)',
        border: 'none',
        borderRadius: '50%',
        boxShadow: liked
          ? '0 0 16px 4px #ff2f56cc, 0 2px 8px #0006'
          : '0 2px 8px #0006',
        width: 50,
        height: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s, background 0.2s, transform 0.18s',
        outline: 'none',
        position: 'relative',
        zIndex: 10,
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
        transform: animate ? 'scale(1.18)' : 'scale(1)',
      }}
      aria-label={liked ? 'Unlike' : 'Like'}
      tabIndex={0}
      onMouseDown={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
    >
      <svg viewBox="0 0 24 24" width="44" height="44">
        <path
          fill={liked ? '#ff2f56' : 'none'}
          stroke={liked ? '#ff2f56' : '#fff'}
          strokeWidth="2"
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        />
      </svg>
      {/* Tooltip */}
      <span
        style={{
          visibility: tooltip ? 'visible' : 'hidden',
          opacity: tooltip ? 1 : 0,
          background: 'rgba(30,30,30,0.85)',
          color: '#fff',
          textAlign: 'center',
          borderRadius: 8,
          padding: '6px 14px',
          position: 'absolute',
          zIndex: 20,
          bottom: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 15,
          fontWeight: 500,
          pointerEvents: 'none',
          transition: 'opacity 0.18s',
          boxShadow: '0 2px 8px #0005',
          whiteSpace: 'nowrap',
        }}
      >
        {liked ? 'Unlike' : 'Like'}
      </span>
    </button>
  </div>
);

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
  const [videoSizes, setVideoSizes] = useState({}); // { [videoId]: sizeInBytes }
  const [fetchingSizes, setFetchingSizes] = useState(false);

  // Helper to fetch random reels
  const fetchRandomReels = async () => {
    setLoadingMore(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_API_URL}/api/reels/random`);
      const data = await res.json();
      if (data?.reels?.length) {
        // Prevent duplicates by ID
        setVideos(prev => {
          const ids = new Set(prev.map(v => v.id));
          const newReels = data.reels.filter(v => !ids.has(v.id));
          return [...prev, ...newReels];
        });
      }
    } catch (err) {
      // Optionally handle error
    } finally {
      setLoadingMore(false);
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

  // Infinite scroll: fetch more as soon as user reaches the 3rd-to-last video
  useEffect(() => {
    if (
      !loadingMore &&
      videos.length > 0 &&
      currentIndex === videos.length - 3 &&
      lastFetchLength.current !== videos.length
    ) {
      fetchRandomReels();
      lastFetchLength.current = videos.length;
    }
    // eslint-disable-next-line
  }, [currentIndex, videos, loadingMore]);

  // Scroll-to-swipe: use wheel/trackpad to go next/prev
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
    // Autoplay current video
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [currentIndex]);

  // Swipe gesture handlers
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

  // Mouse drag for desktop
  const handleMouseDown = (e) => handleTouchStart(e);
  const handleMouseUp = (e) => handleTouchEnd(e);

  // Keyboard navigation
  useEffect(() => {
    const onKeyDown = (e) => {
      if (transitioning) return;
      if (e.key === 'ArrowDown' || e.key === ' ') {
        if (currentIndex < videos.length - 1) {
          setTransitioning(true);
          setTimeout(() => {
            setSeen(prev => new Set(prev).add(videos[currentIndex]?.id));
            setCurrentIndex(idx => Math.min(idx + 1, videos.length - 1));
            setTransitioning(false);
          }, 250);
        }
      }
      if (e.key === 'ArrowUp') {
        if (currentIndex > 0) {
          setTransitioning(true);
          setTimeout(() => {
            setCurrentIndex(idx => Math.max(idx - 1, 0));
            setTransitioning(false);
          }, 250);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentIndex, videos, transitioning]);

  const handleLike = async (video) => {
    setHeartAnimate(true);
    setTimeout(() => setHeartAnimate(false), 350);
    if (isFavorite(video.id)) {
      await removeFavorite(video.id);
    } else {
      await addFavorite(video);
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

  // Hide swipe/scroll hint after first interaction
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

  // Add fade-in animation for video
  useEffect(() => {
    setFadeIn(false);
    setTimeout(() => setFadeIn(true), 10);
  }, [currentIndex]);

  // Tooltip for like button
  const handleHeartMouseEnter = () => setShowTooltip(true);
  const handleHeartMouseLeave = () => setShowTooltip(false);

  useEffect(() => {
    // Fetch sizes for all videos if the filter is enabled and sizes are missing
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

  // Filter videos if switch is on and sizes are available
  const filteredVideos = showUnder10MB
    ? videos.filter(v => videoSizes[v.id] !== undefined && videoSizes[v.id] !== null && videoSizes[v.id] < 10 * 1024 * 1024)
    : videos;
  const filteredCurrentIndex = Math.min(currentIndex, filteredVideos.length - 1);
  const filteredVideo = filteredVideos[filteredCurrentIndex] || null;

  if (loading) return <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading Reels...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;
  if (!videos.length) return <div>No reels found.</div>;

  const video = videos[currentIndex];
  const isSeen = seen.has(video.id);

  // Progress bar width
  const progress = ((currentIndex + 1) / videos.length) * 100;

  return (
    <div
      style={{
        position: 'fixed',
        top: 64, // below navbar
        left: 0,
        width: '100vw',
        height: 'calc(100vh - 64px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000',
        overflow: 'hidden',
        fontFamily: 'Inter, system-ui, sans-serif',
        zIndex: 100,
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      {/* Filter Switch UI */}
      <div style={{ position: 'absolute', top: 24, right: 32, zIndex: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
        <label style={{ color: '#fff', fontSize: 16, fontWeight: 500, cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={showUnder10MB}
            onChange={e => setShowUnder10MB(e.target.checked)}
            style={{ marginRight: 8 }}
          />
          Show only reels under 10MB
        </label>
        {fetchingSizes && (
          <span style={{ color: '#fff', fontSize: 14, marginLeft: 8 }}>Checking sizes...</span>
        )}
      </div>
      {/* Blurred background for glass effect */}
      {filteredVideo && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100%',
            zIndex: 0,
            background: `url(${filteredVideo.url}) center center / cover no-repeat`,
            filter: 'blur(32px) brightness(0.5) saturate(1.2)',
            opacity: 0.45,
            pointerEvents: 'none',
            transition: 'background 0.5s',
          }}
        />
      )}
      {/* Gradient overlays */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '12vw', maxHeight: 80, zIndex: 2, pointerEvents: 'none', background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '18vw', maxHeight: 120, zIndex: 2, pointerEvents: 'none', background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }} />
      {/* Progress bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: `${progress}%`, height: 6, background: 'linear-gradient(90deg, #ff2f56 40%, #646cff 100%)', borderRadius: 8, zIndex: 10, boxShadow: '0 2px 8px #0004', transition: 'width 0.4s cubic-bezier(.4,2,.6,1)' }} />
      {/* Swipe/scroll hint */}
      {showHint && (
        <div style={{ position: 'absolute', bottom: '6vw', left: '50%', transform: 'translateX(-50%)', color: '#fff', background: 'rgba(0,0,0,0.55)', borderRadius: '1.2em', padding: '0.7em 2.2em', fontSize: 'clamp(1rem, 2vw, 1.25rem)', zIndex: 10, opacity: 0.92, boxShadow: '0 2px 12px #0007', display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8, opacity: 0.8 }}><path d="M12 5v14M19 12l-7 7-7-7" /></svg>
          <span>Swipe or scroll for more</span>
        </div>
      )}
      {/* Only render the rest if there is a video to show */}
      {filteredVideo ? (
        <div
          style={{
            width: 'min(100vw, 100%)',
            height: 'min(100%, 80vh)',
            maxWidth: '420px',
            margin: '0 auto',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.3s cubic-bezier(.4,2,.6,1)',
            transform: transitioning ? 'scale(0.97)' : 'scale(1)',
            zIndex: 3,
          }}
        >
          {/* Glassmorphic card */}
          <div
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              borderRadius: '2em',
              background: 'rgba(30,30,30,0.38)',
              boxShadow: '0 12px 48px 0 rgba(0,0,0,0.55)',
              backdropFilter: 'blur(16px) saturate(1.2)',
              WebkitBackdropFilter: 'blur(16px) saturate(1.2)',
              zIndex: 1,
              top: 0,
              left: 0,
            }}
          />
          <video
            ref={videoRef}
            src={filteredVideo.url}
            controls={false}
            autoPlay
            loop={false}
            onEnded={handleVideoEnded}
            style={{
              width: '100%',
              height: '80vh',
              maxHeight: 'calc(100vh - 120px)',
              maxWidth: '100vw',
              borderRadius: '2em',
              background: '#111',
              objectFit: 'cover',
              boxShadow: '0 12px 48px rgba(0,0,0,0.55)',
              opacity: fadeIn ? 1 : 0,
              transitionProperty: 'box-shadow, opacity',
              transitionDuration: '0.3s, 0.5s',
              zIndex: 2,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '2.5vw',
              right: '2.5vw',
              zIndex: 4,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
            }}
            onMouseEnter={handleHeartMouseEnter}
            onMouseLeave={handleHeartMouseLeave}
          >
            <HeartIcon liked={isFavorite(filteredVideo.id)} onClick={() => handleLike(filteredVideo)} animate={heartAnimate} tooltip={showTooltip} />
          </div>
          <div style={{ position: 'absolute', bottom: '2.5vw', left: '2.5vw', color: '#fff', background: 'rgba(0,0,0,0.45)', borderRadius: '1em', padding: '0.85em 1.5em', maxWidth: '80%', fontFamily: 'inherit', zIndex: 4, boxShadow: '0 2px 8px #0005', fontSize: 'clamp(1rem, 2vw, 1.25rem)' }}>
            <div style={{ fontWeight: 800, fontSize: 'clamp(1.1rem, 2vw, 1.25rem)', textShadow: '0 2px 8px #000' }}>{filteredVideo.title}</div>
            <div style={{ fontSize: 'clamp(0.95rem, 1.5vw, 1.05rem)', opacity: 0.88, marginTop: 2 }}>r/{filteredVideo.subreddit}</div>
          </div>
        </div>
      ) : (
        <div style={{ color: '#fff', marginTop: 80, fontSize: 20 }}>No videos found for this filter.</div>
      )}
      <div style={{ color: '#fff', marginTop: 18, fontSize: 'clamp(1rem, 2vw, 1.1rem)', opacity: 0.8, fontFamily: 'inherit', letterSpacing: 1, zIndex: 5 }}>
        {currentIndex + 1} / {videos.length} {isSeen && <span style={{ color: '#aaa', fontSize: 'clamp(0.85rem, 1vw, 0.95rem)' }}>(seen)</span>}
      </div>
    </div>
  );
} 