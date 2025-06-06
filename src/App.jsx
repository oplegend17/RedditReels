import { useEffect, useState, useRef } from 'react';
import Masonry from 'react-masonry-css';
import './App.css';

function App() {
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSubreddit, setSelectedSubreddit] = useState('');
  const [availableSubreddits, setAvailableSubreddits] = useState([]);
  const [afterId, setAfterId] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const loadingRef = useRef(null);
  const [playingVideos, setPlayingVideos] = useState(new Set());
  const [clickedVideos, setClickedVideos] = useState(new Set());
  const videoRefs = useRef({});

  // Fetch available subreddits on component mount
  useEffect(() => {
    const fetchSubreddits = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/subreddits');
        const data = await response.json();
        setAvailableSubreddits(data.subreddits);
        setSelectedSubreddit(data.subreddits[0]); // Set first subreddit as default
      } catch (err) {
        console.error('Error fetching subreddits:', err);
        setError('Failed to load subreddits');
      }
    };

    fetchSubreddits();
  }, []);

  const fetchVideos = async (isNewSubreddit = false) => {
    if (!selectedSubreddit) return;
    
    try {
      setIsLoading(true);
      const response = await fetch(`http://localhost:3001/api/reddit/${selectedSubreddit}${afterId && !isNewSubreddit ? `?after=${afterId}` : ''}`);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();

      // Extract videos from posts
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
        }));

      setAfterId(data.data.after);
      setHasMore(!!data.data.after);
      setVideos(prev => isNewSubreddit ? vids : [...prev, ...vids]);
    } catch (err) {
      console.error('Error fetching videos:', err);
      setError('Failed to load videos. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSubreddit) {
      setVideos([]);
      setAfterId(null);
      setHasMore(true);
      fetchVideos(true);
    }
  }, [selectedSubreddit]);

  // Intersection Observer setup
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          fetchVideos();
        }
      },
      { threshold: 1.0 }
    );

    if (loadingRef.current) {
      observer.observe(loadingRef.current);
    }

    return () => {
      if (loadingRef.current) {
        observer.unobserve(loadingRef.current);
      }
    };
  }, [hasMore, isLoading, afterId]);

  const handleSubredditChange = (event) => {
    setSelectedSubreddit(event.target.value);
  };

  const handleVideoMouseEnter = (videoId) => {
    if (!clickedVideos.has(videoId)) {
      setPlayingVideos(prev => new Set([...prev, videoId]));
      videoRefs.current[videoId]?.play().catch(err => console.warn('Playback failed:', err));
    }
  };

  const handleVideoMouseLeave = (videoId) => {
    if (!clickedVideos.has(videoId)) {
      setPlayingVideos(prev => {
        const next = new Set([...prev]);
        next.delete(videoId);
        return next;
      });
      videoRefs.current[videoId]?.pause();
    }
  };

  const handleVideoClick = (videoId) => {
    if (clickedVideos.has(videoId)) {
      // If already clicked, remove from clicked set and pause
      setClickedVideos(prev => {
        const next = new Set([...prev]);
        next.delete(videoId);
        return next;
      });
      videoRefs.current[videoId]?.pause();
    } else {
      // If not clicked, add to clicked set and play
      setClickedVideos(prev => new Set([...prev, videoId]));
      videoRefs.current[videoId]?.play().catch(err => console.warn('Playback failed:', err));
    }
  };

  // Reset video states when changing subreddit
  useEffect(() => {
    setPlayingVideos(new Set());
    setClickedVideos(new Set());
  }, [selectedSubreddit]);

  const breakpointColumns = {
    default: 4,
    1440: 3,
    1100: 2,
    700: 1
  };

  return (
    <div className="container">
      <h1>Reddit Media Gallery</h1>
      
      <div className="subreddit-selector">
        <select 
          value={selectedSubreddit} 
          onChange={handleSubredditChange}
          className="subreddit-select"
        >
          <option value="">Select Subreddit</option>
          {availableSubreddits.map(sub => (
            <option key={sub} value={sub}>r/{sub}</option>
          ))}
        </select>
      </div>

      {error && <p className="error">{error}</p>}
      {!error && videos.length === 0 && !isLoading && (
        <p>No videos found in r/{selectedSubreddit}</p>
      )}

      <Masonry
        breakpointCols={breakpointColumns}
        className="masonry-grid"
        columnClassName="masonry-grid_column"
      >
        {videos.map(vid => (
          <div 
            key={vid.id} 
            className="card"
            onMouseEnter={() => handleVideoMouseEnter(vid.id)}
            onMouseLeave={() => handleVideoMouseLeave(vid.id)}
          >
            <video
              ref={el => videoRefs.current[vid.id] = el}
              src={vid.url}
              loop
              muted
              width="100%"
              preload="metadata"
              style={{ borderRadius: '10px', cursor: 'pointer' }}
              onClick={() => handleVideoClick(vid.id)}
              onError={() => console.warn(`Failed to load video: ${vid.url}`)}
            >
              <source src={vid.url} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
            <h3 className="video-title">{vid.title}</h3>
          </div>
        ))}
      </Masonry>

      <div ref={loadingRef} className="loading-indicator">
        {isLoading && <p className="loading">Loading more videos...</p>}
        {!hasMore && videos.length > 0 && (
          <p className="no-more">No more videos to load</p>
        )}
      </div>
    </div>
  );
}

export default App;
