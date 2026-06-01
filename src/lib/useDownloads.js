import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, setDoc, deleteDoc, query, orderBy, onSnapshot } from 'firebase/firestore';

const STORAGE_KEY = 'reddit-reels-downloads';

export function useDownloads() {
  const [downloads, setDownloads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Load from local storage initially
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setDownloads(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading downloads from local storage', e);
      }
    }
    setLoading(false);
  }, []);

  // Listen to auth changes and sync with Firestore
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // User logged in - sync with Firestore downloads subcollection
        const downloadsRef = collection(db, 'users', currentUser.uid, 'downloads');
        const q = query(downloadsRef, orderBy('downloadedAt', 'desc'));
        
        const unsubscribeDownloads = onSnapshot(q, (snapshot) => {
          const firestoreDownloads = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setDownloads(firestoreDownloads);
          // Save to local storage as backup
          localStorage.setItem(STORAGE_KEY, JSON.stringify(firestoreDownloads));
        }, (error) => {
          console.error('Error listening to downloads:', error);
        });

        return () => unsubscribeDownloads();
      } else {
        // User logged out - use local storage only
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          try {
            setDownloads(JSON.parse(saved));
          } catch (e) {
            setDownloads([]);
          }
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const addDownload = async (video) => {
    try {
      const newDownload = {
        id: video.id,
        videoId: video.id,
        title: video.title || 'Untitled Video',
        url: video.url,
        thumbnail: video.thumbnail || '',
        subreddit: video.subreddit || '',
        downloadedAt: new Date()
      };

      if (user) {
        // Add to Firestore
        const downloadRef = doc(db, 'users', user.uid, 'downloads', video.id);
        await setDoc(downloadRef, newDownload);
      } else {
        // Add to local storage only
        setDownloads(prev => {
          const exists = prev.some(d => d.id === video.id);
          if (exists) return prev;
          const updated = [newDownload, ...prev];
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          return updated;
        });
      }
      return true;
    } catch (error) {
      console.error('Error saving download entry:', error.message);
      return false;
    }
  };

  const removeDownload = async (videoId) => {
    try {
      if (user) {
        const downloadRef = doc(db, 'users', user.uid, 'downloads', videoId);
        await deleteDoc(downloadRef);
      } else {
        setDownloads(prev => {
          const updated = prev.filter(d => d.id !== videoId);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          return updated;
        });
      }
      return true;
    } catch (error) {
      console.error('Error removing download entry:', error.message);
      return false;
    }
  };

  const isDownloaded = (videoId) => {
    return downloads.some(d => d.id === videoId || d.videoId === videoId);
  };

  return {
    downloads,
    loading,
    addDownload,
    removeDownload,
    isDownloaded
  };
}
