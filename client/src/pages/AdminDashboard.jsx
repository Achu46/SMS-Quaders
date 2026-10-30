import React, { useEffect, useState, Suspense } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  LuBookOpen as BookOpen, LuUsers as Users, LuLogOut as LogOut, LuLayoutDashboard as LayoutDashboard, 
  LuLink as LinkIcon, LuSettings as Settings, LuCreditCard as CreditCard, LuGraduationCap as GraduationCap, 
  LuCalendar as Calendar, LuBus as Bus, LuLibrary as Library, LuFileText as FileText, LuBell as Bell, 
  LuKey as Key, LuMenu as Menu, LuX as X, LuBuilding2 as Building2, LuCheck as CheckSquare, LuHouse as Home, 
  LuPackage as PackageIcon, LuBriefcase as Briefcase, LuChartBar as BarChart2, LuHeartPulse as HeartPulse, 
  LuCircleAlert as AlertCircle, LuFiles as Files, LuChevronDown as ChevronDown, LuChevronRight as ChevronRight, 
  LuShield as Shield, LuLayoutGrid as LayoutGrid, LuMessageSquare as MessageSquare, LuCoffee as Coffee,
  LuLock as Lock 
} from 'react-icons/lu';
import { logoutUser } from '../services/auth';
import { useAuth } from '../context/AuthContext';
import usePermissions from '../hooks/usePermissions';
import { getSchool, subscribeToSubCollection } from '../firebase/firestore';
import TopNavbar from '../components/TopNavbar';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import useSchoolBranding from '../hooks/useSchoolBranding';
import { useNotifications } from '../context/NotificationContext';

export const allNavItems = [
  { name: 'Dashboard', path: '/admin', icon: LayoutDashboard, exact: true },
  { name: 'Noticeboard', path: '/admin/notices', icon: Bell, moduleKey: 'noticeboard' },
  { name: 'Canteen Requests', path: '/admin/canteen', icon: Coffee, moduleKey: 'canteen' },
  { name: 'Environment Setup', path: '/admin/setup', icon: Settings },
  { name: 'Staff Directory', path: '/admin/staff', icon: GraduationCap, moduleKey: 'staff' },
  {
    name: 'Classes & Sections',
    path: '/admin/classes',
    icon: BookOpen,
    moduleKey: 'classes',
    subItems: [
      { name: 'Class List', path: '/admin/classes', icon: BookOpen },
      { name: 'Subject Management', path: '/admin/subjects', icon: BookOpen }
    ]
  },
  { name: 'Student Directory', path: '/admin/students', icon: Users, moduleKey: 'students' },
  { name: 'Attendance', path: '/admin/attendance', icon: CheckSquare, moduleKey: 'attendance' },
  { name: 'HR & Payroll', path: '/admin/hr-payroll', icon: Briefcase, moduleKey: 'hr-payroll' },
  { name: 'Chat Monitor', path: '/admin/chats', icon: MessageSquare, moduleKey: 'chats' },
  { name: 'Timetables', path: '/admin/timetables', icon: Calendar, moduleKey: 'timetables' },
  { name: 'Calendar', path: '/admin/calendar', icon: Calendar, moduleKey: 'calendar' },
  { name: 'Exams & Results', path: '/admin/exams', icon: FileText, moduleKey: 'exams' },
  { name: 'Homework', path: '/admin/homework', icon: BookOpen, moduleKey: 'homework' },
  { name: 'Fees & Payments', path: '/admin/fees', icon: CreditCard, moduleKey: 'fees' },
  { name: 'Transport', path: '/admin/transport', icon: Bus, moduleKey: 'transport' },
  { name: 'Library', path: '/admin/library', icon: Library, moduleKey: 'library' },
  { name: 'Inventory & Assets', path: '/admin/inventory', icon: PackageIcon, moduleKey: 'inventory' },
  { name: 'Leave Requests', path: '/admin/leaves', icon: Calendar, moduleKey: 'leaves' },
  { name: 'Reports & Analytics', path: '/admin/reports', icon: BarChart2, moduleKey: 'reports' },
  { name: 'API Integrations', path: '/admin/api', icon: Key, moduleKey: 'api' },
  { name: 'Registration Links', path: '/admin/links', icon: LinkIcon, moduleKey: 'links' },
  { name: 'Leads', path: '/admin/leads', icon: Users, moduleKey: 'leads' },
  { name: 'Billing & Plan', path: '/admin/billing', icon: CreditCard, moduleKey: 'billing' },
  { name: 'Custom Modules', path: '/admin/form-builder', icon: Settings, moduleKey: 'form-builder' },
  { name: 'Roles & Permissions', path: '/admin/roles', icon: Shield, moduleKey: 'roles' },
];

