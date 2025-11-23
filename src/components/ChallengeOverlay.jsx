export default function ChallengeOverlay({ 
  challengeName, 
  elapsedTime, 
  remainingTime, 
  formatTime,
  intensity,
  videosWatched,
  onGiveUp,
  onILost,
  showControls = true
}) {
  const getRemainingDisplay = () => {
    if (remainingTime === null) {
      return formatTime(elapsedTime);
    }
    return formatTime(remainingTime);
  };

  const getTimerLabel = () => {
    if (remainingTime === null) {
      return 'Time Survived';
    }
    return 'Time Remaining';
  };

  return (
    <>
      {/* Top Overlay - Challenge Info */}
      <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
        <div className="glass-panel px-6 py-3 rounded-full border-2 border-neon-pink/50 shadow-[0_0_20px_rgba(255,47,86,0.3)] animate-in fade-in slide-in-from-top duration-500">
          <div className="flex items-center gap-4">
            {/* Challenge Name */}
            <div className="text-center">
              <div className="text-xs text-white/60 uppercase tracking-wider mb-0.5">Challenge</div>
              <div className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-neon-pink to-neon-blue">
                {challengeName}
              </div>
            </div>

            <div className="w-px h-8 bg-white/20" />

            {/* Timer */}
            <div className="text-center min-w-[120px]">
              <div className="text-xs text-white/60 uppercase tracking-wider mb-0.5">{getTimerLabel()}</div>
              <div className={`text-2xl font-black tabular-nums ${
                remainingTime !== null && remainingTime <= 30 ? 'text-red-500 animate-pulse' : 'text-white'
              }`}>
                {getRemainingDisplay()}
              </div>
            </div>

            <div className="w-px h-8 bg-white/20" />

            {/* Videos Watched */}
            <div className="text-center">
              <div className="text-xs text-white/60 uppercase tracking-wider mb-0.5">Videos</div>
              <div className="text-lg font-bold text-neon-blue">
                {videosWatched}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      {showControls && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
          <div className="flex gap-4">
            <button
              onClick={onILost}
              className="px-8 py-4 rounded-full bg-red-600/80 hover:bg-red-600 backdrop-blur-md border border-red-500/50 text-white font-black shadow-[0_0_20px_rgba(255,0,0,0.4)] hover:shadow-[0_0_30px_rgba(255,0,0,0.6)] transition-all duration-300 hover:scale-105"
            >
              💦 I Lost
            </button>
            
            <button
              onClick={onGiveUp}
              className="px-8 py-4 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-bold transition-all duration-300 hover:scale-105"
            >
              🏳️ Give Up
            </button>
          </div>
        </div>
      )}

      {/* Countdown Flash Effect for last 10 seconds */}
      {remainingTime !== null && remainingTime > 0 && remainingTime <= 10 && (
        <div className="fixed inset-0 pointer-events-none z-40">
          <div 
            className="absolute inset-0 border-8 border-red-500 animate-pulse"
            style={{
              boxShadow: 'inset 0 0 100px rgba(255, 0, 0, 0.3)'
            }}
          />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="text-[120px] font-black text-red-500 animate-pulse drop-shadow-[0_0_30px_rgba(255,0,0,0.8)]">
              {remainingTime}
            </div>
          </div>
        </div>
      )}

      {/* Victory Flash for completion */}
      {remainingTime === 0 && (
        <div className="fixed inset-0 pointer-events-none z-50 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-gradient-to-b from-green-500/20 via-transparent to-green-500/20" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
            <div className="text-6xl font-black text-green-500 drop-shadow-[0_0_30px_rgba(0,255,0,0.8)] animate-bounce mb-4">
              🏆 VICTORY! 🏆
            </div>
            <div className="text-2xl font-bold text-white drop-shadow-lg">
              Challenge Complete!
            </div>
          </div>
        </div>
      )}
    </>
  );
}
