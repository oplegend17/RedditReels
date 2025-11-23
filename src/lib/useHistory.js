import { useState, useEffect, useRef } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';

const STORAGE_KEY = 'reddit-reels-seen-history';
const BATCH_SIZE = 10;

export function useHistory() {
  const [seenIds, setSeenIds] = useState(new Set());
  const [user, setUser] = useState(null);
  const pendingSync = useRef(new Set());

  // Load from local storage initially
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setSeenIds(new Set(JSON.parse(saved)));
      } catch (e) {
        console.error('Error loading history from local storage', e);
      }
    }
  }, []);

  // Listen to auth changes and sync with Firestore
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Load history from Firestore to merge with local
        try {
          const docRef = doc(db, 'users', currentUser.uid, 'userData', 'history');
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.seen && Array.isArray(data.seen)) {
              setSeenIds(prev => {
                const newSet = new Set([...prev, ...data.seen]);
                // Update local storage with merged data
                localStorage.setItem(STORAGE_KEY, JSON.stringify([...newSet]));
                return newSet;
              });
            }
          }
        } catch (error) {
          console.error("Error fetching history:", error);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Sync pending items to Firestore
  const syncToFirestore = async () => {
    if (!user || pendingSync.current.size === 0) return;

    const idsToSync = [...pendingSync.current];
    pendingSync.current.clear(); // Clear immediately to avoid double sync

    try {
      const docRef = doc(db, 'users', user.uid, 'userData', 'history');
      
      // Check if doc exists, if not create it, else update
      // We can use setDoc with merge: true or updateDoc. 
      // Since we want arrayUnion, updateDoc is better if we know it exists, but setDoc with merge is safer for first time.
      // However, arrayUnion works best with updateDoc or setDoc({ seen: arrayUnion(...) }, { merge: true })
      
      await setDoc(docRef, {
        seen: arrayUnion(...idsToSync),
        lastUpdated: new Date()
      }, { merge: true });
      
      console.log(`Synced ${idsToSync.length} seen videos to Firestore`);
    } catch (error) {
      console.error("Error syncing history:", error);
      // Put them back in queue if failed? 
      // For simplicity, we might lose them on error, or we could re-add.
      // Let's re-add them to be safe.
      idsToSync.forEach(id => pendingSync.current.add(id));
    }
  };

  // Sync on window unload
  useEffect(() => {
    const handleUnload = () => {
      if (pendingSync.current.size > 0) {
        // We can't easily await here, but we can try to trigger it.
        // Beacon API is better for unload but Firestore doesn't support it directly easily.
        // We'll just try to call the sync function.
        syncToFirestore();
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [user]);

  const markAsSeen = (videoId) => {
    if (!videoId) return;
    
    setSeenIds(prev => {
      if (prev.has(videoId)) return prev;
      
      const newSet = new Set(prev);
      newSet.add(videoId);
      
      // Update local storage
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...newSet]));
      
      // Add to pending sync
      if (user) {
        pendingSync.current.add(videoId);
        
        // Check batch size
        if (pendingSync.current.size >= BATCH_SIZE) {
          syncToFirestore();
        }
      }
      
      return newSet;
    });
  };

  const isSeen = (videoId) => {
    return seenIds.has(videoId);
  };

  return {
    seenIds,
    markAsSeen,
    isSeen
  };
}
