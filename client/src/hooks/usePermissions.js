import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function usePermissions() {
  const { userProfile } = useAuth();
  const [permissions, setPermissions] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userProfile) {
      setPermissions(null);
      setLoading(false);
      return;
    }

    const role = (userProfile.role || '').toLowerCase();
    
    // SuperAdmin and Admin have unrestricted access
    if (role === 'admin' || role === 'superadmin' || role === 'super_admin') {
      setPermissions('ALL');
      setLoading(false);
      return;
    }

    // Direct permissions from userProfile (from JWT token or backend profile)
    if (userProfile.permissions) {
      if (userProfile.permissions === 'ALL' || (Array.isArray(userProfile.permissions) && userProfile.permissions.includes('ALL'))) {
        setPermissions('ALL');
      } else if (Array.isArray(userProfile.permissions)) {
        // Convert flattened array e.g. ["attendance:VIEW", "attendance:CREATE"] into normalized map
        const map = {};
        userProfile.permissions.forEach(item => {
          if (typeof item === 'string') {
            const [mod, act] = item.toLowerCase().split(':');
            if (!map[mod]) {
              map[mod] = { read: false, create: false, edit: false, delete: false };
            }
            if (!act || act === 'view' || act === 'read') map[mod].read = true;
            if (act === 'create') map[mod].create = true;
            if (act === 'edit' || act === 'update') map[mod].edit = true;
            if (act === 'delete') map[mod].delete = true;
          }
        });
        setPermissions(map);
      } else if (typeof userProfile.permissions === 'object') {
        setPermissions(userProfile.permissions);
      }
      setLoading(false);
      return;
    }

    // Fallback if no permissions are explicitly defined
    setPermissions({});
    setLoading(false);
  }, [userProfile]);

  const canRead = (moduleKey) => {
    if (permissions === 'ALL') return true;
    if (!permissions || !moduleKey) return false;
    const key = moduleKey.toLowerCase().replace(/\s+/g, '-');
    return permissions[key]?.read === true || permissions[moduleKey]?.read === true || permissions[moduleKey]?.view === true;
  };

  const canCreate = (moduleKey) => {
    if (permissions === 'ALL') return true;
    if (!permissions || !moduleKey) return false;
    const key = moduleKey.toLowerCase().replace(/\s+/g, '-');
    return permissions[key]?.create === true || permissions[moduleKey]?.create === true;
  };

  const canEdit = (moduleKey) => {
    if (permissions === 'ALL') return true;
    if (!permissions || !moduleKey) return false;
    const key = moduleKey.toLowerCase().replace(/\s+/g, '-');
    return permissions[key]?.edit === true || permissions[moduleKey]?.edit === true || permissions[moduleKey]?.update === true;
  };

  const canDelete = (moduleKey) => {
    if (permissions === 'ALL') return true;
    if (!permissions || !moduleKey) return false;
    const key = moduleKey.toLowerCase().replace(/\s+/g, '-');
    return permissions[key]?.delete === true || permissions[moduleKey]?.delete === true;
  };

  const hasPermission = (moduleKey, action = 'VIEW') => {
    const act = action.toUpperCase();
    if (act === 'VIEW' || act === 'READ') return canRead(moduleKey);
    if (act === 'CREATE') return canCreate(moduleKey);
    if (act === 'EDIT' || act === 'UPDATE') return canEdit(moduleKey);
    if (act === 'DELETE') return canDelete(moduleKey);
    return false;
  };

  return { permissions, loading, canRead, canCreate, canEdit, canDelete, hasPermission };
}
