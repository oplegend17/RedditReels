import { useState, useEffect } from 'react';
import { supabase } from './supabase';

export function useFavorites() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserFavorites = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setFavorites([]);
          return;
        }

        const { data, error } = await supabase
          .from('favorites')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setFavorites(data || []);
      } catch (error) {
        console.error('Error fetching favorites:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserFavorites();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        fetchUserFavorites();
      } else if (event === 'SIGNED_OUT') {
        setFavorites([]);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const addFavorite = async (video) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('favorites')
        .upsert([
          {
            user_id: user.id,
            video_id: video.id,
            subreddit: video.subreddit,
            video_url: video.url,
            title: video.title
          }
        ], { 
          onConflict: 'user_id,video_id',
          returning: 'representation' 
        })
        .select()
        .single();

      if (error) throw error;
      
      setFavorites(prev => {
        const exists = prev.some(f => f.video_id === video.id);
        if (exists) return prev;
        return [data, ...prev];
      });
      return true;
    } catch (error) {
      console.error('Error adding favorite:', error.message);
      return false;
    }
  };

  const removeFavorite = async (videoId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('favorites')
        .delete()
        .match({ user_id: user.id, video_id: videoId });

      if (error) throw error;
      
      setFavorites(prev => prev.filter(fav => fav.video_id !== videoId));
      return true;
    } catch (error) {
      console.error('Error removing favorite:', error.message);
      return false;
    }
  };

  const isFavorite = (videoId) => {
    return favorites.some(fav => fav.video_id === videoId);
  };

  return {
    favorites,
    loading,
    addFavorite,
    removeFavorite,
    isFavorite
  };
}
