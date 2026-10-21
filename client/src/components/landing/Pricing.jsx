import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { subscribeToSubscriptionPlans } from '../../firebase/firestore';
import { LuCheck, LuX } from 'react-icons/lu';

export default function Pricing() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);

  useEffect(() => {
    const unsub = subscribeToSubscriptionPlans((data) => {
      const order = ['base', 'standard', 'premium', 'enterprise'];
      const sortedPlans = [...data].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      const visiblePlans = sortedPlans.filter(plan => plan.active !== false);
      setPlans(visiblePlans);
    });

    return () => unsub();
  }, []);

  return (
    <section id="pricing" className="py-32 px-6 scroll-mt-20 relative bg-slate-50 dark:bg-[#0f0e15] transition-colors duration-300">
      <div className="absolute inset-0 bg-gradient-to-b from-white via-transparent to-white dark:from-[#020617] dark:to-[#020617] pointer-events-none transition-colors duration-300"></div>
      
      <div className="relative z-10 max-w-7xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl lg:text-5xl font-black mb-4 tracking-tight text-slate-900 dark:text-white">Simple, transparent pricing</h2>
          <p className="text-lg text-slate-600 dark:text-[#94a3b8] max-w-2xl mx-auto">Choose the perfect plan for your institution. Upgrade at any time as your school grows.</p>
        </motion.div>
        
        {plans.length === 0 ? (
          <div className="flex justify-center items-center h-64">
            <div className="w-10 h-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar pb-8 pt-6 -mt-6 px-2 -mx-2">
            <div className={`min-w-[1000px] grid gap-8 justify-center ${
              plans.length === 1 ? 'grid-cols-1 max-w-md mx-auto' :
              plans.length === 2 ? 'grid-cols-2 max-w-3xl mx-auto' :
              plans.length === 3 ? 'grid-cols-3 max-w-5xl mx-auto' :
              'grid-cols-4'
            }`}>
              {plans.map((plan, idx) => {
                const isPopular = plan.id === 'premium';
                
                return (
                  <motion.div 
                    key={plan.id}
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: idx * 0.1 }}
                    className={`w-full max-w-[280px] mx-auto rounded-3xl flex flex-col relative transition-all duration-300 ${
                      isPopular 
                        ? 'bg-white dark:bg-gradient-to-b dark:from-[#1e293b] dark:to-[#0f172a] border-2 border-primary-500 dark:border-primary-400 shadow-xl shadow-primary-500/10 dark:shadow-[0_0_30px_rgba(249,115,22,0.15)] z-10 scale-105' 
                        : 'bg-white/60 dark:bg-[#0f172a]/60 backdrop-blur-xl border border-slate-200 dark:border-primary-900/40 hover:border-primary-300 dark:hover:border-primary-400/40 mt-4'
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary-500 dark:bg-primary-400 text-white dark:text-[#020617] font-bold text-xs uppercase tracking-widest py-1 px-4 rounded-full shadow-md">
                        Most Popular
                      </div>
                    )}
                    
                    <div className={`p-6 border-b ${isPopular ? 'border-primary-100 dark:border-primary-900/50' : 'border-slate-100 dark:border-primary-900/30'}`}>
                      <h3 className="text-2xl font-black mb-4 uppercase tracking-wide text-center text-slate-900 dark:text-white">{plan.name}</h3>
                      <div className="text-center mb-6 h-16 flex flex-col justify-center">
                        {plan.custom ? (
                          <span className="text-3xl font-black text-slate-900 dark:text-[#f1f5f9]">Custom</span>
                        ) : (
                          <div className="flex flex-col items-center justify-center">
                            <div className="flex items-baseline gap-1">
                              <span className="text-4xl font-black text-primary-500 dark:text-primary-400">₹{plan.pricePerUserPerYear}</span>
                            </div>
                            <span className="text-slate-500 dark:text-[#94a3b8] font-medium text-sm">per user / year</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-3 mb-6">
                        <div className="flex justify-between items-center bg-slate-50 dark:bg-[#020617]/50 p-3 rounded-xl border border-slate-100 dark:border-primary-900/20">
                          <span className="text-slate-500 dark:text-[#94a3b8] text-sm font-medium">User Limit</span>
                          <span className="text-slate-900 dark:text-[#f1f5f9] font-bold">{plan.custom ? 'Unlimited' : plan.userLimit}</span>
                        </div>
                        <div className="flex justify-between items-center bg-slate-50 dark:bg-[#020617]/50 p-3 rounded-xl border border-slate-100 dark:border-primary-900/20">
                          <span className="text-slate-500 dark:text-[#94a3b8] text-sm font-medium">Storage</span>
                          <span className="text-slate-900 dark:text-[#f1f5f9] font-bold">{plan.custom ? 'Custom' : `${plan.cloudStorageGB} GB`}</span>
                        </div>
                      </div>

                      <button 
                        onClick={() => navigate(plan.custom ? '#contact' : `/register?plan=${plan.id}`)}
                        className={`w-full py-3.5 font-bold text-sm uppercase tracking-wider rounded-xl transition-all shadow-sm ${
                          isPopular 
                            ? 'bg-primary-500 text-white hover:bg-primary-600 dark:bg-primary-400 dark:text-[#020617] dark:hover:bg-primary-300' 
                            : 'bg-slate-800 text-white hover:bg-slate-900 dark:bg-[#1e293b] dark:hover:bg-[#f97316]'
                        }`}
                      >
                        {plan.custom ? 'Contact Us' : 'Get Started'}
                      </button>
                    </div>
                    
                    <div className="p-6 flex-1">
                      <h4 className="text-xs font-bold text-slate-500 dark:text-[#94a3b8] uppercase tracking-widest mb-4 text-center">Modules Included</h4>
                      <ul className="space-y-4">
                        {[
                          { key: 'staffManagement', label: 'Staff Management' },
                          { key: 'studentManagement', label: 'Student Management' },
                          { key: 'timetable', label: 'Timetable' },
                          { key: 'feeManagement', label: 'Fee Management' },
                          { key: 'attendance', label: 'Attendance' },
                          { key: 'exams', label: 'Exams & Reports' }
                        ].map((mod) => {
                          const isIncluded = plan.modules && plan.modules[mod.key];
                          return (
                            <li key={mod.key} className="flex justify-between items-center border-b border-slate-100 dark:border-primary-900/20 pb-3 last:border-0 last:pb-0">
                              <span className={`text-sm font-medium ${isIncluded ? 'text-slate-900 dark:text-[#f1f5f9]' : 'text-slate-400 dark:text-[#94a3b8]'}`}>{mod.label}</span>
                              {isIncluded ? (
                                <div className="text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-400/10 p-1 rounded-full"><LuCheck size={14} strokeWidth={3} /></div>
                              ) : (
                                <div className="text-slate-300 dark:text-red-400/50 p-1 rounded-full"><LuX size={14} strokeWidth={3} /></div>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
