import { useState, useEffect } from 'react';
import { supabase } from './supabase';

export function useFavorites() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFavorites();
  }, []);

  const fetchFavorites = async () => {
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFavorites(data || []);
    } catch (error) {
      console.error('Error fetching favorites:', error);
    } finally {
      setLoading(false);
    }
  };

  const addFavorite = async (video) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('favorites')
        .insert([
          {
            user_id: user.id,
            video_id: video.id,
            subreddit: video.subreddit,
            video_url: video.url,
            title: video.title
          }
        ])
        .select()
        .single();

      if (error) throw error;
      
      setFavorites(prev => [data, ...prev]);
      return true;
    } catch (error) {
      console.error('Error adding favorite:', error);
      return false;
    }
  };

  const removeFavorite = async (videoId) => {
    try {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('video_id', videoId);

      if (error) throw error;
      
      setFavorites(prev => prev.filter(fav => fav.video_id !== videoId));
      return true;
    } catch (error) {
      console.error('Error removing favorite:', error);
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
