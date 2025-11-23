import { useEffect, useState, useRef, useCallback } from 'react';
import { useFavorites } from '../lib/useFavorites';

export default function Reels() {
  const [videos, setVideos] = useState([]);
  const [videos2, setVideos2] = useState([]); // Second stream for Twin Cam
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeVideoId, setActiveVideoId] = useState(null);
  const [activeVideoId2, setActiveVideoId2] = useState(null); // Active ID for second stream
  const [isMuted, setIsMuted] = useState(true);
  const observerRef = useRef(null);
  const observerRef2 = useRef(null);
  const containerRef = useRef(null);
  const containerRef2 = useRef(null);
  const { favorites, addFavorite, removeFavorite, isFavorite } = useFavorites();
  const [page, setPage] = useState(1);
  const [page2, setPage2] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [viewMode, setViewMode] = useState('single'); // 'single' | 'twin'
  const [autoScroll, setAutoScroll] = useState(false);

  const calculateHeat = (ups) => {
    if (ups > 5000) return 'nuclear';
    if (ups > 1000) return 'fire';
    if (ups > 500) return 'spicy';
    return null;
  };

  const fetchRandomReels = useCallback(async (pageNum = 1, stream = 1) => {
    try {
      if (pageNum === 1 && stream === 1) setLoading(true);
      else setLoadingMore(true);
      
      const res = await fetch(`${import.meta.env.VITE_BACKEND_API_URL}/api/reels/random`);
      const data = await res.json();
      
      if (data?.reels?.length) {
        const newReels = data.reels.map(v => ({
          ...v,
          heat: calculateHeat(v.ups || Math.floor(Math.random() * 6000))
        }));

        if (stream === 1) {
          setVideos(prev => {
            const ids = new Set(prev.map(v => v.id));
            const filtered = newReels.filter(v => !ids.has(v.id));
            return [...prev, ...filtered];
          });
        } else {
          setVideos2(prev => {
            const ids = new Set(prev.map(v => v.id));
            const filtered = newReels.filter(v => !ids.has(v.id));
            return [...prev, ...filtered];
          });
        }
      }
    } catch (err) {
      console.error(err);
      if (pageNum === 1) setError('Failed to load reels.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchRandomReels(1, 1);
    fetchRandomReels(1, 2);
  }, [fetchRandomReels]);

  // Observer for Stream 1
  useEffect(() => {
    const options = { root: containerRef.current, threshold: 0.6 };
    const handleIntersect = (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const videoId = entry.target.dataset.id;
          setActiveVideoId(videoId);
          const index = videos.findIndex(v => v.id === videoId);
          if (index > videos.length - 4 && !loadingMore) {
            setPage(p => p + 1);
            fetchRandomReels(page + 1, 1);
          }
        }
      });
    };
    const observer = new IntersectionObserver(handleIntersect, options);
    observerRef.current = observer;
    const elements = document.querySelectorAll('.reel-item-1');
    elements.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [videos, loadingMore, page, fetchRandomReels]);

  // Observer for Stream 2
  useEffect(() => {
    if (viewMode !== 'twin') return;
    const options = { root: containerRef2.current, threshold: 0.6 };
    const handleIntersect = (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const videoId = entry.target.dataset.id;
          setActiveVideoId2(videoId);
          const index = videos2.findIndex(v => v.id === videoId);
          if (index > videos2.length - 4 && !loadingMore) {
            setPage2(p => p + 1);
            fetchRandomReels(page2 + 1, 2);
          }
        }
      });
    };
    const observer = new IntersectionObserver(handleIntersect, options);
    observerRef2.current = observer;
    const elements = document.querySelectorAll('.reel-item-2');
    elements.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [videos2, loadingMore, page2, fetchRandomReels, viewMode]);

  const toggleMute = (e) => {
    e.stopPropagation();
    setIsMuted(!isMuted);
  };

  const handleLike = async (e, video) => {
    e.stopPropagation();
    if (isFavorite(video.id)) {
      await removeFavorite(video.id);
    } else {
      await addFavorite({ ...video, subreddit: video.subreddit });
    }
  };

  const handleVideoEnd = (streamId) => {
    if (!autoScroll) return;
    
    const container = streamId === 1 ? containerRef.current : containerRef2.current;
    if (container) {
      const height = container.clientHeight;
      container.scrollBy({ top: height, behavior: 'smooth' });
    }
  };

  if (loading && videos.length === 0) return (
    <div className="h-screen w-full flex items-center justify-center bg-black text-neon-pink font-bold animate-pulse text-xl">
      Loading Reels...
    </div>
  );

  return (
    <div className="fixed inset-0 z-40 bg-black flex flex-col md:flex-row">
      {/* Controls */}
      <div className="absolute top-24 right-6 z-50 flex flex-col gap-4">
        <button 
          onClick={toggleMute}
          className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-all shadow-lg"
          title="Mute/Unmute"
        >
          {isMuted ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" strokeDasharray="1 1" /><line x1="17" y1="17" x2="7" y2="7" /></svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
          )}
        </button>

        <button 
          onClick={() => setViewMode(viewMode === 'single' ? 'twin' : 'single')}
          className={`w-12 h-12 rounded-full backdrop-blur-md border border-white/10 flex items-center justify-center text-white transition-all shadow-lg ${viewMode === 'twin' ? 'bg-neon-pink text-white border-neon-pink' : 'bg-black/40 hover:bg-white/10'}`}
          title="Twin Cam Mode"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
        </button>

        <button 
          onClick={() => setAutoScroll(!autoScroll)}
          className={`w-12 h-12 rounded-full backdrop-blur-md border border-white/10 flex items-center justify-center text-white transition-all shadow-lg ${autoScroll ? 'bg-neon-blue text-black border-neon-blue' : 'bg-black/40 hover:bg-white/10'}`}
          title="Auto Scroll"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
        </button>
      </div>

      {/* Stream 1 */}
      <div className={`h-full relative transition-all duration-500 ${viewMode === 'twin' ? 'w-full md:w-1/2 border-r border-white/10' : 'w-full'}`}>
        <div 
          ref={containerRef}
          className="h-full w-full overflow-y-scroll snap-y snap-mandatory scroll-smooth no-scrollbar"
        >
          {videos.map((video) => (
            <ReelItem 
              key={video.id} 
              video={video} 
              isActive={activeVideoId === video.id} 
              isMuted={isMuted}
              onLike={handleLike}
              isFavorite={isFavorite}
              className="reel-item-1"
              onEnded={() => handleVideoEnd(1)}
            />
          ))}
        </div>
      </div>

      {/* Stream 2 (Twin Cam) */}
      {viewMode === 'twin' && (
        <div className="h-full w-full md:w-1/2 relative border-t md:border-t-0 md:border-l border-white/10">
          <div 
            ref={containerRef2}
            className="h-full w-full overflow-y-scroll snap-y snap-mandatory scroll-smooth no-scrollbar"
          >
            {videos2.map((video) => (
              <ReelItem 
                key={video.id} 
                video={video} 
                isActive={activeVideoId2 === video.id} 
                isMuted={isMuted}
                onLike={handleLike}
                isFavorite={isFavorite}
                className="reel-item-2"
                onEnded={() => handleVideoEnd(2)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReelItem({ video, isActive, isMuted, onLike, isFavorite, className, onEnded }) {
  return (
    <div 
      data-id={video.id}
      className={`${className} h-full w-full snap-center relative flex items-center justify-center bg-black`}
    >
      <div className="relative w-full h-full overflow-hidden bg-black">
        <ReelVideo 
          video={video} 
          isActive={isActive} 
          isMuted={isMuted}
          onEnded={onEnded}
        />
        
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/90 pointer-events-none" />

        {video.heat && (
          <div className={`absolute top-6 left-6 z-20 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider text-white shadow-lg ${
            video.heat === 'nuclear' ? 'badge-nuclear' : 
            video.heat === 'fire' ? 'badge-fire' : 'badge-spicy'
          }`}>
            {video.heat === 'nuclear' ? '☢️ NUCLEAR' : video.heat === 'fire' ? '🔥🔥 FIRE' : '🌶️ SPICY'}
          </div>
        )}

        <div className="absolute right-4 bottom-28 flex flex-col gap-6 items-center z-20">
          <LikeButton 
            isLiked={isFavorite(video.id)} 
            onClick={(e) => onLike(e, video)} 
          />
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 pb-24 md:pb-8 pointer-events-none">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-blue to-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-lg">
              {video.subreddit[0].toUpperCase()}
            </div>
            <h3 className="text-white font-bold text-xs drop-shadow-md">r/{video.subreddit}</h3>
          </div>
          <h2 className="text-white text-sm font-bold leading-snug line-clamp-2 drop-shadow-lg mb-2">
            {video.title}
          </h2>
        </div>
      </div>
    </div>
  );
}

function LikeButton({ isLiked, onClick }) {
  const [isSplashing, setIsSplashing] = useState(false);

  const handleClick = (e) => {
    setIsSplashing(true);
    setTimeout(() => setIsSplashing(false), 600);
    onClick(e);
  };

  return (
    <button 
      className={`relative w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md border transition-all duration-300 overflow-hidden ${
        isLiked 
          ? 'bg-neon-pink/20 border-neon-pink text-neon-pink scale-110' 
          : 'bg-black/40 border-white/10 text-white hover:bg-white/10'
      } ${isSplashing ? 'liquid-active' : ''}`}
      onClick={handleClick}
    >
      <div className="liquid-splash"></div>
      <svg className={`w-6 h-6 relative z-10 ${isLiked ? 'fill-current' : ''}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    </button>
  );
}

function ReelVideo({ video, isActive, isMuted, onEnded }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (isActive) {
      const playPromise = videoRef.current?.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      }
    } else {
      videoRef.current?.pause();
      if (videoRef.current) videoRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  }, [isActive]);

  return (
    <>
      <video
        ref={videoRef}
        src={video.url}
        poster={video.thumbnail}
        className="w-full h-full object-contain"
        loop={false} // Disable loop for auto-scroll to work
        muted={isMuted}
        playsInline
        onEnded={onEnded}
      />
      {!isPlaying && isActive && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center animate-pulse">
            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      )}
    </>
  );
}