import React, { useState, useEffect, Suspense } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LuLayoutDashboard, LuUsers, LuCreditCard, LuLogOut, LuMenu, LuX,
  LuKey, LuLifeBuoy, LuClipboardList, LuUserCog, LuSparkles, LuChevronRight
} from 'react-icons/lu';
import { logoutUser } from '../services/auth';
import { useAuth } from '../context/AuthContext';
import TopNavbar from '../components/TopNavbar';

export default function SuperAdminDashboard() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Close sidebar on route change for mobile
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logoutUser();
    navigate('/login');
  };

  const navItems = [
    { name: 'Global Overview', path: '/superadmin', icon: LuLayoutDashboard, exact: true },
    { name: 'Tenant Management', path: '/superadmin/tenants', icon: LuUsers },
    { name: 'Subscription & Plans', path: '/superadmin/billing', icon: LuCreditCard },
    { name: 'License & Usage', path: '/superadmin/license-usage', icon: LuKey },
    { name: 'Support Desk', path: '/superadmin/support-tickets', icon: LuLifeBuoy },
    { name: 'Audit & Activity Logs', path: '/superadmin/audit-logs', icon: LuClipboardList },
    { name: 'Email Templates', path: '/superadmin/email-templates', icon: LuUserCog },
  ];

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 font-sans overflow-hidden antialiased selection:bg-orange-500 selection:text-white">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Modern High-End Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border-r border-slate-200/80 dark:border-slate-800/80 flex flex-col transition-all duration-300 ease-out lg:static lg:translate-x-0 shadow-2xl lg:shadow-none
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Brand Header */}
        <div className="px-6 py-6 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <img
              src="/logo.png"
              alt="queflow"
              className="w-10 h-10 object-contain shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-none">queflow</h1>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary-600 dark:text-primary-400">HQ</span>
              </div>
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-wider">Super Administrator</p>
            </div>
          </div>

          <button
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <LuX size={20} />
          </button>
        </div>

        {/* Navigation Items */}
        <div className="px-4 py-3">
          <p className="px-3 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Platform Core</p>
        </div>

        <nav className="flex-1 px-3 space-y-1.5 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              end={item.exact}
              className={({ isActive }) =>
                `group relative flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm ${isActive
                  ? 'bg-primary-600 text-white font-semibold shadow-md shadow-primary-600/25'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-primary-50/80 dark:hover:bg-slate-800/60 hover:text-primary-700 dark:hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg transition-colors ${isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 group-hover:text-primary-600 group-hover:bg-primary-100/70 dark:group-hover:bg-slate-800'
                      }`}>
                      <item.icon size={18} />
                    </div>
                    <span className="truncate">{item.name}</span>
                  </div>
                  {isActive && (
                    <LuChevronRight size={16} className="text-white/80 shrink-0" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User Card & Logout Footer (FUNDZA Style) */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 space-y-2.5">
          <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-3 border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-600 to-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-primary-500/20">
                  {userProfile?.email ? userProfile.email.substring(0, 2).toUpperCase() : 'SU'}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-800 rounded-full" title="Online" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{userProfile?.name || userProfile?.email?.split('@')[0] || 'Super Administrator'}</p>
                <p className="text-[10px] font-medium text-primary-600 dark:text-primary-400 truncate">
                  Platform Owner
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#20252B] hover:bg-[#15191D] text-white text-xs font-bold transition-all shadow-sm"
          >
            <LuLogOut size={15} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <TopNavbar
          schoolName="SuperAdmin Control Center"
          toggleSidebar={() => setIsSidebarOpen(true)}
        />

        <main className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            <Suspense fallback={
              <div className="flex justify-center items-center h-[50vh]">
                <div className="relative flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full border-4 border-orange-500/20 border-t-orange-500 animate-spin"></div>
                  <LuSparkles className="absolute text-orange-500 animate-pulse" size={18} />
                </div>
              </div>
            }>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
