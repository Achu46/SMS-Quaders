import React, { useEffect, useState, Suspense } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  LuBookOpen as BookOpen, LuUsers as Users, LuLogOut as LogOut, LuLayoutDashboard as LayoutDashboard, 
  LuLink as LinkIcon, LuSettings as Settings, LuCreditCard as CreditCard, LuGraduationCap as GraduationCap, 
  LuCalendar as Calendar, LuBus as Bus, LuLibrary as Library, LuFileText as FileText, LuBell as Bell, 
  LuKey as Key, LuMenu as Menu, LuX as X, LuBuilding2 as Building2, LuCheck as CheckSquare, LuHouse as Home, 
  LuPackage as PackageIcon, LuBriefcase as Briefcase, LuChartBar as BarChart2, LuHeartPulse as HeartPulse, 
  LuCircleAlert as AlertCircle, LuFiles as Files, LuChevronDown as ChevronDown, LuChevronRight as ChevronRight, 
  LuShield as Shield, LuLayoutGrid as LayoutGrid, LuMessageSquare as MessageSquare, LuCoffee as Coffee 
} from 'react-icons/lu';
import { logoutUser } from '../services/auth';
import { useAuth } from '../context/AuthContext';
import usePermissions from '../hooks/usePermissions';
import { getDoc, doc, collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import TopNavbar from '../components/TopNavbar';
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
  const { userProfile } = useAuth();
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
    const fetchSchoolData = async () => {
      try {
        if (userProfile && userProfile.schoolId) {
          const schoolDoc = await getDoc(doc(db, 'schools', userProfile.schoolId));
          if (schoolDoc.exists()) {
            const data = schoolDoc.data();
            if (data.status !== 'approved') {
              navigate('/admin/pending');
              return;
            } else {
              setSchoolData(data);
              
              onSnapshot(doc(db, 'schools', userProfile.schoolId), (docSnap) => {
                if (docSnap.exists()) {
                  setSchoolData(docSnap.data());
                }
              });

              try {
                onSnapshot(collection(db, `schools/${userProfile.schoolId}/customModules`), (snapshot) => {
                  const customMods = snapshot.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .sort((a, b) => a.order - b.order)
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

              try {
                onSnapshot(doc(db, 'settings', 'sidebar_order'), (docSnap) => {
                  if (docSnap.exists() && Array.isArray(docSnap.data().order)) {
                    setSidebarOrder(docSnap.data().order);
                  }
                });
              } catch (e) {
                console.warn('Failed to subscribe to sidebar order:', e);
              }
            }
          }
        }
      } catch (error) {
        console.error("Error fetching school data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSchoolData();
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

  const permittedModules = schoolData.permittedModules || [];
  const combinedNavItems = [...allNavItems, ...customNavItems];
  
  let navItems = combinedNavItems.filter(item => {
    if (!item.moduleKey && item.name === 'Dashboard') return true;
    if (!item.moduleKey && item.name === 'Environment Setup') return true;
    if (item.isCustom) return true;
    if (item.moduleKey === 'inventory' && schoolData.schoolType === 'College') return true;
    
    const coreKeys = ['classes', 'students', 'staff', 'links', 'roles', 'settings', 'form-builder', 'api', 'homework', 'leaves', 'leads', 'reports', 'canteen', 'chats'];
    if (!coreKeys.includes(item.moduleKey) && !permittedModules.includes(item.moduleKey)) {
       return false;
    }
    
    if (permissions === 'ALL') {
       return true;
    } else {
       if (item.moduleKey === 'roles') return false;
       return canRead(item.moduleKey);
    }
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
              alt="Quaders" 
              className="w-10 h-10 object-contain shrink-0" 
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-none">Quaders</h1>
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

            return (
              <div key={item.name} className="space-y-1">
                <NavLink
                  to={item.path}
                  end={item.exact}
                  onClick={hasSubItems ? toggleMenu : undefined}
                  className={({ isActive }) => {
                    const childActive = hasSubItems && item.subItems.some(sub => location.pathname === sub.path);
                    const active = isActive || childActive;
                    return `group relative flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm ${
                      active 
                        ? 'bg-gradient-to-r from-orange-500/15 via-orange-500/10 to-transparent dark:from-orange-500/20 dark:via-orange-500/10 text-orange-600 dark:text-orange-400 font-semibold border-l-4 border-orange-500 shadow-sm' 
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                    }`
                  }}
                >
                  {({ isActive }) => {
                    const childActive = hasSubItems && item.subItems.some(sub => location.pathname === sub.path);
                    const active = isActive || childActive;
                    return (
                      <>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-1.5 rounded-lg transition-colors ${
                            active 
                              ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30' 
                              : 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 group-hover:text-orange-500 group-hover:bg-orange-50 dark:group-hover:bg-slate-800'
                          }`}>
                            <item.icon size={16} />
                          </div>
                          <span className="truncate">{item.name}</span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {unreadCounts[item.moduleKey] > 0 && (
                            <span className="bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full select-none animate-pulse">
                              {unreadCounts[item.moduleKey]}
                            </span>
                          )}
                          {hasSubItems && (
                            <div className="text-slate-400">
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
                          `flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors relative whitespace-nowrap ${
                            isActive
                              ? 'text-orange-600 dark:text-orange-400 bg-orange-50/60 dark:bg-orange-950/40 before:absolute before:-left-4 before:top-1/2 before:-translate-y-1/2 before:w-1.5 before:h-1.5 before:rounded-full before:bg-orange-500'
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

        {/* User Card Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-3 border border-slate-200/80 dark:border-slate-700/60 shadow-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-orange-500/20">
                  {userProfile?.email ? userProfile.email.substring(0, 2).toUpperCase() : 'AD'}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-800 rounded-full" title="Online" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{userProfile?.name || userProfile?.email?.split('@')[0] || 'Administrator'}</p>
                <p className="text-[10px] font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider truncate">
                  {userProfile?.role || 'Admin'}
                </p>
              </div>
            </div>

            <button 
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-all"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
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
            {userProfile?.role?.toLowerCase() === 'admin' && userProfile?.setupCompleted === false && (
              <div className="p-4 sm:p-5 rounded-2xl bg-coral-light/60 dark:bg-darkCard border border-coral/30 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in-up">
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 bg-coral text-white rounded-xl shrink-0 shadow-md shadow-coral-glow">
                    <Settings size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-charcoal dark:text-cream">Academic Setup Incomplete</h3>
                    <p className="text-xs text-grayText dark:text-coral-light mt-0.5">
                      Configure your Academic Year, Classes, and Subjects in Environment Setup to unlock student admissions and staff assignments.
                    </p>
                  </div>
                </div>
                <NavLink
                  to="/admin/setup"
                  className="px-4 py-2 bg-coral hover:bg-coral-dark text-white rounded-xl font-bold text-xs shadow-md shadow-coral-glow transition-all whitespace-nowrap"
                >
                  Complete Setup →
                </NavLink>
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
