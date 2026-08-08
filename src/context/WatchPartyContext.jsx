import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useWatchParty } from '../lib/useWatchParty';

const WatchPartyContext = createContext(null);

export function WatchPartyProvider({ children }) {
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showHostModal, setShowHostModal] = useState(false);
  const videoRef = useRef(null);

  const location = useLocation();
  const navigate = useNavigate();

  const watchParty = useWatchParty(videoRef);
  const { isHost, roomId, currentRoute, syncRoute, syncScroll, scrollRatio, status } = watchParty;

  // Host: sync current route whenever location changes
  useEffect(() => {
    if (isHost && roomId && location.pathname) {
      syncRoute(location.pathname);
    }
  }, [isHost, roomId, location.pathname, syncRoute]);

  // Guest: navigate when Host changes route
  useEffect(() => {
    if (!isHost && currentRoute && location.pathname !== currentRoute) {
      navigate(currentRoute);
    }
  }, [isHost, currentRoute, location.pathname, navigate]);

  // Host: broadcast scroll position
  useEffect(() => {
    if (!isHost || status !== 'hosting' || !roomId) return;
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
          if (maxScroll > 0) {
            const ratio = window.scrollY / maxScroll;
            syncScroll(ratio);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isHost, status, roomId, syncScroll]);

  // Guest: mirror host scroll position
  useEffect(() => {
    if (isHost || status !== 'joined' || typeof scrollRatio !== 'number') return;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (maxScroll > 0) {
      const targetY = scrollRatio * maxScroll;
      if (Math.abs(window.scrollY - targetY) > 50) {
        window.scrollTo({ top: targetY, behavior: 'smooth' });
      }
    }
  }, [isHost, status, scrollRatio]);

  const value = {
    ...watchParty,
    videoRef,
    showJoinModal,
    setShowJoinModal,
    showHostModal,
    setShowHostModal,
  };


  return (
    <WatchPartyContext.Provider value={value}>
      {children}
    </WatchPartyContext.Provider>
  );
}

export function useWatchPartyContext() {
  const ctx = useContext(WatchPartyContext);
  if (!ctx) {
    throw new Error('useWatchPartyContext must be used within a WatchPartyProvider');
  }
  return ctx;
}
