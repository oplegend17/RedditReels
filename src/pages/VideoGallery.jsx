import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import Masonry from 'react-masonry-css';
import { LazyVideo } from '../components/LazyMedia';
import VideoModal from '../components/VideoModal';
import DownloadAllModal from '../components/DownloadAllModal';
import { useFavorites } from '../lib/useFavorites';
import { useDownloads } from '../lib/useDownloads';
import { useFavoriteSubreddits } from '../lib/useFavoriteSubreddits';
import { MOODS } from '../lib/subreddits';
import SubredditBrowser from '../components/SubredditBrowser';
import { useHistory } from '../lib/useHistory';

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL;

export default function VideoGallery() {
  const { profile } = useOutletContext() || {};
  const restrictionActive = profile?.restrictionType === 'keyword' && profile?.restrictionKeyword;
  const restrictionKeyword = profile?.restrictionKeyword || '';

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
  const { addDownload } = useDownloads();
  const { markAsSeen } = useHistory();
  const { favoriteSubreddits, addFavoriteSubreddit, removeFavoriteSubreddit, isFavoriteSubreddit } = useFavoriteSubreddits();
  const [showBrowser, setShowBrowser] = useState(false);
  const [discordMode, setDiscordMode] = useState(false);
  const [videoSizes, setVideoSizes] = useState({}); // id -> bytes | null
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
  const [showDownloadAll, setShowDownloadAll] = useState(false);

  const [sourceProvider, setSourceProvider] = useState('redgifs'); // 'redgifs' (primary) | 'reddit'
  const [redgifsPage, setRedgifsPage] = useState(1);
  const [redgifsHasMore, setRedgifsHasMore] = useState(true);
  const [sortOrder, setSortOrder] = useState('trending'); // 'trending' | 'best' | 'latest'
  const [redgifsTags, setRedgifsTags] = useState([
    'Amateur', 'Cosplay', 'Solo Female', 'Hardcore', 'Fitness', 'Sensual', 'Asian', 'Latina', 'MILF', 'Threesome', 'Brunette', 'Blonde', 'Bikini', 'Hentai'
  ]);
  const [selectedRedgifsTag, setSelectedRedgifsTag] = useState(null);

  useEffect(() => {
    if (sourceProvider === 'redgifs') {
      fetch(`${BACKEND_API_URL}/api/redgifs/tags/trending`)
        .then(res => res.json())
        .then(data => {
          if (data.tags?.length) setRedgifsTags(data.tags);
        })
        .catch(() => {});
    }
  }, [sourceProvider]);

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
    // RedGIFs API Provider Branch (Primary)
    if (sourceProvider === 'redgifs') {
      if (!isNewSubreddit && (isLoading || !redgifsHasMore)) return;

      if (isNewSubreddit) {
        setRedgifsPage(1);
        setRedgifsHasMore(true);
      }

      const pageToFetch = isNewSubreddit ? 1 : redgifsPage;

      let effectiveQuery = 'trending';
      if (restrictionActive) {
        effectiveQuery = searchQuery.trim() ? `${searchQuery.trim()} ${restrictionKeyword}` : restrictionKeyword;
      } else if (isSearchMode && searchQuery) {
        effectiveQuery = searchQuery.trim();
      } else if (selectedRedgifsTag) {
        effectiveQuery = selectedRedgifsTag;
      } else if (selectedMood) {
        effectiveQuery = selectedMood.id === 'soft' ? 'sensual' : (selectedMood.id === 'trending' ? 'trending' : selectedMood.id);
      }

      try {
        setIsLoading(true);
        setError(null);
        const endpoint = (effectiveQuery && effectiveQuery !== 'trending')
          ? `${BACKEND_API_URL}/api/redgifs/search?query=${encodeURIComponent(effectiveQuery)}&order=${sortOrder}&page=${pageToFetch}`
          : `${BACKEND_API_URL}/api/redgifs/trending?order=${sortOrder}&page=${pageToFetch}`;

        const response = await fetch(endpoint);
        if (!response.ok) {
          throw new Error('Failed to fetch from RedGIFs');
        }
        const data = await response.json();
        let vids = (data.posts || []).map(p => ({
          id: p.id,
          title: p.title,
          url: p.url,
          thumbnail: p.thumbnail,
          subreddit: p.subreddit,
          heat: calculateHeat(p.ups, p.created_utc),
          originalUrl: p.permalink,
          isRedgifs: true
        }));

        if (restrictionActive) {
          const kw = restrictionKeyword.toLowerCase().trim();
          vids = vids.filter(v => {
            const title = (v.title || '').toLowerCase();
            const sub = (v.subreddit || '').toLowerCase();
            return title.includes(kw) || sub.includes(kw);
          });
        }

        setRedgifsPage(data.nextPage || pageToFetch + 1);
        setRedgifsHasMore(data.hasMore ?? (vids.length > 0));
        setVideos(prev => isNewSubreddit ? vids : [...prev, ...vids]);
      } catch (err) {
        console.error('RedGIFs fetch error:', err);
        setError('Failed to load RedGIFs content.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Reddit API Provider Branch
    const isCustom = usingCustomSubreddit;
    const isMood = !!selectedMood;
    const isSearch = isSearchMode || restrictionActive;
    
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
    if (isSearch && !restrictionActive && (!searchQuery || !hasMoreCheck)) return;

    try {
      setIsLoading(true);
      setError(null);
      
      let url;
      if (isSearch) {
        // Enforce restriction keyword by appending it or using it as fallback
        const effectiveQuery = restrictionActive
          ? (searchQuery.trim() ? `${searchQuery.trim()} ${restrictionKeyword}` : restrictionKeyword)
          : searchQuery;
        url = `${BACKEND_API_URL}/api/search?q=${encodeURIComponent(effectiveQuery)}${after ? `&after=${after}` : ''}`;
      } else {
        url = `${BACKEND_API_URL}/api/reddit/${sub}${after ? `?after=${after}` : ''}`;
      }
      const response = await fetch(url);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const msg = errData.error || 'This subreddit is unavailable';
        setError(msg);
        setVideos([]);
        setIsLoading(false);
        return;
      }
      const data = await response.json();
      
      let vids = (data?.data?.children || [])
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

      // Perform strict keyword filtering on client side if restriction active
      if (restrictionActive) {
        const kw = restrictionKeyword.toLowerCase().trim();
        vids = vids.filter(v => {
          const title = (v.title || '').toLowerCase();
          const sub = (v.subreddit || '').toLowerCase();
          const url = (v.url || v.originalUrl || '').toLowerCase();
          return title.includes(kw) || sub.includes(kw) || url.includes(kw);
        });
      }

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
    setVideos([]);
    if (restrictionActive) {
      fetchVideos(true);
    } else if (isSearchMode) {
      if (searchQuery) fetchVideos(true);
    } else if (selectedMood) {
      fetchVideos(true);
    } else if (usingCustomSubreddit) {
      if (customSubreddit) fetchVideos(true);
    } else if (selectedSubreddit || sourceProvider === 'redgifs') {
      fetchVideos(true);
    }
  }, [selectedSubreddit, usingCustomSubreddit, selectedMood, isSearchMode, searchQuery, restrictionActive, sourceProvider, sortOrder]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading) {
          const canLoad = sourceProvider === 'redgifs' ? redgifsHasMore : true;
          if (canLoad) fetchVideos(false);
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );
    
    if (loadingRef.current) observer.observe(loadingRef.current);
    return () => observer.disconnect();
  }, [isLoading, hasMore, customHasMore, redgifsHasMore, sourceProvider]);

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
      const mergeUrl = `${BACKEND_API_URL}/api/merge-video?url=${encodeURIComponent(item.url)}`;
      const response = await fetch(mergeUrl);
      const blob = await response.blob();
      
      // Track the download in user history
      await addDownload({
        id: item.id,
        title: item.title,
        url: item.url,
        thumbnail: item.thumbnail,
        subreddit: item.subreddit
      });

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

  // Background size-check: HEAD each video URL we haven't checked yet
  useEffect(() => {
    if (!discordMode) return;
    const unchecked = videos.filter(v => v.url && videoSizes[v.id] === undefined);
    if (!unchecked.length) return;
    unchecked.forEach(async (v) => {
      try {
        const res = await fetch(v.url, { method: 'HEAD' });
        const cl = res.headers.get('content-length');
        setVideoSizes(prev => ({ ...prev, [v.id]: cl ? parseInt(cl) : null }));
      } catch {
        setVideoSizes(prev => ({ ...prev, [v.id]: null }));
      }
    });
  }, [videos, discordMode]);

  // Clear sizes when video list resets
  useEffect(() => {
    setVideoSizes({});
  }, [selectedSubreddit, selectedMood, usingCustomSubreddit, isSearchMode]);

  const handleMoodSelect = (mood) => {
    setSelectedMood(mood);
    setSelectedRedgifsTag(null);
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

    // In RedGIFs mode, search directly via RedGIFs API
    if (sourceProvider === 'redgifs') {
      setSelectedSubreddit(null);
      setSelectedMood(null);
      setUsingCustomSubreddit(false);
      setIsSearchMode(true);
      setSearchQuery(input);
      setAiLoading(false);
      return;
    }

    try {
      const res = await fetch(`${BACKEND_API_URL}/api/ai/mood`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vibe: input }),
      });
      const data = await res.json();

      setSelectedSubreddit(null);
      if (data.intent === 'search' && data.query) {
        setSelectedMood(null);
        setUsingCustomSubreddit(false);
        setIsSearchMode(true);
        setSearchQuery(data.query);
      } else if (data.intent === 'mood' && data.subreddits?.length) {
        handleMoodSelect({ id: 'ai', label: `✨ ${input}`, subreddits: data.subreddits });
      } else {
        setSelectedMood(null);
        setUsingCustomSubreddit(false);
        setIsSearchMode(true);
        setSearchQuery(input);
      }
    } catch (err) {
      console.warn('AI router fallback to direct search:', err);
      setSelectedSubreddit(null);
      setSelectedMood(null);
      setUsingCustomSubreddit(false);
      setIsSearchMode(true);
      setSearchQuery(input);
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

  const getActiveSubredditString = () => {
    if (selectedMood) {
      return selectedMood.subreddits.join('+');
    }
    if (usingCustomSubreddit && customSubreddit) {
      return customSubreddit.trim();
    }
    return selectedSubreddit;
  };

  const breakpointColumns = { default: 4, 1440: 3, 1100: 2, 900: 2, 700: 1 };
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
      {restrictionActive && (
        <div className="w-full p-4 md:p-5 bg-neon-pink/10 border border-neon-pink/30 rounded-2xl flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-xl">🔒</span>
            <div>
              <p className="text-xs font-black uppercase text-neon-pink tracking-wider">Restricted Feed Guard Active</p>
              <p className="text-sm font-semibold text-white/80">Showing exclusive results matching <span className="font-mono text-neon-pink/90">"{restrictionKeyword}"</span></p>
            </div>
          </div>
          <span className="text-xs text-neon-pink/60 font-mono hidden sm:inline">Feed Filtered & Secure</span>
        </div>
      )}

      <div 
        className={`flex flex-col gap-3 mb-8 sticky top-16 md:top-20 z-30 transition-transform duration-300 ${
          showNav ? 'translate-y-0' : '-translate-y-[200%]'
        }`}
      >
        {/* Mood pills — scrollable row (Reddit mode) */}
        {!restrictionActive && sourceProvider === 'reddit' && (
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {MOODS.map(mood => (
              <button
                key={mood.id}
                onClick={() => handleMoodSelect(mood)}
                className={`flex items-center gap-1.5 px-3 md:px-5 py-2 rounded-full text-xs md:text-sm font-bold whitespace-nowrap transition-all duration-300 border ${
                  selectedMood?.id === mood.id
                    ? 'bg-neon-pink text-white border-neon-pink shadow-[0_0_15px_rgba(255,47,86,0.4)] scale-105'
                    : 'bg-black/60 text-neutral-400 border-white/10 hover:bg-white/10 hover:text-white backdrop-blur-xl'
                }`}
              >
                <span>{mood.icon}</span>
                <span className="hidden sm:inline">{mood.label.replace(/^.+? /, '')}</span>
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
              className={`px-3 md:px-5 py-2 rounded-full text-xs md:text-sm font-bold whitespace-nowrap transition-all duration-300 border ${
                !selectedMood && !usingCustomSubreddit && !isSearchMode
                  ? 'bg-white text-black border-white'
                  : 'bg-black/60 text-neutral-400 border-white/10 hover:bg-white/10 hover:text-white backdrop-blur-xl'
              }`}
            >
              All
            </button>
          </div>
        )}

        {/* 🏷️ RedGIFs Tags bar — scrollable row (RedGIFs mode) */}
        {!restrictionActive && sourceProvider === 'redgifs' && (
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar items-center">
            <div className="flex items-center gap-1 bg-red-600/10 border border-red-500/30 px-3 py-1.5 rounded-full text-xs font-black text-red-400 shrink-0">
              🏷️ RedGIFs Tags
            </div>
            {redgifsTags.map(tag => (
              <button
                key={tag}
                onClick={() => {
                  if (selectedRedgifsTag === tag) {
                    setSelectedRedgifsTag(null);
                  } else {
                    setSelectedRedgifsTag(tag);
                    setSelectedMood(null);
                    setIsSearchMode(false);
                    setSearchQuery('');
                  }
                  fetchVideos(true);
                }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 border cursor-pointer ${
                  selectedRedgifsTag === tag
                    ? 'bg-gradient-to-r from-red-600 to-neon-pink text-white border-red-500 shadow-[0_0_12px_rgba(255,47,86,0.4)] scale-105'
                    : 'bg-black/60 text-neutral-300 border-white/10 hover:bg-white/10 hover:text-white backdrop-blur-xl'
                }`}
              >
                <span>#{tag}</span>
              </button>
            ))}
          </div>
        )}

        {/* Browse / search bar — cohesive control strip */}
        <div className="bg-[#15171e] p-1.5 rounded-xl flex flex-wrap items-center gap-2 w-full md:w-fit mx-auto border border-white/10 shadow-lg">
          {/* Content Source Provider Switcher */}
          <div className="flex items-center bg-black/40 p-1 rounded-lg border border-white/10 shrink-0">
            <button
              onClick={() => { setSourceProvider('reddit'); setSelectedRedgifsTag(null); setVideos([]); }}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                sourceProvider === 'reddit'
                  ? 'bg-neon-pink text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Reddit
            </button>
            <button
              onClick={() => { setSourceProvider('redgifs'); setSelectedRedgifsTag(null); setVideos([]); }}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                sourceProvider === 'redgifs'
                  ? 'bg-red-600 text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <span>RedGIFs</span>
              <span className="text-[9px] uppercase tracking-wider bg-white/20 px-1 rounded font-black">API</span>
            </button>
          </div>

          {/* 🔥 Trending Order Switcher (RedGIFs Mode) */}
          {sourceProvider === 'redgifs' && (
            <div className="flex items-center bg-black/40 p-1 rounded-lg border border-white/10 shrink-0">
              <button
                onClick={() => { setSortOrder('trending'); fetchVideos(true); }}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  sortOrder === 'trending'
                    ? 'bg-white/15 text-white font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                🔥 Trending
              </button>
              <button
                onClick={() => { setSortOrder('best'); fetchVideos(true); }}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  sortOrder === 'best'
                    ? 'bg-white/15 text-white font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                🌟 Best
              </button>
              <button
                onClick={() => { setSortOrder('latest'); fetchVideos(true); }}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  sortOrder === 'latest'
                    ? 'bg-white/15 text-white font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                ⚡ Latest
              </button>
            </div>
          )}

          {/* Browse */}
          {!restrictionActive && sourceProvider === 'reddit' && (
            <button
              onClick={() => setShowBrowser(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-xs font-semibold transition-all border border-white/10"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span className="hidden sm:inline">Browse</span>
            </button>
          )}

          {/* AI / RedGIFs Search Bar */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-black/40 border-white/10 w-full sm:w-auto flex-1 min-w-[140px]">
            <span className="text-xs shrink-0">{sourceProvider === 'redgifs' ? '🔎' : '✨'}</span>
            <input
              type="text"
              placeholder={
                restrictionActive 
                  ? "search restricted feed..." 
                  : (sourceProvider === 'redgifs' ? "Search RedGIFs tags or terms..." : "search or vibe...")
              }
              value={aiVibe}
              onChange={e => setAiVibe(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (restrictionActive) {
                    setSearchQuery(aiVibe);
                    fetchVideos(true);
                  } else {
                    handleAiMood();
                  }
                }
              }}
              className="bg-transparent text-white text-xs font-medium placeholder-white/30 outline-none min-w-0 flex-1"
            />
            <button
              onClick={() => {
                if (restrictionActive) {
                  setSearchQuery(aiVibe);
                  fetchVideos(true);
                } else {
                  handleAiMood();
                }
              }}
              disabled={aiLoading || !aiVibe.trim()}
              className="text-neon-blue hover:text-white disabled:opacity-30 transition-colors shrink-0"
            >
              {aiLoading
                ? <span className="w-3.5 h-3.5 border-2 border-neon-blue border-t-transparent rounded-full animate-spin inline-block" />
                : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              }
            </button>
          </div>

          {/* Active Tag Chip (RedGIFs Mode) */}
          {sourceProvider === 'redgifs' && selectedRedgifsTag && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/20 border border-red-500/40 text-xs font-bold text-white shrink-0 shadow-[0_0_10px_rgba(239,68,68,0.2)]">
              <span>🏷️ #{selectedRedgifsTag}</span>
              <button
                onClick={() => {
                  setSelectedRedgifsTag(null);
                  fetchVideos(true);
                }}
                className="text-white/60 hover:text-white text-xs ml-1"
                title="Clear tag"
              >
                ✕
              </button>
            </div>
          )}

          {/* Active sub + star chip (Reddit Mode Only) */}
          {!restrictionActive && sourceProvider === 'reddit' && (selectedSubreddit || usingCustomSubreddit) && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold">
              <span className="text-white truncate max-w-[100px] md:max-w-xs" title={usingCustomSubreddit && customSubreddit ? `r/${customSubreddit}` : `r/${selectedSubreddit}`}>
                {usingCustomSubreddit && customSubreddit ? `r/${customSubreddit}` : `r/${selectedSubreddit}`}
              </span>
              <button
                onClick={() => {
                  const sub = usingCustomSubreddit ? customSubreddit.trim() : selectedSubreddit;
                  isFavoriteSubreddit(sub) ? removeFavoriteSubreddit(sub) : addFavoriteSubreddit(sub);
                }}
                className={`text-sm transition-colors ${
                  isFavoriteSubreddit(usingCustomSubreddit ? customSubreddit.trim() : selectedSubreddit)
                    ? 'text-yellow-400' : 'text-white/30 hover:text-yellow-400'
                }`}
              >
                {isFavoriteSubreddit(usingCustomSubreddit ? customSubreddit.trim() : selectedSubreddit) ? '⭐' : '☆'}
              </button>
            </div>
          )}

          {/* Custom r/ input (Reddit Mode Only) */}
          {!restrictionActive && sourceProvider === 'reddit' && (
            <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl px-2.5 py-1">
              <input
                type="text"
                placeholder="r/..."
                value={customSubreddit}
                onChange={(e) => setCustomSubreddit(e.target.value)}
                className="bg-transparent text-white py-1 outline-none w-16 md:w-24 text-xs font-medium placeholder-white/30"
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
                className="bg-neon-pink hover:bg-neon-pink/80 px-2 py-0.5 rounded-lg text-[10px] font-black transition-all text-white shadow-[0_0_10px_rgba(255,47,86,0.3)]"
              >
                GO
              </button>
            </div>
          )}

          {/* RedGIFs Mode Direct API Badge */}
          {sourceProvider === 'redgifs' && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/10 border border-red-500/30 text-xs font-bold text-red-400">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span>RedGIFs Direct API</span>
            </div>
          )}

          {/* Discord <10MB toggle */}
          <button
            onClick={() => setDiscordMode(d => !d)}
            title="Under 10MB only"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
              discordMode
                ? 'bg-neon-blue/15 border-neon-blue/40 text-neon-blue shadow-[0_0_10px_rgba(0,243,255,0.2)]'
                : 'bg-white/5 border-white/10 text-white/40 hover:text-white'
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.055a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
            </svg>
            <span className="hidden sm:inline">&lt;10MB</span>
          </button>

          {/* Download All button */}
          {!restrictionActive && getActiveSubredditString() && (
            <button
              onClick={() => setShowDownloadAll(true)}
              title="Download all videos from this subreddit"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neon-pink/15 hover:bg-neon-pink/25 border border-neon-pink/30 hover:border-neon-pink/50 text-neon-pink text-xs font-bold transition-all cursor-pointer shadow-[0_0_10px_rgba(255,47,86,0.2)] hover:scale-105"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span className="hidden sm:inline">Download All</span>
            </button>
          )}
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

      {error && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="text-5xl">🚫</div>
          <p className="text-white/60 text-lg font-medium">{error}</p>
          <p className="text-white/30 text-sm">Try a different subreddit or search term</p>
        </div>
      )}

      {!error && !isLoading && videos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="text-5xl">🌑</div>
          <p className="text-white/60 text-lg font-medium">No videos found</p>
          <p className="text-white/30 text-sm">This subreddit might not have video content</p>
        </div>
      )}

      <Masonry breakpointCols={breakpointColumns} className="flex w-auto -ml-6" columnClassName="pl-6 bg-clip-padding">
        {videos
          .filter(vid => {
            if (!discordMode) return true;
            const size = videoSizes[vid.id];
            // Show if: size is known and under 10MB, OR size not yet checked (optimistic)
            return size === undefined || (size !== null && size < 10 * 1024 * 1024);
          })
          .map(vid => {
            const size = videoSizes[vid.id];
            const sizeMB = size ? (size / (1024 * 1024)).toFixed(1) : null;
            const isSmall = size !== null && size !== undefined && size < 10 * 1024 * 1024;
            return (
              <div
                key={vid.id}
                className="group relative mb-6 bg-dark-card rounded-2xl overflow-hidden border border-white/5 shadow-lg transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_10px_40px_rgba(0,0,0,0.5)] hover:border-white/20 cursor-pointer"
                onMouseEnter={() => setPlayingVideoId(vid.id)}
                onMouseLeave={() => setPlayingVideoId(null)}
                onClick={() => {
                  setSelectedVideo(vid);
                  markAsSeen(vid);
                }}
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
                  {/* Size badge */}
                  {sizeMB && (
                    <div className={`absolute bottom-14 left-3 z-20 px-2 py-0.5 rounded-full text-[10px] font-bold backdrop-blur-sm border ${
                      isSmall
                        ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                        : 'bg-white/10 border-white/10 text-white/40'
                    }`}>
                      {sizeMB}MB
                    </div>
                  )}
                  {discordMode && size === undefined && (
                    <div className="absolute bottom-14 left-3 z-20 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 border border-white/10 text-white/20">
                      …
                    </div>
                  )}
                </div>
              </div>
            );
          })
        }
      </Masonry>
      <div ref={loadingRef} className="h-20 flex items-center justify-center">
        {isLoading && <div className="w-8 h-8 border-4 border-neon-pink border-t-transparent rounded-full animate-spin"></div>}
      </div>

      {selectedVideo && <VideoModal key={selectedVideo.id || selectedVideo.url} video={selectedVideo} isRedgifs={selectedVideo.isRedgifs} originalUrl={selectedVideo.originalUrl} onClose={() => setSelectedVideo(null)} />}

      {showDownloadAll && <DownloadAllModal subreddit={getActiveSubredditString()} onClose={() => setShowDownloadAll(false)} />}
    </>
  );
}
