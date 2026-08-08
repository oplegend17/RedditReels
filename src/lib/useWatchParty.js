import { useState, useEffect, useRef, useCallback } from 'react';
import { ref, set, push, onValue, remove, serverTimestamp, onDisconnect } from 'firebase/database';
import { rtdb, auth } from './firebase';

const SYNC_INTERVAL_MS = 2000; // host pushes currentTime every 2s
const SYNC_THRESHOLD_S = 2;    // guest resyncs if >2s behind/ahead

function makeRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function useWatchParty(videoRef) {
  const [roomId, setRoomId]         = useState(null);
  const [isHost, setIsHost]         = useState(false);
  const [members, setMembers]       = useState({});
  const [partyVideo, setPartyVideo] = useState(null); // { id, subreddit, url, title, thumbnail }
  const [status, setStatus]         = useState('idle'); // idle | hosting | joined

  const [messages, setMessages]     = useState([]);
  const [lastReaction, setLastReaction] = useState(null);
  const [scrollRatio, setScrollRatio]   = useState(0);

  const syncIntervalRef = useRef(null);

  const user = auth.currentUser;
  const username = user?.displayName || user?.email?.split('@')[0] || 'Guest';

  /* ── Create a new room as host ── */
  const createRoom = useCallback(async (video) => {
    if (!user) return null;
    const id = makeRoomId();
    const path = `rooms/${id}`;

    await set(ref(rtdb, path), {
      host: user.uid,
      videoId: video?.id || '',
      subreddit: video?.subreddit || 'all',
      url: video?.url || '',
      title: video?.title || 'Reddit Reels Party',
      thumbnail: video?.thumbnail || '',
      currentTime: 0,
      isPlaying: true,
      scrollRatio: 0,
      createdAt: serverTimestamp(),
      members: {
        [user.uid]: { username, joinedAt: Date.now(), lastSeen: Date.now() },
      },
    });

    // Auto-remove room when host disconnects
    onDisconnect(ref(rtdb, path)).remove();

    setRoomId(id);
    setIsHost(true);
    setPartyVideo(video?.url ? video : null);
    setStatus('hosting');
    return id;
  }, [user, username]);

  /* ── Join an existing room ── */
  const joinRoom = useCallback(async (id) => {
    if (!user) return false;
    const path = `rooms/${id}`;
    const memberPath = `${path}/members/${user.uid}`;

    // Write presence
    await set(ref(rtdb, memberPath), {
      username,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
    });

    // Remove self on disconnect
    onDisconnect(ref(rtdb, memberPath)).remove();

    setRoomId(id);
    setIsHost(false);
    setStatus('joined');
    return true;
  }, [user, username]);

  /* ── Leave / close room ── */
  const leaveRoom = useCallback(async () => {
    if (!roomId || !user) return;
    if (isHost) {
      await remove(ref(rtdb, `rooms/${roomId}`));
    } else {
      await remove(ref(rtdb, `rooms/${roomId}/members/${user.uid}`));
    }
    clearInterval(syncIntervalRef.current);
    setRoomId(null);
    setIsHost(false);
    setMembers({});
    setPartyVideo(null);
    setMessages([]);
    setLastReaction(null);
    setStatus('idle');
  }, [roomId, isHost, user]);

  /* ── Host: sync current route ── */
  const syncRoute = useCallback(async (route) => {
    if (!isHost || !roomId) return;
    try {
      await set(ref(rtdb, `rooms/${roomId}/currentRoute`), route);
    } catch (e) {
      console.error('Error syncing route:', e);
    }
  }, [isHost, roomId]);

  /* ── Host: sync active video ── */
  const syncVideo = useCallback(async (video) => {
    if (!isHost || !roomId) return;
    try {
      await set(ref(rtdb, `rooms/${roomId}/partyVideo`), video || null);
      await set(ref(rtdb, `rooms/${roomId}/videoId`), video?.id || '');
      await set(ref(rtdb, `rooms/${roomId}/url`), video?.url || '');
      await set(ref(rtdb, `rooms/${roomId}/title`), video?.title || '');
    } catch (e) {
      console.error('Error syncing video:', e);
    }
  }, [isHost, roomId]);

  /* ── Host: sync scroll ratio ── */
  const syncScroll = useCallback(async (ratio) => {
    if (!isHost || !roomId) return;
    try {
      await set(ref(rtdb, `rooms/${roomId}/scrollRatio`), ratio);
    } catch (e) {}
  }, [isHost, roomId]);

  /* ── Send temporary chat message ── */
  const sendMessage = useCallback(async (text) => {
    if (!roomId || !text.trim()) return;
    try {
      const msgRef = push(ref(rtdb, `rooms/${roomId}/messages`));
      await set(msgRef, {
        user: username,
        text: text.trim(),
        timestamp: Date.now(),
      });
    } catch (e) {
      console.error('Error sending message:', e);
    }
  }, [roomId, username]);

  /* ── Broadcast reaction emoji ── */
  const sendReaction = useCallback(async (emoji) => {
    if (!roomId || !emoji) return;
    try {
      await set(ref(rtdb, `rooms/${roomId}/lastReaction`), {
        emoji,
        user: username,
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      });
    } catch (e) {
      console.error('Error sending reaction:', e);
    }
  }, [roomId, username]);

  /* ── Host: push playback state every 2s ── */
  useEffect(() => {
    if (!isHost || !roomId || !videoRef?.current) return;

    syncIntervalRef.current = setInterval(() => {
      const vid = videoRef.current;
      if (!vid) return;
      set(ref(rtdb, `rooms/${roomId}/currentTime`), vid.currentTime);
      set(ref(rtdb, `rooms/${roomId}/isPlaying`), !vid.paused);
    }, SYNC_INTERVAL_MS);

    return () => clearInterval(syncIntervalRef.current);
  }, [isHost, roomId, videoRef]);

  /* ── Listen to room state ── */
  const [currentRoute, setCurrentRoute] = useState(null);

  useEffect(() => {
    if (!roomId) return;

    const roomRef = ref(rtdb, `rooms/${roomId}`);
    const unsub = onValue(roomRef, (snap) => {
      const data = snap.val();
      if (!data) {
        // Room was deleted (host left)
        leaveRoom();
        return;
      }

      if (data.currentRoute && data.currentRoute !== currentRoute) {
        setCurrentRoute(data.currentRoute);
      }

      if (typeof data.scrollRatio === 'number') {
        setScrollRatio(data.scrollRatio);
      }

      if (data.lastReaction) {
        setLastReaction(data.lastReaction);
      }

      if (data.messages) {
        setMessages(Object.values(data.messages));
      } else {
        setMessages([]);
      }

      const activeMedia = data.partyVideo || null;
      setPartyVideo(activeMedia);
      setMembers(data.members || {});

      if (!isHost) {
        const vid = videoRef?.current;
        if (!vid) return;

        if (typeof data.currentTime === 'number' && Math.abs(vid.currentTime - data.currentTime) > SYNC_THRESHOLD_S) {
          vid.currentTime = data.currentTime;
        }

        if (data.isPlaying && vid.paused) {
          vid.play().catch(() => {});
        } else if (!data.isPlaying && !vid.paused) {
          vid.pause();
        }
      }
    });

    return () => unsub();
  }, [roomId, isHost, videoRef, leaveRoom, currentRoute]);

  const memberCount = Object.keys(members).length;
  const memberList  = Object.values(members);

  return {
    roomId,
    isHost,
    status,
    partyVideo,
    currentRoute,
    scrollRatio,
    members: memberList,
    memberCount,
    messages,
    lastReaction,
    createRoom,
    joinRoom,
    leaveRoom,
    syncRoute,
    syncVideo,
    syncScroll,
    sendMessage,
    sendReaction,
  };
}


