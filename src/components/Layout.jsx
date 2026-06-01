import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { auth } from '../lib/firebase';

const navItems = [
  {
    path: '/',
    label: 'Videos',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    path: '/images',
    label: 'Images',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    path: '/reels',
    label: 'Reels',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    path: '/females',
    label: 'For Her',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
  {
    path: '/challenges',
    label: 'Challenges',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    path: '/stats',
    label: 'Stats',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    path: '/favorites',
    label: 'Favorites',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
  {
    path: '/profile',
    label: 'Profile',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
];

// Bottom tab bar shows these 5 on mobile
const mobileTabItems = ['/', '/reels', '/females', '/favorites', '/profile'];

export default function Layout({ profile, isAdmin }) {
  const [showNav, setShowNav] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);
  const lastScrollY = useRef(0);
  const location = useLocation();

  // Hide header on scroll down, show on scroll up
  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      setShowNav(y <= lastScrollY.current || y <= 100);
      lastScrollY.current = y;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close "more" drawer on route change
  useEffect(() => { setMoreOpen(false); }, [location.pathname]);

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  // Dynamically include Admin route in current navigation if role is admin
  const currentNavItems = isAdmin
    ? [
        ...navItems.slice(0, 7), // Up to Favorites
        {
          path: '/admin',
          label: 'Admin',
          icon: (
            <svg className="w-5 h-5 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          ),
        },
        ...navItems.slice(7), // Profile
      ]
    : navItems;

  const tabItems = currentNavItems.filter(n => mobileTabItems.includes(n.path));
  const moreItems = currentNavItems.filter(n => !mobileTabItems.includes(n.path));

  return (
    <div className="min-h-screen text-white">
      {/* ── Desktop header ── */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 glass-panel border-b-0 rounded-none transition-transform duration-300 ${
          showNav ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="max-w-[1800px] mx-auto px-4 md:px-6 h-16 md:h-20 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link
            to="/"
            className="text-xl md:text-3xl font-black tracking-tighter italic bg-clip-text text-transparent bg-gradient-to-r from-white via-neon-blue to-neon-pink shrink-0"
          >
            REDDIT REELS
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 bg-black/20 p-1.5 rounded-full border border-white/5 backdrop-blur-md overflow-x-auto no-scrollbar">
            {currentNavItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-200 ${
                  isActive(item.path)
                    ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)]'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* Desktop sign out */}
          <button
            className="hidden md:block px-5 py-2 rounded-full border border-white/20 text-white text-sm font-medium hover:bg-white/10 transition-all shrink-0"
            onClick={() => auth.signOut()}
          >
            Sign Out
          </button>

          {/* Mobile: current page label */}
          <span className="md:hidden text-sm font-bold text-white/60 capitalize">
            {currentNavItems.find(n => isActive(n.path))?.label || ''}
          </span>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="max-w-[1800px] mx-auto px-3 md:px-8 pt-16 md:pt-20 pb-20 md:pb-8">
        <Outlet context={{ profile, isAdmin }} />
      </main>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-xl border-t border-white/10 safe-area-pb">
        <div className="flex items-center justify-around h-16">
          {tabItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-200 ${
                isActive(item.path)
                  ? 'text-neon-pink'
                  : 'text-white/40 hover:text-white'
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-bold">{item.label}</span>
            </Link>
          ))}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(p => !p)}
            className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-200 ${
              moreOpen ? 'text-neon-pink' : 'text-white/40 hover:text-white'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h.01M12 12h.01M19 12h.01" />
            </svg>
            <span className="text-[10px] font-bold">More</span>
          </button>
        </div>
      </nav>

      {/* ── Mobile "More" drawer ── */}
      {moreOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="absolute bottom-16 left-0 right-0 bg-[#0d0d0d] border-t border-white/10 rounded-t-3xl p-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />
            <div className="grid grid-cols-3 gap-3 mb-4">
              {moreItems.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${
                    isActive(item.path)
                      ? 'bg-neon-pink/10 border-neon-pink/40 text-neon-pink'
                      : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                  }`}
                >
                  {item.icon}
                  <span className="text-xs font-bold">{item.label}</span>
                </Link>
              ))}
            </div>
            <button
              onClick={() => auth.signOut()}
              className="w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-white/60 font-bold text-sm hover:bg-white/10 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
