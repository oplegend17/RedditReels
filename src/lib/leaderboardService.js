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

const COLLECTION_NAME = 'challenge_results';

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

    // Filter by time
    const now = new Date();
    if (timeFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      constraints.push(where('timestamp', '>=', Timestamp.fromDate(weekAgo)));
    } else if (timeFilter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      constraints.push(where('timestamp', '>=', Timestamp.fromDate(monthAgo)));
    }

    // Sort by duration (descending) and limit
    // Note: Firestore requires an index for compound queries with range filter and sort on different fields.
    // For now, we'll sort by duration. If time filter is applied, we might need client-side sorting 
    // or a composite index. Let's try to do as much as possible in query.
    
    // If we have a time filter, we are filtering on 'timestamp'. 
    // If we sort by 'duration', we need an index.
    // To avoid index creation requirement errors for now, we can fetch more and sort client side if needed,
    // OR just assume the user will create the index when prompted by console error.
    // Let's add the sort.
    constraints.push(orderBy('duration', 'desc'));
    constraints.push(limit(50)); // Fetch top 50 to allow for some client-side filtering if needed

    q = query(q, ...constraints);

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        timestamp: data.timestamp?.toDate ? data.timestamp.toDate().getTime() : new Date(data.date).getTime()
      };
    });
  } catch (error) {
    console.error("Error getting documents: ", error);
    return [];
  }
};
