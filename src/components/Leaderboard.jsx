import { useState, useEffect } from 'react';

const STORAGE_KEY = 'reddit-reels-leaderboard';

export default function Leaderboard({ currentStats }) {
  const [timeFilter, setTimeFilter] = useState('all'); // all, week, month
  const [challengeFilter, setChallengeFilter] = useState('all');
  const [leaderboardData, setLeaderboardData] = useState([]);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setLeaderboardData(JSON.parse(saved));
    }
  };

  const addScore = (entry) => {
    const newData = [...leaderboardData, { ...entry, timestamp: Date.now() }];
    setLeaderboardData(newData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
  };

  const getFilteredData = () => {
    let filtered = [...leaderboardData];

    // Filter by challenge type
    if (challengeFilter !== 'all') {
      filtered = filtered.filter(entry => entry.challengeType === challengeFilter);
    }

    // Filter by time
    const now = Date.now();
    if (timeFilter === 'week') {
      const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(entry => entry.timestamp >= weekAgo);
    } else if (timeFilter === 'month') {
      const monthAgo = now - (30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(entry => entry.timestamp >= monthAgo);
    }

    // Sort by duration (descending)
    filtered.sort((a, b) => b.duration - a.duration);

    // Take top 10
    return filtered.slice(0, 10);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  };

  const topScores = getFilteredData();

  return (
    <div className="max-w-4xl mx-auto p-8">
      {/* Header */}
      <div className="mb-8 text-center">
        <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 mb-2">
          🏆 Leaderboard
        </h2>
        <p className="text-white/60">
          Top performers across all challenges
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        {/* Time Filter */}
        <div className="flex gap-2">
          {['all', 'week', 'month'].map(filter => (
            <button
              key={filter}
              onClick={() => setTimeFilter(filter)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all duration-300 ${
                timeFilter === filter
                  ? 'bg-neon-blue text-black shadow-[0_0_20px_rgba(0,243,255,0.4)]'
                  : 'bg-white/10 text-white/60 hover:bg-white/20'
              }`}
            >
              {filter === 'all' ? 'All Time' : filter === 'week' ? 'This Week' : 'This Month'}
            </button>
          ))}
        </div>

        {/* Challenge Type Filter */}
        <select
          value={challengeFilter}
          onChange={(e) => setChallengeFilter(e.target.value)}
          className="px-4 py-2 rounded-full bg-white/10 text-white font-bold outline-none cursor-pointer border border-white/20"
        >
          <option value="all" className="bg-black">All Challenges</option>
          <option value="tryNotToCum" className="bg-black">Try Not to Cum</option>
          <option value="enduranceRun" className="bg-black">Endurance Run</option>
          <option value="roulette" className="bg-black">Roulette</option>
          <option value="tenMinute" className="bg-black">10 Minute</option>
          <option value="rapidFire" className="bg-black">Rapid Fire</option>
          <option value="noControl" className="bg-black">No Control</option>
        </select>
      </div>

      {/* Leaderboard Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-white/10">
        {topScores.length === 0 ? (
          <div className="p-12 text-center text-white/60">
            <div className="text-6xl mb-4">🏅</div>
            <p className="text-lg">No scores yet. Complete a challenge to get on the board!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-6 py-4 text-left text-xs font-bold text-white/60 uppercase tracking-wider">Rank</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white/60 uppercase tracking-wider">Duration</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white/60 uppercase tracking-wider">Challenge</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white/60 uppercase tracking-wider">Videos</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white/60 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody>
                {topScores.map((entry, index) => {
                  const isPersonalBest = entry.timestamp === currentStats?.lastChallengeTimestamp;
                  
                  return (
                    <tr 
                      key={index}
                      className={`border-b border-white/5 transition-all duration-300 hover:bg-white/5 ${
                        isPersonalBest ? 'bg-neon-pink/10' : ''
                      }`}
                    >
                      {/* Rank */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {index === 0 && <span className="text-2xl">🥇</span>}
                          {index === 1 && <span className="text-2xl">🥈</span>}
                          {index === 2 && <span className="text-2xl">🥉</span>}
                          <span className={`font-bold ${
                            index < 3 ? 'text-xl text-white' : 'text-white/60'
                          }`}>
                            #{index + 1}
                          </span>
                        </div>
                      </td>

                      {/* Duration */}
                      <td className="px-6 py-4">
                        <span className="text-xl font-black text-neon-blue tabular-nums">
                          {formatTime(entry.duration)}
                        </span>
                      </td>

                      {/* Challenge Type */}
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-white capitalize">
                          {entry.challengeType.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                      </td>

                      {/* Videos */}
                      <td className="px-6 py-4">
                        <span className="text-sm text-white/70">
                          {entry.videosWatched || 0}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-6 py-4">
                        <span className="text-xs text-white/50">
                          {formatDate(entry.timestamp)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Personal Best Section */}
      {currentStats && (
        <div className="mt-8 glass-panel p-6 rounded-2xl border-2 border-neon-pink/30">
          <h3 className="text-xl font-black text-white mb-4">📊 Your Stats</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-black text-neon-blue">{currentStats.challengesCompleted || 0}</div>
              <div className="text-xs text-white/60 uppercase tracking-wider">Total Challenges</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-neon-pink">{currentStats.dailyStreak || 0}</div>
              <div className="text-xs text-white/60 uppercase tracking-wider">Day Streak</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-yellow-500">{currentStats.consecutiveChallenges || 0}</div>
              <div className="text-xs text-white/60 uppercase tracking-wider">Best Streak</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-green-500">{currentStats.nuclearVideosWatched || 0}</div>
              <div className="text-xs text-white/60 uppercase tracking-wider">Nuclear Videos</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Export helper to add scores
export const addToLeaderboard = (entry) => {
  const STORAGE_KEY = 'reddit-reels-leaderboard';
  const saved = localStorage.getItem(STORAGE_KEY);
  const data = saved ? JSON.parse(saved) : [];
  const newData = [...data, { ...entry, timestamp: Date.now() }];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
};
