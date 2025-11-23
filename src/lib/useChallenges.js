import { useState, useEffect, useCallback, useRef } from 'react';

export const CHALLENGE_TYPES = {
  TRY_NOT_TO_CUM: {
    id: 'tryNotToCum',
    name: 'Try Not to Cum',
    icon: '💦',
    description: 'Survive for the selected duration without pausing or skipping',
    durations: [180, 300, 600], // 3min, 5min, 10min in seconds
    rules: [
      'No pausing allowed',
      'No skipping videos',
      'Click "I Lost" if you can\'t continue',
      'Intensity meter tracks your progress'
    ]
  },
  ENDURANCE_RUN: {
    id: 'enduranceRun',
    name: 'Endurance Run',
    icon: '🏃',
    description: 'Videos get progressively more intense - see how long you last',
    durations: null, // Open-ended
    rules: [
      'Content intensity increases over time',
      'No time limit - pure endurance',
      'Click "I Give Up" to end the challenge'
    ]
  },
  ROULETTE: {
    id: 'roulette',
    name: 'Roulette Mode',
    icon: '🎰',
    description: 'Completely random content - you never know what\'s next',
    durations: [300, 600, 900], // 5min, 10min, 15min
    rules: [
      'Random shuffle across all categories',
      'Quick 20-30 second intervals',
      'High-intensity content prioritized',
      'No control over what plays next'
    ]
  },
  TEN_MINUTE: {
    id: 'tenMinute',
    name: '10 Minute Challenge',
    icon: '⏱️',
    description: 'Fixed 10 minutes - no pause, no skip, just survive',
    durations: [600], // 10min only
    rules: [
      'Fixed 10-minute duration',
      'No pausing',
      'No skipping',
      'One shot to complete'
    ]
  },
  RAPID_FIRE: {
    id: 'rapidFire',
    name: 'Rapid Fire',
    icon: '⚡',
    description: 'Quick 10-15 second clips in rapid succession',
    durations: [300, 600], // 5min, 10min
    rules: [
      'Quick 10-15 second clips',
      'No breathing room',
      'High stimulation focus',
      'Automatic advancement'
    ]
  },
  NO_CONTROL: {
    id: 'noControl',
    name: 'No Control Mode',
    icon: '🔒',
    description: 'Hardcore mode - absolutely no control',
    durations: [300, 600], // 5min, 10min
    rules: [
      'Cannot pause or skip',
      'Cannot control playback',
      'Pure endurance test',
      'Highest difficulty'
    ]
  }
};

export const useChallenges = () => {
  const [activeChallenge, setActiveChallenge] = useState(null);
  const [challengeState, setChallengeState] = useState('idle'); // idle, active, paused, complete, failed
  const [elapsedTime, setElapsedTime] = useState(0);
  const [challengeDuration, setChallengeDuration] = useState(0);
  const [videosWatched, setVideosWatched] = useState(0);
  const [pauseCount, setPauseCount] = useState(0);
  const [skipCount, setSkipCount] = useState(0);
  
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  // Start a challenge
  const startChallenge = useCallback((challengeType, duration = null) => {
    const challenge = CHALLENGE_TYPES[challengeType];
    if (!challenge) return;

    setActiveChallenge(challenge);
    setChallengeState('active');
    setElapsedTime(0);
    setChallengeDuration(duration || 0);
    setVideosWatched(0);
    setPauseCount(0);
    setSkipCount(0);
    startTimeRef.current = Date.now();

    // Start timer
    timerRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
  }, []);

  // Pause challenge (may be penalized in some modes)
  const pauseChallenge = useCallback(() => {
    if (challengeState !== 'active') return;
    
    setChallengeState('paused');
    setPauseCount(prev => prev + 1);
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [challengeState]);

  // Resume challenge
  const resumeChallenge = useCallback(() => {
if (challengeState !== 'paused') return;
    
    setChallengeState('active');
    
    // Restart timer
    timerRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
  }, [challengeState]);

  // Record video watched
  const recordVideoWatched = useCallback(() => {
    setVideosWatched(prev => prev + 1);
  }, []);

  // Record skip (may fail challenge in some modes)
  const recordSkip = useCallback(() => {
    setSkipCount(prev => prev + 1);
    
    // Auto-fail in no-control modes
    if (activeChallenge?.id === 'noControl' || activeChallenge?.id === 'tenMinute') {
      failChallenge('skipped');
    }
  }, [activeChallenge]);

  // Complete challenge successfully
  const completeChallenge = useCallback(() => {
    setChallengeState('complete');
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return {
      challengeType: activeChallenge?.id,
      duration: elapsedTime,
      videosWatched,
      pauseCount,
      skipCount
    };
  }, [activeChallenge, elapsedTime, videosWatched, pauseCount, skipCount]);

  // Fail challenge
  const failChallenge = useCallback((reason = 'gave_up') => {
    setChallengeState('failed');
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return {
      challengeType: activeChallenge?.id,
      duration: elapsedTime,
      videosWatched,
      reason
    };
  }, [activeChallenge, elapsedTime, videosWatched]);

  // End challenge (manual)
  const endChallenge = useCallback(() => {
    setActiveChallenge(null);
    setChallengeState('idle');
    setElapsedTime(0);
    setVideosWatched(0);
    setPauseCount(0);
    setSkipCount(0);
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Auto-complete when duration is reached
  useEffect(() => {
    if (challengeDuration > 0 && elapsedTime >= challengeDuration && challengeState === 'active') {
      completeChallenge();
    }
  }, [elapsedTime, challengeDuration, challengeState, completeChallenge]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Format time for display
  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const getRemainingTime = useCallback(() => {
    if (challengeDuration === 0) return null;
    return Math.max(0, challengeDuration - elapsedTime);
  }, [challengeDuration, elapsedTime]);

  return {
    activeChallenge,
    challengeState,
    elapsedTime,
    challengeDuration,
    videosWatched,
    pauseCount,
    skipCount,
    startChallenge,
    pauseChallenge,
    resumeChallenge,
    recordVideoWatched,
    recordSkip,
    completeChallenge,
    failChallenge,
    endChallenge,
    formatTime,
    getRemainingTime,
    isActive: challengeState === 'active',
    canPause: activeChallenge?.id !== 'noControl' && activeChallenge?.id !== 'tenMinute',
    canSkip: activeChallenge?.id !== 'noControl' && activeChallenge?.id !== 'tenMinute'
  };
};
