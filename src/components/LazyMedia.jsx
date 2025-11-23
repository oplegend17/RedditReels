import { useState, useEffect, useRef } from 'react';

export function LazyVideo({ src, poster, className, isPlaying, onToggleLike, isLiked, onDownload, title, heat }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSplashing, setIsSplashing] = useState(false);
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsLoaded(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {});
        }
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    }
  }, [isPlaying]);

  const handleLike = (e) => {
    e.stopPropagation();
    setIsSplashing(true);
    setTimeout(() => setIsSplashing(false), 600);
    onToggleLike(e);
  };

  return (
    <div ref={containerRef} className={`relative bg-black ${className}`}>
      {!isLoaded ? (
        <div className="absolute inset-0 bg-white/5 animate-pulse" />
      ) : (
        <>
          <video
            ref={videoRef}
            src={src}
            poster={poster}
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
          />
          
          {/* Overlay Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-300 pointer-events-none" />

          {/* Heat Badge */}
          {heat && (
            <div className={`absolute top-3 left-3 z-20 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider text-white shadow-lg ${
              heat === 'nuclear' ? 'badge-nuclear' : 
              heat === 'fire' ? 'badge-fire' : 'badge-spicy'
            }`}>
              {heat === 'nuclear' ? '☢️ NUCLEAR' : heat === 'fire' ? '🔥🔥 FIRE' : '🌶️ SPICY'}
            </div>
          )}

          {/* Actions */}
          <div className="absolute top-3 right-3 z-20 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
            <button 
              className={`relative w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md border transition-all duration-300 overflow-hidden ${isLiked ? 'bg-neon-pink/20 border-neon-pink text-neon-pink' : 'bg-black/50 border-white/10 text-white hover:bg-white/20'} ${isSplashing ? 'liquid-active' : ''}`}
              onClick={handleLike}
            >
              <div className="liquid-splash"></div>
              <svg className={`w-5 h-5 relative z-10 ${isLiked ? 'fill-current' : ''}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none"><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
            </button>
            <button 
              className="w-10 h-10 rounded-full flex items-center justify-center bg-black/50 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 transition-all duration-300"
              onClick={onDownload}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            </button>
          </div>

          {/* Title */}
          <div className="absolute bottom-0 left-0 right-0 p-5 translate-y-2 group-hover:translate-y-0 transition-transform duration-300 pointer-events-none">
            <h3 className="text-sm font-bold text-white line-clamp-2 leading-relaxed drop-shadow-md">{title}</h3>
          </div>
        </>
      )}
    </div>
  );
}

export function LazyImage({ src, alt, className, onDownload }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          if (imgRef.current) {
            imgRef.current.src = src;
            imgRef.current.onload = () => setIsLoaded(true);
          }
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [src]);

  return (
    <div className={`relative bg-dark-card overflow-hidden ${className}`}>
      <img
        ref={imgRef}
        alt={alt}
        className={`w-full h-full object-cover transition-opacity duration-700 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
      />
      {!isLoaded && <div className="absolute inset-0 bg-white/5 animate-pulse" />}
      
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-60 transition-opacity duration-300 pointer-events-none" />
      
      {/* Actions */}
      <div className="absolute top-3 right-3 z-20 opacity-0 group-hover:opacity-100 transition-all duration-300">
        <button 
          className="w-10 h-10 rounded-full flex items-center justify-center bg-black/50 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 transition-all duration-300"
          onClick={onDownload}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
        </button>
      </div>

      {/* Title */}
      <div className="absolute bottom-0 left-0 right-0 p-5 translate-y-2 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 pointer-events-none">
        <h3 className="text-sm font-bold text-white line-clamp-2 leading-relaxed drop-shadow-md">{alt}</h3>
      </div>
    </div>
  );
}
