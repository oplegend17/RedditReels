import { useState, useEffect, useRef } from 'react';
import Masonry from 'react-masonry-css';
import { LazyVideo } from '../components/LazyMedia';
import VideoModal from '../components/VideoModal';
import { useFavorites } from '../lib/useFavorites';
import { MOODS } from '../lib/subreddits';

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
  const [customSubreddit, setCustomSubreddit] = useState('');
  const [usingCustomSubreddit, setUsingCustomSubreddit] = useState(false);
  const [customAfterId, setCustomAfterId] = useState(null);
  const [customHasMore, setCustomHasMore] = useState(true);
  const [selectedMood, setSelectedMood] = useState(null);

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
    
    let sub = selectedSubreddit;
    if (isCustom) sub = customSubreddit.trim();
    if (isMood) sub = selectedMood.subreddits.join('+');

    const after = (isCustom || isMood) ? (isNewSubreddit ? '' : customAfterId) : (isNewSubreddit ? '' : afterId);
    const hasMoreCheck = (isCustom || isMood) ? (isNewSubreddit || customHasMore) : (isNewSubreddit || hasMore);

    if (!sub || !hasMoreCheck) return;

    try {
      setIsLoading(true);
      setError(null);
      const url = `${BACKEND_API_URL}/api/reddit/${sub}${after ? `?after=${after}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      
      const vids = (data?.data?.children || [])
        .map(post => post?.data)
        .filter(p => 
          (p?.is_video && p?.media?.reddit_video?.fallback_url) ||
          (p?.preview?.reddit_video_preview?.fallback_url)
        )
        .map(p => ({
          id: p.id,
          title: p.title,
          url: p?.media?.reddit_video?.fallback_url || p?.preview?.reddit_video_preview?.fallback_url,
          thumbnail: p?.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, '&') || '',
          subreddit: p.subreddit,
          heat: calculateHeat(p.ups, p.created_utc)
        }));

      const newAfter = data?.data?.after;
      
      if (isCustom || isMood) {
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
    if (selectedMood) {
      fetchVideos(true);
    } else if (usingCustomSubreddit) {
      if (customSubreddit) fetchVideos(true);
    } else if (selectedSubreddit) {
      fetchVideos(true);
    }
  }, [selectedSubreddit, usingCustomSubreddit, selectedMood]);

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
    setCustomSubreddit('');
    setVideos([]);
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
        className={`flex flex-col gap-6 mb-12 sticky top-24 z-30 pointer-events-none transition-transform duration-300 ${
          showNav ? 'translate-y-0' : '-translate-y-[140%]'
        }`}
      >
        {/* Mood Selector */}
        <div className="pointer-events-auto flex gap-3 overflow-x-auto pb-4 no-scrollbar max-w-full mx-auto">
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
            onClick={() => { setSelectedMood(null); setUsingCustomSubreddit(false); setVideos([]); }}
            className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-300 border ${
              !selectedMood && !usingCustomSubreddit
                ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.3)]'
                : 'bg-black/60 text-neutral-400 border-white/10 hover:bg-white/10 hover:text-white backdrop-blur-xl'
            }`}
          >
            All
          </button>
        </div>

        <div className="pointer-events-auto flex gap-4 bg-black/60 backdrop-blur-xl p-2 rounded-2xl border border-white/10 shadow-2xl mx-auto w-fit">
          <select 
            value={usingCustomSubreddit ? '' : selectedSubreddit}
            onChange={(e) => {
              setUsingCustomSubreddit(false);
              setSelectedMood(null);
              setSelectedSubreddit(e.target.value);
            }}
            className="bg-transparent text-white font-bold px-4 py-2 outline-none cursor-pointer"
          >
            <option value="" className="bg-black">Select Subreddit</option>
            {availableSubreddits.map(sub => (
              <option key={sub} value={sub} className="bg-black">r/{sub}</option>
            ))}
          </select>
          
          <div className="w-px bg-white/20"></div>

          <input
            type="text"
            placeholder="Custom r/..."
            value={customSubreddit}
            onChange={(e) => setCustomSubreddit(e.target.value)}
            className="bg-transparent text-white px-4 py-2 outline-none w-32 focus:w-48 transition-all"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setUsingCustomSubreddit(true);
                setSelectedMood(null);
                fetchVideos(true);
              }
            }}
          />
          
          <button 
            onClick={() => {
              setUsingCustomSubreddit(true);
              setSelectedMood(null);
              fetchVideos(true);
            }}
            className="bg-white/10 hover:bg-white/20 px-4 rounded-xl text-sm font-bold transition-colors cursor-pointer"
          >
            GO
          </button>
        </div>
      </div>

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

      {selectedVideo && <VideoModal video={selectedVideo} onClose={() => setSelectedVideo(null)} />}
    </>
  );
}
