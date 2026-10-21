import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import usePermissions from '../hooks/usePermissions';

export default function RequirePermission({ children, module, action = 'VIEW' }) {
  const { userProfile, loading: authLoading } = useAuth();
  const { hasPermission, loading: permissionsLoading } = usePermissions();

  if (authLoading || permissionsLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-coral border-t-transparent"></div>
      </div>
    );
  }

  const role = (userProfile?.role || '').toLowerCase();
  if (role === 'admin' || role === 'superadmin' || role === 'super_admin') {
    return children;
  }

  if (module && !hasPermission(module, action)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
