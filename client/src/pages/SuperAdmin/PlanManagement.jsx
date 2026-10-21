import React, { useState, useEffect } from 'react';
import { subscribeToSubscriptionPlans, updateSubscriptionPlan, initializeDefaultSubscriptionPlans } from '../../firebase/firestore';
import { LuPlus as Plus, LuPen as Edit2, LuCheck as Check, LuX as X, LuSave as Save, LuSettings as Settings, LuDatabase as Database, LuCreditCard, LuSparkles } from 'react-icons/lu';
import toast from 'react-hot-toast';

const ALL_MODULES = {
  staffManagement: 'Staff Management',
  studentManagement: 'Student Management',
  timetable: 'Timetable Management',
  feeManagement: 'Fee Management',
  attendance: 'Attendance Tracking',
  exams: 'Exam & Report Cards',
  library: 'Library Management',
  transport: 'Transport Management',
  lms: 'LMS Integration',
  apiIntegration: '3rd Party API Integration'
};

const PLAN_ORDER = ['base', 'standard', 'premium', 'enterprise'];

export default function PlanManagement() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentPlan, setCurrentPlan] = useState(null);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToSubscriptionPlans((data) => {
      const sortedPlans = [...(data || [])].sort((a, b) => PLAN_ORDER.indexOf(a.id) - PLAN_ORDER.indexOf(b.id));
      setPlans(sortedPlans);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleInitializeDefaults = async () => {
    setLoading(true);
    try {
      await initializeDefaultSubscriptionPlans();
      toast.success("Default subscription plans initialized successfully!");
    } catch (err) {
      toast.error("Failed to initialize plans.");
    } finally {
      setLoading(false);
    }
  };

  const openEditor = (plan) => {
    setCurrentPlan(JSON.parse(JSON.stringify(plan)));
    setIsEditing(true);
  };

  const closeEditor = () => {
    setIsEditing(false);
    setCurrentPlan(null);
  };

  const handleSavePlan = async () => {
    setLoading(true);
    try {
      await updateSubscriptionPlan(currentPlan.id, currentPlan);
      toast.success(`${currentPlan.name} updated successfully!`);
      closeEditor();
    } catch (error) {
      console.error("Error saving plan:", error);
      toast.error("Failed to update plan.");
    } finally {
      setLoading(false);
    }
  };

  const handleModuleToggle = (moduleKey) => {
    setCurrentPlan(prev => ({
      ...prev,
      modules: {
        ...(prev.modules || {}),
        [moduleKey]: !(prev.modules && prev.modules[moduleKey])
      }
    }));
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-white via-white to-orange-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-orange-950/20 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/25">
            <LuCreditCard size={28} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Subscription Plans & Limits
            </h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
              Manage multi-tier pricing, user caps, storage limits, and module access for schools.
            </p>
          </div>
        </div>

        <button 
          onClick={handleInitializeDefaults}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm border border-slate-200 dark:border-slate-700 transition-colors shadow-sm shrink-0"
        >
          <Database size={16} /> Reset Default Tiers
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="w-10 h-10 animate-spin rounded-full border-4 border-orange-500/20 border-t-orange-500"></div>
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-12 rounded-3xl border border-slate-200/80 dark:border-slate-800 text-center shadow-sm">
          <Settings size={48} className="mx-auto text-orange-400 mb-4" />
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Plans Configured</h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6">Click "Reset Default Tiers" to initialize the standard 4-tier pricing model.</p>
          <button 
            onClick={handleInitializeDefaults}
            className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md shadow-orange-500/20"
          >
            <Database size={18} /> Initialize Default Plans
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map(plan => {
            const price = plan.pricePerUserPerYear !== undefined ? plan.pricePerUserPerYear : (plan.price || 0);
            const userLimit = plan.userLimit || plan.studentLimit || 100;
            const storage = plan.cloudStorageGB || 5;

            return (
              <div 
                key={plan.id} 
                className={`bg-white dark:bg-slate-900 rounded-3xl border overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col ${
                  plan.id === 'premium' 
                    ? 'border-orange-500/50 dark:border-orange-500/40 ring-2 ring-orange-500/20' 
                    : 'border-slate-200/80 dark:border-slate-800'
                }`}
              >
                {/* Tier Card Header */}
                <div className={`p-6 border-b ${
                  plan.id === 'premium' 
                    ? 'bg-gradient-to-b from-orange-500/10 to-transparent border-orange-500/20' 
                    : 'bg-slate-50/70 dark:bg-slate-950/40 border-slate-100 dark:border-slate-800'
                }`}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{plan.name}</h3>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${plan.active !== false ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          {plan.active !== false ? 'Active Tier' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    {plan.id === 'premium' && (
                      <span className="text-[10px] font-black uppercase tracking-wider bg-orange-600 text-white px-2.5 py-1 rounded-full shadow-md shadow-orange-500/30 flex items-center gap-1">
                        <LuSparkles size={11} /> Popular
                      </span>
                    )}
                  </div>
                  
                  <div className="mb-3">
                    {plan.custom ? (
                      <span className="text-3xl font-black text-slate-900 dark:text-white">Custom</span>
                    ) : (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs font-bold text-slate-400">INR</span>
                        <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{price}</span>
                        <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold">/user/year</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
                      <span>{plan.custom ? 'Unlimited Users' : `Up to ${userLimit} Users`}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
                      <span>{plan.custom ? 'Custom Storage' : `${storage} GB Cloud Storage`}</span>
                    </div>
                  </div>
                </div>

                {/* Modules Included */}
                <div className="p-6 flex-1 bg-white dark:bg-slate-900 space-y-3">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Included Modules</h4>
                  <ul className="space-y-2.5">
                    {Object.entries(ALL_MODULES).map(([key, label]) => {
                      const hasModule = plan.modules ? !!plan.modules[key] : true;
                      return (
                        <li key={key} className="flex items-center gap-2.5 text-xs">
                          {hasModule ? (
                            <div className="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-0.5 rounded-md shrink-0">
                              <Check size={12} strokeWidth={3} />
                            </div>
                          ) : (
                            <div className="text-slate-300 dark:text-slate-600 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-md shrink-0">
                              <X size={12} strokeWidth={3} />
                            </div>
                          )}
                          <span className={hasModule ? 'font-semibold text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-600 line-through'}>
                            {label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* Action Footer */}
                <div className="p-4 bg-slate-50/80 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800 shrink-0">
                  <button 
                    onClick={() => openEditor(plan)}
                    className="w-full flex items-center justify-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-orange-500/50 text-slate-700 dark:text-slate-200 hover:text-orange-600 dark:hover:text-orange-400 px-4 py-2.5 text-xs font-bold rounded-xl transition-all shadow-sm"
                  >
                    <Edit2 size={14} /> Edit Plan Details
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Plan Editor Modal */}
      {isEditing && currentPlan && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/80 dark:bg-slate-950/40 shrink-0">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Edit {currentPlan.name}</h2>
              <button 
                onClick={closeEditor} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl p-2 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Plan Name
                  </label>
                  <input
                    type="text"
                    value={currentPlan.name || ''}
                    onChange={(e) => setCurrentPlan(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Price (INR/user/year)
                  </label>
                  <input
                    type="number"
                    value={currentPlan.pricePerUserPerYear ?? currentPlan.price ?? 0}
                    onChange={(e) => setCurrentPlan(prev => ({ ...prev, pricePerUserPerYear: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                    User Cap Limit
                  </label>
                  <input
                    type="number"
                    value={currentPlan.userLimit || currentPlan.studentLimit || 100}
                    onChange={(e) => setCurrentPlan(prev => ({ ...prev, userLimit: parseInt(e.target.value) || 100 }))}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Cloud Storage (GB)
                  </label>
                  <input
                    type="number"
                    value={currentPlan.cloudStorageGB || 5}
                    onChange={(e) => setCurrentPlan(prev => ({ ...prev, cloudStorageGB: parseInt(e.target.value) || 5 }))}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-3">
                  Permitted Modules
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {Object.entries(ALL_MODULES).map(([key, label]) => {
                    const isEnabled = currentPlan.modules ? !!currentPlan.modules[key] : false;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleModuleToggle(key)}
                        className={`p-3 rounded-xl border text-xs font-bold text-left flex items-center justify-between transition-all ${
                          isEnabled 
                            ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/40' 
                            : 'bg-slate-50 dark:bg-slate-950/60 text-slate-500 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <span>{label}</span>
                        {isEnabled ? <Check size={14} className="text-orange-500" /> : <X size={14} className="text-slate-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40 flex justify-end gap-3 shrink-0">
              <button 
                onClick={closeEditor}
                className="px-5 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSavePlan}
                className="px-6 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold shadow-md shadow-orange-500/25 transition-all flex items-center gap-2"
              >
                <Save size={16} /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
