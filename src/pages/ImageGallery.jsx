import { useState, useEffect, useRef } from 'react';
import Masonry from 'react-masonry-css';
import { LazyImage } from '../components/LazyMedia';

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL;

export default function ImageGallery() {
  const [images, setImages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedSubreddit, setSelectedSubreddit] = useState('');
  const [availableSubreddits, setAvailableSubreddits] = useState([]);
  const [afterId, setAfterId] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const loadingRef = useRef(null);
  const [customSubreddit, setCustomSubreddit] = useState('');
  const [usingCustomSubreddit, setUsingCustomSubreddit] = useState(false);
  const [customAfterId, setCustomAfterId] = useState(null);
  const [customHasMore, setCustomHasMore] = useState(true);

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

  const fetchImages = async (isNewSubreddit = false) => {
    const isCustom = usingCustomSubreddit;
    const sub = isCustom ? customSubreddit.trim() : selectedSubreddit;
    const after = isCustom ? (isNewSubreddit ? '' : customAfterId) : (isNewSubreddit ? '' : afterId);
    const hasMoreCheck = isCustom ? (isNewSubreddit || customHasMore) : (isNewSubreddit || hasMore);

    if (!sub || !hasMoreCheck) return;

    try {
      setIsLoading(true);
      setError(null);
      const url = `${BACKEND_API_URL}/api/reddit/${sub}${after ? `?after=${after}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      
      const imgs = (data?.data?.children || [])
        .map(post => post?.data)
        .filter(p => p?.post_hint === 'image' && p?.url && /\.(jpg|jpeg|png|gif)$/i.test(p.url))
        .map(p => ({
          id: p.id,
          title: p.title,
          url: p.url,
          thumbnail: p.thumbnail?.startsWith('http') ? p.thumbnail : p.url,
          subreddit: p.subreddit
        }));

      const newAfter = data?.data?.after;
      
      if (isCustom) {
        setCustomAfterId(newAfter);
        setCustomHasMore(!!newAfter && imgs.length > 0);
      } else {
        setAfterId(newAfter);
        setHasMore(!!newAfter && imgs.length > 0);
      }
      
      setImages(prev => isNewSubreddit ? imgs : [...prev, ...imgs]);
    } catch (err) {
      setError('Failed to load images.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (usingCustomSubreddit) {
      if (customSubreddit) fetchImages(true);
    } else if (selectedSubreddit) {
      fetchImages(true);
    }
  }, [selectedSubreddit, usingCustomSubreddit]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading) {
          fetchImages();
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );
    
    if (loadingRef.current) observer.observe(loadingRef.current);
    return () => observer.disconnect();
  }, [isLoading, hasMore, customHasMore]);

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

  const breakpointColumns = { default: 4, 1440: 3, 1100: 2, 700: 1 };

  return (
    <>
      <div className="flex flex-col gap-6 mb-12 sticky top-24 z-30 pointer-events-none">
        <div className="pointer-events-auto flex gap-4 bg-black/60 backdrop-blur-xl p-2 rounded-2xl border border-white/10 shadow-2xl mx-auto w-fit">
          <select 
            value={usingCustomSubreddit ? '' : selectedSubreddit}
            onChange={(e) => {
              setUsingCustomSubreddit(false);
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
                fetchImages(true);
              }
            }}
          />
          
          <button 
            onClick={() => {
              setUsingCustomSubreddit(true);
              fetchImages(true);
            }}
            className="bg-white/10 hover:bg-white/20 px-4 rounded-xl text-sm font-bold transition-colors cursor-pointer"
          >
            GO
          </button>
        </div>
      </div>

      <Masonry breakpointCols={breakpointColumns} className="flex w-auto -ml-6" columnClassName="pl-6 bg-clip-padding">
        {images.map(img => (
          <div 
            key={img.id} 
            className="group relative mb-6 bg-dark-card rounded-2xl overflow-hidden border border-white/5 shadow-lg transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_10px_40px_rgba(0,0,0,0.5)] hover:border-white/20"
          >
            <div className="relative">
              <LazyImage
                src={img.url}
                alt={img.title}
                onDownload={(e) => handleDownload(e, img)}
              />
            </div>
          </div>
        ))}
      </Masonry>
      <div ref={loadingRef} className="h-20 flex items-center justify-center">
        {isLoading && <div className="w-8 h-8 border-4 border-neon-blue border-t-transparent rounded-full animate-spin"></div>}
      </div>
    </>
  );
}
