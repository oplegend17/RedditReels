import { useState, useEffect, useRef, useCallback } from 'react';
import Masonry from 'react-masonry-css';
import { useFavorites } from '../lib/useFavorites';

const BACKEND = import.meta.env.VITE_BACKEND_API_URL;

// Curated female-oriented mood categories based on research
const MOODS = [
  {
    id: 'romantic',
    label: 'Romantic',
    icon: '🌹',
    desc: 'Intimate, sensual, emotional connection',
    subreddits: ['passionx', 'holdthemoan', 'GWCouples', 'gonewildcouples', 'gonemild'],
    color: 'from-rose-500/20 to-pink-500/20',
    border: 'border-rose-500/40',
    glow: 'rgba(244,63,94,0.3)',
  },
  {
    id: 'gentle-dom',
    label: 'Gentle Dom',
    icon: '🎀',
    desc: 'Assertive but caring, praise & aftercare',
    subreddits: ['gentlefemdom', 'bdsmgw', 'collared', 'UnderwearGW'],
    color: 'from-purple-500/20 to-violet-500/20',
    border: 'border-purple-500/40',
    glow: 'rgba(168,85,247,0.3)',
  },
  {
    id: 'female-gaze',
    label: 'Female Gaze',
    icon: '👀',
    desc: 'Attractive men, for her eyes',
    subreddits: ['ladybonersgw', 'chickflixxx', 'massivecock', 'MenGW'],
    color: 'from-amber-500/20 to-orange-500/20',
    border: 'border-amber-500/40',
    glow: 'rgba(245,158,11,0.3)',
  },
  {
    id: 'couples',
    label: 'Couples',
    icon: '💑',
    desc: 'Real chemistry, mutual pleasure',
    subreddits: ['GWCouples', 'gonewildcouples', 'gwcumsluts', 'WouldYouFuckMyWife'],
    color: 'from-red-500/20 to-rose-500/20',
    border: 'border-red-500/40',
    glow: 'rgba(239,68,68,0.3)',
  },
  {
    id: 'pov',
    label: 'Her POV',
    icon: '🎬',
    desc: 'Female perspective & female-initiated',
    subreddits: ['femalepov', 'SheFucksHim', 'girlswhoriide', 'GirlsFinishingTheJob'],
    color: 'from-cyan-500/20 to-blue-500/20',
    border: 'border-cyan-500/40',
    glow: 'rgba(6,182,212,0.3)',
  },
  {
    id: 'sensual',
    label: 'Sensual',
    icon: '🕯️',
    desc: 'Slow, teasing, body appreciation',
    subreddits: ['gonewildcolor', 'altgonewild', 'GoneWild', 'normalnudes', 'sexybutnotporn'],
    color: 'from-pink-500/20 to-fuchsia-500/20',
    border: 'border-pink-500/40',
    glow: 'rgba(236,72,153,0.3)',
  },
  {
    id: 'lesbian',
    label: 'Lesbian',
    icon: '🏳️‍🌈',
    desc: 'Women loving women',
    subreddits: ['lesbians', 'dykesgonewild', 'StraightGirlsPlaying', 'girlskissing'],
    color: 'from-fuchsia-500/20 to-pink-500/20',
    border: 'border-fuchsia-500/40',
    glow: 'rgba(217,70,239,0.3)',
  },
  {
    id: 'audio',
    label: 'Audio Erotica',
    icon: '🎧',
    desc: 'Voice, imagination, GoneWildAudio',
    subreddits: ['gonewildaudio'],
    color: 'from-green-500/20 to-emerald-500/20',
    border: 'border-green-500/40',
    glow: 'rgba(34,197,94,0.3)',
    isAudio: true,
  },
];

