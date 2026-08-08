import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Hls from 'hls.js';
import { getRedditHlsUrl, isRedditUrl, getRedgifsId } from '../lib/media-utils';
import WatchParty from './WatchParty';
import { useWatchPartyContext } from '../context/WatchPartyContext';

const BACKEND = import.meta.env.VITE_BACKEND_API_URL;

export default function VideoModal({ video, onClose, isRedgifs, originalUrl, isGuestMirror = false }) {
  const videoRef = useRef(null);
  const hlsRef   = useRef(null);
  const [src, setSrc]         = useState(video.url);
  const [muted, setMuted]     = useState(false);
  const [copied, setCopied]   = useState(false);
  const [showParty, setShowParty] = useState(false);
  const navigate = useNavigate();

  const partyContext = useWatchPartyContext();
  const { isHost, status, syncVideo, videoRef: sharedVideoRef, createRoom } = partyContext || {};

  // Host: automatically sync video with room on mount and clear on unmount
  useEffect(() => {
    if (isHost && status === 'hosting' && syncVideo && video) {
      syncVideo(video);
      return () => {
        syncVideo(null);
      };
    }
  }, [isHost, status, video, syncVideo]);

  const setVideoRefNode = (node) => {
    videoRef.current = node;
    if (sharedVideoRef) sharedVideoRef.current = node;
  };

  const shareUrl = `${window.location.origin}/watch/${video.subreddit}/${video.id}`;


  const copyLink = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = shareUrl;
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


  /* ── Escape key ── */
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  /* ── Resolve src (redgifs proxy) ── */
  useEffect(() => {
    let cancelled = false;
    const isRedgifMedia = isRedgifs || (video?.url && video.url.includes('redgifs.com'));
    const targetUrl = originalUrl || video?.originalUrl || video?.url;

    if (isRedgifMedia && targetUrl) {
      const rid = getRedgifsId(targetUrl);
      if (rid) {
        fetch(`${BACKEND}/api/redgifs/${rid}`)
          .then(r => r.json())
          .then(d => { if (d.url && !cancelled) setSrc(d.url); })
          .catch(() => { if (!cancelled) setSrc(video.url); });
        return () => { cancelled = true; };
      }
    }
    setSrc(video?.url || '');
    return () => { cancelled = true; };
  }, [video?.id, video?.url, isRedgifs, originalUrl]);

  /* ── HLS attach & video reload ── */
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !src) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    vid.pause();

    const hlsSrc = isRedditUrl(src) ? getRedditHlsUrl(src) : src;
    if (hlsSrc?.includes('.m3u8')) {
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(hlsSrc);
        hls.attachMedia(vid);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          vid.play().catch(() => {
            setMuted(true);
            vid.muted = true;
            vid.play().catch(() => {});
          });
        });
        hlsRef.current = hls;
      } else if (vid.canPlayType('application/vnd.apple.mpegurl')) {
        vid.src = hlsSrc;
        vid.load();
        vid.play().catch(() => {});
      }
    } else {
      vid.src = src;
      vid.load();
      vid.play().catch(() => {
        setMuted(true);
        vid.muted = true;
        vid.play().catch(() => {});
      });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src]);


  /* ── Mute sync ── */
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  const handleDownload = async () => {
    try {
      const r = await fetch(src || video.url);
      const blob = await r.blob();
      const url  = URL.createObjectURL(blob);
      const a    = Object.assign(document.createElement('a'), {
        href: url,
        download: `${(video.title || 'video').slice(0, 40)}.mp4`,
      });
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch { /* silent */ }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center
        bg-black/88 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={video.title}>

      <div
        className="relative w-full sm:w-auto flex flex-col sm:flex-row gap-0 sm:gap-6
          sm:max-w-[90vw] max-h-[100dvh] sm:max-h-[90vh]
          bg-[#0f0f0f] sm:bg-black/50 border-0 sm:border border-white/10
          rounded-t-3xl sm:rounded-2xl overflow-hidden backdrop-blur-xl shadow-2xl"
        onClick={e => e.stopPropagation()}>

        {/* Close */}
        <button
          className="absolute top-3 right-3 z-20 w-9 h-9 flex items-center justify-center
            rounded-full bg-black/60 text-white/60 hover:text-white hover:bg-black/80
            transition-all duration-150"
          onClick={onClose}
          aria-label="Close">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Video — full width on mobile, auto on desktop */}
        <div className="relative w-full sm:w-auto bg-black shrink-0">
          <video
            ref={setVideoRefNode}
            poster={video.thumbnail}
            controls
            loop
            playsInline
            muted={muted}
            className="w-full sm:w-auto max-h-[60dvh] sm:max-h-[80vh] object-contain block" />

          {/* Mute toggle overlay */}
          <button
            className={`absolute bottom-12 right-3 w-8 h-8 rounded-full flex items-center
              justify-center bg-black/60 backdrop-blur-sm border border-white/10
              text-white transition-all duration-150 hover:bg-black/80 ${muted ? 'opacity-100' : 'opacity-60 hover:opacity-100'}`}
            onClick={() => setMuted(m => !m)}
            aria-label={muted ? 'Unmute' : 'Mute'}>
            {muted
              ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <line x1="17" y1="17" x2="7" y2="7" stroke="currentColor" strokeWidth="2" />
                </svg>
              : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
            }
          </button>
        </div>

        {/* Info panel */}
        <div className="flex flex-col gap-4 p-5 sm:py-6 sm:pr-6 sm:pl-0 sm:w-72 shrink-0">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-white/30 uppercase tracking-wider">
              r/{video.subreddit}
            </p>
            {isGuestMirror && (
              <span className="px-2 py-0.5 rounded-full bg-neon-pink/20 border border-neon-pink/40 text-[10px] font-bold text-neon-pink animate-pulse">
                Live Party Sync
              </span>
            )}
          </div>
          <h2 className="text-base font-bold text-white leading-snug line-clamp-4 flex-1">
            {video.title}
          </h2>
          <button
            onClick={handleDownload}
            className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl
              bg-neon-pink hover:bg-red-600 text-white font-bold text-sm
              shadow-[0_0_20px_rgba(255,47,86,0.25)] hover:shadow-[0_0_28px_rgba(255,47,86,0.4)]
              transition-all duration-200 active:scale-95">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download
          </button>

          {/* Share link */}
          <button
            onClick={copyLink}
            className="flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl
              bg-white/6 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white
              font-bold text-sm transition-all duration-200 active:scale-95">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {copied ? 'Copied!' : 'Copy link'}
          </button>

          {/* Watch Party */}
          {!isGuestMirror && (
            <button
              onClick={() => {
                if (status === 'hosting') return;
                if (createRoom) createRoom(video);
                else setShowParty(true);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl font-bold text-sm transition-all duration-200 active:scale-95
                ${status === 'hosting'
                  ? 'bg-neon-pink text-white shadow-[0_0_16px_rgba(255,47,86,0.5)] cursor-default'
                  : 'bg-neon-pink/8 hover:bg-neon-pink/15 border border-neon-pink/25 hover:border-neon-pink/50 text-neon-pink'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {status === 'hosting' ? 'Broadcasting Live 🔴' : 'Watch Party'}
            </button>
          )}
        </div>
      </div>

      {showParty && (
        <WatchParty video={video} onClose={() => setShowParty(false)} />
      )}
    </div>
  );
}

