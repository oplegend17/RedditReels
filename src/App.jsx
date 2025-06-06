import { useEffect, useState, useRef, useCallback } from 'react';
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

      <div className="video-grid">
        {videos.map(vid => (
          <div key={vid.id} className="card">
            <h3>{vid.title}</h3>
            <video
              src={vid.url}
              controls
              loop
              muted
              width="100%"
              style={{ borderRadius: '10px' }}
              onError={() => console.warn(`Failed to load video: ${vid.url}`)}
            >
              <source src={vid.url} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        ))}
      </div>

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
