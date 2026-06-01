import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs,
  Timestamp 
} from 'firebase/firestore';

const COLLECTION_NAME = 'leaderboard';

export const addToLeaderboard = async (entry) => {
  try {
    await addDoc(collection(db, COLLECTION_NAME), {
      ...entry,
      timestamp: Timestamp.now(), // Use server timestamp for consistency
      date: new Date().toISOString() // Keep a readable date string too
    });
  } catch (error) {
    console.error("Error adding document: ", error);
  }
};

export const getLeaderboardData = async (timeFilter = 'all', challengeFilter = 'all') => {
  try {
    let q = collection(db, COLLECTION_NAME);
    const constraints = [];

    // Filter by challenge type
    if (challengeFilter !== 'all') {
      constraints.push(where('challengeType', '==', challengeFilter));
    }

    // Fetch the raw documents (limited to 200 for safe client-side sorting and filtering)
    constraints.push(limit(200));

    q = query(q, ...constraints);

    const querySnapshot = await getDocs(q);
    
    let results = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toDate ? data.timestamp.toDate().getTime() : (data.date ? new Date(data.date).getTime() : Date.now())
      };
    });

    // Filter by time client-side to prevent Firestore composite index crashes
    const now = Date.now();
    if (timeFilter === 'week') {
      const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
      results = results.filter(r => r.timestamp >= weekAgo);
    } else if (timeFilter === 'month') {
      const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
      results = results.filter(r => r.timestamp >= monthAgo);
    }

    // Sort by duration descending client-side
    results.sort((a, b) => (b.duration || 0) - (a.duration || 0));

    // Return the top 50
    return results.slice(0, 50);

  } catch (error) {
    console.error("Error getting documents from leaderboard: ", error);
    return [];
  }
};
