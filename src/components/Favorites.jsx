import { useFavorites } from '../lib/useFavorites';
import Masonry from 'react-masonry-css';

export default function Favorites({ videoRefs, handleVideoClick, handleVideoMouseEnter, handleVideoMouseLeave }) {
  const { favorites, loading, removeFavorite } = useFavorites();

  const breakpointColumns = {
    default: 4,
    1440: 3,
    1100: 2,
    700: 1
  };

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
      {favorites.length === 0 ? (
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
          {favorites.map(fav => (
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
