import { useState, useRef, useEffect } from 'react';
import Hls from 'hls.js';
import { useWatchParty } from '../lib/useWatchParty';
import { getRedditHlsUrl, isRedditUrl, getRedgifsId } from '../lib/media-utils';

const BACKEND = import.meta.env.VITE_BACKEND_API_URL;

/* ─── Join by room ID input ─── */
function JoinForm({ onJoin, onClose }) {
  const [id, setId]   = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async (e) => {
    e.preventDefault();
    const code = id.trim().toUpperCase();
    if (code.length !== 6) { setErr('Room code must be 6 characters'); return; }
    setLoading(true);
    const ok = await onJoin(code);
    if (!ok) { setErr('Room not found or already closed'); setLoading(false); }
  };

  return (
    <form onSubmit={handleJoin} className="space-y-4">
      <div>
        <label className="text-xs font-bold text-white/40 uppercase tracking-wider mb-1.5 block">
          Room code
        </label>
        <input
          type="text"
          value={id}
          onChange={e => { setId(e.target.value.toUpperCase()); setErr(''); }}
          maxLength={6}
          placeholder="ABC123"
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-center
            font-mono text-2xl tracking-[0.3em] placeholder-white/20 focus:outline-none
            focus:border-neon-blue transition-colors uppercase"
          autoFocus
        />
        {err && <p className="text-red-400 text-xs mt-1.5">{err}</p>}
      </div>
      <button
        type="submit"
        disabled={loading || id.trim().length !== 6}
        className="w-full py-3 bg-neon-pink hover:bg-red-600 text-white font-bold rounded-xl
          transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? 'Joining…' : 'Join Party'}
      </button>
      <button type="button" onClick={onClose}
        className="w-full py-2.5 text-white/40 hover:text-white text-sm transition-colors">
        Cancel
      </button>
    </form>
  );
}

import { useWatchPartyContext } from '../context/WatchPartyContext';

