import { useState, useEffect, useRef } from 'react';
import Masonry from 'react-masonry-css';
import { LazyVideo } from '../components/LazyMedia';
import VideoModal from '../components/VideoModal';
import { useFavorites } from '../lib/useFavorites';
import { useFavoriteSubreddits } from '../lib/useFavoriteSubreddits';
import { MOODS } from '../lib/subreddits';
import SubredditBrowser from '../components/SubredditBrowser';

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL;

export default function VideoGallery() {
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSubreddit, setSelectedSubreddit] = useState('');
  const [availableSubreddits, setAvailableSubreddits] = useState([]);
  const [afterId, setAfterId] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const loadingRef = useRef(null);
  const [playingVideoId, setPlayingVideoId] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const { isFavorite, addFavorite, removeFavorite } = useFavorites();
  const { favoriteSubreddits, addFavoriteSubreddit, removeFavoriteSubreddit, isFavoriteSubreddit } = useFavoriteSubreddits();
  const [showBrowser, setShowBrowser] = useState(false);
  const [customSubreddit, setCustomSubreddit] = useState('');
  const [usingCustomSubreddit, setUsingCustomSubreddit] = useState(false);
  const [customAfterId, setCustomAfterId] = useState(null);
  const [customHasMore, setCustomHasMore] = useState(true);
  const [selectedMood, setSelectedMood] = useState(null);
  const [aiVibe, setAiVibe] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchAfterId, setSearchAfterId] = useState(null);
  const [searchHasMore, setSearchHasMore] = useState(true);

  useEffect(() => {
    const fetchSubreddits = async () => {
      try {
        const response = await fetch(`${BACKEND_API_URL}/api/subreddits`);
        const data = await response.json();
        setAvailableSubreddits(data.subreddits);
        setSelectedSubreddit(data.subreddits[0]);
      } catch (err) {
        console.error('Error fetching subreddits:', err);
        setError('Failed to load subreddits');
      }
    };
    fetchSubreddits();
  }, []);

  const calculateHeat = (ups, created) => {
    if (ups > 5000) return 'nuclear';
    if (ups > 1000) return 'fire';
    if (ups > 500) return 'spicy';
    return null;
  };

  const fetchVideos = async (isNewSubreddit = false) => {
    const isCustom = usingCustomSubreddit;
    const isMood = !!selectedMood;
    const isSearch = isSearchMode;
    
    let sub = selectedSubreddit;
    if (isCustom) sub = customSubreddit.trim();
    if (isMood) sub = selectedMood.subreddits.join('+');

    const after = isSearch ? (isNewSubreddit ? '' : searchAfterId) : 
                (isCustom || isMood) ? (isNewSubreddit ? '' : customAfterId) : 
                (isNewSubreddit ? '' : afterId);
    
    const hasMoreCheck = isSearch ? (isNewSubreddit || searchHasMore) :
                       (isCustom || isMood) ? (isNewSubreddit || customHasMore) : 
                       (isNewSubreddit || hasMore);

    if (!isSearch && (!sub || !hasMoreCheck)) return;
    if (isSearch && (!searchQuery || !hasMoreCheck)) return;

    try {
      setIsLoading(true);
      setError(null);
      
      let url;
      if (isSearch) {
        url = `${BACKEND_API_URL}/api/search?q=${encodeURIComponent(searchQuery)}${after ? `&after=${after}` : ''}`;
      } else {
        url = `${BACKEND_API_URL}/api/reddit/${sub}${after ? `?after=${after}` : ''}`;
      }
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      
      const vids = (data?.data?.children || [])
        .map(post => post?.data)
        .filter(p => {
          if (!p) return false;
          const url = p.url_overridden_by_dest || p.url || '';
          return (
            (p.is_video && p.media?.reddit_video?.fallback_url) ||
            p.preview?.reddit_video_preview?.fallback_url ||
            url.includes('redgifs.com') ||
            url.includes('v.redd.it')
          );
        })
        .map(p => ({
          id: p.id,
          title: p.title,
          url: p?.media?.reddit_video?.fallback_url || p?.preview?.reddit_video_preview?.fallback_url || '',
          thumbnail: p?.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, '&') || '',
          subreddit: p.subreddit,
          heat: calculateHeat(p.ups, p.created_utc),
          originalUrl: p.url_overridden_by_dest || p.url,
          isRedgifs: (p.url_overridden_by_dest || p.url || '').includes('redgifs.com')
        }))
        .filter(p => p.url || p.isRedgifs);

      const newAfter = data?.data?.after;
      
      if (isSearch) {
        setSearchAfterId(newAfter);
        setSearchHasMore(!!newAfter && vids.length > 0);
      } else if (isCustom || isMood) {
        setCustomAfterId(newAfter);
        setCustomHasMore(!!newAfter && vids.length > 0);
      } else {
        setAfterId(newAfter);
        setHasMore(!!newAfter && vids.length > 0);
      }
      
      setVideos(prev => isNewSubreddit ? vids : [...prev, ...vids]);
    } catch (err) {
      setError('Failed to load videos.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isSearchMode) {
      if (searchQuery) fetchVideos(true);
    } else if (selectedMood) {
      fetchVideos(true);
    } else if (usingCustomSubreddit) {
      if (customSubreddit) fetchVideos(true);
    } else if (selectedSubreddit) {
      fetchVideos(true);
    }
  }, [selectedSubreddit, usingCustomSubreddit, selectedMood, isSearchMode, searchQuery]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading) {
          fetchVideos();
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );
    
    if (loadingRef.current) observer.observe(loadingRef.current);
    return () => observer.disconnect();
  }, [isLoading, hasMore, customHasMore]);

  const handleFavoriteClick = async (e, video) => {
    e.stopPropagation();
    if (isFavorite(video.id)) {
      await removeFavorite(video.id);
    } else {
      await addFavorite({ ...video, subreddit: video.subreddit });
    }
  };

  const handleDownload = async (e, item) => {
    e.stopPropagation();
    try {
      const response = await fetch(item.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${item.title.slice(0, 20)}.${item.url.split('.').pop()}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      window.open(item.url, '_blank');
    }
  };

  const handleMoodSelect = (mood) => {
    setSelectedMood(mood);
    setUsingCustomSubreddit(false);
    setIsSearchMode(false);
    setSearchQuery('');
    setCustomSubreddit('');
    setVideos([]);
  };

  const handleAiMood = async () => {
    const input = aiVibe.trim();
    if (!input || aiLoading) return;
    setAiLoading(true);
    setVideos([]);
    try {
      const res = await fetch(`${BACKEND_API_URL}/api/ai/mood`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vibe: input }),
      });
      const data = await res.json();

      if (data.intent === 'search' && data.query) {
        // AI decided this is a keyword/name search — fetch directly
        setSelectedMood(null);
        setUsingCustomSubreddit(false);
        setIsSearchMode(true);
        setSearchQuery(data.query);
        setVideos([]);
        // Fetch directly since state updates are async
        try {
          setIsLoading(true);
          const url = `${BACKEND_API_URL}/api/search?q=${encodeURIComponent(data.query)}`;
          const r = await fetch(url);
          if (!r.ok) throw new Error('Search failed');
          const d = await r.json();
          const vids = (d?.data?.children || [])
            .map(post => post?.data)
            .filter(p => {
              if (!p) return false;
              const u = p.url_overridden_by_dest || p.url || '';
              return (
                (p.is_video && p.media?.reddit_video?.fallback_url) ||
                p.preview?.reddit_video_preview?.fallback_url ||
                u.includes('redgifs.com') ||
                u.includes('v.redd.it')
              );
            })
            .map(p => ({
              id: p.id,
              title: p.title,
              url: p?.media?.reddit_video?.fallback_url || p?.preview?.reddit_video_preview?.fallback_url || '',
              thumbnail: p?.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, '&') || '',
              subreddit: p.subreddit,
              heat: calculateHeat(p.ups, p.created_utc),
              originalUrl: p.url_overridden_by_dest || p.url,
              isRedgifs: (p.url_overridden_by_dest || p.url || '').includes('redgifs.com')
            }))
            .filter(p => p.url || p.isRedgifs);
          setSearchAfterId(d?.data?.after);
          setSearchHasMore(!!d?.data?.after && vids.length > 0);
          setVideos(vids);
        } catch (e) {
          console.error('Search fetch error:', e);
        } finally {
          setIsLoading(false);
        }
      } else if (data.intent === 'mood' && data.subreddits?.length) {
        // AI decided this is a vibe — pick subreddits
        handleMoodSelect({ id: 'ai', label: `✨ ${input}`, subreddits: data.subreddits });
      }
    } catch (err) {
      console.error('AI smart search error:', err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleGlobalSearch = (query) => {
    setSearchQuery(query);
    setIsSearchMode(true);
    setSelectedMood(null);
    setUsingCustomSubreddit(false);
    setVideos([]);
    fetchVideos(true);
  };

  const breakpointColumns = { default: 4, 1440: 3, 1100: 2, 700: 1 };

  const [showNav, setShowNav] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        setShowNav(false);
      } else {
        setShowNav(true);
      }
      
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <div 
        className={`flex flex-col gap-4 mb-12 sticky top-20 z-30 transition-transform duration-300 ${
          showNav ? 'translate-y-0' : '-translate-y-[200%]'
        }`}
      >
        {/* Mood Selector */}
        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar max-w-full mx-auto">
          {MOODS.map(mood => (
            <button
              key={mood.id}
              onClick={() => handleMoodSelect(mood)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-300 border ${
                selectedMood?.id === mood.id
                  ? 'bg-neon-pink text-white border-neon-pink shadow-[0_0_15px_rgba(255,47,86,0.4)] scale-105'
                  : 'bg-black/60 text-neutral-400 border-white/10 hover:bg-white/10 hover:text-white backdrop-blur-xl'
              }`}
            >
              <span>{mood.icon}</span>
              <span>{mood.label}</span>
            </button>
          ))}
          <button
            onClick={() => { 
                setSelectedMood(null); 
                setUsingCustomSubreddit(false); 
                setIsSearchMode(false);
                setSearchQuery('');
                setVideos([]); 
            }}
            className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-300 border ${
              !selectedMood && !usingCustomSubreddit && !isSearchMode
                ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.3)]'
                : 'bg-black/60 text-neutral-400 border-white/10 hover:bg-white/10 hover:text-white backdrop-blur-xl'
            }`}
          >
            All
          </button>
        </div>

        <div className="flex items-center gap-2 bg-black/70 backdrop-blur-xl p-2 rounded-2xl border border-white/10 shadow-2xl mx-auto w-fit">
          {/* Browse button */}
          <button
            onClick={() => setShowBrowser(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-sm font-bold transition-colors border border-white/10"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            Browse
          </button>

          <div className="w-px bg-white/20 h-6"></div>

          {/* AI Vibe input */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all duration-300 ${
            selectedMood?.id === 'ai'
              ? 'bg-purple-500/20 border-purple-500/60 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
              : isSearchMode && searchQuery === aiVibe.trim()
              ? 'bg-blue-500/10 border-blue-500/40'
              : 'bg-white/5 border-white/10'
          }`}>
            <span className="text-sm">✨</span>
            <input
              type="text"
              placeholder="search or describe a vibe..."
              value={aiVibe}
              onChange={e => setAiVibe(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAiMood()}
              className="bg-transparent text-white text-sm placeholder-white/30 outline-none w-36 focus:w-48 transition-all"
            />
            <button
              onClick={handleAiMood}
              disabled={aiLoading || !aiVibe.trim()}
              className="text-purple-400 hover:text-purple-300 disabled:opacity-30 transition-colors"
            >
              {aiLoading
                ? <span className="w-3.5 h-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin inline-block"></span>
                : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              }
            </button>
          </div>

          <div className="w-px bg-white/20 h-6"></div>

          {/* Active subreddit pill */}
          <div className="flex items-center gap-2 px-3 py-2">
            <span className="text-white font-bold text-sm">
              {isSearchMode && searchQuery
                ? `🔍 "${searchQuery}"`
                : usingCustomSubreddit && customSubreddit
                ? `r/${customSubreddit}`
                : selectedSubreddit
                ? `r/${selectedSubreddit}`
                : 'All'}
            </span>
            {(usingCustomSubreddit ? customSubreddit : selectedSubreddit) && (
              <button
                onClick={() => {
                  const sub = usingCustomSubreddit ? customSubreddit.trim() : selectedSubreddit;
                  isFavoriteSubreddit(sub) ? removeFavoriteSubreddit(sub) : addFavoriteSubreddit(sub);
                }}
                className={`text-sm transition-colors ${
                  isFavoriteSubreddit(usingCustomSubreddit ? customSubreddit.trim() : selectedSubreddit)
                    ? 'text-yellow-400'
                    : 'text-white/30 hover:text-yellow-400'
                }`}
              >
                {isFavoriteSubreddit(usingCustomSubreddit ? customSubreddit.trim() : selectedSubreddit) ? '⭐' : '☆'}
              </button>
            )}
          </div>

          <div className="w-px bg-white/20 h-6"></div>

          {/* Custom input */}
          <input
            type="text"
            placeholder="Custom r/..."
            value={customSubreddit}
            onChange={(e) => setCustomSubreddit(e.target.value)}
            className="bg-transparent text-white px-3 py-2 outline-none w-28 focus:w-40 transition-all text-sm placeholder-white/30"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && customSubreddit.trim()) {
                setUsingCustomSubreddit(true);
                setSelectedMood(null);
                fetchVideos(true);
              }
            }}
          />
          <button
            onClick={() => {
              if (customSubreddit.trim()) {
                setUsingCustomSubreddit(true);
                setSelectedMood(null);
                fetchVideos(true);
              }
            }}
            className="bg-neon-pink/80 hover:bg-neon-pink px-4 py-2 rounded-xl text-sm font-bold transition-colors cursor-pointer text-white"
          >
            GO
          </button>
        </div>
      </div>

      {showBrowser && (
        <SubredditBrowser
          onSelect={(sub) => {
            setSearchQuery('');
            setIsSearchMode(false);
            setCustomSubreddit('');
            setUsingCustomSubreddit(false);
            setSelectedMood(null);
            setSelectedSubreddit(sub);
          }}
          onGlobalSearch={handleGlobalSearch}
          onClose={() => setShowBrowser(false)}
        />
      )}

      <Masonry breakpointCols={breakpointColumns} className="flex w-auto -ml-6" columnClassName="pl-6 bg-clip-padding">
        {videos.map(vid => (
          <div 
            key={vid.id} 
            className="group relative mb-6 bg-dark-card rounded-2xl overflow-hidden border border-white/5 shadow-lg transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_10px_40px_rgba(0,0,0,0.5)] hover:border-white/20 cursor-pointer"
            onMouseEnter={() => setPlayingVideoId(vid.id)}
            onMouseLeave={() => setPlayingVideoId(null)}
            onClick={() => setSelectedVideo(vid)}
          >
            <div className="relative aspect-[9/16] bg-black">
              <LazyVideo 
                src={vid.url}
                poster={vid.thumbnail}
                isPlaying={playingVideoId === vid.id}
                title={vid.title}
                isLiked={isFavorite(vid.id)}
                onToggleLike={(e) => handleFavoriteClick(e, vid)}
                onDownload={(e) => handleDownload(e, vid)}
                className="w-full h-full"
                heat={vid.heat}
              />
            </div>
          </div>
        ))}
      </Masonry>
      <div ref={loadingRef} className="h-20 flex items-center justify-center">
        {isLoading && <div className="w-8 h-8 border-4 border-neon-pink border-t-transparent rounded-full animate-spin"></div>}
      </div>

      {selectedVideo && <VideoModal video={selectedVideo} isRedgifs={selectedVideo.isRedgifs} originalUrl={selectedVideo.originalUrl} onClose={() => setSelectedVideo(null)} />}
    </>
  );
}
