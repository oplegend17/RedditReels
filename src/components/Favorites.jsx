import { useState, useRef, useEffect } from 'react';
import Masonry from 'react-masonry-css';
import { useFavorites } from '../lib/useFavorites';

export default function Favorites() {
  const { favorites, loading, removeFavorite } = useFavorites();
  const [playingVideos, setPlayingVideos] = useState(new Set());
  const videoRefs = useRef({});
  const [showUnder10MB, setShowUnder10MB] = useState(false);
  const [videoSizes, setVideoSizes] = useState({});
  const [fetchingSizes, setFetchingSizes] = useState(false);

  const breakpointColumns = { default: 4, 1440: 3, 1100: 2, 700: 1 };

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
      const missing = favorites.filter(f => videoSizes[f.video_id] === undefined);
      if (missing.length > 0) {
        setFetchingSizes(true);
        Promise.all(
          missing.map(async (f) => {
            try {
              const res = await fetch(f.video_url, { method: 'HEAD' });
              const size = res.headers.get('Content-Length');
              return { id: f.video_id, size: size ? parseInt(size, 10) : null };
            } catch {
              return { id: f.video_id, size: null };
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
    ? favorites.filter(f => videoSizes[f.video_id] !== undefined && videoSizes[f.video_id] !== null && videoSizes[f.video_id] < 10 * 1024 * 1024)
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
      <div className="flex flex-col items-center justify-center py-32 text-center animate-in fade-in duration-500">
        <div className="w-32 h-32 bg-white/5 rounded-full flex items-center justify-center mb-8 border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
          <svg className="w-12 h-12 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
        </div>
        <h2 className="text-3xl font-bold text-white mb-4">No Favorites Yet</h2>
        <p className="text-neutral-400 max-w-md text-lg">
          Start exploring and heart the videos you love to build your collection.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-6">
        <h2 className="text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-neon-blue to-neon-pink drop-shadow-lg">
          YOUR COLLECTION
        </h2>
        
        <label className="flex items-center gap-3 bg-black/40 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/10 cursor-pointer hover:bg-white/5 transition-colors">
          <input
            type="checkbox"
            checked={showUnder10MB}
            onChange={e => setShowUnder10MB(e.target.checked)}
            className="accent-neon-pink w-4 h-4"
          />
          <span className="text-sm font-bold text-white">Under 10MB</span>
          {fetchingSizes && <span className="text-xs text-neon-pink animate-pulse ml-2">Checking...</span>}
        </label>
      </div>
      
      <Masonry breakpointCols={breakpointColumns} className="flex w-auto -ml-6" columnClassName="pl-6 bg-clip-padding">
        {filteredFavorites.map(vid => (
          <div 
            key={vid.id} 
            className="group relative mb-6 bg-dark-card rounded-2xl overflow-hidden border border-white/5 shadow-lg transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_10px_40px_rgba(0,0,0,0.5)] hover:border-white/20"
            onMouseEnter={() => handleVideoMouseEnter(vid.video_id)}
            onMouseLeave={() => handleVideoMouseLeave(vid.video_id)}
          >
            <div className="absolute top-3 right-3 z-30 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
              <button 
                className="w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md border bg-neon-pink/20 border-neon-pink text-neon-pink hover:bg-neon-pink hover:text-white transition-all duration-300 shadow-[0_0_15px_rgba(255,47,86,0.3)]"
                onClick={() => removeFavorite(vid.video_id)}
                title="Remove from favorites"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
              </button>
            </div>

            <div className="relative aspect-[9/16] bg-black">
              <video
                ref={el => videoRefs.current[vid.video_id] = el}
                src={vid.video_url}
                loop
                muted
                playsInline
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
    </div>
  );
}
