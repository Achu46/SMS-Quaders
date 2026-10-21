import React from 'react';
import { useAuth } from '../context/AuthContext';
import PendingApproval from '../pages/PendingApproval';
import AccountSuspendedScreen from '../pages/AccountSuspendedScreen';

export default function RequireActiveSchool({ children }) {
  const { userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-cream dark:bg-darkBg flex items-center justify-center">
        <div className="w-10 h-10 animate-spin rounded-full border-4 border-coral/20 border-t-coral"></div>
      </div>
    );
  }

  // Super Admins bypass tenant status check
  const role = userProfile?.role?.toLowerCase();
  if (role === 'superadmin' || role === 'super_admin') {
    return children;
  }

  const status = (userProfile?.schoolStatus || 'ACTIVE').toUpperCase();

  if (status === 'PENDING') {
    return <PendingApproval />;
  }

  if (status === 'SUSPENDED') {
    return <AccountSuspendedScreen />;
  }

  return children;
}
