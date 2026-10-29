import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function RequireAcademicSetup({ children }) {
  const { userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  // SuperAdmins bypass academic setup
  const role = userProfile?.role?.toLowerCase();
  if (role === 'superadmin' || role === 'super_admin') {
    return children;
  }

  const isCompleted = Boolean(userProfile?.academicSetupCompleted || userProfile?.setupCompleted);

  if (!isCompleted) {
    toast.error('Please complete Academic Setup first before accessing this directory.', { id: 'setup-locked' });
    return <Navigate to="/admin/setup" replace />;
  }

  return children;
}

