import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { auth } from '../lib/firebase';

export default function Layout() {
  const [showNav, setShowNav] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const lastScrollY = useRef(0);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        setShowNav(false);
      } else {
        setShowNav(true);
      }
      
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isActive = (path) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  const navItems = [
    { 
      path: '/', 
      label: 'Videos', 
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    },
    { 
      path: '/images', 
      label: 'Images', 
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
    },
    { 
      path: '/reels', 
      label: 'Reels', 
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
    },
    { 
      path: '/challenges', 
      label: 'Challenges', 
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
    },
    { 
      path: '/stats', 
      label: 'Stats', 
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
    },
    { 
      path: '/favorites', 
      label: 'Favorites', 
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
    },
    { 
      path: '/profile', 
      label: 'Profile', 
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
    }
  ];

  return (
    <div className="min-h-screen text-white pb-20">
      {/* Header */}
      <header 
        className={`fixed top-0 left-0 right-0 z-50 glass-panel border-b-0 rounded-none mb-8 transition-transform duration-300 ${showNav ? 'translate-y-0' : '-translate-y-full'}`}
      >
        <div className="max-w-[1800px] mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="text-3xl font-black tracking-tighter italic bg-clip-text text-transparent bg-gradient-to-r from-white via-neon-blue to-neon-pink drop-shadow-[0_0_10px_rgba(0,243,255,0.3)]">
            REDDIT REELS
          </Link>
          
          <nav className="hidden md:flex items-center gap-2 bg-black/20 p-1.5 rounded-full border border-white/5 backdrop-blur-md">
            {navItems.map(item => (
              <Link 
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 cursor-pointer ${
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

          <button 
            className="hidden md:block px-6 py-2.5 rounded-full border border-white/20 text-white font-medium hover:bg-white/10 transition-all cursor-pointer" 
            onClick={() => auth.signOut()}
          >
            Sign Out
          </button>
          
          <button className="md:hidden text-white" onClick={() => setMobileNavOpen(!mobileNavOpen)}>
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
        </div>
      </header>

      {/* Mobile Nav */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center gap-8 md:hidden" onClick={() => setMobileNavOpen(false)}>
          {navItems.map(item => (
            <Link 
              key={item.path} 
              to={item.path} 
              className="text-2xl font-bold capitalize text-white"
            >
              {item.label}
            </Link>
          ))}
          <button className="text-xl text-red-500 font-bold" onClick={() => auth.signOut()}>Sign Out</button>
        </div>
      )}

      <main className="max-w-[1800px] mx-auto px-4 md:px-8 pt-24">
        <Outlet />
      </main>
    </div>
  );
}
