import { useEffect, useState, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import Hls from 'hls.js';
import { useFavorites } from '../lib/useFavorites';
import { useHistory } from '../lib/useHistory';
import { getIcon } from './GamificationIcons';
import { getRedgifsId } from '../lib/media-utils';
import { useWatchPartyContext } from '../context/WatchPartyContext';

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL;

export default function Reels({ subreddits = [] }) {
  const { profile } = useOutletContext() || {};
  const restrictionActive = profile?.restrictionType === 'keyword' && profile?.restrictionKeyword;
  const restrictionKeyword = profile?.restrictionKeyword || '';

  const partyContext = useWatchPartyContext();
  const { isHost, status, syncVideo } = partyContext || {};

  const [sourceProvider, setSourceProvider] = useState('redgifs'); // 'redgifs' (primary) | 'reddit'
  const [redditAfter, setRedditAfter] = useState(null);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeVideoId, setActiveVideoId] = useState(null);

  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem('reels-muted') !== 'false';
  });
  const [autoScroll, setAutoScroll] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const containerRef = useRef(null);
  const fetchingRef = useRef(false); // prevent concurrent fetches

  const { addFavorite, removeFavorite, isFavorite } = useFavorites();
  const { markAsSeen } = useHistory();

  const [page, setPage] = useState(1);

  const fetchReels = useCallback(async (reset = false) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      if (reset) setLoading(true);
      else setLoadingMore(true);

      if (sourceProvider === 'redgifs') {
        const targetPage = reset ? 1 : page;
        let url = `${BACKEND_API_URL}/api/redgifs/trending?page=${targetPage}&count=20`;
        if (restrictionActive) {
          url = `${BACKEND_API_URL}/api/redgifs/search?query=${encodeURIComponent(restrictionKeyword)}&page=${targetPage}`;
        } else if (subreddits.length > 0) {
          url = `${BACKEND_API_URL}/api/redgifs/search?query=${encodeURIComponent(subreddits[0])}&page=${targetPage}`;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const rawPosts = data.posts || [];

        let parsedReels = rawPosts.map(p => ({
          id: p.id,
          title: p.title,
          url: p.url,
          thumbnail: p.thumbnail,
          subreddit: p.subreddit,
          originalUrl: p.permalink,
          isRedgifs: true,
        }));

        if (restrictionActive) {
          const kw = restrictionKeyword.toLowerCase().trim();
          parsedReels = parsedReels.filter(v => {
            const title = (v.title || '').toLowerCase();
            const sub = (v.subreddit || '').toLowerCase();
            return title.includes(kw) || sub.includes(kw);
          });
        }

        setPage(data.nextPage || targetPage + 1);

        setVideos(prev => {
          if (reset) return parsedReels;
          const existingIds = new Set(prev.map(v => v.id));
          const unique = parsedReels.filter(v => !existingIds.has(v.id));
          return [...prev, ...unique];
        });
      } else {
        // Reddit API Provider Branch
        const afterToken = reset ? '' : (redditAfter || '');
        const targetSub = subreddits.length > 0
          ? subreddits.join('+')
          : 'nsfw_gifs+gifsex+AnalGifs+blowjobs+LegalTeens';

        let url = `${BACKEND_API_URL}/api/reddit/${targetSub}?sort=hot${afterToken ? `&after=${afterToken}` : ''}`;
        if (restrictionActive) {
          url = `${BACKEND_API_URL}/api/search?q=${encodeURIComponent(restrictionKeyword)}${afterToken ? `&after=${afterToken}` : ''}`;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const children = data?.data?.children || [];
        const nextAfter = data?.data?.after || null;

        let parsedReels = children
          .map(child => child.data)
          .filter(p => {
            if (!p) return false;
            const urlStr = p.url_overridden_by_dest || p.url || '';
            return (
              (p.is_video && p.media?.reddit_video?.fallback_url) ||
              p.preview?.reddit_video_preview?.fallback_url ||
              urlStr.includes('v.redd.it') ||
              urlStr.includes('redgifs.com') ||
              /\.(mp4|webm|m4v)(\?.*)?$/i.test(urlStr)
            );
          })
          .map(p => {
            let videoUrl = p.media?.reddit_video?.fallback_url ||
                           p.preview?.reddit_video_preview?.fallback_url ||
                           p.url_overridden_by_dest ||
                           p.url;

            if (videoUrl.includes('redgifs.com/watch/')) {
              const id = videoUrl.split('/watch/')[1]?.split('?')[0];
              if (id) videoUrl = `https://media.redgifs.com/${id}.mp4`;
            }

            return {
              id: p.id,
              title: p.title,
              url: videoUrl,
              thumbnail: p.thumbnail && p.thumbnail.startsWith('http') ? p.thumbnail : null,
              subreddit: p.subreddit,
              originalUrl: p.permalink,
              isRedgifs: videoUrl.includes('redgifs.com')
            };
          });

        if (restrictionActive) {
          const kw = restrictionKeyword.toLowerCase().trim();
          parsedReels = parsedReels.filter(v => {
            const title = (v.title || '').toLowerCase();
            const sub = (v.subreddit || '').toLowerCase();
            return title.includes(kw) || sub.includes(kw);
          });
        }

        setRedditAfter(nextAfter);

        setVideos(prev => {
          if (reset) return parsedReels;
          const existingIds = new Set(prev.map(v => v.id));
          const unique = parsedReels.filter(v => !existingIds.has(v.id));
          return [...prev, ...unique];
        });
      }

      if (reset) setError(null);
    } catch (err) {
      console.error('Reels fetch error:', err);
      if (reset) setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      fetchingRef.current = false;
    }
  }, [sourceProvider, subreddits, restrictionActive, restrictionKeyword, page, redditAfter]);

  // Reset and fetch when subreddits or sourceProvider changes
  useEffect(() => {
    setVideos([]);
    setActiveVideoId(null);
    setPage(1);
    setRedditAfter(null);
    fetchReels(true);
  }, [sourceProvider, subreddits.join(',')]);

  // Intersection observer — track active video + load more
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const id = entry.target.dataset.id;
            setActiveVideoId(id);
            const videoObj = videos.find(v => v.id === id);
            if (videoObj) {
              markAsSeen(videoObj);
              if (isHost && status === 'hosting' && syncVideo) {
                syncVideo(videoObj);
              }
            } else {
              markAsSeen(id);
            }

          }
        });
      },
      { root: containerRef.current, threshold: 0.6 }
    );

    const items = containerRef.current.querySelectorAll('[data-id]');
    items.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, [videos, markAsSeen]);

  // Load more when near end
  useEffect(() => {
    if (!containerRef.current || !activeVideoId) return;
    const idx = videos.findIndex(v => v.id === activeVideoId);
    if (idx >= videos.length - 4 && !loadingMore && !fetchingRef.current) {
      fetchReels(false);
    }
  }, [activeVideoId]);

  const toggleMute = () => {
    setIsMuted(prev => {
      localStorage.setItem('reels-muted', String(!prev));
      return !prev;
    });
  };

  const handleLike = async (e, video) => {
    e.stopPropagation();
    if (isFavorite(video.id)) {
      await removeFavorite(video.id);
    } else {
      await addFavorite({ id: video.id, title: video.title, url: video.url, thumbnail: video.thumbnail, subreddit: video.subreddit });
    }
  };

  const handleShare = async (e, video) => {
    e.stopPropagation();
    const cleanSub = (video.subreddit || 'redgifs').replace('/', '_');
    const shareUrl = `${window.location.origin}/watch/${cleanSub}/${video.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: video.title, url: shareUrl });
      } else if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = shareUrl;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
    } catch {}
  };

  const scrollNext = () => {
    if (!containerRef.current) return;
    containerRef.current.scrollBy({ top: containerRef.current.clientHeight, behavior: 'smooth' });
  };

  if (loading) return (
    <div className="fixed inset-0 z-40 bg-black flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-neon-pink border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error || videos.length === 0) return (
    <div className="fixed inset-0 z-40 bg-black flex flex-col items-center justify-center gap-4 text-white">
      <p className="text-neon-pink text-xl font-bold">{error || 'No videos found'}</p>
      <button onClick={() => fetchReels(true)} className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full font-bold transition-colors">
        Retry
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-40 bg-black">
      {/* Source Provider Switcher */}
      <div className="absolute top-24 left-4 z-50 flex bg-black/70 backdrop-blur-md p-1 rounded-2xl border border-white/20 shadow-2xl">
        <button
          onClick={() => {
            setSourceProvider('redgifs');
            setVideos([]);
            setActiveVideoId(null);
            setPage(1);
          }}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            sourceProvider === 'redgifs'
              ? 'bg-gradient-to-r from-neon-pink to-rose-500 text-white shadow-[0_0_15px_rgba(255,47,86,0.5)]'
              : 'text-white/60 hover:text-white'
          }`}
        >
          ✨ RedGIFs (First)
        </button>
        <button
          onClick={() => {
            setSourceProvider('reddit');
            setVideos([]);
            setActiveVideoId(null);
            setRedditAfter(null);
          }}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            sourceProvider === 'reddit'
              ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.5)]'
              : 'text-white/60 hover:text-white'
          }`}
        >
          🤖 Reddit API
        </button>
      </div>

      {/* Restricted Alert Banner */}
      {restrictionActive && (
        <div className="absolute top-36 left-4 z-50 bg-purple-950/80 backdrop-blur-md border border-purple-500/30 px-4 py-2.5 rounded-2xl flex items-center gap-2 text-xs font-bold text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.15)] max-w-[80vw] sm:max-w-md animate-pulse pointer-events-none">
          <span>🔒</span>
          <span className="truncate">Restricted Feed Active: "{restrictionKeyword}"</span>
        </div>
      )}

      {/* Controls */}
      <div className="absolute top-24 right-4 z-50 flex flex-col gap-3">
        <ControlBtn onClick={toggleMute} active={!isMuted} title={isMuted ? 'Unmute' : 'Mute'}>
          {isMuted
            ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><line x1="17" y1="17" x2="7" y2="7" stroke="currentColor" strokeWidth="2" /></svg>
            : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
          }
        </ControlBtn>
        <ControlBtn onClick={() => setAutoScroll(p => !p)} active={autoScroll} title="Auto scroll">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
        </ControlBtn>
        <ControlBtn onClick={scrollNext} title="Next">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
        </ControlBtn>
      </div>

      {/* Feed */}
      <div
        ref={containerRef}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar"
      >
        {videos.map(video => (
          <ReelItem
            key={video.id}
            video={video}
            isActive={activeVideoId === video.id}
            isMuted={isMuted}
            autoScroll={autoScroll}
            onScrollNext={scrollNext}
            onLike={handleLike}
            onShare={handleShare}
            isFavorite={isFavorite}
          />
        ))}

        {loadingMore && (
          <div className="h-screen w-full snap-center flex items-center justify-center bg-black">
            <div className="w-8 h-8 border-4 border-neon-pink border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}

function ControlBtn({ onClick, active, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-11 h-11 rounded-full backdrop-blur-md border flex items-center justify-center text-white transition-all shadow-lg ${
        active ? 'bg-neon-pink/30 border-neon-pink' : 'bg-black/50 border-white/10 hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  );
}

function ReelItem({ video, isActive, isMuted, autoScroll, onScrollNext, onLike, onShare, isFavorite }) {
  return (
    <div
      data-id={video.id}
      className="h-screen w-full snap-center relative flex items-center justify-center bg-black overflow-hidden"
    >
      <ReelVideo
        video={video}
        isActive={isActive}
        isMuted={isMuted}
        autoScroll={autoScroll}
        onScrollNext={onScrollNext}
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80 pointer-events-none" />

      {/* Side actions */}
      <div className="absolute right-4 bottom-32 flex flex-col gap-5 items-center z-20">
        <LikeButton isLiked={isFavorite(video.id)} onClick={e => onLike(e, video)} />
        <button
          onClick={e => onShare(e, video)}
          className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-all"
        >
          {getIcon('share')}
        </button>
      </div>

      {/* Info */}
      <div className="absolute bottom-6 left-4 right-20 z-20 pointer-events-none">
        <p className="text-white/60 text-xs font-bold mb-1">r/{video.subreddit}</p>
        <p className="text-white text-sm font-medium line-clamp-2 leading-snug">{video.title}</p>
      </div>
    </div>
  );
}

function LikeButton({ isLiked, onClick }) {
  const [splash, setSplash] = useState(false);
  const handleClick = (e) => {
    setSplash(true);
    setTimeout(() => setSplash(false), 600);
    onClick(e);
  };
  return (
    <button
      onClick={handleClick}
      className={`relative w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md border transition-all overflow-hidden ${
        isLiked ? 'bg-neon-pink/20 border-neon-pink text-neon-pink' : 'bg-black/50 border-white/10 text-white hover:bg-white/10'
      } ${splash ? 'liquid-active' : ''}`}
    >
      <div className="liquid-splash" />
      <svg className={`w-5 h-5 relative z-10 ${isLiked ? 'fill-current' : ''}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    </button>
  );
}

