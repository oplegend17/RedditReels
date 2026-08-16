import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { auth, db } from '../lib/firebase';
import { updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAchievements } from '../lib/useAchievements';
import { useFavorites } from '../lib/useFavorites';
import { useFavoriteSubreddits } from '../lib/useFavoriteSubreddits';
import { useHistory } from '../lib/useHistory';
import { ACHIEVEMENT_TIERS } from '../lib/achievements';
import VideoModal from './VideoModal';

const TIER_ORDER = ['platinum', 'gold', 'silver', 'bronze'];

function StatCard({ label, value, icon }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 bg-white/5 border border-white/10 rounded-2xl px-3 py-3.5 sm:px-5 sm:py-4 w-full min-w-0 overflow-hidden shadow-sm">
      <span className="text-xl sm:text-2xl">{icon}</span>
      <span className="text-xl sm:text-2xl font-black text-white">{value}</span>
      <span className="text-[11px] sm:text-xs text-white/40 font-medium text-center leading-tight truncate w-full" title={label}>{label}</span>
    </div>
  );
}

function AchievementCard({ achievement, unlocked, progress }) {
  const tier = ACHIEVEMENT_TIERS[achievement.tier];
  return (
    <div className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all duration-300 ${
      unlocked
        ? 'border-white/20 bg-white/5'
        : 'border-white/5 bg-white/[0.02] opacity-50'
    }`}
      style={unlocked ? { boxShadow: `0 0 20px ${tier.glow}` } : {}}
    >
      {/* Tier dot */}
      <div className="absolute top-2 right-2 w-2 h-2 rounded-full" style={{ background: tier.color }} />

      <div className="text-3xl">{achievementEmoji(achievement.iconName)}</div>
      <p className="text-xs font-bold text-white text-center leading-tight">{achievement.name}</p>
      <p className="text-[10px] text-white/40 text-center leading-tight">{achievement.description}</p>

      {!unlocked && (
        <div className="w-full bg-white/10 rounded-full h-1 mt-1">
          <div
            className="h-1 rounded-full transition-all"
            style={{ width: `${progress}%`, background: tier.color }}
          />
        </div>
      )}

      {unlocked && (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: tier.color + '33', color: tier.color }}>
          +{achievement.xp} XP
        </span>
      )}
    </div>
  );
}

function achievementEmoji(iconName) {
  const map = {
    target: '🎯', radiation: '☢️', flame: '🔥', muscle: '💪', trophy: '🏆',
    slots: '🎰', zap: '⚡', runner: '🏃', crown: '👑', lock: '🔒',
    hundred: '💯', star: '⭐', medal: '🥇', swords: '⚔️',
  };
  return map[iconName] || '🏅';
}

const TABS = ['Overview', 'Achievements', 'Favorites', 'Watched', 'Subreddits', 'Settings'];

export default function UserProfile({ user }) {
  const { profile, isAdmin } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [joinDate, setJoinDate] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [updateMsg, setUpdateMsg] = useState(null);

  const [activeTab, setActiveTab] = useState('Overview');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [watchedVideos, setWatchedVideos] = useState([]);

  const { stats, level, levelProgress, unlockedAchievements, allAchievements, getProgress } = useAchievements();
  const { favorites } = useFavorites();
  const { favoriteSubreddits, removeFavoriteSubreddit } = useFavoriteSubreddits();
  const { seenIds } = useHistory();

  useEffect(() => {
    if (user) loadProfile();
  }, [user]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const ref = doc(db, 'users', user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const d = snap.data();
        setUsername(d.username || user.displayName || '');
        setAvatarUrl(d.avatarUrl || user.photoURL || '');
        setJoinDate(d.createdAt?.toDate ? d.createdAt.toDate() : null);
      } else {
        const defaultName = user.displayName || user.email.split('@')[0];
        await setDoc(ref, { username: defaultName, avatarUrl: user.photoURL || null, email: user.email, createdAt: new Date() });
        setUsername(defaultName);
        setAvatarUrl(user.photoURL || '');
        setJoinDate(new Date());
      }

      // Load watched videos subcollection
      try {
        const { collection, getDocs } = await import('firebase/firestore');
        const watchedSnap = await getDocs(collection(db, 'users', user.uid, 'watched'));
        const list = watchedSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => {
          const timeA = a.watchedAt?.toDate ? a.watchedAt.toDate().getTime() : (a.watchedAt instanceof Date ? a.watchedAt.getTime() : 0);
          const timeB = b.watchedAt?.toDate ? b.watchedAt.toDate().getTime() : (b.watchedAt instanceof Date ? b.watchedAt.getTime() : 0);
          return timeB - timeA;
        });
        setWatchedVideos(list);
      } catch (err) {
        console.warn("Could not fetch user watched subcollection:", err);
      }
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    setUpdating(true);
    try {
      await updateProfile(auth.currentUser, { displayName: username.trim(), photoURL: avatarUrl.trim() || null });
      await setDoc(doc(db, 'users', user.uid), { username: username.trim(), avatarUrl: avatarUrl.trim() || null, email: user.email, updatedAt: new Date() }, { merge: true });
      setUpdateMsg('Saved!');
      setTimeout(() => setUpdateMsg(null), 2000);
    } catch (err) {
      setUpdateMsg('Error: ' + err.message);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <div className="w-10 h-10 border-4 border-neon-pink border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const xp = stats.xp || 0;
  const totalAchievements = Object.keys(allAchievements).length;
  const unlockedCount = unlockedAchievements.length;

  // Sort achievements: unlocked first by tier, then locked
  const sortedAchievements = Object.values(allAchievements).sort((a, b) => {
    const aUnlocked = unlockedAchievements.includes(a.id);
    const bUnlocked = unlockedAchievements.includes(b.id);
    if (aUnlocked !== bUnlocked) return bUnlocked ? 1 : -1;
    return TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier);
  });

  return (
    <div className="max-w-4xl mx-auto pb-20">

      {/* Hero */}
      <div className="bg-[#15171e] rounded-xl overflow-hidden border border-white/10 mb-6 p-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-xl overflow-hidden border border-white/20 shadow-md">
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-white/10 flex items-center justify-center text-3xl font-black text-white">
                  {username?.[0]?.toUpperCase() || '?'}
                </div>
              )}
            </div>
            {/* Level badge */}
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-neon-pink flex items-center justify-center text-[10px] font-extrabold text-white shadow-md">
              {level}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 text-center sm:text-left min-w-0 max-w-full overflow-hidden">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate max-w-full" title={username}>{username}</h1>
            <p className="text-white/40 text-xs mt-0.5 truncate max-w-full" title={user.email}>{user.email}</p>
            {joinDate && (
              <p className="text-white/30 text-[11px] mt-0.5 truncate max-w-full">Member since {joinDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
            )}

            {/* XP bar */}
            <div className="mt-2.5 max-w-xs mx-auto sm:mx-0">
              <div className="flex justify-between text-[11px] text-white/40 mb-1">
                <span>Level {level}</span>
                <span>{xp.toLocaleString()} XP · {Math.round(levelProgress)}% to {level + 1}</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-neon-pink transition-all duration-700"
                  style={{ width: `${levelProgress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="flex gap-4 shrink-0 bg-white/5 p-3 rounded-lg border border-white/10">
            <div className="text-center">
              <p className="text-lg font-extrabold text-white">{unlockedCount}</p>
              <p className="text-[10px] text-white/40 font-semibold">Achievements</p>
            </div>
            <div className="w-px bg-white/10" />
            <div className="text-center">
              <p className="text-lg font-extrabold text-white">{seenIds.size}</p>
              <p className="text-[10px] text-white/40 font-semibold">Watched</p>
            </div>
            <div className="w-px bg-white/10" />
            <div className="text-center">
              <p className="text-lg font-extrabold text-white">{favorites.length}</p>
              <p className="text-[10px] text-white/40 font-semibold">Saved</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white/5 p-1 rounded-lg border border-white/10 mb-6 overflow-x-auto no-scrollbar gap-1">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`shrink-0 px-3.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer ${
              activeTab === tab
                ? 'bg-white/15 text-white font-bold border border-white/20'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 'Overview' && (
        <div className="space-y-4 sm:space-y-6">
          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total XP" value={xp.toLocaleString()} icon="⚡" />
            <StatCard label="Challenges" value={stats.challengesCompleted || 0} icon="🎯" />
            <StatCard label="Day Streak" value={stats.dailyStreak || 0} icon="🔥" />
            <StatCard label="Videos Watched" value={seenIds.size} icon="▶️" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Nuclear Watched" value={stats.nuclearVideosWatched || 0} icon="☢️" />
            <StatCard label="Fire Watched" value={stats.fireVideosWatched || 0} icon="🔥" />
            <StatCard label="Saved Videos" value={favorites.length} icon="❤️" />
            <StatCard label="Fav Subreddits" value={favoriteSubreddits.length} icon="⭐" />
          </div>

          {/* Recent achievements */}
          {unlockedCount > 0 && (
            <div>
              <h3 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-3">Recent Achievements</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {sortedAchievements.filter(a => unlockedAchievements.includes(a.id)).slice(0, 5).map(a => (
                  <AchievementCard key={a.id} achievement={a} unlocked progress={100} />
                ))}
              </div>
            </div>
          )}

          {/* Favorite subreddits preview */}
          {favoriteSubreddits.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-3">Favorite Subreddits</h3>
              <div className="flex flex-wrap gap-2">
                {favoriteSubreddits.slice(0, 8).map(sub => (
                  <span key={sub} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white/70">
                    r/{sub}
                  </span>
                ))}
                {favoriteSubreddits.length > 8 && (
                  <button onClick={() => setActiveTab('Subreddits')} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white/40 hover:text-white transition-colors">
                    +{favoriteSubreddits.length - 8} more
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Achievements */}
      {activeTab === 'Achievements' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-white/40 text-sm">{unlockedCount} / {totalAchievements} unlocked</p>
            <div className="flex gap-2">
              {TIER_ORDER.map(tier => (
                <span key={tier} className="flex items-center gap-1 text-xs text-white/40">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: ACHIEVEMENT_TIERS[tier].color }} />
                  {ACHIEVEMENT_TIERS[tier].label}
                </span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {sortedAchievements.map(a => (
              <AchievementCard
                key={a.id}
                achievement={a}
                unlocked={unlockedAchievements.includes(a.id)}
                progress={getProgress(a.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Favorites */}
      {activeTab === 'Favorites' && (
        <div>
          {favorites.length === 0 ? (
            <div className="flex flex-col items-center py-20 gap-3 text-white/30">
              <span className="text-5xl">❤️</span>
              <p>No saved videos yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {favorites.map(vid => (
                <div
                  key={vid.id}
                  onClick={() => setSelectedVideo(vid)}
                  className="group relative aspect-[9/16] bg-black rounded-2xl overflow-hidden border border-white/5 hover:border-white/20 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  {vid.thumbnail ? (
                    <img src={vid.thumbnail} alt={vid.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-white/5 flex items-center justify-center text-3xl">▶️</div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-2 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <p className="text-xs text-white font-medium line-clamp-2">{vid.title}</p>
                    <p className="text-[10px] text-white/50 mt-0.5">r/{vid.subreddit}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* Watched */}
      {activeTab === 'Watched' && (
        <div>
          {watchedVideos.length === 0 && seenIds.size === 0 ? (
            <div className="flex flex-col items-center py-20 gap-3 text-white/30">
              <span className="text-5xl">👁️</span>
              <p>No watched history yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {watchedVideos.map(vid => (
                <div
                  key={vid.id}
                  onClick={() => setSelectedVideo(vid)}
                  className="group relative aspect-[9/16] bg-black rounded-2xl overflow-hidden border border-white/5 hover:border-white/20 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  {vid.thumbnail ? (
                    <img src={vid.thumbnail} alt={vid.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-white/5 flex items-center justify-center text-3xl">▶️</div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-2 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <p className="text-xs text-white font-medium line-clamp-2">{vid.title || 'Watched Clip'}</p>
                    <p className="text-[10px] text-white/50 mt-0.5">r/{vid.subreddit || 'video'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Subreddits */}
      {activeTab === 'Subreddits' && (
        <div>
          {favoriteSubreddits.length === 0 ? (
            <div className="flex flex-col items-center py-20 gap-3 text-white/30">
              <span className="text-5xl">⭐</span>
              <p>No favorite subreddits yet</p>
              <p className="text-sm">Star subreddits from the Browse bar to save them here</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {favoriteSubreddits.map(sub => (
                <div key={sub} className="group flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 hover:border-white/20 rounded-xl transition-all">
                  <span className="text-sm font-medium text-white">r/{sub}</span>
                  <button
                    onClick={() => removeFavoriteSubreddit(sub)}
                    className="text-white/20 hover:text-red-400 transition-colors text-lg leading-none opacity-0 group-hover:opacity-100"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Settings */}
      {activeTab === 'Settings' && (
        <div className="max-w-md mx-auto">
          <form onSubmit={saveProfile} className="space-y-5">
            {/* Avatar preview */}
            <div className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl">
              <div className="w-16 h-16 rounded-xl overflow-hidden border border-white/10 shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-neon-pink/40 to-neon-blue/40 flex items-center justify-center text-2xl font-black text-white">
                    {username?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-white">{username || 'Username'}</p>
                <p className="text-xs text-white/40">{user.email}</p>
                <p className="text-xs text-white/30 mt-0.5">Level {level} · {xp.toLocaleString()} XP</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-neon-blue transition-colors"
                placeholder="Enter username"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Avatar URL</label>
              <input
                type="url"
                value={avatarUrl}
                onChange={e => setAvatarUrl(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-neon-blue transition-colors font-mono text-sm"
                placeholder="https://..."
              />
            </div>

            <button
              type="submit"
              disabled={updating}
              className="w-full py-3 bg-neon-pink hover:bg-red-600 text-white rounded-xl font-bold transition-all duration-200 disabled:opacity-50 shadow-lg shadow-neon-pink/20"
            >
              {updating ? 'Saving…' : 'Save Changes'}
            </button>

            {/* Inline status row */}
            {updateMsg && (
              <p className={`text-sm text-center font-medium ${
                updateMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400'
              }`}>
                {updateMsg}
              </p>
            )}

            {/* Developer Section */}
            <div className="pt-5 border-t border-white/10 space-y-3">
              <label className="text-xs font-bold text-yellow-500 uppercase tracking-wider flex items-center gap-1.5">
                <span>🛠️</span> Developer Options
              </label>
              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-white">Dev Admin Mode</p>
                  <p className="text-xs text-white/40">Instantly elevate or revoke Admin role</p>
                </div>
                <button
                  type="button"
                  onClick={toggleAdminMode}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 border ${
                    isAdmin
                      ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400'
                      : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                  }`}
                >
                  {isAdmin ? '★ Admin Mode Active' : '☆ Enable Admin'}
                </button>
              </div>

              {profile?.restrictionType && profile?.restrictionType !== 'none' && (
                <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center gap-3">
                  <span className="text-2xl">🔒</span>
                  <div>
                    <p className="text-sm font-bold text-purple-200">Restricted Mode Enforced</p>
                    <p className="text-xs text-purple-300/60">
                      You are restricted to see only <span className="font-mono text-purple-400">"{profile.restrictionKeyword}"</span> content.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => auth.signOut()}
                className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white rounded-xl font-bold transition-all duration-300"
              >
                Sign Out
              </button>
            </div>
          </form>
        </div>
      )}

      {selectedVideo && <VideoModal video={selectedVideo} onClose={() => setSelectedVideo(null)} />}
    </div>
  );
}