export default function AdminDashboard() {
  const { userProfile, updateProfileData } = useAuth();
  const { permissions, canRead } = usePermissions();
  const { unreadCounts } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const [schoolData, setSchoolData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState([]);
  const [customNavItems, setCustomNavItems] = useState([]);
  const [sidebarOrder, setSidebarOrder] = useState([]);

  useSchoolBranding(schoolData);

  useEffect(() => {
    let unsubModules = null;

    const fetchSchoolData = async () => {
      try {
        if (userProfile && userProfile.schoolId) {
          let data = userProfile.school;
          if (!data || !data.name) {
            data = await getSchool(userProfile.schoolId);
          }

          if (data) {
            const status = (data.status || userProfile.schoolStatus || '').toUpperCase();
            if (status === 'PENDING') {
              navigate('/admin/pending');
              return;
            }
            if (status === 'SUSPENDED') {
              navigate('/admin/suspended');
              return;
            }

            // Force admin into Academic Setup if incomplete
            const isCompleted = Boolean(data.academicSetupCompleted ?? data.setupCompleted ?? userProfile.academicSetupCompleted ?? userProfile.setupCompleted);
            if (!isCompleted && userProfile.role?.toLowerCase() === 'admin' && (location.pathname === '/admin' || location.pathname === '/admin/')) {
              navigate('/admin/setup');
              return;
            }

            setSchoolData(data);

            try {
              unsubModules = subscribeToSubCollection(userProfile.schoolId, 'customModules', (docs) => {
                const customMods = (docs || [])
                  .sort((a, b) => (a.order || 0) - (b.order || 0))
                  .map(m => ({
                    name: m.name,
                    path: `/admin/custom/${m.id}`,
                    icon: LayoutGrid,
                    moduleKey: m.id,
                    isCustom: true
                  }));
                setCustomNavItems(customMods);
              });
            } catch (e) {
              console.warn('Failed to subscribe to custom modules:', e);
            }
          } else {
            // Fallback so admin is never locked out of dashboard
            setSchoolData({
              id: userProfile.schoolId,
              name: userProfile.schoolName || 'School Admin',
              status: userProfile.schoolStatus || 'ACTIVE'
            });
          }
        } else if (userProfile && (userProfile.role === 'superadmin' || userProfile.role === 'super_admin')) {
          setSchoolData({ id: 'superadmin', name: 'Super Admin', status: 'ACTIVE' });
        }
      } catch (error) {
        console.error("Error fetching school data:", error);
        if (userProfile?.schoolId) {
          setSchoolData({
            id: userProfile.schoolId,
            name: userProfile.schoolName || 'School Admin',
            status: userProfile.schoolStatus || 'ACTIVE'
          });
        }
      } finally {
        setLoading(false);
      }
    };

    fetchSchoolData();

    return () => {
      if (unsubModules) unsubModules();
    };
  }, [userProfile, navigate]);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logoutUser();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="w-10 h-10 animate-spin rounded-full border-4 border-orange-500/20 border-t-orange-500"></div>
      </div>
    );
  }

  if (!schoolData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <p className="text-slate-500 dark:text-slate-400">Loading school context...</p>
        </div>
      </div>
    );
  }

  const isAdmin = userProfile?.role?.toLowerCase() === 'admin' || userProfile?.role?.toLowerCase() === 'superadmin' || userProfile?.role?.toLowerCase() === 'super_admin';
  const isSetupCompleted = Boolean(
    userProfile?.academicSetupCompleted ?? 
    userProfile?.setupCompleted ?? 
    schoolData?.academicSetupCompleted ?? 
    schoolData?.setupCompleted
  );
  const isSetupLocked = isAdmin && !isSetupCompleted;

  const permittedModules = schoolData?.permittedModules || [];
  const combinedNavItems = [...allNavItems, ...customNavItems];

  let navItems = combinedNavItems.filter(item => {
    // For Staff members: strictly enforce role-based permissions
    if (permissions !== 'ALL') {
      const adminOnlyNames = ['Environment Setup', 'Roles & Permissions', 'Registration Links', 'API Integrations', 'Billing & Plan', 'Custom Modules'];
      if (adminOnlyNames.includes(item.name)) return false;
      const adminOnlyKeys = ['setup', 'roles', 'links', 'api', 'billing', 'form-builder'];
      if (item.moduleKey && adminOnlyKeys.includes(item.moduleKey)) return false;
      
      if (!item.moduleKey && item.name === 'Dashboard') return true;
      if (item.moduleKey) return canRead(item.moduleKey);
      return false;
    }

    // For Admin / SuperAdmin
    if (!item.moduleKey && item.name === 'Dashboard') return true;
    if (!item.moduleKey && item.name === 'Environment Setup') return true;
    if (item.isCustom) return true;
    if (item.moduleKey === 'inventory' && schoolData?.schoolType === 'College') return true;
    const coreKeys = ['classes', 'students', 'staff', 'links', 'roles', 'settings', 'form-builder', 'api', 'homework', 'leaves', 'leads', 'reports', 'canteen', 'chats'];
    if (!coreKeys.includes(item.moduleKey) && !permittedModules.includes(item.moduleKey)) {
      return false;
    }
    return true;
  });

  if (sidebarOrder.length > 0) {
    navItems.sort((a, b) => {
      if (a.name === 'Dashboard') return -1;
      if (b.name === 'Dashboard') return 1;

      const keyA = a.moduleKey || a.name.toLowerCase().replace(/\s+/g, '-');
      const keyB = b.moduleKey || b.name.toLowerCase().replace(/\s+/g, '-');
      const indexA = sidebarOrder.indexOf(keyA);
      const indexB = sidebarOrder.indexOf(keyB);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return 0;
    });
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 font-sans overflow-hidden antialiased selection:bg-orange-500 selection:text-white">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
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
                <span className="px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 rounded-md">OS</span>
              </div>
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-wider truncate">
                {schoolData?.name || 'School Operations'}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Items */}
        <div className="px-4 py-3">
          <p className="px-3 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">School Modules</p>
        </div>

        <nav className="flex-1 px-3 space-y-1.5 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const hasSubItems = item.subItems && item.subItems.length > 0;
            const isExpanded = expandedMenus.includes(item.name);

            const toggleMenu = () => {
              if (hasSubItems) {
                setExpandedMenus(prev =>
                  prev.includes(item.name) ? [] : [item.name]
                );
              }
            };

            const isGatedModule = ['roles', 'staff', 'students'].includes(item.moduleKey);
            const isItemLocked = isSetupLocked && isGatedModule;

            return (
              <div key={item.name} className="space-y-1">
                <NavLink
                  to={isItemLocked ? '/admin/setup' : item.path}
                  end={item.exact}
                  onClick={(e) => {
                    if (isItemLocked) {
                      e.preventDefault();
                      toast.error(`Complete Academic Setup first to unlock ${item.name}.`);
                      navigate('/admin/setup');
                      return;
                    }
                    if (hasSubItems) toggleMenu();
                  }}
                  className={({ isActive }) => {
                    const childActive = hasSubItems && item.subItems.some(sub => location.pathname === sub.path);
                    const active = isActive || childActive;
                    return `group relative flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm ${active
                        ? 'bg-primary-600 text-white font-semibold shadow-md shadow-primary-600/25'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-primary-50/80 dark:hover:bg-slate-800/60 hover:text-primary-700 dark:hover:text-white'
                      }`
                  }}
                >
                  {({ isActive }) => {
                    const childActive = hasSubItems && item.subItems.some(sub => location.pathname === sub.path);
                    const active = isActive || childActive;
                    return (
                      <>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-1.5 rounded-lg transition-colors ${active
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 group-hover:text-primary-600 group-hover:bg-primary-100/70 dark:group-hover:bg-slate-800'
                            }`}>
                            <item.icon size={16} />
                          </div>
                          <span className="truncate">{item.name}</span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isItemLocked && (
                            <span className="p-1 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" title="Locked until Academic Setup is completed">
                              <Lock size={12} />
                            </span>
                          )}
                          {unreadCounts[item.moduleKey] > 0 && (
                            <span className="bg-primary-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full select-none animate-pulse">
                              {unreadCounts[item.moduleKey]}
                            </span>
                          )}
                          {hasSubItems && (
                            <div className={active ? 'text-white/80' : 'text-slate-400'}>
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </div>
                          )}
                        </div>
                      </>
                    );
                  }}
                </NavLink>

                {/* Sub Items */}
                {hasSubItems && isExpanded && (
                  <div className="pl-9 pr-2 py-1 space-y-1 relative before:absolute before:left-5 before:top-0 before:bottom-2 before:w-[2px] before:bg-slate-200 dark:before:bg-slate-800 before:rounded-full">
                    {item.subItems.map(sub => (
                      <NavLink
                        key={sub.name}
                        to={sub.path}
                        className={({ isActive }) =>
                          `flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors relative whitespace-nowrap ${isActive
                            ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/40 before:absolute before:-left-4 before:top-1/2 before:-translate-y-1/2 before:w-1.5 before:h-1.5 before:rounded-full before:bg-primary-500 font-bold'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`
                        }
                      >
                        {sub.icon && <sub.icon size={14} className="shrink-0" />}
                        {sub.name}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* User Card & Logout Footer (FUNDZA Style) */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 space-y-2.5">
          <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-3 border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-600 to-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-primary-500/20">
                  {userProfile?.email ? userProfile.email.substring(0, 2).toUpperCase() : 'AD'}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-800 rounded-full" title="Online" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{userProfile?.name || userProfile?.email?.split('@')[0] || 'Administrator'}</p>
                <p className="text-[10px] font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wider truncate">
                  {userProfile?.role || 'Admin'}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#20252B] hover:bg-[#15191D] text-white text-xs font-bold transition-all shadow-sm"
          >
            <LogOut size={15} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <TopNavbar
          schoolName={schoolData?.name || 'School Operations'}
          toggleSidebar={() => setIsSidebarOpen(true)}
          navItems={navItems}
        />

        <main className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {userProfile?.role?.toLowerCase() === 'admin' && isSetupLocked && (
              <div className="p-4 sm:p-5 rounded-2xl bg-orange-500/10 dark:bg-slate-900 border border-orange-500/30 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in-up">
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 bg-orange-500 text-white rounded-xl shrink-0 shadow-md shadow-orange-500/20">
                    <Settings size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-orange-500 text-white rounded-md">Step 2 Mandatory</span>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Academic Setup Incomplete</h3>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      Configure your academic environment to unlock Roles & Permissions, Staff Directory, and Student Directory.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <NavLink
                    to="/admin/setup"
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition-all whitespace-nowrap"
                  >
                    Go to Setup
                  </NavLink>
                  <button
                    onClick={async () => {
                      const toastId = toast.loading('Finalizing Academic Setup...');
                      try {
                        await api.post('/academic/complete-setup');
                        if (typeof updateProfileData === 'function') {
                          await updateProfileData();
                        }
                        toast.success('Academic Setup completed! Roles, Staff, and Students are unlocked.', { id: toastId });
                        navigate('/admin/roles');
                      } catch (e) {
                        toast.error(e.message || 'Failed to complete setup', { id: toastId });
                      }
                    }}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-xs shadow-md shadow-orange-500/25 transition-all whitespace-nowrap"
                  >
                    Complete Setup & Unlock →
                  </button>
                </div>
              </div>
            )}

            <Suspense fallback={
              <div className="flex justify-center items-center h-[50vh]">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-coral/20 border-t-coral"></div>
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
