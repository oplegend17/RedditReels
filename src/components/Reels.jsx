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

const HeartIcon = ({ liked, onClick }) => (
  <svg
    onClick={onClick}
    width="48" height="48" viewBox="0 0 48 48"
    style={{ cursor: 'pointer', filter: liked ? 'drop-shadow(0 0 8px #ff6b6b)' : 'none', transition: 'filter 0.2s' }}
    fill={liked ? '#ff2f56' : 'none'} stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M34.5 8c-3.5 0-6.5 2.5-8.5 5.5C24 10.5 21 8 17.5 8 12.5 8 9 12.5 9 17.5c0 8.5 15 20.5 15 20.5s15-12 15-20.5C39 12.5 35.5 8 34.5 8z" />
  </svg>
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

  // Infinite scroll: fetch more when user is within last 3 videos
  useEffect(() => {
    if (
      !loadingMore &&
      videos.length > 0 &&
      currentIndex >= videos.length - 3 &&
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

  if (loading) return <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading Reels...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;
  if (!videos.length) return <div>No reels found.</div>;

  const video = videos[currentIndex];
  const isSeen = seen.has(video.id);

  return (
    <div
      style={{
        width: '100vw',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000',
        position: 'relative',
        overflow: 'hidden',
        touchAction: 'none',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      <div
        style={{
          width: '100vw',
          height: '100vh',
          maxWidth: 420,
          margin: '0 auto',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.3s cubic-bezier(.4,2,.6,1)',
          transform: transitioning ? 'scale(0.97)' : 'scale(1)',
        }}
      >
        <video
          ref={videoRef}
          src={video.url}
          controls={false}
          autoPlay
          loop={false}
          onEnded={handleVideoEnded}
          style={{
            width: '100%',
            height: '80vh',
            borderRadius: 24,
            background: '#111',
            objectFit: 'cover',
            boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
            transition: 'box-shadow 0.3s',
          }}
        />
        <div style={{ position: 'absolute', top: 32, right: 32, zIndex: 2 }}>
          <HeartIcon liked={isFavorite(video.id)} onClick={() => handleLike(video)} />
        </div>
        <div style={{ position: 'absolute', bottom: 32, left: 32, color: '#fff', background: 'rgba(0,0,0,0.45)', borderRadius: 12, padding: '0.75rem 1.25rem', maxWidth: '80%' }}>
          <div style={{ fontWeight: 700, fontSize: '1.2rem', textShadow: '0 2px 8px #000' }}>{video.title}</div>
          <div style={{ fontSize: '1rem', opacity: 0.85, marginTop: 2 }}>r/{video.subreddit}</div>
        </div>
      </div>
      <div style={{ color: '#fff', marginTop: 16, fontSize: 16, opacity: 0.7 }}>
        {currentIndex + 1} / {videos.length} {isSeen && <span style={{ color: '#aaa', fontSize: 14 }}>(seen)</span>}
      </div>
      {loadingMore && currentIndex >= videos.length - 1 && (
        <div style={{ color: '#fff', marginTop: 24, fontSize: 18 }}>
          Loading more reels...
        </div>
      )}
    </div>
  );
} 