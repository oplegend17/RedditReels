import { useEffect, useState } from 'react';
import './App.css';

function App() {
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSubreddit, setSelectedSubreddit] = useState('');
  const [availableSubreddits, setAvailableSubreddits] = useState([]);

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

  useEffect(() => {
    const fetchVideos = async () => {
      if (!selectedSubreddit) return;

      try {
        setIsLoading(true);
        const response = await fetch(`http://localhost:3001/api/reddit/${selectedSubreddit}`);
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
        setVideos(vids);
      } catch (err) {
        console.error('Error fetching videos:', err);
        setError('Failed to load videos. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchVideos();
  }, [selectedSubreddit]); // Fetch videos when selected subreddit changes

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

      {isLoading && <p className="loading">Loading...</p>}
      {error && <p className="error">{error}</p>}
      {!isLoading && !error && videos.length === 0 && (
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
    </div>
  );
}

export default App;
