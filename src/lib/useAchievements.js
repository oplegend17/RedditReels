import { useState, useEffect, useCallback } from 'react';
import { ACHIEVEMENTS, getUnlockedAchievements, getAchievementProgress } from './achievements';

const STORAGE_KEY = 'reddit-reels-stats';
const UNLOCKED_KEY = 'reddit-reels-unlocked-achievements';

const DEFAULT_STATS = {
  challengesCompleted: 0,
  nuclearVideosWatched: 0,
  fireVideosWatched: 0,
  spicyVideosWatched: 0,
  tenMinuteChallengeCompleted: 0,
  consecutiveChallenges: 0,
  currentConsecutive: 0,
  rouletteRoundsCompleted: 0,
  rapidFireCompleted: 0,
  continuousWatchMinutes: 0,
  dailyStreak: 0,
  lastChallengeDate: null,
  noControlCompleted: 0,
  enduranceRunCompleted: 0,
  enduranceRunMinutes: 0,
  tryNotToCumCompleted: 0,
  rouletteCompleted: 0,
  perfectDays: 0,
  challengeDates: []
};

export const useAchievements = () => {
  const [stats, setStats] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_STATS;
  });

  const [unlockedAchievements, setUnlockedAchievements] = useState(() => {
    const saved = localStorage.getItem(UNLOCKED_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  const [newlyUnlocked, setNewlyUnlocked] = useState([]);

  // Save stats to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  }, [stats]);

  // Save unlocked achievements
  useEffect(() => {
    localStorage.setItem(UNLOCKED_KEY, JSON.stringify(unlockedAchievements));
  }, [unlockedAchievements]);

  // Calculate Level based on XP
  // Level 1: 0-1000 XP
  // Level 2: 1000-2500 XP
  // Level 3: 2500-5000 XP
  // etc.
  const calculateLevel = useCallback((xp) => {
    if (!xp) return 1;
    return Math.floor(1 + Math.sqrt(xp / 500));
  }, []);

  const getLevelProgress = useCallback((xp) => {
    const currentLevel = calculateLevel(xp);
    const nextLevel = currentLevel + 1;
    const currentLevelXp = 500 * Math.pow(currentLevel - 1, 2);
    const nextLevelXp = 500 * Math.pow(nextLevel - 1, 2);
    
    const progress = ((xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;
    return Math.min(Math.max(progress, 0), 100);
  }, [calculateLevel]);

  // Check for newly unlocked achievements
  useEffect(() => {
    const currentlyUnlocked = getUnlockedAchievements(stats);
    const newUnlocks = currentlyUnlocked.filter(id => !unlockedAchievements.includes(id));
    
    if (newUnlocks.length > 0) {
      setUnlockedAchievements(prev => [...prev, ...newUnlocks]);
      setNewlyUnlocked(newUnlocks);
      
      // Award XP for new achievements
      let xpGain = 0;
      newUnlocks.forEach(id => {
        const achievement = ACHIEVEMENTS[id];
        if (achievement) {
          xpGain += achievement.xp || 0;
        }
      });

      if (xpGain > 0) {
        setStats(prev => ({
          ...prev,
          xp: (prev.xp || 0) + xpGain
        }));
      }
      
      // Clear newly unlocked after showing animation
      setTimeout(() => setNewlyUnlocked([]), 5000);
    }
  }, [stats, unlockedAchievements]);

  const updateStats = useCallback((updates) => {
    setStats(prev => ({ ...prev, ...updates }));
  }, []);

  const incrementStat = useCallback((statName, amount = 1) => {
    setStats(prev => ({
      ...prev,
      [statName]: (prev[statName] || 0) + amount
    }));
  }, []);

  const recordVideoWatch = useCallback((heat) => {
    if (heat === 'nuclear') incrementStat('nuclearVideosWatched');
    if (heat === 'fire') incrementStat('fireVideosWatched');
    if (heat === 'spicy') incrementStat('spicyVideosWatched');
    
    // Small XP gain for watching intense videos
    if (heat === 'nuclear') incrementStat('xp', 10);
    if (heat === 'fire') incrementStat('xp', 5);
  }, [incrementStat]);

  const recordChallengeComplete = useCallback((challengeType, duration = 0) => {
    const today = new Date().toDateString();
    
    setStats(prev => {
      const newStats = { ...prev };
      
      // Base XP for completion
      let xpGain = 100;
      
      // Bonus XP for duration (10 XP per minute)
      if (duration > 0) {
        xpGain += Math.floor(duration / 60) * 10;
      }

      newStats.xp = (prev.xp || 0) + xpGain;
      
      // Increment total challenges
      newStats.challengesCompleted = (prev.challengesCompleted || 0) + 1;
      
      // Increment specific challenge type
      const typeKey = `${challengeType}Completed`;
      newStats[typeKey] = (prev[typeKey] || 0) + 1;
      
      // Track consecutive challenges
      if (prev.lastChallengeDate === today) {
        newStats.currentConsecutive = (prev.currentConsecutive || 0) + 1;
      } else {
        newStats.currentConsecutive = 1;
      }
      newStats.consecutiveChallenges = Math.max(
        prev.consecutiveChallenges || 0,
        newStats.currentConsecutive
      );
      
      // Update daily streak
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toDateString();
      
      if (prev.lastChallengeDate === yesterdayStr) {
        newStats.dailyStreak = (prev.dailyStreak || 0) + 1;
        // Streak bonus XP
        newStats.xp += (newStats.dailyStreak * 50);
      } else if (prev.lastChallengeDate !== today) {
        newStats.dailyStreak = 1;
      }
      
      newStats.lastChallengeDate = today;
      
      // Track challenge dates for perfect week
      const challengeDates = prev.challengeDates || [];
      if (!challengeDates.includes(today)) {
        challengeDates.push(today);
      }
      newStats.challengeDates = challengeDates.slice(-30); // Keep last 30 days
      
      // Calculate perfect days (consecutive days with at least one challenge)
      const sortedDates = [...challengeDates].sort((a, b) => new Date(b) - new Date(a));
      let perfectDays = 0;
      for (let i = 0; i < sortedDates.length; i++) {
        const date = new Date(sortedDates[i]);
        const expectedDate = new Date();
        expectedDate.setDate(expectedDate.getDate() - i);
        if (date.toDateString() === expectedDate.toDateString()) {
          perfectDays++;
        } else {
          break;
        }
      }
      newStats.perfectDays = perfectDays;
      
      // Track duration for specific challenges
      if (challengeType === 'enduranceRun' && duration > (prev.enduranceRunMinutes || 0)) {
        newStats.enduranceRunMinutes = duration;
      }
      
      return newStats;
    });
  }, []);

  const recordContinuousWatch = useCallback((minutes) => {
    setStats(prev => ({
      ...prev,
      continuousWatchMinutes: Math.max(prev.continuousWatchMinutes || 0, minutes)
    }));
  }, []);

  const isUnlocked = useCallback((achievementId) => {
    return unlockedAchievements.includes(achievementId);
  }, [unlockedAchievements]);

  const getProgress = useCallback((achievementId) => {
    return getAchievementProgress(achievementId, stats);
  }, [stats]);

  const resetStats = useCallback(() => {
    setStats(DEFAULT_STATS);
    setUnlockedAchievements([]);
    setNewlyUnlocked([]);
  }, []);

  return {
    stats,
    level: calculateLevel(stats.xp || 0),
    levelProgress: getLevelProgress(stats.xp || 0),
    unlockedAchievements,
    newlyUnlocked,
    updateStats,
    incrementStat,
    recordVideoWatch,
    recordChallengeComplete,
    recordContinuousWatch,
    isUnlocked,
    getProgress,
    resetStats,
    allAchievements: ACHIEVEMENTS
  };
};
