import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { useWatchPartyContext } from '../context/WatchPartyContext';
import { PartyBar } from './WatchParty';
import VideoModal from './VideoModal';

/* ── Icons — each path is unique ── */
const Icons = {
  Videos: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Images: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  Reels: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" strokeWidth="2" />
      <circle cx="12" cy="12" r="3" strokeWidth="2" />
      <path strokeLinecap="round" strokeWidth="2" d="M12 3v3M12 18v3M3 12h3M18 12h3" />
    </svg>
  ),
  ForHer: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="4" strokeWidth="2" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 12v8M9 17h6" />
    </svg>
  ),
  Challenges: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  Stats: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  Favorites: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
  ),
  Profile: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  More: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h.01M12 12h.01M19 12h.01" />
    </svg>
  ),
};

const navItems = [
  { path: '/',           label: 'Videos',     icon: Icons.Videos },
  { path: '/images',     label: 'Images',     icon: Icons.Images },
  { path: '/reels',      label: 'Reels',      icon: Icons.Reels },
  { path: '/females',    label: 'For Her',    icon: Icons.ForHer },
  { path: '/challenges', label: 'Challenges', icon: Icons.Challenges },
  { path: '/stats',      label: 'Stats',      icon: Icons.Stats },
  { path: '/favorites',  label: 'Favorites',  icon: Icons.Favorites },
  { path: '/profile',    label: 'Profile',    icon: Icons.Profile },
];

const MOBILE_TABS = ['/', '/reels', '/females', '/favorites', '/profile'];

