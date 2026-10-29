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

    // Role permissions from userProfile (from JWT token or backend profile)
    const rawPerms = userProfile.permissions || userProfile.rolePermissions;
    if (rawPerms) {
      if (rawPerms === 'ALL' || (Array.isArray(rawPerms) && rawPerms.includes('ALL'))) {
        setPermissions('ALL');
      } else if (Array.isArray(rawPerms)) {
        // Convert array of objects or strings to normalized map
        const map = {};
        rawPerms.forEach(item => {
          if (item && typeof item === 'object' && item.moduleKey) {
            const mod = item.moduleKey.toLowerCase().replace(/\s+/g, '-');
            map[mod] = {
              canCreate: item.canCreate === true || item.create === true,
              canRead: item.canRead === true || item.read === true || item.view === true,
              canUpdate: item.canUpdate === true || item.edit === true || item.update === true,
              canDelete: item.canDelete === true || item.delete === true,
              create: item.canCreate === true || item.create === true,
              read: item.canRead === true || item.read === true || item.view === true,
              edit: item.canUpdate === true || item.edit === true || item.update === true,
              delete: item.canDelete === true || item.delete === true
            };
          } else if (typeof item === 'string') {
            const [mod, act] = item.toLowerCase().split(':');
            if (!map[mod]) {
              map[mod] = { canRead: false, canCreate: false, canUpdate: false, canDelete: false, read: false, create: false, edit: false, delete: false };
            }
            if (!act || act === 'view' || act === 'read') { map[mod].read = true; map[mod].canRead = true; }
            if (act === 'create') { map[mod].create = true; map[mod].canCreate = true; }
            if (act === 'edit' || act === 'update') { map[mod].edit = true; map[mod].canUpdate = true; }
            if (act === 'delete') { map[mod].delete = true; map[mod].canDelete = true; }
          }
        });
        setPermissions(map);
      } else if (typeof rawPerms === 'object') {
        const normalized = {};
        for (const [key, val] of Object.entries(rawPerms)) {
          const mod = key.toLowerCase().replace(/\s+/g, '-');
          if (val && typeof val === 'object') {
            normalized[mod] = {
              canCreate: val.canCreate === true || val.create === true,
              canRead: val.canRead === true || val.read === true || val.view === true,
              canUpdate: val.canUpdate === true || val.edit === true || val.update === true,
              canDelete: val.canDelete === true || val.delete === true,
              create: val.canCreate === true || val.create === true,
              read: val.canRead === true || val.read === true || val.view === true,
              edit: val.canUpdate === true || val.edit === true || val.update === true,
              delete: val.canDelete === true || val.delete === true
            };
          }
        }
        setPermissions(normalized);
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
    const p = permissions[key] || permissions[moduleKey];
    return p ? (p.canRead === true || p.read === true || p.view === true) : false;
  };

  const canCreate = (moduleKey) => {
    if (permissions === 'ALL') return true;
    if (!permissions || !moduleKey) return false;
    const key = moduleKey.toLowerCase().replace(/\s+/g, '-');
    const p = permissions[key] || permissions[moduleKey];
    return p ? (p.canCreate === true || p.create === true) : false;
  };

  const canEdit = (moduleKey) => {
    if (permissions === 'ALL') return true;
    if (!permissions || !moduleKey) return false;
    const key = moduleKey.toLowerCase().replace(/\s+/g, '-');
    const p = permissions[key] || permissions[moduleKey];
    return p ? (p.canUpdate === true || p.edit === true || p.update === true) : false;
  };

  const canDelete = (moduleKey) => {
    if (permissions === 'ALL') return true;
    if (!permissions || !moduleKey) return false;
    const key = moduleKey.toLowerCase().replace(/\s+/g, '-');
    const p = permissions[key] || permissions[moduleKey];
    return p ? (p.canDelete === true || p.delete === true) : false;
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
