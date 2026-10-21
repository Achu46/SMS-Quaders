import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LuClock as Clock, LuRefreshCcw as RefreshCcw, LuLogOut as LogOut } from 'react-icons/lu';
import { logoutUser } from '../services/auth';
import { api } from '../services/api';

export default function PendingApproval() {
  const { userProfile, updateProfileData } = useAuth();
  const [status, setStatus] = useState(userProfile?.schoolStatus || 'PENDING');
  const [checking, setChecking] = useState(false);
  const navigate = useNavigate();

  const checkStatus = async () => {
    setChecking(true);
    try {
      if (userProfile && userProfile.schoolId) {
        const schoolData = await api.get(`/auth/school-status/${userProfile.schoolId}`);
        if (schoolData && schoolData.status) {
          setStatus(schoolData.status);
          if (schoolData.status === 'ACTIVE' || schoolData.status === 'approved') {
            await updateProfileData();
            navigate('/admin');
            return;
          }
        }
      } else {
        const profile = await api.get('/auth/profile');
        if (profile && (profile.schoolStatus === 'ACTIVE' || profile.schoolStatus === 'approved')) {
          await updateProfileData();
          navigate('/admin');
          return;
        }
      }
    } catch (error) {
      console.error("Error checking school status:", error);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkStatus();
    // Poll every 6 seconds for superadmin approval
    const interval = setInterval(() => {
      checkStatus();
    }, 6000);

    return () => clearInterval(interval);
  }, [userProfile, navigate]);

  useEffect(() => {
    const curStatus = (userProfile?.schoolStatus || '').toUpperCase();
    if (curStatus === 'ACTIVE' || curStatus === 'APPROVED') {
      navigate('/admin');
    }
  }, [userProfile, navigate]);

  const handleLogout = async () => {
    await logoutUser();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-cream dark:bg-darkBg flex flex-col justify-center items-center p-4 transition-colors">
      <div className="glass max-w-md w-full p-8 rounded-3xl text-center shadow-xl border border-coral-glow/20">
        <div className="w-20 h-20 bg-coral-light dark:bg-coral-subtle text-coral rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
          <Clock size={40} className="animate-pulse text-coral" />
        </div>
        
        <h1 className="text-3xl font-black text-charcoal dark:text-cream mb-4">Pending Approval</h1>
        <p className="text-grayText dark:text-coral-light mb-8 leading-relaxed text-sm">
          Your school registration is currently under review by our team. 
          Your full operations dashboard will unlock automatically once approved.
        </p>

        <div className="bg-lightGray dark:bg-darkCard rounded-2xl p-4 mb-8 flex items-center justify-between border border-coral-glow/20">
          <span className="text-sm font-bold text-charcoal dark:text-cream">Account Status:</span>
          <span className="px-3.5 py-1 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800 text-xs font-black uppercase rounded-full tracking-wider animate-pulse">
            {status}
          </span>
        </div>

        <div className="flex gap-4 justify-center">
          <button 
            onClick={checkStatus}
            disabled={checking}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-coral/30 text-charcoal dark:text-cream hover:bg-coral-light dark:hover:bg-darkCard transition-colors font-bold text-sm"
          >
            <RefreshCcw size={18} className={checking ? 'animate-spin text-coral' : 'text-coral'} />
            {checking ? 'Checking...' : 'Check Status'}
          </button>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-coral hover:bg-coral-dark text-white transition-all font-bold text-sm shadow-md shadow-coral-glow"
          >
            <LogOut size={18} />
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
