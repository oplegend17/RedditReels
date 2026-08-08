import { useState, useEffect, useRef, useCallback } from 'react';
import { ref, set, onValue, remove, serverTimestamp, onDisconnect } from 'firebase/database';
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

  const syncIntervalRef = useRef(null);
  const roomRefPath     = roomId ? `rooms/${roomId}` : null;

  const user = auth.currentUser;
  const username = user?.displayName || user?.email?.split('@')[0] || 'Guest';

  /* ── Create a new room as host ── */
  const createRoom = useCallback(async (video) => {
    if (!user) return null;
    const id = makeRoomId();
    const path = `rooms/${id}`;

    await set(ref(rtdb, path), {
      host: user.uid,
      videoId: video.id,
      subreddit: video.subreddit,
      url: video.url,
      title: video.title,
      thumbnail: video.thumbnail || '',
      currentTime: 0,
      isPlaying: true,
      createdAt: serverTimestamp(),
      members: {
        [user.uid]: { username, joinedAt: Date.now(), lastSeen: Date.now() },
      },
    });

    // Auto-remove room when host disconnects
    onDisconnect(ref(rtdb, path)).remove();

    setRoomId(id);
    setIsHost(true);
    setPartyVideo(video);
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
    setStatus('idle');
  }, [roomId, isHost, user]);

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

  /* ── Guest: listen to room state and sync video ── */
  useEffect(() => {
    if (!roomId || isHost) return;

    const roomRef = ref(rtdb, `rooms/${roomId}`);
    const unsub = onValue(roomRef, (snap) => {
      const data = snap.val();
      if (!data) {
        // Room was deleted (host left)
        leaveRoom();
        return;
      }

      setPartyVideo({
        id: data.videoId,
        subreddit: data.subreddit,
        url: data.url,
        title: data.title,
        thumbnail: data.thumbnail,
      });

      setMembers(data.members || {});

      const vid = videoRef?.current;
      if (!vid) return;

      // Sync time if more than threshold off
      if (Math.abs(vid.currentTime - data.currentTime) > SYNC_THRESHOLD_S) {
        vid.currentTime = data.currentTime;
      }

      if (data.isPlaying && vid.paused) {
        vid.play().catch(() => {});
      } else if (!data.isPlaying && !vid.paused) {
        vid.pause();
      }
    });

    return () => unsub();
  }, [roomId, isHost, videoRef, leaveRoom]);

  /* ── Host: subscribe to member list ── */
  useEffect(() => {
    if (!roomId || !isHost) return;
    const membersRef = ref(rtdb, `rooms/${roomId}/members`);
    const unsub = onValue(membersRef, (snap) => {
      setMembers(snap.val() || {});
    });
    return () => unsub();
  }, [roomId, isHost]);

  const memberCount = Object.keys(members).length;
  const memberList  = Object.values(members);

  return {
    roomId,
    isHost,
    status,
    partyVideo,
    members: memberList,
    memberCount,
    createRoom,
    joinRoom,
    leaveRoom,
  };
}
