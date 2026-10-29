import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { 
  LuShield, LuSave, LuCheck, LuX, LuPlus, LuTrash2, LuLock, 
  LuTriangleAlert as LuAlertTriangle, LuUsers, LuFolderCheck, LuArrowRight, LuInfo, LuSearch
} from 'react-icons/lu';
import toast from 'react-hot-toast';
import ConfirmModal from '../../components/ConfirmModal';

const DEFAULT_MODULE_CATALOG = [
  { id: 'attendance', label: 'Attendance Management' },
  { id: 'classes', label: 'Classes & Sections' },
  { id: 'subjects', label: 'Subject Management' },
  { id: 'students', label: 'Student Directory & Admissions' },
  { id: 'staff', label: 'Staff Management' },
  { id: 'timetables', label: 'Timetables & Scheduling' },
  { id: 'calendar', label: 'Academic Calendar' },
  { id: 'exams', label: 'Examinations & Report Cards' },
  { id: 'homework', label: 'Homework & Assignments' },
  { id: 'fees', label: 'Fees & Payments' },
  { id: 'leaves', label: 'Leave Requests' },
  { id: 'noticeboard', label: 'Noticeboard & Announcements' },
  { id: 'chats', label: 'Chat & Messaging' },
  { id: 'library', label: 'Library Management' },
  { id: 'transport', label: 'Transport Management' },
  { id: 'inventory', label: 'Inventory & Assets' },
  { id: 'hr-payroll', label: 'HR & Payroll' },
  { id: 'reports', label: 'Reports & Analytics' },
  { id: 'canteen', label: 'Canteen Management' },
  { id: 'leads', label: 'Leads & Inquiries' },
  { id: 'form-builder', label: 'Custom Forms' }
];

