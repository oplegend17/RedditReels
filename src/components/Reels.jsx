import { useEffect, useState, useRef, useCallback } from 'react';
import { useFavorites } from '../lib/useFavorites';

export default function Reels() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeVideoId, setActiveVideoId] = useState(null);
  const [isMuted, setIsMuted] = useState(true);
  const observerRef = useRef(null);
  const containerRef = useRef(null);
  const { favorites, addFavorite, removeFavorite, isFavorite } = useFavorites();
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchRandomReels = useCallback(async (pageNum = 1) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);
      
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
      if (pageNum === 1) setError('Failed to load reels.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchRandomReels();
  }, [fetchRandomReels]);

  // Intersection Observer for playing videos
  useEffect(() => {
    const options = {
      root: containerRef.current,
      threshold: 0.6, // Video must be 60% visible to play
    };

    const handleIntersect = (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const videoId = entry.target.dataset.id;
          setActiveVideoId(videoId);
          
          // Check if we need to load more
          const index = videos.findIndex(v => v.id === videoId);
          if (index > videos.length - 4 && !loadingMore) {
            setPage(p => p + 1);
            fetchRandomReels(page + 1);
          }
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersect, options);
    observerRef.current = observer;

    // Observe all video containers
    const elements = document.querySelectorAll('.reel-item');
    elements.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, [videos, loadingMore, page, fetchRandomReels]);

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

  if (loading) return (
    <div className="h-screen w-full flex items-center justify-center bg-black text-neon-pink font-bold animate-pulse text-xl">
      Loading Reels...
    </div>
  );

  if (error) return (
    <div className="h-screen w-full flex items-center justify-center bg-black text-red-500 font-bold text-xl">
      {error}
    </div>
  );

  return (
    <div className="fixed inset-0 z-40 bg-black">
      {/* Global Mute Toggle */}
      <button 
        onClick={toggleMute}
        className="absolute top-24 right-6 z-50 w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-all"
      >
        {isMuted ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" strokeDasharray="1 1" /><line x1="17" y1="17" x2="7" y2="7" /></svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
        )}
      </button>

      {/* Scroll Container */}
      <div 
        ref={containerRef}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory scroll-smooth no-scrollbar"
      >
        {videos.map((video) => (
          <div 
            key={video.id} 
            data-id={video.id}
            className="reel-item h-full w-full snap-center relative flex items-center justify-center bg-black"
          >
            {/* Video Player */}
            <div className="relative w-full h-full md:w-[450px] md:h-[90vh] md:rounded-3xl overflow-hidden bg-black shadow-2xl">
              <ReelVideo 
                video={video} 
                isActive={activeVideoId === video.id} 
                isMuted={isMuted}
              />
              
              {/* Overlay Gradient */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/90 pointer-events-none" />

              {/* Right Actions */}
              <div className="absolute right-4 bottom-28 flex flex-col gap-6 items-center z-20">
                <button 
                  className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md border transition-all duration-300 ${
                    isFavorite(video.id) 
                      ? 'bg-neon-pink/20 border-neon-pink text-neon-pink scale-110' 
                      : 'bg-black/40 border-white/10 text-white hover:bg-white/10'
                  }`}
                  onClick={(e) => handleLike(e, video)}
                >
                  <svg className={`w-6 h-6 ${isFavorite(video.id) ? 'fill-current' : ''}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
                
                <button className="w-12 h-12 rounded-full flex items-center justify-center bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-white/10">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                </button>
              </div>

              {/* Bottom Info */}
              <div className="absolute bottom-0 left-0 right-0 p-6 pb-24 md:pb-8 pointer-events-none">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-blue to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                    {video.subreddit[0].toUpperCase()}
                  </div>
                  <h3 className="text-white font-bold text-sm drop-shadow-md">r/{video.subreddit}</h3>
                </div>
                <h2 className="text-white text-lg font-bold leading-snug line-clamp-2 drop-shadow-lg mb-2">
                  {video.title}
                </h2>
              </div>
            </div>
          </div>
        ))}
        {loadingMore && (
          <div className="h-20 w-full flex items-center justify-center text-white/50">
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}

function ReelVideo({ video, isActive, isMuted }) {
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
        className="w-full h-full object-cover"
        loop
        muted={isMuted}
        playsInline
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