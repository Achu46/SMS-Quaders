import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { LuEye as Eye, LuEyeOff as EyeOff, LuArrowLeft } from 'react-icons/lu';
import { FiLoader as Loader, FiCheckCircle as CheckCircle } from 'react-icons/fi';
import { loginUser, getUserProfile, loginWithAdmissionNumber } from '../services/auth';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { currentUser, userProfile, handleAuthChange } = useAuth();
  const reducedMotion = useReducedMotion();

  const [formData, setFormData] = useState({ identifier: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  // Redirect if already logged in
  useEffect(() => {
    if (currentUser && userProfile) {
      redirectBasedOnRole(userProfile.role);
    }
  }, [currentUser, userProfile, navigate]);

  const redirectBasedOnRole = (role) => {
    const r = role?.toLowerCase();
    switch (r) {
      case 'superadmin':
      case 'super_admin':
        navigate('/superadmin');
        break;
      case 'parent':
        navigate('/parent');
        break;
      case 'admin':
        if (userProfile && (userProfile.academicSetupCompleted === false || userProfile.setupCompleted === false)) {
          navigate('/admin/setup');
        } else {
          navigate('/admin');
        }
        break;
      case 'staff':
      case 'teacher':
      default:
        navigate('/admin');
        break;
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError(null);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!formData.identifier || !formData.password) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let user;
      const { identifier, password } = formData;
      if (identifier.includes('@')) {
        user = await loginUser(identifier, password);
      } else {
        user = await loginWithAdmissionNumber(identifier, password);
      }

      if (user) {
        setSuccess(true);
        // Trigger the auth context update so the app knows we are logged in
        handleAuthChange();

        setTimeout(() => {
          redirectBasedOnRole(user.role, user.loginPanel);
        }, 600); // Wait for success animation
      } else {
        setError("User profile not found. Please contact support.");
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Invalid email/admission number or password.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-sans selection:bg-primary-500 selection:text-white flex flex-col items-center justify-center p-4 sm:p-8">
      <motion.div
        initial={{ opacity: 0, y: reducedMotion ? 0 : 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-3xl shadow-xl overflow-hidden flex flex-col md:flex-row h-auto md:h-[90vh] max-h-[800px] min-h-[600px] border border-slate-100 dark:border-slate-800"
      >
        {/* Left Gradient Panel */}
        <div className="w-full md:w-1/2 p-4 hidden md:flex flex-col relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-700 via-primary-600 to-amber-500 rounded-2xl m-4 z-0 shadow-lg">
            {/* Decorative mesh elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[55%] h-[55%] bg-white/20 blur-[60px] rounded-full mix-blend-screen animate-pulse pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[65%] h-[65%] bg-amber-200/25 blur-[80px] rounded-full mix-blend-screen animate-[pulse_4s_ease-in-out_infinite_reverse] pointer-events-none"></div>
          </div>

          <div className="relative z-10 flex flex-col h-full justify-between p-8 text-white">
            {/* Top Bar with Brand Tag */}
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-[11px] font-bold uppercase tracking-widest text-white/90">
                School Management Platform
              </span>
            </div>

            {/* Central Animated Logo Showcase */}
            <div className="my-auto flex flex-col items-center text-center py-6">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="relative flex items-center justify-center mb-6"
              >
                {/* Outer ambient glow rings */}
                <motion.div
                  animate={{
                    scale: [1, 1.25, 1],
                    opacity: [0.35, 0.65, 0.35]
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="absolute w-36 h-36 rounded-3xl bg-white/20 blur-xl pointer-events-none"
                />

                <motion.div
                  animate={{
                    rotate: [0, 360]
                  }}
                  transition={{
                    duration: 25,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                  className="absolute w-32 h-32 rounded-3xl border border-white/25 border-dashed pointer-events-none"
                />

                {/* Floating Animated Logo Badge */}
                <motion.div
                  animate={{
                    y: [-6, 6, -6],
                    rotate: [-1.5, 1.5, -1.5]
                  }}
                  transition={{
                    duration: 4.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  whileHover={{ scale: 1.08, rotate: 0 }}
                  className="relative z-10 w-24 h-24 rounded-2xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-md p-4 shadow-2xl shadow-black/25 flex items-center justify-center border border-white/40 ring-4 ring-white/10"
                >
                  <img
                    src="/logo.png"
                    alt="queflow Logo"
                    className="w-full h-full object-contain drop-shadow-md select-none"
                  />
                </motion.div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.5 }}
                className="space-y-1"
              >
                <h2 className="text-2xl font-black tracking-tight text-white drop-shadow-xs">queflow</h2>
                <p className="text-xs font-medium text-white/80 tracking-wider uppercase">Institutional Excellence</p>
              </motion.div>
            </div>

            <div className="mt-auto">
              <p className="text-sm font-medium text-white/80 mb-2">Welcome back</p>
              <h1 className="text-3xl lg:text-4xl font-bold leading-tight">
                Log in to access your dashboard and tools
              </h1>
            </div>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="w-full md:w-1/2 p-6 sm:p-8 lg:p-12 flex flex-col justify-center bg-white dark:bg-slate-900 relative overflow-y-auto overflow-x-hidden custom-scrollbar">

          {/* Back to Home Button */}
          <div className="mb-4 sm:mb-6 flex">
            <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-primary-600 transition-colors focus:outline-none focus:text-primary-600">
              <LuArrowLeft size={16} /> Back to Home
            </Link>
          </div>

          {/* Mobile Logo */}
          <div className="md:hidden flex flex-col items-center justify-center mb-6">
            <motion.div
              animate={{ y: [-4, 4, -4] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              className="w-16 h-16 rounded-2xl bg-primary-50 dark:bg-slate-800 p-3 shadow-md shadow-primary-500/10 border border-primary-100 dark:border-primary-900/30 flex items-center justify-center"
            >
              <img src="/logo.png" alt="queflow Logo" className="w-full h-full object-contain" />
            </motion.div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white mt-2">queflow</h2>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">Log in to your account</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Access your tasks, notes, and projects anytime, anywhere - and keep everything flowing in one place.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1">
              <label htmlFor="identifier" className="block text-sm font-bold text-slate-700 dark:text-slate-200">Email or Admission No.</label>
              <input
                type="text"
                id="identifier"
                name="identifier"
                value={formData.identifier}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none text-slate-900 dark:text-white disabled:opacity-50"
                placeholder="you@example.com"
                disabled={loading || success}
                required
              />
            </div>

            <div className="space-y-1 relative">
              <label htmlFor="password" className="block text-sm font-bold text-slate-700 dark:text-slate-200">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-4 pr-12 py-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none text-slate-900 dark:text-white disabled:opacity-50"
                  placeholder="••••••••"
                  disabled={loading || success}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 transition-colors focus:outline-none focus:text-primary-600"
                  tabIndex="-1"
                  disabled={loading || success}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm pt-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-primary-500 focus:ring-primary-500 focus:ring-offset-white transition-colors cursor-pointer" />
                <span className="text-slate-500 dark:text-slate-400 group-hover:text-slate-700 transition-colors">Remember me</span>
              </label>
              <Link to="/forgot-password" className="font-bold text-primary-600 hover:text-primary-700 transition-colors focus:outline-none focus:underline">
                Forgot password?
              </Link>
            </div>

            <motion.div
              initial={false}
              animate={{ height: error ? 'auto' : 0, opacity: error ? 1 : 0 }}
              className="overflow-hidden"
            >
              <p className="text-red-500 text-sm font-medium">{error}</p>
            </motion.div>

            <button
              type="submit"
              disabled={loading || success}
              className="w-full py-3.5 mt-2 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700 transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 flex justify-center items-center gap-2 disabled:cursor-not-allowed"
            >
              {success ? (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-2">
                  <CheckCircle size={20} /> Success
                </motion.div>
              ) : loading ? (
                <>
                  <Loader className="animate-spin" size={20} /> Signing in...
                </>
              ) : (
                "Log In"
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Don't have an account?{' '}
            <Link to="/register" className="font-bold text-primary-600 hover:text-primary-700 transition-colors focus:outline-none focus:underline">
              Sign up
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
