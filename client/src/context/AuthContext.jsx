import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getUserProfile, getToken, setToken } from '../services/auth';
import { socket } from '../firebase/config';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const updateProfileData = useCallback(async (overrides = null) => {
    try {
      const token = getToken();
      if (!token) return;

      if (overrides) {
        setUserProfile(prev => ({ ...(prev || {}), ...overrides }));
        return;
      }
      
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
  }, []);

  useEffect(() => {
    const token = getToken();
    
    if (!token) {
      setCurrentUser(null);
      setUserProfile(null);
      setLoading(false);
      return;
    }

    const initAuth = async () => {
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

  // 1. Window focus refetch: refreshes session whenever user switches back to tab
  useEffect(() => {
    const handleFocus = () => {
      const token = getToken();
      if (token) {
        updateProfileData();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [updateProfileData]);

  // 2. Custom event listener triggered on 403 or X-Permissions-Changed response header
  useEffect(() => {
    const handlePermChange = () => {
      updateProfileData();
    };

    window.addEventListener('quaders:permissions_changed', handlePermChange);
    return () => window.removeEventListener('quaders:permissions_changed', handlePermChange);
  }, [updateProfileData]);

  // 3. Socket.IO real-time event listener & auto-join tenant room
  useEffect(() => {
    if (!socket) return;

    const handleSocketPermUpdate = (payload) => {
      if (!payload || !payload.schoolId || payload.schoolId === userProfile?.schoolId) {
        updateProfileData();
      }
    };

    socket.on('permissions-updated', handleSocketPermUpdate);

    if (userProfile?.schoolId) {
      const token = getToken();
      socket.emit('join_tenant', { schoolId: userProfile.schoolId, token });
    }

    return () => {
      socket.off('permissions-updated', handleSocketPermUpdate);
    };
  }, [userProfile?.schoolId, updateProfileData]);

  // 4. Cross-tab real-time BroadcastChannel sync (Admin tab -> Staff tab in same browser)
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    const channel = new BroadcastChannel('queflow_perm_sync');
    channel.onmessage = (event) => {
      if (event.data === 'permissions-changed') {
        updateProfileData();
      }
    };
    return () => {
      try { channel.close(); } catch (_) {}
    };
  }, [updateProfileData]);

  // 5. Periodic lightweight heartbeat for staff (syncs within 8 seconds even without sockets)
  useEffect(() => {
    if (!userProfile || userProfile.role !== 'staff') return;

    const interval = setInterval(() => {
      const token = getToken();
      if (!token || document.visibilityState !== 'visible') return;

      getUserProfile().then(fresh => {
        if (fresh && (
          fresh.permissionsVersion !== userProfile.permissionsVersion ||
          fresh.roleId !== userProfile.roleId ||
          JSON.stringify(fresh.permissions) !== JSON.stringify(userProfile.permissions)
        )) {
          if (fresh.token) setToken(fresh.token);
          setUserProfile(prev => ({ ...prev, ...fresh, uid: fresh.id }));
        }
      }).catch(() => {});
    }, 8000);

    return () => clearInterval(interval);
  }, [userProfile]);

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
