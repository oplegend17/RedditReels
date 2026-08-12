import { useState, useRef, useEffect } from 'react';
import Masonry from 'react-masonry-css';
import { useFavorites } from '../lib/useFavorites';
import VideoModal from './VideoModal';

export default function Favorites() {
  const { favorites, loading, removeFavorite } = useFavorites();
  const [playingVideos, setPlayingVideos] = useState(new Set());
  const [selectedVideo, setSelectedVideo] = useState(null);
  const videoRefs = useRef({});
  const [showUnder10MB, setShowUnder10MB] = useState(false);
  const [videoSizes, setVideoSizes] = useState({});
  const [fetchingSizes, setFetchingSizes] = useState(false);

  const breakpointColumns = { default: 4, 1440: 3, 1100: 2, 900: 2, 700: 1 };

  const handleVideoMouseEnter = (videoId) => {
    setPlayingVideos(prev => new Set([...prev, videoId]));
    videoRefs.current[videoId]?.play().catch(() => {});
  };

  const handleVideoMouseLeave = (videoId) => {
    setPlayingVideos(prev => {
      const next = new Set([...prev]);
      next.delete(videoId);
      return next;
    });
    videoRefs.current[videoId]?.pause();
  };

  useEffect(() => {
    if (showUnder10MB && favorites.length > 0) {
      const missing = favorites.filter(f => videoSizes[f.id] === undefined);
      if (missing.length > 0) {
        setFetchingSizes(true);
        Promise.all(
          missing.map(async (f) => {
            try {
              const res = await fetch(f.url, { method: 'HEAD' });
              const size = res.headers.get('Content-Length');
              return { id: f.id, size: size ? parseInt(size, 10) : null };
            } catch {
              return { id: f.id, size: null };
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
  }, [showUnder10MB, favorites]);

  const filteredFavorites = showUnder10MB
    ? favorites.filter(f => videoSizes[f.id] !== undefined && videoSizes[f.id] !== null && videoSizes[f.id] < 10 * 1024 * 1024)
    : favorites;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-10 h-10 border-4 border-neon-pink border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <svg className="w-12 h-12 text-white/15 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
            d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
        <h2 className="text-2xl font-bold text-white mb-2">No saved videos yet</h2>
        <p className="text-white/35 text-sm max-w-xs">
          Heart any video to save it here for later.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Your Collection</h2>
          <p className="text-white/35 text-sm mt-0.5">{favorites.length} saved</p>
        </div>
        <label className="flex items-center gap-2.5 bg-white/5 px-4 py-2.5 rounded-full border border-white/10 cursor-pointer hover:bg-white/8 transition-colors text-sm font-medium text-white/70 hover:text-white">
          <input
            type="checkbox"
            checked={showUnder10MB}
            onChange={e => setShowUnder10MB(e.target.checked)}
            className="accent-neon-pink w-4 h-4"
          />
          Under 10 MB
          {fetchingSizes && <span className="text-xs text-neon-pink/70 animate-pulse">checking…</span>}
        </label>
      </div>
      
      <Masonry breakpointCols={breakpointColumns} className="flex w-auto -ml-6" columnClassName="pl-6 bg-clip-padding">
        {filteredFavorites.map(vid => (
          <div 
            key={vid.id} 
            onClick={() => setSelectedVideo(vid)}
            className="group relative mb-6 bg-dark-card rounded-2xl overflow-hidden border border-white/5 shadow-lg cursor-pointer transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_10px_40px_rgba(0,0,0,0.5)] hover:border-white/20"
            onMouseEnter={() => handleVideoMouseEnter(vid.id)}
            onMouseLeave={() => handleVideoMouseLeave(vid.id)}
          >
            <div className="absolute top-3 right-3 z-30 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
              <button 
                className="w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md border bg-neon-pink/20 border-neon-pink text-neon-pink hover:bg-neon-pink hover:text-white transition-all duration-300 shadow-[0_0_15px_rgba(255,47,86,0.3)]"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFavorite(vid.id);
                }}
                title="Remove from favorites"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
              </button>
            </div>

            <div className="relative aspect-[9/16] bg-black">
              <video
                ref={el => videoRefs.current[vid.id] = el}
                src={vid.url}
                loop
                muted
                playsInline
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500"
              />
              
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-300 pointer-events-none"></div>
              
              <div className="absolute bottom-0 left-0 right-0 p-5 translate-y-2 group-hover:translate-y-0 transition-transform duration-300 pointer-events-none">
                <h3 className="text-sm font-bold text-white line-clamp-2 leading-relaxed drop-shadow-md">{vid.title}</h3>
                <p className="text-xs text-neutral-400 mt-1 font-mono">r/{vid.subreddit}</p>
              </div>
            </div>
          </div>
        ))}
      </Masonry>

      {selectedVideo && (
        <VideoModal
          key={selectedVideo.id || selectedVideo.url}
          video={selectedVideo}
          isRedgifs={selectedVideo.isRedgifs || (selectedVideo.url && selectedVideo.url.includes('redgifs.com'))}
          originalUrl={selectedVideo.originalUrl || selectedVideo.url}
          onClose={() => setSelectedVideo(null)}
        />
      )}
    </div>
  );
}

