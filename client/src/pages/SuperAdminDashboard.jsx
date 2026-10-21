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
              alt="Quaders" 
              className="w-10 h-10 object-contain shrink-0" 
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-none">Quaders</h1>
                <span className="px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 rounded-md">HQ</span>
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
                `group relative flex items-center justify-between px-3.5 py-3 rounded-xl transition-all duration-200 font-medium text-sm ${
                  isActive 
                    ? 'bg-gradient-to-r from-orange-500/15 via-orange-500/10 to-transparent dark:from-orange-500/20 dark:via-orange-500/10 text-orange-600 dark:text-orange-400 font-semibold border-l-4 border-orange-500 shadow-sm' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg transition-colors ${
                      isActive 
                        ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30' 
                        : 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 group-hover:text-orange-500 group-hover:bg-orange-50 dark:group-hover:bg-slate-800'
                    }`}>
                      <item.icon size={18} />
                    </div>
                    <span className="truncate">{item.name}</span>
                  </div>
                  {isActive && (
                    <LuChevronRight size={16} className="text-orange-500/70 shrink-0" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User Card Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-700/60 shadow-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-orange-500/20">
                  {userProfile?.email ? userProfile.email.substring(0, 2).toUpperCase() : 'SU'}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-800 rounded-full" title="Online" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{userProfile?.name || userProfile?.email?.split('@')[0] || 'Super Administrator'}</p>
                <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Platform Owner
                </p>
              </div>
            </div>

            <button 
              onClick={handleLogout}
              className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-all"
              title="Logout session"
            >
              <LuLogOut size={18} />
            </button>
          </div>
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
