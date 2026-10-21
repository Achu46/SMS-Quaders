import React, { useState, useEffect, useRef } from 'react';
import { Menu, Search, Bell, RefreshCw, ChevronRight, X, AlertTriangle, ArrowLeft, LifeBuoy, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { subscribeToNotices } from '../firebase/firestore';
import RaiseTicketModal from './RaiseTicketModal';
import { useNotifications } from '../context/NotificationContext';
import { FiSun, FiMoon } from 'react-icons/fi';

export default function TopNavbar({ schoolName, schoolLogo, toggleSidebar, navItems = [] }) {
  const { userProfile } = useAuth();
  const { unreadCounts, clearBadge, lastViewed } = useNotifications();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const [showTicketModal, setShowTicketModal] = useState(false);

  const isAdminUser = userProfile?.role === 'admin' || userProfile?.role === 'superadmin' || userProfile?.role === 'super_admin';

  const [notices, setNotices] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);

  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const handleMarkAsRead = (moduleKey) => {
    clearBadge(moduleKey);
  };

  const handleMarkAllAsRead = () => {
    clearBadge('noticeboard');
    clearBadge('notifications');
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!userProfile?.schoolId) return;
    const unsubNotices = subscribeToNotices(userProfile.schoolId, (data) => {
      setNotices(data || []);
    });
    return () => {
      unsubNotices && unsubNotices();
    };
  }, [userProfile?.schoolId]);

  const allNotifications = [
    ...notifications.map(n => ({ ...n, type: 'personal' })),
    ...notices.map(n => ({ ...n, type: 'notice' }))
  ];

  if (unreadCounts?.chats > 0) {
    allNotifications.push({
      id: 'unread_chats',
      type: 'chat',
      title: 'New Messages',
      description: `You have ${unreadCounts.chats} unread message(s).`,
      createdAt: new Date().toISOString()
    });
  }

  allNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const unreadCount = allNotifications.filter(n => {
    if (n.type === 'notice') return n.createdAt > (lastViewed?.noticeboard || '1970');
    if (n.type === 'personal') return n.createdAt > (lastViewed?.notifications || '1970');
    return true;
  }).length;

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (filteredNavItems.length > 0) {
      navigate(filteredNavItems[0].path);
      setShowDropdown(false);
      setSearchQuery('');
    }
  };

  const filteredNavItems = navItems.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name, email) => {
    if (name) return name.substring(0, 2).toUpperCase();
    if (email) return email.substring(0, 2).toUpperCase();
    return 'QA';
  };

  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border-b border-slate-200/80 dark:border-slate-800/80 h-16 shrink-0 flex items-center justify-between px-4 sm:px-6 min-w-0 shadow-sm transition-colors">
      {/* Left Section */}
      <div className="flex items-center flex-1 min-w-0 gap-3">
        <div className={`flex items-center gap-2 shrink-0 ${isMobileSearchOpen ? 'hidden md:flex' : 'flex'}`}>
          <button 
            onClick={() => navigate(-1)}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Go back"
          >
            <ArrowLeft size={18} />
          </button>

          {toggleSidebar && (
            <button 
              onClick={toggleSidebar}
              className="lg:hidden p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Menu size={20} />
            </button>
          )}
        </div>
        
        {/* Search Bar */}
        <div className={`relative flex-1 max-w-md ${isMobileSearchOpen ? 'flex' : 'hidden md:flex'}`}>
          <form onSubmit={handleSearch} className="relative w-full" ref={dropdownRef}>
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none z-10 text-slate-400">
              <Search size={16} />
            </div>
            <input
              type="text"
              className="block w-full pl-9 pr-16 py-2 border border-slate-200/80 dark:border-slate-800 rounded-xl text-sm bg-slate-50/80 dark:bg-slate-950/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-inner"
              placeholder="Quick search modules & tasks..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              autoFocus={isMobileSearchOpen}
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-1.5 pointer-events-none">
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 bg-slate-200/60 dark:bg-slate-800 rounded border border-slate-300/60 dark:border-slate-700">⌘K</kbd>
            </div>
          </form>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* AI Assistant Quick Trigger (Admin & SuperAdmin only - Icon Only) */}
        {isAdminUser && (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-ai-assistant'))}
            className="p-2 rounded-xl text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40 border border-orange-200/60 dark:border-orange-800/50 transition-all shadow-xs active:scale-95 relative group flex items-center justify-center"
            title="Open AI Assistant (⌘J)"
            aria-label="Open AI Assistant"
          >
            <Sparkles size={18} className="text-orange-500 group-hover:scale-110 transition-transform" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full animate-ping" />
          </button>
        )}

        {/* Refresh */}
        <button
          onClick={handleRefresh}
          className={`p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-slate-800 transition-all ${
            isRefreshing ? 'animate-spin text-orange-600' : ''
          }`}
          title="Refresh Data"
        >
          <RefreshCw size={18} />
        </button>

        {/* Dark Mode Toggle */}
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-slate-800 transition-all"
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDarkMode ? <FiSun size={18} className="text-amber-400" /> : <FiMoon size={18} />}
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-slate-800 transition-all relative"
            title="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse" />
            )}
          </button>
        </div>

        {/* User Pill */}
        <div className="pl-2 border-l border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
              {userProfile?.name || 'Administrator'}
            </p>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/60 px-1.5 py-0.5 rounded border border-orange-200/50 dark:border-orange-800/40">
              {userProfile?.role || 'SUPER_ADMIN'}
            </span>
          </div>

          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-orange-500/20 ring-2 ring-white dark:ring-slate-800">
            {getInitials(userProfile?.name, userProfile?.email)}
          </div>
        </div>
      </div>
    </header>
  );
}
