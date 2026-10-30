import React from 'react';
import { motion } from 'framer-motion';
import { LuShieldCheck, LuZap, LuGlobe } from 'react-icons/lu';

const DIFFERENTIATORS = [
  {
    icon: LuZap,
    title: "Lightning Fast",
    desc: "Built on a modern React and Express stack, ensuring instant loads and real-time updates for thousands of users."
  },
  {
    icon: LuShieldCheck,
    title: "Bank-Grade Security",
    desc: "Multi-tenant architecture with isolated data silos and end-to-end encryption for absolute peace of mind."
  },
  {
    icon: LuGlobe,
    title: "Global Scalability",
    desc: "Deploy anywhere. queflow is designed to scale horizontally across multiple branches or a single campus."
  }
];

export default function Whyqueflow() {
  return (
    <section className="py-32 px-6 max-w-7xl mx-auto border-t border-slate-200 dark:border-primary-900/30">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8 }}
        className="text-center mb-20"
      >
        <h2 className="text-4xl lg:text-5xl font-black mb-4 tracking-tight text-slate-900 dark:text-white">Why queflow?</h2>
        <p className="text-lg text-slate-600 dark:text-[#94a3b8] max-w-2xl mx-auto">We didn't just build another school management system. We re-engineered how schools operate from the ground up.</p>
      </motion.div>

      <div className="grid md:grid-cols-3 gap-12 lg:gap-16">
        {DIFFERENTIATORS.map((item, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: idx * 0.1 }}
            className="flex flex-col items-center text-center group"
          >
            {/* Subtle float animation (idle breathing) */}
            <motion.div
              animate={{ y: [-5, 5] }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                repeatType: "mirror",
                ease: "easeInOut",
                delay: idx * 0.2 // offset the breathing 
              }}
              className="w-20 h-20 bg-primary-50 dark:bg-[#0f172a] rounded-full flex items-center justify-center mb-8 border border-primary-100 dark:border-primary-900/40 shadow-sm text-primary-500 group-hover:scale-110 group-hover:bg-primary-100 dark:group-hover:bg-[#1e293b] transition-all"
            >
              <item.icon size={32} />
            </motion.div>

            <h3 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">{item.title}</h3>
            <p className="text-slate-600 dark:text-[#94a3b8] leading-relaxed">
              {item.desc}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