function ReelVideo({ video, isActive, isMuted, autoScroll, onScrollNext }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [src, setSrc] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | playing | error

  // Resolve the actual playable URL
  useEffect(() => {
    setSrc(null);
    setStatus('loading');

    if (video.isRedgifs && video.originalUrl) {
      const id = getRedgifsId(video.originalUrl);
      if (id) {
        fetch(`${BACKEND_API_URL}/api/redgifs/${id}`)
          .then(r => r.json())
          .then(d => {
            if (d.url) setSrc(d.url);
            else throw new Error('no url');
          })
          .catch(() => {
            // Fall back to direct URL if we have one
            if (video.url) setSrc(video.url);
            else setStatus('error');
          });
        return;
      }
    }

    if (video.url) {
      setSrc(video.url);
    } else {
      setStatus('error');
    }
  }, [video.id]);

  // Attach src to video element
  useEffect(() => {
    if (!src || !videoRef.current) return;

    // Destroy previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (src.includes('.m3u8')) {
      if (Hls.isSupported()) {
        const hls = new Hls({ maxBufferLength: 30, enableWorker: true });
        hls.loadSource(src);
        hls.attachMedia(videoRef.current);
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) setStatus('error');
        });
        hlsRef.current = hls;
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = src;
      } else {
        setStatus('error');
      }
    } else {
      videoRef.current.src = src;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src]);

  // Play/pause based on active state
  useEffect(() => {
    if (!videoRef.current || !src) return;

    if (isActive) {
      videoRef.current.muted = isMuted;
      const play = () => {
        videoRef.current?.play()
          .then(() => setStatus('playing'))
          .catch(() => {
            // Autoplay blocked — try muted
            if (videoRef.current) {
              videoRef.current.muted = true;
              videoRef.current.play()
                .then(() => setStatus('playing'))
                .catch(() => setStatus('error'));
            }
          });
      };

      // If video is ready, play immediately; otherwise wait for canplay
      if (videoRef.current.readyState >= 3) {
        play();
      } else {
        videoRef.current.addEventListener('canplay', play, { once: true });
      }
    } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      setStatus('loading');
    }
  }, [isActive, src]);

  // Sync mute state
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = isMuted;
  }, [isMuted]);

  return (
    <>
      <video
        ref={videoRef}
        poster={video.thumbnail}
        className="w-full h-full object-contain"
        playsInline
        referrerPolicy="no-referrer"
        loop={!autoScroll}
        muted={isMuted}
        onEnded={() => autoScroll && onScrollNext()}
        onError={() => setStatus('error')}
      />

      {/* Loading spinner */}
      {isActive && status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
          <span className="text-3xl">⚠️</span>
          <p className="text-white/40 text-sm">Video unavailable</p>
        </div>
      )}
    </>
  );
}
