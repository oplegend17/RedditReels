// Achievement Definitions
export const ACHIEVEMENTS = {
  // Beginner Achievements (Bronze) - 100 XP
  FIRST_STEPS: {
    id: 'first_steps',
    name: 'First Steps',
    description: 'Complete your first challenge',
    iconName: 'target',
    tier: 'bronze',
    xp: 100,
    criteria: { challengesCompleted: 1 }
  },
  HEAT_SEEKER: {
    id: 'heat_seeker',
    name: 'Heat Seeker',
    description: 'Watch 25 Nuclear-rated videos',
    iconName: 'radiation',
    tier: 'bronze',
    xp: 150,
    criteria: { nuclearVideosWatched: 25 }
  },
  FIRE_STARTER: {
    id: 'fire_starter',
    name: 'Fire Starter',
    description: 'Watch 50 Fire-rated videos',
    iconName: 'flame',
    tier: 'bronze',
    xp: 150,
    criteria: { fireVideosWatched: 50 }
  },

  // Intermediate Achievements (Silver) - 300 XP
  IRON_WILL: {
    id: 'iron_will',
    name: 'Iron Will',
    description: 'Complete a 10-minute challenge',
    iconName: 'muscle',
    tier: 'silver',
    xp: 300,
    criteria: { tenMinuteChallengeCompleted: 1 }
  },
  ENDURANCE_MASTER: {
    id: 'endurance_master',
    name: 'Endurance Master',
    description: 'Complete 5 challenges in a row',
    iconName: 'trophy',
    tier: 'silver',
    xp: 350,
    criteria: { consecutiveChallenges: 5 }
  },
  ROULETTE_WINNER: {
    id: 'roulette_winner',
    name: 'Roulette Winner',
    description: 'Complete 25 roulette rounds',
    iconName: 'slots',
    tier: 'silver',
    xp: 300,
    criteria: { rouletteRoundsCompleted: 25 }
  },
  RAPID_FIRE_KING: {
    id: 'rapid_fire_king',
    name: 'Rapid Fire King',
    description: 'Complete Rapid Fire mode 10 times',
    iconName: 'zap',
    tier: 'silver',
    xp: 300,
    criteria: { rapidFireCompleted: 10 }
  },

  // Advanced Achievements (Gold) - 750 XP
  MARATHON_RUNNER: {
    id: 'marathon_runner',
    name: 'Marathon Runner',
    description: 'Watch for 1 hour straight',
    iconName: 'runner',
    tier: 'gold',
    xp: 750,
    criteria: { continuousWatchMinutes: 60 }
  },
  STREAK_KING: {
    id: 'streak_king',
    name: 'Streak King',
    description: 'Maintain a 7-day challenge streak',
    iconName: 'crown',
    tier: 'gold',
    xp: 1000,
    criteria: { dailyStreak: 7 }
  },
  NO_CONTROL_SURVIVOR: {
    id: 'no_control_survivor',
    name: 'No Control Survivor',
    description: 'Complete No Control mode',
    iconName: 'lock',
    tier: 'gold',
    xp: 800,
    criteria: { noControlCompleted: 1 }
  },
  CENTURY_CLUB: {
    id: 'century_club',
    name: 'Century Club',
    description: 'Complete 100 challenges',
    iconName: 'hundred',
    tier: 'gold',
    xp: 1000,
    criteria: { challengesCompleted: 100 }
  },

  // Legendary Achievements (Platinum) - 2000 XP
  ULTIMATE_ENDURANCE: {
    id: 'ultimate_endurance',
    name: 'Ultimate Endurance',
    description: 'Survive a 30-minute Endurance Run',
    iconName: 'star',
    tier: 'platinum',
    xp: 2000,
    criteria: { enduranceRunMinutes: 30 }
  },
  PERFECT_WEEK: {
    id: 'perfect_week',
    name: 'Perfect Week',
    description: 'Complete at least one challenge every day for 7 days',
    iconName: 'medal',
    tier: 'platinum',
    xp: 2500,
    criteria: { perfectDays: 7 }
  },
  NUCLEAR_VETERAN: {
    id: 'nuclear_veteran',
    name: 'Nuclear Veteran',
    description: 'Watch 500 Nuclear-rated videos',
    iconName: 'radiation',
    tier: 'platinum',
    xp: 2000,
    criteria: { nuclearVideosWatched: 500 }
  },
  LEGENDARY_STREAK: {
    id: 'legendary_streak',
    name: 'Legendary Streak',
    description: 'Maintain a 30-day challenge streak',
    iconName: 'crown',
    tier: 'platinum',
    xp: 5000,
    criteria: { dailyStreak: 30 }
  },
  CHALLENGE_MASTER: {
    id: 'challenge_master',
    name: 'Challenge Master',
    description: 'Complete all challenge types at least 10 times each',
    iconName: 'swords',
    tier: 'platinum',
    xp: 5000,
    criteria: { 
      tryNotToCumCompleted: 10,
      enduranceRunCompleted: 10,
      rouletteCompleted: 10,
      tenMinuteChallengeCompleted: 10,
      rapidFireCompleted: 10,
      noControlCompleted: 10
    }
  }
};

export const ACHIEVEMENT_TIERS = {
  bronze: {
    color: '#CD7F32',
    glow: 'rgba(205, 127, 50, 0.5)',
    label: 'Bronze',
    bg: 'bg-orange-900/20'
  },
  silver: {
    color: '#E2E8F0',
    glow: 'rgba(226, 232, 240, 0.5)',
    label: 'Silver',
    bg: 'bg-slate-800/40'
  },
  gold: {
    color: '#FBBF24',
    glow: 'rgba(251, 191, 36, 0.5)',
    label: 'Gold',
    bg: 'bg-yellow-900/20'
  },
  platinum: {
    color: '#38BDF8', // Changed to a cyan/blue for better visibility than gray
    glow: 'rgba(56, 189, 248, 0.6)',
    label: 'Platinum',
    bg: 'bg-cyan-900/20'
  }
};

// Helper function to check if achievement is unlocked
export const checkAchievement = (achievementId, stats) => {
  const achievement = ACHIEVEMENTS[achievementId];
  if (!achievement) return false;

  const { criteria } = achievement;
  
  return Object.keys(criteria).every(key => {
    return stats[key] >= criteria[key];
  });
};

// Get all unlocked achievements
export const getUnlockedAchievements = (stats) => {
  return Object.keys(ACHIEVEMENTS).filter(id => checkAchievement(id, stats));
};

// Calculate achievement progress
export const getAchievementProgress = (achievementId, stats) => {
  const achievement = ACHIEVEMENTS[achievementId];
  if (!achievement) return 0;

  const { criteria } = achievement;
  const criteriaKeys = Object.keys(criteria);
  
  // For achievements with single criteria
  if (criteriaKeys.length === 1) {
    const key = criteriaKeys[0];
    const current = stats[key] || 0;
    const required = criteria[key];
    return Math.min((current / required) * 100, 100);
  }
  
  // For achievements with multiple criteria, calculate average progress
  const progressValues = criteriaKeys.map(key => {
    const current = stats[key] || 0;
    const required = criteria[key];
    return Math.min((current / required), 1);
  });
  
  const averageProgress = progressValues.reduce((a, b) => a + b, 0) / progressValues.length;
  return averageProgress * 100;
};
