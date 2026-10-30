import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LuBan as Ban, LuMail as Mail, LuLogOut as LogOut } from 'react-icons/lu';
import { logoutUser } from '../services/auth';

export default function AccountSuspendedScreen() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logoutUser();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-cream dark:bg-darkBg flex flex-col justify-center items-center p-4 transition-colors">
      <div className="glass max-w-md w-full p-8 rounded-3xl text-center shadow-xl border border-red-500/20 dark:border-red-500/30">
        <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
          <Ban size={40} className="animate-pulse" />
        </div>

        <h1 className="text-3xl font-black text-charcoal dark:text-cream mb-4">Account Suspended</h1>
        <p className="text-grayText dark:text-coral-light mb-6 leading-relaxed text-sm">
          Access for this school tenant has been temporarily suspended by the platform administrator.
          Please contact our support team to reactivate your workspace.
        </p>

        <div className="bg-lightGray dark:bg-darkCard rounded-2xl p-4 mb-8 flex flex-col gap-2 border border-coral-glow/20">
          <span className="text-xs font-bold text-grayText dark:text-coral-light uppercase tracking-wider">Support Contact</span>
          <a
            href="mailto:support@queflow.com"
            className="flex items-center justify-center gap-2 text-sm font-bold text-coral hover:text-coral-dark transition-colors"
          >
            <Mail size={16} /> support@queflow.com
          </a>
        </div>

        <div className="flex gap-4 justify-center">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-coral hover:bg-coral-dark text-white transition-all font-bold text-sm shadow-md shadow-coral-glow"
          >
            <LogOut size={18} />
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}
