import { useState, useEffect, useRef } from 'react';
import { useFavoriteSubreddits } from '../lib/useFavoriteSubreddits';

const BACKEND = import.meta.env.VITE_BACKEND_API_URL;

export default function SubredditBrowser({ onSelect, onClose, onGlobalSearch }) {
  const [categories, setCategories] = useState({});
  const [search, setSearch]         = useState('');
  const [activeCategory, setActiveCategory] = useState(null);
  const [mobileCatOpen, setMobileCatOpen]   = useState(false);
  const { favoriteSubreddits, addFavoriteSubreddit, removeFavoriteSubreddit, isFavoriteSubreddit } =
    useFavoriteSubreddits();
  const searchRef = useRef(null);

  useEffect(() => {
    fetch(`${BACKEND}/api/subreddits/categories`)
      .then(r => r.json())
      .then(d => {
        const cats = d.categories || {};
        setCategories(cats);
        setActiveCategory(Object.keys(cats)[0] ?? null);
      })
      .catch(() => {});
    // Slight delay so the modal animates in before stealing focus
    setTimeout(() => searchRef.current?.focus(), 120);
  }, []);

  const allSubs = Object.entries(categories).flatMap(([cat, subs]) =>
    subs.map(s => ({ sub: s, category: cat }))
  );

  const searchResults = search.trim().length > 0
    ? allSubs.filter(({ sub }) => sub.toLowerCase().includes(search.toLowerCase()))
    : null;

  const displayList = searchResults
    ?? (activeCategory === '__favorites__'
      ? favoriteSubreddits.map(s => ({ sub: s, category: '__favorites__' }))
      : (categories[activeCategory] ?? []).map(s => ({ sub: s, category: activeCategory })));

  const handleSelect = (sub) => { onSelect(sub); onClose(); };
  const toggleFav    = (e, sub) => {
    e.stopPropagation();
    isFavoriteSubreddit(sub) ? removeFavoriteSubreddit(sub) : addFavoriteSubreddit(sub);
  };

  const catList = [
    ...(favoriteSubreddits.length > 0 ? [{ key: '__favorites__', label: '⭐ Saved' }] : []),
    ...Object.keys(categories).map(k => ({ key: k, label: k })),
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center
        p-0 sm:p-4 bg-black/75 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Browse subreddits">

      <div
        className="relative w-full sm:max-w-3xl sm:max-h-[85vh] flex flex-col
          max-h-[92dvh] bg-[#111] border-0 sm:border border-white/10
          rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Drag handle (mobile) */}
        <div className="sm:hidden w-8 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-1 shrink-0" />

        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8 shrink-0">
          <div className="flex-1 flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2.5 border border-white/8">
            <svg className="w-4 h-4 text-white/35 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchRef}
              type="search"
              placeholder="Search subreddits…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent text-white placeholder-white/25 outline-none w-full text-sm" />
            {search && (
              <button onClick={() => setSearch('')}
                className="text-white/30 hover:text-white leading-none text-lg w-5 h-5 flex items-center justify-center shrink-0"
                aria-label="Clear search">×</button>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl
              bg-white/5 hover:bg-white/10 text-white/50 hover:text-white
              transition-colors shrink-0"
            aria-label="Close">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Category strip — horizontal on mobile, sidebar on desktop */}
        {!searchResults && (
          <>
            {/* Mobile: horizontal scroll strip */}
            <div className="sm:hidden flex gap-2 overflow-x-auto no-scrollbar px-4 py-2.5 border-b border-white/8 shrink-0">
              {catList.map(({ key, label }) => (
                <button key={key}
                  onClick={() => setActiveCategory(key)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                    activeCategory === key
                      ? 'bg-neon-pink text-white'
                      : 'bg-white/5 text-white/45 hover:text-white'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="flex flex-1 overflow-hidden">
          {/* Desktop sidebar */}
          {!searchResults && (
            <div className="hidden sm:flex flex-col w-36 shrink-0 border-r border-white/8 overflow-y-auto py-1 no-scrollbar">
              {catList.map(({ key, label }) => (
                <button key={key}
                  onClick={() => setActiveCategory(key)}
                  className={`w-full text-left px-3 py-2.5 text-xs font-semibold truncate transition-colors ${
                    activeCategory === key
                      ? 'bg-neon-pink/10 text-neon-pink'
                      : 'text-white/35 hover:text-white hover:bg-white/4'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Chip grid */}
          <div className="flex-1 overflow-y-auto p-3">

            {/* Global search CTA — pinned at top */}
            {search.trim() && onGlobalSearch && (
              <button
                onClick={() => { onGlobalSearch(search); onClose(); }}
                className="w-full mb-3 flex items-center gap-3 p-3.5 rounded-xl
                  bg-neon-pink/8 hover:bg-neon-pink/15 border border-neon-pink/25 hover:border-neon-pink/50
                  text-neon-pink font-bold text-sm transition-all group">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search Reddit for "{search}"
              </button>
            )}

            {searchResults?.length === 0 && (
              <p className="text-white/25 text-sm text-center mt-10">
                No subreddits match "{search}"
              </p>
            )}

            <div className="flex flex-wrap gap-1.5">
              {displayList.map(({ sub, category }) => (
                <Chip
                  key={`${category}-${sub}`}
                  sub={sub}
                  isFav={isFavoriteSubreddit(sub)}
                  showCategory={!!searchResults}
                  category={category}
                  onSelect={handleSelect}
                  onToggleFav={toggleFav} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({ sub, isFav, onSelect, onToggleFav, showCategory, category }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(sub)}
      onKeyDown={e => e.key === 'Enter' && onSelect(sub)}
      className="group flex items-center gap-1 bg-white/4 hover:bg-white/8
        border border-white/8 hover:border-white/15 rounded-lg px-2.5 py-1.5
        cursor-pointer transition-all duration-150 active:scale-95">
      <span className="text-xs text-white/80 font-medium">r/{sub}</span>
      {showCategory && (
        <span className="text-[9px] text-white/25 ml-0.5 hidden sm:inline">{category}</span>
      )}
      <button
        onClick={e => onToggleFav(e, sub)}
        className={`ml-0.5 text-xs leading-none transition-colors ${
          isFav ? 'text-yellow-400' : 'text-white/15 group-hover:text-white/35'
        }`}
        aria-label={isFav ? `Unsave ${sub}` : `Save ${sub}`}>
        {isFav ? '★' : '☆'}
      </button>
    </div>
  );
}
