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
  const { isHost, roomId, currentRoute, syncRoute, status } = watchParty;

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
