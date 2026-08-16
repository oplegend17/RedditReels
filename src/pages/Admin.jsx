import { useState, useEffect, Fragment } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import VideoModal from '../components/VideoModal';

export default function Admin() {
  const { profile, isAdmin } = useOutletContext();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  
  // Permission Fallback States
  const [hasPermissionError, setHasPermissionError] = useState(false);
  const [lookupUid, setLookupUid] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);

  // Modal State
  const [restrictionType, setRestrictionType] = useState('none');
  const [restrictionKeyword, setRestrictionKeyword] = useState('');
  const [actionMsg, setActionMsg] = useState(null);

  // Favorites Management States
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [userFavorites, setUserFavorites] = useState([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);

  // Downloads Management States
  const [userDownloads, setUserDownloads] = useState([]);
  const [downloadsLoading, setDownloadsLoading] = useState(false);

  // Watched History States
  const [userWatched, setUserWatched] = useState([]);
  const [watchedLoading, setWatchedLoading] = useState(false);

  // Stats & Engagement Tracking States
  const [userStats, setUserStats] = useState(null);
  const [userHistoryCount, setUserHistoryCount] = useState(0);
  const [statsLoading, setStatsLoading] = useState(false);
  const [activeTabMap, setActiveTabMap] = useState({}); // userId -> 'favorites' | 'stats'

  const fetchUserFavorites = async (userId) => {
    setFavoritesLoading(true);
    setStatsLoading(true);
    setDownloadsLoading(true);
    setWatchedLoading(true);
    try {
      const favsPromise = getDocs(collection(db, 'users', userId, 'favorites'));
      const statsPromise = getDoc(doc(db, 'users', userId, 'userData', 'achievements'));
      const historyPromise = getDoc(doc(db, 'users', userId, 'userData', 'history'));
      const downloadsPromise = getDocs(collection(db, 'users', userId, 'downloads'));
      const watchedPromise = getDocs(collection(db, 'users', userId, 'watched'));

      const [favsSnap, statsSnap, historySnap, downloadsSnap, watchedSnap] = await Promise.all([
        favsPromise,
        statsPromise,
        historyPromise,
        downloadsPromise,
        watchedPromise
      ]);

      // 1. Process Favorites
      const favsList = favsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUserFavorites(favsList);

      // 2. Process Downloads
      const downloadsList = downloadsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUserDownloads(downloadsList);

      // 3. Process Watched History
      let watchedList = watchedSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Fallback merge from userData/history.seen array so watched history is never lost
      if (historySnap.exists()) {
        const historyData = historySnap.data();
        const seenArray = Array.isArray(historyData.seen) ? historyData.seen : [];
        const existingIds = new Set(watchedList.map(w => String(w.id || w.videoId)));

        seenArray.forEach(seenId => {
          const strId = String(seenId);
          if (strId && !existingIds.has(strId)) {
            watchedList.push({
              id: strId,
              videoId: strId,
              title: `Watched Video #${strId}`,
              url: '',
              thumbnail: '',
              subreddit: 'watched',
              watchedAt: historyData.lastUpdated?.toDate ? historyData.lastUpdated.toDate() : new Date()
            });
            existingIds.add(strId);
          }
        });
      }

      // Sort watched history by watchedAt descending
      watchedList.sort((a, b) => {
        const timeA = a.watchedAt?.toDate ? a.watchedAt.toDate().getTime() : (a.watchedAt instanceof Date ? a.watchedAt.getTime() : 0);
        const timeB = b.watchedAt?.toDate ? b.watchedAt.toDate().getTime() : (b.watchedAt instanceof Date ? b.watchedAt.getTime() : 0);
        return timeB - timeA;
      });
      setUserWatched(watchedList);

      // 4. Process Achievements (Stats)
      if (statsSnap.exists()) {
        const statsData = statsSnap.data();
        setUserStats(statsData.stats || null);
      } else {
        setUserStats(null);
      }

      // 5. Process History count
      if (historySnap.exists()) {
        const historyData = historySnap.data();
        setUserHistoryCount(Array.isArray(historyData.seen) ? historyData.seen.length : 0);
      } else {
        setUserHistoryCount(0);
      }

      // Default active tab to 'favorites'
      setActiveTabMap(prev => ({ ...prev, [userId]: 'favorites' }));

    } catch (err) {
      console.error("Error fetching user data:", err);
      setActionMsg({ type: 'error', text: 'Failed to load user engagement profile: ' + err.message });
      setTimeout(() => setActionMsg(null), 3000);
    } finally {
      setFavoritesLoading(false);
      setStatsLoading(false);
      setDownloadsLoading(false);
      setWatchedLoading(false);
    }
  };

  const toggleExpandUser = async (userId) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      setUserFavorites([]);
      setUserDownloads([]);
      setUserWatched([]);
      setUserStats(null);
      setUserHistoryCount(0);
    } else {
      setExpandedUserId(userId);
      setUserFavorites([]);
      setUserDownloads([]);
      setUserWatched([]);
      setUserStats(null);
      setUserHistoryCount(0);
      await fetchUserFavorites(userId);
    }
  };

  const handleDeleteFavorite = async (userId, videoId) => {
    if (!window.confirm("Are you sure you want to delete this favorite video for this user?")) return;
    setActionMsg({ type: 'info', text: 'Deleting favorite...' });
    try {
      const favRef = doc(db, 'users', userId, 'favorites', videoId);
      await deleteDoc(favRef);
      setUserFavorites(prev => prev.filter(f => f.id !== videoId));
      setActionMsg({ type: 'success', text: 'Favorite deleted successfully!' });
      setTimeout(() => setActionMsg(null), 2000);
    } catch (err) {
      console.error("Error deleting favorite:", err);
      setActionMsg({ type: 'error', text: 'Failed to delete favorite: ' + err.message });
      setTimeout(() => setActionMsg(null), 3500);
    }
  };

  const handleDeleteDownload = async (userId, videoId) => {
    if (!window.confirm("Are you sure you want to delete this download entry for this user?")) return;
    setActionMsg({ type: 'info', text: 'Deleting download entry...' });
    try {
      const downloadRef = doc(db, 'users', userId, 'downloads', videoId);
      await deleteDoc(downloadRef);
      setUserDownloads(prev => prev.filter(d => d.id !== videoId));
      setActionMsg({ type: 'success', text: 'Download entry deleted successfully!' });
      setTimeout(() => setActionMsg(null), 2000);
    } catch (err) {
      console.error("Error deleting download:", err);
      setActionMsg({ type: 'error', text: 'Failed to delete download: ' + err.message });
      setTimeout(() => setActionMsg(null), 3500);
    }
  };

  const handleDeleteWatched = async (userId, videoId) => {
    if (!window.confirm("Are you sure you want to delete this watched history entry?")) return;
    setActionMsg({ type: 'info', text: 'Deleting watched entry...' });
    try {
      const watchedRef = doc(db, 'users', userId, 'watched', videoId);
      await deleteDoc(watchedRef);
      setUserWatched(prev => prev.filter(w => w.id !== videoId));
      setActionMsg({ type: 'success', text: 'Watched entry deleted successfully!' });
      setTimeout(() => setActionMsg(null), 2000);
    } catch (err) {
      console.error("Error deleting watched entry:", err);
      setActionMsg({ type: 'error', text: 'Failed to delete watched entry: ' + err.message });
      setTimeout(() => setActionMsg(null), 3500);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const getUserAccessTimestamp = (user) => {
    const ts = user.lastActive || user.lastLogin || user.updatedAt || user.createdAt;
    if (!ts) return 0;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (typeof ts.toDate === 'function') return ts.toDate().getTime();
    if (ts instanceof Date) return ts.getTime();
    if (typeof ts === 'number') return ts;
    if (typeof ts === 'string') return new Date(ts).getTime() || 0;
    return 0;
  };

  const formatAccessTime = (user) => {
    const ms = getUserAccessTimestamp(user);
    if (!ms) return 'Never';
    const diffSec = Math.floor((Date.now() - ms) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const fetchUsers = async () => {
    setLoading(true);
    setHasPermissionError(false);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const list = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      // Sort users by most recently active / accessed first
      list.sort((a, b) => {
        const timeA = getUserAccessTimestamp(a);
        const timeB = getUserAccessTimestamp(b);
        if (timeA !== timeB) return timeB - timeA;
        return (a.username || '').localeCompare(b.username || '');
      });
      setUsers(list);
    } catch (err) {
      console.error("Error fetching users:", err);
      if (err.code === 'permission-denied' || err.message?.includes('permission') || err.message?.includes('Permission')) {
        setHasPermissionError(true);
        setActionMsg({ type: 'error', text: 'Listing users restricted by Firestore rules. Loading fallback...' });
      } else {
        setActionMsg({ type: 'error', text: 'Failed to load users: ' + err.message });
      }
      setTimeout(() => setActionMsg(null), 4000);
    } finally {
      setLoading(false);
    }
  };

  const lookupSingleUser = async (e) => {
    e.preventDefault();
    const uid = lookupUid.trim();
    if (!uid) return;
    setLookupLoading(true);
    setActionMsg({ type: 'info', text: 'Fetching user document directly...' });
    try {
      const ref = doc(db, 'users', uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const u = { id: snap.id, ...snap.data() };
        setUsers([u]); // Populate list with just this single user
        setActionMsg({ type: 'success', text: `Loaded user ${u.username || uid}!` });
        setTimeout(() => setActionMsg(null), 2000);
      } else {
        setActionMsg({ type: 'error', text: 'No user document found with that ID.' });
        setTimeout(() => setActionMsg(null), 3000);
      }
    } catch (err) {
      setActionMsg({ type: 'error', text: 'Failed to read document: ' + err.message });
      setTimeout(() => setActionMsg(null), 4000);
    } finally {
      setLookupLoading(false);
    }
  };

  const toggleUserRole = async (targetUser) => {
    setActionMsg({ type: 'info', text: 'Updating role...' });
    try {
      const newRole = targetUser.role === 'admin' ? 'user' : 'admin';
      const ref = doc(db, 'users', targetUser.id);
      await setDoc(ref, { role: newRole }, { merge: true });
      
      // Update local state
      setUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, role: newRole } : u));
      setActionMsg({ type: 'success', text: `Role updated for ${targetUser.username}!` });
      setTimeout(() => setActionMsg(null), 2000);
    } catch (err) {
      setActionMsg({ type: 'error', text: 'Failed to update role: ' + err.message });
      setTimeout(() => setActionMsg(null), 3000);
    }
  };

  const openRestrictionModal = (targetUser) => {
    setEditingUser(targetUser);
    setRestrictionType(targetUser.restrictionType || 'none');
    setRestrictionKeyword(targetUser.restrictionKeyword || '');
  };

  const saveRestriction = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setActionMsg({ type: 'info', text: 'Saving restrictions...' });
    try {
      const ref = doc(db, 'users', editingUser.id);
      const updateData = {
        restrictionType,
        restrictionKeyword: restrictionType === 'keyword' ? restrictionKeyword.trim() : ''
      };
      await setDoc(ref, updateData, { merge: true });
      
      // Update local state
      setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...updateData } : u));
      setEditingUser(null);
      setActionMsg({ type: 'success', text: `Restrictions saved for ${editingUser.username}!` });
      setTimeout(() => setActionMsg(null), 2500);
    } catch (err) {
      setActionMsg({ type: 'error', text: 'Failed to save restrictions: ' + err.message });
      setTimeout(() => setActionMsg(null), 3000);
    }
  };

  const renderStatsSubTab = () => {
    const xp = userStats?.xp || 0;
    const level = Math.floor(1 + Math.sqrt(xp / 500));
    const currentLevelXp = 500 * Math.pow(level - 1, 2);
    const nextLevelXp = 500 * Math.pow(level, 2);
    const levelProgress = Math.min(Math.max(((xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100, 0), 100);

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Level and XP Badge */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(0,243,255,0.05),_transparent_60%)]" />
          
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-neon-pink to-neon-blue flex items-center justify-center font-black text-white text-xl shadow-[0_0_20px_rgba(255,47,86,0.3)]">
              {level}
            </div>
            <div>
              <p className="text-sm font-bold text-white">Engagement Level {level}</p>
              <p className="text-xs text-white/40">{xp.toLocaleString()} Total XP earned</p>
            </div>
          </div>

          <div className="flex-1 w-full max-w-md relative z-10">
            <div className="flex justify-between text-xs text-white/40 mb-1.5 font-bold">
              <span>Level {level} Progress</span>
              <span>{Math.round(levelProgress)}% ({xp} / {nextLevelXp} XP)</span>
            </div>
            <div className="h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-neon-pink to-neon-blue transition-all duration-700 shadow-[0_0_10px_rgba(0,243,255,0.5)]"
                style={{ width: `${levelProgress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
            <span className="text-2xl block mb-1">▶️</span>
            <p className="text-2xl font-black text-white">{userHistoryCount}</p>
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider mt-0.5">Total Videos Watched</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
            <span className="text-2xl block mb-1">🔥</span>
            <p className="text-2xl font-black text-white">{userStats?.dailyStreak || 0}</p>
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider mt-0.5">Daily Streak</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
            <span className="text-2xl block mb-1">🎯</span>
            <p className="text-2xl font-black text-white">{userStats?.challengesCompleted || 0}</p>
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider mt-0.5">Challenges Done</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
            <span className="text-2xl block mb-1">🏆</span>
            <p className="text-2xl font-black text-white">{userStats?.perfectDays || 0}</p>
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider mt-0.5">Perfect Days</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Watch Intensity meter */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
            <h5 className="text-xs font-black text-white uppercase tracking-wider border-b border-white/5 pb-2">
              ☢️ Watch Intensity Breakdown
            </h5>
            
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-white/70 mb-1">
                  <span className="font-bold text-red-400">☢️ Nuclear Watched</span>
                  <span className="font-mono">{userStats?.nuclearVideosWatched || 0}</span>
                </div>
                <div className="h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                  <div 
                    className="h-full bg-red-500 rounded-full" 
                    style={{ width: `${Math.min(((userStats?.nuclearVideosWatched || 0) / Math.max(userHistoryCount, 1)) * 100, 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-white/70 mb-1">
                  <span className="font-bold text-yellow-500">🔥 Fire Watched</span>
                  <span className="font-mono">{userStats?.fireVideosWatched || 0}</span>
                </div>
                <div className="h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                  <div 
                    className="h-full bg-yellow-500 rounded-full" 
                    style={{ width: `${Math.min(((userStats?.fireVideosWatched || 0) / Math.max(userHistoryCount, 1)) * 100, 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-white/70 mb-1">
                  <span className="font-bold text-purple-400">🌶️ Spicy Watched</span>
                  <span className="font-mono">{userStats?.spicyVideosWatched || 0}</span>
                </div>
                <div className="h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                  <div 
                    className="h-full bg-purple-500 rounded-full" 
                    style={{ width: `${Math.min(((userStats?.spicyVideosWatched || 0) / Math.max(userHistoryCount, 1)) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Challenge Mode breakdowns */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
            <h5 className="text-xs font-black text-white uppercase tracking-wider border-b border-white/5 pb-2">
              ⏱️ Challenge Accomplishments
            </h5>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-black/20 rounded-xl">
                <p className="text-white/40">Endurance Best</p>
                <p className="text-sm font-black text-white mt-0.5">
                  {userStats?.enduranceRunMinutes || 0} mins
                </p>
              </div>
              <div className="p-2.5 bg-black/20 rounded-xl">
                <p className="text-white/40">Try Not To Cum</p>
                <p className="text-sm font-black text-white mt-0.5">
                  {userStats?.tryNotToCumCompleted || 0} times
                </p>
              </div>
              <div className="p-2.5 bg-black/20 rounded-xl">
                <p className="text-white/40">Roulette Completed</p>
                <p className="text-sm font-black text-white mt-0.5">
                  {userStats?.rouletteCompleted || 0} rounds
                </p>
              </div>
              <div className="p-2.5 bg-black/20 rounded-xl">
                <p className="text-white/40">Continuous Watch</p>
                <p className="text-sm font-black text-white mt-0.5">
                  {userStats?.continuousWatchMinutes || 0} mins
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderFavoritesSection = (targetUser) => {
    const activeTab = activeTabMap[targetUser.id] || 'favorites';

    return (
      <div className="p-6 bg-black/40 border border-white/5 rounded-2xl mt-4 space-y-4 animate-in slide-in-from-top-2 duration-300">
        
        {/* Header and Tab Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <span className="text-yellow-400 text-lg">👑</span>
            <div>
              <h4 className="text-sm font-black text-white uppercase tracking-wider">
                {targetUser.username}'s Profile
              </h4>
              <p className="text-[10px] text-white/40 font-mono">UID: {targetUser.id}</p>
            </div>
          </div>

          {/* Sub Tab Switcher */}
          <div className="flex overflow-x-auto no-scrollbar gap-1 bg-white/5 p-1 rounded-xl border border-white/10 shrink-0 max-w-full">
            <button
              onClick={() => setActiveTabMap(prev => ({ ...prev, [targetUser.id]: 'favorites' }))}
              className={`shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                activeTab === 'favorites'
                  ? 'bg-white text-black shadow'
                  : 'text-white/40 hover:text-white'
              }`}
            >
              ★ Favorites ({userFavorites.length})
            </button>
            <button
              onClick={() => setActiveTabMap(prev => ({ ...prev, [targetUser.id]: 'downloads' }))}
              className={`shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                activeTab === 'downloads'
                  ? 'bg-white text-black shadow'
                  : 'text-white/40 hover:text-white'
              }`}
            >
              📥 Downloads ({userDownloads.length})
            </button>
            <button
              onClick={() => setActiveTabMap(prev => ({ ...prev, [targetUser.id]: 'watched' }))}
              className={`shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                activeTab === 'watched'
                  ? 'bg-white text-black shadow'
                  : 'text-white/40 hover:text-white'
              }`}
            >
              👁️ Watched ({userWatched.length})
            </button>
            <button
              onClick={() => setActiveTabMap(prev => ({ ...prev, [targetUser.id]: 'stats' }))}
              className={`shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                activeTab === 'stats'
                  ? 'bg-white text-black shadow'
                  : 'text-white/40 hover:text-white'
              }`}
            >
              📈 Stats & History
            </button>
          </div>

          <button
            onClick={() => toggleExpandUser(targetUser.id)}
            className="text-xs text-white/40 hover:text-white transition-colors cursor-pointer sm:ml-2 shrink-0 self-end sm:self-center"
          >
            Close
          </button>
        </div>

        {/* Tab Contents */}
        {activeTab === 'favorites' ? (
          favoritesLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2">
              <div className="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider animate-pulse">Loading Favorites...</p>
            </div>
          ) : userFavorites.length === 0 ? (
            <div className="py-10 text-center bg-white/[0.01] border border-dashed border-white/5 rounded-xl">
              <span className="text-3xl block mb-2">✨</span>
              <p className="text-xs font-bold text-white/40">No favorite videos found</p>
              <p className="text-[10px] text-white/20 mt-0.5">This user hasn't added any videos to their favorites yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {userFavorites.map((fav) => (
                <div
                  key={fav.id}
                  className="group relative bg-[#0f0f0f] border border-white/5 hover:border-white/20 rounded-xl overflow-hidden shadow-lg transition-all duration-300 hover:-translate-y-1"
                >
                  {/* Thumbnail Container */}
                  <div 
                    className="relative aspect-[9/16] bg-black cursor-pointer overflow-hidden"
                    onClick={() => setSelectedVideo({
                      id: fav.videoId || fav.id,
                      url: fav.url,
                      title: fav.title,
                      thumbnail: fav.thumbnail,
                      subreddit: fav.subreddit
                    })}
                  >
                    {fav.thumbnail ? (
                      <img
                        src={fav.thumbnail}
                        alt={fav.title}
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-neutral-900 flex items-center justify-center">
                        <span className="text-white/20 text-xs">No Thumbnail</span>
                      </div>
                    )}
                    
                    {/* Play Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300">
                      <div className="w-10 h-10 rounded-full bg-neon-pink flex items-center justify-center text-white text-sm shadow-[0_0_15px_rgba(255,47,86,0.6)] transform scale-90 group-hover:scale-100 transition-transform duration-300">
                        ▶
                      </div>
                    </div>

                    {/* Subreddit Tag */}
                    {fav.subreddit && (
                      <span className="absolute top-2 left-2 z-10 text-[9px] font-black uppercase bg-black/60 border border-white/10 text-neutral-300 px-2 py-0.5 rounded backdrop-blur-sm">
                        r/{fav.subreddit}
                      </span>
                    )}
                  </div>

                  {/* Info & Admin Action */}
                  <div className="p-3 space-y-2 bg-[#090909] border-t border-white/5">
                    <p className="text-xs font-bold text-white truncate group-hover:text-neon-pink transition-all" title={fav.title}>
                      {fav.title || "Untitled Video"}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] text-white/30 font-medium font-mono">
                        {fav.addedAt?.toDate 
                          ? fav.addedAt.toDate().toLocaleDateString()
                          : fav.addedAt instanceof Date 
                            ? fav.addedAt.toLocaleDateString()
                            : 'N/A'
                      }
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFavorite(targetUser.id, fav.id);
                        }}
                        className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
                        title="Remove from favorites"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : activeTab === 'downloads' ? (
          downloadsLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2">
              <div className="w-6 h-6 border-2 border-neon-pink border-t-transparent rounded-full animate-spin" />
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider animate-pulse">Loading Downloads...</p>
            </div>
          ) : userDownloads.length === 0 ? (
            <div className="py-10 text-center bg-white/[0.01] border border-dashed border-white/5 rounded-xl">
              <span className="text-3xl block mb-2">📥</span>
              <p className="text-xs font-bold text-white/40">No downloads history found</p>
              <p className="text-[10px] text-white/20 mt-0.5">This user hasn't downloaded any videos yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {userDownloads.map((dl) => (
                <div
                  key={dl.id}
                  className="group relative bg-[#0f0f0f] border border-white/5 hover:border-white/20 rounded-xl overflow-hidden shadow-lg transition-all duration-300 hover:-translate-y-1"
                >
                  {/* Thumbnail Container */}
                  <div 
                    className="relative aspect-[9/16] bg-black cursor-pointer overflow-hidden"
                    onClick={() => setSelectedVideo({
                      id: dl.videoId || dl.id,
                      url: dl.url,
                      title: dl.title,
                      thumbnail: dl.thumbnail,
                      subreddit: dl.subreddit
                    })}
                  >
                    {dl.thumbnail ? (
                      <img
                        src={dl.thumbnail}
                        alt={dl.title}
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-neutral-900 flex items-center justify-center">
                        <span className="text-white/20 text-xs">No Thumbnail</span>
                      </div>
                    )}
                    
                    {/* Play Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300">
                      <div className="w-10 h-10 rounded-full bg-neon-pink flex items-center justify-center text-white text-sm shadow-[0_0_15px_rgba(255,47,86,0.6)] transform scale-90 group-hover:scale-100 transition-transform duration-300">
                        ▶
                      </div>
                    </div>

                    {/* Subreddit Tag */}
                    {dl.subreddit && (
                      <span className="absolute top-2 left-2 z-10 text-[9px] font-black uppercase bg-black/60 border border-white/10 text-neutral-300 px-2 py-0.5 rounded backdrop-blur-sm">
                        r/{dl.subreddit}
                      </span>
                    )}
                  </div>

                  {/* Info & Admin Action */}
                  <div className="p-3 space-y-2 bg-[#090909] border-t border-white/5">
                    <p className="text-xs font-bold text-white truncate group-hover:text-neon-pink transition-all" title={dl.title}>
                      {dl.title || "Untitled Video"}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] text-white/30 font-medium font-mono">
                        {dl.downloadedAt?.toDate 
                          ? dl.downloadedAt.toDate().toLocaleDateString()
                          : dl.downloadedAt instanceof Date 
                            ? dl.downloadedAt.toLocaleDateString()
                            : 'N/A'
                      }
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDownload(targetUser.id, dl.id);
                        }}
                        className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
                        title="Remove from downloads"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : activeTab === 'watched' ? (
          watchedLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2">
              <div className="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider animate-pulse">Loading Watch History...</p>
            </div>
          ) : userWatched.length === 0 ? (
            <div className="py-10 text-center bg-white/[0.01] border border-dashed border-white/5 rounded-xl">
              <span className="text-3xl block mb-2">👁️</span>
              <p className="text-xs font-bold text-white/40">No watched videos history found</p>
              <p className="text-[10px] text-white/20 mt-0.5">This user hasn't watched any logged videos yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {userWatched.map((watch) => (
                <div
                  key={watch.id}
                  className="group relative bg-[#0f0f0f] border border-white/5 hover:border-white/20 rounded-xl overflow-hidden shadow-lg transition-all duration-300 hover:-translate-y-1"
                >
                  {/* Thumbnail Container */}
                  <div 
                    className="relative aspect-[9/16] bg-black cursor-pointer overflow-hidden"
                    onClick={() => setSelectedVideo({
                      id: watch.videoId || watch.id,
                      url: watch.url,
                      title: watch.title,
                      thumbnail: watch.thumbnail,
                      subreddit: watch.subreddit
                    })}
                  >
                    {watch.thumbnail ? (
                      <img
                        src={watch.thumbnail}
                        alt={watch.title}
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-neutral-900 flex items-center justify-center">
                        <span className="text-white/20 text-xs">No Thumbnail</span>
                      </div>
                    )}
                    
                    {/* Play Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300">
                      <div className="w-10 h-10 rounded-full bg-neon-pink flex items-center justify-center text-white text-sm shadow-[0_0_15px_rgba(255,47,86,0.6)] transform scale-90 group-hover:scale-100 transition-transform duration-300">
                        ▶
                      </div>
                    </div>

                    {/* Subreddit Tag */}
                    {watch.subreddit && (
                      <span className="absolute top-2 left-2 z-10 text-[9px] font-black uppercase bg-black/60 border border-white/10 text-neutral-300 px-2 py-0.5 rounded backdrop-blur-sm">
                        r/{watch.subreddit}
                      </span>
                    )}
                  </div>

                  {/* Info & Admin Action */}
                  <div className="p-3 space-y-2 bg-[#090909] border-t border-white/5">
                    <p className="text-xs font-bold text-white truncate group-hover:text-neon-pink transition-all" title={watch.title}>
                      {watch.title || "Untitled Video"}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] text-white/30 font-medium font-mono">
                        {watch.watchedAt?.toDate 
                          ? watch.watchedAt.toDate().toLocaleDateString()
                          : watch.watchedAt instanceof Date 
                            ? watch.watchedAt.toLocaleDateString()
                            : 'N/A'
                      }
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteWatched(targetUser.id, watch.id);
                        }}
                        className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
                        title="Remove from watched history"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          statsLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2">
              <div className="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider animate-pulse">Loading Statistics...</p>
            </div>
          ) : (
            renderStatsSubTab()
          )
        )}
      </div>
    );
  };

  // Guard page for non-admin users
  if (!isAdmin) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,47,86,0.1)_0%,_transparent_60%)] opacity-30 blur-3xl"></div>
        <div className="relative z-10 glass-panel p-12 rounded-3xl max-w-md border-red-500/20 shadow-red-950/20">
          <div className="w-20 h-20 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center text-red-500 text-4xl mb-6 mx-auto animate-pulse">
            🔒
          </div>
          <h1 className="text-3xl font-black tracking-tight text-red-400 mb-3 uppercase">Access Denied</h1>
          <p className="text-neutral-400 text-sm mb-8 leading-relaxed">
            You do not have administrative privileges to access this area. 
            Please contact your system administrator or toggle Admin status in your Profile Settings.
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white font-bold text-sm transition-all duration-300 cursor-pointer"
          >
            Return to Gallery
          </button>
        </div>
      </div>
    );
  }

  // Filter users based on search
  const filteredUsers = users.filter(u => {
    const q = searchQuery.toLowerCase();
    const name = (u.username || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  // Stats calculation
  const totalUsers = users.length;
  const adminCount = users.filter(u => u.role === 'admin').length;
  const restrictedCount = users.filter(u => u.restrictionType && u.restrictionType !== 'none').length;

  return (
    <div className="max-w-6xl mx-auto pb-20 animate-in fade-in duration-500">
      
      {/* Header Banner */}
      <div className="bg-[#15171e] border border-white/10 rounded-xl p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">👑</span>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">System Administration</h1>
            </div>
            <p className="text-white/40 text-xs">Manage platform users, inspect activity logs, and enforce feed parameters.</p>
          </div>

          {/* Quick Stats */}
          <div className="flex gap-3 shrink-0 flex-wrap sm:flex-nowrap">
            <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-center min-w-[90px] flex-1">
              <p className="text-xl font-extrabold text-white">{totalUsers}</p>
              <p className="text-[10px] text-white/40 font-semibold uppercase tracking-wider">Total Users</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-center min-w-[90px] flex-1">
              <p className="text-xl font-extrabold text-yellow-400">{adminCount}</p>
              <p className="text-[10px] text-yellow-400/70 font-semibold uppercase tracking-wider">Admins</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-center min-w-[90px] flex-1">
              <p className="text-xl font-extrabold text-purple-400">{restrictedCount}</p>
              <p className="text-[10px] text-purple-400/70 font-semibold uppercase tracking-wider">Restricted</p>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Action Messages (Toasts) */}
      {actionMsg && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-lg border text-xs font-semibold shadow-xl animate-in slide-in-from-bottom-5 duration-300 ${
          actionMsg.type === 'error' ? 'bg-red-950 border-red-500/30 text-red-200' :
          actionMsg.type === 'success' ? 'bg-emerald-950 border-emerald-500/30 text-emerald-200' :
          'bg-black/90 border-white/10 text-white/80'
        }`}>
          <div className="flex items-center gap-2">
            {actionMsg.type === 'error' && <span>❌</span>}
            {actionMsg.type === 'success' && <span>✅</span>}
            {actionMsg.type === 'info' && <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />}
            <span>{actionMsg.text}</span>
          </div>
        </div>
      )}

      {/* Main Admin Card */}
      <div className="bg-[#15171e] rounded-xl overflow-hidden border border-white/10 shadow-xl">
        {/* Toolbar */}
        <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row gap-3 items-center justify-between bg-black/20">
          {/* Search Input */}
          <div className="relative w-full sm:max-w-md">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-xs">🔍</span>
            <input
              type="text"
              placeholder="Search user by username or email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white/5 hover:bg-white/[0.08] focus:bg-white/[0.08] border border-white/10 rounded-lg text-white text-xs placeholder-white/30 focus:outline-none focus:border-white/30 transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs"
              >
                Clear
              </button>
            )}
          </div>

          <button
            onClick={fetchUsers}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white text-xs font-semibold transition-all shrink-0 cursor-pointer disabled:opacity-50"
          >
            🔄 Refresh List
          </button>
        </div>

        {/* Users Table / Fallback Section */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-white/40 text-xs font-semibold">Loading system directory...</p>
            </div>
          ) : hasPermissionError ? (
            <div className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 bg-white/[0.01]">
              {/* Left Column: Direct Document Lookup */}
              <div className="space-y-5 bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
                <div>
                  <span className="text-[10px] font-black uppercase text-purple-400 tracking-wider">Direct Management</span>
                  <h3 className="text-lg font-bold text-white mt-0.5">Direct User Lookup</h3>
                  <p className="text-xs text-white/40 mt-1 leading-relaxed">
                    Firestore collection listing is restricted. Paste a user's **UID** to read and restrict their feed directly.
                  </p>
                </div>
                
                <form onSubmit={lookupSingleUser} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-white/40 uppercase tracking-wider block">Target User UID</label>
                    <input
                      type="text"
                      placeholder="e.g. u1W9A2kL0fPqRt3..."
                      value={lookupUid}
                      onChange={e => setLookupUid(e.target.value)}
                      required
                      className="w-full px-4 py-3 bg-black/40 border border-white/10 focus:border-purple-500 rounded-xl text-white placeholder-white/20 focus:outline-none transition-colors text-xs font-mono"
                    />
                  </div>
                  
                  <button
                    type="submit"
                    disabled={lookupLoading || !lookupUid.trim()}
                    className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-purple-900/30 transition-all cursor-pointer disabled:opacity-50 hover:-translate-y-0.5 active:translate-y-0"
                  >
                    {lookupLoading ? 'Loading User...' : '🔍 Load User Document'}
                  </button>
                </form>

                {users.length > 0 && (
                  <div className="pt-4 border-t border-white/10 animate-in slide-in-from-bottom-2">
                    <p className="text-xs font-bold text-emerald-400 mb-2">✓ Loaded User Match:</p>
                    <div className="flex items-center justify-between p-3.5 bg-white/5 border border-white/10 rounded-xl">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neon-pink/35 to-neon-blue/35 flex items-center justify-center font-black text-white text-xs">
                          {users[0].username?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">{users[0].username}</p>
                          <p className="text-[9px] text-white/40 font-mono truncate max-w-[150px] sm:max-w-none">{users[0].email}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => toggleExpandUser(users[0].id)}
                          className={`px-3 py-1.5 border rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                            expandedUserId === users[0].id
                              ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300 shadow-[0_0_10px_rgba(250,204,21,0.15)]'
                              : 'bg-white/5 border-white/10 hover:bg-white/10 text-white'
                          }`}
                        >
                          {expandedUserId === users[0].id ? 'Hide Favorites' : '★ Favorites'}
                        </button>
                        <button
                          type="button"
                          onClick={() => openRestrictionModal(users[0])}
                          className="px-3 py-1.5 bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 text-purple-300 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                        >
                          Restrict Feed
                        </button>
                      </div>
                    </div>
                    {/* Render favorites if expanded in Direct Lookup mode */}
                    {expandedUserId === users[0].id && renderFavoritesSection(users[0])}
                  </div>
                )}
              </div>

              {/* Right Column: Database Rules Guide */}
              <div className="space-y-5 bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-yellow-500 tracking-wider">Database Configuration</span>
                  <h3 className="text-lg font-bold text-white mt-0.5">Firebase Security Rules</h3>
                  <p className="text-xs text-white/40 mt-1 leading-relaxed">
                    To enable listing the entire user directory on this dashboard, update your **Cloud Firestore Security Rules** in the Firebase Console:
                  </p>
                  
                  <div className="mt-4 p-4 bg-black/50 border border-white/10 rounded-xl font-mono text-[10px] text-yellow-400/90 leading-relaxed overflow-x-auto select-all">
                    {`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow users to read/write their own data, and admins to manage all users
    match /users/{userId} {
      allow read, write: if request.auth != null && (
        request.auth.uid == userId || 
        get(/databases/\$(database)/documents/users/\$(request.auth.uid)).data.role == 'admin'
      );
      
      // Allow users and admins to access subcollections (favorites, history, etc.)
      match /{document=**} {
        allow read, write: if request.auth != null && (
          request.auth.uid == userId || 
          get(/databases/\$(database)/documents/users/\$(request.auth.uid)).data.role == 'admin'
        );
      }
    }
    
    // Global leaderboard - anyone authenticated can read, anyone authenticated can write
    match /leaderboard/{entry} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}`}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <a
                    href="https://console.firebase.google.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-black rounded-xl font-bold text-sm text-center shadow-lg shadow-yellow-900/10 transition-all hover:-translate-y-0.5 active:translate-y-0"
                  >
                    🚀 Open Firebase Console
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /users/{userId} {\n      allow read, write: if request.auth != null && (\n        request.auth.uid == userId || \n        get(/databases/\$(database)/documents/users/\$(request.auth.uid)).data.role == 'admin'\n      );\n      \n      match /{document=**} {\n        allow read, write: if request.auth != null && (\n          request.auth.uid == userId || \n          get(/databases/\$(database)/documents/users/\$(request.auth.uid)).data.role == 'admin'\n        );\n      }\n    }\n    \n    match /leaderboard/{entry} {\n      allow read: if request.auth != null;\n      allow write: if request.auth != null;\n    }\n  }\n}`);
                      setActionMsg({ type: 'success', text: 'Rules copied to clipboard!' });
                      setTimeout(() => setActionMsg(null), 2000);
                    }}
                    className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-bold text-xs transition-all"
                  >
                    📋 Copy Rules to Clipboard
                  </button>
                </div>
              </div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-20 text-center text-white/30">
              <span className="text-5xl block mb-3">👥</span>
              <p className="text-base font-bold">No users match your query</p>
              <p className="text-xs mt-1">Try a different search term or add more users.</p>
            </div>
          ) : (
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-white/5 text-[10px] font-black uppercase text-white/40 tracking-wider bg-white/[0.005]">
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Last Active</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Restrictions</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredUsers.map(u => {
                  const hasRestriction = u.restrictionType && u.restrictionType !== 'none';
                  const joinedDate = u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString() : 'N/A';
                  const lastActiveText = formatAccessTime(u);
                  const isExpanded = expandedUserId === u.id;
                  
                  return (
                    <Fragment key={u.id}>
                      <tr className={`hover:bg-white/[0.02] transition-colors duration-200 ${isExpanded ? 'bg-white/[0.01]' : ''}`}>
                        {/* Avatar & Username */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 shrink-0">
                              {u.avatarUrl ? (
                                <img src={u.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-neon-pink/35 to-neon-blue/35 flex items-center justify-center font-black text-white text-base">
                                  {u.username?.[0]?.toUpperCase() || '?'}
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white flex items-center gap-1.5">
                                {u.username}
                                {u.role === 'admin' && (
                                  <span className="text-xs" title="Admin">👑</span>
                                )}
                              </p>
                              <p className="text-[10px] text-white/30 font-medium">Joined {joinedDate}</p>
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white/60 font-mono">
                          {u.email}
                        </td>

                        {/* Last Active */}
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold">
                          <span className={`px-2.5 py-1 rounded-full border text-[10px] font-bold ${
                            lastActiveText === 'Just now' || lastActiveText.endsWith('m ago')
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              : 'bg-white/5 border-white/10 text-white/50'
                          }`}>
                            {lastActiveText}
                          </span>
                        </td>

                        {/* Role Badges */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => toggleUserRole(u)}
                            title={`Toggle role to ${u.role === 'admin' ? 'User' : 'Admin'}`}
                            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border cursor-pointer hover:scale-105 active:scale-95 transition-all ${
                              u.role === 'admin'
                                ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.15)]'
                                : 'bg-white/5 border-white/15 text-white/40 hover:text-white hover:border-white/30'
                            }`}
                          >
                            {u.role || 'user'}
                          </button>
                        </td>

                        {/* Restriction Details */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {hasRestriction ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-purple-400 font-bold text-xs bg-purple-500/10 border border-purple-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1">
                                🔒 Locked: "{u.restrictionKeyword}"
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-white/30 font-bold uppercase tracking-wider">Unrestricted</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => toggleExpandUser(u.id)}
                              className={`px-4 py-2 border rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer ${
                                isExpanded
                                  ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300 shadow-[0_0_15px_rgba(250,204,21,0.15)]'
                                  : 'bg-white/5 border border-white/10 hover:border-yellow-500/30 hover:bg-yellow-500/10 text-white hover:text-yellow-400'
                              }`}
                            >
                              ★ Favorites
                            </button>
                            <button
                              onClick={() => openRestrictionModal(u)}
                              className="px-4 py-2 bg-white/5 border border-white/10 hover:border-purple-500/30 hover:bg-purple-500/15 text-white hover:text-purple-300 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer"
                            >
                              🛡️ Restrict Feed
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-black/20">
                          <td colSpan="6" className="px-6 py-4">
                            {renderFavoritesSection(u)}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
        </div>
      </div>

      {/* Restrictions Modal */}
      {editingUser && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-300"
          onClick={() => setEditingUser(null)}
        >
          <div
            className="w-full max-w-md bg-[#0d0d0d] border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl animate-in slide-in-from-bottom-6 duration-300"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-400">Restricted Feed Guard</span>
                <h3 className="text-xl font-bold text-white mt-0.5">Restrict {editingUser.username}</h3>
              </div>
              <button 
                onClick={() => setEditingUser(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white text-lg transition-colors cursor-pointer shrink-0"
              >
                ×
              </button>
            </div>

            <form onSubmit={saveRestriction} className="space-y-6">
              {/* Type Select */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-white/40 uppercase tracking-wider block">Restriction Mode</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRestrictionType('none')}
                    className={`py-3.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      restrictionType === 'none'
                        ? 'bg-white text-black border-white shadow-xl'
                        : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                    }`}
                  >
                    🔓 Unrestricted
                  </button>
                  <button
                    type="button"
                    onClick={() => setRestrictionType('keyword')}
                    className={`py-3.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      restrictionType === 'keyword'
                        ? 'bg-purple-500/20 border-purple-500 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                        : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                    }`}
                  >
                    🔒 Keyword filter
                  </button>
                </div>
              </div>

              {/* Keyword Input */}
              {restrictionType === 'keyword' && (
                <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                  <label className="text-xs font-bold text-white/40 uppercase tracking-wider block">Restriction Keyword</label>
                  <input
                    type="text"
                    value={restrictionKeyword}
                    onChange={e => setRestrictionKeyword(e.target.value)}
                    required
                    placeholder="e.g. Korean"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-purple-500 rounded-xl text-white placeholder-white/20 focus:outline-none transition-colors font-semibold"
                  />
                  <p className="text-[10px] text-purple-300/40 leading-relaxed font-medium">
                    This user's feed across all sections (Video Gallery, Image Gallery, Reels, For Her) will be automatically overridden and strictly locked to search queries matching this keyword.
                  </p>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white font-bold text-sm transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-purple-900/30 transition-all cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
                >
                  Save Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Video Modal Player */}
      {selectedVideo && (
        <VideoModal
          video={selectedVideo}
          isRedgifs={selectedVideo.isRedgifs}
          originalUrl={selectedVideo.originalUrl}
          onClose={() => setSelectedVideo(null)}
        />
      )}
    </div>
  );
}