export default function RolesPermissions() {
  const { userProfile } = useAuth();
  const schoolId = userProfile?.schoolId;

  const [roles, setRoles] = useState([]);
  const [activeRoleId, setActiveRoleId] = useState(null);
  const [modules, setModules] = useState(DEFAULT_MODULE_CATALOG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Create role modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createRoleData, setCreateRoleData] = useState({
    name: '',
    description: '',
    permissions: {} // { [moduleKey]: { canCreate, canRead, canUpdate, canDelete } }
  });

  // Active role permissions edit state
  const [editedPermissions, setEditedPermissions] = useState({}); // { [moduleKey]: { canCreate, canRead, canUpdate, canDelete } }
  const [editedRoleName, setEditedRoleName] = useState('');
  const [editedRoleDesc, setEditedRoleDesc] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    roleId: null,
    roleName: '',
    assignedCount: 0
  });

  // Load roles and module catalog on mount
  useEffect(() => {
    fetchInitialData();
  }, [schoolId]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // 1. Fetch available modules
      try {
        const modRes = await api.get('/roles/modules');
        if (Array.isArray(modRes) && modRes.length > 0) {
          setModules(modRes);
        }
      } catch (err) {
        console.warn('Using default module catalog:', err);
      }

      // 2. Fetch custom roles for this college/school
      const rolesRes = await api.get('/roles');
      const loadedRoles = Array.isArray(rolesRes) ? rolesRes : [];
      setRoles(loadedRoles);

      if (loadedRoles.length > 0) {
        selectRole(loadedRoles[0]);
      } else {
        setActiveRoleId(null);
        setEditedPermissions({});
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
      toast.error('Failed to load roles and permissions');
    } finally {
      setLoading(false);
    }
  };

  const selectRole = (role) => {
    if (!role) return;
    setActiveRoleId(role.id);
    setEditedRoleName(role.name || '');
    setEditedRoleDesc(role.description || '');

    // Map permissions
    const permMap = {};
    if (Array.isArray(role.permissions)) {
      role.permissions.forEach(p => {
        if (p && p.moduleKey) {
          const key = p.moduleKey.toLowerCase();
          permMap[key] = {
            canCreate: p.canCreate || false,
            canRead: p.canRead || false,
            canUpdate: p.canUpdate || false,
            canDelete: p.canDelete || false
          };
        }
      });
    }
    setEditedPermissions(permMap);
  };

  const activeRole = roles.find(r => r.id === activeRoleId);

  // Toggle permission flag for the currently active role
  const handleTogglePermission = (moduleKey, action) => {
    const key = moduleKey.toLowerCase();
    setEditedPermissions(prev => {
      const current = prev[key] || { canCreate: false, canRead: false, canUpdate: false, canDelete: false };
      const nextVal = !current[action];
      const updated = { ...current, [action]: nextVal };

      // Logical cascading: enabling create/update/delete implies read
      if ((action === 'canCreate' || action === 'canUpdate' || action === 'canDelete') && nextVal) {
        updated.canRead = true;
      }
      // Disabling read automatically disables create/update/delete
      if (action === 'canRead' && !nextVal) {
        updated.canCreate = false;
        updated.canUpdate = false;
        updated.canDelete = false;
      }

      return { ...prev, [key]: updated };
    });
  };

  // Quick select for row (enable all CRUD or disable all)
  const handleQuickSelectRow = (moduleKey, enableAll) => {
    const key = moduleKey.toLowerCase();
    setEditedPermissions(prev => ({
      ...prev,
      [key]: {
        canCreate: enableAll,
        canRead: enableAll,
        canUpdate: enableAll,
        canDelete: enableAll
      }
    }));
  };

  // Bulk grant all permissions across all modules
  const handleGrantAll = () => {
    setEditedPermissions(prev => {
      const updated = { ...prev };
      modules.forEach(m => {
        const key = m.id.toLowerCase();
        updated[key] = {
          canCreate: true,
          canRead: true,
          canUpdate: true,
          canDelete: true
        };
      });
      return updated;
    });
  };

  // Bulk revoke all permissions across all modules
  const handleRevokeAll = () => {
    setEditedPermissions(prev => {
      const updated = { ...prev };
      modules.forEach(m => {
        const key = m.id.toLowerCase();
        updated[key] = {
          canCreate: false,
          canRead: false,
          canUpdate: false,
          canDelete: false
        };
      });
      return updated;
    });
  };

  const filteredModules = modules.filter(m => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const label = (m.label || m.name || m.id).toLowerCase();
    return label.includes(term) || m.id.toLowerCase().includes(term);
  });

  // Save changes to the active role
  const handleSaveActiveRole = async () => {
    if (!activeRoleId) return;
    setSaving(true);
    try {
      // Transform editedPermissions map to array of RolePermission objects
      const permissionsArray = [];
      for (const [moduleKey, flags] of Object.entries(editedPermissions)) {
        if (flags.canCreate || flags.canRead || flags.canUpdate || flags.canDelete) {
          permissionsArray.push({
            moduleKey,
            canCreate: Boolean(flags.canCreate),
            canRead: Boolean(flags.canRead),
            canUpdate: Boolean(flags.canUpdate),
            canDelete: Boolean(flags.canDelete)
          });
        }
      }

      if (permissionsArray.length === 0) {
        toast.error('A role must have at least one active module permission.');
        setSaving(false);
        return;
      }

      const payload = {
        name: editedRoleName.trim(),
        description: editedRoleDesc.trim(),
        permissions: permissionsArray
      };

      const res = await api.put(`/roles/${activeRoleId}`, payload);
      toast.success(`Role "${editedRoleName}" updated successfully!`);

      // Update in local list
      setRoles(prev => prev.map(r => r.id === activeRoleId ? res.role : r));
      selectRole(res.role);
    } catch (error) {
      console.error('Error saving role:', error);
      toast.error(error.message || 'Failed to save role permissions');
    } finally {
      setSaving(false);
    }
  };

  // Open Create Role Modal
  const openCreateModal = () => {
    // Initialize blank matrix
    const initialPerms = {};
    modules.forEach(m => {
      initialPerms[m.id.toLowerCase()] = {
        canCreate: false,
        canRead: false,
        canUpdate: false,
        canDelete: false
      };
    });

    setCreateRoleData({
      name: '',
      description: '',
      permissions: initialPerms
    });
    setIsCreateModalOpen(true);
  };

  const handleToggleCreatePerm = (moduleKey, action) => {
    const key = moduleKey.toLowerCase();
    setCreateRoleData(prev => {
      const current = prev.permissions[key] || { canCreate: false, canRead: false, canUpdate: false, canDelete: false };
      const nextVal = !current[action];
      const updated = { ...current, [action]: nextVal };

      if ((action === 'canCreate' || action === 'canUpdate' || action === 'canDelete') && nextVal) {
        updated.canRead = true;
      }
      if (action === 'canRead' && !nextVal) {
        updated.canCreate = false;
        updated.canUpdate = false;
        updated.canDelete = false;
      }

      return {
        ...prev,
        permissions: { ...prev.permissions, [key]: updated }
      };
    });
  };

  const handleCreateRoleSubmit = async (e) => {
    e.preventDefault();
    if (!createRoleData.name.trim()) {
      toast.error('Role name is required');
      return;
    }

    const permissionsArray = [];
    for (const [moduleKey, flags] of Object.entries(createRoleData.permissions)) {
      if (flags.canCreate || flags.canRead || flags.canUpdate || flags.canDelete) {
        permissionsArray.push({
          moduleKey,
          canCreate: Boolean(flags.canCreate),
          canRead: Boolean(flags.canRead),
          canUpdate: Boolean(flags.canUpdate),
          canDelete: Boolean(flags.canDelete)
        });
      }
    }

    if (permissionsArray.length === 0) {
      toast.error('Please assign at least one module permission (Create, Read, Update, or Delete).');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: createRoleData.name.trim(),
        description: createRoleData.description.trim() || undefined,
        permissions: permissionsArray
      };

      const newRole = await api.post('/roles', payload);
      toast.success(`Role "${newRole.name}" created successfully!`);
      
      setRoles(prev => [...prev, newRole]);
      selectRole(newRole);
      setIsCreateModalOpen(false);
    } catch (error) {
      console.error('Error creating role:', error);
      toast.error(error.message || 'Failed to create role');
    } finally {
      setSaving(false);
    }
  };

  // Open Delete confirmation
  const initiateDelete = (role) => {
    const assignedCount = role._count?.users || 0;
    setDeleteModal({
      isOpen: true,
      roleId: role.id,
      roleName: role.name,
      assignedCount
    });
  };

  const confirmDeleteRole = async () => {
    if (!deleteModal.roleId) return;

    if (deleteModal.assignedCount > 0) {
      toast.error(`Cannot delete "${deleteModal.roleName}" because ${deleteModal.assignedCount} staff member(s) are assigned to it. Please reassign them in Staff Directory first.`);
      setDeleteModal({ isOpen: false, roleId: null, roleName: '', assignedCount: 0 });
      return;
    }

    try {
      await api.delete(`/roles/${deleteModal.roleId}`);
      toast.success(`Role "${deleteModal.roleName}" deleted successfully`);

      const remaining = roles.filter(r => r.id !== deleteModal.roleId);
      setRoles(remaining);
      if (remaining.length > 0) {
        selectRole(remaining[0]);
      } else {
        setActiveRoleId(null);
        setEditedPermissions({});
      }
    } catch (error) {
      console.error('Error deleting role:', error);
      toast.error(error.message || 'Failed to delete role');
    } finally {
      setDeleteModal({ isOpen: false, roleId: null, roleName: '', assignedCount: 0 });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary-50 dark:bg-primary-950/40 text-primary-600 rounded-xl">
              <LuShield size={22} />
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Roles & Permissions</h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Create custom roles and assign module-level CRUD permissions scoped strictly to your institution.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white font-semibold text-sm rounded-xl hover:bg-primary-700 shadow-sm transition-all"
        >
          <LuPlus size={18} />
          Create New Role
        </button>
      </div>

      {/* Main Content: If 0 roles exist, show Empty State */}
      {roles.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-12 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 space-y-4">
          <div className="w-16 h-16 bg-primary-50 dark:bg-primary-950/40 text-primary-600 rounded-2xl flex items-center justify-center mx-auto">
            <LuShield size={32} />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Zero Roles Configured</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Your institution starts with zero roles by default. Create custom roles (e.g. Principal, Teacher, Accountant) with granular CRUD permissions before assigning staff.
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white font-semibold text-sm rounded-xl hover:bg-primary-700 shadow-sm transition-all"
          >
            <LuPlus size={18} />
            Create First Role
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Roles Selector Sidebar */}
          <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Institution Roles</span>
              <span className="px-2 py-0.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md">
                {roles.length}
              </span>
            </div>

            <div className="space-y-1.5 max-h-[520px] overflow-y-auto custom-scrollbar pr-1">
              {roles.map(r => {
                const isSelected = r.id === activeRoleId;
                const assignedUsers = r._count?.users || 0;

                return (
                  <div
                    key={r.id}
                    onClick={() => selectRole(r)}
                    className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-primary-50 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-800 text-primary-900 dark:text-primary-100'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-transparent'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-sm truncate">{r.name}</p>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <LuUsers size={12} /> {assignedUsers} staff assigned
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          initiateDelete(r);
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete Role"
                      >
                        <LuTrash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Permissions Matrix Panel */}
          <div className="lg:col-span-3 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col space-y-4">
            {activeRole ? (
              <>
                {/* Role Info Bar & Save */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={editedRoleName}
                        onChange={(e) => setEditedRoleName(e.target.value)}
                        className="text-lg font-bold text-slate-900 dark:text-white bg-transparent border-b border-dashed border-slate-300 dark:border-slate-700 focus:border-primary-500 focus:outline-none px-1"
                        placeholder="Role Name"
                      />
                      <span className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg shrink-0">
                        {activeRole._count?.users || 0} Staff Assigned
                      </span>
                    </div>
                    <input
                      type="text"
                      value={editedRoleDesc}
                      onChange={(e) => setEditedRoleDesc(e.target.value)}
                      placeholder="Add an optional description for this role..."
                      className="text-xs text-slate-500 dark:text-slate-400 bg-transparent border-b border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-primary-500 focus:outline-none w-full px-1"
                    />
                  </div>

                  <button
                    onClick={handleSaveActiveRole}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white font-semibold text-sm rounded-xl hover:bg-primary-700 shadow-sm disabled:opacity-50 transition-all shrink-0"
                  >
                    <LuSave size={18} />
                    {saving ? 'Saving...' : 'Save Permissions'}
                  </button>
                </div>

                {/* Filter and Bulk Action Controls */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-sm">
                    <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Filter modules (e.g. Fees, Attendance)..."
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-800 dark:text-slate-200"
                    />
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={handleGrantAll}
                      className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-lg transition-colors"
                      title="Grant all CRUD permissions across all modules"
                    >
                      Grant All
                    </button>
                    <button
                      type="button"
                      onClick={handleRevokeAll}
                      className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 font-semibold rounded-lg transition-colors"
                      title="Clear all permissions"
                    >
                      Revoke All
                    </button>
                  </div>
                </div>

                {/* Permissions Table - Independently Scrollable Section */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                  <div className="max-h-[500px] overflow-y-auto overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-800 shadow-sm">
                        <tr className="border-b border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          <th className="py-3 px-4 bg-slate-50 dark:bg-slate-800">Module Name</th>
                          <th className="py-3 px-3 text-center bg-slate-50 dark:bg-slate-800">Create</th>
                          <th className="py-3 px-3 text-center bg-slate-50 dark:bg-slate-800">Read / View</th>
                          <th className="py-3 px-3 text-center bg-slate-50 dark:bg-slate-800">Update / Edit</th>
                          <th className="py-3 px-3 text-center bg-slate-50 dark:bg-slate-800">Delete</th>
                          <th className="py-3 px-4 text-right bg-slate-50 dark:bg-slate-800">Quick Select</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
                        {filteredModules.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="py-8 text-center text-xs text-slate-400">
                              No modules match "{searchTerm}"
                            </td>
                          </tr>
                        ) : (
                          filteredModules.map(m => {
                            const key = m.id.toLowerCase();
                            const p = editedPermissions[key] || { canCreate: false, canRead: false, canUpdate: false, canDelete: false };
                            const isAllActive = p.canCreate && p.canRead && p.canUpdate && p.canDelete;

                            return (
                              <tr key={m.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                                <td className="py-3.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                                  {m.label || m.name || m.id}
                                </td>

                                {/* Create Checkbox */}
                                <td className="py-3.5 px-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(p.canCreate)}
                                    onChange={() => handleTogglePermission(m.id, 'canCreate')}
                                    className="w-4 h-4 text-primary-600 rounded border-slate-300 dark:border-slate-700 focus:ring-primary-500 cursor-pointer"
                                  />
                                </td>

                                {/* Read Checkbox */}
                                <td className="py-3.5 px-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(p.canRead)}
                                    onChange={() => handleTogglePermission(m.id, 'canRead')}
                                    className="w-4 h-4 text-primary-600 rounded border-slate-300 dark:border-slate-700 focus:ring-primary-500 cursor-pointer"
                                  />
                                </td>

                                {/* Update Checkbox */}
                                <td className="py-3.5 px-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(p.canUpdate)}
                                    onChange={() => handleTogglePermission(m.id, 'canUpdate')}
                                    className="w-4 h-4 text-primary-600 rounded border-slate-300 dark:border-slate-700 focus:ring-primary-500 cursor-pointer"
                                  />
                                </td>

                                {/* Delete Checkbox */}
                                <td className="py-3.5 px-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(p.canDelete)}
                                    onChange={() => handleTogglePermission(m.id, 'canDelete')}
                                    className="w-4 h-4 text-primary-600 rounded border-slate-300 dark:border-slate-700 focus:ring-primary-500 cursor-pointer"
                                  />
                                </td>

                                {/* Quick Select Buttons */}
                                <td className="py-3.5 px-4 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleQuickSelectRow(m.id, !isAllActive)}
                                    className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                                      isAllActive
                                        ? 'bg-primary-100 dark:bg-primary-950 text-primary-700 dark:text-primary-300 hover:bg-primary-200'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                    }`}
                                  >
                                    {isAllActive ? 'Clear' : 'Select All'}
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-12 text-center text-slate-400">
                Select a role from the left to configure permissions.
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE ROLE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LuShield className="text-primary-600" size={20} />
                <h3 className="font-bold text-slate-900 dark:text-white">Create Custom Role</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <LuX size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateRoleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Role Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Principal, Class Teacher, Accountant"
                    value={createRoleData.name}
                    onChange={(e) => setCreateRoleData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    placeholder="Brief description of responsibilities..."
                    value={createRoleData.description}
                    onChange={(e) => setCreateRoleData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              {/* Matrix */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                    Assign Module CRUD Permissions *
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const updated = {};
                        modules.forEach(m => {
                          updated[m.id.toLowerCase()] = { canCreate: true, canRead: true, canUpdate: true, canDelete: true };
                        });
                        setCreateRoleData(prev => ({ ...prev, permissions: updated }));
                      }}
                      className="text-[11px] font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400"
                    >
                      Grant All
                    </button>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = {};
                        modules.forEach(m => {
                          updated[m.id.toLowerCase()] = { canCreate: false, canRead: false, canUpdate: false, canDelete: false };
                        });
                        setCreateRoleData(prev => ({ ...prev, permissions: updated }));
                      }}
                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-72 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10 shadow-sm border-b border-slate-200 dark:border-slate-700">
                      <tr className="text-slate-500 dark:text-slate-400 font-bold uppercase">
                        <th className="py-2.5 px-3 bg-slate-50 dark:bg-slate-800">Module</th>
                        <th className="py-2.5 px-2 text-center bg-slate-50 dark:bg-slate-800">Create</th>
                        <th className="py-2.5 px-2 text-center bg-slate-50 dark:bg-slate-800">Read</th>
                        <th className="py-2.5 px-2 text-center bg-slate-50 dark:bg-slate-800">Update</th>
                        <th className="py-2.5 px-2 text-center bg-slate-50 dark:bg-slate-800">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {modules.map(m => {
                        const key = m.id.toLowerCase();
                        const p = createRoleData.permissions[key] || { canCreate: false, canRead: false, canUpdate: false, canDelete: false };

                        return (
                          <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">
                              {m.label || m.name || m.id}
                            </td>
                            <td className="py-2 px-2 text-center">
                              <input
                                type="checkbox"
                                checked={p.canCreate}
                                onChange={() => handleToggleCreatePerm(m.id, 'canCreate')}
                                className="w-3.5 h-3.5 text-primary-600 rounded"
                              />
                            </td>
                            <td className="py-2 px-2 text-center">
                              <input
                                type="checkbox"
                                checked={p.canRead}
                                onChange={() => handleToggleCreatePerm(m.id, 'canRead')}
                                className="w-3.5 h-3.5 text-primary-600 rounded"
                              />
                            </td>
                            <td className="py-2 px-2 text-center">
                              <input
                                type="checkbox"
                                checked={p.canUpdate}
                                onChange={() => handleToggleCreatePerm(m.id, 'canUpdate')}
                                className="w-3.5 h-3.5 text-primary-600 rounded"
                              />
                            </td>
                            <td className="py-2 px-2 text-center">
                              <input
                                type="checkbox"
                                checked={p.canDelete}
                                onChange={() => handleToggleCreatePerm(m.id, 'canDelete')}
                                className="w-3.5 h-3.5 text-primary-600 rounded"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-sm disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title={`Delete Role: ${deleteModal.roleName}`}
        message={
          deleteModal.assignedCount > 0
            ? `⚠️ Cannot delete this role: ${deleteModal.assignedCount} staff member(s) are currently assigned to "${deleteModal.roleName}". Please reassign them in the Staff Directory first.`
            : `Are you sure you want to delete the role "${deleteModal.roleName}"? This action cannot be undone.`
        }
        confirmText={deleteModal.assignedCount > 0 ? "Understood" : "Delete Role"}
        confirmColor={deleteModal.assignedCount > 0 ? "bg-slate-600 hover:bg-slate-700" : "bg-red-600 hover:bg-red-700"}
        onConfirm={confirmDeleteRole}
        onCancel={() => setDeleteModal({ isOpen: false, roleId: null, roleName: '', assignedCount: 0 })}
      />
    </div>
  );
}
