import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const STORAGE_KEY = 'reddit-reels-favorite-subreddits';

export function useFavoriteSubreddits() {
  const [favoriteSubreddits, setFavoriteSubreddits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Load from local storage initially
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setFavoriteSubreddits(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading favorite subreddits from local storage', e);
      }
    }
    setLoading(false);
  }, []);

  // Listen to auth changes and sync with Firestore
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // User logged in - sync with Firestore
        try {
          const docRef = doc(db, 'users', currentUser.uid, 'preferences', 'favoriteSubreddits');
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            setFavoriteSubreddits(data.subreddits || []);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data.subreddits || []));
          }
        } catch (error) {
          console.error('Error loading favorite subreddits:', error);
        }
      } else {
        // User logged out - use local storage only
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          try {
            setFavoriteSubreddits(JSON.parse(saved));
          } catch (e) {
            setFavoriteSubreddits([]);
          }
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const addFavoriteSubreddit = async (subreddit) => {
    try {
      const updated = [...new Set([...favoriteSubreddits, subreddit])];
      
      if (user) {
        // Save to Firestore
        const docRef = doc(db, 'users', user.uid, 'preferences', 'favoriteSubreddits');
        await setDoc(docRef, { subreddits: updated, updatedAt: new Date() });
      }
      
      // Update local state and storage
      setFavoriteSubreddits(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return true;
    } catch (error) {
      console.error('Error adding favorite subreddit:', error);
      return false;
    }
  };

  const removeFavoriteSubreddit = async (subreddit) => {
    try {
      const updated = favoriteSubreddits.filter(s => s !== subreddit);
      
      if (user) {
        // Save to Firestore
        const docRef = doc(db, 'users', user.uid, 'preferences', 'favoriteSubreddits');
        await setDoc(docRef, { subreddits: updated, updatedAt: new Date() });
      }
      
      // Update local state and storage
      setFavoriteSubreddits(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return true;
    } catch (error) {
      console.error('Error removing favorite subreddit:', error);
      return false;
    }
  };

  const isFavoriteSubreddit = (subreddit) => {
    return favoriteSubreddits.includes(subreddit);
  };

  return {
    favoriteSubreddits,
    loading,
    addFavoriteSubreddit,
    removeFavoriteSubreddit,
    isFavoriteSubreddit
  };
}
