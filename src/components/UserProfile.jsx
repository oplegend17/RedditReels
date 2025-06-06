import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function UserProfile({ session }) {
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (session?.user) {
      getProfile();
    }
  }, [session]);
  const getProfile = async () => {
    try {
      setLoading(true);
      const { user } = session;

      // First try to get the existing profile
      let { data, error: fetchError } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('id', user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      // If no profile exists, create one
      if (!data) {
        const defaultUsername = user.email.split('@')[0];
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            username: defaultUsername,
            avatar_url: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select('username, avatar_url')
          .single();

        if (insertError) throw insertError;
        data = newProfile;
      }

      setUsername(data.username);
      setAvatarUrl(data.avatar_url);
    } catch (error) {
      console.error('Error fetching profile:', error);
      alert(error.message || 'Error loading user data!');
    } finally {
      setLoading(false);
    }
  };
  const updateProfile = async (e) => {
    e.preventDefault();
    
    try {
      setUpdating(true);
      const { user } = session;

      if (!username?.trim()) {
        throw new Error('Username cannot be empty');
      }

      const updates = {
        id: user.id,
        username: username.trim(),
        avatar_url: avatarUrl?.trim() || null,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('profiles')
        .upsert(updates, {
          returning: 'minimal',
          onConflict: 'id'
        });

      if (error) {
        if (error.code === '23505') { // unique violation
          throw new Error('Username already taken');
        }
        throw error;
      }

      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert(error.message || 'Error updating the data!');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-animation">
        <div className="loading-dot"></div>
        <div className="loading-dot"></div>
        <div className="loading-dot"></div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <form onSubmit={updateProfile} className="profile-form">
        <div className="avatar-section">
          {avatarUrl ? (
            <img 
              src={avatarUrl}
              alt="Avatar"
              className="avatar-image"
            />
          ) : (
            <div className="avatar-placeholder">
              {username ? username[0].toUpperCase() : '?'}
            </div>
          )}
        </div>
        
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="text"
            value={session.user.email}
            disabled
          />
        </div>

        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            value={username || ''}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="avatar">Avatar URL</label>
          <input
            id="avatar"
            type="url"
            value={avatarUrl || ''}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://example.com/avatar.jpg"
          />
        </div>

        <button
          type="submit"
          className="update-button"
          disabled={updating}
        >
          {updating ? 'Updating...' : 'Update Profile'}
        </button>
      </form>
    </div>
  );
}
