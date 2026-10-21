import React, { createContext, useContext, useState, useEffect } from 'react';
import { getUserProfile, getToken, setToken } from '../services/auth';
import { CacheService } from '../services/CacheService';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null); // Just stores { uid, ... } to match old firebase shape somewhat
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    
    if (!token) {
      setCurrentUser(null);
      setUserProfile(null);
      setLoading(false);
      return;
    }

    const initAuth = async () => {
      // 1. Optimistic Cache Load
      // We don't have user.uid immediately from token without decoding, 
      // but we can just use a generic key or decode JWT manually.
      // For now, let's just fetch the profile.
      try {
        const profile = await getUserProfile();
        if (profile) {
          const mappedUser = { uid: profile.id, email: profile.email };
          setCurrentUser(mappedUser);
          
          const fullProfile = { ...profile, uid: profile.id };
          setUserProfile(fullProfile);
        } else {
          setCurrentUser(null);
          setUserProfile(null);
          setToken(null);
        }
      } catch (error) {
        console.error("Error fetching profile", error);
        setCurrentUser(null);
        setUserProfile(null);
        setToken(null);
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const updateProfileData = async () => {
    try {
      const token = getToken();
      if (!token) return;
      
      const profile = await getUserProfile();
      if (profile) {
        if (profile.token) {
          setToken(profile.token);
        }
        setCurrentUser({ uid: profile.id, email: profile.email });
        setUserProfile({ ...profile, uid: profile.id });
      }
    } catch (error) {
      console.error("Error refreshing profile", error);
    }
  };

  // Function to wrap login so context updates immediately
  const handleAuthChange = () => {
    setLoading(true);
    updateProfileData().finally(() => setLoading(false));
  };

  const value = {
    currentUser,
    userProfile,
    loading,
    updateProfileData,
    handleAuthChange
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
