import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ROLES = [
  { id: 'super_admin', label: 'Super Admin', color: 'text-primary-500' },
  { id: 'admin', label: 'Admin', color: 'text-emerald-500' },
  { id: 'teacher', label: 'Teacher', color: 'text-blue-500' },
  { id: 'parent', label: 'Parent', color: 'text-purple-500' }
];

const ROLE_CONTENT = {
  super_admin: {
    title: 'Global Oversight',
    desc: 'Manage multiple school branches, monitor global analytics, configure tenant limits, and handle subscription billing from a single powerful dashboard.',
    features: ['Multi-tenant management', 'Global financial reporting', 'System audit logs']
  },
  admin: {
    title: 'School Operations',
    desc: 'Run your daily operations efficiently. Manage staff payroll, student admissions, fee collections, and generate compliance reports.',
    features: ['Fee management', 'Staff attendance & payroll', 'Student records']
  },
  teacher: {
    title: 'Classroom Control',
    desc: 'Focus on teaching, not paperwork. Take attendance in seconds, grade exams digitally, and communicate directly with parents.',
    features: ['One-click attendance', 'Digital gradebook', 'Homework assignments']
  },
  parent: {
    title: 'Student Success',
    desc: 'Stay involved in your child’s education. Pay fees online securely, track attendance, and receive instant alerts for exams and events.',
    features: ['Online fee payment', 'Real-time attendance alerts', 'Direct teacher messaging']
  }
};

export default function RoleAccess() {
  const [activeRole, setActiveRole] = useState(ROLES[0].id);

  const content = ROLE_CONTENT[activeRole];

  return (
    <section className="py-32 px-6 max-w-7xl mx-auto overflow-hidden">
      <motion.div 
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.8 }}
        className="text-center mb-16"
      >
        <h2 className="text-4xl lg:text-5xl font-black mb-4 tracking-tight text-slate-900 dark:text-white">Built for everyone</h2>
        <p className="text-lg text-slate-600 dark:text-[#94a3b8] max-w-2xl mx-auto">Different roles require different tools. Quaders adapts to give you exactly what you need.</p>
      </motion.div>

      <div className="flex flex-col items-center max-w-4xl mx-auto">
        {/* Segmented Control */}
        <div className="flex p-1.5 bg-slate-100 dark:bg-[#0f172a] rounded-full mb-12 border border-slate-200 dark:border-primary-900/30 overflow-x-auto w-full md:w-auto custom-scrollbar shadow-inner">
          {ROLES.map((role) => (
            <button
              key={role.id}
              onClick={() => setActiveRole(role.id)}
              className={`relative px-6 py-3 rounded-full text-sm md:text-base font-bold transition-colors whitespace-nowrap outline-none ${
                activeRole === role.id ? 'text-white' : 'text-slate-500 dark:text-[#94a3b8] hover:text-slate-900 dark:hover:text-slate-300'
              }`}
            >
              {activeRole === role.id && (
                <motion.div
                  layoutId="activeRoleTab"
                  className="absolute inset-0 bg-primary-500 rounded-full shadow-md"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <span className="relative z-10">{role.label}</span>
            </button>
          ))}
        </div>

        {/* Content Panel */}
        <div className="w-full relative min-h-[300px] md:min-h-[250px] bg-white dark:bg-[#0f172a]/40 backdrop-blur-md border border-slate-200 dark:border-primary-900/30 rounded-3xl p-8 md:p-12 shadow-xl overflow-hidden">
          
          {/* Subtle Background Glow behind the panel to maintain visual interest without 3D */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary-500/10 rounded-full blur-[80px] pointer-events-none" />

          <AnimatePresence mode="wait">
            <motion.div
              key={activeRole}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="relative z-10 grid md:grid-cols-2 gap-8 items-center h-full"
            >
              <div>
                <h3 className="text-3xl font-black mb-4 text-slate-900 dark:text-white">{content.title}</h3>
                <p className="text-slate-600 dark:text-[#94a3b8] leading-relaxed mb-6 text-lg">{content.desc}</p>
              </div>
              
              <div className="bg-slate-50 dark:bg-[#020617]/60 p-6 rounded-2xl border border-slate-100 dark:border-primary-900/20 shadow-sm">
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-[#94a3b8] mb-4">Key Features</h4>
                <ul className="space-y-4">
                  {content.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-slate-700 dark:text-[#f1f5f9] font-medium">
                      <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-500 flex items-center justify-center shrink-0 shadow-sm">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
