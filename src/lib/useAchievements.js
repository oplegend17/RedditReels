import { useState, useEffect, useCallback } from 'react';
import { ACHIEVEMENTS, getUnlockedAchievements, getAchievementProgress } from './achievements';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const STORAGE_KEY = 'reddit-reels-stats';
const UNLOCKED_KEY = 'reddit-reels-unlocked-achievements';

const DEFAULT_STATS = {
  xp: 0,
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
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...DEFAULT_STATS, ...JSON.parse(saved) } : DEFAULT_STATS;
    } catch { return DEFAULT_STATS; }
  });

  const [unlockedAchievements, setUnlockedAchievements] = useState(() => {
    try {
      const saved = localStorage.getItem(UNLOCKED_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [newlyUnlocked, setNewlyUnlocked] = useState([]);
  const [user, setUser] = useState(null);

  // Sync with Firebase on auth change
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) return;
      try {
        const ref = doc(db, 'users', currentUser.uid, 'userData', 'achievements');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          if (data.stats) {
            const merged = { ...DEFAULT_STATS, ...data.stats };
            setStats(merged);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          }
          if (data.unlocked) {
            setUnlockedAchievements(data.unlocked);
            localStorage.setItem(UNLOCKED_KEY, JSON.stringify(data.unlocked));
          }
        }
      } catch (e) {
        console.error('Error loading achievements from Firestore:', e);
      }
    });
    return () => unsub();
  }, []);

  // Persist stats to localStorage + Firestore
  const persistStats = useCallback(async (newStats, newUnlocked) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newStats));
    localStorage.setItem(UNLOCKED_KEY, JSON.stringify(newUnlocked));
    if (user) {
      try {
        const ref = doc(db, 'users', user.uid, 'userData', 'achievements');
        await setDoc(ref, { stats: newStats, unlocked: newUnlocked, updatedAt: new Date() }, { merge: true });
      } catch (e) {
        console.error('Error saving achievements:', e);
      }
    }
  }, [user]);

  // Level calculation
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

  // Check for newly unlocked achievements whenever stats change
  useEffect(() => {
    const currentlyUnlocked = getUnlockedAchievements(stats);
    const newUnlocks = currentlyUnlocked.filter(id => !unlockedAchievements.includes(id));

    if (newUnlocks.length > 0) {
      let xpGain = 0;
      newUnlocks.forEach(id => {
        const achievement = Object.values(ACHIEVEMENTS).find(a => a.id === id);
        if (achievement) xpGain += achievement.xp || 0;
      });

      const updatedUnlocked = [...unlockedAchievements, ...newUnlocks];
      setUnlockedAchievements(updatedUnlocked);
      setNewlyUnlocked(newUnlocks);
      setTimeout(() => setNewlyUnlocked([]), 5000);

      if (xpGain > 0) {
        setStats(prev => {
          const updated = { ...prev, xp: (prev.xp || 0) + xpGain };
          persistStats(updated, updatedUnlocked);
          return updated;
        });
      } else {
        persistStats(stats, updatedUnlocked);
      }
    }
  }, [stats]);

  const updateStats = useCallback((updates) => {
    setStats(prev => {
      const updated = { ...prev, ...updates };
      persistStats(updated, unlockedAchievements);
      return updated;
    });
  }, [unlockedAchievements, persistStats]);

  const incrementStat = useCallback((statName, amount = 1) => {
    setStats(prev => {
      const updated = { ...prev, [statName]: (prev[statName] || 0) + amount };
      persistStats(updated, unlockedAchievements);
      return updated;
    });
  }, [unlockedAchievements, persistStats]);

  const recordVideoWatch = useCallback((heat) => {
    setStats(prev => {
      const updated = { ...prev };
      if (heat === 'nuclear') {
        updated.nuclearVideosWatched = (prev.nuclearVideosWatched || 0) + 1;
        updated.xp = (prev.xp || 0) + 10;
      } else if (heat === 'fire') {
        updated.fireVideosWatched = (prev.fireVideosWatched || 0) + 1;
        updated.xp = (prev.xp || 0) + 5;
      } else if (heat === 'spicy') {
        updated.spicyVideosWatched = (prev.spicyVideosWatched || 0) + 1;
        updated.xp = (prev.xp || 0) + 2;
      }
      persistStats(updated, unlockedAchievements);
      return updated;
    });
  }, [unlockedAchievements, persistStats]);

  const recordChallengeComplete = useCallback((challengeType, durationSeconds = 0) => {
    const today = new Date().toDateString();
    const durationMinutes = Math.floor(durationSeconds / 60);

    setStats(prev => {
      const updated = { ...prev };

      // Base XP
      let xpGain = 100 + durationMinutes * 10;
      updated.xp = (prev.xp || 0) + xpGain;

      // Total challenges
      updated.challengesCompleted = (prev.challengesCompleted || 0) + 1;

      // Per-type stat — map challengeType id to stat key
      const typeStatMap = {
        tryNotToCum: 'tryNotToCumCompleted',
        enduranceRun: 'enduranceRunCompleted',
        roulette: 'rouletteCompleted',
        tenMinute: 'tenMinuteChallengeCompleted',
        rapidFire: 'rapidFireCompleted',
        noControl: 'noControlCompleted',
      };
      const typeKey = typeStatMap[challengeType];
      if (typeKey) updated[typeKey] = (prev[typeKey] || 0) + 1;

      // Roulette rounds (same as roulette completed for now)
      if (challengeType === 'roulette') {
        updated.rouletteRoundsCompleted = (prev.rouletteRoundsCompleted || 0) + 1;
      }

      // Endurance run duration record (in minutes)
      if (challengeType === 'enduranceRun' && durationMinutes > (prev.enduranceRunMinutes || 0)) {
        updated.enduranceRunMinutes = durationMinutes;
      }

      // Consecutive challenges (same day)
      if (prev.lastChallengeDate === today) {
        updated.currentConsecutive = (prev.currentConsecutive || 0) + 1;
      } else {
        updated.currentConsecutive = 1;
      }
      updated.consecutiveChallenges = Math.max(
        prev.consecutiveChallenges || 0,
        updated.currentConsecutive
      );

      // Daily streak
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toDateString();

      if (prev.lastChallengeDate === yesterdayStr) {
        updated.dailyStreak = (prev.dailyStreak || 0) + 1;
        updated.xp += updated.dailyStreak * 50; // streak bonus
      } else if (prev.lastChallengeDate !== today) {
        updated.dailyStreak = 1;
      }
      updated.lastChallengeDate = today;

      // Challenge dates for perfect week tracking
      const challengeDates = [...(prev.challengeDates || [])];
      if (!challengeDates.includes(today)) challengeDates.push(today);
      updated.challengeDates = challengeDates.slice(-30);

      // Perfect days (consecutive days with at least one challenge)
      const sorted = [...challengeDates].sort((a, b) => new Date(b) - new Date(a));
      let perfectDays = 0;
      for (let i = 0; i < sorted.length; i++) {
        const expected = new Date();
        expected.setDate(expected.getDate() - i);
        if (new Date(sorted[i]).toDateString() === expected.toDateString()) {
          perfectDays++;
        } else break;
      }
      updated.perfectDays = perfectDays;

      persistStats(updated, unlockedAchievements);
      return updated;
    });
  }, [unlockedAchievements, persistStats]);

  const recordContinuousWatch = useCallback((minutes) => {
    setStats(prev => {
      const updated = {
        ...prev,
        continuousWatchMinutes: Math.max(prev.continuousWatchMinutes || 0, minutes)
      };
      persistStats(updated, unlockedAchievements);
      return updated;
    });
  }, [unlockedAchievements, persistStats]);

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
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(UNLOCKED_KEY);
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
