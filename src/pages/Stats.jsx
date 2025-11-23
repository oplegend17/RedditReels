import Leaderboard from '../components/Leaderboard';
import { AchievementGallery } from '../components/AchievementSystem';
import { useAchievements } from '../lib/useAchievements';

export default function Stats() {
  const achievements = useAchievements();

  return (
    <div className="space-y-8">
      <Leaderboard currentStats={achievements.stats} />
      <AchievementGallery 
        achievements={achievements.allAchievements}
        unlockedIds={achievements.unlockedAchievements}
        stats={achievements.stats}
        getProgress={achievements.getProgress}
      />
    </div>
  );
}