export default function Females() {
  const [activeMood, setActiveMood] = useState(MOODS[0]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [after, setAfter] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const loadMoreRef = useRef(null);
  const { isFavorite, addFavorite, removeFavorite } = useFavorites();
  const [playingId, setPlayingId] = useState(null);
  const [selectedAudio, setSelectedAudio] = useState(null);

  const fetchPosts = useCallback(async (mood, afterToken = null, reset = false) => {
    setLoading(true);
    setError(null);
    try {
      const sub = mood.subreddits.join('+');
      const url = `${BACKEND}/api/reddit/${sub}${afterToken ? `?after=${afterToken}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to load');
      }
      const data = await res.json();
      const children = data?.data?.children || [];

      let mapped;
      if (mood.isAudio) {
        // Audio posts: filter for self posts or links with audio
        mapped = children
          .map(c => c.data)
          .filter(p => p && (p.is_self || p.url?.includes('reddit.com') || p.selftext))
          .map(p => ({
            id: p.id,
            title: p.title,
            author: p.author,
            ups: p.ups,
            url: p.url,
            selftext: p.selftext,
            subreddit: p.subreddit,
            created: p.created_utc,
            type: 'audio',
            flair: p.link_flair_text,
          }));
      } else {
        // Visual posts: images + videos
        mapped = children
          .map(c => c.data)
          .filter(p => {
            if (!p) return false;
            const u = p.url_overridden_by_dest || p.url || '';
            return (
              (p.is_video && p.media?.reddit_video?.fallback_url) ||
              p.preview?.reddit_video_preview?.fallback_url ||
              p.post_hint === 'image' ||
              /\.(jpg|jpeg|png|gif|webp)$/i.test(u) ||
              u.includes('redgifs.com') ||
              u.includes('i.redd.it')
            );
          })
          .map(p => {
            const u = p.url_overridden_by_dest || p.url || '';
            const isVideo = !!(
              (p.is_video && p.media?.reddit_video?.fallback_url) ||
              p.preview?.reddit_video_preview?.fallback_url ||
              u.includes('redgifs.com')
            );
            return {
              id: p.id,
              title: p.title,
              author: p.author,
              ups: p.ups,
              url: isVideo
                ? (p.media?.reddit_video?.fallback_url || p.preview?.reddit_video_preview?.fallback_url || u)
                : (p.url_overridden_by_dest || p.url),
              thumbnail: p.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, '&') || '',
              subreddit: p.subreddit,
              type: isVideo ? 'video' : 'image',
              isRedgifs: u.includes('redgifs.com'),
            };
          });
      }

      const newAfter = data?.data?.after;
      setAfter(newAfter);
      setHasMore(!!newAfter);
      setPosts(prev => reset ? mapped : [...prev, ...mapped]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPosts([]);
    setAfter(null);
    setHasMore(true);
    setPlayingId(null);
    setSelectedAudio(null);
    fetchPosts(activeMood, null, true);
  }, [activeMood]);

  // Infinite scroll
  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !loading && hasMore) {
        fetchPosts(activeMood, after);
      }
    }, { rootMargin: '300px' });
    if (loadMoreRef.current) obs.observe(loadMoreRef.current);
    return () => obs.disconnect();
  }, [loading, hasMore, after, activeMood]);

  const handleFav = async (e, post) => {
    e.stopPropagation();
    if (isFavorite(post.id)) {
      await removeFavorite(post.id);
    } else {
      await addFavorite({ id: post.id, title: post.title, url: post.url, thumbnail: post.thumbnail || '', subreddit: post.subreddit });
    }
  };

  const breakpoints = { default: 3, 1100: 2, 700: 1 };

  return (
    <div className="pb-20">
      {/* Hero */}
      <div className="relative mb-8 rounded-3xl overflow-hidden bg-gradient-to-br from-rose-950/40 via-black to-purple-950/40 border border-white/10 p-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(244,63,94,0.15),_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(168,85,247,0.1),_transparent_60%)]" />
        <div className="relative z-10">
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-rose-300 via-pink-300 to-purple-300 mb-2">
            For Her ✨
          </h1>
          <p className="text-white/50 text-sm max-w-lg">
            Curated content that centers female pleasure — romantic, sensual, and from her perspective.
          </p>
        </div>
      </div>

      {/* Mood selector */}
      <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar mb-8">
        {MOODS.map(mood => (
          <button
            key={mood.id}
            onClick={() => setActiveMood(mood)}
            className={`flex flex-col items-start gap-1 px-5 py-3.5 rounded-2xl border whitespace-nowrap transition-all duration-300 shrink-0 ${
              activeMood.id === mood.id
                ? `bg-gradient-to-br ${mood.color} ${mood.border} scale-105`
                : 'bg-white/5 border-white/10 hover:bg-white/10'
            }`}
            style={activeMood.id === mood.id ? { boxShadow: `0 0 20px ${mood.glow}` } : {}}
          >
            <span className="text-xl">{mood.icon}</span>
            <span className="text-sm font-bold text-white">{mood.label}</span>
            <span className="text-[10px] text-white/40 max-w-[120px] leading-tight">{mood.desc}</span>
          </button>
        ))}
      </div>

      {/* Audio player modal */}
      {selectedAudio && (
        <AudioModal post={selectedAudio} onClose={() => setSelectedAudio(null)} />
      )}

      {/* Error */}
      {error && (
        <div className="flex flex-col items-center py-20 gap-3 text-center">
          <span className="text-5xl">🚫</span>
          <p className="text-white/60 text-lg">{error}</p>
          <button onClick={() => fetchPosts(activeMood, null, true)} className="px-6 py-2 bg-white/10 rounded-full text-sm font-bold hover:bg-white/20 transition-colors">
            Retry
          </button>
        </div>
      )}

      {/* Audio list */}
      {!error && activeMood.isAudio && (
        <div className="space-y-3">
          {posts.map(post => (
            <AudioCard key={post.id} post={post} onClick={() => setSelectedAudio(post)} isFav={isFavorite(post.id)} onFav={handleFav} />
          ))}
          {!loading && posts.length === 0 && <EmptyState />}
        </div>
      )}

      {/* Visual grid */}
      {!error && !activeMood.isAudio && (
        <Masonry breakpointCols={breakpoints} className="flex w-auto -ml-5" columnClassName="pl-5 bg-clip-padding">
          {posts.map(post => (
            <div key={post.id} className="mb-5 group relative rounded-2xl overflow-hidden border border-white/5 hover:border-white/20 transition-all duration-300 hover:-translate-y-1 cursor-pointer bg-black"
              onMouseEnter={() => post.type === 'video' && setPlayingId(post.id)}
              onMouseLeave={() => post.type === 'video' && setPlayingId(null)}
            >
              <VisualCard post={post} isPlaying={playingId === post.id} isFav={isFavorite(post.id)} onFav={handleFav} mood={activeMood} />
            </div>
          ))}
        </Masonry>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${activeMood.glow} transparent transparent transparent` }} />
        </div>
      )}

      <div ref={loadMoreRef} className="h-4" />
    </div>
  );
}

function VisualCard({ post, isPlaying, isFav, onFav, mood }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [isPlaying]);

  return (
    <div className="relative">
      {post.type === 'video' ? (
        <div className="aspect-[9/16] bg-black">
          <video
            ref={videoRef}
            src={post.url}
            poster={post.thumbnail}
            loop muted playsInline
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="bg-black">
          <img
            src={post.url}
            alt={post.title}
            className="w-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Actions */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0">
        <button
          onClick={e => onFav(e, post)}
          className={`w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md border transition-all ${
            isFav ? 'bg-rose-500/30 border-rose-400 text-rose-400' : 'bg-black/50 border-white/20 text-white hover:border-rose-400 hover:text-rose-400'
          }`}
        >
          <svg className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      </div>

      {/* Info */}
      <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-1 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
        <p className="text-xs font-bold text-white line-clamp-2 mb-1">{post.title}</p>
        <p className="text-[10px] text-white/40">r/{post.subreddit}</p>
      </div>

      {/* Type badge */}
      {post.type === 'video' && (
        <div className="absolute top-3 left-3 w-6 h-6 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <svg className="w-3 h-3 text-white fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
        </div>
      )}
    </div>
  );
}

function AudioCard({ post, onClick, isFav, onFav }) {
  const timeAgo = (ts) => {
    const diff = Date.now() / 1000 - ts;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  // Parse flair tags like [M4F], [F4M], [F4F] etc.
  const flairMatch = post.title.match(/\[([MF][4][MFA-Z]+)\]/i);
  const flair = flairMatch ? flairMatch[1] : post.flair;

  const flairColor = flair?.startsWith('M4F') ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
    : flair?.startsWith('F4M') ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
    : flair?.startsWith('F4F') ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
    : 'bg-white/10 text-white/50 border-white/10';

  return (
    <div
      onClick={onClick}
      className="group flex items-center gap-4 p-4 bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-white/20 rounded-2xl cursor-pointer transition-all duration-200"
    >
      {/* Play icon */}
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
        <svg className="w-5 h-5 text-green-400 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {flair && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${flairColor}`}>
              [{flair}]
            </span>
          )}
          <span className="text-[10px] text-white/30">u/{post.author}</span>
          <span className="text-[10px] text-white/20">{timeAgo(post.created)}</span>
        </div>
        <p className="text-sm font-medium text-white line-clamp-2 leading-snug">{post.title}</p>
      </div>

      {/* Upvotes + fav */}
      <div className="flex flex-col items-center gap-2 shrink-0">
        <button
          onClick={e => onFav(e, post)}
          className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all ${
            isFav ? 'bg-rose-500/20 border-rose-400 text-rose-400' : 'bg-white/5 border-white/10 text-white/30 hover:text-rose-400 hover:border-rose-400'
          }`}
        >
          <svg className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
        <span className="text-[10px] text-white/30 font-bold">{post.ups > 1000 ? `${(post.ups/1000).toFixed(1)}k` : post.ups}</span>
      </div>
    </div>
  );
}

function AudioModal({ post, onClose }) {
  // GWA posts link to reddit comments — open in new tab
  const handleListen = () => {
    window.open(`https://reddit.com/r/${post.subreddit}/comments/${post.id}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-[#0d0d0d] border border-white/10 rounded-3xl p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 flex items-center justify-center shrink-0">
            <span className="text-2xl">🎧</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/40 mb-0.5">r/{post.subreddit} · u/{post.author}</p>
            <h3 className="text-sm font-bold text-white leading-snug line-clamp-3">{post.title}</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white text-lg transition-colors shrink-0">×</button>
        </div>

        {/* Waveform placeholder */}
        <div className="flex items-center gap-1 justify-center h-12 mb-5 px-4">
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={i}
              className="w-1 rounded-full bg-green-500/40"
              style={{ height: `${20 + Math.sin(i * 0.8) * 15 + Math.random() * 10}px` }}
            />
          ))}
        </div>

        {/* Note */}
        <p className="text-xs text-white/30 text-center mb-4">
          Audio erotica opens on Reddit — best experienced with headphones 🎧
        </p>

        <button
          onClick={handleListen}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold transition-all shadow-lg shadow-green-900/30"
        >
          Listen on Reddit →
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center py-20 gap-3 text-white/30">
      <span className="text-5xl">🌙</span>
      <p className="text-lg">Nothing here yet</p>
    </div>
  );
}
