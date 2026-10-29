import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { 
  LuEye as Eye, 
  LuEyeOff as EyeOff, 
  LuShieldCheck, 
  LuLock, 
  LuCheck, 
  LuX, 
  LuTriangleAlert as LuAlertTriangle, 
  LuBuilding2, 
  LuBadgeCheck,
  LuArrowRight
} from 'react-icons/lu';
import toast from 'react-hot-toast';

export default function StaffRegister() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [validatingError, setValidatingError] = useState(null);
  const [inviteData, setInviteData] = useState(null); // { email, employeeId, schoolName, schoolLogo }

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setValidatingError('No registration token was provided in the link. Please contact your school admin.');
      setLoading(false);
      return;
    }

    const validateToken = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/staff-invite/validate?token=${encodeURIComponent(token)}`);
        setInviteData(res);
        setValidatingError(null);
      } catch (err) {
        console.error('Validation error:', err);
        setValidatingError(err.message || 'Link is invalid or expired. Contact your school admin.');
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  // Password rules validation
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isFormValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && passwordsMatch;

  // Calculate password strength
  const calculateStrength = () => {
    if (!password) return { label: 'None', score: 0, color: 'bg-slate-200 dark:bg-slate-700' };
    let score = 0;
    if (hasMinLength) score += 1;
    if (hasUppercase) score += 1;
    if (hasLowercase) score += 1;
    if (hasNumber) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score <= 2) return { label: 'Weak', score: 25, color: 'bg-red-500' };
    if (score === 3) return { label: 'Fair', score: 50, color: 'bg-amber-500' };
    if (score === 4) return { label: 'Good', score: 75, color: 'bg-blue-500' };
    return { label: 'Strong', score: 100, color: 'bg-emerald-500' };
  };

  const strength = calculateStrength();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) {
      toast.error('Please fulfill all password requirements before proceeding.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/staff-invite/complete', {
        token,
        password,
        confirmPassword
      });

      setSubmittedSuccess(true);
      toast.success('Registration completed successfully!');
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2000);
    } catch (err) {
      console.error('Registration completion error:', err);
      toast.error(err.message || 'Failed to complete registration.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-semibold text-slate-500 dark:text-slate-400">Verifying registration invite...</p>
      </div>
    );
  }

  // Invalid or expired link screen (No Form)
  if (validatingError || !inviteData) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-3xl p-8 border border-slate-200 dark:border-slate-700 shadow-xl text-center space-y-5">
          <div className="w-16 h-16 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto">
            <LuAlertTriangle size={32} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Registration Link Unavailable</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {validatingError || 'Link is invalid or expired. Contact your school admin.'}
            </p>
          </div>
          <div className="pt-2">
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold text-sm rounded-xl transition-all"
            >
              Return to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Registration successful screen
  if (submittedSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-3xl p-8 border border-slate-200 dark:border-slate-700 shadow-xl text-center space-y-5">
          <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto">
            <LuBadgeCheck size={36} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Registration Complete!</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Your staff password has been set. Redirecting you to the login screen...
            </p>
          </div>
          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 bg-primary-600 text-white font-semibold text-sm rounded-xl shadow-lg hover:bg-primary-700 transition-all"
          >
            Go to Login Now <LuArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-6">
        {/* School Branding Header */}
        <div className="text-center space-y-3 pb-4 border-b border-slate-100 dark:border-slate-700/60">
          {inviteData.schoolLogo ? (
            <img 
              src={inviteData.schoolLogo} 
              alt={inviteData.schoolName || 'Institution Logo'} 
              className="h-16 w-16 mx-auto rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm"
            />
          ) : (
            <div className="w-14 h-14 bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400 rounded-2xl flex items-center justify-center mx-auto">
              <LuBuilding2 size={28} />
            </div>
          )}

          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">
              {inviteData.schoolName || 'Institution Staff Portal'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Staff Portal Setup & Password Creation
            </p>
          </div>
        </div>

        {/* Pre-filled Account Information */}
        <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-3">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Account Credentials</div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">Email Address</span>
              <div className="flex items-center gap-2 mt-0.5 text-xs font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <LuLock size={14} className="text-slate-400 shrink-0" />
                <span className="truncate">{inviteData.email}</span>
              </div>
            </div>

            <div>
              <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">Employee ID</span>
              <div className="flex items-center gap-2 mt-0.5 text-xs font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <LuShieldCheck size={14} className="text-emerald-500 shrink-0" />
                <span className="truncate">{inviteData.employeeId || 'Assigned'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Password Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Create Password *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters..."
                className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Strength Meter */}
            {password && (
              <div className="mt-2 space-y-1">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400 font-semibold">Password Strength:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">{strength.label}</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${strength.color} transition-all duration-300`} 
                    style={{ width: `${strength.score}%` }} 
                  />
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Confirm Password *
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password..."
                className={`w-full pl-3.5 pr-10 py-2.5 text-sm bg-slate-50 dark:bg-slate-900/60 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white ${
                  confirmPassword && !passwordsMatch 
                    ? 'border-red-400 focus:ring-red-500' 
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {confirmPassword && !passwordsMatch && (
              <p className="text-[11px] text-red-500 mt-1 font-medium">Passwords do not match</p>
            )}
          </div>

          {/* Password Rules Checklist */}
          <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200/60 dark:border-slate-800 space-y-1.5 text-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Security Requirements
            </span>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                {hasMinLength ? <LuCheck size={14} /> : <LuX size={14} />} 8+ characters
              </div>
              <div className={`flex items-center gap-1.5 ${hasUppercase ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                {hasUppercase ? <LuCheck size={14} /> : <LuX size={14} />} Uppercase (A-Z)
              </div>
              <div className={`flex items-center gap-1.5 ${hasLowercase ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                {hasLowercase ? <LuCheck size={14} /> : <LuX size={14} />} Lowercase (a-z)
              </div>
              <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                {hasNumber ? <LuCheck size={14} /> : <LuX size={14} />} Number (0-9)
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={!isFormValid || submitting}
            className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 mt-4"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Saving Account Password...
              </>
            ) : (
              'Complete Registration & Activate Account'
            )}
          </button>
        </form>

        <div className="text-center pt-2">
          <Link to="/login" className="text-xs text-slate-500 hover:text-primary-600 dark:hover:text-primary-400">
            Already completed setup? <span className="font-semibold underline">Log in here</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
