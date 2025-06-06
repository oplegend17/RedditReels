import { useEffect, useState, useRef } from 'react';
import Masonry from 'react-masonry-css';
import './App.css';

function VideoModal({ video, onClose }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    videoRef.current?.play();
  }, []);

  const handleDownload = async () => {
    try {
      const response = await fetch(video.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${video.title}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  return (
    <div className="video-modal-overlay" onClick={onClose}>
      <div className="video-modal-content" onClick={e => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>×</button>
        <div className="video-controls-sidebar">
          <h2 className="modal-title">{video.title}</h2>
          <button className="download-button" onClick={handleDownload}>
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download
          </button>
        </div>
        <video
          ref={videoRef}
          src={video.url}
          controls
          autoPlay
          loop
          className="modal-video"
        >
          <source src={video.url} type="video/mp4" />
        </video>
      </div>
    </div>
  );
}

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
  const [loadingVideos, setLoadingVideos] = useState(new Set());
  const videoRefs = useRef({});
  const [selectedVideo, setSelectedVideo] = useState(null);

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

  const handleVideoClick = (video) => {
    setSelectedVideo(video);
  };

  const handleVideoLoadStart = (videoId) => {
    setLoadingVideos(prev => new Set([...prev, videoId]));
  };

  const handleVideoCanPlay = (videoId) => {
    setLoadingVideos(prev => {
      const next = new Set([...prev]);
      next.delete(videoId);
      return next;
    });
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
            className={`card ${loadingVideos.has(vid.id) ? 'loading' : ''}`}
            onMouseEnter={() => handleVideoMouseEnter(vid.id)}
            onMouseLeave={() => handleVideoMouseLeave(vid.id)}
          >
            {loadingVideos.has(vid.id) && (
              <div className="video-loading-overlay">
                <div className="loading-spinner"></div>
              </div>
            )}
            <video
              ref={el => videoRefs.current[vid.id] = el}
              src={vid.url}
              loop
              muted
              width="100%"
              preload="metadata"
              style={{ borderRadius: '10px', cursor: 'pointer' }}
              onClick={() => handleVideoClick(vid)}
              onLoadStart={() => handleVideoLoadStart(vid.id)}
              onCanPlay={() => handleVideoCanPlay(vid.id)}
              onError={() => {
                console.warn(`Failed to load video: ${vid.url}`);
                handleVideoCanPlay(vid.id);
              }}
            >
              <source src={vid.url} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
            <h3 className="video-title">{vid.title}</h3>
          </div>
        ))}
      </Masonry>

      {selectedVideo && (
        <VideoModal
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
        />
      )}

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
