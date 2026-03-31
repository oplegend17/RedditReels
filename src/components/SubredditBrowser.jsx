import { useState, useEffect, useRef } from 'react';
import { useFavoriteSubreddits } from '../lib/useFavoriteSubreddits';

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL;

export default function SubredditBrowser({ onSelect, onClose }) {
  const [categories, setCategories] = useState({});
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(null);
  const { favoriteSubreddits, addFavoriteSubreddit, removeFavoriteSubreddit, isFavoriteSubreddit } = useFavoriteSubreddits();
  const searchRef = useRef(null);

  useEffect(() => {
    fetch(`${BACKEND_API_URL}/api/subreddits/categories`)
      .then(r => r.json())
      .then(d => {
        setCategories(d.categories || {});
        setActiveCategory(Object.keys(d.categories || {})[0]);
      })
      .catch(() => {});
    searchRef.current?.focus();
  }, []);

  // Flatten all subreddits for search
  const allSubs = Object.entries(categories).flatMap(([cat, subs]) =>
    subs.map(s => ({ sub: s, category: cat }))
  );

  const searchResults = search.trim().length > 0
    ? allSubs.filter(({ sub }) => sub.toLowerCase().includes(search.toLowerCase()))
    : null;

  const displayList = searchResults
    ? searchResults
    : (activeCategory && categories[activeCategory]
        ? categories[activeCategory].map(s => ({ sub: s, category: activeCategory }))
        : []);

  const handleSelect = (sub) => {
    onSelect(sub);
    onClose();
  };

  const toggleFav = (e, sub) => {
    e.stopPropagation();
    isFavoriteSubreddit(sub) ? removeFavoriteSubreddit(sub) : addFavoriteSubreddit(sub);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[85vh] flex flex-col bg-[#0d0d0d] border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-white/10">
          <div className="flex-1 flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2.5 border border-white/10">
            <svg className="w-4 h-4 text-white/40 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              placeholder="Search subreddits..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent text-white placeholder-white/30 outline-none w-full text-sm"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-white/30 hover:text-white text-lg leading-none">×</button>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Category sidebar — hidden during search */}
          {!searchResults && (
            <div className="w-40 shrink-0 border-r border-white/10 overflow-y-auto py-2 no-scrollbar">
              {favoriteSubreddits.length > 0 && (
                <button
                  onClick={() => setActiveCategory('__favorites__')}
                  className={`w-full text-left px-4 py-2.5 text-xs font-bold truncate transition-colors ${
                    activeCategory === '__favorites__'
                      ? 'bg-yellow-400/10 text-yellow-400'
                      : 'text-white/40 hover:text-white hover:bg-white/5'
                  }`}
                >
                  ⭐ Favorites
                </button>
              )}
              {Object.keys(categories).map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`w-full text-left px-4 py-2.5 text-xs font-bold truncate transition-colors ${
                    activeCategory === cat
                      ? 'bg-neon-pink/10 text-neon-pink'
                      : 'text-white/40 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Subreddit grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {searchResults && searchResults.length === 0 && (
              <p className="text-white/30 text-sm text-center mt-8">No results for "{search}"</p>
            )}

            {/* Favorites view */}
            {!searchResults && activeCategory === '__favorites__' && (
              <div className="flex flex-wrap gap-2">
                {favoriteSubreddits.map(sub => (
                  <SubredditChip
                    key={sub}
                    sub={sub}
                    isFav={true}
                    onSelect={handleSelect}
                    onToggleFav={toggleFav}
                  />
                ))}
              </div>
            )}

            {/* Normal / search view */}
            {(searchResults || activeCategory !== '__favorites__') && (
              <div className="flex flex-wrap gap-2">
                {(searchResults || displayList).map(({ sub, category }) => (
                  <SubredditChip
                    key={`${category}-${sub}`}
                    sub={sub}
                    isFav={isFavoriteSubreddit(sub)}
                    onSelect={handleSelect}
                    onToggleFav={toggleFav}
                    showCategory={!!searchResults}
                    category={category}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SubredditChip({ sub, isFav, onSelect, onToggleFav, showCategory, category }) {
  return (
    <div
      className="group flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl px-3 py-2 cursor-pointer transition-all duration-200"
      onClick={() => onSelect(sub)}
    >
      <span className="text-sm text-white font-medium">r/{sub}</span>
      {showCategory && (
        <span className="text-[10px] text-white/30 ml-1">{category}</span>
      )}
      <button
        onClick={e => onToggleFav(e, sub)}
        className={`ml-1 text-sm transition-colors ${isFav ? 'text-yellow-400' : 'text-white/20 group-hover:text-white/40'}`}
      >
        {isFav ? '⭐' : '☆'}
      </button>
    </div>
  );
}
