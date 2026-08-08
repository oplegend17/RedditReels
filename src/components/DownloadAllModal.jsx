import { useState, useRef, useEffect } from 'react';
import { useDownloads } from '../lib/useDownloads';

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL;

export default function DownloadAllModal({ subreddit, onClose }) {
  const { addDownload } = useDownloads();
  const [maxPages, setMaxPages] = useState(10);
  const [sort, setSort] = useState('hot'); // 'hot' | 'new' | 'top'
  const [timeFrame, setTimeFrame] = useState('all'); // 'all' | 'year' | 'month' | 'week' | 'day'
  const [status, setStatus] = useState('idle'); // 'idle' | 'scanning' | 'downloading' | 'success' | 'error'
  const [downloadedMb, setDownloadedMb] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [progressMsg, setProgressMsg] = useState('');
  const [videosCount, setVideosCount] = useState(0);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  
  const abortController = useRef(null);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        if (status === 'idle' || status === 'success' || status === 'error') {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose, status]);

  const handleStartDownload = async () => {
    setStatus('scanning');
    setDownloadedMb(0);
    setErrorMsg('');
    setProgressMsg('Scanning pages on Reddit...');
    setCurrentVideoIndex(0);
    setVideosCount(0);
    setSuccessCount(0);
    
    abortController.current = new AbortController();

    try {
      let after = '';
      let videos = [];
      let pagesFetched = 0;
      
      // Phase 1: Scan and collect metadata from JSON API
      while (pagesFetched < maxPages) {
        if (abortController.current.signal.aborted) break;
        
        setProgressMsg(`Scanning Reddit pages: ${pagesFetched + 1} of ${maxPages}...`);
        
        let url = `${BACKEND_API_URL}/api/reddit/${subreddit}?sort=${sort}&t=${timeFrame}`;
        if (after) {
          url += `&after=${after}`;
        }
        
        const response = await fetch(url, { signal: abortController.current.signal });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || 'Subreddit unavailable or private.');
        }
        
        const data = await response.json();
        const children = data?.data?.children || [];
        if (children.length === 0) break;
        
        const pageVids = children
          .map(post => post?.data)
          .filter(p => {
            if (!p) return false;
            const urlStr = p.url_overridden_by_dest || p.url || '';
            return (
              (p.is_video && p.media?.reddit_video?.fallback_url) ||
              p.preview?.reddit_video_preview?.fallback_url ||
              urlStr.includes('v.redd.it')
            );
          })
          .map(p => ({
            id: p.id,
            title: p.title,
            url: p?.media?.reddit_video?.fallback_url || p?.preview?.reddit_video_preview?.fallback_url || ''
          }))
          .filter(p => p.url);
        
        videos.push(...pageVids);
        setVideosCount(videos.length);
        
        after = data?.data?.after;
        if (!after) break;
        pagesFetched++;
      }

      if (abortController.current.signal.aborted) {
        setStatus('idle');
        return;
      }

      if (videos.length === 0) {
        throw new Error('No downloadable Reddit-hosted videos found in this subreddit feed.');
      }

      // Phase 2: Download videos directly in browser and trigger browser save
      setStatus('downloading');
      let succeeded = 0;
      let totalBytesTransferred = 0;

      for (let i = 0; i < videos.length; i++) {
        if (abortController.current.signal.aborted) break;
        
        const video = videos[i];
        setCurrentVideoIndex(i + 1);
        setProgressMsg(`Downloading: "${video.title ? video.title.slice(0, 35) + '...' : video.id}"`);

        try {
          // Fetch video from backend merge endpoint to combine audio and video tracks
          const mergeUrl = `${BACKEND_API_URL}/api/merge-video?url=${encodeURIComponent(video.url)}`;
          const videoRes = await fetch(mergeUrl, { 
            signal: abortController.current.signal 
          });

          if (videoRes.ok) {
            const blob = await videoRes.blob();
            
            // Create local URL
            const downloadUrl = window.URL.createObjectURL(blob);
            
            // Sanitise file name
            const safeTitle = (video.title || video.id)
              .replace(/[\\/:*?"<>|]/g, "_")
              .slice(0, 50);
            const filename = `${succeeded + 1}_${safeTitle}.mp4`;
            
            // Trigger direct save
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            
            // Cleanup local memory
            window.URL.revokeObjectURL(downloadUrl);
            document.body.removeChild(a);
            
            // Save download entry in history (Firestore / LocalBackup)
            await addDownload({
              id: video.id,
              title: video.title,
              url: video.url,
              subreddit: subreddit
            });
            
            succeeded++;
            setSuccessCount(succeeded);
            
            totalBytesTransferred += blob.size;
            setDownloadedMb(totalBytesTransferred / (1024 * 1024));
            
            // Wait 600ms to allow browser to trigger save dialogs consecutively
            await new Promise(resolve => setTimeout(resolve, 600));
          }
        } catch (e) {
          console.warn(`Skipped video ${video.id} due to fetch error:`, e.message);
        }
      }

      if (abortController.current.signal.aborted) {
        setStatus('idle');
        return;
      }

      if (succeeded === 0) {
        throw new Error('All video downloads failed or were blocked. Please try again.');
      }
      
      setStatus('success');
    } catch (err) {
      if (err.name === 'AbortError') {
        setStatus('idle');
      } else {
        console.error('Bulk download error:', err);
        setErrorMsg(err.message || 'An unknown error occurred during download.');
        setStatus('error');
      }
    }
  };

  const handleCancel = () => {
    if (abortController.current) {
      abortController.current.abort();
    }
    setStatus('idle');
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-300"
      onClick={status === 'idle' || status === 'success' || status === 'error' ? onClose : undefined}
    >
      <div 
        className="relative w-full max-w-lg p-8 bg-black/40 border border-white/10 rounded-3xl backdrop-blur-xl shadow-2xl animate-in zoom-in-95 duration-300 mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        {(status === 'idle' || status === 'success' || status === 'error') && (
          <button 
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-white/60 hover:text-white hover:bg-white/15 transition-all duration-300 cursor-pointer"
            onClick={onClose}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {status === 'idle' && (
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">📥</span>
                <span className="text-[10px] font-black tracking-widest text-neon-pink uppercase px-2 py-0.5 rounded bg-neon-pink/10 border border-neon-pink/20">
                  Bulk Downloader
                </span>
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">Download r/{subreddit}</h2>
              <p className="text-white/40 text-xs mt-1">
                Downloads and queues videos individually in your browser. Zero zipping overhead!
              </p>
            </div>

            {/* Warning Alert */}
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 text-yellow-300/90 text-xs leading-relaxed space-y-1.5">
              <div className="font-bold flex items-center gap-1.5 text-yellow-400">
                <span>⚠️</span> Browser Download Notice
              </div>
              <p>• The browser may ask: <strong>"Allow this site to download multiple files?"</strong>. Click <strong>Allow</strong> to proceed.</p>
              <p>• Videos download straight to your browser's default downloads directory.</p>
              <p>• Video files are automatically merged with their audio tracks on-the-fly!</p>
            </div>

            {/* Page Limit Selector */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-wider block">
                How many pages to scan?
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[1, 5, 10, 25, 100].map((pages) => (
                  <button
                    key={pages}
                    onClick={() => setMaxPages(pages)}
                    className={`py-3 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                      maxPages === pages
                        ? 'bg-white text-black border-white shadow'
                        : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {pages} {pages === 1 ? 'Page' : 'Pages'}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-white/30 font-mono leading-relaxed mt-1.5">
                * Each page scans up to 100 posts. Note: Reddit's API strictly caps all standard feeds at <strong>1,000 total posts (~10 pages)</strong>. 
                <br/>💡 <strong>To download *literally all* videos:</strong> simply run downloads under different <em>Sort Filters</em> (e.g., first download <strong>HOT</strong>, then download <strong>TOP (All Time)</strong>, then <strong>TOP (Month)</strong>). This loads older/alternative feeds to compile and bypass the 1,000 limit!
              </p>
            </div>

            {/* Sort Selector */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-wider block">
                Sort Filter
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['hot', 'new', 'top'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSort(s)}
                    className={`py-3 rounded-xl text-xs font-bold transition-all border cursor-pointer uppercase ${
                      sort === s
                        ? 'bg-white text-black border-white shadow'
                        : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Timeframe Selector (Only visible if sort is top) */}
            {sort === 'top' && (
              <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-wider block">
                  Top Timeframe
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {['all', 'year', 'month', 'week', 'day'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTimeFrame(t)}
                      className={`py-2 rounded-lg text-[10px] font-bold transition-all border cursor-pointer uppercase ${
                        timeFrame === t
                          ? 'bg-neon-pink text-white border-neon-pink shadow'
                          : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white font-bold text-sm transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleStartDownload}
                className="flex-1 py-3.5 bg-neon-pink hover:bg-red-600 text-white rounded-xl font-bold text-sm shadow-[0_0_20px_rgba(255,47,86,0.3)] transition-all cursor-pointer"
              >
                🚀 Start Download
              </button>
            </div>
          </div>
        )}

        {(status === 'scanning' || status === 'downloading') && (
          <div className="text-center py-8 space-y-6">
            {/* Spinning/pulsing animation */}
            <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 border-4 border-neon-pink/20 border-t-neon-pink rounded-full animate-spin"></div>
              <span className="text-3xl animate-bounce">
                {status === 'scanning' ? '🔍' : '📥'}
              </span>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-black text-white">
                {status === 'scanning' && 'Scanning Subreddit...'}
                {status === 'downloading' && `Queuing Videos (${currentVideoIndex}/${videosCount})`}
              </h3>
              <p className="text-xs text-white/40 max-w-sm mx-auto min-h-[32px] flex items-center justify-center">
                {progressMsg}
              </p>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full max-w-xs mx-auto space-y-1">
              <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-neon-pink to-neon-blue transition-all duration-300 rounded-full"
                  style={{
                    width: videosCount > 0 
                      ? `${Math.min(100, Math.round((currentVideoIndex / videosCount) * 100))}%` 
                      : status === 'scanning' ? '30%' : '0%'
                  }}
                />
              </div>
              {videosCount > 0 && (
                <div className="flex justify-between text-[10px] text-white/40 font-mono">
                  <span>{Math.round((currentVideoIndex / videosCount) * 100)}%</span>
                  <span>{currentVideoIndex} / {videosCount}</span>
                </div>
              )}
            </div>

            {/* Bytes Counter */}
            <div className="bg-white/5 border border-white/10 rounded-2xl py-4 px-6 max-w-xs mx-auto">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-wider block mb-1">
                Data Queued
              </span>
              <span className="text-3xl font-black text-white font-mono">
                {downloadedMb.toFixed(1)} <span className="text-neon-pink text-xl">MB</span>
              </span>
            </div>

            <button
              onClick={handleCancel}
              className="px-6 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              🛑 Abort Downloader
            </button>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center py-8 space-y-6">
            <div className="w-16 h-16 bg-emerald-500/15 border border-emerald-500/30 rounded-full flex items-center justify-center text-emerald-500 text-3xl mx-auto shadow-[0_0_25px_rgba(16,185,129,0.2)]">
              ✓
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-black text-white">All Downloads Queued!</h3>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto leading-relaxed">
                Successfully queued <strong>{successCount}</strong> videos directly to your browser's download manager.
              </p>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl py-3 px-6 max-w-xs mx-auto text-xs text-emerald-300 font-bold">
              📦 Total Transferred: {downloadedMb.toFixed(1)} MB
            </div>

            <button
              onClick={onClose}
              className="px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white text-sm font-bold transition-all cursor-pointer"
            >
              Return to Gallery
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center py-8 space-y-6">
            <div className="w-16 h-16 bg-red-500/15 border border-red-500/30 rounded-full flex items-center justify-center text-red-500 text-3xl mx-auto shadow-[0_0_25px_rgba(239,68,68,0.2)]">
              ⚠️
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-black text-white">Queueing Failed</h3>
              <p className="text-xs text-red-400 max-w-sm mx-auto leading-relaxed">
                {errorMsg}
              </p>
            </div>

            <div className="flex gap-3 max-w-xs mx-auto pt-2">
              <button
                onClick={onClose}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white font-bold text-xs transition-all cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={handleStartDownload}
                className="flex-1 py-3 bg-neon-pink hover:bg-red-600 text-white rounded-xl font-bold text-xs shadow-lg transition-all cursor-pointer"
              >
                🔄 Retry
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
