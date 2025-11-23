import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChallenges, CHALLENGE_TYPES } from '../lib/useChallenges';
import { useIntensity } from '../lib/useIntensity';
import { useAchievements } from '../lib/useAchievements';
import { useFavorites } from '../lib/useFavorites';
import IntensityMeter from './IntensityMeter';
import ChallengeOverlay from './ChallengeOverlay';
import AchievementPopup from './AchievementSystem';
import { addToLeaderboard } from './Leaderboard';
import DrippingEffect from './DrippingEffect';

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:3000';

const CHALLENGE_ICONS = {
  tryNotToCum: (
    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  ),
  enduranceRun: (
    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  roulette: (
    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  tenMinute: (
    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  rapidFire: (
    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  noControl: (
    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  )
};

export default function ChallengeMode() {
  const { challengeId } = useParams();
  const navigate = useNavigate();
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [selectedDuration, setSelectedDuration] = useState(null);
  const [videos, setVideos] = useState([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [isStarting, setIsStarting] = useState(false);

  const challenges = useChallenges();
  const intensity = useIntensity(challenges.isActive);
  const achievements = useAchievements();
  const { isFavorite, addFavorite, removeFavorite } = useFavorites();

  // Sync URL with state
  useEffect(() => {
    const challenge = Object.values(CHALLENGE_TYPES).find(c => c.id === challengeId);
    if (challengeId && challenge) {
      setSelectedChallenge(challenge);
      // Default duration if not set
      if (!selectedDuration && challenge.durations) {
        setSelectedDuration(challenge.durations[0]);
      }
    } else {
      setSelectedChallenge(null);
      setSelectedDuration(null);
    }
  }, [challengeId]);

  const calculateHeat = (ups) => {
    if (ups > 5000) return 'nuclear';
    if (ups > 1000) return 'fire';
    if (ups > 500) return 'spicy';
    return null;
  };

  // Fetch videos for challenge
  const fetchChallengeVideos = useCallback(async (challengeType) => {
    setIsLoading(true);
    setError(null);
    
    const fetchFromSubreddit = async (sub) => {
      try {
        const response = await fetch(`${BACKEND_API_URL}/api/reddit/${sub}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        return (data?.data?.children || [])
          .map(post => post?.data)
          .filter(p => 
            (p?.is_video && p?.media?.reddit_video?.fallback_url) ||
            (p?.preview?.reddit_video_preview?.fallback_url)
          )
          .map(p => ({
            id: p.id,
            title: p.title,
            url: p?.media?.reddit_video?.fallback_url || p?.preview?.reddit_video_preview?.fallback_url,
            thumbnail: p?.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, '&') || '',
            subreddit: p.subreddit,
            ups: p.ups || 0,
            heat: calculateHeat(p.ups)
          }));
      } catch (err) {
        console.error(`Failed to fetch from ${sub}:`, err);
        return [];
      }
    };

    try {
      let primarySub = 'nsfw+porn+bonermaterial+nsfw_gifs+60fpsporn';
      let backupSub = 'nsfw_hardcore+grool+squirting';

      // For endurance run, prioritize high heat content
      if (challengeType === 'enduranceRun') {
        primarySub = 'nsfw+hardcore+rough+anal+deepthroat+bdsm';
        backupSub = 'BDSMcommunity+Bondage';
      }
      
      // For roulette, completely random
      if (challengeType === 'roulette') {
        primarySub = 'all'; 
        backupSub = 'random';
      }

      // Try primary subreddit
      let vids = await fetchFromSubreddit(primarySub);

      // If no videos, try backup
      if (vids.length === 0) {
        console.log('Primary fetch failed or empty, trying backup...');
        vids = await fetchFromSubreddit(backupSub);
      }

      // If still no videos, try a reliable fallback
      if (vids.length === 0) {
        console.log('Backup fetch failed, trying reliable fallback...');
        vids = await fetchFromSubreddit('nsfw');
      }

      if (vids.length === 0) {
        throw new Error('No videos found. Please check your internet connection or try again later.');
      }

      // Shuffle videos for randomness
      vids = vids.sort(() => Math.random() - 0.5);

      setVideos(vids);
      setCurrentVideoIndex(0);
    } catch (error) {
      console.error('Failed to fetch challenge videos:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Start challenge
  const handleStartChallenge = async () => {
    if (!selectedChallenge || !selectedDuration) return;

    await fetchChallengeVideos(selectedChallenge.id);
    challenges.startChallenge(selectedChallenge.id, selectedDuration);
    intensity.reset();
    setShowResults(false);
    setIsStarting(true);
  };

  // Handle video change
  const nextVideo = useCallback(() => {
    if (currentVideoIndex < videos.length - 1) {
      setCurrentVideoIndex(prev => prev + 1);
      challenges.recordVideoWatched();
      
      // Record heat for achievements
      const currentVideo = videos[currentVideoIndex];
      if (currentVideo?.heat) {
        achievements.recordVideoWatch(currentVideo.heat);
      }

      // Fetch more videos if running low
      if (currentVideoIndex >= videos.length - 3) {
        fetchChallengeVideos(selectedChallenge.id);
      }
    }
  }, [currentVideoIndex, videos, challenges, achievements, selectedChallenge, fetchChallengeVideos]);

  // Handle previous video
  const previousVideo = useCallback(() => {
    if (currentVideoIndex > 0) {
      setCurrentVideoIndex(prev => prev - 1);
    }
  }, [currentVideoIndex]);

  // Keyboard controls
  useEffect(() => {
    if (!challenges.isActive) return;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        nextVideo();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        previousVideo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [challenges.isActive, nextVideo, previousVideo]);

  // Handle challenge completion
  const handleChallengeComplete = useCallback(() => {
    const challengeData = challenges.completeChallenge();
    
    // Record achievement progress
    achievements.recordChallengeComplete(
      challengeData.challengeType, 
      Math.floor(challengeData.duration / 60)
    );

    // Add to leaderboard
    addToLeaderboard({
      ...challengeData,
      intensity: intensity.intensity
    });

    // Show results
    setResults({
      ...challengeData,
      success: true,
      intensity: intensity.intensity
    });
    setShowResults(true);

    // Reset
    intensity.reset();
  }, [challenges, achievements, intensity]);

  // Handle challenge failure
  const handleChallengeFail = useCallback((reason) => {
    const challengeData = challenges.failChallenge(reason);
    
    setResults({
      ...challengeData,
      success: false,
      intensity: intensity.intensity
    });
    setShowResults(true);

    intensity.reset();
  }, [challenges, intensity]);

  // Auto-complete when time runs out
  useEffect(() => {
    if (challenges.challengeState === 'complete') {
      handleChallengeComplete();
    }
  }, [challenges.challengeState, handleChallengeComplete]);

  const handleToggleFavorite = async (e) => {
    e?.stopPropagation();
    if (!currentVideo) return;
    
    if (isFavorite(currentVideo.id)) {
      await removeFavorite(currentVideo.id);
    } else {
      await addFavorite({ ...currentVideo, subreddit: currentVideo.subreddit });
    }
  };

  const currentVideo = videos[currentVideoIndex];

  // Challenge Selection Screen
  if (!challenges.isActive && !showResults) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-500 to-pink-500 mb-4">
              🔥 Challenge Mode
            </h1>
            <p className="text-xl text-white/70">
              Test your limits with intense challenge modes
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="max-w-md mx-auto mb-8 p-4 bg-red-500/20 border border-red-500 rounded-xl text-center text-red-200">
              <p className="font-bold">Error starting challenge:</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Challenge Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {Object.values(CHALLENGE_TYPES).map(challenge => (
              <button
                key={challenge.id}
                onClick={() => navigate(`/challenges/${challenge.id}`)}
                className={`text-left p-6 rounded-2xl border-2 transition-all duration-300 ${
                  selectedChallenge?.id === challenge.id
                    ? 'bg-neon-pink/20 border-neon-pink scale-105 shadow-[0_0_30px_rgba(255,47,86,0.4)]'
                    : 'glass-panel border-white/10 hover:border-white/30 hover:scale-105'
                }`}
              >
                {/* Icon */}
                <div className="text-neon-pink mb-4">{CHALLENGE_ICONS[challenge.id]}</div>

                {/* Title */}
                <h3 className="text-2xl font-black text-white mb-2">
                  {challenge.name}
                </h3>

                {/* Description */}
                <p className="text-sm text-white/70 mb-4">
                  {challenge.description}
                </p>

                {/* Rules */}
                <ul className="text-xs text-white/50 space-y-1">
                  {challenge.rules.map((rule, index) => (
                    <li key={index}>• {rule}</li>
                  ))}
                </ul>
              </button>
            ))}
          </div>

          {/* Duration Selection & Start */}
          {selectedChallenge && (
            <div className="glass-panel p-8 rounded-2xl border-2 border-neon-pink/50 animate-in fade-in slide-in-from-bottom duration-500">
              <h3 className="text-2xl font-black text-white mb-6">
                Configure {selectedChallenge.name}
              </h3>

              {selectedChallenge.durations && (
                <div className="mb-6">
                  <label className="block text-sm font-bold text-white/70 uppercase tracking-wider mb-3">
                    Duration
                  </label>
                  <div className="flex gap-3">
                    {selectedChallenge.durations.map(duration => (
                      <button
                        key={duration}
                        onClick={() => setSelectedDuration(duration)}
                        className={`px-6 py-3 rounded-full text-lg font-bold transition-all duration-300 ${
                          selectedDuration === duration
                            ? 'bg-neon-blue text-black shadow-[0_0_20px_rgba(0,243,255,0.4)]'
                            : 'bg-white/10 text-white hover:bg-white/20'
                        }`}
                      >
                        {Math.floor(duration / 60)} min
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleStartChallenge}
                disabled={isLoading}
                className="w-full px-8 py-5 rounded-full bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white text-2xl font-black shadow-[0_0_30px_rgba(255,47,86,0.5)] hover:shadow-[0_0_50px_rgba(255,47,86,0.7)] transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Loading...' : '🔥 Start Challenge'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Results Screen
  if (showResults && results) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl">
        <div className="max-w-2xl w-full p-8">
          <div className={`glass-panel p-12 rounded-3xl border-4 ${
            results.success 
              ? 'border-green-500 shadow-[0_0_50px_rgba(0,255,0,0.5)]' 
              : 'border-red-500 shadow-[0_0_50px_rgba(255,0,0,0.5)]'
          }`}>
            {/* Result Icon */}
            <div className="text-center mb-8">
              <div className="text-9xl mb-4 animate-bounce">
                {results.success ? '🏆' : '💔'}
              </div>
              <h2 className={`text-5xl font-black mb-2 ${
                results.success ? 'text-green-500' : 'text-red-500'
              }`}>
                {results.success ? 'VICTORY!' : 'CHALLENGE FAILED'}
              </h2>
              <p className="text-white/70 text-xl">
                {results.success 
                  ? 'You completed the challenge!' 
                  : `Reason: ${results.reason || 'Unknown'}`}
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="text-center glass-panel p-4 rounded-xl">
                <div className="text-4xl font-black text-neon-blue">
                  {challenges.formatTime(results.duration)}
                </div>
                <div className="text-xs text-white/60 uppercase tracking-wider">Duration</div>
              </div>
              <div className="text-center glass-panel p-4 rounded-xl">
                <div className="text-4xl font-black text-neon-pink">
                  {results.videosWatched}
                </div>
                <div className="text-xs text-white/60 uppercase tracking-wider">Videos Watched</div>
              </div>
              <div className="text-center glass-panel p-4 rounded-xl">
                <div className="text-4xl font-black text-yellow-500">
                  {Math.round(results.intensity)}%
                </div>
                <div className="text-xs text-white/60 uppercase tracking-wider">Peak Intensity</div>
              </div>
              <div className="text-center glass-panel p-4 rounded-xl">
                <div className="text-4xl font-black text-green-500">
                  {achievements.unlockedAchievements.length}
                </div>
                <div className="text-xs text-white/60 uppercase tracking-wider">Achievements</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setShowResults(false);
                  challenges.endChallenge();
                  navigate('/challenges');
                }}
                className="flex-1 px-6 py-4 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold transition-all duration-300"
              >
                Back to Menu
              </button>
              <button
                onClick={() => {
                  setShowResults(false);
                  handleStartChallenge();
                }}
                className="flex-1 px-6 py-4 rounded-full bg-neon-pink hover:bg-red-600 text-white font-bold shadow-[0_0_20px_rgba(255,47,86,0.4)] transition-all duration-300"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active Challenge Screen
  return (
    <div className="fixed inset-0 z-40 bg-black">
      {/* Video Player */}
      {currentVideo && (
        <video
          key={currentVideo.id}
          src={currentVideo.url}
          poster={currentVideo.thumbnail}
          autoPlay
          loop={selectedChallenge?.id !== 'rapidFire' && selectedChallenge?.id !== 'roulette'}
          muted={false}
          playsInline
          className="w-full h-full object-contain"
          onEnded={() => {
            if (selectedChallenge?.id === 'rapidFire' || selectedChallenge?.id === 'roulette') {
              nextVideo();
            }
          }}
        />
      )}

      {/* Dripping Effect */}
      {isStarting && (
        <DrippingEffect onComplete={() => setIsStarting(false)} />
      )}

      {/* Challenge Overlay */}
      <ChallengeOverlay
        challengeName={selectedChallenge?.name}
        elapsedTime={challenges.elapsedTime}
        remainingTime={challenges.getRemainingTime()}
        formatTime={challenges.formatTime}
        intensity={intensity.intensity}
        videosWatched={challenges.videosWatched}
        onGiveUp={() => handleChallengeFail('gave_up')}
        onILost={() => handleChallengeFail('lost')}
        showControls={challenges.canPause}
      />

      {/* Achievement Popups */}
      <AchievementPopup 
        achievements={achievements.newlyUnlocked.map(id => achievements.allAchievements[id.toUpperCase().replace(/_/g, '_')])}
        onClose={() => {}}
      />

      {/* Side Controls (Navigation & Like) */}
      <div className="fixed right-8 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-6">
        {/* Previous Video (Up Arrow) */}
        {selectedChallenge?.id !== 'rapidFire' && selectedChallenge?.id !== 'roulette' && (
          <button
            onClick={previousVideo}
            disabled={currentVideoIndex === 0}
            className="w-16 h-16 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/20 hover:border-white/50 text-white transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed hover:scale-110 group"
            title="Previous Video (Up Arrow)"
          >
            <svg className="w-8 h-8 group-hover:-translate-y-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
            </svg>
          </button>
        )}

        {/* Like Button */}
        <button
          onClick={handleToggleFavorite}
          className={`w-16 h-16 flex items-center justify-center rounded-full backdrop-blur-md border transition-all duration-300 hover:scale-110 ${
            currentVideo && isFavorite(currentVideo.id)
              ? 'bg-neon-pink text-white border-neon-pink shadow-[0_0_20px_rgba(255,47,86,0.5)]'
              : 'bg-black/40 hover:bg-black/60 border-white/20 hover:border-white/50 text-white'
          }`}
          title="Like Video"
        >
          <svg className={`w-8 h-8 ${currentVideo && isFavorite(currentVideo.id) ? 'fill-current' : 'fill-none'}`} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>

        {/* Next Video (Down Arrow) */}
        {selectedChallenge?.id !== 'rapidFire' && selectedChallenge?.id !== 'roulette' && (
          <button
            onClick={nextVideo}
            className="w-16 h-16 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/20 hover:border-white/50 text-white transition-all duration-300 hover:scale-110 group"
            title="Next Video (Down Arrow)"
          >
            <svg className="w-8 h-8 group-hover:translate-y-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
