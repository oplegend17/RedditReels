import { useState, useEffect } from 'react';
import { getIcon } from './GamificationIcons';
import { getLeaderboardData } from '../lib/leaderboardService';

export default function Leaderboard({ currentStats }) {
  const [timeFilter, setTimeFilter] = useState('all'); // all, week, month
  const [challengeFilter, setChallengeFilter] = useState('all');
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard();
  }, [timeFilter, challengeFilter]);

  const loadLeaderboard = async () => {
    setIsLoading(true);
    const data = await getLeaderboardData(timeFilter, challengeFilter);
    setLeaderboardData(data);
    setIsLoading(false);
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

  const getRankIcon = (index) => {
    if (index === 0) return getIcon('rank1');
    if (index === 1) return getIcon('rank2');
    if (index === 2) return getIcon('rank3');
    return <span className="text-white/50 font-bold">#{index + 1}</span>;
  };

  // Data is already filtered and sorted by the service, but let's ensure we only take top 10 for display
  const topScores = leaderboardData.slice(0, 10);

  return (
    <div className="max-w-4xl mx-auto p-8">
      {/* Header */}
      <div className="mb-8 text-center">
        <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 mb-2 flex items-center justify-center gap-4">
          <div className="w-12 h-12 text-yellow-500">{getIcon('trophy')}</div>
          Leaderboard
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
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-neon-pink border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : topScores.length === 0 ? (
          <div className="p-12 text-center text-white/60">
            <div className="w-24 h-24 mx-auto mb-4 text-white/20">
              {getIcon('rankGeneric')}
            </div>
            <p className="text-lg">No scores yet. Complete a challenge to get on the board!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-6 py-4 text-left text-xs font-bold text-white/60 uppercase tracking-wider">Rank</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white/60 uppercase tracking-wider">User</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white/60 uppercase tracking-wider">Duration</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white/60 uppercase tracking-wider">Challenge</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white/60 uppercase tracking-wider">Intensity</th>
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
                        <div className="flex items-center gap-3">
                          {getRankIcon(index)}
                        </div>
                      </td>

                      {/* User */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-blue to-neon-pink flex items-center justify-center text-xs font-bold text-white">
                            {(entry.username || 'A')[0].toUpperCase()}
                          </div>
                          <span className={`font-bold ${
                            entry.username ? 'text-white' : 'text-white/50 italic'
                          }`}>
                            {entry.username || 'Anonymous'}
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
                        <span className="text-sm font-semibold text-white capitalize flex items-center gap-2">
                          {entry.challengeType.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                      </td>

                      {/* Intensity */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 text-red-500">{getIcon('flame')}</div>
                          <span className="text-sm font-bold text-white/90">
                            {Math.round(entry.intensity || 0)}%
                          </span>
                        </div>
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

      {/* Personal Stats Section */}
      {currentStats && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Level Progress */}
          <div className="glass-panel p-6 rounded-2xl border border-white/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 w-32 h-32 text-white">
              {getIcon('star')}
            </div>
            
            <div className="relative z-10">
              <div className="flex justify-between items-end mb-2">
                <div>
                  <div className="text-xs text-white/60 uppercase tracking-wider mb-1">Current Level</div>
                  <div className="text-4xl font-black text-white">
                    {Math.floor(1 + Math.sqrt((currentStats.xp || 0) / 500))}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-white/60 uppercase tracking-wider mb-1">Total XP</div>
                  <div className="text-xl font-bold text-neon-blue">{currentStats.xp || 0}</div>
                </div>
              </div>
              
              {/* XP Progress Bar */}
              <div className="h-3 bg-black/40 rounded-full overflow-hidden border border-white/5">
                <div 
                  className="h-full bg-gradient-to-r from-neon-blue to-purple-500 transition-all duration-500"
                  style={{
                    width: `${((currentStats.xp || 0) % 500) / 5}%` // Simplified progress calc for display
                  }}
                />
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="glass-panel p-6 rounded-2xl border border-white/10">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 rounded-xl bg-white/5">
                <div className="text-2xl font-black text-neon-pink mb-1">{currentStats.dailyStreak || 0}</div>
                <div className="text-[10px] text-white/60 uppercase tracking-wider flex items-center justify-center gap-1">
                  <div className="w-3 h-3">{getIcon('flame')}</div> Streak
                </div>
              </div>
              <div className="text-center p-3 rounded-xl bg-white/5">
                <div className="text-2xl font-black text-yellow-500 mb-1">{currentStats.challengesCompleted || 0}</div>
                <div className="text-[10px] text-white/60 uppercase tracking-wider flex items-center justify-center gap-1">
                  <div className="w-3 h-3">{getIcon('target')}</div> Completed
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
