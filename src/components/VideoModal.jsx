import { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { getRedditHlsUrl, isRedditUrl, isRedgifsUrl, getRedgifsId } from '../lib/media-utils';

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL;

export default function VideoModal({ video, onClose, isRedgifs, originalUrl }) {
  const videoRef = useRef(null);
  const [currentSrc, setCurrentSrc] = useState(video.url);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    if (isRedgifs && originalUrl) {
        const id = getRedgifsId(originalUrl);
        if (id) {
            fetch(`${BACKEND_API_URL}/api/redgifs/${id}`)
                .then(r => r.json())
                .then(d => {
                    if (d.url) setCurrentSrc(d.url);
                })
                .catch(() => {});
        }
    } else {
        setCurrentSrc(video.url);
    }
  }, [video.url, isRedgifs, originalUrl]);

  useEffect(() => {
    if (!videoRef.current) return;
    
    const hlsSrc = isRedditUrl(currentSrc) ? getRedditHlsUrl(currentSrc) : currentSrc;
    
    let hls = null;
    if (hlsSrc.includes('.m3u8')) {
        if (Hls.isSupported()) {
            hls = new Hls();
            hls.loadSource(hlsSrc);
            hls.attachMedia(videoRef.current);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                videoRef.current.play().catch(e => {
                  if (e.name === 'NotAllowedError') {
                    videoRef.current.muted = true;
                    videoRef.current.play();
                  }
                });
            });
        } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
            videoRef.current.src = hlsSrc;
        }
    } else {
        videoRef.current.src = currentSrc;
    }

    return () => {
        if (hls) hls.destroy();
    };
  }, [currentSrc]);

  const handleDownload = async () => {
    try {
      const response = await fetch(currentSrc || video.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${video.title}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}>
      <div className="relative flex flex-col md:flex-row gap-8 max-w-[95vw] max-h-[90vh] p-4 md:p-8 bg-black/40 border border-white/10 rounded-3xl backdrop-blur-xl shadow-2xl animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
        <button 
          className="absolute -top-4 -right-4 md:top-4 md:right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 hover:rotate-90 transition-all duration-300 z-50 backdrop-blur-md" 
          onClick={onClose}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        
        <div className="order-2 md:order-1 w-full md:w-80 flex flex-col gap-6 h-fit self-center">
          <h2 className="text-2xl font-bold text-white leading-tight text-glow">{video.title}</h2>
          <div className="flex flex-col gap-4 mt-auto">
             <button 
              className="flex items-center justify-center gap-3 px-6 py-4 bg-neon-pink hover:bg-red-600 text-white rounded-xl font-bold shadow-[0_0_20px_rgba(255,47,86,0.3)] hover:shadow-[0_0_30px_rgba(255,47,86,0.5)] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer" 
              onClick={handleDownload}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download Video
            </button>
          </div>
        </div>

        <div className="order-1 md:order-2 relative rounded-2xl overflow-hidden shadow-2xl shadow-black/50 border border-white/5">
          <video
            ref={videoRef}
            controls
            autoPlay
            loop
            className="max-h-[50vh] md:max-h-[80vh] w-auto object-contain bg-black"
          />
        </div>
      </div>
    </div>
  );
}
