import React, { useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate, useInView } from 'framer-motion';

function Counter({ from, to, duration, prefix = "", suffix = "" }) {
  const count = useMotionValue(from);
  const rounded = useTransform(count, (latest) => Math.round(latest));
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  useEffect(() => {
    if (isInView) {
      const controls = animate(count, to, { 
        duration: duration, 
        ease: "easeOut" 
      });
      return controls.stop;
    }
  }, [count, to, duration, isInView]);

  return (
    <div className="flex items-center justify-center font-black text-4xl md:text-5xl lg:text-6xl text-slate-900 dark:text-white" ref={ref}>
      <span>{prefix}</span>
      <motion.span>{rounded}</motion.span>
      <span className="text-primary-500">{suffix}</span>
    </div>
  );
}

export default function TrustBar() {
  return (
    <section className="py-20 relative border-y border-slate-200 dark:border-primary-900/30 bg-white/50 dark:bg-[#0f172a]/30 backdrop-blur-sm overflow-hidden z-20">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-12 text-center divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-primary-900/30">
        
        <div className="flex flex-col gap-2 pt-6 md:pt-0 relative">
          <motion.div 
            initial={{ scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="absolute -right-6 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-primary-500/50 to-transparent hidden md:block"
          />
          <Counter from={0} to={200} duration={2.5} suffix="+" />
          <span className="text-slate-500 dark:text-[#94a3b8] font-medium tracking-wide uppercase text-sm">Schools Powered</span>
        </div>

        <div className="flex flex-col gap-2 pt-12 md:pt-0 relative">
          <motion.div 
            initial={{ scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="absolute -right-6 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-primary-500/50 to-transparent hidden md:block"
          />
          <Counter from={0} to={50} duration={2} suffix="k+" />
          <span className="text-slate-500 dark:text-[#94a3b8] font-medium tracking-wide uppercase text-sm">Active Students</span>
        </div>

        <div className="flex flex-col gap-2 pt-12 md:pt-0">
          <Counter from={0} to={99} duration={3} suffix=".9%" />
          <span className="text-slate-500 dark:text-[#94a3b8] font-medium tracking-wide uppercase text-sm">Platform Uptime</span>
        </div>

      </div>
    </section>
  );
}
