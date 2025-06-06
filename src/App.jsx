import { useEffect, useState } from 'react';
import './App.css';

function App() {
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('http://localhost:3001/api/reddit');
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Raw Reddit API response:', data);

        // Extract videos from posts
        const vids = (data?.data?.children || [])
          .map(post => post?.data)
          .filter(p => 
            // Check forReddit-hosted videos in media or preview
            (p?.is_video && p?.media?.reddit_video?.fallback_url) ||
            (p?.preview?.reddit_video_preview?.fallback_url)
          )
          .map(p => ({
            id: p.id, // Unique ID for key prop
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
  }, []);

  return (
    <div className="container">
      <h1>Reddit NSFW GIFs</h1>
      {isLoading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}
      {!isLoading && !error && videos.length === 0 && <p>No videos found.</p>}
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