/* ─── Floating Reaction Particles Overlay ─── */
export function FloatingReactions() {
  const { lastReaction } = useWatchPartyContext() || {};
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (!lastReaction?.emoji) return;
    const newItems = Array.from({ length: 5 }).map((_, i) => ({
      id: `${lastReaction.id}_${i}`,
      emoji: lastReaction.emoji,
      left: Math.floor(Math.random() * 50) + 40, // 40% - 90%
      animDelay: i * 0.12,
    }));
    setParticles(prev => [...prev.slice(-15), ...newItems]);
  }, [lastReaction]);

  return (
    <div className="fixed inset-0 pointer-events-none z-[130] overflow-hidden">
      {particles.map(p => (
        <span
          key={p.id}
          style={{ left: `${p.left}%`, animationDelay: `${p.animDelay}s` }}
          className="absolute bottom-12 text-3xl animate-float-up opacity-0 drop-shadow-[0_0_12px_rgba(255,255,255,0.6)]"
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}

const EMOJIS = ['🔥', '❤️', '😂', '🤯', '👏', '💯'];

/* ─── Active party bar (shown during session) ─── */
export function PartyBar({ roomId, isHost, members, onLeave }) {
  const [copied, setCopied] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const chatBottomRef = useRef(null);

  const { messages, sendMessage, sendReaction } = useWatchPartyContext() || {};

  useEffect(() => {
    if (chatOpen && chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, chatOpen]);

  const safeCopy = async (e, text) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("Copy fallback handled:", err);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyLink = (e) => safeCopy(e, `${window.location.origin}/party/${roomId}`);
  const copyCode = (e) => safeCopy(e, roomId);

  const handleSendChat = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    if (sendMessage) sendMessage(inputText);
    setInputText('');
  };

  return (
    <>
      <FloatingReactions />

      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[110] flex flex-col items-center gap-2">
        <div className="flex items-center gap-2 md:gap-3 px-4 py-2 bg-black/90 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl animate-in slide-in-from-top-2 duration-300">

          {/* Pulse dot */}
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon-pink opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-neon-pink" />
          </span>

          <span className="text-xs md:text-sm font-bold text-white whitespace-nowrap">
            {isHost ? 'Hosting Party' : 'Synced with Host'} ({members.length})
          </span>

          {/* Avatars */}
          <div className="hidden sm:flex -space-x-1.5 shrink-0">
            {members.slice(0, 4).map((m, i) => (
              <div key={i}
                className="w-6 h-6 rounded-full bg-gradient-to-br from-neon-pink/60 to-neon-blue/60
                  border border-black flex items-center justify-center text-[9px] font-bold text-white"
                title={m.username}>
                {m.username?.[0]?.toUpperCase() || '?'}
              </div>
            ))}
            {members.length > 4 && (
              <div className="w-6 h-6 rounded-full bg-white/10 border border-black flex items-center justify-center text-[9px] text-white/60">
                +{members.length - 4}
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-white/15 shrink-0" />

          {/* Emoji Reaction Bar */}
          <div className="flex items-center gap-1 shrink-0">
            {EMOJIS.map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => sendReaction && sendReaction(emoji)}
                className="hover:scale-125 transition-transform text-sm sm:text-base cursor-pointer p-0.5"
                title={`Send ${emoji} reaction`}
              >
                {emoji}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-white/15 shrink-0" />

          {/* Chat Toggle Button */}
          <button
            type="button"
            onClick={() => setChatOpen(p => !p)}
            className={`relative flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
              chatOpen ? 'bg-neon-pink text-white shadow-[0_0_12px_rgba(255,47,86,0.4)]' : 'bg-white/10 text-white/80 hover:bg-white/20'
            }`}
          >
            💬 Chat
            {messages.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-neon-blue text-black font-extrabold text-[9px] flex items-center justify-center">
                {messages.length}
              </span>
            )}
          </button>

          {/* Code chip */}
          <button onClick={copyCode} type="button"
            className="hidden md:block font-mono text-xs font-bold text-white/70 hover:text-white transition-colors tracking-widest shrink-0"
            title="Click to copy code">
            {roomId}
          </button>

          {/* Share link */}
          <button onClick={copyLink} type="button"
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 hover:bg-white/20
              text-xs font-bold text-white transition-all cursor-pointer shrink-0">
            <svg className="w-3.5 h-3.5 text-neon-pink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            {copied ? 'Copied!' : 'Invite'}
          </button>

          {/* Leave */}
          <button onClick={onLeave} type="button"
            className="text-white/40 hover:text-red-400 transition-colors p-1 shrink-0"
            title={isHost ? 'End party' : 'Leave party'}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>

        {/* Collapsible Temporary Chat Drawer */}
        {chatOpen && (
          <div className="w-80 sm:w-96 bg-black/95 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl p-4 flex flex-col gap-3 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                💬 Party Chat
              </span>
              <button onClick={() => setChatOpen(false)} className="text-white/40 hover:text-white text-xs">
                ✕
              </button>
            </div>

            {/* Messages Stream */}
            <div className="h-44 overflow-y-auto space-y-2 pr-1 text-xs">
              {messages.length === 0 ? (
                <p className="text-white/30 text-center py-8 italic">No messages yet. Say hello!</p>
              ) : (
                messages.map((m, i) => (
                  <div key={i} className="bg-white/5 rounded-xl p-2 border border-white/5">
                    <span className="font-bold text-neon-blue mr-1.5">{m.user}:</span>
                    <span className="text-white/90">{m.text}</span>
                  </div>
                ))
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendChat} className="flex items-center gap-2 pt-1 border-t border-white/10">
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-white/8 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-neon-pink"
              />
              <button
                type="submit"
                className="px-3.5 py-2 bg-neon-pink hover:bg-red-600 font-bold text-xs text-white rounded-xl transition-all cursor-pointer shrink-0"
              >
                Send
              </button>
            </form>
          </div>
        )}
      </div>
    </>
  );
}



/* ─── Guest player — mirrors host's video ─── */
function GuestPlayer({ video, videoRef }) {
  const hlsRef   = useRef(null);
  const [src, setSrc] = useState(video.url);

  // Resolve redgifs
  useEffect(() => {
    if (video.url?.includes('redgifs.com')) {
      const id = getRedgifsId(video.url);
      if (id) {
        fetch(`${BACKEND}/api/redgifs/${id}`)
          .then(r => r.json())
          .then(d => { if (d.url) setSrc(d.url); })
          .catch(() => {});
        return;
      }
    }
    setSrc(video.url);
  }, [video.url]);

  // Attach HLS / direct
  useEffect(() => {
    if (!videoRef.current || !src) return;
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    const hlsSrc = isRedditUrl(src) ? getRedditHlsUrl(src) : src;
    if (hlsSrc?.includes('.m3u8') && Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(hlsSrc);
      hls.attachMedia(videoRef.current);
      hlsRef.current = hls;
    } else {
      videoRef.current.src = src;
    }
    return () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } };
  }, [src, videoRef]);

  return (
    <video
      ref={videoRef}
      poster={video.thumbnail}
      playsInline
      muted
      className="w-full h-full object-contain bg-black"
    />
  );
}

/* ─── Main exported component ─── */
export default function WatchParty({ video, onClose }) {
  const [view, setView] = useState('menu'); // menu | join
  const videoRef = useRef(null);
  const { roomId, isHost, status, partyVideo, members, createRoom, joinRoom, leaveRoom } = useWatchParty(videoRef);

  const handleCreate = async () => {
    await createRoom(video);
  };

  const handleJoin = async (id) => {
    return await joinRoom(id);
  };

  const handleLeave = async () => {
    await leaveRoom();
    onClose();
  };

  // Active party bar — shown on top of the normal app
  if (status !== 'idle') {
    return (
      <>
        <PartyBar
          roomId={roomId}
          isHost={isHost}
          members={members}
          onLeave={handleLeave}
        />
        {/* Guest player — full screen overlay */}
        {!isHost && partyVideo && (
          <div className="fixed inset-0 z-40 bg-black flex flex-col">
            <div className="relative flex-1">
              <GuestPlayer video={partyVideo} videoRef={videoRef} />
              <div className="absolute bottom-0 inset-x-0 p-5 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
                <p className="text-xs text-white/50 mb-0.5">r/{partyVideo.subreddit}</p>
                <p className="text-sm font-bold text-white line-clamp-2">{partyVideo.title}</p>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Setup modal
  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center
      bg-black/75 backdrop-blur-sm"
      onClick={onClose}>
      <div
        className="w-full sm:max-w-sm bg-[#111] border border-white/10 rounded-t-3xl sm:rounded-2xl
          p-6 shadow-2xl animate-in slide-in-from-bottom-2 sm:zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}>

        {/* Handle */}
        <div className="sm:hidden w-8 h-1 bg-white/20 rounded-full mx-auto mb-5" />

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-black text-white">Watch Party</h2>
            <p className="text-xs text-white/40 mt-0.5">Watch together in real time</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full
            bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {view === 'menu' && (
          <div className="space-y-3">
            {/* Current video preview */}
            <div className="flex items-center gap-3 p-3 bg-white/4 rounded-xl border border-white/8 mb-5">
              {video.thumbnail && (
                <img src={video.thumbnail} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold text-white line-clamp-2">{video.title}</p>
                <p className="text-[10px] text-white/40 mt-0.5">r/{video.subreddit}</p>
              </div>
            </div>

            <button
              onClick={handleCreate}
              className="w-full py-3.5 bg-neon-pink hover:bg-red-600 text-white font-bold
                rounded-xl transition-all flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
              </svg>
              Host a party
            </button>

            <button
              onClick={() => setView('join')}
              className="w-full py-3.5 bg-white/6 hover:bg-white/10 border border-white/10
                text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Join with a code
            </button>
          </div>
        )}

        {view === 'join' && (
          <JoinForm
            onJoin={handleJoin}
            onClose={() => setView('menu')}
          />
        )}
      </div>
    </div>
  );
}
