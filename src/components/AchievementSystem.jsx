import { useEffect, useState } from 'react';
import { ACHIEVEMENT_TIERS } from '../lib/achievements';

export default function AchievementPopup({ achievements = [], onClose }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (achievements.length > 0) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onClose, 300);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [achievements, onClose]);

  if (achievements.length === 0) return null;

  return (
    <div className={`fixed top-24 right-6 z-[100] transition-all duration-500 ${
      visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
    }`}>
      {achievements.map((achievement, index) => {
        const tier = ACHIEVEMENT_TIERS[achievement.tier];
        
        return (
          <div 
            key={achievement.id}
            className="mb-4 glass-panel p-6 rounded-2xl border-2 min-w-[320px] animate-in slide-in-from-right duration-500"
            style={{
              borderColor: tier.color,
              boxShadow: `0 0 30px ${tier.glow}`,
              animationDelay: `${index * 150}ms`
            }}
          >
            {/* Achievement Unlocked Header */}
            <div className="text-center mb-3">
              <div className="text-xs font-black uppercase tracking-wider text-white/60 mb-1">
                Achievement Unlocked!
              </div>
              <div 
                className="text-sm font-bold uppercase tracking-wide"
                style={{ color: tier.color }}
              >
                {tier.label} Tier
              </div>
            </div>

            {/* Achievement Icon */}
            <div className="text-center mb-3">
              <div 
                className="text-6xl inline-block animate-bounce"
                style={{
                  filter: `drop-shadow(0 0 20px ${tier.glow})`
                }}
              >
                {achievement.icon}
              </div>
            </div>

            {/* Achievement Details */}
            <div className="text-center">
              <h3 className="text-xl font-black text-white mb-1">
                {achievement.name}
              </h3>
              <p className="text-sm text-white/70">
                {achievement.description}
              </p>
            </div>

            {/* Sparkle Effect */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
              <div className="sparkle-effect" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Achievement Gallery Component
export function AchievementGallery({ achievements, unlockedIds, stats, getProgress }) {
  const [filter, setFilter] = useState('all'); // all, unlocked, locked

  const achievementList = Object.values(achievements);
  const filteredAchievements = achievementList.filter(achievement => {
    if (filter === 'unlocked') return unlockedIds.includes(achievement.id);
    if (filter === 'locked') return !unlockedIds.includes(achievement.id);
    return true;
  });

  // Group by tier
  const groupedByTier = filteredAchievements.reduce((acc, achievement) => {
    if (!acc[achievement.tier]) acc[achievement.tier] = [];
    acc[achievement.tier].push(achievement);
    return acc;
  }, {});

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-neon-pink mb-2">
          Achievements
        </h2>
        <p className="text-white/60">
          {unlockedIds.length} of {achievementList.length} unlocked
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-8">
        {['all', 'unlocked', 'locked'].map(filterType => (
          <button
            key={filterType}
            onClick={() => setFilter(filterType)}
            className={`px-6 py-2 rounded-full text-sm font-bold transition-all duration-300 ${
              filter === filterType
                ? 'bg-neon-pink text-white shadow-[0_0_20px_rgba(255,47,86,0.4)]'
                : 'bg-white/10 text-white/60 hover:bg-white/20'
            }`}
          >
            {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
          </button>
        ))}
      </div>

      {/* Achievement Grid by Tier */}
      {Object.keys(ACHIEVEMENT_TIERS).map(tierKey => {
        const tierAchievements = groupedByTier[tierKey] || [];
        if (tierAchievements.length === 0) return null;

        const tier = ACHIEVEMENT_TIERS[tierKey];

        return (
          <div key={tierKey} className="mb-12">
            <h3 
              className="text-2xl font-black mb-6 uppercase tracking-wider"
              style={{ color: tier.color }}
            >
              {tier.label} Tier
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tierAchievements.map(achievement => {
                const isUnlocked = unlockedIds.includes(achievement.id);
                const progress = getProgress(achievement.id);

                return (
                  <div
                    key={achievement.id}
                    className={`glass-panel p-6 rounded-2xl border-2 transition-all duration-300 ${
                      isUnlocked 
                        ? 'border-opacity-100 hover:scale-105' 
                        : 'opacity-60 border-opacity-30'
                    }`}
                    style={{
                      borderColor: tier.color,
                      boxShadow: isUnlocked ? `0 0 20px ${tier.glow}` : 'none'
                    }}
                  >
                    {/* Icon */}
                    <div className="text-5xl text-center mb-4">
                      {isUnlocked ? achievement.icon : '🔒'}
                    </div>

                    {/* Name & Description */}
                    <h4 className="text-lg font-bold text-white text-center mb-2">
                      {achievement.name}
                    </h4>
                    <p className="text-sm text-white/70 text-center mb-4">
                      {achievement.description}
                    </p>

                    {/* Progress Bar (for locked achievements) */}
                    {!isUnlocked && (
                      <div className="mt-4">
                        <div className="flex justify-between text-xs text-white/60 mb-1">
                          <span>Progress</span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="h-2 bg-black/50 rounded-full overflow-hidden">
                          <div 
                            className="h-full transition-all duration-300"
                            style={{
                              width: `${progress}%`,
                              backgroundColor: tier.color
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Unlocked Badge */}
                    {isUnlocked && (
                      <div className="text-center mt-4">
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-green-500/20 text-green-500 border border-green-500/50">
                          ✓ Unlocked
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
