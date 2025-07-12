import { useFavorites } from '../lib/useFavorites';
import Masonry from 'react-masonry-css';
import { useState, useEffect } from 'react';

export default function Favorites({ videoRefs, handleVideoClick, handleVideoMouseEnter, handleVideoMouseLeave }) {
  const { favorites, loading, removeFavorite } = useFavorites();
  const [showUnder10MB, setShowUnder10MB] = useState(false);
  const [videoSizes, setVideoSizes] = useState({}); // { [videoId]: sizeInBytes }
  const [fetchingSizes, setFetchingSizes] = useState(false);

  const breakpointColumns = {
    default: 4,
    1440: 3,
    1100: 2,
    700: 1
  };

  useEffect(() => {
    // Fetch sizes for all favorites if the filter is enabled and sizes are missing
    if (showUnder10MB && favorites.length > 0) {
      const missing = favorites.filter(f => videoSizes[f.video_id] === undefined);
      if (missing.length > 0) {
        setFetchingSizes(true);
        Promise.all(
          missing.map(async (f) => {
            try {
              const res = await fetch(f.video_url, { method: 'HEAD' });
              const size = res.headers.get('Content-Length');
              return { id: f.video_id, size: size ? parseInt(size, 10) : null };
            } catch {
              return { id: f.video_id, size: null };
            }
          })
        ).then(results => {
          setVideoSizes(prev => {
            const next = { ...prev };
            results.forEach(({ id, size }) => { next[id] = size; });
            return next;
          });
          setFetchingSizes(false);
        });
      }
    }
  }, [showUnder10MB, favorites]);

  const filteredFavorites = showUnder10MB
    ? favorites.filter(f => videoSizes[f.video_id] !== undefined && videoSizes[f.video_id] !== null && videoSizes[f.video_id] < 10 * 1024 * 1024)
    : favorites;

  if (loading) {
    return (
      <div className="loading-animation">
        <div className="loading-dot"></div>
        <div className="loading-dot"></div>
        <div className="loading-dot"></div>
      </div>
    );
  }

  return (
    <div className="favorites-container">
      <h2>Your Favorite Videos</h2>
      {/* Filter Switch UI */}
      <div style={{ margin: '16px 0 8px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
        <label style={{ color: '#fff', fontSize: 16, fontWeight: 500, cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={showUnder10MB}
            onChange={e => setShowUnder10MB(e.target.checked)}
            style={{ marginRight: 8 }}
          />
          Show only videos under 10MB
        </label>
        {fetchingSizes && (
          <span style={{ color: '#fff', fontSize: 14, marginLeft: 8 }}>Checking sizes...</span>
        )}
      </div>
      {filteredFavorites.length === 0 ? (
        <div className="empty-state">
          <svg className="empty-icon" viewBox="0 0 24 24" width="48" height="48">
            <path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          <p>No favorites yet</p>
        </div>
      ) : (
        <Masonry
          breakpointCols={breakpointColumns}
          className="masonry-grid"
          columnClassName="masonry-grid_column"
        >
          {filteredFavorites.map(fav => (
            <div 
              key={fav.id} 
              className="card"
              onMouseEnter={() => handleVideoMouseEnter(fav.video_id)}
              onMouseLeave={() => handleVideoMouseLeave(fav.video_id)}
            >
              <div className="card-actions">
                <button 
                  className="favorite-button active"
                  onClick={() => removeFavorite(fav.video_id)}
                >
                  <svg viewBox="0 0 24 24" width="24" height="24">
                    <path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                  </svg>
                </button>
              </div>
              <video
                ref={el => videoRefs.current[fav.video_id] = el}
                src={fav.video_url}
                loop
                muted
                width="100%"
                preload="metadata"
                style={{ borderRadius: '10px', cursor: 'pointer' }}
                onClick={() => handleVideoClick({ id: fav.video_id, url: fav.video_url, title: fav.title })}
              >
                <source src={fav.video_url} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
              <h3 className="video-title">{fav.title}</h3>
              <div className="video-subreddit">r/{fav.subreddit}</div>
            </div>
          ))}
        </Masonry>
      )}
    </div>
  );
}
