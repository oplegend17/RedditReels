import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, setDoc, deleteDoc, query, orderBy, onSnapshot } from 'firebase/firestore';

const STORAGE_KEY = 'reddit-reels-favorites';

export function useFavorites() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Load from local storage initially
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading favorites from local storage', e);
      }
    }
    setLoading(false);
  }, []);

  // Listen to auth changes and sync with Firestore
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // User logged in - sync with Firestore
        const favoritesRef = collection(db, 'users', currentUser.uid, 'favorites');
        const q = query(favoritesRef, orderBy('addedAt', 'desc'));
        
        const unsubscribeFavorites = onSnapshot(q, (snapshot) => {
          const firestoreFavorites = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setFavorites(firestoreFavorites);
          // Also save to local storage as backup
          localStorage.setItem(STORAGE_KEY, JSON.stringify(firestoreFavorites));
        }, (error) => {
          console.error('Error listening to favorites:', error);
        });

        return () => unsubscribeFavorites();
      } else {
        // User logged out - use local storage only
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          try {
            setFavorites(JSON.parse(saved));
          } catch (e) {
            setFavorites([]);
          }
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const addFavorite = async (video) => {
    try {
      const newFavorite = {
        id: video.id,
        videoId: video.id,
        title: video.title,
        url: video.url,
        thumbnail: video.thumbnail,
        subreddit: video.subreddit,
        addedAt: new Date()
      };

      if (user) {
        // Add to Firestore
        const favoriteRef = doc(db, 'users', user.uid, 'favorites', video.id);
        await setDoc(favoriteRef, newFavorite);
      } else {
        // Add to local storage only
        setFavorites(prev => {
          const exists = prev.some(f => f.id === video.id);
          if (exists) return prev;
          const updated = [newFavorite, ...prev];
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          return updated;
        });
      }
      return true;
    } catch (error) {
      console.error('Error adding favorite:', error.message);
      return false;
    }
  };

  const removeFavorite = async (videoId) => {
    try {
      if (user) {
        // Remove from Firestore
        const favoriteRef = doc(db, 'users', user.uid, 'favorites', videoId);
        await deleteDoc(favoriteRef);
      } else {
        // Remove from local storage only
        setFavorites(prev => {
          const updated = prev.filter(fav => fav.id !== videoId);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          return updated;
        });
      }
      return true;
    } catch (error) {
      console.error('Error removing favorite:', error.message);
      return false;
    }
  };

  const isFavorite = (videoId) => {
    return favorites.some(fav => fav.id === videoId || fav.videoId === videoId);
  };

  return {
    favorites,
    loading,
    addFavorite,
    removeFavorite,
    isFavorite
  };
}
