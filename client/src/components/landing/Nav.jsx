import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { LuSun, LuMoon, LuMenu, LuX } from 'react-icons/lu';

export default function Nav({ scrollToSection }) {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Hardcode dark mode for now as default if there's no context, 
  // but let's manage a local state or read from document.documentElement
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark') || true);

  const toggleTheme = () => {
    setIsDark(!isDark);
    if (!isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const { scrollY } = useScroll();
  const navBg = useTransform(scrollY, [0, 80], ['rgba(18, 16, 26, 0)', 'rgba(18, 16, 26, 0.8)']);
  const navBackdrop = useTransform(scrollY, [0, 80], ['blur(0px)', 'blur(16px)']);
  const navBorder = useTransform(scrollY, [0, 80], ['rgba(229, 189, 223, 0)', 'rgba(229, 189, 223, 0.1)']);
  const navPy = useTransform(scrollY, [0, 80], ['1.5rem', '1rem']);

  return (
    <>
      <motion.nav 
        style={{ 
          backgroundColor: navBg, 
          backdropFilter: navBackdrop, 
          borderBottomColor: navBorder,
          borderBottomWidth: '1px',
          paddingTop: navPy,
          paddingBottom: navPy
        }}
        className="fixed top-0 left-0 right-0 z-50 px-6 lg:px-12 transition-all duration-300"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => scrollToSection('home')}>
            {/* Quaders Logo Image */}
            <img 
              src="/logo.png" 
              alt="Quaders Logo" 
              className="w-auto h-12 md:h-16 object-contain group-hover:scale-105 transition-transform" 
            />
          </div>
          
          <div className="hidden md:flex gap-8 items-center font-medium text-slate-500 dark:text-[#94a3b8]">
            <button onClick={() => scrollToSection('home')} className="hover:text-primary-500 dark:hover:text-primary-400 transition-colors">Home</button>
            <button onClick={() => scrollToSection('ai-assistant')} className="text-orange-600 dark:text-orange-400 font-bold hover:text-orange-500 flex items-center gap-1 transition-colors">
              <span>AI Assistant</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-extrabold uppercase">New</span>
            </button>
            <button onClick={() => scrollToSection('services')} className="hover:text-primary-500 dark:hover:text-primary-400 transition-colors">Services</button>
            <button onClick={() => scrollToSection('pricing')} className="hover:text-primary-500 dark:hover:text-primary-400 transition-colors">Pricing</button>
          </div>

          <div className="hidden md:flex gap-4 items-center">
            {/* Theme Toggle */}
            <button 
              onClick={toggleTheme}
              className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <AnimatePresence mode="wait" initial={false}>
                {isDark ? (
                  <motion.div
                    key="sun"
                    initial={{ opacity: 0, rotate: -90 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: 90 }}
                    transition={{ duration: 0.2 }}
                    className="absolute text-[#f1f5f9]"
                  >
                    <LuSun size={20} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="moon"
                    initial={{ opacity: 0, rotate: -90 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: 90 }}
                    transition={{ duration: 0.2 }}
                    className="absolute text-slate-800"
                  >
                    <LuMoon size={20} />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>

            <button 
              onClick={() => navigate('/login')}
              className="px-5 py-2.5 font-bold text-slate-600 dark:text-[#94a3b8] hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Log in
            </button>
            <button 
              onClick={() => navigate('/register')}
              className="px-6 py-2.5 bg-gradient-to-r from-primary-600 to-primary-400 text-white font-bold rounded-full hover:scale-105 transition-all duration-300 shadow-[0_0_20px_rgba(249,115,22,0.3)]"
            >
              Get Started
            </button>
          </div>

          <button className="md:hidden text-slate-800 dark:text-[#f1f5f9] p-2 -mr-2" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <LuX size={28} /> : <LuMenu size={28} />}
          </button>
        </div>
      </motion.nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-white/95 dark:bg-[#020617]/95 backdrop-blur-xl flex flex-col items-center justify-center gap-8 md:hidden pt-20"
          >
            <button onClick={() => scrollToSection('home')} className="text-2xl font-bold text-slate-500 dark:text-[#94a3b8] hover:text-slate-900 dark:hover:text-white">Home</button>
            <button onClick={() => scrollToSection('services')} className="text-2xl font-bold text-slate-500 dark:text-[#94a3b8] hover:text-slate-900 dark:hover:text-white">Services</button>
            <button onClick={() => scrollToSection('pricing')} className="text-2xl font-bold text-slate-500 dark:text-[#94a3b8] hover:text-slate-900 dark:hover:text-white">Pricing</button>
            <button onClick={toggleTheme} className="text-2xl font-bold text-slate-500 dark:text-[#94a3b8] hover:text-slate-900 dark:hover:text-white mt-4 flex items-center gap-2">
              Toggle Theme {isDark ? <LuSun /> : <LuMoon />}
            </button>
            <button onClick={() => navigate('/login')} className="text-2xl font-bold text-slate-500 dark:text-[#94a3b8] hover:text-slate-900 dark:hover:text-white mt-4">Log in</button>
            <button 
              onClick={() => {
                setIsMobileMenuOpen(false);
                navigate('/register');
              }}
              className="px-8 py-4 bg-gradient-to-r from-primary-600 to-primary-400 text-white font-bold rounded-full text-xl shadow-[0_0_20px_rgba(249,115,22,0.4)]"
            >
              Get Started
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