export default function Layout({ profile, isAdmin }) {
  const [showNav, setShowNav] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [joinInputCode, setJoinInputCode] = useState('');
  const [joinErr, setJoinErr] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const lastScrollY = useRef(0);
  const location = useLocation();

  const party = useWatchPartyContext();
  const { status, roomId, isHost, members, partyVideo, leaveRoom, joinRoom, createRoom, showJoinModal, setShowJoinModal } = party;

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setShowNav(y <= lastScrollY.current || y <= 80);
      lastScrollY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const allItems = isAdmin
    ? [
        ...navItems.slice(0, 7),
        {
          path: '/admin',
          label: 'Admin',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          ),
        },
        ...navItems.slice(7),
      ]
    : navItems;

  const tabItems  = allItems.filter(n => MOBILE_TABS.includes(n.path));
  const moreItems = allItems.filter(n => !MOBILE_TABS.includes(n.path));

  const handleJoinSubmit = async (e) => {
    e.preventDefault();
    const code = joinInputCode.trim().toUpperCase();
    if (code.length !== 6) {
      setJoinErr('Room code must be 6 characters');
      return;
    }
    setIsJoining(true);
    setJoinErr('');
    const ok = await joinRoom(code);
    setIsJoining(false);
    if (ok) {
      setShowJoinModal(false);
      setJoinInputCode('');
    } else {
      setJoinErr('Room not found or host disconnected');
    }
  };

  const handleCreateHostParty = async () => {
    await createRoom({ id: 'home', title: 'Reddit Reels Party', subreddit: 'all', url: '' });
  };

  return (
    <div className="min-h-screen text-white">

      {/* ── Active Watch Party status bar ── */}
      {status !== 'idle' && (
        <PartyBar
          roomId={roomId}
          isHost={isHost}
          members={members}
          onLeave={leaveRoom}
        />
      )}

      {/* ── Guest Media Mirror Overlay ── */}
      {!isHost && status === 'joined' && partyVideo && (partyVideo.url || partyVideo.id) && (
        <VideoModal
          key={partyVideo.id || partyVideo.url}
          video={partyVideo}
          isGuestMirror={true}
          isRedgifs={partyVideo.isRedgifs || (partyVideo.url && partyVideo.url.includes('redgifs.com'))}
          originalUrl={partyVideo.originalUrl || partyVideo.url}
          onClose={() => {}}
        />
      )}



      {/* ── Join Party Modal ── */}
      {showJoinModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          onClick={() => setShowJoinModal(false)}>
          <div className="w-full max-w-sm bg-[#121212] border border-white/10 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-xl font-black text-white">Join Watch Party</h3>
                <p className="text-xs text-white/50 mt-0.5">Enter the 6-character room code</p>
              </div>
              <button onClick={() => setShowJoinModal(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white">
                ✕
              </button>
            </div>
            <form onSubmit={handleJoinSubmit} className="space-y-4">
              <input
                type="text"
                value={joinInputCode}
                onChange={e => { setJoinInputCode(e.target.value.toUpperCase()); setJoinErr(''); }}
                maxLength={6}
                placeholder="ABC123"
                className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white text-center font-mono text-2xl tracking-[0.3em] uppercase focus:outline-none focus:border-neon-pink"
                autoFocus
              />
              {joinErr && <p className="text-xs text-red-400 text-center font-medium">{joinErr}</p>}
              <button
                type="submit"
                disabled={isJoining || joinInputCode.trim().length !== 6}
                className="w-full py-3.5 bg-neon-pink hover:bg-red-600 text-white font-bold rounded-xl shadow-lg transition-all disabled:opacity-40">
                {isJoining ? 'Joining Party...' : 'Join Party'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Desktop / tablet header ── */}
      <header className={`fixed top-0 inset-x-0 z-50 bg-[#0b0c10]/90 backdrop-blur-md border-b border-white/10
        transition-transform duration-300 ${showNav ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="max-w-[1800px] mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">

          <Link to="/"
            className="flex items-center gap-2 text-lg md:text-xl font-black tracking-tight shrink-0"
            aria-label="Reddit Reels home">
            <span className="w-7 h-7 rounded-lg bg-neon-pink flex items-center justify-center text-white font-black text-xs shadow-md">RR</span>
            <span className="text-white font-extrabold tracking-wider">REDDIT <span className="text-neon-pink">REELS</span></span>
          </Link>

          {/* Primary Navigation — Clean, restrained text/icon tabs */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
            {navItems.map(item => {
              const active = isActive(item.path);
              return (
                <Link key={item.path} to={item.path}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all duration-150
                    ${active
                      ? 'bg-white/10 text-white font-bold border border-white/15'
                      : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                  aria-current={active ? 'page' : undefined}>
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Secondary Controls & Party Actions */}
          <div className="hidden md:flex items-center gap-2">
            {status === 'idle' ? (
              <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-lg border border-white/10">
                <button
                  type="button"
                  onClick={handleCreateHostParty}
                  className="flex items-center gap-1 px-3 py-1 rounded-md bg-neon-pink hover:bg-neon-pink/80 text-white text-xs font-bold transition-all cursor-pointer">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                  </svg>
                  Host Party
                </button>
                <button
                  type="button"
                  onClick={() => setShowJoinModal(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md hover:bg-white/10 text-white/70 hover:text-white text-xs font-semibold transition-all cursor-pointer">
                  Join
                </button>
              </div>
            ) : null}

            {isAdmin && (
              <Link to="/admin"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  isActive('/admin')
                    ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
                    : 'bg-white/5 border-white/10 text-yellow-400/80 hover:text-yellow-300 hover:bg-white/10'
                }`}>
                <span>👑</span>
                <span>Admin</span>
              </Link>
            )}

            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10
                text-white/60 text-xs font-semibold hover:bg-white/10 hover:text-white transition-all shrink-0"
              onClick={() => auth.signOut()}>
              Sign out
            </button>
          </div>

          {/* Mobile: current route label */}
          <span className="md:hidden text-sm font-bold text-white/50">
            {allItems.find(n => isActive(n.path))?.label ?? ''}
          </span>
        </div>
      </header>


      {/* ── Page content ── */}
      <main className="max-w-[1800px] mx-auto px-3 md:px-8 pt-16 md:pt-20 pb-24 md:pb-10">
        <Outlet context={{ profile, isAdmin }} />
      </main>

      {/* ── Mobile bottom tab bar ── */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-black/92 backdrop-blur-xl
          border-t border-white/8 safe-area-pb"
        aria-label="Mobile navigation">
        <div className="flex items-center justify-around h-16">
          {tabItems.map(item => {
            const active = isActive(item.path);
            return (
              <Link key={item.path} to={item.path}
                className={`relative flex flex-col items-center gap-0.5 min-w-[44px] min-h-[44px]
                  justify-center px-2 transition-colors duration-150
                  ${active ? 'text-neon-pink' : 'text-white/35 hover:text-white/70'}`}
                aria-current={active ? 'page' : undefined}>
                {item.icon}
                <span className="text-[9px] font-bold tracking-wide">{item.label}</span>
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-1
                    rounded-full bg-neon-pink shadow-[0_0_6px_rgba(255,47,86,0.8)]" />
                )}
              </Link>
            );
          })}

          <button
            onClick={() => setDrawerOpen(p => !p)}
            className={`relative flex flex-col items-center gap-0.5 min-w-[44px] min-h-[44px]
              justify-center px-2 transition-colors duration-150
              ${drawerOpen ? 'text-neon-pink' : 'text-white/35 hover:text-white/70'}`}
            aria-expanded={drawerOpen}
            aria-label="More navigation options">
            {Icons.More}
            <span className="text-[9px] font-bold tracking-wide">More</span>
          </button>
        </div>
      </nav>

      {/* ── Mobile "More" sheet ── */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/55 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true">
          <div
            className="absolute bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] inset-x-0 bg-[#16181e] border-t border-white/15
              rounded-t-2xl px-4 pt-3 pb-8 shadow-2xl max-h-[75vh] overflow-y-auto no-scrollbar
              animate-in slide-in-from-bottom-2 duration-200"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-label="More options">
            {/* drag handle */}
            <div className="w-10 h-1 bg-white/30 rounded-full mx-auto mb-4" />

            {/* Watch Party Controls (Mobile) */}
            {status === 'idle' && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => { setDrawerOpen(false); handleCreateHostParty(); }}
                  className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-neon-pink text-white font-bold text-xs transition-all cursor-pointer">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                  </svg>
                  Host Party
                </button>
                <button
                  type="button"
                  onClick={() => { setDrawerOpen(false); setShowJoinModal(true); }}
                  className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-white/10 text-white font-bold text-xs border border-white/15 transition-all cursor-pointer">
                  Join Party
                </button>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 mb-3">
              {moreItems.map(item => {
                const active = isActive(item.path);
                return (
                  <Link key={item.path} to={item.path}
                    className={`flex flex-col items-center gap-1.5 py-3.5 rounded-xl border
                      transition-all duration-150
                      ${active
                        ? 'bg-neon-pink/10 border-neon-pink/30 text-neon-pink'
                        : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'}`}
                    aria-current={active ? 'page' : undefined}>
                    {item.icon}
                    <span className="text-xs font-semibold">{item.label}</span>
                  </Link>
                );
              })}
            </div>

            <button
              onClick={() => auth.signOut()}
              className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10
                text-white/60 font-semibold text-xs hover:bg-white/10 hover:text-white
                transition-all duration-150 cursor-pointer">
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
