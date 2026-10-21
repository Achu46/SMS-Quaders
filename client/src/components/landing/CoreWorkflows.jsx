import React, { useRef, useState, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { MeshDistortMaterial, Float } from '@react-three/drei';

function WorkflowIcon3D({ type, reducedMotion, isDark }) {
  const meshRef = useRef(null);

  useFrame((state) => {
    if (meshRef.current && !reducedMotion) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.5;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.3;
    }
  });

  // Assign a shape based on the workflow type
  const getGeometry = () => {
    switch (type) {
      case 'attendance': return <torusGeometry args={[1, 0.4, 16, 32]} />; // Checkmark/calendar abstract
      case 'leave': return <boxGeometry args={[1.5, 1.5, 0.5]} />; // Document abstract
      case 'fees': return <cylinderGeometry args={[1, 1, 0.5, 32]} />; // Coin abstract
      default: return <sphereGeometry args={[1, 32, 32]} />;
    }
  };

  return (
    <Float speed={reducedMotion ? 0 : 3} rotationIntensity={reducedMotion ? 0 : 0.5} floatIntensity={reducedMotion ? 0 : 1}>
      <mesh ref={meshRef} scale={1.2}>
        {getGeometry()}
        <MeshDistortMaterial 
          color="#F97316"
          emissive="#FB923C"
          emissiveIntensity={isDark ? 0.8 : 0.4}
          roughness={0.2}
          distort={reducedMotion ? 0 : 0.2} 
          speed={reducedMotion ? 0 : 2} 
          transparent
          opacity={0.9}
        />
      </mesh>
    </Float>
  );
}

function WorkflowCard({ title, desc, type, idx, reducedMotion, isDark }) {
  const cardRef = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Smooth out the motion values for the pseudo-3D tilt
  const mouseXSpring = useSpring(x, { stiffness: 100, damping: 20 });
  const mouseYSpring = useSpring(y, { stiffness: 100, damping: 20 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);

  const handleMouseMove = (e) => {
    if (!cardRef.current || reducedMotion) return;
    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Normalize values between -0.5 and 0.5
    x.set(mouseX / width - 0.5);
    y.set(mouseY / height - 0.5);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div 
      ref={cardRef}
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: idx * 0.1 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={reducedMotion ? {} : { rotateX, rotateY, transformStyle: "preserve-3d" }}
      className="group relative bg-white/60 dark:bg-[#0f172a]/60 backdrop-blur-xl border border-slate-200 dark:border-primary-900/30 p-8 rounded-[32px] hover:border-primary-500/50 hover:shadow-[0_20px_40px_rgba(249,115,22,0.15)] transition-colors h-full flex flex-col"
    >
      <div 
        className="w-16 h-16 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-[#1e293b] dark:to-[#3d2025] rounded-2xl flex items-center justify-center mb-6 shadow-lg border border-primary-200 dark:border-primary-900/50 relative overflow-hidden pointer-events-none"
        style={{ transform: "translateZ(30px)" }} // Pop out the icon container during tilt
      >
        {/* Render Canvas inline, fallback for low end */}
        {!reducedMotion ? (
          <div className="absolute inset-[-10px]">
            <Canvas camera={{ position: [0, 0, 3], fov: 45 }}>
              <ambientLight intensity={isDark ? 0.3 : 1} />
              <directionalLight position={[5, 5, 5]} intensity={1} color="#F97316" />
              <WorkflowIcon3D type={type} reducedMotion={reducedMotion} isDark={isDark} />
            </Canvas>
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-primary-500 shadow-[0_0_15px_#F97316]" />
        )}
      </div>
      <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white" style={{ transform: "translateZ(20px)" }}>{title}</h3>
      <p className="text-slate-600 dark:text-[#94a3b8] leading-relaxed flex-grow" style={{ transform: "translateZ(10px)" }}>
        {desc}
      </p>

      {/* Hover Glow Effect inside the card */}
      <div className="absolute inset-0 rounded-[32px] bg-gradient-to-br from-primary-500/0 to-primary-500/0 group-hover:from-primary-500/5 group-hover:to-primary-500/0 pointer-events-none transition-all duration-300" />
    </motion.div>
  );
}

export default function CoreWorkflows() {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const checkPerformance = () => {
      setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.innerWidth < 768);
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkPerformance();
    window.addEventListener('resize', checkPerformance);
    
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      window.removeEventListener('resize', checkPerformance);
      observer.disconnect();
    };
  }, []);

  const workflows = [
    { type: 'attendance', title: "Attendance Tracking", desc: "Real-time tracking for students and staff with instant alerts and geofencing capabilities." },
    { type: 'leave', title: "Leave Management", desc: "Automated workflows for leave requests, approvals, and balance tracking." },
    { type: 'fees', title: "Fee & Payments", desc: "Automate invoicing, online payments, and financial reporting with direct bank integrations." }
  ];

  return (
    <section id="services" className="py-32 px-6 max-w-7xl mx-auto scroll-mt-20 relative z-10" style={{ perspective: "1000px" }}>
      <motion.div 
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8 }}
        className="text-center mb-20"
      >
        <h2 className="text-4xl lg:text-5xl font-black mb-4 tracking-tight text-slate-900 dark:text-white">Core Workflows</h2>
        <p className="text-lg text-slate-600 dark:text-[#94a3b8] max-w-2xl mx-auto">Everything you need to run your institution, redesigned for speed and clarity.</p>
      </motion.div>
      
      <div className="grid md:grid-cols-3 gap-8">
        {workflows.map((workflow, idx) => (
          <WorkflowCard 
            key={idx} 
            idx={idx} 
            {...workflow} 
            reducedMotion={reducedMotion} 
            isDark={isDark} 
          />
        ))}
      </div>
    </section>
  );
}
