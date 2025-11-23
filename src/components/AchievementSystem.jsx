import { useEffect, useState } from 'react';
import { ACHIEVEMENT_TIERS } from '../lib/achievements';
import { getIcon } from './GamificationIcons';

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
            className="mb-4 glass-panel p-6 rounded-2xl border-2 min-w-[320px] animate-in slide-in-from-right duration-500 overflow-hidden relative"
            style={{
              borderColor: tier.color,
              boxShadow: `0 0 30px ${tier.glow}`,
              animationDelay: `${index * 150}ms`
            }}
          >
            {/* Background Glow */}
            <div 
              className={`absolute inset-0 opacity-20 ${tier.bg}`} 
            />

            <div className="relative z-10">
              {/* Achievement Unlocked Header */}
              <div className="text-center mb-3">
                <div className="text-xs font-black uppercase tracking-wider text-white/60 mb-1">
                  Achievement Unlocked!
                </div>
                <div 
                  className="text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2"
                  style={{ color: tier.color }}
                >
                  {tier.label} Tier
                  <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-white/80">
                    +{achievement.xp} XP
                  </span>
                </div>
              </div>

              {/* Achievement Icon */}
              <div className="flex justify-center mb-4">
                <div 
                  className="w-16 h-16 p-3 rounded-xl bg-black/40 backdrop-blur-sm border border-white/10 animate-bounce"
                  style={{
                    color: tier.color,
                    boxShadow: `0 0 20px ${tier.glow}`
                  }}
                >
                  {getIcon(achievement.iconName)}
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
              className="text-2xl font-black mb-6 uppercase tracking-wider flex items-center gap-3"
              style={{ color: tier.color }}
            >
              {tier.label} Tier
              <div className="h-px flex-1 bg-gradient-to-r from-current to-transparent opacity-50" />
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tierAchievements.map(achievement => {
                const isUnlocked = unlockedIds.includes(achievement.id);
                const progress = getProgress(achievement.id);

                return (
                  <div
                    key={achievement.id}
                    className={`glass-panel p-6 rounded-2xl border-2 transition-all duration-300 relative overflow-hidden group ${
                      isUnlocked 
                        ? 'border-opacity-100 hover:scale-105' 
                        : 'opacity-60 border-opacity-30'
                    }`}
                    style={{
                      borderColor: tier.color,
                      boxShadow: isUnlocked ? `0 0 20px ${tier.glow}` : 'none'
                    }}
                  >
                    {/* Background Tint */}
                    {isUnlocked && (
                      <div className={`absolute inset-0 opacity-10 ${tier.bg} group-hover:opacity-20 transition-opacity`} />
                    )}

                    <div className="relative z-10">
                      {/* Header: XP & Status */}
                      <div className="flex justify-between items-start mb-4">
                        <span className="text-xs font-bold px-2 py-1 rounded bg-black/40 text-white/80 border border-white/10">
                          {achievement.xp} XP
                        </span>
                        {isUnlocked ? (
                          <span className="text-xs font-bold text-green-500 flex items-center gap-1">
                            ✓ Unlocked
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-white/40 flex items-center gap-1">
                            🔒 Locked
                          </span>
                        )}
                      </div>

                      {/* Icon */}
                      <div className="flex justify-center mb-4">
                        <div 
                          className={`w-16 h-16 p-3 rounded-xl bg-black/40 backdrop-blur-sm border border-white/10 transition-transform duration-300 ${
                            isUnlocked ? 'group-hover:scale-110 group-hover:rotate-3' : 'grayscale opacity-50'
                          }`}
                          style={{ color: isUnlocked ? tier.color : 'white' }}
                        >
                          {getIcon(achievement.iconName)}
                        </div>
                      </div>

                      {/* Name & Description */}
                      <h4 className="text-lg font-bold text-white text-center mb-2">
                        {achievement.name}
                      </h4>
                      <p className="text-sm text-white/70 text-center mb-4 min-h-[40px]">
                        {achievement.description}
                      </p>

                      {/* Progress Bar (for locked achievements) */}
                      {!isUnlocked && (
                        <div className="mt-2">
                          <div className="flex justify-between text-xs text-white/60 mb-1">
                            <span>Progress</span>
                            <span>{Math.round(progress)}%</span>
                          </div>
                          <div className="h-1.5 bg-black/50 rounded-full overflow-hidden">
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
                    </div>
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
