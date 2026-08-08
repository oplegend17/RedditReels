import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import Hls from 'hls.js';
import { getRedditHlsUrl, isRedditUrl, getRedgifsId } from '../lib/media-utils';
import WatchParty from '../components/WatchParty';
import { useWatchParty } from '../lib/useWatchParty';

const BACKEND = import.meta.env.VITE_BACKEND_API_URL;

/* ────────────────────────────────────────────────────────────
   /watch/:subreddit/:id  —  shareable video page
   /party/:roomId         —  watch-party invite landing
──────────────────────────────────────────────────────────── */
export default function Watch() {
  const { subreddit, id, roomId: partyRoomId } = useParams();

  const [video, setVideo]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [src, setSrc]             = useState(null);
  const [copied, setCopied]       = useState(false);
  const [showParty, setShowParty] = useState(false);
  const videoRef = useRef(null);
  const hlsRef   = useRef(null);

  /* ── Fetch post (only for /watch routes) ── */
  useEffect(() => {
    if (!subreddit || !id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const parsePost = (post) => {
      const url =
        post.media?.reddit_video?.fallback_url ||
        post.preview?.reddit_video_preview?.fallback_url ||
        post.url_overridden_by_dest ||
        post.url ||
        '';

      return {
        id: post.id,
        title: post.title,
        url,
        thumbnail: post.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, '&') || '',
        subreddit: post.subreddit,
        isRedgifs: (post.url_overridden_by_dest || post.url || '').includes('redgifs.com'),
        originalUrl: post.url_overridden_by_dest || post.url,
      };
    };

    // 1. Try single post API route first
    fetch(`${BACKEND}/api/post/${subreddit}/${id}`)
      .then(r => {
        if (!r.ok) throw new Error('Post endpoint error');
        return r.json();
      })
      .then(d => {
        if (d?.post) {
          const parsed = parsePost(d.post);
          setVideo(parsed);
          setSrc(parsed.url);
        } else {
          throw new Error('Post not found');
        }
      })
      .catch(() => {
        // 2. Fallback to searching subreddit listing feed
        return fetch(`${BACKEND}/api/reddit/${subreddit}`)
          .then(r => r.json())
          .then(data => {
            const post = (data?.data?.children || [])
              .map(c => c.data)
              .find(p => p?.id === id);
            if (!post) throw new Error('Video not found');

            const parsed = parsePost(post);
            setVideo(parsed);
            setSrc(parsed.url);
          });
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [subreddit, id]);


  /* ── Resolve redgifs ── */
  useEffect(() => {
    if (!video?.isRedgifs || !video?.originalUrl) return;
    const rid = getRedgifsId(video.originalUrl);
    if (!rid) return;
    fetch(`${BACKEND}/api/redgifs/${rid}`)
      .then(r => r.json())
      .then(d => { if (d.url) setSrc(d.url); })
      .catch(() => {});
  }, [video]);

  /* ── HLS / direct attach ── */
  useEffect(() => {
    if (!videoRef.current || !src) return;
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    const hlsSrc = isRedditUrl(src) ? getRedditHlsUrl(src) : src;
    if (hlsSrc?.includes('.m3u8') && Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(hlsSrc);
      hls.attachMedia(videoRef.current);
      hls.on(Hls.Events.MANIFEST_PARSED, () => videoRef.current?.play().catch(() => {}));
      hlsRef.current = hls;
    } else if (src) {
      videoRef.current.src = src;
      videoRef.current.play().catch(() => {});
    }

    return () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } };
  }, [src]);

  const copyLink = async () => {
    const url = video
      ? `${window.location.origin}/watch/${video.subreddit}/${video.id}`
      : window.location.href;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ── /party/:roomId landing ── */
  if (partyRoomId && !subreddit) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6 text-white p-4">
        <div className="text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-black mb-1">You're invited to a Watch Party</h1>
          <p className="text-white/40 text-sm">
            Room <span className="font-mono text-white/70">{partyRoomId}</span>
          </p>
        </div>
        <WatchPartyJoinWidget roomId={partyRoomId} />
        <Link to="/" className="text-white/30 hover:text-white text-sm transition-colors mt-2">
          ← Browse videos
        </Link>
      </div>
    );
  }

  /* ── Loading ── */
  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-neon-pink border-t-transparent rounded-full animate-spin" />
    </div>
  );

  /* ── Error ── */
  if (error || !video) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 text-white">
      <span className="text-5xl">🚫</span>
      <p className="text-white/60">{error || 'Video not found'}</p>
      <Link to="/"
        className="px-6 py-2.5 bg-neon-pink hover:bg-red-600 rounded-full font-bold text-sm transition-colors">
        Back to home
      </Link>
    </div>
  );

  /* ── Video page ── */
  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Player */}
      <div className="w-full bg-black flex items-center justify-center" style={{ maxHeight: '80dvh' }}>
        <video
          ref={videoRef}
          poster={video.thumbnail}
          controls loop playsInline
          className="w-full object-contain"
          style={{ maxHeight: '80dvh' }}
        />
      </div>

      {/* Info + actions */}
      <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-4">
        <div>
          <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-1">
            r/{video.subreddit}
          </p>
          <h1 className="text-lg font-bold text-white leading-snug">{video.title}</h1>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={copyLink}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/6 hover:bg-white/10
              border border-white/10 text-sm font-bold text-white transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {copied ? 'Copied!' : 'Copy link'}
          </button>

          <button onClick={() => setShowParty(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neon-pink/10 hover:bg-neon-pink/20
              border border-neon-pink/30 hover:border-neon-pink/60 text-sm font-bold text-neon-pink transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Watch Party
          </button>

          <a href={`https://reddit.com/r/${video.subreddit}/comments/${video.id}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/6 hover:bg-white/10
              border border-white/10 text-sm font-bold text-white/60 hover:text-white transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Reddit
          </a>

          <Link to="/"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/6 hover:bg-white/10
              border border-white/10 text-sm font-bold text-white/60 hover:text-white transition-all ml-auto">
            ← Home
          </Link>
        </div>
      </div>

      {showParty && (
        <WatchParty video={video} onClose={() => setShowParty(false)} />
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Inline join widget — used on /party/:roomId landing page
──────────────────────────────────────────────────────────── */
function WatchPartyJoinWidget({ roomId }) {
  const videoRef = useRef(null);
  const { joinRoom, partyVideo, members } = useWatchParty(videoRef);
  const [joined, setJoined] = useState(false);
  const [err, setErr]       = useState('');

  const handleJoin = async () => {
    const ok = await joinRoom(roomId);
    if (ok) setJoined(true);
    else setErr('Room not found or has ended.');
  };

  if (joined && partyVideo) {
    return (
      <div className="text-center space-y-2">
        <p className="text-green-400 font-bold">You joined! 🎉</p>
        <p className="text-white/50 text-sm">
          Watching: <span className="text-white">{partyVideo.title}</span>
        </p>
        <p className="text-white/30 text-xs">{members.length} people in this party</p>
        <Link
          to={`/watch/${partyVideo.subreddit}/${partyVideo.id}`}
          className="inline-block mt-3 px-6 py-3 bg-neon-pink hover:bg-red-600
            rounded-xl font-bold text-white transition-colors">
          Open video →
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xs space-y-3">
      {err && <p className="text-red-400 text-sm text-center">{err}</p>}
      <button
        onClick={handleJoin}
        className="w-full py-3.5 bg-neon-pink hover:bg-red-600 text-white font-bold
          rounded-xl transition-all flex items-center justify-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Join Watch Party
      </button>
    </div>
  );
}
